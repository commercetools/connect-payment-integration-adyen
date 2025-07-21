import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, Redirect } from "@adyen/adyen-web";
/**
 * Clearpay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/clearpay/web-component/
 */
export class ClearpayBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.clearpay, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const clearpayComponent = new ClearpayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride:
        this.resolvePaymentComponentConfigOverride(PaymentMethod.clearpay),
    });
    clearpayComponent.init();
    return clearpayComponent;
  }
}

export class ClearpayComponent extends DefaultAdyenComponent {
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
      type: "clearpay",
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
