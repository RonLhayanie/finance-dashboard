import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { SyncStatusProvider, useSyncStatusContext } from '../context/SyncStatusContext';
import { useAuth } from '../context/AuthContext';
import OtpModal from './OtpModal';
import SyncErrorToast from './SyncErrorToast';
import ConfirmModal from './ConfirmModal';
import logo from '../assets/logo/logo-dark-bg.svg';

const NAV_ITEMS = [
  { to: '/', label: 'לוח בקרה', end: true },
  { to: '/transactions', label: 'תנועות' },
  { to: '/subscriptions', label: 'מנויים' },
  { to: '/chat', label: 'צ׳אט' },
  { to: '/accounts', label: 'חשבונות' },
  { to: '/settings', label: 'הגדרות' },
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

function SettingsIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </svg>
  );
}

const NAV_ICONS = {
  '/': LayoutDashboardIcon,
  '/transactions': ArrowsExchangeIcon,
  '/subscriptions': RepeatIcon,
  '/chat': SparklesIcon,
  '/accounts': BuildingBankIcon,
  '/settings': SettingsIcon,
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
      <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <aside
          className="sticky top-0 flex h-full w-56 shrink-0 flex-col overflow-hidden p-4"
          style={{ backgroundColor: 'var(--color-surface)', borderInlineStart: '0.5px solid var(--color-border)' }}
        >
          <img src={logo} alt="Dashboard" className="mx-auto mb-6 w-40 h-auto py-2" />
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
              התנתקות ({user.firstName || user.email})
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
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
