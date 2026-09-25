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
    {
      name: 'lastFour',
      label: {
        en: 'Last four digits of the gift card',
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
  lastFour?: string;
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
