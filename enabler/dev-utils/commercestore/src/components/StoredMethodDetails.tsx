import type { CardDetails, BankDetails } from '../types.ts';

/**
 * Renders a card's brand badge, last four digits, and expiry. Nothing here reads bank fields —
 * callers pick this or BankInfo based on which detail object the stored method actually has.
 */
export function CardInfo({ cardDetails }: { cardDetails: CardDetails }) {
  const brand = cardDetails.brand?.key ?? '';
  const showBrandBadge = brand && brand !== 'Unknown';
  const exp = cardDetails.expiryMonth && cardDetails.expiryYear
    ? `${String(cardDetails.expiryMonth).padStart(2, '0')}/${String(cardDetails.expiryYear).slice(-2)}`
    : null;

  return (
    <>
      {showBrandBadge && <span className={`cs-saved-card__brand cs-saved-card__brand--${brand.toLowerCase()}`}>{brand}</span>}
      {cardDetails.endDigits && <span className="cs-saved-card__number">•••• {cardDetails.endDigits}</span>}
      {exp && <span className="cs-saved-card__exp">{exp}</span>}
    </>
  );
}

/**
 * Renders a bank account's last four IBAN digits, owner name, and issuing bank. endDigits here is
 * never a card PAN — keeping this separate from CardInfo avoids that ambiguity.
 */
export function BankInfo({ bankDetails }: { bankDetails: BankDetails }) {
  return (
    <>
      {bankDetails.endDigits && <span className="cs-saved-card__number">•••• {bankDetails.endDigits}</span>}
      {bankDetails.ownerName && <span className="cs-saved-card__owner">{bankDetails.ownerName}</span>}
      {bankDetails.issuingBank && <span className="cs-saved-card__owner">{bankDetails.issuingBank}</span>}
    </>
  );
}
