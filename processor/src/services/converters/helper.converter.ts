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
  TaxRateConverter,
} from '@commercetools/connect-payments-sdk';
import {
  getAllowedPaymentMethodsFromContext,
  getCtSessionIdFromContext,
  getProcessorUrlFromContext,
} from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';
import { GenericIssuerPaymentMethodDetails } from '@adyen/api-library/lib/src/typings/checkout/genericIssuerPaymentMethodDetails';
import { ApplicationInfo } from '@adyen/api-library/lib/src/typings/applicationInfo';
import { config } from '../../config/config';

/**
 * These payment methods require product line item discounts to be send seperately as a new (negative value) line item
 */
export const PAYMENT_METHODS_REQUIRE_SEPERATE_DISCOUNT = ['afterpaytouch', 'clearpay'];

export const mapCoCoLineItemToAdyenLineItem = (lineItem: CoCoLineItem): LineItem => {
  return {
    id: lineItem.variant.sku,
    description: Object.values(lineItem.name)[0], //TODO: get proper locale
    quantity: lineItem.quantity,
    amountExcludingTax: getItemAmount(getAmountExcludingTax(lineItem), lineItem.quantity),
    amountIncludingTax: getItemAmount(getAmountIncludingTax(lineItem), lineItem.quantity),
    taxAmount: getItemAmount(getTaxAmount(lineItem), lineItem.quantity),
    taxPercentage: TaxRateConverter.convertCoCoTaxPercentage(lineItem.taxRate?.amount),
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
    taxPercentage: TaxRateConverter.convertCoCoTaxPercentage(customLineItem.taxRate?.amount),
  };
};

const mapOverAmountsOfLineItemToSingleQuantityPricing = (lineItem: CoCoLineItem | CustomLineItem) => {
  const amountExcludingTaxForOneQuantity = getItemAmount(getAmountExcludingTax(lineItem), lineItem.quantity);
  const amountIncludingTaxForOneQuantity = getItemAmount(getAmountIncludingTax(lineItem), lineItem.quantity);
  const taxAmountForOneQuantity = getItemAmount(getTaxAmount(lineItem), lineItem.quantity);

  const isLineItem = 'price' in lineItem;

  const productPriceWithoutProductDiscounts = isLineItem ? lineItem.price.value.centAmount : lineItem.money.centAmount;

  const discountedAmountForOneQuantity = productPriceWithoutProductDiscounts - amountIncludingTaxForOneQuantity;
  const hasLineItemBeenDiscounted = discountedAmountForOneQuantity !== 0;

  return {
    amountExcludingTaxForOneQuantity,
    amountIncludingTaxForOneQuantity,
    taxAmountForOneQuantity,
    discountedAmountForOneQuantity,
    hasLineItemBeenDiscounted,
  };
};

const mapCoCoLineItemToAdyenLineItemSeperateProductDiscounts = (
  lineItem: CoCoLineItem | CustomLineItem,
): LineItem[] => {
  const lineItems: LineItem[] = [];

  const amounts = mapOverAmountsOfLineItemToSingleQuantityPricing(lineItem);

  const isLineItem = 'price' in lineItem;
  const id = isLineItem ? lineItem.variant.sku : lineItem.id;

  const lineItemMapped = {
    id: id,
    description: Object.values(lineItem.name)[0], //TODO: get proper locale
    quantity: lineItem.quantity,
    amountExcludingTax: amounts.amountExcludingTaxForOneQuantity + amounts.discountedAmountForOneQuantity,
    amountIncludingTax: amounts.amountIncludingTaxForOneQuantity + amounts.discountedAmountForOneQuantity,
    taxAmount: amounts.taxAmountForOneQuantity,
    taxPercentage: TaxRateConverter.convertCoCoTaxPercentage(lineItem.taxRate?.amount),
  };

  lineItems.push(lineItemMapped);

  if (amounts.hasLineItemBeenDiscounted) {
    const discountedLineItem: LineItem = {
      id: `${id}-discount`,
      description: `${Object.values(lineItem.name)[0]} discount`, //TODO: get proper locale
      quantity: lineItem.quantity,
      amountIncludingTax: -amounts.discountedAmountForOneQuantity,
    };

    lineItems.push(discountedLineItem);
  }

  return lineItems;
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
      taxPercentage: TaxRateConverter.convertCoCoTaxPercentage(shipping.shippingInfo.taxRate?.amount),
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
  paymentMethod?: string,
): LineItem[] => {
  // CoCo model between these attributes is shared between a Cart and Order hence we can re-use the existing mapping logic.
  return mapCoCoCartItemsToAdyenLineItems(order, paymentMethod);
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
  paymentMethod?: string,
): LineItem[] => {
  const seperateProductDiscounts = paymentMethod && PAYMENT_METHODS_REQUIRE_SEPERATE_DISCOUNT.includes(paymentMethod);

  const adyenLineItems: LineItem[] = [];

  for (const lineItem of cart.lineItems) {
    if (seperateProductDiscounts) {
      adyenLineItems.push(...mapCoCoLineItemToAdyenLineItemSeperateProductDiscounts(lineItem));
    } else {
      adyenLineItems.push(mapCoCoLineItemToAdyenLineItem(lineItem));
    }
  }

  for (const customLineItem of cart.customLineItems) {
    if (seperateProductDiscounts) {
      adyenLineItems.push(...mapCoCoLineItemToAdyenLineItemSeperateProductDiscounts(customLineItem));
    } else {
      adyenLineItems.push(mapCoCoCustomLineItemToAdyenLineItem(customLineItem));
    }
  }

  adyenLineItems.push(...mapCoCoShippingInfoToAdyenLineItem(paymentSDK.ctCartService.getNormalizedShipping({ cart })));

  if (cart.discountOnTotalPrice) {
    adyenLineItems.push(
      mapCoCoDiscountOnTotalPriceToAdyenLineItem({ discountOnTotalPrice: cart.discountOnTotalPrice }),
    );
  }

  return adyenLineItems;
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

const PAYMENT_METHOD_TO_ADYEN_MAPPING: Record<string, string> = {
  afterpay: 'afterpaytouch',
  bancontactcard: 'bcmc',
  bancontactmobile: 'bcmc_mobile',
  card: 'scheme',
  klarna_billie: 'klarna_b2b',
  klarna_pay_later: 'klarna',
  klarna_pay_now: 'klarna_paynow',
  klarna_pay_overtime: 'klarna_account',
  przelewy24: GenericIssuerPaymentMethodDetails.TypeEnum.OnlineBankingPl,
  fpx: 'molpay_ebanking_fpx_MY',
};

const ADYEN_TO_PAYMENT_METHOD_MAPPING: Record<string, string> = Object.entries(PAYMENT_METHOD_TO_ADYEN_MAPPING).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<string, string>,
);

export const convertPaymentMethodToAdyenFormat = (paymentMethod: string): string => {
  return PAYMENT_METHOD_TO_ADYEN_MAPPING[paymentMethod] ?? paymentMethod;
};

export const convertPaymentMethodFromAdyenFormat = (paymentMethod: string): string => {
  return ADYEN_TO_PAYMENT_METHOD_MAPPING[paymentMethod] ?? paymentMethod;
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

const getItemAmount = (totalAmount: number, quantity: number): number => {
  return parseFloat((totalAmount / quantity).toFixed(0));
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

const CT_CARD_BRAND_TO_ADYEN_MAPPING: Record<string, string> = {
  Amex: 'amex',
  Bancontact: 'bcmc',
  CartesBancaires: 'cartebancaire',
  Diners: 'diners',
  Discover: 'discover',
  Jcb: 'jcb',
  Maestro: 'maestro',
  Mastercard: 'mc',
  UnionPay: 'cup',
  Visa: 'visa',
};

const ADYEN_CARD_BRAND_TO_CT_MAPPING: Record<string, string> = Object.entries(CT_CARD_BRAND_TO_ADYEN_MAPPING).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Converts CT brand to the Adyen style. Will return "Unknown" if the brand mapping is not in place or a undefined value is provided.
 */
export const convertCTCardBrandToAdyenFormat = (brand?: string): string => {
  if (!brand) {
    return 'Unknown';
  }

  return CT_CARD_BRAND_TO_ADYEN_MAPPING[brand] ?? 'Unknown';
};

/**
 * Converts Adyen brand to the CT style. Will return "Unknown" if the brand mapping is not in place or a undefined value is provided.
 */
export const convertAdyenCardBrandToCTFormat = (brand?: string): string => {
  if (!brand) {
    return 'Unknown';
  }

  return ADYEN_CARD_BRAND_TO_CT_MAPPING[brand] ?? 'Unknown';
};

export const extractShopperName = (cart: Cart): { firstName: string; lastName: string } | undefined => {
  const { billingAddress, shippingAddress } = cart;
  const firstName = billingAddress?.firstName ?? shippingAddress?.firstName;
  const lastName = billingAddress?.lastName ?? shippingAddress?.lastName;

  if (!firstName || !lastName) {
    return undefined;
  }
  return {
    firstName: firstName ?? '',
    lastName: lastName ?? '',
  };
};
