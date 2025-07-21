import { describe, test, expect } from '@jest/globals';
import { mockGetPaymentResult } from '../../utils/mock-payment-data';
import { config } from '../../../src/config/config';
import { RefundPaymentConverter } from '../../../src/services/converters/refund-payment.converter';
import { Payment } from '@commercetools/connect-payments-sdk';

describe('refund.converter', () => {
  const converter = new RefundPaymentConverter();

  test('convert with checkout merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;
    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
    };

    // Act
    const result = converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: mockGetPaymentResult.id,
      amount: {
        currency: mockGetPaymentResult.amountPlanned.currencyCode,
        value: mockGetPaymentResult.amountPlanned.centAmount,
      },
    });
  });

  test('convert with custom merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;
    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
      merchantReference: 'merchantReference',
    };

    // Act
    const result = converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: 'merchantReference',
      amount: {
        currency: mockGetPaymentResult.amountPlanned.currencyCode,
        value: mockGetPaymentResult.amountPlanned.centAmount,
      },
    });
  });

  test('convert refund for a PayPal payment with transactionId', async () => {
    // Arrange
    const payment = {
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
        method: 'paypal',
      },
      transactions: [
        {
          id: 'dummy-transaction-id',
          type: 'Charge',
          interactionId: 'some-psp-reference',
          amount: {
            type: 'centPrecision',
            currencyCode: 'GBP',
            centAmount: 120000,
            fractionDigits: 2,
          },
          state: 'Success',
        },
      ],
    } as Payment;
    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
      transactionId: payment.transactions[0].id,
    };

    // Act
    const result = converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: mockGetPaymentResult.id,
      amount: {
        currency: mockGetPaymentResult.amountPlanned.currencyCode,
        value: mockGetPaymentResult.amountPlanned.centAmount,
      },
      capturePspReference: payment.transactions[0].interactionId,
    });
  });

  test('convert refund for a PayPal payment throws an error when transactionId provided does not exist', async () => {
    // Arrange
    const payment = {
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
        method: 'paypal',
      },
      transactions: [
        {
          id: 'dummy-transaction-id',
          type: 'Charge',
          interactionId: 'some-psp-reference',
          amount: {
            type: 'centPrecision',
            currencyCode: 'GBP',
            centAmount: 120000,
            fractionDigits: 2,
          },
          state: 'Success',
        },
      ],
    } as Payment;

    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
      transactionId: 'non-existent-transaction-id',
    };

    // Act & Assert
    expect(() => {
      converter.convertRequest(data);
    }).toThrow(`Transaction with ID 'non-existent-transaction-id' does not exist`);
  });

  test('convert refund for a PayPal payment throws an error when transactionId provided is not of type Charge', async () => {
    // Arrange
    const payment = {
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
        method: 'paypal',
      },
      transactions: [
        {
          id: 'dummy-transaction-id',
          type: 'CancelAuthorization',
          interactionId: 'some-psp-reference',
          amount: {
            type: 'centPrecision',
            currencyCode: 'GBP',
            centAmount: 120000,
            fractionDigits: 2,
          },
          state: 'Initial',
        },
      ],
    } as Payment;

    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
      transactionId: payment.transactions[0].id,
    };

    // Act & Assert
    expect(() => {
      converter.convertRequest(data);
    }).toThrow(`Transaction with ID '${payment.transactions[0].id}' must be of type 'Charge'`);
  });
});
