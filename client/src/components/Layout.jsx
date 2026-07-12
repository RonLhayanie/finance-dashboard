import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SyncStatusProvider, useSyncStatusContext } from '../context/SyncStatusContext';
import { useAuth } from '../context/AuthContext';
import OtpModal from './OtpModal';
import SyncErrorToast from './SyncErrorToast';

const NAV_ITEMS = [
  { to: '/', label: 'לוח בקרה', end: true },
  { to: '/transactions', label: 'תנועות' },
  { to: '/subscriptions', label: 'מנויים' },
  { to: '/chat', label: 'צ׳אט' },
  { to: '/accounts', label: 'חשבונות' },
];

function TopBar() {
  const { isSyncing, needsOtpJob } = useSyncStatusContext();

  let label = 'ממתין';
  let dotClass = 'bg-slate-500';
  if (needsOtpJob) {
    label = 'ממתין לקוד אימות';
    dotClass = 'bg-amber-400';
  } else if (isSyncing) {
    label = 'מסנכרן...';
    dotClass = 'animate-pulse bg-emerald-400';
  }

  return (
    <div className="flex items-center justify-end gap-2 border-b border-slate-800 px-6 py-3">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}

function OtpGate() {
  const { needsOtpJob, refresh } = useSyncStatusContext();
  const [dismissedJobId, setDismissedJobId] = useState(null);

  if (!needsOtpJob || needsOtpJob.id === dismissedJobId) return null;

  return (
    <OtpModal
      job={needsOtpJob}
      onSubmitted={() => {
        setDismissedJobId(null);
        refresh();
      }}
      onCancel={() => setDismissedJobId(needsOtpJob.id)}
    />
  );
}

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <SyncStatusProvider>
      <div className="flex min-h-screen bg-slate-900 text-slate-100">
        <aside className="flex w-56 shrink-0 flex-col border-e border-slate-800 p-4">
          <h1 className="mb-6 text-lg font-semibold text-emerald-400">לוח בקרה פיננסי</h1>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${
                    isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-4">
            <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-200">
              התנתקות ({user})
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <OtpGate />
      <SyncErrorToast />
    </SyncStatusProvider>
  );
}
