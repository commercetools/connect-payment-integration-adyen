import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { getPayments } from '../api/ct.ts';
import { executePaymentAction } from '../api/processor.ts';
import type { CtPayment, PaymentsFilters } from '../types.ts';

export function usePaymentsData(): {
  payments: CtPayment[];
  allPayments: CtPayment[];
  loading: boolean;
  error: string | null;
  filters: PaymentsFilters;
  setFilters: Dispatch<SetStateAction<PaymentsFilters>>;
  runAction: (paymentId: string, action: string, opts?: { amount?: number; currency?: string }) => Promise<void>;
  reload: () => Promise<void>;
} {
  const [payments, setPayments] = useState<CtPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PaymentsFilters>({ status: '', type: '', search: '' });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPayments();
      setPayments(data.results ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filteredPayments = payments.filter(p => {
    const latest = p.transactions?.at(-1);
    if (filters.status && latest?.state !== filters.status) return false;
    if (filters.type && latest?.type !== filters.type) return false;
    if (filters.search && !p.id.includes(filters.search)) return false;
    return true;
  });

  const runAction = useCallback(async (paymentId: string, action: string, opts: { amount?: number; currency?: string } = {}) => {
    await executePaymentAction(paymentId, action, opts);
    await reload();
  }, [reload]);

  return { payments: filteredPayments, allPayments: payments, loading, error, filters, setFilters, runAction, reload };
}
