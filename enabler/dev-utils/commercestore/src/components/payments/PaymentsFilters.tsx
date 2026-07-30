import type { PaymentsFilters } from '../../types.ts';

const STATUS_OPTIONS = ['', 'Initial', 'Pending', 'Success', 'Failure'];
const TYPE_OPTIONS = ['', 'Authorization', 'CancelAuthorization', 'Charge', 'Refund', 'Chargeback'];

interface PaymentsFiltersProps {
  filters: PaymentsFilters;
  onChange: (filters: PaymentsFilters) => void;
  onReload: () => void;
  loading: boolean;
}

export default function PaymentsFiltersBar({ filters, onChange, onReload, loading }: PaymentsFiltersProps) {
  return (
    <div className="cs-filters">
      <select className="form-control form-control-sm" value={filters.status}
        onChange={e => onChange({ ...filters, status: e.target.value })}>
        <option value="">All statuses</option>
        {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className="form-control form-control-sm" value={filters.type}
        onChange={e => onChange({ ...filters, type: e.target.value })}>
        <option value="">All types</option>
        {TYPE_OPTIONS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input type="text" className="form-control form-control-sm" placeholder="Search by ID..."
        value={filters.search} onChange={e => onChange({ ...filters, search: e.target.value })} />
      <button className="btn btn-sm btn-outline-secondary" onClick={onReload} disabled={loading}>
        {loading ? '↻' : '↻ Refresh'}
      </button>
    </div>
  );
}
