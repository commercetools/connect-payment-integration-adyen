import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('config', () => {
  const getModule = () => {
    jest.resetModules();
    return require('../../src/config/config');
  };

  beforeEach(() => {
    delete process.env.ADYEN_ENVIRONMENT;
    delete process.env.ADYEN_CLIENT_ENVIRONMENT;
  });

  afterEach(() => {
    delete process.env.ADYEN_ENVIRONMENT;
    delete process.env.ADYEN_CLIENT_ENVIRONMENT;
  });

  describe('resolveAdyenEnvironment', () => {
    test('normalizes valid values to uppercase', () => {
      const { resolveAdyenEnvironment } = getModule();
      expect(resolveAdyenEnvironment('TEST')).toStrictEqual('TEST');
      expect(resolveAdyenEnvironment('live')).toStrictEqual('LIVE');
    });

    test('throws for a region-qualified value like LIVE-AU', () => {
      const { resolveAdyenEnvironment } = getModule();
      expect(() => resolveAdyenEnvironment('LIVE-AU')).toThrow(/ADYEN_ENVIRONMENT/);
    });
  });

  describe('resolveAdyenClientEnvironment', () => {
    test('derives "test" from a TEST backend environment when unset', () => {
      const { resolveAdyenClientEnvironment } = getModule();
      expect(resolveAdyenClientEnvironment(undefined, 'TEST')).toStrictEqual('test');
    });

    test('derives "live" from a LIVE backend environment when unset', () => {
      const { resolveAdyenClientEnvironment } = getModule();
      expect(resolveAdyenClientEnvironment(undefined, 'LIVE')).toStrictEqual('live');
    });

    test('respects an explicit region-qualified override', () => {
      const { resolveAdyenClientEnvironment } = getModule();
      expect(resolveAdyenClientEnvironment('live-au', 'LIVE')).toStrictEqual('live-au');
    });

    test('throws for an invalid or wrongly-cased value', () => {
      const { resolveAdyenClientEnvironment } = getModule();
      expect(() => resolveAdyenClientEnvironment('LIVE-AU', 'LIVE')).toThrow(/ADYEN_CLIENT_ENVIRONMENT/);
    });
  });

  describe('module load', () => {
    test('throws at import time when ADYEN_ENVIRONMENT is invalid', () => {
      process.env.ADYEN_ENVIRONMENT = 'LIVE-AU';
      expect(() => getModule()).toThrow(/ADYEN_ENVIRONMENT/);
    });

    test('derives adyenClientEnvironment from ADYEN_ENVIRONMENT when ADYEN_CLIENT_ENVIRONMENT is unset', () => {
      process.env.ADYEN_ENVIRONMENT = 'LIVE';
      const { config } = getModule();
      expect(config.adyenEnvironment).toStrictEqual('LIVE');
      expect(config.adyenClientEnvironment).toStrictEqual('live');
    });

    test('honors an explicit ADYEN_CLIENT_ENVIRONMENT override', () => {
      process.env.ADYEN_ENVIRONMENT = 'LIVE';
      process.env.ADYEN_CLIENT_ENVIRONMENT = 'live-au';
      const { config } = getModule();
      expect(config.adyenClientEnvironment).toStrictEqual('live-au');
    });
  });
});
