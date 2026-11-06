import { describe, test, expect, vi, beforeEach } from "vitest";

const dropinRemove = vi.fn();
const dropinCtor = vi.fn();

vi.mock("@adyen/adyen-web", () => {
  class Dropin {
    remove = dropinRemove;
    constructor(...args: unknown[]) {
      dropinCtor(...args);
    }
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

describe("DropinComponents Click to Pay shopper email", () => {
  beforeEach(() => {
    dropinCtor.mockClear();
  });

  const cardConfigOf = (opts: { dropinConfigOverride?: Record<string, any>; shopperEmail?: string }) => {
    new DropinComponents({
      adyenCheckout: { options: {} } as any,
      dropinOptions: {},
      dropinConfigOverride: opts.dropinConfigOverride ?? {},
      storedPaymentMethodsConfig: { isEnabled: false, storedPaymentMethods: [] } as any,
      processorUrl: "http://processor",
      sessionId: "session-id",
      shopperEmail: opts.shopperEmail,
    }).init();
    return dropinCtor.mock.calls[0][1].paymentMethodsConfiguration.card;
  };

  test("sets the cart shopper email, keeping the rest of the configured clickToPayConfiguration", () => {
    const card = cardConfigOf({
      shopperEmail: "shopper@example.com",
      dropinConfigOverride: { card: { clickToPayConfiguration: { merchantDisplayName: "Shop" } } },
    });

    expect(card.clickToPayConfiguration).toEqual({
      merchantDisplayName: "Shop",
      shopperEmail: "shopper@example.com",
    });
  });

  test("leaves the configured clickToPayConfiguration untouched when the cart has no email", () => {
    const card = cardConfigOf({
      dropinConfigOverride: { card: { clickToPayConfiguration: { merchantDisplayName: "Shop" } } },
    });

    expect(card.clickToPayConfiguration).toEqual({ merchantDisplayName: "Shop" });
  });
});
