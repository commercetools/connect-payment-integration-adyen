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
});

export type ConfigResponseSchemaDTO = Static<typeof ConfigResponseSchema>;
