
import { MBWayBuilder } from "../components/payment-methods/mbway";
import { TrustlyBuilder } from "../components/payment-methods/trustly";
import { JCSBuilder } from "../components/payment-methods/jsc";
import { AfterPayBuilder } from "../components/payment-methods/afterpay";
import { BlikBuilder } from "../components/payment-methods/blik";
import { FPXBuilder } from "../components/payment-methods/fpx";
import { MobilePayBuilder } from "../components/payment-methods/mobilepay";
import { Przelewy24Builder } from "../components/payment-methods/przelewy24";
import { SwishBuilder } from "../components/payment-methods/swish";
import { VippsBuilder } from "../components/payment-methods/vipps";
import { ClearpayBuilder } from "../components/payment-methods/clearpay";
import { SepaBuilder } from "../components/payment-methods/sepadirectdebit";
import { BancontactMobileBuilder } from "../components/payment-methods/bancontactcard-mobile";
import { KlarnaBillieBuilder } from "../components/payment-methods/klarna-billie";
import { ApplePayBuilder } from "../components/payment-methods/applepay";
import { CardBuilder } from "../components/payment-methods/card";
import { GooglepayBuilder } from "../components/payment-methods/googlepay";
import { IdealBuilder } from "../components/payment-methods/ideal";
import { PaypalBuilder } from "../components/payment-methods/paypal";
import { KlarnaPayNowBuilder } from "../components/payment-methods/klarna-pay-now";
import { KlarnaPayLaterBuilder } from "../components/payment-methods/klarna-pay-later";
import { KlarnaPayOverTimeBuilder } from "../components/payment-methods/klarna-pay-over-time";
import { EPSBuilder } from "../components/payment-methods/eps";
import { BancontactCardBuilder } from "../components/payment-methods/bancontactcard";
import { TwintBuilder } from "../components/payment-methods/twint";
import { DropinEmbeddedBuilder } from "../dropin/dropin-embedded";
import { DropinType } from "./payment-enabler";
import { GooglePayExpressBuilder } from "../express/googlepay";
import { PayPalExpressBuilder } from "../express/paypal";
import { ApplePayExpressBuilder } from "../express/applepay";
import { StoredCardBuilder } from "../stored/stored-payment-methods/card";

export const SUPPORTED_METHODS = {
  applepay: ApplePayBuilder,
  bancontactcard: BancontactCardBuilder,
  bancontactmobile: BancontactMobileBuilder,
  blik: BlikBuilder,
  card: CardBuilder,
  eps: EPSBuilder,
  fpx: FPXBuilder,
  googlepay: GooglepayBuilder,
  ideal: IdealBuilder,
  klarna_billie: KlarnaBillieBuilder,
  klarna_pay_later: KlarnaPayLaterBuilder,
  klarna_pay_now: KlarnaPayNowBuilder,
  klarna_pay_overtime: KlarnaPayOverTimeBuilder,
  przelewy24: Przelewy24Builder,
  paypal: PaypalBuilder,
  sepadirectdebit: SepaBuilder,
  swish: SwishBuilder,
  twint: TwintBuilder,
  vipps: VippsBuilder,
  mobilepay: MobilePayBuilder,
  afterpay: AfterPayBuilder,
  clearpay: ClearpayBuilder,
  mbway: MBWayBuilder,
  trustly: TrustlyBuilder,
  jcs: JCSBuilder,
} as const;

export type SupportedMethod = keyof typeof SUPPORTED_METHODS;

export const SUPPORTED_DROPIN_METHODS: Partial<Record<keyof typeof DropinType, any>> = {
  embedded: DropinEmbeddedBuilder
} as const;

export type SupportedDropinMethod = keyof typeof SUPPORTED_DROPIN_METHODS;

export const SUPPORTED_EXPRESS_METHODS = {
  googlepay: GooglePayExpressBuilder,
  paypal: PayPalExpressBuilder,
  applepay: ApplePayExpressBuilder,
} as const;

export type SupportedExpressMethod = keyof typeof SUPPORTED_EXPRESS_METHODS;

export const SUPPORTED_STORED_METHODS = {
  card: StoredCardBuilder,
};

export type SupportedStoredMethod = keyof typeof SUPPORTED_STORED_METHODS;
