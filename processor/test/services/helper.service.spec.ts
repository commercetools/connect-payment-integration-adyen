import { afterEach, describe, test, expect, jest } from '@jest/globals';
import { Payment, Type } from '@commercetools/connect-payments-sdk';
import * as Config from '../../src/config/config';
import { AdyenPaymentDetailsTypeKey } from '../../src/custom-types/adyen-payment-details';
import { paymentSDK } from '../../src/payment-sdk';
import {
  buildAdyenPaymentCustomFields,
  populateInterfaceInteraction,
  maskRequest,
  maskResponse,
} from '../../src/services/helper.service';
import { mockGetPaymentResult } from '../utils/mock-payment-data';
import { CardDetails } from '@adyen/api-library/lib/src/typings/checkout/cardDetails';
import { ApplePayDetails } from '@adyen/api-library/lib/src/typings/checkout/applePayDetails';
import { PayWithGoogleDetails } from '@adyen/api-library/lib/src/typings/checkout/payWithGoogleDetails';
import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { NotificationRequestDTO } from '../../src/dtos/adyen-payment.dto';

describe('maskRequest', () => {
  test('encrypted card: masks all paymentMethod fields except type', () => {
    // Arrange
    const paymentMethod: CardDetails = {
      type: CardDetails.TypeEnum.Scheme,
      encryptedCardNumber: 'test_4111111111111111',
      encryptedExpiryMonth: 'test_03',
      encryptedExpiryYear: 'test_2030',
      encryptedSecurityCode: 'test_737',
    };
    const input: PaymentRequest = {
      amount: { currency: 'USD', value: 1000 },
      reference: 'Your order number',
      paymentMethod,
      returnUrl: 'https://your-company.example.com/...',
      merchantAccount: 'YOUR_MERCHANT_ACCOUNT',
    };

    // Act
    const result = maskRequest(input);

    // Assert
    expect(result).toEqual({
      amount: { currency: 'USD', value: 1000 },
      reference: 'Your order number',
      paymentMethod: {
        type: CardDetails.TypeEnum.Scheme,
        encryptedCardNumber: '***',
        encryptedExpiryMonth: '***',
        encryptedExpiryYear: '***',
        encryptedSecurityCode: '***',
      },
      returnUrl: 'https://your-company.example.com/...',
      merchantAccount: 'YOUR_MERCHANT_ACCOUNT',
    });
  });

  test('plain card: masks number, cvc and all paymentMethod fields except type', () => {
    // Arrange
    const paymentMethod: CardDetails = {
      type: CardDetails.TypeEnum.Scheme,
      number: '4111111111111111',
      holderName: 'John Smith',
      cvc: '737',
    };
    const input: PaymentRequest = {
      amount: { currency: 'USD', value: 1000 },
      reference: 'Your order number',
      paymentMethod,
      returnUrl: 'https://your-company.example.com/...',
      merchantAccount: 'YOUR_MERCHANT_ACCOUNT',
    };

    // Act
    const result = maskRequest(input);

    // Assert
    expect(result).toEqual({
      amount: { currency: 'USD', value: 1000 },
      reference: 'Your order number',
      paymentMethod: {
        type: CardDetails.TypeEnum.Scheme,
        number: '***',
        holderName: '***',
        cvc: '***',
      },
      returnUrl: 'https://your-company.example.com/...',
      merchantAccount: 'YOUR_MERCHANT_ACCOUNT',
    });
  });

  test('apple pay: token masked via paymentMethod special case', () => {
    // Arrange
    const paymentMethod: ApplePayDetails = {
      type: ApplePayDetails.TypeEnum.Applepay,
      applePayToken: 'VNRWtuNlNEWkRCSm1xWndjMDFFbktkQU...',
    };
    const input: PaymentRequest = {
      amount: { currency: 'USD', value: 1000 },
      reference: 'Your order number',
      paymentMethod,
      returnUrl: 'https://your-company.example.com/...',
      merchantAccount: 'YOUR_MERCHANT_ACCOUNT',
    };

    // Act
    const result = maskRequest(input);

    // Assert
    expect(result).toEqual({
      ...input,
      paymentMethod: { type: ApplePayDetails.TypeEnum.Applepay, applePayToken: '***' },
    });
  });

  test('google pay: token masked via paymentMethod special case', () => {
    // Arrange
    const paymentMethod: PayWithGoogleDetails = {
      type: PayWithGoogleDetails.TypeEnum.Paywithgoogle,
      googlePayToken: '==Payload as retrieved from Google Pay response==',
    };
    const input: PaymentRequest = {
      amount: { currency: 'USD', value: 1000 },
      reference: 'Your order number',
      paymentMethod,
      returnUrl: 'https://your-company.example.com/...',
      merchantAccount: 'YourMerchantAccount',
    };

    // Act
    const result = maskRequest(input);

    // Assert
    expect(result).toEqual({
      ...input,
      paymentMethod: { type: PayWithGoogleDetails.TypeEnum.Paywithgoogle, googlePayToken: '***' },
    });
  });

  test('notification: masks storedPaymentMethodId in additionalData dotted keys', () => {
    // Arrange
    const input: NotificationRequestDTO = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              'tokenization.shopperReference': 'YOUR_SHOPPER_REFERENCE',
              'tokenization.storedPaymentMethodId': 'M5N7TQ4TG5PFWR50',
              'tokenization.store.operationType': 'created',
            },
            amount: { currency: 'EUR', value: 1000 },
            eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
            eventDate: '2021-01-01T01:00:00+01:00',
            merchantAccountCode: 'YOUR_MERCHANT_ACCOUNT',
            merchantReference: 'YOUR_MERCHANT_REFERENCE',
            pspReference: 'QFQTPCQ8HXSKGK82',
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    };

    // Act
    const result = maskRequest(input);

    // Assert
    expect(result).toEqual({
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              'tokenization.shopperReference': 'YOUR_SHOPPER_REFERENCE',
              'tokenization.storedPaymentMethodId': '***',
              'tokenization.store.operationType': 'created',
            },
            amount: { currency: 'EUR', value: 1000 },
            eventCode: NotificationRequestItem.EventCodeEnum.Authorisation,
            eventDate: '2021-01-01T01:00:00+01:00',
            merchantAccountCode: 'YOUR_MERCHANT_ACCOUNT',
            merchantReference: 'YOUR_MERCHANT_REFERENCE',
            pspReference: 'QFQTPCQ8HXSKGK82',
            success: NotificationRequestItem.SuccessEnum.True,
          },
        },
      ],
    });
  });
});

describe('maskResponse', () => {
  test('paymentMethod brand and type are preserved; PII in additionalData is still masked', () => {
    // Arrange
    const input: PaymentResponse = {
      resultCode: PaymentResponse.ResultCodeEnum.Authorised,
      pspReference: 'D5NHHX5ZD2LC3J75',
      paymentMethod: { brand: 'visa', type: 'scheme' },
      additionalData: {
        'tokenization.storedPaymentMethodId': 'M5N7TQ4TG5PFWR50',
        expiryDate: '3/2030',
      },
    };

    // Act
    const result = maskResponse(input);

    // Assert
    expect(result).toEqual({
      resultCode: PaymentResponse.ResultCodeEnum.Authorised,
      pspReference: 'D5NHHX5ZD2LC3J75',
      paymentMethod: { brand: 'visa', type: 'scheme' },
      additionalData: {
        'tokenization.storedPaymentMethodId': '***',
        expiryDate: '3/2030',
      },
    });
  });
});

describe('populateInterfaceInteraction', () => {
  test('returns undefined when saveInterfaceInteractions is false', () => {
    // Arrange
    jest.spyOn(Config, 'getConfig').mockReturnValueOnce({ saveInterfaceInteractions: false } as any);

    // Act
    const result = populateInterfaceInteraction({
      interactionId: 'id',
      type: 'CreatePayment',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    // Assert
    expect(result).toBeUndefined();
  });

  test('returns array with masked and serialized fields when enabled', () => {
    // Arrange
    jest.spyOn(Config, 'getConfig').mockReturnValueOnce({ saveInterfaceInteractions: true } as any);
    const request: PaymentRequest = {
      amount: { currency: 'USD', value: 1000 },
      reference: 'ORDER-123',
      paymentMethod: { type: CardDetails.TypeEnum.Scheme, encryptedCardNumber: 'test_4111111111111111' },
      returnUrl: 'https://example.com',
      merchantAccount: 'TEST',
      shopperEmail: 'user@example.com',
    };
    const response: PaymentResponse = {
      resultCode: PaymentResponse.ResultCodeEnum.Authorised,
      merchantReference: 'ORDER-123',
      additionalData: { 'tokenization.storedPaymentMethodId': 'M5N7TQ4TG5PFWR50' },
    };

    // Act
    const result = populateInterfaceInteraction({
      interactionId: 'my-uuid',
      type: 'CreatePayment',
      createdAt: '2024-01-01T00:00:00.000Z',
      request,
      response,
    });

    // Assert
    expect(result).toHaveLength(1);
    const fields = result![0].fields!;
    expect(fields.interactionId).toEqual('my-uuid');
    expect(fields.type).toEqual('CreatePayment');
    expect(JSON.parse(fields.request as string)).toEqual({
      amount: { currency: 'USD', value: 1000 },
      reference: 'ORDER-123',
      paymentMethod: { type: CardDetails.TypeEnum.Scheme, encryptedCardNumber: '***' },
      returnUrl: 'https://example.com',
      merchantAccount: 'TEST',
      shopperEmail: '***',
    });
    expect(JSON.parse(fields.response as string)).toEqual({
      resultCode: PaymentResponse.ResultCodeEnum.Authorised,
      merchantReference: 'ORDER-123',
      additionalData: { 'tokenization.storedPaymentMethodId': '***' },
    });
  });
});

describe('buildAdyenPaymentCustomFields', () => {
  const merchantType: Type = {
    id: 'custom-type-id',
    version: 1,
    key: 'merchant-own-payment-type',
    name: { en: 'Merchant own payment type' },
    resourceTypeIds: ['payment'],
    fieldDefinitions: [],
    createdAt: '2024-02-13T00:00:00.000Z',
    lastModifiedAt: '2024-02-13T00:00:00.000Z',
  };
  // The payment only carries the id of its type; the key is resolved through ctCustomTypeService.
  const paymentWithCustomType: Payment = {
    ...mockGetPaymentResult,
    custom: {
      type: { typeId: 'type', id: merchantType.id },
      fields: { adyenDonationToken: 'a-donation-token' },
    },
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('assigns the connector type when the payment has none', async () => {
    // Act
    const result = await buildAdyenPaymentCustomFields(mockGetPaymentResult, { adyenDonationState: 'Success' });

    // Assert
    expect(result).toEqual({
      customFields: {
        type: { key: AdyenPaymentDetailsTypeKey, typeId: 'type' },
        fields: { adyenDonationState: 'Success' },
      },
    });
  });

  test.each([AdyenPaymentDetailsTypeKey, merchantType.key])(
    'only sets the given values when the payment already carries the type %s',
    async (typeKey) => {
      // Arrange
      jest.spyOn(paymentSDK.ctCustomTypeService, 'getById').mockResolvedValue({ ...merchantType, key: typeKey });
      const createOrUpdate = jest
        .spyOn(paymentSDK.ctCustomTypeService, 'createOrUpdate')
        .mockResolvedValue({ ...merchantType, key: typeKey });

      // Act
      const result = await buildAdyenPaymentCustomFields(paymentWithCustomType, { adyenDonationState: 'Success' });

      // Assert: setCustomField only, so the fields the caller did not pass survive the update
      expect(result).toEqual({ customFieldValues: { adyenDonationState: 'Success' } });
      // the field definitions are only added to a type the connector does not own
      expect(createOrUpdate).toHaveBeenCalledTimes(typeKey === AdyenPaymentDetailsTypeKey ? 0 : 1);
    },
  );
});
