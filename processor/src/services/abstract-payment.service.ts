import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorInvalidJsonInput,
  ErrorInvalidOperation,
  Payment,
} from '@commercetools/connect-payments-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  ModifyPayment,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  StatusResponse,
} from './types/operation.type';
import {
  AmountSchemaDTO,
  PaymentIntentResponseSchemaDTO,
  PaymentModificationStatus,
} from '../dtos/operations/payment-intents.dto';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { log } from '../libs/logger';

export abstract class AbstractPaymentService {
  protected ctCartService: CommercetoolsCartService;
  protected ctPaymentService: CommercetoolsPaymentService;
  constructor(ctCartService: CommercetoolsCartService, ctPaymentService: CommercetoolsPaymentService) {
    this.ctCartService = ctCartService;
    this.ctPaymentService = ctPaymentService;
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

  public async modifyPayment(opts: ModifyPayment): Promise<PaymentIntentResponseSchemaDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.paymentId,
    });

    const request = opts.data.actions[0];

    let requestAmount!: AmountSchemaDTO;
    if (request.action != 'cancelPayment') {
      requestAmount = request.amount;
    } else {
      requestAmount = ctPayment.amountPlanned;
    }

    const transactionType = this.getPaymentTransactionType(request.action);

    let updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      transaction: {
        type: transactionType,
        amount: requestAmount,
        state: 'Initial',
      },
    });

    log.info(`Processing payment modification.`, {
      paymentId: updatedPayment.id,
      action: request.action,
    });

    const res = await this.processPaymentModification(updatedPayment, transactionType, requestAmount);

    updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      transaction: {
        type: transactionType,
        amount: requestAmount,
        interactionId: res.pspReference,
        state: this.convertPaymentModificationOutcomeToState(res.outcome),
      },
    });

    log.info(`Payment modification completed.`, {
      paymentId: updatedPayment.id,
      action: request.action,
      result: res.outcome,
    });

    return {
      outcome: res.outcome,
    };
  }

  protected getPaymentTransactionType(action: string): string {
    switch (action) {
      case 'cancelPayment': {
        return 'CancelAuthorization';
      }
      case 'capturePayment': {
        return 'Charge';
      }
      case 'refundPayment': {
        return 'Refund';
      }
      default: {
        log.error(`Operation ${action} not supported when modifying payment.`);
        throw new ErrorInvalidJsonInput(`Request body does not contain valid JSON.`);
      }
    }
  }

  protected async processPaymentModification(
    payment: Payment,
    transactionType: string,
    requestAmount: AmountSchemaDTO,
  ) {
    switch (transactionType) {
      case 'CancelAuthorization': {
        const validation = this.ctPaymentService.validatePaymentCancelAuthorization({ payment });
        if (!validation.isValid) {
          log.error(`Payment can not be cancelled. ${validation.reason}`, { paymentId: payment.id });
          throw new ErrorInvalidOperation(validation.reason || 'Payment can not be cancelled.');
        }
        return await this.cancelPayment({ payment });
      }
      case 'Charge': {
        const validation = this.ctPaymentService.validatePaymentCharge({ payment, amount: requestAmount });
        if (!validation.isValid) {
          log.error(`Payment can not be charged. ${validation.reason}`, {
            paymentId: payment.id,
            amount: requestAmount,
          });
          throw new ErrorInvalidOperation(validation.reason || 'Payment can not be charged.');
        }
        return await this.capturePayment({ amount: requestAmount, payment });
      }
      case 'Refund': {
        const validation = this.ctPaymentService.validatePaymentRefund({ payment, amount: requestAmount });
        if (!validation.isValid) {
          log.error(`Payment can not be refunded. ${validation.reason}`, {
            paymentId: payment.id,
            amount: requestAmount,
          });
          throw new ErrorInvalidOperation(validation.reason || 'Payment can not be refunded.');
        }
        return await this.refundPayment({ amount: requestAmount, payment });
      }
      default: {
        throw new ErrorInvalidOperation(`Operation ${transactionType} not supported.`);
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
