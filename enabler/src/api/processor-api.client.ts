import { balanceCheckResponseType, GiftCardElementData } from '@adyen/adyen-web';
import {
  ConfigResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  StoredPaymentMethodsResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
  ConfirmPaymentDetailsRequest,
  ConfirmPaymentDetailsResponse,
  CreateApplePaySessionRequest,
  CreateApplePaySessionResponse,
  ExpressConfigRequest,
  ExpressConfigResponse,
  ExpressPaymentDataResponse,
  CreateExpressPaymentRequest,
  CreateExpressPaymentResponse,
  ConfirmExpressPaymentDetailsRequest,
  ConfirmExpressPaymentDetailsResponse,
  UpdatePaypalOrderRequest,
  UpdatePaypalOrderResponse,
  CreateOrderResponse,
  CancelOrderRequest,
  CancelOrderResponse,
} from './processor-api.type';

export class ProcessorApiClient {
  private readonly host: string;
  private readonly sessionId: string;

  constructor(opts: { processorUrl: string; sessionId: string }) {
    this.host = opts.processorUrl.replace(/\/$/, '');
    this.sessionId = opts.sessionId;
  }

  private get authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Session-Id': this.sessionId,
    };
  }

  // ─── Session & Configuration ──────────────────────────────────────────────

  async createSession(data: CreateSessionRequest): Promise<CreateSessionResponse> {
    const res = await fetch(`${this.host}/sessions`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create session (${res.status})`);
    return res.json();
  }

  async getConfig(): Promise<ConfigResponse> {
    const res = await fetch(`${this.host}/operations/config`, {
      method: 'GET',
      headers: this.authHeaders,
    });
    if (!res.ok) throw new Error(`Failed to get config (${res.status})`);
    return res.json();
  }

  async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponse> {
    const res = await fetch(`${this.host}/stored-payment-methods`, {
      method: 'GET',
      headers: this.authHeaders,
    });
    if (!res.ok) throw new Error(`Failed to get stored payment methods (${res.status})`);
    return res.json();
  }

  async deleteStoredPaymentMethod(id: string): Promise<void> {
    const res = await fetch(`${this.host}/stored-payment-methods/${id}`, {
      method: 'DELETE',
      headers: { 'X-Session-Id': this.sessionId },
    });
    if (!res.ok) throw new Error(`Failed to delete stored payment method (${res.status})`);
  }

  // ─── Payments ──────────────────────────────────────────────────────

  async createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const res = await fetch(`${this.host}/payments`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create payment (${res.status})`);
    return res.json();
  }

  async confirmPaymentDetails(data: ConfirmPaymentDetailsRequest): Promise<ConfirmPaymentDetailsResponse> {
    const res = await fetch(`${this.host}/payments/details`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to confirm payment details (${res.status})`);
    return res.json();
  }

  async checkGiftCardBalance(data: GiftCardElementData): Promise<balanceCheckResponseType> {
    const res = await fetch(`${this.host}/paymentMethods/balance`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to check gift card balance (${res.status})`);
    return res.json();
  }

  async createApplePaySession(data: CreateApplePaySessionRequest): Promise<CreateApplePaySessionResponse> {
    const res = await fetch(`${this.host}/applepay-sessions`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create Apple Pay session (${res.status})`);
    return res.json();
  }

  // ─── Express payments ─────────────────────────────────────────────────────

  async getExpressConfig(data: ExpressConfigRequest): Promise<ExpressConfigResponse> {
    const res = await fetch(`${this.host}/express-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to get express config (${res.status})`);
    return res.json();
  }

  async getExpressPaymentData(): Promise<ExpressPaymentDataResponse> {
    const res = await fetch(`${this.host}/express-payment-data`, {
      method: 'GET',
      headers: this.authHeaders,
    });
    if (!res.ok) throw new Error(`Failed to get express payment data (${res.status})`);
    return res.json();
  }

  async createExpressPayment(data: CreateExpressPaymentRequest): Promise<CreateExpressPaymentResponse> {
    const res = await fetch(`${this.host}/express-payments`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create express payment (${res.status})`);
    return res.json();
  }

  async confirmExpressPaymentDetails(data: ConfirmExpressPaymentDetailsRequest): Promise<ConfirmExpressPaymentDetailsResponse> {
    const res = await fetch(`${this.host}/express-payments/details`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to confirm express payment details (${res.status})`);
    return res.json();
  }

  async updatePaypalOrder(data: UpdatePaypalOrderRequest): Promise<UpdatePaypalOrderResponse> {
    const res = await fetch(`${this.host}/paypal-express/order`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update PayPal order (${res.status})`);
    return res.json();
  }

  // ─── Orders (gift card split payments) ───────────────────────────────────

  async createOrder(): Promise<CreateOrderResponse> {
    const res = await fetch(`${this.host}/orders`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Failed to create order (${res.status})`);
    return res.json();
  }

  async cancelOrder(data: CancelOrderRequest): Promise<CancelOrderResponse> {
    const res = await fetch(`${this.host}/orders/cancel`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to cancel order (${res.status})`);
    return res.json();
  }
}
