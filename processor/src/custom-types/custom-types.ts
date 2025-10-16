import { TypeDraft } from '@commercetools/connect-payments-sdk';

// TODO: SCC-3449: Ensure to allow a flag to save the intention of the buyer to store the payment method (needed for cko connector)
// TODO: SCC-3449: Evaluate if it’s better to have a single type for all the payment methods or a specific type for each one as it is in the RFC.

export const CardDetailsTypeDraft: TypeDraft = {
  key: 'CardDetails',
  name: {
    en: 'Card payment details',
  },
  resourceTypeIds: ['payment-method-info', 'payment-method'],
  fieldDefinitions: [
    {
      name: 'brand',
      label: {
        en: 'Card Brand',
      },
      type: {
        name: 'Enum',
        values: [
          {
            key: 'Amex',
            label: 'American Express',
          },
          {
            key: 'Bancontact',
            label: 'Bancontact',
          },
          {
            key: 'CartesBancaires',
            label: 'Cartes Bancaires',
          },
          {
            key: 'Diners',
            label: 'Diners Club',
          },
          {
            key: 'Discover',
            label: 'Discover',
          },
          {
            key: 'EftposAu',
            label: 'Eftpos AU',
          },
          {
            key: 'Jcb',
            label: 'JCB',
          },
          {
            key: 'Link',
            label: 'Link',
          },
          {
            key: 'Maestro',
            label: 'Maestro',
          },
          {
            key: 'Mastercard',
            label: 'Mastercard',
          },
          {
            key: 'UnionPay',
            label: 'UnionPay',
          },
          {
            key: 'Visa',
            label: 'Visa',
          },
          {
            key: 'Unknown',
            label: 'Unknown',
          },
        ],
      },
      required: true,
    },
    {
      name: 'lastFour',
      label: {
        en: 'Last four digits of the card',
      },
      type: {
        name: 'String',
      },
      required: true,
    },
    {
      name: 'bin',
      label: {
        en: 'Card BIN',
      },
      type: {
        name: 'String',
      },
      required: false,
    },
    {
      name: 'expiryMonth',
      label: {
        en: 'Expiry Month',
      },
      type: {
        name: 'Number',
      },
      required: false,
    },
    {
      name: 'expiryYear',
      label: {
        en: 'Expiry Year',
      },
      type: {
        name: 'Number',
      },
      required: false,
    },
  ],
};

export const SepaDetailsTypeDraft: TypeDraft = {
  key: 'SepaDetails',
  name: {
    en: 'SEPA Direct Debit details',
  },
  resourceTypeIds: ['payment-method-info', 'payment-method'],
  fieldDefinitions: [
    {
      name: 'lastFour',
      label: {
        en: 'Last four digits of IBAN',
      },
      type: {
        name: 'String',
      },
      required: true,
    },
  ],
};
