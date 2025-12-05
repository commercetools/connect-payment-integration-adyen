import { paymentMethodConfig } from '../../src/config/payment-method.config';

describe('payment-method.config', () => {
  test('should have the specific config per payment method types set', async () => {
    expect(paymentMethodConfig).toStrictEqual({
      bcmc: {
        supportSeparateCapture: false,
      },
      bcmc_mobile: {
        supportSeparateCapture: false,
      },
      blik: {
        supportSeparateCapture: false,
      },
      eps: {
        supportSeparateCapture: false,
      },
      molpay_ebanking_fpx_MY: {
        supportSeparateCapture: false,
      },
      ideal: {
        supportSeparateCapture: false,
      },
      onlineBanking_PL: {
        supportSeparateCapture: false,
      },
      swish: {
        supportSeparateCapture: false,
      },
    });
  });
});
