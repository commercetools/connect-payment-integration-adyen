import { Static, Type } from '@sinclair/typebox';

export const ConfigResponseSchema = Type.Object({
  clientKey: Type.String(),
  environment: Type.String(),
  applePayConfig: Type.Optional(
    Type.Object({
      usesOwnCertificate: Type.Boolean(),
    }),
  ),
  paymentComponentsConfig: Type.Optional(Type.Any()),
  storedPaymentMethodsConfig: Type.Object(
    {
      isEnabled: Type.Boolean(),
    },
    { description: 'Is true when the feature flag is enabled as well when the current cart has an customerId set' },
  ),
});

export type ConfigResponseSchemaDTO = Static<typeof ConfigResponseSchema>;
