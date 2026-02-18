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
 * @throws No exceptions; invalid configurations are logged and ignored
 */
const parsePaymentMethodConfigFromEnv = (): PaymentMethodConfig => {
  const rawConfig = process.env.ADYEN_PAYMENT_METHODS_CONFIG;
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      log.warn('Invalid ADYEN_PAYMENT_METHODS_CONFIG; expected a JSON object.', { value: rawConfig });
      return {};
    }

    const parsedEntries = Object.entries(parsed as Record<string, unknown>);
    return parsedEntries.reduce<PaymentMethodConfig>((acc, [key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        log.warn('Ignoring payment method config entry; expected an object.', { key, value });
        return acc;
      }

      const methodConfig = value as PaymentMethodConfig;
      if (typeof methodConfig.supportSeparateCapture !== 'boolean') {
        log.warn('Ignoring payment method config entry; supportSeparateCapture must be boolean.', {
          key,
          value,
        });
        return acc;
      }

      acc[key] = { supportSeparateCapture: methodConfig.supportSeparateCapture };
      return acc;
    }, {});
  } catch (error) {
    log.warn('Failed to parse ADYEN_PAYMENT_METHODS_CONFIG; using defaults.', { error, value: rawConfig });
    return {};
  }
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
