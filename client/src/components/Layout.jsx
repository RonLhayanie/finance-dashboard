import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { SyncStatusProvider, useSyncStatusContext } from '../context/SyncStatusContext';
import { useAuth } from '../context/AuthContext';
import OtpModal from './OtpModal';
import SyncErrorToast from './SyncErrorToast';
import ConfirmModal from './ConfirmModal';

const NAV_ITEMS = [
  { to: '/', label: 'לוח בקרה', end: true },
  { to: '/transactions', label: 'תנועות' },
  { to: '/subscriptions', label: 'מנויים' },
  { to: '/chat', label: 'צ׳אט' },
  { to: '/accounts', label: 'חשבונות' },
];

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function WalletIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" />
      <path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" />
    </svg>
  );
}

function LayoutDashboardIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="4" y="4" width="7" height="8" rx="1" />
      <rect x="4" y="15" width="7" height="5" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="13" width="6" height="7" rx="1" />
    </svg>
  );
}

function ArrowsExchangeIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M16 3l4 4l-4 4" />
      <path d="M10 7l10 0" />
      <path d="M8 13l-4 4l4 4" />
      <path d="M4 17l10 0" />
    </svg>
  );
}

function RepeatIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3" />
      <path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3" />
    </svg>
  );
}

function SparklesIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z" />
    </svg>
  );
}

function BuildingBankIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M3 21l18 0" />
      <path d="M3 10l18 0" />
      <path d="M5 6l7 -3l7 3" />
      <path d="M4 10l0 11" />
      <path d="M20 10l0 11" />
      <path d="M8 14l0 3" />
      <path d="M12 14l0 3" />
      <path d="M16 14l0 3" />
    </svg>
  );
}

const NAV_ICONS = {
  '/': LayoutDashboardIcon,
  '/transactions': ArrowsExchangeIcon,
  '/subscriptions': RepeatIcon,
  '/chat': SparklesIcon,
  '/accounts': BuildingBankIcon,
};

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
    <div
      className="flex items-center justify-end gap-2 px-6 py-3"
      style={{ borderBottom: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
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
  const location = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Remembers the query string last seen while on the dashboard route, so
  // the sidebar link restores its filters (?account=, ?month=) even after
  // navigating away to another page and back - location.search alone only
  // reflects whichever page is currently active, not the dashboard's.
  const [dashboardSearch, setDashboardSearch] = useState(location.pathname === '/' ? location.search : '');

  useEffect(() => {
    if (location.pathname === '/') {
      setDashboardSearch(location.search);
    }
  }, [location.pathname, location.search]);

  return (
    <SyncStatusProvider>
      <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <aside
          className="flex w-56 shrink-0 flex-col p-4"
          style={{ backgroundColor: 'var(--color-surface)', borderInlineStart: '0.5px solid var(--color-border)' }}
        >
          <h1 className="mb-6 flex items-center gap-2 text-lg font-semibold text-[var(--color-accent)]">
            <WalletIcon />
            בקרה פיננסי
          </h1>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = NAV_ICONS[item.to];
              // Only the dashboard link needs its query string preserved -
              // other pages don't carry filter state in the URL.
              const to = item.to === '/' ? { pathname: '/', search: dashboardSearch } : item.to;
              return (
                <NavLink
                  key={item.to}
                  to={to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                    }`
                  }
                >
                  <Icon />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto pt-4">
            <button
              onClick={() => setConfirmLogout(true)}
              className="cursor-pointer text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            >
              התנתקות ({user})
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-[var(--color-bg)] p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <OtpGate />
      <SyncErrorToast />
      <ConfirmModal
        open={confirmLogout}
        title="התנתקות"
        message="האם אתה בטוח שברצונך להתנתק מהחשבון?"
        confirmLabel="התנתק"
        variant="default"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </SyncStatusProvider>
  );
}
