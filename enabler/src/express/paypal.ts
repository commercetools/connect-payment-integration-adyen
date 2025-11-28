import {
  ICore,
  Intent,
  PaymentMethod,
  PayPal,
  SubmitActions,
  SubmitData,
  UIElement,
} from "@adyen/adyen-web";
import {
  ExpressOptions,
  OnComplete,
  PaymentExpressBuilder,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";
import { DefaultAdyenExpressComponent } from "./base";

type PayPalShippingOption = {
  reference: string;
  description: string;
  type: string;
  amount: {
    currency: string;
    value: number;
  };
  selected: boolean;
};

type PaymentAmount = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

type UpdateOrder = {
  paymentReference?: string;
  pspReference: string;
  paymentData: string;
  deliveryMethods: PayPalShippingOption[];
  originalAmount: PaymentAmount;
};

/**
 * PayPal express component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/paypal/web-component/express-checkout
 */
export class PayPalExpressBuilder implements PaymentExpressBuilder {
  private adyenCheckout: ICore;
  private processorUrl: string;
  private sessionId: string;
  private countryCode: string;
  private currencyCode: string;
  private paymentMethodConfig: { [key: string]: string };
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

  build(config: ExpressOptions): PayPalExpressComponent {
    const paypalComponent = new PayPalExpressComponent({
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      processorUrl: this.processorUrl,
      sessionId: this.sessionId,
      countryCode: this.countryCode,
      currencyCode: this.currencyCode,
      paymentMethodConfig: this.paymentMethodConfig,
      onComplete: config.onComplete || this.onComplete,
    });
    paypalComponent.init();

    return paypalComponent;
  }
}

export class PayPalExpressComponent extends DefaultAdyenExpressComponent {
  private adyenCheckout: ICore;
  private pspReference: string;
  private paymentReference: string;
  private shippingAddress: any;
  private originalAmount: PaymentAmount;
  private paymentMethod: PaymentMethod;

  constructor(opts: {
    adyenCheckout: ICore;
    componentOptions: ExpressOptions;
    processorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
    paymentMethodConfig: { [key: string]: string };
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
    this.adyenCheckout = opts.adyenCheckout;
  }

  init(): void {
    const me = this;

    this.component = new PayPal(this.adyenCheckout, {
      isExpress: true,
      blockPayPalCreditButton: true,
      blockPayPalPayLaterButton: true,
      blockPayPalVenmoButton: true,
      //HINT: To fix this problem https://docs.adyen.com/payment-methods/paypal/paypal-troubleshooting#expected-currency-from-order-api-call-to-be-usd-got-eur-please-ensure-you-are-passing-currencyeur-to-the-sdk-url, i had to predefine this amount value here
      amount: {
        currency: this.expressOptions.initialAmount.currencyCode,
        value: this.expressOptions.initialAmount.centAmount,
      },
      countryCode: this.countryCode,
      configuration: {
        merchantId: this.paymentMethodConfig.merchantId,
        intent: this.paymentMethodConfig.intent as Intent,
      },
      onClick: () => {
        return this.expressOptions
          .onPayButtonClick()
          .then((opts) => {
            this.setSessionId(opts.sessionId);
            return true;
          })
          .catch(() => false);
      },
      onPaymentCompleted: (data, _component) => {
        this.onComplete({
          isSuccess: !!data.resultCode,
          paymentReference: this.paymentReference,
          method: this.paymentMethod,
        });
      },
      onSubmit: async (
        state: SubmitData,
        component: UIElement,
        actions: SubmitActions
      ) => {
        try {
          const reqData = {
            ...state.data,
            channel: "Web",
          };

          this.paymentMethod = {
            type: state.data.paymentMethod.type,
            name: "unknown",
          };

          const response = await fetch(
            this.processorUrl + "/express-payments",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": this.sessionId,
              },
              body: JSON.stringify(reqData),
            }
          );
          const data = await response.json();
          this.pspReference = data.pspReference;
          this.paymentReference = data.paymentReference;
          this.originalAmount = data.originalAmount;

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
        } catch (e) {
          actions.reject(e);
        }
      },
      onShippingAddressChange: async (data, actions, component) => {
        try {
          await me.setShippingAddress({
            address: {
              country: data.shippingAddress.countryCode,
              postalCode: data.shippingAddress.postalCode,
              city: data.shippingAddress.city,
            },
          });

          const shippingOptions = await me.getShippingOptions(
            data.shippingAddress.countryCode
          );

          this.shippingAddress = data.shippingAddress;

          // set the default shipping option at this point in the cart.
          const selectedOption = shippingOptions.filter(
            (option) => option.selected === true
          );
          await me.setShippingMethod({
            shippingMethod: {
              id: selectedOption[0].reference,
            },
          });

          // Update adyen with the new payment amount and delivery methods available to the selected address
          const payload = {
            paymentReference: this.paymentReference,
            pspReference: this.pspReference,
            paymentData: component.paymentData,
            deliveryMethods: shippingOptions,
            originalAmount: this.originalAmount,
          };

          const updatedOrder = await me.updateOrder(payload);
          component.updatePaymentData(updatedOrder.paymentData);
        } catch (err) {
          return actions.reject(data.errors.COUNTRY_ERROR);
        }
      },
      onShippingOptionsChange: async (data, actions, component) => {
        try {
          await me.setShippingMethod({
            shippingMethod: {
              id: data.selectedShippingOption.id,
            },
          });

          // fetch all shipping methods
          const shippingOptions = await me.getShippingOptions(
            this.shippingAddress.countryCode,
            data.selectedShippingOption.id
          );

          const payload = {
            paymentReference: this.paymentReference,
            pspReference: this.pspReference,
            paymentData: component.paymentData,
            deliveryMethods: shippingOptions,
            originalAmount: this.originalAmount,
          };

          // Update adyen with the shipping methods and thus update to payment price depending on the amount for the shipping option
          const updatedOrder = await me.updateOrder(payload);
          component.updatePaymentData(updatedOrder.paymentData);
        } catch (err) {
          return actions.reject(data.errors.METHOD_UNAVAILABLE);
        }
      },
      onAdditionalDetails: async (state, component, actions) => {
        try {
          const requestData = {
            ...state.data,
            paymentReference: this.paymentReference,
            paymentMethod: this.paymentMethod.type,
          };
          const url = this.processorUrl.endsWith("/")
            ? `${this.processorUrl}express-payments/details`
            : `${this.processorUrl}/express-payments/details`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": this.sessionId,
            },
            body: JSON.stringify(requestData),
          });

          const data = await response.json();
          this.paymentReference = data.paymentReference;
          this.paymentMethod = data.paymentMethod;

          if (
            data.resultCode === "Authorised" ||
            data.resultCode === "Pending"
          ) {
            component.setStatus("success");
          } else {
            component.setStatus("error");
          }
          actions.resolve({ resultCode: data.resultCode });
        } catch (_err) {
          actions.reject();
        }
      },
      onAuthorized: async (data, actions) => {
        const deliveryInformation =
          data.authorizedEvent.purchase_units[0]?.shipping;

        const shippingAddress = this.convertAddress({
          address: data.deliveryAddress,
          email: data.authorizedEvent.email,
          firstName: deliveryInformation?.name?.full_name.split(" ")[0],
          lastName: deliveryInformation?.name?.full_name
            .split(" ")
            .slice(1)
            .join(" "),
          phoneNumber: data.authorizedEvent?.shippingAddress?.phoneNumber,
        });

        const billingAddress = this.convertAddress({
          address: data.billingAddress,
          email: data.authorizedEvent.payer.email_address,
          firstName: data.authorizedEvent.payer?.name?.given_name || "",
          lastName: data.authorizedEvent.payer?.name?.surname || "",
          phoneNumber:
            data.authorizedEvent.payer.phone?.phone_number?.national_number,
        });

        this.expressOptions
          .onPaymentSubmit({
            shippingAddress,
            billingAddress,
          })
          .then(() => actions.resolve())
          .catch(() => {
            actions.reject();
          });
      },
    });
  }

  protected async updateOrder(payload: UpdateOrder): Promise<any> {
    try {
      const response = await fetch(
        `${this.processorUrl}/paypal-express/order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Id": this.sessionId,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        throw new Error("something happened.");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  private async getShippingOptions(
    countryCode: string,
    selectedOptionId?: string
  ): Promise<PayPalShippingOption[]> {
    const shippingMethods = await this.getShippingMethods({
      address: {
        country: countryCode,
      },
    });

    if (selectedOptionId) {
      return shippingMethods.map((method) => ({
        reference: method.id,
        description: method.name,
        type: "Shipping",
        amount: {
          currency: method.amount.currencyCode,
          value: method.amount.centAmount,
        },
        selected: selectedOptionId === method.id ? true : false,
      }));
    }

    return shippingMethods.map((method) => ({
      reference: method.id,
      description: method.name,
      type: "Shipping",
      amount: {
        currency: method.amount.currencyCode,
        value: method.amount.centAmount,
      },
      selected: method.isSelected ?? false,
    }));
  }
}
