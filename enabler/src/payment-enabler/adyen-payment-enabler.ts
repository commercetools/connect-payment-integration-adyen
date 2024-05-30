import AdyenCheckout from "@adyen/adyen-web";
import "@adyen/adyen-web/dist/adyen.css";
import { BaseOptions } from "../components/base";
import {
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentEnabler,
} from "./payment-enabler";
import { ApplePayBuilder } from "../components/payment-methods/applepay";
import { CardBuilder } from "../components/payment-methods/card";
import { GooglepayBuilder } from "../components/payment-methods/googlepay";
import { IdealBuilder } from "../components/payment-methods/ideal";
import { PaypalBuilder } from "../components/payment-methods/paypal";
import { KlarnaPayNowBuilder } from "../components/payment-methods/klarnaPaynow";
import { KlarnaPayLaterBuilder } from "../components/payment-methods/klarnaPayLater";
import { KlarnaPayOverTimeBuilder } from "../components/payment-methods/klarnaPayOverTime";

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
export class AdyenPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: AdyenEnablerOptions) {
    this.setupData = AdyenPaymentEnabler._Setup(options);
  }

  private static _Setup = async (
    options: AdyenEnablerOptions
  ): Promise<{ baseOptions: BaseOptions }> => {
    const [sessionResponse, configResponse] = await Promise.all([
      fetch(options.processorUrl + "/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
        body: JSON.stringify({}),
      }),
      fetch(options.processorUrl + "/operations/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
      }),
    ]);

    const [sessionJson, configJson] = await Promise.all([
      sessionResponse.json(),
      configResponse.json(),
    ]);

    const { sessionData: data, paymentReference } = sessionJson;

    if (!data || !data.id) {
      throw new AdyenInitError("No session data found", options.sessionId);
    } else {
      const adyenCheckout = await AdyenCheckout({
        onPaymentCompleted: (result, component) => {
          console.info(result, component);
          window.location.href = options.processorUrl + "/confirm";
        },
        onError: (error, component) => {
          console.error(error.name, error.message, error.stack, component);
          options.onError && options.onError(error);
        },
        onSubmit: async (state, component) => {
          try {
            const reqData = {
              ...state.data,
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
              options.onActionRequired &&
                options.onActionRequired({
                  type:
                    data.action.type === "redirect"
                      ? "redirect"
                      : data.action.type === "threeDS2"
                        ? "threeDS"
                        : "other",
                });
              component.handleAction(data.action);
            } else {
              if (data.resultCode === "Authorised") {
                component.setStatus("success");
                options.onComplete &&
                  options.onComplete({ isSuccess: true, paymentReference });
              } else {
                options.onComplete && options.onComplete({ isSuccess: false });
                component.setStatus("error");
              }
            }
          } catch (e) {
            console.log("Payment aborted by client");
            component.setStatus("ready");
          }
        },
        onAdditionalDetails: async (state, component) => {
          console.log("onAdditionalDetails", state, component);
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
          if (data.resultCode === "Authorised") {
            component.setStatus("success");
            options.onComplete &&
              options.onComplete({ isSuccess: true, paymentReference });
          } else {
            options.onComplete && options.onComplete({ isSuccess: false });
            component.setStatus("error");
          }
        },
        analytics: {
          enabled: true,
        },

        ...(options.locale ? { locale: options.locale } : {}),

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
    type: string
  ): Promise<PaymentComponentBuilder | never> {
    const setupData = await this.setupData;
    if (!setupData) {
      throw new Error("AdyenPaymentEnabler not initialized");
    }
    const supportedMethods = {
      applepay: ApplePayBuilder,
      card: CardBuilder,
      googlepay: GooglepayBuilder,
      ideal: IdealBuilder,
      paypal: PaypalBuilder,
      "klarna_paynow": KlarnaPayNowBuilder,
      klarna: KlarnaPayLaterBuilder,
      "klarna_account": KlarnaPayOverTimeBuilder
    };
    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }
    return new supportedMethods[type](setupData.baseOptions);
  }
}
