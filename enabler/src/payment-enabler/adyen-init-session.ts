import {
  AdditionalDetailsActions,
  AdditionalDetailsData,
  AdyenCheckout,
  AdyenCheckoutError,
  ICore,
  PaymentCompletedData,
  PaymentFailedData,
  SubmitActions,
  SubmitData,
  UIElement,
} from "@adyen/adyen-web";
import {
  AdyenEnablerOptions,
  BaseOptions,
  StoredPaymentMethodsConfig,
} from "./adyen-payment-enabler";
import { convertToAdyenLocale } from "../converters/locale.converter";
import {
  CocoStoredPaymentMethod,
  getPaymentMethodType,
} from "./payment-enabler";

export interface AdyenInit {
  init(type: string): Promise<BaseOptions>;
}

class AdyenInitError extends Error {
  sessionId: string;
  constructor(message: string, sessionId: string) {
    super(message);
    this.name = "AdyenInitError";
    this.sessionId = sessionId;
  }
}

export class AdyenInitWithSessionFlow implements AdyenInit {
  private initOptions: AdyenEnablerOptions;
  private adyenCheckout: ICore;
  private applePayConfig?: { usesOwnCertificate: boolean };
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private paymentComponentsConfigOverride?: Record<string, any>;
  private storePaymentDetails = false;

  constructor(initOptions: AdyenEnablerOptions) {
    this.initOptions = initOptions;
  }

  async init(): Promise<BaseOptions> {
    if(this.adyenCheckout) {
      return {
        adyenCheckout: this.adyenCheckout,
        sessionId: this.initOptions.sessionId,
        processorUrl: this.initOptions.processorUrl,
        countryCode: this.initOptions.countryCode,
        currencyCode: this.initOptions.currencyCode,
        applePayConfig: this.applePayConfig,
        paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
        storedPaymentMethodsConfig: this.storedPaymentMethodsConfig,
        setStorePaymentDetails: this.setStorePaymentDetails,
      };
    }

    const adyenLocale = convertToAdyenLocale(
      this.initOptions.locale || "en-US"
    );

    const [sessionResponse, configResponse] = await Promise.all([
      fetch(`${this.initOptions.processorUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.initOptions.sessionId,
        },
        body: JSON.stringify({
          shopperLocale: adyenLocale,
        }),
      }),
      fetch(`${this.initOptions.processorUrl}/operations/config`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.initOptions.sessionId,
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
        this.initOptions.sessionId
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
      countryCode: this.initOptions.countryCode,
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

    return {
      adyenCheckout: this.adyenCheckout,
      sessionId: this.initOptions.sessionId,
      processorUrl: this.initOptions.processorUrl,
      countryCode: this.initOptions.countryCode,
      currencyCode: this.initOptions.currencyCode,
      applePayConfig: this.applePayConfig,
      paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
      storedPaymentMethodsConfig: this.storedPaymentMethodsConfig,
      setStorePaymentDetails: this.setStorePaymentDetails,
    };
  }

  private handleError(opts: {
    error: any;
    component: UIElement;
    paymentReference: string;
  }) {
    if (this.initOptions.onError) {
      this.initOptions.onError(opts.error, {
        paymentReference: opts.paymentReference,
        method: { type: getPaymentMethodType(opts.component?.props?.type) },
      });
    }
  }

  private handleComplete(opts: {
    isSuccess: boolean;
    component: UIElement;
    paymentReference: string;
  }) {
    if (this.initOptions.onComplete) {
      this.initOptions.onComplete({
        isSuccess: opts.isSuccess,
        paymentReference: opts.paymentReference,
        method: { type: getPaymentMethodType(opts.component?.props?.type) },
      });
    }
  }

  setStorePaymentDetails = (enabled: boolean): void => {
    this.storePaymentDetails = enabled;
  };

  private getStorePaymentDetails = (): boolean => {
    return this.storePaymentDetails;
  };
}
