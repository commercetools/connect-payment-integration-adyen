import { useEffect, useState } from 'react';
import Header from './components/Header.tsx';
import Spinner from './components/Spinner.tsx';
import { getPaymentById } from './api/ct.ts';
import type { CtPayment } from './types.ts';

type ResultState = 'loading' | 'success' | 'pending' | 'cancelled' | 'failure' | 'not_found';

function isPaymentSuccessful(payment: CtPayment): boolean {
  const relevantTypes = new Set(['Authorization', 'Charge']);
  return (payment.transactions ?? []).some(
    t => relevantTypes.has(t.type) && (t.state === 'Success' || t.state === 'Pending'),
  );
}

function isPaymentPending(payment: CtPayment): boolean {
  const relevantTypes = new Set(['Authorization', 'Charge']);
  return (payment.transactions ?? []).some(
    t => relevantTypes.has(t.type) && t.state === 'Pending',
  );
}

export default function ReturnApp() {
  const params = new URLSearchParams(window.location.search);
  const paymentReference = params.get('paymentReference');
  const userAction = params.get('userAction');

  const [state, setState] = useState<ResultState>('loading');
  const [payment, setPayment] = useState<CtPayment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userAction === 'cancelled') {
      setState('cancelled');
      return;
    }
    if (!paymentReference) {
      setState('not_found');
      return;
    }

    getPaymentById(paymentReference)
      .then(p => {
        setPayment(p);
        if (isPaymentSuccessful(p)) {
          setState(isPaymentPending(p) ? 'pending' : 'success');
        } else {
          setState('failure');
        }
      })
      .catch(e => {
        setError((e as Error).message);
        setState('not_found');
      });
  }, [paymentReference, userAction]);

  const goToCheckout = () => {
    window.location.href = '/checkout';
  };

  const goToPayments = () => {
    window.location.href = '/payments';
  };

  const renderContent = () => {
    if (state === 'loading') {
      return <Spinner text="Loading payment result…" />;
    }

    const configs: Record<ResultState, { icon: string; iconClass: string; title: string; subtitle?: string }> = {
      success: { icon: '✓', iconClass: 'cs-result-icon--success', title: 'Payment Successful!' },
      pending: { icon: '⏳', iconClass: 'cs-result-icon--pending', title: 'Payment Pending', subtitle: 'Your payment is being processed.' },
      cancelled: { icon: '✕', iconClass: 'cs-result-icon--error', title: 'Payment Cancelled', subtitle: 'You cancelled the payment.' },
      failure: { icon: '✕', iconClass: 'cs-result-icon--error', title: 'Payment Failed', subtitle: 'The payment could not be completed.' },
      not_found: { icon: '?', iconClass: 'cs-result-icon--error', title: 'Payment Not Found', subtitle: error ?? 'Could not retrieve payment information.' },
      loading: { icon: '', iconClass: '', title: '' },
    };

    const cfg = configs[state];

    return (
      <div className="cs-modal cs-modal--result" style={{ margin: '0 auto', maxWidth: 480 }}>
        <div className={`cs-result-icon ${cfg.iconClass}`}>{cfg.icon}</div>
        <h5>{cfg.title}</h5>
        {cfg.subtitle && <p className="text-muted">{cfg.subtitle}</p>}

        {payment && (
          <div className="cs-result-ref">
            <div className="cs-result-ref-label">Transaction Reference</div>
            <code>{payment.id}</code>
          </div>
        )}

        {paymentReference && !payment && state !== 'cancelled' && (
          <div className="cs-result-ref">
            <div className="cs-result-ref-label">Payment Reference</div>
            <code>{paymentReference}</code>
          </div>
        )}

        <div className="mt-3" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={goToCheckout}>New Checkout</button>
          {payment && (
            <button className="btn btn-outline-secondary" onClick={goToPayments}>View Payments</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Header active="" />
      <div className="cs-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
        {renderContent()}
      </div>
    </>
  );
}
