import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ClickToPay, ICore } from "@adyen/adyen-web";

/**
 * Click to Pay component
 *
 * Shopper recognition options (shopperEmail, telephoneNumber, merchantDisplayName) can be
 * provided through paymentComponentsConfigOverride.clicktopay.
 * https://docs.adyen.com/payment-methods/click-to-pay/web-component/
 */
export class ClickToPayComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
    paymentComponentConfigOverride: Record<string, any>;
    setStorePaymentDetails: (enabled: boolean) => void;
  }) {
    super(opts);
  }

  init(): void {
    this.component = new ClickToPay(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      ...this.componentOptions,
    });
  }

  async showValidation() {
    this.component.showValidation();
  }

  async isValid() {
    return this.component.isValid;
  }
}

export class ClickToPayBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.clicktopay, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const clickToPayComponent = new ClickToPayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride:
        this.resolvePaymentComponentConfigOverride(PaymentMethod.clicktopay),
      setStorePaymentDetails: this.setStorePaymentDetails,
    });
    clickToPayComponent.init();
    return clickToPayComponent;
  }
}
