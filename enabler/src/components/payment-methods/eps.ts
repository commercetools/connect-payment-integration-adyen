import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";

/**
 * EPS component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/eps/web-component/
 */
export class EPSBuilder extends AdyenBaseComponentBuilder {

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.eps, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const epsComponent = new EPSComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    epsComponent.init();
    return epsComponent;
  }
}

export class EPSComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: typeof Core;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
  }) {
    super(opts);
  }

  init() {
    this.component = this.adyenCheckout.create(this.paymentMethod, {
      showPayButton: this.componentOptions.showPayButton,
    });
  }

  showValidation() {
    this.component.showValidation();
  }

  isValid() {
    return this.component.isValid;
  }
}
