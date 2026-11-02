import { addDays, todayYMD } from './date';

/**
 * Starter plan templates. Each one is selected against the property
 * profile so the first schedule feels specific to the home rather than
 * a generic checklist.
 */
const TEMPLATES = [
  {
    title: 'Vacuum and sweep living areas',
    category: 'cleaning',
    frequency: 'weekly',
    dueInDays: 0,
    description:
      'Floors, rugs, and the corners that collect dust and pet hair. Ten focused minutes keeps the whole house feeling fresher.',
  },
  {
    title: 'Clean bathrooms',
    category: 'cleaning',
    frequency: 'weekly',
    dueInDays: 2,
    description: 'Sinks, toilets, mirrors, and a quick shower scrub. Restock paper goods while you are there.',
  },
  {
    title: 'Change bed linens',
    category: 'cleaning',
    frequency: 'weekly',
    dueInDays: 3,
    description: 'Fresh sheets and towels for every bedroom. Wash pillow covers once a month.',
  },
  {
    title: 'Mop hard floors',
    category: 'cleaning',
    frequency: 'biweekly',
    dueInDays: 5,
    description: 'Kitchen, baths, and entryways first — those are the highest-traffic spots.',
  },
  {
    title: 'Dust and wipe surfaces',
    category: 'cleaning',
    frequency: 'biweekly',
    dueInDays: 6,
    description: 'Shelves, baseboards, blinds, and the tops of door frames.',
  },
  {
    title: 'Clean kitchen appliances',
    category: 'cleaning',
    frequency: 'monthly',
    dueInDays: 10,
    description: 'Wipe the fridge shelves, run a cleaning cycle on the dishwasher, and clear the microwave.',
  },
  {
    title: 'Deep clean the oven and range hood',
    category: 'cleaning',
    frequency: 'quarterly',
    dueInDays: 21,
    description: 'Degrease the filters and soak the oven racks. A little effort now prevents a smoky surprise later.',
  },
  {
    title: 'Change the HVAC filter',
    category: 'maintenance',
    frequency: 'quarterly',
    dueInDays: 7,
    applies: (property) => property.hvacType && property.hvacType !== 'none',
    description:
      'Use the size printed on the old filter. A clean filter lowers energy bills and keeps dust down. Pet owners may need monthly changes.',
  },
  {
    title: 'Book an HVAC service',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 75,
    applies: (property) => property.hvacType && property.hvacType !== 'none',
    description: 'Have a technician inspect the system before peak heating or cooling season.',
  },
  {
    title: 'Flush the water heater',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 60,
    applies: (property) => property.waterHeaterType === 'tank',
    description:
      'Drain a few gallons from the tank to remove sediment. Turn off power or gas first and follow the manufacturer’s instructions.',
  },
  {
    title: 'Descale the tankless water heater',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 60,
    applies: (property) => property.waterHeaterType === 'tankless',
    description: 'Flush the heat exchanger with a descaling solution to protect flow rate and efficiency.',
  },
  {
    title: 'Service the heat-pump water heater',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 60,
    applies: (property) => property.waterHeaterType === 'heat_pump',
    description:
      'Rinse or replace the air filter, clear the condensate line, and check the tank for leaks. A clean filter keeps this appliance efficient.',
  },
  {
    title: 'Test smoke and carbon monoxide detectors',
    category: 'maintenance',
    frequency: 'semiannual',
    dueInDays: 14,
    description: 'Press the test button on every alarm and replace batteries at least once a year.',
  },
  {
    title: 'Clean the gutters',
    category: 'maintenance',
    frequency: 'semiannual',
    dueInDays: 45,
    applies: (property) => Boolean(property.hasGutters),
    description:
      'Clear leaves and check that downspouts carry water away from the foundation. Use gloves and a stable ladder.',
  },
  {
    title: 'Clean the dryer vent',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 30,
    description: 'Pull lint from the duct and the exterior vent. This is one of the best fire-prevention habits in a home.',
  },
  {
    title: 'Check the fire extinguisher',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 120,
    description: 'Confirm the gauge is in the green and the pin is intact. Replace expired units.',
  },
  {
    title: 'Inspect the roof and attic',
    category: 'maintenance',
    frequency: 'annual',
    dueInDays: 150,
    applies: (property) => {
      const year = Number(property.yearBuilt);
      return Number.isFinite(year) && year > 0 && year < 2000;
    },
    description:
      'Older homes benefit from a yearly look at flashing, shingles, insulation, and signs of moisture. Use binoculars from the ground where possible.',
  },
];

export function buildSeedTasks(property, existingTitles = []) {
  if (!property?.id) return [];
  const today = todayYMD();
  const createdAt = new Date().toISOString();
  const existing = new Set(existingTitles.map((title) => String(title).trim().toLowerCase()));

  return TEMPLATES.filter((template) => !template.applies || template.applies(property))
    .filter((template) => !existing.has(template.title.toLowerCase()))
    .map((template) => ({
      propertyId: property.id,
      title: template.title,
      description: template.description,
      category: template.category,
      frequency: template.frequency,
      nextDueDate: addDays(today, template.dueInDays),
      status: 'active',
      createdAt,
    }));
}
