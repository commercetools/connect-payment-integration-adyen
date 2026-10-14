import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { mockGetCartResultShippingModeSimple } from '../../utils/mock-cart-data';
import {
  mockAdyenCreatePaymentResponse,
  mockGetPaymentAmount,
  mockGetPaymentResult,
  mockUpdatePaymentResult,
} from '../../utils/mock-payment-data';
import { CreatePaymentRequestDTO, NotificationRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import * as Config from '../../../src/config/config';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent } from './test-setup';

const GIFT_CARD_TYPE = { key: 'commercetools-checkout-giftcard-details', typeId: 'type' };

describe('adyen-payment.service - gift card number', () => {
  setupMockAgent();
  const paymentService = new AdyenPaymentService(createPaymentServiceOptions());

  beforeEach(() => {
    vi.spyOn(Config, 'getConfig').mockReturnValue({
      ...Config.getConfig(),
      adyenStorePaymentMethodDetailsEnabled: true,
    });
  });

  describe('createPayment', () => {
    const createOpts: { data: CreatePaymentRequestDTO } = {
      data: { paymentMethod: { type: 'giftcard', brand: 'givex' } as Record<string, string> },
    };

    beforeEach(() => {
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
      vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
      vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
      vi.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(5000);
    });

    test('writes the gift card number from the /payments response (StoredValueID)', async () => {
      vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue({
        ...mockAdyenCreatePaymentResponse,
        resultCode: 'Authorised',
        paymentMethod: { brand: 'givex', type: 'giftcard' },
        additionalData: { cardSummary: '0000', StoredValueID: '6036280000000000000' },
      } as PaymentResponse);

      await paymentService.createPayment(createOpts);

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodInfo: {
            custom: {
              type: GIFT_CARD_TYPE,
              fields: { brand: 'Givex', lastFour: '0000', giftCardNumber: '6036280000000000000' },
            },
          },
        }),
      );
    });

    test('does not write gift card fields when the response carries no number', async () => {
      vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue({
        ...mockAdyenCreatePaymentResponse,
        resultCode: 'Authorised',
        paymentMethod: { brand: 'givex', type: 'giftcard' },
        additionalData: { cardSummary: '0000' },
      } as PaymentResponse);

      await paymentService.createPayment(createOpts);

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.not.objectContaining({ paymentMethodInfo: expect.anything() }),
      );
    });

    test('does not write gift card fields when the feature flag is disabled', async () => {
      vi.spyOn(Config, 'getConfig').mockReturnValue({
        ...Config.getConfig(),
        adyenStorePaymentMethodDetailsEnabled: false,
      });
      vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue({
        ...mockAdyenCreatePaymentResponse,
        resultCode: 'Authorised',
        paymentMethod: { brand: 'givex', type: 'giftcard' },
        additionalData: { cardSummary: '0000', StoredValueID: '6036280000000000000' },
      } as PaymentResponse);

      await paymentService.createPayment(createOpts);

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.not.objectContaining({ paymentMethodInfo: expect.anything() }),
      );
    });
  });

  describe('processNotification', () => {
    const notification: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: { cardSummary: '0000', paymentMethod: 'givex' },
            amount: { currency: 'EUR', value: 5000 },
            eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
            eventDate: '2026-10-14T14:32:05+02:00',
            merchantAccountCode: 'MyMerchantAccount',
            merchantReference: 'some-merchant-reference',
            paymentMethod: 'givex',
            pspReference: 'some-psp-reference',
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    const paymentWithStoredNumber = (giftCardNumber?: string) => ({
      ...mockUpdatePaymentResult,
      paymentMethodInfo: {
        custom: {
          type: { typeId: 'type' as const, id: 'type-id' },
          fields: { brand: 'Givex', lastFour: '0000', ...(giftCardNumber && { giftCardNumber }) },
        },
      },
    });

    test('keeps the stored gift card number when the webhook carries none', async () => {
      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([
        paymentWithStoredNumber('6036280000000000000'),
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      await paymentService.processNotification({ data: notification });

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodInfo: {
            custom: {
              type: GIFT_CARD_TYPE,
              fields: { brand: 'Givex', lastFour: '0000', giftCardNumber: '6036280000000000000' },
            },
          },
        }),
      );
    });

    test('does not add a gift card number when none is stored', async () => {
      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([
        paymentWithStoredNumber(),
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      await paymentService.processNotification({ data: notification });

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodInfo: { custom: { type: GIFT_CARD_TYPE, fields: { brand: 'Givex', lastFour: '0000' } } },
        }),
      );
    });
  });
});
