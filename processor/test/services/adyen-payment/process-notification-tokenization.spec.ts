import { describe, expect, vi, test } from 'vitest';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
import { DefaultRecurringPaymentJobService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-recurring-payment-job.service';
import { mockGetPaymentResult } from '../../utils/mock-payment-data';
import { ErrorResourceNotFound, Payment, PaymentMethod } from '@commercetools/connect-payments-sdk';
import { NotificationTokenizationDTO } from '../../../src/dtos/adyen-payment.dto';
import {
  TokenizationCreatedDetailsNotificationRequest,
  TokenizationAlreadyExistingDetailsNotificationRequest,
} from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent, setupMockConfig } from './test-setup';

describe('adyen-payment.service - processNotificationTokenization', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('processNotificationTokenization', () => {
    test('it should process the notification tokenization of type "recurring.token.created" properly', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const shopperReference = 'some-shopper-reference';
      const storedPaymentMethodId = 'abcdefg';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const methodType = 'visapremiumdebit';

      const notification: NotificationTokenizationDTO = {
        createdAt: new Date(),
        environment: TokenizationCreatedDetailsNotificationRequest.EnvironmentEnum.Test,
        eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
        type: TokenizationCreatedDetailsNotificationRequest.TypeEnum.RecurringTokenCreated,
        data: {
          merchantAccount: merchantReference,
          operation: 'operation text description',
          shopperReference: shopperReference,
          storedPaymentMethodId,
          type: methodType,
        },
      };

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: merchantReference,
        shopperReference,
        storedPaymentMethods: [
          {
            id: storedPaymentMethodId,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue').mockRejectedValueOnce(
        new ErrorResourceNotFound(storedPaymentMethodId),
      );

      vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: shopperReference,
          typeId: 'customer',
        },
        paymentInterface,
        interfaceAccount,
        method: 'card',
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      const mockGetPaymentResult: Payment = {
        id: '61d6bf13-aa20-4297-bc22-07e528ca9c37',
        version: 1,
        amountPlanned: {
          type: 'centPrecision',
          currencyCode: 'GBP',
          centAmount: 120000,
          fractionDigits: 2,
        },
        interfaceId: '92C12661DS923781G',
        paymentMethodInfo: {
          method: 'method',
          name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
        },
        paymentStatus: { interfaceText: 'Paid' },
        transactions: [],
        interfaceInteractions: [],
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
      };

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([
        mockGetPaymentResult,
      ]);

      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValueOnce(mockGetPaymentResult);

      const mockCreateRecurringPaymentJob = vi
        .spyOn(DefaultRecurringPaymentJobService.prototype, 'createRecurringPaymentJobIfApplicable')
        .mockResolvedValueOnce(null);

      // When
      await paymentService.processNotificationTokenization({ data: notification });

      // Then
      expect(DefaultPaymentMethodService.prototype.save).toHaveBeenCalledWith({
        customerId: shopperReference,
        method: 'card',
        paymentInterface: 'adyen-payment-interface',
        interfaceAccount: 'adyen-interface-account',
        token: storedPaymentMethodId,
      });

      expect(DefaultPaymentService.prototype.findPaymentsByInterfaceId).toHaveBeenCalledWith({
        interfaceId: notification.eventId,
      });

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
        id: mockGetPaymentResult.id,
        paymentMethodInfo: {
          token: {
            value: notification.data.storedPaymentMethodId,
          },
        },
      });

      // Recurring payment jobs are opt-in via ADYEN_RECURRING_PAYMENTS_ENABLED, disabled by default
      expect(mockCreateRecurringPaymentJob).not.toHaveBeenCalled();
    });

    test('it should create a recurring payment job when ADYEN_RECURRING_PAYMENTS_ENABLED is enabled', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const shopperReference = 'some-shopper-reference';
      const storedPaymentMethodId = 'abcdefg';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const methodType = 'visapremiumdebit';

      const notification: NotificationTokenizationDTO = {
        createdAt: new Date(),
        environment: TokenizationCreatedDetailsNotificationRequest.EnvironmentEnum.Test,
        eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
        type: TokenizationCreatedDetailsNotificationRequest.TypeEnum.RecurringTokenCreated,
        data: {
          merchantAccount: merchantReference,
          operation: 'operation text description',
          shopperReference: shopperReference,
          storedPaymentMethodId,
          type: methodType,
        },
      };

      setupMockConfig({ adyenRecurringPaymentsEnabled: true });

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: merchantReference,
        shopperReference,
        storedPaymentMethods: [
          {
            id: storedPaymentMethodId,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue').mockRejectedValueOnce(
        new ErrorResourceNotFound(storedPaymentMethodId),
      );

      const newlyCreatedPaymentMethod = {
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: shopperReference,
          typeId: 'customer' as const,
        },
        paymentInterface,
        interfaceAccount,
        method: 'card',
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active' as const,
        version: 1,
      };
      vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce(newlyCreatedPaymentMethod);

      const mockGetPaymentResult: Payment = {
        id: '61d6bf13-aa20-4297-bc22-07e528ca9c37',
        version: 1,
        amountPlanned: {
          type: 'centPrecision',
          currencyCode: 'GBP',
          centAmount: 120000,
          fractionDigits: 2,
        },
        interfaceId: '92C12661DS923781G',
        paymentMethodInfo: {
          method: 'method',
          name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
        },
        paymentStatus: { interfaceText: 'Paid' },
        transactions: [],
        interfaceInteractions: [],
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
      };

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([
        mockGetPaymentResult,
      ]);

      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValueOnce(mockGetPaymentResult);

      const mockCreateRecurringPaymentJob = vi
        .spyOn(DefaultRecurringPaymentJobService.prototype, 'createRecurringPaymentJobIfApplicable')
        .mockResolvedValueOnce({
          id: 'recurring-payment-job-id',
          version: 1,
          createdAt: '2024-02-13T00:00:00.000Z',
          lastModifiedAt: '2024-02-13T00:00:00.000Z',
          status: { state: 'Initial' },
        });

      // When
      await paymentService.processNotificationTokenization({ data: notification });

      // Then
      expect(mockCreateRecurringPaymentJob).toHaveBeenCalledWith({
        originPayment: {
          id: mockGetPaymentResult.id,
          typeId: 'payment',
        },
        paymentMethod: {
          id: newlyCreatedPaymentMethod.id,
          typeId: 'payment-method',
        },
      });
    });

    test('it should process the notification tokenization of type "recurring.token.alreadyExisting" properly', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const shopperReference = 'some-shopper-reference';
      const storedPaymentMethodId = 'abcdefg';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const methodType = 'visapremiumdebit';

      const notification: NotificationTokenizationDTO = {
        createdAt: new Date(),
        environment: TokenizationAlreadyExistingDetailsNotificationRequest.EnvironmentEnum.Test,
        eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
        type: TokenizationAlreadyExistingDetailsNotificationRequest.TypeEnum.RecurringTokenAlreadyExisting,
        data: {
          merchantAccount: merchantReference,
          operation: 'operation text description',
          shopperReference: shopperReference,
          storedPaymentMethodId,
          type: methodType,
        },
      };

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: merchantReference,
        shopperReference,
        storedPaymentMethods: [
          {
            id: storedPaymentMethodId,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue').mockRejectedValueOnce(
        new ErrorResourceNotFound(storedPaymentMethodId),
      );

      vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: shopperReference,
          typeId: 'customer',
        },
        paymentInterface,
        interfaceAccount,
        method: 'card',
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      const mockGetPaymentResult: Payment = {
        id: '61d6bf13-aa20-4297-bc22-07e528ca9c37',
        version: 1,
        amountPlanned: {
          type: 'centPrecision',
          currencyCode: 'GBP',
          centAmount: 120000,
          fractionDigits: 2,
        },
        interfaceId: '92C12661DS923781G',
        paymentMethodInfo: {
          method: 'method',
          name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
        },
        paymentStatus: { interfaceText: 'Paid' },
        transactions: [],
        interfaceInteractions: [],
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
      };

      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([
        mockGetPaymentResult,
      ]);

      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValueOnce(mockGetPaymentResult);

      // When
      await paymentService.processNotificationTokenization({ data: notification });

      // Then
      expect(DefaultPaymentMethodService.prototype.save).toHaveBeenCalledWith({
        customerId: shopperReference,
        method: 'card',
        paymentInterface: 'adyen-payment-interface',
        interfaceAccount: 'adyen-interface-account',
        token: storedPaymentMethodId,
      });

      expect(DefaultPaymentService.prototype.findPaymentsByInterfaceId).toHaveBeenCalledWith({
        interfaceId: notification.eventId,
      });

      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
        id: mockGetPaymentResult.id,
        paymentMethodInfo: {
          token: {
            value: notification.data.storedPaymentMethodId,
          },
        },
      });
    });

    test('it should not create a new stored payment-method if an payment-method with the same token already exists for the given customer', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const shopperReference = 'some-shopper-reference';
      const storedPaymentMethodId = 'abcdefg';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const methodType = 'visapremiumdebit';

      const notification: NotificationTokenizationDTO = {
        createdAt: new Date(),
        environment: TokenizationAlreadyExistingDetailsNotificationRequest.EnvironmentEnum.Test,
        eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
        type: TokenizationAlreadyExistingDetailsNotificationRequest.TypeEnum.RecurringTokenAlreadyExisting,
        data: {
          merchantAccount: merchantReference,
          operation: 'operation text description',
          shopperReference: shopperReference,
          storedPaymentMethodId,
          type: methodType,
        },
      };

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: merchantReference,
        shopperReference,
        storedPaymentMethods: [
          {
            id: storedPaymentMethodId,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });

      const existingPaymentMethod: PaymentMethod = {
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: shopperReference,
          typeId: 'customer',
        },
        paymentInterface,
        interfaceAccount,
        method: 'card',
        token: { value: storedPaymentMethodId },
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      };
      vi.spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue').mockResolvedValueOnce(existingPaymentMethod);

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save');

      const mockGetPaymentResult: Payment = {
        id: '61d6bf13-aa20-4297-bc22-07e528ca9c37',
        version: 1,
        amountPlanned: {
          type: 'centPrecision',
          currencyCode: 'GBP',
          centAmount: 120000,
          fractionDigits: 2,
        },
        interfaceId: '92C12661DS923781G',
        paymentMethodInfo: {
          method: 'method',
          name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
        },
        paymentStatus: { interfaceText: 'Paid' },
        transactions: [],
        interfaceInteractions: [],
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
      };
      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([
        mockGetPaymentResult,
      ]);
      const updatePaymentSpy = vi
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValueOnce(mockGetPaymentResult);
      const createRecurringPaymentJobSpy = vi
        .spyOn(DefaultRecurringPaymentJobService.prototype, 'createRecurringPaymentJobIfApplicable')
        .mockResolvedValueOnce(null);

      // When
      await paymentService.processNotificationTokenization({ data: notification });

      // Then
      expect(saveSpy).not.toHaveBeenCalled();
      expect(updatePaymentSpy).toHaveBeenCalledWith({
        id: mockGetPaymentResult.id,
        paymentMethodInfo: {
          token: {
            value: storedPaymentMethodId,
          },
        },
      });
      // Recurring payment jobs are opt-in via ADYEN_RECURRING_PAYMENTS_ENABLED, disabled by default
      expect(createRecurringPaymentJobSpy).not.toHaveBeenCalled();
    });

    test('it should create a recurring payment job when a previously-tokenized payment method is reused and ADYEN_RECURRING_PAYMENTS_ENABLED is enabled', async () => {
      // Given
      const merchantReference = 'some-merchant-reference';
      const shopperReference = 'some-shopper-reference';
      const storedPaymentMethodId = 'abcdefg';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const methodType = 'visapremiumdebit';

      const notification: NotificationTokenizationDTO = {
        createdAt: new Date(),
        environment: TokenizationAlreadyExistingDetailsNotificationRequest.EnvironmentEnum.Test,
        eventId: 'cbaf6264-ee31-40cd-8cd5-00a398cd46d0',
        type: TokenizationAlreadyExistingDetailsNotificationRequest.TypeEnum.RecurringTokenAlreadyExisting,
        data: {
          merchantAccount: merchantReference,
          operation: 'operation text description',
          shopperReference: shopperReference,
          storedPaymentMethodId,
          type: methodType,
        },
      };

      setupMockConfig({ adyenRecurringPaymentsEnabled: true });

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: merchantReference,
        shopperReference,
        storedPaymentMethods: [
          {
            id: storedPaymentMethodId,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });

      const existingPaymentMethod: PaymentMethod = {
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: shopperReference,
          typeId: 'customer',
        },
        paymentInterface,
        interfaceAccount,
        method: 'card',
        token: { value: storedPaymentMethodId },
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      };
      vi.spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue').mockResolvedValueOnce(existingPaymentMethod);

      const mockGetPaymentResult: Payment = {
        id: '61d6bf13-aa20-4297-bc22-07e528ca9c37',
        version: 1,
        amountPlanned: {
          type: 'centPrecision',
          currencyCode: 'GBP',
          centAmount: 120000,
          fractionDigits: 2,
        },
        interfaceId: '92C12661DS923781G',
        paymentMethodInfo: {
          method: 'method',
          name: { 'en-US': 'Debit Card', 'en-GB': 'Debit Card' },
        },
        paymentStatus: { interfaceText: 'Paid' },
        transactions: [],
        interfaceInteractions: [],
        createdAt: '2024-02-13T00:00:00.000Z',
        lastModifiedAt: '2024-02-13T00:00:00.000Z',
      };
      vi.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValueOnce([
        mockGetPaymentResult,
      ]);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValueOnce(mockGetPaymentResult);
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
      await paymentService.processNotificationTokenization({ data: notification });

      // Then
      expect(createRecurringPaymentJobSpy).toHaveBeenCalledWith({
        originPayment: {
          id: mockGetPaymentResult.id,
          typeId: 'payment',
        },
        paymentMethod: {
          id: existingPaymentMethod.id,
          typeId: 'payment-method',
        },
      });
    });
  });
});
