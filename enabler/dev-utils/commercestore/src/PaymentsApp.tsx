import { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import ToastContainer from './components/Toast.tsx';
import Spinner from './components/Spinner.tsx';
import PaymentsFiltersBar from './components/payments/PaymentsFilters.tsx';
import PaymentsTable from './components/payments/PaymentsTable.tsx';
import ActionModal from './components/payments/ActionModal.tsx';
import { usePaymentsData } from './hooks/usePaymentsData.ts';
import { useToast } from './hooks/useToast.ts';
import type { CtPayment } from './types.ts';

interface ActionState {
  payment: CtPayment;
  action: string;
}

export default function PaymentsApp() {
  const { payments, loading, error, filters, setFilters, runAction, reload } = usePaymentsData();
  const { toasts, addToast, removeToast } = useToast();
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = useCallback((payment: CtPayment, action: string) => {
    setActionState({ payment, action });
  }, []);

  const handleConfirmAction = useCallback(async (opts: { amount?: number; currency?: string }) => {
    if (!actionState) return;
    setActionLoading(true);
    try {
      await runAction(actionState.payment.id, actionState.action, opts);
      addToast('success', `${actionState.action.replace('Payment', '')} completed`);
      setActionState(null);
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }, [actionState, runAction, addToast]);

  return (
    <>
      <Header active="Payments" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="cs-page">
        <div className="cs-page-header">
          <h4>Payment Management</h4>
          <p className="text-muted">View and manage payments created with this connector.</p>
        </div>

        <PaymentsFiltersBar filters={filters} onChange={setFilters} onReload={reload} loading={loading} />

        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? <Spinner text="Loading payments…" /> : (
          <PaymentsTable payments={payments} onAction={handleAction} loading={false} />
        )}
      </div>

      {actionState && (
        <ActionModal
          payment={actionState.payment}
          action={actionState.action}
          onConfirm={handleConfirmAction}
          onClose={() => setActionState(null)}
          loading={actionLoading}
        />
      )}
    </>
  );
}
