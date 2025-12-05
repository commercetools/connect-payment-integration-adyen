import {
  AdyenCheckout,
  AdyenCheckoutError,
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
  private applePayConfig?: { usesOwnCertificate: boolean };
  private expressPaymentMethodsConfig: Map<string, { [key: string]: string }>;

  constructor(initOptions: AdyenEnablerOptions) {
    this.initOptions = initOptions;
    this.expressPaymentMethodsConfig = new Map();
  }

  async init(): Promise<BaseOptions> {
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
        }),
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
      onPaymentFailed: (_result: PaymentFailedData, component: UIElement) => {
        this.handleComplete({ isSuccess: false, component });
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
      analytics: { enabled: true },
      locale: adyenLocale,
      environment: configJson.config.environment,
      clientKey: configJson.config.clientKey,
      countryCode: this.initOptions.countryCode,
    });

    if (configJson.config.applePayConfig) {
      this.applePayConfig = configJson.config.applePayConfig;
    }

    return {
      adyenCheckout,
      applePayConfig: this.applePayConfig,
      countryCode: this.initOptions.countryCode,
      currencyCode: this.initOptions.currencyCode,
      processorUrl: this.initOptions.processorUrl,
      sessionId: this.initOptions.sessionId,
      onComplete: this.initOptions.onComplete,
    };
  }

  getPaymentMethodConfig(type: string): { [key: string]: string } {
    return this.expressPaymentMethodsConfig.get(type);
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
