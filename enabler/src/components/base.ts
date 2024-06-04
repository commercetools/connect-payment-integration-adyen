import ApplePay from "@adyen/adyen-web/dist/types/components/ApplePay";
import GooglePay from "@adyen/adyen-web/dist/types/components/GooglePay";
import RedirectElement from "@adyen/adyen-web/dist/types/components/Redirect/Redirect";
import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../payment-enabler/payment-enabler";

export type BaseOptions = {
  adyenCheckout: typeof Core;
  sessionId: string;
  processorUrl: string;
  applePayConfig?: {
    usesOwnCertificate: boolean;
  };
};

/**
 * Base Web Component
 */
export abstract class AdyenBaseComponentBuilder
  implements PaymentComponentBuilder
{
  public componentHasSubmit = true;

  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: typeof Core;
  protected sessionId: string;
  protected processorUrl: string;

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions) {
    this.paymentMethod = paymentMethod;
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.sessionId = baseOptions.sessionId;
    this.processorUrl = baseOptions.processorUrl;
  }

  build(config: ComponentOptions): PaymentComponent {
    const component = new DefaultAdyenComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    component.init();
    return component;
  }
}

export class DefaultAdyenComponent implements PaymentComponent {
  protected component:
    | typeof ApplePay
    | typeof GooglePay
    | typeof RedirectElement;
  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: typeof Core;
  protected componentOptions: ComponentOptions;
  protected sessionId: string;
  protected processorUrl: string;

  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: typeof Core;
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
  // This is an internal method
  init() {
    this.component = this.adyenCheckout.create(
      this.paymentMethod,
      this.componentOptions
    );
  }

  submit() {
    this.component.submit();
  }

  mount(selector: string) {
   this.component.mount(selector);
  }

  isAvailable() {
    if ("isAvailable" in this.component) {
      return this.component.isAvailable()
      .then(() => {
        console.log(`${this.paymentMethod} is available`);
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
}
