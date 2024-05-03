import Core from "@adyen/adyen-web/dist/types/core/core";
import {
  ComponentOptions,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler";
import {
  AdyenBaseComponentBuilder,
  BaseOptions,
  DefaultAdyenComponent,
} from "../base";

/**
 * Apple pay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/apple-pay/web-component/
 */
export class ApplePayBuilder extends AdyenBaseComponentBuilder {
  private usesOwnCertificate: boolean;
  public componentHasSubmit = false;
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.applepay, baseOptions);
    this.usesOwnCertificate =
      baseOptions.applePayConfig?.usesOwnCertificate || false;
  }

  build(config: ComponentOptions): ApplePayComponent {
    const applePayComponent = new ApplePayComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      usesOwnCertificate: this.usesOwnCertificate,
    });
    applePayComponent.init();

    return applePayComponent;
  }
}

export class ApplePayComponent extends DefaultAdyenComponent {
  private usesOwnCertificate: boolean;
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: typeof Core;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
    usesOwnCertificate?: boolean;
  }) {
    super(opts);
    this.usesOwnCertificate = opts.usesOwnCertificate;
  }

  init() {
    this.component = this.adyenCheckout.create(this.paymentMethod, {
      ...this.componentOptions,
      buttonType: "pay",
      buttonColor: "black",
      ...(this.usesOwnCertificate && {
        onValidateMerchant: this.onValidateMerchant.bind(this),
      }),
    });
  }

  private onValidateMerchant(
    resolve: Function,
    reject: Function,
    validationUrl: string
  ) {
    fetch(`${this.processorUrl}/applepay-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify({
        validationUrl,
      }),
    })
      .then((res) => res.json())
      .then((merchantSession) => {
        resolve(merchantSession);
      })
      .catch((error) => {
        reject(error);
      });
  }
}
