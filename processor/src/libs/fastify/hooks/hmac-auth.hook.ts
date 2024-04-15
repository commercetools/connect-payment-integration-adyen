import HmacValidator from '@adyen/api-library/lib/src/utils/hmacValidator';
import { config } from '../../../config/config';
import { FastifyRequest } from 'fastify';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';
import { NotificationRequestDTO } from '../../../dtos/adyen-payment.dto';

export class HmacAuthHook {
  public authenticate() {
    return async (request: FastifyRequest) => {
      const data = request.body as NotificationRequestDTO;
      if (!data.notificationItems || data.notificationItems.length === 0) {
        throw new ErrorAuthErrorResponse('Unexpected payload');
      }

      const validator = new HmacValidator();
      const item = data.notificationItems[0].NotificationRequestItem;

      if (!validator.validateHMAC(item, config.adyenHMACKey)) {
        throw new ErrorAuthErrorResponse('HMAC is not valid');
      }
    };
  }
}
