import { useSyncExternalStore } from 'react';
import { DRIVE_LAST_SYNC_KEY } from './constants';

const listeners = new Set();

const storedLastSync = (() => {
  try {
    const value = Number(localStorage.getItem(DRIVE_LAST_SYNC_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
})();

let state = {
  status: 'idle',
  error: null,
  lastSyncedAt: storedLastSync,
};

export function getSyncState() {
  return state;
}

export function setSyncState(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('HomeOps: a sync status listener failed.', error);
    }
  }
}

export function subscribeSyncState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncState() {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}
