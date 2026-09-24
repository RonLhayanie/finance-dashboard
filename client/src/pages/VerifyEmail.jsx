import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/client';
import AuthCard from '../components/AuthCard';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'pending' : 'error');
  const [error, setError] = useState(token ? '' : 'קישור האימות חסר או שגוי');
  // Tokens are single-use. StrictMode runs effects twice in dev, and the
  // second call would get "already used" - so call exactly once per mount.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [token]);

  if (status === 'pending') {
    return (
      <AuthCard title="מאמת את כתובת האימייל...">
        <div className="flex justify-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </div>
      </AuthCard>
    );
  }

  if (status === 'success') {
    return (
      <AuthCard title="האימייל אומת בהצלחה">
        <p className="text-center text-sm text-[var(--color-text-muted)]">כתובת האימייל שלך אומתה.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="האימות נכשל">
      <p className="text-center text-sm text-[var(--color-expense)]">{error}</p>
    </AuthCard>
  );
}
