import { getCtpToken } from './ct.ts';
import type { PaymentMethod } from '../types.ts';

const processorUrl = (): string => window.__VITE_PROCESSOR_URL__;

export async function fetchPaymentMethods(sessionId: string): Promise<{
  components: PaymentMethod[];
  dropins: PaymentMethod[];
  express: PaymentMethod[];
}> {
  const res = await fetch(`${processorUrl()}/operations/payment-components`, {
    headers: {
      'X-Session-Id': sessionId,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || 'Failed to fetch payment components');
  }
  const data = await res.json() as { components?: PaymentMethod[]; dropins?: PaymentMethod[]; express?: PaymentMethod[] };
  return {
    components: data.components ?? [],
    dropins: data.dropins ?? [],
    express: data.express ?? [],
  };
}

export async function executePaymentAction(
  paymentId: string,
  action: string,
  { amount, currency }: { amount?: number; currency?: string } = {},
): Promise<unknown> {
  const jwt = await getCtpToken();
  const actionObj: Record<string, unknown> = { action };
  if (amount !== undefined) actionObj.amount = { centAmount: amount, currencyCode: currency };

  const res = await fetch(`${processorUrl()}/operations/payment-intents/${paymentId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actions: [actionObj] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || `Failed to execute ${action}`);
  }
  return res.json();
}
