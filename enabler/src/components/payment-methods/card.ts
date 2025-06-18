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
  private cmp: any;
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
      // hasHolderName: true,
      // holderNameRequired: true,
      // Override the default config with the one provided by the user
      // ...this.paymentComponentConfigOverride,
      // isStoredPaymentMethod: true,
      // enableStoreDetails: true,
      // showStoreDetailsCheckbox: true,
      storedPaymentMethodId: "QV5P9PGRCB9V3575",
      isStoredPaymentMethod: true,
      supportedShopperInteractions: ["Ecommerce"], // Supported shopper interactions
      // Configuration that can not be overridden
      // onFieldValid: function (data) {
      //   const { endDigits, fieldType } = data;
      //   if (endDigits && fieldType === "encryptedCardNumber") {
      //     that.endDigits = endDigits;
      //   }
      // },
      // ...this.componentOptions,
    });

    this.cmp = new Card(this.adyenCheckout, {
      // hasHolderName: true,
      // holderNameRequired: true,
      // Override the default config with the one provided by the user
      // ...this.paymentComponentConfigOverride,
      // isStoredPaymentMethod: true,
      // enableStoreDetails: true,
      // showStoreDetailsCheckbox: true,
      storedPaymentMethodId: "KNF9S4ZT5QQC7Z65",
      isStoredPaymentMethod: true,
      supportedShopperInteractions: ["Ecommerce"], // Supported shopper interactions
      // Configuration that can not be overridden
      // onFieldValid: function (data) {
      //   const { endDigits, fieldType } = data;
      //   if (endDigits && fieldType === "encryptedCardNumber") {
      //     that.endDigits = endDigits;
      //   }
      // },
      // ...this.componentOptions,
    });
  }

  showValidation() {
    this.component.showValidation();
  }

  mount(selector: string): void {
    this.component.mount(selector);
    this.cmp.mount("#container--external2");
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
