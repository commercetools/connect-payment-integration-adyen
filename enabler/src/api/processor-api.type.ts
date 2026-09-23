import { CTAmount, CocoStoredPaymentMethod } from '../payment-enabler/payment-enabler';
import { CoreConfiguration, PaymentAction, RawPaymentMethod, ResultCode } from '@adyen/adyen-web';

type AdyenEnvironment = CoreConfiguration['environment'];

// ─── Session & Configuration ──────────────────────────────────────────────────

export type CreateSessionRequest = { shopperLocale: string };
export type CreateSessionResponse = {
  sessionData: { id: string; sessionData: string };
};

export type ConfigResponse = {
  environment: AdyenEnvironment;
  clientKey: string;
  applePayConfig?: { usesOwnCertificate: boolean };
  paymentComponentsConfig?: Record<string, Record<string, unknown>>;
  storedPaymentMethodsConfig?: { isEnabled: boolean };
};

export type StoredPaymentMethodsResponse = {
  storedPaymentMethods: CocoStoredPaymentMethod[];
};

// ─── Payments ──────────────────────────────────────────────────────────

export type CreatePaymentRequest = Record<string, unknown>;
export type CreatePaymentResponse = {
  resultCode: ResultCode;
  action?: PaymentAction;
  order?: { orderData: string; pspReference: string; remainingAmount?: { value: number; currency: string } };
  paymentReference: string;
};

export type ConfirmPaymentDetailsRequest = Record<string, unknown>;
export type ConfirmPaymentDetailsResponse = { resultCode: ResultCode };

export type CreateApplePaySessionRequest = { validationUrl: string };
export type CreateApplePaySessionResponse = Record<string, unknown>;

// ─── Express payments ─────────────────────────────────────────────────────────

export type ExpressConfigRequest = { countryCode: string };
export type ExpressConfigResponse = {
  config: {
    environment: AdyenEnvironment;
    clientKey: string;
    applePayConfig?: { usesOwnCertificate: boolean };
  };
  methods: Array<{ type: string; configuration: Record<string, string> }>;
};

export type ExpressPaymentDataResponse = {
  totalPrice: CTAmount;
  lineItems: Array<{ name: string; amount: CTAmount; type: string }>;
  currencyCode: string;
};

export type CreateExpressPaymentRequest = Record<string, unknown>;
export type CreateExpressPaymentResponse = {
  resultCode: ResultCode;
  action?: PaymentAction;
  paymentReference?: string;
};

export type ConfirmExpressPaymentDetailsRequest = Record<string, unknown>;
export type ConfirmExpressPaymentDetailsResponse = {
  resultCode: ResultCode;
  paymentReference?: string;
  paymentMethod?: RawPaymentMethod;
};

export type UpdatePaypalOrderRequest = {
  paymentReference?: string;
  pspReference: string;
  paymentData: string;
  deliveryMethods: Array<{
    reference: string;
    description: string;
    type: string;
    amount: { currency: string; value: number };
    selected: boolean;
  }>;
  originalAmount: CTAmount;
};
export type UpdatePaypalOrderResponse = Record<string, unknown>;

// ─── Orders (gift card split payments) ───────────────────────────────────────

export type CreateOrderResponse = {
  orderData: string;
  pspReference?: string;
  amount: { value: number; currency: string };
  remainingAmount: { value: number; currency: string };
};

export type CancelOrderRequest = {
  orderData: string;
  pspReference: string;
};

export type CancelOrderResponse = {
  pspReference: string;
  resultCode: string;
};
