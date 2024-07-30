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
  }) {
    super(opts);
  }

  init(): void {
    const that = this;
    this.component = new Card(this.adyenCheckout, {
      onFieldValid: function (data) {
        const { endDigits, fieldType } = data;
        if (endDigits && fieldType === "encryptedCardNumber") {
          that.endDigits = endDigits;
        }
      },
      hasHolderName: true,
      holderNameRequired: true,
      ...this.componentOptions,
    });
  }

  showValidation() {
    this.component.showValidation();
  }

  isValid() {
    return this.component.isValid;
  }

  getState() {
    return {
      card: {
        endDigits: this.endDigits,
        brand: this.component.state.selectedBrandValue,
      },
    };
  }
}
