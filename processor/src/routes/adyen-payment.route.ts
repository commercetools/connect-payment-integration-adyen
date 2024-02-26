import { SessionAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  ConfirmPaymentRequestDTO,
  ConfirmPaymentResponseDTO,
  CreatePaymentRequestDTO,
  CreatePaymentResponseDTO,
  CreateSessionRequestDTO,
  CreateSessionResponseDTO,
  PaymentNotificationSchemaDTO,
} from '../dtos/adyen-payment.dto';
import { AdyenPaymentService } from '../services/adyen-payment.service';
import { config } from '../config/config';

const ACK_NOTIFICATION = '[accepted]';

type PaymentRoutesOptions = {
  paymentService: AdyenPaymentService;
  sessionAuthHook: SessionAuthenticationHook;
};

export const adyenPaymentRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PaymentRoutesOptions,
) => {
  /**
   * Listen to the notification from Adyen
   */
  fastify.post<{ Body: PaymentNotificationSchemaDTO; Reply: any }>('/notifications', {}, async (request, reply) => {
    await opts.notificationService.processNotification({
      data: request.body,
    });

    return reply.status(200).send(ACK_NOTIFICATION);
  });

  fastify.post<{ Body: CreateSessionRequestDTO; Reply: CreateSessionResponseDTO }>(
    '/payment-sessions',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createSession({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.post<{ Body: CreatePaymentRequestDTO; Reply: CreatePaymentResponseDTO }>(
    '/payments',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.get<{ Reply: ConfirmPaymentResponseDTO }>('/payments/confirmations', {}, async (request, reply) => {
    const queryParams = request.query as any;
    const res = await opts.paymentService.confirmPayment({
      data: {
        details: {
          redirectResult: queryParams.redirectResult as string,
        },
        paymentReference: queryParams.paymentReference as string,
      },
    });

    return reply.redirect(buildRedirectUrl(res.paymentReference));
  });

  fastify.post<{ Body: ConfirmPaymentRequestDTO; Reply: ConfirmPaymentResponseDTO }>(
    '/payments/confirmations',
    {},
    async (request, reply) => {
      const res = await opts.paymentService.confirmPayment({
        data: request.body,
      });
      return reply.status(200).send(res);
    },
  );
};

const buildRedirectUrl = (paymentReference: string) => {
  const redirectUrl = new URL(config.merchantReturnUrl);
  redirectUrl.searchParams.append('paymentReference', paymentReference);
  return redirectUrl.toString();
};
