import { Payment } from '@commercetools/platform-sdk';
import { Transaction } from '@commercetools/platform-sdk/dist/declarations/src';
import { PaymentCancelResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCancelResponse';
import { PaymentMethodsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentMethodsResponse';
import { PaymentCaptureResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureResponse';
import { PaymentRefundResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundResponse';
import { Cart } from '@commercetools/platform-sdk';
import { PaymentAmount } from '@commercetools/connect-payments-sdk/dist/commercetools/types/payment.type';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/models';
import { randomUUID } from 'crypto';

export const mockGetPaymentResult: Payment = {
  id: '123456',
  version: 1,
  amountPlanned: {
    type: 'centPrecision',
    currencyCode: 'GBP',
    centAmount: 120000,
    fractionDigits: 2,
  },
  interfaceId: '92C12661DS923781G',
  paymentMethodInfo: {
    method: 'Debit Card',
    name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
  },
  paymentStatus: { interfaceText: 'Paid' },
  transactions: [],
  interfaceInteractions: [],
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
};

const mockCancelPaymentTransaction: Transaction = {
  id: 'dummy-transaction-id',
  timestamp: '2024-02-13T00:00:00.000Z',
  type: 'CancelAuthorization',
  amount: {
    type: 'centPrecision',
    centAmount: 120000,
    currencyCode: 'GBP',
    fractionDigits: 2,
  },
  state: 'Initial',
};

export const mockUpdatePaymentResult: Payment = {
  id: '123456',
  version: 1,
  amountPlanned: {
    type: 'centPrecision',
    currencyCode: 'GBP',
    centAmount: 120000,
    fractionDigits: 2,
  },
  interfaceId: '92C12661DS923781G',
  paymentMethodInfo: {
    method: 'Debit Card',
    name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
  },
  paymentStatus: { interfaceText: 'Paid' },
  transactions: [mockCancelPaymentTransaction],
  interfaceInteractions: [],
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
};

export const mockAdyenCancelPaymentResponse: PaymentCancelResponse = {
  status: PaymentCancelResponse.StatusEnum.Received,
  merchantAccount: 'ABC',
  paymentPspReference: '24680',
  pspReference: '123456',
};

export const mockAdyenPaymentMethodsResponse: PaymentMethodsResponse = {
  paymentMethods: [{ name: 'card' }],
};

export const mockAdyenCapturePaymentResponse: PaymentCaptureResponse = {
  status: PaymentCaptureResponse.StatusEnum.Received,
  paymentPspReference: '24680',
  pspReference: '123456',
  merchantAccount: 'ABC',
  reference: '123456',
  amount: {
    currency: 'USD',
    value: 150000,
  },
};

export const mockAdyenRefundPaymentResponse: PaymentRefundResponse = {
  status: PaymentRefundResponse.StatusEnum.Received,
  paymentPspReference: '24680',
  pspReference: '123456',
  merchantAccount: 'ABC',
  reference: '123456',
  amount: {
    currency: 'USD',
    value: 150000,
  },
};

export const mockGetCartResult = () => {
  const cartId = randomUUID();
  const mockGetCartResult: Cart = {
    id: cartId,
    version: 1,
    lineItems: [],
    customLineItems: [],
    totalPrice: {
      type: 'centPrecision',
      currencyCode: 'USD',
      centAmount: 150000,
      fractionDigits: 2,
    },
    cartState: 'Ordered',
    origin: 'Customer',
    taxMode: 'ExternalAmount',
    taxRoundingMode: 'HalfEven',
    taxCalculationMode: 'LineItemLevel',
    shipping: [],
    discountCodes: [],
    directDiscounts: [],
    refusedGifts: [],
    itemShippingAddresses: [],
    inventoryMode: 'ReserveOnOrder',
    shippingMode: 'Single',
    createdAt: '2024-01-01T00:00:00Z',
    lastModifiedAt: '2024-01-01T00:00:00Z',
  };
  return mockGetCartResult;
};

export const mockGetPaymentAmount: PaymentAmount = {
  centAmount: 150000,
  currencyCode: 'USD',
};

export const mockAdyenCreatePaymentResponse: PaymentResponse = {
  pspReference: '123456',
  resultCode: PaymentResponse.ResultCodeEnum.Received,
};
