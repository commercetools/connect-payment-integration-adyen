import { describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultOrderService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-order.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { ModifyPayment } from '../../../src/services/types/operation.type';
import { mockGetCartResultShippingModeMultiple, mockGetCartResultShippingModeSimple } from '../../utils/mock-cart-data';
import { mockGetOrderResult } from '../../utils/mock-order-data';
import {
  mockAdyenCancelPaymentResponse,
  mockAdyenCapturePaymentResponse,
  mockAdyenCreatePaymentResponse,
  mockAdyenRefundPaymentResponse,
  mockGetPaymentAmount,
  mockGetPaymentResult,
  mockGetPaymentResultKlarnaPayLater,
  mockUpdatePaymentResult,
  mockUpdatePaymentResultKlarnaPayLater,
} from '../../utils/mock-payment-data';
import { ModificationsApi } from '@adyen/api-library/lib/src/services/checkout/modificationsApi';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import { Payment } from '@commercetools/connect-payments-sdk';
import { CreatePaymentRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { ApplePayDetails } from '@adyen/api-library/lib/src/typings/checkout/applePayDetails';
import { CardDetails } from '@adyen/api-library/lib/src/typings/checkout/cardDetails';
import { KlarnaDetails } from '@adyen/api-library/lib/src/typings/checkout/klarnaDetails';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { OrdersApi } from '@adyen/api-library/lib/src/services/checkout/ordersApi';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { CancelOrderResponse } from '@adyen/api-library/lib/src/typings/checkout/models';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent } from './test-setup';

describe('adyen-payment.service - modifyPayment', () => {
  setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  test('cancelPayment', async () => {
    const modifyPaymentOpts: ModifyPayment = {
      paymentId: 'dummy-paymentId',
      data: {
        actions: [
          {
            action: 'cancelPayment',
          },
        ],
      },
    };

    vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    vi.spyOn(ModificationsApi.prototype, 'cancelAuthorisedPaymentByPspReference').mockResolvedValue(
      mockAdyenCancelPaymentResponse,
    );

    const result = await paymentService.modifyPayment(modifyPaymentOpts);
    expect(result?.outcome).toStrictEqual('received');
  });

  describe('capturePayment', () => {
    test('capturePayment without lineitems', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 150000,
                currencyCode: 'USD',
              },
            },
          ],
        },
      };

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
      const mockOrderService = vi.spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId');
      const mockCartService = vi.spyOn(DefaultCartService.prototype, 'getCartByPaymentId');
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      const result = await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      const expectedAdyenCapturePayload = {
        amount: { currency: 'USD', value: 150000 },
        lineItems: undefined,
        merchantAccount: 'adyenMerchantAccount',
        reference: '123456',
      };
      expect(mockOrderService).not.toHaveBeenCalled();
      expect(mockCartService).not.toHaveBeenCalled();
      expect(mockAdyenService).toHaveBeenCalledWith('92C12661DS923781G', expectedAdyenCapturePayload);
      expect(result?.outcome).toStrictEqual('received');
    });

    test('capturePayment keeps Payment.interfaceId when it matches the successful authorization', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [{ action: 'capturePayment', amount: { centAmount: 150000, currencyCode: 'USD' } }],
        },
      };
      const authorizations = [
        { state: 'Failure', ref: 'PSPREF_REFUSED' },
        { state: 'Success', ref: 'PSPREF_SUCCESS' },
      ];
      const payment = {
        ...mockGetPaymentResult,
        interfaceId: 'PSPREF_SUCCESS',
        transactions: authorizations.map(({ state, ref }) => ({
          ...mockGetPaymentResult.transactions[0],
          type: 'Authorization',
          state,
          interfaceId: ref,
        })),
      } as typeof mockGetPaymentResult;

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      expect(mockAdyenService).toHaveBeenCalledWith('PSPREF_SUCCESS', expect.anything());
    });

    test('capturePayment uses the successful authorization when Payment.interfaceId points at a refused attempt', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [{ action: 'capturePayment', amount: { centAmount: 150000, currencyCode: 'USD' } }],
        },
      };
      const authorizations = [
        { state: 'Failure', ref: 'PSPREF_REFUSED' },
        { state: 'Success', ref: 'PSPREF_SUCCESS' },
      ];
      const payment = {
        ...mockGetPaymentResult,
        interfaceId: 'PSPREF_REFUSED',
        transactions: authorizations.map(({ state, ref }) => ({
          ...mockGetPaymentResult.transactions[0],
          type: 'Authorization',
          state,
          interfaceId: ref,
        })),
      } as typeof mockGetPaymentResult;

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      expect(mockAdyenService).toHaveBeenCalledWith('PSPREF_SUCCESS', expect.anything());
    });

    test('capturePayment falls back to Payment.interfaceId when there is no successful authorization', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [{ action: 'capturePayment', amount: { centAmount: 150000, currencyCode: 'USD' } }],
        },
      };
      const authorizations = [{ state: 'Failure', ref: 'PSPREF_REFUSED' }];
      const payment = {
        ...mockGetPaymentResult,
        interfaceId: 'PSPREF_REFUSED',
        transactions: authorizations.map(({ state, ref }) => ({
          ...mockGetPaymentResult.transactions[0],
          type: 'Authorization',
          state,
          interfaceId: ref,
        })),
      } as typeof mockGetPaymentResult;

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(payment);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      expect(mockAdyenService).toHaveBeenCalledWith('PSPREF_REFUSED', expect.anything());
    });

    test('capturePayment with lineitems with a order', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 150000,
                currencyCode: 'USD',
              },
            },
          ],
        },
      };

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(
        mockUpdatePaymentResultKlarnaPayLater,
      );
      vi.spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId').mockResolvedValue(mockGetOrderResult);
      const mockCartService = vi.spyOn(DefaultCartService.prototype, 'getCartByPaymentId');
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      const result = await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      const expectedAdyenCapturePayload = {
        amount: { currency: 'USD', value: 150000 },
        lineItems: [
          {
            amountExcludingTax: 7562,
            amountIncludingTax: 8999,
            description: 'Walnut Counter Stool',
            id: 'WCSI-09',
            quantity: 1,
            taxAmount: 1437,
            taxPercentage: 1900,
          },
        ],
        merchantAccount: 'adyenMerchantAccount',
        reference: '123456',
      };
      expect(mockCartService).not.toHaveBeenCalled();
      expect(mockAdyenService).toHaveBeenCalledWith('92C12661DS923781G', expectedAdyenCapturePayload);
      expect(result?.outcome).toStrictEqual('received');
    });

    test('capturePayment with lineitems with a cart', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 150000,
                currencyCode: 'USD',
              },
            },
          ],
        },
      };

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(
        mockUpdatePaymentResultKlarnaPayLater,
      );
      const mockOrderService = vi
        .spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve order'));
      vi.spyOn(DefaultCartService.prototype, 'getCartByPaymentId').mockResolvedValue(
        mockGetCartResultShippingModeSimple(),
      );
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      const result = await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      const expectedAdyenCapturePayload = {
        amount: { currency: 'USD', value: 150000 },
        lineItems: [
          {
            amountExcludingTax: 150000,
            amountIncludingTax: 150000,
            description: 'lineitem-name-1',
            id: 'variant-sku-1',
            quantity: 1,
            taxAmount: 0,
            taxPercentage: 0,
          },
          {
            amountExcludingTax: 150000,
            amountIncludingTax: 150000,
            description: 'customLineItem-name-1',
            id: 'customLineItem-id-1',
            quantity: 1,
            taxAmount: 0,
            taxPercentage: 0,
          },
          {
            amountExcludingTax: 0,
            amountIncludingTax: 0,
            description: 'Shipping - shippingMethodName1',
            quantity: 1,
            taxAmount: 0,
            taxPercentage: 0,
          },
        ],
        merchantAccount: 'adyenMerchantAccount',
        reference: '123456',
      };

      await expect(mockOrderService).rejects.toThrow('Could not retrieve order');
      expect(mockAdyenService).toHaveBeenCalledWith('92C12661DS923781G', expectedAdyenCapturePayload);
      expect(result?.outcome).toStrictEqual('received');
    });

    test('capturePayment with lineitems with a cart which has multiple shipments', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 150000,
                currencyCode: 'USD',
              },
            },
          ],
        },
      };

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(
        mockUpdatePaymentResultKlarnaPayLater,
      );
      const mockOrderService = vi
        .spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve order'));
      vi.spyOn(DefaultCartService.prototype, 'getCartByPaymentId').mockResolvedValue(
        mockGetCartResultShippingModeMultiple(),
      );
      const mockAdyenService = vi
        .spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment')
        .mockResolvedValue(mockAdyenCapturePaymentResponse);

      // Act
      const result = await paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      const expectedAdyenCapturePayload = {
        amount: { currency: 'USD', value: 150000 },
        lineItems: [
          {
            amountExcludingTax: 150000,
            amountIncludingTax: 150000,
            description: 'lineitem-name-1',
            id: 'variant-sku-1',
            quantity: 1,
            taxAmount: 0,
            taxPercentage: 0,
          },
          {
            amountExcludingTax: 150000,
            amountIncludingTax: 150000,
            description: 'customLineItem-name-1',
            id: 'customLineItem-id-1',
            quantity: 1,
            taxAmount: 0,
            taxPercentage: 0,
          },
          {
            amountExcludingTax: 0,
            amountIncludingTax: 0,
            description: 'Shipping - shippingMethodName1',
            quantity: 1,
            taxAmount: 0,
            taxPercentage: 0,
          },
        ],
        merchantAccount: 'adyenMerchantAccount',
        reference: '123456',
      };

      await expect(mockOrderService).rejects.toThrow('Could not retrieve order');
      expect(mockAdyenService).toHaveBeenCalledWith('92C12661DS923781G', expectedAdyenCapturePayload);
      expect(result?.outcome).toStrictEqual('received');
    });

    test('capturePayment should throw an ErrorReferencedResourceNotFound if neither a order nor cart can be found', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 150000,
                currencyCode: 'USD',
              },
            },
          ],
        },
      };

      vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(
        mockUpdatePaymentResultKlarnaPayLater,
      );
      const mockOrderService = vi
        .spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve order'));
      const mockCartService = vi
        .spyOn(DefaultCartService.prototype, 'getCartByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve cart'));
      const mockAdyenService = vi.spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment');

      // Act
      const adyenModifyPaymentCall = paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      const expectedErrorMessage =
        "The referenced object of type 'cart' '123456' was not found. It either doesn't exist, or it can't be accessed from this endpoint (e.g., if the endpoint filters by store or customer account).";
      await expect(adyenModifyPaymentCall).rejects.toThrow(expectedErrorMessage);
      await expect(mockOrderService).rejects.toThrow('Could not retrieve order');
      await expect(mockCartService).rejects.toThrow('Could not retrieve cart');
      expect(mockAdyenService).not.toHaveBeenCalled();
    });
  });

  test('refundPayment', async () => {
    const modifyPaymentOpts: ModifyPayment = {
      paymentId: 'dummy-paymentId',
      data: {
        actions: [
          {
            action: 'refundPayment',
            amount: {
              centAmount: 150000,
              currencyCode: 'USD',
            },
          },
        ],
      },
    };

    vi.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    vi.spyOn(ModificationsApi.prototype, 'refundCapturedPayment').mockResolvedValue(mockAdyenRefundPaymentResponse);

    const result = await paymentService.modifyPayment(modifyPaymentOpts);
    expect(result?.outcome).toStrictEqual('received');
  });

  test('createApplePayPayment', async () => {
    const applePayDetails: ApplePayDetails = {
      applePayToken: '123456789',
      type: ApplePayDetails.TypeEnum.Applepay,
    };
    const createPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: {
        paymentMethod: applePayDetails,
      },
    };

    vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);

    const result = await adyenPaymentService.createPayment(createPaymentOpts);
    expect(result?.resultCode).toStrictEqual(PaymentResponse.ResultCodeEnum.Received);
    expect(result?.paymentReference).toStrictEqual('123456');
  });

  test('createSchemeCardPayment with stored payment method payment', async () => {
    const storedPaymentMethodId = 'stored-payment-method-token-id';
    const cardDetails: CardDetails = {
      type: CardDetails.TypeEnum.Scheme,
      storedPaymentMethodId,
    };
    const createPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: {
        paymentMethod: cardDetails,
      },
    };

    vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);

    const result = await adyenPaymentService.createPayment(createPaymentOpts);

    expect(result?.resultCode).toStrictEqual(PaymentResponse.ResultCodeEnum.Received);
    expect(result?.paymentReference).toStrictEqual('123456');

    expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: '123456',
        paymentMethodInfo: {
          token: {
            value: storedPaymentMethodId,
          },
        },
      }),
    );
  });

  test('createSchemeCardPayment', async () => {
    const cardDetails: CardDetails = {
      type: CardDetails.TypeEnum.Scheme,
    };
    const createPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: {
        paymentMethod: cardDetails,
      },
    };

    vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);

    const result = await adyenPaymentService.createPayment(createPaymentOpts);
    expect(result?.resultCode).toStrictEqual(PaymentResponse.ResultCodeEnum.Received);
    expect(result?.paymentReference).toStrictEqual('123456');
  });

  test('createKlarnaPayment', async () => {
    const klarnaDetails: KlarnaDetails = {
      type: KlarnaDetails.TypeEnum.KlarnaAccount,
    };
    const createPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: {
        paymentMethod: klarnaDetails,
      },
    };

    vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    vi.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    vi.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    vi.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    vi.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    vi.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);

    const result = await adyenPaymentService.createPayment(createPaymentOpts);
    expect(result?.resultCode).toStrictEqual(PaymentResponse.ResultCodeEnum.Received);
    expect(result?.paymentReference).toStrictEqual('123456');
  });

  describe('reversePayment', () => {
    const paymentWithSuccessfulCharge: Payment = {
      ...mockGetPaymentResult,
      transactions: [
        {
          id: 'tx-charge',
          type: 'Charge',
          state: 'Success',
          amount: { type: 'centPrecision', centAmount: 120000, currencyCode: 'GBP', fractionDigits: 2 },
          timestamp: '2024-02-13T00:00:00.000Z',
        },
      ],
    };

    const paymentWithAdyenOrder: Payment = {
      ...paymentWithSuccessfulCharge,
      custom: {
        type: { typeId: 'type', id: 'custom-type-id' },
        fields: { adyenOrderData: 'some-order-data', adyenOrderPspReference: 'ORDER-PSP-123' },
      },
    };

    test('reverses the individual payment via the modification API when there is no Adyen order', async () => {
      // Given
      const updateSpy = vi
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResult);
      const reversalSpy = vi.spyOn(ModificationsApi.prototype, 'refundOrCancelPayment').mockResolvedValue({
        status: 'received' as never,
        pspReference: 'REVERSAL-PSP-789',
        paymentPspReference: paymentWithSuccessfulCharge.interfaceId as string,
        merchantAccount: 'adyenMerchantAccount',
      });
      const cancelOrderSpy = vi.spyOn(OrdersApi.prototype, 'cancelOrder');

      // Act
      const result = await paymentService.reversePayment({ payment: paymentWithSuccessfulCharge });

      // Expect
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(reversalSpy).toHaveBeenCalledWith(
        paymentWithSuccessfulCharge.interfaceId as string,
        expect.objectContaining({ reference: paymentWithSuccessfulCharge.id }),
      );
      expect(result.outcome).toStrictEqual('received');
      expect(result.pspReference).toStrictEqual('REVERSAL-PSP-789');
      expect(updateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            type: 'Refund',
            interactionId: 'REVERSAL-PSP-789',
            interfaceId: 'REVERSAL-PSP-789',
          }),
        }),
      );
    });

    test('cancels the Adyen order instead of reversing the leg when the payment belongs to an Adyen order', async () => {
      // Given
      const updateSpy = vi
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResult);
      const cancelOrderSpy = vi.spyOn(OrdersApi.prototype, 'cancelOrder').mockResolvedValue({
        pspReference: 'CANCEL-REQUEST-PSP-456',
        resultCode: CancelOrderResponse.ResultCodeEnum.Received,
      });
      const reversalSpy = vi.spyOn(ModificationsApi.prototype, 'refundOrCancelPayment');

      // Act
      const result = await paymentService.reversePayment({ payment: paymentWithAdyenOrder });

      // Expect
      expect(reversalSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { orderData: 'some-order-data', pspReference: 'ORDER-PSP-123' },
        }),
      );
      // The transaction must be stamped with the order's own pspReference — not the cancellation
      // request's own pspReference — so it later matches the ORDER_CLOSED webhook.
      expect(result.outcome).toStrictEqual('received');
      expect(result.pspReference).toStrictEqual('ORDER-PSP-123');
      expect(updateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            type: 'Refund',
            interactionId: 'ORDER-PSP-123',
            interfaceId: 'ORDER-PSP-123',
          }),
        }),
      );
    });

    test('uses CancelAuthorization when the Adyen order payment only has a successful Authorization', async () => {
      // Given
      const paymentWithAdyenOrderAuthOnly: Payment = {
        ...paymentWithAdyenOrder,
        transactions: [
          {
            id: 'tx-auth',
            type: 'Authorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 120000, currencyCode: 'GBP', fractionDigits: 2 },
            timestamp: '2024-02-13T00:00:00.000Z',
          },
        ],
      };
      const updateSpy = vi
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResult);
      vi.spyOn(OrdersApi.prototype, 'cancelOrder').mockResolvedValue({
        pspReference: 'CANCEL-REQUEST-PSP-456',
        resultCode: CancelOrderResponse.ResultCodeEnum.Received,
      });

      // Act
      await paymentService.reversePayment({ payment: paymentWithAdyenOrderAuthOnly });

      // Expect
      expect(updateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({ type: 'CancelAuthorization', interactionId: 'ORDER-PSP-123' }),
        }),
      );
    });

    test('throws when there is no successful Charge or Authorization to reverse', async () => {
      // Given
      const paymentWithoutSuccessfulTransaction: Payment = { ...mockGetPaymentResult, transactions: [] };

      // Act & Expect
      await expect(paymentService.reversePayment({ payment: paymentWithoutSuccessfulTransaction })).rejects.toThrow(
        'There is no successful payment transaction to reverse.',
      );
    });
  });
});
