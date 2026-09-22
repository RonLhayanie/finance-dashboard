import { useEffect, useRef } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  warning,
  confirmLabel,
  cancelLabel = 'ביטול',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const accentColor = variant === 'danger' ? 'var(--color-expense)' : 'var(--color-accent)';
  const confirmClass =
    variant === 'danger'
      ? 'bg-[var(--color-expense)] text-white hover:opacity-90'
      : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-strong)]';
  // Explicit, not relying on the browser default, so a short trailing word in
  // a long Hebrew phrase never gets forced onto its own line - it wraps at
  // natural word boundaries instead.
  const wrapStyle = { wordBreak: 'normal', overflowWrap: 'break-word' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-in w-full max-w-[460px] rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          borderTopWidth: '3px',
          borderTopColor: accentColor,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-[var(--color-text)]" style={wrapStyle}>
          {title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-[var(--color-text-muted)]" style={wrapStyle}>
          {message}
        </p>
        {warning && (
          <p className="mt-3 text-base font-bold leading-relaxed" style={{ color: 'var(--color-expense)', ...wrapStyle }}>
            {warning}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-lg bg-[var(--color-surface-2)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
