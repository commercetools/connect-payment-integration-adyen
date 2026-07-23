import { useState } from 'react';
import { COUNTRIES } from '../../data/countries.ts';
import { createCart, searchCustomerByEmail, createCustomer } from '../../api/ct.ts';
import type { LineItem } from '../../types.ts';

const DEFAULT_ITEM: LineItem = { name: 'Premium Wireless Headphones', quantity: 1, centAmount: 12999 };

const CUSTOMER_MODES = [
  { value: 'none', label: 'Anonymous', desc: 'No customer' },
  { value: 'existing', label: 'Existing', desc: 'Find by email' },
  { value: 'new', label: 'New', desc: 'Create customer' },
] as const;

type CustomerMode = (typeof CUSTOMER_MODES)[number]['value'];

interface LineItemRowProps {
  item: LineItem;
  index: number;
  onChange: (index: number, field: keyof LineItem, value: string | number) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}

function LineItemRow({ item, index, onChange, onRemove, showRemove }: LineItemRowProps) {
  return (
    <div className="cs-line-item">
      {showRemove && <button type="button" className="cs-line-item-remove" onClick={() => onRemove(index)}>×</button>}
      <div className="cs-line-item-fields">
        <input className="form-control form-control-sm" placeholder="Product name" value={item.name}
          onChange={e => onChange(index, 'name', e.target.value)} />
        <input type="number" className="form-control form-control-sm" placeholder="Qty" min="1" value={item.quantity}
          onChange={e => onChange(index, 'quantity', parseInt(e.target.value, 10) || 1)} />
        <input type="number" className="form-control form-control-sm" placeholder="Price (cents)" min="0" value={item.centAmount}
          onChange={e => onChange(index, 'centAmount', parseInt(e.target.value, 10) || 0)} />
      </div>
    </div>
  );
}

interface CustomCartModalProps {
  onCreated: (cartId: string) => void;
  onClose: () => void;
}

export default function CustomCartModal({ onCreated, onClose }: CustomCartModalProps) {
  const [countryCode, setCountryCode] = useState('DE');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('none');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ ...DEFAULT_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const addItem = () =>
    setItems(prev => [...prev, { name: '', quantity: 1, centAmount: 1000 }]);

  const handleCreate = async () => {
    if (items.some(i => !i.name.trim())) { setError('All items need a name.'); return; }
    if (customerMode === 'existing' && !email) { setError('Enter a customer email.'); return; }
    if (customerMode === 'new' && (!email || !firstName || !lastName)) { setError('Fill in all customer fields.'); return; }

    setLoading(true);
    setError('');
    try {
      let customerId: string | undefined;
      if (customerMode === 'existing') {
        const customer = await searchCustomerByEmail(email);
        if (!customer) throw new Error(`No customer found with email: ${email}`);
        customerId = customer.id;
      } else if (customerMode === 'new') {
        const result = await createCustomer({ email, firstName, lastName });
        customerId = result.customer.id;
      }

      const cart = await createCart({ country: countryCode, customerId, lineItems: items });
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
      <div className="cs-modal cs-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="cs-modal-header">
          <h5>Custom Cart</h5>
          <button className="cs-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="cs-modal-body">
          <div className="cs-field">
            <label>Country & Currency</label>
            <select className="form-control" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name} — {c.currency}</option>
              ))}
            </select>
          </div>

          <div className="cs-field">
            <label>Customer</label>
            <div className="cs-option-cards">
              {CUSTOMER_MODES.map(opt => (
                <label key={opt.value} className={`cs-option-card ${customerMode === opt.value ? 'selected' : ''}`}>
                  <input type="radio" name="ccCustomer" value={opt.value} checked={customerMode === opt.value} onChange={() => setCustomerMode(opt.value)} />
                  <div><strong>{opt.label}</strong><small>{opt.desc}</small></div>
                </label>
              ))}
            </div>
          </div>

          {customerMode === 'existing' && (
            <input className="form-control mb-2" type="email" placeholder="Customer email" value={email} onChange={e => setEmail(e.target.value)} />
          )}
          {customerMode === 'new' && (
            <div className="row mb-2">
              <div className="col-md-4"><input className="form-control" type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="col-md-4"><input className="form-control" placeholder="First name *" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
              <div className="col-md-4"><input className="form-control" placeholder="Last name *" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            </div>
          )}

          <div className="cs-field">
            <label>Line Items</label>
            {items.map((item, idx) => (
              <LineItemRow key={idx} item={item} index={idx} onChange={updateItem} onRemove={removeItem} showRemove={items.length > 1} />
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={addItem}>+ Add item</button>
          </div>

          {error && <div className="alert alert-danger mt-2">{error}</div>}
        </div>
        <div className="cs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
