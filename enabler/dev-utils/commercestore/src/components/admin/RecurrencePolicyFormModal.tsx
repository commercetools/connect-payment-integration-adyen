import { useState } from 'react';
import type { RecurrencePolicy, RecurrencePolicyFormInput, RecurrenceScheduleType } from '../../types.ts';

const INTERVAL_UNITS: Array<{ value: 'Days' | 'Weeks' | 'Months'; label: string }> = [
  { value: 'Days', label: 'Days' },
  { value: 'Weeks', label: 'Weeks' },
  { value: 'Months', label: 'Months' },
];

function emptyInput(): RecurrencePolicyFormInput {
  return { key: '', name: '', scheduleType: 'standard', intervalUnit: 'Months', value: 1, day: 1 };
}

interface RecurrencePolicyFormModalProps {
  mode: 'add' | 'edit';
  initial?: RecurrencePolicy;
  onSave: (input: RecurrencePolicyFormInput) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export default function RecurrencePolicyFormModal({ mode, initial, onSave, onClose, loading }: RecurrencePolicyFormModalProps) {
  const [input, setInput] = useState<RecurrencePolicyFormInput>(initial ? {
    key: initial.key,
    name: initial.name ?? '',
    scheduleType: initial.scheduleType,
    intervalUnit: initial.intervalUnit ?? 'Months',
    value: initial.value ?? 1,
    day: initial.day ?? 1,
  } : emptyInput());
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RecurrencePolicyFormInput>(field: K, value: RecurrencePolicyFormInput[K]) =>
    setInput(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setError(null);
    if (!input.key.trim()) return setError('Key is required.');
    if (!input.name.trim()) return setError('Name is required.');
    if (input.scheduleType === 'standard' && (!input.value || input.value < 1)) {
      return setError('Interval value must be at least 1.');
    }
    if (input.scheduleType === 'dayOfMonth' && (input.day < 1 || input.day > 31)) {
      return setError('Day of month must be between 1 and 31.');
    }

    try {
      await onSave({ ...input, key: input.key.trim() });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const title = mode === 'add' ? 'Create Recurrence Policy' : `Edit ${initial?.name ?? initial?.key}`;

  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-header">
          <h5>{title}</h5>
          <button className="cs-modal-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className="cs-modal-body">
          {error && <div className="alert alert-danger" style={{ fontSize: 13, padding: '8px 12px', marginBottom: 16 }}>{error}</div>}

          <div className="cs-field">
            <label>Key</label>
            <input
              className="form-control form-control-sm"
              value={input.key}
              onChange={e => set('key', e.target.value)}
              readOnly={mode === 'edit'}
              placeholder="e.g. commercestore-recurring-weekly"
              style={mode === 'edit' ? { background: '#f5f7fa', cursor: 'not-allowed' } : undefined}
            />
          </div>

          <div className="cs-field">
            <label>Name</label>
            <input
              className="form-control form-control-sm"
              value={input.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Weekly"
            />
          </div>

          <div className="cs-field">
            <label>Schedule type</label>
            <select
              className="form-control form-control-sm"
              value={input.scheduleType}
              onChange={e => set('scheduleType', e.target.value as RecurrenceScheduleType)}
            >
              <option value="standard">Standard (every N days/weeks/months)</option>
              <option value="dayOfMonth">Day of month</option>
            </select>
          </div>

          {input.scheduleType === 'standard' ? (
            <div className="row">
              <div className="col-6">
                <div className="cs-field">
                  <label>Every</label>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    min={1}
                    value={input.value}
                    onChange={e => set('value', parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>
              <div className="col-6">
                <div className="cs-field">
                  <label>Unit</label>
                  <select
                    className="form-control form-control-sm"
                    value={input.intervalUnit}
                    onChange={e => set('intervalUnit', e.target.value as 'Days' | 'Weeks' | 'Months')}
                  >
                    {INTERVAL_UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="cs-field">
              <label>Day of month</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min={1}
                max={31}
                value={input.day}
                onChange={e => set('day', parseInt(e.target.value, 10) || 1)}
              />
            </div>
          )}
        </div>

        <div className="cs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading
              ? <><span className="btn-spinner-sm" />{mode === 'add' ? 'Creating…' : 'Saving…'}</>
              : mode === 'add' ? 'Create Policy' : 'Save Changes'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
