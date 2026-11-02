import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Logo from '../components/Logo';
import { Card } from '../components/ui';
import { isGoogleConfigured } from '../lib/syncService';
import { useAuthStore } from '../store/useAuthStore';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.65 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function AuthPage() {
  const session = useAuthStore((state) => state.session);
  const busy = useAuthStore((state) => state.busy);
  const error = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);
  const configured = isGoogleConfigured();

  const [opening, setOpening] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const handleSignIn = async () => {
    setOpening(true);
    try {
      await signIn();
    } catch {
      // The store exposes the message below the button.
    } finally {
      setOpening(false);
    }
  };

  const working = busy || opening;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-pine-900 p-10 text-sand-50 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-clay-400/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-white/10" />

        <Logo variant="dark" showTagline />

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pine-200/80">
            A calmer home
          </p>
          <blockquote className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-balance xl:text-[2.8rem]">
            “A calm home is a hundred small things, finished on time.”
          </blockquote>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-pine-100/85">
            One plan for cleaning, maintenance, and the paper trail of owning a place. Local-first,
            with a quiet backup in your own Google Drive.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-pine-100/90">
            {[
              'A maintenance plan generated from your home profile',
              'Bills, warranties, and invoices filed in your Drive',
              'Room photos and floor plans you can actually find',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-pine-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-pine-100/80">
          <Cloud size={14} className="shrink-0 text-pine-300" />
          <span className="truncate">
            Local-first · backed up to{' '}
            <span className="font-medium text-sand-50">your Google Drive</span>
          </span>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo showTagline />
          </div>

          <Card className="p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine-700">
              Your account
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              Welcome home.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Sign in with Google to open your plan. Everything is saved on this device first,
              then backed up to a private app folder in your Drive.
            </p>

            {!configured && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>
                  Google sign-in is not configured yet. Add{' '}
                  <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[10px]">
                    VITE_GOOGLE_CLIENT_ID
                  </code>{' '}
                  to <code className="font-mono text-[10px]">.env</code> and restart the dev
                  server. The README walks through the Google Cloud console.
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs leading-relaxed text-clay-800"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={working || !configured}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-sand-300 bg-white px-5 text-sm font-medium text-ink shadow-sm transition hover:border-pine-200 hover:bg-pine-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? <Loader2 size={17} className="animate-spin text-pine-600" /> : <GoogleIcon />}
              {working ? 'Connecting to Google…' : 'Sign in with Google'}
            </button>

            <div className="mt-6 space-y-3 border-t border-sand-100 pt-5">
              {[
                {
                  icon: Database,
                  title: 'Your browser is the database',
                  body: 'IndexedDB keeps every task, room, and record available offline.',
                },
                {
                  icon: HardDrive,
                  title: 'Your Drive holds the backup',
                  body: 'One small basekeep_backup.json lives in a hidden app folder; uploads go to a HomeOps folder.',
                },
                {
                  icon: Sparkles,
                  title: 'Nothing passes through a developer',
                  body: 'There is no HomeOps server, shared database, or subscription.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine-700">
                    <item.icon size={15} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-xl bg-sand-100/70 px-3.5 py-3 text-[11px] leading-relaxed text-ink-muted">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-pine-700" />
              HomeOps requests only the Drive permissions it needs. It never sees your Google
              password, and you can revoke access from your Google Account at any time.
            </p>
          </Card>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-soft">
            Google Drive access: app data folder (backup) and files created by HomeOps.
          </p>
        </div>
      </main>
    </div>
  );
}
