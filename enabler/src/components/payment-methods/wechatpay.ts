import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, WeChat } from "@adyen/adyen-web";
/**
 * WeChat Pay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/wechat-pay/web-component/
 */
export class WeChatPayBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.wechatpay, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const wechatpayComponent = new WeChatPayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.wechatpay),
    });
    wechatpayComponent.init();
    return wechatpayComponent;
  }
}

export class WeChatPayComponent extends DefaultAdyenComponent {
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
    this.component = new WeChat(this.adyenCheckout, {
      ...this.paymentComponentConfigOverride,
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
