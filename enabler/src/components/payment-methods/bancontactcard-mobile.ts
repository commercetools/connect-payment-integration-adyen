import { BcmcMobile, ICore } from "@adyen/adyen-web";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";

/**
 * Bancontact card component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/bancontact/bancontact-mobile/web-component
 */
export class BancontactMobileBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.bancontactmobile, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const bancontactmobileComponent = new BancontactMobileComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.bancontactmobile),
    });
    bancontactmobileComponent.init();
    return bancontactmobileComponent;
  }
}

export class BancontactMobileComponent extends DefaultAdyenComponent {
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

  init() {
    this.component = new BcmcMobile(this.adyenCheckout, {
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
