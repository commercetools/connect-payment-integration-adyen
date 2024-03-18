import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseComponentBuilder,
  DefaultAdyenComponent,
  BaseOptions,
} from "../base";

/**
 * Paypal component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/paypal/web-component/
 */
export class PaypalBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;
  
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.paypal, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const paypalComponent = new PaypalComponent(this.paymentMethod, this.adyenCheckout, config);
    paypalComponent.init();
    return paypalComponent;
  }
}

export class PaypalComponent extends DefaultAdyenComponent {
  constructor(
    paymentMethod: PaymentMethod,
    adyenCheckout: typeof Core,
    componentOptions: ComponentOptions
  ) {
    super(paymentMethod, adyenCheckout, componentOptions);
  }

  init() {
    this.component = this.adyenCheckout.create(this.paymentMethod, {
      ...this.componentOptions,
      blockPayPalCreditButton: true,
      blockPayPalPayLaterButton: true,
      blockPayPalVenmoButton: true,
    });
  }
}
