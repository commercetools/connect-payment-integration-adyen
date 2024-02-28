import { BaseComponent, BaseOptions } from '../base';
import { ComponentOptions, PaymentMethod } from '../../payment-enabler/payment-enabler';

/**
 * Apple pay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/apple-pay/web-component/
 */
export class Applepay extends BaseComponent {
  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.applepay, baseOptions, componentOptions);
  }
}
