import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { Card, ICore } from "@adyen/adyen-web";

/**
 * Credit card component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/cards/web-component/
 */

export class CardBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.card, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const cardComponent = new CardComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride("card"),
    });
    cardComponent.init();
    return cardComponent;
  }
}

export class CardComponent extends DefaultAdyenComponent {
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
    this.component = new Card(this.adyenCheckout, {
      hasHolderName: true,
      holderNameRequired: true,
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      onFieldValid: function (data) {
        const { endDigits, fieldType } = data;
        if (endDigits && fieldType === "encryptedCardNumber") {
          that.endDigits = endDigits;
        }
      },
      ...this.componentOptions,
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
        brand: this.component.state.selectedBrandValue,
      },
    };
  }
}
