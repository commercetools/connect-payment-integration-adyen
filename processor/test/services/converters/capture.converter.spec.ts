import { describe, test, expect } from '@jest/globals';
import {
  CapturePaymentConverter,
  METHODS_REQUIRE_LINE_ITEMS,
} from '../../../src/services/converters/capture-payment.converter';
import { paymentSDK } from '../../../src/payment-sdk';
import { mockGetPaymentResult } from '../../utils/mock-payment-data';
import { config } from '../../../src/config/config';

describe('capture.converter', () => {
  const converter = new CapturePaymentConverter(paymentSDK.ctCartService, paymentSDK.ctOrderService);
  test('METHODS_REQUIRE_LINE_ITEMS', () => {
    const expected = ['klarna', 'klarna_account', 'klarna_paynow', 'klarna_b2b'];
    expect(METHODS_REQUIRE_LINE_ITEMS).toEqual(expected);
  });

  test('convert with checkout merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;
    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
    };

    // Act
    const result = await converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: mockGetPaymentResult.id,
      amount: {
        currency: mockGetPaymentResult.amountPlanned.currencyCode,
        value: mockGetPaymentResult.amountPlanned.centAmount,
      },
    });
  });

  test('convert with custom merchant reference', async () => {
    // Arrange
    const payment = mockGetPaymentResult;
    const data = {
      amount: mockGetPaymentResult.amountPlanned,
      payment,
      merchantReference: 'merchantReference',
    };

    // Act
    const result = await converter.convertRequest(data);

    // Assert
    expect(result).toEqual({
      merchantAccount: config.adyenMerchantAccount,
      reference: 'merchantReference',
      amount: {
        currency: mockGetPaymentResult.amountPlanned.currencyCode,
        value: mockGetPaymentResult.amountPlanned.centAmount,
      },
    });
  });
});
