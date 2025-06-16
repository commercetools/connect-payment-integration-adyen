import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, Redirect } from "@adyen/adyen-web";
/**
 * AfterPay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/afterpaytouch/web-component/
 */
export class AfterPayBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.afterpay, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const afterpayComponent = new AfterPayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.afterpay),
    });
    afterpayComponent.init();
    return afterpayComponent;
  }
}

export class AfterPayComponent extends DefaultAdyenComponent {
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
      type: "afterpaytouch",
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
