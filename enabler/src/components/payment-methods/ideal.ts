import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, Redirect } from "@adyen/adyen-web";
/**
 * Ideal component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/ideal/web-component/
 */

export class IdealWeroBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.ideal_wero, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const idealWeroComponent = new IdealWeroComponent({
      paymentMethod: this.paymentMethod,

      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.ideal_wero),
    });
    idealWeroComponent.init();
    return idealWeroComponent;
  }
}

export class IdealWeroComponent extends DefaultAdyenComponent {
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
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      type: this.paymentMethod,
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
