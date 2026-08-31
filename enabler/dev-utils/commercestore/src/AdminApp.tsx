import { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import ToastContainer from './components/Toast.tsx';
import Spinner from './components/Spinner.tsx';
import CountryList from './components/admin/CountryList.tsx';
import EnableCountryModal from './components/admin/EnableCountryModal.tsx';
import CountryFormModal from './components/admin/CountryFormModal.tsx';
import RecurrencePolicyList from './components/admin/RecurrencePolicyList.tsx';
import RecurrencePolicyFormModal from './components/admin/RecurrencePolicyFormModal.tsx';
import { useAdmin } from './hooks/useAdmin.ts';
import { useToast } from './hooks/useToast.ts';
import type { Country, Address, RecurrencePolicy, RecurrencePolicyFormInput } from './types.ts';

type AdminTab = 'store' | 'recurrence';

export default function AdminApp() {
  const { countryStatuses, recurrencePolicies, loading, error, enableCountry, getMissingItems, addCountry, editCountry, getCountryConfig, createRecurrencePolicy, updateRecurrencePolicy, reload } = useAdmin();
  const { toasts, addToast, removeToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('store');

  // Enable flow
  const [enabling, setEnabling] = useState<string | null>(null);
  const [enableLoading, setEnableLoading] = useState(false);

  // Add flow
  const [addingCountry, setAddingCountry] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Edit flow
  const [editingCountryCode, setEditingCountryCode] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Recurrence policy add/edit flow
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RecurrencePolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  const handleEnable = useCallback((countryCode: string) => {
    setEnabling(countryCode);
  }, []);

  const handleConfirmEnable = useCallback(async () => {
    if (!enabling) return;
    setEnableLoading(true);
    try {
      await enableCountry(enabling);
      addToast('success', `${enabling} enabled successfully`);
      setEnabling(null);
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setEnableLoading(false);
    }
  }, [enabling, enableCountry, addToast]);

  const handleAdd = useCallback(() => {
    setAddingCountry(true);
  }, []);

  const handleSaveAdd = useCallback(async (country: Country, address: Address, shippingCost: number) => {
    setAddLoading(true);
    try {
      await addCountry(country, address, shippingCost);
      addToast('success', `${country.name} (${country.code}) added successfully`);
      setAddingCountry(false);
    } catch (e) {
      addToast('error', (e as Error).message);
      throw e; // let modal show inline error too
    } finally {
      setAddLoading(false);
    }
  }, [addCountry, addToast]);

  const handleEdit = useCallback((countryCode: string) => {
    setEditingCountryCode(countryCode);
  }, []);

  const handleSaveEdit = useCallback(async (country: Country, address: Address, shippingCost: number) => {
    setEditLoading(true);
    try {
      await editCountry(country, address, shippingCost);
      addToast('success', `${country.name} updated successfully`);
      setEditingCountryCode(null);
    } catch (e) {
      addToast('error', (e as Error).message);
      throw e;
    } finally {
      setEditLoading(false);
    }
  }, [editCountry, addToast]);

  const handleSavePolicy = useCallback(async (input: RecurrencePolicyFormInput) => {
    setPolicyLoading(true);
    try {
      if (editingPolicy) {
        await updateRecurrencePolicy(editingPolicy.id, editingPolicy.version, input);
        addToast('success', `${input.name} updated successfully`);
        setEditingPolicy(null);
      } else {
        await createRecurrencePolicy(input);
        addToast('success', `${input.name} created successfully`);
        setAddingPolicy(false);
      }
    } catch (e) {
      addToast('error', (e as Error).message);
      throw e; // let modal show inline error too
    } finally {
      setPolicyLoading(false);
    }
  }, [editingPolicy, createRecurrencePolicy, updateRecurrencePolicy, addToast]);

  const missingItems = enabling ? getMissingItems(enabling) : [];
  const editingConfig = editingCountryCode ? getCountryConfig(editingCountryCode) : undefined;

  return (
    <>
      <Header active="Admin" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="cs-page">
        <div className="cs-page-header">
          <h4>Store Configuration</h4>
          <p className="text-muted">Manage tax rates, shipping methods, and recurrence policies.</p>
          <button className="btn btn-sm btn-outline-secondary" onClick={reload} disabled={loading}>
            ↻ Refresh
          </button>
        </div>

        <div className="cs-tabs mb-3">
          <button className={`cs-tab ${activeTab === 'store' ? 'active' : ''}`} onClick={() => setActiveTab('store')}>
            Tax & Shipping
          </button>
          <button className={`cs-tab ${activeTab === 'recurrence' ? 'active' : ''}`} onClick={() => setActiveTab('recurrence')}>
            Recurrence Policies
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? <Spinner text="Loading configuration…" /> : (
          <>
            {activeTab === 'store' && (
              <CountryList
                countries={countryStatuses}
                onEnable={handleEnable}
                onEdit={handleEdit}
                onAdd={handleAdd}
              />
            )}
            {activeTab === 'recurrence' && (
              <RecurrencePolicyList
                policies={recurrencePolicies}
                onAdd={() => setAddingPolicy(true)}
                onEdit={setEditingPolicy}
              />
            )}
          </>
        )}
      </div>

      {enabling && (
        <EnableCountryModal
          countryCode={enabling}
          missingItems={missingItems}
          onConfirm={handleConfirmEnable}
          onClose={() => setEnabling(null)}
          loading={enableLoading}
        />
      )}

      {addingCountry && (
        <CountryFormModal
          mode="add"
          onSave={handleSaveAdd}
          onClose={() => setAddingCountry(false)}
          loading={addLoading}
        />
      )}

      {editingCountryCode && editingConfig && (
        <CountryFormModal
          mode="edit"
          initial={editingConfig}
          onSave={handleSaveEdit}
          onClose={() => setEditingCountryCode(null)}
          loading={editLoading}
        />
      )}

      {addingPolicy && (
        <RecurrencePolicyFormModal
          mode="add"
          onSave={handleSavePolicy}
          onClose={() => setAddingPolicy(false)}
          loading={policyLoading}
        />
      )}

      {editingPolicy && (
        <RecurrencePolicyFormModal
          mode="edit"
          initial={editingPolicy}
          onSave={handleSavePolicy}
          onClose={() => setEditingPolicy(null)}
          loading={policyLoading}
        />
      )}
    </>
  );
}
