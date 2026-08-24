import { getConfig } from './config';

/**
 * Represents which payment methods are supported for tokenization. The key represents the type value of the payment method as defined by Adyen.
 */
export type SupportedStoredPaymentMethodsTypes = {
  [key: string]: {
    oneOffPayments: {
      enabled: boolean;
    };
    recurringPayments: {
      enabled: boolean;
      // Some payment methods (e.g. Afterpay) only support recurring/tokenization in specific
      // countries even though the same Adyen type value is used elsewhere. Omit to allow every
      // country wherever recurringPayments is true.
      allowedCountries?: string[];
    };
  };
};

export type StoredPaymentMethodsConfig = {
  enabled: boolean; // indicates if tokenization feature is enabled
  config: {
    paymentInterface: string; // paymentInterface to set
    interfaceAccount?: string; // optional interfaceAccount to set
    supportedPaymentMethodTypes: SupportedStoredPaymentMethodsTypes;
  };
};

let storedPaymentMethodsConfigValidated: StoredPaymentMethodsConfig;

export const getStoredPaymentMethodsConfig = (): StoredPaymentMethodsConfig => {
  if (storedPaymentMethodsConfigValidated) {
    return storedPaymentMethodsConfigValidated;
  }

  storedPaymentMethodsConfigValidated = {
    enabled: getConfig().adyenStoredPaymentMethodsEnabled,
    config: {
      paymentInterface: getConfig().adyenStoredPaymentMethodsPaymentInterface,
      interfaceAccount: getConfig().adyenStoredPaymentMethodsInterfaceAccount,
      supportedPaymentMethodTypes: {
        scheme: {
          oneOffPayments: {
            enabled: true,
          },
          recurringPayments: {
            enabled: true,
          },
        },
        googlepay: {
          oneOffPayments: {
            enabled: false,
          },
          recurringPayments: {
            enabled: true,
          },
        },
        applepay: {
          oneOffPayments: {
            enabled: false,
          },
          recurringPayments: {
            enabled: true,
          },
        },
        klarna_paynow: {
          oneOffPayments: {
            enabled: false,
          },
          recurringPayments: {
            enabled: true,
          },
        },
        klarna: {
          oneOffPayments: {
            enabled: false,
          },
          recurringPayments: {
            enabled: true,
          },
        },
        klarna_account: {
          oneOffPayments: {
            enabled: false,
          },
          recurringPayments: {
            enabled: true,
          },
        },
        afterpaytouch: {
          oneOffPayments: {
            enabled: false,
          },
          recurringPayments: {
            enabled: true,
            allowedCountries: ['AU', 'NZ'],
          },
        },
      },
    },
  };

  return storedPaymentMethodsConfigValidated;
};
