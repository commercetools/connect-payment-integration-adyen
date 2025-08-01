type CardPaymentState = {
  card?: {
    endDigits?: string;
    brand?: string;
    expiryDate?: string;
  };
};

export interface PaymentComponent {
  submit(): Promise<void>;
  mount(selector: string): Promise<void>;
  showValidation?(): Promise<void>;
  isValid?(): Promise<boolean>;
  getState?(): Promise<CardPaymentState>;
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
  onError?: (
    error: any,
    context?: { paymentReference?: string; method?: { type?: string } },
  ) => void;
};

export enum PaymentMethod {
  afterpay = "afterpaytouch", // Afterpay
  applepay = "applepay",
  bancontactcard = "bcmc", // Bancontact card
  bancontactmobile = "bcmc_mobile", // Bancontact mobile
  blik = "blik",
  card = "scheme",
  clearpay = "clearpay",
  dropin = "dropin",
  eps = "eps",
  googlepay = "googlepay",
  ideal = "ideal",
  klarna_billie = "klarna_b2b", // Billie
  klarna_pay_later = "klarna", // Pay later
  klarna_pay_now = "klarna_paynow", // Pay now
  klarna_pay_overtime = "klarna_account", // Pay over time
  paypal = "paypal",
  przelewy24 = "onlineBanking_PL", //przelewy24
  sepadirectdebit = "sepadirectdebit",
  swish = "swish",
  twint = "twint",
  vipps = "vipps",
  mobilepay = "mobilepay",
}

export const getPaymentMethodType = (
  adyenPaymentMethod: string,
): PaymentMethod | undefined => {
  for (const enumKey in PaymentMethod) {
    if (PaymentMethod[enumKey] === adyenPaymentMethod) {
      return enumKey as PaymentMethod;
    }
  }
  return undefined;
};

export type PaymentResult =
  | {
      isSuccess: true;
      paymentReference: string;
      method?: { type?: string };
    }
  | {
      isSuccess: false;
      paymentReference?: string;
      method?: { type?: string };
    };

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
  submit(): Promise<void>;
  mount(selector: string): Promise<void>;
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
    type: string,
  ) => Promise<PaymentComponentBuilder | never>;

  /**
   *
   * @returns {Promise<DropinComponent>}
   * @throws {Error}
   */
  createDropinBuilder: (
    type: DropinType,
  ) => Promise<PaymentDropinBuilder | never>;
}
