import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';
import { HmacHeaderAuthHook } from '../libs/fastify/hooks/hmac-header-auth.hook';
import { paymentSDK } from '../payment-sdk';
import { AdyenOrderService } from '../services/adyen-order.service';
import { AdyenPaymentService } from '../services/adyen-payment.service';

const orderService = new AdyenOrderService({
  ctCartService: paymentSDK.ctCartService,
});

const paymentService = new AdyenPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctOrderService: paymentSDK.ctOrderService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
  orderService,
});

export const app = {
  services: {
    paymentService,
    orderService,
  },
  hooks: {
    hmacAuthHook: new HmacAuthHook(),
    hmacHeaderAuthHook: new HmacHeaderAuthHook(),
  },
};
