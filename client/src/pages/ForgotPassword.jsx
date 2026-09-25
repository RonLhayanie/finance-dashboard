import { useState } from 'react';
import { forgotPassword } from '../api/client';
import AuthCard, { authInputClass } from '../components/AuthCard';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || pending) return;
    setError('');
    setPending(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="בדוק את תיבת הדואר">
        <p className="text-center text-sm text-[var(--color-text-muted)]">
          אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה. הקישור בתוקף לשעה.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="שכחתי סיסמה">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
            אימייל
          </label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>

        {error && <div className="text-sm text-[var(--color-expense)]">{error}</div>}

        <button
          type="submit"
          disabled={pending || !email.trim()}
          className="w-full cursor-pointer rounded-lg bg-[var(--color-accent)] py-2 font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'שולח...' : 'שליחת קישור איפוס'}
        </button>
      </form>
    </AuthCard>
  );
}
