import { LineItem } from '@adyen/api-library/lib/src/typings/checkout/lineItem';
import {
  Cart,
  LineItem as CoCoLineItem,
  CustomLineItem,
  Order,
  NormalizedShipping,
  CurrencyConverters,
  TaxRateConverter,
} from '@commercetools/connect-payments-sdk';
import { paymentSDK } from '../../payment-sdk';
import { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from '../../constants/currencies';

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

export const mapCoCoLineItemToAdyenLineItem = (lineItem: CoCoLineItem): LineItem[] => {
  const lineItems: LineItem[] = [];

  const lineItemMapped: LineItem = {
    id: lineItem.variant.sku,
    description: Object.values(lineItem.name)[0], //TODO: get proper locale
    quantity: lineItem.quantity,
    amountExcludingTax: getItemAmount(getAmountExcludingTax(lineItem), lineItem.quantity),
    amountIncludingTax: getItemAmount(getAmountIncludingTax(lineItem), lineItem.quantity),
    taxAmount: getItemAmount(getTaxAmount(lineItem), lineItem.quantity),
    taxPercentage: TaxRateConverter.convertCoCoTaxPercentage(lineItem.taxRate?.amount),
  };

  lineItems.push(lineItemMapped);

  const discountedAmount = lineItem.price.value.centAmount - lineItem.totalPrice.centAmount;
  const hasLineItemBeenDiscounted = discountedAmount !== 0;

  if (hasLineItemBeenDiscounted) {
    const discountedLineItem: LineItem = {
      id: `${lineItem.variant.sku}-discount`,
      description: `${Object.values(lineItem.name)[0]} discount`, //TODO: get proper locale
      quantity: lineItem.quantity,
      amountIncludingTax: -discountedAmount,
    };

    lineItems.push(discountedLineItem);
  }

  return lineItems;
};

export const mapCoCoCustomLineItemToAdyenLineItem = (customLineItem: CustomLineItem): LineItem[] => {
  const lineItems: LineItem[] = [];

  const lineItemMapped = {
    id: customLineItem.id,
    description: Object.values(customLineItem.name)[0], //TODO: get proper locale
    quantity: customLineItem.quantity,
    amountExcludingTax: getItemAmount(getAmountExcludingTax(customLineItem), customLineItem.quantity),
    amountIncludingTax: getItemAmount(getAmountIncludingTax(customLineItem), customLineItem.quantity),
    taxAmount: getItemAmount(getTaxAmount(customLineItem), customLineItem.quantity),
    taxPercentage: TaxRateConverter.convertCoCoTaxPercentage(customLineItem.taxRate?.amount),
  };

  lineItems.push(lineItemMapped);

  const discountedAmount = customLineItem.money.centAmount - customLineItem.totalPrice.centAmount;
  const hasLineItemBeenDiscounted = discountedAmount !== 0;

  if (hasLineItemBeenDiscounted) {
    const discountedLineItem: LineItem = {
      id: `${customLineItem.id}-discount`,
      description: `${Object.values(customLineItem.name)[0]} discount`, //TODO: get proper locale
      quantity: customLineItem.quantity,
      amountIncludingTax: -discountedAmount,
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

    // TODO: SCC-3189: should we do anything specific for shipping discounts?

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

  // TODO: SCC-3189: do we need to anything else for cart discounts on total price?

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
  // TODO: SCC-3189: limit sending of discounted line items to only afterpaytouch
  const adyenLineItems: LineItem[] = [];

  cart.lineItems.forEach((lineItem) => adyenLineItems.push(...mapCoCoLineItemToAdyenLineItem(lineItem)));

  cart.customLineItems.forEach((customLineItem) =>
    adyenLineItems.push(...mapCoCoCustomLineItemToAdyenLineItem(customLineItem)),
  );

  adyenLineItems.push(...mapCoCoShippingInfoToAdyenLineItem(paymentSDK.ctCartService.getNormalizedShipping({ cart })));

  if (cart.discountOnTotalPrice) {
    adyenLineItems.push(
      mapCoCoDiscountOnTotalPriceToAdyenLineItem({ discountOnTotalPrice: cart.discountOnTotalPrice }),
    );
  }

  return adyenLineItems;
};
