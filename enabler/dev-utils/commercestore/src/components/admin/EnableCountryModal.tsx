import { COUNTRY_BY_CODE } from '../../data/countries.ts';

interface EnableCountryModalProps {
  countryCode: string;
  missingItems: string[];
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

export default function EnableCountryModal({ countryCode, missingItems, onConfirm, onClose, loading }: EnableCountryModalProps) {
  const country = COUNTRY_BY_CODE[countryCode];

  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-header">
          <h5>Enable {country?.name}</h5>
          <button className="cs-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="cs-modal-body">
          <p>The following will be created or updated in your commercetools project:</p>
          <ul className="cs-enable-list">
            {missingItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          {!missingItems.length && (
            <p className="text-success">This country is already fully configured.</p>
          )}
        </div>
        <div className="cs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={loading || !missingItems.length}>
            {loading ? 'Configuring…' : 'Confirm & Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}
