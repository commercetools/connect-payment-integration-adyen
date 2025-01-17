import { describe, test, expect } from '@jest/globals';
import { mockGetPaymentResult } from '../../utils/mock-payment-data';
import { config } from '../../../src/config/config';
import { CancelPaymentConverter } from '../../../src/services/converters/cancel-payment.converter';

describe('cancel.converter', () => {
  const converter = new CancelPaymentConverter();

  test('convert with checkout merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;
    const data = {
      payment,
    };

    // Act
    const result = converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: mockGetPaymentResult.id,
    });
  });

  test('convert with custom merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;
    const data = {
      payment,
      merchantReference: 'merchantReference',
    };

    // Act
    const result = converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: 'merchantReference',
    });
  });
});
