import {
  AdditionalDetailsActions,
  AdditionalDetailsData,
  AdyenCheckoutError,
  ICore,
  PaymentCompletedData,
  PaymentFailedData,
  SubmitActions,
  SubmitData,
  UIElement,
  AdyenCheckout,
} from "@adyen/adyen-web";
import "@adyen-css";
import {
  CocoStoredPaymentMethod,
  DropinType,
  EnablerOptions,
  getPaymentMethodType,
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
import { convertToAdyenLocale } from "../converters/locale.converter";

class AdyenInitError extends Error {
  sessionId: string;
  constructor(message: string, sessionId: string) {
    super(message);
    this.name = "AdyenInitError";
    this.sessionId = sessionId;
  }
}

type AdyenEnablerOptions = EnablerOptions & {
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
  storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  setStorePaymentDetails: (enabled: boolean) => void;
};

export class AdyenPaymentEnabler implements PaymentEnabler {
  private initOptions: AdyenEnablerOptions;
  private sessionId: string;
  private processorUrl: string;
  private countryCode: string;
  private currencyCode: string;
  private adyenCheckout: ICore;
  private applePayConfig?: { usesOwnCertificate: boolean };
  private expressPaymentMethodsConfig: Map<string, { [key: string]: string }>;
  private storePaymentDetails = false;
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private paymentComponentsConfigOverride?: Record<string, any>;

  constructor(options: AdyenEnablerOptions) {
    this.sessionId = options.sessionId;
    this.processorUrl = options.processorUrl;
    this.countryCode = options.countryCode;
    this.currencyCode = options.currencyCode;
    this.initOptions = options;
    this.expressPaymentMethodsConfig = new Map();
  }

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder> {
    await this.initializeAdyenWithSession();
    if (!this.adyenCheckout) {
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

    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      applePayConfig: this.applePayConfig,
      processorUrl: this.processorUrl,
      paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
      sessionId: this.sessionId,
    });
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder> {
    await this.initializeAdyenWithSession();
    if (!this.adyenCheckout) {
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

    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      applePayConfig: this.applePayConfig,
      processorUrl: this.processorUrl,
      paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
      sessionId: this.sessionId,
    });
  }

  async createExpressBuilder(type: string): Promise<PaymentExpressBuilder> {
    await this.initializeAdyenForExpressCheckout();
    if (!this.adyenCheckout) {
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

    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      applePayConfig: this.applePayConfig,
      countryCode: this.countryCode,
      currencyCode: this.currencyCode,
      processorUrl: this.processorUrl,
      paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
      paymentMethodConfig: this.expressPaymentMethodsConfig.get(type),
      sessionId: this.sessionId,
    });
  }

  async createStoredPaymentMethodBuilder(
    type: string
  ): Promise<StoredComponentBuilder | never> {
    await this.initializeAdyenWithSession();
    if (!this.adyenCheckout) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

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

    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      applePayConfig: this.applePayConfig,
      countryCode: this.countryCode,
      processorUrl: this.processorUrl,
      paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
      sessionId: this.sessionId,
      setStorePaymentDetails: this.setStorePaymentDetails,
    });
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    return this.storedPaymentMethodsConfig?.isEnabled;
  }

  setStorePaymentDetails = (enabled: boolean): void => {
    this.storePaymentDetails = enabled;
  };

  getStorePaymentDetails = (): boolean => {
    return this.storePaymentDetails;
  };

  async getStoredPaymentMethods({ allowedMethodTypes }) {
    const storedPaymentMethods =
      this.storedPaymentMethodsConfig.storedPaymentMethods
        .map(({ token, ...storedPaymentMethod }) => storedPaymentMethod)
        .filter((method) => allowedMethodTypes.includes(method.type));

    return { storedPaymentMethods };
  }

  //TODO: move initialize away to another class or something AdyenInit
  private async initializeAdyenWithSession(): Promise<void> {
    if (this.adyenCheckout) return;

    const adyenLocale = convertToAdyenLocale(
      this.initOptions.locale || "en-US"
    );

    const [sessionResponse, configResponse] = await Promise.all([
      fetch(`${this.processorUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify({
          shopperLocale: adyenLocale,
        }),
      }),
      fetch(`${this.processorUrl}/operations/config`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
      }),
    ]);

    const [sessionJson, configJson] = await Promise.all([
      sessionResponse.json(),
      configResponse.json(),
    ]);

    let storedPaymentMethodsList: CocoStoredPaymentMethod[] = [];
    if (configJson.storedPaymentMethodsConfig?.isEnabled === true) {
      const response = await fetch(
        this.initOptions.processorUrl + "/stored-payment-methods",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Id": this.initOptions.sessionId,
          },
        }
      );

      const storedPaymentMethods: {
        storedPaymentMethods: CocoStoredPaymentMethod[];
      } = await response.json();

      storedPaymentMethodsList = storedPaymentMethods.storedPaymentMethods;
    }

    const { sessionData: data, paymentReference } = sessionJson;

    if (!data || !data.id) {
      throw new AdyenInitError(
        "Not able to initialize Adyen, session data missing",
        this.sessionId
      );
    }

    const adyenCheckout = await AdyenCheckout({
      onPaymentCompleted: (
        result: PaymentCompletedData,
        _component: UIElement
      ) => {
        console.info("payment completed", result.resultCode);
      },
      onPaymentFailed: (result: PaymentFailedData, _component: UIElement) => {
        this.handleComplete({
          isSuccess: false,
          component: _component,
          paymentReference,
        });
        console.info("payment failed", result.resultCode);
      },
      onError: (error: AdyenCheckoutError, component: UIElement) => {
        if (error.name === "CANCEL") {
          console.info("shopper canceled the payment attempt");
          component.setStatus("ready");
        } else {
          console.error(error.name, error.message, error.stack, component);
        }
        this.handleError({ error, component, paymentReference });
      },
      onSubmit: async (
        state: SubmitData,
        component: UIElement,
        actions: SubmitActions
      ) => {
        try {
          const reqData = {
            ...state.data,
            shopperLocale: adyenLocale,
            channel: "Web",
            paymentReference,
            ...(this.getStorePaymentDetails()
              ? { storePaymentMethod: true }
              : {}),
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
          if (data.action) {
            if (
              ["threeDS2", "qrCode"].includes(data.action.type) &&
              this.initOptions.onActionRequired
            ) {
              this.initOptions.onActionRequired({ type: "fullscreen" });
            }
            component.handleAction(data.action);
          } else {
            if (
              data.resultCode === "Authorised" ||
              data.resultCode === "Pending"
            ) {
              component.setStatus("success");
              this.handleComplete({
                isSuccess: true,
                component: component,
                paymentReference,
              });
            } else {
              this.handleComplete({
                isSuccess: false,
                component: component,
                paymentReference,
              });
              component.setStatus("error");
            }
          }

          actions.resolve({
            resultCode: data.resultCode,
            action: data.action,
          });
        } catch (e) {
          this.handleError({ error: e, component, paymentReference });
          component.setStatus("ready");
          actions.reject(e);
        }
      },
      onAdditionalDetails: async (
        state: AdditionalDetailsData,
        component: UIElement,
        actions: AdditionalDetailsActions
      ) => {
        try {
          const requestData = {
            ...state.data,
            paymentReference,
          };
          const url = this.initOptions.processorUrl.endsWith("/")
            ? `${this.initOptions.processorUrl}payments/details`
            : `${this.initOptions.processorUrl}/payments/details`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": this.initOptions.sessionId,
            },
            body: JSON.stringify(requestData),
          });
          const data = await response.json();
          if (
            data.resultCode === "Authorised" ||
            data.resultCode === "Pending"
          ) {
            component.setStatus("success");
            this.handleComplete({
              isSuccess: true,
              component: component,
              paymentReference,
            });
          } else {
            this.handleComplete({
              isSuccess: false,
              component: component,
              paymentReference,
            });
            component.setStatus("error");
          }
          actions.resolve({ resultCode: data.resultCode });
        } catch (e) {
          console.error("Not able to submit the payment details", e);
          this.handleError({ error: e, component, paymentReference });
          component.setStatus("ready");
          actions.reject();
        }
      },
      analytics: { enabled: true },
      locale: adyenLocale,
      environment: configJson.environment,
      clientKey: configJson.clientKey,
      countryCode: this.countryCode,
      session: {
        id: data.id,
        sessionData: data.sessionData,
      },
    });

    this.adyenCheckout = adyenCheckout;

    if (configJson.applePayConfig) {
      this.applePayConfig = configJson.applePayConfig;
    }

    if (configJson.paymentComponentsConfig) {
      this.paymentComponentsConfigOverride = configJson.paymentComponentsConfig;
    }

    if (configJson.storedPaymentMethodsConfig) {
      this.storedPaymentMethodsConfig = {
        isEnabled: configJson.storedPaymentMethodsConfig.isEnabled,
        storedPaymentMethods: storedPaymentMethodsList,
      };
    }
  }

  private async initializeAdyenForExpressCheckout(): Promise<void> {
    if (this.adyenCheckout) return;

    const adyenLocale = convertToAdyenLocale(
      this.initOptions.locale || "en-US"
    );

    const [paymentMethodsResponse, configResponse] = await Promise.all([
      fetch(`${this.processorUrl}/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify({
          allowedPaymentMethods: ["paypal", "googlepay", "applepay"],
          countryCode: this.countryCode,
        }),
      }),
      fetch(`${this.processorUrl}/operations/config`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
      }),
    ]);

    const [paymentMethodsJson, configJson] = await Promise.all([
      paymentMethodsResponse.json(),
      configResponse.json(),
    ]);

    if (!paymentMethodsJson.paymentMethods) {
      throw new AdyenInitError("Not able to initialize Adyen", this.sessionId);
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
      analytics: { enabled: true },
      locale: adyenLocale,
      environment: configJson.environment,
      clientKey: configJson.clientKey,
      countryCode: this.countryCode,
    });

    this.adyenCheckout = adyenCheckout;

    if (configJson.applePayConfig) {
      this.applePayConfig = configJson.applePayConfig;
    }
  }

  private handleError(opts: {
    error: any;
    component: UIElement;
    paymentReference?: string;
  }) {
    if (this.initOptions.onError) {
      this.initOptions.onError(opts.error, {
        paymentReference: opts?.paymentReference || "",
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
        paymentReference: opts?.paymentReference || "",
        method: { type: getPaymentMethodType(opts.component?.props?.type) },
      });
    }
  }
}
