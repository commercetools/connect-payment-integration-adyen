import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, Twint } from "@adyen/adyen-web";
/**
 * TWINT component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/twint/web-component/
 */
export class TwintBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.twint, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const twintComponent = new TwintComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    twintComponent.init();
    return twintComponent;
  }
}

export class TwintComponent extends DefaultAdyenComponent {
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
    this.component = new Twint(this.adyenCheckout, {
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
