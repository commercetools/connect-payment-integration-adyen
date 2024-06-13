import { describe, test, expect } from '@jest/globals';
import { METHODS_REQUIRE_LINE_ITEMS } from '../../../src/services/converters/capture-payment.converter';

describe('capture.converter', () => {
  test('METHODS_REQUIRE_LINE_ITEMS', () => {
    const expected = ['klarna', 'klarna_account', 'klarna_paynow'];
    expect(METHODS_REQUIRE_LINE_ITEMS).toEqual(expected);
  });
});
