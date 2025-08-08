import { ComponentOptions, PaymentComponent, PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, DefaultAdyenComponent } from "../base";
import { BaseOptions } from "../../payment-enabler/adyen-payment-enabler";
import { ICore, PayPal } from "@adyen/adyen-web";

/**
 * Paypal component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/paypal/web-component/
 */
export class PaypalBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.paypal, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const paypalComponent = new PaypalComponent({
      paymentMethod: this.paymentMethod,
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      paymentComponentConfigOverride: this.resolvePaymentComponentConfigOverride(PaymentMethod.paypal),
      setStorePaymentDetails: this.setStorePaymentDetails,
    });
    paypalComponent.init();
    return paypalComponent;
  }
}

export class PaypalComponent extends DefaultAdyenComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    adyenCheckout: ICore;
    componentOptions: ComponentOptions;
    sessionId: string;
    processorUrl: string;
    paymentComponentConfigOverride: Record<string, any>;
    setStorePaymentDetails: (enabled: boolean) => void;
  }) {
    super(opts);
  }

  init(): void {
    this.component = new PayPal(this.adyenCheckout, {
      blockPayPalCreditButton: true,
      blockPayPalPayLaterButton: true,
      blockPayPalVenmoButton: false,
      // Override the default config with the one provided by the user
      ...this.paymentComponentConfigOverride,
      // Configuration that can not be overridden
      showPayButton: this.componentOptions.showPayButton,
      onClick: () => {
        if (this.componentOptions.onPayButtonClick) {
          return this.componentOptions
            .onPayButtonClick()
            .then(({
              storePaymentDetails
            }: {
              storePaymentDetails?: boolean;
            }) => {
              this.setStorePaymentDetails?.(storePaymentDetails);
            })
            .catch((_error) => {
              return false;
            });
        }
        return true;
      },
    });
  }
}
