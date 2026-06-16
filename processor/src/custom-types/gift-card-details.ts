import { CustomFieldsDraft, TypeDraft } from '@commercetools/platform-sdk';

export const GiftCardDetailsTypeKey = 'commercetools-checkout-giftcard-details';

export const GiftCardDetailsTypeDraft: TypeDraft = {
  key: GiftCardDetailsTypeKey,
  name: {
    en: 'Gift card payment details',
  },
  resourceTypeIds: ['payment-method-info'],
  fieldDefinitions: [
    {
      name: 'brand',
      label: {
        en: 'Gift Card Brand',
      },
      type: {
        name: 'String',
      },
      required: false,
    },
  ],
};

export type GiftCardDetailsFields = {
  brand?: string;
};

export const GenerateGiftCardDetailsCustomFieldsDraft = (fields: GiftCardDetailsFields): CustomFieldsDraft => {
  return {
    type: {
      key: GiftCardDetailsTypeKey,
      typeId: 'type',
    },
    fields: fields,
  };
};
