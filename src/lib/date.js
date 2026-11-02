const MS_PER_DAY = 86_400_000;

/** Convert a Date to a local YYYY-MM-DD string. */
export function toYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayYMD() {
  return toYMD(new Date());
}

/**
 * Parse YYYY-MM-DD as local noon. Noon avoids DST edge cases that can
 * shift a midnight date into the previous day.
 */
export function fromYMD(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(ymd, days) {
  const date = fromYMD(ymd);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

/** Calendar-month addition with end-of-month clamping (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(ymd, months) {
  const base = fromYMD(ymd);
  if (!base) return null;
  const day = base.getDate();
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(day, lastDay));
  return toYMD(target);
}

/** Whole-day difference: positive when `target` is after `reference`. */
export function dayDiff(target, reference) {
  const a = String(target).slice(0, 10).split('-').map(Number);
  const b = String(reference).slice(0, 10).split('-').map(Number);
  if (a.length !== 3 || b.length !== 3) return 0;
  return Math.round(
    (Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / MS_PER_DAY,
  );
}

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '—';
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? fromYMD(value)
      : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatShort(value) {
  return formatDate(value, { month: 'short', day: 'numeric' });
}

export function formatLongDate(value = new Date()) {
  return formatDate(value, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDateTime(value) {
  return formatDate(value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeDue(ymd) {
  const delta = dayDiff(ymd, todayYMD());
  if (delta < -1) return `${Math.abs(delta)} days overdue`;
  if (delta === -1) return 'Yesterday';
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta <= 13) return `In ${delta} days`;
  return formatShort(ymd);
}

export function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
