import {
  DropinComponent,
  DropinOptions,
  DropinType,
  getPaymentMethodType,
  PaymentDropinBuilder,
  PaymentMethod,
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
  AfterPay,
} from "@adyen/adyen-web";

export class DropinEmbeddedBuilder implements PaymentDropinBuilder {
  public dropinHasSubmit = false;
  private paymentComponentsConfigOverride: Record<string, any>;
  private adyenCheckout: ICore;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.paymentComponentsConfigOverride =
      baseOptions.paymentComponentsConfigOverride;
  }

  build(config: DropinOptions): DropinComponent {
    const dropin = new DropinComponents({
      adyenCheckout: this.adyenCheckout,
      dropinOptions: config,
      dropinConfigOverride: this.resolveDropinComponentConfigOverride(),
    });

    dropin.init();
    return dropin;
  }

  private resolveDropinComponentConfigOverride(): Record<string, any> {
    return this.paymentComponentsConfigOverride?.[DropinType.embedded] ?? {};
  }
}

export class DropinComponents implements DropinComponent {
  protected component: Dropin;
  private adyenCheckout: ICore;
  private dropinOptions: DropinOptions;
  private dropinConfigOverride: Record<string, any>;

  constructor(opts: {
    adyenCheckout: ICore;
    dropinOptions: DropinOptions;
    dropinConfigOverride: Record<string, any>;
  }) {
    this.dropinOptions = opts.dropinOptions;
    this.adyenCheckout = opts.adyenCheckout;
    this.dropinConfigOverride = opts.dropinConfigOverride;

    this.overrideOnSubmit();
  }

  init(): void {
    this.component = new Dropin(this.adyenCheckout, {
      showPayButton: true,
      showRadioButton: false,
      openFirstStoredPaymentMethod: false,
      showStoredPaymentMethods: true,
      showRemovePaymentMethodButton: true,

      onDisableStoredPaymentMethod: (resolve) => {
        return resolve();
      },
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
        AfterPay,
      ],
      paymentMethodsConfiguration: {
        applepay: {
          buttonType: "pay" as any, // "pay" type is not included in Adyen's types, try to force it
          buttonColor: "black",
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.applepay)
          ],
          // Configuration that can not be overridden
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
        bcmc: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.bancontactcard)
          ],
          // Configuration that can not be overridden
        },
        bcmc_mobile: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.bancontactmobile)
          ],
          // Configuration that can not be overridden
        },

        card: {
          hasHolderName: true,
          holderNameRequired: true,
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.card)
          ],
          enableStoreDetails: true,
          showStoreDetailsCheckbox: true,
          // Configuration that can not be overridden
        },
        googlepay: {
          buttonType: "pay",
          buttonSizeMode: "fill",
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.googlepay)
          ],
          // Configuration that can not be overridden
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
        klarna_b2b: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.klarna_billie)
          ],
          // Configuration that can not be overridden
        },
        klarna: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.klarna_pay_later)
          ],
          // Configuration that can not be overridden
        },
        klarna_paynow: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.klarna_pay_now)
          ],
          // Configuration that can not be overridden
        },
        klarna_account: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.klarna_pay_overtime)
          ],
          // Configuration that can not be overridden
        },
        onlineBanking_PL: {
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.przelewy24)
          ],
          // Configuration that can not be overridden
        },
        paypal: {
          blockPayPalCreditButton: true,
          blockPayPalPayLaterButton: true,
          blockPayPalVenmoButton: true,
          // Override the default config with the one provided by the user
          ...this.dropinConfigOverride[
            getPaymentMethodType(PaymentMethod.paypal)
          ],
          // Configuration that can not be overridden
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

  async mount(selector: string) {
    this.component.mount(selector);
  }

  async submit(): Promise<void> {
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
