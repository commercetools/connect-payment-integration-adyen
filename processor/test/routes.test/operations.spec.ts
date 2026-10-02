import fastify from 'fastify';
import { describe, beforeAll, afterAll, test, expect, vi, afterEach } from 'vitest';
import {
  AuthorityAuthorizationHook,
  AuthorityAuthorizationManager,
  CommercetoolsCartService,
  CommercetoolsOrderService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  CommercetoolsRecurringPaymentJobService,
  ContextProvider,
  JWTAuthenticationHook,
  JWTAuthenticationManager,
  Logger,
  Oauth2AuthenticationHook,
  Oauth2AuthenticationManager,
  RequestContextData,
  SessionHeaderAuthenticationHook,
  SessionHeaderAuthenticationManager,
} from '@commercetools/connect-payments-sdk';
import { IncomingHttpHeaders } from 'node:http';
import { operationsRoute } from '../../src/routes/operation.route';
import { AdyenPaymentService } from '../../src/services/adyen-payment.service';

describe('/operations APIs', () => {
  const app = fastify({ logger: false });
  const token = 'token';
  const jwtToken = 'jwtToken';
  const sessionId = 'session-id';
  const logger = vi.fn() as unknown as Logger;

  const spyAuthenticateJWT = vi
    .spyOn(JWTAuthenticationHook.prototype, 'authenticate')
    .mockImplementationOnce(() => async (request: { headers: IncomingHttpHeaders }) => {
      expect(request.headers['authorization']).toContain(`Bearer ${jwtToken}`);
    });

  const spyAuthenticateOauth2 = vi
    .spyOn(Oauth2AuthenticationHook.prototype, 'authenticate')
    .mockImplementationOnce(() => async (request: { headers: IncomingHttpHeaders }) => {
      expect(request.headers['authorization']).toContain(`Bearer ${token}`);
    });

  const spyAuthenticateSession = vi
    .spyOn(SessionHeaderAuthenticationHook.prototype, 'authenticate')
    .mockImplementationOnce(() => async (request: { headers: IncomingHttpHeaders }) => {
      expect(request.headers['x-session-id']).toContain('session-id');
    });

  const spiedJwtAuthenticationHook = new JWTAuthenticationHook({
    authenticationManager: vi.fn() as unknown as JWTAuthenticationManager,
    contextProvider: vi.fn() as unknown as ContextProvider<RequestContextData>,
    logger,
  });

  const spiedOauth2AuthenticationHook = new Oauth2AuthenticationHook({
    authenticationManager: vi.fn() as unknown as Oauth2AuthenticationManager,
    contextProvider: vi.fn() as unknown as ContextProvider<RequestContextData>,
    logger,
  });

  const spiedSessionHeaderAuthenticationHook = new SessionHeaderAuthenticationHook({
    authenticationManager: vi.fn() as unknown as SessionHeaderAuthenticationManager,
    contextProvider: vi.fn() as unknown as ContextProvider<RequestContextData>,
    logger,
  });

  const spiedAuthorityAuthorizationHook = new AuthorityAuthorizationHook({
    authorizationManager: vi.fn() as unknown as AuthorityAuthorizationManager,
    contextProvider: vi.fn() as unknown as ContextProvider<RequestContextData>,
    logger,
  });

  const spiedPaymentService = new AdyenPaymentService({
    ctCartService: vi.fn() as unknown as CommercetoolsCartService,
    ctPaymentService: vi.fn() as unknown as CommercetoolsPaymentService,
    ctOrderService: vi.fn() as unknown as CommercetoolsOrderService,
    ctPaymentMethodService: vi.fn() as unknown as CommercetoolsPaymentMethodService,
    ctRecurringPaymentJobService: vi.fn() as unknown as CommercetoolsRecurringPaymentJobService,
    orderService: vi.fn() as unknown as ConstructorParameters<typeof AdyenPaymentService>[0]['orderService'],
  });

  beforeAll(async () => {
    await app.register(operationsRoute, {
      prefix: '/operations',
      oauth2AuthHook: spiedOauth2AuthenticationHook,
      jwtAuthHook: spiedJwtAuthenticationHook,
      sessionHeaderAuthHook: spiedSessionHeaderAuthenticationHook,
      authorizationHook: spiedAuthorityAuthorizationHook,
      paymentService: spiedPaymentService,
    });
  });

  afterEach(async () => {
    spyAuthenticateJWT.mockClear();
    spyAuthenticateOauth2.mockClear();
    spyAuthenticateSession.mockClear();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /operations/config', () => {
    test('it should return the Adyen client config', async () => {
      vi.spyOn(spiedPaymentService, 'isStoredPaymentMethodsEnabled').mockResolvedValueOnce(true);

      //When
      const responseGetConfig = await app.inject({
        method: 'GET',
        url: `/operations/config`,
        headers: {
          'x-session-id': sessionId,
          'content-type': 'application/json',
        },
      });

      //Then
      expect(responseGetConfig.statusCode).toEqual(200);
      expect(responseGetConfig.json()).toEqual({
        clientKey: 'adyenClientKey',
        environment: 'test',
        applePayConfig: {
          usesOwnCertificate: false,
        },
        storedPaymentMethodsConfig: {
          isEnabled: true,
        },
      });
    });
  });

  describe('GET /operations/status', () => {
    test('it should return the status of the connector', async () => {
      //Given
      vi.spyOn(spiedPaymentService, 'status').mockResolvedValue({
        metadata: {
          name: 'payment-integration-adyen',
          description: 'Payment integration with Adyen',
        },
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00Z',
        status: 'UP',
        checks: [
          {
            name: 'CoCo Permissions',
            status: 'UP',
          },
          {
            name: 'Adyen Status check',
            status: 'UP',
          },
          {
            name: 'Adyen Apple Pay config check',
            status: 'UP',
          },
        ],
      });

      //When
      const responseGetStatus = await app.inject({
        method: 'GET',
        url: `/operations/status`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
          'content-type': 'application/json',
        },
      });

      //Then
      expect(responseGetStatus.statusCode).toEqual(200);
      expect(responseGetStatus.json()).toEqual(
        expect.objectContaining({
          metadata: expect.any(Object),
          status: 'UP',
          timestamp: expect.any(String),
          version: '1.0.0',
          checks: expect.arrayContaining([
            expect.objectContaining({
              name: 'CoCo Permissions',
              status: 'UP',
            }),
            expect.objectContaining({
              name: 'Adyen Status check',
              status: 'UP',
            }),
            expect.objectContaining({
              name: 'Adyen Apple Pay config check',
              status: 'UP',
            }),
          ]),
        }),
      );
    });

    test('it should return the status of the connector in case of partial availability', async () => {
      //Given
      vi.spyOn(spiedPaymentService, 'status').mockResolvedValue({
        metadata: {
          name: 'payment-integration-adyen',
          description: 'Payment integration with Adyen',
        },
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00Z',
        status: 'Partially Available',
        checks: [
          {
            name: 'Adyen Status check',
            status: 'DOWN',
            message: 'Failed to connect with Adyen',
          },
          {
            name: 'Adyen Apple Pay config check',
            status: 'DOWN',
            message:
              'Apple Pay configuration is not complete, please fill in all the Apple Pay "own" environment variables',
          },
          {
            name: 'CoCo Permissions',
            status: 'DOWN',
            message: `CoCo permissions are not correct, expected scopes: manage_payments view_sessions view_api_clients manage_orders introspect_oauth_tokens, actual scopes: manage_payments:dev-commercetools-checkout view_api_clients:dev-commercetools-checkout manage_orders:dev-commercetools-checkout introspect_oauth_tokens:dev-commercetools-checkout view_payments:dev-commercetools-checkout view_orders:dev-commercetools-checkout`,
            details: {
              expectedScopes: [
                'manage_payments',
                'view_sessions',
                'view_api_clients',
                'manage_orders',
                'introspect_oauth_tokens',
              ],
              actualScopes:
                'manage_payments:dev-commercetools-checkout view_api_clients:dev-commercetools-checkout manage_orders:dev-commercetools-checkout introspect_oauth_tokens:dev-commercetools-checkout view_payments:dev-commercetools-checkout view_orders:dev-commercetools-checkout',
              reason: 'scopes not available',
            },
          },
        ],
      });

      //When
      const responseGetStatus = await app.inject({
        method: 'GET',
        url: `/operations/status`,
        headers: {
          authorization: `Bearer ${jwtToken}`,
          'content-type': 'application/json',
        },
      });

      //Then
      expect(responseGetStatus.statusCode).toEqual(200);
      expect(responseGetStatus.json()).toEqual(
        expect.objectContaining({
          metadata: expect.any(Object),
          status: 'Partially Available',
          timestamp: expect.any(String),
          version: '1.0.0',
          checks: expect.arrayContaining([
            expect.objectContaining({
              name: 'CoCo Permissions',
              status: 'DOWN',
              message: `CoCo permissions are not correct, expected scopes: manage_payments view_sessions view_api_clients manage_orders introspect_oauth_tokens, actual scopes: manage_payments:dev-commercetools-checkout view_api_clients:dev-commercetools-checkout manage_orders:dev-commercetools-checkout introspect_oauth_tokens:dev-commercetools-checkout view_payments:dev-commercetools-checkout view_orders:dev-commercetools-checkout`,
              details: {
                expectedScopes: [
                  'manage_payments',
                  'view_sessions',
                  'view_api_clients',
                  'manage_orders',
                  'introspect_oauth_tokens',
                ],
                actualScopes:
                  'manage_payments:dev-commercetools-checkout view_api_clients:dev-commercetools-checkout manage_orders:dev-commercetools-checkout introspect_oauth_tokens:dev-commercetools-checkout view_payments:dev-commercetools-checkout view_orders:dev-commercetools-checkout',
                reason: 'scopes not available',
              },
            }),
            expect.objectContaining({
              name: 'Adyen Status check',
              status: 'DOWN',
              message: 'Failed to connect with Adyen',
            }),
            expect.objectContaining({
              name: 'Adyen Apple Pay config check',
              status: 'DOWN',
              message:
                'Apple Pay configuration is not complete, please fill in all the Apple Pay "own" environment variables',
            }),
          ]),
        }),
      );
    });
  });
});
