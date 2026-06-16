import { log } from '../libs/logger';
import { getConfig } from '../config/config';
import { paymentSDK } from '../payment-sdk';
import { GiftCardDetailsTypeDraft } from '../custom-types/gift-card-details';
import { AdyenOrderDetailsTypeDraft } from '../custom-types/adyen-order-details';

export async function createCheckoutCustomType(): Promise<void> {
  if (getConfig().adyenPartialPaymentsEnabled) {
    log.info('Creating Adyen order details custom type if not existing...');
    try {
      const orderDetailsType = await paymentSDK.ctCustomTypeService.createOrUpdate(AdyenOrderDetailsTypeDraft);
      log.info('Created (if not existing) Adyen order details custom type', { typeId: orderDetailsType.id, typeKey: orderDetailsType.key });
    } catch (error) {
      log.error('Error creating Adyen order details custom type', { error });
    }
  }

  if (!getConfig().adyenStorePaymentMethodDetailsEnabled) {
    log.info('Not creating the predefined payment method custom-types for Checkout since the feature is disabled');
    return;
  }

  log.info('Creating payment method custom types if not existing...');
  try {
    const paymentMethodsTypes = await paymentSDK.ctCustomTypeService.createOrUpdatePredefinedPaymentMethodTypes();
    paymentMethodsTypes.forEach((type) => {
      log.info('Created (if not existing) payment method custom type', { typeId: type.id, typeKey: type.key });
    });

    const giftCardType = await paymentSDK.ctCustomTypeService.createOrUpdate(GiftCardDetailsTypeDraft);
    log.info('Created (if not existing) gift card details custom type', { typeId: giftCardType.id, typeKey: giftCardType.key });
  } catch (error) {
    log.error('Error creating payment method custom types', { error });
  }
}
