import { GooglePay, ICore } from "@adyen/adyen-web";
import {
  ExpressOptions,
  PaymentExpressBuilder,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/adyen-payment-enabler";
import { DefaultAdyenExpressComponent } from "./base";

/**
 * Google pay express component
 *
 * Configuration options:
 * https://docs.adyen.com/payment-methods/google-pay/web-component/express-checkout
 */
export class GooglePayExpressBuilder implements PaymentExpressBuilder {
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

  build(config: ExpressOptions): GooglePayExpressComponent {
    const googlePayComponent = new GooglePayExpressComponent({
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

type GooglePayShippingOption = {
  id: string;
  label: string;
  description?: string;
};

type GooglePayShippingOptions = {
  defaultSelectedOptionId: string;
  shippingOptions: GooglePayShippingOption[];
};

export class GooglePayExpressComponent extends DefaultAdyenExpressComponent {
  private adyenCheckout: ICore;
  public finalAmount: number;

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
    const me = this;

    this.component = new GooglePay(this.adyenCheckout, {
      isExpress: true,
      buttonType: "pay",
      buttonSizeMode: "fill",
      configuration: {
        gatewayMerchantId: this.paymentMethodConfig.gatewayMerchantId,
        merchantId: this.paymentMethodConfig.merchantId,
      },
      callbackIntents: ["SHIPPING_ADDRESS", "SHIPPING_OPTION"],
      shippingAddressRequired: true,
      shippingAddressParameters: {
        allowedCountryCodes: [],
        phoneNumberRequired: true,
      },
      emailRequired: true,
      billingAddressRequired: true,
      billingAddressParameters: {
        format: "FULL",
        phoneNumberRequired: true,
      },
      onClick: (resolve, reject) => {
        return this.expressOptions
          .onPaymentInit()
          .then(() => resolve())
          .catch(() => reject());
      },
      shippingOptionRequired: true,
      paymentDataCallbacks: {
        onPaymentDataChanged(intermediatePaymentData) {
          return new Promise(async (resolve) => {
            const { callbackTrigger, shippingAddress, shippingOptionData } =
              intermediatePaymentData;
            const paymentDataRequestUpdate: google.payments.api.PaymentDataRequestUpdate =
              {};

            /** If it initializes or changes the shipping address, we calculate the shipping options and transaction info  */
            if (
              callbackTrigger === "INITIALIZE" ||
              callbackTrigger === "SHIPPING_ADDRESS"
            ) {
              try {
                await me.setShippingAddress({
                  address: {
                    country: shippingAddress.countryCode,
                    postalCode: shippingAddress.postalCode,
                    city: shippingAddress.locality,
                  },
                });
              } catch (error) {
                paymentDataRequestUpdate.error = {
                  reason: "SHIPPING_ADDRESS_UNSERVICEABLE",
                  message: "Cannot ship to the selected address",
                  intent: "SHIPPING_ADDRESS",
                };
              }

              paymentDataRequestUpdate.newShippingOptionParameters =
                await me.getShippingOptions(shippingAddress.countryCode);

              await me.setShippingMethod({
                shippingOption: {
                  id: paymentDataRequestUpdate.newShippingOptionParameters
                    .defaultSelectedOptionId,
                },
              });

              const transactionInfo = await me.getTransactionInfo();
              paymentDataRequestUpdate.newTransactionInfo = transactionInfo;
            }
            /** If SHIPPING_OPTION changed, we calculate the new fee */
            if (callbackTrigger === "SHIPPING_OPTION") {
              try {
                await me.setShippingMethod({
                  shippingOption: {
                    id: shippingOptionData.id,
                  },
                });
              } catch (error) {
                paymentDataRequestUpdate.error = {
                  reason: "SHIPPING_OPTION_INVALID",
                  message: "Cannot use the selected shipping method",
                  intent: "SHIPPING_OPTION",
                };
              }

              paymentDataRequestUpdate.newTransactionInfo =
                await me.getTransactionInfo();
            }

            resolve(paymentDataRequestUpdate);
          });
        },
      },
      onAuthorized: (data, actions) => {
        const shippingAddress = this.convertAddress({
          address: data.deliveryAddress,
          email: data.authorizedEvent.email,
          name: data.authorizedEvent?.shippingAddress?.name,
          phoneNumber: data.authorizedEvent?.shippingAddress?.phoneNumber,
        });

        const billingAddress = this.convertAddress({
          address: data.billingAddress,
          email: data.authorizedEvent.email,
          name: data.authorizedEvent.paymentMethodData.info?.billingAddress
            ?.name,
          phoneNumber:
            data.authorizedEvent.paymentMethodData.info?.billingAddress
              ?.phoneNumber,
        });

        this.expressOptions
          .onPaymentSubmit({
            shippingAddress,
            billingAddress,
          })
          .then(() => actions.resolve())
          .catch((error) => {
            actions.reject(error);
          });
      },
    });
  }

  private async getShippingOptions(
    countryCode: string
  ): Promise<GooglePayShippingOptions> {
    const shippingMethods = await this.getShippingMethods({
      address: {
        country: countryCode,
      },
    });

    const convertedShippingOptions = shippingMethods.map((method) => ({
      id: method.id,
      label: `${this.formatCurrency(method.amount)} - ${method.name}`,
      description: method.description,
    }));

    const selectedShippingOption = shippingMethods.find((s) => s.isSelected);

    return {
      defaultSelectedOptionId:
        selectedShippingOption?.id || convertedShippingOptions[0].id,
      shippingOptions: convertedShippingOptions,
    };
  }

  private async getTransactionInfo(): Promise<google.payments.api.TransactionInfo> {
    const paymentData = await this.getInitialPaymentData();

    const displayItems: google.payments.api.DisplayItem[] =
      paymentData.lineItems.map((lineItem) => ({
        label: lineItem.name,
        type: this.convertToDisplayItemType(lineItem.type),
        price: this.centAmountToString(lineItem.amount.centAmount),
      }));

    return {
      displayItems,
      countryCode: this.countryCode,
      currencyCode: paymentData.currencyCode,
      totalPriceStatus: "FINAL",
      totalPrice: this.centAmountToString(paymentData.totalPrice.centAmount),
      totalPriceLabel: "Total",
    };
  }

  private convertToDisplayItemType(
    type: string
  ): google.payments.api.DisplayItemType {
    switch (type.toLocaleLowerCase()) {
      case "tax":
        return "TAX";
      case "shipping":
        return "SHIPPING_OPTION";
      case "discount":
        return "DISCOUNT";
      default:
        return "SUBTOTAL";
    }
  }
}
