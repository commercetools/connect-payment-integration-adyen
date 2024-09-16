import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { SepaDirectDebit, ICore } from "@adyen/adyen-web";

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
    adyenCheckout: ICore;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
  }) {
    super(opts);
  }

  init(): void {
    this.component = new SepaDirectDebit(this.adyenCheckout, {
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