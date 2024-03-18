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

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions) {
    this.paymentMethod = paymentMethod;
    this.adyenCheckout = baseOptions.adyenCheckout;
  }

  build(config: ComponentOptions): PaymentComponent {
    const component = new DefaultAdyenComponent(
      this.paymentMethod,
      this.adyenCheckout,
      config
    );
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

  constructor(
    paymentMethod: PaymentMethod,
    adyenCheckout: typeof Core,
    componentOptions: ComponentOptions
  ) {
    this.paymentMethod = paymentMethod;
    this.adyenCheckout = adyenCheckout;
    this.componentOptions = componentOptions;
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
    if ("isAvailable" in this.component) {
      this.component
        .isAvailable()
        .then(() => {
          this.component.mount(selector);
        })
        .catch((e: unknown) => {
          console.log(`${this.paymentMethod} is not available`, e);
        });
    } else {
      this.component.mount(selector);
    }
  }
}
