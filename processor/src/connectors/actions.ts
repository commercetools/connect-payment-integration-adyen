import { TypeDraft } from '@commercetools/connect-payments-sdk';
import { CardDetailsTypeDraft, SepaDetailsTypeDraft } from '../custom-types/custom-types';
import { log } from '../libs/logger';
import { paymentSDK } from '../payment-sdk';
import { getConfig } from '../config/config';

export async function createPaymentMethodDetailsCustomType(): Promise<void> {
  if (!getConfig().adyenStorePaymentMethodDetailsEnabled) {
    log.info('Not creating the custom types for payment method details since the feature is disabled');
    return;
  }

  // TODO: SCC-3449: call the updated connect-payments-sdk with the ability to create new predefined payment details type(s) instead of doing it manually in here.
  // paymentSDK.ctCustomType.xxx
  const apiClient = paymentSDK.ctAPI.client;

  const typeDrafts: TypeDraft[] = [CardDetailsTypeDraft, SepaDetailsTypeDraft];

  for (const typeDraft of typeDrafts) {
    const getRes = await apiClient
      .types()
      .get({
        queryArgs: {
          where: `key="${typeDraft.key}"`,
        },
      })
      .execute();

    if (getRes.body.results.length > 0) {
      log.info(`Payment method details custom type with key='${typeDraft.key}' already exists. Skipping creation.`);
      continue;
    }

    try {
      const postRes = await apiClient
        .types()
        .post({
          body: typeDraft,
        })
        .execute();

      log.info(`Payment method details custom with key='${typeDraft.key}' created successfully`, postRes.body.id);
    } catch (error) {
      log.error(`Payment method details custom with key='${typeDraft.key}' could not be created.`, error);
    }
  }
}
