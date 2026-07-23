import { useEffect, useState, type RefObject } from 'react';
import type { EnablerInstance, MountableComponent, DropinBuildOptions } from '../types.ts';

export function useAdyenMount(
  component: MountableComponent | null | undefined,
  containerRef: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    if (!component || !containerRef.current) return;

    containerRef.current.innerHTML = '';
    component.mount(containerRef.current);

    return () => {
      try { component.unmount?.(); } catch (_) {}
    };
  }, [component]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useDropinMount(
  enabler: EnablerInstance | null,
  containerRef: RefObject<HTMLElement>,
  options: DropinBuildOptions = {},
): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!enabler || !containerRef.current) return;
    let cancelled = false;
    let instance: MountableComponent | null = null;
    let patchedCheckout: any = null;
    let origStoreElementReference: ((comp: any) => void) | null = null;
    setMounted(false);

    (async () => {
      try {
        const builder = await enabler.createDropinBuilder('embedded');
        if (cancelled) return;
        const dropin = builder.build(options);
        if (cancelled) return;
        dropin.mount(containerRef.current!);
        instance = dropin;

        // Adyen's giftcard split-payment flow calls checkout.update({ order }) which runs
        // components.forEach(e => e.update(o)). Dropin payment-method UIElements are rendered
        // as Preact sub-components and never get mount() called explicitly, so their _node is
        // null. update() does unmount().mount(this._node) → throws "Root node was not found".
        // Fix: wrap update() to be a no-op when _node is null, on both existing and future components.
        const checkout = (dropin as any).adyenCheckout;
        if (checkout) {
          const wrapUpdate = (comp: any) => {
            if (comp && typeof comp.update === 'function' && !comp.__cs_updateGuarded) {
              const origCompUpdate = comp.update.bind(comp);
              comp.update = function(this: any, ...args: any[]) {
                if (!this._node) return this;
                return origCompUpdate.apply(this, args);
              };
              comp.__cs_updateGuarded = true;
            }
          };
          // Patch existing components (already in the registry with _node=null)
          if (Array.isArray(checkout.components)) {
            checkout.components.forEach(wrapUpdate);
          }
          // Patch future components registered via storeElementReference
          if (typeof checkout.storeElementReference === 'function') {
            origStoreElementReference = checkout.storeElementReference.bind(checkout);
            patchedCheckout = checkout;
            checkout.storeElementReference = function(comp: any) {
              wrapUpdate(comp);
              origStoreElementReference!(comp);
            };
          }
        }

        setMounted(true);
      } catch (e) {
        console.error('Failed to mount dropin:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (patchedCheckout && origStoreElementReference) {
        patchedCheckout.storeElementReference = origStoreElementReference;
      }
      try { instance?.unmount?.(); } catch (_) {}
    };
  }, [enabler]); // eslint-disable-line react-hooks/exhaustive-deps

  return mounted;
}

export function useExpressMount(
  enabler: EnablerInstance | null,
  refs: Record<string, RefObject<HTMLElement>>,
): void {
  useEffect(() => {
    if (!enabler) return;
    let cancelled = false;
    const instances: MountableComponent[] = [];

    const mount = async (type: string, ref: RefObject<HTMLElement>) => {
      if (!ref.current) return;
      try {
        const builder = await enabler.createExpressBuilder(type);
        if (cancelled) return;
        const component = (builder as { build(c: unknown): MountableComponent }).build({});
        if (cancelled) return;
        component.mount(ref.current);
        instances.push(component);
      } catch (e) {
        console.warn(`Express ${type} not available:`, (e as Error).message);
      }
    };

    (async () => {
      await Promise.all(
        Object.entries(refs).map(([type, ref]) => mount(type, ref))
      );
    })();

    return () => {
      cancelled = true;
      instances.forEach(i => { try { i.unmount?.(); } catch (_) {} });
    };
  }, [enabler]); // eslint-disable-line react-hooks/exhaustive-deps
}
