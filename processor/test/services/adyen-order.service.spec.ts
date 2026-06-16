import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Cart, Payment } from '@commercetools/connect-payments-sdk';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { paymentSDK } from '../../src/payment-sdk';
import { AdyenOrderService } from '../../src/services/adyen-order.service';
import { mockGetCartResultShippingModeSimple } from '../utils/mock-cart-data';
import { mockGetPaymentAmount, mockGetPaymentResult } from '../utils/mock-payment-data';
import { OrdersApi } from '@adyen/api-library/lib/src/services/checkout/ordersApi';
import { CreateOrderResponse } from '@adyen/api-library/lib/src/typings/checkout/createOrderResponse';
import { CancelOrderResponse } from '@adyen/api-library/lib/src/typings/checkout/cancelOrderResponse';
import * as FastifyContext from '../../src/libs/fastify/context/context';
import { CancelOrderRequestDTO } from '../../src/dtos/adyen-payment.dto';

describe('adyen-order.service', () => {
  const orderService = new AdyenOrderService({
    ctCartService: paymentSDK.ctCartService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createOrder', () => {
    test('should create an Adyen order and return the response', async () => {
      // Arrange
      const cart = mockGetCartResultShippingModeSimple();
      const mockOrderResponse = {
        pspReference: 'ORDER-PSP-123',
        orderData: 'some-order-data',
        remainingAmount: { currency: 'USD', value: 150000 },
        amount: { currency: 'USD', value: 150000 },
        reference: cart.id,
        expiresAt: '2025-01-01T00:00:00.000Z',
        resultCode: CreateOrderResponse.ResultCodeEnum.Success,
      };

      jest.spyOn(FastifyContext, 'getCartIdFromContext').mockReturnValue(cart.id);
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cart);
      jest.spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount').mockResolvedValueOnce(mockGetPaymentAmount);
      jest.spyOn(OrdersApi.prototype, 'orders').mockResolvedValueOnce(mockOrderResponse);

      // Act
      const result = await orderService.createOrder();

      // Assert
      expect(result).toEqual(mockOrderResponse);
      expect(DefaultCartService.prototype.getCart).toHaveBeenCalledWith({ id: cart.id });
      expect(OrdersApi.prototype.orders).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: cart.id,
          amount: {
            currency: mockGetPaymentAmount.currencyCode,
            value: mockGetPaymentAmount.centAmount,
          },
        }),
      );
    });

    test('should wrap Adyen errors and rethrow', async () => {
      // Arrange
      const cart = mockGetCartResultShippingModeSimple();

      jest.spyOn(FastifyContext, 'getCartIdFromContext').mockReturnValue(cart.id);
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cart);
      jest.spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount').mockResolvedValueOnce(mockGetPaymentAmount);
      jest.spyOn(OrdersApi.prototype, 'orders').mockRejectedValueOnce(new Error('Adyen API failure'));

      // Act & Assert
      await expect(orderService.createOrder()).rejects.toThrow();
    });
  });

  describe('cancelOrder', () => {
    test('should cancel an Adyen order and return the response', async () => {
      // Arrange
      const dto: CancelOrderRequestDTO = {
        orderData: 'some-order-data',
        pspReference: 'ORDER-PSP-123',
      };
      const mockCancelResponse = {
        pspReference: 'CANCEL-PSP-456',
        resultCode: CancelOrderResponse.ResultCodeEnum.Received,
      };

      jest.spyOn(OrdersApi.prototype, 'cancelOrder').mockResolvedValueOnce(mockCancelResponse);

      // Act
      const result = await orderService.cancelOrder({ data: dto });

      // Assert
      expect(result).toEqual(mockCancelResponse);
      expect(OrdersApi.prototype.cancelOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          order: {
            orderData: dto.orderData,
            pspReference: dto.pspReference,
          },
        }),
      );
    });

    test('should wrap Adyen errors and rethrow', async () => {
      // Arrange
      const dto: CancelOrderRequestDTO = {
        orderData: 'some-order-data',
        pspReference: 'ORDER-PSP-123',
      };

      jest.spyOn(OrdersApi.prototype, 'cancelOrder').mockRejectedValueOnce(new Error('Adyen API failure'));

      // Act & Assert
      await expect(orderService.cancelOrder({ data: dto })).rejects.toThrow();
    });
  });

  describe('cancelCartActiveOrders', () => {
    const mockCancelResponse = { pspReference: 'CANCEL-PSP', resultCode: CancelOrderResponse.ResultCodeEnum.Received };

    const approvedPaymentWithOrder = (id: string, pspReference: string, orderData: string): Payment => ({
      ...mockGetPaymentResult,
      id,
      transactions: [{ id: `tx-${id}`, type: 'Authorization', state: 'Success', amount: { type: 'centPrecision', centAmount: 5000, currencyCode: 'USD', fractionDigits: 2 }, timestamp: '2024-01-01T00:00:00Z' }],
      custom: { type: { typeId: 'type', id: 'custom-type-id' }, fields: { adyenOrderData: orderData, adyenOrderPspReference: pspReference } },
    });

    const cartWithPayments = (payments: Payment[]): Cart => ({
      ...mockGetCartResultShippingModeSimple(),
      paymentInfo: { payments: payments.map((p) => ({ typeId: 'payment' as const, id: p.id, obj: p })) },
    });

    test('should do nothing when cart has no paymentInfo', async () => {
      const cart = mockGetCartResultShippingModeSimple();
      const cancelSpy = jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(mockCancelResponse);

      await orderService.cancelCartActiveOrders(cart);

      expect(cancelSpy).not.toHaveBeenCalled();
    });

    test('should do nothing when no payment has an active Adyen order', async () => {
      // Approved payment but no adyenOrderData custom field
      const payment: Payment = {
        ...mockGetPaymentResult,
        transactions: [{ id: 'tx-1', type: 'Authorization', state: 'Success', amount: { type: 'centPrecision', centAmount: 5000, currencyCode: 'USD', fractionDigits: 2 }, timestamp: '2024-01-01T00:00:00Z' }],
      };
      const cancelSpy = jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(mockCancelResponse);

      await orderService.cancelCartActiveOrders(cartWithPayments([payment]));

      expect(cancelSpy).not.toHaveBeenCalled();
    });

    test('should do nothing when payments with order data are not approved', async () => {
      // Has adyenOrderData but no successful Authorization
      const payment: Payment = {
        ...mockGetPaymentResult,
        transactions: [],
        custom: { type: { typeId: 'type', id: 'custom-type-id' }, fields: { adyenOrderData: 'order-data', adyenOrderPspReference: 'ORDER-PSP-1' } },
      };
      const cancelSpy = jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(mockCancelResponse);

      await orderService.cancelCartActiveOrders(cartWithPayments([payment]));

      expect(cancelSpy).not.toHaveBeenCalled();
    });

    test('should cancel one active Adyen order', async () => {
      const payment = approvedPaymentWithOrder('payment-1', 'ORDER-PSP-1', 'order-data-1');
      const cancelSpy = jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(mockCancelResponse);

      await orderService.cancelCartActiveOrders(cartWithPayments([payment]));

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(cancelSpy).toHaveBeenCalledWith({ data: { orderData: 'order-data-1', pspReference: 'ORDER-PSP-1' } });
    });

    test('should deduplicate payments that share the same adyenOrderPspReference', async () => {
      const p1 = approvedPaymentWithOrder('payment-1', 'ORDER-PSP-SHARED', 'order-data-1');
      const p2 = approvedPaymentWithOrder('payment-2', 'ORDER-PSP-SHARED', 'order-data-1');
      const cancelSpy = jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(mockCancelResponse);

      await orderService.cancelCartActiveOrders(cartWithPayments([p1, p2]));

      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    test('should cancel each distinct active order independently', async () => {
      const p1 = approvedPaymentWithOrder('payment-1', 'ORDER-PSP-1', 'order-data-1');
      const p2 = approvedPaymentWithOrder('payment-2', 'ORDER-PSP-2', 'order-data-2');
      const cancelSpy = jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(mockCancelResponse);

      await orderService.cancelCartActiveOrders(cartWithPayments([p1, p2]));

      expect(cancelSpy).toHaveBeenCalledTimes(2);
      expect(cancelSpy).toHaveBeenCalledWith({ data: { orderData: 'order-data-1', pspReference: 'ORDER-PSP-1' } });
      expect(cancelSpy).toHaveBeenCalledWith({ data: { orderData: 'order-data-2', pspReference: 'ORDER-PSP-2' } });
    });

    test('should log error and continue when a cancellation fails', async () => {
      const p1 = approvedPaymentWithOrder('payment-1', 'ORDER-PSP-1', 'order-data-1');
      const p2 = approvedPaymentWithOrder('payment-2', 'ORDER-PSP-2', 'order-data-2');
      jest.spyOn(orderService, 'cancelOrder')
        .mockRejectedValueOnce(new Error('Adyen failure'))
        .mockResolvedValueOnce(mockCancelResponse);

      await expect(orderService.cancelCartActiveOrders(cartWithPayments([p1, p2]))).resolves.toBeUndefined();
    });
  });
});
