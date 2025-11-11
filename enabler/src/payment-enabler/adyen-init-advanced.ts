import {
  AdyenCheckout,
  AdyenCheckoutError,
  ICore,
  PaymentCompletedData,
  PaymentFailedData,
  UIElement,
} from "@adyen/adyen-web";
import { convertToAdyenLocale } from "../converters/locale.converter";
import { AdyenInit } from "./adyen-init-session";
import { AdyenEnablerOptions, BaseOptions } from "./adyen-payment-enabler";
import { getPaymentMethodType } from "./payment-enabler";

class AdyenInitError extends Error {
  sessionId: string;
  constructor(message: string, sessionId: string) {
    super(message);
    this.name = "AdyenInitError";
    this.sessionId = sessionId;
  }
}

export class AdyenInitWithAdvancedFlow implements AdyenInit {
  private initOptions: AdyenEnablerOptions;
  private adyenCheckout: ICore;
  private applePayConfig?: { usesOwnCertificate: boolean };
  private expressPaymentMethodsConfig: Map<string, { [key: string]: string }>;

  constructor(initOptions: AdyenEnablerOptions) {
    this.initOptions = initOptions;
    this.expressPaymentMethodsConfig = new Map();
  }

  async init(type: string): Promise<BaseOptions> {
    const adyenLocale = convertToAdyenLocale(
      this.initOptions.locale || "en-US"
    );

    const [paymentMethodsResponse, configResponse] = await Promise.all([
      fetch(`${this.initOptions.processorUrl}/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.initOptions.sessionId,
        },
        body: JSON.stringify({
          allowedPaymentMethods: ["paypal", "googlepay", "applepay"],
          countryCode: this.initOptions.countryCode,
        }),
      }),
      fetch(`${this.initOptions.processorUrl}/operations/config`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.initOptions.sessionId,
        },
      }),
    ]);

    const [paymentMethodsJson, configJson] = await Promise.all([
      paymentMethodsResponse.json(),
      configResponse.json(),
    ]);

    if (!paymentMethodsJson.paymentMethods) {
      throw new AdyenInitError(
        "Not able to initialize Adyen",
        this.initOptions.sessionId
      );
    }

    paymentMethodsJson.paymentMethods.forEach((method: any) => {
      this.expressPaymentMethodsConfig.set(method.type, method.configuration);
    });

    const adyenCheckout = await AdyenCheckout({
      onPaymentCompleted: (
        result: PaymentCompletedData,
        _component: UIElement
      ) => {
        console.info("payment completed", result.resultCode);
      },
      onPaymentFailed: (result: PaymentFailedData, _component: UIElement) => {
        this.handleComplete({ isSuccess: false, component: _component });
        console.info("payment failed", result.resultCode);
      },
      onError: (error: AdyenCheckoutError, component: UIElement) => {
        if (error.name === "CANCEL") {
          console.info("shopper canceled the payment attempt");
          component.setStatus("ready");
        } else {
          console.error(error.name, error.message, error.stack, component);
        }
        this.handleError({ error, component });
      },
      onSubmit: async (state, component, actions) => {
        try {
          const reqData = {
            ...state.data,
            channel: "Web",
          };
          const response = await fetch(
            this.initOptions.processorUrl + "/payments",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": this.initOptions.sessionId,
              },
              body: JSON.stringify(reqData),
            }
          );
          const data = await response.json();

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
          actions.reject();
        }
      },
      analytics: { enabled: true },
      locale: adyenLocale,
      environment: configJson.environment,
      clientKey: configJson.clientKey,
      countryCode: this.initOptions.countryCode,
    });

    this.adyenCheckout = adyenCheckout;

    if (configJson.applePayConfig) {
      this.applePayConfig = configJson.applePayConfig;
    }

    return {
      adyenCheckout: this.adyenCheckout,
      applePayConfig: this.applePayConfig,
      countryCode: this.initOptions.countryCode,
      currencyCode: this.initOptions.currencyCode,
      processorUrl: this.initOptions.processorUrl,
      paymentMethodConfig: this.expressPaymentMethodsConfig.get(type),
      sessionId: this.initOptions.sessionId,
    };
  }

  private handleError(opts: { error: any; component: UIElement }) {
    if (this.initOptions.onError) {
      this.initOptions.onError(opts.error, {
        method: { type: getPaymentMethodType(opts.component?.props?.type) },
      });
    }
  }

  private handleComplete(opts: {
    isSuccess: boolean;
    component: UIElement;
    paymentReference?: string;
  }) {
    if (this.initOptions.onComplete) {
      this.initOptions.onComplete({
        isSuccess: opts.isSuccess,
        paymentReference: opts?.paymentReference,
        method: { type: getPaymentMethodType(opts.component?.props?.type) },
      });
    }
  }
}
