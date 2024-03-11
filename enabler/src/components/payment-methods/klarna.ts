import { PaymentMethod } from '../../payment-enabler/payment-enabler';
import { AdyenBaseComponentBuilder, BaseOptions } from '../base';

/**
 * Klarna component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/klarna/web-component/
 */
export class KlarnaBuilder extends AdyenBaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    /* todo:
      pass locale
    */
    super(PaymentMethod.klarna, baseOptions);
  }
}
