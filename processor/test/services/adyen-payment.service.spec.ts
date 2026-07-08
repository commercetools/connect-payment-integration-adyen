import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultOrderService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-order.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { DefaultPaymentMethodService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment-method.service';
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
import { AdyenOrderService } from '../../src/services/adyen-order.service';

import { PaymentRest, type TPaymentRest } from '@commercetools/composable-commerce-test-data/payment';
import { CartRest, TCartRest } from '@commercetools/composable-commerce-test-data/cart';
import {
  Cart,
  ErrorInternalConstraintViolated,
  ErrorInvalidField,
  ErrorInvalidOperation,
  ErrorRequiredField,
  Errorx,
  HealthCheckResult,
  Payment,
  PaymentMethod,
} from '@commercetools/connect-payments-sdk';
import {
  CreateApplePaySessionRequestDTO,
  CreatePaymentRequestDTO,
  CreateSessionRequestDTO,
  NotificationRequestDTO,
  NotificationTokenizationDTO,
  PaymentMethodsRequestDTO,
} from '../../src/dtos/adyen-payment.dto';
import { SupportedPaymentComponentsSchemaDTO } from '../../src/dtos/operations/payment-componets.dto';

import { ApplePayDetails } from '@adyen/api-library/lib/src/typings/checkout/applePayDetails';
import { CardDetails } from '@adyen/api-library/lib/src/typings/checkout/cardDetails';
import { KlarnaDetails } from '@adyen/api-library/lib/src/typings/checkout/klarnaDetails';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import {
  TokenizationCreatedDetailsNotificationRequest,
  TokenizationAlreadyExistingDetailsNotificationRequest,
} from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';
import { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
import { OrdersApi } from '@adyen/api-library/lib/src/services/checkout/ordersApi';

import * as FastifyContext from '../../src/libs/fastify/context/context';
import { StoredPaymentMethod } from '../../src/dtos/stored-payment-methods.dto';
import * as StoredPaymentMethodsConfig from '../../src/config/stored-payment-methods.config';
import { HttpClientException } from '@adyen/api-library';
import { TransactionDraftDTO } from '../../src/dtos/operations/transaction.dto';

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
    ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
    orderService: new AdyenOrderService({ ctCartService: paymentSDK.ctCartService }),
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
    jest.spyOn(AdyenPaymentService.prototype, 'getStoredPaymentMethods').mockResolvedValueOnce({
      storedPaymentMethods: [{ token: 'sometokenidvaluefromadyen' } as StoredPaymentMethod],
    });

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
    expect(result?.components).toHaveLength(27);
    expect(result?.components[0]?.type).toStrictEqual('afterpay');
    expect(result?.components[1]?.type).toStrictEqual('alipay');
    expect(result?.components[2]?.type).toStrictEqual('applepay');
    expect(result?.components[3]?.type).toStrictEqual('bancontactcard');
    expect(result?.components[4]?.type).toStrictEqual('bancontactmobile');
    expect(result?.components[5]?.type).toStrictEqual('blik');
    expect(result?.components[6]?.type).toStrictEqual('card');
    expect(result?.components[7]?.type).toStrictEqual('eps');
    expect(result?.components[8]?.type).toStrictEqual('fpx');
    expect(result?.components[9]?.type).toStrictEqual('googlepay');
    expect(result?.components[10]?.type).toStrictEqual('ideal');
    expect(result?.components[11]?.type).toStrictEqual('klarna_billie');
    expect(result?.components[12]?.type).toStrictEqual('klarna_pay_later');
    expect(result?.components[13]?.type).toStrictEqual('klarna_pay_now');
    expect(result?.components[14]?.type).toStrictEqual('klarna_pay_overtime');
    expect(result?.components[15]?.type).toStrictEqual('mobilepay');
    expect(result?.components[16]?.type).toStrictEqual('paypal');
    expect(result?.components[17]?.type).toStrictEqual('przelewy24');
    expect(result?.components[18]?.type).toStrictEqual('sepadirectdebit');
    expect(result?.components[19]?.type).toStrictEqual('swish');
    expect(result?.components[20]?.type).toStrictEqual('twint');
    expect(result?.components[21]?.type).toStrictEqual('vipps');
    expect(result?.components[22]?.type).toStrictEqual('clearpay');
    expect(result?.components[23]?.type).toStrictEqual('mbway');
    expect(result?.components[24]?.type).toStrictEqual('trustly');
    expect(result?.components[25]?.type).toStrictEqual('wechatpay');
    expect(result?.components[26]?.type).toStrictEqual('zip');
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

  describe('interface interactions', () => {
    const createPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: { paymentMethod: { type: CardDetails.TypeEnum.Scheme } as CardDetails },
    };

    const setupCreatePaymentMocks = () => {
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
      jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      jest.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
      jest.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    };

    test('createPayment passes pspInteractions to updatePayment when saveInterfaceInteractions is enabled', async () => {
      // Arrange
      jest
        .spyOn(Config, 'getConfig')
        .mockReturnValue({ saveInterfaceInteractions: true, adyenMerchantAccount: 'adyenMerchantAccount' } as any);
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
      jest
        .spyOn(Config, 'getConfig')
        .mockReturnValue({ saveInterfaceInteractions: false, adyenMerchantAccount: 'adyenMerchantAccount' } as any);
      setupCreatePaymentMocks();

      // Act
      await new AdyenPaymentService(opts).createPayment(createPaymentOpts);

      // Assert
      expect(DefaultPaymentService.prototype.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ pspInteractions: undefined }),
      );
    });
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

  describe('createSession', () => {
    beforeEach(() => {
      jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      jest.spyOn(FastifyContext, 'getCtSessionIdFromContext').mockReturnValue('session-123');
      jest.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue([]);
      jest.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(0);
      jest.spyOn(PaymentsApi.prototype, 'sessions').mockResolvedValue(mockAdyenCreateSessionResponse);
    });

    test('returns session data', async () => {
      const createSessionOpts: { data: CreateSessionRequestDTO } = {
        data: {},
      };

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

      jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      jest.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue(['applepay']);

      jest.spyOn(FastifyContext, 'getCtSessionIdFromContext').mockReturnValue('123456789');

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
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      const plannedAmountSpy = jest
        .spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount')
        .mockResolvedValue(mockGetPaymentAmount);
      const cancelSpy = jest.spyOn(opts.orderService, 'cancelCartActiveOrders').mockResolvedValue(undefined);

      const service = new AdyenPaymentService(opts);
      await service.createSession({ data: {} });

      expect(cancelSpy).not.toHaveBeenCalled();
      expect(plannedAmountSpy).toHaveBeenCalled();
    });

    test('when adyenPartialPaymentsEnabled is enabled: cancels active orders and uses calculateRemainingAmount', async () => {
      jest.spyOn(Config, 'getConfig').mockReturnValue({ adyenPartialPaymentsEnabled: true } as any);
      const cartWithExpand = { ...mockGetCartResultShippingModeSimple(), paymentInfo: undefined };
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartWithExpand);
      const plannedAmountSpy = jest
        .spyOn(DefaultCartService.prototype, 'getPlannedPaymentAmount')
        .mockResolvedValue(mockGetPaymentAmount);
      const cancelSpy = jest.spyOn(opts.orderService, 'cancelCartActiveOrders').mockResolvedValue(undefined);

      const service = new AdyenPaymentService(opts);
      const calcSpy = jest.spyOn(service, 'calculateRemainingAmount').mockReturnValue(mockGetPaymentAmount);
      await service.createSession({ data: {} });

      expect(cancelSpy).toHaveBeenCalledWith(cartWithExpand);
      expect(calcSpy).toHaveBeenCalledWith(cartWithExpand);
      expect(plannedAmountSpy).not.toHaveBeenCalled();
    });
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

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'doesTokenBelongsToCustomer').mockResolvedValueOnce(false);

      jest.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
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

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValueOnce([mockGetPaymentResult]);

      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValueOnce(mockGetPaymentResult);

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

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'doesTokenBelongsToCustomer').mockResolvedValueOnce(false);

      jest.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce({
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

      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValueOnce([mockGetPaymentResult]);

      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValueOnce(mockGetPaymentResult);

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

      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface,
          interfaceAccount,
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'doesTokenBelongsToCustomer').mockResolvedValueOnce(true);

      jest.spyOn(DefaultPaymentMethodService.prototype, 'save').mockImplementationOnce(async () => {
        return {} as PaymentMethod;
      });

      // When
      await paymentService.processNotificationTokenization({ data: notification });

      // Then
      expect(DefaultPaymentMethodService.prototype.save).not.toHaveBeenCalled();
    });
  });

  describe('isStoredPaymentMethodsEnabled', () => {
    test('should return an "false" if the feature flag is disabled', async () => {
      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: false,
        config: {
          paymentInterface: 'paymentInterface',
          interfaceAccount: 'interfaceAccount',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const result = await paymentService.isStoredPaymentMethodsEnabled();

      expect(result).toStrictEqual(false);
    });

    test('should return an "false" if the feature flag is enabled but no customerId is set on the cart', async () => {
      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface: 'paymentInterface',
          interfaceAccount: 'interfaceAccount',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress', 'customerId'],
        }) as Cart;

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = await paymentService.isStoredPaymentMethodsEnabled();

      expect(result).toStrictEqual(false);
    });

    test('should return an "true" if the feature flag is enabled and the cart has an customerId set', async () => {
      jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
        enabled: true,
        config: {
          paymentInterface: 'paymentInterface',
          interfaceAccount: 'interfaceAccount',
          supportedPaymentMethodTypes: {
            scheme: { oneOffPayments: true },
          },
        },
      });

      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress'],
        }) as Cart;

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = await paymentService.isStoredPaymentMethodsEnabled();

      expect(result).toStrictEqual(true);
    });
  });

  describe('getStoredPaymentMethods', () => {
    test('should throw an "ErrorRequiredField" error if no customerId is set on the cart', async () => {
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress', 'customerId'],
        }) as Cart;

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = paymentService.getStoredPaymentMethods();

      expect(result).rejects.toThrow(new ErrorRequiredField('customerId'));
    });

    test('should return an empty list if no stored payment methods are stored for the given customerId from the cart', async () => {
      const merchantAccount = 'merchantAccount';
      const customerId = '12303506-396c-4163-9193-11115c10fc2e';
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .customerId(customerId)
        .buildRest<TCartRest>({}) as Cart;

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount,
        shopperReference: customerId,
        storedPaymentMethods: [],
      });
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
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
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          { id: existingToken, type: methodType, lastFour: '1111', brand: 'visa' },
          { id: orphanToken, type: methodType, lastFour: '2222', brand: 'mc' },
        ],
      });
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
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

      const saveSpy = jest.spyOn(DefaultPaymentMethodService.prototype, 'save').mockResolvedValueOnce(createdOrphan);
      const updateSpy = jest.spyOn(DefaultPaymentMethodService.prototype, 'update');

      const result = await paymentService.getStoredPaymentMethods();

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ customerId, token: orphanToken, method: methodType }),
      );
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

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [{ id: adyenToken, type: methodType, lastFour: '1234', brand: 'visa' }],
      });
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
        count: 0,
        limit: 100,
        offset: 0,
        results: [],
      });

      jest
        .spyOn(DefaultPaymentMethodService.prototype, 'save')
        .mockRejectedValueOnce(
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

      const getByTokenValueSpy = jest
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

      jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
        merchantAccount: 'merchantAccount',
        shopperReference: customerId,
        storedPaymentMethods: [
          { id: healthyToken, type: methodType, lastFour: '1234', brand: 'visa' },
          { id: brokenToken, type: methodType, lastFour: '5678', brand: 'mc' },
        ],
      });
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'find').mockResolvedValueOnce({
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

      jest
        .spyOn(DefaultPaymentMethodService.prototype, 'save')
        .mockResolvedValueOnce(createdHealthy)
        .mockRejectedValueOnce(new Error('CT is temporarily unavailable'));

      const result = await paymentService.getStoredPaymentMethods();

      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0].id).toStrictEqual('healthy-ct-id');
    });
  });

  describe('deleteStoredPaymentMethodViaCart', () => {
    test('should throw an "ErrorRequiredField" error if no customerId is set on the cart', async () => {
      const ctPaymentMethodId = '88e7b1e4-eeee-45a9-b9c5-8723e8435d51';
      const cartRandom = CartRest.random()
        .lineItems([])
        .customLineItems([])
        .buildRest<TCartRest>({
          omitFields: ['billingAddress', 'shippingAddress', 'customerId'],
        }) as Cart;

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);

      const result = paymentService.deleteStoredPaymentMethodViaCart(ctPaymentMethodId);

      expect(result).rejects.toThrow(new ErrorRequiredField('customerId'));
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

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockImplementationOnce(() => {
        throw new Error('some error thrown during delete');
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      expect(result).rejects.toThrow(new Error('some error thrown during delete'));
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

      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValueOnce(cartRandom);
      jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementationOnce(() => {
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementationOnce(() => {
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementationOnce(() => {
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockImplementation(async () => {
        throw new HttpClientException({
          message: 'adyen error message',
          responseBody:
            '{"status":500,"errorCode":"000","message":"HTTP Status Response - Internal Server Error","errorType":"security"}',
          errorCode: 'error-code',
          statusCode: 500,
        });
      });

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);
      expect(result).rejects.toThrow(
        new Errorx({
          cause: {
            errorCode: 'error-code',
            message: 'adyen error message',
            name: 'HttpClientException',
            responseBody:
              '{"status":500,"errorCode":"000","message":"HTTP Status Response - Internal Server Error","errorType":"security"}',
            statusCode: 500,
          },
          code: 'AdyenError-000',
          fields: undefined,
          httpErrorStatus: 500,
          message: 'HTTP Status Response - Internal Server Error',
          privateFields: undefined,
          privateMessage: undefined,
          skipLog: undefined,
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValueOnce({
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

      jest.spyOn(DefaultPaymentMethodService.prototype, 'delete').mockResolvedValueOnce({
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

      jest.spyOn(RecurringApi.prototype, 'deleteTokenForStoredPaymentDetails').mockResolvedValueOnce(undefined);

      const result = paymentService.deleteStoredPaymentMethod(ctPaymentMethodId, customerId);

      expect(result).resolves.not.toThrow();
    });
  });

  describe('handleTransaction', () => {
    const paymentInterface = 'paymentInterface';
    const interfaceAccount = 'interfaceAccount';

    const merchantReference = 'merchantReference';
    const paymentId = '1056e308-de46-4d2f-ae2b-1b2ee9cb9d68';
    const paymentMethodId = '997ff5fb-838b-4978-bf47-37a7de565820';
    const customerId = '0e2a18f3-9f3b-4cef-83ab-6d892c95a0a8';

    const adyenTokenId = 'adyen-token-id-value';

    const transactionDraft: TransactionDraftDTO = {
      cartId: 'fcd6bbc4-64a9-48b8-918e-bfa60d3d7495',
      checkoutTransactionItemId: 'ee64746c-327c-4732-b1d2-678ded3c760e',
      paymentInterface: 'ee64746c-327c-4732-b1d2-678ded3c760e',
      amount: {
        centAmount: 1199,
        currencyCode: 'EUR',
      },
      futureOrderNumber: 'future-order-number',
      paymentMethod: {
        id: 'f3850734-0da8-4c57-8009-2425991c12aa',
      },
      type: 'Recurring',
    };

    test('it should throw an ErrorInvalidField if the provided "type" value is unsupported', async () => {
      const transactionDraft: TransactionDraftDTO = {
        type: 'UnknownType',
      } as unknown as TransactionDraftDTO;

      expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
        new ErrorInvalidField('type', 'UnknownType', 'Recurring'),
      );
    });

    test('it should throw an ErrorInvalidField if the "type" value is not provided', async () => {
      const transactionDraft: TransactionDraftDTO = {} as unknown as TransactionDraftDTO;

      expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
        new ErrorInvalidField('type', 'not-provided', 'Recurring'),
      );
    });

    describe('Recurring', () => {
      test('it should throw an ErrorInvalidOperation if the StoredPaymentMethods feature is not enabled', async () => {
        expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          new ErrorInvalidOperation(
            'The stored-payment-methods feature is disabled and thus cannot request an transaction using stored-payment-methods',
          ),
        );
      });

      test('it should throw an ErrorRequiredField if the provided cart does not have an customerId set', async () => {
        jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
          enabled: true,
          config: {
            paymentInterface,
            interfaceAccount,
            supportedPaymentMethodTypes: {
              scheme: { oneOffPayments: true },
            },
          },
        });

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(undefined)
          .buildRest<TCartRest>({}) as Cart;

        jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);

        expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(
          new ErrorRequiredField('customerId'),
        );
      });

      test('it should throw an ErrorRequiredField if the no paymentMethod reference is provided', async () => {
        jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
          enabled: true,
          config: {
            paymentInterface,
            interfaceAccount,
            supportedPaymentMethodTypes: {
              scheme: { oneOffPayments: true },
            },
          },
        });

        const cartRandom = CartRest.random()
          .origin('RecurringOrder')
          .lineItems([])
          .customLineItems([])
          .customerId(customerId)
          .buildRest<TCartRest>({}) as Cart;

        jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);

        const transactionDraftWithoutPaymentMethod: TransactionDraftDTO = {
          ...transactionDraft,
          paymentMethod: undefined,
        };

        expect(paymentService.handleTransaction(transactionDraftWithoutPaymentMethod)).rejects.toThrow(
          new ErrorRequiredField('paymentMethod'),
        );
      });

      test('it should throw an ErrorRequiredField if the paymentMethod referenced does not have an token value set', async () => {
        jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
          enabled: true,
          config: {
            paymentInterface,
            interfaceAccount,
            supportedPaymentMethodTypes: {
              scheme: { oneOffPayments: true },
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

        jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValue(paymentMethod);

        expect(paymentService.handleTransaction(transactionDraft)).rejects.toThrow(new ErrorRequiredField('token'));
      });

      test('it should handle the "Recurring" transaction draft type', async () => {
        // Arrange
        jest.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
          enabled: true,
          config: {
            paymentInterface,
            interfaceAccount,
            supportedPaymentMethodTypes: {
              scheme: { oneOffPayments: true },
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

        jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
        jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(cartRandom);
        jest.spyOn(DefaultPaymentMethodService.prototype, 'get').mockResolvedValue(paymentMethod);

        jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(paymentRandom);
        jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue({
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

        jest.spyOn(RecurringApi.prototype, 'getTokensForStoredPaymentDetails').mockResolvedValueOnce({
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
        jest.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);

        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(paymentRandom);

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
            paymentInterface: transactionDraft.paymentInterface,
            token: {
              value: adyenTokenId,
            },
            method: 'scheme',
          },
          customer: {
            typeId: 'customer',
            id: customerId,
          },
        });

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
        });
      });
    });
  });

  describe('calculateRemainingAmount', () => {
    const service = new AdyenPaymentService(opts);

    const baseCart = () => ({
      ...mockGetCartResultShippingModeSimple(),
      totalPrice: { type: 'centPrecision' as const, centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 },
    });

    const approvedPayment = (overrides: Partial<Payment> = {}): Payment => ({
      ...mockGetPaymentResult,
      id: 'payment-1',
      amountPlanned: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
      transactions: [
        {
          id: 'tx-1',
          type: 'Authorization',
          state: 'Success',
          amount: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
          timestamp: '2024-01-01T00:00:00Z',
        },
      ],
      ...overrides,
    });

    const cartWithPayments = (payments: Payment[]): Cart => ({
      ...baseCart(),
      paymentInfo: { payments: payments.map((p) => ({ typeId: 'payment' as const, id: p.id, obj: p })) },
    });

    beforeEach(() => {
      jest.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(0);
    });

    test('returns full totalPrice when cart has no payments', () => {
      const result = service.calculateRemainingAmount(baseCart());
      expect(result).toEqual({ centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 });
    });

    test('uses taxedPrice.totalGross when available instead of totalPrice', () => {
      const cart: Cart = {
        ...baseCart(),
        taxedPrice: {
          totalNet: { type: 'centPrecision', centAmount: 8000, currencyCode: 'USD', fractionDigits: 2 },
          totalGross: { type: 'centPrecision', centAmount: 9600, currencyCode: 'USD', fractionDigits: 2 },
          taxPortions: [],
        },
      };
      const result = service.calculateRemainingAmount(cart);
      expect(result.centAmount).toBe(9600);
    });

    test('deducts approved payments without adyenOrderData', () => {
      const payment = approvedPayment();
      const result = service.calculateRemainingAmount(cartWithPayments([payment]));
      expect(result.centAmount).toBe(10000 - 2000);
    });

    test('does not deduct approved payments that carry adyenOrderData (gift card orders being cancelled)', () => {
      const payment = approvedPayment({
        custom: {
          type: { typeId: 'type', id: 'ct' },
          fields: { adyenOrderData: 'order-data', adyenOrderPspReference: 'ORDER-PSP-1' },
        },
      });
      const result = service.calculateRemainingAmount(cartWithPayments([payment]));
      expect(result.centAmount).toBe(10000);
    });

    test('does not deduct reverted payments (Authorization followed by CancelAuthorization in Success)', () => {
      const payment = approvedPayment({
        transactions: [
          {
            id: 'tx-auth',
            type: 'Authorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: 'tx-cancel',
            type: 'CancelAuthorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 2000, currencyCode: 'USD', fractionDigits: 2 },
            timestamp: '2024-01-01T01:00:00Z',
          },
        ],
      });
      const result = service.calculateRemainingAmount(cartWithPayments([payment]));
      expect(result.centAmount).toBe(10000);
    });

    test('deducts giftCardCentAmount from context', () => {
      jest.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(500);
      const result = service.calculateRemainingAmount(baseCart());
      expect(result.centAmount).toBe(10000 - 500);
    });

    test('deducts multiple approved non-order payments independently', () => {
      const p1 = approvedPayment({
        id: 'p1',
        amountPlanned: { type: 'centPrecision', centAmount: 1000, currencyCode: 'USD', fractionDigits: 2 },
      });
      const p2 = approvedPayment({
        id: 'p2',
        amountPlanned: { type: 'centPrecision', centAmount: 3000, currencyCode: 'USD', fractionDigits: 2 },
      });
      const result = service.calculateRemainingAmount(cartWithPayments([p1, p2]));
      expect(result.centAmount).toBe(10000 - 1000 - 3000);
    });

    test('throws ErrorInvalidOperation when remaining amount is exactly zero', () => {
      const payment = approvedPayment({
        amountPlanned: { type: 'centPrecision', centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 },
        transactions: [
          {
            id: 'tx-1',
            type: 'Authorization',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 10000, currencyCode: 'USD', fractionDigits: 2 },
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      });
      expect(() => service.calculateRemainingAmount(cartWithPayments([payment]))).toThrow(ErrorInvalidOperation);
    });

    test('throws ErrorInvalidOperation when remaining amount would be negative', () => {
      jest.spyOn(FastifyContext, 'getGiftCardPlannedCentAmountFromContext').mockReturnValue(10001);
      expect(() => service.calculateRemainingAmount(baseCart())).toThrow(ErrorInvalidOperation);
    });
  });

  describe('createPayment - gift card split payment (getAmountToPay)', () => {
    const giftCardPaymentOpts: { data: CreatePaymentRequestDTO } = {
      data: {
        paymentMethod: { type: 'giftcard', brand: 'givex' } as Record<string, string>,
        order: { orderData: 'some-order-data', pspReference: 'ORDER-PSP-1' },
      },
    };

    beforeEach(() => {
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
      jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
      jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResultShippingModeSimple());
      jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');
      jest.spyOn(FastifyContext, 'getMerchantReturnUrlFromContext').mockReturnValue('http://127.0.0.1/checkout/result');
      jest.spyOn(PaymentsApi.prototype, 'payments').mockResolvedValue(mockAdyenCreatePaymentResponse);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    });

    test('uses gift card balance as amountPlanned when balance is less than cart amount', async () => {
      // cartAmount = 150000 (mockGetPaymentAmount), balance = 5000 → use 5000
      jest.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard').mockResolvedValue({
        balance: { value: 5000, currency: 'USD' },
        pspReference: 'BALANCE-PSP-1',
        resultCode: 'Success',
      });

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(giftCardPaymentOpts);

      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 5000, currencyCode: 'USD' }),
        }),
      );
    });

    test('caps amountPlanned at cart amount when gift card balance exceeds remaining cart amount', async () => {
      // cartAmount = 150000 (mockGetPaymentAmount), balance = 200000 → cap at 150000
      jest.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard').mockResolvedValue({
        balance: { value: 200000, currency: 'USD' },
        pspReference: 'BALANCE-PSP-2',
        resultCode: 'Success',
      });

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(giftCardPaymentOpts);

      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 150000, currencyCode: 'USD' }),
        }),
      );
    });

    test('falls back to cart amount when balance check returns no balance', async () => {
      jest.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard').mockResolvedValue({
        pspReference: 'BALANCE-PSP-3',
        resultCode: 'NotEnoughBalance',
      });

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(giftCardPaymentOpts);

      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 150000, currencyCode: 'USD' }),
        }),
      );
    });

    test('uses cart amount directly when payment is not a gift card split payment', async () => {
      const cardPaymentOpts: { data: CreatePaymentRequestDTO } = {
        data: { paymentMethod: { type: 'scheme' } as Record<string, string> },
      };

      const balanceSpy = jest.spyOn(OrdersApi.prototype, 'getBalanceOfGiftCard');

      const adyenPaymentService = new AdyenPaymentService(opts);
      await adyenPaymentService.createPayment(cardPaymentOpts);

      expect(balanceSpy).not.toHaveBeenCalled();
      expect(DefaultPaymentService.prototype.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPlanned: expect.objectContaining({ centAmount: 150000 }),
        }),
      );
    });
  });
});
