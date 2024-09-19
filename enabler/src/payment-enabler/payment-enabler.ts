export interface PaymentComponent {
  submit(): void;
  mount(selector: string): void;
  showValidation?(): void;
  isValid?(): boolean;
  getState?(): {
    card?: {
      endDigits?: string;
      brand?: string;
      expiryDate?: string;
    }
  };
  isAvailable?(): Promise<boolean>;
}

export interface PaymentComponentBuilder {
  componentHasSubmit: boolean;
  build(config: ComponentOptions): PaymentComponent;
}


export type EnablerOptions = {
  processorUrl: string;
  sessionId: string;
  countryCode?: string; //TODO: is mandatory for express checkout
  currencyCode?: string; //TODO: is mandatory for express checkout
  locale?: string;
  onActionRequired?: () => Promise<void>;
  onComplete?: (result: PaymentResult) => void;
  onError?: (error: any) => void;
};

export enum PaymentMethod {
  applepay = "applepay",
  card = "scheme",
  dropin = "dropin",
  googlepay = "googlepay",
  ideal = "ideal",
  paypal = "paypal",
  klarna_pay_now = "klarna_paynow", // Pay now
  klarna_pay_later = "klarna", // Pay later
  klarna_pay_overtime = "klarna_account", // Pay over time
  eps = "eps",
  bancontactcard = "bcmc", // Bancontact card
  bancontactmobile = "bcmc_mobile", // Bancontact mobile
  twint = "twint",
  sepadirectdebit = "sepadirectdebit",
  klarna_billie = "klarna_b2b", // Billie
}

export type PaymentResult =
  | {
      isSuccess: true;
      paymentReference: string;
    }
  | { isSuccess: false };

export type ComponentOptions = {
  showPayButton?: boolean;
  onPayButtonClick?: () => Promise<void>;
};

export enum DropinType {
  /*
   * The embedded drop-in type which is rendered within the page.
   */
  embedded = "embedded",
  /*
   * The hosted payment page (HPP) drop-in type which redirects the user to a hosted payment page.
   */
  hpp = "hpp",
}

export interface DropinComponent {
  submit(): void;
  mount(selector: string): void;
}
export type DropinOptions = {
  showPayButton?: boolean;
  onDropinReady?: () => Promise<void>;
  onPayButtonClick?: () => Promise<void>;
};

export interface PaymentDropinBuilder {
  dropinHasSubmit: boolean;
  build(config: DropinOptions): DropinComponent;
}

export type ExpressShippingOptionData = {
  id: string;
  name: string;
  description?: string;
  isSelected?: boolean;
  amount: {
    centAmount: number;
    currencyCode: string;
  };
};

export type ExpressAddressData = {
  country: string;
  firstName?: string;
  lastName?: string;
  streetName?: string;
  streetNumber?: string;
  additionalStreetInfo?: string;
  region?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
};

export interface ExpressComponent {
  mount(selector: string): void;
}
export type ExpressOptions = {
  allowedCountries?: string[]; //TODO: review
  onPaymentInit: () => Promise<void>;
  onShippingAddressSelected: (opts: { address: ExpressAddressData }) => Promise<void>;
  getShippingMethods: (opts: { address: ExpressAddressData }) => Promise<ExpressShippingOptionData[]>;
  onShippingMethodSelected: (opts: { shippingOption: { id: string } }) => Promise<void>;
  onPaymentSubmit: (opts: { shippingAddress: ExpressAddressData; billingAddress: ExpressAddressData }) => Promise<void>;
};

export interface PaymentExpressBuilder {
  build(config: ExpressOptions): ExpressComponent;
}

export interface PaymentEnabler {
  /**
   * @throws {Error}
   */
  createComponentBuilder: (type: string) => Promise<PaymentComponentBuilder | never>;

  /**
   *
   * @returns {Promise<DropinComponent>}
   * @throws {Error}
   */
  createDropinBuilder: (type: DropinType) => Promise<PaymentDropinBuilder | never>;

  createExpressBuilder: (type: string) => Promise<PaymentExpressBuilder | never>;
}
