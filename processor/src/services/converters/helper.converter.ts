import { Address } from '@adyen/api-library/lib/src/typings/checkout/address';
import { Address as CartAddress } from '@commercetools/connect-payments-sdk';
import {
  getAllowedPaymentMethodsFromContext,
  getCtSessionIdFromContext,
  getProcessorUrlFromContext,
} from '../../libs/fastify/context/context';
import { GenericIssuerPaymentMethodDetails } from '@adyen/api-library/lib/src/typings/checkout/genericIssuerPaymentMethodDetails';
import { ApplicationInfo } from '@adyen/api-library/lib/src/typings/applicationInfo';
import { config } from '../../config/config';

export const populateCartAddress = (address?: CartAddress): Address => {
  return {
    country: address?.country || '',
    city: address?.city || '',
    street: address?.streetName || '',
    houseNumberOrName: address?.streetNumber || '',
    stateOrProvince: address?.region || address?.state || undefined,
    postalCode: address?.postalCode || '',
  };
};

export const convertAllowedPaymentMethodsToAdyenFormat = (): string[] => {
  const allowedPaymentMethods: string[] = getAllowedPaymentMethodsFromContext();
  const adyenAllowedPaymentMethods: string[] = [];
  allowedPaymentMethods.forEach((paymentMethod) => {
    adyenAllowedPaymentMethods.push(convertPaymentMethodToAdyenFormat(paymentMethod));
  });

  return adyenAllowedPaymentMethods;
};

export const convertPaymentMethodToAdyenFormat = (paymentMethod: string): string => {
  if (paymentMethod === 'card') {
    return 'scheme';
  } else if (paymentMethod === 'klarna_pay_later') {
    return 'klarna';
  } else if (paymentMethod === 'klarna_pay_now') {
    return 'klarna_paynow';
  } else if (paymentMethod === 'klarna_pay_overtime') {
    return 'klarna_account';
  } else if (paymentMethod === 'bancontactcard') {
    return 'bcmc';
  } else if (paymentMethod === 'bancontactmobile') {
    return 'bcmc_mobile';
  } else if (paymentMethod === 'klarna_billie') {
    return 'klarna_b2b';
  } else if (paymentMethod === 'przelewy24') {
    return GenericIssuerPaymentMethodDetails.TypeEnum.OnlineBankingPl;
  } else if (paymentMethod === 'afterpay') {
    return 'afterpaytouch';
  } else {
    return paymentMethod;
  }
};

export const convertPaymentMethodFromAdyenFormat = (paymentMethod: string): string => {
  if (paymentMethod === 'scheme') {
    return 'card';
  } else if (paymentMethod === 'klarna') {
    return 'klarna_pay_later';
  } else if (paymentMethod === 'klarna_paynow') {
    return 'klarna_pay_now';
  } else if (paymentMethod === 'klarna_account') {
    return 'klarna_pay_overtime';
  } else if (paymentMethod === 'bcmc') {
    return 'bancontactcard';
  } else if (paymentMethod === 'bcmc_mobile') {
    return 'bancontactmobile';
  } else if (paymentMethod === 'klarna_b2b') {
    return 'klarna_billie';
  } else if (paymentMethod === GenericIssuerPaymentMethodDetails.TypeEnum.OnlineBankingPl) {
    return 'przelewy24';
  } else if (paymentMethod === 'afterpaytouch') {
    return 'afterpay';
  } else {
    return paymentMethod;
  }
};

export const buildReturnUrl = (paymentReference: string): string => {
  const url = new URL('/payments/details', getProcessorUrlFromContext());
  url.searchParams.append('paymentReference', paymentReference);
  url.searchParams.append('ctsid', getCtSessionIdFromContext());
  return url.toString();
};

export const populateApplicationInfo = (): ApplicationInfo => {
  return {
    externalPlatform: {
      name: 'commercetools-connect',
      integrator: 'commercetools',
    },
    merchantApplication: {
      name: 'adyen-commercetools',
    },
  };
};

/**
 * Get the shopper statement and applies rules defined in the Adyen documentation.
 * https://docs.adyen.com/api-explorer/Checkout/71/post/payments#request-shopperStatement
 *
 * @returns The shopper statement
 */
export const getShopperStatement = (): string | undefined => {
  // Allowed characters: a-z, A-Z, 0-9, spaces, and special characters . , ' _ - ? + * /.
  const allowedCharacters = /[^a-zA-Z0-9 .,'_\-?+*/]/g;

  const shopperStatement = config.adyenShopperStatement?.trim();
  if (!shopperStatement) {
    return undefined;
  }

  const filteredShopperStatement = shopperStatement.replace(allowedCharacters, '');

  return filteredShopperStatement || undefined;
};
