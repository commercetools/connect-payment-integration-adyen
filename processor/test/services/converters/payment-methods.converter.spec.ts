import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CartRest, type TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { Cart } from '@commercetools/connect-payments-sdk';
import { PaymentMethodsConverter } from '../../../src/services/converters/payment-methods.converter';
import * as Helpers from '../../../src/services/converters/helper.converter';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { paymentSDK } from '../../../src/payment-sdk';

describe('payment-methods.converter', () => {
  const converter = new PaymentMethodsConverter(paymentSDK.ctCartService);

  const cart = CartRest.random().lineItems([]).customLineItems([]).buildRest<TCartRest>({}) as Cart;

  beforeEach(() => {
    vi.spyOn(FastifyContext, 'getCartIdFromContext').mockReturnValue(cart.id);
    vi.spyOn(paymentSDK.ctCartService, 'getCart').mockResolvedValue(cart);
    vi.spyOn(paymentSDK.ctCartService, 'getPaymentAmount').mockResolvedValue({
      centAmount: 1000,
      currencyCode: 'EUR',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('blockedPaymentMethods', () => {
    test('passes the cart and its recurring flag to getBlockedPaymentMethods', async () => {
      vi.spyOn(paymentSDK.ctCartService, 'isRecurringCart').mockReturnValue(true);
      const blockedSpy = vi.spyOn(Helpers, 'getBlockedPaymentMethods').mockReturnValue([]);

      await converter.convertRequest({ data: {} });

      expect(blockedSpy).toHaveBeenCalledWith({ cart, isRecurringCart: true });
    });

    test('sets blockedPaymentMethods when getBlockedPaymentMethods returns payment methods', async () => {
      vi.spyOn(paymentSDK.ctCartService, 'isRecurringCart').mockReturnValue(false);
      vi.spyOn(Helpers, 'getBlockedPaymentMethods').mockReturnValue(['scheme', 'paypal']);

      const result = await converter.convertRequest({ data: {} });

      expect(result.blockedPaymentMethods).toEqual(['scheme', 'paypal']);
    });

    test('omits blockedPaymentMethods when getBlockedPaymentMethods returns no payment methods', async () => {
      vi.spyOn(paymentSDK.ctCartService, 'isRecurringCart').mockReturnValue(false);
      vi.spyOn(Helpers, 'getBlockedPaymentMethods').mockReturnValue([]);

      const result = await converter.convertRequest({ data: {} });

      expect(result).not.toHaveProperty('blockedPaymentMethods');
    });
  });
});
