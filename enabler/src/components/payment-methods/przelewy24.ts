import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, OnlineBankingPL } from "@adyen/adyen-web";
/**
 * Przelewy24 component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/online-banking-poland/web-component/
 */
export class Przelewy24PLBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.blik, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const przelewy24 = new Przelewy24Component({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    przelewy24.init();
    return przelewy24;
  }
}

export class Przelewy24Component extends DefaultAdyenComponent {
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
    this.component = new OnlineBankingPL(this.adyenCheckout, {
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
