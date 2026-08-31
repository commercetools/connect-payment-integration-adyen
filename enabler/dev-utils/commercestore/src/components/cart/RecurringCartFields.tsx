import { useEffect } from 'react';
import type { RecurrencePolicy } from '../../types.ts';

interface RecurringCartFieldsProps {
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
  recurrencePolicyId: string;
  onRecurrencePolicyIdChange: (id: string) => void;
  policies: RecurrencePolicy[];
  loading: boolean;
}

export default function RecurringCartFields({
  isRecurring, onIsRecurringChange, recurrencePolicyId, onRecurrencePolicyIdChange, policies, loading,
}: RecurringCartFieldsProps) {
  // Default to the first available policy once loaded, so "Recurring cart" is usable immediately.
  useEffect(() => {
    if (!recurrencePolicyId && policies.length > 0) {
      onRecurrencePolicyIdChange(policies[0].id);
    }
  }, [policies, recurrencePolicyId, onRecurrencePolicyIdChange]);

  if (loading) return null;

  if (policies.length === 0) {
    return (
      <div className="cs-field">
        <small className="text-muted">
          No recurrence policies found — create one in Admin → Recurrence Policies to enable recurring carts.
        </small>
      </div>
    );
  }

  return (
    <div className="cs-field">
      <label className="cs-field-checkbox">
        <input type="checkbox" checked={isRecurring} onChange={e => onIsRecurringChange(e.target.checked)} />
        Recurring cart
      </label>
      {isRecurring && (
        <select
          className="form-control mt-2"
          value={recurrencePolicyId}
          onChange={e => onRecurrencePolicyIdChange(e.target.value)}
        >
          {policies.map(p => (
            <option key={p.id} value={p.id}>{p.name ?? p.key} ({p.scheduleLabel})</option>
          ))}
        </select>
      )}
    </div>
  );
}
