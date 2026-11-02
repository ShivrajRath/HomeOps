import { Home } from 'lucide-react';
import { cx } from '../lib/utils';

export default function Logo({ variant = 'light', showTagline = false, className }) {
  const dark = variant === 'dark';
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <span
        className={cx(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
          dark ? 'bg-white/10 text-sand-50 ring-1 ring-white/15' : 'bg-pine-700 text-sand-50',
        )}
      >
        <Home size={18} aria-hidden="true" />
      </span>
      <div>
        <p
          className={cx(
            'font-display text-lg font-semibold leading-none tracking-tight',
            dark ? 'text-sand-50' : 'text-ink',
          )}
        >
          HomeOps
        </p>
        {showTagline && (
          <p className={cx('mt-1 text-[11px]', dark ? 'text-pine-200/80' : 'text-ink-soft')}>
            A calmer home
          </p>
        )}
      </div>
    </div>
  );
}
