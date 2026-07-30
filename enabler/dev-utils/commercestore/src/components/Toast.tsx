import type { Toast } from '../types.ts';

const ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: number) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  return (
    <div className={`cs-toast cs-toast--${toast.type}`}>
      <span className="cs-toast-icon">{ICONS[toast.type]}</span>
      <span className="cs-toast-message">{toast.message}</span>
      <button className="cs-toast-close" onClick={() => onRemove(toast.id)}>×</button>
    </div>
  );
}

interface ToastProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (!toasts.length) return null;
  return (
    <div className="cs-toast-container">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}
