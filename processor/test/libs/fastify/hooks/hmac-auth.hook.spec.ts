import { describe, expect, test } from '@jest/globals';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';
import HmacValidator from '@adyen/api-library/lib/src/utils/hmacValidator';
import { NotificationRequestItem } from '@adyen/api-library/lib/src/typings/notification/notificationRequestItem';
import { FastifyRequest } from 'fastify';
import { HmacAuthHook } from '../../../../src/libs/fastify/hooks/hmac-auth.hook';

// Adyen HMAC keys are hex-encoded.
const HMAC_KEY = '11AA22BB33CC44DD55EE66FF77AA88BB';

const notificationItem = (): NotificationRequestItem =>
  ({
    amount: { currency: 'EUR', value: 500 },
    originalReference: 'V4HZ4RBFJGXXGN82',
    eventCode: NotificationRequestItem.EventCodeEnum.Donation,
    eventDate: '2022-07-07T13:18:13+02:00',
    merchantAccountCode: 'CHARITY_DONATION_ACCOUNT',
    merchantReference: 'payment-id',
    paymentMethod: 'visa',
    pspReference: 'Z58FGTKBRCQ2WN27',
    success: NotificationRequestItem.SuccessEnum.True,
  }) as NotificationRequestItem;

const requestWith = (item: NotificationRequestItem): FastifyRequest =>
  ({
    headers: {},
    body: { live: 'false', notificationItems: [{ NotificationRequestItem: item }] },
  }) as unknown as FastifyRequest;

describe('hmac-auth.hook', () => {
  test('accepts a correctly signed notification', async () => {
    const item = notificationItem();
    item.additionalData = { hmacSignature: new HmacValidator().calculateHmac(item, HMAC_KEY) };

    await expect(new HmacAuthHook(HMAC_KEY).authenticate()(requestWith(item))).resolves.toBeUndefined();
  });

  test('rejects a notification signed with another key', async () => {
    const item = notificationItem();
    item.additionalData = {
      hmacSignature: new HmacValidator().calculateHmac(item, 'FFEEDDCCBBAA99887766554433221100'),
    };

    await expect(new HmacAuthHook(HMAC_KEY).authenticate()(requestWith(item))).rejects.toThrow(ErrorAuthErrorResponse);
  });

  test('rejects a notification carrying no signature instead of failing with an internal error', async () => {
    await expect(new HmacAuthHook(HMAC_KEY).authenticate()(requestWith(notificationItem()))).rejects.toThrow(
      ErrorAuthErrorResponse,
    );
  });

  test('rejects a payload without notification items', async () => {
    const request = { body: { live: 'false', notificationItems: [] } } as unknown as FastifyRequest;

    await expect(new HmacAuthHook(HMAC_KEY).authenticate()(request)).rejects.toThrow(ErrorAuthErrorResponse);
  });
});
