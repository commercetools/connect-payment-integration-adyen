import { useState, useEffect } from 'react';
import type { Country, Address } from '../../types.ts';

interface CountryFormModalProps {
  mode: 'add' | 'edit';
  initial?: { country: Country; address: Address; shippingCost: number };
  onSave: (country: Country, address: Address, shippingCost: number) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

const NZ_DEFAULTS = {
  country: { code: 'NZ', name: 'New Zealand', currency: 'NZD', taxRate: 0.15, taxName: 'GST' },
  address: {
    firstName: 'Sam',
    lastName: 'Smith',
    streetName: 'Queen Street',
    streetNumber: '1',
    city: 'Auckland',
    postalCode: '1010',
    phone: '+6491234567',
    email: 'sam.smith@example.co.nz',
  },
  shippingCost: 750,
};

function emptyCountry(): Country {
  return { code: '', name: '', currency: '', taxRate: 0, taxName: '' };
}

function emptyAddress(): Address {
  return { firstName: '', lastName: '', streetName: '', streetNumber: '', city: '', postalCode: '', region: '', phone: '', email: '' };
}

export default function CountryFormModal({ mode, initial, onSave, onClose, loading }: CountryFormModalProps) {
  const [country, setCountry] = useState<Country>(initial?.country ?? emptyCountry());
  const [address, setAddress] = useState<Address>(initial?.address ?? emptyAddress());
  // shippingCostDisplay is in currency units (e.g. "7.00"), stored as cents
  const [shippingCostDisplay, setShippingCostDisplay] = useState<string>(
    initial ? (initial.shippingCost / 100).toFixed(2) : ''
  );
  const [error, setError] = useState<string | null>(null);

  // Auto-fill NZ defaults when code is typed as "NZ" in add mode
  useEffect(() => {
    if (mode === 'add' && country.code.toUpperCase() === 'NZ') {
      setCountry(NZ_DEFAULTS.country);
      setAddress(NZ_DEFAULTS.address);
      setShippingCostDisplay((NZ_DEFAULTS.shippingCost / 100).toFixed(2));
    }
  // Only react to code changes in add mode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.code, mode]);

  const setC = (field: keyof Country, value: string | number) =>
    setCountry(prev => ({ ...prev, [field]: value }));

  const setA = (field: keyof Address, value: string) =>
    setAddress(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setError(null);
    if (!country.code.trim()) return setError('Country code is required.');
    if (!country.name.trim()) return setError('Country name is required.');
    if (!country.currency.trim()) return setError('Currency code is required.');
    if (!country.taxName.trim()) return setError('Tax name is required.');
    if (!address.firstName.trim() || !address.lastName.trim()) return setError('First and last name are required.');
    if (!address.streetName.trim() || !address.streetNumber.trim()) return setError('Street name and number are required.');
    if (!address.city.trim() || !address.postalCode.trim()) return setError('City and postal code are required.');

    const shippingCostCents = Math.round(parseFloat(shippingCostDisplay || '0') * 100);
    if (isNaN(shippingCostCents) || shippingCostCents < 0) return setError('Shipping cost must be a valid non-negative number.');

    const finalCountry: Country = {
      ...country,
      code: country.code.trim().toUpperCase(),
      currency: country.currency.trim().toUpperCase(),
      taxRate: country.taxRate,
    };

    try {
      await onSave(finalCountry, address, shippingCostCents);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const title = mode === 'add' ? 'Add Country' : `Edit ${initial?.country.name ?? country.name}`;

  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal cs-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-header">
          <h5>{title}</h5>
          <button className="cs-modal-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className="cs-modal-body">
          {error && <div className="alert alert-danger" style={{ fontSize: 13, padding: '8px 12px', marginBottom: 16 }}>{error}</div>}

          {/* Country section */}
          <div className="cs-form-section-title">Country</div>
          <div className="cs-form-grid cs-form-grid--3">
            <div className="cs-field">
              <label>Code</label>
              <input
                className="form-control form-control-sm"
                value={country.code}
                onChange={e => setC('code', e.target.value.toUpperCase())}
                readOnly={mode === 'edit'}
                maxLength={3}
                placeholder="e.g. NZ"
                style={mode === 'edit' ? { background: '#f5f7fa', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="cs-field">
              <label>Name</label>
              <input
                className="form-control form-control-sm"
                value={country.name}
                onChange={e => setC('name', e.target.value)}
                placeholder="e.g. New Zealand"
              />
            </div>
            <div className="cs-field">
              <label>Currency</label>
              <input
                className="form-control form-control-sm"
                value={country.currency}
                onChange={e => setC('currency', e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="e.g. NZD"
              />
            </div>
            <div className="cs-field">
              <label>Tax Rate (%)</label>
              <input
                className="form-control form-control-sm"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={country.taxRate * 100}
                onChange={e => setC('taxRate', parseFloat(e.target.value) / 100)}
                placeholder="e.g. 15"
              />
            </div>
            <div className="cs-field">
              <label>Tax Name</label>
              <input
                className="form-control form-control-sm"
                value={country.taxName}
                onChange={e => setC('taxName', e.target.value)}
                placeholder="e.g. GST"
              />
            </div>
            <div className="cs-field">
              <label>Shipping Cost ({country.currency || 'currency'})</label>
              <input
                className="form-control form-control-sm"
                type="number"
                step="0.01"
                min="0"
                value={shippingCostDisplay}
                onChange={e => setShippingCostDisplay(e.target.value)}
                placeholder="e.g. 7.50"
              />
            </div>
          </div>

          {/* Address section */}
          <div className="cs-form-section-title" style={{ marginTop: 8 }}>Address</div>
          <div className="cs-form-grid cs-form-grid--2">
            <div className="cs-field">
              <label>First Name</label>
              <input className="form-control form-control-sm" value={address.firstName} onChange={e => setA('firstName', e.target.value)} placeholder="First name" />
            </div>
            <div className="cs-field">
              <label>Last Name</label>
              <input className="form-control form-control-sm" value={address.lastName} onChange={e => setA('lastName', e.target.value)} placeholder="Last name" />
            </div>
            <div className="cs-field">
              <label>Street Name</label>
              <input className="form-control form-control-sm" value={address.streetName} onChange={e => setA('streetName', e.target.value)} placeholder="Street name" />
            </div>
            <div className="cs-field">
              <label>Street Number</label>
              <input className="form-control form-control-sm" value={address.streetNumber} onChange={e => setA('streetNumber', e.target.value)} placeholder="Number" />
            </div>
            <div className="cs-field">
              <label>City</label>
              <input className="form-control form-control-sm" value={address.city} onChange={e => setA('city', e.target.value)} placeholder="City" />
            </div>
            <div className="cs-field">
              <label>Postal Code</label>
              <input className="form-control form-control-sm" value={address.postalCode} onChange={e => setA('postalCode', e.target.value)} placeholder="Postal code" />
            </div>
            <div className="cs-field">
              <label>Region <span className="text-muted">(optional)</span></label>
              <input className="form-control form-control-sm" value={address.region ?? ''} onChange={e => setA('region', e.target.value)} placeholder="State / province" />
            </div>
            <div className="cs-field">
              <label>Phone <span className="text-muted">(optional)</span></label>
              <input className="form-control form-control-sm" value={address.phone ?? ''} onChange={e => setA('phone', e.target.value)} placeholder="+1234567890" />
            </div>
            <div className="cs-field" style={{ gridColumn: '1 / -1' }}>
              <label>Email <span className="text-muted">(optional)</span></label>
              <input className="form-control form-control-sm" value={address.email ?? ''} onChange={e => setA('email', e.target.value)} placeholder="test@example.com" />
            </div>
          </div>
        </div>

        <div className="cs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading
              ? <><span className="btn-spinner-sm" />{mode === 'add' ? 'Adding…' : 'Saving…'}</>
              : mode === 'add' ? 'Add Country' : 'Save Changes'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
