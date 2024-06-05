import { Address } from '@adyen/api-library/lib/src/typings/checkout/address';
import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import {
  Cart,
  LineItem as CoCoLineItem,
  CustomLineItem,
  Address as CartAddress,
} from '@commercetools/connect-payments-sdk';
import {
  getAllowedPaymentMethodsFromContext,
  getCtSessionIdFromContext,
  getProcessorUrlFromContext,
} from '../../libs/fastify/context/context';

/**
 * Mapping logic is mainly based upon the Adyen `adyen-commercetools` connector.
 *
 * @param cart The CoCo cart to map the line items from
 * @returns List of lineitems that Adyen will accept
 */
export const populateLineItems = (cart: Cart): LineItem[] => {
  const lineItems: LineItem[] = [];

  cart.lineItems.forEach((lineItem) => {
    lineItems.push({
      id: lineItem.variant.sku,
      description: Object.values(lineItem.name)[0], //TODO: get proper locale
      quantity: lineItem.quantity,
      amountExcludingTax: getItemAmount(getAmountExcludingTax(lineItem), lineItem.quantity),
      amountIncludingTax: getItemAmount(getAmountIncludingTax(lineItem), lineItem.quantity),
      taxAmount: getItemAmount(getTaxAmount(lineItem), lineItem.quantity),
      taxPercentage: convertTaxPercentageToCentAmount(lineItem.taxRate?.amount),
    });
  });

  cart.customLineItems.forEach((customLineItem) => {
    lineItems.push({
      id: customLineItem.id,
      description: Object.values(customLineItem.name)[0], //TODO: get proper locale
      quantity: customLineItem.quantity,
      amountExcludingTax: getItemAmount(getAmountExcludingTax(customLineItem), customLineItem.quantity),
      amountIncludingTax: getItemAmount(getAmountIncludingTax(customLineItem), customLineItem.quantity),
      taxAmount: getItemAmount(getTaxAmount(customLineItem), customLineItem.quantity),
      taxPercentage: convertTaxPercentageToCentAmount(customLineItem.taxRate?.amount),
    });
  });

  if (cart.shippingInfo) {
    lineItems.push({
      description: 'Shipping',
      quantity: 1,
      amountExcludingTax: cart.shippingInfo.taxedPrice?.totalNet.centAmount || 0,
      amountIncludingTax: cart.shippingInfo.taxedPrice?.totalGross.centAmount || 0,
      taxAmount: cart.shippingInfo.taxedPrice?.totalTax?.centAmount || 0,
      taxPercentage: convertTaxPercentageToCentAmount(cart.shippingInfo?.taxRate?.amount),
    });
  }

  if (cart.discountOnTotalPrice) {
    const amountExcludingTax = cart.discountOnTotalPrice.discountedNetAmount?.centAmount || 0;
    const amountIncludingTax = cart.discountOnTotalPrice.discountedGrossAmount?.centAmount || 0;
    const taxAmount = amountIncludingTax - amountExcludingTax;

    lineItems.push({
      description: 'Discount',
      quantity: 1,
      amountExcludingTax: -amountExcludingTax,
      amountIncludingTax: -amountIncludingTax,
      taxAmount: -taxAmount,
    });
  }

  return lineItems;
};

export const populateCartAddress = (address: CartAddress): Address => {
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
  } else {
    return paymentMethod;
  }
};

export const convertPaymentMethodFromAdyenFormat = (paymentMethod: string): string => {
  if (paymentMethod === 'scheme') {
    return 'card';
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
