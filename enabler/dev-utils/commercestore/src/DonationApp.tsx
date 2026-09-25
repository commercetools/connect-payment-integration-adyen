import { useEffect, useRef, useState } from 'react';
import Header from './components/Header.tsx';
import Spinner from './components/Spinner.tsx';
import { getSessionId } from './api/ct.ts';
import type { DonationEnablerConstructor, MountableComponent } from './types.ts';

type Status = 'idle' | 'loading' | 'shown' | 'thanks' | 'dismissed' | 'rejected' | 'error';

/** The donation flow rejects with `DonationError`, which carries a `code`. */
const describeError = (e: unknown): string => {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  if (!message) return String(e);
  return code ? `[${code}] ${message}` : message;
};

/**
 * Order-confirmation stand-in page: takes a payment reference, opens a cartless checkout session
 * on it and mounts the Adyen Giving donation form.
 */
export default function DonationApp() {
  const params = new URLSearchParams(window.location.search);
  const [paymentReference, setPaymentReference] = useState(params.get('paymentReference') ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<MountableComponent | null>(null);
  const [autoStart] = useState(() => !!params.get('paymentReference'));

  const mountDonation = async (reference: string) => {
    setStatus('loading');
    setError(null);
    // Unmount via the component: it renders with Preact, which keeps state on the container node,
    // so clearing that node by hand breaks the next mount.
    try { componentRef.current?.unmount?.(); } catch (_) {}
    componentRef.current = null;

    try {
      // The processor authenticates on the session, so open a cartless one carrying the payment.
      const paymentId = reference.trim();
      const sessionId = await getSessionId({ paymentId });

      // @ts-ignore — Vite resolves this path to the connector enabler at dev runtime
      const { DonationEnabler } = await import('/src/main.ts') as { DonationEnabler: DonationEnablerConstructor };
      const enabler = new DonationEnabler({
        processorUrl: window.__VITE_PROCESSOR_URL__,
        sessionId,
        onComplete: ({ reason }) => {
          if (reason === 'donated') return setStatus('thanks');
          setStatus(reason === 'rejected' ? 'rejected' : 'dismissed');
        },
        onError: (e) => {
          setError(describeError(e));
          setStatus('error');
        },
      });

      const builder = await enabler.createDonationBuilder();
      const component = builder.build();

      if (!containerRef.current) return;
      component.mount(containerRef.current);
      componentRef.current = component;
      setStatus('shown');
    } catch (e) {
      setError(describeError(e));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (autoStart && paymentReference) void mountDonation(paymentReference);
    return () => {
      try { componentRef.current?.unmount?.(); } catch (_) {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Header active="Giving" />
      <div className="cs-page" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 32 }}>
        <h5>Adyen Giving</h5>
        <p className="text-muted">
          Paste the reference of a payment that carries a donation token and the donation form will be
          rendered below.
        </p>

        <div className="input-group mb-3">
          <input
            className="form-control"
            placeholder="paymentId"
            value={paymentReference}
            onChange={e => setPaymentReference(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && paymentReference) void mountDonation(paymentReference); }}
          />
          <button
            className="btn btn-primary"
            disabled={!paymentReference || status === 'loading'}
            onClick={() => void mountDonation(paymentReference)}
          >
            Load donation form
          </button>
        </div>

        {status === 'loading' && <Spinner text="Loading donation form…" />}
        {status === 'error' && <div className="alert alert-danger">{error}</div>}
        {status === 'thanks' && <div className="alert alert-success">Thanks for your donation!</div>}
        {status === 'dismissed' && <div className="alert alert-secondary">No donation was made.</div>}
        {status === 'rejected' && <div className="alert alert-warning">The donation was not accepted.</div>}

        <div
          ref={containerRef}
          style={{ display: status === 'shown' || status === 'loading' ? 'block' : 'none' }}
        />
      </div>
    </>
  );
}
