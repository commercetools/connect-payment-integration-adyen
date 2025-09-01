import {
  PaymentMethod,
  StoredComponent,
  StoredComponentOptions,
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseStoredComponentBuilder,
  DefaultAdyenStoredComponent,
} from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { Card, ICore } from "@adyen/adyen-web";

/**
 * Stored Credit card component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/cards/web-component/
 */

export class StoredCardBuilder extends AdyenBaseStoredComponentBuilder {
  constructor(
    baseOptions: BaseOptions,
    storedPaymentMethodsTokens: Record<string, string>,
  ) {
    super(PaymentMethod.card, baseOptions, storedPaymentMethodsTokens);
  }

  build(config: StoredComponentOptions): StoredComponent {
    const cardComponent = new StoredCardComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride:
        this.resolvePaymentComponentConfigOverride("card"),
      storedPaymentMethodsTokens: this.storedPaymentMethodsTokens,
    });
    cardComponent.init({
      id: config.id,
    });
    return cardComponent;
  }
}

export class StoredCardComponent extends DefaultAdyenStoredComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: StoredComponentOptions;
    sessionId: string;
    processorUrl: string;
    paymentComponentConfigOverride: Record<string, any>;
    storedPaymentMethodsTokens: Record<string, string>;
  }) {
    super(opts);
  }

  init({ id }: { id: string }): void {
    const adyenStoredPaymentMethodId = this.storedPaymentMethodsTokens[id];
    this.component = new Card(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      storedPaymentMethodId: adyenStoredPaymentMethodId,
      isStoredPaymentMethod: true,
      supportedShopperInteractions: ["Ecommerce"],
      ...this.componentOptions,
    });
    this.adyenStoredPaymentMethodId = adyenStoredPaymentMethodId;
  }

  async showValidation() {
    this.component.showValidation();
  }

  async isValid() {
    return this.component.isValid;
  }

  async remove() {
    const url = this.processorUrl.endsWith("/")
      ? `${this.processorUrl}stored-payment-methods`
      : `${this.processorUrl}/stored-payment-methods`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Session-Id": this.sessionId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tokenId: this.adyenStoredPaymentMethodId,
      }),
    });

    if (!response.ok) {
      throw new Error("failed for some reason");
    }
  }
}
