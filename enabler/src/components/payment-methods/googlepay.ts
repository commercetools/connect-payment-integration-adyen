import { PaymentMethod } from '../../payment-enabler/payment-enabler';
import { AdyenBaseComponentBuilder, BaseOptions } from '../base';

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
}
