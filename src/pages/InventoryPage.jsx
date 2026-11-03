import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Armchair,
  BadgeCheck,
  Bike,
  Boxes,
  Camera,
  CircleDollarSign,
  Gem,
  Layers,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Receipt,
  Search,
  Shirt,
  Sparkles,
  Trash2,
  Trees,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Wrench,
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
  Textarea,
} from '../components/ui';
import { useDriveObjectUrl } from '../hooks/useDriveObjectUrl';
import { MAX_IMAGE_BYTES } from '../lib/constants';
import { formatDate } from '../lib/date';
import {
  addItem as addItemRecord,
  addItems,
  db,
  deleteItem as deleteItemRecord,
  getPrimaryProperty,
  updateItem as updateItemRecord,
} from '../lib/db';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CONDITIONS,
  INVENTORY_ROOMS,
  INVENTORY_STATUSES,
  STARTER_GROUPS,
  STARTER_ITEMS,
  categoryLabel,
  documentedValue,
  downloadInventoryCsv,
  findStarterByName,
  formatCurrency,
  itemTotalValue,
  itemUnitValue,
  starterItemsFor,
  starterToItem,
  statusLabel,
  warrantyInfo,
} from '../lib/inventory';
import { trashDriveFile, uploadDriveFile } from '../lib/syncService';
import { cx, formatBytes } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

const CATEGORY_ICONS = {
  electronics: Tv,
  appliances: WashingMachine,
  furniture: Armchair,
  kitchen: UtensilsCrossed,
  tools: Wrench,
  outdoor: Trees,
  clothing: Shirt,
  valuables: Gem,
  sports: Bike,
  safety: BadgeCheck,
  other: Package,
};

const inputDate = (value) => (value ? String(value).slice(0, 10) : '');

function blankItem() {
  return {
    name: '',
    category: 'electronics',
    room: 'Living room',
    quantity: '1',
    brand: '',
    model: '',
    serialNumber: '',
    condition: 'good',
    purchaseDate: '',
    purchasePrice: '',
    replacementValue: '',
    warrantyUntil: '',
    notes: '',
    status: 'owned',
  };
}

function formFromItem(item) {
  return {
    name: item.name ?? '',
    category: item.category ?? 'other',
    room: item.room ?? 'Whole home',
    quantity: String(item.quantity ?? 1),
    brand: item.brand ?? '',
    model: item.model ?? '',
    serialNumber: item.serialNumber ?? '',
    condition: item.condition ?? 'good',
    purchaseDate: inputDate(item.purchaseDate),
    purchasePrice: item.purchasePrice ?? '',
    replacementValue: item.replacementValue ?? '',
    warrantyUntil: inputDate(item.warrantyUntil),
    notes: item.notes ?? '',
    status: item.status ?? 'owned',
  };
}

function SummaryTile({ label, value, hint, icon: Icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-muted">
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-ink-soft">{hint}</p>
    </Card>
  );
}

function ItemThumb({ item }) {
  const { url, loading } = useDriveObjectUrl(item.driveFileId);
  const Icon = CATEGORY_ICONS[item.category] ?? Package;

  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-sand-100 text-pine-700 ring-1 ring-sand-200">
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <Icon size={20} />
      )}
    </span>
  );
}

/* --------------------------------------------------------- Starter picker */

function StarterModal({ open, propertyId, ownedNames, onClose }) {
  const pushToast = useUiStore((state) => state.pushToast);

  const [group, setGroup] = useState('essentials');
  const [picked, setPicked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setGroup('essentials');
    setPicked(new Set());
    setSaving(false);
    setError('');
  }, [open]);

  const options = useMemo(() => starterItemsFor(group), [group]);
  const available = useMemo(
    () => options.filter((item) => !ownedNames.has(item.name.toLowerCase())),
    [options, ownedNames],
  );
  const chosen = available.filter((item) => picked.has(item.name));
  const total = chosen.reduce((sum, item) => sum + item.value * (item.quantity ?? 1), 0);
  const allPicked = available.length > 0 && chosen.length === available.length;

  const toggle = (name) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setError('');
  };

  const toggleAll = () => {
    setPicked((current) => {
      if (allPicked) return new Set();
      const next = new Set(current);
      available.forEach((item) => next.add(item.name));
      return next;
    });
  };

  const handleAdd = async () => {
    if (chosen.length === 0) {
      setError('Pick at least one item, or switch to another room.');
      return;
    }
    setSaving(true);
    try {
      const count = await addItems(propertyId, chosen.map(starterToItem));
      pushToast(
        `${count} ${count === 1 ? 'item' : 'items'} added. Add serial numbers and receipts whenever you like.`,
      );
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Could not add those items.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add common household items"
      description="Pick a room, choose what you own, and edit the details later. Values are typical replacement costs."
      footer={
        <>
          <span className="mr-auto hidden text-xs text-ink-soft sm:block">
            {chosen.length > 0
              ? `${chosen.length} selected · ${formatCurrency(total)} replacement value`
              : 'Nothing selected yet'}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={saving} disabled={chosen.length === 0}>
            {saving
              ? 'Adding…'
              : chosen.length === 1
                ? 'Add 1 item'
                : `Add ${chosen.length} items`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-pine-100 bg-pine-50/70 px-3.5 py-3">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-pine-700" />
          <p className="text-xs leading-relaxed text-pine-800">
            This is the same room-by-room list insurers recommend. Start with the essentials, then
            fill in the rooms you use most. You can rename, revalue, or delete anything.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs text-clay-800"
          >
            {error}
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {STARTER_GROUPS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setGroup(option.key)}
              className={cx(
                'inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition',
                group === option.key
                  ? 'border-pine-700 bg-pine-700 text-white'
                  : 'border-sand-200 bg-white text-ink-muted hover:border-pine-200 hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-soft">
            {available.length} {available.length === 1 ? 'item' : 'items'} available in this group
          </p>
          <button
            type="button"
            onClick={toggleAll}
            disabled={available.length === 0}
            className="text-[11px] font-medium text-pine-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allPicked ? 'Clear selection' : 'Select all'}
          </button>
        </div>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {options.map((item) => {
            const already = ownedNames.has(item.name.toLowerCase());
            const checked = picked.has(item.name);
            return (
              <label
                key={item.name}
                className={cx(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                  already
                    ? 'cursor-not-allowed border-sand-200 bg-sand-50/60 opacity-60'
                    : checked
                      ? 'border-pine-300 bg-pine-50/60'
                      : 'border-sand-200 bg-white hover:border-pine-200',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-sand-300 accent-pine-700"
                  checked={checked}
                  disabled={already}
                  onChange={() => toggle(item.name)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                  <span className="block text-[11px] text-ink-soft">
                    {item.quantity ? `${item.quantity} × ` : ''}
                    {formatCurrency(item.value)} suggested · {categoryLabel(item.category)}
                  </span>
                </span>
                {already && <Badge tone="neutral">Added</Badge>}
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Item form */

function ItemModal({ open, item, propertyId, roomOptions, onClose }) {
  const pushToast = useUiStore((state) => state.pushToast);
  const existingPhoto = useDriveObjectUrl(item?.driveFileId);

  const [form, setForm] = useState(blankItem);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(item ? formFromItem(item) : blankItem());
    setFile(null);
    setSaving(false);
    setError('');
  }, [open, item]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  };

  /**
   * Naming an item from the catalogue ("Refrigerator") fills the category,
   * room and a typical value so the common case is one keystroke away.
   */
  const handleName = (value) => {
    setForm((current) => {
      const next = { ...current, name: value };
      const match = findStarterByName(value);
      if (match) {
        next.category = match.category;
        next.room = match.room;
        if (!current.replacementValue) next.replacementValue = String(match.value);
        if (!current.quantity || current.quantity === '1') {
          next.quantity = String(match.quantity ?? 1);
        }
      }
      return next;
    });
    setError('');
  };

  const chooseFile = (nextFile) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setError(
        `That photo is ${formatBytes(nextFile.size)}. The maximum size is ${formatBytes(
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
    if (!form.name.trim()) {
      setError('Give the item a name you will recognize later.');
      return;
    }

    setSaving(true);
    let uploaded = null;
    let saved = false;

    try {
      if (file) {
        uploaded = await uploadDriveFile(file, {
          folder: 'Inventory',
          maxBytes: MAX_IMAGE_BYTES,
        });
      }

      const photoFields = uploaded
        ? {
            driveFileId: uploaded.id,
            fileName: uploaded.name,
            fileSize: uploaded.size,
            mimeType: uploaded.mimeType,
          }
        : {};

      const payload = {
        name: form.name,
        category: form.category,
        room: form.room,
        quantity: form.quantity,
        brand: form.brand,
        model: form.model,
        serialNumber: form.serialNumber,
        condition: form.condition,
        purchaseDate: form.purchaseDate,
        purchasePrice: form.purchasePrice,
        replacementValue: form.replacementValue,
        warrantyUntil: form.warrantyUntil,
        notes: form.notes,
        status: form.status,
        ...photoFields,
      };

      if (item) {
        await updateItemRecord(item.id, payload);
        saved = true;

        if (uploaded && item.driveFileId) {
          trashDriveFile(item.driveFileId).catch((trashError) => {
            console.warn('HomeOps: the replaced inventory photo could not be trashed.', trashError);
          });
        }
        pushToast('Item updated.');
      } else {
        await addItemRecord(propertyId, payload);
        saved = true;
        pushToast('Item added to your inventory.');
      }

      onClose();
    } catch (submitError) {
      if (uploaded && !saved) {
        await trashDriveFile(uploaded.id).catch(() => {});
      }
      setError(submitError.message || 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  const shownPhoto = preview || existingPhoto.url;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? 'Edit item' : 'Add an item'}
      description="The more of this you fill in, the easier a claim becomes. Only the name is required."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={saving}>
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs text-clay-800"
          >
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/60 p-3">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-pine-700 ring-1 ring-sand-200">
            {shownPhoto ? (
              <img src={shownPhoto} alt="Item preview" className="h-full w-full object-cover" />
            ) : existingPhoto.loading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Camera size={20} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {file ? file.name : shownPhoto ? 'Replace the photo' : 'Add a photo'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
              One clear photo of the item or its label helps an adjuster. Stored in HomeOps /
              Inventory in your Drive.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <div className="flex shrink-0 items-center gap-1">
            {file && (
              <IconButton label="Remove selected photo" onClick={() => setFile(null)}>
                <X size={15} />
              </IconButton>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
            >
              <Camera size={14} /> Choose
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item" htmlFor="item-name" required className="sm:col-span-2">
            <Input
              id="item-name"
              list="inventory-item-names"
              placeholder="65-inch OLED TV"
              value={form.name}
              onChange={(event) => handleName(event.target.value)}
              autoFocus
            />
            <datalist id="inventory-item-names">
              {STARTER_ITEMS.map((starter) => (
                <option key={starter.name} value={starter.name} />
              ))}
            </datalist>
          </Field>

          <Field label="Room" htmlFor="item-room" hint="Where you would look for it.">
            <Input
              id="item-room"
              list="inventory-room-names"
              placeholder="Living room"
              value={form.room}
              onChange={(event) => update({ room: event.target.value })}
            />
            <datalist id="inventory-room-names">
              {roomOptions.map((room) => (
                <option key={room} value={room} />
              ))}
            </datalist>
          </Field>

          <Field label="Category" htmlFor="item-category">
            <Select
              id="item-category"
              value={form.category}
              onChange={(event) => update({ category: event.target.value })}
            >
              {INVENTORY_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantity" htmlFor="item-quantity">
            <Input
              id="item-quantity"
              type="number"
              min="1"
              max="999"
              inputMode="numeric"
              value={form.quantity}
              onChange={(event) => update({ quantity: event.target.value })}
            />
          </Field>

          <Field label="Condition" htmlFor="item-condition">
            <Select
              id="item-condition"
              value={form.condition}
              onChange={(event) => update({ condition: event.target.value })}
            >
              {INVENTORY_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="rounded-xl border border-sand-200 bg-sand-50/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            What an insurer asks for
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Brand" htmlFor="item-brand">
              <Input
                id="item-brand"
                placeholder="Samsung"
                value={form.brand}
                onChange={(event) => update({ brand: event.target.value })}
              />
            </Field>
            <Field label="Model" htmlFor="item-model">
              <Input
                id="item-model"
                placeholder="QN65S90D"
                value={form.model}
                onChange={(event) => update({ model: event.target.value })}
              />
            </Field>
            <Field
              label="Serial number"
              htmlFor="item-serial"
              hint="Usually on the back, bottom, or the box."
              className="sm:col-span-2"
            >
              <Input
                id="item-serial"
                placeholder="Serial or asset tag"
                value={form.serialNumber}
                onChange={(event) => update({ serialNumber: event.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purchased" htmlFor="item-purchased">
            <Input
              id="item-purchased"
              type="date"
              value={form.purchaseDate}
              onChange={(event) => update({ purchaseDate: event.target.value })}
            />
          </Field>
          <Field label="Price paid (each)" htmlFor="item-price">
            <Input
              id="item-price"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              placeholder="0"
              value={form.purchasePrice}
              onChange={(event) => update({ purchasePrice: event.target.value })}
            />
          </Field>
          <Field
            label="Replacement value (each)"
            htmlFor="item-replacement"
            hint="What it would cost to buy again today."
          >
            <Input
              id="item-replacement"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              placeholder="0"
              value={form.replacementValue}
              onChange={(event) => update({ replacementValue: event.target.value })}
            />
          </Field>
          <Field label="Warranty until" htmlFor="item-warranty">
            <Input
              id="item-warranty"
              type="date"
              value={form.warrantyUntil}
              onChange={(event) => update({ warrantyUntil: event.target.value })}
            />
          </Field>
        </div>

        <Field
          label="Where is it now?"
          htmlFor="item-status"
          hint="Sold, donated, or discarded items stay in the record but leave your totals."
        >
          <Select
            id="item-status"
            value={form.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            {INVENTORY_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes" htmlFor="item-notes" hint="Receipt location, repairs, who it belongs to.">
          <Textarea
            id="item-notes"
            placeholder="Receipt in the warranty folder. Bought during the 2024 remodel."
            value={form.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------------- Row */

function ItemRow({ item, onEdit, onDelete }) {
  const removed = item.status !== 'owned';
  const warranty = warrantyInfo(item);
  const quantity = Math.max(1, Number(item.quantity) || 1);

  return (
    <article
      className={cx(
        'flex gap-3 px-4 py-3.5 transition hover:bg-sand-50/50 sm:px-5',
        removed && 'opacity-60',
      )}
    >
      <ItemThumb item={item} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate text-sm font-medium text-ink">
            {item.name}
            {quantity > 1 && <span className="ml-1.5 text-xs text-ink-soft">×{quantity}</span>}
          </h3>
          {removed && <Badge tone="clay">{statusLabel(item.status)}</Badge>}
        </div>

        {(item.brand || item.model || item.serialNumber) && (
          <p className="mt-0.5 truncate text-[11px] text-ink-soft">
            {[item.brand, item.model].filter(Boolean).join(' · ')}
            {item.serialNumber
              ? `${item.brand || item.model ? ' · ' : ''}S/N ${item.serialNumber}`
              : ''}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{item.room}</Badge>
          <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
          {warranty.state === 'expiring' && (
            <Badge tone="amber">
              Warranty ends {formatDate(item.warrantyUntil, { month: 'short', year: 'numeric' })}
            </Badge>
          )}
          {warranty.state === 'expired' && <Badge tone="neutral">Warranty ended</Badge>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold text-ink">{formatCurrency(itemTotalValue(item))}</p>
        {quantity > 1 && (
          <p className="-mt-1 text-[10px] text-ink-soft">
            {quantity} × {formatCurrency(itemUnitValue(item))}
          </p>
        )}
        <div className="flex items-center gap-0.5">
          <IconButton label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton label={`Delete ${item.name}`} tone="danger" onClick={() => onDelete(item)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------- Page */

export default function InventoryPage() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const items = useLiveQuery(() => db.items.toArray(), []) ?? [];
  const spaces = useLiveQuery(() => db.rooms.toArray(), []) ?? [];
  const pushToast = useUiStore((state) => state.pushToast);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [room, setRoom] = useState('all');
  const [showRemoved, setShowRemoved] = useState(false);
  const [groupByRoom, setGroupByRoom] = useState(true);
  const [starterOpen, setStarterOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const ownedDiff = (a.status === 'owned' ? 0 : 1) - (b.status === 'owned' ? 0 : 1);
        if (ownedDiff !== 0) return ownedDiff;
        return (
          String(a.room ?? '').localeCompare(String(b.room ?? '')) ||
          String(a.name ?? '').localeCompare(String(b.name ?? ''))
        );
      }),
    [items],
  );

  const ownedItems = useMemo(() => items.filter((item) => item.status === 'owned'), [items]);
  const totalValue = documentedValue(items);
  const roomsCovered = new Set(ownedItems.map((item) => item.room).filter(Boolean)).size;
  const expiringWarranties = ownedItems.filter(
    (item) => warrantyInfo(item).state === 'expiring',
  ).length;

  const ownedNames = useMemo(
    () => new Set(ownedItems.map((item) => String(item.name).toLowerCase())),
    [ownedItems],
  );

  const roomOptions = useMemo(() => {
    const names = new Set([
      ...INVENTORY_ROOMS,
      ...items.map((item) => item.room).filter(Boolean),
      ...spaces.map((space) => space.name).filter(Boolean),
    ]);
    return [...names];
  }, [items, spaces]);

  const visible = useMemo(
    () => (showRemoved ? sorted : sorted.filter((item) => item.status === 'owned')),
    [sorted, showRemoved],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return visible.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      const matchesRoom = room === 'all' || item.room === room;
      const matchesTerm =
        !term ||
        [item.name, item.brand, item.model, item.serialNumber, item.room, item.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)) ||
        categoryLabel(item.category).toLowerCase().includes(term);
      return matchesCategory && matchesRoom && matchesTerm;
    });
  }, [visible, query, category, room]);

  const grouped = groupByRoom && room === 'all';
  const groups = useMemo(() => {
    if (!grouped) return [{ key: 'all', room: null, items: filtered }];
    const map = new Map();
    for (const item of filtered) {
      const key = item.room || 'Whole home';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()].map(([name, list]) => ({ key: name, room: name, items: list }));
  }, [filtered, grouped]);

  const filteredValue = documentedValue(filtered);

  const openNew = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Delete “${item.name}” from your inventory?${
        item.driveFileId ? ' Its photo will move to your Google Drive trash.' : ''
      }`,
    );
    if (!confirmed) return;

    try {
      await deleteItemRecord(item.id);
    } catch (error) {
      pushToast(error.message || 'Could not delete this item.', 'error');
      return;
    }

    try {
      if (item.driveFileId) await trashDriveFile(item.driveFileId);
      pushToast('Item deleted.');
    } catch (error) {
      pushToast('The item was removed, but the Drive photo could not be trashed.', 'error');
    }
  };

  const handleExport = () => {
    if (items.length === 0) {
      pushToast('Add an item before exporting your inventory.', 'info');
      return;
    }
    downloadInventoryCsv(sorted, property?.address ?? 'Home');
    pushToast(`Inventory exported: ${items.length} items, ${formatCurrency(totalValue)} documented.`);
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setRoom('all');
    setShowRemoved(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="The inventory"
        title="Everything you own, accounted for."
        description="A room-by-room record of what is in the home, what it is worth, and where the proof lives. Built for insurance claims, moves, and the occasional “did we already own one of these?”"
        actions={
          <>
            <Button variant="secondary" onClick={handleExport} disabled={items.length === 0}>
              <Receipt size={16} /> Export CSV
            </Button>
            <Button variant="secondary" onClick={() => setStarterOpen(true)}>
              <PackagePlus size={16} /> Common items
            </Button>
            <Button onClick={openNew}>
              <Plus size={16} /> Add item
            </Button>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryTile
          icon={Boxes}
          label="Items tracked"
          value={ownedItems.length}
          hint={
            items.length > ownedItems.length
              ? `${items.length - ownedItems.length} removed from the home`
              : 'Everything currently in the home'
          }
        />
        <SummaryTile
          icon={CircleDollarSign}
          label="Documented value"
          value={formatCurrency(totalValue)}
          hint="Replacement cost, quantity included"
        />
        <SummaryTile
          icon={Layers}
          label="Rooms covered"
          value={roomsCovered}
          hint={`${STARTER_ITEMS.length} common items in the catalogue`}
        />
        <SummaryTile
          icon={BadgeCheck}
          label="Warranties ending"
          value={expiringWarranties}
          hint="In the next 90 days"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <Input
            type="search"
            placeholder="Search name, brand, serial, room…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
            aria-label="Search inventory"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className="h-10 max-w-[10.5rem] text-xs"
          >
            <option value="all">All categories</option>
            {INVENTORY_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            aria-label="Filter by room"
            className="h-10 max-w-[9rem] text-xs"
          >
            <option value="all">All rooms</option>
            {[...new Set(items.map((item) => item.room).filter(Boolean))]
              .sort((a, b) => a.localeCompare(b))
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </Select>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-sand-300 accent-pine-700"
              checked={showRemoved}
              onChange={(event) => setShowRemoved(event.target.checked)}
            />
            Show removed
          </label>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Boxes}
            title="Start with the things that would be painful to replace"
            description="The catalogue fills in appliances, electronics, furniture, tools, and valuables by room — with typical replacement values you can adjust. Add the essentials in one go and worry about the small stuff later."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setStarterOpen(true)}>
                  <Sparkles size={16} /> Add the essentials
                </Button>
                <Button variant="secondary" onClick={openNew}>
                  <Plus size={16} /> Add one item
                </Button>
              </div>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Search}
            title="No items match"
            description="Try a different search term, room, or category — or include items you have removed from the home."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-soft">
              {filtered.length} of {visible.length} {visible.length === 1 ? 'item' : 'items'}
              {filteredValue > 0 && ` · ${formatCurrency(filteredValue)} documented`}
            </p>
            {room === 'all' && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-ink-soft">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-sand-300 accent-pine-700"
                  checked={groupByRoom}
                  onChange={(event) => setGroupByRoom(event.target.checked)}
                />
                Group by room
              </label>
            )}
          </div>

          {groups.map((group) => (
            <section key={group.key} className="mt-4">
              {group.room && (
                <header className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h2 className="text-sm font-semibold text-ink">{group.room}</h2>
                  <span className="text-[10px] text-ink-soft">
                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'} ·{' '}
                    {formatCurrency(
                      group.items.reduce((sum, entry) => sum + itemTotalValue(entry), 0),
                    )}
                  </span>
                </header>
              )}
              <Card className="divide-y divide-sand-100 overflow-hidden">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </Card>
            </section>
          ))}
        </>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sand-200 bg-white/60 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine-700">
          <Receipt size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Built for the day you have to make a claim.</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Photograph high-value items, note their serial numbers, and file receipts and warranties
            in the{' '}
            <Link
              to="/documents"
              className="font-medium text-pine-700 underline-offset-2 hover:underline"
            >
              document vault
            </Link>
            . The CSV export opens in any spreadsheet and lists every field an adjuster asks for.
          </p>
        </div>
      </div>

      <StarterModal
        open={starterOpen}
        propertyId={property?.id}
        ownedNames={ownedNames}
        onClose={() => setStarterOpen(false)}
      />

      <ItemModal
        open={modalOpen}
        item={editingItem}
        propertyId={property?.id}
        roomOptions={roomOptions}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
