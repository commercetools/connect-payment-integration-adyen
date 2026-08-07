import { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import ToastContainer from './components/Toast.tsx';
import Spinner from './components/Spinner.tsx';
import { useToast } from './hooks/useToast.ts';
import { getSessionId } from './api/ct.ts';
import { fetchRecurringStoredPaymentMethods } from './api/processor.ts';
import { WALLET_METHODS } from '../../wallet-methods.ts';
import type { StoredPaymentMethod } from './types.ts';

function RecurringMethodItem({ method }: { method: StoredPaymentMethod }) {
  const brand = method.displayOptions?.brand?.key ?? '';
  const last4 = method.displayOptions?.endDigits;
  const walletLabel = WALLET_METHODS[method.type]?.label;
  const exp = method.displayOptions?.expiryMonth && method.displayOptions?.expiryYear
    ? `${String(method.displayOptions.expiryMonth).padStart(2, '0')}/${String(method.displayOptions.expiryYear).slice(-2)}`
    : null;

  return (
    <div className="cs-saved-card cs-saved-card--static">
      <span className="cs-saved-card__info">
        <span className="cs-saved-card__main">
          {walletLabel && <span className="cs-saved-card__wallet">{walletLabel}</span>}
          {brand ? (
            <span className={`cs-saved-card__brand cs-saved-card__brand--${brand.toLowerCase()}`}>{brand}</span>
          ) : !walletLabel ? (
            <span className={`cs-saved-card__brand cs-saved-card__brand--${method.type.toLowerCase()}`}>{method.type}</span>
          ) : null}
          <span className="cs-saved-card__number">•••• {last4 ?? '????'}</span>
          {exp && <span className="cs-saved-card__exp">{exp}</span>}
        </span>
        {method.isDefault && <span className="cs-saved-card__default">Default</span>}
      </span>
      <code className="cs-recurring-method-id">{method.id}</code>
    </div>
  );
}

export default function RecurringApp() {
  const [cartId, setCartId] = useState('');
  const [methods, setMethods] = useState<StoredPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const handleLoad = useCallback(async () => {
    if (!cartId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const sessionId = await getSessionId(cartId);
      const result = await fetchRecurringStoredPaymentMethods(sessionId);
      setMethods(result);
      setLoaded(true);
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cartId, addToast]);

  return (
    <>
      <Header active="Recurring" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="cs-page">
        <div className="cs-page-header">
          <h4>Recurring Payment Methods</h4>
          <p className="text-muted">
            Lists the stored payment methods allowed for recurring payments for a cart's customer — separate from
            the one-off methods shown during checkout.
          </p>
        </div>

        <div className="cs-cart-input-row">
          <label className="cs-cart-label">Cart ID</label>
          <div className="cs-cart-input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Paste a cart ID whose customer has a stored payment method"
              value={cartId}
              onChange={e => setCartId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && cartId && handleLoad()}
            />
            <button className="btn btn-primary" onClick={handleLoad} disabled={!cartId || loading}>
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        {loading && <Spinner text="Loading recurring payment methods…" />}

        {!loading && loaded && (
          methods.length > 0 ? (
            <div className="cs-recurring-list">
              {methods.map(m => <RecurringMethodItem key={m.id} method={m} />)}
            </div>
          ) : (
            <p className="cs-sidebar-empty">
              No payment methods allowed for recurring payments were found for this cart's customer.
            </p>
          )
        )}
      </div>
    </>
  );
}
