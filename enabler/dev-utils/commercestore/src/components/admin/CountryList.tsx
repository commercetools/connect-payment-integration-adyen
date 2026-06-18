import { formatTaxRate } from '../../data/countries.ts';
import { COUNTRIES } from '../../data/countries.ts';
import type { CountryStatus } from '../../types.ts';

const BUILT_IN_CODES = new Set(COUNTRIES.map(c => c.code));

interface StatusDotProps {
  ok: boolean;
}

function StatusDot({ ok }: StatusDotProps) {
  return <span className={`cs-status-dot ${ok ? 'cs-status-dot--ok' : 'cs-status-dot--missing'}`} />;
}

interface CountryRowProps {
  country: CountryStatus;
  index: number;
  onEnable: (code: string) => void;
  onEdit: (code: string) => void;
}

function CountryRow({ country, index, onEnable, onEdit }: CountryRowProps) {
  return (
    <tr className={`cs-table-row ${index % 2 === 0 ? 'cs-table-row--even' : 'cs-table-row--odd'} ${!country.isReady ? 'cs-row--missing' : ''}`}>
      <td>
        <div className="cs-country-cell">
          <span className="cs-country-badge">{country.code}</span>
          <span className="cs-country-name">{country.name}</span>
        </div>
      </td>
      <td><span className="cs-currency-label">{country.currency}</span></td>
      <td>
        <div className="cs-status-cell">
          <StatusDot ok={country.hasTax} />
          <span>{country.hasTax ? formatTaxRate(country.taxRate) : '—'}</span>
        </div>
      </td>
      <td>
        <div className="cs-status-cell">
          <StatusDot ok={country.hasShipping} />
          <span>{country.hasShipping ? '✓' : '—'}</span>
        </div>
      </td>
      <td>
        <div className="cs-row-actions">
          {country.isReady
            ? <span className="cs-badge cs-badge--green">Ready</span>
            : <button className="btn btn-xs btn-warning" onClick={() => onEnable(country.code)}>Enable</button>
          }
          <button
            className="cs-icon-btn"
            title={`Edit ${country.name}`}
            onClick={() => onEdit(country.code)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

interface CountryListProps {
  countries: CountryStatus[];
  onEnable: (code: string) => void;
  onEdit: (code: string) => void;
  onAdd: () => void;
}

export default function CountryList({ countries, onEnable, onEdit, onAdd }: CountryListProps) {
  const ready = countries.filter(c => c.isReady).length;

  return (
    <div className="cs-admin-card">
      <div className="cs-admin-card-header">
        <div className="cs-admin-summary-inline">
          <span className="cs-admin-summary-count">
            <strong>{ready}</strong> / {countries.length} countries configured
          </span>
          <div className="cs-legend">
            <StatusDot ok={true} /> Configured &nbsp;
            <StatusDot ok={false} /> Missing
          </div>
        </div>
        <button className="btn btn-sm btn-primary cs-add-country-btn" onClick={onAdd}>
          + Add Country
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-sm cs-table cs-admin-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>Currency</th>
              <th>Tax Rate</th>
              <th>Shipping</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c, i) => (
              <CountryRow key={c.code} country={c} index={i} onEnable={onEnable} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
