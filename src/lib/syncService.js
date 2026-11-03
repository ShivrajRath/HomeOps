import {
  DRIVE_BACKUP_FILE,
  DRIVE_DIRTY_KEY,
  DRIVE_FOLDER_NAME,
  DRIVE_LAST_SYNC_KEY,
  DRIVE_OWNER_KEY,
  GOOGLE_SESSION_KEY,
  MAX_DOCUMENT_BYTES,
} from './constants';
import {
  clearDatabase,
  db,
  exportDatabase,
  hydrateDatabase,
  isDatabaseEmpty,
} from './db';
import { setSyncState } from './syncStatus';
import { formatBytes } from './utils';

const CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * `openid email profile` identifies the signed-in person.
 * `drive.appdata` holds the hidden basekeep_backup.json.
 * `drive.file` lets HomeOps create and read the files it uploads.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

export class GoogleAuthError extends Error {
  constructor(message, code = 'auth') {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

/* --------------------------------------------------------------- Module state */

let googleScriptPromise = null;
let accessToken = null;
let tokenExpiresAt = 0;
let user = null;
let backupFileId = null;
let syncTimer = null;
let syncPromise = null;
let syncQueued = false;
let suppressChangeSync = false;
let suppressChangesUntil = 0;
const folderCache = new Map();

/* ------------------------------------------------------------- Persistence */

function readSession() {
  try {
    const raw = sessionStorage.getItem(GOOGLE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.user?.sub || !Number.isFinite(parsed.expiresAt)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSession() {
  if (!accessToken || !user) return;
  try {
    sessionStorage.setItem(
      GOOGLE_SESSION_KEY,
      JSON.stringify({ accessToken, expiresAt: tokenExpiresAt, user }),
    );
  } catch (error) {
    console.warn('HomeOps: the Google session could not be cached in this tab.', error);
  }
}

function clearStoredSession() {
  try {
    sessionStorage.removeItem(GOOGLE_SESSION_KEY);
  } catch {
    // sessionStorage may be unavailable in hardened browsers.
  }
}

function readOwner() {
  try {
    return localStorage.getItem(DRIVE_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(ownerId) {
  try {
    localStorage.setItem(DRIVE_OWNER_KEY, ownerId);
  } catch {
    // Ignore storage failures; this only guards against mixing accounts.
  }
}

function readLastSync() {
  try {
    return Number(localStorage.getItem(DRIVE_LAST_SYNC_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSync(timestamp) {
  try {
    localStorage.setItem(DRIVE_LAST_SYNC_KEY, String(timestamp));
  } catch {
    // Ignore storage failures.
  }
}

function readDirty() {
  try {
    return localStorage.getItem(DRIVE_DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDirty(value) {
  try {
    if (value) localStorage.setItem(DRIVE_DIRTY_KEY, '1');
    else localStorage.removeItem(DRIVE_DIRTY_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function markSynced(timestamp = Date.now()) {
  writeLastSync(timestamp);
  writeDirty(false);
  setSyncState({ status: 'synced', lastSyncedAt: timestamp, error: null });
}

/* ------------------------------------------------------------------- Config */

export function isGoogleConfigured() {
  return CLIENT_ID.length > 0;
}

function assertConfigured() {
  if (!isGoogleConfigured()) {
    throw new GoogleAuthError(
      'Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to .env and restart the dev server.',
      'missing_client_id',
    );
  }
}

/* ---------------------------------------------------------------- GIS loader */

function loadGoogleScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new GoogleAuthError('Google sign-in needs a browser.', 'no_window'));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const fail = () => {
      googleScriptPromise = null;
      reject(
        new GoogleAuthError(
          'Google sign-in could not load. Check your network connection or content blockers.',
          'script_load',
        ),
      );
    };

    const existing = document.querySelector('script[data-homeops-google]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.homeopsGoogle = 'true';
    script.onload = () => resolve();
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

function mapGoogleError(error) {
  const type = error?.type || '';
  if (type === 'popup_closed') {
    return new GoogleAuthError('Google sign-in was closed before it finished.', 'popup_closed');
  }
  if (type === 'popup_failed_to_open') {
    return new GoogleAuthError(
      'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.',
      'popup_blocked',
    );
  }
  if (type === 'access_denied') {
    return new GoogleAuthError(
      'HomeOps needs Drive access to back up your home. Choose “Allow” on the Google screen.',
      'access_denied',
    );
  }
  return new GoogleAuthError(
    error?.message || 'Google sign-in failed. Please try again.',
    type || 'unknown',
  );
}

/**
 * Open the Google token popup and resolve with a live access token.
 * GIS access tokens last about an hour; the expiry is tracked in-memory and in
 * sessionStorage so a page reload within that hour stays signed in.
 */
function requestToken(prompt) {
  return loadGoogleScript().then(
    () =>
      new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback) => (value) => {
          if (settled) return;
          settled = true;
          callback(value);
        };

        let client;
        try {
          client = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: GOOGLE_SCOPES,
            include_granted_scopes: true,
            callback: finish((response) => {
              if (!response?.access_token) {
                reject(new GoogleAuthError('Google did not return an access token.', 'no_token'));
                return;
              }
              accessToken = response.access_token;
              const lifetime = Math.max(60, Number(response.expires_in) || 3600);
              tokenExpiresAt = Date.now() + lifetime * 1000 - 60_000;
              resolve(response.access_token);
            }),
            error_callback: finish((error) => reject(mapGoogleError(error))),
          });
        } catch (error) {
          reject(error);
          return;
        }

        try {
          client.requestAccessToken({ prompt });
        } catch (error) {
          reject(error);
        }
      }),
  );
}

async function fetchUserInfo(token) {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new GoogleAuthError(
      'Google did not share your profile. Check that the email and profile scopes are allowed.',
      'userinfo',
    );
  }
  const profile = await response.json();
  if (!profile?.sub) {
    throw new GoogleAuthError('Google did not return an account identifier.', 'userinfo');
  }
  return {
    sub: profile.sub,
    name: profile.name || profile.email || 'Google account',
    email: profile.email || '',
    picture: profile.picture || null,
  };
}

async function ensureToken({ interactive = false } = {}) {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  if (!interactive) {
    throw new GoogleAuthError(
      'Your Google session expired. Choose “Sync now” to reconnect.',
      'expired',
    );
  }

  assertConfigured();
  await requestToken('');
  const nextUser = await fetchUserInfo(accessToken);

  if (user?.sub && nextUser.sub !== user.sub) {
    // A different Google account was selected. Never mix two people's homes.
    await withSuppressedChanges(clearDatabase);
    writeOwner(nextUser.sub);
    writeDirty(false);
    backupFileId = null;
    folderCache.clear();
    user = nextUser;
    persistSession();
    await pullOrCreateBackup();
    return accessToken;
  }

  user = nextUser;
  persistSession();
  return accessToken;
}

/* ------------------------------------------------------------------ Session */

/**
 * Restore a session cached by this tab. No network call is made here.
 */
export function restoreSession() {
  const stored = readSession();
  if (!stored || stored.expiresAt <= Date.now() + 30_000) {
    clearStoredSession();
    return null;
  }

  accessToken = stored.accessToken;
  tokenExpiresAt = stored.expiresAt;
  user = stored.user;
  return user;
}

/**
 * Sign in with Google, then reconcile this browser with the Drive backup.
 */
export async function signIn() {
  assertConfigured();
  setSyncState({ status: 'connecting', error: null });

  try {
    await requestToken('consent');
    const profile = await fetchUserInfo(accessToken);
    const previousOwner = readOwner();
    const ownerChanged = Boolean(previousOwner && previousOwner !== profile.sub);

    if (ownerChanged) {
      await withSuppressedChanges(clearDatabase);
      writeDirty(false);
    }

    user = profile;
    backupFileId = null;
    folderCache.clear();
    writeOwner(profile.sub);
    persistSession();

    if (!ownerChanged && readDirty() && !(await isDatabaseEmpty())) {
      // This browser already holds unsynced edits. Push them instead of
      // replacing them with a possibly older cloud copy.
      await syncNow();
    } else {
      await pullOrCreateBackup();
    }

    markSynced(readLastSync() || Date.now());
    return profile;
  } catch (error) {
    accessToken = null;
    tokenExpiresAt = 0;
    user = null;
    clearStoredSession();
    setSyncState({ status: 'error', error: error.message || 'Google sign-in failed.' });
    throw error;
  }
}

export function signOut() {
  window.clearTimeout(syncTimer);
  syncTimer = null;
  syncQueued = false;

  const token = accessToken;
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch (error) {
      console.warn('HomeOps: the Google token could not be revoked.', error);
    }
  }

  accessToken = null;
  tokenExpiresAt = 0;
  user = null;
  backupFileId = null;
  folderCache.clear();
  clearStoredSession();
  setSyncState({ status: 'idle', error: null });
  // IndexedDB and the backup stay in place: signing out is not a data wipe.
}

/* --------------------------------------------------------------- Drive API */

async function authorizedFetch(url, options = {}) {
  const token = await ensureToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    accessToken = null;
    tokenExpiresAt = 0;
    clearStoredSession();
    throw new GoogleAuthError(
      'Google authorization expired. Reconnect to keep syncing.',
      'expired',
    );
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = `Google Drive request failed (HTTP ${response.status}).`;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      if (raw) message = `${message} ${raw.slice(0, 160)}`;
    }
    throw new Error(message);
  }

  return response;
}

const escapeQueryValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function findBackupFile() {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${escapeQueryValue(DRIVE_BACKUP_FILE)}' and trashed = false`,
    fields: 'files(id,name,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '10',
  });

  const response = await authorizedFetch(`${DRIVE_API}/files?${params.toString()}`);
  const payload = await response.json();
  return payload.files?.[0] ?? null;
}

async function downloadBackup(fileId) {
  const response = await authorizedFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  try {
    return await response.json();
  } catch {
    throw new Error('The backup in Google Drive is not valid JSON.');
  }
}

async function writeBackup(fileId, snapshot) {
  await authorizedFetch(
    `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,modifiedTime`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(snapshot, null, 2),
    },
  );
}

async function createBackupFile(snapshot) {
  const response = await authorizedFetch(`${DRIVE_API}/files?fields=id,name,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name: DRIVE_BACKUP_FILE,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }),
  });

  const created = await response.json();
  if (!created?.id) throw new Error('Google Drive did not create the backup file.');
  await writeBackup(created.id, snapshot);
  return created.id;
}

/* ----------------------------------------------------------- Hydration flow */

async function withSuppressedChanges(operation) {
  const previous = suppressChangeSync;
  suppressChangeSync = true;
  suppressChangesUntil = Date.now() + 2500;
  try {
    return await operation();
  } finally {
    suppressChangeSync = previous;
    suppressChangesUntil = Date.now() + 500;
  }
}

async function applyBackup(snapshot) {
  await withSuppressedChanges(() => hydrateDatabase(snapshot));
}

/**
 * On first sign-in: restore basekeep_backup.json, or create it with whatever
 * is already in this browser.
 */
async function pullOrCreateBackup() {
  const existing = await findBackupFile();

  if (existing) {
    const snapshot = await downloadBackup(existing.id);
    await applyBackup(snapshot);
    backupFileId = existing.id;
    writeDirty(false);
    const stamp = Date.parse(existing.modifiedTime || '') || Date.now();
    writeLastSync(stamp);
    setSyncState({ status: 'synced', lastSyncedAt: stamp, error: null });
    return { hydrated: true };
  }

  const snapshot = await exportDatabase();
  backupFileId = await createBackupFile(snapshot);
  markSynced();
  return { hydrated: false };
}

/* -------------------------------------------------------------------- Sync */

/**
 * Called after Dexie commits a CRUD write. Debounced so a burst of changes
 * (creating a home plus its starter tasks) becomes one Drive upload.
 */
export function scheduleSync(delay = 1200) {
  if (!accessToken) return;
  if (suppressChangeSync || Date.now() < suppressChangesUntil) return;

  writeDirty(true);
  setSyncState({ status: 'pending', error: null });

  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncNow().catch(() => {
      // syncNow already records the error for the UI.
    });
  }, delay);
}

/**
 * Overwrite basekeep_backup.json with the current Dexie state.
 * The promise is shared so concurrent callers cannot interleave writes.
 */
export function syncNow({ interactive = false } = {}) {
  if (syncPromise) {
    syncQueued = true;
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      if (!accessToken && !interactive && !restoreSession()) {
        throw new GoogleAuthError('Sign in with Google to sync.', 'signed_out');
      }
      await ensureToken({ interactive });

      setSyncState({ status: 'syncing', error: null });
      const snapshot = await exportDatabase();

      if (!backupFileId) {
        const existing = await findBackupFile();
        if (existing) backupFileId = existing.id;
      }

      if (backupFileId) {
        await writeBackup(backupFileId, snapshot);
      } else {
        backupFileId = await createBackupFile(snapshot);
      }

      markSynced();
      return snapshot;
    } catch (error) {
      writeDirty(true);
      setSyncState({
        status: 'error',
        error: error.message || 'Your changes could not reach Google Drive.',
      });
      throw error;
    } finally {
      syncPromise = null;
      if (syncQueued) {
        syncQueued = false;
        window.setTimeout(() => {
          syncNow().catch(() => {});
        }, 0);
      }
    }
  })();

  return syncPromise;
}

/**
 * Run when a restored session becomes available. Pulls a newer cloud backup,
 * or pushes local edits so another device sees them.
 */
export async function resumeSync() {
  if (!accessToken) return { skipped: true };

  try {
    const existing = await findBackupFile();
    if (existing) {
      const remoteTime = Date.parse(existing.modifiedTime || '') || 0;
      const lastSync = readLastSync();

      if (!readDirty() && remoteTime > lastSync + 120_000) {
        await applyBackup(await downloadBackup(existing.id));
        backupFileId = existing.id;
        writeDirty(false);
        writeLastSync(remoteTime);
        setSyncState({ status: 'synced', lastSyncedAt: remoteTime, error: null });
        return { hydrated: true };
      }

      backupFileId = existing.id;
    }

    if (await isDatabaseEmpty()) {
      return pullOrCreateBackup();
    }

    await syncNow();
    return { hydrated: false };
  } catch (error) {
    setSyncState({ status: 'error', error: error.message });
    return { error };
  }
}

/* -------------------------------------------------------------- File upload */

function sanitizeFileName(name = 'file') {
  const cleaned = String(name)
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned.slice(-120) || 'file';
}

async function ensureFolder(name, parentId = null) {
  const cacheKey = `${parentId || 'root'}:${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const parentClause = parentId ? `'${escapeQueryValue(parentId)}' in parents` : `'root' in parents`;
  const params = new URLSearchParams({
    q: `name = '${escapeQueryValue(name)}' and mimeType = 'application/vnd.google-apps.folder' and ${parentClause} and trashed = false`,
    fields: 'files(id,name)',
    pageSize: '10',
    spaces: 'drive',
  });

  const listedResponse = await authorizedFetch(`${DRIVE_API}/files?${params.toString()}`);
  const listed = await listedResponse.json();
  const existing = listed.files?.[0];
  if (existing?.id) {
    folderCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const createdResponse = await authorizedFetch(`${DRIVE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const created = await createdResponse.json();
  if (!created?.id) throw new Error('Google Drive could not create the HomeOps folder.');

  folderCache.set(cacheKey, created.id);
  return created.id;
}

/**
 * Upload a receipt, invoice, floor plan, or room photo into
 * HomeOps / <folder> in the user's My Drive. Returns the Drive file ID that
 * is stored on the Dexie record.
 */
export async function uploadDriveFile(
  file,
  { folder = 'Documents', maxBytes = MAX_DOCUMENT_BYTES } = {},
) {
  if (!file) throw new Error('Choose a file to upload.');
  if (maxBytes && file.size > maxBytes) {
    throw new Error(
      `That file is ${formatBytes(file.size)}. The maximum upload size is ${formatBytes(maxBytes)}.`,
    );
  }

  const rootFolderId = await ensureFolder(DRIVE_FOLDER_NAME);
  const targetFolderId = await ensureFolder(folder, rootFolderId);
  const name = sanitizeFileName(file.name);
  const mimeType = file.type || 'application/octet-stream';

  // Resumable uploads work for both small receipts and large PDFs, and avoid
  // hand-building a multipart body in the browser.
  const initResponse = await authorizedFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({
        name,
        mimeType,
        parents: [targetFolderId],
      }),
    },
  );

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) throw new Error('Google Drive did not return an upload URL.');

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: file,
  });

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '');
    throw new Error(
      `Google Drive rejected the upload (HTTP ${uploadResponse.status})${
        detail ? `: ${detail.slice(0, 160)}` : '.'
      }`,
    );
  }

  const uploaded = await uploadResponse.json();
  if (!uploaded?.id) throw new Error('Google Drive did not return a file ID.');

  return {
    id: uploaded.id,
    name: uploaded.name || name,
    mimeType: uploaded.mimeType || mimeType,
    size: Number(uploaded.size) || file.size,
    webViewLink: uploaded.webViewLink || null,
  };
}

/** Download a Drive file as a Blob for previewing images or documents. */
export async function getDriveBlob(fileId) {
  if (!fileId) throw new Error('This record has no Google Drive file.');
  const response = await authorizedFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  return response.blob();
}

/** Fetch a file and hand it to the browser's download flow. */
export async function saveDriveFile(fileId, fileName = 'document') {
  const blob = await getDriveBlob(fileId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || 'document';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Open a Drive file in a new tab. The tab is claimed synchronously (before the
 * fetch) so browsers treat it as part of the user's click and do not block it.
 */
export async function openDriveFile(fileId) {
  if (!fileId) throw new Error('This record has no Google Drive file.');

  const tab = window.open('', '_blank');
  if (!tab) throw new Error('Allow popups to preview this file.');

  try {
    tab.opener = null;
  } catch {
    // Some browsers refuse the assignment; the new tab is still usable.
  }

  try {
    const blob = await getDriveBlob(fileId);
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (error) {
    try {
      tab.close();
    } catch {
      // Ignore a tab that already closed itself.
    }
    throw error;
  }
}

/** Move a Drive file to the trash (recoverable) instead of deleting it. */
export async function trashDriveFile(fileId) {
  if (!fileId) return;
  await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ trashed: true }),
  });
}

/* ------------------------------------------------------- Dexie write hooks */

/**
 * This Dexie build does not expose a database-wide "changes" event, so each
 * table gets hooks for its three write paths. Hooks cover add(), put(),
 * update(), delete(), bulkAdd(), bulkPut(), bulkDelete(), and clear().
 *
 * scheduleSync() only starts a debounced timer; it never performs database
 * work inside the write transaction.
 */
for (const tableName of ['properties', 'rooms', 'tasks', 'documents', 'items']) {
  const table = db.table(tableName);
  for (const eventName of ['creating', 'updating', 'deleting']) {
    table.hook(eventName, () => {
      scheduleSync();
    });
  }
}
