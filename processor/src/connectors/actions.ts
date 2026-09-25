import { log } from '../libs/logger';
import { getConfig } from '../config/config';
import { paymentSDK } from '../payment-sdk';
import { GiftCardDetailsTypeDraft } from '../custom-types/gift-card-details';
import {
  AdyenPaymentDetailsTypeDraft,
  AdyenPaymentDetailsTypeKey,
  AdyenPaymentDetailsTypeName,
  LegacyAdyenOrderDetailsTypeKey,
} from '../custom-types/adyen-payment-details';

/**
 * Creates the Adyen payment details custom type, renaming it in place from its legacy key when
 * present. Payments reference the type by id, so no data migration is needed. Idempotent.
 */
async function createOrRenameAdyenPaymentDetailsCustomType(): Promise<void> {
  log.info('Creating Adyen payment details custom type if not existing...');
  try {
    const alreadyMigrated = await paymentSDK.ctCustomTypeService.existsByKey({ key: AdyenPaymentDetailsTypeKey });

    if (!alreadyMigrated) {
      const legacyExists = await paymentSDK.ctCustomTypeService.existsByKey({ key: LegacyAdyenOrderDetailsTypeKey });

      if (legacyExists) {
        const legacyType = await paymentSDK.ctCustomTypeService.getByKey({ key: LegacyAdyenOrderDetailsTypeKey });

        await paymentSDK.ctCustomTypeService.update({
          key: LegacyAdyenOrderDetailsTypeKey,
          updateActions: {
            version: legacyType.version,
            actions: [
              { action: 'changeKey', key: AdyenPaymentDetailsTypeKey },
              { action: 'changeName', name: { en: AdyenPaymentDetailsTypeName } },
            ],
          },
        });

        log.info('Renamed the legacy Adyen order details custom type', {
          typeId: legacyType.id,
          previousTypeKey: LegacyAdyenOrderDetailsTypeKey,
          typeKey: AdyenPaymentDetailsTypeKey,
        });
      }
    }

    // Also adds any field definitions an already existing type is lacking
    const paymentDetailsType = await paymentSDK.ctCustomTypeService.createOrUpdate(AdyenPaymentDetailsTypeDraft);
    log.info('Created (if not existing) Adyen payment details custom type', {
      typeId: paymentDetailsType.id,
      typeKey: paymentDetailsType.key,
    });
  } catch (error) {
    log.error('Error creating Adyen payment details custom type', { error });
  }
}

export async function createCheckoutCustomType(): Promise<void> {
  if (getConfig().saveInterfaceInteractions) {
    log.info('Creating interface interaction custom type if not existing...');
    try {
      const interfaceInteractionType =
        await paymentSDK.ctCustomTypeService.createOrUpdatePredefinedInterfaceInteractionType();
      log.info('Created (if not existing) interface interaction custom type', {
        typeId: interfaceInteractionType.id,
        typeKey: interfaceInteractionType.key,
      });
    } catch (error) {
      log.error('Error creating interface interaction custom type', { error });
    }
  }

  if (getConfig().adyenPartialPaymentsEnabled || getConfig().adyenGivingEnabled) {
    await createOrRenameAdyenPaymentDetailsCustomType();
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
    log.info('Created (if not existing) gift card details custom type', {
      typeId: giftCardType.id,
      typeKey: giftCardType.key,
    });
  } catch (error) {
    log.error('Error creating payment method custom types', { error });
  }
}
