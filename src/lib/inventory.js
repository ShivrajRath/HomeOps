import { dayDiff, todayYMD } from './date';

/**
 * Home inventory reference data.
 *
 * Insurance guidance (NAIC, state insurance departments, and most carriers)
 * agrees on the details that make a claim easy: what the item is, where it
 * lives, brand/model/serial number, when and for how much it was bought, what
 * it would cost to replace today, and proof such as a photo or receipt.
 *
 * The starter catalogue exists so a first inventory can be built by tapping
 * common items instead of typing every one from scratch. Suggested values are
 * typical replacement costs, not quotes — they are editable on every record.
 */

export const INVENTORY_CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'appliances', label: 'Appliances' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'kitchen', label: 'Kitchen & dining' },
  { value: 'tools', label: 'Tools & DIY' },
  { value: 'outdoor', label: 'Outdoor & garden' },
  { value: 'clothing', label: 'Clothing & linens' },
  { value: 'valuables', label: 'Jewelry & valuables' },
  { value: 'sports', label: 'Sports & hobbies' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

export const INVENTORY_ROOMS = [
  'Kitchen',
  'Living room',
  'Dining room',
  'Primary bedroom',
  'Bedroom',
  'Bathroom',
  'Home office',
  'Laundry room',
  'Garage',
  'Basement',
  'Attic',
  'Storage',
  'Outdoors',
  'Whole home',
];

export const INVENTORY_CONDITIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export const INVENTORY_STATUSES = [
  { value: 'owned', label: 'In the home' },
  { value: 'sold', label: 'Sold' },
  { value: 'donated', label: 'Donated' },
  { value: 'discarded', label: 'Discarded' },
  { value: 'lost', label: 'Lost or stolen' },
];

export const STARTER_ITEMS = [
  // Kitchen
  { name: 'Refrigerator', category: 'appliances', room: 'Kitchen', value: 1800, essentials: true },
  { name: 'Range / oven', category: 'appliances', room: 'Kitchen', value: 1100, essentials: true },
  { name: 'Dishwasher', category: 'appliances', room: 'Kitchen', value: 800, essentials: true },
  { name: 'Microwave', category: 'appliances', room: 'Kitchen', value: 250 },
  { name: 'Coffee maker', category: 'kitchen', room: 'Kitchen', value: 150 },
  { name: 'Stand mixer', category: 'kitchen', room: 'Kitchen', value: 350 },
  { name: 'Cookware set', category: 'kitchen', room: 'Kitchen', value: 300 },
  { name: 'Dinnerware set', category: 'kitchen', room: 'Kitchen', value: 150 },
  { name: 'Knife set', category: 'kitchen', room: 'Kitchen', value: 200 },

  // Living room
  { name: 'Sofa', category: 'furniture', room: 'Living room', value: 1200, essentials: true },
  { name: 'Coffee table', category: 'furniture', room: 'Living room', value: 350 },
  { name: 'Television', category: 'electronics', room: 'Living room', value: 700, essentials: true },
  { name: 'Soundbar', category: 'electronics', room: 'Living room', value: 250 },
  { name: 'Area rug', category: 'furniture', room: 'Living room', value: 400 },
  { name: 'Floor lamp', category: 'furniture', room: 'Living room', value: 120 },
  { name: 'Bookshelf', category: 'furniture', room: 'Living room', value: 250 },
  { name: 'Gaming console', category: 'electronics', room: 'Living room', value: 500 },
  { name: 'Smart speaker', category: 'electronics', room: 'Living room', value: 100 },
  { name: 'Musical instrument', category: 'sports', room: 'Living room', value: 600 },
  { name: 'Artwork', category: 'valuables', room: 'Living room', value: 800 },

  // Dining room
  { name: 'Dining table', category: 'furniture', room: 'Dining room', value: 800, essentials: true },
  { name: 'Dining chairs', category: 'furniture', room: 'Dining room', value: 150, quantity: 4 },

  // Bedrooms
  { name: 'Mattress', category: 'furniture', room: 'Primary bedroom', value: 1000, essentials: true },
  { name: 'Bed frame', category: 'furniture', room: 'Primary bedroom', value: 600 },
  { name: 'Dresser', category: 'furniture', room: 'Primary bedroom', value: 500 },
  { name: 'Nightstand', category: 'furniture', room: 'Primary bedroom', value: 200 },
  { name: 'Bedding set', category: 'clothing', room: 'Primary bedroom', value: 150 },
  { name: 'Jewelry collection', category: 'valuables', room: 'Primary bedroom', value: 1500, essentials: true },
  { name: 'Watch', category: 'valuables', room: 'Primary bedroom', value: 500 },
  { name: 'Home safe', category: 'valuables', room: 'Primary bedroom', value: 400 },
  { name: 'Treadmill', category: 'sports', room: 'Bedroom', value: 1200 },

  // Bathroom
  { name: 'Bath towels', category: 'clothing', room: 'Bathroom', value: 15, quantity: 6 },
  { name: 'Hair dryer', category: 'electronics', room: 'Bathroom', value: 80 },
  { name: 'Bath mat', category: 'clothing', room: 'Bathroom', value: 40 },

  // Laundry
  { name: 'Washer', category: 'appliances', room: 'Laundry room', value: 900, essentials: true },
  { name: 'Dryer', category: 'appliances', room: 'Laundry room', value: 800, essentials: true },
  { name: 'Vacuum cleaner', category: 'appliances', room: 'Laundry room', value: 350 },
  { name: 'Robot vacuum', category: 'appliances', room: 'Laundry room', value: 400 },

  // Home office
  { name: 'Laptop', category: 'electronics', room: 'Home office', value: 1200, essentials: true },
  { name: 'Monitor', category: 'electronics', room: 'Home office', value: 300 },
  { name: 'Printer', category: 'electronics', room: 'Home office', value: 200 },
  { name: 'Desk', category: 'furniture', room: 'Home office', value: 500 },
  { name: 'Office chair', category: 'furniture', room: 'Home office', value: 350 },

  // Garage and tools
  { name: 'Cordless drill', category: 'tools', room: 'Garage', value: 180 },
  { name: 'Hand tool set', category: 'tools', room: 'Garage', value: 250 },
  { name: 'Ladder', category: 'tools', room: 'Garage', value: 150 },
  { name: 'Lawn mower', category: 'outdoor', room: 'Garage', value: 450, essentials: true },
  { name: 'Bicycle', category: 'sports', room: 'Garage', value: 700 },

  // Outdoors
  { name: 'Patio set', category: 'outdoor', room: 'Outdoors', value: 700 },
  { name: 'Grill', category: 'outdoor', room: 'Outdoors', value: 500 },
  { name: 'Garden hose', category: 'outdoor', room: 'Outdoors', value: 60 },

  // Whole home
  { name: 'Wi-Fi router', category: 'electronics', room: 'Whole home', value: 200 },
  { name: 'Air purifier', category: 'appliances', room: 'Whole home', value: 250 },
  { name: 'Space heater', category: 'appliances', room: 'Whole home', value: 100 },
  { name: 'Smoke detectors', category: 'safety', room: 'Whole home', value: 40, quantity: 4, essentials: true },
  { name: 'Carbon monoxide detector', category: 'safety', room: 'Whole home', value: 40 },
  { name: 'Fire extinguisher', category: 'safety', room: 'Whole home', value: 60 },
  { name: 'First aid kit', category: 'safety', room: 'Whole home', value: 50 },
  { name: 'Dehumidifier', category: 'appliances', room: 'Basement', value: 250 },

  // Storage
  { name: 'Holiday decorations', category: 'other', room: 'Storage', value: 400 },
  { name: 'Suitcases', category: 'other', room: 'Storage', value: 300 },
  { name: 'Camping gear', category: 'sports', room: 'Storage', value: 500 },
  { name: 'Collectibles', category: 'valuables', room: 'Storage', value: 600 },
];

export const ESSENTIAL_ITEMS = STARTER_ITEMS.filter((item) => item.essentials);

/** Rooms that actually have entries in the starter catalogue, in a sensible order. */
export const STARTER_ROOMS = [
  'Living room',
  'Kitchen',
  'Primary bedroom',
  'Bedroom',
  'Bathroom',
  'Dining room',
  'Home office',
  'Laundry room',
  'Garage',
  'Outdoors',
  'Storage',
  'Basement',
  'Whole home',
].filter((room) => STARTER_ITEMS.some((item) => item.room === room));

export const STARTER_GROUPS = [
  { key: 'essentials', label: 'Whole-home essentials' },
  ...STARTER_ROOMS.map((room) => ({ key: room, label: room })),
];

export function starterItemsFor(group) {
  if (group === 'essentials') return ESSENTIAL_ITEMS;
  return STARTER_ITEMS.filter((item) => item.room === group);
}

/** Find a catalogue entry by its exact (case-insensitive) name. */
export function findStarterByName(name) {
  const term = String(name ?? '').trim().toLowerCase();
  if (!term) return null;
  return STARTER_ITEMS.find((item) => item.name.toLowerCase() === term) ?? null;
}

/** Shape a catalogue pick into an item ready for db.addItems(). */
export function starterToItem(starter) {
  return {
    name: starter.name,
    category: starter.category,
    room: starter.room,
    quantity: starter.quantity ?? 1,
    replacementValue: starter.value,
  };
}

export function categoryLabel(value) {
  return INVENTORY_CATEGORIES.find((category) => category.value === value)?.label ?? 'Other';
}

export function conditionLabel(value) {
  return INVENTORY_CONDITIONS.find((condition) => condition.value === value)?.label ?? '—';
}

export function statusLabel(value) {
  return INVENTORY_STATUSES.find((status) => status.value === value)?.label ?? 'In the home';
}

export function isOwned(item) {
  return (item?.status ?? 'owned') === 'owned';
}

export function itemUnitValue(item) {
  return Number(item?.replacementValue) || Number(item?.purchasePrice) || 0;
}

export function itemTotalValue(item) {
  const quantity = Math.max(1, Number(item?.quantity) || 1);
  return itemUnitValue(item) * quantity;
}

/** Replacement value of everything still in the home (quantity included). */
export function documentedValue(items = []) {
  return items
    .filter(isOwned)
    .reduce((sum, item) => sum + itemTotalValue(item), 0);
}

/**
 * Warranty state relative to today. Anything inside 90 days counts as
 * expiring so the dashboard can nudge before the coverage disappears.
 */
export function warrantyInfo(item, today = todayYMD()) {
  if (!item?.warrantyUntil) return { state: 'none', days: null };
  const days = dayDiff(item.warrantyUntil, today);
  if (days < 0) return { state: 'expired', days };
  if (days <= 90) return { state: 'expiring', days };
  return { state: 'active', days };
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatCurrency(value) {
  return currency.format(Number(value) || 0);
}

/* ------------------------------------------------------------------- CSV */

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Insurance-friendly export: one row per item, with the fields a claims
 * adjuster asks for and the current total replacement value.
 */
export function inventoryToCsv(items = []) {
  const headers = [
    'Item',
    'Category',
    'Room',
    'Quantity',
    'Brand',
    'Model',
    'Serial number',
    'Condition',
    'Purchased',
    'Purchase price',
    'Replacement value (each)',
    'Total replacement value',
    'Warranty until',
    'Status',
    'Notes',
  ];

  const lines = items.map((item) =>
    [
      item.name,
      categoryLabel(item.category),
      item.room,
      item.quantity ?? 1,
      item.brand,
      item.model,
      item.serialNumber,
      conditionLabel(item.condition),
      item.purchaseDate,
      item.purchasePrice,
      item.replacementValue,
      itemTotalValue(item) || null,
      item.warrantyUntil,
      statusLabel(item.status),
      item.notes,
    ]
      .map(csvCell)
      .join(','),
  );

  return [headers.join(','), ...lines].join('\r\n');
}

export function downloadInventoryCsv(items, address = 'home') {
  const csv = inventoryToCsv(items);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `home-inventory-${todayYMD()}.csv`;
  anchor.title = `${address} inventory`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
