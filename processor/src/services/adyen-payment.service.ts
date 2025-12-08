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
  PaymentMethod,
  ErrorInvalidField,
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
  GetExpressPaymentDataResponseDTO,
  GetExpressConfigResponseDTO,
  GetExpressConfigRequestDTO,
  UpdatePayPalExpressPaymentRequestDTO,
  UpdatePayPalExpressPaymentResponseDTO,
  CreateExpressPaymentResponseDTO,
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
import { getStoredPaymentMethodsConfig } from '../config/stored-payment-methods.config';
import { StoredPaymentMethod, StoredPaymentMethodsResponse } from '../dtos/stored-payment-methods.dto';
import { NotificationTokenizationConverter } from './converters/notification-recurring.converter';
import { convertAdyenCardBrandToCTFormat, convertPaymentMethodToAdyenFormat } from './converters/helper.converter';
import { PaypalUpdateOrderRequest } from '@adyen/api-library/lib/src/typings/checkout/paypalUpdateOrderRequest';
import { randomUUID } from 'node:crypto';
import { TransactionDraftDTO, TransactionResponseDTO } from '../dtos/operations/transaction.dto';

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
    this.createPaymentConverter = new CreatePaymentConverter(this.ctPaymentMethodService, this.ctCartService);
    this.confirmPaymentConverter = new ConfirmPaymentConverter();
    this.notificationConverter = new NotificationConverter(this.ctPaymentService);
    this.notificationTokenizationConverter = new NotificationTokenizationConverter();
    this.paymentComponentsConverter = new PaymentComponentsConverter();
    this.cancelPaymentConverter = new CancelPaymentConverter();
    this.capturePaymentConverter = new CapturePaymentConverter(this.ctCartService, this.ctOrderService);
    this.refundPaymentConverter = new RefundPaymentConverter();
    this.reversePaymentConverter = new ReversePaymentConverter();
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    if (!getStoredPaymentMethodsConfig().enabled) {
      return false;
    }

    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    return ctCart.customerId !== undefined;
  }

  async config(): Promise<ConfigResponse> {
    const usesOwnCertificate = getConfig().adyenApplePayOwnCerticate?.length > 0;

    return {
      clientKey: getConfig().adyenClientKey,
      environment: getConfig().adyenEnvironment,
      applePayConfig: {
        usesOwnCertificate,
      },
      paymentComponentsConfig: this.getPaymentComponentsConfig(),
      storedPaymentMethodsConfig: {
        isEnabled: await this.isStoredPaymentMethodsEnabled(),
      },
    };
  }

  async expressConfig(opts: { data: GetExpressConfigRequestDTO }): Promise<GetExpressConfigResponseDTO> {
    const usesOwnCertificate = getConfig().adyenApplePayOwnCerticate?.length > 0;
    const config = {
      clientKey: getConfig().adyenClientKey,
      environment: getConfig().adyenEnvironment,
      applePayConfig: {
        usesOwnCertificate,
      },
    };

    try {
      const res = await AdyenApi().PaymentsApi.paymentMethods({
        merchantAccount: getConfig().adyenMerchantAccount,
        allowedPaymentMethods: ['paypal', 'googlepay', 'applepay'],
        countryCode: opts.data.countryCode,
      });

      return {
        config,
        methods: res.paymentMethods,
      };
    } catch (e) {
      throw wrapAdyenError(e);
    }
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

    if (getStoredPaymentMethodsConfig().enabled) {
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

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization', //TODO: is there any case where this could be a direct charge?
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: txState,
      },
      ...('storedPaymentMethodId' in data.paymentMethod &&
        data.paymentMethod.storedPaymentMethodId && {
          paymentMethodInfo: { token: { value: data.paymentMethod.storedPaymentMethodId } },
        }),
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

  public async createExpressPayment(opts: { data: CreatePaymentRequestDTO }): Promise<CreateExpressPaymentResponseDTO> {
    if (opts.data.paymentMethod?.type === 'paypal') {
      return this.processPaypalExpress(opts.data);
    }

    return this.processOtherExpressMethods(opts.data);
  }

  public async confirmExpressPayment(opts: { data: ConfirmPaymentRequestDTO }): Promise<ConfirmPaymentResponseDTO> {
    let ctCart;
    ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: getPaymentInterfaceFromContext() || 'adyen',
        method: opts.data.paymentMethod,
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
        amount: {
          centAmount: res.amount?.value || ctPayment.amountPlanned.centAmount,
          currencyCode: res.amount?.currency || ctPayment.amountPlanned.currencyCode,
        },
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
    const notificationLogObject = {
      notification: {
        createdAt: opts.data.createdAt,
        environment: opts.data.environment,
        eventId: opts.data.eventId,
        type: opts.data.type,
        version: opts.data.version,
        data: {
          merchantAccount: opts.data.data.merchantAccount,
          shopperReference: opts.data.data.shopperReference,
          type: opts.data.data.type,
        },
      },
    };

    log.info('Processing notification tokenization', notificationLogObject);

    try {
      const actions = await this.notificationTokenizationConverter.convert(opts);

      if (actions.draft) {
        const doesTokenAlreadyExist = await this.ctPaymentMethodService.doesTokenBelongsToCustomer({
          customerId: actions.draft.customerId,
          paymentInterface: actions.draft.paymentInterface,
          interfaceAccount: actions.draft.interfaceAccount,
          tokenValue: actions.draft.token,
        });

        if (doesTokenAlreadyExist) {
          log.info(
            'Stored payment method already exists in CT for the given customer, paymentInterface, interfaceAccount and token combination. Not creating a new one and ignoring request to save a new stored payment method.',
            {
              notification: notificationLogObject,
              paymentMethod: {
                customer: actions.draft.customerId,
                paymentInterface: actions.draft.paymentInterface,
                interfaceAccount: actions.draft.interfaceAccount,
                method: actions.draft.method,
              },
            },
          );
        } else {
          const newlyCreatedPaymentMethod = await this.ctPaymentMethodService.save(actions.draft);

          log.info('Created new payment method used for tokenization', {
            notification: notificationLogObject,
            paymentMethod: {
              id: newlyCreatedPaymentMethod.id,
              customer: newlyCreatedPaymentMethod.customer,
              paymentInterface: newlyCreatedPaymentMethod.paymentInterface,
              interfaceAccount: newlyCreatedPaymentMethod.interfaceAccount,
              method: newlyCreatedPaymentMethod.method,
            },
          });

          // Ensure that the original payment that tokenised the payment-method for the first time also has the token value set in the paymentMethodInfo.token.value
          const payments = await this.ctPaymentService.findPaymentsByInterfaceId({
            interfaceId: opts.data.eventId,
          });

          if (payments.length === 1) {
            await this.ctPaymentService.updatePayment({
              id: payments[0].id,
              paymentMethodInfo: {
                token: {
                  value: actions.draft.token,
                },
              },
            });
          } else {
            log.warn('0 or more then 1 payments for the given Adyen PsP reference which should not happen', {
              notification: notificationLogObject,
              paymentCount: payments.length,
              payments: payments.map((pm) => pm.id),
            });
          }
        }
      }
    } catch (e) {
      if (e instanceof UnsupportedNotificationError) {
        log.info('Unsupported notification received', {
          notificationLogObject,
        });

        return;
      }

      log.error('Error processing notification', { error: e, notificationLogObject });
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

  private async handleTransactionStoredPaymentMethodPurchase(
    transactionDraft: TransactionDraftDTO,
  ): Promise<TransactionResponseDTO> {
    // Perform validations
    if (!getStoredPaymentMethodsConfig().enabled) {
      throw new ErrorInvalidOperation(
        'The stored-payment-methods feature is disabled and thus cannot request an transaction using stored-payment-methods',
      );
    }

    const ctCart = await this.ctCartService.getCart({ id: transactionDraft.cartId });

    if (!ctCart.customerId) {
      throw new ErrorRequiredField('customerId', {
        privateMessage: 'customerId is not set on the cart',
        privateFields: {
          cart: {
            id: ctCart.id,
          },
          checkoutTransactionItemId: transactionDraft.checkoutTransactionItemId,
          paymentInterface: transactionDraft.paymentInterface,
        },
      });
    }

    if (!transactionDraft.paymentMethod) {
      throw new ErrorRequiredField('paymentMethod', {
        privateMessage: 'paymentMethod is not provided in the draft',
        privateFields: {
          cart: {
            id: ctCart.id,
          },
          checkoutTransactionItemId: transactionDraft.checkoutTransactionItemId,
          paymentInterface: transactionDraft.paymentInterface,
        },
      });
    }

    const paymentMethod = await this.ctPaymentMethodService.get({
      id: transactionDraft.paymentMethod?.id,
      customerId: ctCart.customerId,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
    });

    if (!paymentMethod.token) {
      throw new ErrorRequiredField('token', {
        privateMessage: 'The "token" value is not set on the payment-method',
        privateFields: {
          cart: {
            id: ctCart.id,
          },
          checkoutTransactionItemId: transactionDraft.checkoutTransactionItemId,
          paymentInterface: transactionDraft.paymentInterface,
          paymentMethod: {
            id: paymentMethod.id,
          },
        },
      });
    }

    // Determine the amount that needs to be payed and setup the payment entity in CT
    let amountPlanned = transactionDraft.amount;
    if (!amountPlanned) {
      amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });
    }

    const newlyCreatedPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      checkoutTransactionItemId: transactionDraft.checkoutTransactionItemId,
      paymentMethodInfo: {
        paymentInterface: transactionDraft.paymentInterface,
        token: {
          value: paymentMethod.token.value,
        },
        ...(paymentMethod.method && { method: convertPaymentMethodToAdyenFormat(paymentMethod.method) }),
      },
      customer: {
        typeId: 'customer',
        id: ctCart.customerId,
      },
    });

    await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: newlyCreatedPayment.id,
    });

    // Execute Authorization payment request to Adyen
    let res: PaymentResponse;

    const data = await this.createPaymentConverter.convertRequestStoredPaymentMethod({
      cart: ctCart,
      payment: newlyCreatedPayment,
      paymentMethod: paymentMethod,
    });

    try {
      res = await AdyenApi().PaymentsApi.payments(data);
    } catch (e) {
      throw wrapAdyenError(e);
    }

    // Handle the response from Adyen
    const txState = this.convertAdyenResultCode(
      res.resultCode as PaymentResponse.ResultCodeEnum,
      this.isActionRequired(res),
    );

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: newlyCreatedPayment.id,
      pspReference: res.pspReference,
      transaction: {
        amount: amountPlanned,
        type: 'Authorization',
        state: txState,
        interactionId: res.pspReference,
      },
      token: paymentMethod.token.value,
    });

    log.info("Payment authorization processed for 'transaction' stored payment method", {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      result: res.resultCode,
    });

    if (txState === 'Failure') {
      const reason = res.refusalReason ? `with reason "${res.refusalReason}"` : '';
      return {
        transactionStatus: {
          errors: [
            {
              code: 'PaymentRejected',
              message: `Payment '${newlyCreatedPayment.id}' has been rejected ${reason}"`,
            },
          ],
          state: 'Failed',
        },
      };
    }

    if (txState === 'Success') {
      return {
        transactionStatus: {
          errors: [],
          state: 'Completed',
        },
      };
    }

    return {
      transactionStatus: {
        errors: [],
        state: 'Pending',
      },
    };
  }

  async handleTransaction(transactionDraft: TransactionDraftDTO): Promise<TransactionResponseDTO> {
    if (transactionDraft.type === 'StoredPaymentMethodPurchase') {
      return await this.handleTransactionStoredPaymentMethodPurchase(transactionDraft);
    }

    throw new ErrorInvalidField('type', transactionDraft.type || '', 'StoredPaymentMethodPurchase');
  }

  /**
   * Returns "cart.customerId" from the catt that is present in the context. If the "cart.customerId" is not set then a "ErrorRequiredField" will be thrown.
   */
  async getCustomerIdFromCart(): Promise<string> {
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

    return customerId;
  }

  async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponse> {
    const customerId = await this.getCustomerIdFromCart();

    const storedPaymentMethods = await this.ctPaymentMethodService.find({
      customerId: customerId,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
    });

    if (storedPaymentMethods.results.length <= 0) {
      return { storedPaymentMethods: [] };
    }

    const resList = await this.enhanceCTStoredPaymentMethodsWithAdyenDisplayData(
      customerId,
      storedPaymentMethods.results,
    );

    return {
      storedPaymentMethods: resList,
    };
  }

  async enhanceCTStoredPaymentMethodsWithAdyenDisplayData(
    customerId: string,
    storedPaymentMethods: PaymentMethod[],
  ): Promise<StoredPaymentMethod[]> {
    const customersTokenDetailsFromAdyen = await AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(
      customerId,
      getConfig().adyenMerchantAccount,
    );

    return storedPaymentMethods.map((spm) => {
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
          brand: {
            key: convertAdyenCardBrandToCTFormat(tokenDetailsFromAdyen?.brand),
          },
          endDigits: tokenDetailsFromAdyen?.lastFour,
          expiryMonth: tokenDetailsFromAdyen?.expiryMonth ? Number(tokenDetailsFromAdyen.expiryMonth) : undefined,
          expiryYear: tokenDetailsFromAdyen?.expiryYear ? Number(tokenDetailsFromAdyen.expiryYear) : undefined,
        },
      };

      return res;
    });
  }

  async deleteStoredPaymentMethodViaCart(id: string): Promise<void> {
    const customerId = await this.getCustomerIdFromCart();

    await this.deleteStoredPaymentMethod(id, customerId);
  }

  async deleteStoredPaymentMethod(id: string, customerId: string): Promise<void> {
    const paymentMethod = await this.ctPaymentMethodService.get({
      customerId: customerId,
      paymentInterface: getStoredPaymentMethodsConfig().config.paymentInterface,
      interfaceAccount: getStoredPaymentMethodsConfig().config.interfaceAccount,
      id,
    });

    try {
      await this.ctPaymentMethodService.delete({
        customerId: customerId,
        id: paymentMethod.id,
        version: paymentMethod.version,
      });

      log.info('Successfully deleted payment-method in CT', {
        customer: { id: customerId, type: 'customer' },
        paymentMethod: { id: paymentMethod.id, type: 'payment-method', version: paymentMethod.version },
      });
    } catch (error) {
      log.error('Could not delete payment-method in CT', {
        error,
        customer: { id: customerId, type: 'customer' },
        paymentMethod: { id: paymentMethod.id, type: 'payment-method' },
      });

      throw error;
    }

    await this.deleteTokenInAdyen(customerId, paymentMethod);
  }

  async updatePayPalExpressOrder(opts: {
    data: UpdatePayPalExpressPaymentRequestDTO;
  }): Promise<UpdatePayPalExpressPaymentResponseDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });
    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });

    const enrichedDelivery = opts.data.deliveryMethods.map((item) => {
      if (item.selected) {
        return {
          ...item,
          amount: {
            currency: amountPlanned.currencyCode,
            value: amountPlanned.centAmount - opts.data.originalAmount.centAmount,
          },
        };
      }
      return item;
    });

    const requestData: PaypalUpdateOrderRequest = {
      ...opts.data,
      deliveryMethods: enrichedDelivery,
      pspReference: opts.data.pspReference,
      amount: {
        currency: amountPlanned.currencyCode,
        value: amountPlanned.centAmount,
      },
    };

    const res = await AdyenApi().UtilityApi.updatesOrderForPaypalExpressCheckout(requestData);

    return res;
  }

  async getExpressPaymentData(): Promise<GetExpressPaymentDataResponseDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    return {
      totalPrice: {
        currencyCode: ctCart.taxedPrice?.totalGross.currencyCode || ctCart.totalPrice.currencyCode,
        centAmount: ctCart.taxedPrice?.totalGross.centAmount || ctCart.totalPrice.centAmount,
      },
      lineItems: [
        {
          name: 'Subtotal',
          amount: {
            centAmount: ctCart.taxedPrice?.totalNet.centAmount || ctCart.totalPrice.centAmount,
            currencyCode: ctCart.taxedPrice?.totalNet.currencyCode || ctCart.totalPrice.currencyCode,
          },
          type: 'SUBTOTAL',
        },
        ...(ctCart.taxedPrice
          ? [
              {
                name: 'Tax',
                amount: {
                  centAmount: ctCart.taxedPrice?.totalTax?.centAmount || 0,
                  currencyCode: ctCart.taxedPrice?.totalTax?.currencyCode || ctCart.totalPrice.currencyCode,
                },
                type: 'TAX',
              },
            ]
          : []),
      ],
      currencyCode: ctCart.taxedPrice?.totalGross.currencyCode || ctCart.totalPrice.currencyCode,
    };
  }

  private async deleteTokenInAdyen(
    customerId: string,
    ctPaymentMethod: Pick<PaymentMethod, 'id' | 'version' | 'token'>,
  ) {
    const maxRetries = 3;
    let attempt = 1;

    do {
      try {
        await AdyenApi().RecurringApi.deleteTokenForStoredPaymentDetails(
          ctPaymentMethod.token!.value,
          customerId,
          getConfig().adyenMerchantAccount,
        );

        log.info('Successfully deleted token in Adyen', {
          customer: { id: customerId, type: 'customer' },
          paymentMethod: { id: ctPaymentMethod.id, type: 'payment-method', version: ctPaymentMethod.version },
        });

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
          paymentMethod: { id: ctPaymentMethod.id, type: 'payment-method' },
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

        if (attempt === maxRetries) {
          log.error('Could not delete payment-method in Adyen and maximum attempt reached', errorLogObject);
          throw wrappedAdyenError;
        }

        log.warn('Could not delete payment-method in Adyen, retrying...', errorLogObject);

        attempt += 1;
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

  private convertAdyenResultCode(
    resultCode: PaymentResponse.ResultCodeEnum,
    isActionRequired: boolean,
  ): TransactionState {
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

  private async processPaypalExpress(payload: CreatePaymentRequestDTO): Promise<CreateExpressPaymentResponseDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });
    const data = await this.createPaymentConverter.convertExpressRequest({
      data: payload,
      cart: ctCart,
      payment: {
        amountPlanned: amountPlanned,
        id: `ct-checkout-${randomUUID()}`,
      },
    });

    let res!: PaymentResponse;
    try {
      res = await AdyenApi().PaymentsApi.payments(data);
    } catch (e) {
      throw wrapAdyenError(e);
    }

    log.info(`Payment initiated with adyen.`, {
      interactionId: res.pspReference,
      result: res.resultCode,
    });

    return {
      ...res,
      originalAmount: amountPlanned,
    } as CreateExpressPaymentResponseDTO;
  }

  private async processOtherExpressMethods(payload: CreatePaymentRequestDTO): Promise<CreateExpressPaymentResponseDTO> {
    let ctCart, ctPayment;
    ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    if (payload.paymentReference) {
      ctPayment = await this.ctPaymentService.updatePayment({
        id: payload.paymentReference,
        paymentMethod: payload.paymentMethod?.type,
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
          method: payload.paymentMethod?.type,
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

    const data = await this.createPaymentConverter.convertExpressRequest({
      data: payload,
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

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization',
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
}
