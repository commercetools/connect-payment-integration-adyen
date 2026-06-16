export const config = {
  // commercetools / Payment SDK
  projectKey: process.env.CTP_PROJECT_KEY || 'projectKey',
  clientId: process.env.CTP_CLIENT_ID || 'xxx',
  clientSecret: process.env.CTP_CLIENT_SECRET || 'xxx',
  jwksUrl: process.env.CTP_JWKS_URL || 'https://mc-api.europe-west1.gcp.commercetools.com/.well-known/jwks.json',
  jwtIssuer: process.env.CTP_JWT_ISSUER || 'https://mc-api.europe-west1.gcp.commercetools.com',
  authUrl: process.env.CTP_AUTH_URL || 'https://auth.europe-west1.gcp.commercetools.com',
  apiUrl: process.env.CTP_API_URL || 'https://api.europe-west1.gcp.commercetools.com',
  sessionUrl: process.env.CTP_SESSION_URL || 'https://session.europe-west1.gcp.commercetools.com/',
  checkoutUrl: process.env.CTP_CHECKOUT_URL || 'https://checkout.europe-west1.gcp.commercetools.com',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  merchantReturnUrl: process.env.MERCHANT_RETURN_URL || '',
  loggerLevel: process.env.LOGGER_LEVEL || 'info',

  // Adyen — core
  adyenEnvironment: process.env.ADYEN_ENVIRONMENT || 'TEST',
  adyenClientKey: process.env.ADYEN_CLIENT_KEY || 'adyenClientKey',
  adyenApiKey: process.env.ADYEN_API_KEY || 'adyenApiKey',
  adyenMerchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || 'adyenMerchantAccount',
  adyenLiveUrlPrefix: process.env.ADYEN_LIVE_URL_PREFIX || '',
  adyenShopperStatement: process.env.ADYEN_SHOPPER_STATEMENT || '',
  adyenPaymentComponentsConfig: process.env.ADYEN_PAYMENT_COMPONENTS_CONFIG || '',
  paymentInterface: process.env.ADYEN_STORED_PAYMENT_METHODS_PAYMENT_INTERFACE || 'checkout-adyen',

  // Adyen — webhooks
  adyenHMACKey: process.env.ADYEN_NOTIFICATION_HMAC_KEY || 'adyenHMACKey',
  adyenHMACTokenizationWebHooksKey: process.env.ADYEN_NOTIFICATION_HMAC_TOKENIZATION_WEBHOOKS_KEY || undefined,

  // Adyen — Apple Pay (own certificate)
  adyenApplePayOwnCerticate: process.env.ADYEN_APPLEPAY_OWN_CERTIFICATE
    ? atob(process.env.ADYEN_APPLEPAY_OWN_CERTIFICATE)
    : '',
  adyenApplePayOwnMerchantId: process.env.ADYEN_APPLEPAY_OWN_MERCHANT_ID || '',
  adyenApplePayOwnMerchantDomain: process.env.ADYEN_APPLEPAY_OWN_MERCHANT_DOMAIN || '',
  adyenApplePayOwnDisplayName: process.env.ADYEN_APPLEPAY_OWN_DISPLAY_NAME || '',

  // Adyen — stored payment methods
  adyenStoredPaymentMethodsEnabled: process.env.ADYEN_STORED_PAYMENT_METHODS_ENABLED === 'true',
  adyenStoredPaymentMethodsPaymentInterface: process.env.ADYEN_STORED_PAYMENT_METHODS_PAYMENT_INTERFACE || 'adyen',
  adyenStoredPaymentMethodsInterfaceAccount: process.env.ADYEN_STORED_PAYMENT_METHODS_INTERFACE_ACCOUNT || undefined,
  adyenStorePaymentMethodDetailsEnabled: process.env.ADYEN_STORE_PAYMENT_METHOD_DETAILS_ENABLED === 'true',

  // Adyen — partial payments (gift cards)
  adyenPartialPaymentsEnabled: process.env.ADYEN_PARTIAL_PAYMENTS_ENABLED === 'true',
  adyenOrderExpiryMinutes: parseInt(process.env.ADYEN_ORDER_EXPIRY_MINUTES || '60', 10),
};

export const getConfig = () => {
  return config;
};
