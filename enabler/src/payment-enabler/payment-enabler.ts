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
  amazonpay = "amazonpay"
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

export interface PaymentEnabler {
  /**
   * @throws {Error}
   */
  createComponentBuilder: (
    type: string
  ) => Promise<PaymentComponentBuilder | never>;

  /**
   *
   * @returns {Promise<DropinComponent>}
   * @throws {Error}
   */
  createDropinBuilder: (
    type: DropinType
  ) => Promise<PaymentDropinBuilder | never>;
}
