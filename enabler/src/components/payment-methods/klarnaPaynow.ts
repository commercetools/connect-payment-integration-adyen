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
 * Klarna component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/klarna/web-component/
 */
export class KlarnaPayNowBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.klarna_paynow, baseOptions);
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
    adyenCheckout: typeof Core;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
  }) {
    super(opts);
  }

  init() {
    this.component = this.adyenCheckout.create(this.paymentMethod, {
      ...this.componentOptions,
      useKlarnaWidget: false // Set to false to initiate a redirect flow.
    });
  }
}
