import {
  PaymentMethod
} from "../../payment-enabler/payment-enabler";
import { AdyenBaseComponentBuilder, BaseOptions } from "../base";

/**
 * Paypal component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/paypal/web-component/
 */
export class PaypalBuilder extends AdyenBaseComponentBuilder {
  public componentHasSubmit = false;

  constructor(baseOptions: BaseOptions) {
    // TODO:

    /*

    Hide Venmo

      If you and your shopper are both located in the US, Venmo is shown in the PayPal Component by default. To hide Venmo in the PayPal Component, set blockPayPalVenmoButton to true.

      Use the create method of your AdyenCheckout instance, in this case checkout, to create an instance of the Component. Add the configuration object if you created one.


      const paypalComponent = checkout.create('paypal', paypalConfiguration).mount('#paypal-container');
      */
    super(PaymentMethod.paypal, baseOptions);
  }
}
