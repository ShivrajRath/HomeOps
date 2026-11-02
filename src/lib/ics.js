import { CATEGORY_BY_VALUE } from './constants';
import { addDays, todayYMD } from './date';
import { FREQUENCY_MAP } from './recurrence';

function icsDate(ymd) {
  return String(ymd).slice(0, 10).replaceAll('-', '');
}

function icsStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Fold content lines at 75 octets as required by RFC 5545. */
function foldLine(line) {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join('\r\n');
}

/** Build a valid RFC 5545 calendar for recurring HomeOps tasks. */
export function buildCalendar(tasks, propertyAddress = 'Home') {
  const stamp = icsStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HomeOps//Home Maintenance Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`HomeOps — ${propertyAddress}`)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const task of tasks) {
    if (!task.nextDueDate) continue;
    const frequency = FREQUENCY_MAP[task.frequency];
    const category = CATEGORY_BY_VALUE[task.category]?.label ?? 'Home';
    const description = [
      task.description,
      `${frequency?.label ?? 'Recurring'} ${category.toLowerCase()} task from HomeOps.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@homeops`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(task.nextDueDate)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(task.nextDueDate, 1))}`,
      `SUMMARY:${escapeText(task.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `CATEGORIES:${escapeText(category)}`,
      'TRANSP:TRANSPARENT',
      'STATUS:CONFIRMED',
    );
    if (frequency?.rrule) lines.push(`RRULE:${frequency.rrule}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** Generate and download an .ics file the user can import anywhere. */
export function downloadCalendar(tasks, propertyAddress = 'Home') {
  const calendar = buildCalendar(tasks, propertyAddress);
  const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `homeops-${todayYMD()}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
