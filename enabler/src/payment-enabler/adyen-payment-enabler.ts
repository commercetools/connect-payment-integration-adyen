import AdyenCheckout from "@adyen/adyen-web";
import "@adyen/adyen-web/dist/adyen.css";
import { CoreOptions } from "@adyen/adyen-web/dist/types/core/types";
import { BaseOptions } from "../components/base";

import { CardBuilder } from "../components/payment-methods/card";
import { GooglepayBuilder } from "../components/payment-methods/googlepay";
import { IdealBuilder } from "../components/payment-methods/ideal";
import { KlarnaBuilder } from "../components/payment-methods/klarna";
import {
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentEnabler,
} from "./payment-enabler";
import { ApplepayBuilder } from "../components/payment-methods/applepay";

type AdyenEnablerOptions = EnablerOptions & {
  config: Omit<typeof CoreOptions, "environment" | "clientKey" | "session">;
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

    const adyenCheckout = await AdyenCheckout({
      onPaymentCompleted: (result, component) => {
        debugger;
        console.info(result, component);
        window.location.href = options.processorUrl + "/confirm";
      },
      onError: (error, component) => {
        console.error(error.name, error.message, error.stack, component);
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
          console.log("onSubmit test", state, component, data);
          if (data.action) {
            options.onActionRequired &&
              options.onActionRequired({
                offsite: data.action.type === "redirect",
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

      ...(options.config?.locale ? { locale: options.config.locale } : {}),
      ...(options.config?.showPayButton
        ? { showPayButton: options.config.showPayButton }
        : {}),

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
      },
    };
  };

  async createComponentBuilder(
    type: string
  ): Promise<PaymentComponentBuilder | never> {
    const { baseOptions } = await this.setupData;
    const supportedMethods = {
      applepay: ApplepayBuilder,
      card: CardBuilder,
      googlepay: GooglepayBuilder,
      ideal: IdealBuilder,
      klarna: KlarnaBuilder,
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
}
