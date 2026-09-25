import { useState } from 'react';
import { signup } from '../api/client';
import AuthCard, { authInputClass } from '../components/AuthCard';
import ResendVerification from '../components/ResendVerification';

const FIELDS = [
  { name: 'firstName', label: 'שם פרטי', type: 'text', autoComplete: 'given-name' },
  { name: 'username', label: 'שם משתמש', type: 'text', autoComplete: 'username' },
  { name: 'email', label: 'אימייל', type: 'email', autoComplete: 'email', dir: 'ltr' },
  { name: 'phone', label: 'טלפון', type: 'tel', autoComplete: 'tel', dir: 'ltr' },
  { name: 'password', label: 'סיסמה', type: 'password', autoComplete: 'new-password' },
  { name: 'passwordConfirm', label: 'אימות סיסמה', type: 'password', autoComplete: 'new-password' },
];

const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.name, '']));

export default function Signup() {
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailFailed, setEmailFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pending) return;
    if (values.password !== values.passwordConfirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    setError('');
    setPending(true);
    try {
      const data = await signup(values);
      // Matches the wording of signup's email-failure message in server/src/routes/auth.js.
      setEmailFailed(Boolean(data?.message?.includes('may not have arrived')));
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (success && emailFailed) {
    return (
      <AuthCard title="החשבון נוצר">
        <p className="mb-4 text-center text-sm text-[var(--color-text-muted)]">
          ייתכן שמייל האימות לא נשלח אל <span dir="ltr" className="text-[var(--color-text)]">{values.email}</span>. ניתן
          לבקש קישור אימות חדש:
        </p>
        <ResendVerification email={values.email} />
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard title="נשלח מייל אימות">
        <p className="text-center text-sm text-[var(--color-text-muted)]">
          שלחנו קישור אימות אל <span dir="ltr" className="text-[var(--color-text)]">{values.email}</span>. יש ללחוץ על
          הקישור שבמייל כדי להשלים את ההרשמה.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="הרשמה">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name} className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
              {f.label}
            </label>
            <input
              id={f.name}
              type={f.type}
              dir={f.dir}
              autoComplete={f.autoComplete}
              value={values[f.name]}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className={authInputClass}
            />
          </div>
        ))}

        {error && <div className="text-sm text-[var(--color-expense)]">{error}</div>}

        <button
          type="submit"
          disabled={pending}
          className="w-full cursor-pointer rounded-lg bg-[var(--color-accent)] py-2 font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'נרשם...' : 'הרשמה'}
        </button>
      </form>
    </AuthCard>
  );
}
