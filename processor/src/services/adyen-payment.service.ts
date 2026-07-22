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
  ErrorInternalConstraintViolated,
  CurrencyConverters,
  CustomFieldsDraft,
  FieldContainer,
} from '@commercetools/connect-payments-sdk';
import { AdyenOrderService } from './adyen-order.service';
import { CheckoutOrderResponse } from '@adyen/api-library/lib/src/typings/checkout/checkoutOrderResponse';
import type { RecurringApi } from '@adyen/api-library/lib/src/services/checkout/recurringApi';
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
  GiftCardBalanceRequestDTO,
  GiftCardBalanceResponseDTO,
} from '../dtos/adyen-payment.dto';
import { AdyenApi, isAdyenApiError, wrapAdyenError } from '../clients/adyen.client';
import { PaymentAmount } from '@commercetools/connect-payments-sdk/dist/commercetools/types/payment.type';
import {
  getCartIdFromContext,
  getCheckoutTransactionItemIdFromContext,
  getGiftCardPlannedCentAmountFromContext,
  getMerchantReturnUrlFromContext,
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
import { BalanceCheckConverter } from './converters/balance-check.converter';
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
import {
  buildCheckoutTransactionItemId,
  convertAdyenCardBrandToCTFormat,
  convertPaymentMethodFromAdyenFormat,
  convertPaymentMethodToAdyenFormat,
  isGiftCardSplitPayment,
} from './converters/helper.converter';
import { populateInterfaceInteraction, AdyenRequestPayload, AdyenResponsePayload } from './helper.service';
import {
  AdyenOrderDetailsTypeDraft,
  AdyenOrderDetailsTypeKey,
  GenerateAdyenOrderDetailsCustomFieldsDraft,
} from '../custom-types/adyen-order-details';
import { PaypalUpdateOrderRequest } from '@adyen/api-library/lib/src/typings/checkout/paypalUpdateOrderRequest';
import { randomUUID } from 'node:crypto';
import { TransactionDraftDTO, TransactionResponseDTO } from '../dtos/operations/transaction.dto';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../constants/currencies';
import { StoredPaymentMethodResource } from '@adyen/api-library/lib/src/typings/checkout/storedPaymentMethodResource';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJSON = require('../../package.json');

const MODIFICATION_TYPE_MAP = {
  capture: 'CapturePayment',
  refund: 'RefundPayment',
  cancel: 'CancelPayment',
  reverse: 'ReversePayment',
} as const;

export type AdyenPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctOrderService: CommercetoolsOrderService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
  orderService: AdyenOrderService;
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
  private balanceCheckConverter: BalanceCheckConverter;
  private orderService: AdyenOrderService;

  constructor(opts: AdyenPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService, opts.ctOrderService, opts.ctPaymentMethodService);
    this.orderService = opts.orderService;
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
    this.balanceCheckConverter = new BalanceCheckConverter();
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

    if (getConfig().adyenStorePaymentMethodDetailsEnabled) {
      requiredPermissions.push('manage_types');
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
      expand: ['paymentInfo.payments[*]'],
    });

    // When partial payments are enabled, optimistically cancel any active Adyen orders (gift card
    // orders that have been partially applied but not yet fully settled). The session amount is
    // computed excluding those gift card payments — we assume the ORDER_CLOSED webhook will arrive
    // and finalise the cancellation. Payments without adyenOrderData (e.g. regular card payments)
    // are still deducted as they represent settled amounts.
    if (getConfig().adyenPartialPaymentsEnabled) {
      await this.orderService.cancelCartActiveOrders(ctCart);
    }

    const amountPlanned = await this.getPaymentPlannedAmount(ctCart);

    const adyenRequestData = this.createSessionConverter.convertRequest({
      data: opts.data,
      cart: ctCart,
      amountPlanned,
    });

    try {
      const res = await AdyenApi().PaymentsApi.sessions(adyenRequestData);
      return {
        sessionData: this.createSessionConverter.convertResponse({ response: res }),
      };
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  private async getPaymentPlannedAmount(cart: Cart): Promise<PaymentAmount> {
    if (getConfig().adyenPartialPaymentsEnabled) {
      return this.calculateRemainingAmount(cart);
    }
    return this.ctCartService.getPlannedPaymentAmount({ cart });
  }

  /**
   * Calculates the remaining amount to be paid in the session after optimistic order cancellation.
   * Only deducts approved payments that do NOT carry adyenOrderData — i.e. settled non-gift-card
   * payments. Gift card payments with an active Adyen order are excluded because their orders are
   * being cancelled and the actual deduction will happen once the ORDER_CLOSED webhook arrives.
   */
  public calculateRemainingAmount(cart: Cart): PaymentAmount {
    const basePrice = cart.taxedPrice?.totalGross ?? cart.totalPrice;
    const giftCardCentAmount = getGiftCardPlannedCentAmountFromContext();

    const paidCentAmount = (cart.paymentInfo?.payments ?? [])
      .map((ref) => ref.obj)
      .filter(
        (payment): payment is Payment =>
          payment !== undefined &&
          this.isPaymentApproved(payment) &&
          payment.custom?.fields?.['adyenOrderData'] === undefined,
      )
      .reduce((sum, payment) => sum + payment.amountPlanned.centAmount, 0);

    const centAmount = basePrice.centAmount - paidCentAmount - giftCardCentAmount;
    if (centAmount <= 0) {
      throw new ErrorInvalidOperation('Cart has no remaining amount to pay');
    }

    return {
      centAmount,
      currencyCode: basePrice.currencyCode,
      fractionDigits: basePrice.fractionDigits,
    };
  }

  private isPaymentApproved(payment: Payment): boolean {
    const wasReverted = payment.transactions.some(
      (tx) =>
        (tx.type === 'CancelAuthorization' || tx.type === 'Refund') &&
        (tx.state === 'Success' || tx.state === 'Pending'),
    );
    if (wasReverted) return false;

    return payment.transactions.some(
      (tx) =>
        (tx.state === 'Success' || tx.state === 'Pending') && (tx.type === 'Authorization' || tx.type === 'Charge'),
    );
  }

  public async createPayment(opts: { data: CreatePaymentRequestDTO }): Promise<CreatePaymentResponseDTO> {
    const ctCart = await this.ctCartService.getCart({ id: getCartIdFromContext() });
    const isSplitPayment = isGiftCardSplitPayment(opts.data);
    const amountPlanned = await this.getAmountToPay({
      isSplitPayment,
      paymentMethod: opts.data.paymentMethod as Record<string, string>,
      cart: ctCart,
    });

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: getConfig().paymentInterface,
        method: opts.data.paymentMethod?.type,
      },
      checkoutTransactionItemId: buildCheckoutTransactionItemId(opts.data),
      ...(ctCart.customerId && { customer: { typeId: 'customer', id: ctCart.customerId } }),
      ...(!ctCart.customerId && ctCart.anonymousId && { anonymousId: ctCart.anonymousId }),
    });

    const updatedCart = await this.ctCartService.addPayment({
      resource: { id: ctCart.id, version: ctCart.version },
      paymentId: ctPayment.id,
    });

    const data = await this.createPaymentConverter.convertRequest({
      data: opts.data,
      cart: updatedCart,
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

    const orderCustomFields =
      getConfig().adyenPartialPaymentsEnabled && res.order
        ? await this.buildAdyenOrderCustomFields(ctPayment, res.order)
        : {};

    const interfaceInteraction = this.buildInterfaceInteraction('CreatePayment', data, res);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization', //TODO: is there any case where this could be a direct charge?
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference, // Deprecated but kept for backward compatibility
        interfaceId: res.pspReference,
        state: txState,
      },
      ...('storedPaymentMethodId' in data.paymentMethod &&
        data.paymentMethod.storedPaymentMethodId && {
          paymentMethodInfo: { token: { value: data.paymentMethod.storedPaymentMethodId } },
        }),
      ...orderCustomFields,
      pspInteractions: interfaceInteraction,
    });

    log.info(`Payment authorization processed.`, {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      interfaceId: res.pspReference,
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

    const interfaceInteraction = this.buildInterfaceInteraction('ConfirmPayment', data, res);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference, // Deprecated but kept for backward compatibility
        interfaceId: res.pspReference,
        state: this.convertAdyenResultCode(res.resultCode as PaymentResponse.ResultCodeEnum, false),
      },
      pspInteractions: interfaceInteraction,
    });

    log.info(`Payment confirmation processed.`, {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      interfaceId: res.pspReference,
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
        paymentInterface: getConfig().paymentInterface,
        method: opts.data.paymentMethod,
      },
      checkoutTransactionItemId: getCheckoutTransactionItemIdFromContext(),
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

    const interfaceInteraction = this.buildInterfaceInteraction('ConfirmPayment', data, res);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization',
        amount: {
          centAmount: res.amount?.value || ctPayment.amountPlanned.centAmount,
          currencyCode: res.amount?.currency || ctPayment.amountPlanned.currencyCode,
        },
        interactionId: res.pspReference, // Deprecated but kept for backward compatibility
        interfaceId: res.pspReference,
        state: this.convertAdyenResultCode(res.resultCode as PaymentResponse.ResultCodeEnum, false),
      },
      pspInteractions: interfaceInteraction,
    });

    log.info(`Payment confirmation processed.`, {
      cartId: ctCart.id,
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      interfaceId: res.pspReference,
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
      const updateDataList = await this.notificationConverter.convert(opts);

      for (const updateData of updateDataList) {
        await this.applyNotificationUpdate(updateData, opts.data);
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

    let transactionType: 'Refund' | 'CancelAuthorization';
    if (hasCharge) {
      transactionType = 'Refund';
    } else if (hasAuthorization) {
      transactionType = 'CancelAuthorization';
    } else {
      throw new ErrorInvalidOperation(`There is no successful payment transaction to reverse.`);
    }

    const adyenOrder = this.getAdyenOrderReference(request.payment);

    const response = adyenOrder
      ? await this.reverseOrderPayment({ request, transactionType, ...adyenOrder })
      : await this.processPaymentModificationInternal({
          request,
          transactionType,
          adyenOperation: 'reverse',
          amount: request.payment.amountPlanned,
        });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'reversePayment',
      result: response.outcome,
    });

    return response;
  }

  /**
   * Returns the Adyen order reference for a payment that is part of a partial/multi payment
   * (gift card + card), or undefined if the payment was not created as part of such an order.
   */
  private getAdyenOrderReference(
    payment: Payment,
  ): { adyenOrderData: string; adyenOrderPspReference: string } | undefined {
    const adyenOrderData = payment.custom?.fields?.['adyenOrderData'] as string | undefined;
    const adyenOrderPspReference = payment.custom?.fields?.['adyenOrderPspReference'] as string | undefined;

    return adyenOrderData && adyenOrderPspReference ? { adyenOrderData, adyenOrderPspReference } : undefined;
  }

  /**
   * Reverses a payment that belongs to an Adyen order (partial/multi payments, e.g. gift card + card)
   * by cancelling the order itself instead of calling the modification API on the individual payment.
   */
  private async reverseOrderPayment(opts: {
    request: ReversePaymentRequest;
    transactionType: 'Refund' | 'CancelAuthorization';
    adyenOrderData: string;
    adyenOrderPspReference: string;
  }): Promise<PaymentProviderModificationResponse> {
    const { request, transactionType, adyenOrderData, adyenOrderPspReference } = opts;

    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: transactionType,
        amount: request.payment.amountPlanned,
        state: 'Initial',
      },
    });

    const adyenResponse = await this.orderService.cancelOrder({
      data: { orderData: adyenOrderData, pspReference: adyenOrderPspReference },
    });

    log.info(`Adyen order cancellation requested as part of payment reversal.`, {
      paymentId: request.payment.id,
      adyenOrderPspReference,
      cancellationRequestPspReference: adyenResponse.pspReference,
    });

    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: transactionType,
        amount: request.payment.amountPlanned,
        interactionId: adyenOrderPspReference, // Deprecated but kept for backward compatibility
        interfaceId: adyenOrderPspReference,
        state: this.convertPaymentModificationOutcomeToState(PaymentModificationStatus.RECEIVED),
      },
    });

    return { outcome: PaymentModificationStatus.RECEIVED, pspReference: adyenOrderPspReference };
  }

  private async handleTransactionRecurringType(transactionDraft: TransactionDraftDTO): Promise<TransactionResponseDTO> {
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
      id: transactionDraft.paymentMethod.id,
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

    const data = await this.createPaymentConverter.convertPaymentRequestForRecurringTokenPayments({
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

    const interfaceInteraction = this.buildInterfaceInteraction('CreatePayment', data, res);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: newlyCreatedPayment.id,
      pspReference: res.pspReference,
      transaction: {
        amount: amountPlanned,
        type: 'Authorization',
        state: txState,
        interactionId: res.pspReference, // Deprecated but kept for backward compatibility
        interfaceId: res.pspReference,
      },
      pspInteractions: interfaceInteraction,
    });

    log.info("Payment authorization processed for 'transaction' stored payment method", {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      interfaceId: res.pspReference,
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
    if (transactionDraft.type === 'Recurring') {
      return await this.handleTransactionRecurringType(transactionDraft);
    }

    throw new ErrorInvalidField('type', transactionDraft.type || 'not-provided', 'Recurring');
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

  /**
   * Adyen is the source of truth for *which* tokens exist for the customer (commercetools can be
   * missing tokens that were imported into Adyen from another PSP, e.g. Braintree). commercetools
   * is only the store for the metadata Adyen doesn't have (our own `id` used for delete,
   * `createdAt`, `default`). Any Adyen token without a matching record is an "orphan" and gets
   * persisted on the fly, within this same call, by reconcileOrphanAdyenToken().
   */
  async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponse> {
    const customerId = await this.getCustomerIdFromCart();
    const { paymentInterface, interfaceAccount } = getStoredPaymentMethodsConfig().config;

    // Fetched in parallel: neither call depends on the other's result.
    const [adyenTokenDetails, ctStoredPaymentMethods] = await Promise.all([
      AdyenApi().RecurringApi.getTokensForStoredPaymentDetails(customerId, getConfig().adyenMerchantAccount),
      this.ctPaymentMethodService.find({
        customerId,
        paymentInterface,
        interfaceAccount,
      }),
    ]);

    const adyenStoredPaymentMethods = adyenTokenDetails.storedPaymentMethods ?? [];

    // Nothing in Adyen means nothing to show, regardless of what commercetools has (a record without a
    // matching Adyen token is a stale/deleted token and must not be surfaced to the customer).
    if (adyenStoredPaymentMethods.length <= 0) {
      return { storedPaymentMethods: [] };
    }

    // Index commercetools records by token value so each Adyen token can find a match
    // directly, instead of scanning the array per token.
    const ctPaymentMethodByToken = new Map(
      ctStoredPaymentMethods.results.map((paymentMethod) => [paymentMethod.token?.value, paymentMethod]),
    );

    const storedPaymentMethods = await Promise.all(
      adyenStoredPaymentMethods.map((adyenToken) =>
        this.resolveStoredPaymentMethod(adyenToken, ctPaymentMethodByToken.get(adyenToken.id), {
          customerId,
          paymentInterface,
          interfaceAccount,
        }),
      ),
    );

    return {
      storedPaymentMethods: storedPaymentMethods.filter((paymentMethod) => paymentMethod !== undefined),
    };
  }

  /**
   * Turns one Adyen token into a response entry. Reconciles it into commercetools first if
   * `ctPaymentMethod` is undefined (no matching record yet). Returns undefined if reconciliation
   * fails, so this token is simply left out of the response (see reconcileOrphanAdyenToken()).
   */
  private async resolveStoredPaymentMethod(
    adyenToken: StoredPaymentMethodResource,
    ctPaymentMethod: PaymentMethod | undefined,
    context: { customerId: string; paymentInterface: string; interfaceAccount?: string },
  ): Promise<StoredPaymentMethod | undefined> {
    const paymentMethod = ctPaymentMethod ?? (await this.reconcileOrphanAdyenToken(adyenToken, context));

    return paymentMethod ? this.mapToStoredPaymentMethod(paymentMethod, adyenToken) : undefined;
  }

  /**
   * Combines the commercetools record (id, createdAt, default) with Adyen's display data
   * (brand, last four & expiry date) into the response DTO. Used for both already reconciled and
   * newly created records.
   */
  private mapToStoredPaymentMethod(
    ctPaymentMethod: PaymentMethod,
    adyenToken: StoredPaymentMethodResource,
  ): StoredPaymentMethod {
    return {
      id: ctPaymentMethod.id,
      createdAt: ctPaymentMethod.createdAt,
      isDefault: ctPaymentMethod.default,
      token: ctPaymentMethod.token?.value || adyenToken.id || '',
      type: ctPaymentMethod.method || convertPaymentMethodFromAdyenFormat(adyenToken.type as string) || '',
      displayOptions: {
        brand: {
          key: convertAdyenCardBrandToCTFormat(adyenToken.brand),
        },
        endDigits: adyenToken.lastFour,
        expiryMonth: adyenToken.expiryMonth ? Number(adyenToken.expiryMonth) : undefined,
        expiryYear: adyenToken.expiryYear ? Number(adyenToken.expiryYear) : undefined,
      },
    };
  }

  /**
   * Persists a PaymentMethod in commercetools for a token that exists in Adyen but was never
   * recorded there (e.g. imported from another PSP). Self-heals on the next call if persistence
   * fails here.
   */
  private async reconcileOrphanAdyenToken(
    adyenToken: StoredPaymentMethodResource,
    context: { customerId: string; paymentInterface: string; interfaceAccount?: string },
  ): Promise<PaymentMethod | undefined> {
    const { customerId, paymentInterface, interfaceAccount } = context;

    try {
      // Always created with default: false
      const createdPaymentMethod = await this.ctPaymentMethodService.save({
        customerId,
        token: adyenToken.id || '',
        paymentInterface,
        interfaceAccount,
        method: convertPaymentMethodFromAdyenFormat(adyenToken.type as string),
      });

      log.info('Created payment-method in commercetools for orphaned Adyen token', {
        customer: { id: customerId, type: 'customer' },
        paymentMethod: { id: createdPaymentMethod.id, type: 'payment-method' },
      });

      return createdPaymentMethod;
    } catch (error) {
      if (error instanceof ErrorInternalConstraintViolated) {
        // save() already checked for a record with this token.value and found one, a concurrent
        // request (or another in-flight tab) beat us to reconciling it. Not a real failure: fetch
        // the record that now exists instead of dropping a token the customer does have.
        return this.fetchConcurrentlyCreatedPaymentMethod(adyenToken, context);
      }

      // Any other failure (e.g. a transient commercetools outage): log and give up on this one
      // token. We deliberately don't fail the whole request for one bad token.
      // The token simply won't appear until a later call successfully reconciles it.
      log.warn('Could not create payment-method in commercetools for orphaned Adyen token; omitting from response', {
        error,
        customer: { id: customerId, type: 'customer' },
      });

      return undefined;
    }
  }

  /**
   * Fetches the commercetools record for a token that reconcileOrphanAdyenToken() failed to
   * create because it already exists: i.e. another concurrent request won the
   * race and created it first. Returns undefined if even this lookup fails, in which case the
   * token is left out of the response until a later call reconciles it successfully.
   */
  private async fetchConcurrentlyCreatedPaymentMethod(
    adyenToken: StoredPaymentMethodResource,
    context: { customerId: string; paymentInterface: string; interfaceAccount?: string },
  ): Promise<PaymentMethod | undefined> {
    const { customerId, paymentInterface, interfaceAccount } = context;

    try {
      return await this.ctPaymentMethodService.getByTokenValue({
        customerId,
        tokenValue: adyenToken.id || '',
        paymentInterface,
        interfaceAccount,
      });
    } catch (error) {
      log.warn('Could not fetch concurrently-created payment-method in commercetools for orphaned Adyen token', {
        error,
        customer: { id: customerId, type: 'customer' },
      });
      return undefined;
    }
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

    const enrichedDelivery = opts.data.deliveryMethods.map((deliveryMethod) => {
      if (deliveryMethod.selected) {
        // HINT: this computation is a walk-around to a problem we have with paypal express. An initial order is created for example with total amount 854 cents
        // If a delivery method causes a discount to be applied to the cart, the new total won't be same as the original amount + deliveryMethod.amount, which is a
        // validation paypal does on their end thus leading to a 422 error.
        //==>
        // This computation below makes sure that if there is an extra discount applied due to the selected delivery method, that the discount is subtracted from the delivery amount.
        // And thus passing this paypal total price validation. We can look into making this better in the future.
        const discount =
          opts.data.originalAmount.centAmount + (deliveryMethod.amount?.value || 0) - amountPlanned.centAmount;
        const shippingAmountWithDiscount = (deliveryMethod.amount?.value || 0) - discount;

        return {
          ...deliveryMethod,
          amount: {
            value: CurrencyConverters.convertWithMapping({
              mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
              amount: shippingAmountWithDiscount,
              currencyCode: amountPlanned.currencyCode,
            }),
            currency: amountPlanned.currencyCode,
          },
        };
      }

      return {
        ...deliveryMethod,
        amount: {
          value: CurrencyConverters.convertWithMapping({
            mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
            amount: deliveryMethod.amount?.value as number,
            currencyCode: deliveryMethod.amount?.currency as string,
          }),
          currency: deliveryMethod.amount?.currency as string,
        },
      };
    });

    const requestData: PaypalUpdateOrderRequest = {
      ...opts.data,
      deliveryMethods: enrichedDelivery,
      pspReference: opts.data.pspReference,
      amount: {
        currency: amountPlanned.currencyCode,
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: amountPlanned.centAmount,
          currencyCode: amountPlanned.currencyCode,
        }),
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
        fractionDigits: ctCart.taxedPrice?.totalGross.fractionDigits || ctCart.totalPrice.fractionDigits,
      },
      lineItems: [
        {
          name: 'Subtotal',
          amount: {
            centAmount: ctCart.taxedPrice?.totalNet.centAmount || ctCart.totalPrice.centAmount,
            currencyCode: ctCart.taxedPrice?.totalNet.currencyCode || ctCart.totalPrice.currencyCode,
            fractionDigits: ctCart.taxedPrice?.totalNet.fractionDigits || ctCart.totalPrice.fractionDigits,
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
                  fractionDigits: ctCart.taxedPrice?.totalTax?.fractionDigits || ctCart.totalPrice.fractionDigits,
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

    const { adyenRequest, adyenResponse } = await this.makeCallToAdyenInternal(interfaceId, adyenOperation, request);

    const interfaceInteraction = this.buildInterfaceInteraction(
      MODIFICATION_TYPE_MAP[adyenOperation],
      adyenRequest,
      adyenResponse,
    );

    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: transactionType,
        amount,
        interactionId: adyenResponse.pspReference, // Deprecated but kept for backward compatibility
        interfaceId: adyenResponse.pspReference,
        state: this.convertPaymentModificationOutcomeToState(PaymentModificationStatus.RECEIVED),
      },
      pspInteractions: interfaceInteraction,
    });

    return { outcome: PaymentModificationStatus.RECEIVED, pspReference: adyenResponse.pspReference };
  }

  private async makeCallToAdyenInternal(
    interfaceId: string,
    adyenOperation: 'capture' | 'refund' | 'cancel' | 'reverse',
    request: CapturePaymentRequest | CancelPaymentRequest | RefundPaymentRequest | ReversePaymentRequest,
  ): Promise<{
    adyenRequest: AdyenRequestPayload;
    adyenResponse: PaymentCaptureResponse | PaymentCancelResponse | PaymentRefundResponse;
  }> {
    try {
      switch (adyenOperation) {
        case 'capture': {
          const adyenRequest = await this.capturePaymentConverter.convertRequest(request as CapturePaymentRequest);
          const adyenResponse = await AdyenApi().ModificationsApi.captureAuthorisedPayment(interfaceId, adyenRequest);
          return { adyenRequest, adyenResponse };
        }
        case 'refund': {
          const adyenRequest = this.refundPaymentConverter.convertRequest(request as RefundPaymentRequest);
          const adyenResponse = await AdyenApi().ModificationsApi.refundCapturedPayment(interfaceId, adyenRequest);
          return { adyenRequest, adyenResponse };
        }
        case 'cancel': {
          const adyenRequest = this.cancelPaymentConverter.convertRequest(request as CancelPaymentRequest);
          const adyenResponse = await AdyenApi().ModificationsApi.cancelAuthorisedPaymentByPspReference(
            interfaceId,
            adyenRequest,
          );
          return { adyenRequest, adyenResponse };
        }
        case 'reverse': {
          const adyenRequest = this.reversePaymentConverter.convertRequest(request as ReversePaymentRequest);
          const adyenResponse = await AdyenApi().ModificationsApi.refundOrCancelPayment(interfaceId, adyenRequest);
          return { adyenRequest, adyenResponse };
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

  async checkGiftCardBalance(opts: { data: GiftCardBalanceRequestDTO }): Promise<GiftCardBalanceResponseDTO> {
    const ctCart = await this.ctCartService.getCart({ id: getCartIdFromContext() });
    const amountPlanned = await this.ctCartService.getPlannedPaymentAmount({ cart: ctCart });

    log.info('Checking gift card balance.', { paymentMethodType: opts.data.paymentMethod.type });
    const response = await this.fetchGiftCardBalance({ paymentMethod: opts.data.paymentMethod, amountPlanned });
    log.info('Gift card balance check completed.', { resultCode: response.resultCode });
    return response;
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

  /**
   * Builds the custom field update for storing Adyen Order data on a commercetools payment.
   *
   * If the payment has no custom type, returns `customFields` (setCustomType) using our own type.
   * If the payment already has our type, refreshes it via `customFields`.
   * If the payment has a merchant-owned custom type, adds our field definitions to that type
   * (idempotent) and returns `customFieldValues` (setCustomField) so the merchant's type is
   * preserved and not replaced.
   */
  private async buildAdyenOrderCustomFields(
    ctPayment: Payment,
    order: CheckoutOrderResponse,
  ): Promise<{ customFields?: CustomFieldsDraft; customFieldValues?: FieldContainer }> {
    if (!ctPayment.custom) {
      return {
        customFields: GenerateAdyenOrderDetailsCustomFieldsDraft({
          adyenOrderData: order.orderData,
          adyenOrderPspReference: order.pspReference,
        }),
      };
    }

    // Payment already has a custom type from the merchant — fetch it by ID to get its key,
    // then add our fields to it rather than replacing it
    const existingType = await paymentSDK.ctCustomTypeService.getById(ctPayment.custom.type.id);

    if (existingType.key === AdyenOrderDetailsTypeKey) {
      return {
        customFields: GenerateAdyenOrderDetailsCustomFieldsDraft({
          adyenOrderData: order.orderData,
          adyenOrderPspReference: order.pspReference,
        }),
      };
    }

    await paymentSDK.ctCustomTypeService.createOrUpdate({
      ...AdyenOrderDetailsTypeDraft,
      key: existingType.key,
    });

    return {
      customFieldValues: {
        adyenOrderData: order.orderData,
        adyenOrderPspReference: order.pspReference,
      },
    };
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
  private async applyNotificationUpdate(
    updateData: NotificationUpdatePayment,
    rawNotification?: NotificationRequestDTO,
  ): Promise<void> {
    const payment = await this.getPaymentFromNotification(updateData);
    const interfaceInteraction = rawNotification
      ? this.buildInterfaceInteraction('Notification', rawNotification, undefined)
      : undefined;
    for (let i = 0; i < updateData.transactions.length; i++) {
      const tx = updateData.transactions[i];
      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: payment.id,
        pspReference: updateData.pspReference,
        transaction: tx,
        ...(updateData.paymentMethodInfoCustomField && {
          paymentMethodInfo: { custom: updateData.paymentMethodInfoCustomField },
        }),
        ...(i === 0 && { pspInteractions: interfaceInteraction }),
      });
      log.info('Payment updated after processing the notification', {
        paymentId: updatedPayment.id,
        version: updatedPayment.version,
        pspReference: updateData.pspReference,
        paymentMethod: updateData.paymentMethod,
        transaction: JSON.stringify(tx),
      });
    }
  }

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
        id: `ct:checkout:${randomUUID()}`,
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
      interfaceId: res.pspReference,
      result: res.resultCode,
    });

    return {
      ...res,
      originalAmount: amountPlanned,
    } as CreateExpressPaymentResponseDTO;
  }

  private async processOtherExpressMethods(payload: CreatePaymentRequestDTO): Promise<CreateExpressPaymentResponseDTO> {
    let ctCart;
    ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });
    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: getConfig().paymentInterface,
        method: payload.paymentMethod?.type,
      },
      checkoutTransactionItemId: getCheckoutTransactionItemIdFromContext(),
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

    const interfaceInteraction = this.buildInterfaceInteraction('CreatePayment', data, res);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference, // Deprecated but kept for backward compatibility
        interfaceId: res.pspReference,
        state: txState,
      },
      pspInteractions: interfaceInteraction,
    });

    log.info(`Payment authorization processed.`, {
      paymentId: updatedPayment.id,
      interactionId: res.pspReference,
      interfaceId: res.pspReference,
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

  private async getAmountToPay(opts: {
    isSplitPayment: boolean;
    paymentMethod: Record<string, string>;
    cart: Cart;
  }): Promise<PaymentAmount> {
    const cartAmount = await this.ctCartService.getPaymentAmount({ cart: opts.cart });

    if (opts.isSplitPayment) {
      const balanceResponse = await this.fetchGiftCardBalance({
        paymentMethod: opts.paymentMethod,
        amountPlanned: cartAmount,
      });
      if (balanceResponse.balance && balanceResponse.balance.value > 0) {
        return {
          centAmount: Math.min(balanceResponse.balance.value, cartAmount.centAmount),
          currencyCode: balanceResponse.balance.currency,
          fractionDigits: cartAmount.fractionDigits,
        };
      }
    }

    return cartAmount;
  }

  private async fetchGiftCardBalance(opts: {
    paymentMethod: Record<string, string>;
    amountPlanned: { centAmount: number; currencyCode: string };
  }): Promise<GiftCardBalanceResponseDTO> {
    const request = this.balanceCheckConverter.convertRequest({
      data: { paymentMethod: opts.paymentMethod },
      amountPlanned: opts.amountPlanned,
    });
    try {
      return await AdyenApi().OrdersApi.getBalanceOfGiftCard(request);
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  private buildInterfaceInteraction(
    type: string,
    request: AdyenRequestPayload,
    response: AdyenResponsePayload | undefined,
  ) {
    return populateInterfaceInteraction({
      interactionId: randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      request,
      response,
    });
  }
}
