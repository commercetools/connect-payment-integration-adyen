import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { adyenPaymentRoutes } from '../../routes/adyen-payment.route';
import { app } from '../app';

export default async function (server: FastifyInstance) {
  await server.register(adyenPaymentRoutes, {
    paymentService: app.services.paymentService,
    sessionAuthHook: paymentSDK.sessionAuthHookFn,
    hmacAuthHook: app.hooks.hmacAuthHook,
  });
}
