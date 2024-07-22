import Core from "@adyen/adyen-web/dist/types/core/core";
import Dropin from "@adyen/adyen-web/dist/types/components/Dropin";
import {
  DropinComponent,
  DropinOptions,
  PaymentDropinBuilder,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";

export class DropinComponentsBuilder implements PaymentDropinBuilder {
  private adyenCheckout: typeof Core;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
  }

  build(): DropinComponent {
    const dropin = new DropinComponents({
      adyenCheckout: this.adyenCheckout,
      dropinOptions: {},
    });

    dropin.init();
    return dropin;
  }
}

export class DropinComponents implements DropinComponent {
  private adyenPaymentMethod: string = "dropin";
  protected component: typeof Dropin;
  private adyenCheckout: typeof Core;

  constructor(opts: {
    adyenCheckout: typeof Core;
    dropinOptions: DropinOptions;
  }) {
    this.adyenCheckout = opts.adyenCheckout;
  }

  init() {
    this.component = this.adyenCheckout.create(this.adyenPaymentMethod, {
      openFirstStoredPaymentMethod: false,
      showStoredPaymentMethods: false,
      showPayButton: true,
    });
  }

  mount(selector: string) {
    this.component.mount(selector);
  }
}
