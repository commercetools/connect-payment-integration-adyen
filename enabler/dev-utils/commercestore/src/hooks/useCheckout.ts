import { useState, useCallback, useRef } from 'react';
import { getCartById, getSessionId } from '../api/ct.ts';
import { fetchPaymentMethods } from '../api/processor.ts';
import type {
  CtCart,
  EnablerInstance,
  EnablerConstructor,
  PaymentMethod,
  StoredPaymentMethod,
  CheckoutResult,
} from '../types.ts';

type CompletionCallbacks = {
  onComplete?: (result: CheckoutResult) => void;
  onError?: (err: Error, ctx?: unknown) => void;
};

type LoadOptions = {
  isDropin?: boolean;
  onComplete?: (result: CheckoutResult) => void;
  onError?: (err: Error, ctx?: unknown) => void;
};

export function useCheckout(): {
  cart: CtCart | null;
  enabler: EnablerInstance | null;
  paymentMethods: PaymentMethod[];
  dropinMethods: PaymentMethod[];
  savedMethods: StoredPaymentMethod[];
  loading: boolean;
  error: string | null;
  load: (cartId: string, opts?: LoadOptions) => Promise<void>;
  reset: () => void;
  removeSavedMethod: (id: string) => void;
} {
  const [cart, setCart] = useState<CtCart | null>(null);
  const [enabler, setEnabler] = useState<EnablerInstance | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [dropinMethods, setDropinMethods] = useState<PaymentMethod[]>([]);
  const [savedMethods, setSavedMethods] = useState<StoredPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completionRef = useRef<CompletionCallbacks>({});

  const load = useCallback(async (cartId: string, { isDropin = false, onComplete, onError }: LoadOptions = {}) => {
    setLoading(true);
    setError(null);
    setEnabler(null);
    setPaymentMethods([]);
    setSavedMethods([]);

    completionRef.current = { onComplete, onError };

    try {
      const [cartData, sessionId] = await Promise.all([
        getCartById(cartId),
        getSessionId(cartId, { isDropin }),
      ]);
      setCart(cartData);

      // @ts-ignore — Vite resolves this path to the connector enabler at dev runtime
      const { Enabler } = await import('/src/main.ts') as { Enabler: EnablerConstructor };
      const instance = new Enabler({
        processorUrl: window.__VITE_PROCESSOR_URL__,
        sessionId,
        onComplete: (result) => completionRef.current.onComplete?.(result),
        onError: (err, ctx) => completionRef.current.onError?.(err, ctx),
      });

      const [methodsData, storedEnabled] = await Promise.all([
        fetchPaymentMethods(),
        instance.isStoredPaymentMethodsEnabled?.().catch(() => false),
      ]);

      setPaymentMethods(methodsData.components);
      setDropinMethods(methodsData.dropins);

      if (storedEnabled && cartData.customerId) {
        const stored = await instance.getStoredPaymentMethods({ allowedMethodTypes: ['card'] }).catch(() => ({ storedPaymentMethods: [] }));
        console.log('[useCheckout] getStoredPaymentMethods raw:', JSON.stringify(stored, null, 2));
        setSavedMethods(stored.storedPaymentMethods ?? []);
      }

      setEnabler(instance);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCart(null);
    setEnabler(null);
    setPaymentMethods([]);
    setDropinMethods([]);
    setSavedMethods([]);
    setError(null);
  }, []);

  const removeSavedMethod = useCallback((id: string) => {
    setSavedMethods(prev => prev.filter(m => m.id !== id));
  }, []);

  return { cart, enabler, paymentMethods, dropinMethods, savedMethods, loading, error, load, reset, removeSavedMethod };
}
