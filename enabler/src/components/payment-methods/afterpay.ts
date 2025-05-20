import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { AfterPay, ICore } from "@adyen/adyen-web";
/**
 * AfterPay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/afterpaytouch/web-component/
 */
export class AfterPayBuilder extends AdyenBaseComponentBuilder {
  // TODO: SCC-3189: validate the form that is shown for web-components and the impact it has. (drop-in redirects to a specific page)

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
  }) {
    super(opts);
  }

  init(): void {
    this.component = new AfterPay(this.adyenCheckout, {
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
