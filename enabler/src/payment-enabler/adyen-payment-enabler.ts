import { ICore } from "@adyen/adyen-web";
import "@adyen-css";
import {
  CocoStoredPaymentMethod,
  DropinType,
  EnablerOptions,
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
};

export class AdyenPaymentEnabler implements PaymentEnabler {
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private adyenInitWithSessionFlow: AdyenInitWithSessionFlow;
  private adyenInitWithAdvancedFlow: AdyenInitWithAdvancedFlow;

  constructor(options: AdyenEnablerOptions) {
    this.adyenInitWithSessionFlow = new AdyenInitWithSessionFlow(options);
    this.adyenInitWithAdvancedFlow = new AdyenInitWithAdvancedFlow(options);
  }

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder> {
    const baseOptions = await this.adyenInitWithSessionFlow.init();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    const supportedMethods = {
      applepay: ApplePayBuilder,
      card: CardBuilder,
      googlepay: GooglepayBuilder,
      ideal: IdealBuilder,
      paypal: PaypalBuilder,
      klarna_pay_now: KlarnaPayNowBuilder,
      klarna_pay_later: KlarnaPayLaterBuilder,
      klarna_pay_overtime: KlarnaPayOverTimeBuilder,
      eps: EPSBuilder,
      bancontactcard: BancontactCardBuilder,
      bancontactmobile: BancontactMobileBuilder,
      twint: TwintBuilder,
      sepadirectdebit: SepaBuilder,
      klarna_billie: KlarnaBillieBuilder,
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
    const baseOptions = await this.adyenInitWithSessionFlow.init();
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
    const baseOptions = await this.adyenInitWithAdvancedFlow.init(type);
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    const supportedMethods = {
      googlepay: GooglePayExpressBuilder,
    };

    if (!(type in supportedMethods)) {
      throw new Error(
        `Express checkout type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }

  async createStoredPaymentMethodBuilder(
    type: string
  ): Promise<StoredComponentBuilder | never> {
    const baseOptions = await this.adyenInitWithSessionFlow.init();
    if (!baseOptions.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    this.storedPaymentMethodsConfig = baseOptions.storedPaymentMethodsConfig;

    if (!this.storedPaymentMethodsConfig?.isEnabled) {
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
    return this.storedPaymentMethodsConfig?.isEnabled;
  }

  async getStoredPaymentMethods({ allowedMethodTypes }) {
    const storedPaymentMethods =
      this.storedPaymentMethodsConfig.storedPaymentMethods
        .map(({ token, ...storedPaymentMethod }) => storedPaymentMethod)
        .filter((method) => allowedMethodTypes.includes(method.type));

    return { storedPaymentMethods };
  }
}
