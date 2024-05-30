import Core from "@adyen/adyen-web/dist/types/core/core";
import { ComponentOptions, PaymentMethod } from '../../payment-enabler/payment-enabler';
import { AdyenBaseComponentBuilder, BaseOptions, DefaultAdyenComponent } from '../base';

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
    })
    googlePayComponent.init();

    return googlePayComponent
  }
}

export class GooglePayComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: typeof Core;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
    usesOwnCertificate?: boolean;
  }) {
    super(opts);
  }

  init() {
    this.component = this.adyenCheckout.create(this.paymentMethod, {
      showPayButton: this.componentOptions.showPayButton,
      onClick: (resolve, reject) => {
        const res = this.componentOptions.onClick();
        if (res instanceof Promise) {
          res.then(() => resolve()).catch((error) => reject(error));
        } else {
          resolve();
        }
      },
      buttonType: 'pay',
      buttonSizeMode: 'fill'
    })
  }
}
