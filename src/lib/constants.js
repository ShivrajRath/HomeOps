export const APP_NAME = 'HomeOps';
export const APP_TAGLINE = 'Your home, on a schedule.';

// Local-first storage.
export const DB_NAME = 'homeops';

// Google Drive sync.
export const DRIVE_BACKUP_FILE = 'basekeep_backup.json';
export const DRIVE_FOLDER_NAME = 'HomeOps';
export const GOOGLE_SESSION_KEY = 'homeops.google.session';
export const DRIVE_OWNER_KEY = 'homeops.drive.owner';
export const DRIVE_LAST_SYNC_KEY = 'homeops.drive.lastSync';
export const DRIVE_DIRTY_KEY = 'homeops.drive.dirty';

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const HVAC_TYPES = [
  { value: 'forced_air', label: 'Forced-air furnace' },
  { value: 'heat_pump', label: 'Heat pump' },
  { value: 'mini_split', label: 'Mini-split / ductless' },
  { value: 'radiator', label: 'Radiator / boiler' },
  { value: 'window', label: 'Window or portable units' },
  { value: 'none', label: 'No HVAC system' },
];

export const WATER_HEATER_TYPES = [
  { value: 'tank', label: 'Tank water heater' },
  { value: 'tankless', label: 'Tankless / on-demand' },
  { value: 'heat_pump', label: 'Heat-pump water heater' },
  { value: 'none', label: 'No water heater' },
];

export const HEATING_FUELS = [
  { value: 'electric', label: 'Electric' },
  { value: 'gas', label: 'Natural gas' },
  { value: 'oil', label: 'Heating oil' },
  { value: 'propane', label: 'Propane' },
  { value: 'other', label: 'Other' },
];

export const ROOM_KINDS = [
  { value: 'room', label: 'Room' },
  { value: 'floor_plan', label: 'Floor plan' },
];

export const CATEGORIES = [
  {
    value: 'cleaning',
    label: 'Cleaning',
    tone: 'pine',
    description: 'The weekly rhythm that keeps the house feeling calm.',
  },
  {
    value: 'maintenance',
    label: 'Maintenance',
    tone: 'clay',
    description: 'Small checks that protect the systems you rely on.',
  },
];

export const CATEGORY_BY_VALUE = Object.fromEntries(
  CATEGORIES.map((category) => [category.value, category]),
);

export const DOCUMENT_CATEGORIES = [
  'Bills',
  'Insurance',
  'Contractor Invoice',
  'Appliance Receipt',
  'Warranty',
  'Tax / HOA',
  'Other',
];

export const EMPTY_PROPERTY = {
  address: '',
  yearBuilt: '',
  sqft: '',
  hvacType: 'forced_air',
  waterHeaterType: 'tank',
  heatingFuel: 'electric',
  hasGutters: true,
};

export const SEASONAL_TIPS = {
  winter: {
    label: 'Winter',
    title: 'Protect the pipes and the air you breathe',
    body: 'Keep cabinet doors open during deep freezes, replace HVAC filters on schedule, and test carbon monoxide detectors monthly.',
  },
  spring: {
    label: 'Spring',
    title: 'Water is your home’s quietest enemy',
    body: 'Clear gutters and downspouts, check the grade around the foundation, and look for peeling caulk around windows before the rainy season.',
  },
  summer: {
    label: 'Summer',
    title: 'Give the cooling system some breathing room',
    body: 'Hose off outdoor condenser coils, keep vents unblocked, and check the AC condensate line for algae or clogs.',
  },
  fall: {
    label: 'Fall',
    title: 'The furnace is about to earn its keep',
    body: 'Book a furnace tune-up, seal drafty doors, reverse ceiling fans, and drain outdoor hoses before the first hard freeze.',
  },
};

export function seasonForMonth(monthIndex) {
  if (monthIndex === 11 || monthIndex === 0 || monthIndex === 1) return 'winter';
  if (monthIndex >= 2 && monthIndex <= 4) return 'spring';
  if (monthIndex >= 5 && monthIndex <= 7) return 'summer';
  return 'fall';
}

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? '—';
}
