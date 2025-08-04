import {
  PaymentMethod,
  StoredComponent,
  StoredComponentOptions,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseStoredComponentBuilder, DefaultAdyenStoredComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { Card, ICore } from "@adyen/adyen-web";
import { getAdyenIdFromCocoId } from "../../payment-enabler/payment-methods-data.tmp";

/**
 * Stored Credit card component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/cards/web-component/
 */

export class StoredCardBuilder extends AdyenBaseStoredComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.card, baseOptions);
  }

  build(config: StoredComponentOptions): StoredComponent {
    const cardComponent = new StoredCardComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride("card"),
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
  }) {
    super(opts);
  }

  init({id}: {id: string}): void {
    const adyenId = getAdyenIdFromCocoId(id);
    this.component = new Card(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      storedPaymentMethodId: adyenId,
      isStoredPaymentMethod: true,
      supportedShopperInteractions: ["Ecommerce"], 
      ...this.componentOptions,
    });
  }

  async showValidation() {
    this.component.showValidation();
  }

  async isValid() {
    return this.component.isValid;
  }

  async remove() {
    console.log("TODO: Implement remove method for stored card component");
    return;
  }
}
