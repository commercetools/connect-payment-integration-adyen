import { PaymentMethod } from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, BaseOptions } from "../base";

/**
 * Apple pay component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/apple-pay/web-component/
 */
export class ApplepayBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.applepay, baseOptions);
  }
}
