import { Client, CheckoutAPI } from '@adyen/api-library';
import { config } from '../config/config';
import { log } from '../libs/logger';
import { AdyenApiError, AdyenApiErrorData } from '../errors/adyen-api.error';

export const AdyenApi = (): CheckoutAPI => {
  const apiClient = new Client({
    apiKey: config.adyenApiKey,
    environment: config.adyenEnvironment.toUpperCase() as Environment,
    ...(config.adyenLiveUrlPrefix && {
      liveEndpointUrlPrefix: config.adyenLiveUrlPrefix,
    }),
  });

  return new CheckoutAPI(apiClient);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const wrapAdyenError = (e: any): Error => {
  if (e?.responseBody) {
    const errorData = JSON.parse(e.responseBody) as AdyenApiErrorData;
    return new AdyenApiError(errorData, { cause: e });
  }

  log.error('Unexpected error calling Adyen', e);
  return e;
};
