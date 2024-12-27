import { describe, test, expect } from '@jest/globals';
import { CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING, CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING } from './currencies';

describe('constants.currencies', () => {
  test('CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING', () => {
    const expected = new Map<string, number>([
      ['CLP', -2],
      ['CVE', 2],
      ['IDR', 2],
      ['ISK', -2],
      ['CVE', 2],
    ]);

    expect(CURRENCIES_FROM_ISO_TO_ADYEN_MAPPING).toEqual(expected);
  });

  test('CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING', () => {
    const expected = new Map<string, number>([
      ['CLP', 2],
      ['CVE', -2],
      ['IDR', -2],
      ['ISK', 2],
      ['CVE', -2],
    ]);

    expect(CURRENCIES_FROM_ADYEN_TO_ISO_MAPPING).toEqual(expected);
  });
});
