import HmacValidator from '@adyen/api-library/lib/src/utils/hmacValidator';
import { config } from '../../../config/config';
import { FastifyRequest } from 'fastify';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';

export class HmacHeaderAuthHook {
  public authenticate() {
    return async (request: FastifyRequest) => {
      const hmacSignatureHeaders = request.headers['hmacsignature'];

      if (!hmacSignatureHeaders) {
        throw new ErrorAuthErrorResponse('No hmac signature header found in the request');
      }

      let hmacSignature: string;

      if (Array.isArray(hmacSignatureHeaders)) {
        if (hmacSignatureHeaders.length !== 1) {
          throw new ErrorAuthErrorResponse('Exactly one hmac signature needs to be provided');
        }

        hmacSignature = hmacSignatureHeaders[0];
      } else {
        hmacSignature = hmacSignatureHeaders;
      }

      const hmacKey = config.adyenHMACTokenizationWebHooksKey
        ? config.adyenHMACTokenizationWebHooksKey
        : config.adyenHMACKey;

      const validator = new HmacValidator();

      const reqBody = JSON.stringify(request.body);
      const isValid = validator.validateHMACSignature(hmacKey, hmacSignature, reqBody);

      if (!isValid) {
        throw new ErrorAuthErrorResponse('HMAC is not valid');
      }
    };
  }
}
