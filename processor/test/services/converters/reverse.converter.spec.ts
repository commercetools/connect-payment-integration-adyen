import { describe, test, expect } from '@jest/globals';
import { mockGetPaymentResult } from '../../utils/mock-payment-data';
import { config } from '../../../src/config/config';
import { ReversePaymentConverter } from '../../../src/services/converters/reverse-payment.converter';

describe('reverse.converter', () => {
  const converter = new ReversePaymentConverter();

  test('convert with checkout merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;

    // Act
    const result = converter.convertRequest({
      payment,
    });

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: mockGetPaymentResult.id,
    });
  });

  test('convert with custom merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;

    // Act
    const result = converter.convertRequest({
      payment,
      merchantReference: 'merchantReference',
    });

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: 'merchantReference',
    });
  });
});
