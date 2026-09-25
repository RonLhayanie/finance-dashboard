import { useState } from 'react';
import { resendVerification } from '../api/client';
import { authInputClass } from './AuthCard';

// With a known email (login page) it's just a button; without one (expired
// link on /verify-email) it asks for the address first.
export default function ResendVerification({ email: knownEmail }) {
  const [email, setEmail] = useState(knownEmail || '');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleResend(e) {
    e.preventDefault();
    if (!email.trim() || status === 'pending') return;
    setError('');
    setStatus('pending');
    try {
      await resendVerification(email);
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <p className="text-center text-sm text-[var(--color-text-muted)]">
        אם הכתובת שייכת לחשבון שטרם אומת, נשלח אליה קישור אימות חדש.
      </p>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3">
      {!knownEmail && (
        <input
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="אימייל"
          aria-label="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
      )}
      {error && <div className="text-sm text-[var(--color-expense)]">{error}</div>}
      <button
        type="submit"
        disabled={status === 'pending' || !email.trim()}
        className="w-full cursor-pointer rounded-lg border border-[var(--color-accent)] py-2 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'pending' ? 'שולח...' : 'שליחת מייל אימות מחדש'}
      </button>
    </form>
  );
}
