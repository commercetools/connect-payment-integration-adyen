import { CustomFieldsDraft, TypeDraft } from '@commercetools/platform-sdk';

export const AdyenOrderDetailsTypeKey = 'commercetools-checkout-adyen-order-details';

export const AdyenOrderDetailsTypeDraft: TypeDraft = {
  key: AdyenOrderDetailsTypeKey,
  name: {
    en: 'Adyen Order details',
  },
  resourceTypeIds: ['payment'],
  fieldDefinitions: [
    {
      name: 'adyenOrderData',
      label: {
        en: 'Adyen Order Data',
      },
      type: {
        name: 'String',
      },
      required: false,
    },
    {
      name: 'adyenOrderPspReference',
      label: {
        en: 'Adyen Order PSP Reference',
      },
      type: {
        name: 'String',
      },
      required: false,
    },
  ],
};

export type AdyenOrderDetailsFields = {
  adyenOrderData?: string;
  adyenOrderPspReference?: string;
};

export const GenerateAdyenOrderDetailsCustomFieldsDraft = (fields: AdyenOrderDetailsFields): CustomFieldsDraft => {
  return {
    type: {
      key: AdyenOrderDetailsTypeKey,
      typeId: 'type',
    },
    fields: fields,
  };
};
