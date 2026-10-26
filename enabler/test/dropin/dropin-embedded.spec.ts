import { describe, test, expect, vi, beforeEach } from "vitest";

const dropinRemove = vi.fn();

vi.mock("@adyen/adyen-web", () => {
  class Dropin {
    remove = dropinRemove;
  }
  // The builder only needs the payment method classes to exist; they are never instantiated here.
  const stub = class {};
  return {
    Dropin,
    Card: stub,
    PayPal: stub,
    GooglePay: stub,
    ApplePay: stub,
    Redirect: stub,
    SepaDirectDebit: stub,
    Twint: stub,
    Klarna: stub,
    Bancontact: stub,
    BcmcMobile: stub,
    EPS: stub,
    Blik: stub,
    OnlineBankingPL: stub,
    Swish: stub,
    Vipps: stub,
    AfterPay: stub,
    MolPayEBankingMY: stub,
    Trustly: stub,
    MBWay: stub,
    Giftcard: stub,
    WeChat: stub,
    Econtext: stub,
  };
});

import { DropinComponents } from "../../src/dropin/dropin-embedded";

describe("DropinComponents.remove", () => {
  beforeEach(() => {
    dropinRemove.mockClear();
  });

  const buildDropin = () =>
    new DropinComponents({
      adyenCheckout: { options: {} } as any,
      dropinOptions: {},
      dropinConfigOverride: {},
      storedPaymentMethodsConfig: { isEnabled: false, storedPaymentMethods: [] } as any,
      processorUrl: "http://processor",
      sessionId: "session-id",
    });

  test("removes the underlying Adyen Drop-in", async () => {
    const dropin = buildDropin();
    dropin.init();

    await dropin.remove();

    expect(dropinRemove).toHaveBeenCalledTimes(1);
  });
});
