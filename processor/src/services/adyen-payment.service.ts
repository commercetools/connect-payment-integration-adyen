import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorInvalidOperation,
  healthCheckCommercetoolsPermissions,
  statusHandler,
  Cart,
  Payment,
} from '@commercetools/connect-payments-sdk';
import {
  ConfirmPaymentRequestDTO,
  ConfirmPaymentResponseDTO,
  CreatePaymentRequestDTO,
  CreatePaymentResponseDTO,
  CreateSessionRequestDTO,
  CreateSessionResponseDTO,
  NotificationRequestDTO,
  PaymentMethodsRequestDTO,
  PaymentMethodsResponseDTO,
} from '../dtos/adyen-payment.dto';
import { AdyenApi, wrapAdyenError } from '../clients/adyen.client';
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
  StatusResponse,
} from './types/operation.type';
import { getConfig, config } from '../config/config';
import { paymentSDK } from '../payment-sdk';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { AbstractPaymentService } from './abstract-payment.service';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { PaymentDetailsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsResponse';
import { CancelPaymentConverter } from './converters/cancel-payment.converter';
import { RefundPaymentConverter } from './converters/refund-payment.converter';
const packageJSON = require('../../package.json');

export type AdyenPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export class AdyenPaymentService extends AbstractPaymentService {
  private paymentMethodsConverter: PaymentMethodsConverter;
  private createSessionConverter: CreateSessionConverter;
  private createPaymentConverter: CreatePaymentConverter;
  private confirmPaymentConverter: ConfirmPaymentConverter;
  private notificationConverter: NotificationConverter;
  private paymentComponentsConverter: PaymentComponentsConverter;
  private cancelPaymentConverter: CancelPaymentConverter;
  private capturePaymentConverter: CapturePaymentConverter;
  private refundPaymentConverter: RefundPaymentConverter;

  constructor(opts: AdyenPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.paymentMethodsConverter = new PaymentMethodsConverter(this.ctCartService);
    this.createSessionConverter = new CreateSessionConverter();
    this.createPaymentConverter = new CreatePaymentConverter();
    this.confirmPaymentConverter = new ConfirmPaymentConverter();
    this.notificationConverter = new NotificationConverter();
    this.paymentComponentsConverter = new PaymentComponentsConverter();
    this.cancelPaymentConverter = new CancelPaymentConverter();
    this.capturePaymentConverter = new CapturePaymentConverter();
    this.refundPaymentConverter = new RefundPaymentConverter();
  }
  async config(): Promise<ConfigResponse> {
    return {
      clientKey: getConfig().adyenClientKey,
      environment: getConfig().adyenEnvironment,
    };
  }

  async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: config.healthCheckTimeout,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: ['manage_payments', 'view_sessions', 'view_api_clients'],
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
              details: {
                error: e,
              },
            };
          }
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

    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });
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
      ...(ctCart.anonymousId && {
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
        sessionData: res,
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
      ctPayment = await this.ctPaymentService.getPayment({
        id: opts.data.paymentReference,
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
        },
        ...(ctCart.customerId && {
          customer: {
            typeId: 'customer',
            id: ctCart.customerId,
          },
        }),
        ...(ctCart.anonymousId && {
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
    const data = this.createPaymentConverter.convertRequest({
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
      paymentMethod: res.paymentMethod?.type, //TODO: should be converted to a standard format? i.e scheme to card
      transaction: {
        type: 'Authorization', //TODO: is there any case where this could be a direct charge?
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: txState,
      },
    });

    return {
      ...res,
      paymentReference: updatedPayment.id,
      ...(txState === 'Success' || txState === 'Pending'
        ? { merchantReturnUrl: this.buildRedirectMerchantUrl(updatedPayment.id) }
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
      paymentMethod: res.paymentMethod?.type, //TODO:review
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: this.convertAdyenResultCode(res.resultCode as PaymentResponse.ResultCodeEnum, false),
      },
    });
    return {
      ...res,
      paymentReference: updatedPayment.id,
      merchantReturnUrl: this.buildRedirectMerchantUrl(updatedPayment.id),
    } as ConfirmPaymentResponseDTO;
  }

  public async processNotification(opts: { data: NotificationRequestDTO }): Promise<void> {
    const updateData = await this.notificationConverter.convert(opts);
    await this.ctPaymentService.updatePayment(updateData);
  }

  async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    try {
      const res = await AdyenApi().ModificationsApi.captureAuthorisedPayment(
        interfaceId,
        this.capturePaymentConverter.convertRequest(request),
      );

      return { outcome: PaymentModificationStatus.RECEIVED, pspReference: res.pspReference };
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    try {
      const res = await AdyenApi().ModificationsApi.cancelAuthorisedPaymentByPspReference(
        interfaceId,
        this.cancelPaymentConverter.convertRequest(request),
      );
      return { outcome: PaymentModificationStatus.RECEIVED, pspReference: res.pspReference };
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    try {
      const res = await AdyenApi().ModificationsApi.refundCapturedPayment(
        interfaceId,
        this.refundPaymentConverter.convertRequest(request),
      );
      return { outcome: PaymentModificationStatus.RECEIVED, pspReference: res.pspReference };
    } catch (e) {
      throw wrapAdyenError(e);
    }
  }

  private convertAdyenResultCode(resultCode: PaymentResponse.ResultCodeEnum, isActionRequired: boolean): string {
    if (resultCode === PaymentResponse.ResultCodeEnum.Authorised) {
      return 'Success';
    } else if (resultCode === PaymentResponse.ResultCodeEnum.Pending && !isActionRequired) {
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

  private buildRedirectMerchantUrl(paymentReference: string): string {
    const merchantReturnUrl = getMerchantReturnUrlFromContext() || config.merchantReturnUrl;
    const redirectUrl = new URL(merchantReturnUrl);
    redirectUrl.searchParams.append('paymentReference', paymentReference);
    return redirectUrl.toString();
  }
}
