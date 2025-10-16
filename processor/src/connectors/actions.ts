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

  // the stripe connector creates a custom type for customers and what it does is check if the type exists, if so, then it adds a new attribute to the existing type.
  // I think that the behaviour we want, either to create or to extend a type
  // https://github.com/stripe/stripe-commercetools-checkout-app/blob/8bf028100eec0a8fea8b392f65d5098740a32927/processor/src/services/stripe-payment.service.ts#L742

  // https://github.com/stripe/stripe-commercetools-checkout-app/blob/main/processor/src/connectors/actions.ts#L81

  // https://github.com/stripe/stripe-commercetools-checkout-app/blob/main/processor/src/services/commerce-tools/customTypeHelper.ts#L47
  // https://github.com/stripe/stripe-commercetools-checkout-app/blob/main/processor/src/services/commerce-tools/customTypeHelper.ts#L130

  // TODO: SCC-3449: if the type by key does NOT exist then create the custom type
  // TODO: SCC-3449: if the type by key does exist then check if the static TypeDraft definition has more fields then in CT, if yes then update/add those fields.

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
