import { describe, test, expect } from '@jest/globals';
import { config } from '../../../src/config/config';
import { CancelOrderConverter } from '../../../src/services/converters/cancel-order.converter';
import { CancelOrderRequestDTO } from '../../../src/dtos/adyen-payment.dto';

describe('cancel-order.converter', () => {
  const converter = new CancelOrderConverter();

  test('should map orderData and pspReference into the Adyen cancel order request', () => {
    // Arrange
    const dto: CancelOrderRequestDTO = {
      orderData: 'some-order-data',
      pspReference: 'ABC123DEF456',
    };

    // Act
    const result = converter.convertRequest({ data: dto });

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      order: {
        orderData: 'some-order-data',
        pspReference: 'ABC123DEF456',
      },
    });
  });
});
