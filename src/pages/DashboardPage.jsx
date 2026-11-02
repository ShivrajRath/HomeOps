import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Check,
  Clock,
  FileText,
  FolderLock,
  LayoutGrid,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '../components/ui';
import {
  CATEGORY_BY_VALUE,
  HVAC_TYPES,
  SEASONAL_TIPS,
  WATER_HEATER_TYPES,
  labelFor,
  seasonForMonth,
} from '../lib/constants';
import {
  dayDiff,
  formatDate,
  formatLongDate,
  greetingForHour,
  relativeDue,
  relativeTime,
  todayYMD,
} from '../lib/date';
import { completeTask, db, getPrimaryProperty } from '../lib/db';
import { downloadCalendar } from '../lib/ics';
import { frequencyLabel } from '../lib/recurrence';
import { cx } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

function StatCard({ to, label, value, hint, icon: Icon, tone }) {
  const tones = {
    clay: 'bg-clay-50 text-clay-700',
    pine: 'bg-pine-50 text-pine-700',
    sand: 'bg-sand-100 text-ink-muted',
  };
  return (
    <Link
      to={to}
      className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50"
    >
      <Card className="h-full p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-pine-200 group-hover:shadow-lift sm:p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <span className={cx('grid h-8 w-8 place-items-center rounded-lg', tones[tone] ?? tones.sand)}>
            <Icon size={16} />
          </span>
        </div>
        <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{value}</p>
        <p className="mt-1 text-[11px] text-ink-soft">{hint}</p>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const tasks =
    useLiveQuery(() => db.tasks.orderBy('nextDueDate').toArray(), []) ?? [];
  const documents =
    useLiveQuery(() => db.documents.orderBy('uploadedAt').reverse().toArray(), []) ?? [];
  const rooms = useLiveQuery(() => db.rooms.toArray(), []) ?? [];

  const pushToast = useUiStore((state) => state.pushToast);
  const navigate = useNavigate();

  const [busyId, setBusyId] = useState(null);
  const today = todayYMD();

  const activeTasks = tasks.filter((task) => task.status === 'active');
  const overdue = activeTasks.filter((task) => dayDiff(task.nextDueDate, today) < 0);
  const thisWeek = activeTasks.filter((task) => {
    const delta = dayDiff(task.nextDueDate, today);
    return delta >= 0 && delta <= 7;
  });
  const nextUp = [...overdue, ...thisWeek]
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 6);
  const later = activeTasks
    .filter((task) => dayDiff(task.nextDueDate, today) > 7)
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 4);

  const season = SEASONAL_TIPS[seasonForMonth(new Date().getMonth())];

  const handleComplete = async (task) => {
    setBusyId(task.id);
    try {
      const updated = await completeTask(task);
      pushToast(`Done. “${task.title}” is next due ${formatDate(updated.nextDueDate)}.`);
    } catch (error) {
      pushToast(error.message || 'Could not complete that task.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    if (activeTasks.length === 0) {
      pushToast('There are no active tasks to export yet.', 'info');
      return;
    }
    downloadCalendar(activeTasks, property?.address ?? 'Home');
    pushToast(`Calendar file ready with ${activeTasks.length} recurring tasks.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow={formatLongDate()}
        title={`${greetingForHour()}.`}
        description={
          property
            ? `Here’s what ${property.address} needs next, and what can wait.`
            : 'Here’s what your home needs next.'
        }
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 text-sm font-medium text-ink shadow-sm transition hover:border-pine-200 hover:bg-pine-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 focus-visible:ring-offset-2"
            >
              <CalendarDays size={16} /> Export .ics
            </button>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-pine-700 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-pine-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 focus-visible:ring-offset-2"
            >
              <Plus size={16} /> Open task plan
            </button>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          to="/tasks"
          label="Overdue"
          value={overdue.length}
          hint={overdue.length ? 'Needs a little attention' : 'All caught up'}
          icon={Clock}
          tone={overdue.length ? 'clay' : 'pine'}
        />
        <StatCard
          to="/tasks"
          label="Next 7 days"
          value={thisWeek.length}
          hint="On the near horizon"
          icon={CalendarDays}
          tone="pine"
        />
        <StatCard
          to="/documents"
          label="Documents"
          value={documents.length}
          hint="Filed in your Drive vault"
          icon={FolderLock}
          tone="sand"
        />
        <StatCard
          to="/rooms"
          label="Spaces"
          value={rooms.length}
          hint="Rooms and floor plans"
          icon={LayoutGrid}
          tone="sand"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-sand-100 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Next up</h2>
                <p className="mt-0.5 text-xs text-ink-soft">Overdue and due in the next 7 days.</p>
              </div>
              <Link
                to="/tasks"
                className="text-xs font-medium text-pine-700 underline-offset-2 hover:text-pine-800 hover:underline"
              >
                View plan
              </Link>
            </div>

            {nextUp.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  icon={Check}
                  title="Nothing pressing"
                  description="No overdue tasks and nothing due for the next seven days. Enjoy the breathing room."
                  className="border-0 bg-transparent py-4"
                  action={
                    <Link
                      to="/tasks"
                      className="text-sm font-medium text-pine-700 underline-offset-2 hover:underline"
                    >
                      Browse the full plan
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-sand-100 px-5">
                {nextUp.map((task) => {
                  const isOverdue = dayDiff(task.nextDueDate, today) < 0;
                  const category = CATEGORY_BY_VALUE[task.category];
                  return (
                    <li key={task.id} className="flex items-center gap-3 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleComplete(task)}
                        disabled={busyId === task.id}
                        aria-label={`Mark ${task.title} complete`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-sand-300 text-transparent transition hover:border-pine-500 hover:bg-pine-50 hover:text-pine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 disabled:opacity-50"
                      >
                        {busyId === task.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Check size={13} strokeWidth={2.5} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-soft">
                          <span className={isOverdue ? 'font-medium text-clay-700' : ''}>
                            {relativeDue(task.nextDueDate)}
                          </span>
                          <span>·</span>
                          <span>{category?.label ?? 'Task'}</span>
                          <span>·</span>
                          <span>{frequencyLabel(task.frequency)}</span>
                        </p>
                      </div>
                      {isOverdue && <Badge tone="clay">Overdue</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">On the horizon</h2>
              <Badge tone="neutral">{activeTasks.length} active tasks</Badge>
            </div>
            {later.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Nothing beyond next week yet. Add a seasonal project from the task plan whenever
                you’re ready.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-sand-100">
                {later.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{task.title}</p>
                      <p className="text-[11px] text-ink-soft">
                        {CATEGORY_BY_VALUE[task.category]?.label} · {frequencyLabel(task.frequency)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-ink-muted">
                      {formatDate(task.nextDueDate, { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">Home profile</h2>
              <Link
                to="/settings"
                className="text-xs font-medium text-pine-700 underline-offset-2 hover:underline"
              >
                Manage
              </Link>
            </div>

            <p className="mt-3 flex items-start gap-2 text-sm font-medium leading-snug text-ink">
              <MapPin size={15} className="mt-0.5 shrink-0 text-pine-600" />
              {property?.address}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-sand-100 pt-4">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Built
                </dt>
                <dd className="mt-0.5 text-sm text-ink">{property?.yearBuilt ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Size
                </dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {property?.sqft ? `${Number(property.sqft).toLocaleString()} sq ft` : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  HVAC
                </dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {labelFor(HVAC_TYPES, property?.hvacType)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Water heater
                </dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {labelFor(WATER_HEATER_TYPES, property?.waterHeaterType)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">Recently filed</h2>
              <Link
                to="/documents"
                className="text-xs font-medium text-pine-700 underline-offset-2 hover:underline"
              >
                Open vault
              </Link>
            </div>

            {documents.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                The filing cabinet is empty. Add an insurance policy, warranty, or contractor
                invoice.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-sand-100">
                {documents.slice(0, 3).map((document) => (
                  <li key={document.id} className="flex items-center gap-2.5 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-pine-700">
                      <FileText size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">{document.title}</p>
                      <p className="text-[10px] text-ink-soft">{document.category}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-ink-soft">
                      {relativeTime(document.uploadedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="relative overflow-hidden border-pine-800 bg-pine-800 p-5 text-sand-50">
            <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full border border-white/10" />
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-pine-100">
                <Sparkles size={15} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pine-200/80">
                {season.label}
              </span>
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold leading-snug">{season.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-pine-100/80">{season.body}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
