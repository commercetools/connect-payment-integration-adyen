import { DonationCampaign } from '@adyen/api-library/lib/src/typings/checkout/donationCampaign';
import { DonationCampaignsRequest } from '@adyen/api-library/lib/src/typings/checkout/donationCampaignsRequest';
import {
  CommercetoolsCartService,
  CurrencyConverters,
  ErrorInvalidOperation,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { config } from '../../config/config';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { GetDonationConfigRequestDTO, GetDonationConfigResponseDTO } from '../../dtos/adyen-donation.dto';
import { getCountryCodeFromCart } from './helper.converter';

export class DonationCampaignsConverter {
  constructor(private ctCartService: CommercetoolsCartService) {}

  public convertRequest(opts: { data: GetDonationConfigRequestDTO; payment: Payment }): DonationCampaignsRequest {
    return {
      merchantAccount: config.adyenMerchantAccount,
      currency: opts.payment.amountPlanned.currencyCode,
      ...(opts.data.locale && { locale: opts.data.locale }),
    };
  }

  public async convertResponse(opts: {
    donationCampaign: DonationCampaign | undefined;
    data: GetDonationConfigRequestDTO;
    payment: Payment;
  }): Promise<GetDonationConfigResponseDTO> {
    const { amountPlanned } = opts.payment;

    return {
      clientKey: config.adyenClientKey,
      environment: config.adyenClientEnvironment,
      paymentReference: opts.payment.id,
      ...(opts.data.withCountryCode && { countryCode: await this.getCountryCode(opts.payment) }),
      paidAmount: {
        value: CurrencyConverters.convertWithMapping({
          mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
          amount: amountPlanned.centAmount,
          currencyCode: amountPlanned.currencyCode,
        }),
        currency: amountPlanned.currencyCode,
      },
      donationCampaign: opts.donationCampaign,
    };
  }

  /** The Adyen web SDK refuses to initialize without a country code; resolve it from the cart as a fallback. */
  private async getCountryCode(payment: Payment): Promise<string> {
    const cart = await this.ctCartService.getCartByPaymentId({ paymentId: payment.id });

    const countryCode = getCountryCodeFromCart(cart);
    if (!countryCode) {
      throw new ErrorInvalidOperation('Could not determine the country code for the donation');
    }

    return countryCode;
  }
}
