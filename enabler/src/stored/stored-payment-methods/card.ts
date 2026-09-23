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
  Bancontact: "bcmc",
  CartesBancaires: "cartebancaire",
  Diners: "diners",
  Discover: "discover",
  Jcb: "jcb",
  Maestro: "maestro",
  Mastercard: "mc",
  UnionPay: "cup",
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
      // The "storedCard" config is applied on top of the "card" one, so that options can be
      // set for every card or for stored cards only.
      paymentComponentConfigOverride: {
        ...this.resolvePaymentComponentConfigOverride("card"),
        ...this.resolvePaymentComponentConfigOverride("storedCard"),
      },
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
      // The SDK's "All fields are required..." instruction is unnecessary once hideCVC leaves this form empty.
      ...(this.paymentComponentConfigOverride?.hideCVC && {
        i18n: this.buildI18nWithBlankFormInstruction(),
      }),
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
    await this.apiClient.deleteStoredPaymentMethod(this.usedCocoStoredPaymentMethod.id);
  }

  // Delegates to the checkout's i18n instance for every key except the one instruction we want blanked out.
  private buildI18nWithBlankFormInstruction() {
    const baseI18n = this.adyenCheckout.modules.i18n;
    const scopedI18n = Object.create(baseI18n);
    scopedI18n.get = (key: string, options?: unknown) =>
      key === "form.instruction" ? "" : baseI18n.get(key, options);
    return scopedI18n;
  }
}
