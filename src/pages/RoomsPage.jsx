import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Image as ImageIcon,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  Upload,
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
import { useDriveObjectUrl } from '../hooks/useDriveObjectUrl';
import { MAX_IMAGE_BYTES, ROOM_KINDS, labelFor } from '../lib/constants';
import { formatDate } from '../lib/date';
import {
  addRoomRecord,
  db,
  deleteRoomRecord,
  getPrimaryProperty,
  updateRoomRecord,
} from '../lib/db';
import { trashDriveFile, uploadDriveFile } from '../lib/syncService';
import { cx, formatBytes } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

function RoomModal({ open, room, defaultKind, propertyId, onClose }) {
  const pushToast = useUiStore((state) => state.pushToast);
  const existing = useDriveObjectUrl(room?.driveFileId);

  const [name, setName] = useState('');
  const [kind, setKind] = useState(defaultKind);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(room?.name ?? '');
    setKind(room?.kind ?? defaultKind);
    setFile(null);
    setSaving(false);
    setError('');
  }, [open, room, defaultKind]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const chooseFile = (nextFile) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setError(
        `That image is ${formatBytes(nextFile.size)}. The maximum size is ${formatBytes(
          MAX_IMAGE_BYTES,
        )}.`,
      );
      return;
    }
    setError('');
    setFile(nextFile);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give this space a name.');
      return;
    }
    if (!room && !file) {
      setError('Choose a photo or floor plan to upload.');
      return;
    }

    setSaving(true);
    let uploaded = null;
    let saved = false;

    try {
      if (file) {
        uploaded = await uploadDriveFile(file, {
          folder: 'Spaces',
          maxBytes: MAX_IMAGE_BYTES,
        });
      }

      if (room) {
        await updateRoomRecord(room.id, {
          name,
          kind,
          ...(uploaded
            ? {
                driveFileId: uploaded.id,
                fileName: uploaded.name,
                fileSize: uploaded.size,
                mimeType: uploaded.mimeType,
              }
            : {}),
        });
        saved = true;

        if (uploaded && room.driveFileId) {
          trashDriveFile(room.driveFileId).catch((trashError) => {
            console.warn('HomeOps: the replaced Drive image could not be trashed.', trashError);
          });
        }
        pushToast('Space updated.');
      } else {
        if (!uploaded) throw new Error('Choose a photo or floor plan to upload.');
        await addRoomRecord({
          propertyId,
          name,
          kind,
          driveFileId: uploaded.id,
          fileName: uploaded.name,
          fileSize: uploaded.size,
          mimeType: uploaded.mimeType,
        });
        saved = true;
        pushToast('Space added to your Google Drive.');
      }

      onClose();
    } catch (submitError) {
      if (uploaded && !saved) {
        await trashDriveFile(uploaded.id).catch(() => {});
      }
      setError(submitError.message || 'Could not save this space.');
    } finally {
      setSaving(false);
    }
  };

  const shownImage = preview || existing.url;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? 'Edit space' : 'Add a space'}
      description="A room photo or a labeled floor plan, stored in your Google Drive."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="room-form" loading={saving}>
            {saving ? 'Saving…' : room ? 'Save changes' : 'Add space'}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs text-clay-800"
          >
            {error}
          </div>
        )}

        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-sand-200 bg-sand-100">
          {shownImage ? (
            <img
              src={shownImage}
              alt={name ? `Preview of ${name}` : 'Space preview'}
              className="h-full w-full object-cover"
            />
          ) : existing.loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-soft">
              <ImageIcon size={28} />
              <p className="text-xs">Your preview will appear here</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-sand-50/60 p-3.5 text-left transition hover:border-pine-300 hover:bg-pine-50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-pine-700 ring-1 ring-sand-200">
            <Upload size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {file ? file.name : shownImage ? 'Replace image' : 'Choose an image'}
            </span>
            <span className="block text-[11px] text-ink-soft">
              JPG, PNG, WebP or HEIC · up to 10 MB
            </span>
          </span>
        </button>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="room-name" required>
            <Input
              id="room-name"
              placeholder="Primary bathroom"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Type" htmlFor="room-kind">
            <Select
              id="room-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {ROOM_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function RoomCard({ room, onEdit, onDelete }) {
  const { url, loading, error } = useDriveObjectUrl(room.driveFileId);

  return (
    <Card className="group overflow-hidden">
      <div className="relative aspect-[4/3] bg-sand-100">
        {room.driveFileId ? (
          url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${room.name}`}
              className="block h-full w-full"
            >
              <img
                src={url}
                alt={room.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </a>
          ) : loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div
              className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-ink-soft"
              title={error || undefined}
            >
              <ImageIcon size={24} />
              <p className="text-[10px] leading-relaxed">Image unavailable. Reconnect Drive.</p>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-ink-soft">
            <ImageIcon size={24} />
          </div>
        )}

        <div className="absolute left-2.5 top-2.5">
          <Badge tone="neutral" className="bg-white/95 backdrop-blur">
            {labelFor(ROOM_KINDS, room.kind)}
          </Badge>
        </div>

        <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-lg bg-white/95 p-1 shadow-sm backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <IconButton label={`Edit ${room.name}`} onClick={() => onEdit(room)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton
            label={`Delete ${room.name}`}
            tone="danger"
            onClick={() => onDelete(room)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{room.name}</p>
          <p className="text-[11px] text-ink-soft">
            Added {formatDate(room.createdAt, { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(room)}
          className="text-[11px] font-medium text-pine-700 underline-offset-2 hover:underline"
        >
          Rename
        </button>
      </div>
    </Card>
  );
}

export default function RoomsPage() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const rooms =
    useLiveQuery(async () => {
      // createdAt is intentionally not indexed on rooms, so sort after reading.
      const items = await db.rooms.toArray();
      return items.sort((a, b) =>
        String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')),
      );
    }, []) ?? [];
  const pushToast = useUiStore((state) => state.pushToast);

  const [tab, setTab] = useState('room');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);

  const visibleRooms = useMemo(
    () => rooms.filter((room) => room.kind === tab),
    [rooms, tab],
  );
  const roomCount = rooms.filter((room) => room.kind === 'room').length;
  const planCount = rooms.filter((room) => room.kind === 'floor_plan').length;

  const openNew = () => {
    setEditingRoom(null);
    setModalOpen(true);
  };

  const openEdit = (room) => {
    setEditingRoom(room);
    setModalOpen(true);
  };

  const handleDelete = async (room) => {
    const confirmed = window.confirm(
      `Delete “${room.name}”? The image will be moved to your Google Drive trash.`,
    );
    if (!confirmed) return;

    try {
      await deleteRoomRecord(room.id);
    } catch (error) {
      pushToast(error.message || 'Could not delete this space.', 'error');
      return;
    }

    try {
      await trashDriveFile(room.driveFileId);
      pushToast('Space deleted. The image is in your Google Drive trash.');
    } catch (error) {
      pushToast(
        'The space was removed, but the Drive image could not be moved to trash.',
        'error',
      );
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="The spaces"
        title="Know every corner."
        description="Photograph rooms, keep a labeled floor plan, and stop hunting for the water shutoff at 11 p.m."
        actions={
          <Button onClick={openNew}>
            <Plus size={16} /> Add space
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-sand-200 bg-white p-1 shadow-sm">
          {[
            { value: 'room', label: 'Room photos', count: roomCount },
            { value: 'floor_plan', label: 'Floor plans', count: planCount },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTab(option.value)}
              className={cx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
                tab === option.value
                  ? 'bg-pine-700 text-white shadow-sm'
                  : 'text-ink-muted hover:bg-sand-100 hover:text-ink',
              )}
            >
              {option.label}
              <span
                className={cx(
                  'rounded-full px-1.5 text-[10px]',
                  tab === option.value
                    ? 'bg-white/20 text-white'
                    : 'bg-sand-100 text-ink-soft',
                )}
              >
                {option.count}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-soft">
          Images live in <span className="font-mono">HomeOps / Spaces</span> in your Google Drive.
        </p>
      </div>

      {visibleRooms.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={tab === 'room' ? ImageIcon : LayoutGrid}
            title={tab === 'room' ? 'No room photos yet' : 'No floor plans yet'}
            description={
              tab === 'room'
                ? 'Start with the rooms you would want a house sitter to find: kitchen, utility room, primary bath.'
                : 'Upload the builder’s plan, a hand-drawn sketch, or a labeled emergency shutoff map.'
            }
            action={
              <Button onClick={openNew}>
                <Plus size={16} /> Add {tab === 'room' ? 'a room' : 'a floor plan'}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <RoomModal
        open={modalOpen}
        room={editingRoom}
        defaultKind={tab}
        propertyId={property?.id}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
