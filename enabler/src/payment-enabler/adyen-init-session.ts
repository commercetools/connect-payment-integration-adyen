import {
  AdditionalDetailsActions,
  AdditionalDetailsData,
  AdyenCheckout,
  AdyenCheckoutError,
  PaymentCompletedData,
  PaymentFailedData,
  SubmitActions,
  SubmitData,
  UIElement,
} from "@adyen/adyen-web";
import { AdyenEnablerOptions, BaseOptions, StoredPaymentMethodsConfig } from "./adyen-payment-enabler";
import { convertToAdyenLocale } from "../converters/locale.converter";
import { CocoStoredPaymentMethod, DropinType, getPaymentMethodType } from "./payment-enabler";
import { ProcessorApiClient } from "../api/processor-api.client";

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
  private apiClient: ProcessorApiClient;
  private applePayConfig?: { usesOwnCertificate: boolean };
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private paymentComponentsConfigOverride?: Record<string, any>;
  private storePaymentDetails = false;

  constructor(initOptions: AdyenEnablerOptions) {
    this.initOptions = initOptions;
    this.apiClient = new ProcessorApiClient({
      processorUrl: initOptions.processorUrl,
      sessionId: initOptions.sessionId,
    });
  }

  async init(): Promise<BaseOptions> {
    const adyenLocale = convertToAdyenLocale(this.initOptions.locale || "en-US");

    const [sessionJson, configJson] = await Promise.all([
      this.apiClient.createSession({ shopperLocale: adyenLocale }),
      this.apiClient.getConfig(),
    ]);

    let orderAmount: { value: number; currency: string } | undefined;
    let currentRemainingAmount = 0;
    let storedPaymentMethodsList: CocoStoredPaymentMethod[] = [];
    if (configJson.storedPaymentMethodsConfig?.isEnabled === true) {
      const storedPaymentMethods = await this.apiClient.getStoredPaymentMethods();
      storedPaymentMethodsList = storedPaymentMethods.storedPaymentMethods;
    }

    const { sessionData: data } = sessionJson;
    let paymentReference = "";

    if (!data || !data.id) {
      throw new AdyenInitError("Not able to initialize Adyen, session data missing", this.initOptions.sessionId);
    }

    const adyenCheckout = await AdyenCheckout({
      onPaymentCompleted: (result: PaymentCompletedData, _component: UIElement) => {
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
      onSubmit: async (state: SubmitData, component: UIElement, actions: SubmitActions) => {
        try {
          const reqData = {
            ...state.data,
            shopperLocale: adyenLocale,
            channel: "Web",
            ...(this.getStorePaymentDetails() ? { storePaymentMethod: true } : {}),
          };

          const data = await this.apiClient.createPayment(reqData);
          paymentReference = data.paymentReference;
          currentRemainingAmount = data.order?.remainingAmount?.value ?? 0;
          if (data.action) {
            if (["threeDS2", "qrCode"].includes(data.action.type) && this.initOptions.onActionRequired) {
              this.initOptions.onActionRequired({ type: "fullscreen" });
            }
            component.handleAction(data.action);
          } else {
            if (data.resultCode === "Authorised" || data.resultCode === "Pending") {
              component.setStatus("success");
              const remainingAmount = data.order?.remainingAmount?.value ?? 0;
              if (remainingAmount === 0) {
                this.handleComplete({
                  isSuccess: true,
                  component: component,
                  paymentReference,
                });
              }
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
            ...(data.order?.orderData && { order: data.order }),
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
        actions: AdditionalDetailsActions,
      ) => {
        try {
          const data = await this.apiClient.confirmPaymentDetails({ ...state.data, paymentReference });
          if (data.resultCode === "Authorised" || data.resultCode === "Pending") {
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
      onBalanceCheck: async (resolve, reject, data) => {
        try {
          const result = await this.apiClient.checkGiftCardBalance(data);
          resolve(result);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      onOrderRequest: async (resolve, reject) => {
        try {
          const order = await this.apiClient.createOrder();
          orderAmount = order.amount;
          currentRemainingAmount = order.remainingAmount?.value ?? 0;
          resolve({
            orderData: order.orderData,
            pspReference: order.pspReference ?? "",
            remainingAmount: order.remainingAmount,
          });
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      onOrderCancel: async (data, actions) => {
        try {
          await this.apiClient.cancelOrder({
            orderData: data.order.orderData,
            pspReference: data.order.pspReference,
          });
          actions.resolve({ amount: orderAmount! });
        } catch {
          actions.reject("Failed to cancel gift card order");
        }
      },
      analytics: { enabled: true },
      locale: adyenLocale,
      environment: configJson.environment,
      clientKey: configJson.clientKey,
      session: {
        id: data.id,
        sessionData: data.sessionData,
      },
    });

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
      adyenCheckout,
      sessionId: this.initOptions.sessionId,
      processorUrl: this.initOptions.processorUrl,
      getRemainingAmount: () => currentRemainingAmount,
      currencyCode: this.initOptions.currencyCode,
      applePayConfig: this.applePayConfig,
      paymentComponentsConfigOverride: this.paymentComponentsConfigOverride,
      storedPaymentMethodsConfig: this.storedPaymentMethodsConfig,
      setStorePaymentDetails: this.setStorePaymentDetails,
    };
  }

  private resolveMethodType(component: UIElement): string {
    try {
      if (component?.props?.isDropin) return DropinType.embedded;
      return getPaymentMethodType(component?.props?.type);
    } catch {
      return "unknown";
    }
  }

  private handleError(opts: { error: any; component: UIElement; paymentReference: string }) {
    if (!this.initOptions.onError) return;
    const methodType = this.resolveMethodType(opts.component);
    this.initOptions.onError(opts.error, {
      paymentReference: opts.paymentReference,
      ...(methodType && { method: { type: methodType } }),
    });
  }

  private handleComplete(opts: { isSuccess: boolean; component: UIElement; paymentReference: string }) {
    if (!this.initOptions.onComplete) return;
    this.initOptions.onComplete({
      isSuccess: opts.isSuccess,
      paymentReference: opts.paymentReference,
      method: { type: this.resolveMethodType(opts.component) },
    });
  }

  setStorePaymentDetails = (enabled: boolean): void => {
    this.storePaymentDetails = enabled;
  };

  private getStorePaymentDetails = (): boolean => {
    return this.storePaymentDetails;
  };
}
