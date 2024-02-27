import { SessionAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
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
import { AdyenPaymentService } from '../services/adyen-payment.service';
import { config } from '../config/config';
import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';

type PaymentRoutesOptions = {
  paymentService: AdyenPaymentService;
  sessionAuthHook: SessionAuthenticationHook;
  hmacAuthHook: HmacAuthHook;
};

export const adyenPaymentRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PaymentRoutesOptions,
) => {
  fastify.post<{ Body: PaymentMethodsRequestDTO; Reply: PaymentMethodsResponseDTO }>(
    '/payment-methods',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
    },
    async (request, reply) => {
      const resp = await opts.paymentService.getPaymentMethods({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.post<{ Body: CreateSessionRequestDTO; Reply: CreateSessionResponseDTO }>(
    '/sessions',
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

  fastify.get<{ Reply: ConfirmPaymentResponseDTO }>('/payments/details', {}, async (request, reply) => {
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
    '/payments/details',
    {},
    async (request, reply) => {
      const res = await opts.paymentService.confirmPayment({
        data: request.body,
      });
      return reply.status(200).send(res);
    },
  );

  fastify.post<{ Body: NotificationRequestDTO }>(
    '/notifications',
    {
      preHandler: [opts.hmacAuthHook.authenticate()],
    },
    async (request, reply) => {
      await opts.notificationService.processNotification({
        data: request.body,
      });

      return reply.status(200).send('[accepted]');
    },
  );
};

const buildRedirectUrl = (paymentReference: string) => {
  const redirectUrl = new URL(config.merchantReturnUrl);
  redirectUrl.searchParams.append('paymentReference', paymentReference);
  return redirectUrl.toString();
};
