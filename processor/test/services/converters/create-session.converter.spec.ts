import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CartRest, type TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { Cart } from '@commercetools/connect-payments-sdk';
import { CreateSessionConverter } from '../../../src/services/converters/create-session.converter';
import * as Helpers from '../../../src/services/converters/helper.converter';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { paymentSDK } from '../../../src/payment-sdk';

describe('create-session.converter', () => {
  const converter = new CreateSessionConverter(paymentSDK.ctCartService);

  const cart = CartRest.random()
    .lineItems([])
    .customLineItems([])
    .buildRest<TCartRest>({
      omitFields: ['billingAddress', 'shippingAddress'],
    }) as Cart;

  const amountPlanned = { centAmount: 1000, currencyCode: 'EUR' };

  beforeEach(() => {
    vi.spyOn(Helpers, 'buildReturnUrl').mockReturnValue('https://commercetools.com');
    vi.spyOn(Helpers, 'convertAllowedPaymentMethodsToAdyenFormat').mockReturnValue([]);
    vi.spyOn(FastifyContext, 'getFutureOrderNumberFromContext').mockReturnValue(undefined);
    vi.spyOn(paymentSDK.ctCartService, 'getOneShippingAddress').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('blockedPaymentMethods', () => {
    test('passes the cart and its recurring flag to getBlockedPaymentMethods', () => {
      vi.spyOn(paymentSDK.ctCartService, 'isRecurringCart').mockReturnValue(true);
      const blockedSpy = vi.spyOn(Helpers, 'getBlockedPaymentMethods').mockReturnValue([]);

      converter.convertRequest({ data: {}, cart, amountPlanned });

      expect(blockedSpy).toHaveBeenCalledWith({ cart, isRecurringCart: true });
    });

    test('sets blockedPaymentMethods when getBlockedPaymentMethods returns payment methods', () => {
      vi.spyOn(paymentSDK.ctCartService, 'isRecurringCart').mockReturnValue(false);
      vi.spyOn(Helpers, 'getBlockedPaymentMethods').mockReturnValue(['scheme', 'paypal']);

      const result = converter.convertRequest({ data: {}, cart, amountPlanned });

      expect(result.blockedPaymentMethods).toEqual(['scheme', 'paypal']);
    });

    test('omits blockedPaymentMethods when getBlockedPaymentMethods returns no payment methods', () => {
      vi.spyOn(paymentSDK.ctCartService, 'isRecurringCart').mockReturnValue(false);
      vi.spyOn(Helpers, 'getBlockedPaymentMethods').mockReturnValue([]);

      const result = converter.convertRequest({ data: {}, cart, amountPlanned });

      expect(result).not.toHaveProperty('blockedPaymentMethods');
    });
  });
});
