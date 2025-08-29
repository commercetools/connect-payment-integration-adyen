import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';
import { HmacHeaderAuthHook } from '../libs/fastify/hooks/hmac-header-auth.hook';
import { paymentSDK } from '../payment-sdk';
import { AdyenPaymentService } from '../services/adyen-payment.service';

const paymentService = new AdyenPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctOrderService: paymentSDK.ctOrderService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
});

export const app = {
  services: {
    paymentService,
  },
  hooks: {
    hmacAuthHook: new HmacAuthHook(),
    hmacHeaderAuthHook: new HmacHeaderAuthHook(),
  },
};
