import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { adyenPaymentRoutes } from '../../routes/adyen-payment.route';
import { AdyenPaymentService } from '../../services/adyen-payment.service';
import { HmacAuthHook } from '../../libs/fastify/hooks/hmac-auth.hook';

export default async function (server: FastifyInstance) {
  const paymentService = new AdyenPaymentService({
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
  });

  await server.register(adyenPaymentRoutes, {
    paymentService,
    sessionAuthHook: paymentSDK.sessionAuthHookFn,
    hmacAuthHook: new HmacAuthHook(),
  });
}
