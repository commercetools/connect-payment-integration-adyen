import type { Country } from '../types.ts';

export const COUNTRY_CURRENCY: Record<string, string> = {
  AU: 'AUD', AT: 'EUR', BE: 'EUR', DK: 'DKK', FI: 'EUR',
  FR: 'EUR', DE: 'EUR', IT: 'EUR', NL: 'EUR', NO: 'NOK',
  PL: 'PLN', PT: 'EUR', ES: 'EUR', SE: 'SEK', CH: 'CHF',
  GB: 'GBP', US: 'USD',
};

export const SHIPPING_COST_BY_CURRENCY: Record<string, number> = {
  EUR: 500, USD: 600, GBP: 400, DKK: 3500, NOK: 4900,
  SEK: 4900, PLN: 1900, CHF: 500, AUD: 700,
};

export const COUNTRIES: Country[] = [
  { code: 'AU', name: 'Australia',      currency: 'AUD', taxRate: 0.10,  taxName: 'GST' },
  { code: 'AT', name: 'Austria',        currency: 'EUR', taxRate: 0.20,  taxName: 'VAT' },
  { code: 'BE', name: 'Belgium',        currency: 'EUR', taxRate: 0.21,  taxName: 'VAT' },
  { code: 'DK', name: 'Denmark',        currency: 'DKK', taxRate: 0.25,  taxName: 'VAT' },
  { code: 'FI', name: 'Finland',        currency: 'EUR', taxRate: 0.24,  taxName: 'VAT' },
  { code: 'FR', name: 'France',         currency: 'EUR', taxRate: 0.20,  taxName: 'VAT' },
  { code: 'DE', name: 'Germany',        currency: 'EUR', taxRate: 0.19,  taxName: 'VAT' },
  { code: 'IT', name: 'Italy',          currency: 'EUR', taxRate: 0.22,  taxName: 'VAT' },
  { code: 'NL', name: 'Netherlands',    currency: 'EUR', taxRate: 0.21,  taxName: 'VAT' },
  { code: 'NO', name: 'Norway',         currency: 'NOK', taxRate: 0.25,  taxName: 'VAT' },
  { code: 'PL', name: 'Poland',         currency: 'PLN', taxRate: 0.23,  taxName: 'VAT' },
  { code: 'PT', name: 'Portugal',       currency: 'EUR', taxRate: 0.23,  taxName: 'VAT' },
  { code: 'ES', name: 'Spain',          currency: 'EUR', taxRate: 0.21,  taxName: 'VAT' },
  { code: 'SE', name: 'Sweden',         currency: 'SEK', taxRate: 0.25,  taxName: 'VAT' },
  { code: 'CH', name: 'Switzerland',    currency: 'CHF', taxRate: 0.077, taxName: 'VAT' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', taxRate: 0.20,  taxName: 'VAT' },
  { code: 'US', name: 'United States',  currency: 'USD', taxRate: 0.08,  taxName: 'Sales Tax' },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(rate === 0.077 ? 1 : 0)}%`;
}

export function formatCurrency(centAmount: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(centAmount / 100);
}

export const ALLOWED_PAYMENT_METHODS: string[] = [
  // 'alipay','afterpay', 'applepay', 'bancontactcard', 'bancontactmobile', 'blik', 'card',
  // 'clearpay', 'eps', 'fpx', 'googlepay', 'ideal', 'klarna_billie',
  // 'klarna_pay_later', 'klarna_pay_now', 'klarna_pay_overtime', 'mbway',
  // 'mobilepay', 'paypal', 'przelewy24', 'sepadirectdebit', 'swish',
  // 'trustly', 'twint', 'vipps', 'wechatpay', 'zip',
];

export const EXPRESS_TYPES: string[] = ['applepay', 'googlepay', 'paypal'];
