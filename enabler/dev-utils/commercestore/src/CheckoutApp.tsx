import { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import ToastContainer from './components/Toast.tsx';
import Spinner from './components/Spinner.tsx';
import CartInput from './components/checkout/CartInput.tsx';
import CheckoutContent from './components/checkout/CheckoutContent.tsx';
import QuickCartModal from './components/cart/QuickCartModal.tsx';
import CustomCartModal from './components/cart/CustomCartModal.tsx';
import { useCheckout } from './hooks/useCheckout.ts';
import { useToast } from './hooks/useToast.ts';
import type { CheckoutResult } from './types.ts';

interface ResultModalProps {
  result: CheckoutResult;
  onClose: () => void;
}

function ResultModal({ result, onClose }: ResultModalProps) {
  const isSuccess = result.isSuccess;
  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal cs-modal--result" onClick={e => e.stopPropagation()}>
        <div className={`cs-result-icon ${isSuccess ? 'cs-result-icon--success' : 'cs-result-icon--error'}`}>
          {isSuccess ? '✓' : '✕'}
        </div>
        <h5>{isSuccess ? 'Payment Successful!' : 'Payment Failed'}</h5>
        {result.paymentReference && (
          <div className="cs-result-ref">
            <div className="cs-result-ref-label">Transaction Reference</div>
            <code>{result.paymentReference}</code>
          </div>
        )}
        {!isSuccess && result.message && <p className="text-danger mt-2">{result.message}</p>}
        <button className="btn btn-primary mt-3" onClick={onClose}>
          {isSuccess ? 'New Checkout' : 'Close'}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutApp() {
  const [cartId, setCartId] = useState('');
  const [showQuickCart, setShowQuickCart] = useState(false);
  const [showCustomCart, setShowCustomCart] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const { cart, enabler, paymentMethods, dropinMethods, savedMethods, loading, error, load, reset } = useCheckout();

  const handleCartCreated = useCallback((id: string) => {
    setCartId(id);
    addToast('success', `Cart created: ${id.slice(0, 8)}…`);
  }, [addToast]);

  const handleStartCheckout = useCallback(async () => {
    try {
      await load(cartId, {
        onComplete: (r) => setResult(r),
        onError: (e) => setResult({ isSuccess: false, message: e.message || String(e) }),
      });
    } catch (e) {
      addToast('error', (e as Error).message);
    }
  }, [cartId, load, addToast]);

  const handleResultClose = useCallback(() => {
    if (result?.isSuccess) { reset(); setCartId(''); }
    setResult(null);
  }, [result, reset]);

  const handlePayError = useCallback((msg: string) => addToast('error', msg), [addToast]);
  const handlePaySuccess = useCallback((r: CheckoutResult) => setResult(r), []);

  return (
    <>
      <Header active="Checkout" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="cs-page">
        <CartInput
          cartId={cartId}
          onChange={setCartId}
          onStart={handleStartCheckout}
          onQuickCart={() => setShowQuickCart(true)}
          onCustomCart={() => setShowCustomCart(true)}
          loading={loading}
          hasCart={!!cart}
        />

        {error && <div className="alert alert-danger cs-error">{error}</div>}

        {loading && <Spinner text="Loading checkout…" />}

        {enabler && !loading && (
          <CheckoutContent
            enabler={enabler}
            paymentMethods={paymentMethods}
            dropinMethods={dropinMethods}
            savedMethods={savedMethods}
            onSuccess={handlePaySuccess}
            onError={handlePayError}
          />
        )}
      </div>

      {showQuickCart && (
        <QuickCartModal
          onCreated={handleCartCreated}
          onError={msg => addToast('error', msg)}
          onClose={() => setShowQuickCart(false)}
        />
      )}
      {showCustomCart && (
        <CustomCartModal
          onCreated={handleCartCreated}
          onClose={() => setShowCustomCart(false)}
        />
      )}
      {result && <ResultModal result={result} onClose={handleResultClose} />}
    </>
  );
}
