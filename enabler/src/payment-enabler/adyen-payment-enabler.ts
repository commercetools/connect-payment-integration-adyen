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
} from "@adyen/adyen-web";
import { AdyenCheckout } from "@adyen/adyen-web/auto";
import "@adyen-css";
import {
  DropinType,
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentExpressBuilder,
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
import { PayPalExpressBuilder } from "../express/paypal";

class AdyenInitError extends Error {
  sessionId: string;
  constructor(message: string, sessionId: string) {
    super(message);
    this.name = "AdyenInitError";
    this.message = message;
    this.sessionId = sessionId;
  }
}

type AdyenEnablerOptions = EnablerOptions & {
  onActionRequired?: (action: any) => Promise<void>;
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
};

export class AdyenPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;
  private initOptions: AdyenEnablerOptions;
  private sessionId: string;
  private processorUrl: string;
  private countryCode: string;
  private currencyCode: string;
  private adyenCheckout: ICore;
  private applePayConfig?: {
    usesOwnCertificate: boolean;
  };

  constructor(options: AdyenEnablerOptions) {
    this.sessionId = options.sessionId;
    this.processorUrl = options.processorUrl;
    this.countryCode = options.countryCode;
    this.currencyCode = options.currencyCode;
    this.initOptions = options;
  }

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder | never> {
    await this.initializeAdyenWithSession();

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
    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }
    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      applePayConfig: this.applePayConfig,
    });
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder | never> {
    await this.initializeAdyenWithSession();

    const supportedMethods = {
      embedded: DropinEmbeddedBuilder,
    };
    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Dropin type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }

    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      applePayConfig: this.applePayConfig,
    });
  }

  async createExpressBuilder(type: string): Promise<PaymentExpressBuilder | never> {
    await this.initializeAdyenForExpressCheckout();

    const supportedMethods = {
      googlepay: GooglePayExpressBuilder,
      paypal: PayPalExpressBuilder,
    };
    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Express checkout component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(
          ", "
        )}`
      );
    }

    return new supportedMethods[type]({
      adyenCheckout: this.adyenCheckout,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      countryCode: this.countryCode,
      currencyCode: this.currencyCode,
      applePayConfig: this.applePayConfig,
    });
  }

  private async initializeAdyenWithSession(): Promise<void> {
    const [sessionResponse, configResponse] = await Promise.all([
      fetch(this.processorUrl + "/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify({}),
      }),
      fetch(this.processorUrl + "/operations/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
      }),
    ]);

    const [sessionJson, configJson] = await Promise.all([sessionResponse.json(), configResponse.json()]);

    const { sessionData: data, paymentReference } = sessionJson;

    if (!data || !data.id) {
      throw new AdyenInitError("Not able to initialize Adyen, session data missing", this.sessionId);
    } else {
      const adyenCheckout = await AdyenCheckout({
        onPaymentCompleted: (result: PaymentCompletedData, _component: UIElement) => {
          console.info("payment completed", result.resultCode);
        },
        onPaymentFailed: (result: PaymentFailedData, _component: UIElement) => {
          console.info("payment failed", result.resultCode);
        },
        onError: (error: AdyenCheckoutError, component: UIElement) => {
          if (error.name === "CANCEL") {
            console.info("shopper canceled the payment attempt");
            component.setStatus("ready");
          } else {
            console.error(error.name, error.message, error.stack, component);
          }
          this.initOptions.onError && this.initOptions.onError(error);
        },
        onSubmit: async (state: SubmitData, component: UIElement, actions: SubmitActions) => {
          console.log("## onSubmit - state", state);
          try {
            const reqData = {
              ...state.data,
              channel: "Web",
              paymentReference,
            };
            const response = await fetch(this.processorUrl + "/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": this.initOptions.sessionId,
              },
              body: JSON.stringify(reqData),
            });
            const data = await response.json();
            if (data.action) {
              if (["threeDS2", "qrCode"].includes(data.action.type) && this.initOptions.onActionRequired) {
                this.initOptions.onActionRequired({ type: "fullscreen" });
              }
              component.handleAction(data.action);
            } else {
              if (data.resultCode === "Authorised" || data.resultCode === "Pending") {
                component.setStatus("success");
                this.initOptions.onComplete && this.initOptions.onComplete({ isSuccess: true, paymentReference });
              } else {
                this.initOptions.onComplete && this.initOptions.onComplete({ isSuccess: false });
                component.setStatus("error");
              }
            }

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
            if (data.resultCode === "Authorised" || data.resultCode === "Pending") {
              component.setStatus("success");
              this.initOptions.onComplete && this.initOptions.onComplete({ isSuccess: true, paymentReference });
            } else {
              this.initOptions.onComplete && this.initOptions.onComplete({ isSuccess: false });
              component.setStatus("error");
            }
            actions.resolve({ resultCode: data.resultCode });
          } catch (e) {
            console.error("Not able to submit the payment details", e);
            component.setStatus("ready");
            actions.reject();
          }
        },
        analytics: {
          enabled: true,
        },
        ...(this.initOptions.locale ? { locale: this.initOptions.locale } : {}),
        environment: configJson.environment,
        clientKey: configJson.clientKey,
        session: {
          id: data.id,
          sessionData: data.sessionData,
        },
      });

      this.adyenCheckout = adyenCheckout;
      if (configJson.applePayConfig) {
        this.applePayConfig = configJson.applePayConfig;
      }
    }
  }

  private async initializeAdyenForExpressCheckout(): Promise<void> {
    const configResponse = await fetch(this.processorUrl + "/operations/config", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
    });

    const configJson = await configResponse.json();

    const adyenCheckout = await AdyenCheckout({
      onPaymentCompleted: (result: PaymentCompletedData, _component: UIElement) => {
        console.info("payment completed", result.resultCode);
      },
      onPaymentFailed: (result: PaymentFailedData, _component: UIElement) => {
        console.info("payment failed", result.resultCode);
      },
      onError: (error: AdyenCheckoutError, component: UIElement) => {
        if (error.name === "CANCEL") {
          console.info("shopper canceled the payment attempt");
          component.setStatus("ready");
        } else {
          console.error(error.name, error.message, error.stack, component);
        }
        this.initOptions.onError && this.initOptions.onError(error);
      },
      analytics: {
        enabled: true,
      },
      ...(this.initOptions.locale ? { locale: this.initOptions.locale } : {}),
      environment: configJson.environment,
      clientKey: configJson.clientKey,
      countryCode: this.initOptions.countryCode ?? "DE", //TODO: obtain during instantiation
    });

    this.adyenCheckout = adyenCheckout;
    if (configJson.applePayConfig) {
      this.applePayConfig = configJson.applePayConfig;
    }
  }
}
