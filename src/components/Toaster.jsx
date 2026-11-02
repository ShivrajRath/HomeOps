import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useUiStore } from '../store/useUiStore';
import { cx } from '../lib/utils';

const TONES = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-pine-600',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-clay-600',
  },
  info: {
    icon: Info,
    iconClass: 'text-ink-muted',
  },
};

export default function Toaster() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.type] ?? TONES.info;
        const Icon = tone.icon;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink shadow-lift animate-slide-up"
          >
            <Icon size={17} className={cx('mt-0.5 shrink-0', tone.iconClass)} aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-sand-100 hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
