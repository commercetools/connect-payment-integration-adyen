import { useRef, useCallback, useState, type RefObject } from 'react';
import { useDropinMount } from '../../hooks/useAdyenMount.ts';
import Spinner from '../Spinner.tsx';
import type { EnablerInstance } from '../../types.ts';

interface DropinTabProps {
  enabler: EnablerInstance;
  onError: (msg: string) => void;
}

export default function DropinTab({ enabler, onError }: DropinTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termsAcceptedRef = useRef(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsError, setTermsError] = useState(false);

  // Updated every render so the stable callback below always runs the latest logic
  const onPayButtonClickImpl = useRef<() => Promise<void>>();
  onPayButtonClickImpl.current = async () => {
    if (!termsAcceptedRef.current) {
      setTermsError(true);
      onError('Please accept the terms and conditions.');
      throw new Error('terms_not_accepted');
    }
  };

  // Stable: captured once by the dropin at build time, delegates to latest impl above
  const onPayButtonClick = useCallback(() => onPayButtonClickImpl.current!(), []);

  const mounted = useDropinMount(enabler, containerRef as RefObject<HTMLElement>, { onPayButtonClick });

  const handleTermsChange = (checked: boolean) => {
    termsAcceptedRef.current = checked;
    setTermsChecked(checked);
    if (checked) setTermsError(false);
  };

  return (
    <div className="cs-dropin-tab">
      {!mounted && <Spinner text="Loading drop-in..." />}
      <div ref={containerRef} className="cs-dropin-mount" />
      {mounted && (
        <div className="cs-pay-area">
          <label className={`cs-terms ${termsError ? 'cs-terms--error' : ''}`}>
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={e => handleTermsChange(e.target.checked)}
            />
            I agree to the <a href="#">terms and conditions</a>
          </label>
        </div>
      )}
    </div>
  );
}
