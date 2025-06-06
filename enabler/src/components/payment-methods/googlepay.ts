import { ComponentOptions, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { GooglePay, ICore } from "@adyen/adyen-web";

/**
 * Google pay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/google-pay/web-component/
 */
export class GooglepayBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.googlepay, baseOptions);
  }

  build(config: ComponentOptions): GooglePayComponent {
    const googlePayComponent = new GooglePayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.googlepay),
    });
    googlePayComponent.init();

    return googlePayComponent;
  }
}

export class GooglePayComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
    paymentComponentConfigOverride: Record<string, any>;
    usesOwnCertificate?: boolean;
  }) {
    super(opts);
  }

  init(): void {
    this.component = new GooglePay(this.adyenCheckout, {
      buttonType: "pay",
      buttonSizeMode: "fill",
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      showPayButton: this.componentOptions.showPayButton,
      onClick: (resolve, reject) => {
        if (this.componentOptions.onPayButtonClick) {
          return this.componentOptions
            .onPayButtonClick()
            .then(() => resolve())
            .catch(() => reject());
        }
        return resolve();
      },
    });
  }
}
