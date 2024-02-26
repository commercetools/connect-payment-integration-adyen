import { healthCheckCommercetoolsPermissions, statusHandler } from '@commercetools/connect-payments-sdk';
import { AdyenApi } from '../../clients/adyen.client';
import { config } from '../../config/config';
import { PaymentModificationStatus } from '../../dtos/operations/payment-intents.dto';
import { paymentSDK } from '../../payment-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  StatusResponse,
} from '../types/operation.type';
import { OperationProcessor } from './operation.processor';
import { log } from '../../libs/logger';
const packageJSON = require('../../../package.json');

export class AdyenOperationProcessor implements OperationProcessor {
  async config(): Promise<ConfigResponse> {
    return {
      clientKey: config.adyenClientKey,
      environment: config.adyenEnvironment,
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
              data: {
                paymentMethods: result.paymentMethods,
              },
            };
          } catch (e) {
            return {
              name: 'Adyen Status check',
              status: 'DOWN',
              data: {
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

  async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    try {
      await AdyenApi().ModificationsApi.captureAuthorisedPayment(interfaceId, {
        amount: {
          value: request.amount.centAmount,
          currency: request.amount.currencyCode,
        },
        merchantAccount: config.adyenMerchantAccount,
        reference: interfaceId,
      });
      return { outcome: PaymentModificationStatus.RECEIVED, pspReference: interfaceId };
    } catch (e) {
      log.error('Error capturing payment', e);
      return { outcome: PaymentModificationStatus.REJECTED, pspReference: interfaceId };
    }
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    try {
      await AdyenApi().ModificationsApi.cancelAuthorisedPaymentByPspReference(interfaceId, {
        merchantAccount: config.adyenMerchantAccount,
        reference: interfaceId,
      });
      return { outcome: PaymentModificationStatus.RECEIVED, pspReference: interfaceId };
    } catch (e) {
      log.error('Error cancelling payment', e);
      return { outcome: PaymentModificationStatus.REJECTED, pspReference: interfaceId };
    }
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    try {
      await AdyenApi().ModificationsApi.refundCapturedPayment(interfaceId, {
        amount: {
          value: request.amount.centAmount,
          currency: request.amount.currencyCode,
        },
        merchantAccount: config.adyenMerchantAccount,
        reference: request.payment.id,
      });
      return { outcome: PaymentModificationStatus.RECEIVED, pspReference: interfaceId };
    } catch (e) {
      log.error('Error refunding payment', e);
      return { outcome: PaymentModificationStatus.REJECTED, pspReference: interfaceId };
    }
  }
}
