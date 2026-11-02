# HomeOps

A local-first home organization and maintenance planner. The database is your browser's IndexedDB; the backup and every uploaded file live in your own Google Drive. Static React on GitHub Pages, no HomeOps server, no shared database, no subscription.

> Your home, on a schedule.

## What it does

- **Sign in with Google** — one button, no HomeOps account, no email/password form. Access is limited to a hidden app data backup and files the app creates.
- **Home profile** — address, year built, square footage, HVAC, water heater, heating fuel, and gutters. A clearly labeled demo lookup fills plausible details (it does not call a public-records API).
- **Profile-aware starter plan** — ~16 cleaning and maintenance tasks, filtered by your systems, with dates spread across the coming months.
- **Task plan** — Overdue / This week / Upcoming board, recurring completion, pause/resume, manual tasks, and one-click `.ics` export with `RRULE`s for Google Calendar or Outlook.
- **Document vault** — receipts, invoices, insurance policies, and warranties uploaded to `HomeOps / Documents` in Google Drive, with categories, search, preview, download, and deletion.
- **Spaces** — room photos and floor plans in `HomeOps / Spaces`, tagged as either type.
- **Google Drive sync** — a debounced JSON backup (`basekeep_backup.json`) in the hidden `appDataFolder`, restored on sign-in.
- **Settings** — profile facts, "add missing starter tasks", Drive status, manual sync, and sign-out.

## Stack

React 18 · Vite 5 · Tailwind CSS 3 · Lucide React · React Router 6 (`HashRouter`) · Zustand · Dexie 4 · `dexie-react-hooks` · Google Identity Services (OAuth 2.0 token model) · Google Drive REST API.

Supabase is no longer used. There is no SQL, RLS, storage bucket, or database URL to configure.

## How data moves

```
        user action
            │
            ▼
   React + useLiveQuery ──────────────► Dexie (IndexedDB)
            ▲                                │
            │                                │ db.on('changes')
            │                                ▼
            │                        syncService (debounced)
            │                                │
            │                                ├── basekeep_backup.json
            │                                │   (Google Drive appDataFolder)
            │                                │
            └──── hydrate on sign-in ◄───────┘

   file upload → Google Drive REST (HomeOps/Documents, HomeOps/Spaces)
               → driveFileId stored on the Dexie record
```

- Screens read with `useLiveQuery`, so every write is visible instantly and works offline.
- Any create, update, or delete in Dexie schedules a background overwrite of the Drive backup.
- Files are uploaded first, then the returned Drive file ID is written to the local record; the change triggers a backup.
- Deleting a record moves its Drive file to the Drive trash, so it can be recovered.

## Quick start

### 1. Configure Google

1. Open the [Google Cloud Console](https://console.cloud.google.com/), create a project, and enable **Google Drive API** under **APIs & Services → Library**.
2. Configure the **OAuth consent screen** (External is fine for personal use). Add these scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/drive.file`
3. While the consent screen is in **Testing**, add the Google accounts you will sign in with as **Test users**.
4. Create **Credentials → OAuth client ID → Web application**. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (Vite dev)
   - `https://<your-user>.github.io` (Pages; origin only, no repository path)
5. Copy the client ID.

### 2. Run locally

```bash
npm install
cp .env.example .env
```

Put the client ID in `.env`:

```bash
VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

```bash
npm run dev
```

Open the printed URL, choose **Sign in with Google**, and allow Drive access. No build-time secrets are required; the OAuth client ID is public by design.

### 3. First sign-in

- If `basekeep_backup.json` already exists in the Drive app data folder, it is downloaded and the local Dexie database is replaced with it.
- If it does not exist, HomeOps creates it from whatever is currently in this browser.
- Then the property wizard appears, or the dashboard if a home was restored.

## Dexie schema

Defined in [`src/lib/db.js`](src/lib/db.js):

```js
db.version(1).stores({
  properties: '++id, address, yearBuilt, sqft, createdAt',
  rooms: '++id, propertyId, name, driveFileId',
  tasks: '++id, propertyId, title, category, frequency, nextDueDate, status',
  documents: '++id, propertyId, title, category, driveFileId, uploadedAt',
});
```

Records use camelCase (`propertyId`, `nextDueDate`, `driveFileId`, `uploadedAt`). A few non-indexed fields keep the existing screens intact: property systems (`hvacType`, `waterHeaterType`, `heatingFuel`, `hasGutters`), task `description` and `lastCompletedAt`, room `kind` and file metadata, and document `fileName`, `fileSize`, and `mimeType`.

One home per account is still the MVP shape: the app reads the oldest property record and ignores additional ones.

## Google Drive layout

| What | Where |
| --- | --- |
| JSON backup | `appDataFolder/basekeep_backup.json` (hidden, created by HomeOps) |
| Vault files | `My Drive/HomeOps/Documents/` |
| Room photos, floor plans | `My Drive/HomeOps/Spaces/` |

The `drive.appdata` scope covers the hidden backup; `drive.file` covers the visible files HomeOps creates. The app cannot browse the rest of your Drive.

### Sync behavior

- **On sign-in:** read the backup, hydrate Dexie, or create the backup if none exists. If the same account has unsynced local edits, those are pushed instead of being overwritten.
- **On mutation:** Dexie's `changes` event starts a 1.2-second debounced `syncNow()`. Bursts (creating a profile plus its starter tasks) become one upload.
- **On reload:** a tab-scoped Google token is restored from `sessionStorage`. A newer remote backup (more than two minutes newer than the last sync) is pulled; otherwise local changes are pushed.
- **Manual sync:** **Settings → Google Drive sync → Sync now** forces a write and can refresh an expired token.
- **Conflicts:** last writer wins. There is no multi-device merge; avoid editing the same home on two devices at once.
- **Token expiry:** Google access tokens last about an hour. When one expires, local editing still works, the sidebar shows **Sync paused**, and **Sync now** or a fresh sign-in reconnects.

The backup payload includes `app`, `schemaVersion`, `exportedAt`, and `data` (properties, rooms, tasks, documents). Hydration keeps explicit IDs so records remain stable across devices and Dexie advances its auto-increment counters.

## Security and privacy

- **No HomeOps backend.** There is no place for this project's developer to read your data.
- **IndexedDB is not encryption.** Anyone with access to this browser profile or an XSS foothold on this origin can read the local database. Keep dependencies current; the app does not inject untrusted HTML.
- **The Drive token lives in `sessionStorage`** for the current tab and is cleared on sign-out. It is not written to localStorage. Signing out also revokes the token with Google.
- **Least privilege.** Only `drive.appdata` and `drive.file` are requested, plus basic profile scopes to show which account is signed in.
- **Account switching.** Signing in with a different Google account clears the local Dexie database first, then restores that account's backup. This prevents one person's home from being uploaded to another's Drive.
- **Deleting is recoverable.** Document and space deletion moves the Drive object to trash, not permanent deletion.
- **Revoke access** at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Deployment to GitHub Pages

1. Push the repository to GitHub with `main` as the default branch.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Add the OAuth client ID as a repository **Actions variable** named `VITE_GOOGLE_CLIENT_ID` (**Settings → Secrets and variables → Actions → Variables**). The workflow passes it to the Vite build.
4. Add `https://<user>.github.io` to the OAuth client's **Authorized JavaScript origins**.
5. Push to `main`. The workflow installs, builds, and publishes `dist`.

`vite.config.js` uses `base: './'`, so the same build works at any Pages project path. `HashRouter` removes the need for a 404 rewrite. `VITE_GOOGLE_CLIENT_ID` is inlined at build time; it is a public client ID, not a secret.

Manual deploy: `VITE_GOOGLE_CLIENT_ID=... npm run build` and publish `dist`.

## Project structure

```
.
├── .env.example                     # VITE_GOOGLE_CLIENT_ID
├── .github/workflows/deploy.yml     # GitHub Pages build + deploy
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js                   # base: './' for GitHub Pages
└── src/
    ├── main.jsx
    ├── App.jsx                      # HashRouter + Google session gate
    ├── index.css
    ├── components/
    │   ├── AppLayout.jsx            # sidebar, mobile nav, Drive status
    │   ├── Logo.jsx
    │   ├── RouteGuards.jsx          # session + live property gates
    │   ├── SyncIndicator.jsx
    │   ├── Toaster.jsx
    │   └── ui.jsx
    ├── hooks/
    │   └── useDriveObjectUrl.js     # Drive file ID → blob URL for <img>
    ├── lib/
    │   ├── constants.js
    │   ├── date.js
    │   ├── db.js                    # Dexie init, CRUD, backup serialize/hydrate
    │   ├── ics.js
    │   ├── recurrence.js
    │   ├── syncService.js           # Google auth, Drive JSON sync, uploads
    │   ├── syncStatus.js            # observable sync state
    │   ├── taskTemplates.js
    │   └── utils.js
    ├── pages/
    │   ├── AuthPage.jsx             # Sign in with Google
    │   ├── DashboardPage.jsx
    │   ├── DocumentsPage.jsx
    │   ├── PropertyWizardPage.jsx
    │   ├── RoomsPage.jsx
    │   ├── SettingsPage.jsx
    │   └── TasksPage.jsx
    └── store/
        ├── useAuthStore.js
        └── useUiStore.js
```

## Verification

```bash
npm run build
npm run preview
```

There is no automated test suite in this MVP. After a build, exercise:

1. Fresh browser → **Sign in with Google**; confirm the consent screen lists Drive app-data and per-file access.
2. First sign-in creates `basekeep_backup.json`; Settings shows a recent backup.
3. Create the home profile → starter tasks appear; check the backup timestamp updates.
4. Complete a task → next due date rolls forward and the change syncs.
5. Upload a document → it appears in `HomeOps/Documents`; preview and download work; delete moves it to Drive trash.
6. Upload a room photo and a floor plan → images render through the Drive API.
7. Reload → session and data return without re-consent while the token is valid.
8. Sign out → local data remains; signing in with another Google account switches to that account's backup.

### Limitations

- The Google OAuth consent screen must be configured (and verified for public use if Google requires it for the selected scopes). While in Testing mode, only listed test users can sign in.
- Access tokens expire hourly; the app reconnects on demand rather than running a background refresh timer.
- Single home per account, one backup file, last-write-wins sync.
- Uploads depend on the Drive API being reachable; a failed sync leaves the change safe in IndexedDB and surfaces **Sync paused**.
