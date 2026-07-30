import { useState } from 'react';
import { formatCurrency } from '../../data/countries.ts';
import type { CtPayment } from '../../types.ts';

const ACTION_LABELS: Record<string, string> = {
  capturePayment: 'Capture',
  cancelPayment: 'Cancel',
  reversePayment: 'Reverse',
  refundPayment: 'Refund',
};

function totalCharged(payment: CtPayment): number {
  const txs = payment.transactions ?? [];
  const txAmount = txs
    .filter(t => t.type === 'Charge' && t.state === 'Success')
    .reduce((sum, t) => sum + (t.amount?.centAmount ?? 0), 0);
  // Adyen connector may not set transaction amount; fall back to amountPlanned
  if (txAmount === 0 && txs.some(t => t.type === 'Charge' && t.state === 'Success')) {
    return payment.amountPlanned?.centAmount ?? 0;
  }
  return txAmount;
}

function totalRefunded(payment: CtPayment): number {
  return (payment.transactions ?? [])
    .filter(t => t.type === 'Refund' && t.state === 'Success')
    .reduce((sum, t) => sum + (t.amount?.centAmount ?? 0), 0);
}

interface ActionModalProps {
  payment: CtPayment;
  action: string;
  onConfirm: (opts: { amount?: number; currency?: string }) => void;
  onClose: () => void;
  loading: boolean;
}

export default function ActionModal({ payment, action, onConfirm, onClose, loading }: ActionModalProps) {
  const currency = payment.amountPlanned?.currencyCode;
  const maxRefund = totalCharged(payment) - totalRefunded(payment);
  const needsAmount = action === 'refundPayment';
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState(Math.floor(maxRefund / 2));

  // capturePayment requires amount in the schema; always capture the full planned amount
  const captureAmount = action === 'capturePayment' ? payment.amountPlanned?.centAmount : undefined;
  const amount = needsAmount ? (refundType === 'full' ? maxRefund : partialAmount) : captureAmount;

  const handleConfirm = () => {
    if (needsAmount && refundType === 'partial' && (partialAmount <= 0 || partialAmount > maxRefund)) return;
    onConfirm({ amount, currency });
  };

  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-header">
          <h5>{ACTION_LABELS[action]} Payment</h5>
          <button className="cs-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="cs-modal-body">
          <p>Payment ID: <code>{payment.id}</code></p>
          {needsAmount && (
            <>
              <p>Available to refund: <strong>{formatCurrency(maxRefund, currency!)}</strong></p>
              <div className="cs-option-cards">
                <label className={`cs-option-card ${refundType === 'full' ? 'selected' : ''}`}>
                  <input type="radio" name="refundType" value="full" checked={refundType === 'full'} onChange={() => setRefundType('full')} />
                  <div><strong>Full refund</strong><small>{formatCurrency(maxRefund, currency!)}</small></div>
                </label>
                <label className={`cs-option-card ${refundType === 'partial' ? 'selected' : ''}`}>
                  <input type="radio" name="refundType" value="partial" checked={refundType === 'partial'} onChange={() => setRefundType('partial')} />
                  <div><strong>Partial refund</strong><small>Enter amount below</small></div>
                </label>
              </div>
              {refundType === 'partial' && (
                <div className="cs-field mt-2">
                  <label>Amount in cents (max {maxRefund})</label>
                  <input type="number" className="form-control" min="1" max={maxRefund}
                    value={partialAmount} onChange={e => setPartialAmount(parseInt(e.target.value, 10))} />
                </div>
              )}
            </>
          )}
          {action === 'capturePayment' && (
            <p>Amount to capture: <strong>{formatCurrency(payment.amountPlanned.centAmount, currency!)}</strong></p>
          )}
          {action !== 'capturePayment' && !needsAmount && (
            <p className="text-muted">This action cannot be undone.</p>
          )}
        </div>
        <div className="cs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={loading || (needsAmount && maxRefund <= 0)}>
            {loading ? 'Processing…' : `Confirm ${ACTION_LABELS[action]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
