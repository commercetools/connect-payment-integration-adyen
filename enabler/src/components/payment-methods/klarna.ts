import { BaseComponent, BaseOptions } from '../base';
import { ComponentOptions, PaymentMethod } from '../../payment-enabler/payment-enabler';

/**
 * Klarna component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/klarna/web-component/
 */
export class Klarna extends BaseComponent {
  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    /* todo:
      pass locale
    */
    super(PaymentMethod.klarna, baseOptions, componentOptions);
  }
}
