import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseComponentBuilder,
  BaseOptions,
  DefaultAdyenComponent,
} from "../base";

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
    const cardComponent = new CardComponent(this.paymentMethod, this.adyenCheckout, config);
    cardComponent.init();
    return cardComponent;
  }
}

export class CardComponent extends DefaultAdyenComponent {
  private endDigits: string;

  constructor(
    paymentMethod: PaymentMethod,
    adyenCheckout: typeof Core,
    componentOptions: ComponentOptions
  ) {
    super(paymentMethod, adyenCheckout, componentOptions);
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
