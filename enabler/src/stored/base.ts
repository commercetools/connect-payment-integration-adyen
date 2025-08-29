import { ICore, Card } from "@adyen/adyen-web";
import {
  StoredComponentOptions,
  StoredComponent,
  StoredComponentBuilder,
  PaymentMethod,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";

type AdyenComponent = Card; // We can add more components as needed

/**
 * Base Web Component
 */
export abstract class AdyenBaseStoredComponentBuilder
  implements StoredComponentBuilder
{
  public componentHasSubmit = true;

  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: ICore;
  protected sessionId: string;
  protected processorUrl: string;
  protected paymentComponentsConfigOverride: Record<string, any>;
  protected storedPaymentMethodsTokens: Record<string, string>;

  constructor(
    paymentMethod: PaymentMethod,
    baseOptions: BaseOptions,
    storedPaymentMethodsTokens: Record<string, string>,
  ) {
    this.paymentMethod = paymentMethod;
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.sessionId = baseOptions.sessionId;
    this.processorUrl = baseOptions.processorUrl;
    this.paymentComponentsConfigOverride =
      baseOptions.paymentComponentsConfigOverride;
    this.storedPaymentMethodsTokens = storedPaymentMethodsTokens;
  }

  abstract build(config: StoredComponentOptions): StoredComponent;

  protected resolvePaymentComponentConfigOverride(
    paymentMethod: string,
  ): Record<string, any> {
    return this.paymentComponentsConfigOverride?.[paymentMethod] ?? {};
  }
}

export abstract class DefaultAdyenStoredComponent implements StoredComponent {
  protected component: AdyenComponent;
  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: ICore;
  protected componentOptions: StoredComponentOptions;
  protected sessionId: string;
  protected processorUrl: string;
  protected paymentComponentConfigOverride: Record<string, any>;
  protected storedPaymentMethodsTokens: Record<string, string>;

  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: StoredComponentOptions;
    sessionId: string;
    processorUrl: string;
    paymentComponentConfigOverride: Record<string, any>;
    storedPaymentMethodsTokens: Record<string, string>;
  }) {
    this.paymentMethod = opts.paymentMethod;
    this.adyenCheckout = opts.adyenCheckout;
    this.componentOptions = opts.componentOptions;
    this.sessionId = opts.sessionId;
    this.processorUrl = opts.processorUrl;
    this.paymentComponentConfigOverride = opts.paymentComponentConfigOverride;
    this.storedPaymentMethodsTokens = opts.storedPaymentMethodsTokens;
  }
  abstract init(options: { id: string }): void;

  abstract remove(): Promise<void>;

  async submit(): Promise<void> {
    this.component.submit();
  }

  async mount(selector: string): Promise<void> {
    this.component.mount(selector);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isPaymentMethodAllowed()) {
      console.log(`${this.paymentMethod} is not allowed`);
      return Promise.resolve(false);
    }

    if ("isAvailable" in this.component) {
      return this.component
        .isAvailable()
        .then(() => {
          return true;
        })
        .catch((e: unknown) => {
          console.log(`${this.paymentMethod} is not available`, e);
          return false;
        });
    } else {
      return Promise.resolve(true);
    }
  }

  private isPaymentMethodAllowed(): boolean {
    return this.adyenCheckout.paymentMethodsResponse.paymentMethods.some(
      (paymentMethod) => paymentMethod.type === this.paymentMethod,
    );
  }
}
