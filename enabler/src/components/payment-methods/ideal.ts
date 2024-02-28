import { ComponentOptions, PaymentMethod } from '../../payment-enabler/payment-enabler';
import { BaseComponent, BaseOptions } from '../base';
/**
 * Ideal component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/ideal/web-component/
 */
export class Ideal extends BaseComponent {
  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.ideal, baseOptions, componentOptions);
  }

  showValidation() {
    this.component.showValidation();
  }

  isValid() {
    return this.component.isValid;
  }
}
