import { describe, test, expect, vi, beforeEach } from "vitest";

const clickToPayCtor = vi.fn();

vi.mock("@adyen/adyen-web", () => {
  class ClickToPay {
    constructor(...args: unknown[]) {
      clickToPayCtor(...args);
    }
  }
  return { ClickToPay };
});

import { ClickToPayBuilder } from "../../src/components/payment-methods/click-to-pay";

describe("ClickToPayBuilder", () => {
  beforeEach(() => clickToPayCtor.mockClear());

  test("creates the Adyen ClickToPay component merging the override and component options", () => {
    const adyenCheckout = {};
    const builder = new ClickToPayBuilder({
      adyenCheckout,
      sessionId: "session-id",
      processorUrl: "http://processor",
      paymentComponentsConfigOverride: {
        clicktopay: { shopperEmail: "shopper@example.com", merchantDisplayName: "Shop" },
      },
      setStorePaymentDetails: vi.fn(),
    } as any);

    builder.build({ showPayButton: false });

    expect(clickToPayCtor).toHaveBeenCalledWith(adyenCheckout, {
      shopperEmail: "shopper@example.com",
      merchantDisplayName: "Shop",
      showPayButton: false,
    });
  });
});
