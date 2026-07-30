import { useState } from 'react';
import ComponentsTab from './ComponentsTab.tsx';
import DropinTab from './DropinTab.tsx';
import type { EnablerInstance, PaymentMethod, StoredPaymentMethod, CheckoutResult } from '../../types.ts';

type TabId = 'components' | 'dropin';

interface CheckoutContentProps {
  enabler: EnablerInstance;
  paymentMethods: PaymentMethod[];
  dropinMethods: PaymentMethod[];
  savedMethods: StoredPaymentMethod[];
  onSuccess: (result: CheckoutResult) => void;
  onError: (msg: string) => void;
  onSavedMethodRemoved: (id: string) => void;
}

export default function CheckoutContent({ enabler, paymentMethods, dropinMethods, savedMethods, onSuccess, onError, onSavedMethodRemoved }: CheckoutContentProps) {
  const hasComponents = paymentMethods.length > 0;
  const hasDropin = dropinMethods.length > 0;

  const defaultTab: TabId = hasComponents ? 'components' : 'dropin';
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const tabs = [
    hasComponents && { id: 'components' as TabId, label: 'Components' },
    hasDropin && { id: 'dropin' as TabId, label: 'Drop-in' },
  ].filter(Boolean) as { id: TabId; label: string }[];

  if (tabs.length === 0) return null;

  return (
    <div className="cs-checkout-content">
      <div className="cs-checkout-header">
        <h5>Payment Methods</h5>
        <div className="cs-tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`cs-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cs-tab-content">
        {activeTab === 'components' && hasComponents && (
          <ComponentsTab enabler={enabler} paymentMethods={paymentMethods}
            savedMethods={savedMethods} onSuccess={onSuccess} onError={onError}
            onSavedMethodRemoved={onSavedMethodRemoved} />
        )}
        {activeTab === 'dropin' && hasDropin && (
          <DropinTab enabler={enabler} onError={onError} />
        )}
      </div>
    </div>
  );
}
