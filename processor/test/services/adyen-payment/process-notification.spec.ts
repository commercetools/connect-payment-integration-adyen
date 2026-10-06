import { describe, expect, vi, test } from 'vitest';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
import { DefaultRecurringPaymentJobService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-recurring-payment-job.service';
import { mockUpdatePaymentResult } from '../../utils/mock-payment-data';
import { Payment, PaymentMethod } from '@commercetools/connect-payments-sdk';
import { NotificationRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent, setupMockConfig } from './test-setup';

describe('adyen-payment.service - processNotification', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('processNotification', () => {
    test('it should process the notification properly', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([
        mockUpdatePaymentResult,
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      // When
      await paymentService.processNotification({ data: notification });

      // Then
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
        id: '123456',
        pspReference,
        transaction: {
          amount: {
            centAmount: 10000,
            currencyCode: 'EUR',
          },
          interactionId: pspReference,
          state: 'Success',
          type: 'Authorization',
        },
      });
    });

    test('it should process the notification properly in case of a revert operation', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                'modification.action': 'cancel',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.CancelOrRefund,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([
        mockUpdatePaymentResult,
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      // When
      await paymentService.processNotification({ data: notification });

      // Then
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
        id: '123456',
        pspReference,
        transaction: {
          amount: {
            centAmount: 10000,
            currencyCode: 'EUR',
          },
          interactionId: pspReference,
          state: 'Success',
          type: 'CancelAuthorization',
        },
      });
    });

    test('it should create a recurring payment job when an authorization succeeds for a payment made with an existing stored payment method', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      setupMockConfig({ adyenRecurringPaymentsEnabled: true });

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface: 'adyen-payment-interface',
          interfaceAccount: 'adyen-interface-account',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      const updatedPaymentWithToken: Payment = {
        ...mockUpdatePaymentResult,
        customer: { id: 'some-customer-id', typeId: 'customer' },
        paymentMethodInfo: {
          ...mockUpdatePaymentResult.paymentMethodInfo,
          token: { value: 'existing-token-value' },
        },
      };

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([
        mockUpdatePaymentResult,
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatedPaymentWithToken);

      const existingPaymentMethod: PaymentMethod = {
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: { id: 'some-customer-id', typeId: 'customer' },
        paymentInterface: 'adyen-payment-interface',
        interfaceAccount: 'adyen-interface-account',
        method: 'card',
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      };
      const getByTokenValueSpy = vi
        .spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue')
        .mockResolvedValueOnce(existingPaymentMethod);

      const createRecurringPaymentJobSpy = vi
        .spyOn(DefaultRecurringPaymentJobService.prototype, 'createRecurringPaymentJobIfApplicable')
        .mockResolvedValueOnce({
          id: 'recurring-payment-job-id',
          version: 1,
          createdAt: '2024-02-13T00:00:00.000Z',
          lastModifiedAt: '2024-02-13T00:00:00.000Z',
          status: { state: 'Initial' },
        });

      // When
      await paymentService.processNotification({ data: notification });

      // Then
      expect(getByTokenValueSpy).toHaveBeenCalledWith({
        customerId: 'some-customer-id',
        paymentInterface: 'adyen-payment-interface',
        interfaceAccount: 'adyen-interface-account',
        tokenValue: 'existing-token-value',
      });
      expect(createRecurringPaymentJobSpy).toHaveBeenCalledWith({
        originPayment: {
          id: updatedPaymentWithToken.id,
          typeId: 'payment',
        },
        paymentMethod: {
          id: existingPaymentMethod.id,
          typeId: 'payment-method',
        },
      });
    });

    test('it should not look up a payment method when the authorized payment has no stored token', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const pspReference = 'some-psp-reference';
      const paymentMethod = 'visa';
      const notification: NotificationRequestDTO = {
        live: 'false',
        notificationItems: [
          {
            NotificationRequestItem: {
              additionalData: {
                expiryDate: '12/2012',
                authCode: '1234',
                cardSummary: '7777',
              },
              amount: {
                currency: 'EUR',
                value: 10000,
              },
              eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
              eventDate: '2024-06-17T11:37:05+02:00',
              merchantAccountCode: 'MyMerchantAccount',
              merchantReference,
              paymentMethod,
              pspReference,
              success: NotificationRequestItem.SuccessEnum.True,
            },
          },
        ],
      };

      setupMockConfig({ adyenRecurringPaymentsEnabled: true });

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([
        mockUpdatePaymentResult,
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
      const getByTokenValueSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue');

      // When
      await paymentService.processNotification({ data: notification });

      // Then
      expect(getByTokenValueSpy).not.toHaveBeenCalled();
    });
  });
});
