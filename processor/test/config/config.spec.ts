import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';

describe('config', () => {
  const getModule = () => {
    vi.resetModules();
    return import('../../src/config/config.js');
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
    test('normalizes valid values to uppercase', async () => {
      const { resolveAdyenEnvironment } = await getModule();
      expect(resolveAdyenEnvironment('TEST')).toStrictEqual('TEST');
      expect(resolveAdyenEnvironment('live')).toStrictEqual('LIVE');
    });

    test('throws for a region-qualified value like LIVE-AU', async () => {
      const { resolveAdyenEnvironment } = await getModule();
      expect(() => resolveAdyenEnvironment('LIVE-AU')).toThrow(/ADYEN_ENVIRONMENT/);
    });
  });

  describe('resolveAdyenClientEnvironment', () => {
    test('derives "test" from a TEST backend environment when unset', async () => {
      const { resolveAdyenClientEnvironment } = await getModule();
      expect(resolveAdyenClientEnvironment(undefined, 'TEST')).toStrictEqual('test');
    });

    test('derives "live" from a LIVE backend environment when unset', async () => {
      const { resolveAdyenClientEnvironment } = await getModule();
      expect(resolveAdyenClientEnvironment(undefined, 'LIVE')).toStrictEqual('live');
    });

    test('respects an explicit region-qualified override', async () => {
      const { resolveAdyenClientEnvironment } = await getModule();
      expect(resolveAdyenClientEnvironment('live-au', 'LIVE')).toStrictEqual('live-au');
    });

    test('throws for an invalid or wrongly-cased value', async () => {
      const { resolveAdyenClientEnvironment } = await getModule();
      expect(() => resolveAdyenClientEnvironment('LIVE-AU', 'LIVE')).toThrow(/ADYEN_CLIENT_ENVIRONMENT/);
    });
  });

  describe('module load', () => {
    test('throws at import time when ADYEN_ENVIRONMENT is invalid', async () => {
      process.env.ADYEN_ENVIRONMENT = 'LIVE-AU';
      await expect(getModule()).rejects.toThrow(/ADYEN_ENVIRONMENT/);
    });

    test('derives adyenClientEnvironment from ADYEN_ENVIRONMENT when ADYEN_CLIENT_ENVIRONMENT is unset', async () => {
      process.env.ADYEN_ENVIRONMENT = 'LIVE';
      const { config } = await getModule();
      expect(config.adyenEnvironment).toStrictEqual('LIVE');
      expect(config.adyenClientEnvironment).toStrictEqual('live');
    });

    test('honors an explicit ADYEN_CLIENT_ENVIRONMENT override', async () => {
      process.env.ADYEN_ENVIRONMENT = 'LIVE';
      process.env.ADYEN_CLIENT_ENVIRONMENT = 'live-au';
      const { config } = await getModule();
      expect(config.adyenClientEnvironment).toStrictEqual('live-au');
    });
  });
});
