import HmacValidator from '@adyen/api-library/lib/src/utils/hmacValidator';
import { FastifyRequest } from 'fastify';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';
import { NotificationRequestDTO } from '../../../dtos/adyen-payment.dto';

/**
 * @see https://docs.adyen.com/development-resources/webhooks/verify-hmac-signatures/?programming_language=js
 */
export class HmacAuthHook {
  constructor(private readonly hmacKey: string) {}

  public authenticate() {
    return async (request: FastifyRequest) => {
      const data = request.body as NotificationRequestDTO;
      if (!data.notificationItems || data.notificationItems.length === 0) {
        throw new ErrorAuthErrorResponse('Unexpected payload');
      }

      const validator = new HmacValidator();
      const item = data.notificationItems[0].NotificationRequestItem;

      let isValid: boolean;
      try {
        isValid = validator.validateHMAC(item, this.hmacKey);
      } catch (e) {
        throw new ErrorAuthErrorResponse('HMAC could not be verified', { cause: e });
      }

      if (!isValid) {
        throw new ErrorAuthErrorResponse('HMAC is not valid');
      }
    };
  }
}
