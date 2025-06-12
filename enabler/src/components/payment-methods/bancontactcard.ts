import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { Bancontact, ICore } from "@adyen/adyen-web";

/**
 * Bancontact card component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/bancontact/bancontact-card/web-component
 */
export class BancontactCardBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.bancontactcard, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const bancontactcardComponent = new BancontactCardComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.bancontactcard),
    });
    bancontactcardComponent.init();
    return bancontactcardComponent;
  }
}

export class BancontactCardComponent extends DefaultAdyenComponent {
  private endDigits: string;
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
    const that = this;
    this.component = new Bancontact(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      showPayButton: this.componentOptions.showPayButton,
      onFieldValid: function (data) {
        const { endDigits, fieldType } = data;
        if (endDigits && fieldType === "encryptedCardNumber") {
          that.endDigits = endDigits;
        }
      },
    });
  }

  async showValidation() {
    this.component.showValidation();
  }

  async isValid() {
    return this.component.isValid;
  }

  async getState() {
    return {
      card: {
        endDigits: this.endDigits,
        brand: "bcmc",
      },
    };
  }
}
