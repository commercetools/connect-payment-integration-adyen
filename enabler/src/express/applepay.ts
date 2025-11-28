import { ApplePay, ICore, PaymentMethod } from "@adyen/adyen-web";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";
import { DefaultAdyenExpressComponent } from "./base";
import {
  PaymentExpressBuilder,
  ExpressOptions,
} from "../payment-enabler/payment-enabler";

export class ApplePayExpressBuilder implements PaymentExpressBuilder {
  private adyenCheckout: ICore;
  private processorUrl: string;
  private sessionId: string;
  private countryCode: string;
  private currencyCode: string;
  private paymentMethodConfig: { [key: string]: string };
  private usesOwnCertificate: boolean;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.processorUrl = baseOptions.processorUrl;
    this.sessionId = baseOptions.sessionId;
    this.countryCode = baseOptions.countryCode;
    this.currencyCode = baseOptions.currencyCode;
    this.paymentMethodConfig = baseOptions.paymentMethodConfig;
  }

  build(config: ExpressOptions): ApplePayExpressComponent {
    const googlePayComponent = new ApplePayExpressComponent({
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      processorUrl: this.processorUrl,
      sessionId: this.sessionId,
      countryCode: this.countryCode,
      currencyCode: this.currencyCode,
      paymentMethodConfig: this.paymentMethodConfig,
      usesOwnCertificate: this.usesOwnCertificate,
    });
    googlePayComponent.init();

    return googlePayComponent;
  }
}

export class ApplePayExpressComponent extends DefaultAdyenExpressComponent {
  private adyenCheckout: ICore;
  public finalAmount: number;
  private paymentReference: string;
  private paymentMethod: PaymentMethod;
  private usesOwnCertificate: boolean;

  constructor(opts: {
    adyenCheckout: ICore;
    componentOptions: ExpressOptions;
    processorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
    paymentMethodConfig: { [key: string]: string };
    usesOwnCertificate?: boolean;
  }) {
    super({
      expressOptions: opts.componentOptions,
      processorUrl: opts.processorUrl,
      sessionId: opts.sessionId,
      countryCode: opts.countryCode,
      currencyCode: opts.currencyCode,
      paymentMethodConfig: opts.paymentMethodConfig,
    });
    this.usesOwnCertificate = opts.usesOwnCertificate;
    this.adyenCheckout = opts.adyenCheckout;
  }

  init(): void {
    const me = this;

    this.component = new ApplePay(this.adyenCheckout, {
      isExpress: true,
      buttonType: "pay",
      buttonColor: "black",
      amount: {
        currency: this.expressOptions.initialAmount.currencyCode,
        value: this.expressOptions.initialAmount.centAmount,
      },
      ...(this.usesOwnCertificate && {
        onValidateMerchant: this.onValidateMerchant.bind(this),
      }),
      requiredBillingContactFields: ["postalAddress", "email", "name"],
      requiredShippingContactFields: [
        "postalAddress",
        "name",
        "phoneticName",
        "email",
        "phone",
      ],
      configuration: {
        merchantId: this.paymentMethodConfig.merchantId,
        merchantName: this.paymentMethodConfig.merchantName,
      },
      onPaymentCompleted: (data, component) => {
        this.onComplete(
          {
            isSuccess: !!data.resultCode,
            paymentReference: this.paymentReference,
            method: this.paymentMethod,
          },
          component
        );
      },
      onClick: (resolve, reject) => {
        // TODO: we still need to implement Juans change in his branch
        return this.expressOptions
          .onPayButtonClick()
          .then((res) => {
            this.sessionId = res.sessionId;
            resolve();
          })
          .catch(() => reject());
      },
      onSubmit: async (state, component, actions) => {
        try {
          const reqData = {
            ...state.data,
            channel: "Web",
            countryCode: this.countryCode,
          };

          const response = await fetch(this.processorUrl + "/express-payments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": this.sessionId,
            },
            body: JSON.stringify(reqData),
          });
          const data = await response.json();

          this.paymentMethod = data.paymentMethod;

          this.paymentReference = data.paymentReference;
          this.paymentMethod = data.paymentMethod;
          if (!data.resultCode) {
            actions.reject();
            return;
          }

          if (data.action) {
            component.handleAction(data.action);
          } else {
            if (
              data.resultCode === "Authorised" ||
              data.resultCode === "Pending"
            ) {
              component.setStatus("success");
            } else {
              component.setStatus("error");
            }
          }

          actions.resolve({
            resultCode: data.resultCode,
            action: data.action,
          });
        } catch (error) {
          actions.reject(error);
        }
      },
      onShippingContactSelected: async (
        resolve,
        _reject,
        event: ApplePayJS.ApplePayShippingContactSelectedEvent
      ) => {
        const { countryCode, locality, postalCode } = event.shippingContact;

        await me.setShippingAddress({
          address: {
            country: countryCode,
            postalCode,
            city: locality,
            streetName: locality,
          },
        });
        // TODO: handle error scenarios (set shipping address not working for example)

        const shippingMethods = await this.fetchShippingMethods(countryCode);
        
        const updatedLineItemsWithTotal = await this.getLineItemsWithNewTotal(
          shippingMethods[0]
        );

        const update: Partial<ApplePayJS.ApplePayShippingContactUpdate> = {
          ...updatedLineItemsWithTotal,
          newShippingMethods: shippingMethods,
        };

        resolve(update);
      },
      onShippingMethodSelected: async (
        resolve,
        _reject,
        event: ApplePayJS.ApplePayShippingMethodSelectedEvent
      ) => {
        const { shippingMethod } = event;

        await me.setShippingMethod({
          shippingMethod: {
            id: shippingMethod.identifier,
          },
        });
        const updatedLineItemsWithTotal = await this.getLineItemsWithNewTotal(
          shippingMethod
        );

        const update: Partial<ApplePayJS.ApplePayShippingContactUpdate> = {
          ...updatedLineItemsWithTotal,
        };

        resolve(update);
      },
      onAuthorized: async (data, actions) => {
        const shippingAddress = this.convertAddress({
          address: data.deliveryAddress,
          email: data.authorizedEvent.payment.shippingContact.emailAddress,
          firstName: data.authorizedEvent.payment.shippingContact.givenName,
          lastName: data.authorizedEvent.payment.shippingContact.familyName,
          phoneNumber: data.authorizedEvent.payment.shippingContact.phoneNumber,
        });

        const billingAddress = this.convertAddress({
          address: data.billingAddress,
          email: data.authorizedEvent.payment.billingContact?.emailAddress,
          firstName: data.authorizedEvent.payment.billingContact.givenName,
          lastName: data.authorizedEvent.payment.billingContact.familyName,
          phoneNumber: data.authorizedEvent.payment.billingContact?.phoneNumber,
        });

        this.expressOptions
          .onPaymentSubmit({
            shippingAddress,
            billingAddress,
          })
          .then(() => actions.resolve())
          .catch((error) => {
            actions.reject(error);
          });
      },
    });
  }

  private onValidateMerchant(
    resolve: Function,
    reject: Function,
    validationUrl: string
  ) {
    fetch(`${this.processorUrl}/applepay-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify({
        validationUrl,
      }),
    })
      .then((res) => res.json())
      .then((merchantSession) => {
        resolve(merchantSession);
      })
      .catch((error) => {
        reject(error);
      });
  }

  private async getLineItemsWithNewTotal(
    shippingMethod: ApplePayJS.ApplePayShippingMethod
  ): Promise<ApplePayJS.ApplePayShippingContactUpdate> {
    const paymentData = await this.getInitialPaymentData();

    const lineItems: ApplePayJS.ApplePayLineItem[] = paymentData.lineItems.map(
      (lineItem) => ({
        label: lineItem.name,
        amount: this.centAmountToString(lineItem.amount.centAmount),
        type: "final",
      })
    );

    lineItems.push({
      label: `Delivery: ${shippingMethod.label}`,
      amount: shippingMethod.amount,
      type: "final" as const,
    });

    return {
      newLineItems: lineItems,
      newTotal: {
        label: this.paymentMethodConfig.merchantName,
        amount: this.centAmountToString(paymentData.totalPrice.centAmount),
      },
    };
  }

  private async fetchShippingMethods(
    countryCode: string
  ): Promise<ApplePayJS.ApplePayShippingMethod[]> {
    const shippingsMethods = await this.getShippingMethods({
      address: {
        country: countryCode,
      },
    });

    return shippingsMethods.map((method) => ({
      label: method.name,
      detail: method.description,
      amount: this.centAmountToString(method.amount.centAmount),
      identifier: method.id,
    }));
  }
}
