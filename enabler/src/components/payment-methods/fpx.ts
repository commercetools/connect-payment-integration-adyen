import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { MolPayEBankingMY, ICore } from "@adyen/adyen-web";

/**
 * fpx-online-banking-malaysia component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/fpx-online-banking-malaysia/web-component/
 */
export class FPXBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.fpx, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const fpxComponent = new FPXComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride:
        this.resolvePaymentComponentConfigOverride(PaymentMethod.fpx),
    });
    fpxComponent.init();
    return fpxComponent;
  }
}

export class FPXComponent extends DefaultAdyenComponent {
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
    this.component = new MolPayEBankingMY(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
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
