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
import { ProcessorApiClient } from '../api/processor-api.client';

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
  private apiClient: ProcessorApiClient;
  private applePayConfig?: { usesOwnCertificate: boolean };
  private expressPaymentMethodsConfig: Map<string, { [key: string]: string }>;

  constructor(initOptions: AdyenEnablerOptions) {
    this.initOptions = initOptions;
    this.apiClient = new ProcessorApiClient({ processorUrl: initOptions.processorUrl, sessionId: initOptions.sessionId });
    this.expressPaymentMethodsConfig = new Map();
  }

  async init(): Promise<BaseOptions> {
    const adyenLocale = convertToAdyenLocale(
      this.initOptions.locale || "en-US"
    );

    let configJson: Awaited<ReturnType<ProcessorApiClient['getExpressConfig']>>;
    try {
      configJson = await this.apiClient.getExpressConfig({ countryCode: this.initOptions.countryCode });
    } catch {
      throw new AdyenInitError('Not able to initialize Adyen', this.initOptions.sessionId);
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
        method: opts.component?.props?.type ? { type: getPaymentMethodType(opts.component.props.type) } : undefined,
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
        method: { type: getPaymentMethodType(opts.component.props?.type) },
      });
    }
  }
}
