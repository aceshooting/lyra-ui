import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMirrorMap } from './migrate-wa.mjs';
import {
  INVENTORY_SCHEMA_VERSION,
  LOCAL_MIGRATION_PROFILES,
  REWRITE_RULE_SECTIONS,
  SURFACE_SECTIONS,
  compareMappedSurfaces,
  emptyNormalizations,
  emptyRewrites,
  emptySurface,
  familyFromModule,
  normalizeManifest,
} from './component-inventory.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArguments(argv) {
  const options = { output: defaultOutput, write: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--lyra-manifest') options.lyraManifest = argv[++index];
    else if (argument === '--webawesome-manifest') options.webawesomeManifest = argv[++index];
    else if (argument === '--shoelace-manifest') options.shoelaceManifest = argv[++index];
    else if (argument === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.webawesomeManifest || !options.shoelaceManifest) {
    throw new Error(
      'Both --webawesome-manifest and --shoelace-manifest are required; pass the pinned published custom-elements.json files.',
    );
  }
  return options;
}

function resolveTypeScriptImport(importer, specifier) {
  const target = path.resolve(path.dirname(importer), specifier);
  const candidates = [target, target.replace(/\.js$/, '.ts'), path.join(target, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate) && candidate.endsWith('.ts')) || null;
}

/**
 * Root registration follows the component's reviewed optional-peer policy, never the generated
 * allowlist. Peer-free components are safe to enroll automatically. A new peer-bearing component
 * remains fail-closed until its root behavior is reviewed; existing reviewed lazy-peer inclusion
 * and optional-peer-family exclusion decisions are retained.
 */
export function rootRegistrationMetadata(previous, optionalPeers, tag = previous?.tag ?? 'component') {
  if (!Array.isArray(optionalPeers)) throw new TypeError(`${tag}: optionalPeers must be an array`);
  const priorExclusion = previous?.rootExclusion;
  if (![undefined, null, 'optional-peer-family', 'unreviewed'].includes(priorExclusion)) {
    throw new Error(`${tag}: unsupported root exclusion ${String(priorExclusion)}`);
  }
  if (optionalPeers.length === 0) return { rootIncluded: true, rootExclusion: null };
  if (priorExclusion === 'optional-peer-family') {
    return { rootIncluded: false, rootExclusion: 'optional-peer-family' };
  }
  if (previous?.rootIncluded === true && priorExclusion === null) {
    return { rootIncluded: true, rootExclusion: null };
  }
  return { rootIncluded: false, rootExclusion: 'unreviewed' };
}

function optionalPeersForComponent(component, packageJson) {
  const peers = Object.keys(packageJson.peerDependencies ?? {}).filter(
    (peer) => packageJson.peerDependenciesMeta?.[peer]?.optional === true,
  );
  const found = new Set();
  const seen = new Set();
  const queue = [path.join(packageDir, component.registrationModule)];

  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const peer of peers) {
      const escaped = peer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:from\\s+|import\\()\\s*['"]${escaped}(?:/|['"])`).test(source)) found.add(peer);
    }
    for (const match of source.matchAll(/(?:from\s+|import\()\s*['"](\.[^'"]+)['"]/g)) {
      const resolved = resolveTypeScriptImport(file, match[1]);
      if (resolved) queue.push(resolved);
    }
  }
  return [...found].sort();
}

function lyraComponents(manifest, existing, packageJson) {
  const normalized = normalizeManifest(manifest, { ecosystem: 'lyra' });
  const existingByTag = new Map((existing?.components ?? []).map((component) => [component.tag, component]));

  return normalized.map((entry) => {
    const classModule = entry.module;
    const registrationModule = classModule.replace(/\.class\.ts$/, '.ts');
    const previous = existingByTag.get(entry.tag);
    const component = {
      tag: entry.tag,
      family: familyFromModule(classModule),
      classModule,
      registrationModule,
      rootIncluded: false,
      rootExclusion: 'unreviewed',
      optionalPeers: [],
      maturity: previous?.maturity ?? entry.maturity,
      counterparts: [],
      surface: entry.surface,
    };
    component.optionalPeers = optionalPeersForComponent(component, packageJson);
    Object.assign(component, rootRegistrationMetadata(previous, component.optionalPeers, entry.tag));
    return component;
  });
}

function reviewedProperty(name, attribute, type, defaultValue, reflects = false) {
  return {
    name,
    attribute,
    type,
    readonly: false,
    reflects,
    deprecated: null,
    hasDefault: true,
    default: defaultValue,
  };
}

function reviewedPropertyWithoutDefault(name, attribute, type, { readonly = false, reflects = false } = {}) {
  return {
    name,
    attribute,
    type,
    readonly,
    reflects,
    deprecated: null,
    hasDefault: false,
  };
}

function reviewedReadonlyProperty(name, attribute, type, defaultValue, reflects = false) {
  return { ...reviewedProperty(name, attribute, type, defaultValue, reflects), readonly: true };
}

function reviewedAttributes(properties) {
  return properties
    .filter((property) => property.attribute !== null)
    .map((property) => ({
      name: property.attribute,
      property: property.name,
      type: property.type,
      reflects: property.reflects,
      inferred: false,
      deprecated: property.deprecated,
      hasDefault: property.hasDefault,
      ...(property.hasDefault ? { default: property.default } : {}),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function reviewedNames(names) {
  return names.map((name) => ({ name, deprecated: null }));
}

function reviewedParts(parts) {
  return parts.map((part) =>
    typeof part === 'string' ? { name: part, deprecated: null } : part,
  );
}

function reviewedCssProperties(names) {
  return names.map((name) => ({ name, deprecated: null, hasDefault: false }));
}

function reviewedEvent(name, type = 'Event', cancelable = 'never') {
  return { name, type, cancelable };
}

function reviewedNativeEvent(
  name,
  constructor = 'Event',
  { bubbles = true, composed = true, cancelable = 'never' } = {},
) {
  const runtimeConstructor = /^CustomEvent</u.test(constructor) ? 'CustomEvent' : constructor;
  return { name, type: constructor, constructor: runtimeConstructor, bubbles, composed, cancelable };
}

function reviewedPublicDocumentation({
  tag,
  maturity,
  properties,
  slots = [],
  events = [],
  parts = [],
  cssProperties = [],
  cssStates = [],
  methods = [],
  form = { associated: false, properties: [], methods: [] },
  native = { forwardedEvents: [], delegatedMethods: [] },
  url,
  sha256,
}) {
  return {
    tag,
    module: null,
    tier: 'pro',
    maturity: { ...maturity, deprecated: null },
    surface: {
      attributes: reviewedAttributes(properties),
      properties,
      slots: reviewedNames(slots),
      events,
      parts: reviewedParts(parts),
      cssProperties: reviewedCssProperties(cssProperties),
      cssStates: reviewedNames(cssStates),
      methods,
      form,
      native,
    },
    review: {
      status: 'complete',
      source: 'official-public-documentation',
      sourceUrl: url,
      sourceVersion: '3.11.0',
      sourceSha256: sha256,
      reviewedAt: '2026-08-02',
      unreviewedSections: [],
    },
  };
}

function reviewedMethod(name, parameters = [], returnType = 'void') {
  return { name, overloads: [{ parameters, returnType }] };
}

function reviewedParameter(name, type) {
  return { name, type, optional: false, hasDefault: false };
}

function reviewedOptionalParameter(name, type) {
  return { name, type, optional: true, hasDefault: false };
}

const CHART_CSS_PROPERTIES = [
  '--border-color-1',
  '--border-color-2',
  '--border-color-3',
  '--border-color-4',
  '--border-color-5',
  '--border-color-6',
  '--border-radius',
  '--border-width',
  '--fill-color-1',
  '--fill-color-2',
  '--fill-color-3',
  '--fill-color-4',
  '--fill-color-5',
  '--fill-color-6',
  '--grid-border-width',
  '--grid-color',
  '--line-border-width',
  '--point-radius',
];

const CHART_REVIEW_EVIDENCE = new Map([
  ['wa-chart', ['chart', 'bar', 'c0748337345cc95607f19cfce5bc637b7936164ced4841d557c320f95c82ae87']],
  ['wa-bar-chart', ['bar-chart', 'bar', '7470610eb8e7567c5f8a2bdf8bd15cf680de7bfd4300d71dc8830d2d2b42bd40']],
  ['wa-bubble-chart', ['bubble-chart', 'bubble', '8371654815fca58ab82f757b386c358230b6f3c3ab4eb80c24cda77bccc0d108']],
  ['wa-doughnut-chart', ['doughnut-chart', 'doughnut', 'a3a16f308914a53bd1a5b6d33808de05a660aff790848717521351a061e4dd75']],
  ['wa-line-chart', ['line-chart', 'line', 'aa51b9a8db374d84624781511541c0655f6a2df6082b485934d754609d0cd147']],
  ['wa-pie-chart', ['pie-chart', 'pie', 'ac6492a77c3708d8d3a8801bd8d2e27deabaad464d3711741190e9b35207e177']],
  ['wa-polar-area-chart', ['polar-area-chart', 'polarArea', '21d67f13bef0e7163f60090111c906dd8d5727f0e1b078c05a2259b789203549']],
  ['wa-radar-chart', ['radar-chart', 'radar', '921edb0198c393f6764e4227f7a5c5935880688d5de167c8f3fed0bf48003780']],
  ['wa-scatter-chart', ['scatter-chart', 'scatter', '191b5b2d8dc12f9543bf8760c684ea556fea0483eb3498433c4c602f44aa8178']],
]);

export function reviewedWebAwesomeChart(tag) {
  const evidence = CHART_REVIEW_EVIDENCE.get(tag);
  if (!evidence) throw new Error(`Unknown reviewed Web Awesome chart tag: ${tag}`);
  const [slug, typeDefault, sha256] = evidence;
  const properties = [
    reviewedPropertyWithoutDefault('config', null, "ChartJS['config']"),
    reviewedProperty('description', 'description', 'string | null', null),
    reviewedProperty('grid', 'grid', "'x' | 'y' | 'both' | 'none'", 'both'),
    reviewedProperty('indexAxis', 'index-axis', "'x' | 'y'", 'x'),
    reviewedProperty('label', 'label', 'string | null', null),
    reviewedProperty('legendPosition', 'legend-position', "LayoutPosition | 'start' | 'end'", 'top'),
    reviewedProperty('max', 'max', 'number | null', null),
    reviewedProperty('min', 'min', 'number | null', null),
    reviewedProperty('plugins', 'plugins', 'array', '[]'),
    reviewedProperty('stacked', 'stacked', 'boolean', false),
    reviewedProperty('type', 'type', 'ChartType', typeDefault),
    reviewedProperty('withoutAnimation', 'without-animation', 'boolean', false, true),
    reviewedProperty('withoutLegend', 'without-legend', 'boolean', false, true),
    reviewedProperty('withoutTooltip', 'without-tooltip', 'boolean', false, true),
    reviewedProperty('xLabel', 'x-label', 'string | null', null),
    reviewedProperty('yLabel', 'y-label', 'string | null', null),
  ];
  return reviewedPublicDocumentation({
    tag,
    maturity: { status: 'stable', since: '3.3' },
    properties,
    slots: [''],
    cssProperties: CHART_CSS_PROPERTIES,
    url: `https://webawesome.com/docs/components/${slug}/`,
    sha256,
  });
}

export function reviewedWebAwesomeSparkline() {
  const properties = [
    reviewedProperty('appearance', 'appearance', "'gradient' | 'line' | 'solid'", 'solid', true),
    reviewedProperty('curve', 'curve', "'linear' | 'natural' | 'step'", 'linear', true),
    reviewedProperty('data', 'data', 'string', ''),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedPropertyWithoutDefault('trend', 'trend', "'positive' | 'negative' | 'neutral'", { reflects: true }),
  ];
  return reviewedPublicDocumentation({
    tag: 'wa-sparkline',
    maturity: { status: 'stable', since: '3.2' },
    properties,
    parts: [
      { name: 'base', deprecated: 'Use the sparkline part instead.' },
      'fill',
      'line',
      'sparkline',
    ],
    cssProperties: ['--fill-color', '--line-color', '--line-width'],
    url: 'https://webawesome.com/docs/components/sparkline/',
    sha256: '1022114cbaef4bad2d8012702ee5038c210b188fe61542c51647fc8a970c53dd',
  });
}

export function reviewedWebAwesomeCombobox() {
  const properties = [
    reviewedProperty('allowCreate', 'allow-create', 'boolean', false),
    reviewedProperty('allowCustomValue', 'allow-custom-value', 'boolean', false),
    reviewedProperty('appearance', 'appearance', "'filled' | 'outlined' | 'filled-outlined'", 'outlined', true),
    reviewedPropertyWithoutDefault('autocapitalize', 'autocapitalize', 'string'),
    reviewedPropertyWithoutDefault('autocorrect', 'autocorrect', 'boolean'),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedPropertyWithoutDefault('enterkeyhint', 'enterkeyhint', 'string'),
    reviewedProperty('filter', null, '((option: HTMLElement, query: string) => boolean) | null', null),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null', { readonly: true }),
    reviewedPropertyWithoutDefault('getTag', null, '(option: HTMLElement) => unknown'),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedPropertyWithoutDefault('inputmode', 'inputmode', 'string'),
    reviewedProperty('inputValue', null, 'string', ''),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedProperty('maxOptionsVisible', 'max-options-visible', 'number', 3),
    reviewedProperty('multiple', 'multiple', 'boolean', false, true),
    reviewedProperty('name', 'name', 'string | null', '', true),
    reviewedProperty('open', 'open', 'boolean', false, true),
    reviewedProperty('pill', 'pill', 'boolean', false, true),
    reviewedProperty('placeholder', 'placeholder', 'string', ''),
    reviewedProperty('placement', 'placement', "'top' | 'bottom'", 'bottom', true),
    reviewedProperty('required', 'required', 'boolean', false, true),
    reviewedProperty('size', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'm', true),
    reviewedProperty('spellcheck', 'spellcheck', 'boolean', false),
    reviewedPropertyWithoutDefault('validationTarget', null, 'HTMLElement | undefined'),
    reviewedProperty('validators', null, 'Validator[]', '[]'),
    reviewedPropertyWithoutDefault('value', null, 'string | string[]'),
    reviewedProperty('withClear', 'with-clear', 'boolean', false),
    reviewedProperty('withHint', 'with-hint', 'boolean', false),
    reviewedProperty('withLabel', 'with-label', 'boolean', false),
  ];
  const nativeEvents = ['blur', 'change', 'focus', 'input'];
  return reviewedPublicDocumentation({
    tag: 'wa-combobox',
    maturity: { status: 'stable', since: '3.1' },
    properties,
    slots: ['', 'clear-icon', 'end', 'expand-icon', 'hint', 'label', 'start'],
    events: [
      reviewedNativeEvent('blur', 'FocusEvent'),
      reviewedNativeEvent('change', 'CustomEvent<{ value: string | string[] }>'),
      reviewedNativeEvent('focus', 'FocusEvent'),
      reviewedNativeEvent('input', 'InputEvent | CustomEvent<{ value: string | string[] }>'),
      reviewedEvent('wa-after-hide'),
      reviewedEvent('wa-after-show'),
      reviewedEvent('wa-clear'),
      reviewedEvent('wa-create', 'CustomEvent<{ inputValue: string }>', 'always'),
      reviewedEvent('wa-hide'),
      reviewedEvent('wa-invalid'),
      reviewedEvent('wa-show'),
    ],
    parts: [
      'clear-button',
      'combobox',
      'combobox-input',
      'end',
      'expand-icon',
      'form-control',
      'form-control-input',
      'form-control-label',
      'hint',
      'label',
      'listbox',
      'start',
      'tag',
      'tag__content',
      'tag__remove-button',
      'tag__remove-button__base',
      'tags',
    ],
    cssProperties: ['--hide-duration', '--show-duration', '--tag-max-size'],
    cssStates: ['blank', 'disabled'],
    methods: [
      reviewedMethod('blur'),
      reviewedMethod('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      reviewedMethod('formStateRestoreCallback', [reviewedParameter('state', 'string | File | FormData | null')]),
      reviewedMethod('hide', [], 'Promise<void>'),
      reviewedMethod('resetValidity'),
      reviewedMethod('setCustomValidity', [reviewedParameter('message', 'string')]),
      reviewedMethod('show', [], 'Promise<void>'),
    ],
    form: {
      associated: true,
      properties: ['form', 'name', 'disabled', 'required'],
      methods: ['setCustomValidity'],
    },
    native: { forwardedEvents: nativeEvents, delegatedMethods: ['blur', 'focus'] },
    url: 'https://webawesome.com/docs/components/combobox/',
    sha256: '63635cc46b63f03c24c956b2cf8e3c0b4293c367ed77c5c9c85afc3e74c8ea40',
  });
}

export function reviewedWebAwesomeFileInput() {
  const properties = [
    reviewedProperty('accept', 'accept', 'string', ''),
    reviewedPropertyWithoutDefault('capture', 'capture', "'user' | 'environment'"),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedReadonlyProperty('dragging', 'dragging', 'boolean', false, true),
    reviewedPropertyWithoutDefault('fileCount', null, 'number', { readonly: true }),
    reviewedProperty('files', null, 'File[]', '[]'),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null', { readonly: true }),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedProperty('multiple', 'multiple', 'boolean', false),
    reviewedProperty('name', 'name', 'string | null', null),
    reviewedProperty('required', 'required', 'boolean', false),
    reviewedProperty('size', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'm'),
    reviewedPropertyWithoutDefault('validationTarget', null, 'HTMLElement | undefined'),
    reviewedProperty('validators', null, 'Validator[]', '[]'),
    reviewedProperty('withHint', 'with-hint', 'boolean', false),
    reviewedProperty('withLabel', 'with-label', 'boolean', false),
  ];
  const nativeEvents = ['blur', 'change', 'focus', 'input'];
  return reviewedPublicDocumentation({
    tag: 'wa-file-input',
    maturity: { status: 'stable', since: '3.2' },
    properties,
    slots: ['', 'dropzone', 'hint', 'label'],
    events: [
      reviewedNativeEvent('blur', 'FocusEvent'),
      reviewedNativeEvent('change'),
      reviewedNativeEvent('focus', 'FocusEvent'),
      reviewedNativeEvent('input'),
      reviewedEvent('wa-invalid'),
    ],
    parts: [
      { name: 'base', deprecated: 'Use the file-input part instead.' },
      'dropzone',
      'dropzone-icon',
      'dropzone-text',
      'file',
      'file-details',
      'file-icon',
      'file-image',
      'file-input',
      'file-list',
      'file-name',
      'file-size',
      'file-thumbnail',
      'form-control-label',
      'hint',
      'label',
      'remove-button',
    ],
    cssStates: ['blank', 'dragging'],
    methods: [
      reviewedMethod('blur'),
      reviewedMethod('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      reviewedMethod('formStateRestoreCallback', [reviewedParameter('state', 'string | File | FormData | null')]),
      reviewedMethod('resetValidity'),
      reviewedMethod('setCustomValidity', [reviewedParameter('message', 'string')]),
    ],
    form: {
      associated: true,
      properties: ['form', 'name', 'disabled', 'required'],
      methods: ['setCustomValidity'],
    },
    native: { forwardedEvents: nativeEvents, delegatedMethods: ['blur', 'focus'] },
    url: 'https://webawesome.com/docs/components/file-input/',
    sha256: '733c31b6c91ae12e1469d9713ef496142519a596a3efb529ea4645b6439ee695',
  });
}

export function reviewedWebAwesomeDateInput() {
  const properties = [
    reviewedProperty('appearance', 'appearance', "'filled' | 'outlined' | 'filled-outlined'", 'outlined', true),
    reviewedProperty('assumeInteractionOn', null, 'string[]', "['input']"),
    reviewedProperty('autocomplete', 'autocomplete', 'string', ''),
    reviewedPropertyWithoutDefault('dayContent', null, 'WaDateInputDayContent | undefined'),
    reviewedPropertyWithoutDefault('defaultValue', 'value', 'string', { reflects: true }),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedProperty('disabledDates', 'disabled-dates', 'string | string[] | Date[]', ''),
    reviewedProperty('disabledDaysOfWeek', 'disabled-days-of-week', 'string', ''),
    reviewedProperty('disableFuture', 'disable-future', 'boolean', false, true),
    reviewedProperty('disablePast', 'disable-past', 'boolean', false, true),
    reviewedProperty('distance', 'distance', 'number', 0, true),
    reviewedProperty('firstDayOfWeek', 'first-day-of-week', 'WaDateInputFirstDayOfWeek', 'auto', true),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null', { readonly: true }),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedPropertyWithoutDefault('isDateDisabled', null, '((date: Date) => boolean) | undefined'),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedProperty('max', 'max', 'string', '', true),
    reviewedProperty('maxRange', 'max-range', 'number', 0, true),
    reviewedProperty('min', 'min', 'string', '', true),
    reviewedProperty('minRange', 'min-range', 'number', 0, true),
    reviewedProperty('mode', 'mode', 'WaDateInputMode', 'single', true),
    reviewedProperty('months', 'months', '1 | 2', 1, true),
    reviewedProperty('name', 'name', 'string | null', '', true),
    reviewedProperty('open', 'open', 'boolean', false, true),
    reviewedProperty('pageBy', 'page-by', "'months' | 'single'", 'months', true),
    reviewedProperty('pill', 'pill', 'boolean', false, true),
    reviewedProperty('placement', 'placement', 'WaDateInputPlacement', 'bottom-start', true),
    reviewedProperty('readonly', 'readonly', 'boolean', false, true),
    reviewedProperty('required', 'required', 'boolean', false, true),
    reviewedProperty('size', 'size', "WaDateInputSize | 'small' | 'medium' | 'large'", 'm', true),
    reviewedProperty('today', 'today', 'string', '', true),
    reviewedPropertyWithoutDefault('validationTarget', null, 'undefined | HTMLElement'),
    reviewedProperty('validators', null, 'Validator[]', '[]'),
    reviewedPropertyWithoutDefault('value', null, 'string'),
    reviewedPropertyWithoutDefault('valueAsDate', null, 'Date | null'),
    reviewedPropertyWithoutDefault('valueAsRange', null, '{ from: Date | null; to: Date | null }'),
    reviewedProperty('weekdayFormat', 'weekday-format', "'narrow' | 'short' | 'long'", 'short', true),
    reviewedProperty('withClear', 'with-clear', 'boolean', false),
    reviewedProperty('withHint', 'with-hint', 'boolean', false),
    reviewedProperty('withLabel', 'with-label', 'boolean', false),
    reviewedProperty('withOutsideDays', 'with-outside-days', 'boolean', false, true),
    reviewedProperty('withWeekNumbers', 'with-week-numbers', 'boolean', false, true),
  ];
  const nativeEvents = ['blur', 'change', 'focus', 'input'];
  const method = (name, parameters = []) => reviewedMethod(name, parameters, UNSPECIFIED_PUBLIC_RETURN);
  return reviewedPublicDocumentation({
    tag: 'wa-date-input',
    maturity: { status: 'experimental', since: '3.8' },
    properties,
    slots: [
      'clear-icon',
      'day-YYYY-MM-DD',
      'end',
      'expand-icon',
      'footer',
      'hint',
      'label',
      'next-icon',
      'previous-icon',
      'start',
    ],
    events: [
      reviewedNativeEvent('blur', 'FocusEvent'),
      reviewedNativeEvent('change'),
      reviewedNativeEvent('focus', 'FocusEvent'),
      reviewedNativeEvent('input', 'InputEvent'),
      reviewedEvent('wa-after-hide'),
      reviewedEvent('wa-after-show'),
      reviewedEvent('wa-clear'),
      reviewedEvent('wa-hide', 'CustomEvent<void>', 'always'),
      reviewedEvent('wa-invalid'),
      reviewedEvent('wa-show', 'CustomEvent<void>', 'always'),
    ],
    parts: [
      { name: 'base', deprecated: 'Use the date-input part instead.' },
      'clear-button',
      'date-input',
      'date-picker',
      'end',
      'expand-button',
      'expand-icon',
      'form-control',
      'form-control-input',
      'form-control-label',
      'hint',
      'input',
      'input-wrapper',
      { name: 'label', deprecated: 'Use the form-control-label part instead.' },
      'popup',
      'range-separator',
      'segment',
      'segment-literal',
      'start',
    ],
    cssProperties: ['--hide-duration', '--show-duration'],
    cssStates: ['blank', 'disabled', 'open', 'range'],
    methods: [
      method('blur'),
      method('clear'),
      method('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      method('formStateRestoreCallback', [reviewedParameter('state', 'string | File | FormData | null')]),
      method('hide'),
      method('resetValidity'),
      method('setCustomValidity', [reviewedParameter('message', 'string')]),
      method('show'),
    ],
    form: {
      associated: true,
      properties: ['form', 'name', 'disabled', 'required'],
      methods: ['setCustomValidity'],
    },
    native: { forwardedEvents: nativeEvents, delegatedMethods: ['blur', 'focus'] },
    url: 'https://webawesome.com/docs/components/date-input/',
    sha256: '7597b7a3865419c954d0ac103f25a846190036bd3c067da21b4622e9f61169fe',
  });
}

export function reviewedWebAwesomeDatePicker() {
  const properties = [
    reviewedPropertyWithoutDefault('dayContent', null, 'WaDatePickerDayContent | undefined'),
    reviewedProperty('disabled', 'disabled', 'boolean', false, true),
    reviewedPropertyWithoutDefault('disabledDates', 'disabled-dates', 'string | string[] | Date[]'),
    reviewedProperty('disabledDaysOfWeek', 'disabled-days-of-week', 'string', ''),
    reviewedProperty('disableFuture', 'disable-future', 'boolean', false, true),
    reviewedProperty('disablePast', 'disable-past', 'boolean', false, true),
    reviewedProperty('firstDayOfWeek', 'first-day-of-week', 'WaDatePickerFirstDayOfWeek', 'auto', true),
    reviewedProperty('focusedDate', 'focused-date', 'string', '', true),
    reviewedPropertyWithoutDefault('isDateDisabled', null, '((date: Date) => boolean) | undefined'),
    reviewedProperty('locale', 'locale', 'string', '', true),
    reviewedProperty('max', 'max', 'string', '', true),
    reviewedProperty('maxRange', 'max-range', 'number', 0, true),
    reviewedProperty('min', 'min', 'string', '', true),
    reviewedProperty('minRange', 'min-range', 'number', 0, true),
    reviewedProperty('mode', 'mode', 'WaDatePickerMode', 'single', true),
    reviewedProperty('months', 'months', '1 | 2', 1, true),
    reviewedProperty('pageBy', 'page-by', 'WaDatePickerPageBy', 'months', true),
    reviewedProperty('readonly', 'readonly', 'boolean', false, true),
    reviewedProperty('size', 'size', "WaDatePickerSize | 'small' | 'medium' | 'large'", 'm', true),
    reviewedProperty('today', 'today', 'string', '', true),
    reviewedPropertyWithoutDefault('value', 'value', 'string', { reflects: true }),
    reviewedPropertyWithoutDefault('valueAsDate', null, 'Date | null'),
    reviewedPropertyWithoutDefault('valueAsRange', null, 'WaDatePickerRange'),
    reviewedProperty('view', 'view', 'WaDatePickerView', 'days', true),
    reviewedProperty('weekdayFormat', 'weekday-format', 'WaDatePickerWeekdayFormat', 'short', true),
    reviewedProperty('withOutsideDays', 'with-outside-days', 'boolean', false, true),
    reviewedProperty('withWeekNumbers', 'with-week-numbers', 'boolean', false, true),
  ];
  const nativeEvents = ['change', 'input'];
  const method = (name, parameters = []) => reviewedMethod(name, parameters, UNSPECIFIED_PUBLIC_RETURN);
  return reviewedPublicDocumentation({
    tag: 'wa-date-picker',
    maturity: { status: 'experimental', since: '3.8' },
    properties,
    slots: ['footer', 'header', 'next-icon', 'previous-icon'],
    events: [
      reviewedNativeEvent('change'),
      reviewedNativeEvent('input', 'InputEvent'),
      reviewedEvent('wa-focus-day', 'CustomEvent<{ date: Date }>'),
      reviewedEvent('wa-view-change', 'CustomEvent<{ view: WaDatePickerView; date: Date }>'),
    ],
    parts: [
      { name: 'base', deprecated: 'Use the date-picker part instead.' },
      'date-picker',
      'day',
      'day-disabled',
      'day-label',
      'day-outside',
      'day-placeholder',
      'day-range-end',
      'day-range-inner',
      'day-range-preview',
      'day-range-start',
      'day-selected',
      'day-today',
      'day-weekend',
      'footer',
      'grid',
      'header',
      'month',
      'month-label',
      'months',
      'nav',
      'next',
      'previous',
      'title',
      'view-cell',
      'view-grid',
      'view-item',
      'view-item-disabled',
      'view-item-selected',
      'view-item-today',
      'view-row',
      'weekday',
      'weekdays',
      'weeknumber',
      'weeknumbers',
    ],
    cssStates: ['disabled', 'range', 'readonly'],
    methods: [
      method('clear'),
      method('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      method('goToDate', [reviewedParameter('date', 'string | Date')]),
      method('goToToday'),
    ],
    native: { forwardedEvents: nativeEvents, delegatedMethods: ['focus'] },
    url: 'https://webawesome.com/docs/components/date-picker/',
    sha256: 'f6121bc7c107a2a437f5cb10d46f84dec767f0e7a0704a47e8023ba7e4c98817',
  });
}

const DATA_GRID_OPTION_TYPE = "{ columnIds?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }";
const DATA_GRID_CSV_OPTION_TYPE = '{ fileName?: string; columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }';
const UNSPECIFIED_PUBLIC_RETURN = 'unspecified-public-documentation';

export function reviewedWebAwesomeDataGrid() {
  const properties = [
    reviewedProperty('appearance', 'appearance', "'outlined' | 'plain'", 'outlined', true),
    reviewedProperty('childRows', 'child-rows', 'string | ((row: Row) => Row[] | undefined) | null', null),
    reviewedPropertyWithoutDefault('columnOrder', null, 'string[]'),
    reviewedProperty('columns', null, 'DataGridColumn[]', '[]'),
    reviewedProperty('data', null, 'Row[]', '[]'),
    reviewedProperty('dataSource', null, '((request: DataGridRequest) => Promise<DataGridResponse>) | null', null),
    reviewedPropertyWithoutDefault('expandedKeys', null, '(string | number)[]'),
    reviewedProperty('filterDebounce', 'filter-debounce', 'number', 250),
    reviewedPropertyWithoutDefault('filteredCount', null, 'number', { readonly: true }),
    reviewedProperty('filterFromLeafRows', 'filter-from-leaf-rows', 'boolean', false),
    reviewedPropertyWithoutDefault('filters', null, '{ id: string; value: unknown }[]'),
    reviewedProperty('groupBy', 'group-by', 'string | string[] | null', null),
    reviewedProperty('label', 'label', 'string | null', null),
    reviewedProperty('loading', 'loading', 'boolean', false, true),
    reviewedProperty('maxMultiSort', 'max-multi-sort', 'number', 0),
    reviewedProperty('page', 'page', 'number', 0, true),
    reviewedPropertyWithoutDefault('pageCount', null, 'number', { readonly: true }),
    reviewedProperty('pageSize', 'page-size', 'number', 20),
    reviewedProperty('pageSizeOptions', null, 'number[]', '[10, 20, 50, 100]'),
    reviewedProperty('paginate', 'paginate', 'boolean', false, true),
    reviewedProperty('pinnable', 'pinnable', 'boolean', false, true),
    reviewedProperty('reorderable', 'reorderable', 'boolean', false, true),
    reviewedProperty('resizable', 'resizable', 'boolean', false, true),
    reviewedProperty('rowClass', null, '((row: Row) => string | null | undefined) | null', null),
    reviewedProperty('rowDetail', null, '((row: Row) => string | TemplateResult | Node) | null', null),
    reviewedProperty('rowKey', 'row-key', 'string | null', null),
    reviewedProperty('searchFn', null, '((value: unknown, searchTerm: string, row: Row) => boolean) | null', null),
    reviewedProperty('searchTerm', null, 'string', ''),
    reviewedProperty('selectable', 'selectable', "'' | 'single' | 'multiple' | 'none'", 'none', true),
    reviewedProperty('selectableRows', null, '((row: Row) => boolean) | null', null),
    reviewedPropertyWithoutDefault('selectedKeys', null, '(string | number)[]'),
    reviewedPropertyWithoutDefault('selectedRows', null, 'Row[]', { readonly: true }),
    reviewedProperty('server', 'server', 'boolean', false, true),
    reviewedProperty('size', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'm', true),
    reviewedPropertyWithoutDefault('sort', null, 'SortingState'),
    reviewedProperty('sortDescFirst', 'sort-desc-first', 'boolean', false),
    reviewedProperty('striped', 'striped', 'boolean', false, true),
    reviewedProperty('total', 'total', 'number', -1),
    reviewedProperty('withColumnMenu', 'with-column-menu', 'boolean', false, true),
    reviewedProperty('withColumnsMenu', 'with-columns-menu', 'boolean', false, true),
    reviewedProperty('withoutSortRemoval', 'without-sort-removal', 'boolean', false, true),
    reviewedProperty('withSearch', 'with-search', 'boolean', false, true),
  ];
  const method = (name, parameters = []) => reviewedMethod(name, parameters, UNSPECIFIED_PUBLIC_RETURN);
  return reviewedPublicDocumentation({
    tag: 'wa-data-grid',
    maturity: { status: 'experimental', since: '3.11' },
    properties,
    slots: ['empty', 'loading', 'no-results'],
    events: [
      reviewedEvent('request'),
      reviewedEvent('wa-cell-click'),
      reviewedEvent('wa-cell-contextmenu', 'CustomEvent', 'always'),
      reviewedEvent('wa-column-move'),
      reviewedEvent('wa-column-pin'),
      reviewedEvent('wa-column-resize'),
      reviewedEvent('wa-column-visibility-change'),
      reviewedEvent('wa-data-error'),
      reviewedEvent('wa-data-request'),
      reviewedEvent('wa-filter-change'),
      reviewedEvent('wa-page-change'),
      reviewedEvent('wa-row-collapse'),
      reviewedEvent('wa-row-expand'),
      reviewedEvent('wa-row-select'),
      reviewedEvent('wa-sort-change'),
    ],
    parts: [
      'body',
      'cell',
      'column-menu',
      'column-menu-button',
      'columns-menu',
      'data-grid',
      'drag-ghost',
      'ellipsis',
      'empty',
      'expand-button',
      'filter-button',
      'filter-panel',
      'first-button',
      'footer',
      'footer-cell',
      'footer-row',
      'group-count',
      'group-row',
      'group-value',
      'header',
      'header-cell',
      'last-button',
      'live-region',
      'loading-overlay',
      'next-button',
      'no-results',
      'page',
      'page-current',
      'page-size',
      'pager',
      'pager-button',
      'pin-indicator',
      'previous-button',
      'resize-handle',
      'row',
      'row-detail',
      'search',
      'select-all-checkbox',
      'sort-indicator',
      'sort-number',
      'table',
      'toolbar',
    ],
    cssProperties: [
      '--accent-color',
      '--background-color',
      '--border-color',
      '--border-radius',
      '--border-width',
      '--cell-padding',
      '--focus-ring',
      '--header-background',
      '--header-row-height',
      '--header-text-color',
      '--indent-size',
      '--max-height',
      '--row-height',
      '--row-hover-background',
      '--selected-background',
      '--stripe-background',
      '--text-color',
      '--transition-duration',
    ],
    methods: [
      method('autoSizeColumn', [reviewedParameter('columnId', 'string')]),
      method('autoSizeColumns'),
      method('collapseAllRows'),
      method('collapseRow', [reviewedParameter('key', 'string | number')]),
      method('copySelectedRows', [reviewedOptionalParameter('options', DATA_GRID_OPTION_TYPE)]),
      method('expandAllRows'),
      method('expandRow', [reviewedParameter('key', 'string | number')]),
      method('exportDataAsCsv', [reviewedParameter('options', DATA_GRID_CSV_OPTION_TYPE)]),
      method('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      method('getColumnFacets', [reviewedParameter('columnId', 'string')]),
      method('getColumnPin', [reviewedParameter('columnId', 'string')]),
      method('getDataAsCsv', [reviewedParameter('options', DATA_GRID_CSV_OPTION_TYPE.replace('fileName?: string; ', ''))]),
      method('getProcessedRows'),
      method('getState'),
      method('getVisibleRows'),
      method('handleColumnsChange'),
      method('handlePageChange'),
      method('handleSearchTermChange'),
      method('pinColumn', [
        reviewedParameter('columnId', 'string'),
        reviewedParameter('side', "'left' | 'right' | false"),
      ]),
      method('reload'),
      method('resetColumns'),
      method('resetState'),
      method('scrollToIndex', [
        reviewedParameter('index', 'number'),
        reviewedParameter('options', "{ align?: 'start' | 'center' | 'end' }"),
      ]),
      method('setState', [reviewedParameter('state', 'DataGridState')]),
      method('sizeColumnsToFit'),
      method('toggleColumn', [
        reviewedParameter('columnId', 'string'),
        reviewedParameter('visible', 'boolean'),
      ]),
    ],
    native: { forwardedEvents: [], delegatedMethods: ['focus'] },
    url: 'https://webawesome.com/docs/components/data-grid/',
    sha256: '2ed6c9c0f4b1cc944d637fa8270c0b839f16aabb0f5f63eed35e6bb385f6f44f',
  });
}

export function reviewedWebAwesomeVideo() {
  const properties = [
    reviewedProperty('autoplay', 'autoplay', 'boolean', false),
    reviewedProperty('autoplayMuted', 'autoplay-muted', 'boolean', false),
    reviewedProperty('autoplayOnVisible', 'autoplay-on-visible', 'boolean', false),
    reviewedProperty('controls', 'controls', "'none' | 'standard' | 'full'", 'standard', true),
    reviewedProperty('currentTime', 'current-time', 'number', 0),
    reviewedProperty('duration', 'duration', 'number', 0),
    reviewedProperty('iconLibrary', 'icon-library', 'string', 'system'),
    reviewedProperty('loop', 'loop', 'boolean', false),
    reviewedProperty('muted', 'muted', 'boolean', false, true),
    reviewedProperty('playing', 'playing', 'boolean', false, true),
    reviewedProperty('poster', 'poster', 'string', ''),
    reviewedProperty('preload', 'preload', "'auto' | 'metadata' | 'none'", 'metadata'),
    reviewedProperty('src', 'src', 'string', ''),
    reviewedProperty('thumbnails', 'thumbnails', 'string', ''),
    reviewedProperty('title', 'title', 'string', ''),
    reviewedProperty('volume', 'volume', 'number', 1),
  ];
  const attributes = properties
    .filter((property) => property.attribute !== null)
    .map((property) => ({
      name: property.attribute,
      property: property.name,
      type: property.type,
      reflects: property.reflects,
      inferred: false,
      deprecated: null,
      hasDefault: property.hasDefault,
      default: property.default,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const nativeEvents = ['ended', 'error', 'loadedmetadata', 'pause', 'play', 'timeupdate', 'volumechange'];

  return {
    tag: 'wa-video',
    module: null,
    tier: 'pro',
    maturity: { status: 'experimental', since: '3.7', deprecated: null },
    surface: {
      attributes,
      properties,
      slots: [
        '',
        'controls-after-play',
        'controls-start',
        'exit-fullscreen-icon',
        'fullscreen-icon',
        'mute-icon',
        'pause-icon',
        'play-icon',
        'poster-icon',
        'volume-icon',
      ].map((name) => ({ name, deprecated: null })),
      events: nativeEvents.map((name) =>
        reviewedNativeEvent(name, 'Event', { bubbles: false, composed: false }),
      ),
      parts: [
        'base',
        'caption',
        'caption-overlay',
        'controls',
        'controls-overlay',
        'poster-overlay',
        'poster-play-button',
        'progress',
        'thumbnail',
        'timeline',
        'timeline-indicator',
        'timeline-thumb',
        'timeline-track',
        'video',
        'video-title-overlay',
        'video-wrapper',
      ].map((name) => ({ name, deprecated: null })),
      cssProperties: [
        '--controls-background',
        '--controls-color',
        '--poster-play-button-background',
      ].map((name) => ({ name, deprecated: null, hasDefault: false })),
      cssStates: [],
      methods: [
        reviewedMethod('exitFullscreen', [], 'Promise<void>'),
        reviewedMethod('getState', [], 'VideoState'),
        reviewedMethod('getVideoElement', [], 'HTMLVideoElement | undefined'),
        reviewedMethod('pause'),
        reviewedMethod('play', [], 'Promise<void>'),
        reviewedMethod('requestFullscreen', [], 'Promise<void>'),
        reviewedMethod('seek', [reviewedParameter('time', 'number')]),
        reviewedMethod('setPlaybackRate', [reviewedParameter('rate', 'number')]),
        reviewedMethod('setVolume', [reviewedParameter('volume', 'number')]),
        reviewedMethod('toggleMute'),
        reviewedMethod('togglePlay'),
      ],
      form: { associated: false, properties: [], methods: [] },
      native: { forwardedEvents: nativeEvents, delegatedMethods: ['pause', 'play'] },
    },
    review: {
      status: 'complete',
      source: 'official-public-documentation',
      sourceUrl: 'https://webawesome.com/docs/components/video/',
      sourceVersion: '3.11.0',
      sourceSha256: 'e46664de348242af28213cb413b6ae824cbe05d7c976da017c53937f5fd75972',
      reviewedAt: '2026-08-02',
      unreviewedSections: [],
    },
  };
}

export function reviewedWebAwesomeVideoPlaylist() {
  const properties = [
    reviewedProperty('controls', 'controls', "'none' | 'standard' | 'full'", 'full', true),
    reviewedProperty('iconLibrary', 'icon-library', 'string', 'system'),
  ];
  const attributes = properties.map((property) => ({
    name: property.attribute,
    property: property.name,
    type: property.type,
    reflects: property.reflects,
    inferred: false,
    deprecated: null,
    hasDefault: property.hasDefault,
    default: property.default,
  }));

  return {
    tag: 'wa-video-playlist',
    module: null,
    tier: 'pro',
    maturity: { status: 'experimental', since: '3.7', deprecated: null },
    surface: {
      attributes,
      properties,
      slots: [{ name: '', deprecated: null }],
      events: [
        {
          name: 'wa-video-change',
          type:
            'CustomEvent<{ previousIndex: number; currentIndex: number; video: { title: string; poster: string; sources: unknown[]; tracks: unknown[] } }>',
          cancelable: 'never',
        },
      ],
      parts: [
        {
          name: 'base',
          deprecated: 'Same-node compatibility alias for the video-playlist part.',
        },
        'video-playlist',
        'playlist',
        'playlist-duration',
        'playlist-item',
        'playlist-thumbnail',
        'playlist-title',
      ].map((part) =>
        typeof part === 'string' ? { name: part, deprecated: null } : part,
      ),
      cssProperties: [],
      cssStates: [],
      methods: [
        reviewedMethod('goTo', [reviewedParameter('index', 'number')]),
        reviewedMethod('next'),
        reviewedMethod('previous'),
      ],
      form: { associated: false, properties: [], methods: [] },
      native: { forwardedEvents: [], delegatedMethods: [] },
    },
    review: {
      status: 'complete',
      source: 'official-public-documentation',
      sourceUrl: 'https://webawesome.com/docs/components/video-playlist/',
      sourceVersion: '3.11.0',
      sourceSha256: 'af8cf002c696f5ee3a63e69f64309add477b5f9bac71668efd13289ca28d4896',
      reviewedAt: '2026-08-02',
      unreviewedSections: [],
    },
  };
}

const MANUAL_UPSTREAM_REVIEWS = new Map([
  ...[...CHART_REVIEW_EVIDENCE.keys()].map((tag) => [tag, reviewedWebAwesomeChart(tag)]),
  ['wa-combobox', reviewedWebAwesomeCombobox()],
  ['wa-data-grid', reviewedWebAwesomeDataGrid()],
  ['wa-date-input', reviewedWebAwesomeDateInput()],
  ['wa-date-picker', reviewedWebAwesomeDatePicker()],
  ['wa-file-input', reviewedWebAwesomeFileInput()],
  ['wa-sparkline', reviewedWebAwesomeSparkline()],
  ['wa-video', reviewedWebAwesomeVideo()],
  ['wa-video-playlist', reviewedWebAwesomeVideoPlaylist()],
]);

function upstreamComponents(manifest, ecosystem, fixture, existing) {
  const prefix = ecosystem === 'webawesome' ? 'wa-' : 'sl-';
  const tierByTag =
    ecosystem === 'webawesome'
      ? new Map([
          ...fixture.webawesome.free.map((tag) => [tag, 'free']),
          ...fixture.webawesome.pro.map((tag) => [tag, 'pro']),
        ])
      : new Map(fixture.shoelace.tags.map((tag) => [tag, 'free']));
  const normalized = normalizeManifest(manifest, { ecosystem, tierByTag });
  const byTag = new Map(normalized.filter((entry) => entry.tag.startsWith(prefix)).map((entry) => [entry.tag, entry]));
  const previous = new Map((existing?.upstreams?.[ecosystem]?.components ?? []).map((entry) => [entry.tag, entry]));
  const catalog =
    ecosystem === 'webawesome' ? [...fixture.webawesome.free, ...fixture.webawesome.pro] : [...fixture.shoelace.tags];

  return catalog
    .map((tag) => {
      const manualReview = MANUAL_UPSTREAM_REVIEWS.get(tag);
      if (manualReview) return structuredClone(manualReview);
      const published = byTag.get(tag);
      if (published) return published;
      const reviewed = previous.get(tag);
      if (reviewed?.review?.status === 'complete') return reviewed;
      return {
        tag,
        module: null,
        tier: tierByTag.get(tag),
        maturity: { status: 'unreviewed', since: null, deprecated: null },
        surface: emptySurface(),
        review: {
          status: 'tag-only',
          source: 'pinned-public-tag-catalog',
          unreviewedSections: [...SURFACE_SECTIONS],
        },
      };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

const REQUIRED_TARGETS = new Map([
  ['sl-alert', 'lr-alert'],
  ['sl-split-panel', 'lr-split-panel'],
  ['wa-data-grid', 'lr-data-grid'],
  ['wa-page', 'lr-page'],
  ['wa-split-panel', 'lr-split-panel'],
  ['wa-video', 'lr-video'],
  ['wa-video-playlist', 'lr-video-playlist'],
]);

const DERIVED_REL_DRIFT = [
  { code: 'missing-attribute', section: 'attributes', member: 'rel' },
  { code: 'missing-property', section: 'properties', member: 'rel' },
];

const READONLY_DERIVED_REL_DRIFT = [
  {
    code: 'readonly-mismatch',
    section: 'properties',
    member: 'rel',
    expected: false,
    actual: true,
  },
];

const INCLUDE_SECURITY_DRIFT = [
  { code: 'missing-attribute', section: 'attributes', member: 'allow-scripts' },
  {
    code: 'default-mismatch',
    section: 'attributes',
    member: 'mode',
    expected: 'cors',
    actual: 'same-origin',
  },
  { code: 'missing-property', section: 'properties', member: 'allowScripts' },
];

const DECISION_OVERRIDES = new Map([
  [
    'wa-breadcrumb-item',
    {
      classification: 'warning-required',
      rationale:
        'Lyra derives safe rel="noopener noreferrer" behavior from target and does not expose an independently settable rel; migration leaves the use unchanged and reports the security-sensitive difference.',
      expectedDrift: DERIVED_REL_DRIFT,
    },
  ],
  [
    'sl-breadcrumb-item',
    {
      classification: 'warning-required',
      rationale:
        'Lyra derives safe rel="noopener noreferrer" behavior from target and does not expose an independently settable rel; migration leaves the use unchanged and reports the security-sensitive difference.',
      expectedDrift: DERIVED_REL_DRIFT,
    },
  ],
  [
    'wa-button',
    {
      classification: 'warning-required',
      rationale:
        'Lyra derives safe rel="noopener noreferrer" behavior from target and ignores an independently authored rel; migration leaves the use unchanged and reports the security-sensitive difference.',
      expectedDrift: READONLY_DERIVED_REL_DRIFT,
    },
  ],
  [
    'sl-button',
    {
      classification: 'warning-required',
      rationale:
        'Lyra derives safe rel="noopener noreferrer" behavior from target and ignores an independently authored rel; migration leaves the use unchanged and reports the security-sensitive difference.',
      expectedDrift: READONLY_DERIVED_REL_DRIFT,
    },
  ],
  [
    'wa-include',
    {
      classification: 'warning-required',
      rationale:
        'Lyra intentionally sanitizes included markup and keeps a same-origin default; uses that depend on cross-origin or script-executing behavior require an explicit security warning rather than a silent rename.',
      expectedDrift: INCLUDE_SECURITY_DRIFT,
    },
  ],
  [
    'sl-include',
    {
      classification: 'warning-required',
      rationale:
        'Lyra intentionally sanitizes included markup and keeps a same-origin default; uses that depend on cross-origin or script-executing behavior require an explicit security warning rather than a silent rename.',
      expectedDrift: [
        ...INCLUDE_SECURITY_DRIFT.slice(0, 2),
        { code: 'missing-event', section: 'events', member: 'sl-error' },
        INCLUDE_SECURITY_DRIFT[2],
      ],
    },
  ],
]);

const DECISION_NOTES = new Map([
  [
    'wa-video',
    'Lyra adds load(), validates media and thumbnail URLs, preserves consumer source/track nodes, caps thumbnail VTT input, and rejects unsupported fullscreen requests. These fail-closed additions do not change the documented safe-use contract.',
  ],
  [
    'wa-video-playlist',
    'Lyra preserves the reviewed direct-child, first-active, navigation, control-forwarding, immutable event-snapshot, and ended auto-advance behavior. It adds autoAdvance and repeat controls without removing or changing the mapped upstream surface.',
  ],
]);

// When Lyra intentionally keeps a v8 default that differs from a source contract, migration
// inserts the source default only when the consumer omitted the attribute. This preserves source
// behavior without changing Lyra's own default for newly-authored markup.
const REVIEWED_DEFAULT_REWRITES = new Map([
  [
    'sl-badge',
    [
      {
        memberKind: 'attribute',
        member: 'variant',
        action: 'insert-if-absent',
        value: 'primary',
      },
    ],
  ],
  [
    'sl-qr-code',
    [
      {
        memberKind: 'attribute',
        member: 'background',
        action: 'insert-if-absent',
        value: 'white',
      },
      {
        memberKind: 'attribute',
        member: 'fill',
        action: 'insert-if-absent',
        value: 'black',
      },
    ],
  ],
  [
    'sl-radio-group',
    [
      {
        memberKind: 'attribute',
        member: 'name',
        action: 'insert-if-absent',
        value: 'option',
      },
    ],
  ],
  [
    'sl-range',
    [
      {
        memberKind: 'attribute',
        member: 'tooltip',
        action: 'insert-if-absent',
        value: 'top',
      },
    ],
  ],
  [
    'wa-badge',
    [
      {
        memberKind: 'attribute',
        member: 'appearance',
        action: 'insert-if-absent',
        value: 'accent',
      },
      {
        memberKind: 'attribute',
        member: 'variant',
        action: 'insert-if-absent',
        value: 'brand',
      },
    ],
  ],
]);

function summarizeDrift(drift) {
  const byCode = new Map();
  for (const finding of drift) {
    const members = byCode.get(finding.code) ?? [];
    members.push(finding.member);
    byCode.set(finding.code, members);
  }
  const summaries = [...byCode]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, members]) => {
      const examples = [...new Set(members)].slice(0, 5).join(', ');
      return `${members.length} ${code}${examples ? ` (${examples})` : ''}`;
    });
  return `Prefix substitution is not currently public-surface safe: ${summaries.join('; ')}.`;
}

function attributeRewrites(fixture, upstreamTag) {
  return (fixture.attributeRenames ?? [])
    .filter((entry) => entry.upstream === upstreamTag)
    .map(({ from, to }) => ({ from, to }))
    .filter((entry) => entry.from !== entry.to)
    .sort((a, b) => a.from.localeCompare(b.from));
}

function normalizedRewrites(rewrites = {}) {
  const normalized = emptyRewrites();
  for (const section of Object.keys(normalized)) {
    normalized[section] = Array.isArray(rewrites[section]) ? rewrites[section] : [];
  }
  return normalized;
}

function normalizedNormalizations(normalizations = {}) {
  const normalized = emptyNormalizations();
  for (const section of Object.keys(normalized)) {
    normalized[section] = Array.isArray(normalizations[section]) ? structuredClone(normalizations[section]) : [];
  }
  return normalized;
}

const reviewedDefaultEquivalence = (member, upstream, target) => ({
  memberKind: 'attribute',
  member,
  upstream,
  target,
});

const reviewedPropertyDefaultEquivalence = (member, upstream, target) => ({
  memberKind: 'property',
  member,
  upstream,
  target,
});

const reviewedTypeEquivalence = (memberKind, member, upstream, target) => ({
  memberKind,
  member,
  upstream,
  target,
});

// Both upstream and Lyra create one modal-coordination controller per instance. Their published
// manifests serialize the two original implementations differently (`new Modal(this)` versus the
// structurally equivalent object literal), so compare the exact reviewed runtime representations
// here instead of pretending either implementation spelling is a codemod rewrite.
const LYRA_MODAL_CONTROLLER_DEFAULT =
  '{ activateExternal: () => { this.externalModalDepth++; if (this.externalModalDepth === 1) ' +
  'this.overlay?.suspend(); }, deactivateExternal: () => { if (this.externalModalDepth === 0) return; ' +
  'this.externalModalDepth--; if (this.externalModalDepth === 0 && this.open && this.modalSurface) { ' +
  'this.overlay?.resume(); queueMicrotask(() => this.focusInitial()); } }, }';

// These are public-surface comparison normalizations, not executable source rewrites. The default
// pairs are semantic aliases/absence representations, and Shoelace's `get-tag` is an analyzer-
// inferred attribute for the documented property-only getTag callback. They affect comparison
// only and are never executable codemod rewrites.
//
// Type tuples are `[member kind, exact upstream members, exact upstream type, exact Lyra CEM
// type]`. They enumerate target aliases whose source declarations were reviewed to accept the
// complete upstream type. Keeping both strings and every member explicit makes analyzer or API
// changes fail validation instead of silently broadening a global alias rule.
const REVIEWED_TYPE_EQUIVALENCE_GROUPS = new Map([
  ['sl-alert', [['attribute', ['countdown'], "'rtl' | 'ltr' | undefined", 'AlertCountdown']]],
  [
    'sl-badge',
    [[
      'attribute',
      ['variant'],
      "'primary' | 'success' | 'neutral' | 'warning' | 'danger'",
      "BadgeVariant | 'primary'",
    ]],
  ],
  [
    'sl-avatar',
    [
      ['attribute', ['loading'], "'eager' | 'lazy'", 'AvatarLoading'],
      ['attribute', ['shape'], "'circle' | 'square' | 'rounded'", 'AvatarShape'],
    ],
  ],
  [
    'sl-breadcrumb-item',
    [['attribute', ['target'], "'_blank' | '_parent' | '_self' | '_top' | undefined", 'BreadcrumbItemTarget | undefined']],
  ],
  [
    'sl-button',
    [
      [
        'attribute',
        ['form-enctype'],
        "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'",
        'ButtonFormEnctype',
      ],
      ['attribute', ['form-method'], "'post' | 'get'", 'ButtonFormMethod'],
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['type'], "'button' | 'submit' | 'reset'", 'ButtonType'],
      [
        'attribute',
        ['variant'],
        "'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'",
        'ButtonVariant',
      ],
    ],
  ],
  ['sl-checkbox', [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'sl-color-picker',
    [
      ['attribute', ['format'], "'hex' | 'rgb' | 'hsl' | 'hsv'", 'LyraColorPickerFormat'],
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'sl-copy-button',
    [['attribute', ['tooltip-placement'], "'top' | 'right' | 'bottom' | 'left'", 'LyraCopyButtonTooltipPlacement']],
  ],
  ['sl-drawer', [['attribute', ['placement'], "'top' | 'end' | 'bottom' | 'start'", 'LyraDrawerPlacement']]],
  ['sl-dropdown', [['attribute', ['sync'], "'width' | 'height' | 'both' | undefined", 'PlaceSync | undefined']]],
  [
    'sl-format-bytes',
    [
      ['attribute', ['display'], "'long' | 'short' | 'narrow'", 'FormatDisplay'],
      ['attribute', ['unit'], "'byte' | 'bit'", 'FormatBytesUnit'],
    ],
  ],
  [
    'sl-format-date',
    [
      ['attribute', ['day', 'hour', 'minute', 'second', 'year'], "'numeric' | '2-digit'", 'FormatDateNumeric | undefined'],
      ['attribute', ['era', 'weekday'], "'narrow' | 'short' | 'long'", 'FormatDateText | undefined'],
      ['attribute', ['hour-format'], "'auto' | '12' | '24'", 'FormatDateHour'],
      [
        'attribute',
        ['month'],
        "'numeric' | '2-digit' | 'narrow' | 'short' | 'long'",
        'FormatDateMonth | undefined',
      ],
      ['attribute', ['time-zone-name'], "'short' | 'long'", 'FormatDateTimeZoneName | undefined'],
    ],
  ],
  [
    'sl-format-number',
    [
      ['attribute', ['currency-display'], "'symbol' | 'narrowSymbol' | 'code' | 'name'", 'FormatCurrencyDisplay'],
      ['attribute', ['type'], "'currency' | 'decimal' | 'percent'", 'FormatNumberType'],
    ],
  ],
  ['sl-include', [['attribute', ['mode'], "'cors' | 'no-cors' | 'same-origin'", 'LyraIncludeMode']]],
  [
    'sl-input',
    [
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
      [
        'attribute',
        ['type'],
        "| 'date' | 'datetime-local' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'time' | 'url'",
        'LyraInputType',
      ],
    ],
  ],
  ['sl-menu-item', [['attribute', ['type'], "'normal' | 'checkbox'", 'MenuItemType']]],
  [
    'sl-popup',
    [
      ['attribute', ['arrow-placement'], "'start' | 'end' | 'center' | 'anchor'", 'LyraArrowPlacement'],
      ['attribute', ['auto-size'], "'horizontal' | 'vertical' | 'both'", 'PlaceAutoSize | null'],
      ['attribute', ['flip-fallback-strategy'], "'best-fit' | 'initial'", 'LyraPopupFlipFallbackStrategy'],
      ['attribute', ['strategy'], "'absolute' | 'fixed'", 'PlaceStrategy'],
      ['attribute', ['sync'], "'width' | 'height' | 'both'", 'PlaceSync | null'],
    ],
  ],
  ['sl-qr-code', [['attribute', ['error-correction'], "'L' | 'M' | 'Q' | 'H'", 'LyraQrCodeErrorCorrection']]],
  ['sl-radio', [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']]],
  ['sl-radio-button', [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']]],
  ['sl-radio-group', [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'sl-relative-time',
    [
      ['attribute', ['format'], "'long' | 'short' | 'narrow'", 'FormatDisplay'],
      ['attribute', ['numeric'], "'always' | 'auto'", 'RelativeTimeNumeric'],
    ],
  ],
  ['sl-select', [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']]],
  ['sl-skeleton', [['attribute', ['effect'], "'pulse' | 'sheen' | 'none'", 'SkeletonEffect']]],
  ['sl-split-panel', [['attribute', ['primary'], "'start' | 'end' | undefined", 'SplitPanelPrimary | undefined']]],
  ['sl-switch', [['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'sl-tab-group',
    [
      ['attribute', ['activation'], "'auto' | 'manual'", 'TabGroupActivation'],
      ['attribute', ['placement'], "'top' | 'bottom' | 'start' | 'end'", 'TabGroupPlacement'],
    ],
  ],
  [
    'sl-tag',
    [[
      'attribute',
      ['variant'],
      "'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'",
      "BadgeVariant | 'primary' | 'text'",
    ]],
  ],
  [
    'sl-textarea',
    [
      ['attribute', ['resize'], "'none' | 'vertical' | 'auto'", 'TextareaResize'],
      ['attribute', ['size'], "'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  ['sl-tree', [['attribute', ['selection'], "'single' | 'multiple' | 'leaf'", 'TreeSelection']]],
  [
    'wa-accordion',
    [
      ['attribute', ['heading-level'], 'string', 'LyraAccordionHeadingLevel'],
      ['attribute', ['icon-placement'], "'start' | 'end'", 'LyraAccordionIconPlacement'],
      ['attribute', ['mode'], "'single' | 'single-collapsible' | 'multiple'", 'LyraAccordionMode'],
    ],
  ],
  [
    'wa-avatar',
    [
      ['attribute', ['loading'], "'eager' | 'lazy'", 'AvatarLoading'],
      ['attribute', ['shape'], "'circle' | 'square' | 'rounded'", 'AvatarShape'],
    ],
  ],
  [
    'wa-badge',
    [
      ['attribute', ['appearance'], "'accent' | 'filled' | 'outlined' | 'filled-outlined'", 'BadgeAppearance'],
      ['attribute', ['attention'], "'none' | 'pulse' | 'bounce'", 'BadgeAttention'],
      [
        'attribute',
        ['variant'],
        "'brand' | 'neutral' | 'success' | 'warning' | 'danger'",
        "BadgeVariant | 'primary'",
      ],
    ],
  ],
  [
    'wa-bar-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  [
    'wa-breadcrumb-item',
    [['attribute', ['target'], "'_blank' | '_parent' | '_self' | '_top' | undefined", 'BreadcrumbItemTarget | undefined']],
  ],
  [
    'wa-bubble-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  [
    'wa-button',
    [
      ['attribute', ['appearance'], "'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain'", 'ButtonAppearance'],
      [
        'attribute',
        ['formenctype'],
        "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'",
        'ButtonFormEnctype | undefined',
      ],
      ['attribute', ['formmethod'], "'post' | 'get'", 'ButtonFormMethod | undefined'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['type'], "'button' | 'submit' | 'reset'", 'ButtonType'],
      ['attribute', ['variant'], "'neutral' | 'brand' | 'success' | 'warning' | 'danger'", 'ButtonVariant'],
    ],
  ],
  ['wa-button-group', [['attribute', ['orientation'], "'horizontal' | 'vertical'", 'ButtonGroupOrientation']]],
  [
    'wa-callout',
    [
      ['attribute', ['appearance'], "'accent' | 'filled' | 'outlined' | 'plain' | 'filled-outlined'", 'CalloutAppearance'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'CalloutSize'],
      ['attribute', ['variant'], "'brand' | 'neutral' | 'success' | 'warning' | 'danger'", 'CalloutVariant'],
    ],
  ],
  ['wa-card', [['attribute', ['appearance'], "'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain'", 'CardAppearance']]],
  [
    'wa-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  ['wa-checkbox', [['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'wa-checkbox-group',
    [
      ['attribute', ['orientation'], "'horizontal' | 'vertical'", 'CheckboxGroupOrientation'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-color-picker',
    [
      ['attribute', ['format'], "'hex' | 'rgb' | 'hsl' | 'hsv'", 'LyraColorPickerFormat'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-combobox',
    [
      ['attribute', ['placement'], "'top' | 'bottom'", 'LyraComboboxPlacement'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-copy-button',
    [
      ['attribute', ['tooltip-placement'], "'top' | 'right' | 'bottom' | 'left'", 'LyraCopyButtonTooltipPlacement'],
      ['attribute', ['tooltip'], "'full' | 'copy' | 'none'", 'LyraCopyButtonTooltip'],
    ],
  ],
  [
    'wa-data-grid',
    [
      ['attribute', ['appearance'], "'outlined' | 'plain'", 'DataGridAppearance'],
      ['attribute', ['selectable'], "'' | 'single' | 'multiple' | 'none'", 'DataGridSelectable'],
    ],
  ],
  [
    'wa-date-input',
    [
      ['attribute', ['disabled-dates'], 'string | string[] | Date[]', 'LyraDatePickerDisabledDates'],
      ['attribute', ['page-by'], "'months' | 'single'", 'LyraDatePickerPageBy'],
      ['attribute', ['size'], "WaDateInputSize | 'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['weekday-format'], "'narrow' | 'short' | 'long'", 'WeekdayFormat'],
    ],
  ],
  [
    'wa-date-picker',
    [
      ['attribute', ['disabled-dates'], 'string | string[] | Date[]', 'LyraDatePickerDisabledDates'],
      ['attribute', ['size'], "WaDatePickerSize | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  ['wa-details', [['attribute', ['icon-placement'], "'start' | 'end'", 'LyraDetailsIconPlacement']]],
  ['wa-divider', [['attribute', ['orientation'], "'horizontal' | 'vertical'", 'DividerOrientation']]],
  [
    'wa-doughnut-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  ['wa-drawer', [['attribute', ['placement'], "'top' | 'end' | 'bottom' | 'start'", 'LyraDrawerPlacement']]],
  ['wa-dropdown', [['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'wa-dropdown-item',
    [
      ['attribute', ['type'], "'normal' | 'checkbox'", 'MenuItemType'],
      ['attribute', ['variant'], "'danger' | 'default'", 'MenuItemVariant'],
    ],
  ],
  [
    'wa-file-input',
    [
      ['attribute', ['capture'], "'user' | 'environment'", 'LyraFileInputCapture'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-format-bytes',
    [
      ['attribute', ['display'], "'long' | 'short' | 'narrow'", 'FormatDisplay'],
      ['attribute', ['unit'], "'byte' | 'bit'", 'FormatBytesUnit'],
    ],
  ],
  [
    'wa-format-date',
    [
      ['attribute', ['day', 'hour', 'minute', 'second', 'year'], "'numeric' | '2-digit'", 'FormatDateNumeric | undefined'],
      ['attribute', ['era', 'weekday'], "'narrow' | 'short' | 'long'", 'FormatDateText | undefined'],
      ['attribute', ['hour-format'], "'auto' | '12' | '24'", 'FormatDateHour'],
      [
        'attribute',
        ['month'],
        "'numeric' | '2-digit' | 'narrow' | 'short' | 'long'",
        'FormatDateMonth | undefined',
      ],
      ['attribute', ['time-zone-name'], "'short' | 'long'", 'FormatDateTimeZoneName | undefined'],
    ],
  ],
  [
    'wa-format-number',
    [
      ['attribute', ['currency-display'], "'symbol' | 'narrowSymbol' | 'code' | 'name'", 'FormatCurrencyDisplay'],
      ['attribute', ['type'], "'currency' | 'decimal' | 'percent'", 'FormatNumberType'],
    ],
  ],
  [
    'wa-icon',
    [
      [
        'attribute',
        ['animation'],
        "'beat' | 'fade' | 'beat-fade' | 'bounce' | 'flip' | 'flip-360' | 'shake' | 'spin' | 'spin-pulse' | 'spin-reverse' | 'spin-snap' | 'spin-snap-4' | 'spin-snap-8' | 'buzz' | 'wag' | 'float' | 'swing' | 'jello' | undefined",
        'LyraIconAnimation | undefined',
      ],
      ['attribute', ['canvas'], "'fixed' | 'auto' | 'square' | 'roomy' | undefined", 'LyraIconCanvas | undefined'],
      ['attribute', ['flip'], "'x' | 'y' | 'both' | undefined", 'LyraIconFlip | undefined'],
    ],
  ],
  ['wa-include', [['attribute', ['mode'], "'cors' | 'no-cors' | 'same-origin'", 'LyraIncludeMode']]],
  [
    'wa-input',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraAppearance'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
      [
        'attribute',
        ['type'],
        "'date' | 'datetime-local' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'time' | 'url'",
        'LyraInputType',
      ],
    ],
  ],
  ['wa-known-date', [['attribute', ['size'], "'s' | 'xs' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'wa-line-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  ['wa-markdown', [['property', ['marked'], 'Marked', 'OptionalPeerApi | undefined']]],
  [
    'wa-number-input',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraAppearance'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-otp-input',
    [
      ['attribute', ['case'], "'preserve' | 'upper' | 'lower'", 'OtpInputCase'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['type'], "'numeric' | 'alpha' | 'alphanumeric'", 'OtpInputType'],
    ],
  ],
  [
    'wa-page',
    [
      ['attribute', ['navigation-placement'], "'start' | 'end'", 'PageNavigationPlacement'],
      ['attribute', ['view'], "'mobile' | 'desktop'", 'PageView'],
    ],
  ],
  [
    'wa-pagination',
    [
      ['attribute', ['appearance'], "'outlined' | 'filled' | 'plain'", 'LyraAppearance'],
      ['attribute', ['format'], "'standard' | 'compact'", 'LyraPaginationFormat'],
    ],
  ],
  [
    'wa-pie-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  [
    'wa-polar-area-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  [
    'wa-popup',
    [
      ['attribute', ['arrow-placement'], "'start' | 'end' | 'center' | 'anchor'", 'LyraArrowPlacement'],
      ['attribute', ['auto-size'], "'horizontal' | 'vertical' | 'both'", 'PlaceAutoSize | null'],
      ['attribute', ['boundary'], "'viewport' | 'scroll'", 'LyraPopupBoundary'],
      ['attribute', ['flip-fallback-strategy'], "'best-fit' | 'initial'", 'LyraPopupFlipFallbackStrategy'],
      ['attribute', ['sync'], "'width' | 'height' | 'both'", 'PlaceSync | null'],
    ],
  ],
  ['wa-qr-code', [['attribute', ['error-correction'], "'L' | 'M' | 'Q' | 'H'", 'LyraQrCodeErrorCorrection']]],
  [
    'wa-radar-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  [
    'wa-radio',
    [
      ['attribute', ['appearance'], "'default' | 'button'", 'RadioAppearance'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-radio-group',
    [
      ['attribute', ['orientation'], "'horizontal' | 'vertical'", 'RadioGroupOrientation'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-random-content',
    [
      ['attribute', ['animation'], "'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right'", 'LyraRandomContentAnimation'],
      ['attribute', ['mode'], "'random' | 'unique' | 'sequence'", 'LyraRandomContentMode'],
    ],
  ],
  [
    'wa-relative-time',
    [
      ['attribute', ['format'], "'long' | 'short' | 'narrow'", 'FormatDisplay'],
      ['attribute', ['numeric'], "'always' | 'auto'", 'RelativeTimeNumeric'],
    ],
  ],
  [
    'wa-scatter-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'OptionalPeerApi | undefined'],
    ],
  ],
  [
    'wa-select',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraAppearance'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-rating',
    [[
      'attribute',
      ['size'],
      "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
      "LyraRatingSize | 'small' | 'medium' | 'large'",
    ]],
  ],
  ['wa-skeleton', [['attribute', ['effect'], "'pulse' | 'sheen' | 'none'", 'SkeletonEffect']]],
  [
    'wa-slider',
    [
      ['attribute', ['orientation'], "'horizontal' | 'vertical'", 'SliderOrientation'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['tooltip-placement'], "'top' | 'right' | 'bottom' | 'left'", 'SliderTooltipPlacement'],
    ],
  ],
  [
    'wa-split-panel',
    [
      ['attribute', ['orientation'], "'horizontal' | 'vertical'", 'SplitPanelOrientation'],
      ['attribute', ['primary'], "'start' | 'end' | undefined", 'SplitPanelPrimary | undefined'],
    ],
  ],
  ['wa-switch', [['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize']]],
  [
    'wa-tab-group',
    [
      ['attribute', ['activation'], "'auto' | 'manual'", 'TabGroupActivation'],
      ['attribute', ['placement'], "'top' | 'bottom' | 'start' | 'end'", 'TabGroupPlacement'],
    ],
  ],
  [
    'wa-tag',
    [
      ['attribute', ['appearance'], "'accent' | 'filled' | 'outlined' | 'filled-outlined'", 'BadgeAppearance'],
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        "BadgeSize | 'small' | 'medium' | 'large'",
      ],
      [
        'attribute',
        ['variant'],
        "'brand' | 'neutral' | 'success' | 'warning' | 'danger'",
        "BadgeVariant | 'primary' | 'text'",
      ],
    ],
  ],
  [
    'wa-textarea',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraAppearance'],
      ['attribute', ['resize'], "'none' | 'vertical' | 'horizontal' | 'both' | 'auto'", 'TextareaResize'],
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
    ],
  ],
  [
    'wa-time-input',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraAppearance'],
      ['attribute', ['hour-format'], "'auto' | '12' | '24'", 'LyraTimeInputHourFormat'],
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end'",
        'LyraTimeInputPlacement',
      ],
      ['attribute', ['size'], "'s' | 'xs' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraSize'],
      ['attribute', ['step'], "number | 'any'", 'LyraTimeInputStep'],
    ],
  ],
  [
    'wa-toast',
    [
      [
        'attribute',
        ['placement'],
        "'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end'",
        'ToastPlacement',
      ],
    ],
  ],
  [
    'wa-toast-item',
    [
      [
        'attribute',
        ['size'],
        "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
        "ToastSize | 'small' | 'medium' | 'large'",
      ],
      ['attribute', ['variant'], "'brand' | 'success' | 'warning' | 'danger' | 'neutral'", 'ToastVariant'],
    ],
  ],
  ['wa-tree', [['attribute', ['selection'], "'single' | 'multiple' | 'leaf' | 'leaf-multiple'", 'TreeSelection']]],
  [
    'wa-video',
    [
      ['attribute', ['controls'], "'none' | 'standard' | 'full'", 'LyraVideoControls'],
      ['attribute', ['preload'], "'auto' | 'metadata' | 'none'", 'LyraVideoPreload'],
    ],
  ],
  ['wa-video-playlist', [['attribute', ['controls'], "'none' | 'standard' | 'full'", 'LyraVideoControls']]],
  ['wa-zoomable-frame', [['attribute', ['loading'], "'eager' | 'lazy'", 'ZoomableFrameLoading']]],
]);

// These pairs cannot be expanded as plain local aliases. They cover reviewed TypeScript utility
// types, dependency-owned names, generic/default projections, and CEM spellings that differ while
// preserving the upstream assignment shape. They remain exact per tag and member for the same
// stale-rule guarantees as the local-alias table above.
const REVIEWED_OPAQUE_TYPE_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-alert',
    [['attribute', ['variant'], "'primary' | 'success' | 'neutral' | 'warning' | 'danger'", 'AlertVariant']],
  ],
  ['sl-carousel', [['attribute', ['orientation'], "'horizontal' | 'vertical'", 'LyraCarouselOrientation']]],
  ['sl-dropdown', [['attribute', ['placement'], "| 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'", 'Placement']]],
  ['sl-format-date', [['attribute', ['time-zone'], 'string', "Intl.DateTimeFormatOptions['timeZone'] | undefined"]]],
  [
    'sl-popup',
    [
      ['attribute', ['anchor'], 'Element | string | VirtualElement', 'LyraPopupAnchor | null'],
      ['attribute', ['placement'], "| 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'", 'Placement'],
    ],
  ],
  ['sl-select', [['attribute', ['placement'], "'top' | 'bottom'", 'Placement']]],
  ['sl-tooltip', [['attribute', ['placement'], "| 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'", 'Placement']]],
  [
    'wa-accordion',
    [['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined' | 'plain'", 'LyraAccordionAppearance']],
  ],
  [
    'wa-bar-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  ['wa-card', [['attribute', ['orientation'], "'horizontal' | 'vertical'", 'CardOrientation']]],
  ['wa-carousel', [['attribute', ['orientation'], "'horizontal' | 'vertical'", 'LyraCarouselOrientation']]],
  [
    'wa-bubble-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-color-picker',
    [[
      'attribute',
      ['placement'],
      "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
      'Placement',
    ]],
  ],
  [
    'wa-combobox',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraComboboxAppearance'],
      ['property', ['filter'], '((option: HTMLElement, query: string) => boolean) | null', 'OptionFilter | null'],
      ['property', ['getTag'], '(option: HTMLElement) => unknown', 'LyraComboboxTagRenderer | undefined'],
      ['property', ['validators'], 'Validator[]', 'unknown[]'],
    ],
  ],
  [
    'wa-data-grid',
    [
      ['attribute', ['size'], "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'DataGridSize'],
      ['property', ['columns'], 'DataGridColumn[]', 'DataGridColumn<Row>[]'],
      [
        'property',
        ['dataSource'],
        '((request: DataGridRequest) => Promise<DataGridResponse>) | null',
        '((request: DataGridRequest) => Promise<DataGridResponse<Row>>) | null',
      ],
      ['property', ['expandedKeys', 'selectedKeys'], '(string | number)[]', 'DataGridKey[]'],
      ['property', ['filters'], '{ id: string; value: unknown }[]', 'DataGridFilter[]'],
      [
        'property',
        ['searchFn'],
        '((value: unknown, searchTerm: string, row: Row) => boolean) | null',
        '((value: unknown, term: string, row: Row) => boolean) | null',
      ],
    ],
  ],
  [
    'wa-date-input',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraDateInputAppearance'],
      ['attribute', ['mode'], 'WaDateInputMode', "'single' | 'range'"],
      ['property', ['dayContent'], 'WaDateInputDayContent | undefined', 'LyraDatePickerDayContent | undefined'],
      ['property', ['isDateDisabled'], '((date: Date) => boolean) | undefined', '(date: Date) => boolean | undefined'],
      ['property', ['validators'], 'Validator[]', 'LyraDateInputValidator[]'],
      ['property', ['valueAsRange'], '{ from: Date | null; to: Date | null }', 'DateRange'],
    ],
  ],
  [
    'wa-date-picker',
    [
      ['attribute', ['first-day-of-week'], 'WaDatePickerFirstDayOfWeek', 'string'],
      ['attribute', ['mode'], 'WaDatePickerMode', 'CalendarMode'],
      ['attribute', ['weekday-format'], 'WaDatePickerWeekdayFormat', 'WeekdayFormat'],
      ['property', ['isDateDisabled'], '((date: Date) => boolean) | undefined', '(date: Date) => boolean | undefined'],
      ['property', ['valueAsRange'], 'WaDatePickerRange', 'DateRange'],
    ],
  ],
  ['wa-details', [['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined' | 'plain'", 'LyraDetailsAppearance']]],
  [
    'wa-doughnut-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-dropdown',
    [[
      'attribute',
      ['placement'],
      "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
      'Placement',
    ]],
  ],
  ['wa-file-input', [['property', ['validators'], 'Validator[]', 'unknown[]']]],
  ['wa-format-date', [['attribute', ['time-zone'], 'string', "Intl.DateTimeFormatOptions['timeZone'] | undefined"]]],
  ['wa-known-date', [['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraKnownDateAppearance']]],
  [
    'wa-line-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-otp-input',
    [['attribute', ['appearance'], "'outlined' | 'filled' | 'filled-outlined' | 'contained'", 'OtpInputAppearance']],
  ],
  [
    'wa-pie-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-polar-area-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-popover',
    [[
      'attribute',
      ['placement'],
      "'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'",
      'Placement',
    ]],
  ],
  [
    'wa-popup',
    [
      ['attribute', ['anchor'], 'Element | string | VirtualElement', 'LyraPopupAnchor | null'],
      [
        'attribute',
        ['placement'],
        "'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'right' | 'right-start' | 'right-end' | 'left' | 'left-start' | 'left-end'",
        'Placement',
      ],
    ],
  ],
  [
    'wa-radar-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-scatter-chart',
    [['attribute', ['legend-position'], "LayoutPosition | 'start' | 'end'", 'LyraChartLegendPosition']],
  ],
  [
    'wa-select',
    [
      ['attribute', ['placement'], "'top' | 'bottom'", 'Placement'],
      [
        'property',
        ['getTag'],
        '(option: WaOption, index: number) => TemplateResult | string | HTMLElement',
        'LyraSelectTagRenderer | undefined',
      ],
    ],
  ],
  [
    'wa-slider',
    [['property', ['valueFormatter'], '(value: number) => string', 'SliderValueFormatter | undefined']],
  ],
  [
    'wa-sparkline',
    [
      ['attribute', ['appearance'], "'gradient' | 'line' | 'solid'", 'LyraSparklineAppearance'],
      ['attribute', ['curve'], "'linear' | 'natural' | 'step'", 'LyraSparklineCurve'],
      ['attribute', ['trend'], "'positive' | 'negative' | 'neutral'", 'LyraSparklineTrend | undefined'],
    ],
  ],
  ['wa-scroller', [['attribute', ['orientation'], "'horizontal' | 'vertical'", 'ScrollerOrientation']]],
  [
    'wa-tooltip',
    [[
      'attribute',
      ['placement'],
      "'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'",
      'Placement',
    ]],
  ],
]);

const FORM_OWNER_ATTRIBUTE_TYPE_EQUIVALENCE_TAGS = [
  'sl-button',
  'sl-checkbox',
  'sl-color-picker',
  'sl-input',
  'sl-radio-group',
  'sl-range',
  'sl-select',
  'sl-switch',
  'sl-textarea',
];

// Web Awesome publishes nullable write types for string-backed form attributes. Lyra accepts the
// same null writes as attribute removal while preserving a canonical string read type, so record
// each affected tag/member pair instead of widening editor read metadata or applying a global
// nullable-string rule.
const NULLABLE_STRING_ATTRIBUTE_TYPE_EQUIVALENCE_MEMBERS = new Map([
  ['wa-button', ['name']],
  ['wa-checkbox', ['name', 'value']],
  ['wa-color-picker', ['name', 'value']],
  ['wa-combobox', ['name']],
  ['wa-date-input', ['name']],
  ['wa-input', ['name', 'value']],
  ['wa-known-date', ['name']],
  ['wa-number-input', ['name', 'value']],
  ['wa-otp-input', ['name', 'value']],
  ['wa-popover', ['for']],
  ['wa-radio', ['name']],
  ['wa-radio-group', ['name', 'value']],
  ['wa-rating', ['name']],
  ['wa-select', ['name']],
  ['wa-switch', ['name', 'value']],
  ['wa-textarea', ['name']],
  ['wa-time-input', ['name']],
  ['wa-tooltip', ['for']],
]);

// Chart.js 4.5.1's `ChartType = keyof ChartTypeRegistry` is the same eight built-in controller
// names exposed by `LyraChartType`. Keep the nine mirrored chart tags explicit so a new chart
// family or dependency type never inherits this review accidentally.
const CHART_TYPE_EQUIVALENCE_TAGS = [
  'wa-bar-chart',
  'wa-bubble-chart',
  'wa-chart',
  'wa-doughnut-chart',
  'wa-line-chart',
  'wa-pie-chart',
  'wa-polar-area-chart',
  'wa-radar-chart',
  'wa-scatter-chart',
];

function reviewedTypeEquivalences(upstreamTag) {
  const groups = [
    ...(REVIEWED_TYPE_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []),
    ...(REVIEWED_OPAQUE_TYPE_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []),
  ];
  if (FORM_OWNER_ATTRIBUTE_TYPE_EQUIVALENCE_TAGS.includes(upstreamTag)) {
    groups.push(['attribute', ['form'], 'string', 'HTMLFormElement | null']);
  }
  const nullableStringMembers = NULLABLE_STRING_ATTRIBUTE_TYPE_EQUIVALENCE_MEMBERS.get(upstreamTag);
  if (nullableStringMembers) {
    groups.push(['attribute', nullableStringMembers, 'string | null', 'string']);
  }
  if (CHART_TYPE_EQUIVALENCE_TAGS.includes(upstreamTag)) {
    groups.push(['attribute', ['type'], 'ChartType', 'LyraChartType']);
  }
  return groups.flatMap(
    ([memberKind, members, upstream, target]) =>
      members.map((member) => reviewedTypeEquivalence(memberKind, member, upstream, target)),
  );
}

const REVIEWED_MAPPING_NORMALIZATIONS = new Map([
  [
    'sl-button',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('href', '', 'undefined'),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
        reviewedDefaultEquivalence('variant', 'default', 'neutral'),
      ],
      derivedDefaultEquivalences: [
        {
          memberKind: 'attribute',
          member: 'rel',
          upstream: 'noreferrer noopener',
          target: 'noopener noreferrer',
        },
      ],
    },
  ],
  [
    'sl-checkbox',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'sl-color-picker',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
      unknownMethodReturnTypes: [
        { method: 'blur' },
        { method: 'checkValidity' },
        { method: 'focus' },
        { method: 'getFormattedValue' },
        { method: 'reportValidity' },
        { method: 'setCustomValidity' },
      ],
    },
  ],
  [
    'sl-dropdown',
    {
      inferredAttributeSuppressions: [
        { attribute: 'containing-element', property: 'containingElement' },
      ],
    },
  ],
  [
    'sl-dialog',
    {
      defaultEquivalences: [
        reviewedPropertyDefaultEquivalence('modal', 'new Modal(this)', LYRA_MODAL_CONTROLLER_DEFAULT),
      ],
    },
  ],
  [
    'sl-drawer',
    {
      defaultEquivalences: [
        reviewedPropertyDefaultEquivalence('modal', 'new Modal(this)', LYRA_MODAL_CONTROLLER_DEFAULT),
      ],
    },
  ],
  [
    'sl-input',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  ['sl-radio', { defaultEquivalences: [reviewedDefaultEquivalence('size', 'medium', 'm')] }],
  ['sl-radio-button', { defaultEquivalences: [reviewedDefaultEquivalence('size', 'medium', 'm')] }],
  [
    'sl-radio-group',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  [
    'sl-popup',
    {
      inferredAttributeSuppressions: [
        { attribute: 'auto-size-boundary', property: 'autoSizeBoundary' },
        { attribute: 'flip-boundary', property: 'flipBoundary' },
        { attribute: 'popup', property: 'popup' },
        { attribute: 'shift-boundary', property: 'shiftBoundary' },
      ],
    },
  ],
  [
    'sl-range',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('name', '', null),
      ],
      inferredAttributeSuppressions: [
        { attribute: 'tooltip-formatter', property: 'tooltipFormatter' },
      ],
    },
  ],
  [
    'sl-rating',
    {
      inferredAttributeSuppressions: [{ attribute: 'get-symbol', property: 'getSymbol' }],
    },
  ],
  [
    'sl-select',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
      inferredAttributeSuppressions: [{ attribute: 'get-tag', property: 'getTag' }],
    },
  ],
  [
    'sl-switch',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  ['sl-tag', { defaultEquivalences: [reviewedDefaultEquivalence('size', 'medium', 'm')] }],
  [
    'sl-textarea',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
    },
  ],
  ['wa-button', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-checkbox', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-color-picker', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-input', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-number-input', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-otp-input', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-popover', { defaultEquivalences: [reviewedDefaultEquivalence('for', null, '')] }],
  [
    'wa-popup',
    {
      inferredAttributeSuppressions: [
        { attribute: 'autoSizeBoundary', property: 'autoSizeBoundary', explicit: true },
        { attribute: 'flipBoundary', property: 'flipBoundary', explicit: true },
        { attribute: 'shiftBoundary', property: 'shiftBoundary', explicit: true },
      ],
    },
  ],
  ['wa-radio', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-radio-group', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  [
    'wa-rating',
    {
      defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')],
      inferredAttributeSuppressions: [
        { attribute: 'getSymbol', property: 'getSymbol', explicit: true },
      ],
    },
  ],
  ['wa-switch', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-textarea', { defaultEquivalences: [reviewedDefaultEquivalence('name', null, '')] }],
  ['wa-tooltip', { defaultEquivalences: [reviewedDefaultEquivalence('for', null, '')] }],
]);

export function reviewedMappingNormalizations(upstreamTag) {
  const normalizations = normalizedNormalizations(REVIEWED_MAPPING_NORMALIZATIONS.get(upstreamTag));
  normalizations.typeEquivalences.push(...reviewedTypeEquivalences(upstreamTag));
  return normalizations;
}

function prefixEventRewrites(component, target, upstream) {
  if (!target) return [];
  const prefix = upstream === 'webawesome' ? 'wa-' : 'sl-';
  const targetEvents = new Set(target.surface.events.map((event) => event.name));
  return component.surface.events
    .filter((event) => event.name.startsWith(prefix))
    .map((event) => ({ from: event.name, to: `lr-${event.name.slice(prefix.length)}` }))
    .filter((rewrite) => rewrite.from !== rewrite.to && targetEvents.has(rewrite.to))
    .sort((left, right) => left.from.localeCompare(right.from));
}

function mappingDecisions({ fixture, readme, components, upstreams, existing }) {
  const { map: mirrorMap, conflicts } = buildMirrorMap(readme);
  if (conflicts.length) throw new Error(`README mirror table has conflicts: ${conflicts.join('; ')}`);
  const lyraByTag = new Map(components.map((component) => [component.tag, component]));
  const previous = new Map((existing?.mappings ?? []).map((mapping) => [mapping.upstreamTag, mapping]));
  const entries = [
    ...upstreams.webawesome.components.map((component) => ({ upstream: 'webawesome', component })),
    ...upstreams.shoelace.components.map((component) => ({ upstream: 'shoelace', component })),
  ];

  return entries
    .map(({ upstream, component }) => {
      const upstreamTag = component.tag;
      const targetTag = REQUIRED_TARGETS.get(upstreamTag) || mirrorMap.get(upstreamTag) || null;
      const existingDecision = previous.get(upstreamTag);
      const target = lyraByTag.get(targetTag);
      const rewrites =
        existingDecision?.decisionSource === 'reviewed'
          ? normalizedRewrites(existingDecision.rewrites)
          : normalizedRewrites({
              attributes: attributeRewrites(fixture, upstreamTag),
              events: prefixEventRewrites(component, target, upstream),
              defaults: REVIEWED_DEFAULT_REWRITES.get(upstreamTag) ?? [],
            });
      const reviewedNormalizations = REVIEWED_MAPPING_NORMALIZATIONS.has(upstreamTag)
        ? reviewedMappingNormalizations(upstreamTag)
        : null;
      const normalizations = reviewedNormalizations ?? normalizedNormalizations(existingDecision?.normalizations);
      // Type reviews are authoritative even when a mapping has no other comparison-only
      // normalization. Replacing this section (instead of appending it) keeps regeneration
      // idempotent when the previous inventory already contains the same exact member rules.
      normalizations.typeEquivalences = reviewedTypeEquivalences(upstreamTag);
      const drift =
        component.review.status === 'complete' && target
          ? compareMappedSurfaces(component.surface, target.surface, {
              upstreamPrefix: upstream === 'webawesome' ? 'wa-' : 'sl-',
              rewrites,
              normalizations,
            })
          : [];

      let classification;
      let rationale;
      let decisionSource = 'derived';
      if (DECISION_OVERRIDES.has(upstreamTag)) {
        const override = DECISION_OVERRIDES.get(upstreamTag);
        if (JSON.stringify(drift) !== JSON.stringify(override.expectedDrift)) {
          throw new Error(
            `${upstreamTag}: warning-required override drift changed; expected ${JSON.stringify(override.expectedDrift)} but found ${JSON.stringify(drift)}`,
          );
        }
        ({ classification, rationale } = override);
      } else if (existingDecision?.decisionSource === 'reviewed') {
        classification = existingDecision.classification;
        rationale = existingDecision.rationale;
        decisionSource = 'reviewed';
      } else if (targetTag && !target) {
        classification = 'unsupported';
        rationale = `The required ${targetTag} target is not registered yet; automatic migration remains blocked until its complete public contract ships.`;
      } else if (!target) {
        classification = 'unsupported';
        rationale = 'The pinned upstream tag has no reviewed Lyra target; automatic migration is blocked.';
      } else if (component.review.status !== 'complete') {
        classification = 'unsupported';
        rationale =
          'The pinned public snapshot identifies this tag but does not include a member-level manifest; automatic migration remains blocked until every documented member is fully recorded.';
      } else if (drift.length === 0) {
        const hasRewrite = REWRITE_RULE_SECTIONS.some((section) => rewrites[section]?.length > 0);
        classification = hasRewrite ? 'rewritten' : 'exact';
        rationale = hasRewrite ? 'All reviewed differences are covered by deterministic member rewrites.' : null;
      } else {
        classification = 'unsupported';
        rationale = summarizeDrift(drift);
      }

      return {
        upstream,
        upstreamTag,
        upstreamTier: component.tier,
        targetTag,
        classification,
        rationale,
        decisionSource,
        ...(DECISION_NOTES.has(upstreamTag) ? { notes: DECISION_NOTES.get(upstreamTag) } : {}),
        rewrites,
        normalizations,
        drift,
      };
    })
    .sort((a, b) => a.upstreamTag.localeCompare(b.upstreamTag));
}

function addCounterparts(components, mappings) {
  const byTag = new Map(components.map((component) => [component.tag, component]));
  for (const mapping of mappings) {
    const target = byTag.get(mapping.targetTag);
    if (!target) continue;
    target.counterparts.push({
      upstream: mapping.upstream,
      tag: mapping.upstreamTag,
      tier: mapping.upstreamTier,
      classification: mapping.classification,
    });
  }
  for (const component of components) component.counterparts.sort((a, b) => a.tag.localeCompare(b.tag));
}

export function generateInventory({
  webawesomeManifest,
  shoelaceManifest,
  lyraManifest = path.join(packageDir, 'custom-elements.json'),
  output = defaultOutput,
}) {
  const fixture = readJson(path.join(packageDir, 'scripts', 'fixtures', 'upstream-tags.json'));
  const lyraManifestJson = readJson(lyraManifest);
  const packageJson = readJson(path.join(packageDir, 'package.json'));
  const readme = fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8');
  const existing = fs.existsSync(output) ? readJson(output) : null;
  const components = lyraComponents(lyraManifestJson, existing, packageJson);
  const upstreams = {
    webawesome: {
      package: '@awesome.me/webawesome',
      version: fixture.webawesome.version,
      commit: fixture.webawesome.commit,
      components: upstreamComponents(readJson(webawesomeManifest), 'webawesome', fixture, existing),
    },
    shoelace: {
      package: '@shoelace-style/shoelace',
      version: fixture.shoelace.version,
      commit: fixture.shoelace.commit,
      components: upstreamComponents(readJson(shoelaceManifest), 'shoelace', fixture, existing),
    },
  };
  const mappings = mappingDecisions({ fixture, readme, components, upstreams, existing });
  addCounterparts(components, mappings);

  return {
    $comment:
      'Authoritative component, public-surface, and upstream mapping inventory. Refresh with generate-component-inventory.mjs using the pinned published manifests; do not infer upstream behavior from implementation source.',
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    pins: {
      lyraVersion: packageJson.version,
      webawesome: { version: fixture.webawesome.version, commit: fixture.webawesome.commit },
      shoelace: { version: fixture.shoelace.version, commit: fixture.shoelace.commit },
    },
    components,
    localMigrations: structuredClone(LOCAL_MIGRATION_PROFILES),
    upstreams,
    mappings,
  };
}

function serialize(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const inventory = generateInventory(options);
    const serialized = serialize(inventory);
    if (options.check) {
      const current = fs.existsSync(options.output) ? fs.readFileSync(options.output, 'utf8') : '';
      if (current !== serialized) {
        console.error('component-inventory.json is stale; regenerate it from the pinned published manifests.');
        process.exitCode = 1;
      } else {
        console.log('component-inventory.json generation is deterministic and current.');
      }
    } else if (options.write) {
      fs.writeFileSync(options.output, serialized);
      console.log(
        `component inventory generated: ${inventory.components.length} Lyra, ` +
          `${inventory.upstreams.webawesome.components.length} Web Awesome, ` +
          `${inventory.upstreams.shoelace.components.length} Shoelace tags.`,
      );
    } else {
      process.stdout.write(serialized);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
