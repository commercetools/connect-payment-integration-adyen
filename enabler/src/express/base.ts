import { AddressData, ApplePay, GooglePay, PayPal } from "@adyen/adyen-web";
import {
  ExpressAddressData,
  ExpressComponent,
  ExpressOptions,
  ExpressShippingOptionData,
} from "../payment-enabler/payment-enabler";

export type ShippingMethodCost = {
  [key: string]: string;
};

export type InitialPaymentData = {
  totalPrice: {
    centAmount: number;
    currencyCode: string;
  };
  lineItems: {
    name: string;
    amount: {
      centAmount: number;
      currencyCode: string;
    };
    type: string;
  }[];
  currencyCode: string;
};

export abstract class DefaultAdyenExpressComponent implements ExpressComponent {
  protected processorUrl: string;
  protected sessionId: string;
  protected countryCode: string;
  protected currencyCode: string;
  protected expressOptions: ExpressOptions;
  protected component: GooglePay | ApplePay | PayPal;
  protected availableShippingMethods: ExpressShippingOptionData[];

  constructor(opts: {
    expressOptions: ExpressOptions;
    proccessorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
  }) {
    this.expressOptions = opts.expressOptions;
    this.processorUrl = opts.proccessorUrl;
    this.sessionId = opts.sessionId;
    this.countryCode = opts.countryCode;
    this.currencyCode = opts.currencyCode;
  }

  abstract init(): void;

  mount(selector: string): void {
    this.component.mount(selector);
  }

  async setShippingAddress(opts: { address: ExpressAddressData }): Promise<void> {
    if (this.expressOptions.onShippingAddressSelected) {
      await this.expressOptions.onShippingAddressSelected(opts);
    }
  }

  async getShippingMethods(opts: { address: ExpressAddressData }): Promise<ExpressShippingOptionData[]> {
    this.availableShippingMethods = await this.expressOptions.getShippingMethods(opts);

    return this.availableShippingMethods;
  }

  async setShippingMethod(opts: { shippingOption: { id: string } }): Promise<void> {
    if (this.expressOptions.onShippingMethodSelected) {
      await this.expressOptions.onShippingMethodSelected(opts);
    }
  }

  protected async getInitialPaymentData(): Promise<InitialPaymentData> {
    try {
      const response = await fetch(`${this.processorUrl}/express-payment-data`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
      });
      const data = await response.json();
      return data as InitialPaymentData;
    } catch (error) {
      console.error("## getPaymentData - critical error", error);
      throw error;
    }
  }

  protected getShippingMethodCost(selectedShippingMethodId: string): string {
    const selectedShippingMethod = this.availableShippingMethods.find(
      (method) => method.id === selectedShippingMethodId
    );

    return this.centAmountToString(selectedShippingMethod.amount.centAmount);
  }

  protected formatCurrency(opts: { centAmount: number; currencyCode: string }): string {
    const amount = opts.centAmount / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: opts.currencyCode,
    }).format(amount);
  }

  protected convertAddress(opts: { address: AddressData; email?: string; phoneNumber?: string }): ExpressAddressData {
    return {
      country: opts.address.country,
      firstName: opts.address.firstName,
      lastName: opts.address.lastName,
      streetName: opts.address.street,
      streetNumber: opts.address.houseNumberOrName,
      region: opts.address.stateOrProvince,
      postalCode: opts.address.postalCode,
      city: opts.address.city,
      email: opts.email,
      phone: opts.phoneNumber,
    };
  }

  protected centAmountToString(centAmount: number): string {
    return (centAmount / 100).toFixed(2);
  }
}
