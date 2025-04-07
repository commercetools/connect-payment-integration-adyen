import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultOrderService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-order.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { paymentSDK } from '../../src/payment-sdk';
import { ConfigResponse, ModifyPayment, StatusResponse } from '../../src/services/types/operation.type';
import { mockGetCartResultShippingModeMultiple, mockGetCartResultShippingModeSimple } from '../utils/mock-cart-data';
import { mockGetOrderResult } from '../utils/mock-order-data';
import {
  mockAdyenCancelPaymentResponse,
  mockAdyenCapturePaymentResponse,
  mockAdyenCreatePaymentResponse,
  mockAdyenCreateSessionResponse,
  mockAdyenPaymentMethodsResponse,
  mockAdyenRefundPaymentResponse,
  mockGetPaymentAmount,
  mockGetPaymentResult,
  mockGetPaymentResultKlarnaPayLater,
  mockUpdatePaymentResult,
  mockUpdatePaymentResultKlarnaPayLater,
} from '../utils/mock-payment-data';

import { ModificationsApi } from '@adyen/api-library/lib/src/services/checkout/modificationsApi';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import * as StatusHandler from '@commercetools/connect-payments-sdk/dist/api/handlers/status.handler';
import { MockAgent, setGlobalDispatcher } from 'undici';
import * as Config from '../../src/config/config';
import { AdyenPaymentService, AdyenPaymentServiceOptions } from '../../src/services/adyen-payment.service';

import { HealthCheckResult } from '@commercetools/connect-payments-sdk';
import {
  CreateApplePaySessionRequestDTO,
  CreatePaymentRequestDTO,
  CreateSessionRequestDTO,
  NotificationRequestDTO,
  PaymentMethodsRequestDTO,
} from '../../src/dtos/adyen-payment.dto';
import { SupportedPaymentComponentsSchemaDTO } from '../../src/dtos/operations/payment-componets.dto';

import { ApplePayDetails } from '@adyen/api-library/lib/src/typings/checkout/applePayDetails';
import { CardDetails } from '@adyen/api-library/lib/src/typings/checkout/cardDetails';
import { KlarnaDetails } from '@adyen/api-library/lib/src/typings/checkout/klarnaDetails';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import * as FastifyContext from '../../src/libs/fastify/context/context';

interface FlexibleConfig {
  [key: string]: string; // Adjust the type according to your config values
}

function setupMockConfig(keysAndValues: Record<string, string>) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  jest.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
}

describe('adyen-payment.service', () => {
  const mockAgent = new MockAgent();
  const opts: AdyenPaymentServiceOptions = {
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
    ctOrderService: paymentSDK.ctOrderService,
  };

  const paymentService = new AdyenPaymentService(opts);

  beforeAll(() => {
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    mockAgent.close();
  });

  test('getConfig', async () => {
    // Setup mock config for a system using `clientKey`
    setupMockConfig({ adyenClientKey: 'adyen', adyenEnvironment: 'test' });

    const result: ConfigResponse = await paymentService.config();
    // Assertions can remain the same or be adapted based on the abstracted access
    expect(result?.clientKey).toStrictEqual('adyen');
    expect(result?.environment).toStrictEqual('test');
    expect(result?.applePayConfig?.usesOwnCertificate).toStrictEqual(false);
  });

  test('getSupportedPaymentComponents', async () => {
    const result: SupportedPaymentComponentsSchemaDTO = await paymentService.getSupportedPaymentComponents();
    expect(result?.components).toHaveLength(19);
    expect(result?.components[0]?.type).toStrictEqual('applepay');
    expect(result?.components[1]?.type).toStrictEqual('bancontactcard');
    expect(result?.components[2]?.type).toStrictEqual('bancontactmobile');
    expect(result?.components[3]?.type).toStrictEqual('blik');
    expect(result?.components[4]?.type).toStrictEqual('card');
    expect(result?.components[5]?.type).toStrictEqual('eps');
    expect(result?.components[6]?.type).toStrictEqual('googlepay');
    expect(result?.components[7]?.type).toStrictEqual('ideal');
    expect(result?.components[8]?.type).toStrictEqual('klarna_billie');
    expect(result?.components[9]?.type).toStrictEqual('klarna_pay_later');
    expect(result?.components[10]?.type).toStrictEqual('klarna_pay_now');
    expect(result?.components[11]?.type).toStrictEqual('klarna_pay_overtime');
    expect(result?.components[12]?.type).toStrictEqual('mobilepay');
    expect(result?.components[13]?.type).toStrictEqual('paypal');
    expect(result?.components[14]?.type).toStrictEqual('przelewy24');
    expect(result?.components[15]?.type).toStrictEqual('sepadirectdebit');
    expect(result?.components[16]?.type).toStrictEqual('swish');
    expect(result?.components[17]?.type).toStrictEqual('twint');
    expect(result?.components[18]?.type).toStrictEqual('vipps');
  });

  test('getStatus', async () => {
    const mockHealthCheckFunction: () => Promise<HealthCheckResult> = async () => {
      const result: HealthCheckResult = {
        name: 'CoCo Permissions',
        status: 'DOWN',
        details: {},
        message: 'Invalid permissions',
      };
      return result;
    };

    jest.spyOn(PaymentsApi.prototype, 'paymentMethods').mockResolvedValue(mockAdyenPaymentMethodsResponse);
    jest.spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions').mockReturnValue(mockHealthCheckFunction);
    const result: StatusResponse = await paymentService.status();

    expect(result?.status).toBeDefined();
    expect(result?.checks).toHaveLength(3);
    expect(result?.status).toStrictEqual('Partially Available');
    expect(result?.checks[0]?.name).toStrictEqual('CoCo Permissions');
    expect(result?.checks[0]?.status).toStrictEqual('DOWN');
    expect(result?.checks[0]?.details).toStrictEqual({});
    expect(result?.checks[0]?.message).toStrictEqual('Invalid permissions');
    expect(result?.checks[1]?.name).toStrictEqual('Adyen Status check');
    expect(result?.checks[1]?.status).toStrictEqual('UP');
    expect(result?.checks[1]?.details).toBeDefined();
    expect(result?.checks[2]?.name).toStrictEqual('Adyen Apple Pay config check');
    expect(result?.checks[2]?.status).toStrictEqual('UP');
  });

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

    jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    jest
      .spyOn(ModificationsApi.prototype, 'cancelAuthorisedPaymentByPspReference')
      .mockResolvedValue(mockAdyenCancelPaymentResponse);

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

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
      const mockOrderService = jest.spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId');
      const mockCartService = jest.spyOn(DefaultCartService.prototype, 'getCartByPaymentId');
      const mockAdyenService = jest
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

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      jest
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResultKlarnaPayLater);
      jest.spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId').mockResolvedValue(mockGetOrderResult);
      const mockCartService = jest.spyOn(DefaultCartService.prototype, 'getCartByPaymentId');
      const mockAdyenService = jest
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

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      jest
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResultKlarnaPayLater);
      const mockOrderService = jest
        .spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve order'));
      jest
        .spyOn(DefaultCartService.prototype, 'getCartByPaymentId')
        .mockResolvedValue(mockGetCartResultShippingModeSimple());
      const mockAdyenService = jest
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

      expect(mockOrderService).rejects.toThrow('Could not retrieve order');
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

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      jest
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResultKlarnaPayLater);
      const mockOrderService = jest
        .spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve order'));
      jest
        .spyOn(DefaultCartService.prototype, 'getCartByPaymentId')
        .mockResolvedValue(mockGetCartResultShippingModeMultiple());
      const mockAdyenService = jest
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

      expect(mockOrderService).rejects.toThrow('Could not retrieve order');
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

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResultKlarnaPayLater);
      jest
        .spyOn(DefaultPaymentService.prototype, 'updatePayment')
        .mockResolvedValue(mockUpdatePaymentResultKlarnaPayLater);
      const mockOrderService = jest
        .spyOn(DefaultOrderService.prototype, 'getOrderByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve order'));
      const mockCartService = jest
        .spyOn(DefaultCartService.prototype, 'getCartByPaymentId')
        .mockRejectedValue(new Error('Could not retrieve cart'));
      const mockAdyenService = jest.spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment');

      // Act
      const adyenModifyPaymentCall = paymentService.modifyPayment(modifyPaymentOpts);

      // Expect
      const expectedErrorMessage =
        "The referenced object of type 'cart' '123456' was not found. It either doesn't exist, or it can't be accessed from this endpoint (e.g., if the endpoint filters by store or customer account).";
      expect(adyenModifyPaymentCall).rejects.toThrow(expectedErrorMessage);
      expect(mockOrderService).rejects.toThrow('Could not retrieve order');
      expect(mockCartService).rejects.toThrow('Could not retrieve cart');
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

    jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
    jest.spyOn(ModificationsApi.prototype, 'refundCapturedPayment').mockResolvedValue(mockAdyenRefundPaymentResponse);

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

    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    jest.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    jest.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);

    const result = await adyenPaymentService.createPayment(createPaymentOpts);
    expect(result?.resultCode).toStrictEqual(PaymentResponse.ResultCodeEnum.Received);
    expect(result?.paymentReference).toStrictEqual('123456');
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

    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    jest.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    jest.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
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

    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    jest.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
    jest.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);

    const result = await adyenPaymentService.createPayment(createPaymentOpts);
    expect(result?.resultCode).toStrictEqual(PaymentResponse.ResultCodeEnum.Received);
    expect(result?.paymentReference).toStrictEqual('123456');
  });

  test('getPaymentMethods', async () => {
    const getPaymentMethodsOpts: { data: PaymentMethodsRequestDTO } = {
      data: {},
    };

    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
    jest.spyOn(PaymentsApi.prototype, 'paymentMethods').mockResolvedValue(mockAdyenPaymentMethodsResponse);
    jest.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue(['card']);

    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);
    const result = await adyenPaymentService.getPaymentMethods(getPaymentMethodsOpts);

    expect(result.paymentMethods).toBeDefined();
    expect(result.paymentMethods).toHaveLength(0);
  });

  test('createSession', async () => {
    const createSessionOpts: { data: CreateSessionRequestDTO } = {
      data: {},
    };

    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
    jest.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue(['applepay']);

    jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
    jest.spyOn(FastifyContext, 'getCtSessionIdFromContext').mockReturnValue('123456789');

    jest.spyOn(PaymentsApi.prototype, 'sessions').mockResolvedValue(mockAdyenCreateSessionResponse);

    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);
    const result = await adyenPaymentService.createSession(createSessionOpts);
    expect(result.sessionData).toBeDefined();
    expect(result.paymentReference).toBeDefined();
    expect(result?.sessionData.id).toStrictEqual('12345');
    expect(result?.sessionData.merchantAccount).toStrictEqual('123456');
    expect(result?.sessionData.reference).toStrictEqual('123456');
    expect(result?.sessionData.returnUrl).toStrictEqual('http://127.0.0.1');
    expect(result?.sessionData?.amount.currency).toStrictEqual('USD');
    expect(result?.sessionData?.amount.value).toStrictEqual(150000);
    expect(result?.sessionData.expiresAt).toStrictEqual(new Date('2024-12-31T00:00:00.000Z'));
    expect(result.paymentReference).toStrictEqual('123456');
  });

  describe('createApplePaySession', () => {
    test('it should create a valid Apple Pay session', async () => {
      //Given
      const applePayValidationUrl = 'https://apple-pay-gateway.apple.com/paymentservices/paymentSession';
      const createApplePaySessionRequest: CreateApplePaySessionRequestDTO = {
        validationUrl: applePayValidationUrl,
      };

      const applePayResponse = {
        merchantSessionIdentifier: 'merchantSessionIdentifier',
        merchantIdentifier: 'merchantId',
        domainName: 'mydomain.com',
        displayName: 'test store',
        signature: 'singature',
        pspId: 'pspId',
      };

      const mockPool = mockAgent.get(`https://apple-pay-gateway.apple.com`);
      mockPool
        .intercept({
          path: '/paymentservices/paymentSession',
          method: 'POST',
        })
        .reply(200, applePayResponse);

      //When
      const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);
      const result = await adyenPaymentService.createApplePaySession({
        data: createApplePaySessionRequest,
        agent: mockAgent,
      });

      //Then
      expect(result.merchantSessionIdentifier).toStrictEqual('merchantSessionIdentifier');
      expect(result.merchantIdentifier).toStrictEqual('merchantId');
      expect(result.domainName).toStrictEqual('mydomain.com');
      expect(result.displayName).toStrictEqual('test store');
      expect(result.signature).toStrictEqual('singature');
      expect(result.pspId).toStrictEqual('pspId');
    });

    test('it should return an error when Apple Pay returns a 400', async () => {
      //Given
      const applePayValidationUrl = 'https://apple-pay-gateway.apple.com/paymentservices/paymentSession';
      const createApplePaySessionRequest: CreateApplePaySessionRequestDTO = {
        validationUrl: applePayValidationUrl,
      };

      const applePayResponse = {
        statusMessage: 'bad_request',
      };
      const mockPool = mockAgent.get(`https://apple-pay-gateway.apple.com`);
      mockPool
        .intercept({
          path: '/paymentservices/paymentSession',
          method: 'POST',
        })
        .reply(400, applePayResponse);

      jest.spyOn(FastifyContext, 'getCartIdFromContext').mockReturnValue('abcd');

      //When
      const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);
      const resultPromise = adyenPaymentService.createApplePaySession({
        data: createApplePaySessionRequest,
        agent: mockAgent,
      });

      //Then
      await expect(resultPromise).rejects.toThrow('bad_request');
    });
  });

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

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([mockUpdatePaymentResult]);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

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

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([mockUpdatePaymentResult]);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

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
  });
});
