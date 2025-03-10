import {
  ICore,
  ApplePay,
  GooglePay,
  Redirect,
  Card,
  PayPal,
  Klarna,
  EPS,
  Twint,
  SepaDirectDebit,
  Blik,
  Swish,
  Vipps,
  OnlineBankingPL,
} from "@adyen/adyen-web";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";

type AdyenComponent =
  | Card
  | PayPal
  | ApplePay
  | GooglePay
  | Klarna
  | EPS
  | Twint
  | Redirect
  | SepaDirectDebit
  | Blik
  | Vipps
  | OnlineBankingPL
  | Swish;

/**
 * Base Web Component
 */
export abstract class AdyenBaseComponentBuilder
  implements PaymentComponentBuilder
{
  public componentHasSubmit = true;

  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: ICore;
  protected sessionId: string;
  protected processorUrl: string;

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions) {
    this.paymentMethod = paymentMethod;
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.sessionId = baseOptions.sessionId;
    this.processorUrl = baseOptions.processorUrl;
  }

  abstract build(config: ComponentOptions): PaymentComponent;
}

export abstract class DefaultAdyenComponent implements PaymentComponent {
  protected component: AdyenComponent;
  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: ICore;
  protected componentOptions: ComponentOptions;
  protected sessionId: string;
  protected processorUrl: string;

  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
  }) {
    this.paymentMethod = opts.paymentMethod;
    this.adyenCheckout = opts.adyenCheckout;
    this.componentOptions = opts.componentOptions;
    this.sessionId = opts.sessionId;
    this.processorUrl = opts.processorUrl;
  }
  abstract init(): void;

  submit(): void {
    this.component.submit();
  }

  mount(selector: string): void {
    this.component.mount(selector);
  }

  isAvailable(): Promise<boolean> {
    if (!this.isPaymentMethodAllowed()) {
      console.log(`${this.paymentMethod} is not allowed`);
      return Promise.resolve(false);
    }

    if ("isAvailable" in this.component) {
      return this.component
        .isAvailable()
        .then(() => {
          return true;
        })
        .catch((e: unknown) => {
          console.log(`${this.paymentMethod} is not available`, e);
          return false;
        });
    } else {
      return Promise.resolve(true);
    }
  }

  private isPaymentMethodAllowed(): boolean {
    return this.adyenCheckout.paymentMethodsResponse.paymentMethods.some(
      (paymentMethod) => paymentMethod.type === this.paymentMethod,
    );
  }
}
