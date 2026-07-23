import { useState, useEffect, useCallback } from 'react';
import { COUNTRIES } from '../data/countries.ts';
import { getAllCountries, getAllAddresses, getAllShippingCosts, saveCustomCountryConfig, getCustomCountryConfigs } from '../data/customCountries.ts';
import { getTaxCategoryStatus, getShippingMethodStatus, enableCountryInCt, addCountryToCt } from '../api/ct.ts';
import type { Country, Address, CountryStatus, CtTaxCategoryStatus, CtShippingMethodStatus } from '../types.ts';

const BUILT_IN_CODES = new Set(COUNTRIES.map(c => c.code));

export function useAdmin(): {
  countryStatuses: CountryStatus[];
  loading: boolean;
  error: string | null;
  enableCountry: (countryCode: string) => Promise<void>;
  getMissingItems: (countryCode: string) => string[];
  addCountry: (country: Country, address: Address, shippingCost: number) => Promise<void>;
  editCountry: (country: Country, address: Address, shippingCost: number) => Promise<void>;
  getCountryConfig: (code: string) => { country: Country; address: Address; shippingCost: number } | undefined;
  reload: () => Promise<void>;
} {
  const [taxStatus, setTaxStatus] = useState<CtTaxCategoryStatus | null>(null);
  const [shippingStatus, setShippingStatus] = useState<CtShippingMethodStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tax, shipping] = await Promise.all([getTaxCategoryStatus(), getShippingMethodStatus()]);
      setTaxStatus(tax);
      setShippingStatus(shipping);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const countryStatuses: CountryStatus[] = getAllCountries().map(country => {
    const hasTax = taxStatus?.rates?.[country.code] !== undefined;
    const hasShipping = shippingStatus?.currencies?.includes(country.currency) ?? false;
    return { ...country, hasTax, hasShipping, isReady: hasTax && hasShipping };
  });

  const enableCountry = useCallback(async (countryCode: string) => {
    if (!BUILT_IN_CODES.has(countryCode)) {
      // Custom country: re-run the full CT setup (tax + shipping) using stored config
      const config = getCustomCountryConfigs()[countryCode];
      if (config) await addCountryToCt(config.country, config.shippingCost);
    } else {
      await enableCountryInCt(countryCode);
    }
    await reload();
  }, [reload]);

  const getMissingItems = useCallback((countryCode: string): string[] => {
    const countries = getAllCountries();
    const shippingCosts = getAllShippingCosts();
    const country = countries.find(c => c.code === countryCode);
    if (!country) return [];
    const hasTax = taxStatus?.rates?.[countryCode] !== undefined;
    const hasShipping = shippingStatus?.currencies?.includes(country.currency) ?? false;
    const items: string[] = [];
    if (!hasTax) items.push(`Tax rate ${(country.taxRate * 100).toFixed(country.taxRate === 0.077 ? 1 : 0)}% (${country.taxName}) for ${country.name}`);
    if (!hasShipping) items.push(`Shipping rate ${(shippingCosts[country.currency] ?? 500) / 100} ${country.currency} for ${country.name}`);
    if (!taxStatus?.exists) items.push('Create "commercestore-standard-tax" tax category');
    if (!shippingStatus?.exists) items.push('Create "commercestore-standard-shipping" shipping method');
    return items;
  }, [taxStatus, shippingStatus]);

  const addCountry = useCallback(async (country: Country, address: Address, shippingCost: number) => {
    // Save to localStorage first so it's available for subsequent CT calls
    saveCustomCountryConfig(country.code, { country, address, shippingCost });
    // Push to CT
    await addCountryToCt(country, shippingCost);
    await reload();
  }, [reload]);

  const editCountry = useCallback(async (country: Country, address: Address, shippingCost: number) => {
    // Persist the updated config
    saveCustomCountryConfig(country.code, { country, address, shippingCost });
    // If the country is custom (not built-in), make sure CT is up to date too
    if (!BUILT_IN_CODES.has(country.code)) {
      await addCountryToCt(country, shippingCost);
    }
    await reload();
  }, [reload]);

  const getCountryConfig = useCallback((code: string): { country: Country; address: Address; shippingCost: number } | undefined => {
    const countries = getAllCountries();
    const addresses = getAllAddresses();
    const shippingCosts = getAllShippingCosts();
    const custom = getCustomCountryConfigs();

    const country = countries.find(c => c.code === code);
    if (!country) return undefined;

    const address = addresses[code];
    if (!address) return undefined;

    // Custom entries have an explicit shippingCost; built-ins derive from SHIPPING_COST_BY_CURRENCY
    const shippingCost = custom[code]?.shippingCost ?? shippingCosts[country.currency] ?? 500;
    return { country, address, shippingCost };
  }, []);

  return { countryStatuses, loading, error, enableCountry, getMissingItems, addCountry, editCountry, getCountryConfig, reload };
}
