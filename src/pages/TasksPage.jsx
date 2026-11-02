import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Check,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../components/ui';
import { CATEGORIES, CATEGORY_BY_VALUE } from '../lib/constants';
import { dayDiff, formatDate, relativeDue, todayYMD } from '../lib/date';
import {
  addTask,
  completeTask as completeTaskInDb,
  db,
  deleteTask as deleteTaskInDb,
  getPrimaryProperty,
  updateTask as updateTaskInDb,
} from '../lib/db';
import { downloadCalendar } from '../lib/ics';
import { FREQUENCIES, frequencyLabel } from '../lib/recurrence';
import { cx } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

function blankTask() {
  return {
    title: '',
    description: '',
    category: 'cleaning',
    frequency: 'weekly',
    nextDueDate: todayYMD(),
    status: 'active',
  };
}

function TaskModal({ open, task, propertyId, onClose }) {
  const pushToast = useUiStore((state) => state.pushToast);

  const [form, setForm] = useState(blankTask);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(
      task
        ? {
            title: task.title ?? '',
            description: task.description ?? '',
            category: task.category ?? 'cleaning',
            frequency: task.frequency ?? 'weekly',
            nextDueDate: task.nextDueDate ?? todayYMD(),
            status: task.status ?? 'active',
          }
        : blankTask(),
    );
    setError('');
    setSaving(false);
  }, [open, task]);

  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Give the task a short, clear name.');
      return;
    }
    if (!form.nextDueDate) {
      setError('Choose the next due date.');
      return;
    }

    setSaving(true);
    try {
      if (task) {
        await updateTaskInDb(task.id, form);
        pushToast('Task updated.');
      } else {
        await addTask(propertyId, form);
        pushToast('Task added to your plan.');
      }
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Could not save the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'Add a task'}
      description={
        task
          ? 'Adjust the cadence or pause this item without losing its history.'
          : 'Give it a rhythm and HomeOps will keep it moving.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={saving}>
            {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs text-clay-800"
          >
            {error}
          </div>
        )}

        <Field label="Task name" htmlFor="task-title" required>
          <Input
            id="task-title"
            placeholder="Clean the gutters"
            value={form.title}
            onChange={(event) => update({ title: event.target.value })}
            autoFocus
          />
        </Field>

        <Field label="Notes" htmlFor="task-description" hint="Optional, but future-you will thank you.">
          <Textarea
            id="task-description"
            placeholder="Clear leaves, check downspouts, and look for sagging."
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="task-category">
            <Select
              id="task-category"
              value={form.category}
              onChange={(event) => update({ category: event.target.value })}
            >
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Repeats" htmlFor="task-frequency">
            <Select
              id="task-frequency"
              value={form.frequency}
              onChange={(event) => update({ frequency: event.target.value })}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>
                  {frequency.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Next due" htmlFor="task-due">
            <Input
              id="task-due"
              type="date"
              value={form.nextDueDate}
              onChange={(event) => update({ nextDueDate: event.target.value })}
            />
          </Field>

          {task && (
            <Field label="Status" htmlFor="task-status">
              <Select
                id="task-status"
                value={form.status}
                onChange={(event) => update({ status: event.target.value })}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </Field>
          )}
        </div>
      </form>
    </Modal>
  );
}

function TaskCard({ task, busy, onComplete, onEdit, onDelete }) {
  const overdue = dayDiff(task.nextDueDate, todayYMD()) < 0;
  const category = CATEGORY_BY_VALUE[task.category];
  const Icon = task.category === 'cleaning' ? Sparkles : Wrench;

  return (
    <article className="group rounded-xl border border-sand-200 bg-white p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-pine-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <Badge tone={task.category === 'cleaning' ? 'pine' : 'clay'}>
          <Icon size={11} /> {category?.label ?? 'Task'}
        </Badge>
        <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <IconButton label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton label={`Delete ${task.title}`} tone="danger" onClick={() => onDelete(task)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      <h3 className="mt-2.5 text-sm font-medium leading-snug text-ink">{task.title}</h3>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{task.description}</p>
      )}

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-sand-100 pt-3">
        <div className="min-w-0">
          <p
            className={cx(
              'flex items-center gap-1.5 text-[11px] font-medium',
              overdue ? 'text-clay-700' : 'text-ink-muted',
            )}
          >
            <Clock size={12} className="shrink-0" />
            {relativeDue(task.nextDueDate)}
          </p>
          <p className="mt-0.5 text-[10px] text-ink-soft">
            {frequencyLabel(task.frequency)} · {formatDate(task.nextDueDate, { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onComplete(task)}
          disabled={busy}
          aria-label={`Mark ${task.title} complete`}
          title="Mark complete"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sand-200 text-ink-soft transition hover:border-pine-400 hover:bg-pine-50 hover:text-pine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 disabled:opacity-50"
        >
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} strokeWidth={2.4} />}
        </button>
      </div>
    </article>
  );
}

function TaskColumn({ title, hint, dotClass, tasks, busyId, onComplete, onEdit, onDelete, emptyText }) {
  return (
    <section className="min-w-0">
      <header className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className={cx('h-2 w-2 rounded-full', dotClass)} />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <span className="rounded-full bg-sand-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
            {tasks.length}
          </span>
        </div>
        <span className="text-[10px] text-ink-soft">{hint}</span>
      </header>

      <div className="mt-3 space-y-3">
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sand-300 bg-white/40 px-3 py-5 text-center text-[11px] leading-relaxed text-ink-soft">
            {emptyText}
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              busy={busyId === task.id}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function TasksPage() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const tasks =
    useLiveQuery(() => db.tasks.orderBy('nextDueDate').toArray(), []) ?? [];
  const pushToast = useUiStore((state) => state.pushToast);

  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const today = todayYMD();
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === 'active'),
    [tasks],
  );
  const filtered = activeTasks.filter((task) => filter === 'all' || task.category === filter);
  const overdue = filtered.filter((task) => dayDiff(task.nextDueDate, today) < 0);
  const thisWeek = filtered.filter((task) => {
    const delta = dayDiff(task.nextDueDate, today);
    return delta >= 0 && delta <= 7;
  });
  const upcoming = filtered.filter((task) => dayDiff(task.nextDueDate, today) > 7);
  const paused = tasks.filter(
    (task) => task.status === 'paused' && (filter === 'all' || task.category === filter),
  );

  const counts = {
    all: activeTasks.length,
    cleaning: activeTasks.filter((task) => task.category === 'cleaning').length,
    maintenance: activeTasks.filter((task) => task.category === 'maintenance').length,
  };

  const openNew = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleComplete = async (task) => {
    setBusyId(task.id);
    try {
      const updated = await completeTaskInDb(task);
      pushToast(`Done. “${task.title}” is next due ${formatDate(updated.nextDueDate)}.`);
    } catch (error) {
      pushToast(error.message || 'Could not complete the task.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task) => {
    const confirmed = window.confirm(`Delete “${task.title}”? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteTaskInDb(task.id);
      pushToast('Task deleted.');
    } catch (error) {
      pushToast(error.message || 'Could not delete the task.', 'error');
    }
  };

  const handleResume = async (task) => {
    try {
      await updateTaskInDb(task.id, { status: 'active' });
      pushToast('Task resumed.');
    } catch (error) {
      pushToast(error.message || 'Could not resume the task.', 'error');
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
        eyebrow="The plan"
        title="A rhythm for the place you live."
        description="Cleaning and maintenance in one schedule. Complete a task and its next occurrence moves forward automatically."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}>
              <CalendarDays size={16} /> Export .ics
            </Button>
            <Button onClick={openNew}>
              <Plus size={16} /> New task
            </Button>
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-sand-200 bg-white p-1 shadow-sm">
          {[
            { value: 'all', label: 'All' },
            { value: 'cleaning', label: 'Cleaning' },
            { value: 'maintenance', label: 'Maintenance' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={cx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
                filter === tab.value
                  ? 'bg-pine-700 text-white shadow-sm'
                  : 'text-ink-muted hover:bg-sand-100 hover:text-ink',
              )}
            >
              {tab.label}
              <span
                className={cx(
                  'rounded-full px-1.5 text-[10px]',
                  filter === tab.value ? 'bg-white/20 text-white' : 'bg-sand-100 text-ink-soft',
                )}
              >
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-soft">Marking complete rolls the next date forward.</p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-3 lg:gap-5">
        <TaskColumn
          title="Overdue"
          hint="Needs attention"
          dotClass="bg-clay-500"
          tasks={overdue}
          busyId={busyId}
          onComplete={handleComplete}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyText="Nothing overdue. Lovely."
        />
        <TaskColumn
          title="This week"
          hint="Next 7 days"
          dotClass="bg-pine-500"
          tasks={thisWeek}
          busyId={busyId}
          onComplete={handleComplete}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyText="No tasks due this week."
        />
        <TaskColumn
          title="Upcoming"
          hint="Beyond 7 days"
          dotClass="bg-sand-400"
          tasks={upcoming}
          busyId={busyId}
          onComplete={handleComplete}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyText="Nothing on the horizon yet."
        />
      </div>

      {paused.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Pause size={14} className="text-ink-soft" />
            <h2 className="text-sm font-semibold text-ink">Paused</h2>
            <Badge tone="neutral">{paused.length}</Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {paused.map((task) => (
              <Card key={task.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{task.title}</p>
                  <p className="text-[11px] text-ink-soft">
                    {CATEGORY_BY_VALUE[task.category]?.label} · {frequencyLabel(task.frequency)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => handleResume(task)}>
                  <Play size={13} /> Resume
                </Button>
                <IconButton label={`Edit ${task.title}`} onClick={() => openEdit(task)}>
                  <Pencil size={14} />
                </IconButton>
              </Card>
            ))}
          </div>
        </section>
      )}

      <TaskModal
        open={modalOpen}
        task={editingTask}
        propertyId={property?.id}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
