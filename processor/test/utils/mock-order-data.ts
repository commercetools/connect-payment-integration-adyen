import { Order } from '@commercetools/connect-payments-sdk';

export const mockGetOrderResult: Order = {
  id: '123456',
  version: 1,
  createdAt: '2024-02-13T00:00:00.000Z',
  lastModifiedAt: '2024-02-13T00:00:00.000Z',
  customLineItems: [],
  lineItems: [
    {
      id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
      productId: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
      productKey: 'walnut-counter-stool',
      name: {
        'en-US': 'Walnut Counter Stool',
        'en-GB': 'Walnut Counter Stool',
        'de-DE': 'Barhocker aus Nussbaumholz',
      },
      productType: {
        typeId: 'product-type',
        id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
      },
      productSlug: {
        'en-US': 'walnut-counter-stool',
        'en-GB': 'walnut-counter-stool',
        'de-DE': 'barhocker-aus-walnussholz',
      },
      variant: {
        id: 1,
        sku: 'WCSI-09',
        prices: [
          {
            id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
            value: {
              type: 'centPrecision',
              currencyCode: 'EUR',
              centAmount: 8999,
              fractionDigits: 2,
            },
          },
          {
            id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
            value: {
              type: 'centPrecision',
              currencyCode: 'GBP',
              centAmount: 8999,
              fractionDigits: 2,
            },
            country: 'GB',
          },
          {
            id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
            value: {
              type: 'centPrecision',
              currencyCode: 'USD',
              centAmount: 8999,
              fractionDigits: 2,
            },
            country: 'US',
          },
        ],
        images: [
          {
            url: 'https://imagedomain.com/Walnut_Counter_Stool-1.1.jpeg',
            dimensions: {
              w: 5906,
              h: 5906,
            },
          },
        ],
        attributes: [
          {
            name: 'productspec',
            value: {
              'en-GB': '- Includes 1 stool',
              'en-US': '- Includes 1 stool',
              'de-DE': '- Beinhaltet 1 Hocker',
            },
          },
          {
            name: 'color-filter',
            value: {
              key: '#964B00',
              label: {
                'de-DE': 'Dunkelbraun',
                'en-GB': 'Dark Brown',
                'en-US': 'Dark Brown',
              },
            },
          },
          {
            name: 'finishlabel',
            value: {
              'en-GB': 'Walnut',
              'de-DE': 'Nussbaum',
              'en-US': 'Walnut',
            },
          },
          {
            name: 'finish',
            value: {
              'en-GB': '#75412E',
              'en-US': '#75412E',
              'de-DE': '#75412E',
            },
          },
        ],
        assets: [],
        availability: {
          isOnStock: true,
          availableQuantity: 100,
          version: 1,
          id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
        },
      },
      price: {
        id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
        value: {
          type: 'centPrecision',
          currencyCode: 'EUR',
          centAmount: 8999,
          fractionDigits: 2,
        },
      },
      quantity: 1,
      discountedPricePerQuantity: [],
      taxRate: {
        name: 'Standard VAT for NL',
        amount: 0.19,
        includedInPrice: true,
        country: 'NL',
        id: 'vDls7YG4',
        key: 'vat-standard-nl',
        subRates: [],
      },
      perMethodTaxRate: [],
      addedAt: '2024-06-06T09:06:09.197Z',
      lastModifiedAt: '2024-06-06T09:06:09.197Z',
      state: [
        {
          quantity: 1,
          state: {
            typeId: 'state',
            id: 'fbb6ea54-e96b-4ebe-b4c9-ccad345bd5d6',
          },
        },
      ],
      priceMode: 'Platform',
      lineItemMode: 'Standard',
      totalPrice: {
        type: 'centPrecision',
        currencyCode: 'EUR',
        centAmount: 8999,
        fractionDigits: 2,
      },
      taxedPrice: {
        totalNet: {
          type: 'centPrecision',
          currencyCode: 'EUR',
          centAmount: 7562,
          fractionDigits: 2,
        },
        totalGross: {
          type: 'centPrecision',
          currencyCode: 'EUR',
          centAmount: 8999,
          fractionDigits: 2,
        },
        taxPortions: [
          {
            rate: 0.19,
            amount: {
              type: 'centPrecision',
              currencyCode: 'EUR',
              centAmount: 1437,
              fractionDigits: 2,
            },
            name: 'Standard VAT for NL',
          },
        ],
        totalTax: {
          type: 'centPrecision',
          currencyCode: 'EUR',
          centAmount: 1437,
          fractionDigits: 2,
        },
      },
      taxedPricePortions: [],
    },
  ],
  orderState: '',
  origin: '',
  refusedGifts: [],
  shipping: [],
  shippingMode: '',
  syncInfo: [],
  totalPrice: {
    centAmount: 8999,
    currencyCode: 'EUR',
    type: 'centPrecision',
    fractionDigits: 2,
  },
};
