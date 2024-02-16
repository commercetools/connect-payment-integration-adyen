import { healthCheckCommercetoolsPermissions, statusHandler } from '@commercetools/connect-payments-sdk';
import { AdyenAPI } from '../../clients/adyen/adyen.client';
import { config } from '../../config/config';
import { PaymentModificationStatus } from '../../dtos/operations/payment-intents.dto';
import { paymentSDK } from '../../payment-sdk';
import { OperationProcessor } from './operation.processor';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  StatusResponse,
} from '../types/operation.type';
const packageJSON = require('../../package.json');

export class MockOperationProcessor implements OperationProcessor {
  async config(): Promise<ConfigResponse> {
    return {
      clientKey: config.adyenClientKey,
      environment: config.adyenEnvironment,
      returnUrl: config.returnUrl,
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
            const result = await AdyenAPI().PaymentsApi.paymentMethods({
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
    await AdyenAPI().ModificationsApi.captureAuthorisedPayment(interfaceId, {
      amount: {
        value: request.amount.amount,
        currency: request.amount.currency,
      },
      merchantAccount: config.adyenMerchantAccount,
      reference: interfaceId,
    });
    return { outcome: PaymentModificationStatus.RECEIVED, pspReference: interfaceId };
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    await AdyenAPI().ModificationsApi.cancelAuthorisedPaymentByPspReference(interfaceId, {
      merchantAccount: config.adyenMerchantAccount,
      reference: interfaceId,
    });
    return { outcome: PaymentModificationStatus.RECEIVED, pspReference: interfaceId };
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const interfaceId = request.payment.interfaceId as string;
    await AdyenAPI().ModificationsApi.refundCapturedPayment(interfaceId, {
      amount: {
        value: request.amount.amount,
        currency: request.amount.currency,
      },
      merchantAccount: config.adyenMerchantAccount,
      reference: request.payment.id,
    });
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: interfaceId };
  }
}
