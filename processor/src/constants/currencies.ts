// Mappings are based on the deviatons from https://en.wikipedia.org/wiki/ISO_4217 defined on the Adyen table defined https://docs.adyen.com/development-resources/currency-codes/#note

// TODO: SCC-2800: figure out if we can move some of the mapping stuff to here using a updated connect-payments-sdk
const CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING = new Map<string, number>([
  ['CLP', -2],
  ['CVE', 2],
  ['IDR', 2],
  ['ISK', -2],
  ['CVE', 2],
]);

const CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING = new Map<string, number>([
  ['CLP', 2],
  ['CVE', -2],
  ['IDR', -2],
  ['ISK', 2],
  ['CVE', -2],
]);

export { CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING, CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING };
