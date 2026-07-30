import type { Country, Address } from '../types.ts';
import { COUNTRIES, SHIPPING_COST_BY_CURRENCY } from './countries.ts';
import { ADDRESSES } from './addresses.ts';

export interface CustomCountryConfig {
  country: Country;
  address: Address;
  shippingCost: number; // in cents
}

const STORAGE_KEY = 'cs-custom-countries';

const BUILT_IN_CODES = new Set(COUNTRIES.map(c => c.code));

export function getCustomCountryConfigs(): Record<string, CustomCountryConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CustomCountryConfig>;
  } catch {
    return {};
  }
}

export function saveCustomCountryConfig(code: string, config: CustomCountryConfig): void {
  const all = getCustomCountryConfigs();
  all[code] = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteCustomCountryConfig(code: string): void {
  if (BUILT_IN_CODES.has(code)) {
    throw new Error(`Cannot delete built-in country: ${code}`);
  }
  const all = getCustomCountryConfigs();
  delete all[code];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/** All countries: built-ins first, then custom additions; custom overrides built-ins by code. */
export function getAllCountries(): Country[] {
  const custom = getCustomCountryConfigs();
  const merged = COUNTRIES.map(c => custom[c.code] ? custom[c.code].country : c);
  // Append any custom countries whose codes are NOT in the built-in list
  for (const [code, cfg] of Object.entries(custom)) {
    if (!BUILT_IN_CODES.has(code)) {
      merged.push(cfg.country);
    }
  }
  return merged;
}

/** All addresses: built-ins + custom, custom overrides built-ins. */
export function getAllAddresses(): Record<string, Address> {
  const custom = getCustomCountryConfigs();
  const merged: Record<string, Address> = { ...ADDRESSES };
  for (const [code, cfg] of Object.entries(custom)) {
    merged[code] = cfg.address;
  }
  return merged;
}

/**
 * All shipping costs keyed by currency code (same shape as SHIPPING_COST_BY_CURRENCY).
 * Custom entries contribute their currency → shippingCost mapping.
 * If multiple custom countries share a currency, the last one wins.
 * Built-in costs are the baseline; custom entries for the same currency override.
 */
export function getAllShippingCosts(): Record<string, number> {
  const custom = getCustomCountryConfigs();
  const merged: Record<string, number> = { ...SHIPPING_COST_BY_CURRENCY };
  for (const cfg of Object.values(custom)) {
    merged[cfg.country.currency] = cfg.shippingCost;
  }
  return merged;
}
