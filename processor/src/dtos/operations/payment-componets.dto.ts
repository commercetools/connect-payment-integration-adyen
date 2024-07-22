import { Static, Type } from '@sinclair/typebox';

const DropinType = Type.Enum({
  COMPONENTS: 'components',
  HPP: 'hpp',
  EXPRESS: 'express',
});

export const SupportedPaymentDropinsData = Type.Object({
  type: DropinType,
});

export const SupportedPaymentComponentsData = Type.Object({
  type: Type.String(),
  subtypes: Type.Optional(Type.Array(Type.String())),
});

export const SupportedPaymentComponentsSchema = Type.Object({
  dropins: Type.Array(SupportedPaymentDropinsData),
  components: Type.Array(SupportedPaymentComponentsData),
});

export type SupportedPaymentComponentsSchemaDTO = Static<typeof SupportedPaymentComponentsSchema>;
