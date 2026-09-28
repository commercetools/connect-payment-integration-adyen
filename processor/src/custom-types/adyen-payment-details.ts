import { CustomFieldsDraft, Money, TypeDraft } from '@commercetools/platform-sdk';

/** Previous key of the type; still needed because a deployment may find the type stored under it. */
export const LegacyAdyenOrderDetailsTypeKey = 'commercetools-checkout-adyen-order-details';
export const AdyenPaymentDetailsTypeKey = 'commercetools-checkout-adyen-payment-details';
export const AdyenPaymentDetailsTypeName = 'Adyen payment details';
export const AdyenDonationStates = ['Pending', 'Success', 'Failure'] as const;
export type AdyenDonationState = (typeof AdyenDonationStates)[number];

export const AdyenPaymentDetailsTypeDraft: TypeDraft = {
  key: AdyenPaymentDetailsTypeKey,
  name: {
    en: AdyenPaymentDetailsTypeName,
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
    {
      name: 'adyenDonationToken',
      label: {
        en: 'Adyen Donation Token',
      },
      type: {
        name: 'String',
      },
      required: false,
    },
    {
      name: 'adyenDonationAmount',
      label: {
        en: 'Adyen Donation Amount',
      },
      type: {
        name: 'Money',
      },
      required: false,
    },
    {
      name: 'adyenDonationState',
      label: {
        en: 'Adyen Donation State',
      },
      type: {
        name: 'Enum',
        values: AdyenDonationStates.map((state) => ({ key: state, label: state })),
      },
      required: false,
    },
  ],
};

export type AdyenPaymentDetailsFields = {
  adyenOrderData?: string;
  adyenOrderPspReference?: string;
  adyenDonationToken?: string;
  adyenDonationAmount?: Money;
  adyenDonationState?: AdyenDonationState;
};

export const GenerateAdyenPaymentDetailsCustomFieldsDraft = (fields: AdyenPaymentDetailsFields): CustomFieldsDraft => {
  return {
    type: {
      key: AdyenPaymentDetailsTypeKey,
      typeId: 'type',
    },
    fields: fields,
  };
};
