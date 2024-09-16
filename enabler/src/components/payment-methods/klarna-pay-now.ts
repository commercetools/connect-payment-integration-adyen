import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, Klarna } from "@adyen/adyen-web";

/**
 * Klarna Pay Now component. Key is `klarna_paynow`.
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/klarna/web-component/
 */
export class KlarnaPayNowBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.klarna_pay_now, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const klarnaComponent = new KlarnaPayNowComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    klarnaComponent.init();
    return klarnaComponent;
  }
}

export class KlarnaPayNowComponent extends DefaultAdyenComponent {
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
    this.component = new Klarna(this.adyenCheckout, {
      type: this.paymentMethod,
      showPayButton: this.componentOptions.showPayButton,
      useKlarnaWidget: false, // Set to false to initiate a redirect flow.
    });
  }
}
