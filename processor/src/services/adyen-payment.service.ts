import { CommercetoolsCartService, CommercetoolsPaymentService } from '@commercetools/connect-payments-sdk';
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
import { AdyenApi } from '../clients/adyen.client';
import { getCartIdFromContext, getPaymentInterfaceFromContext } from '../libs/fastify/context/context';
import { CreateSessionConverter } from './converters/create-session.converter';
import { CreatePaymentConverter } from './converters/create-payment.converter';
import { ConfirmPaymentConverter } from './converters/confirm-payment.converter';
import { NotificationConverter } from './converters/notification.converter';
import { PaymentMethodsConverter } from './converters/payment-methods.converter';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { log } from 'console';

export type AdyenPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export class AdyenPaymentService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;
  private paymentMethodsConverter: PaymentMethodsConverter;
  private createSessionConverter: CreateSessionConverter;
  private createPaymentConverter: CreatePaymentConverter;
  private confirmPaymentConverter: ConfirmPaymentConverter;
  private notificationConverter: NotificationConverter;

  constructor(opts: AdyenPaymentServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.paymentMethodsConverter = new PaymentMethodsConverter(this.ctCartService);
    this.createSessionConverter = new CreateSessionConverter();
    this.createPaymentConverter = new CreatePaymentConverter();
    this.confirmPaymentConverter = new ConfirmPaymentConverter();
    this.notificationConverter = new NotificationConverter();
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
      log('Adyen getPaymentMethods error', e);
      throw e;
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

    const adyenRequestData = await this.createSessionConverter.convert({
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
      log('Adyen createSession error', e);
      throw e;
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

    const data = await this.createPaymentConverter.convert({
      data: opts.data,
      cart: ctCart,
      payment: ctPayment,
    });

    const res = await AdyenApi().PaymentsApi.payments(data);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      paymentMethod: res.paymentMethod?.type, //TODO: review
      transaction: {
        type: 'Authorization', //TODO: review
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: this.convertAdyenResultCode(res.resultCode as PaymentResponse.ResultCodeEnum),
      },
    });

    return {
      ...res,
      paymentReference: updatedPayment.id,
    } as CreatePaymentResponseDTO;
  }

  public async confirmPayment(opts: { data: ConfirmPaymentRequestDTO }): Promise<ConfirmPaymentResponseDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.data.paymentReference,
    });

    const data = await this.confirmPaymentConverter.convert({
      data: opts.data,
    });
    const res = await AdyenApi().PaymentsApi.paymentsDetails(data);

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: res.pspReference,
      paymentMethod: res.paymentMethod?.type, //TODO:review
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: res.pspReference,
        state: this.convertAdyenResultCode(res.resultCode as PaymentResponse.ResultCodeEnum),
      },
    });
    return {
      ...res,
      paymentReference: updatedPayment.id,
    } as ConfirmPaymentResponseDTO;
  }

  public async processNotification(opts: { data: NotificationRequestDTO }): Promise<void> {
    const updateData = await this.notificationConverter.convert(opts);
    await this.ctPaymentService.updatePayment(updateData);
  }

  private convertAdyenResultCode(resultCode: PaymentResponse.ResultCodeEnum): string {
    switch (resultCode) {
      case PaymentResponse.ResultCodeEnum.Authorised:
        return 'Success';
      case PaymentResponse.ResultCodeEnum.Pending:
        return 'Pending';
      case PaymentResponse.ResultCodeEnum.Refused:
      case PaymentResponse.ResultCodeEnum.Error:
      case PaymentResponse.ResultCodeEnum.Cancelled:
        return 'Failure';
      default:
        return 'Initial';
    }
  }
}
