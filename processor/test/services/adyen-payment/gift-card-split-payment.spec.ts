import { beforeEach, describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { mockGetCartResultShippingModeSimple } from '../../utils/mock-cart-data';
import {
  mockAdyenCreatePaymentResponse,
  mockGetPaymentAmount,
  mockGetPaymentResult,
} from '../../utils/mock-payment-data';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import { Cart, ErrorInvalidOperation, Payment } from '@commercetools/connect-payments-sdk';
import { CreatePaymentRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { OrdersApi } from '@adyen/api-library/lib/src/services/checkout/ordersApi';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { BalanceCheckResponse } from '@adyen/api-library/lib/src/typings/checkout/models';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent } from './test-setup';

describe('adyen-payment.service - gift card split payment', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('calculateRemainingAmount', () => {
    const service = new AdyenPaymentService(opts);

    const baseCart = () => ({
      ...mockGetCartResultShippingModeSimple(),
      totalPrice: { type: 'centPrecision' as const, centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 },
    });

    const approvedPayment = (overrides: Partial<Payment> = {}): Payment => ({
      ...mockGetPaymentResult,
      id: 'payment-1',
      amountPlanned: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
      transactions: [
        {
          id: 'tx-1',
          type: 'Authorization',
          state: 'Success',
          amount: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
          timestamp: '2024-01-01T00:00:00Z',
        },
      ],
      ...overrides,
    });

    const cartWithPayments = (payments: Payment[]): Cart => ({
      ...baseCart(),
      paymentInfo: { payments: payments.map((p) => ({ typeId: 'payment' as const, id: p.id, obj: p })) },
    });

    beforeEach(() => {
      vi.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(0);
    });

    test('returns full totalPrice when cart has no payments', () => {
      const result = service.calculateRemainingAmount(baseCart());
      expect(result).toEqual({ centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 });
    });

    test('uses taxedPrice.totalGross when available instead of totalPrice', () => {
      const cart: Cart = {
        ...baseCart(),
        taxedPrice: {
          totalNet: { type: 'centPrecision', centAmount: 8000, currencyCode: 'USD', fractionDigits: 2 },
          totalGross: { type: 'centPrecision', centAmount: 9600, currencyCode: 'USD', fractionDigits: 2 },
          taxPortions: [],
        },
      };
      const result = service.calculateRemainingAmount(cart);
      expect(result.centAmount).toBe(9600);
    });

    test('deducts approved payments without adyenOrderData', () => {
      const payment = approvedPayment();
      const result = service.calculateRemainingAmount(cartWithPayments([payment]));
      expect(result.centAmount).toBe(10000 - 2000);
    });

    test('does not deduct approved payments that carry adyenOrderData (gift card orders being cancelled)', () => {
      const payment = approvedPayment({
        custom: {
          type: { typeId: 'type', id: 'ct' },
          fields: { adyenOrderData: 'order-data', adyenOrderPspReference: 'ORDER-PSP-1' },
        },
      });
      const result = service.calculateRemainingAmount(cartWithPayments([payment]));
      expect(result.centAmount).toBe(10000);
    });

    test('does not deduct reverted payments (Authorization followed by CancelAuthorization in Success)', () => {
      const payment = approvedPayment({
        transactions: [
          {
            id: 'tx-auth',
            type: 'Authorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: 'tx-cancel',
            type: 'CancelAuthorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
            timestamp: '2024-01-01T01:00:00Z',
          },
        ],
      });
      const result = service.calculateRemainingAmount(cartWithPayments([payment]));
      expect(result.centAmount).toBe(10000);
    });

    test('deducts giftCardCentAmount from context', () => {
      vi.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(500);
      const result = service.calculateRemainingAmount(baseCart());
      expect(result.centAmount).toBe(10000 - 500);
    });

    test('deducts multiple approved non-order payments independently', () => {
      const p1 = approvedPayment({
        id: 'p1',
        amountPlanned: { type: 'centPrecision', centAmount: 1000, currencyCode: 'USD', fractionDigits: 2 },
      });
      const p2 = approvedPayment({
        id: 'p2',
        amountPlanned: { type: 'centPrecision', centAmount: 3000, currencyCode: 'USD', fractionDigits: 2 },
      });
      const result = service.calculateRemainingAmount(cartWithPayments([p1, p2]));
      expect(result.centAmount).toBe(10000 - 1000 - 3000);
    });

    test('throws ErrorInvalidOperation when remaining amount is exactly zero', () => {
      const payment = approvedPayment({
        amountPlanned: { type: 'centPrecision', centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 },
        transactions: [
          {
            id: 'tx-1',
            type: 'Authorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 },
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      });
      expect(() => service.calculateRemainingAmount(cartWithPayments([payment]))).toThrow(ErrorInvalidOperation);
    });

    test('throws ErrorInvalidOperation when remaining amount would be negative', () => {
      vi.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(10001);
      expect(() => service.calculateRemainingAmount(baseCart())).toThrow(ErrorInvalidOperation);
    });
  });

  describe('createPayment - gift card split payment (getAmountToPay)', () => {
    const giftCardPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: {
        paymentMethod: { type: 'giftcard', brand: 'givex' } as Record<string, string>,
        order: { orderData: 'some-order-data', pspReference: 'ORDER-PSP-1' },
      },
    };

    beforeEach(() => {
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
      vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
      vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    });

    test('uses gift card balance as amountPlanned when balance is less than cart amount', async () => {
      // cartAmount = 150000 (mockGetPaymentAmount), balance = 5000 → use 5000
      vi.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard').mockResolvedValue({
        balance: { value: 5000, currency: 'USD' },
        pspReference: 'BALANCE-PSP-1',
        resultCode: BalanceCheckResponse.ResultCodeEnum.Success,
      });

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(giftCardPaymentOpts);

      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 5000, currencyCode: 'USD' }),
        }),
      );
    });

    test('caps amountPlanned at cart amount when gift card balance exceeds remaining cart amount', async () => {
      // cartAmount = 150000 (mockGetPaymentAmount), balance = 200000 → cap at 150000
      vi.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard').mockResolvedValue({
        balance: { value: 200000, currency: 'USD' },
        pspReference: 'BALANCE-PSP-2',
        resultCode: BalanceCheckResponse.ResultCodeEnum.Success,
      });

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(giftCardPaymentOpts);

      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 150000, currencyCode: 'USD' }),
        }),
      );
    });

    test('falls back to cart amount when balance check returns no balance', async () => {
      vi.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard').mockResolvedValue({
        pspReference: 'BALANCE-PSP-3',
        resultCode: BalanceCheckResponse.ResultCodeEnum.NotEnoughBalance,
      } as BalanceCheckResponse);

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(giftCardPaymentOpts);

      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 150000, currencyCode: 'USD' }),
        }),
      );
    });

    test('uses cart amount directly when payment is not a gift card split payment', async () => {
      const cardPaymentOpts: { data: CreatePaymentRequestDTO } = {
        data: { paymentMethod: { type: 'scheme' } as Record<string, string> },
      };

      const balanceSpy = vi.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard');

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(cardPaymentOpts);

      expect(balanceSpy).not.toHaveBeenCalled();
      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 150000 }),
        }),
      );
    });
  });
});
