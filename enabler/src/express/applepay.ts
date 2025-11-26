import { ApplePay, ICore, PaymentMethod } from "@adyen/adyen-web";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";
import { DefaultAdyenExpressComponent } from "./base";
import { PaymentExpressBuilder, ExpressOptions } from "../payment-enabler/payment-enabler";

export class ApplePayExpressBuilder implements PaymentExpressBuilder {
  private adyenCheckout: ICore;
  private processorUrl: string;
  private sessionId: string;
  private countryCode: string;
  private currencyCode: string;
  private paymentMethodConfig: { [key: string]: string };

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.processorUrl = baseOptions.processorUrl;
    this.sessionId = baseOptions.sessionId;
    this.countryCode = baseOptions.countryCode;
    this.currencyCode = baseOptions.currencyCode;
    this.paymentMethodConfig = baseOptions.paymentMethodConfig;
  }

  build(config: ExpressOptions): ApplePayExpressComponent {
    const googlePayComponent = new ApplePayExpressComponent({
      adyenCheckout: this.adyenCheckout,
      componentOptions: config,
      processorUrl: this.processorUrl,
      sessionId: this.sessionId,
      countryCode: this.countryCode,
      currencyCode: this.currencyCode,
      paymentMethodConfig: this.paymentMethodConfig,
    });
    googlePayComponent.init();

    return googlePayComponent;
  }
}

export class ApplePayExpressComponent extends DefaultAdyenExpressComponent {
  private adyenCheckout: ICore;
  public finalAmount: number;
  private paymentReference: string;
  private paymentMethod: PaymentMethod;

  constructor(opts: {
    adyenCheckout: ICore;
    componentOptions: ExpressOptions;
    processorUrl: string;
    sessionId: string;
    countryCode: string;
    currencyCode: string;
    paymentMethodConfig: { [key: string]: string };
  }) {
    super({
      expressOptions: opts.componentOptions,
      processorUrl: opts.processorUrl,
      sessionId: opts.sessionId,
      countryCode: opts.countryCode,
      currencyCode: opts.currencyCode,
      paymentMethodConfig: opts.paymentMethodConfig,
    });
    this.adyenCheckout = opts.adyenCheckout;
  }

  init(): void {
    console.log(this.paymentMethodConfig)

    this.component = new ApplePay(this.adyenCheckout, {
      isExpress: true,
      requiredBillingContactFields: ['postalAddress', 'email', 'name'],
      requiredShippingContactFields: ['postalAddress', 'name', 'phoneticName', 'email', 'phone'],
      configuration: {
        merchantId: this.paymentMethodConfig.merchantId,
        merchantName: this.paymentMethodConfig.merchantName
      },
    })
  }
}