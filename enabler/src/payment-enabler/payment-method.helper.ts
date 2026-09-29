import { METHODS_WITH_NATIVE_RETRY_SHEET, PaymentMethod } from "./payment-enabler";

export const getPaymentMethodType = (adyenPaymentMethod: string | undefined): PaymentMethod => {
  if (!adyenPaymentMethod) {
    throw new Error('Adyen payment method type is undefined');
  }
  const entry = Object.entries(PaymentMethod).find(([, value]) => value === adyenPaymentMethod);
  if (!entry) {
    throw new Error(`Unknown Adyen payment method type: "${adyenPaymentMethod}"`);
  }
  return entry[0] as PaymentMethod;
};

export const hasNativeRetrySheet = (methodType: string | undefined): boolean =>
  !!methodType && METHODS_WITH_NATIVE_RETRY_SHEET.includes(methodType);
