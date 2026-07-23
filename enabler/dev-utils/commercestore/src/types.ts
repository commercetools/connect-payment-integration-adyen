// ---- Global window env vars ----

declare global {
  interface Window {
    __VITE_CTP_PROJECT_KEY__: string;
    __VITE_CTP_API_URL__: string;
    __VITE_CTP_AUTH_URL__: string;
    __VITE_CTP_SESSION_URL__: string;
    __VITE_CTP_CLIENT_ID__: string;
    __VITE_CTP_CLIENT_SECRET__: string;
    __VITE_PROCESSOR_URL__: string;
    __VITE_PAYMENT_INTERFACE__: string | undefined;
  }
}

// ---- Domain types ----

export interface Country {
  code: string;
  name: string;
  currency: string;
  taxRate: number;
  taxName: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  streetName: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country?: string;
  region?: string;
  phone?: string;
  email?: string;
}

export interface LineItem {
  name: string;
  quantity: number;
  centAmount: number;
}

// ---- commercetools API types (minimal shapes we actually use) ----

export interface CtMoney {
  currencyCode: string;
  centAmount: number;
  fractionDigits?: number;
}

export interface CtTransaction {
  id: string;
  type: 'Authorization' | 'CancelAuthorization' | 'Charge' | 'Refund' | 'Chargeback';
  state: 'Initial' | 'Pending' | 'Success' | 'Failure';
  amount?: CtMoney;
  timestamp?: string;
}

export interface CtPayment {
  id: string;
  version: number;
  createdAt: string;
  amountPlanned: CtMoney;
  paymentMethodInfo?: { paymentInterface?: string; method?: string };
  transactions?: CtTransaction[];
}

export interface CtCart {
  id: string;
  version: number;
  currency: string;
  country?: string;
  customerId?: string;
  totalPrice?: CtMoney;
  taxedPrice?: { totalGross: CtMoney };
  shippingInfo?: { price: CtMoney };
}

export interface CtCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface CtTaxCategoryStatus {
  exists: boolean;
  id?: string;
  version?: number;
  rates: Record<string, number>;
}

export interface CtShippingMethodStatus {
  exists: boolean;
  currencies: string[];
}

// ---- Enabler types ----

export interface PaymentMethod {
  type: string;
  label?: string;
  unavailable?: boolean;
}

export interface StoredPaymentMethod {
  id: string;
  type: string;
  token?: string;
  isDefault?: boolean;
  createdAt?: string;
  displayOptions?: {
    endDigits?: string;
    brand?: { key: string };
    expiryMonth?: number;
    expiryYear?: number;
  };
}

export interface CheckoutResult {
  isSuccess: boolean;
  paymentReference?: string;
  message?: string;
}

export interface EnablerConfig {
  processorUrl: string;
  sessionId: string;
  countryCode?: string;
  currencyCode?: string;
  locale?: string;
  onComplete?: (result: CheckoutResult) => void;
  onError?: (err: Error, ctx?: unknown) => void;
}

export interface MountableComponent {
  mount(element: HTMLElement): void;
  unmount?(): void;
  remove?(): Promise<void>;
  submit?(): Promise<void>;
  isValid?(): boolean;
  showValidation?(): void;
}

interface ComponentBuilder {
  build(config?: Record<string, unknown>): MountableComponent;
}

export interface DropinBuildOptions {
  onDropinReady?: () => Promise<void>;
  onPayButtonClick?: () => Promise<void>;
}

interface DropinBuilder {
  build(config: DropinBuildOptions): MountableComponent;
}

export interface ExpressAddressData {
  country: string;
  firstName?: string;
  lastName?: string;
  streetName?: string;
  streetNumber?: string;
  additionalStreetInfo?: string;
  region?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface ExpressShippingOptionData {
  id: string;
  name: string;
  description?: string;
  isSelected?: boolean;
  amount: { centAmount: number; currencyCode: string };
}

export interface ExpressOptions {
  allowedCountries?: string[];
  initialAmount: { centAmount: number; currencyCode: string };
  onPayButtonClick: () => Promise<{ sessionId: string }>;
  onShippingAddressSelected: (opts: { address: ExpressAddressData }) => Promise<void>;
  getShippingMethods: (opts: { address: ExpressAddressData }) => Promise<ExpressShippingOptionData[]>;
  onShippingMethodSelected: (opts: { shippingMethod: { id: string } }) => Promise<void>;
  onPaymentSubmit: (opts: { shippingAddress: ExpressAddressData; billingAddress: ExpressAddressData; customerEmail: string }) => Promise<void>;
  onComplete?: (result: { isSuccess: boolean }) => void;
}

interface ExpressBuilder {
  build(config: ExpressOptions): MountableComponent;
}

export interface EnablerInstance {
  createComponentBuilder(type: string): Promise<ComponentBuilder>;
  createDropinBuilder(type: 'embedded'): Promise<DropinBuilder>;
  createExpressBuilder(type: string): Promise<ExpressBuilder>;
  createStoredPaymentMethodBuilder(type: string): Promise<ComponentBuilder>;
  isStoredPaymentMethodsEnabled?(): Promise<boolean>;
  getStoredPaymentMethods(opts: { allowedMethodTypes: string[] }): Promise<StoredPaymentMethod[]>;
}

export type EnablerConstructor = new (config: EnablerConfig) => EnablerInstance;

// ---- UI types ----

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface CountryStatus extends Country {
  hasTax: boolean;
  hasShipping: boolean;
  isReady: boolean;
}

export interface PaymentsFilters {
  status: string;
  type: string;
  search: string;
}
