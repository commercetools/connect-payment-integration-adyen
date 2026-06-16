import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { config } from '../../../src/config/config';
import { CreateOrderConverter } from '../../../src/services/converters/create-order.converter';
import { mockGetCartResultShippingModeSimple } from '../../utils/mock-cart-data';
import { mockGetPaymentAmount } from '../../utils/mock-payment-data';
import { paymentSDK } from '../../../src/payment-sdk';

describe('create-order.converter', () => {
  const converter = new CreateOrderConverter(paymentSDK.ctCartService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should build a valid Adyen create order request from a cart', async () => {
    // Arrange
    const cart = mockGetCartResultShippingModeSimple();

    jest.spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount').mockResolvedValueOnce(mockGetPaymentAmount);

    // Act
    const result = await converter.convertRequest({ cart });

    // Assert
    expect(result.merchantAccount).toEqual(config.adyenMerchantAccount);
    expect(result.reference).toEqual(cart.id);
    expect(result.amount).toEqual({
      currency: mockGetPaymentAmount.currencyCode,
      value: mockGetPaymentAmount.centAmount,
    });
    expect(result.expiresAt).toBeDefined();
    expect(new Date(result.expiresAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  test('should set expiresAt based on adyenOrderExpiryMinutes config', async () => {
    // Arrange
    const cart = mockGetCartResultShippingModeSimple();

    jest.spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount').mockResolvedValueOnce(mockGetPaymentAmount);

    const before = Date.now();
    const result = await converter.convertRequest({ cart });
    const after = Date.now();

    const expiresAtMs = new Date(result.expiresAt as string).getTime();
    const expectedMinMs = before + config.adyenOrderExpiryMinutes * 60 * 1000;
    const expectedMaxMs = after + config.adyenOrderExpiryMinutes * 60 * 1000;

    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMinMs);
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMaxMs);
  });
});
