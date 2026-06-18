import { useState, useEffect, useRef, type MutableRefObject } from 'react';
import type { EnablerInstance, MountableComponent, PaymentMethod } from '../types.ts';

export function usePaymentAvailability(
  enabler: EnablerInstance | null,
  methods: PaymentMethod[],
): {
  availability: Record<string, boolean>;
  checking: boolean;
  instancesRef: MutableRefObject<Record<string, MountableComponent>>;
} {
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const instancesRef = useRef<Record<string, MountableComponent>>({});

  const methodKey = methods.map(m => m.type).join(',');

  useEffect(() => {
    if (!enabler || methods.length === 0) return;
    let cancelled = false;

    instancesRef.current = {};
    setAvailability({});
    setChecking(true);

    (async () => {
      await Promise.all(
        methods.map(async (method) => {
          try {
            const builder = await enabler.createComponentBuilder(method.type);
            const instance = builder.build({ showPayButton: false });
            instancesRef.current[method.type] = instance;
            const available = await (instance as { isAvailable?(): Promise<boolean> }).isAvailable?.() ?? true;
            if (!cancelled) setAvailability(prev => ({ ...prev, [method.type]: available }));
          } catch {
            if (!cancelled) setAvailability(prev => ({ ...prev, [method.type]: false }));
          }
        }),
      );
      if (!cancelled) setChecking(false);
    })();

    return () => { cancelled = true; };
  }, [enabler, methodKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { availability, checking, instancesRef };
}
