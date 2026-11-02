import { forwardRef, useEffect, useId } from 'react';
import { Loader2, X } from 'lucide-react';
import { cx } from '../lib/utils';

/* ---------------------------------------------------------------- Button */

const BUTTON_VARIANTS = {
  primary:
    'bg-pine-700 text-white shadow-sm hover:bg-pine-800 focus-visible:ring-pine-500 disabled:hover:bg-pine-700',
  secondary:
    'border border-sand-200 bg-white text-ink shadow-sm hover:border-pine-200 hover:bg-pine-50 focus-visible:ring-pine-500',
  ghost: 'text-ink-muted hover:bg-sand-100 hover:text-ink focus-visible:ring-pine-500',
  danger: 'bg-clay-600 text-white shadow-sm hover:bg-clay-700 focus-visible:ring-clay-500',
  subtle: 'bg-pine-50 text-pine-800 hover:bg-pine-100 focus-visible:ring-pine-500',
};

const BUTTON_SIZES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-11 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-5 text-base',
  icon: 'h-9 w-9 justify-center p-0',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    className,
    loading = false,
    disabled,
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  { label, className, tone = 'default', type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-grid h-8 w-8 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500',
        tone === 'danger'
          ? 'text-ink-soft hover:bg-clay-50 hover:text-clay-700'
          : 'text-ink-soft hover:bg-sand-100 hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/* ----------------------------------------------------------------- Inputs */

const FIELD_BASE =
  'w-full rounded-xl border bg-white px-3.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-soft focus:border-pine-400 focus:ring-2 focus:ring-pine-500/20';

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        FIELD_BASE,
        'h-11',
        invalid ? 'border-clay-300 focus:border-clay-400 focus:ring-clay-500/20' : 'border-sand-200',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        FIELD_BASE,
        'min-h-[96px] resize-y py-3 leading-relaxed',
        invalid ? 'border-clay-300 focus:border-clay-400 focus:ring-clay-500/20' : 'border-sand-200',
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        FIELD_BASE,
        'h-11 cursor-pointer appearance-none bg-[length:16px_16px] bg-[right_0.85rem_center] bg-no-repeat pr-10',
        invalid ? 'border-clay-300 focus:border-clay-400 focus:ring-clay-500/20' : 'border-sand-200',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235b6b62' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({ label, htmlFor, hint, error, className, children, required }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-ink">
          {label}
          {required && <span className="text-clay-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-clay-700">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, description, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <label
      htmlFor={inputId}
      className={cx(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-sand-200 bg-white p-3.5 transition hover:border-pine-200',
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300 accent-pine-700"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>
        )}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------- Containers */

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx('rounded-2xl border border-sand-200/80 bg-white shadow-soft', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', className, children }) {
  const tones = {
    neutral: 'bg-sand-100 text-ink-muted ring-sand-200',
    pine: 'bg-pine-50 text-pine-700 ring-pine-200',
    clay: 'bg-clay-50 text-clay-700 ring-clay-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        tones[tone] ?? tones.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine-700">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-white/50 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-pine-50 text-pine-600">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <Loader2
      className={cx('h-5 w-5 animate-spin text-pine-600', className)}
      aria-hidden="true"
    />
  );
}

export function PageLoader({ label = 'Loading your home…' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-ink-muted">
      <Spinner />
      <p>{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cx(
          'relative z-10 flex max-h-[92vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift sm:rounded-2xl',
          sizes[size] ?? sizes.md,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sand-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-sand-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-sand-100 bg-sand-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
