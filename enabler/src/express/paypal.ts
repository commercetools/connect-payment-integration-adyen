import {
  ICore,
  Intent,
  PayPal,
  SubmitActions,
  SubmitData,
  UIElement,
} from "@adyen/adyen-web";
import {
  ExpressOptions,
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

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.processorUrl = baseOptions.processorUrl;
    this.sessionId = baseOptions.sessionId;
    this.countryCode = baseOptions.countryCode;
    this.currencyCode = baseOptions.currencyCode;
    this.paymentMethodConfig = baseOptions.paymentMethodConfig;
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
  public finalAmount: number;

  constructor(opts: {
    adyenCheckout: ICore;
    componentOptions: ExpressOptions;
    processorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
    paymentMethodConfig: { [key: string]: string };
  }) {
    super({
      expressOptions: opts.componentOptions,
      processorUrl: opts.processorUrl,
      sessionId: opts.sessionId,
      countryCode: opts.countryCode,
      currencyCode: opts.currencyCode,
      paymentMethodConfig: opts.paymentMethodConfig,
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
        currency: this.currencyCode,
        value: 2500,
      },
      countryCode: this.countryCode,
      configuration: {
        merchantId: this.paymentMethodConfig.merchantId,
        intent: this.paymentMethodConfig.intent as Intent,
      },
      onClick: () => {
        return this.expressOptions
          .onPaymentInit()
          .then(() => true)
          .catch((_error) => {
            console.error("## onPaymentInit - error", _error);
            return false;
          });
      },
      //TODO: Think on how to abstract this things
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

          const response = await fetch(this.processorUrl + "/payments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": this.sessionId,
            },
            body: JSON.stringify(reqData),
          });
          const data = await response.json();
          this.pspReference = data.pspReference;
          this.paymentReference = data.paymentReference;

          actions.resolve({
            resultCode: data.resultCode,
            action: data.action,
          });
        } catch (e) {
          console.log("Payment aborted by client");
          component.setStatus("ready");
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
              // streetName: '' // IF street name is not set, adyen throws an error if the buyer re-attempts to buy after cancelling the first attempt, but
              // since a new cart is going to be created every time the paypal button is clicked, we might need not to worry about this.
            },
          });
        } catch (err) {
          return actions.reject(data.errors.COUNTRY_ERROR);
        }

        const shippingOptions = await me.getShippingOptions(
          data.shippingAddress.countryCode
        );
        this.shippingAddress = data.shippingAddress;
        //TODO: set the default shipping option at this point in the cart.

        const payload = {
          paymentReference: this.paymentReference,
          pspReference: this.pspReference,
          paymentData: component.paymentData,
          deliveryMethods: shippingOptions,
        };

        const updatedOrder = await me.updateOrder(payload);
        component.updatePaymentData(updatedOrder.paymentData);
      },
      onShippingOptionsChange: async (data, actions, component) => {
        try {
          await me.setShippingMethod({
            shippingOption: {
              id: data.selectedShippingOption.id,
            },
          });
        } catch (err) {
          return actions.reject(data.errors.METHOD_UNAVAILABLE);
        }

        const shippingOptions = await me.getShippingOptions(
          this.shippingAddress.countryCode,
          data.selectedShippingOption.id
        );
        const payload = {
          paymentReference: this.paymentReference,
          pspReference: this.pspReference,
          paymentData: component.paymentData,
          deliveryMethods: shippingOptions,
        };
        const updatedOrder = await me.updateOrder(payload);
        component.updatePaymentData(updatedOrder.paymentData);
      },
      onAdditionalDetails: async (state, component, actions) => {
        try {
          const requestData = {
            ...state.data,
            paymentReference: this.paymentReference,
          };
          const url = this.processorUrl.endsWith("/")
            ? `${this.processorUrl}payments/details`
            : `${this.processorUrl}/payments/details`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": this.sessionId,
            },
            body: JSON.stringify(requestData),
          });

          const data = await response.json();
          if (
            data.resultCode === "Authorised" ||
            data.resultCode === "Pending"
          ) {
            component.setStatus("success");
            // this({
            //   isSuccess: true,
            //   component: component,
            //   paymentReference: this.paymentReference,
            // });
          } else {
            // this.handleComplete({
            //   isSuccess: false,
            //   component: component,
            //   paymentReference: this.paymentReference,
            // });
            component.setStatus("error");
          }
          actions.resolve({ resultCode: data.resultCode });
        } catch (err) {
          console.error("Not able to submit the payment details", err);
          // this.handleError({ error: err, component, paymentReference: this.paymentReference });
          component.setStatus("ready");
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

  protected async updateOrder(payload: any): Promise<any> {
    try {
      const response = await fetch(`${this.processorUrl}/paypal-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("## getPaymentData - critical error", error);
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
