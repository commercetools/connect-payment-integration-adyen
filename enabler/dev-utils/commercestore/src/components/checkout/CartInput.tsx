interface CartInputProps {
  cartId: string;
  onChange: (value: string) => void;
  onStart: () => void;
  onQuickCart: () => void;
  onCustomCart: () => void;
  onViewSummary?: () => void;
  loading: boolean;
  hasCart: boolean;
}

export default function CartInput({ cartId, onChange, onStart, onQuickCart, onCustomCart, onViewSummary, loading, hasCart }: CartInputProps) {
  return (
    <div className="cs-cart-section">
      <div className="cs-cart-actions">
        <button className="cs-btn-cart cs-btn-cart--quick" onClick={onQuickCart}>
          <span className="cs-btn-cart-icon">✓</span>
          <span><strong>Quick Cart</strong><small>Pre-configured</small></span>
        </button>
        <button className="cs-btn-cart cs-btn-cart--custom" onClick={onCustomCart}>
          <span className="cs-btn-cart-icon">⊕</span>
          <span><strong>Custom Cart</strong><small>Build your own</small></span>
        </button>
        {hasCart && onViewSummary && (
          <button className="cs-btn-cart cs-btn-cart--summary" onClick={onViewSummary}>
            <span className="cs-btn-cart-icon">☰</span>
            <span><strong>Summary</strong><small>View cart</small></span>
          </button>
        )}
      </div>
      <div className="cs-cart-input-row">
        <label className="cs-cart-label">Cart ID</label>
        <div className="cs-cart-input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Paste a cart ID or create one above"
            value={cartId}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cartId && onStart()}
          />
          <button className="btn btn-primary" onClick={onStart} disabled={!cartId || loading}>
            {loading ? 'Loading...' : 'Start Checkout →'}
          </button>
        </div>
      </div>
    </div>
  );
}
