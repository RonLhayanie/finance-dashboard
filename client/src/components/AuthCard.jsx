import ledgerlyLogo from '../assets/logo/ledgerly-logo-dark-bg.svg';

// Same card look as the login page, for the public signup/verify pages.
export const authInputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]';

export default function AuthCard({ title, children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-bg)] px-4 py-10">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(127,119,221,0.25) 0%, rgba(127,119,221,0) 70%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-surface)]/72 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="mb-6 text-center">
          <img src={ledgerlyLogo} alt="Ledgerly" className="mx-auto h-auto w-56" />
          <h1 className="mt-3 text-lg font-semibold text-[var(--color-text)]">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
