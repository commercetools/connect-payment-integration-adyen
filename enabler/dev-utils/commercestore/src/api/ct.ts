import { ALLOWED_PAYMENT_METHODS } from '../data/countries.ts';
import { getAllCountries, getAllAddresses, getAllShippingCosts } from '../data/customCountries.ts';
import type {
  Country,
  CtCart, CtCustomer, CtPayment,
  CtTaxCategoryStatus, CtShippingMethodStatus,
  LineItem, ExpressAddressData,
} from '../types.ts';

const projectKey = (): string => window.__VITE_CTP_PROJECT_KEY__;
const apiUrl = (): string => window.__VITE_CTP_API_URL__;
const authUrl = (): string => window.__VITE_CTP_AUTH_URL__;
const sessionUrl = (): string => window.__VITE_CTP_SESSION_URL__;

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getCtpToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = btoa(`${window.__VITE_CTP_CLIENT_ID__}:${window.__VITE_CTP_CLIENT_SECRET__}`);
  const body = new URLSearchParams({ grant_type: 'client_credentials' });

  const res = await fetch(`${authUrl()}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('Failed to get CTP token');

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function getJwtToken(): Promise<string> {
  const res = await fetch('http://localhost:9002/jwt/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      iss: 'https://issuer.com',
      sub: 'test-sub',
      'https://issuer.com/claims/project_key': projectKey(),
    }),
  });
  if (!res.ok) throw new Error('Failed to get JWT token — is the local JWT service running on port 9002?');
  const data = await res.json() as { token: string };
  return data.token;
}

export async function getSessionId(cartId: string, { isDropin = false } = {}): Promise<string> {
  const token = await getCtpToken();
  const returnPath = window.location.href.replace(/\/[^/]*(\?.*)?$/, '/return');
  const metadata: Record<string, unknown> = {
    processorUrl: window.__VITE_PROCESSOR_URL__,
    checkoutTransactionItemId: crypto.randomUUID(),
    merchantReturnUrl: returnPath,
    ...(!isDropin && { allowedPaymentMethods: ALLOWED_PAYMENT_METHODS }),
  };

  const res = await fetch(`${sessionUrl()}/${projectKey()}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cart: { cartRef: { id: cartId } }, metadata }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || 'Failed to create session');
  }
  const data = await res.json() as { id: string };
  return data.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ctFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getCtpToken();
  const res = await fetch(`${apiUrl()}/${projectKey()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || `CT API error: ${res.status}`);
  }
  return res.json();
}

export const getCartById = (cartId: string): Promise<CtCart> => ctFetch(`/carts/${cartId}`);

export async function searchCustomerByEmail(email: string): Promise<CtCustomer | null> {
  const data = await ctFetch(`/customers?where=email%3D%22${encodeURIComponent(email)}%22`) as { results: CtCustomer[] };
  return data.results[0] ?? null;
}

export async function createCustomer({ email, firstName, lastName }: { email: string; firstName: string; lastName: string }): Promise<{ customer: CtCustomer }> {
  return ctFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({ email, firstName, lastName, password: 'Test1234!' }),
  });
}

export const getPaymentById = (id: string): Promise<CtPayment> => ctFetch(`/payments/${id}`);

export async function getPayments({ limit = 100, offset = 0, paymentInterface }: { limit?: number; offset?: number; paymentInterface?: string } = {}): Promise<{ results: CtPayment[]; total: number }> {
  const iface = paymentInterface || window.__VITE_PAYMENT_INTERFACE__ || 'checkout-adyen';
  const where = `paymentMethodInfo(paymentInterface="${iface}")%20AND%20transactions%20is%20not%20empty`;
  return ctFetch(`/payments?where=${where}&limit=${limit}&offset=${offset}&sort=createdAt+desc`);
}

async function getOrCreateTaxCategory(): Promise<{ id: string; version: number }> {
  const slug = 'commercestore-standard-tax';
  const data = await ctFetch(`/tax-categories?where=key%3D%22${slug}%22`) as { total: number; results: Array<{ id: string; version: number }> };
  if (data.total > 0) return data.results[0];

  const countries = getAllCountries();
  return ctFetch('/tax-categories', {
    method: 'POST',
    body: JSON.stringify({
      name: 'commercestore Standard Tax',
      key: slug,
      rates: countries.map(c => ({
        name: c.taxName,
        amount: c.taxRate,
        country: c.code,
        includedInPrice: false,
      })),
    }),
  });
}

async function getOrCreateShippingMethod(taxCategory: { id: string }): Promise<unknown> {
  const key = 'commercestore-standard-shipping';
  const existing = await ctFetch(`/shipping-methods?where=key%3D%22${key}%22`) as { total: number; results: unknown[] };
  if (existing.total > 0) return existing.results[0];

  const countries = getAllCountries();
  const shippingCosts = getAllShippingCosts();

  // Discover which zones already cover our countries. A country can only be in one zone in CT.
  const ourCountryCodes = new Set(countries.map(c => c.code));
  const allZones = await ctFetch('/zones?limit=500') as { results: Array<{ id: string; locations: Array<{ country: string }> }> };
  const countryToZone: Record<string, string> = {};
  for (const zone of allZones.results) {
    for (const loc of zone.locations) {
      if (ourCountryCodes.has(loc.country)) {
        countryToZone[loc.country] = zone.id;
      }
    }
  }

  // Create our own zone for any countries not covered by existing zones
  const uncovered = countries.filter(c => !countryToZone[c.code]);
  if (uncovered.length > 0) {
    const zoneKey = 'commercestore-zone';
    const existingZone = await ctFetch(`/zones?where=key%3D%22${zoneKey}%22`) as { total: number; results: Array<{ id: string }> };
    const zone = existingZone.total > 0
      ? existingZone.results[0]
      : await ctFetch('/zones', {
          method: 'POST',
          body: JSON.stringify({
            name: 'commercestore Zone',
            key: zoneKey,
            locations: uncovered.map(c => ({ country: c.code })),
          }),
        }) as { id: string };
    for (const c of uncovered) countryToZone[c.code] = zone.id;
  }

  // Group currencies per zone
  const zoneRateMap: Record<string, Set<string>> = {};
  for (const country of countries) {
    const zoneId = countryToZone[country.code];
    if (!zoneId) continue;
    if (!zoneRateMap[zoneId]) zoneRateMap[zoneId] = new Set();
    zoneRateMap[zoneId].add(country.currency);
  }

  const zoneRates = Object.entries(zoneRateMap).map(([zoneId, currencies]) => ({
    zone: { typeId: 'zone', id: zoneId },
    shippingRates: [...currencies].map(currency => ({
      price: { currencyCode: currency, centAmount: shippingCosts[currency] ?? 500 },
    })),
  }));

  return ctFetch('/shipping-methods', {
    method: 'POST',
    body: JSON.stringify({
      name: 'commercestore Standard Shipping',
      key,
      taxCategory: { typeId: 'tax-category', id: taxCategory.id },
      zoneRates,
      isDefault: true,
    }),
  });
}

export async function ensureProjectConfiguration(): Promise<void> {
  const countries = getAllCountries();
  const supportedCurrencies = [...new Set(countries.map(c => c.currency))];
  const projectData = await ctFetch('') as { currencies: string[]; countries: string[]; version: number };

  const missingCurrencies = supportedCurrencies.filter(c => !projectData.currencies.includes(c));
  const missingCountries = countries.map(c => c.code).filter(c => !projectData.countries.includes(c));

  if (missingCurrencies.length > 0 || missingCountries.length > 0) {
    const actions: Array<{ action: string; currencies?: string[]; countries?: string[] }> = [];
    if (missingCurrencies.length > 0) {
      actions.push({ action: 'changeCurrencies', currencies: [...projectData.currencies, ...missingCurrencies] });
    }
    if (missingCountries.length > 0) {
      actions.push({ action: 'changeCountries', countries: [...projectData.countries, ...missingCountries] });
    }
    await ctFetch('', {
      method: 'POST',
      body: JSON.stringify({ version: projectData.version, actions }),
    });
  }

  const taxCategory = await getOrCreateTaxCategory();
  await getOrCreateShippingMethod(taxCategory);
}

export async function createCart({ country, customerId, lineItems }: { country: string; customerId?: string; lineItems: LineItem[] }): Promise<CtCart> {
  const countries = getAllCountries();
  const addresses = getAllAddresses();
  const countryConfig = countries.find(c => c.code === country);
  const currency = countryConfig?.currency ?? country;
  const address = addresses[country];
  const taxCategory = await getOrCreateTaxCategory();

  const taxRate = countryConfig?.taxRate ?? 0;

  const customLineItems = lineItems.map(item => ({
    name: { en: item.name },
    quantity: item.quantity,
    money: { currencyCode: currency, centAmount: item.centAmount },
    slug: item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    taxCategory: { typeId: 'tax-category', id: taxCategory.id },
    externalTaxRate: { name: 'Standard Tax', amount: taxRate, country, includedInPrice: false },
  }));

  const cartPayload: Record<string, unknown> = {
    currency,
    country,
    taxMode: 'External',
    taxRoundingMode: 'HalfEven',
    taxCalculationMode: 'LineItemLevel',
    ...(customerId && { customerId }),
    shippingAddress: { ...address, country },
    billingAddress: { ...address, country },
    customLineItems,
  };

  const cart = await ctFetch('/carts', { method: 'POST', body: JSON.stringify(cartPayload) }) as CtCart;

  const shippingData = await ctFetch(`/shipping-methods/matching-cart?cartId=${cart.id}`) as { results: Array<{ id: string }> };
  const shippingMethod = shippingData.results[0];

  if (shippingMethod) {
    return ctFetch(`/carts/${cart.id}`, {
      method: 'POST',
      body: JSON.stringify({
        version: cart.version,
        actions: [{
          action: 'setShippingMethod',
          shippingMethod: { typeId: 'shipping-method', id: shippingMethod.id },
        }],
      }),
    });
  }

  return cart;
}

export async function createPreconfiguredCart(country: string, withCustomer = false): Promise<CtCart> {
  const addresses = getAllAddresses();
  const address = addresses[country];

  await ensureProjectConfiguration();

  let customerId: string | undefined;
  if (withCustomer) {
    const email = `commercestore-${country.toLowerCase()}@example.com`;
    let customer = await searchCustomerByEmail(email);
    if (!customer) {
      const result = await createCustomer({ email, firstName: address.firstName, lastName: address.lastName });
      customer = result.customer;
    }
    customerId = customer.id;
  }

  const lineItems: LineItem[] = [
    { name: 'Premium Wireless Headphones', quantity: 1, centAmount: 12999 },
    { name: 'Organic Cotton T-Shirt', quantity: 2, centAmount: 3499 },
  ];

  return createCart({ country, customerId, lineItems });
}

// Admin helpers

export async function getTaxCategoryStatus(): Promise<CtTaxCategoryStatus> {
  const key = 'commercestore-standard-tax';
  const data = await ctFetch(`/tax-categories?where=key%3D%22${key}%22`) as { total: number; results: Array<{ id: string; version: number; rates: Array<{ country: string; amount: number }> }> };
  if (data.total === 0) return { exists: false, rates: {} };
  const tc = data.results[0];
  const rates = Object.fromEntries(tc.rates.map(r => [r.country, r.amount]));
  return { exists: true, id: tc.id, version: tc.version, rates };
}

export async function getShippingMethodStatus(): Promise<CtShippingMethodStatus> {
  const key = 'commercestore-standard-shipping';
  const data = await ctFetch(`/shipping-methods?where=key%3D%22${key}%22&expand=zoneRates%5B*%5D.zone`) as { total: number; results: Array<{ zoneRates: Array<{ shippingRates: Array<{ price: { currencyCode: string } }> }> }> };
  if (data.total === 0) return { exists: false, currencies: [] };
  const method = data.results[0];
  const currencies = method.zoneRates.flatMap(zr => zr.shippingRates.map(r => r.price.currencyCode));
  return { exists: true, currencies };
}

export async function enableCountryInCt(_countryCode: string): Promise<void> {
  await ensureProjectConfiguration();
}

/**
 * Add a new country to the CT project's tax category and shipping method.
 * Assumes ensureProjectConfiguration() has already been called at least once
 * (so the tax category and shipping method exist).
 */
export async function addCountryToCt(country: Country, shippingCost: number): Promise<void> {
  // 1. Add country + currency to the CT project if missing
  const projectData = await ctFetch('') as { currencies: string[]; countries: string[]; version: number };
  const projectActions: Array<{ action: string; currencies?: string[]; countries?: string[] }> = [];
  if (!projectData.currencies.includes(country.currency)) {
    projectActions.push({ action: 'changeCurrencies', currencies: [...projectData.currencies, country.currency] });
  }
  if (!projectData.countries.includes(country.code)) {
    projectActions.push({ action: 'changeCountries', countries: [...projectData.countries, country.code] });
  }
  if (projectActions.length > 0) {
    await ctFetch('', {
      method: 'POST',
      body: JSON.stringify({ version: projectData.version, actions: projectActions }),
    });
  }

  // 2. Add tax rate to the existing tax category (if missing)
  const taxKey = 'commercestore-standard-tax';
  const taxData = await ctFetch(`/tax-categories?where=key%3D%22${taxKey}%22`) as {
    total: number;
    results: Array<{ id: string; version: number; rates: Array<{ country: string }> }>;
  };
  if (taxData.total > 0) {
    const tc = taxData.results[0];
    const alreadyHasRate = tc.rates.some(r => r.country === country.code);
    if (!alreadyHasRate) {
      await ctFetch(`/tax-categories/${tc.id}`, {
        method: 'POST',
        body: JSON.stringify({
          version: tc.version,
          actions: [{
            action: 'addTaxRate',
            taxRate: {
              name: country.taxName,
              amount: country.taxRate,
              country: country.code,
              includedInPrice: false,
            },
          }],
        }),
      });
    }
  }

  // 3. Add shipping rate to the existing shipping method (if currency not covered)
  const shippingKey = 'commercestore-standard-shipping';
  const smData = await ctFetch(`/shipping-methods?where=key%3D%22${shippingKey}%22&expand=zoneRates%5B*%5D.zone`) as {
    total: number;
    results: Array<{
      id: string;
      version: number;
      zoneRates: Array<{
        zone: { id: string; obj?: { locations: Array<{ country: string }> } };
        shippingRates: Array<{ price: { currencyCode: string } }>;
      }>;
    }>;
  };
  if (smData.total > 0) {
    const sm = smData.results[0];
    const currencyAlreadyCovered = sm.zoneRates.some(zr =>
      zr.shippingRates.some(r => r.price.currencyCode === country.currency)
    );

    if (!currencyAlreadyCovered) {
      // Find or create the commercestore-zone and ensure the country is in it
      const zoneKey = 'commercestore-zone';
      const zoneData = await ctFetch(`/zones?where=key%3D%22${zoneKey}%22`) as {
        total: number;
        results: Array<{ id: string; version: number; locations: Array<{ country: string }> }>;
      };

      let zoneId: string;
      if (zoneData.total > 0) {
        const zone = zoneData.results[0];
        zoneId = zone.id;
        // Add country to zone if not already there
        const alreadyInZone = zone.locations.some(l => l.country === country.code);
        if (!alreadyInZone) {
          await ctFetch(`/zones/${zone.id}`, {
            method: 'POST',
            body: JSON.stringify({
              version: zone.version,
              actions: [{ action: 'addLocation', location: { country: country.code } }],
            }),
          });
        }
      } else {
        // Create the zone
        const newZone = await ctFetch('/zones', {
          method: 'POST',
          body: JSON.stringify({
            name: 'commercestore Zone',
            key: zoneKey,
            locations: [{ country: country.code }],
          }),
        }) as { id: string };
        zoneId = newZone.id;
      }

      // Check if this zone already has a zone rate in the shipping method
      const existingZoneRate = sm.zoneRates.find(zr => zr.zone.id === zoneId);
      if (existingZoneRate) {
        // Add a shipping rate to the existing zone rate
        await ctFetch(`/shipping-methods/${sm.id}`, {
          method: 'POST',
          body: JSON.stringify({
            version: sm.version,
            actions: [{
              action: 'addShippingRate',
              zone: { typeId: 'zone', id: zoneId },
              shippingRate: { price: { currencyCode: country.currency, centAmount: shippingCost } },
            }],
          }),
        });
      } else {
        // Add zone to shipping method, then add shipping rate — both in one request
        await ctFetch(`/shipping-methods/${sm.id}`, {
          method: 'POST',
          body: JSON.stringify({
            version: sm.version,
            actions: [
              { action: 'addZone', zone: { typeId: 'zone', id: zoneId } },
              {
                action: 'addShippingRate',
                zone: { typeId: 'zone', id: zoneId },
                shippingRate: { price: { currencyCode: country.currency, centAmount: shippingCost } },
              },
            ],
          }),
        });
      }
    }
  }
}

// ---- Express checkout cart operations ----

export async function createExpressCart(
  currency: string,
  country: string,
  centAmount: number,
  productName = 'Express Checkout Product',
): Promise<{ id: string; version: number }> {
  const taxCategory = await getOrCreateTaxCategory();
  const cart = await ctFetch('/carts', {
    method: 'POST',
    body: JSON.stringify({
      currency,
      country,
      customLineItems: [{
        name: { en: productName },
        money: { currencyCode: currency, centAmount },
        slug: 'express-product',
        quantity: 1,
        taxCategory: { typeId: 'tax-category', id: taxCategory.id },
      }],
    }),
  }) as { id: string; version: number };
  return { id: cart.id, version: cart.version };
}

export async function updateExpressCartAddress(
  cartId: string,
  version: number,
  address: ExpressAddressData,
  type: 'shipping' | 'billing',
): Promise<number> {
  const action = type === 'shipping' ? 'setShippingAddress' : 'setBillingAddress';
  const cart = await ctFetch(`/carts/${cartId}`, {
    method: 'POST',
    body: JSON.stringify({
      version,
      actions: [{ action, address }],
    }),
  }) as { version: number };
  return cart.version;
}

export async function setExpressCartShippingMethod(
  cartId: string,
  version: number,
): Promise<number> {
  const key = 'commercestore-standard-shipping';
  const data = await ctFetch(`/shipping-methods/matching-cart?cartId=${cartId}`) as {
    results: Array<{ id: string }>;
  };
  const smId = data.results[0]?.id;
  if (!smId) return version;
  const cart = await ctFetch(`/carts/${cartId}`, {
    method: 'POST',
    body: JSON.stringify({
      version,
      actions: [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', id: smId } }],
    }),
  }) as { version: number };
  void key;
  return cart.version;
}
