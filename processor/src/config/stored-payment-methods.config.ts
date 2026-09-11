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
        zip: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        ideal: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        // Unlike iDEAL, Adyen documents EPS recurring as going "through SEPA Direct Debit" and
        // shows the pay-with-token request using type: 'sepadirectdebit' directly, with no brand
        // hint preserving the original EPS identity. So an EPS-originated token is expected to
        // come back from Adyen (and be stored here) as a plain 'sepadirectdebit' method, not
        // 'eps' - unlike the googlepay/bcmc brand-collapse cases, there's no known way to tell
        // them apart after tokenization. Worth reconfirming with live token data (Adyen's docs
        // were wrong about iDEAL colliding the same way before we checked live data).
        eps: {
          oneOffPayments: false,
          recurringPayments: true,
        },
        // Unlike every other method here, PayPal recurring also requires PayPal's own
        // "Reference Transactions" permission to be granted on the merchant's PayPal seller
        // account (a manual request to PayPal support, separate from anything in Adyen or this
        // connector). Without it, Adyen will not create a token even though this config allows it.
        paypal: {
          oneOffPayments: false,
          recurringPayments: true,
        },
      },
    },
  };

  return storedPaymentMethodsConfigValidated;
};

/**
 * Whether tokenization is enabled, either for one-off payments or for recurring payments
 */
export const isTokenizationEnabled = (): boolean => {
  return getStoredPaymentMethodsConfig().enabled || getConfig().adyenRecurringPaymentsEnabled;
};
