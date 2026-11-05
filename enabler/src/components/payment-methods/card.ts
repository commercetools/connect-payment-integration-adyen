import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { resolveClickToPayConfiguration } from "../../utils/click-to-pay";
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
      paymentComponentConfigOverride: {
        ...this.resolvePaymentComponentConfigOverride("card"),
        ...resolveClickToPayConfiguration(
          this.resolvePaymentComponentConfigOverride("card"),
          {
            merchantShopperEmail: config.shopperEmail,
            cartShopperEmail: this.cartShopperEmail,
          },
        ),
      },
      setStorePaymentDetails: this.setStorePaymentDetails,
    });
    cardComponent.init();
    return cardComponent;
  }
}

const omitShopperEmail = ({ shopperEmail: _shopperEmail, ...rest }: ComponentOptions) => rest; // eslint-disable-line @typescript-eslint/no-unused-vars

export class CardComponent extends DefaultAdyenComponent {
  private endDigits: string;

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
      // shopperEmail is only consumed by Click to Pay (see CardBuilder), not a Card prop
      ...omitShopperEmail(this.componentOptions),
    });

    this.component.props = {
      ...this.component.props,
      showStoreDetailsCheckbox: false,
    };
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
