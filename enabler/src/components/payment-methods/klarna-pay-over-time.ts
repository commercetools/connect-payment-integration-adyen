import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseComponentBuilder,
  DefaultAdyenComponent,
  BaseOptions,
} from "../base";

/**
 * Klarna Pay Over Time component. Key is `klarna_account`.
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/klarna/web-component/
 */
export class KlarnaPayOverTimeBuilder extends AdyenBaseComponentBuilder {

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.klarna_over_time, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const klarnaComponent = new KlarnaPayOverTimeComponent({
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

export class KlarnaPayOverTimeComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: typeof Core;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
  }) {
    super(opts);
  }

  init() {
    this.component = this.adyenCheckout.create(this.paymentMethod, {
      showPayButton: this.componentOptions.showPayButton,
      useKlarnaWidget: false // Set to false to initiate a redirect flow.
    });
  }
}
