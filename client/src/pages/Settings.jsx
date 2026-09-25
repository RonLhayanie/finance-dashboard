import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, deleteMyAccount } from '../api/client';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm text-[var(--color-text)] transition-colors focus:outline-none focus:border-[var(--color-accent)]';
const inputStyle = { backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' };
const primaryButton =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton =
  'rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50';

function Section({ title, children, danger }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: danger ? '0.5px solid var(--color-expense)' : undefined,
      }}
    >
      <h3
        className={`mb-4 text-sm font-medium ${danger ? 'text-[var(--color-expense)]' : 'text-[var(--color-text-muted)]'}`}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Status({ status }) {
  if (!status) return null;
  const color = status.ok ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]';
  return <p className={`text-sm ${color}`}>{status.text}</p>;
}

// Runs a request with pending state and turns the result into a status line.
function useAction() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(null);
  async function run(fn) {
    setPending(true);
    setStatus(null);
    try {
      return await fn();
    } catch (err) {
      setStatus({ ok: false, text: err.message });
      return null;
    } finally {
      setPending(false);
    }
  }
  return { pending, status, setStatus, run };
}

function ProfileSection({ profile, onSaved }) {
  const [firstName, setFirstName] = useState(profile.first_name || '');
  const [lastName, setLastName] = useState(profile.last_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const details = useAction();

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const email = useAction();

  async function saveDetails(e) {
    e.preventDefault();
    // Older accounts may have no last name yet; don't block saving other fields on it.
    const fields = { first_name: firstName, phone };
    if (lastName.trim() || profile.last_name) fields.last_name = lastName;
    const data = await details.run(() => updateProfile(fields));
    if (data) {
      onSaved(data.profile);
      details.setStatus({ ok: true, text: 'הפרטים נשמרו' });
    }
  }

  async function saveEmail(e) {
    e.preventDefault();
    const data = await email.run(() => updateProfile({ email: newEmail, currentPassword: emailPassword }));
    if (!data) return;
    onSaved(data.profile);
    setEditingEmail(false);
    setNewEmail('');
    setEmailPassword('');
    if (!data.message) {
      email.setStatus({ ok: true, text: 'כתובת האימייל לא השתנתה' });
    } else if (data.emailSent === false) {
      email.setStatus({
        ok: false,
        text: 'האימייל עודכן, אך ייתכן שמייל האימות לא נשלח. יש לאמת את הכתובת החדשה לפני ההתחברות הבאה (אפשר לבקש קישור חדש ממסך ההתחברות).',
      });
    } else {
      email.setStatus({ ok: true, text: 'האימייל עודכן. שלחנו קישור אימות לכתובת החדשה - יש לאמת אותה לפני ההתחברות הבאה.' });
    }
  }

  return (
    <Section title="פרופיל">
      <form onSubmit={saveDetails} className="space-y-3">
        <Field label="שם פרטי">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="שם משפחה">
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="טלפון">
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Status status={details.status} />
        <button type="submit" disabled={details.pending} className={primaryButton}>
          {details.pending ? 'שומר...' : 'שמירה'}
        </button>
      </form>

      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <Field label="אימייל">
          <div className="flex items-center gap-2">
            <input value={profile.email || ''} dir="ltr" disabled className={`${inputClass} opacity-60`} style={inputStyle} />
            {!editingEmail && (
              <button type="button" onClick={() => setEditingEmail(true)} className={secondaryButton}>
                שינוי
              </button>
            )}
          </div>
        </Field>
        {editingEmail && (
          <form onSubmit={saveEmail} className="mt-3 space-y-3">
            <Field label="אימייל חדש">
              <input
                type="email"
                dir="ltr"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="סיסמה נוכחית">
              <input
                type="password"
                autoComplete="current-password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={email.pending || !newEmail || !emailPassword} className={primaryButton}>
                {email.pending ? 'שומר...' : 'עדכון אימייל'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingEmail(false);
                  email.setStatus(null);
                }}
                className={secondaryButton}
              >
                ביטול
              </button>
            </div>
          </form>
        )}
        <div className="mt-3">
          <Status status={email.status} />
        </div>
      </div>
    </Section>
  );
}

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const action = useAction();

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      action.setStatus({ ok: false, text: 'הסיסמאות אינן תואמות' });
      return;
    }
    const data = await action.run(() => updateProfile({ currentPassword, newPassword, newPasswordConfirm }));
    if (data) {
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      action.setStatus({ ok: true, text: 'הסיסמה עודכנה' });
    }
  }

  const fields = [
    ['סיסמה נוכחית', currentPassword, setCurrentPassword, 'current-password'],
    ['סיסמה חדשה', newPassword, setNewPassword, 'new-password'],
    ['אימות סיסמה חדשה', newPasswordConfirm, setNewPasswordConfirm, 'new-password'],
  ];

  return (
    <Section title="אבטחה">
      <form onSubmit={handleSubmit} className="space-y-3">
        {fields.map(([label, value, setValue, autoComplete]) => (
          <Field key={label} label={label}>
            <input
              type="password"
              autoComplete={autoComplete}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        ))}
        <Status status={action.status} />
        <button
          type="submit"
          disabled={action.pending || !currentPassword || !newPassword || !newPasswordConfirm}
          className={primaryButton}
        >
          {action.pending ? 'מעדכן...' : 'שינוי סיסמה'}
        </button>
      </form>
    </Section>
  );
}

function DataSection() {
  return (
    <Section title="נתונים">
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">
        הורדת כל הנתונים שלך (פרופיל, חשבונות, תנועות ומנויים) כקובץ JSON. פרטי ההתחברות לבנק אינם נכללים.
      </p>
      {/* Plain link: the session cookie goes along and the server's Content-Disposition triggers the download. */}
      <a href="/api/user/export" download className={`inline-block ${secondaryButton}`}>
        ייצוא הנתונים שלי
      </a>
    </Section>
  );
}

function DangerSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const action = useAction();

  async function handleDelete(e) {
    e.preventDefault();
    const data = await action.run(() => deleteMyAccount(password));
    if (data) {
      await logout();
      navigate('/login', { replace: true });
    }
  }

  return (
    <Section title="אזור מסוכן" danger>
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">
        מחיקת החשבון תמחק לצמיתות את כל החשבונות, התנועות והמנויים שלך. לא ניתן לבטל פעולה זו.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-expense)] transition-colors hover:bg-[var(--color-expense-bg)]"
        >
          מחיקת החשבון שלי
        </button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-3">
          <Field label="סיסמה נוכחית לאישור">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Status status={action.status} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={action.pending || !password}
              className="rounded-lg bg-[var(--color-expense)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.pending ? 'מוחק...' : 'מחיקה לצמיתות'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setPassword('');
                action.setStatus(null);
              }}
              className={secondaryButton}
            >
              ביטול
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-text)]">הגדרות</h2>
      {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      {profile && (
        <>
          <ProfileSection profile={profile} onSaved={setProfile} />
          <SecuritySection />
          <DataSection />
          <DangerSection />
        </>
      )}
    </div>
  );
}
