import { ICore, Intent, PayPal, SubmitActions, SubmitData, UIElement } from "@adyen/adyen-web";
import { ExpressOptions, PaymentExpressBuilder } from "../payment-enabler/payment-enabler";
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
      proccessorUrl: this.processorUrl,
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
  public finalAmount: number;

  constructor(opts: {
    adyenCheckout: ICore;
    componentOptions: ExpressOptions;
    proccessorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
    paymentMethodConfig: { [key: string]: string };
  }) {
    super({
      expressOptions: opts.componentOptions,
      proccessorUrl: opts.proccessorUrl,
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
      blockPayPalVenmoButton: true,
      blockPayPalCreditButton: true,
      blockPayPalPayLaterButton: true,
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
      onSubmit: async (state: SubmitData, component: UIElement, actions: SubmitActions) => {
        console.log("## onSubmit paypal - state", state);
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

          console.log("## onSubmit - data", data);

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
        console.log("onShippingAddressChange", data);

        const shippingAddress = {
          country: data.shippingAddress.countryCode,
          postalCode: data.shippingAddress.postalCode,
        };

        await me.setShippingAddress({
          address: shippingAddress,
        });

        const shippingOptions = await me.getShippingOptions(data.shippingAddress.countryCode);

        const payload = {
          paymentReference: this.paymentReference,
          pspReference: this.pspReference,
          paymentData: component.paymentData,
          deliveryMethods: shippingOptions,
        };

        const updatedOrder = await me.updateOrder(payload);
        component.updatePaymentData(updatedOrder);
      },

      onAuthorized(data, actions) {
        console.log("onAuthorized", data);
        actions.resolve();
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

  private async getShippingOptions(countryCode: string): Promise<PayPalShippingOption[]> {
    const shippingMethods = await this.getShippingMethods({
      address: {
        country: countryCode,
      },
    });

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
