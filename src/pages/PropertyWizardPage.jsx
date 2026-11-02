import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Droplets,
  Home,
  LogOut,
  MapPin,
  Ruler,
  Sparkles,
  Wind,
} from 'lucide-react';
import Logo from '../components/Logo';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageLoader,
  PageHeader,
  Select,
} from '../components/ui';
import {
  EMPTY_PROPERTY,
  HEATING_FUELS,
  HVAC_TYPES,
  WATER_HEATER_TYPES,
  labelFor,
} from '../lib/constants';
import { getPrimaryProperty, savePropertyProfile } from '../lib/db';
import { buildSeedTasks } from '../lib/taskTemplates';
import { cx } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';

const STEPS = [
  { label: 'The home', icon: MapPin },
  { label: 'Systems', icon: Wind },
  { label: 'Review', icon: Check },
];

function propertyToForm(property) {
  if (!property) return { ...EMPTY_PROPERTY };
  return {
    address: property.address ?? '',
    yearBuilt: property.yearBuilt ?? '',
    sqft: property.sqft ?? '',
    hvacType: property.hvacType ?? 'forced_air',
    waterHeaterType: property.waterHeaterType ?? 'tank',
    heatingFuel: property.heatingFuel ?? 'electric',
    hasGutters: property.hasGutters ?? true,
  };
}

/** Deterministic demo data so the "lookup" feels real without an API. */
function mockPropertyLookup(address) {
  let hash = 2166136261;
  for (let index = 0; index < address.length; index += 1) {
    hash ^= address.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const seed = Math.abs(hash);
  const maxYear = new Date().getFullYear() - 5;
  const year = 1948 + (seed % Math.max(1, maxYear - 1948));
  return {
    yearBuilt: year,
    sqft: 900 + (seed % 26) * 100,
    hvacType: ['forced_air', 'heat_pump', 'radiator', 'mini_split'][seed % 4],
    waterHeaterType: ['tank', 'tankless', 'tank'][seed % 3],
    heatingFuel: ['gas', 'electric', 'oil'][Math.floor(seed / 11) % 3],
    hasGutters: seed % 7 !== 0,
  };
}

function Stepper({ step, onGo }) {
  return (
    <ol className="mt-7 flex items-center">
      {STEPS.map((item, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <li key={item.label} className={cx('flex items-center', index < STEPS.length - 1 && 'flex-1')}>
            <button
              type="button"
              onClick={() => index < step && onGo(index)}
              disabled={index > step}
              className={cx(
                'flex items-center gap-2 text-left',
                index <= step ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cx(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition',
                  done
                    ? 'bg-pine-700 text-white'
                    : active
                      ? 'bg-pine-100 text-pine-800 ring-2 ring-pine-500'
                      : 'bg-sand-100 text-ink-soft',
                )}
              >
                {done ? <Check size={14} /> : index + 1}
              </span>
              <span
                className={cx(
                  'hidden text-xs font-medium sm:block',
                  active ? 'text-ink' : 'text-ink-soft',
                )}
              >
                {item.label}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <span
                className={cx(
                  'mx-3 h-px flex-1 rounded-full',
                  done ? 'bg-pine-300' : 'bg-sand-200',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function PropertyWizard({ property }) {
  const signOut = useAuthStore((state) => state.signOut);
  const pushToast = useUiStore((state) => state.pushToast);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => propertyToForm(property));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupNote, setLookupNote] = useState('');

  const previewTasks = useMemo(
    () => buildSeedTasks({ ...form, id: 'preview' }, []),
    [form],
  );

  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const validateHomeStep = () => {
    const nextErrors = {};
    if (form.address.trim().length < 5) {
      nextErrors.address = 'Enter a street address so your plan has a home.';
    }
    const year = Number(form.yearBuilt);
    if (!form.yearBuilt || !Number.isInteger(year) || year < 1700 || year > 2100) {
      nextErrors.yearBuilt = 'Enter a build year between 1700 and 2100.';
    }
    const sqft = Number(form.sqft);
    if (!form.sqft || !Number.isFinite(sqft) || sqft < 100 || sqft > 100000) {
      nextErrors.sqft = 'Enter a square footage between 100 and 100,000.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLookup = async () => {
    if (form.address.trim().length < 5) {
      setErrors({ address: 'Add a street address first, then try the demo lookup.' });
      return;
    }
    setLooking(true);
    setLookupNote('');
    await new Promise((resolve) => setTimeout(resolve, 900));
    const guess = mockPropertyLookup(form.address.trim());
    setForm((current) => ({ ...current, ...guess }));
    setLooking(false);
    setLookupNote(
      'Demo lookup only. HomeOps doesn’t fetch public records — confirm or edit these details before saving.',
    );
  };

  const goNext = () => {
    if (step === 0 && !validateHomeStep()) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      await savePropertyProfile(form);
      pushToast(
        property
          ? 'Home profile updated.'
          : `Home profile saved. ${previewTasks.length} starter tasks are on your plan.`,
      );
      navigate('/', { replace: true });
    } catch (error) {
      setErrors({ form: error.message || 'Could not save your property profile.' });
      pushToast(error.message || 'Could not save your profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-sand-200/70 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1.5">
            {property && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-white hover:text-ink"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/auth', { replace: true });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-white hover:text-ink"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <PageHeader
          eyebrow={property ? 'Home profile' : 'One last step'}
          title={property ? 'Update the details HomeOps uses.' : 'Tell us about the place.'}
          description={
            property
              ? 'Refine the systems in this home. Your existing tasks and documents stay untouched.'
              : 'These details shape a starter plan: filters, water heater care, gutters, and the cleaning rhythm of a home this size.'
          }
        />

        <Stepper step={step} onGo={setStep} />

        <Card className="mt-6 overflow-hidden">
          <div className="p-5 sm:p-7">
            {step === 0 && (
              <div className="animate-fade-in space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-sand-200 bg-sand-50/70 px-4 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-100 text-pine-700">
                    <Home size={17} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">Start with the basics</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      The address is just a label for your home in this app. The demo lookup below
                      fills plausible details so you can see the flow.
                    </p>
                  </div>
                </div>

                <Field
                  label="Street address"
                  htmlFor="property-address"
                  error={errors.address}
                  hint="A name like “42 Alder Lane” is enough."
                  required
                >
                  <Input
                    id="property-address"
                    autoComplete="street-address"
                    placeholder="42 Alder Lane, Portland, OR"
                    value={form.address}
                    invalid={Boolean(errors.address)}
                    onChange={(event) => update({ address: event.target.value })}
                  />
                </Field>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLookup}
                    loading={looking}
                    className="w-fit"
                  >
                    {!looking && <Sparkles size={14} />}
                    {looking ? 'Looking up…' : 'Try a demo lookup'}
                  </Button>
                  <p className="text-[11px] leading-relaxed text-ink-soft">
                    Mock public-record data — not a real address lookup.
                  </p>
                </div>

                {lookupNote && (
                  <div className="flex items-start gap-2 rounded-xl border border-pine-200 bg-pine-50 px-3.5 py-3 text-xs leading-relaxed text-pine-800">
                    <Sparkles size={14} className="mt-0.5 shrink-0" />
                    {lookupNote}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Year built"
                    htmlFor="property-year"
                    error={errors.yearBuilt}
                    hint="Older homes get an annual roof and attic check."
                    required
                  >
                    <div className="relative">
                      <Input
                        id="property-year"
                        type="number"
                        inputMode="numeric"
                        min="1700"
                        max="2100"
                        placeholder="1996"
                        value={form.yearBuilt}
                        invalid={Boolean(errors.yearBuilt)}
                        className="pr-10"
                        onChange={(event) => update({ yearBuilt: event.target.value })}
                      />
                      <Ruler
                        size={15}
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                      />
                    </div>
                  </Field>

                  <Field
                    label="Square footage"
                    htmlFor="property-sqft"
                    error={errors.sqft}
                    hint="Roughly is fine."
                    required
                  >
                    <Input
                      id="property-sqft"
                      type="number"
                      inputMode="numeric"
                      min="100"
                      max="100000"
                      placeholder="1850"
                      value={form.sqft}
                      invalid={Boolean(errors.sqft)}
                      onChange={(event) => update({ sqft: event.target.value })}
                    />
                  </Field>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">The systems in the home</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    These answers decide which seasonal maintenance tasks make it onto your plan.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Heating & cooling"
                    htmlFor="property-hvac"
                    hint="Adds filter changes and an annual service."
                  >
                    <Select
                      id="property-hvac"
                      value={form.hvacType}
                      onChange={(event) => update({ hvacType: event.target.value })}
                    >
                      {HVAC_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Water heater"
                    htmlFor="property-water"
                    hint="Drives annual flush or descale reminders."
                  >
                    <Select
                      id="property-water"
                      value={form.waterHeaterType}
                      onChange={(event) => update({ waterHeaterType: event.target.value })}
                    >
                      {WATER_HEATER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Heating fuel" htmlFor="property-fuel">
                    <Select
                      id="property-fuel"
                      value={form.heatingFuel}
                      onChange={(event) => update({ heatingFuel: event.target.value })}
                    >
                      {HEATING_FUELS.map((fuel) => (
                        <option key={fuel.value} value={fuel.value}>
                          {fuel.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div className="flex items-end">
                    <Checkbox
                      className="w-full"
                      label="The home has gutters"
                      description="Adds a twice-yearly gutter cleaning task."
                      checked={form.hasGutters}
                      onChange={(event) => update({ hasGutters: event.target.checked })}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-3.5">
                  <p className="flex items-center gap-2 text-xs font-medium text-ink">
                    <Droplets size={14} className="text-pine-700" /> Why we ask
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    A tank heater needs sediment flushed once a year; a tankless unit needs
                    descaling. A home without gutters shouldn’t nag you about them. The starter
                    plan only includes what applies.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {property ? 'Ready to save?' : 'Here’s your home at a glance.'}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {property
                      ? 'Your changes take effect immediately. You can add any newly suggested tasks from Settings.'
                      : 'Saving this creates the profile and generates your first plan.'}
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-sand-200">
                  <div className="flex items-start gap-3 bg-sand-50/80 px-4 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-pine-700 ring-1 ring-sand-200">
                      <MapPin size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{form.address}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {form.yearBuilt} · {Number(form.sqft).toLocaleString()} sq ft
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-5 px-4 py-4 sm:grid-cols-3">
                    <Detail label="HVAC" value={labelFor(HVAC_TYPES, form.hvacType)} />
                    <Detail
                      label="Water heater"
                      value={labelFor(WATER_HEATER_TYPES, form.waterHeaterType)}
                    />
                    <Detail label="Fuel" value={labelFor(HEATING_FUELS, form.heatingFuel)} />
                    <Detail label="Gutters" value={form.hasGutters ? 'Yes' : 'No'} />
                    <Detail
                      label="Starter tasks"
                      value={property ? 'Your current plan' : `${previewTasks.length} tasks`}
                    />
                  </dl>
                </div>

                {!property && previewTasks.length > 0 && (
                  <div className="rounded-xl border border-pine-100 bg-pine-50/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-pine-900">Your starter plan</p>
                      <Badge tone="pine">{previewTasks.length} recurring tasks</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-pine-800/80">
                      Due dates are spread over the next few months. Everything is editable.
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {previewTasks.slice(0, 8).map((task) => (
                        <li key={task.title} className="flex items-start gap-2 text-xs text-pine-900">
                          <Check size={13} className="mt-0.5 shrink-0 text-pine-600" />
                          {task.title}
                        </li>
                      ))}
                    </ul>
                    {previewTasks.length > 8 && (
                      <p className="mt-2 text-[11px] text-pine-800/70">
                        + {previewTasks.length - 8} more cleaning and maintenance tasks
                      </p>
                    )}
                  </div>
                )}

                {errors.form && (
                  <p className="rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-xs text-clay-800">
                    {errors.form}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-sand-100 px-5 py-4 sm:px-7">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || saving}
            >
              <ArrowLeft size={16} /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={goNext}>
                Continue <ArrowRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleSave} loading={saving}>
                {!saving && <Check size={16} />}
                {saving ? 'Saving…' : property ? 'Save home profile' : 'Create my home plan'}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-5 text-center text-[11px] text-ink-soft">
          You can change the address, size, and systems later from Settings.
        </p>
      </main>
    </div>
  );
}

export default function PropertyWizardPage() {
  const property = useLiveQuery(getPrimaryProperty, []);

  if (property === undefined) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-sand-200/70 bg-white/60 px-4 py-3.5 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Logo />
          </div>
        </header>
        <PageLoader label="Preparing your home profile…" />
      </div>
    );
  }

  return <PropertyWizard property={property} />;
}
