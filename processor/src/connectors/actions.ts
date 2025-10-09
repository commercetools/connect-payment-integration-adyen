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

  const apiClient = paymentSDK.ctAPI.client;

  const typeDrafts: TypeDraft[] = [CardDetailsTypeDraft, SepaDetailsTypeDraft];

  // TODO: SCC-3449: figure out the correct approach with regards to custom 'key' value or not.
  // TODO: SCC-3449: figure out the correct approach with regards to validating if the existing custom type schema is correct or not. If not should we update it?

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
