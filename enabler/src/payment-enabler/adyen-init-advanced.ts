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
  constructor(message: string, sessionId?: string) {
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
    if(this.adyenCheckout) return;
    
    const adyenLocale = convertToAdyenLocale(
      this.initOptions.locale || "en-US"
    );

    const [configResponse] = await Promise.all([
      fetch(`${this.initOptions.processorUrl}/express-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryCode: this.initOptions.countryCode,
        })
      }),
    ]);

    if (!configResponse.ok) {
      throw new AdyenInitError(
        configResponse.status === 403
          ? "Unauthorized error fetching express config"
          : "Not able to initialize Adyen"
      );
    }

    const [configJson] = await Promise.all([configResponse.json()]);

    console.log(configJson)
    if (!configJson.methods) {
      throw new AdyenInitError(
        "Not able to initialize Adyen",
        this.initOptions.sessionId
      );
    }

    configJson.methods.forEach((method: any) => {
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
      environment: configJson.config.environment,
      clientKey: configJson.config.clientKey,
      countryCode: this.initOptions.countryCode,
    });

    this.adyenCheckout = adyenCheckout;

    if (configJson.config.applePayConfig) {
      this.applePayConfig = configJson.config.applePayConfig;
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
