import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (!username || !password || pending) return;
    setError('');
    setPending(true);
    try {
      await login(username, password);
      setPassword('');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">לוח בקרה פיננסי</h1>
          <p className="mt-1 text-sm text-slate-400">הכספים שלך, על השרת שלך.</p>
        </div>

        <div className="space-y-4 rounded-xl bg-slate-800 p-6">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm text-slate-300">
              שם משתמש
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-slate-300">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={pending || !username || !password}
            className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600"
          >
            {pending ? 'מתחבר...' : 'התחברות'}
          </button>
        </div>
      </div>
    </div>
  );
}
