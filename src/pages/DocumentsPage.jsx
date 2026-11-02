import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Eye,
  FileText,
  FolderLock,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from '../components/ui';
import { DOCUMENT_CATEGORIES, MAX_DOCUMENT_BYTES } from '../lib/constants';
import { formatDate, relativeTime } from '../lib/date';
import {
  addDocumentRecord,
  db,
  deleteDocumentRecord,
  getPrimaryProperty,
} from '../lib/db';
import {
  openDriveFile,
  saveDriveFile,
  trashDriveFile,
  uploadDriveFile,
} from '../lib/syncService';
import { cx, formatBytes, stripExtension } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

function UploadModal({ open, propertyId, onClose }) {
  const pushToast = useUiStore((state) => state.pushToast);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Bills');
  const [file, setFile] = useState(null);
  const [titleEdited, setTitleEdited] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategory('Bills');
    setFile(null);
    setTitleEdited(false);
    setDragging(false);
    setSaving(false);
    setError('');
  }, [open]);

  const chooseFile = (nextFile) => {
    if (!nextFile) return;
    if (nextFile.size > MAX_DOCUMENT_BYTES) {
      setError(
        `That file is ${formatBytes(nextFile.size)}. The maximum upload size is ${formatBytes(
          MAX_DOCUMENT_BYTES,
        )}.`,
      );
      return;
    }
    setFile(nextFile);
    setError('');
    if (!titleEdited) {
      setTitle(stripExtension(nextFile.name).replace(/[-_]+/g, ' ').trim());
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Give the document a title you will recognize later.');
      return;
    }

    setSaving(true);
    let uploaded = null;
    let saved = false;
    try {
      uploaded = await uploadDriveFile(file, {
        folder: 'Documents',
        maxBytes: MAX_DOCUMENT_BYTES,
      });
      await addDocumentRecord({
        propertyId,
        title,
        category,
        driveFileId: uploaded.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: uploaded.mimeType || file.type || null,
      });
      saved = true;
      pushToast('File added to your vault and your Google Drive.');
      onClose();
    } catch (submitError) {
      if (uploaded && !saved) {
        await trashDriveFile(uploaded.id).catch(() => {});
      }
      setError(submitError.message || 'The upload could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="File a document"
      description="Uploads go straight from this browser to your Google Drive."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="upload-form" loading={saving}>
            {saving ? 'Uploading…' : 'Upload document'}
          </Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs text-clay-800"
          >
            {error}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />

        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine-700">
              <FileText size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.name}</p>
              <p className="text-xs text-ink-soft">{formatBytes(file.size)}</p>
            </div>
            <IconButton label="Remove selected file" onClick={() => setFile(null)}>
              <X size={15} />
            </IconButton>
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cx(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
              dragging ? 'border-pine-400 bg-pine-50' : 'border-sand-300 bg-sand-50/60',
            )}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-pine-700 shadow-sm ring-1 ring-sand-200">
              <Upload size={19} />
            </span>
            <p className="mt-3 text-sm text-ink">
              Drop a file here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-pine-700 underline underline-offset-2 hover:text-pine-800"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-[11px] text-ink-soft">
              PDFs, images, receipts and invoices · up to 25 MB
            </p>
          </div>
        )}

        <Field label="Title" htmlFor="document-title" required>
          <Input
            id="document-title"
            placeholder="Home insurance policy 2026"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleEdited(true);
            }}
          />
        </Field>

        <Field label="Category" htmlFor="document-category">
          <Select
            id="document-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {DOCUMENT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <p className="text-[11px] leading-relaxed text-ink-soft">
          The file is uploaded to <span className="font-medium text-ink-muted">HomeOps / Documents</span>{' '}
          in your Drive. The vault record and its Drive file ID stay in this browser’s IndexedDB,
          then travel in your backup.
        </p>
      </form>
    </Modal>
  );
}

export default function DocumentsPage() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const documents =
    useLiveQuery(() => db.documents.orderBy('uploadedAt').reverse().toArray(), []) ?? [];
  const pushToast = useUiStore((state) => state.pushToast);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const totalBytes = documents.reduce(
    (sum, document) => sum + (Number(document.fileSize) || 0),
    0,
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesCategory = category === 'all' || document.category === category;
      const matchesTerm =
        !term ||
        document.title.toLowerCase().includes(term) ||
        (document.fileName ?? '').toLowerCase().includes(term) ||
        document.category.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [documents, query, category]);

  const handleView = async (document) => {
    setBusy(`${document.id}:view`);
    try {
      await openDriveFile(document.driveFileId);
    } catch (error) {
      pushToast(error.message || 'Could not open that file from Google Drive.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (document) => {
    setBusy(`${document.id}:download`);
    try {
      await saveDriveFile(document.driveFileId, document.fileName || document.title);
    } catch (error) {
      pushToast(error.message || 'Could not download that file from Google Drive.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (document) => {
    const confirmed = window.confirm(
      `Delete “${document.title}”? The file will be moved to your Google Drive trash.`,
    );
    if (!confirmed) return;

    try {
      await deleteDocumentRecord(document.id);
    } catch (error) {
      pushToast(error.message || 'Could not delete the document.', 'error');
      return;
    }

    try {
      await trashDriveFile(document.driveFileId);
      pushToast('Document deleted. The file is in your Google Drive trash.');
    } catch (error) {
      pushToast(
        'The record was deleted, but the Drive file could not be moved to trash.',
        'error',
      );
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="The vault"
        title="Every paper, in one place."
        description="Insurance policies, contractor invoices, appliance receipts, and the warranty you will definitely need someday."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Plus size={16} /> Upload document
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <Input
            type="search"
            placeholder="Search title, file, or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
            aria-label="Search documents"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['all', ...DOCUMENT_CATEGORIES].map((option) => {
            const label = option === 'all' ? 'All files' : option;
            const count =
              option === 'all'
                ? documents.length
                : documents.filter((document) => document.category === option).length;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                className={cx(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                  category === option
                    ? 'border-pine-700 bg-pine-700 text-white'
                    : 'border-sand-200 bg-white text-ink-muted hover:border-pine-200 hover:text-ink',
                )}
              >
                {label}
                <span
                  className={cx(
                    'text-[10px]',
                    category === option ? 'text-white/70' : 'text-ink-soft',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          {documents.length} {documents.length === 1 ? 'file' : 'files'}
          {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`} · stored in your Google Drive
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={FolderLock}
            title="Your filing cabinet is empty"
            description="Start with the documents you always end up hunting for: the home insurance policy, the HVAC warranty, or last year’s contractor invoice."
            action={
              <Button onClick={() => setUploadOpen(true)}>
                <Upload size={16} /> Upload the first document
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Search}
            title="No matches"
            description="Try a different search term or clear the category filter."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <Card className="mt-4 divide-y divide-sand-100 overflow-hidden">
          {filtered.map((document) => {
            const viewing = busy === `${document.id}:view`;
            const downloading = busy === `${document.id}:download`;
            return (
              <div
                key={document.id}
                className="flex flex-col gap-3 px-4 py-4 transition hover:bg-sand-50/50 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand-100 text-pine-700">
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{document.title}</p>
                    <p className="truncate text-[11px] text-ink-soft">
                      {document.fileName || 'Document'}
                      {document.fileSize ? ` · ${formatBytes(document.fileSize)}` : ''}
                      {` · ${relativeTime(document.uploadedAt)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <Badge tone="neutral">{document.category}</Badge>
                    <span className="text-[10px] text-ink-soft">
                      {formatDate(document.uploadedAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleView(document)}
                      disabled={Boolean(busy) || !document.driveFileId}
                      aria-label={`View ${document.title}`}
                      title="View"
                      className="inline-grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-sand-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {viewing ? <Spinner className="h-4 w-4" /> : <Eye size={15} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(document)}
                      disabled={Boolean(busy) || !document.driveFileId}
                      aria-label={`Download ${document.title}`}
                      title="Download"
                      className="inline-grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-sand-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {downloading ? <Spinner className="h-4 w-4" /> : <Download size={15} />}
                    </button>

                    <IconButton
                      label={`Delete ${document.title}`}
                      tone="danger"
                      onClick={() => handleDelete(document)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <UploadModal
        open={uploadOpen}
        propertyId={property?.id}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
