import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';
import { paymentSDK } from '../payment-sdk';
import { AdyenPaymentService } from '../services/adyen-payment.service';

const paymentService = new AdyenPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctOrderService: paymentSDK.ctOrderService,
});

export const app = {
  services: {
    paymentService,
  },
  hooks: {
    hmacAuthHook: new HmacAuthHook(),
  },
};
