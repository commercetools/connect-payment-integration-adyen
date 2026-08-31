import type { RecurrencePolicy } from '../../types.ts';

interface RecurrencePolicyListProps {
  policies: RecurrencePolicy[];
  onAdd: () => void;
  onEdit: (policy: RecurrencePolicy) => void;
}

export default function RecurrencePolicyList({ policies, onAdd, onEdit }: RecurrencePolicyListProps) {
  return (
    <div className="cs-admin-card">
      <div className="cs-admin-card-header">
        <div className="cs-admin-summary-inline">
          <span className="cs-admin-summary-count">
            <strong>{policies.length}</strong> recurrence {policies.length === 1 ? 'policy' : 'policies'} in the project
          </span>
        </div>
        <button className="btn btn-sm btn-primary cs-add-country-btn" onClick={onAdd}>
          + Create Policy
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-sm cs-table cs-admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Schedule</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p, i) => (
              <tr key={p.id} className={`cs-table-row ${i % 2 === 0 ? 'cs-table-row--even' : 'cs-table-row--odd'}`}>
                <td>{p.key}</td>
                <td>{p.name ?? '—'}</td>
                <td>{p.scheduleLabel}</td>
                <td>
                  <button
                    className="cs-icon-btn"
                    title={`Edit ${p.name ?? p.key}`}
                    onClick={() => onEdit(p)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {policies.length === 0 && (
              <tr className="cs-table-row">
                <td colSpan={4} className="text-muted">No recurrence policies found in this project.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
