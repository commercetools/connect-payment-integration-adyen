import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorInvalidOperation,
  healthCheckCommercetoolsPermissions,
  statusHandler,
  Cart,
  Payment,
  CommercetoolsOrderService,
  Errorx,
  TransactionType,
  TransactionState,
  CommercetoolsPaymentMethodService,
  ErrorRequiredField,
} from '@commercetools/connect-payments-sdk';
import {
  ConfirmPaymentRequestDTO,
  ConfirmPaymentResponseDTO,
  CreateApplePaySessionRequestDTO,
  CreateApplePaySessionResponseDTO,
  CreatePaymentRequestDTO,
  CreatePaymentResponseDTO,
  CreateSessionRequestDTO,
  CreateSessionResponseDTO,
  NotificationTokenizationDTO,
  NotificationRequestDTO,
  PaymentMethodsRequestDTO,
  PaymentMethodsResponseDTO,
} from '../dtos/adyen-payment.dto';
import { AdyenApi, isAdyenApiError, wrapAdyenError } from '../clients/adyen.client';
import {
  getCartIdFromContext,
  getMerchantReturnUrlFromContext,
  getPaymentInterfaceFromContext,
} from '../libs/fastify/context/context';
import { CreateSessionConverter } from './converters/create-session.converter';
import { CreatePaymentConverter } from './converters/create-payment.converter';
import { ConfirmPaymentConverter } from './converters/confirm-payment.converter';
import { NotificationConverter } from './converters/notification.converter';
import { PaymentMethodsConverter } from './converters/payment-methods.converter';
import { PaymentComponentsConverter } from './converters/payment-components.converter';
import { CapturePaymentConverter } from './converters/capture-payment.converter';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';
import { getConfig, config } from '../config/config';
import { appLogger, paymentSDK } from '../payment-sdk';
import { AmountSchemaDTO, PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { AbstractPaymentService } from './abstract-payment.service';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { PaymentDetailsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsResponse';
import { CancelPaymentConverter } from './converters/cancel-payment.converter';
import { RefundPaymentConverter } from './converters/refund-payment.converter';
import { ReversePaymentConverter } from './converters/reverse-payment.converter';
import { log } from '../libs/logger';
import { ApplePayPaymentSessionError, UnsupportedNotificationError } from '../errors/adyen-api.error';
import { fetch as undiciFetch, Agent, Dispatcher } from 'undici';
import { NotificationUpdatePayment } from './types/service.type';
import { PaymentCaptureResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureResponse';
import { PaymentCancelResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCancelResponse';
import { PaymentRefundResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundResponse';
import { getSavedPaymentsConfig } from '../config/saved-payment-method.config';
import { StoredPaymentMethod, StoredPaymentMethodsResponse } from '../dtos/saved-payment-methods.dto';
import { NotificationTokenizationConverter } from './converters/notification-recurring.converter';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJSON = require('../../package.json');

export type AdyenPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctOrderService: CommercetoolsOrderService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
};

export class AdyenPaymentService extends AbstractPaymentService {
  private paymentMethodsConverter: PaymentMethodsConverter;
  private createSessionConverter: CreateSessionConverter;
  private createPaymentConverter: CreatePaymentConverter;
  private confirmPaymentConverter: ConfirmPaymentConverter;
  private notificationConverter: NotificationConverter;
  private notificationTokenizationConverter: NotificationTokenizationConverter;
  private paymentComponentsConverter: PaymentComponentsConverter;
  private cancelPaymentConverter: CancelPaymentConverter;
  private capturePaymentConverter: CapturePaymentConverter;
  private refundPaymentConverter: RefundPaymentConverter;
  private reversePaymentConverter: ReversePaymentConverter;

  constructor(opts: AdyenPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService, opts.ctOrderService, opts.ctPaymentMethodService);
    this.paymentMethodsConverter = new PaymentMethodsConverter(this.ctCartService);
    this.createSessionConverter = new CreateSessionConverter();
    this.createPaymentConverter = new CreatePaymentConverter(this.ctPaymentMethodService);
    this.confirmPaymentConverter = new ConfirmPaymentConverter();
    this.notificationConverter = new NotificationConverter(this.ctPaymentService);
    this.notificationTokenizationConverter = new NotificationTokenizationConverter();
    this.paymentComponentsConverter = new PaymentComponentsConverter();
    this.cancelPaymentConverter = new CancelPaymentConverter();
    this.capturePaymentConverter = new CapturePaymentConverter(this.ctCartService, this.ctOrderService);
    this.refundPaymentConverter = new RefundPaymentConverter();
    this.reversePaymentConverter = new ReversePaymentConverter();
  }
  async config(): Promise<ConfigResponse> {
    const usesOwnCertificate = getConfig().adyenApplePayOwnCerticate?.length > 0;

    const savedPaymentMethods = await this.getSavedPaymentMethods();

    return {
      clientKey: getConfig().adyenClientKey,
      environment: getConfig().adyenEnvironment,
      applePayConfig: {
        usesOwnCertificate,
      },
      paymentComponentsConfig: this.getPaymentComponentsConfig(),
      savedpaymentMethodsConfig: {
        isEnabled: getSavedPaymentsConfig().enabled,
        knownTokensIds: savedPaymentMethods.storedPaymentMethods.map((spm) => spm.token),
      },
    };
  }

  async status(): Promise<StatusResponse> {
    const requiredPermissions = [
      'manage_payments',
      'view_sessions',
      'view_api_clients',
      'manage_orders',
      'introspect_oauth_tokens',
      'manage_checkout_payment_intents',
    ];

    if (getSavedPaymentsConfig().enabled) {
      requiredPermissions.push('manage_payment_methods');
    }

    const handler = await statusHandler({
      timeout: config.healthCheckTimeout,
      log: appLogger,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: requiredPermissions,
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: config.projectKey,
        }),
        async () => {
          try {
            const result = await AdyenApi().PaymentsApi.paymentMethods({
              merchantAccount: config.adyenMerchantAccount,
            });
            return {
              name: 'Adyen Status check',
              status: 'UP',
              details: {
                paymentMethods: result.paymentMethods,
              },
            };
          } catch (e) {
            return {
              name: 'Adyen Status check',
              status: 'DOWN',
              message: `Not able to talk to the Adyen API`,
              details: {
                error: e,
              },
            };
          }
        },
        () => {
          const config = getConfig();
          const usesApplePayOwnCertificate = config.adyenApplePayOwnCerticate?.length > 0;

          let status: 'UP' | 'DOWN' = 'UP';
          if (usesApplePayOwnCertificate) {
            const { adyenApplePayOwnMerchantId, adyenApplePayOwnDisplayName, adyenApplePayOwnMerchantDomain } = config;
            status =
              adyenApplePayOwnMerchantId?.length > 0 &&
              adyenApplePayOwnDisplayName?.length > 0 &&
              adyenApplePayOwnMerchantDomain?.length > 0
                ? 'UP'
                : 'DOWN';
          }

          return {
            name: 'Adyen Apple Pay config check',
            status,
            ...(status === 'DOWN' && {
              message:
                'Apple Pay configuration is not complete, please fill in all the Apple Pay "own" environment variables',
              details: {
                error:
                  'Apple Pay configuration is not complete, please fill in all the Apple Pay "own" environment variables',
              },
            }),
          };
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        '@commercetools/sdk-client-v2': packageJSON.dependencies['@commercetools/sdk-client-v2'],
        '@adyen/api-library': packageJSON.dependencies['@adyen/api-library'],
      }),
    })();

    return handler.body;
  }

  async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return this.paymentComponentsConverter.convertResponse();
  }

  async getPaymentMethods(opts: { data: PaymentMethodsRequestDTO }): Promise<PaymentMethodsResponseDTO> {
    const data = await this.paymentMethodsConverter.convertRequest({
      data: opts.data,
    });

    try {
      const res = await AdyenApi().PaymentsApi.paymentMethods(data);
      return this.paymentMethodsConverter.convertResponse({
        data: res,
      });
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  async createSession(opts: { data: CreateSessionRequestDTO }): Promise<CreateSessionResponseDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const amountPlanned = await this.ctCartService.getPlannedPaymentAmount({ cart: ctCart });
    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: getPaymentInterfaceFromContext() || 'adyen',
      },
      ...(ctCart.customerId && {
        customer: {
          typeId: 'customer',
          id: ctCart.customerId,
        },
      }),
      ...(!ctCart.customerId &&
        ctCart.anonymousId && {
          anonymousId: ctCart.anonymousId,
        }),
    });

    const updatedCart = await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: ctPayment.id,
    });

    const adyenRequestData = this.createSessionConverter.convertRequest({
      data: opts.data,
      cart: updatedCart,
      payment: ctPayment,
    });

    try {
      const res = await AdyenApi().PaymentsApi.sessions(adyenRequestData);
      return {
        sessionData: this.createSessionConverter.convertResponse({ response: res }),
        paymentReference: ctPayment.id,
      };
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  public async createPayment(opts: { data: CreatePaymentRequestDTO }): Promise<CreatePaymentResponseDTO> {
    let ctCart, ctPayment;
    ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    if (opts.data.paymentReference) {
      ctPayment = await this.ctPaymentService.updatePayment({
        id: opts.data.paymentReference,
        paymentMethod: opts.data.paymentMethod?.type,
      });

      if (await this.hasPaymentAmountChanged(ctCart, ctPayment)) {
        throw new ErrorInvalidOperation('The payment amount does not fulfill the remaining amount of the cart', {
          fields: {
            cartId: ctCart.id,
            paymentId: ctPayment.id,
          },
        });
      }
    } else {
      const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });
      ctPayment = await this.ctPaymentService.createPayment({
        amountPlanned,
        paymentMethodInfo: {
          paymentInterface: getPaymentInterfaceFromContext() || 'adyen',
          method: opts.data.paymentMethod?.type,
        },
        ...(ctCart.customerId && {
          customer: {
            typeId: 'customer',
            id: ctCart.customerId,
          },
        }),
        ...(!ctCart.customerId &&
          ctCart.anonymousId && {
            anonymousId: ctCart.anonymousId,
          }),
      });

      ctCart = await this.ctCartService.addPayment({
        resource: {
          id: ctCart.id,
          version: ctCart.version,
        },
        paymentId: ctPayment.id,
      });
    }
    const data = await this.createPaymentConverter.convertRequest({
      data: opts.data,
      cart: ctCart,
      payment: ctPayment,
    });

    let res!: PaymentResponse;
    try {
      res = await AdyenApi().PaymentsApi.payments(data);
    } catch (e) {
      throw wrapAdyenError(e);
    }

    const txState = this.convertAdyenResultCode(
      res.resultCode as PaymentResponse.ResultCodeEnum,
      this.isActionRequired(res),
    );

    // TODO: SCC-3447: (SCC-3449) if the user payed with a spm, then the token (and the rest of the payment details --> this is already done) must be stored in the commercetools Payment entity.

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization', //TODO: is there any case where this could be a direct charge?
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: txState,
      },
    });

    log.info(`Payment authorization processed.`, {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      result: res.resultCode,
    });

    return {
      ...res,
      paymentReference: updatedPayment.id,
      ...(txState === 'Success' || txState === 'Pending'
        ? { merchantReturnUrl: this.buildRedirectMerchantUrl(updatedPayment.id, res.resultCode) }
        : {}),
    } as CreatePaymentResponseDTO;
  }

  public async confirmPayment(opts: { data: ConfirmPaymentRequestDTO }): Promise<ConfirmPaymentResponseDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.data.paymentReference,
    });

    const data = this.confirmPaymentConverter.convertRequest({
      data: opts.data,
    });

    let res!: PaymentDetailsResponse;
    try {
      res = await AdyenApi().PaymentsApi.paymentsDetails(data);
    } catch (e) {
      throw wrapAdyenError(e);
    }

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: this.convertAdyenResultCode(res.resultCode as PaymentResponse.ResultCodeEnum, false),
      },
    });

    log.info(`Payment confirmation processed.`, {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      result: res.resultCode,
    });

    return {
      ...res,
      paymentReference: updatedPayment.id,
      merchantReturnUrl: this.buildRedirectMerchantUrl(updatedPayment.id, res.resultCode),
    } as ConfirmPaymentResponseDTO;
  }

  public async processNotification(opts: { data: NotificationRequestDTO }): Promise<void> {
    log.info('Processing notification', { notification: JSON.stringify(opts.data) });
    try {
      const updateData = await this.notificationConverter.convert(opts);
      const payment = await this.getPaymentFromNotification(updateData);

      for (const tx of updateData.transactions) {
        const updatedPayment = await this.ctPaymentService.updatePayment({
          id: payment.id,
          pspReference: updateData.pspReference,
          transaction: tx,
        });

        log.info('Payment updated after processing the notification', {
          paymentId: updatedPayment.id,
          version: updatedPayment.version,
          pspReference: updateData.pspReference,
          paymentMethod: updateData.paymentMethod,
          transaction: JSON.stringify(tx),
        });
      }
    } catch (e) {
      if (e instanceof UnsupportedNotificationError) {
        log.info('Unsupported notification received', { notification: JSON.stringify(opts.data) });
        return;
      } else if (e instanceof Errorx && e.code === 'ResourceNotFound') {
        log.info('Payment not found hence accepting the notification', { notification: JSON.stringify(opts.data) });
        return;
      }

      log.error('Error processing notification', { error: e });
      throw e;
    }
  }

  public async processNotificationTokenization(opts: { data: NotificationTokenizationDTO }): Promise<void> {
    log.info('Processing notification tokenization', { notification: JSON.stringify(opts.data) });

    try {
      const actions = await this.notificationTokenizationConverter.convert(opts);

      if (actions.draft) {
        const newlyCreatedPaymentMethod = await this.ctPaymentMethodService.save(actions.draft);

        log.info('Created new payment method used for tokenization', {
          notification: JSON.stringify(opts.data),
          paymentMethod: {
            id: newlyCreatedPaymentMethod.id,
            customer: newlyCreatedPaymentMethod.customer,
            paymentInterface: newlyCreatedPaymentMethod.paymentInterface,
            interfaceAccount: newlyCreatedPaymentMethod.interfaceAccount,
            method: newlyCreatedPaymentMethod.method,
          },
        });
      }
    } catch (e) {
      if (e instanceof UnsupportedNotificationError) {
        log.info('Unsupported notification received', { notification: JSON.stringify(opts.data) });
        return;
      }

      log.error('Error processing notification', { error: e });
      throw e;
    }
  }

  async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'capturePayment',
    });

    const response = await this.processPaymentModificationInternal({
      request,
      transactionType: 'Charge',
      adyenOperation: 'capture',
      amount: request.amount,
    });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'capturePayment',
      result: response.outcome,
    });

    return response;
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'cancelPayment',
    });

    const response = await this.processPaymentModificationInternal({
      request,
      transactionType: 'CancelAuthorization',
      adyenOperation: 'cancel',
      amount: request.payment.amountPlanned,
    });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'cancelPayment',
      result: response.outcome,
    });

    return response;
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'refundPayment',
    });

    const response = await this.processPaymentModificationInternal({
      request,
      transactionType: 'Refund',
      adyenOperation: 'refund',
      amount: request.amount,
    });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'refundPayment',
      result: response.outcome,
    });

    return response;
  }

  async reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'reversePayment',
    });

    const transactionStateChecker = (transactionType: TransactionType, states: TransactionState[]) =>
      this.ctPaymentService.hasTransactionInState({ payment: request.payment, transactionType, states });

    const hasCharge = transactionStateChecker('Charge', ['Success']);
    const hasAuthorization = transactionStateChecker('Authorization', ['Success']);

    let response!: PaymentProviderModificationResponse;
    if (hasCharge) {
      response = await this.processPaymentModificationInternal({
        request,
        transactionType: 'Refund',
        adyenOperation: 'reverse',
        amount: request.payment.amountPlanned,
      });
    } else if (hasAuthorization) {
      response = await this.processPaymentModificationInternal({
        request,
        transactionType: 'CancelAuthorization',
        adyenOperation: 'reverse',
        amount: request.payment.amountPlanned,
      });
    } else {
      throw new ErrorInvalidOperation(`There is no successful payment transaction to reverse.`);
    }

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'reversePayment',
      result: response.outcome,
    });

    return response;
  }

  /**
   * Gets the known saved payment methods from CT based on the customerId on the cart in the session
   */
  async getSavedPaymentMethods(): Promise<StoredPaymentMethodsResponse> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const customerId = ctCart.customerId;

    if (!customerId) {
      throw new ErrorRequiredField('customerId', {
        privateMessage: 'customerId is not set on the cart',
        privateFields: {
          cart: {
            id: ctCart.id,
          },
        },
      });
    }

    const savedPaymentMethods = await this.ctPaymentMethodService.find({
      customerId: ctCart.customerId,
      paymentInterface: getSavedPaymentsConfig().config.paymentInterface,
      interfaceAccount: getSavedPaymentsConfig().config.interfaceAccount,
    });

    // TODO: SCC-3447: (SCC-3449) if the .env toggle is DISABLED then try and retrieve as much as possible from the Adyen API during runtime for the displayOptions. if ENABLED then use that information to show the displayOptions

    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      customerId,
      getConfig().adyenMerchantAccount,
    );

    const resList = savedPaymentMethods.results.map((spm) => {
      const tokenDetailsFromAdyen = customersTokenDetailsFromAdyen.storedPaymentMethods?.find(
        (tokenDetails) => tokenDetails.id === spm.token?.value,
      );

      const res: StoredPaymentMethod = {
        id: spm.id,
        createdAt: spm.createdAt,
        isDefault: spm.default,
        token: spm.token?.value || tokenDetailsFromAdyen?.id || '',
        type: spm.method || tokenDetailsFromAdyen?.type || '',
        displayOptions: {
          name: `•••• ${tokenDetailsFromAdyen?.lastFour}`,
          brand: tokenDetailsFromAdyen?.brand,
          endDigits: tokenDetailsFromAdyen?.lastFour,
          expiryMonth: tokenDetailsFromAdyen?.expiryMonth,
          expiryYear: tokenDetailsFromAdyen?.expiryYear,
          logoUrl: undefined, // TODO: SCC-3447: logoUrl is not present on the CT and adyen model
        },
      };
      return res;
    });

    return {
      storedPaymentMethods: resList,
    };
  }

  async deleteSavedPaymentMethod(id: string): Promise<void> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const customerId = ctCart.customerId;

    if (!customerId) {
      throw new ErrorRequiredField('customerId', {
        privateMessage: 'customerId is not set on the cart',
        privateFields: {
          cart: {
            id: ctCart.id,
          },
        },
      });
    }

    const paymentMethod = await this.ctPaymentMethodService.getByTokenValue({
      customerId: customerId,
      paymentInterface: getSavedPaymentsConfig().config.paymentInterface,
      interfaceAccount: getSavedPaymentsConfig().config.interfaceAccount,
      tokenValue: id,
    });

    try {
      await this.ctPaymentMethodService.delete({
        customerId: customerId,
        id: paymentMethod.id,
        version: paymentMethod.version,
      });
    } catch (error) {
      log.error('Could not delete payment-method in CT', {
        error,
        customer: { id: customerId, type: 'customer' },
        paymentMethod: { id: paymentMethod.id, type: 'payment-method' },
        cart: { id: ctCart.id, type: 'cart' },
      });

      throw error;
    }

    const maxRetries = 3;
    let attempt = 1;

    async function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    do {
      try {
        AdyenApi().RecurringApi.deleteTokenForStoredPaymentDetails(id, customerId, getConfig().adyenMerchantAccount);
        break;
      } catch (error) {
        const wrappedAdyenError = wrapAdyenError(error);

        const errorLogObject = {
          error,
          retry: {
            attempt,
            maxRetries,
          },
          customer: { id: customerId, type: 'customer' },
          paymentMethod: { id: paymentMethod.id, type: 'payment-method' },
          cart: { id: ctCart.id, type: 'cart' },
        };

        if (isAdyenApiError(wrappedAdyenError)) {
          if (wrappedAdyenError.httpErrorStatus === 404) {
            break;
          }

          if (wrappedAdyenError.httpErrorStatus === 401 || wrappedAdyenError.httpErrorStatus === 403) {
            log.error('Could not delete payment-method in Adyen due to credential problems', {
              ...errorLogObject,
              httpStatusCode: wrappedAdyenError.httpErrorStatus,
            });
            break;
          }
        }

        log.error('Could not delete payment-method in Adyen', errorLogObject);

        await sleep(200);

        if (attempt === maxRetries) {
          throw wrappedAdyenError;
        }

        attempt++;
      }
    } while (attempt <= maxRetries);
  }

  private async processPaymentModificationInternal(opts: {
    request: CapturePaymentRequest | CancelPaymentRequest | RefundPaymentRequest | ReversePaymentRequest;
    transactionType: 'Charge' | 'Refund' | 'CancelAuthorization';
    adyenOperation: 'capture' | 'refund' | 'cancel' | 'reverse';
    amount: AmountSchemaDTO;
  }): Promise<PaymentProviderModificationResponse> {
    const { request, transactionType, adyenOperation, amount } = opts;
    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: transactionType,
        amount,
        state: 'Initial',
      },
    });

    const interfaceId = request.payment.interfaceId as string;

    const response = await this.makeCallToAdyenInternal(interfaceId, adyenOperation, request);

    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: transactionType,
        amount,
        interactionId: response.pspReference,
        state: this.convertPaymentModificationOutcomeToState(PaymentModificationStatus.RECEIVED),
      },
    });

    return { outcome: PaymentModificationStatus.RECEIVED, pspReference: response.pspReference };
  }

  private async makeCallToAdyenInternal(
    interfaceId: string,
    adyenOperation: 'capture' | 'refund' | 'cancel' | 'reverse',
    request: CapturePaymentRequest | CancelPaymentRequest | RefundPaymentRequest | ReversePaymentRequest,
  ): Promise<PaymentCaptureResponse | PaymentCancelResponse | PaymentRefundResponse> {
    try {
      switch (adyenOperation) {
        case 'capture': {
          return await AdyenApi().ModificationsApi.captureAuthorisedPayment(
            interfaceId,
            await this.capturePaymentConverter.convertRequest(request as CapturePaymentRequest),
          );
        }
        case 'refund': {
          return await AdyenApi().ModificationsApi.refundCapturedPayment(
            interfaceId,
            this.refundPaymentConverter.convertRequest(request as RefundPaymentRequest),
          );
        }
        case 'cancel': {
          return await AdyenApi().ModificationsApi.cancelAuthorisedPaymentByPspReference(
            interfaceId,
            this.cancelPaymentConverter.convertRequest(request as CancelPaymentRequest),
          );
        }
        case 'reverse': {
          return await AdyenApi().ModificationsApi.refundOrCancelPayment(
            interfaceId,
            this.reversePaymentConverter.convertRequest(request as ReversePaymentRequest),
          );
        }
        default: {
          log.error(`makeCallToAdyenInternal: Operation  ${adyenOperation} not supported when modifying payment.`);
          throw new ErrorInvalidOperation(`Operation not supported.`);
        }
      }
    } catch (e) {
      if (e instanceof Errorx) {
        throw e;
      } else {
        throw wrapAdyenError(e);
      }
    }
  }

  async createApplePaySession(opts: {
    data: CreateApplePaySessionRequestDTO;
    agent?: Dispatcher;
  }): Promise<CreateApplePaySessionResponseDTO> {
    const certificate = getConfig().adyenApplePayOwnCerticate;
    try {
      const data = {
        merchantIdentifier: getConfig().adyenApplePayOwnMerchantId,
        displayName: getConfig().adyenApplePayOwnDisplayName,
        initiative: 'web',
        initiativeContext: getConfig().adyenApplePayOwnMerchantDomain,
      };

      const response = await undiciFetch(opts.data.validationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        dispatcher:
          opts.agent ||
          new Agent({
            connect: {
              cert: certificate,
              key: certificate,
            },
          }),
      });

      const responseData = (await response.json()) as CreateApplePaySessionResponseDTO;
      if (response.status !== 200) {
        const defaultErrorMessage = 'Not able to create the Apple Pay session';
        throw new ApplePayPaymentSessionError(
          {
            status: response.status,
            message: responseData?.statusMessage || defaultErrorMessage,
          },
          {
            privateFields: {
              cart: getCartIdFromContext(),
            },
          },
        );
      }

      return responseData;
    } catch (e) {
      if (e instanceof ApplePayPaymentSessionError) {
        throw e;
      }
      throw new ApplePayPaymentSessionError(
        {
          status: 500,
          message: 'Unexpected error creating the Apple Pay session',
        },
        {
          cause: e,
          privateFields: {
            cart: getCartIdFromContext(),
          },
        },
      );
    }
  }

  private convertAdyenResultCode(resultCode: PaymentResponse.ResultCodeEnum, isActionRequired: boolean): string {
    if (resultCode === PaymentResponse.ResultCodeEnum.Authorised) {
      return 'Success';
    } else if (
      (resultCode === PaymentResponse.ResultCodeEnum.Pending ||
        resultCode === PaymentResponse.ResultCodeEnum.Received) &&
      !isActionRequired
    ) {
      return 'Pending';
    } else if (
      resultCode === PaymentResponse.ResultCodeEnum.Refused ||
      resultCode === PaymentResponse.ResultCodeEnum.Error ||
      resultCode === PaymentResponse.ResultCodeEnum.Cancelled
    ) {
      return 'Failure';
    } else {
      return 'Initial';
    }
  }

  private isActionRequired(data: PaymentResponse): boolean {
    return data.action?.type !== undefined;
  }

  private async hasPaymentAmountChanged(cart: Cart, ctPayment: Payment): Promise<boolean> {
    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart });
    return (
      ctPayment.amountPlanned.centAmount !== amountPlanned.centAmount ||
      ctPayment.amountPlanned.currencyCode !== amountPlanned.currencyCode
    );
  }

  private buildRedirectMerchantUrl(
    paymentReference: string,
    resultCode?: PaymentDetailsResponse.ResultCodeEnum,
  ): string {
    const merchantReturnUrl = getMerchantReturnUrlFromContext() || config.merchantReturnUrl;
    const redirectUrl = new URL(merchantReturnUrl);

    redirectUrl.searchParams.append('paymentReference', paymentReference);
    if (resultCode === PaymentDetailsResponse.ResultCodeEnum.Cancelled) {
      redirectUrl.searchParams.append('userAction', 'cancelled');
    }
    return redirectUrl.toString();
  }

  /**
   * Retrieves a payment instance from the notification data
   * First, it tries to find the payment by the interfaceId (PSP reference)
   * As a fallback, it tries to find the payment by the merchantReference which unless the merchant overrides it, it's the payment ID
   * @param data
   * @returns A payment instance
   */
  private async getPaymentFromNotification(data: NotificationUpdatePayment): Promise<Payment> {
    const interfaceId = data.pspReference;
    let payment!: Payment;

    if (interfaceId) {
      const results = await this.ctPaymentService.findPaymentsByInterfaceId({
        interfaceId,
      });

      if (results.length > 0) {
        payment = results[0];
      }
    }

    if (!payment) {
      return await this.ctPaymentService.getPayment({
        id: data.merchantReference,
      });
    }

    return payment;
  }

  private getPaymentComponentsConfig(): unknown | undefined {
    try {
      const paymentComponentsConfigStr = getConfig().adyenPaymentComponentsConfig;
      return paymentComponentsConfigStr ? JSON.parse(paymentComponentsConfigStr) : undefined;
    } catch (e) {
      log.error('Error parsing payment components config', { error: e });
      return undefined;
    }
  }
}
