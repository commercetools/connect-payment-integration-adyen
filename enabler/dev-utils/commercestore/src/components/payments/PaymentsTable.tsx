import { useState } from 'react';
import { formatCurrency } from '../../data/countries.ts';
import type { CtPayment, CtTransaction } from '../../types.ts';

const STATE_BADGE: Record<string, string> = { Success: 'green', Failure: 'danger', Pending: 'orange', Initial: 'purple' };
const TYPE_BADGE: Record<string, string> = { Authorization: 'purple', Charge: 'green', Refund: 'orange', CancelAuthorization: 'grey', Chargeback: 'danger' };
const ACTION_LABELS: Record<string, string> = { capturePayment: 'Capture', cancelPayment: 'Cancel', reversePayment: 'Reverse', refundPayment: 'Refund' };
const PAGE_SIZE = 10;

function latestTransaction(payment: CtPayment): CtTransaction | undefined {
  return payment.transactions?.at(-1);
}

function availableActions(payment: CtPayment): string[] {
  const txs = payment.transactions ?? [];
  const hasSuccessAuth = txs.some(t => t.type === 'Authorization' && t.state === 'Success');
  const hasSuccessCharge = txs.some(t => t.type === 'Charge' && t.state === 'Success');
  const hasSuccessCancel = txs.some(t => t.type === 'CancelAuthorization' && t.state === 'Success');
  const hasSuccessRefund = txs.some(t => t.type === 'Refund' && t.state === 'Success');

  if (hasSuccessAuth && !hasSuccessCharge && !hasSuccessCancel) {
    return ['capturePayment', 'cancelPayment', 'reversePayment'];
  }
  if (hasSuccessCharge && !hasSuccessRefund) {
    return ['refundPayment', 'reversePayment'];
  }
  if (hasSuccessCharge && hasSuccessRefund) {
    // Check if partial refund — compute remaining (Adyen may omit charge amount, so fall back to amountPlanned)
    const chargedRaw = txs.filter(t => t.type === 'Charge' && t.state === 'Success').reduce((s, t) => s + (t.amount?.centAmount ?? 0), 0);
    const charged = chargedRaw === 0 ? (payment.amountPlanned?.centAmount ?? 0) : chargedRaw;
    const refunded = txs.filter(t => t.type === 'Refund' && t.state === 'Success').reduce((s, t) => s + (t.amount?.centAmount ?? 0), 0);
    if (refunded > 0 && refunded < charged) return ['refundPayment'];
    return [];
  }
  return [];
}

interface PaymentRowProps {
  payment: CtPayment;
  index: number;
  onAction: (payment: CtPayment, action: string) => void;
}

function PaymentRow({ payment, index, onAction }: PaymentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const tx = latestTransaction(payment);
  const actions = availableActions(payment);
  const amount = payment.amountPlanned;
  const rowClass = `cs-table-row cs-table-row--${index % 2 === 0 ? 'even' : 'odd'}`;
  const colSpan = 6;

  return (
    <>
      <tr className={`${rowClass} cs-table-row--clickable`} onClick={() => setExpanded(e => !e)}>
        <td><code className="cs-payment-id">{payment.id}</code></td>
        <td>{amount ? formatCurrency(amount.centAmount, amount.currencyCode) : '—'}</td>
        <td>
          {payment.paymentMethodInfo?.method
            ? <span className="cs-badge cs-badge--purple">{payment.paymentMethodInfo.method}</span>
            : '—'}
          {tx && (
            <span className={`cs-badge cs-badge--${STATE_BADGE[tx.state] ?? 'grey'} cs-badge--ml`}>{tx.state}</span>
          )}
        </td>
        <td>
          {tx
            ? <span className={`cs-badge cs-badge--${TYPE_BADGE[tx.type] ?? 'grey'}`}>{tx.type}</span>
            : '—'}
        </td>
        <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
        <td>
          <div className="cs-action-group" onClick={e => e.stopPropagation()}>
            {actions.map(action => (
              <button key={action} className="cs-action-btn" onClick={() => onAction(payment, action)}>
                {ACTION_LABELS[action] ?? action}
              </button>
            ))}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className={`cs-table-row--${index % 2 === 0 ? 'even' : 'odd'}`}>
          <td colSpan={colSpan} className="cs-json-cell">
            <pre className="cs-json-pre">{JSON.stringify(payment, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

interface PaymentsTableProps {
  payments: CtPayment[];
  onAction: (payment: CtPayment, action: string) => void;
  loading: boolean;
}

export default function PaymentsTable({ payments, onAction, loading }: PaymentsTableProps) {
  const [page, setPage] = useState(1);
  const total = payments.length;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const slice = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="cs-table-loading">Loading payments…</div>;
  if (!total) return <div className="cs-table-empty">No payments found</div>;

  return (
    <div className="cs-admin-card">
      <div className="cs-admin-card-header">
        <span className="cs-admin-summary-count">
          <strong>{total}</strong> payment{total !== 1 ? 's' : ''}
        </span>
        {pageCount > 1 && (
          <div className="cs-pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span>{page} / {pageCount}</span>
            <button disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>
      <div className="table-responsive">
        <table className="table table-sm cs-table cs-admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Amount</th><th>Method / Status</th><th>Transaction</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((p, i) => <PaymentRow key={p.id} payment={p} index={i} onAction={onAction} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
