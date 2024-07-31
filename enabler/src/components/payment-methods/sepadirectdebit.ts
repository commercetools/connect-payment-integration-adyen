import Core from "@adyen/adyen-web/dist/types/core/core";
import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, BaseOptions, DefaultAdyenComponent } from "../base";

export class SepaBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.sepadirectdebit, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const sepaComponent = new SepaComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });

    sepaComponent.init();
    return sepaComponent;
  }
}

export class SepaComponent extends DefaultAdyenComponent {
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
    })
  }

  showValidation() {
    this.component.showValidation();
  }

  isValid() {
    return this.component.isValid;
  }
}