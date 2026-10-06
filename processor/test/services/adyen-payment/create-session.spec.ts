import { beforeEach, describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { mockGetCartResultShippingModeSimple } from '../../utils/mock-cart-data';
import {
  mockAdyenCreatePaymentResponse,
  mockAdyenCreateSessionResponse,
  mockGetPaymentAmount,
  mockGetPaymentResult,
} from '../../utils/mock-payment-data';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import * as Config from '../../../src/config/config';
import { CreatePaymentRequestDTO, CreateSessionRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { CardDetails } from '@adyen/api-library/lib/src/typings/checkout/cardDetails';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent, setupMockConfig } from './test-setup';

describe('adyen-payment.service - createSession', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('interface interactions', () => {
    const createPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: { paymentMethod: { type: CardDetails.TypeEnum.Scheme } as CardDetails },
    };

    const setupCreatePaymentMocks = () => {
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
      vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
      vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    };

    test('createPayment passes pspInteractions to updatePayment when saveInterfaceInteractions is enabled', async () => {
      // Arrange
      vi.spyOn(Config, 'getConfig').mockReturnValue({
        saveInterfaceInteractions: true,
        adyenMerchantAccount: 'adyenMerchantAccount',
      } as any);
      setupCreatePaymentMocks();

      // Act
      await new AdyenPaymentService(opts).createPayment(createPaymentOpts);

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          pspInteractions: expect.arrayContaining([
            expect.objectContaining({
              type: expect.objectContaining({ key: 'commercetools-checkout-payment-interface-interaction' }),
              fields: expect.objectContaining({ type: 'CreatePayment' }),
            }),
          ]),
        }),
      );
    });

    test('createPayment does not pass pspInteractions to updatePayment when saveInterfaceInteractions is disabled', async () => {
      // Arrange
      vi.spyOn(Config, 'getConfig').mockReturnValue({
        saveInterfaceInteractions: false,
        adyenMerchantAccount: 'adyenMerchantAccount',
      } as any);
      setupCreatePaymentMocks();

      // Act
      await new AdyenPaymentService(opts).createPayment(createPaymentOpts);

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ pspInteractions: undefined }),
      );
    });
  });

  describe('createSession', () => {
    beforeEach(() => {
      vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      vi.spyOn(FastifyContext, 'getCtSessionIdFromContext').mockReturnValue('session-123');
      vi.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue([]);
      vi.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(0);
      vi.spyOn(PaymentsApi.prototype, 'sessions').mockResolvedValue(mockAdyenCreateSessionResponse);
    });

    test('returns session data', async () => {
      const createSessionOpts: { data: CreateSessionRequestDTO } = {
        data: {},
      };

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

      vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue(['applepay']);

      vi.spyOn(FastifyContext, 'getCtSessionIdFromContext').mockReturnValue('123456789');

      const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);
      const result = await adyenPaymentService.createSession(createSessionOpts);
      expect(result.sessionData).toBeDefined();
      expect(result?.sessionData.id).toStrictEqual('12345');
      expect(result?.sessionData.merchantAccount).toStrictEqual('123456');
      expect(result?.sessionData.reference).toStrictEqual('123456');
      expect(result?.sessionData.returnUrl).toStrictEqual('http://127.0.0.1');
      expect(result?.sessionData?.amount.currency).toStrictEqual('USD');
      expect(result?.sessionData?.amount.value).toStrictEqual(150000);
      expect(result?.sessionData.expiresAt).toStrictEqual(new Date('2024-12-31T00:00:00.000Z'));
    });

    test('when adyenPartialPaymentsEnabled is disabled: uses SDK getPlannedPaymentAmount and does not cancel orders', async () => {
      setupMockConfig({});
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      const plannedAmountSpy = vi
        .spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount')
        .mockResolvedValue(mockGetPaymentAmount);
      const cancelSpy = vi.spyOn(opts.orderService, 'cancelCartActiveOrders').mockResolvedValue(undefined);

      const service = new AdyenPaymentService(opts);
      await service.createSession({ data: {} });

      expect(cancelSpy).not.toHaveBeenCalled();
      expect(plannedAmountSpy).toHaveBeenCalled();
    });

    test('when adyenPartialPaymentsEnabled is enabled: cancels active orders and uses calculateRemainingAmount', async () => {
      vi.spyOn(Config, 'getConfig').mockReturnValue({ adyenPartialPaymentsEnabled: true } as any);
      const cartWithExpand = { ...mockGetCartResultShippingModeSimple(), paymentInfo: undefined };
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartWithExpand);
      const plannedAmountSpy = vi
        .spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount')
        .mockResolvedValue(mockGetPaymentAmount);
      const cancelSpy = vi.spyOn(opts.orderService, 'cancelCartActiveOrders').mockResolvedValue(undefined);

      const service = new AdyenPaymentService(opts);
      const calcSpy = vi.spyOn(service, 'calculateRemainingAmount').mockReturnValue(mockGetPaymentAmount);
      await service.createSession({ data: {} });

      expect(cancelSpy).toHaveBeenCalledWith(cartWithExpand);
      expect(calcSpy).toHaveBeenCalledWith(cartWithExpand);
      expect(plannedAmountSpy).not.toHaveBeenCalled();
    });
  });
});
