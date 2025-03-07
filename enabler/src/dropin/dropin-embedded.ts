import {
  DropinComponent,
  DropinOptions,
  PaymentDropinBuilder,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";
import {
  ICore,
  SubmitActions,
  SubmitData,
  Dropin,
  Card,
  PayPal,
  GooglePay,
  ApplePay,
  Redirect,
  SepaDirectDebit,
  Twint,
  Klarna,
  Bancontact,
  BcmcMobile,
  EPS,
  Blik,
  OnlineBankingPL,
  Swish,
  Vipps,
} from "@adyen/adyen-web";

export class DropinEmbeddedBuilder implements PaymentDropinBuilder {
  public dropinHasSubmit = false;

  private adyenCheckout: ICore;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
  }

  build(config: DropinOptions): DropinComponent {
    const dropin = new DropinComponents({
      adyenCheckout: this.adyenCheckout,
      dropinOptions: config,
    });

    dropin.init();
    return dropin;
  }
}

export class DropinComponents implements DropinComponent {
  protected component: Dropin;
  private adyenCheckout: ICore;
  private dropinOptions: DropinOptions;

  constructor(opts: { adyenCheckout: ICore; dropinOptions: DropinOptions }) {
    this.dropinOptions = opts.dropinOptions;
    this.adyenCheckout = opts.adyenCheckout;

    this.overrideOnSubmit();
  }

  init(): void {
    this.component = new Dropin(this.adyenCheckout, {
      showPayButton: true,
      showRadioButton: false,
      openFirstStoredPaymentMethod: false,
      showStoredPaymentMethods: false,
      isDropin: true,
      onReady: () => {
        if (this.dropinOptions.onDropinReady) {
          this.dropinOptions
            .onDropinReady()
            .then(() => {})
            .catch((error) => console.error(error));
        }
      },
      paymentMethodComponents: [
        ApplePay,
        Bancontact,
        BcmcMobile,
        Blik,
        Card,
        GooglePay,
        EPS,
        Klarna,
        OnlineBankingPL,
        PayPal,
        Redirect,
        SepaDirectDebit,
        Swish,
        Twint,
        Vipps,
      ],
      paymentMethodsConfiguration: {
        applepay: {
          buttonType: "pay" as any, // "pay" type is not included in Adyen's types, try to force it
          buttonColor: "black",
          onClick: (resolve, reject) => {
            if (this.dropinOptions.onPayButtonClick) {
              return this.dropinOptions
                .onPayButtonClick()
                .then(() => resolve())
                .catch((error) => reject(error));
            }
            return resolve();
          },
        },
        card: {
          hasHolderName: true,
          holderNameRequired: true,
        },
        googlepay: {
          buttonType: "pay",
          buttonSizeMode: "fill",
          onClick: (resolve, reject) => {
            if (this.dropinOptions.onPayButtonClick) {
              return this.dropinOptions
                .onPayButtonClick()
                .then(() => resolve())
                .catch(() => reject());
            }
            return resolve();
          },
        },
        paypal: {
          blockPayPalCreditButton: true,
          blockPayPalPayLaterButton: true,
          blockPayPalVenmoButton: true,
          style: {
            disableMaxWidth: true,
          },
          onClick: () => {
            if (this.dropinOptions.onPayButtonClick) {
              return this.dropinOptions
                .onPayButtonClick()
                .then(() => {})
                .catch((_error) => {
                  return false;
                });
            }
          },
        },
      },
    });
  }

  mount(selector: string) {
    this.component.mount(selector);
  }

  submit(): void {
    throw new Error(
      "Method not available. Submit is managed by the Dropin component.",
    );
  }

  private overrideOnSubmit() {
    const parentOnSubmit = this.adyenCheckout.options.onSubmit;

    this.adyenCheckout.options.onSubmit = async (
      state: SubmitData,
      component: Dropin,
      actions: SubmitActions,
    ) => {
      const paymentMethod = state.data.paymentMethod.type;
      const hasOnClick =
        component.props.paymentMethodsConfiguration[paymentMethod]?.onClick;
      if (!hasOnClick && this.dropinOptions.onPayButtonClick) {
        try {
          await this.dropinOptions.onPayButtonClick();
        } catch (e) {
          component.setStatus("ready");
          return;
        }
      }
      return await parentOnSubmit(state, component, actions);
    };
  }
}
