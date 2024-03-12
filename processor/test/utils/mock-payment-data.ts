import { Payment } from '@commercetools/platform-sdk';
import { Transaction } from '@commercetools/platform-sdk/dist/declarations/src';
import { PaymentCancelResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCancelResponse'
import { PaymentMethodsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentMethodsResponse';

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

export const mockAdyenCancelPaymentResponse : PaymentCancelResponse = {
    status : PaymentCancelResponse.StatusEnum.Received,
    merchantAccount : 'ABC',
    paymentPspReference : '24680',
    pspReference: '123456'
}

export const mockAdyenPaymentMethodsResponse : PaymentMethodsResponse = {
    paymentMethods : [{ name : 'card'}]
}
