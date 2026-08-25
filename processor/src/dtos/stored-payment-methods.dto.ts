import { Static, Type } from '@sinclair/typebox';

export const StoredPaymentMethodSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  token: Type.String(),
  isDefault: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  displayOptions: Type.Object({
    logoUrl: Type.Optional(Type.String()),
    cardDetails: Type.Optional(
      Type.Object({
        brand: Type.Optional(
          Type.Object({
            key: Type.String(),
          }),
        ),
        endDigits: Type.Optional(Type.String()),
        expiryMonth: Type.Optional(Type.Number()),
        expiryYear: Type.Optional(Type.Number()),
      }),
    ),
    // For bank-account-based methods (e.g. SEPA Direct Debit): endDigits is the last four digits
    // of the IBAN, since there is no separate PAN to display.
    bankDetails: Type.Optional(
      Type.Object({
        ownerName: Type.Optional(Type.String()),
        issuingBank: Type.Optional(Type.String()),
        endDigits: Type.Optional(Type.String()),
      }),
    ),
  }),
});

export const StoredPaymentMethodsResponseSchema = Type.Object({
  storedPaymentMethods: Type.Array(StoredPaymentMethodSchema),
});

export type StoredPaymentMethod = Static<typeof StoredPaymentMethodSchema>;
export type StoredPaymentMethodsResponse = Static<typeof StoredPaymentMethodsResponseSchema>;
