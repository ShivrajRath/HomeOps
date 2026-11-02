import { addDays, addMonths, dayDiff, todayYMD } from './date';

export const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly', rrule: 'FREQ=WEEKLY' },
  { value: 'biweekly', label: 'Every 2 weeks', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { value: 'monthly', label: 'Monthly', rrule: 'FREQ=MONTHLY' },
  { value: 'quarterly', label: 'Every 3 months', rrule: 'FREQ=MONTHLY;INTERVAL=3' },
  { value: 'semiannual', label: 'Every 6 months', rrule: 'FREQ=MONTHLY;INTERVAL=6' },
  { value: 'annual', label: 'Once a year', rrule: 'FREQ=YEARLY' },
];

export const FREQUENCY_MAP = Object.fromEntries(
  FREQUENCIES.map((frequency) => [frequency.value, frequency]),
);

export function frequencyLabel(value) {
  return FREQUENCY_MAP[value]?.label ?? 'Monthly';
}

/** Add one recurrence interval to a YYYY-MM-DD date. */
export function addFrequency(ymd, frequency) {
  switch (frequency) {
    case 'weekly':
      return addDays(ymd, 7);
    case 'biweekly':
      return addDays(ymd, 14);
    case 'monthly':
      return addMonths(ymd, 1);
    case 'quarterly':
      return addMonths(ymd, 3);
    case 'semiannual':
      return addMonths(ymd, 6);
    case 'annual':
      return addMonths(ymd, 12);
    default:
      return addMonths(ymd, 1);
  }
}

/**
 * The next due date after completing a task.
 *
 * If the task was already overdue, the next occurrence is scheduled from
 * today so finishing an old chore doesn't immediately create a new overdue
 * item. If it was completed early, the cadence continues from its due date.
 */
export function nextOccurrence(dueDate, frequency, today = todayYMD()) {
  const reference =
    dueDate && dayDiff(dueDate, today) >= 0 ? String(dueDate).slice(0, 10) : today;
  return addFrequency(reference, frequency);
}
