import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, Redirect } from "@adyen/adyen-web";
/**
 * Alipay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/alipay/web-component/
 */
export class AlipayBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.alipay, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const alipayComponent = new AlipayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.alipay),
    });
    alipayComponent.init();
    return alipayComponent;
  }
}

export class AlipayComponent extends DefaultAdyenComponent {
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
    this.component = new Redirect(this.adyenCheckout, {
      ...this.paymentComponentConfigOverride,
      type: "alipay",
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
