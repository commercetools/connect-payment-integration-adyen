import {
  ComponentOptions,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { AmazonPay, ICore } from "@adyen/adyen-web";

/**
 * Google pay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/google-pay/web-component/
 */
export class AmazonpayBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.amazonpay, baseOptions);
  }

  build(config: ComponentOptions): AmazonPayComponent {
    const amazonPayComponent = new AmazonPayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
    });
    amazonPayComponent.init();

    return amazonPayComponent;
  }
}

export class AmazonPayComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
    usesOwnCertificate?: boolean;
  }) {
    super(opts);
  }

  init(): void {
    const returnUrl = this.processorUrl.endsWith("/")
    ? `${this.processorUrl}payments/details?step=review`
    : `${this.processorUrl}/payments/details?step=review`;

    this.component = new AmazonPay(this.adyenCheckout, {
      showPayButton: this.componentOptions.showPayButton,
      // environment: 'test', // we can add an additional environment variable for the enabler for this, or add it to the baseOptions to be passed by the user of the enabler
      returnUrl,
      onClick: (resolve, reject) => {
        if (this.componentOptions.onPayButtonClick) {
          return this.componentOptions
            .onPayButtonClick()
            .then(() => resolve())
            .catch((error) => reject(error));
        }
        return resolve();
      },
    });
  }
}
