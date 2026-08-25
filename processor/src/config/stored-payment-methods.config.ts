import { getConfig } from './config';

/**
 * Represents which payment methods are supported for tokenization. The key represents the type value of the payment method as defined by Adyen.
 */
export type SupportedStoredPaymentMethodsTypes = {
  [key: string]: {
    oneOffPayments: boolean;
    recurringPayments: boolean;
    // Some payment methods (e.g. Afterpay) only support tokenization in specific countries even
    // though the same Adyen type value is used elsewhere. Applies to tokenization generally —
    // both a client-requested one-off store and an auto-stored recurring order — since it reflects
    // a capability of the payment method/account, not of a particular trigger path. Omit to allow
    // every country.
    tokenizationAllowedCountries?: string[];
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
          oneOffPayments: true,
          recurringPayments: true,
        },
        googlepay: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        applepay: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        klarna_paynow: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        klarna: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        klarna_account: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        afterpaytouch: {
          oneOffPayments: false,
          recurringPayments: true,
          tokenizationAllowedCountries: ['AU', 'NZ'],
        },
        bcmc: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        bcmc_mobile: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        sepadirectdebit: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        // EPS itself is never tokenized: Adyen sets up recurring for an EPS shopper as a SEPA
        // Direct Debit mandate instead, so the stored resource comes back as `sepadirectdebit`
        // (already configured above) rather than `eps`. This entry only gates the initial EPS
        // payment on a recurring cart being asked to store.
        eps: {
          oneOffPayments: false,
          recurringPayments: true,
        },
      },
    },
  };

  return storedPaymentMethodsConfigValidated;
};
