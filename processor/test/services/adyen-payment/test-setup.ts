import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { paymentSDK } from '../../../src/payment-sdk';
import * as Config from '../../../src/config/config';
import { AdyenOrderService } from '../../../src/services/adyen-order.service';
import { AdyenPaymentServiceOptions } from '../../../src/services/adyen-payment.service';

interface FlexibleConfig {
  [key: string]: string | boolean; // Adjust the type according to your config values
}

export function setupMockConfig(keysAndValues: Record<string, string | boolean>) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  vi.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
}

export function createPaymentServiceOptions(): AdyenPaymentServiceOptions {
  return {
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
    ctOrderService: paymentSDK.ctOrderService,
    ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
    ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService,
    orderService: new AdyenOrderService({ ctCartService: paymentSDK.ctCartService }),
  };
}

/** Registers the shared lifecycle hooks (network mock agent, mock reset/restore) and returns the agent for intercepts. */
export function setupMockAgent() {
  const mockAgent = new MockAgent();

  beforeAll(() => {
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  beforeEach(() => {
    vi.setConfig({ testTimeout: 10000 });
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    mockAgent.close();
  });

  return mockAgent;
}
