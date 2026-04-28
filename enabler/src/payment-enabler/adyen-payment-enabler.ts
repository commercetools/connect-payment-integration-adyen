import { ICore } from "@adyen/adyen-web";
import "@adyen-css";
import {
  CocoStoredPaymentMethod,
  DropinType,
  EnablerOptions,
  OnComplete,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentExpressBuilder,
  StoredComponentBuilder,
} from "./payment-enabler";
import { AdyenInitWithSessionFlow } from "./adyen-init-session";
import { AdyenInitWithAdvancedFlow } from "./adyen-init-advanced";
import { SUPPORTED_DROPIN_METHODS, SUPPORTED_EXPRESS_METHODS, SUPPORTED_METHODS, SUPPORTED_STORED_METHODS, SupportedExpressMethod, SupportedMethod, SupportedStoredMethod } from "./constants";

export type AdyenEnablerOptions = EnablerOptions & {
  onActionRequired?: (action: any) => Promise<void>;
};

export type StoredPaymentMethodsConfig = {
  isEnabled: boolean;
  storedPaymentMethods: CocoStoredPaymentMethod[];
};

export type BaseOptions = {
  adyenCheckout: ICore;
  sessionId: string;
  processorUrl: string;
  countryCode?: string;
  currencyCode?: string;
  applePayConfig?: {
    usesOwnCertificate: boolean;
  };
  paymentMethodConfig?: { [key: string]: string };
  paymentComponentsConfigOverride?: Record<string, any>;
  storedPaymentMethodsConfig?: StoredPaymentMethodsConfig;
  setStorePaymentDetails?: (enabled: boolean) => void;
  setSessionId?: (sessionId: string) => void;
  onComplete?: OnComplete;
};

export class AdyenPaymentEnabler implements PaymentEnabler {
  private adyenInitWithSessionFlow: AdyenInitWithSessionFlow;
  private adyenInitWithAdvancedFlow: AdyenInitWithAdvancedFlow;
  private sessionFlowBaseOptions: Promise<BaseOptions> | null = null;
  private advancedFlowBaseOptions: Promise<BaseOptions> | null = null;

  constructor(options: AdyenEnablerOptions) {
    this.adyenInitWithSessionFlow = new AdyenInitWithSessionFlow(options);
    this.adyenInitWithAdvancedFlow = new AdyenInitWithAdvancedFlow(options);
  }

  private async getSessionFlowBaseOptions(): Promise<BaseOptions> {
    if (!this.sessionFlowBaseOptions) {
      this.sessionFlowBaseOptions = this.adyenInitWithSessionFlow.init();
    }
    return this.sessionFlowBaseOptions;
  }

  private async getAdvancedFlowBaseOptions(): Promise<BaseOptions> {
    if (!this.advancedFlowBaseOptions) {
      this.advancedFlowBaseOptions = this.adyenInitWithAdvancedFlow.init();
    }
    return this.advancedFlowBaseOptions;
  }

  async createComponentBuilder(type: SupportedMethod): Promise<PaymentComponentBuilder> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    if (!(type in SUPPORTED_METHODS)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          SUPPORTED_METHODS
        ).join(", ")}`
      );
    }

    return new SUPPORTED_METHODS[type](baseOptions);
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    if (!(type in SUPPORTED_DROPIN_METHODS)) {
      throw new Error(
        `Dropin type not supported: ${type}. Supported types: ${Object.keys(
          SUPPORTED_DROPIN_METHODS
        ).join(", ")}`
      );
    }

    return new SUPPORTED_DROPIN_METHODS[type](baseOptions);
  }

  async createExpressBuilder(type: SupportedExpressMethod): Promise<PaymentExpressBuilder> {
    const baseOptions = await this.getAdvancedFlowBaseOptions();
    const paymentMethodConfig =
      this.adyenInitWithAdvancedFlow.getPaymentMethodConfig(type);
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    if (!(type in SUPPORTED_EXPRESS_METHODS)) {
      throw new Error(
        `Express checkout type not supported: ${type}. Supported types: ${Object.keys(
          SUPPORTED_EXPRESS_METHODS
        ).join(", ")}`
      );
    }

    return new SUPPORTED_EXPRESS_METHODS[type]({ ...baseOptions, paymentMethodConfig });
  }

  async createStoredPaymentMethodBuilder(
    type: SupportedStoredMethod
  ): Promise<StoredComponentBuilder | never> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    if (!baseOptions.storedPaymentMethodsConfig?.isEnabled) {
      throw new Error(
        "Stored payment methods is not enabled and thus cannot be used to build a new component"
      );
    }

    if (!Object.keys(SUPPORTED_STORED_METHODS).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          SUPPORTED_STORED_METHODS
        ).join(", ")}`
      );
    }

    return new SUPPORTED_STORED_METHODS[type](baseOptions);
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    return !!baseOptions.storedPaymentMethodsConfig?.isEnabled;
  }

  async getStoredPaymentMethods({ allowedMethodTypes }: { allowedMethodTypes: string[] }) {
    const baseOptions = await this.getSessionFlowBaseOptions();
    const storedPaymentMethods =
      baseOptions.storedPaymentMethodsConfig?.storedPaymentMethods
        .map(({ token, ...storedPaymentMethod }) => storedPaymentMethod)
        .filter((method) => allowedMethodTypes.includes(method.type));

    return { storedPaymentMethods };
  }
}
