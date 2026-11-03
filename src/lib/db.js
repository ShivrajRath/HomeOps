import Dexie from 'dexie';
import { DB_NAME } from './constants';
import { todayYMD } from './date';
import { nextOccurrence } from './recurrence';
import { buildSeedTasks } from './taskTemplates';

/**
 * HomeOps lives in the browser first.
 *
 * Every screen reads from Dexie through useLiveQuery, so a write is visible
 * immediately and works offline. Google Drive receives a JSON backup of these
 * five tables whenever a change settles.
 */
export const db = new Dexie(DB_NAME);

db.version(1).stores({
  properties: '++id, address, yearBuilt, sqft, createdAt',
  rooms: '++id, propertyId, name, driveFileId',
  tasks: '++id, propertyId, title, category, frequency, nextDueDate, status',
  documents: '++id, propertyId, title, category, driveFileId, uploadedAt',
});

// Version 2 adds the home inventory. The earlier version stays declared so
// browsers that already hold data upgrade in place rather than starting over.
db.version(2).stores({
  properties: '++id, address, yearBuilt, sqft, createdAt',
  rooms: '++id, propertyId, name, driveFileId',
  tasks: '++id, propertyId, title, category, frequency, nextDueDate, status',
  documents: '++id, propertyId, title, category, driveFileId, uploadedAt',
  items: '++id, propertyId, name, category, room, warrantyUntil, status, createdAt',
});

const nowISO = () => new Date().toISOString();
const cleanText = (value) => String(value ?? '').trim();
const numberOrNull = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeProperty(values = {}) {
  return {
    address: cleanText(values.address),
    yearBuilt: numberOrNull(values.yearBuilt),
    sqft: numberOrNull(values.sqft),
    hvacType: values.hvacType || 'forced_air',
    waterHeaterType: values.waterHeaterType || 'tank',
    heatingFuel: values.heatingFuel || 'electric',
    hasGutters: Boolean(values.hasGutters),
  };
}

export async function getPrimaryProperty() {
  // `first()` returns undefined both while loading and when no home exists,
  // which is ambiguous for useLiveQuery. Resolve to an array first so an empty
  // database is represented as null, not "still loading".
  const properties = await db.properties.orderBy('createdAt').toArray();
  return properties[0] ?? null;
}

/**
 * Create or update the single home profile. Creating the profile also seeds
 * the starter maintenance plan that matches its systems.
 */
export async function savePropertyProfile(values) {
  const existing = await getPrimaryProperty();
  const payload = normalizeProperty(values);

  if (existing) {
    await db.properties.update(existing.id, payload);
    return { ...existing, ...payload };
  }

  const createdAt = nowISO();
  const id = await db.properties.add({ ...payload, createdAt });
  const property = { id, ...payload, createdAt };
  const starterTasks = buildSeedTasks(property, []);
  if (starterTasks.length > 0) {
    await db.tasks.bulkAdd(starterTasks);
  }
  return property;
}

export async function addTask(propertyId, values = {}) {
  if (!propertyId) throw new Error('Create your property profile first.');

  const title = cleanText(values.title);
  if (!title) throw new Error('Give the task a short, clear name.');

  const task = {
    propertyId,
    title,
    description: cleanText(values.description) || null,
    category: values.category || 'cleaning',
    frequency: values.frequency || 'weekly',
    nextDueDate: values.nextDueDate || todayYMD(),
    status: values.status || 'active',
    createdAt: nowISO(),
  };

  const id = await db.tasks.add(task);
  return { id, ...task };
}

export async function updateTask(id, patch = {}) {
  const updates = {};

  for (const key of ['title', 'description', 'category', 'frequency', 'nextDueDate', 'status']) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }

  if (updates.title !== undefined) {
    updates.title = cleanText(updates.title);
    if (!updates.title) throw new Error('Give the task a short, clear name.');
  }
  if (updates.description !== undefined) {
    updates.description = cleanText(updates.description) || null;
  }

  await db.tasks.update(id, updates);
  return db.tasks.get(id);
}

export async function deleteTask(id) {
  await db.tasks.delete(id);
}

/**
 * A recurring task has no permanent "done" state: completing it rolls the
 * next due date forward so the plan never runs dry.
 */
export async function completeTask(task) {
  const nextDueDate = nextOccurrence(task.nextDueDate, task.frequency);
  const lastCompletedAt = nowISO();
  await db.tasks.update(task.id, { nextDueDate, lastCompletedAt });
  return { ...task, nextDueDate, lastCompletedAt };
}

export async function seedMissingTasks(property) {
  const target = property ?? (await getPrimaryProperty());
  if (!target) throw new Error('Create your property profile first.');

  const existing = await db.tasks.where('propertyId').equals(target.id).toArray();
  const seed = buildSeedTasks(
    target,
    existing.map((task) => task.title),
  );
  if (seed.length === 0) return 0;

  await db.tasks.bulkAdd(seed);
  return seed.length;
}

export async function addRoomRecord({
  propertyId,
  name,
  kind = 'room',
  driveFileId,
  fileName = null,
  fileSize = null,
  mimeType = null,
}) {
  if (!propertyId) throw new Error('Create your property profile first.');
  if (!driveFileId) throw new Error('The image did not finish uploading to Google Drive.');

  const room = {
    propertyId,
    name: cleanText(name),
    kind,
    driveFileId,
    fileName,
    fileSize,
    mimeType,
    createdAt: nowISO(),
  };

  const id = await db.rooms.add(room);
  return { id, ...room };
}

export async function updateRoomRecord(id, patch = {}) {
  const updates = {};
  for (const key of [
    'name',
    'kind',
    'driveFileId',
    'fileName',
    'fileSize',
    'mimeType',
  ]) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  if (updates.name !== undefined) updates.name = cleanText(updates.name);
  await db.rooms.update(id, updates);
  return db.rooms.get(id);
}

export async function deleteRoomRecord(id) {
  await db.rooms.delete(id);
}

export async function addDocumentRecord({
  propertyId,
  title,
  category = 'Other',
  driveFileId,
  fileName = null,
  fileSize = null,
  mimeType = null,
}) {
  if (!propertyId) throw new Error('Create your property profile first.');
  if (!driveFileId) throw new Error('The file did not finish uploading to Google Drive.');

  const document = {
    propertyId,
    title: cleanText(title) || 'Untitled document',
    category,
    driveFileId,
    fileName,
    fileSize,
    mimeType,
    uploadedAt: nowISO(),
  };

  const id = await db.documents.add(document);
  return { id, ...document };
}

export async function deleteDocumentRecord(id) {
  await db.documents.delete(id);
}

/* -------------------------------------------------------------- Inventory */

const ITEM_CONDITIONS = ['excellent', 'good', 'fair', 'poor'];
const ITEM_STATUSES = ['owned', 'sold', 'donated', 'discarded', 'lost'];

function quantityOrOne(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, 999) : 1;
}

function moneyOrNull(value) {
  const number = numberOrNull(value);
  return number != null && number >= 0 ? number : null;
}

function dateOrNull(value) {
  const text = cleanText(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/** Clean an inventory form into the shape stored in Dexie. */
export function normalizeItem(values = {}) {
  const name = cleanText(values.name);
  if (!name) throw new Error('Give the item a name you will recognize later.');

  const status = ITEM_STATUSES.includes(values.status) ? values.status : 'owned';

  return {
    name,
    category: values.category || 'other',
    room: cleanText(values.room) || 'Whole home',
    quantity: quantityOrOne(values.quantity),
    brand: cleanText(values.brand) || null,
    model: cleanText(values.model) || null,
    serialNumber: cleanText(values.serialNumber) || null,
    condition: ITEM_CONDITIONS.includes(values.condition) ? values.condition : 'good',
    purchaseDate: dateOrNull(values.purchaseDate),
    purchasePrice: moneyOrNull(values.purchasePrice),
    replacementValue: moneyOrNull(values.replacementValue),
    warrantyUntil: dateOrNull(values.warrantyUntil),
    notes: cleanText(values.notes) || null,
    status,
    removedAt: status === 'owned' ? null : dateOrNull(values.removedAt) || todayYMD(),
    driveFileId: values.driveFileId || null,
    fileName: values.fileName || null,
    fileSize: Number(values.fileSize) > 0 ? Number(values.fileSize) : null,
    mimeType: values.mimeType || null,
  };
}

export async function addItem(propertyId, values = {}) {
  if (!propertyId) throw new Error('Create your property profile first.');

  const payload = normalizeItem(values);
  const timestamp = nowISO();
  const item = { propertyId, ...payload, createdAt: timestamp, updatedAt: timestamp };
  const id = await db.items.add(item);
  return { id, ...item };
}

/** Bulk-create starter catalogue picks in one write (and one sync burst). */
export async function addItems(propertyId, list = []) {
  if (!propertyId) throw new Error('Create your property profile first.');

  const timestamp = nowISO();
  const payload = list
    .filter(Boolean)
    .map((values) => normalizeItem(values))
    .map((item) => ({ propertyId, ...item, createdAt: timestamp, updatedAt: timestamp }));

  if (payload.length === 0) return 0;
  await db.items.bulkAdd(payload);
  return payload.length;
}

export async function updateItem(id, patch = {}) {
  const current = await db.items.get(id);
  if (!current) throw new Error('That item is no longer in your inventory.');

  // Merging before normalizing keeps untouched fields intact while still
  // stamping removedAt when an item is sold, donated, or discarded.
  const next = normalizeItem({ ...current, ...patch });
  await db.items.update(id, { ...next, updatedAt: nowISO() });
  return db.items.get(id);
}

export async function deleteItem(id) {
  await db.items.delete(id);
}

/* ------------------------------------------------------------ Sync payload */

/**
 * Serialize every table into the exact shape written to
 * basekeep_backup.json in Google Drive's hidden app data folder.
 */
export async function exportDatabase() {
  const [properties, rooms, tasks, documents, items] = await Promise.all([
    db.properties.orderBy('id').toArray(),
    db.rooms.orderBy('id').toArray(),
    db.tasks.orderBy('id').toArray(),
    db.documents.orderBy('id').toArray(),
    db.items.orderBy('id').toArray(),
  ]);

  return {
    app: 'HomeOps',
    schemaVersion: 2,
    exportedAt: nowISO(),
    data: { properties, rooms, tasks, documents, items },
  };
}

function rows(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];
}

/**
 * Replace the local database with a downloaded backup. Explicit IDs are kept
 * so records stay stable across devices; Dexie advances its auto-increment
 * counters to the highest restored ID.
 */
export async function hydrateDatabase(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('The Google Drive backup is not valid JSON.');
  }

  const source = snapshot.data && typeof snapshot.data === 'object' ? snapshot.data : snapshot;
  const next = {
    properties: rows(source.properties),
    rooms: rows(source.rooms),
    tasks: rows(source.tasks),
    documents: rows(source.documents),
    // Backups written before the inventory existed simply have no items.
    items: rows(source.items),
  };

  await db.transaction(
    'rw',
    db.properties,
    db.rooms,
    db.tasks,
    db.documents,
    db.items,
    async () => {
      await db.items.clear();
      await db.documents.clear();
      await db.tasks.clear();
      await db.rooms.clear();
      await db.properties.clear();

      if (next.properties.length) await db.properties.bulkPut(next.properties);
      if (next.rooms.length) await db.rooms.bulkPut(next.rooms);
      if (next.tasks.length) await db.tasks.bulkPut(next.tasks);
      if (next.documents.length) await db.documents.bulkPut(next.documents);
      if (next.items.length) await db.items.bulkPut(next.items);
    },
  );

  return next;
}

export async function clearDatabase() {
  await db.transaction(
    'rw',
    db.properties,
    db.rooms,
    db.tasks,
    db.documents,
    db.items,
    async () => {
      await db.items.clear();
      await db.documents.clear();
      await db.tasks.clear();
      await db.rooms.clear();
      await db.properties.clear();
    },
  );
}

export async function isDatabaseEmpty() {
  return (await db.properties.count()) === 0;
}
