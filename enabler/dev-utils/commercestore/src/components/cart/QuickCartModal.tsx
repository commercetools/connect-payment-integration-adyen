import { useState } from 'react';
import { COUNTRIES } from '../../data/countries.ts';
import { createPreconfiguredCart } from '../../api/ct.ts';

const CUSTOMER_OPTIONS = [
  { value: 'anonymous', label: 'Anonymous', desc: 'No customer attached' },
  { value: 'with', label: 'With Customer', desc: 'Auto-created demo customer' },
] as const;

type CustomerOption = (typeof CUSTOMER_OPTIONS)[number]['value'];

interface QuickCartModalProps {
  onCreated: (cartId: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export default function QuickCartModal({ onCreated, onError: _onError, onClose }: QuickCartModalProps) {
  const [country, setCountry] = useState('DE');
  const [customer, setCustomer] = useState<CustomerOption>('anonymous');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const cart = await createPreconfiguredCart(country, customer === 'with');
      onCreated(cart.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-header">
          <h5>Quick Cart</h5>
          <button className="cs-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="cs-modal-body">
          <p className="cs-modal-intro">
            Creates a ready-to-use cart with 2 sample products, shipping, and taxes for the selected country.
          </p>

          <div className="cs-field">
            <label>Country</label>
            <select className="form-control" value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.name} — {c.currency} (Tax: {(c.taxRate * 100).toFixed(c.taxRate === 0.077 ? 1 : 0)}%)
                </option>
              ))}
            </select>
          </div>

          <div className="cs-field">
            <label>Customer</label>
            <div className="cs-option-cards">
              {CUSTOMER_OPTIONS.map(opt => (
                <label key={opt.value} className={`cs-option-card ${customer === opt.value ? 'selected' : ''}`}>
                  <input type="radio" name="qcCustomer" value={opt.value} checked={customer === opt.value} onChange={() => setCustomer(opt.value)} />
                  <div>
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="alert alert-danger mt-2">{error}</div>}
        </div>
        <div className="cs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-success" onClick={handleCreate} disabled={loading}>
            {loading ? <span className="btn-spinner-sm" /> : null}
            {loading ? 'Creating...' : '✓ Create Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
