import { useState } from 'react';
import { submitOtp } from '../api/client';

export default function OtpModal({ job, onSubmitted, onCancel }) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const valid = /^\d{4,8}$/.test(code);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid || pending) return;

    setPending(true);
    setError('');
    try {
      await submitOtp(job.id, code);
      setCode('');
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-slate-100">הזנת קוד אימות</h2>
        <p className="mb-4 text-sm text-slate-400">
          הבנק שלח קוד לאישור בהודעת SMS כדי להמשיך את הסנכרון של חשבון {job.account_id}.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="123456"
            className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-center text-lg tracking-widest text-slate-100 outline-none focus:border-emerald-500"
          />

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!valid || pending}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'שולח...' : 'שליחה'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
