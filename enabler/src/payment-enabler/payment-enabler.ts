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
  card = "card",
  dropin = "dropin",
  googlepay = "googlepay",
  ideal = "ideal",
  paypal = "paypal",
}

export type PaymentResult = {
  isSuccess: true;
  paymentReference: string;
} | { isSuccess: false };

export type ComponentOptions = {
  showPayButton?: boolean;
  onPayButtonClick?: () => Promise<void>;
};

export interface PaymentEnabler {
  /** 
   * @throws {Error}
   */
  createComponentBuilder: (type: string) => Promise<PaymentComponentBuilder | never>
}
