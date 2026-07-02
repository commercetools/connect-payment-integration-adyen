import { Econtext, ICore } from "@adyen/adyen-web";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";

export class JCSComponent extends DefaultAdyenComponent {
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
    this.component = new Econtext(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      showPayButton: this.componentOptions.showPayButton,
    });
  }
}

export class JCSBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.jcs, baseOptions);
  }
  build(config: ComponentOptions): PaymentComponent {
    const jcsComponent = new JCSComponent({
      paymentMethod: this.paymentMethod,

      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.jcs),
    });
    jcsComponent.init();
    return jcsComponent;
  }
}