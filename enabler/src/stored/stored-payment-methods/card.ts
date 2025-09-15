import {
  PaymentMethod,
  StoredComponent,
  StoredComponentOptions,
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseStoredComponentBuilder,
  DefaultAdyenStoredComponent,
} from "../base";
import {
  BaseOptions,
  StoredPaymentMethodsConfig,
} from "../../payment-enabler/adyen-payment-enabler";
import { Card, ICore } from "@adyen/adyen-web";

const CT_CARD_BRAND_TO_ADYEN_MAPPING: Record<string, string> = {
  Amex: "amex",
  Maestro: "maestro",
  Mastercard: "mc",
  Visa: "visa",
};

const convertCTCardBrandToAdyenFormat = (brand: string): string => {
  return CT_CARD_BRAND_TO_ADYEN_MAPPING[brand] ?? "Unknown";
};

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
      paymentComponentConfigOverride:
        this.resolvePaymentComponentConfigOverride("card"),
      storedPaymentMethodsConfig: this.storedPaymentMethodsConfig,
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
    storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  }) {
    super(opts);
  }

  init({ id }: { id: string }): void {
    const cocoStoredPaymentMethod =
      this.storedPaymentMethodsConfig.storedPaymentMethods.find((spm) => {
        return spm.id === id;
      });

    if (!cocoStoredPaymentMethod) {
      throw new Error(
        `Received stored payment method id "${id} however that is not an available id to use. Available ones are: [${this.storedPaymentMethodsConfig.storedPaymentMethods.map((spm) => spm.id).join(", ")}]"`,
      );
    }

    const brandsMapped = this.componentOptions.brands.map(
      convertCTCardBrandToAdyenFormat,
    );

    this.component = new Card(this.adyenCheckout, {
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      storedPaymentMethodId: cocoStoredPaymentMethod.token,
      isStoredPaymentMethod: true,
      supportedShopperInteractions: ["Ecommerce"],
      ...this.componentOptions,
      brands: brandsMapped,
    });
    this.usedCocoStoredPaymentMethod = cocoStoredPaymentMethod;
  }

  async showValidation() {
    this.component.showValidation();
  }

  async isValid() {
    return this.component.isValid;
  }

  async remove() {
    const url = this.processorUrl.endsWith("/")
      ? `${this.processorUrl}stored-payment-methods/${this.usedCocoStoredPaymentMethod.id}`
      : `${this.processorUrl}/stored-payment-methods/${this.usedCocoStoredPaymentMethod.id}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-Session-Id": this.sessionId,
      },
    });

    if (!response.ok) {
      throw new Error("failed for some reason");
    }
  }
}
