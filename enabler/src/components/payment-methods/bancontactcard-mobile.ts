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
  }) {
    super(opts);
  }

  init() {
    this.component = new BcmcMobile(this.adyenCheckout, {
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
