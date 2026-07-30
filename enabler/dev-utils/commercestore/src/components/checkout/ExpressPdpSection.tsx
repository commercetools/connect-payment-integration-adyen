import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import { getAllCountries, getAllShippingCosts } from '../../data/customCountries.ts';
import { createExpressCart, updateExpressCartAddress, setExpressCartShippingMethod, getSessionId } from '../../api/ct.ts';
import type {
  EnablerConstructor, EnablerInstance, MountableComponent,
  ExpressAddressData, ExpressShippingOptionData,
} from '../../types.ts';

const EXPRESS_TYPES = [
  { type: 'applepay', label: 'Apple Pay' },
  { type: 'googlepay', label: 'Google Pay' },
  { type: 'paypal', label: 'PayPal' },
];

interface ExpressSlotProps {
  label: string;
  containerRef: RefObject<HTMLDivElement>;
  mounted: boolean;
}

function ExpressSlot({ label, containerRef, mounted }: ExpressSlotProps) {
  return (
    <div className="cs-express-slot">
      <div className="cs-express-slot-label">{label}</div>
      <div ref={containerRef} className={`cs-express-mount ${!mounted ? 'cs-express-mount--pending' : ''}`} />
    </div>
  );
}

export default function ExpressPdpSection() {
  const countries = getAllCountries();
  const [countryCode, setCountryCode] = useState(countries[0]?.code ?? 'GB');
  const [amountDisplay, setAmountDisplay] = useState('49.99');
  const [enabler, setEnabler] = useState<EnablerInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cartRef = useRef<{ id: string; version: number } | null>(null);
  // Stable refs so callbacks always read latest config without needing to rebuild
  const countryCodeRef = useRef(countryCode);
  const centAmountRef = useRef(0);
  countryCodeRef.current = countryCode;

  const country = countries.find(c => c.code === countryCode) ?? countries[0];
  const centAmount = Math.round(parseFloat(amountDisplay || '0') * 100);
  centAmountRef.current = centAmount;

  const appleRef = useRef<HTMLDivElement>(null);
  const googleRef = useRef<HTMLDivElement>(null);
  const paypalRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const handleMount = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setEnabler(null);
    mountedRef.current = false;
    try {
      // @ts-ignore — Vite resolves this at dev runtime
      const { Enabler } = await import('/src/main.ts') as { Enabler: EnablerConstructor };
      // Express flow: no cart needed yet; sessionId is empty (CORS auth for express-config)
      const instance = new Enabler({
        processorUrl: window.__VITE_PROCESSOR_URL__,
        sessionId: '',
        countryCode: country.code,
        currencyCode: country.currency,
      });
      setEnabler(instance);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Callbacks — use refs so they read fresh cart/config state at call time
  const onPayButtonClick = useCallback(async () => {
    const code = countryCodeRef.current;
    const allCountries = getAllCountries();
    const cfg = allCountries.find(c => c.code === code) ?? allCountries[0];
    const cart = await createExpressCart(cfg.currency, cfg.code, centAmountRef.current);
    cartRef.current = cart;
    const sessionId = await getSessionId(cart.id);
    return { sessionId };
  }, []);

  const onShippingAddressSelected = useCallback(async ({ address }: { address: ExpressAddressData }) => {
    const cart = cartRef.current;
    if (!cart) return;
    const version = await updateExpressCartAddress(cart.id, cart.version, address, 'shipping');
    cartRef.current = { id: cart.id, version };
  }, []);

  const getShippingMethods = useCallback(async ({ address }: { address: ExpressAddressData }): Promise<ExpressShippingOptionData[]> => {
    const allCountries = getAllCountries();
    const costs = getAllShippingCosts();
    const addressCountry = allCountries.find(c => c.code === address.country);
    const currency = addressCountry?.currency ?? (allCountries.find(c => c.code === countryCodeRef.current)?.currency ?? 'EUR');
    const costInCents = costs[currency] ?? 500;
    return [{
      id: 'commercestore-standard',
      name: 'Standard Shipping',
      description: '3-5 business days',
      amount: { centAmount: costInCents, currencyCode: currency },
    }];
  }, []);

  const onShippingMethodSelected = useCallback(async (_opts: { shippingMethod: { id: string } }) => {
    const cart = cartRef.current;
    if (!cart) return;
    const version = await setExpressCartShippingMethod(cart.id, cart.version);
    cartRef.current = { id: cart.id, version };
  }, []);

  const onPaymentSubmit = useCallback(async ({ shippingAddress, billingAddress }: {
    shippingAddress: ExpressAddressData;
    billingAddress: ExpressAddressData;
    customerEmail: string;
  }) => {
    const cart = cartRef.current;
    if (!cart) return;
    let version = await updateExpressCartAddress(cart.id, cart.version, shippingAddress, 'shipping');
    version = await updateExpressCartAddress(cart.id, version, billingAddress, 'billing');
    cartRef.current = { id: cart.id, version };
  }, []);

  // Mount express builders when enabler is ready
  useEffect(() => {
    if (!enabler) return;
    let cancelled = false;
    const instances: MountableComponent[] = [];
    const refs: Record<string, RefObject<HTMLDivElement>> = { applepay: appleRef, googlepay: googleRef, paypal: paypalRef };

    const expressOptions = {
      initialAmount: { centAmount, currencyCode: country.currency },
      allowedCountries: getAllCountries().map(c => c.code),
      onPayButtonClick,
      onShippingAddressSelected,
      getShippingMethods,
      onShippingMethodSelected,
      onPaymentSubmit,
      onComplete: (result: { isSuccess: boolean }) => {
        if (result.isSuccess) setSuccessMsg('Payment completed successfully!');
        else setError('Payment failed or was cancelled.');
      },
    };

    (async () => {
      await Promise.all(
        EXPRESS_TYPES.map(async ({ type }) => {
          const ref = refs[type];
          if (!ref?.current) return;
          try {
            const builder = await enabler.createExpressBuilder(type);
            if (cancelled) return;
            const component = builder.build(expressOptions as never);
            if (cancelled) return;
            component.mount(ref.current);
            instances.push(component);
          } catch (e) {
            console.warn(`Express ${type} not available:`, (e as Error).message);
          }
        })
      );
      if (!cancelled) mountedRef.current = true;
    })();

    return () => {
      cancelled = true;
      instances.forEach(i => { try { i.unmount?.(); } catch (_) {} });
    };
  }, [enabler]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cs-card cs-express-pdp">
      <div className="cs-express-pdp-header">
        <div>
          <h6 className="cs-express-pdp-title">Express Checkout</h6>
          <p className="cs-express-pdp-subtitle">Simulates a PDP — no cart required to render buttons</p>
        </div>
      </div>

      {!enabler ? (
        <div className="cs-express-pdp-config">
          <div className="cs-form-grid cs-form-grid--3">
            <div className="cs-field">
              <label>Country</label>
              <select className="form-control form-control-sm" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>
                ))}
              </select>
            </div>
            <div className="cs-field">
              <label>Product price ({country.currency})</label>
              <input
                className="form-control form-control-sm"
                type="number" step="0.01" min="0"
                value={amountDisplay}
                onChange={e => setAmountDisplay(e.target.value)}
              />
            </div>
            <div className="cs-field cs-field--action">
              <label>&nbsp;</label>
              <button className="btn btn-primary btn-sm" onClick={handleMount} disabled={loading || centAmount <= 0}>
                {loading ? <><span className="btn-spinner-sm" /> Initializing…</> : 'Mount Express Buttons →'}
              </button>
            </div>
          </div>
          {error && <div className="alert alert-danger mt-2" style={{ fontSize: 13, padding: '8px 12px' }}>{error}</div>}
        </div>
      ) : (
        <div>
          <div className="cs-express-pdp-product">
            <span className="cs-express-pdp-product-name">Express Checkout Product</span>
            <span className="cs-express-pdp-product-price">
              {(centAmount / 100).toLocaleString(undefined, { style: 'currency', currency: country.currency })}
            </span>
            <button className="cs-link-btn" onClick={() => { setEnabler(null); setError(null); setSuccessMsg(null); cartRef.current = null; }}>
              ← Reset
            </button>
          </div>
          {successMsg && <div className="alert alert-success" style={{ fontSize: 13, padding: '8px 12px', marginBottom: 12 }}>{successMsg}</div>}
          {error && <div className="alert alert-danger" style={{ fontSize: 13, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}
          <div className="cs-express-grid">
            {EXPRESS_TYPES.map(({ type, label }, i) => {
              const refMap = [appleRef, googleRef, paypalRef];
              return <ExpressSlot key={type} label={label} containerRef={refMap[i]} mounted={!!enabler} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
