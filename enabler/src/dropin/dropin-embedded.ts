import Core from "@adyen/adyen-web/dist/types/core/core";
import Dropin from "@adyen/adyen-web/dist/types/components/Dropin";
import {
  DropinComponent,
  DropinOptions,
  PaymentDropinBuilder,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";

export class DropinEmbeddedBuilder implements PaymentDropinBuilder {
  public dropinHasSubmit = false;

  private adyenCheckout: typeof Core;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
  }

  build(config: DropinOptions): DropinComponent {
    const dropin = new DropinComponents({
      adyenCheckout: this.adyenCheckout,
      dropinOptions: config,
    });

    dropin.init();
    return dropin;
  }
}

export class DropinComponents implements DropinComponent {
  private adyenPaymentMethod = "dropin";
  protected component: typeof Dropin;
  private adyenCheckout: typeof Core;
  private dropinOptions: DropinOptions;

  constructor(opts: {
    adyenCheckout: typeof Core;
    dropinOptions: DropinOptions;
  }) {
    this.dropinOptions = opts.dropinOptions;
    this.adyenCheckout = opts.adyenCheckout;

    this.overridePaymentMethodConfiguration();
    this.overrideOnSubmit();
  }

  init() {
    this.component = this.adyenCheckout.create(this.adyenPaymentMethod, {
      showPayButton: true,
      openFirstStoredPaymentMethod: false,
      showStoredPaymentMethods: false,
      onReady: () => {
        if (this.dropinOptions.onDropinReady) {
          this.dropinOptions
            .onDropinReady()
            .then(() => {})
            .catch((error) => console.error(error));
        }
      },
    });
  }

  mount(selector: string) {
    this.component.mount(selector);
  }

  submit(): void {
    throw new Error("Method not available");
  }

  private overridePaymentMethodConfiguration() {
    this.adyenCheckout.options.paymentMethodsConfiguration = {
      applepay: {
        onClick: (resolve, reject) => {
          if (this.dropinOptions.onPayButtonClick) {
            return this.dropinOptions
              .onPayButtonClick()
              .then(() => resolve())
              .catch((error) => reject(error));
          }
          return resolve();
        },
        buttonType: "pay",
        buttonColor: "black",
      },
      card: {
        hasHolderName: true,
        holderNameRequired: true,
      },
      googlepay: {
        onClick: (resolve, reject) => {
          if (this.dropinOptions.onPayButtonClick) {
            return this.dropinOptions
              .onPayButtonClick()
              .then(() => resolve())
              .catch((error) => reject(error));
          }
          return resolve();
        },
        buttonType: "pay",
        buttonSizeMode: "fill",
      },
      paypal: {
        onClick: (_, { resolve, reject }) => {
          if (this.dropinOptions.onPayButtonClick) {
            return this.dropinOptions
              .onPayButtonClick()
              .then(() => resolve())
              .catch((error) => reject(error));
          }
          return resolve();
        },
      },
    };
  }

  private overrideOnSubmit() {
    const parentOnSubmit = this.adyenCheckout.options.onSubmit;
    this.adyenCheckout.options.onSubmit = async (state, component) => {
      const paymentMethod = state?.data?.paymentMethod?.type;
      const hasOnClick =
        this.adyenCheckout.options.paymentMethodsConfiguration[paymentMethod]
          ?.onClick;
      if (!hasOnClick && this.dropinOptions.onPayButtonClick) {
        try {
          await this.dropinOptions.onPayButtonClick();
        } catch (e) {
          component.setStatus("ready");
          return;
        }
      }
      await parentOnSubmit(state, component);
    };
  }
}
