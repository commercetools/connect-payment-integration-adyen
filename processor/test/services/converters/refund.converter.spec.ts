import { describe, test, expect } from '@jest/globals';
import { mockGetPaymentResult } from '../../utils/mock-payment-data';
import { config } from '../../../src/config/config';
import { RefundPaymentConverter } from '../../../src/services/converters/refund-payment.converter';

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
});
