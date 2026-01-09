import {
  ApplePay,
  ICore,
  RawPaymentMethod,
  SubmitActions,
  SubmitData,
  UIElement,
} from "@adyen/adyen-web";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";
import { DefaultAdyenExpressComponent, InitialPaymentData } from "./base";
import {
  PaymentExpressBuilder,
  ExpressOptions,
  OnComplete,
} from "../payment-enabler/payment-enabler";

export class ApplePayExpressBuilder implements PaymentExpressBuilder {
  private adyenCheckout: ICore;
  private processorUrl: string;
  private sessionId: string;
  private countryCode: string;
  private currencyCode: string;
  private paymentMethodConfig: { [key: string]: string };
  private usesOwnCertificate: boolean;
  private onComplete: OnComplete;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.processorUrl = baseOptions.processorUrl;
    this.sessionId = baseOptions.sessionId;
    this.countryCode = baseOptions.countryCode;
    this.currencyCode = baseOptions.currencyCode;
    this.paymentMethodConfig = baseOptions.paymentMethodConfig;
    this.onComplete = baseOptions.onComplete;
  }

  build(config: ExpressOptions): ApplePayExpressComponent {
    const applePayComponent = new ApplePayExpressComponent({
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      processorUrl: this.processorUrl,
      sessionId: this.sessionId,
      countryCode: this.countryCode,
      currencyCode: this.currencyCode,
      paymentMethodConfig: this.paymentMethodConfig,
      usesOwnCertificate: this.usesOwnCertificate,
      onComplete: config.onComplete || this.onComplete,
    });
    applePayComponent.init();

    return applePayComponent;
  }
}

export class ApplePayExpressComponent extends DefaultAdyenExpressComponent {
  private adyenCheckout: ICore;
  public finalAmount: number;
  private paymentReference: string;
  private paymentMethod: RawPaymentMethod;
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
    onComplete: OnComplete;
  }) {
    super({
      expressOptions: opts.componentOptions,
      processorUrl: opts.processorUrl,
      sessionId: opts.sessionId,
      countryCode: opts.countryCode,
      currencyCode: opts.currencyCode,
      paymentMethodConfig: opts.paymentMethodConfig,
      onComplete: opts.onComplete,
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
      supportedCountries: this.expressOptions?.allowedCountries || [],
      totalPriceStatus: 'pending', // HINT: instead of showing an initial amount which is definitely going to change after delivery method is selected, apple pay will show 'Amount pending', after which it updates automatically.
      // TODO: add support for expressPage...to be set by spa to be used for analytics.
      ...(this.usesOwnCertificate && {
        onValidateMerchant: this.onValidateMerchant.bind(this),
      }),
      requiredBillingContactFields: ["postalAddress", "email", "name"],
      requiredShippingContactFields: ["postalAddress", "name", "email"],
      configuration: {
        merchantId: this.paymentMethodConfig.merchantId,
        merchantName: this.paymentMethodConfig.merchantName,
      },
      onPaymentCompleted: (data, _component) => {
        this.onComplete({
          isSuccess: !!data.resultCode,
          paymentReference: this.paymentReference,
          method: this.paymentMethod,
        });
      },
      onClick: (resolve, reject) => {
        return this.expressOptions
          .onPayButtonClick()
          .then((res) => {
            this.sessionId = res.sessionId;
            resolve();
          })
          .catch(() => reject());
      },
      onSubmit: async (
        state: SubmitData,
        component: UIElement,
        actions: SubmitActions
      ) => {
        return this.submit({
          state,
          component,
          actions,
          extraRequestData: { countryCode: this.countryCode },
          onBeforeResolve: (data) => {
            this.paymentReference = data.paymentReference;
            this.paymentMethod = data.paymentMethod;
          },
        });
      },
      onShippingContactSelected: async (
        resolve,
        _reject,
        event: ApplePayJS.ApplePayShippingContactSelectedEvent
      ) => {
        const { countryCode, locality, postalCode } = event.shippingContact;
        let update: Partial<ApplePayJS.ApplePayShippingContactUpdate> = {};
        let paymentData: InitialPaymentData;

        try {
          await me.setShippingAddress({
            address: {
              country: countryCode,
              postalCode,
              city: locality,
              streetName: locality,
            },
          });

          const shippingMethods = await this.fetchShippingMethods(countryCode);
          paymentData = await this.getInitialPaymentData();
          const updatedLineItemsWithTotal = await this.getLineItemsWithNewTotal(
            shippingMethods[0],
            paymentData
          );

          update = {
            ...updatedLineItemsWithTotal,
            newShippingMethods: shippingMethods,
          };
        } catch (err) {
          update = {
            newTotal: {
              label: this.paymentMethodConfig.merchantName,
              amount: this.centAmountToString(
                paymentData?.totalPrice?.centAmount || this.expressOptions.initialAmount.centAmount, // If the error being handled was thrown by the call to getInitialPaymentData() this will fail, thus why the fallback
                paymentData?.totalPrice?.fractionDigits || this.expressOptions.initialAmount.fractionDigits
              ),
            },
            errors: [
              new ApplePayError(
                "shippingContactInvalid",
                undefined,
                "Cannot ship to the selected address"
              ),
            ],
          };
        }

        resolve(update);
      },
      onShippingMethodSelected: async (
        resolve,
        _reject,
        event: ApplePayJS.ApplePayShippingMethodSelectedEvent
      ) => {
        const { shippingMethod } = event;
        let update: Partial<ApplePayJS.ApplePayShippingContactUpdate> = {};
        let paymentData: InitialPaymentData;

        try {
          await me.setShippingMethod({
            shippingMethod: {
              id: shippingMethod.identifier,
            },
          });

          paymentData = await this.getInitialPaymentData();
          const updatedLineItemsWithTotal = await this.getLineItemsWithNewTotal(
            shippingMethod,
            paymentData
          );

          update = {
            ...updatedLineItemsWithTotal,
          };
        } catch (err) {
          update = {
            newTotal: {
              label: this.paymentMethodConfig.merchantName,
              amount: this.centAmountToString(
                paymentData?.totalPrice?.centAmount || this.expressOptions.initialAmount.centAmount, // If the error being handled was thrown by the call to getInitialPaymentData() this will fail, thus why the fallback
                paymentData?.totalPrice?.fractionDigits || this.expressOptions.initialAmount.fractionDigits
              ),
            },
            errors: [
              new ApplePayError(
                "unknown",
                undefined,
                "Cannot ship using the selected method"
              ),
            ],
          };
        }

        resolve(update);
      },
      onAuthorized: async (data, actions) => {
        const customerEmail =
          data.authorizedEvent.payment.shippingContact.emailAddress;
        const shippingAddress = this.convertAddress({
          address: data.deliveryAddress,
          email: customerEmail,
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
            customerEmail,
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
    shippingMethod: ApplePayJS.ApplePayShippingMethod,
    paymentData: InitialPaymentData
  ): Promise<ApplePayJS.ApplePayShippingContactUpdate> {
    const lineItems: ApplePayJS.ApplePayLineItem[] = paymentData.lineItems.map(
      (lineItem) => ({
        label: lineItem.name,
        amount: this.centAmountToString(
          lineItem.amount.centAmount,
          lineItem.amount.fractionDigits
        ),
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
        amount: this.centAmountToString(
          paymentData.totalPrice.centAmount,
          paymentData.totalPrice.fractionDigits
        ),
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
      amount: this.centAmountToString(
        method.amount.centAmount,
        method.amount.fractionDigits
      ),
      identifier: method.id,
    }));
  }
}
