import Core from '@adyen/adyen-web/dist/types/core/core';
import { ComponentOptions, PaymentComponent, PaymentMethod } from '../payment-enabler/payment-enabler';
import ApplePay from '@adyen/adyen-web/dist/types/components/ApplePay';
import GooglePay from '@adyen/adyen-web/dist/types/components/GooglePay';
import RedirectElement from '@adyen/adyen-web/dist/types/components/Redirect/Redirect';

export type BaseOptions = {
  adyenCheckout: typeof Core;
}

/**
 * Base Web Component
 */
export abstract class BaseComponent implements PaymentComponent {
  protected paymentMethod: PaymentMethod;
  protected adyenCheckout: typeof Core;
  protected config: ComponentOptions['config'];
  protected component: typeof ApplePay | typeof GooglePay | typeof RedirectElement;

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    this.paymentMethod = paymentMethod;
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.config = componentOptions.config;
    this.component = this._create();
  }

  protected _create(): typeof ApplePay | typeof GooglePay | typeof RedirectElement {
    return this.adyenCheckout.create(this.paymentMethod, this.config);
  }

  submit()  {
    this.component.submit();
  };

  mount(selector: string) {
    if ('isAvailable' in this.component) {
      this.component.isAvailable()
        .then(() => {
          this.component.mount(selector);
        })
        .catch((e: unknown) => {
          console.log(`${this.paymentMethod } is not available`, e);
        });
    } else {
      this.component.mount(selector);
    }
  }

  showValidation?(): void;
  isValid?(): boolean;
  getState?(): {
    card?: {
      endDigits?: string;
      brand?: string;
      expiryDate? : string;
    }
  };
}
