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
import { ApplePayBuilder } from "../components/payment-methods/applepay";
import { CardBuilder } from "../components/payment-methods/card";
import { GooglepayBuilder } from "../components/payment-methods/googlepay";
import { IdealBuilder } from "../components/payment-methods/ideal";
import { PaypalBuilder } from "../components/payment-methods/paypal";
import { KlarnaPayNowBuilder } from "../components/payment-methods/klarna-pay-now";
import { KlarnaPayLaterBuilder } from "../components/payment-methods/klarna-pay-later";
import { KlarnaPayOverTimeBuilder } from "../components/payment-methods/klarna-pay-over-time";
import { EPSBuilder } from "../components/payment-methods/eps";
import { BancontactCardBuilder } from "../components/payment-methods/bancontactcard";
import { TwintBuilder } from "../components/payment-methods/twint";
import { DropinEmbeddedBuilder } from "../dropin/dropin-embedded";
import { SepaBuilder } from "../components/payment-methods/sepadirectdebit";
import { BancontactMobileBuilder } from "../components/payment-methods/bancontactcard-mobile";
import { KlarnaBillieBuilder } from "../components/payment-methods/klarna-billie";
import { GooglePayExpressBuilder } from "../express/googlepay";
import { StoredCardBuilder } from "../stored/stored-payment-methods/card";
import { AdyenInitWithSessionFlow } from "./adyen-init-session";
import { AdyenInitWithAdvancedFlow } from "./adyen-init-advanced";
import { AfterPayBuilder } from "../components/payment-methods/afterpay";
import { BlikBuilder } from "../components/payment-methods/blik";
import { FPXBuilder } from "../components/payment-methods/fpx";
import { MobilePayBuilder } from "../components/payment-methods/mobilepay";
import { Przelewy24Builder } from "../components/payment-methods/przelewy24";
import { SwishBuilder } from "../components/payment-methods/swish";
import { VippsBuilder } from "../components/payment-methods/vipps";
import { ClearpayBuilder } from "../components/payment-methods/clearpay";
import { PayPalExpressBuilder } from "../express/paypal";
import { ApplePayExpressBuilder } from "../express/applepay";

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

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    const supportedMethods = {
      applepay: ApplePayBuilder,
      bancontactcard: BancontactCardBuilder,
      bancontactmobile: BancontactMobileBuilder,
      blik: BlikBuilder,
      card: CardBuilder,
      eps: EPSBuilder,
      fpx: FPXBuilder,
      googlepay: GooglepayBuilder,
      ideal: IdealBuilder,
      klarna_billie: KlarnaBillieBuilder,
      klarna_pay_later: KlarnaPayLaterBuilder,
      klarna_pay_now: KlarnaPayNowBuilder,
      klarna_pay_overtime: KlarnaPayOverTimeBuilder,
      przelewy24: Przelewy24Builder,
      paypal: PaypalBuilder,
      sepadirectdebit: SepaBuilder,
      swish: SwishBuilder,
      twint: TwintBuilder,
      vipps: VippsBuilder,
      mobilepay: MobilePayBuilder,
      afterpay: AfterPayBuilder,
      clearpay: ClearpayBuilder,
    };

    if (!(type in supportedMethods)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    const supportedMethods = { embedded: DropinEmbeddedBuilder };

    if (!(type in supportedMethods)) {
      throw new Error(
        `Dropin type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }

  async createExpressBuilder(type: string): Promise<PaymentExpressBuilder> {
    const baseOptions = await this.getAdvancedFlowBaseOptions();
    const paymentMethodConfig =
      this.adyenInitWithAdvancedFlow.getPaymentMethodConfig(type);
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    const supportedMethods = {
      googlepay: GooglePayExpressBuilder,
      paypal: PayPalExpressBuilder,
      applepay: ApplePayExpressBuilder,
    };

    if (!(type in supportedMethods)) {
      throw new Error(
        `Express checkout type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type]({ ...baseOptions, paymentMethodConfig });
  }

  async createStoredPaymentMethodBuilder(
    type: string
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

    const supportedMethods = {
      card: StoredCardBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    const baseOptions = await this.getSessionFlowBaseOptions();
    return baseOptions.storedPaymentMethodsConfig?.isEnabled;
  }

  async getStoredPaymentMethods({ allowedMethodTypes }) {
    const baseOptions = await this.getSessionFlowBaseOptions();
    const storedPaymentMethods =
      baseOptions.storedPaymentMethodsConfig.storedPaymentMethods
        .map(({ token, ...storedPaymentMethod }) => storedPaymentMethod)
        .filter((method) => allowedMethodTypes.includes(method.type));

    return { storedPaymentMethods };
  }
}
