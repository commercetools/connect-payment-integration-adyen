import { DonationPaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentRequest';
import { DonationPaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentResponse';
import { Payment } from '@commercetools/connect-payments-sdk';
import { config } from '../../config/config';
import { MakeDonationRequestDTO, MakeDonationResponseDTO } from '../../dtos/adyen-donation.dto';
import { getMerchantReturnUrlFromContext } from '../../libs/fastify/context/context';
import { getAdyenPaymentCustomFields } from '../helper.service';

export class MakeDonationConverter {
  public convertRequest(opts: { data: MakeDonationRequestDTO; payment: Payment }): DonationPaymentRequest {
    return {
      ...opts.data,
      donationToken: getAdyenPaymentCustomFields(opts.payment).adyenDonationToken,
      donationOriginalPspReference: opts.payment.interfaceId as string,
      // `paymentMethod` is omitted on purpose: Adyen only requires it when no donationToken is supplied.
      reference: opts.payment.id,
      merchantAccount: config.adyenMerchantAccount,
      returnUrl: getMerchantReturnUrlFromContext() || config.merchantReturnUrl,
    };
  }

  public convertResponse(opts: { response: DonationPaymentResponse }): MakeDonationResponseDTO {
    return {
      status: opts.response.status,
      id: opts.response.id,
    };
  }
}
