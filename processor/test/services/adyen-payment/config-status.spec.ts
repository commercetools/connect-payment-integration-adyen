import { describe, expect, vi, test } from 'vitest';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { ConfigResponse, StatusResponse } from '../../../src/services/types/operation.type';
import { mockGetCartResultShippingModeSimple } from '../../utils/mock-cart-data';
import { mockAdyenPaymentMethodsResponse, mockGetPaymentAmount } from '../../utils/mock-payment-data';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import * as StatusHandler from '@commercetools/connect-payments-sdk/dist/api/handlers/status.handler';
import { HealthCheckResult } from '@commercetools/connect-payments-sdk';
import { CreateApplePaySessionRequestDTO, PaymentMethodsRequestDTO } from '../../../src/dtos/adyen-payment.dto';
import { SupportedPaymentComponentsSchemaDTO } from '../../../src/dtos/operations/payment-componets.dto';
import * as FastifyContext from '../../../src/libs/fastify/context/context';
import { StoredPaymentMethod } from '../../../src/dtos/stored-payment-methods.dto';
import * as StoredPaymentMethodsConfig from '../../../src/config/stored-payment-methods.config';
import { AdyenPaymentService } from '../../../src/services/adyen-payment.service';
import { createPaymentServiceOptions, setupMockAgent, setupMockConfig } from './test-setup';

describe('adyen-payment.service - config, status & Apple Pay', () => {
  const mockAgent = setupMockAgent();
  const opts = createPaymentServiceOptions();
  const paymentService = new AdyenPaymentService(opts);

  test('getConfig', async () => {
    vi.spyOn(AdyenPaymentService.prototype, 'getStoredPaymentMethods').mockResolvedValueOnce({
      storedPaymentMethods: [{ token: 'sometokenidvaluefromadyen' } as StoredPaymentMethod],
    });
    // Setup mock config for a system using `clientKey`
    setupMockConfig({ adyenClientKey: 'adyen', adyenEnvironment: 'test', adyenClientEnvironment: 'test' });

    const result: ConfigResponse = await paymentService.config();
    // Assertions can remain the same or be adapted based on the abstracted access
    expect(result?.clientKey).toStrictEqual('adyen');
    expect(result?.environment).toStrictEqual('test');
    expect(result?.applePayConfig?.usesOwnCertificate).toStrictEqual(false);
  });

  test('getConfig uses the frontend-specific environment when it diverges from the backend one', async () => {
    vi.spyOn(AdyenPaymentService.prototype, 'getStoredPaymentMethods').mockResolvedValueOnce({
      storedPaymentMethods: [{ token: 'sometokenidvaluefromadyen' } as StoredPaymentMethod],
    });
    setupMockConfig({ adyenClientKey: 'adyen', adyenEnvironment: 'LIVE', adyenClientEnvironment: 'live-au' });

    const result: ConfigResponse = await paymentService.config();
    expect(result?.environment).toStrictEqual('live-au');
  });

  test('getSupportedPaymentComponents', async () => {
    const result: SupportedPaymentComponentsSchemaDTO = await paymentService.getSupportedPaymentComponents();
    expect(result?.components).toHaveLength(28);
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
    expect(result?.components[27]?.type).toStrictEqual('jcs');
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

    vi.spyOn(PaymentsApi.prototype, 'paymentMethods').mockResolvedValue(mockAdyenPaymentMethodsResponse);
    const mockHealthCheck = vi
      .spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions')
      .mockReturnValue(mockHealthCheckFunction);
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
    expect(mockHealthCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermissions: expect.not.arrayContaining(['manage_recurring_payment_jobs']),
      }),
    );
  });

  test('getStatus requires manage_recurring_payment_jobs when recurring payments are enabled', async () => {
    const mockHealthCheckFunction: () => Promise<HealthCheckResult> = async () => ({
      name: 'CoCo Permissions',
      status: 'UP',
      details: {},
    });

    setupMockConfig({ adyenRecurringPaymentsEnabled: true });
    vi.spyOn(StoredPaymentMethodsConfig, 'getStoredPaymentMethodsConfig').mockReturnValue({
      enabled: false,
      config: {
        paymentInterface: 'adyen',
        supportedPaymentMethodTypes: { scheme: { oneOffPayments: true, recurringPayments: true } },
      },
    });
    vi.spyOn(PaymentsApi.prototype, 'paymentMethods').mockResolvedValue(mockAdyenPaymentMethodsResponse);
    const mockHealthCheck = vi
      .spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions')
      .mockReturnValue(mockHealthCheckFunction);

    await paymentService.status();

    expect(mockHealthCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermissions: expect.arrayContaining(['manage_recurring_payment_jobs']),
      }),
    );
  });

  test('getPaymentMethods', async () => {
    const getPaymentMethodsOpts: { data: PaymentMethodsRequestDTO } = {
      data: {},
    };

    vi.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResultShippingModeSimple());
    vi.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);
    vi.spyOn(PaymentsApi.prototype, 'paymentMethods').mockResolvedValue(mockAdyenPaymentMethodsResponse);
    vi.spyOn(FastifyContext, 'getAllowedPaymentMethodsFromContext').mockReturnValue(['card']);

    const adyenPaymentService: AdyenPaymentService = new AdyenPaymentService(opts);
    const result = await adyenPaymentService.getPaymentMethods(getPaymentMethodsOpts);

    expect(result.paymentMethods).toBeDefined();
    expect(result.paymentMethods).toHaveLength(0);
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

      vi.spyOn(FastifyContext, 'getCartIdFromContext').mockReturnValue('abcd');

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
});
