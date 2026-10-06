import { describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
import { mockAdyenCreatePaymentResponse } from '../../utils/mock-payment-data';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import * as Config from '../../../src/config/config';
import { PaymentRest, type TPaymentRest } from '@commercetools/composable-commerce-test-data/payment';
import { CartRest, TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import {
  Cart,
  ErrorInternalConstraintViolated,
  ErrorInvalidField,
  ErrorInvalidOperation,
  ErrorRequiredField,
  Payment,
  PaymentMethod,
} from '@commercetools/connect-payments-sdk';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';
import { TransactionDraftDTO } from '../../../src/dtos/operations/transaction.dto';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent, setupMockConfig } from './test-setup';

describe('adyen-payment.service - handleTransaction', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('handleTransaction', () => {
    const paymentInterface = 'paymentInterface';
    const interfaceAccount = 'interfaceAccount';

    const merchantReference = 'merchantReference';
    const paymentId = '1056e308-de46-4d2f-ae2b-1b2ee9cb9d68';
    const paymentMethodId = '997ff5fb-838b-4978-bf47-37a7de565820';
    const customerId = '0e2a18f3-9f3b-4cef-83ab-6d892c95a0a8';

    const adyenTokenId = 'adyen-token-id-value';

    const idempotencyKey = 'idempotency-key-value';

    const transactionDraft: TransactionDraftDTO = {
      cartId: 'fcd6bbc4-64a9-48b8-918e-bfa60d3d7495',
      checkoutTransactionItemId: 'ee64746c-327c-4732-b1d2-678ded3c760e',
      amount: {
        centAmount: 1199,
        currencyCode: 'EUR',
      },
      futureOrderNumber: 'future-order-number',
      paymentMethodId: 'f3850734-0da8-4c57-8009-2425991c12aa',
      idempotencyKey,
      type: 'Recurring',
    };

    test('it should throw an ErrorInvalidField if the provided "type" value is unsupported', async () => {
      const transactionDraft: TransactionDraftDTO = {
        type: 'UnknownType',
      } as unknown as TransactionDraftDTO;

      await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
        new ErrorInvalidField('type', 'UnknownType', 'Recurring'),
      );
    });

    test('it should throw an ErrorInvalidField if the "type" value is not provided', async () => {
      const transactionDraft: TransactionDraftDTO = {} as unknown as TransactionDraftDTO;

      await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
        new ErrorInvalidField('type', 'not-provided', 'Recurring'),
      );
    });

    describe('Recurring', () => {
      test('it should throw an ErrorInvalidOperation if the StoredPaymentMethods feature is not enabled', async () => {
        await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          new ErrorInvalidOperation(
            'The stored-payment-methods feature is disabled and thus cannot request an transaction using stored-payment-methods',
          ),
        );
      });

      test('it should throw an ErrorInternalConstraintViolated if the provided cart does not have an customerId set', async () => {
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(undefined)
          .buildRest<TCartRest>({}) as Cart;

        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);

        const expectedError = new ErrorInternalConstraintViolated(
          'The cart associated with this transaction does not have a customerId set.',
        );
        await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          expect.objectContaining({ message: expectedError.message, code: expectedError.code }),
        );
      });

      test('it should fall back to the cart amount, skipping currency/amount validation, when the draft does not have an amount set', async () => {
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        const paymentMethod: PaymentMethod = {
          id: paymentMethodId,
          createdAt: '',
          lastModifiedAt: '',
          paymentMethodStatus: 'Active',
          version: 1,
          default: false,
          token: {
            value: adyenTokenId,
          },
        };

        const paymentRandom = PaymentRest.random().id(paymentId).buildRest<TPaymentRest>() as Payment;

        const cartAmount = {
          centAmount: 999,
          currencyCode: 'USD',
          fractionDigits: 2,
        };

        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(cartAmount);
        vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValue(paymentMethod);
        vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(paymentRandom);
        vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(cartRandom);
        vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
          merchantAccount: merchantReference,
          shopperReference: customerId,
          storedPaymentMethods: [
            {
              id: adyenTokenId,
              type: 'scheme',
              lastFour: '1234',
              brand: 'visa',
              expiryMonth: '03',
              expiryYear: '30',
            },
          ],
        });
        vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);
        vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(paymentRandom);

        const transactionDraftWithoutAmount: TransactionDraftDTO = { ...transactionDraft, amount: undefined };

        await paymentService.handleTransaction(transactionDraftWithoutAmount);

        expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amountPlanned: cartAmount,
          }),
        );
      });

      test('it should throw an ErrorInvalidField if the draft amount currency does not match the cart amount currency', async () => {
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue({
          centAmount: transactionDraft.amount!.centAmount,
          currencyCode: 'USD',
          fractionDigits: 2,
        });

        await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          new ErrorInvalidField('amount.currencyCode', transactionDraft.amount!.currencyCode, 'USD'),
        );
      });

      test('it should throw an ErrorInvalidField if the draft amount is greater than the cart amount', async () => {
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue({
          centAmount: transactionDraft.amount!.centAmount - 1,
          currencyCode: transactionDraft.amount!.currencyCode,
          fractionDigits: 2,
        });

        await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          new ErrorInvalidField(
            'amount.centAmount',
            String(transactionDraft.amount!.centAmount),
            `<= ${transactionDraft.amount!.centAmount - 1}`,
          ),
        );
      });

      test('it should throw an ErrorRequiredField if the draft does not have a paymentMethodId set', async () => {
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue({
          centAmount: transactionDraft.amount!.centAmount,
          currencyCode: transactionDraft.amount!.currencyCode,
          fractionDigits: 2,
        });

        const transactionDraftWithoutPaymentMethodId: TransactionDraftDTO = {
          ...transactionDraft,
          paymentMethodId: undefined,
        };

        const expectedError = new ErrorRequiredField('paymentMethodId');
        await expect(paymentService.handleTransaction(transactionDraftWithoutPaymentMethodId)).rejects.toThrow(
          expect.objectContaining({ message: expectedError.message, code: expectedError.code }),
        );
      });

      test('it should throw an ErrorRequiredField if the paymentMethod referenced does not have an token value set', async () => {
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        const paymentMethod: PaymentMethod = {
          id: paymentMethodId,
          createdAt: '',
          lastModifiedAt: '',
          paymentMethodStatus: 'Active',
          version: 1,
          default: false,
        };

        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue({
          centAmount: transactionDraft.amount!.centAmount,
          currencyCode: transactionDraft.amount!.currencyCode,
          fractionDigits: 2,
        });
        vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValue(paymentMethod);

        const expectedError = new ErrorInternalConstraintViolated(
          'The referenced payment method does not have a token set.',
        );
        await expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          expect.objectContaining({ message: expectedError.message, code: expectedError.code }),
        );
      });

      test('it should handle the "Recurring" transaction draft type', async () => {
        // Arrange
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

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        const paymentMethod: PaymentMethod = {
          id: paymentMethodId,
          createdAt: '',
          lastModifiedAt: '',
          paymentMethodStatus: 'Active',
          version: 1,
          default: false,
          token: {
            value: adyenTokenId,
          },
          method: 'card',
        };

        const paymentRandom = PaymentRest.random().id(paymentId).buildRest<TPaymentRest>() as Payment;

        vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
        vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue({
          centAmount: transactionDraft.amount!.centAmount,
          currencyCode: transactionDraft.amount!.currencyCode,
          fractionDigits: 2,
        });
        vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValue(paymentMethod);

        vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(paymentRandom);
        vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue({
          ...cartRandom,
          paymentInfo: {
            payments: [
              {
                id: paymentId,
                typeId: 'payment',
              },
            ],
          },
        });

        vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
          merchantAccount: merchantReference,
          shopperReference: customerId,
          storedPaymentMethods: [
            {
              id: adyenTokenId,
              type: 'scheme',
              lastFour: '1234',
              brand: 'visa',
              expiryMonth: '03',
              expiryYear: '30',
            },
          ],
        });
        vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

        vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(paymentRandom);

        // Process
        const result = await paymentService.handleTransaction(transactionDraft);

        // Assert
        expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith({
          amountPlanned: {
            centAmount: transactionDraft.amount!.centAmount,
            currencyCode: transactionDraft.amount!.currencyCode,
          },
          checkoutTransactionItemId: transactionDraft.checkoutTransactionItemId,
          paymentMethodInfo: {
            paymentInterface: Config.getConfig().paymentInterface,
            token: {
              value: adyenTokenId,
            },
            method: 'card',
          },
          customer: {
            typeId: 'customer',
            id: customerId,
          },
        });

        expect(PaymentsApi.prototype.payments).toHaveBeenCalledWith(expect.anything(), { idempotencyKey });

        expect(DefaultCartService.prototype.addPayment).toHaveBeenCalledWith({
          resource: {
            id: cartRandom.id,
            version: cartRandom.version,
          },
          paymentId: paymentId,
        });

        expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith({
          id: paymentId,
          pspReference: mockAdyenCreatePaymentResponse.pspReference,
          transaction: {
            amount: {
              centAmount: transactionDraft.amount!.centAmount,
              currencyCode: transactionDraft.amount!.currencyCode,
            },
            type: 'Authorization',
            state: 'Pending',
            interactionId: mockAdyenCreatePaymentResponse.pspReference,
            interfaceId: mockAdyenCreatePaymentResponse.pspReference,
          },
        });

        expect(result).toStrictEqual({
          transactionStatus: {
            errors: [],
            state: 'Pending',
          },
          paymentId,
        });
      });
    });
  });
});
