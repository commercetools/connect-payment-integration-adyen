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
  DropinType,
  EnablerOptions,
  getPaymentMethodType,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
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
import { BlikBuilder } from "../components/payment-methods/blik";
import { Przelewy24Builder } from "../components/payment-methods/przelewy24";
import { SwishBuilder } from "../components/payment-methods/swish";
import { VippsBuilder } from "../components/payment-methods/vipps";
import { MobilePayBuilder } from "../components/payment-methods/mobilepay";
import { convertToAdyenLocale } from "../converters/locale.converter";

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
  applePayConfig?: {
    usesOwnCertificate: boolean;
  };
};

export class AdyenPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: AdyenEnablerOptions) {
    this.setupData = AdyenPaymentEnabler._Setup(options);
  }

  private static _Setup = async (options: AdyenEnablerOptions): Promise<{ baseOptions: BaseOptions }> => {
    const adyenLocale = convertToAdyenLocale(options.locale || "en-US");

    const [sessionResponse, configResponse] = await Promise.all([
      fetch(options.processorUrl + "/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
        body: JSON.stringify({
          shopperLocale: adyenLocale,
        }),
      }),
      fetch(options.processorUrl + "/operations/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
      }),
    ]);

    const handleError = (error: any, component: UIElement) => {
      if (options.onError) {
        options.onError(error, { 
          paymentReference, 
          method: { type: getPaymentMethodType(component?.props?.type )} 
        });
      }
    };
    const handleComplete = (isSuccess: boolean, component: UIElement) => {
      if (options.onComplete) {
        options.onComplete({ 
          isSuccess, 
          paymentReference,
          method: { type: getPaymentMethodType(component?.props?.type )} 
        });
      }
    }

    const [sessionJson, configJson] = await Promise.all([
      sessionResponse.json(),
      configResponse.json(),
    ]);

    const { sessionData: data, paymentReference } = sessionJson;

    if (!data || !data.id) {
      throw new AdyenInitError(
        "Not able to initialize Adyen, session data missing",
        options.sessionId,
      );
    } else {
      const adyenCheckout = await AdyenCheckout({
        onPaymentCompleted: (
          result: PaymentCompletedData,
          _component: UIElement,
        ) => {
          console.info("payment completed", result.resultCode);
        },
        onPaymentFailed: (result: PaymentFailedData, _component: UIElement) => {
          handleComplete(false, _component);
          console.info("payment failed", result.resultCode);
        },
        onError: (error: AdyenCheckoutError, component: UIElement) => {
          if (error.name === "CANCEL") {
            console.info("shopper canceled the payment attempt");
            component.setStatus("ready");
          } else {
            console.error(error.name, error.message, error.stack, component);
          }
          handleError(error, component);
        },
        onSubmit: async (state: SubmitData, component: UIElement, actions: SubmitActions) => {
          try {
            const reqData = {
              ...state.data,
              shopperLocale: adyenLocale,
              channel: "Web",
              paymentReference,
            };
            const response = await fetch(options.processorUrl + "/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": options.sessionId,
              },
              body: JSON.stringify(reqData),
            });
            const data = await response.json();
            if (data.action) {
              if (
                ["threeDS2", "qrCode"].includes(data.action.type) &&
                options.onActionRequired
              ) {
                options.onActionRequired({ type: "fullscreen" });
              }
              component.handleAction(data.action);
            } else {
              if (
                data.resultCode === "Authorised" ||
                data.resultCode === "Pending"
              ) {
                component.setStatus("success");
                handleComplete(true, component);
              } else {
                handleComplete(false, component);
                component.setStatus("error");
              }
            }

            actions.resolve({
              resultCode: data.resultCode,
              action: data.action,
            });
          } catch (e) {
            handleError(e, component);
            component.setStatus("ready");
            actions.reject(e);
          }
        },
        onAdditionalDetails: async (
          state: AdditionalDetailsData,
          component: UIElement,
          actions: AdditionalDetailsActions,
        ) => {
          try {
            const requestData = {
              ...state.data,
              paymentReference,
            };
            const url = options.processorUrl.endsWith("/")
              ? `${options.processorUrl}payments/details`
              : `${options.processorUrl}/payments/details`;

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": options.sessionId,
              },
              body: JSON.stringify(requestData),
            });
            const data = await response.json();
            if (
              data.resultCode === "Authorised" ||
              data.resultCode === "Pending"
            ) {
              component.setStatus("success");
              handleComplete(true, component);
            } else {
              handleComplete(false, component);
              component.setStatus("error");
            }
            actions.resolve({ resultCode: data.resultCode });
          } catch (e) {
            console.error("Not able to submit the payment details", e);
            handleError(e, component);
            component.setStatus("ready");
            actions.reject();
          }
        },
        analytics: {
          enabled: true,
        },

        locale: adyenLocale,
        environment: configJson.environment,
        clientKey: configJson.clientKey,
        session: {
          id: data.id,
          sessionData: data.sessionData,
        },
      });

      return {
        baseOptions: {
          adyenCheckout: adyenCheckout,
          sessionId: options.sessionId,
          processorUrl: options.processorUrl,
          ...(configJson.applePayConfig && {
            applePayConfig: configJson.applePayConfig,
          }),
        },
      };
    }
  };

  async createComponentBuilder(
    type: string,
  ): Promise<PaymentComponentBuilder | never> {
    const setupData = await this.setupData;
    if (!setupData) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }
    const supportedMethods = {
      applepay: ApplePayBuilder,
      bancontactcard: BancontactCardBuilder,
      bancontactmobile: BancontactMobileBuilder,
      blik: BlikBuilder,
      card: CardBuilder,
      eps: EPSBuilder,
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
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`,
      );
    }
    return new supportedMethods[type](setupData.baseOptions);
  }

  async createDropinBuilder(
    type: DropinType,
  ): Promise<PaymentDropinBuilder | never> {
    const setupData = await this.setupData;
    if (!setupData) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }

    const supportedMethods = {
      embedded: DropinEmbeddedBuilder,
    };
    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Dropin type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`,
      );
    }

    return new supportedMethods[type](setupData.baseOptions);
  }
}
