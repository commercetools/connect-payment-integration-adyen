import { GooglePay, ICore, PaymentMethod } from "@adyen/adyen-web";
import {
  ExpressOptions,
  OnComplete,
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
  private onComplete: OnComplete;

  constructor(baseOptions: BaseOptions) {
    this.adyenCheckout = baseOptions.adyenCheckout;
    this.processorUrl = baseOptions.processorUrl;
    this.sessionId = baseOptions.sessionId;
    this.countryCode = baseOptions.countryCode;
    this.currencyCode = baseOptions.currencyCode;
    this.paymentMethodConfig = baseOptions.paymentMethodConfig;
    this.onComplete = baseOptions.onComplete;
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
      onComplete: config.onComplete || this.onComplete,
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
    onComplete: OnComplete;
  }) {
    super({
      expressOptions: opts.componentOptions,
      processorUrl: opts.processorUrl,
      sessionId: opts.sessionId,
      countryCode: opts.countryCode,
      currencyCode: opts.currencyCode,
      paymentMethodConfig: opts.paymentMethodConfig,
      onComplete: opts.onComplete,
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
        allowedCountryCodes: this.expressOptions?.allowedCountries || [],
        phoneNumberRequired: true,
      },
      emailRequired: true,
      billingAddressRequired: true,
      billingAddressParameters: {
        format: "FULL",
        phoneNumberRequired: true,
      },
      onPaymentCompleted: (data, _component) => {
        this.onComplete({
          isSuccess: !!data.resultCode,
          paymentReference: this.paymentReference,
          method: this.paymentMethod,
        });
      },
      onClick: (resolve, reject) => {
        return this.expressOptions
          .onPayButtonClick()
          .then((opts) => {
            this.setSessionId(opts.sessionId);
            resolve();
          })
          .catch(() => reject());
      },
      onSubmit: async (state, component, actions) => {
        try {
          const reqData = {
            ...state.data,
            channel: "Web",
            countryCode: this.countryCode,
          };

          const response = await fetch(
            this.processorUrl + "/express-payments",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": this.sessionId,
              },
              body: JSON.stringify(reqData),
            }
          );
          const data = await response.json();

          this.paymentReference = data.paymentReference;
          this.paymentMethod = data.paymentMethod;
          if (!data.resultCode) {
            actions.reject();
            return;
          }

          if (data.action) {
            component.handleAction(data.action);
          } else {
            if (
              data.resultCode === "Authorised" ||
              data.resultCode === "Pending"
            ) {
              component.setStatus("success");
            } else {
              component.setStatus("error");
            }
          }

          actions.resolve({
            resultCode: data.resultCode,
            action: data.action,
          });
        } catch (error) {
          actions.reject(error);
        }
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

                paymentDataRequestUpdate.newShippingOptionParameters =
                  await me.getShippingOptions(shippingAddress.countryCode);

                await me.setShippingMethod({
                  shippingMethod: {
                    id: paymentDataRequestUpdate.newShippingOptionParameters
                      .defaultSelectedOptionId,
                  },
                });

                const transactionInfo = await me.getTransactionInfo();
                paymentDataRequestUpdate.newTransactionInfo = transactionInfo;
              } catch (error) {
                paymentDataRequestUpdate.error = {
                  reason: "SHIPPING_ADDRESS_UNSERVICEABLE",
                  message: "Cannot ship to the selected address",
                  intent: "SHIPPING_ADDRESS",
                };
              }
            }

            /** If SHIPPING_OPTION changed, we calculate the new fee */
            if (callbackTrigger === "SHIPPING_OPTION") {
              try {
                await me.setShippingMethod({
                  shippingMethod: {
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
        const shippedToFullName = data.authorizedEvent.shippingAddress.name;
        const payerFullName =
          data.authorizedEvent.paymentMethodData.info?.billingAddress?.name;

        const shippingAddress = this.convertAddress({
          address: data.deliveryAddress,
          email: data.authorizedEvent.email,
          firstName: shippedToFullName.split(" ")[0],
          lastName: shippedToFullName.split(" ").slice(1).join(" "),
          phoneNumber: data.authorizedEvent?.shippingAddress?.phoneNumber,
        });

        const billingAddress = this.convertAddress({
          address: data.billingAddress,
          email: data.authorizedEvent.email,
          firstName: payerFullName.split("")[0],
          lastName: payerFullName.split(" ").slice(1).join(" "),
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
