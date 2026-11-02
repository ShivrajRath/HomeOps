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
 * four tables whenever a change settles.
 */
export const db = new Dexie(DB_NAME);

db.version(1).stores({
  properties: '++id, address, yearBuilt, sqft, createdAt',
  rooms: '++id, propertyId, name, driveFileId',
  tasks: '++id, propertyId, title, category, frequency, nextDueDate, status',
  documents: '++id, propertyId, title, category, driveFileId, uploadedAt',
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

/* ------------------------------------------------------------ Sync payload */

/**
 * Serialize every table into the exact shape written to
 * basekeep_backup.json in Google Drive's hidden app data folder.
 */
export async function exportDatabase() {
  const [properties, rooms, tasks, documents] = await Promise.all([
    db.properties.orderBy('id').toArray(),
    db.rooms.orderBy('id').toArray(),
    db.tasks.orderBy('id').toArray(),
    db.documents.orderBy('id').toArray(),
  ]);

  return {
    app: 'HomeOps',
    schemaVersion: 1,
    exportedAt: nowISO(),
    data: { properties, rooms, tasks, documents },
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
  };

  await db.transaction('rw', db.properties, db.rooms, db.tasks, db.documents, async () => {
    await db.documents.clear();
    await db.tasks.clear();
    await db.rooms.clear();
    await db.properties.clear();

    if (next.properties.length) await db.properties.bulkPut(next.properties);
    if (next.rooms.length) await db.rooms.bulkPut(next.rooms);
    if (next.tasks.length) await db.tasks.bulkPut(next.tasks);
    if (next.documents.length) await db.documents.bulkPut(next.documents);
  });

  return next;
}

export async function clearDatabase() {
  await db.transaction('rw', db.properties, db.rooms, db.tasks, db.documents, async () => {
    await db.documents.clear();
    await db.tasks.clear();
    await db.rooms.clear();
    await db.properties.clear();
  });
}

export async function isDatabaseEmpty() {
  return (await db.properties.count()) === 0;
}
