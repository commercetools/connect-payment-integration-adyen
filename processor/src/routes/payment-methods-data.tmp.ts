import { Static, Type } from '@sinclair/typebox';

export const StoredPaymentMethodSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  token: Type.String(),
  isDefault: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  displayOptions: Type.Object({
    name: Type.String(),
    endDigits: Type.Optional(Type.String()),
    brand: Type.Optional(Type.String()),
    expiryMonth: Type.Optional(Type.String()),
    expiryYear: Type.Optional(Type.String()),
    logoUrl: Type.Optional(Type.String()),
  }),
});

type StoredPaymentMethod = Static<typeof StoredPaymentMethodSchema>;

export const StoredPaymentMethodsResponseSchema = Type.Object({
  storedPaymentMethods: Type.Array(StoredPaymentMethodSchema),
});

export const storedPaymentMethods: StoredPaymentMethod[] = [
  {
    id: 's1',
    token: 'QV5P9PGRCB9V3575',
    isDefault: true,
    createdAt: '2023-10-01T11:00:00Z',
    type: 'card',
    displayOptions: {
      name: '**** 1111',
      endDigits: '1111',
      brand: 'visa',
      expiryMonth: '12',
      expiryYear: '2025',
    },
  },
  {
    id: 's2',
    token: 'KNF9S4ZT5QQC7Z65',
    isDefault: false,
    createdAt: '2023-10-02T12:00:00Z',
    type: 'card',
    displayOptions: {
      name: '**** 5454',
      endDigits: '5454',
      brand: 'mc',
      expiryMonth: '07',
      expiryYear: '2025',
    },
  },
  {
    id: 's3',
    token: 'BXTFL42RCB9V3575',
    isDefault: false,
    createdAt: '2023-09-01T17:00:00Z',
    type: 'card',
    displayOptions: {
      name: '**** 1111 (2)',
      endDigits: '1111',
      brand: 'visa',
      expiryMonth: '12',
      expiryYear: '2025',
    },
  },
  {
    id: 's4',
    token: 'xtz',
    isDefault: false,
    createdAt: '2023-10-04T12:00:00Z',
    type: 'sepadirectdebit',
    displayOptions: {
      name: 'SEPA Direct Debit',
      logoUrl: 'https://checkoutshopper-test.adyen.com/checkoutshopper/images/icons/sepa.svg',
    },
  },
];
