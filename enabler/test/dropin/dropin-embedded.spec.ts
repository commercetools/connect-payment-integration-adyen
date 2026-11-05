import { describe, test, expect, vi, beforeEach } from "vitest";

const dropinRemove = vi.fn();

vi.mock("@adyen/adyen-web", () => {
  class Dropin {
    static lastProps: any;
    remove = dropinRemove;
    constructor(_checkout: any, props: any) {
      Dropin.lastProps = props;
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

import { Dropin } from "@adyen/adyen-web";
import { resolveClickToPayConfiguration } from "../../src/utils/click-to-pay";
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

describe("DropinComponents Click to Pay", () => {
  const build = (override: Record<string, any>, cartShopperEmail?: string, shopperEmail?: string) => {
    new DropinComponents({
      adyenCheckout: { options: {} } as any,
      dropinOptions: { shopperEmail },
      dropinConfigOverride: override,
      storedPaymentMethodsConfig: { isEnabled: false, storedPaymentMethods: [] } as any,
      processorUrl: "http://processor",
      sessionId: "session-id",
      cartShopperEmail,
    }).init();
    return (Dropin as any).lastProps.paymentMethodsConfiguration.card;
  };
  const enabled = { card: { clickToPayConfiguration: { merchantDisplayName: "Shop" } } };

  test("is not enabled by default", () => {
    expect(build({}, "cart@example.com", "runtime@example.com").clickToPayConfiguration).toBeUndefined();
  });

  test("falls back to the cart email", () => {
    expect(build(enabled, "cart@example.com").clickToPayConfiguration).toEqual({
      shopperEmail: "cart@example.com",
      merchantDisplayName: "Shop",
    });
  });

  test("the shopperEmail passed at runtime takes precedence over the cart email", () => {
    expect(build(enabled, "cart@example.com", "runtime@example.com").clickToPayConfiguration.shopperEmail).toBe(
      "runtime@example.com",
    );
  });
});

describe("resolveClickToPayConfiguration", () => {
  test("is empty when not configured", () => {
    expect(resolveClickToPayConfiguration({}, { merchantShopperEmail: "m@b.com", cartShopperEmail: "c@b.com" })).toEqual({});
  });

  test("runtime email wins, cart email is the fallback", () => {
    const override = { clickToPayConfiguration: {} };
    expect(resolveClickToPayConfiguration(override, { cartShopperEmail: "c@b.com" })).toEqual({
      clickToPayConfiguration: { shopperEmail: "c@b.com" },
    });
    expect(
      resolveClickToPayConfiguration(override, { merchantShopperEmail: "m@b.com", cartShopperEmail: "c@b.com" }),
    ).toEqual({ clickToPayConfiguration: { shopperEmail: "m@b.com" } });
  });

  test("ignores a static shopperEmail in the component config", () => {
    const override = { clickToPayConfiguration: { shopperEmail: "static@b.com" } };
    expect(resolveClickToPayConfiguration(override, {})).toEqual({ clickToPayConfiguration: {} });
    expect(resolveClickToPayConfiguration(override, { cartShopperEmail: "c@b.com" })).toEqual({
      clickToPayConfiguration: { shopperEmail: "c@b.com" },
    });
  });
});
