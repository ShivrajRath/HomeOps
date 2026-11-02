import { useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { relativeTime } from '../lib/date';
import { syncNow } from '../lib/syncService';
import { useSyncState } from '../lib/syncStatus';
import { useUiStore } from '../store/useUiStore';
import { cx } from '../lib/utils';

/**
 * Small, quiet status line for the sidebar. Local-first work is never blocked
 * by sync; this only tells the user whether the Drive copy is current.
 */
export default function SyncIndicator({ className }) {
  const { status, error, lastSyncedAt } = useSyncState();
  const pushToast = useUiStore((state) => state.pushToast);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await syncNow({ interactive: true });
      pushToast('Your home is backed up to Google Drive.');
    } catch (retryError) {
      pushToast(retryError.message || 'Google Drive sync failed.', 'error');
    } finally {
      setRetrying(false);
    }
  };

  const busy = retrying || status === 'syncing' || status === 'pending' || status === 'connecting';

  let label = 'Saved on this device';
  if (status === 'connecting') label = 'Connecting to Google…';
  else if (status === 'pending' || status === 'syncing') label = 'Syncing to Drive…';
  else if (status === 'synced') label = 'Saved to Drive';
  else if (status === 'error') label = 'Sync paused';

  return (
    <div className={cx('rounded-xl px-2 py-1.5', className)}>
      <div className="flex items-center gap-2">
        {busy ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-pine-600" />
        ) : status === 'error' ? (
          <CloudOff size={14} className="shrink-0 text-clay-600" />
        ) : (
          <Cloud
            size={14}
            className={cx('shrink-0', status === 'synced' ? 'text-pine-600' : 'text-ink-soft')}
          />
        )}
        <p
          className={cx(
            'min-w-0 flex-1 truncate text-[11px] font-medium',
            status === 'error' ? 'text-clay-700' : 'text-ink-muted',
          )}
          title={error || undefined}
        >
          {label}
        </p>
        {status === 'error' && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            aria-label="Retry Google Drive sync"
            title={error || 'Retry sync'}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-sand-100 hover:text-ink disabled:opacity-50"
          >
            <RefreshCw size={12} className={retrying ? 'animate-spin' : undefined} />
          </button>
        )}
      </div>
      {status === 'synced' && lastSyncedAt && (
        <p className="mt-0.5 pl-[22px] text-[10px] text-ink-soft">{relativeTime(lastSyncedAt)}</p>
      )}
      {status === 'error' && (
        <p className="mt-1 pl-[22px] text-[10px] leading-relaxed text-ink-soft">
          Changes are safe here. Reconnect to back them up.
        </p>
      )}
    </div>
  );
}
