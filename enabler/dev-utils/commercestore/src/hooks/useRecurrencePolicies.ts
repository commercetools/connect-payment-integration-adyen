import { useState, useEffect } from 'react';
import { getAllRecurrencePolicies } from '../api/ct.ts';
import type { RecurrencePolicy } from '../types.ts';

export function useRecurrencePolicies(): { policies: RecurrencePolicy[]; loading: boolean } {
  const [policies, setPolicies] = useState<RecurrencePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllRecurrencePolicies()
      .then(result => { if (!cancelled) setPolicies(result); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { policies, loading };
}
