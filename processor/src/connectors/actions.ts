import { log } from '../libs/logger';
import { getConfig } from '../config/config';
import { paymentSDK } from '../payment-sdk';

export async function createCheckoutCustomType(): Promise<void> {
  if (!getConfig().adyenStorePaymentMethodDetailsEnabled) {
    log.info('Not creating the predefined payment method custom-types for Checkout since the feature is disabled');
    return;
  }

  log.info('Creating payment custom types if not existing...');

  try {
    const paymentMethodsTypes = await paymentSDK.ctCustomTypeService.createOrUpdatePredefinedPaymentMethodTypes();
    paymentMethodsTypes.forEach((type) => {
      log.info('Created (if not existing) payment method custom type', { typeId: type.id, typeKey: type.key });
    });
  } catch (error) {
    log.error('Error creating payment custom types', { error });
  }
}
