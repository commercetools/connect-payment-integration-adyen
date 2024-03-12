import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseComponentBuilder,
  DefaultAdyenComponent,
  BaseOptions,
} from "../base";
/**
 * Ideal component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/ideal/web-component/
 */
export class IdealBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.ideal, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const idealComponent = new IdealComponent(this.paymentMethod, this.adyenCheckout, config);
    idealComponent.init();
    return idealComponent;
  }
}

export class IdealComponent extends DefaultAdyenComponent {
  constructor(
    paymentMethod: PaymentMethod,
    adyenCheckout: typeof Core,
    componentOptions: ComponentOptions
  ) {
    super(paymentMethod, adyenCheckout, componentOptions);
  }

  showValidation() {
    this.component.showValidation();
  }

  isValid() {
    return this.component.isValid;
  }
}
