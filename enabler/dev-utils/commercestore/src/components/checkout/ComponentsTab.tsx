import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import { useAdyenMount } from '../../hooks/useAdyenMount.ts';
import { usePaymentAvailability } from '../../hooks/usePaymentAvailability.ts';
import type { EnablerInstance, MountableComponent, PaymentMethod, StoredPaymentMethod, CheckoutResult } from '../../types.ts';

interface PaymentMethodItemProps {
  type: string;
  label: string;
  selected: boolean;
  available: boolean;
  loading: boolean;
  onClick: () => void;
}

function PaymentMethodItem({ type, label, selected, available, loading, onClick }: PaymentMethodItemProps) {
  return (
    <button
      className={`cs-method-item ${selected ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
      onClick={onClick}
      disabled={!available || loading}
    >
      <span className="cs-method-label">{label || type}</span>
      {loading && <span className="cs-method-badge cs-method-badge--checking">…</span>}
      {!loading && !available && <span className="cs-method-badge">Unavailable</span>}
    </button>
  );
}

interface SavedMethodItemProps {
  method: StoredPaymentMethod;
  selected: boolean;
  onClick: () => void;
}

function SavedMethodItem({ method, selected, onClick }: SavedMethodItemProps) {
  const brand = method.displayOptions?.brand?.key ?? '';
  const last4 = method.displayOptions?.endDigits;
  const exp = method.displayOptions?.expiryMonth && method.displayOptions?.expiryYear
    ? `${String(method.displayOptions.expiryMonth).padStart(2, '0')}/${String(method.displayOptions.expiryYear).slice(-2)}`
    : null;

  return (
    <div className={`cs-saved-card ${selected ? 'selected' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <span className={`cs-saved-card__radio ${selected ? 'selected' : ''}`} />
      <span className="cs-saved-card__info">
        <span className="cs-saved-card__main">
          {brand && <span className={`cs-saved-card__brand cs-saved-card__brand--${brand.toLowerCase()}`}>{brand}</span>}
          <span className="cs-saved-card__number">•••• {last4 ?? '????'}</span>
          {exp && <span className="cs-saved-card__exp">{exp}</span>}
        </span>
        {method.isDefault && <span className="cs-saved-card__default">Default</span>}
      </span>
    </div>
  );
}

interface PaymentContainerProps {
  component: MountableComponent;
  onPay: () => void;
  showStore: boolean;
  storeChecked: boolean;
  onStoreChange: (checked: boolean) => void;
  hasOwnButton: boolean;
  isSaved: boolean;
  onRemoveSaved?: () => void;
  removingId: string | null;
}

function PaymentContainer({ component, onPay, showStore, storeChecked, onStoreChange, hasOwnButton, isSaved, onRemoveSaved, removingId }: PaymentContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRedirect, setIsRedirect] = useState(false);
  useAdyenMount(component, containerRef as RefObject<HTMLElement>);

  useEffect(() => {
    if (hasOwnButton) { setIsRedirect(false); return; }
    setIsRedirect(false);
    const timer = setTimeout(() => {
      const html = containerRef.current?.innerHTML.trim() ?? '';
      setIsRedirect(html === '');
    }, 800);
    return () => clearTimeout(timer);
  }, [component, hasOwnButton]);

  return (
    <div className="cs-component-wrap">
      <div ref={containerRef} className="cs-component-mount" />
      {!hasOwnButton && isRedirect && (
        <div className="cs-redirect-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          You'll be redirected to complete this payment
        </div>
      )}
      {showStore && (
        <label className="cs-store-method">
          <input type="checkbox" checked={storeChecked} onChange={e => onStoreChange(e.target.checked)} />
          Save payment method for future use
        </label>
      )}
      {!hasOwnButton && (
        <div className="cs-pay-area">
          <label className="cs-terms">
            <input type="checkbox" id="termsCheck" />
            I agree to the <a href="#">terms and conditions</a>
          </label>
          <div className="cs-pay-actions">
            <button className="btn btn-primary cs-pay-btn" onClick={onPay}>Pay now</button>
            {isSaved && onRemoveSaved && (
              <button className="cs-remove-saved-btn" onClick={onRemoveSaved} disabled={!!removingId}>
                {removingId ? 'Removing…' : 'Remove saved card'}
              </button>
            )}
          </div>
        </div>
      )}
      {hasOwnButton && isSaved && onRemoveSaved && (
        <div className="cs-pay-area cs-pay-area--own-btn">
          <button className="cs-remove-saved-btn" onClick={onRemoveSaved} disabled={!!removingId}>
            {removingId ? 'Removing…' : 'Remove saved card'}
          </button>
        </div>
      )}
    </div>
  );
}

interface ComponentsTabProps {
  enabler: EnablerInstance;
  paymentMethods: PaymentMethod[];
  savedMethods: StoredPaymentMethod[];
  onSuccess: (result: CheckoutResult) => void;
  onError: (msg: string) => void;
  onSavedMethodRemoved: (id: string) => void;
}

export default function ComponentsTab({ enabler, paymentMethods, savedMethods, onSuccess: _onSuccess, onError, onSavedMethodRemoved }: ComponentsTabProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null);
  const [component, setComponent] = useState<MountableComponent | null>(null);
  const [savedComponent, setSavedComponent] = useState<MountableComponent | null>(null);
  const [storeMethod, setStoreMethod] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
  const [activeHasOwnButton, setActiveHasOwnButton] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const savedInstancesRef = useRef<Record<string, MountableComponent>>({});

  const { availability, checking, instancesRef } = usePaymentAvailability(enabler, paymentMethods);

  const selectMethod = useCallback(async (type: string) => {
    setSelectedSaved(null);
    setSavedComponent(null);
    setActiveHasOwnButton(false);
    if (type === selected) return;
    setSelected(type);
    setLoadingMethod(type);
    try {
      // componentHasSubmit lives on the builder, not the built instance.
      const builder = await enabler.createComponentBuilder(type);
      const hasOwnButton = builder.componentHasSubmit === false;

      let instance: MountableComponent;
      if (hasOwnButton) {
        instance = builder.build({ showPayButton: true });
        instancesRef.current[type] = instance;
      } else {
        instance = instancesRef.current[type] ?? builder.build({ showPayButton: false });
        instancesRef.current[type] = instance;
      }

      setActiveHasOwnButton(hasOwnButton);
      setComponent(instance);
    } catch (e) {
      onError(`Failed to load ${type}: ${(e as Error).message}`);
      setSelected(null);
    } finally {
      setLoadingMethod(null);
    }
  }, [enabler, selected, instancesRef, onError]);

  const selectSaved = useCallback(async (method: StoredPaymentMethod) => {
    setSelected(null);
    setComponent(null);
    setActiveHasOwnButton(false);
    if (method.id === selectedSaved) return;
    setSelectedSaved(method.id);
    setLoadingMethod(method.id);
    try {
      if (!savedInstancesRef.current[method.id]) {
        const builder = await enabler.createStoredPaymentMethodBuilder(method.type);
        const brand = method.displayOptions?.brand?.key;
        const instance = builder.build({ id: method.id, brands: brand ? [brand] : [] });
        savedInstancesRef.current[method.id] = instance;
      }
      setSavedComponent(savedInstancesRef.current[method.id]);
    } catch (e) {
      onError(`Failed to load saved method: ${(e as Error).message}`);
      setSelectedSaved(null);
    } finally {
      setLoadingMethod(null);
    }
  }, [enabler, selectedSaved, onError]);

  const handleRemoveSaved = useCallback(async () => {
    if (!selectedSaved) return;
    setRemovingId(selectedSaved);
    try {
      await savedInstancesRef.current[selectedSaved]?.remove?.();
      delete savedInstancesRef.current[selectedSaved];
      onSavedMethodRemoved(selectedSaved);
      setSelectedSaved(null);
      setSavedComponent(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setRemovingId(null);
    }
  }, [selectedSaved, onSavedMethodRemoved, onError]);

  const handlePay = useCallback(async () => {
    const terms = document.getElementById('termsCheck') as HTMLInputElement | null;
    if (!terms?.checked) { onError('Please accept the terms and conditions.'); return; }
    try {
      const c = component || savedComponent;
      if (await c?.isValid?.() === false) { await c?.showValidation?.(); return; }
      await c?.submit?.({ storePaymentDetails: storeMethod });
    } catch (e) {
      onError((e as Error).message);
    }
  }, [component, savedComponent, storeMethod, onError]);

  const activeComponent = component || savedComponent;

  return (
    <div className="cs-tab-layout">
      <div className="cs-methods-sidebar">
        {savedMethods.length > 0 && (
          <>
            <div className="cs-sidebar-section-title">Saved Methods</div>
            {savedMethods.map(m => (
              <SavedMethodItem key={m.id} method={m} selected={m.id === selectedSaved}
                onClick={() => selectSaved(m)} />
            ))}
            <div className="cs-sidebar-divider" />
          </>
        )}
        <div className="cs-sidebar-section-title">Payment Methods</div>
        {[...paymentMethods].sort((a, b) => (a.label ?? a.type).localeCompare(b.label ?? b.type)).map(m => {
          const available = checking ? true : (availability[m.type] ?? true);
          return (
            <PaymentMethodItem
              key={m.type}
              type={m.type}
              label={m.label ?? m.type}
              selected={m.type === selected}
              available={available}
              loading={checking && !(m.type in availability)}
              onClick={() => selectMethod(m.type)}
            />
          );
        })}
        {!paymentMethods.length && <p className="cs-sidebar-empty">No methods available</p>}
      </div>

      <div className="cs-payment-area">
        {!activeComponent && (
          <div className="cs-placeholder">
            {loadingMethod ? <span className="cs-loading-dot" /> : 'Select a payment method'}
          </div>
        )}
        {activeComponent && (
          <PaymentContainer
            component={activeComponent}
            onPay={handlePay}
            showStore={selected === 'card'}
            storeChecked={storeMethod}
            onStoreChange={setStoreMethod}
            hasOwnButton={activeHasOwnButton}
            isSaved={!!selectedSaved}
            onRemoveSaved={handleRemoveSaved}
            removingId={removingId}
          />
        )}
      </div>
    </div>
  );
}
