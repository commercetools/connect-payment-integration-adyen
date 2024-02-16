import { SessionAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PaymentNotificationSchemaDTO } from '../dtos/adyen-payment.dts';
import { AdyenPaymentService } from '../services/adyen-payment.service';

const ACK_NOTIFICATION = '[accepted]';

type PaymentRoutesOptions = {
  paymentService: AdyenPaymentService;
  sessionAuthHook: SessionAuthenticationHook;
};

export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  /**
   * Listen to the notification from Adyen
   */
  fastify.post<{ Body: PaymentNotificationSchemaDTO; Reply: any }>('/notifications', {}, async (request, reply) => {
    await opts.notificationService.processNotification({
      data: request.body,
    });

    return reply.status(200).send(ACK_NOTIFICATION);
  });
};
