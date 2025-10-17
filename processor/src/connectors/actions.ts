import { log } from '../libs/logger';
import { getConfig } from '../config/config';
import { paymentSDK } from '../payment-sdk';

export async function createCheckoutCustomType(): Promise<void> {
  if (!getConfig().adyenStorePaymentMethodDetailsEnabled) {
    log.info('Not creating the custom types for Checkout since the feature is disabled');
    return;
  }

  await paymentSDK.ctCustomTypeService.createOrUpdatePredefinedCheckoutType();
}
