import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { Redirect, ICore } from "@adyen/adyen-web";
/**
 * MobilePay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/mobilepay/web-component
 */
export class MobilePayBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.mobilepay, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const mobilePayComponent = new MobilePayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    mobilePayComponent.init();
    return mobilePayComponent;
  }
}

export class MobilePayComponent extends DefaultAdyenComponent {
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
    this.component = new Redirect(this.adyenCheckout, {
      type: this.paymentMethod,
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
