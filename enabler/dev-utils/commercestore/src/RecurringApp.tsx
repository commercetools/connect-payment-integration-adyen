import { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import ToastContainer from './components/Toast.tsx';
import Spinner from './components/Spinner.tsx';
import { useToast } from './hooks/useToast.ts';
import { getSessionId } from './api/ct.ts';
import { deleteStoredPaymentMethod, fetchRecurringStoredPaymentMethods } from './api/processor.ts';
import { METHOD_LABELS } from '../../method-labels.ts';
import type { StoredPaymentMethod } from './types.ts';

function RecurringMethodItem({
  method,
  onRemove,
  removing,
}: {
  method: StoredPaymentMethod;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const cardDetails = method.displayOptions?.cardDetails;
  const bankDetails = method.displayOptions?.bankDetails;
  const brand = cardDetails?.brand?.key ?? '';
  const showBrandBadge = brand && brand !== 'Unknown';
  const last4 = cardDetails?.endDigits ?? bankDetails?.endDigits;
  const ownerName = bankDetails?.ownerName;
  const issuingBank = bankDetails?.issuingBank;
  const methodLabel = METHOD_LABELS[method.type]?.label;
  const hasCardDigits = last4 !== undefined;
  const exp = cardDetails?.expiryMonth && cardDetails?.expiryYear
    ? `${String(cardDetails.expiryMonth).padStart(2, '0')}/${String(cardDetails.expiryYear).slice(-2)}`
    : null;

  return (
    <div className="cs-saved-card cs-saved-card--static">
      <span className="cs-saved-card__info">
        <span className="cs-saved-card__main">
          {methodLabel && <span className="cs-saved-card__wallet">{methodLabel}</span>}
          {showBrandBadge ? (
            <span className={`cs-saved-card__brand cs-saved-card__brand--${brand.toLowerCase()}`}>{brand}</span>
          ) : !methodLabel ? (
            <span className={`cs-saved-card__brand cs-saved-card__brand--${method.type.toLowerCase()}`}>{method.type}</span>
          ) : null}
          {hasCardDigits && <span className="cs-saved-card__number">•••• {last4 ?? '????'}</span>}
          {hasCardDigits && exp && <span className="cs-saved-card__exp">{exp}</span>}
          {ownerName && <span className="cs-saved-card__owner">{ownerName}</span>}
          {issuingBank && <span className="cs-saved-card__owner">{issuingBank}</span>}
        </span>
        {method.isDefault && <span className="cs-saved-card__default">Default</span>}
      </span>
      <code className="cs-recurring-method-id">{method.id}</code>
      <button className="cs-remove-saved-btn" onClick={() => onRemove(method.id)} disabled={removing}>
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </div>
  );
}

export default function RecurringApp() {
  const [cartId, setCartId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [methods, setMethods] = useState<StoredPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const handleLoad = useCallback(async () => {
    if (!cartId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const newSessionId = await getSessionId(cartId);
      const result = await fetchRecurringStoredPaymentMethods(newSessionId);
      setSessionId(newSessionId);
      setMethods(result);
      setLoaded(true);
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cartId, addToast]);

  const handleRemove = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      await deleteStoredPaymentMethod(id, sessionId);
      setMethods(current => current.filter(m => m.id !== id));
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setRemovingId(null);
    }
  }, [sessionId, addToast]);

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
              {methods.map(m => (
                <RecurringMethodItem key={m.id} method={m} onRemove={handleRemove} removing={removingId === m.id} />
              ))}
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
