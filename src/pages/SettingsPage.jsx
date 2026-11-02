import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Building2,
  Cloud,
  ExternalLink,
  HardDrive,
  ListChecks,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Badge, Button, Card, PageHeader, Spinner } from '../components/ui';
import {
  DRIVE_BACKUP_FILE,
  DRIVE_FOLDER_NAME,
  HEATING_FUELS,
  HVAC_TYPES,
  WATER_HEATER_TYPES,
  labelFor,
} from '../lib/constants';
import { formatDateTime, relativeTime } from '../lib/date';
import { db, getPrimaryProperty, seedMissingTasks } from '../lib/db';
import { syncNow } from '../lib/syncService';
import { useSyncState } from '../lib/syncStatus';
import { formatBytes } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value === 0 ? '0' : value || '—'}</dd>
    </div>
  );
}

function SyncBadge({ status }) {
  if (status === 'error') return <Badge tone="clay">Needs attention</Badge>;
  if (status === 'syncing' || status === 'pending' || status === 'connecting') {
    return <Badge tone="neutral">Syncing</Badge>;
  }
  return (
    <Badge tone="pine">
      <ShieldCheck size={11} /> Connected
    </Badge>
  );
}

export default function SettingsPage() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const documents = useLiveQuery(() => db.documents.toArray(), []) ?? [];
  const rooms = useLiveQuery(() => db.rooms.toArray(), []) ?? [];

  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const { status, error: syncError, lastSyncedAt } = useSyncState();
  const pushToast = useUiStore((state) => state.pushToast);
  const navigate = useNavigate();

  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const totalDocumentBytes = documents.reduce(
    (sum, document) => sum + (Number(document.fileSize) || 0),
    0,
  );

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const added = await seedMissingTasks(property);
      if (added === 0) {
        pushToast('Every matching starter task is already on your plan.', 'info');
      } else {
        pushToast(`Added ${added} suggested ${added === 1 ? 'task' : 'tasks'}.`);
      }
    } catch (error) {
      pushToast(error.message || 'Could not add suggested tasks.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncNow({ interactive: true });
      pushToast('Your home is backed up to Google Drive.');
    } catch (error) {
      pushToast(error.message || 'Google Drive sync failed.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="The fine print"
        title="Settings"
        description="Your home profile, starter plan, Google Drive backup, and account — all in one place."
      />

      <div className="mt-7 space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine-700">
                <Building2 size={18} />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Home profile</h2>
                <p className="mt-0.5 text-sm text-ink-muted">{property?.address}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/onboarding')}
            >
              <Pencil size={14} /> Edit profile
            </Button>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-sand-100 pt-4 sm:grid-cols-4">
            <Fact label="Year built" value={property?.yearBuilt} />
            <Fact
              label="Square feet"
              value={property?.sqft ? Number(property.sqft).toLocaleString() : null}
            />
            <Fact label="HVAC" value={labelFor(HVAC_TYPES, property?.hvacType)} />
            <Fact
              label="Water heater"
              value={labelFor(WATER_HEATER_TYPES, property?.waterHeaterType)}
            />
            <Fact label="Heating fuel" value={labelFor(HEATING_FUELS, property?.heatingFuel)} />
            <Fact label="Gutters" value={property?.hasGutters ? 'Yes' : 'No'} />
            <Fact label="Documents" value={documents.length} />
            <Fact label="Spaces" value={rooms.length} />
          </dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-clay-50 text-clay-700">
                <ListChecks size={18} />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Starter plan</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
                  Re-run the profile checklist to add any suggested tasks that are missing. Existing
                  tasks are never changed or deleted.
                </p>
              </div>
            </div>
            <Badge tone="neutral">{tasks.length} tasks</Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sand-100 pt-4">
            <Button variant="secondary" onClick={handleSeed} loading={seeding}>
              {!seeding && <RefreshCw size={15} />}
              {seeding ? 'Checking plan…' : 'Add missing starter tasks'}
            </Button>
            <p className="text-[11px] text-ink-soft">
              Safe to run anytime — duplicates are skipped by title.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine-700">
                <Cloud size={18} />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Google Drive sync</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
                  This browser is the fast local copy. A JSON backup and every uploaded file live
                  in your own Drive.
                </p>
              </div>
            </div>
            <SyncBadge status={status} />
          </div>

          <dl className="mt-4 divide-y divide-sand-100 rounded-xl border border-sand-200 bg-sand-50/60 px-4">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-xs text-ink-muted">Google account</dt>
              <dd className="min-w-0 truncate text-xs text-ink">{session?.email || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-xs text-ink-muted">Backup file</dt>
              <dd className="truncate font-mono text-[11px] text-ink">{DRIVE_BACKUP_FILE}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-xs text-ink-muted">Backup location</dt>
              <dd className="text-xs text-ink">Hidden app data folder</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-xs text-ink-muted">Uploaded files</dt>
              <dd className="truncate font-mono text-[11px] text-ink">{DRIVE_FOLDER_NAME}/…</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-xs text-ink-muted">Last backup</dt>
              <dd className="text-xs text-ink">
                {lastSyncedAt ? (
                  <span title={formatDateTime(lastSyncedAt)}>{relativeTime(lastSyncedAt)}</span>
                ) : (
                  'Not yet'
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-xs text-ink-muted">Vault usage</dt>
              <dd className="text-xs text-ink">
                {documents.length} files
                {totalDocumentBytes > 0 ? ` · ${formatBytes(totalDocumentBytes)}` : ''}
              </dd>
            </div>
          </dl>

          {syncError && (
            <p
              role="status"
              className="mt-3 rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs leading-relaxed text-clay-800"
            >
              {syncError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSync} disabled={syncing} loading={syncing}>
              {!syncing && <RefreshCw size={15} />}
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <a
              href="https://drive.google.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 text-sm font-medium text-ink shadow-sm transition hover:border-pine-200 hover:bg-pine-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 focus-visible:ring-offset-2"
            >
              <ExternalLink size={15} /> Open Google Drive
            </a>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-soft">
            <HardDrive size={14} className="mt-0.5 shrink-0 text-pine-600" />
            Documents upload to <span className="font-medium text-ink-muted">HomeOps / Documents</span>
            ; room photos and floor plans go to{' '}
            <span className="font-medium text-ink-muted">HomeOps / Spaces</span>. Deleting a record
            moves the Drive file to trash, not into permanent deletion.
          </p>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-muted">
                <UserRound size={18} />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Account</h2>
                <p className="mt-0.5 text-sm text-ink-muted">{session?.name || session?.email}</p>
                <p className="mt-1 text-[11px] text-ink-soft">
                  Access is limited to the app data folder and files HomeOps creates. Revoke it any
                  time from your Google Account permissions.
                </p>
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-pine-700 hover:text-pine-800"
                >
                  Manage Google access <ExternalLink size={11} />
                </a>
              </div>
            </div>
            <Button variant="secondary" onClick={handleSignOut}>
              <LogOut size={15} /> Sign out
            </Button>
          </div>
        </Card>

        <p className="pb-2 text-center text-[11px] leading-relaxed text-ink-soft">
          HomeOps · local-first edition · {new Date().getFullYear()}
          <br />
          IndexedDB on this device, your Google Drive as the backup. No HomeOps accounts or servers.
        </p>
      </div>
    </div>
  );
}
