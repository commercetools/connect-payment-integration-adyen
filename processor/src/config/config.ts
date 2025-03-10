export const config = {
  // Required by Payment SDK
  projectKey: process.env.CTP_PROJECT_KEY || 'projectKey',
  clientId: process.env.CTP_CLIENT_ID || 'xxx',
  clientSecret: process.env.CTP_CLIENT_SECRET || 'xxx',
  jwksUrl: process.env.CTP_JWKS_URL || 'https://mc-api.europe-west1.gcp.commercetools.com/.well-known/jwks.json',
  jwtIssuer: process.env.CTP_JWT_ISSUER || 'https://mc-api.europe-west1.gcp.commercetools.com',
  authUrl: process.env.CTP_AUTH_URL || 'https://auth.europe-west1.gcp.commercetools.com',
  apiUrl: process.env.CTP_API_URL || 'https://api.europe-west1.gcp.commercetools.com',
  sessionUrl: process.env.CTP_SESSION_URL || 'https://session.europe-west1.gcp.commercetools.com/',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),

  // Required by logger
  loggerLevel: process.env.LOGGER_LEVEL || 'info',

  // Payment Providers config
  adyenEnvironment: process.env.ADYEN_ENVIRONMENT || 'TEST',
  adyenClientKey: process.env.ADYEN_CLIENT_KEY || 'adyenClientKey',
  adyenApiKey: process.env.ADYEN_API_KEY || 'adyenApiKey',
  adyenHMACKey: process.env.ADYEN_NOTIFICATION_HMAC_KEY || 'adyenHMACKey',
  adyenLiveUrlPrefix: process.env.ADYEN_LIVE_URL_PREFIX || '',
  adyenMerchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || 'adyenMerchantAccount',
  adyenApplePayOwnCerticate: process.env.ADYEN_APPLEPAY_OWN_CERTIFICATE
    ? atob(process.env.ADYEN_APPLEPAY_OWN_CERTIFICATE)
    : '',
  adyenApplePayOwnMerchantId: process.env.ADYEN_APPLEPAY_OWN_MERCHANT_ID || '',
  adyenApplePayOwnMerchantDomain: process.env.ADYEN_APPLEPAY_OWN_MERCHANT_DOMAIN || '',
  adyenApplePayOwnDisplayName: process.env.ADYEN_APPLEPAY_OWN_DISPLAY_NAME || '',
  adyenShopperStatement: process.env.ADYEN_SHOPPER_STATEMENT || '',
  merchantReturnUrl: process.env.MERCHANT_RETURN_URL || '',
};
export const getConfig = () => {
  return config;
};
