import { Address } from '@adyen/api-library/lib/src/typings/checkout/address';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import {
  Cart,
  LineItem as CoCoLineItem,
  CustomLineItem,
  Address as CartAddress,
  Order,
} from '@commercetools/connect-payments-sdk';
import {
  getAllowedPaymentMethodsFromContext,
  getCtSessionIdFromContext,
  getProcessorUrlFromContext,
} from '../../libs/fastify/context/context';
import { NormalizedShipping } from '@commercetools/connect-payments-sdk';
import { paymentSDK } from '../../payment-sdk';

export const mapCoCoLineItemToAdyenLineItem = (lineItem: CoCoLineItem): LineItem => {
  return {
    id: lineItem.variant.sku,
    description: Object.values(lineItem.name)[0], //TODO: get proper locale
    quantity: lineItem.quantity,
    amountExcludingTax: getItemAmount(getAmountExcludingTax(lineItem), lineItem.quantity),
    amountIncludingTax: getItemAmount(getAmountIncludingTax(lineItem), lineItem.quantity),
    taxAmount: getItemAmount(getTaxAmount(lineItem), lineItem.quantity),
    taxPercentage: convertTaxPercentageToCentAmount(lineItem.taxRate?.amount),
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
    taxPercentage: convertTaxPercentageToCentAmount(customLineItem.taxRate?.amount),
  };
};

export const mapCoCoShippingInfoToAdyenLineItem = (shippingInfo: NormalizedShipping[]): LineItem[] => {
  return shippingInfo.map((shipping) => ({
    description: `Shipping - ${shipping.shippingInfo.shippingMethodName}`,
    quantity: 1,
    amountExcludingTax: shipping.shippingInfo.taxedPrice?.totalNet.centAmount || 0,
    amountIncludingTax: shipping.shippingInfo.taxedPrice?.totalGross.centAmount || 0,
    taxAmount: shipping.shippingInfo.taxedPrice?.totalTax?.centAmount || 0,
    taxPercentage: convertTaxPercentageToCentAmount(shipping.shippingInfo.taxRate?.amount),
  }));
};

export const mapCoCoDiscountOnTotalPriceToAdyenLineItem = (
  cart: Required<Pick<Cart, 'discountOnTotalPrice'>>,
): LineItem => {
  const amountExcludingTax = cart.discountOnTotalPrice.discountedNetAmount?.centAmount || 0;
  const amountIncludingTax = cart.discountOnTotalPrice.discountedGrossAmount?.centAmount || 0;
  const taxAmount = amountIncludingTax - amountExcludingTax;

  return {
    description: 'Discount',
    quantity: 1,
    amountExcludingTax: -amountExcludingTax,
    amountIncludingTax: -amountIncludingTax,
    taxAmount: -taxAmount,
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
  return lineItem.taxedPrice ? lineItem.taxedPrice.totalGross.centAmount : lineItem.totalPrice.centAmount;
};

const getAmountExcludingTax = (lineItem: CoCoLineItem | CustomLineItem): number => {
  return lineItem.taxedPrice ? lineItem.taxedPrice.totalNet.centAmount : lineItem.totalPrice.centAmount;
};

const getTaxAmount = (lineItem: CoCoLineItem | CustomLineItem): number => {
  return lineItem.taxedPrice?.totalTax ? lineItem.taxedPrice.totalTax.centAmount : 0;
};

const convertTaxPercentageToCentAmount = (decimalTaxRate?: number): number => {
  return decimalTaxRate ? decimalTaxRate * 100 * 100 : 0;
};
