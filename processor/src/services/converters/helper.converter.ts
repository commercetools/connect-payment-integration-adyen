import { Address } from '@adyen/api-library/lib/src/typings/checkout/address';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import {
  Cart,
  LineItem as CoCoLineItem,
  CustomLineItem,
  Address as CartAddress,
  Order,
  NormalizedShipping,
  CurrencyConverters,
} from '@commercetools/connect-payments-sdk';
import {
  getAllowedPaymentMethodsFromContext,
  getCtSessionIdFromContext,
  getProcessorUrlFromContext,
} from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { GenericIssuerPaymentMethodDetails } from '@adyen/api-library/lib/src/typings/checkout/genericIssuerPaymentMethodDetails';

export const mapCoCoLineItemToAdyenLineItem = (lineItem: CoCoLineItem): LineItem => {
  return {
    id: lineItem.variant.sku,
    description: Object.values(lineItem.name)[0], //TODO: get proper locale
    quantity: lineItem.quantity,
    amountExcludingTax: getItemAmount(getAmountExcludingTax(lineItem), lineItem.quantity),
    amountIncludingTax: getItemAmount(getAmountIncludingTax(lineItem), lineItem.quantity),
    taxAmount: getItemAmount(getTaxAmount(lineItem), lineItem.quantity),
    taxPercentage: convertTaxPercentageToAdyenMinorUnits(
      lineItem.totalPrice.fractionDigits,
      lineItem.totalPrice.currencyCode,
      lineItem.taxRate?.amount,
    ),
  };
};

export const mapCoCoCustomLineItemToAdyenLineItem = (customLineItem: CustomLineItem): LineItem => {
  return {
    id: customLineItem.id,
    description: Object.values(customLineItem.name)[0], //TODO: get proper locale
    quantity: customLineItem.quantity,
    amountExcludingTax: getItemAmount(getAmountExcludingTax(customLineItem), customLineItem.quantity),
    amountIncludingTax: getItemAmount(getAmountIncludingTax(customLineItem), customLineItem.quantity),
    taxAmount: getItemAmount(getTaxAmount(customLineItem), customLineItem.quantity),
    taxPercentage: convertTaxPercentageToAdyenMinorUnits(
      customLineItem.totalPrice.fractionDigits,
      customLineItem.totalPrice.currencyCode,
      customLineItem.taxRate?.amount,
    ),
  };
};

export const mapCoCoShippingInfoToAdyenLineItem = (normalizedShippings: NormalizedShipping[]): LineItem[] => {
  return normalizedShippings.map((shipping) => {
    let amountExcludingTaxValue = 0;
    let amountIncludingTaxValue = 0;

    if (shipping.shippingInfo.taxedPrice) {
      amountExcludingTaxValue = CurrencyConverters.convertWithMapping({
        mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
        amount: shipping.shippingInfo.taxedPrice.totalNet.centAmount,
        currencyCode: shipping.shippingInfo.taxedPrice.totalNet.currencyCode,
      });

      amountIncludingTaxValue = CurrencyConverters.convertWithMapping({
        mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
        amount: shipping.shippingInfo.taxedPrice.totalGross.centAmount,
        currencyCode: shipping.shippingInfo.taxedPrice.totalGross.currencyCode,
      });
    }

    let taxAmountValue = 0;

    if (shipping.shippingInfo.taxedPrice?.totalTax?.centAmount) {
      taxAmountValue = CurrencyConverters.convertWithMapping({
        mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
        amount: shipping.shippingInfo.taxedPrice.totalTax.centAmount,
        currencyCode: shipping.shippingInfo.taxedPrice.totalTax.currencyCode,
      });
    }

    return {
      description: `Shipping - ${shipping.shippingInfo.shippingMethodName}`,
      quantity: 1,
      amountExcludingTax: amountExcludingTaxValue,
      amountIncludingTax: amountIncludingTaxValue,
      taxAmount: taxAmountValue,
      taxPercentage: convertTaxPercentageToAdyenMinorUnits(
        shipping.shippingInfo.price.fractionDigits,
        shipping.shippingInfo.price.currencyCode,
        shipping.shippingInfo.taxRate?.amount,
      ),
    };
  });
};

export const mapCoCoDiscountOnTotalPriceToAdyenLineItem = (
  cart: Required<Pick<Cart, 'discountOnTotalPrice'>>,
): LineItem => {
  let amountExcludingTaxValue = 0;
  let amountIncludingTaxValue = 0;

  if (cart.discountOnTotalPrice.discountedNetAmount) {
    amountExcludingTaxValue = CurrencyConverters.convertWithMapping({
      mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
      amount: cart.discountOnTotalPrice.discountedNetAmount.centAmount,
      currencyCode: cart.discountOnTotalPrice.discountedNetAmount.currencyCode,
    });
  }

  if (cart.discountOnTotalPrice.discountedGrossAmount) {
    amountIncludingTaxValue = CurrencyConverters.convertWithMapping({
      mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
      amount: cart.discountOnTotalPrice.discountedGrossAmount.centAmount,
      currencyCode: cart.discountOnTotalPrice.discountedGrossAmount.currencyCode,
    });
  }

  const taxAmountValue = amountIncludingTaxValue - amountExcludingTaxValue;

  return {
    description: 'Discount',
    quantity: 1,
    amountExcludingTax: -amountExcludingTaxValue,
    amountIncludingTax: -amountIncludingTaxValue,
    taxAmount: -taxAmountValue,
  };
};

/**
 * Maps over a CoCo order items (like lineItems, discounts, shipping, etc) over to the Adyen line items.
 *
 * Mapping logic is mainly based upon the Adyen `adyen-commercetools` connector.
 *
 * @param cart The CoCo order to map over
 * @returns List of lineitems to be send to Adyen
 */
export const mapCoCoOrderItemsToAdyenLineItems = (
  order: Pick<
    Order,
    | 'lineItems'
    | 'customLineItems'
    | 'shippingMode'
    | 'shippingAddress'
    | 'shippingInfo'
    | 'shipping'
    | 'discountOnTotalPrice'
  >,
): LineItem[] => {
  // CoCo model between these attributes is shared between a Cart and Order hence we can re-use the existing mapping logic.
  return mapCoCoCartItemsToAdyenLineItems(order);
};

/**
 * Maps over a CoCo cart items (like lineItems, discounts, shipping, etc) over to the Adyen line items.
 *
 * Mapping logic is mainly based upon the Adyen `adyen-commercetools` connector.
 *
 * @param cart The CoCo cart to map over
 * @returns List of lineitems to be send to Adyen
 */
export const mapCoCoCartItemsToAdyenLineItems = (
  cart: Pick<
    Cart,
    | 'lineItems'
    | 'customLineItems'
    | 'shippingMode'
    | 'shippingAddress'
    | 'shippingInfo'
    | 'shipping'
    | 'discountOnTotalPrice'
  >,
): LineItem[] => {
  const aydenLineItems: LineItem[] = [];

  cart.lineItems.forEach((lineItem) => aydenLineItems.push(mapCoCoLineItemToAdyenLineItem(lineItem)));

  cart.customLineItems.forEach((customLineItem) =>
    aydenLineItems.push(mapCoCoCustomLineItemToAdyenLineItem(customLineItem)),
  );

  aydenLineItems.push(...mapCoCoShippingInfoToAdyenLineItem(paymentSDK.ctCartService.getNormalizedShipping({ cart })));

  if (cart.discountOnTotalPrice) {
    aydenLineItems.push(
      mapCoCoDiscountOnTotalPriceToAdyenLineItem({ discountOnTotalPrice: cart.discountOnTotalPrice }),
    );
  }

  return aydenLineItems;
};

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
  } else {
    return paymentMethod;
  }
};

const getItemAmount = (totalAmount: number, quantity: number): number => {
  return parseFloat((totalAmount / quantity).toFixed(0));
};

export const buildReturnUrl = (paymentReference: string): string => {
  const url = new URL('/payments/details', getProcessorUrlFromContext());
  url.searchParams.append('paymentReference', paymentReference);
  url.searchParams.append('ctsid', getCtSessionIdFromContext());
  return url.toString();
};

const getAmountIncludingTax = (lineItem: CoCoLineItem | CustomLineItem): number => {
  const centAmount = lineItem.taxedPrice ? lineItem.taxedPrice.totalGross.centAmount : lineItem.totalPrice.centAmount;
  const currencyCode = lineItem.taxedPrice
    ? lineItem.taxedPrice.totalGross.currencyCode
    : lineItem.totalPrice.currencyCode;

  return CurrencyConverters.convertWithMapping({
    mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
    amount: centAmount,
    currencyCode,
  });
};

const getAmountExcludingTax = (lineItem: CoCoLineItem | CustomLineItem): number => {
  const centAmount = lineItem.taxedPrice ? lineItem.taxedPrice.totalNet.centAmount : lineItem.totalPrice.centAmount;
  const currencyCode = lineItem.taxedPrice
    ? lineItem.taxedPrice.totalNet.currencyCode
    : lineItem.totalPrice.currencyCode;

  return CurrencyConverters.convertWithMapping({
    mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
    amount: centAmount,
    currencyCode,
  });
};

const getTaxAmount = (lineItem: CoCoLineItem | CustomLineItem): number => {
  if (!lineItem.taxedPrice || !lineItem.taxedPrice.totalTax) {
    return 0;
  }

  return CurrencyConverters.convertWithMapping({
    mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
    amount: lineItem.taxedPrice.totalTax.centAmount,
    currencyCode: lineItem.taxedPrice.totalTax.currencyCode,
  });
};

/**
 * Convert the CoCo tax percentage, which ranges from 0-1 as floating point numbers to the expected Adyen minor units.
 *
 * This function applies the given fractionDigit to get the correct minor units. This also takes into account the deviations Adyen has with regards to the fractionDigit.
 *
 * @example CoCo taxRate of 0.21, normalized is 21% with currencyCode EUR and fractionDigit of 2 = expressed in Adyen minor units value as 2100
 * @example CoCo taxRate of 0.21, normalized is 21% with currencyCode CLP, according to ISO standard has fractionDigit of 0 but Adyen deviats from it and so it has fractionDigit of 2 = expressed in Adyen minor units value as 2100
 * @example CoCo taxRate of 0.21, normalized is 21% with currencyCode JPY and fractionDigit of 0 = expressed in Adyen minor units value as 21
 *
 * @param fractionDigit the fractionDigit that are applicable for the currencyCode according to ISO_4217
 * @param currencyCode the applicable currencyCode
 * @param decimalTaxRate the tax rate expressed in decimals between 0-1 as floating point numbers taken from the CoCo taxRate (see docs below)
 *
 * @see https://docs.commercetools.com/api/projects/taxCategories#ctp:api:type:TaxRate
 * @see https://docs.adyen.com/api-explorer/Checkout/latest/post/sessions#request-lineItems-taxPercentage
 * @see https://docs.adyen.com/development-resources/currency-codes/#minor-units
 */
const convertTaxPercentageToAdyenMinorUnits = (
  fractionDigit: number,
  currencyCode: string,
  decimalTaxRate?: number,
): number => {
  if (!decimalTaxRate) {
    return 0;
  }
  // First go from the range of 0 - 1 (floating numbers) to value expressed as "non-decimals". I.e. 0.15% from CoCo becomes 15% tax rate value.
  const normalizedTaxRate = decimalTaxRate * 100;

  const result = CurrencyConverters.convertWithMapping({
    mapping: CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING,
    amount: normalizedTaxRate,
    currencyCode,
    fractionDigit,
  });

  return result;
};
