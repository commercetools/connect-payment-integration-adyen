/**
 * Specific configuration for payment methods that require special handling.
 * See https://docs.adyen.com/payment-methods for more information about each payment method.
 *
 * The key must point to the Adyen payment-method key structure.
 *
 * Configuration can be overridden via the ADYEN_PAYMENT_METHODS_CONFIG environment variable,
 * which accepts a JSON string with payment method overrides.
 * Example: '{"bcmc":{"supportSeparateCapture":true}}'
 *
 * @see ADYEN_PAYMENT_METHODS_CONFIG environment variable
 */
import { log } from '../libs/logger';

export type PaymentMethodConfig = {
  [key: string]: {
    /**
     * Whether the payment method supports separate capture (manual/deferred capture).
     * When false, the connector automatically creates a Charge transaction upon authorization.
     * When true, the connector waits for the CAPTURE webhook from Adyen.
     */
    supportSeparateCapture: boolean;
  };
};

/**
 * Default payment method configuration.
 * These payment methods do not support separate capture by default.
 * This can be overridden via the ADYEN_PAYMENT_METHODS_CONFIG environment variable.
 */
export const defaultPaymentMethodConfig: PaymentMethodConfig = {
  bcmc: {
    supportSeparateCapture: false,
  },
  bcmc_mobile: {
    supportSeparateCapture: false,
  },
  blik: {
    supportSeparateCapture: false,
  },
  eps: {
    supportSeparateCapture: false,
  },
  molpay_ebanking_fpx_MY: {
    supportSeparateCapture: false,
  },
  ideal: {
    supportSeparateCapture: false,
  },
  onlineBanking_PL: {
    supportSeparateCapture: false,
  },
  swish: {
    supportSeparateCapture: false,
  },
};

/**
 * Safely parses a JSON string and returns the result or null on failure.
 */
const parseJSON = <T>(json: string): T | null => {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    log.warn('Failed to parse JSON for ADYEN_PAYMENT_METHODS_CONFIG', { error, value: json });
    return null;
  }
};

/**
 * Type guard to check if a value is a valid payment method entry.
 */
const isValidPaymentMethodEntry = (value: unknown): value is PaymentMethodConfig[string] => {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).supportSeparateCapture === 'boolean'
  );
};

/**
 * Parses and validates the ADYEN_PAYMENT_METHODS_CONFIG environment variable.
 *
 * The environment variable must be a JSON string with the following structure:
 * {
 *   "paymentMethodKey": {
 *     "supportSeparateCapture": boolean
 *   }
 * }
 *
 * @returns Parsed payment method configuration, or empty object if parsing fails or env var is not set
 * @throws No exceptions; invalid entries are logged and ignored
 */
const parsePaymentMethodConfigFromEnv = (): PaymentMethodConfig => {
  const config = process.env.ADYEN_PAYMENT_METHODS_CONFIG;
  const parsed = parseJSON<Record<string, unknown>>(config || '{}');

  if (!parsed) {
    return {};
  }

  const result: PaymentMethodConfig = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (isValidPaymentMethodEntry(value)) {
      result[key] = value;
    } else {
      log.warn('Ignoring invalid payment method config entry', { key, value });
    }
  }

  return result;
};

const mergePaymentMethodConfig = (
  baseConfig: PaymentMethodConfig,
  overrideConfig: PaymentMethodConfig,
): PaymentMethodConfig => ({
  ...baseConfig,
  ...overrideConfig,
});

/**
 * Gets the merged payment method configuration.
 *
 * Merges the default configuration with any overrides from the ADYEN_PAYMENT_METHODS_CONFIG
 * environment variable. Environment variable values take precedence over defaults.
 *
 * @returns The merged payment method configuration
 */
export const getPaymentMethodConfig = (): PaymentMethodConfig =>
  mergePaymentMethodConfig(defaultPaymentMethodConfig, parsePaymentMethodConfigFromEnv());
