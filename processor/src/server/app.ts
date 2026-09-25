import { config } from '../config/config';
import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';
import { HmacHeaderAuthHook } from '../libs/fastify/hooks/hmac-header-auth.hook';
import { paymentSDK } from '../payment-sdk';
import { AdyenDonationService } from '../services/adyen-donation.service';
import { AdyenOrderService } from '../services/adyen-order.service';
import { AdyenPaymentService } from '../services/adyen-payment.service';

const orderService = new AdyenOrderService({
  ctCartService: paymentSDK.ctCartService,
});

const donationService = new AdyenDonationService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
});

const paymentService = new AdyenPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctOrderService: paymentSDK.ctOrderService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
  ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService,
  orderService,
});

export const app = {
  services: {
    paymentService,
    orderService,
    donationService,
  },
  hooks: {
    hmacAuthHook: new HmacAuthHook(config.adyenHMACKey),
    donationHmacAuthHook: new HmacAuthHook(config.adyenHMACDonationWebHooksKey ?? config.adyenHMACKey),
    hmacHeaderAuthHook: new HmacHeaderAuthHook(config.adyenHMACTokenizationWebHooksKey ?? config.adyenHMACKey),
  },
};
