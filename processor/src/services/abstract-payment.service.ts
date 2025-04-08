import {
  CommercetoolsCartService,
  CommercetoolsOrderService,
  CommercetoolsPaymentService,
  ErrorInvalidOperation,
} from '@commercetools/connect-payments-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  ModifyPayment,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';
import { PaymentIntentResponseSchemaDTO, PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { log } from '../libs/logger';

export abstract class AbstractPaymentService {
  protected ctCartService: CommercetoolsCartService;
  protected ctPaymentService: CommercetoolsPaymentService;
  protected ctOrderService: CommercetoolsOrderService;

  constructor(
    ctCartService: CommercetoolsCartService,
    ctPaymentService: CommercetoolsPaymentService,
    ctOrderService: CommercetoolsOrderService,
  ) {
    this.ctCartService = ctCartService;
    this.ctPaymentService = ctPaymentService;
    this.ctOrderService = ctOrderService;
  }

  /**
   * Get configuration information
   * @returns
   */
  abstract config(): Promise<ConfigResponse>;

  /**
   * Get stats information
   * @returns
   */
  abstract status(): Promise<StatusResponse>;

  /**
   * Get supported payment components by the processor
   */
  abstract getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO>;

  /**
   * Capture payment
   * @param request
   * @returns
   */
  abstract capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Cancel payment
   * @param request
   * @returns
   */
  abstract cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Refund payment
   * @param request
   * @returns
   */
  abstract refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Reverse payment
   *
   * @remarks
   * Abstract method to execute payment reversals in support of automated reversals to be triggered by checkout api. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request
   * @returns Promise with outcome containing operation status and PSP reference
   */
  abstract reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse>;

  public async modifyPayment(opts: ModifyPayment): Promise<PaymentIntentResponseSchemaDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.paymentId,
    });

    const request = opts.data.actions[0];

    switch (request.action) {
      case 'cancelPayment': {
        return await this.cancelPayment({ payment: ctPayment, merchantReference: request.merchantReference });
      }
      case 'capturePayment': {
        return await this.capturePayment({
          payment: ctPayment,
          merchantReference: request.merchantReference,
          amount: request.amount,
        });
      }
      case 'refundPayment': {
        return await this.refundPayment({
          amount: request.amount,
          payment: ctPayment,
          merchantReference: request.merchantReference,
        });
      }
      case 'reversePayment': {
        return await this.reversePayment({
          payment: ctPayment,
          merchantReference: request.merchantReference,
        });
      }
      default: {
        log.error(`Operation not supported when modifying payment.`);
        throw new ErrorInvalidOperation(`Operation not supported.`);
      }
    }
  }

  protected convertPaymentModificationOutcomeToState(
    outcome: PaymentModificationStatus,
  ): 'Pending' | 'Success' | 'Failure' {
    if (outcome === PaymentModificationStatus.RECEIVED) {
      return 'Pending';
    } else if (outcome === PaymentModificationStatus.APPROVED) {
      return 'Success';
    } else {
      return 'Failure';
    }
  }
}
