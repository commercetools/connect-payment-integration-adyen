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
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.twint),
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
    paymentComponentConfigOverride: Record<string, any>;
  }) {
    super(opts);
  }

  init(): void {
    this.component = new Twint(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      showPayButton: this.componentOptions.showPayButton,
    });
  }

  async showValidation() {
    this.component.showValidation();
  }

  async isValid() {
    return this.component.isValid;
  }
}
