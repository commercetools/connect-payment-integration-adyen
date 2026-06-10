import {
  AddressData,
  ApplePay,
  GooglePay,
  PayPal,
  SubmitActions,
  SubmitData,
  UIElement,
} from "@adyen/adyen-web";
import {
  ExpressAddressData,
  ExpressComponent,
  ExpressOptions,
  ExpressShippingOptionData,
  OnComplete,
} from "../payment-enabler/payment-enabler";
import { ProcessorApiClient } from '../api/processor-api.client';
import { ExpressPaymentDataResponse } from '../api/processor-api.type';

export type ShippingMethodCost = {
  [key: string]: string;
};

// Re-export for backwards compatibility with subclasses that reference InitialPaymentData
export type InitialPaymentData = ExpressPaymentDataResponse;

export abstract class DefaultAdyenExpressComponent implements ExpressComponent {
  protected processorUrl: string;
  protected sessionId: string;
  protected countryCode: string;
  protected currencyCode: string;
  protected expressOptions: ExpressOptions;
  protected component: GooglePay | ApplePay | PayPal;
  protected availableShippingMethods: ExpressShippingOptionData[];
  protected paymentMethodConfig: { [key: string]: string };
  protected onComplete: OnComplete;
  protected apiClient: ProcessorApiClient;

  constructor(opts: {
    expressOptions: ExpressOptions;
    processorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
    paymentMethodConfig: { [key: string]: string };
    onComplete: OnComplete;
  }) {
    this.expressOptions = opts.expressOptions;
    this.processorUrl = opts.processorUrl;
    this.sessionId = opts.sessionId;
    this.countryCode = opts.countryCode;
    this.currencyCode = opts.currencyCode;
    this.paymentMethodConfig = opts.paymentMethodConfig;
    this.onComplete = opts.onComplete;
    this.apiClient = new ProcessorApiClient({ processorUrl: opts.processorUrl, sessionId: opts.sessionId });
  }

  abstract init(): void;

  mount(selector: string): void {
    this.component.mount(selector);
  }

  async setShippingAddress(opts: {
    address: ExpressAddressData;
  }): Promise<void> {
    if (this.expressOptions.onShippingAddressSelected) {
      await this.expressOptions.onShippingAddressSelected(opts);
      return;
    }

    throw new Error("setShippingAddress not implemented");
  }

  async getShippingMethods(opts: {
    address: ExpressAddressData;
  }): Promise<ExpressShippingOptionData[]> {
    if (this.expressOptions.getShippingMethods) {
      this.availableShippingMethods =
        await this.expressOptions.getShippingMethods(opts);
      return this.availableShippingMethods;
    }

    throw new Error("getShippingMethods not implemented");
  }

  async setShippingMethod(opts: {
    shippingMethod: { id: string };
  }): Promise<void> {
    if (this.expressOptions.onShippingMethodSelected) {
      await this.expressOptions.onShippingMethodSelected(opts);
      return;
    }

    throw new Error("setShippingMethod not implemented");
  }

  async handleComplete(opts: {
    isSuccess: boolean;
    paymentReference: string;
    method: { type: string };
  }): Promise<void> {
    if (this.expressOptions.onComplete) {
      await this.expressOptions.onComplete(opts);
      return;
    }

    throw new Error("onComplete not implemented");
  }

  protected setSessionId(sessionId): void {
    this.sessionId = sessionId;
    this.apiClient = new ProcessorApiClient({ processorUrl: this.processorUrl, sessionId });
  }

  protected async getInitialPaymentData(): Promise<InitialPaymentData> {
    try {
      return await this.apiClient.getExpressPaymentData();
    } catch (error) {
      console.error("## getPaymentData - critical error", error);
      throw error;
    }
  }


  // HINT: this is used to display currency with it's symbol. '10.00' -> $10.00
  protected formatCurrency(opts: {
    centAmount: number;
    currencyCode: string;
    fractionDigits: number;
  }): string {
    const amount = opts.centAmount / Math.pow(10, opts.fractionDigits);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: opts.currencyCode,
    }).format(amount);
  }

  protected convertAddress(opts: {
    address: AddressData;
    email?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }): ExpressAddressData {
    return {
      country: opts.address.country,
      firstName: opts.firstName,
      lastName: opts.lastName,
      streetName: opts.address.street,
      // Remove Adyen's default value for street number
      streetNumber: opts.address.houseNumberOrName === "ZZ" ? "" : opts.address.houseNumberOrName,
      region: opts.address.stateOrProvince,
      postalCode: opts.address.postalCode,
      city: opts.address.city,
      email: opts.email,
      phone: opts.phoneNumber,
    };
  }

  // HINT: this converts 1000 -> to 10.00 if fraction digit is 2
  protected centAmountToString(centAmount: number, fractionDigits: number): string {
    return (centAmount / 100).toFixed(fractionDigits);
  }

  protected async submit(opts: {
    state: SubmitData;
    component: UIElement;
    actions: SubmitActions;
    extraRequestData: Record<string, any>;
    onBeforeResolve?: (data: any) => void;
  }) {
    try {
      const reqData = {
        ...opts.state.data,
        channel: "Web",
        ...opts.extraRequestData,
      };

      const data = await this.apiClient.createExpressPayment(reqData);

      if (opts.onBeforeResolve) {
        opts.onBeforeResolve(data);
      }

      if (data.action) {
        opts.component.handleAction(data.action);
      } else {
        const isSuccess =
          opts.extraRequestData.resultCode === "Authorised" ||
          data.resultCode === "Pending";

        opts.component.setStatus(isSuccess ? "success" : "error");
      }

      opts.actions.resolve({
        resultCode: data.resultCode,
        action: data.action,
      });
    } catch (err) {
      opts.actions.reject(err);
    }
  }
}
