import { describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
import * as Config from '../../../src/config/config';
import { CartRest, TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { Cart, ErrorInternalConstraintViolated, PaymentMethod } from '@commercetools/connect-payments-sdk';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent } from './test-setup';

describe('adyen-payment.service - stored payment methods', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('isStoredPaymentMethodsEnabled', () => {
    test('should return an "false" if the feature flag is disabled', async () => {
      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: false,
        config: {
          paymentInterface: 'paymentInterface',
          interfaceAccount: 'interfaceAccount',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      const result = await paymentService.isStoredPaymentMethodsEnabled();

      expect(result).toStrictEqual(false);
    });

    test('should return an "false" if the feature flag is enabled but no customerId is set on the cart', async () => {
      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface: 'paymentInterface',
          interfaceAccount: 'interfaceAccount',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress', 'customerId'],
        }) as Cart;

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = await paymentService.isStoredPaymentMethodsEnabled();

      expect(result).toStrictEqual(false);
    });

    test('should return an "true" if the feature flag is enabled and the cart has an customerId set', async () => {
      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface: 'paymentInterface',
          interfaceAccount: 'interfaceAccount',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress'],
        }) as Cart;

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = await paymentService.isStoredPaymentMethodsEnabled();

      expect(result).toStrictEqual(true);
    });
  });

  describe('getStoredPaymentMethods', () => {
    test('should throw an "ErrorInternalConstraintViolated" error if no customerId is set on the cart', async () => {
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress', 'customerId'],
        }) as Cart;

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = paymentService.getStoredPaymentMethods();

      const expectedError = new ErrorInternalConstraintViolated('The cart does not have a customerId set.');
      await expect(result).rejects.toThrow(
        expect.objectContaining({ message: expectedError.message, code: expectedError.code }),
      );
    });

    test('should return an empty list if no stored payment methods are stored for the given customerId from the cart', async () => {
      const merchantAccount = 'merchantAccount';
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount,
        shopperReference: customerId,
        storedPaymentMethods: [],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const result = await paymentService.getStoredPaymentMethods();

      expect(result).toStrictEqual({ storedPaymentMethods: [] });
    });

    test('should return a list of mapped stored payment methods', async () => {
      const merchantAccount = 'merchantAccount';
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';

      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const adyenTokenOne = 'adyen-token-value-123';
      const adyenTokenTwo = 'adyen-token-value-456';

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount,
        shopperReference: customerId,
        storedPaymentMethods: [
          {
            id: adyenTokenOne,
            type: methodType,
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
          {
            id: adyenTokenTwo,
            type: methodType,
            lastFour: '5678',
            brand: 'mc',
            expiryMonth: '11',
            expiryYear: '28',
          },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [
          {
            id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
            customer: {
              id: customerId,
              typeId: 'customer',
            },
            token: {
              value: adyenTokenOne,
            },
            paymentInterface,
            interfaceAccount,
            method: 'card',
            createdAt: '',
            lastModifiedAt: '',
            default: false,
            paymentMethodStatus: 'Active',
            version: 1,
          },
          {
            id: '91d31650-04f5-4528-90fc-213c8e38a408',
            customer: {
              id: customerId,
              typeId: 'customer',
            },
            token: {
              value: adyenTokenTwo,
            },
            paymentInterface,
            interfaceAccount,
            method: 'card',
            createdAt: '',
            lastModifiedAt: '',
            default: false,
            paymentMethodStatus: 'Active',
            version: 1,
          },
        ],
      });

      const result = await paymentService.getStoredPaymentMethods();

      expect(result).toStrictEqual({
        storedPaymentMethods: [
          {
            id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
            createdAt: '',
            isDefault: false,
            token: 'adyen-token-value-123',
            type: 'card',
            displayOptions: {
              brand: {
                key: 'Visa',
              },
              endDigits: '1234',
              expiryMonth: 3,
              expiryYear: 30,
            },
          },
          {
            id: '91d31650-04f5-4528-90fc-213c8e38a408',
            createdAt: '',
            isDefault: false,
            token: 'adyen-token-value-456',
            type: 'card',
            displayOptions: {
              brand: {
                key: 'Mastercard',
              },
              endDigits: '5678',
              expiryMonth: 11,
              expiryYear: 28,
            },
          },
        ],
      });
    });

    test('should filter out a stored payment method whose type does not support oneOffPayments', async () => {
      const merchantAccount = 'merchantAccount';
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const adyenToken = 'adyen-token-value-123';

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: false, recurringPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount,
        shopperReference: customerId,
        storedPaymentMethods: [
          {
            id: adyenToken,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [
          {
            id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
            customer: { id: customerId, typeId: 'customer' },
            token: { value: adyenToken },
            paymentInterface,
            interfaceAccount,
            method: 'card',
            createdAt: '',
            lastModifiedAt: '',
            default: false,
            paymentMethodStatus: 'Active',
            version: 1,
          },
        ],
      });

      const result = await paymentService.getStoredPaymentMethods();

      expect(result).toStrictEqual({ storedPaymentMethods: [] });
    });

    test('should include a stored payment method whose type supports oneOffPayments', async () => {
      const merchantAccount = 'merchantAccount';
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';
      const adyenToken = 'adyen-token-value-123';

      vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true, recurringPayments: false },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount,
        shopperReference: customerId,
        storedPaymentMethods: [
          {
            id: adyenToken,
            type: 'scheme',
            lastFour: '1234',
            brand: 'visa',
            expiryMonth: '03',
            expiryYear: '30',
          },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [
          {
            id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
            customer: { id: customerId, typeId: 'customer' },
            token: { value: adyenToken },
            paymentInterface,
            interfaceAccount,
            method: 'card',
            createdAt: '',
            lastModifiedAt: '',
            default: false,
            paymentMethodStatus: 'Active',
            version: 1,
          },
        ],
      });

      const result = await paymentService.getStoredPaymentMethods();

      expect(result).toStrictEqual({
        storedPaymentMethods: [
          {
            id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
            createdAt: '',
            isDefault: false,
            token: adyenToken,
            type: 'card',
            displayOptions: {
              brand: { key: 'Visa' },
              endDigits: '1234',
              expiryMonth: 3,
              expiryYear: 30,
            },
          },
        ],
      });
    });

    test('should create a commercetools payment-method for an orphan Adyen token with default: false, without ever calling update()', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const methodType = 'scheme';
      const existingToken = 'adyen-token-value-existing';
      const orphanToken = 'adyen-token-value-orphan';

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          { id: existingToken, type: methodType, lastFour: '1111', brand: 'visa' },
          { id: orphanToken, type: methodType, lastFour: '2222', brand: 'mc' },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 1,
        limit: 100,
        offset: 0,
        results: [
          {
            id: 'existing-ct-id',
            customer: { id: customerId, typeId: 'customer' },
            token: { value: existingToken },
            method: methodType,
            createdAt: '2023-01-01T00:00:00.000Z',
            lastModifiedAt: '2023-01-01T00:00:00.000Z',
            default: true,
            paymentMethodStatus: 'Active',
            version: 1,
          },
        ],
      });

      const createdOrphan = {
        id: 'new-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: orphanToken },
        method: methodType,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod;

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce(createdOrphan);
      const updateSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'update');

      const result = await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ customerId, token: orphanToken, method: 'card' }));
      expect(updateSpy).not.toHaveBeenCalled();
      expect(result.storedPaymentMethods).toHaveLength(2);
      expect(result.storedPaymentMethods.find((spm) => spm.id === 'new-ct-id')?.isDefault).toStrictEqual(false);
    });

    test('should recover via getByTokenValue when creating the orphan fails because it was concurrently created already', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const methodType = 'scheme';
      const adyenToken = 'adyen-token-value-race';

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [{ id: adyenToken, type: methodType, lastFour: '1234', brand: 'visa' }],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockRejectedValueOnce(
        new ErrorInternalConstraintViolated('A payment method with the same token already exists.'),
      );

      const concurrentlyCreated = {
        id: 'concurrently-created-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: adyenToken },
        method: methodType,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod;

      const getByTokenValueSpy = vi
        .spyOn(DefaultPaymentMethodService.prototype, 'getByTokenValue')
        .mockResolvedValueOnce(concurrentlyCreated);

      const result = await paymentService.getStoredPaymentMethods();

      expect(getByTokenValueSpy).toHaveBeenCalledWith(expect.objectContaining({ customerId, tokenValue: adyenToken }));
      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0].id).toStrictEqual('concurrently-created-id');
    });

    test('should omit an orphan from the response instead of failing the whole request when creating it in CT fails', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const methodType = 'scheme';
      const healthyToken = 'adyen-token-value-healthy';
      const brokenToken = 'adyen-token-value-broken';

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          { id: healthyToken, type: methodType, lastFour: '1234', brand: 'visa' },
          { id: brokenToken, type: methodType, lastFour: '5678', brand: 'mc' },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const createdHealthy = {
        id: 'healthy-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: healthyToken },
        method: methodType,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod;

      vi.spyOn(DefaultPaymentMethodService.prototype, 'save')
        .mockResolvedValueOnce(createdHealthy)
        .mockRejectedValueOnce(new Error('CT is temporarily unavailable'));

      const result = await paymentService.getStoredPaymentMethods();

      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0].id).toStrictEqual('healthy-ct-id');
    });

    test('includes card details custom fields for a "scheme" orphan token when adyenStorePaymentMethodDetailsEnabled is enabled', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const orphanToken = 'adyen-token-value-orphan';

      vi.spyOn(Config, 'getConfig').mockReturnValue({ adyenStorePaymentMethodDetailsEnabled: true } as any);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          { id: orphanToken, type: 'scheme', brand: 'visa', lastFour: '1234', expiryMonth: '03', expiryYear: '30' },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'new-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: orphanToken },
        method: 'card',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod);

      await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customFields: {
            type: { key: 'commercetools-checkout-card-details', typeId: 'type' },
            fields: {
              brand: 'Visa',
              lastFour: '1234',
              expiryMonth: 3,
              expiryYear: 30,
            },
          },
        }),
      );
    });

    test('omits custom fields for a "sepadirectdebit" orphan token even when adyenStorePaymentMethodDetailsEnabled is enabled', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const orphanToken = 'adyen-token-value-orphan-sepa';

      vi.spyOn(Config, 'getConfig').mockReturnValue({ adyenStorePaymentMethodDetailsEnabled: true } as any);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          {
            id: orphanToken,
            type: 'sepadirectdebit',
            brand: 'sepadirectdebit_authcap',
            iban: 'NL98ABNA0410108103',
            ownerName: 'A. Klaasen',
          },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'new-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: orphanToken },
        method: 'sepadirectdebit',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod);

      await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ customFields: undefined }));
    });

    test('omits expiryMonth/expiryYear from custom fields when the "scheme" orphan token does not provide them', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const orphanToken = 'adyen-token-value-orphan';

      vi.spyOn(Config, 'getConfig').mockReturnValue({ adyenStorePaymentMethodDetailsEnabled: true } as any);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [{ id: orphanToken, type: 'scheme', brand: 'visa', lastFour: '1234' }],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'new-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: orphanToken },
        method: 'card',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod);

      await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customFields: {
            type: { key: 'commercetools-checkout-card-details', typeId: 'type' },
            fields: {
              brand: 'Visa',
              lastFour: '1234',
            },
          },
        }),
      );
    });

    test('omits custom fields for a non-"scheme" orphan token even when adyenStorePaymentMethodDetailsEnabled is enabled', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const orphanToken = 'adyen-token-value-orphan';

      vi.spyOn(Config, 'getConfig').mockReturnValue({ adyenStorePaymentMethodDetailsEnabled: true } as any);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [{ id: orphanToken, type: 'paypal' }],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'new-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: orphanToken },
        method: 'paypal',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod);

      await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ customFields: undefined }));
    });

    test('omits custom fields when adyenStorePaymentMethodDetailsEnabled is disabled', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const orphanToken = 'adyen-token-value-orphan';

      vi.spyOn(Config, 'getConfig').mockReturnValue({ adyenStorePaymentMethodDetailsEnabled: false } as any);

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      vi.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          { id: orphanToken, type: 'scheme', brand: 'visa', lastFour: '1234', expiryMonth: '03', expiryYear: '30' },
        ],
      });
      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      const saveSpy = vi.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
        id: 'new-ct-id',
        customer: { id: customerId, typeId: 'customer' },
        token: { value: orphanToken },
        method: 'card',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModifiedAt: '2024-01-01T00:00:00.000Z',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      } as PaymentMethod);

      await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ customFields: undefined }));
    });
  });
});
