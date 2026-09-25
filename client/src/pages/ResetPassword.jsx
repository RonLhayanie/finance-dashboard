import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/client';
import AuthCard, { authInputClass } from '../components/AuthCard';

const linkClass = 'text-sm text-[var(--color-accent)] hover:underline';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pending) return;
    if (newPassword !== newPasswordConfirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    setError('');
    setPending(true);
    try {
      await resetPassword({ token, newPassword, newPasswordConfirm });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="איפוס סיסמה">
        <p className="text-center text-sm text-[var(--color-expense)]">קישור האיפוס חסר או שגוי</p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="הסיסמה עודכנה">
        <p className="text-center text-sm text-[var(--color-text-muted)]">
          הסיסמה שלך עודכנה בהצלחה.{' '}
          <Link to="/login" className={linkClass}>
            מעבר להתחברות
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="איפוס סיסמה">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="newPassword" className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
            סיסמה חדשה
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="newPasswordConfirm" className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
            אימות סיסמה חדשה
          </label>
          <input
            id="newPasswordConfirm"
            type="password"
            autoComplete="new-password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            className={authInputClass}
          />
        </div>

        {error && <div className="text-sm text-[var(--color-expense)]">{error}</div>}

        <button
          type="submit"
          disabled={pending || !newPassword || !newPasswordConfirm}
          className="w-full cursor-pointer rounded-lg bg-[var(--color-accent)] py-2 font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'מעדכן...' : 'עדכון סיסמה'}
        </button>
      </form>
    </AuthCard>
  );
}
