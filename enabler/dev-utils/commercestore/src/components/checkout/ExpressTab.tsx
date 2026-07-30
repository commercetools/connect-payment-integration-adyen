import { useRef, type RefObject } from 'react';
import { useExpressMount } from '../../hooks/useAdyenMount.ts';
import type { EnablerInstance } from '../../types.ts';

const EXPRESS_TYPES = [
  { type: 'applepay', label: 'Apple Pay' },
  { type: 'googlepay', label: 'Google Pay' },
  { type: 'paypal', label: 'PayPal' },
];

interface ExpressTabProps {
  enabler: EnablerInstance;
}

export default function ExpressTab({ enabler }: ExpressTabProps) {
  const applePayRef = useRef<HTMLDivElement>(null);
  const googlePayRef = useRef<HTMLDivElement>(null);
  const paypalRef = useRef<HTMLDivElement>(null);

  const refs: Record<string, RefObject<HTMLElement>> = {
    applepay: applePayRef as RefObject<HTMLElement>,
    googlepay: googlePayRef as RefObject<HTMLElement>,
    paypal: paypalRef as RefObject<HTMLElement>,
  };
  useExpressMount(enabler, refs);

  const refMap: Record<string, RefObject<HTMLDivElement>> = { applepay: applePayRef, googlepay: googlePayRef, paypal: paypalRef };

  return (
    <div className="cs-express-tab">
      <p className="cs-express-intro">
        Express checkout methods handle the complete payment flow, including address collection.
      </p>
      <div className="cs-express-grid">
        {EXPRESS_TYPES.map(({ type, label }) => (
          <div key={type} className="cs-express-slot">
            <div className="cs-express-slot-label">{label}</div>
            <div ref={refMap[type]} className="cs-express-mount" />
          </div>
        ))}
      </div>
    </div>
  );
}
