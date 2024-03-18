import {
  SessionHeaderAuthenticationHook,
  SessionQueryParamAuthenticationHook,
} from '@commercetools/connect-payments-sdk';
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
import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';

type PaymentRoutesOptions = {
  paymentService: AdyenPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
  sessionQueryParamAuthHook: SessionQueryParamAuthenticationHook;
  hmacAuthHook: HmacAuthHook;
};

export const adyenPaymentRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PaymentRoutesOptions,
) => {
  fastify.post<{ Body: PaymentMethodsRequestDTO; Reply: PaymentMethodsResponseDTO }>(
    '/payment-methods',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
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
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
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
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.get<{
    Reply: ConfirmPaymentResponseDTO;
    Querystring: {
      paymentReference: string;
      redirectResult?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  }>(
    '/payments/details',
    {
      preHandler: [opts.sessionQueryParamAuthHook.authenticate()],
    },
    async (request, reply) => {
      const queryParams = request.query as any;
      const res = await opts.paymentService.confirmPayment({
        data: {
          details: {
            redirectResult: queryParams.redirectResult as string,
          },
          paymentReference: queryParams.paymentReference as string,
        },
      });

      return reply.redirect(res.merchantReturnUrl);
    },
  );

  fastify.post<{ Body: ConfirmPaymentRequestDTO; Reply: ConfirmPaymentResponseDTO }>(
    '/payments/details',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
    },
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
      await opts.paymentService.processNotification({
        data: request.body,
      });

      return reply.status(200).send('[accepted]');
    },
  );
};
