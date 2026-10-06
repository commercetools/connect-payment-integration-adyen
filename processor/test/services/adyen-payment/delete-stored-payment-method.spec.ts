import { describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
import { CartRest, TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import { Cart, ErrorInternalConstraintViolated } from '@commercetools/connect-payments-sdk';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
import { HttpClientException } from '@adyen/api-library';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent } from './test-setup';

describe('adyen-payment.service - deleteStoredPaymentMethod', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  describe('deleteStoredPaymentMethodViaCart', () => {
    test('should throw an "ErrorInternalConstraintViolated" error if no customerId is set on the cart', async () => {
      const ctPaymentMethodId = '88e7b1e4-eeee-45a9-b9c5-8723e8435d51';
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress', 'customerId'],
        }) as Cart;

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = paymentService.deleteStoredPaymentMethodViaCart(ctPaymentMethodId);

      const expectedError = new ErrorInternalConstraintViolated('The cart does not have a customerId set.');
      await expect(result).rejects.toThrow(
        expect.objectContaining({ message: expectedError.message, code: expectedError.code }),
      );
    });
  });

  describe('deleteStoredPaymentMethod', () => {
    test('should throw an error if the deletion of the payment method in CT fails without calling Adyen to delete the token', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      const ctPaymentMethodId = '7140d787-831f-4b15-bf42-2828e2598aeb';
      const adyenToken = 'adyen-token-value';
      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockImplementationOnce(() => {
        throw new Error('some error thrown during delete');
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      await expect(result).rejects.toThrow(new Error('some error thrown during delete'));
    });

    test('should immediatly stop trying to delete the token in Adyen if the API call returns a 404', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      const ctPaymentMethodId = '7140d787-831f-4b15-bf42-2828e2598aeb';
      const adyenToken = 'adyen-token-value';
      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';

      vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementationOnce(() => {
        throw new HttpClientException({
          message: 'adyen error message',
          responseBody:
            '{"status":404,"errorCode":"000","message":"HTTP Status Response - Not Found","errorType":"security"}',
          errorCode: 'error-code',
          statusCode: 404,
        });
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      expect(() => result).not.toThrow();
    });

    test('should not throw an error if Adyen returns a 401 when trying to delete the token', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';

      const ctPaymentMethodId = '7140d787-831f-4b15-bf42-2828e2598aeb';
      const adyenToken = 'adyen-token-value';
      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';

      vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementationOnce(() => {
        throw new HttpClientException({
          message: 'adyen error message',
          responseBody:
            '{"status":401,"errorCode":"000","message":"HTTP Status Response - Unauthorized","errorType":"security"}',
          errorCode: 'error-code',
          statusCode: 401,
        });
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      expect(() => result).not.toThrow();
    });

    test('should not throw an error if Adyen returns a 403 when trying to delete the token', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';

      const ctPaymentMethodId = '7140d787-831f-4b15-bf42-2828e2598aeb';
      const adyenToken = 'adyen-token-value';
      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';

      vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
        id: 'd85435f2-2628-457f-8b8e-1a567da30a8d',
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementationOnce(() => {
        throw new HttpClientException({
          message: 'adyen error message',
          responseBody:
            '{"status":403,"errorCode":"000","message":"HTTP Status Response - Forbidden","errorType":"security"}',
          errorCode: 'error-code',
          statusCode: 403,
        });
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      expect(() => result).not.toThrow();
    });

    test('should retry up to 3 times trying to delete the token in Adyen afterwhich it will throw the last received error', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';

      const ctPaymentMethodId = '7140d787-831f-4b15-bf42-2828e2598aeb';
      const adyenToken = 'adyen-token-value';
      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';

      vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementation(async () => {
        throw new HttpClientException({
          message: 'adyen error message',
          responseBody:
            '{"status":500,"errorCode":"000","message":"HTTP Status Response - Internal Server Error","errorType":"security"}',
          errorCode: 'error-code',
          statusCode: 500,
        });
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);
      await expect(result).rejects.toThrow(
        expect.objectContaining({
          code: 'AdyenError-000',
          httpErrorStatus: 500,
          message: 'HTTP Status Response - Internal Server Error',
        }),
      );
    });

    test('should succesfully delete the token in CT and Adyen', async () => {
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';

      const ctPaymentMethodId = '7140d787-831f-4b15-bf42-2828e2598aeb';
      const adyenToken = 'adyen-token-value';
      const methodType = 'scheme';
      const paymentInterface = 'adyen-payment-interface';
      const interfaceAccount = 'adyen-interface-account';

      vi.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
        id: ctPaymentMethodId,
        customer: {
          id: customerId,
          typeId: 'customer',
        },
        token: {
          value: adyenToken,
        },
        paymentInterface,
        interfaceAccount,
        method: methodType,
        createdAt: '',
        lastModifiedAt: '',
        default: false,
        paymentMethodStatus: 'Active',
        version: 1,
      });

      vi.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockResolvedValueOnce(undefined);

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      await expect(result).resolves.not.toThrow();
    });
  });
});
