import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMirrorMap } from './migrate-wa.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';
import {
  ACCESSIBILITY_PROFILE_SECTIONS,
  INVENTORY_SCHEMA_VERSION,
  LOCAL_MIGRATION_PROFILES,
  REWRITE_RULE_SECTIONS,
  SURFACE_SECTIONS,
  compareMappedSurfaces,
  compareAccessibilityProfiles,
  emptyNormalizations,
  emptyRewrites,
  emptySurface,
  familyFromModule,
  normalizeManifest,
} from './component-inventory.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

/** Restores standard-resolvable inherited public surfaces before inventory normalization. The
 * published CEM is compact, while the inventory intentionally records each tag's effective API. */
export function expandLyraInventoryManifest(manifest) {
  return expandManifestInheritance(manifest);
}

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

export function retainedComponentQualityMetadata(previous) {
  return {
    qualification: structuredClone(previous?.qualification ?? {
      status: 'pending-generation',
      humanReview: 'pending',
      reviewer: null,
      reviewedAt: null,
      accessibility: 'not-recorded',
      ledger: 'scripts/fixtures/component-qualification.json',
    }),
    dependencies: structuredClone(previous?.dependencies ?? {
      direct: [],
      transitive: [],
      ledger: 'scripts/fixtures/component-integration.json',
    }),
  };
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
      ...retainedComponentQualityMetadata(previous),
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
      sourceHashNormalization: 'cloudflare-data-cfemail-v1',
      reviewedAt: '2026-08-02',
      unreviewedSections: [],
    },
  };
}

const UNSPECIFIED_PUBLIC_RETURN = 'unspecified-public-documentation';

function reviewedMethod(name, parameters = [], returnType = UNSPECIFIED_PUBLIC_RETURN) {
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
  ['wa-chart', ['chart', 'bar', '5165e2b004b5b1214a29aea843670e5b963ef5424cb27379c2b58b1611b8ee0e']],
  ['wa-bar-chart', ['bar-chart', 'bar', 'fe2969c238434c32679554cf9e36e66f32d2faf8aa2100b4efa491967e2f7d43']],
  ['wa-bubble-chart', ['bubble-chart', 'bubble', 'c18a710316888476a09008ce4f7ba0fa864f6a7c5d96ab7e972a50e492e46dbd']],
  ['wa-doughnut-chart', ['doughnut-chart', 'doughnut', 'f0537eda572288c36700e54917f6915d3970126bdfb7b9718d93e3a4d3bfec57']],
  ['wa-line-chart', ['line-chart', 'line', 'f318b950f8a0c7cdae1d436bd1d2cd2b02b8b678ef0164f86907309a87da54a2']],
  ['wa-pie-chart', ['pie-chart', 'pie', 'a5ebc5a5fb6cae11d7d602ca37f536db81267a6af54e1bc9d9bfaeaf442238ff']],
  ['wa-polar-area-chart', ['polar-area-chart', 'polarArea', 'b00297da3a51e7b5a5ce922cfe1f5c158a95b34669c3a55a53c8b47665b08ea5']],
  ['wa-radar-chart', ['radar-chart', 'radar', '5d54d45a9263bf16a2fde8a95e41e31c4fcfe428884d271cca537c1bc63bc53c']],
  ['wa-scatter-chart', ['scatter-chart', 'scatter', '1f5a3191e2895f28efc75aa5e441deb7eb1293d7ab48787c807c04ea93414a2a']],
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
    sha256: 'f1ad77432edfdb1f5f45a2caf5a707187478d851295a66a4968c02fe78770516',
  });
}

export function reviewedWebAwesomeCombobox() {
  const properties = [
    reviewedProperty('allowCreate', 'allow-create', 'boolean', false),
    reviewedProperty('allowCustomValue', 'allow-custom-value', 'boolean', false),
    reviewedProperty('appearance', 'appearance', "'filled' | 'outlined' | 'filled-outlined'", 'outlined', true),
    reviewedPropertyWithoutDefault(
      'autocapitalize',
      'autocapitalize',
      "'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'",
    ),
    reviewedPropertyWithoutDefault('autocorrect', 'autocorrect', 'boolean'),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedPropertyWithoutDefault(
      'enterkeyhint',
      'enterkeyhint',
      "'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'",
    ),
    reviewedProperty('filter', null, '((option: WaOption, query: string) => boolean) | null', null),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null'),
    reviewedPropertyWithoutDefault(
      'getTag',
      null,
      '(option: WaOption, index: number) => TemplateResult | string | HTMLElement',
    ),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedPropertyWithoutDefault(
      'inputmode',
      'inputmode',
      "'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'",
    ),
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
    reviewedPropertyWithoutDefault('validationTarget', null, 'undefined | HTMLElement'),
    reviewedProperty('validators', null, 'Validator[]', '[]'),
    reviewedPropertyWithoutDefault('value', 'value', 'string | string[]'),
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
      { name: 'label', deprecated: 'Use the form-control-label part instead.' },
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
      reviewedMethod('formStateRestoreCallback', [
        reviewedParameter('state', 'string | File | FormData | null'),
        reviewedParameter('reason', "'autocomplete' | 'restore'"),
      ]),
      reviewedMethod('hide'),
      reviewedMethod('resetValidity'),
      reviewedMethod('setCustomValidity', [reviewedParameter('message', 'string')]),
      reviewedMethod('show'),
    ],
    form: {
      associated: true,
      properties: ['form', 'name', 'disabled', 'required'],
      methods: ['setCustomValidity'],
    },
    native: { forwardedEvents: nativeEvents, delegatedMethods: ['blur', 'focus'] },
    url: 'https://webawesome.com/docs/components/combobox/',
    sha256: '878fceb16d17a6ced71602f22d51339958c16138a470858f5dccf2d8d6419ec3',
  });
}

export function reviewedWebAwesomeFileInput() {
  const properties = [
    reviewedProperty('accept', 'accept', 'string', ''),
    reviewedPropertyWithoutDefault('capture', 'capture', "'user' | 'environment'"),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedProperty('dragging', null, 'boolean', false),
    reviewedPropertyWithoutDefault('fileCount', null, 'number'),
    reviewedProperty('files', null, 'File[]', '[]'),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null'),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedProperty('multiple', 'multiple', 'boolean', false, true),
    reviewedProperty('name', 'name', 'string | null', null, true),
    reviewedProperty('required', 'required', 'boolean', false, true),
    reviewedProperty('size', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'm', true),
    reviewedPropertyWithoutDefault('validationTarget', null, 'undefined | HTMLElement'),
    reviewedProperty('validators', null, 'Validator[]', '[]'),
    reviewedProperty('withHint', 'with-hint', 'boolean', false),
    reviewedProperty('withLabel', 'with-label', 'boolean', false),
  ];
  const nativeEvents = ['blur', 'change', 'focus', 'input'];
  return reviewedPublicDocumentation({
    tag: 'wa-file-input',
    maturity: { status: 'stable', since: '3.2' },
    properties,
    slots: ['dropzone', 'hint', 'label'],
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
      { name: 'label', deprecated: 'Use the form-control-label part instead.' },
      'remove-button',
    ],
    cssStates: ['blank', 'dragging'],
    methods: [
      reviewedMethod('blur'),
      reviewedMethod('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      reviewedMethod('formStateRestoreCallback', [
        reviewedParameter('state', 'string | File | FormData | null'),
        reviewedParameter('reason', "'autocomplete' | 'restore'"),
      ]),
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
    sha256: 'ce9311420d7f5e29ebfd736d8e99a61aeb412e36765729113fa23b84990a3b05',
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
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null'),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedPropertyWithoutDefault('isDateDisabled', null, '(date: Date) => boolean | undefined'),
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
    sha256: 'f02d777c5ea505c9eeafee76a0418647b83aeff513e2830915547937cda418b9',
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
    reviewedPropertyWithoutDefault('isDateDisabled', null, '(date: Date) => boolean | undefined'),
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
    reviewedPropertyWithoutDefault('valueAsDate', null, 'Date | null', { readonly: true }),
    reviewedPropertyWithoutDefault('valueAsRange', null, 'WaDatePickerRange', { readonly: true }),
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
    sha256: '9dc70a6ef8da5c99193cb82cb30887972f25133691f74963daf90f316678d6ff',
  });
}

const DATA_GRID_OPTION_TYPE = "{ columnIds?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }";
const DATA_GRID_CSV_OPTION_TYPE = '{ fileName?: string; columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }';
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
    reviewedPropertyWithoutDefault('selectedRows', null, 'Row[]'),
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
    sha256: '4712e4032ddfb07bf32bacf18733c478b7b939e0af766609826d04d836d8239e',
  });
}

export function reviewedWebAwesomeVideo() {
  const properties = [
    reviewedProperty('autoplay', 'autoplay', 'boolean', false),
    reviewedProperty('autoplayMuted', 'autoplay-muted', 'boolean', false),
    reviewedProperty('autoplayOnVisible', 'autoplay-on-visible', 'boolean', false),
    reviewedProperty('controls', 'controls', "'none' | 'standard' | 'full'", 'standard', true),
    reviewedProperty('currentTime', 'currentTime', 'number', 0),
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
        { name: 'base', deprecated: 'Use the video-wrapper part instead.' },
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
      ].map((part) =>
        typeof part === 'string' ? { name: part, deprecated: null } : part,
      ),
      cssProperties: [
        '--controls-background',
        '--controls-color',
        '--poster-play-button-background',
      ].map((name) => ({ name, deprecated: null, hasDefault: false })),
      cssStates: [],
      methods: [
        reviewedMethod('exitFullscreen'),
        reviewedMethod('getState'),
        reviewedMethod('getVideoElement'),
        reviewedMethod('pause'),
        reviewedMethod('play'),
        reviewedMethod('requestFullscreen'),
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
      sourceSha256: '3823f6e9dbf7330a333dde9612e987b851f3fa8762b6cd007d93ccd1d71f6362',
      sourceHashNormalization: 'cloudflare-data-cfemail-v1',
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
          deprecated: 'Use the video-playlist part instead.',
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
      sourceSha256: 'bcb3e7ea61f1a5f5e3ced4b3be538e790c3ba8e1b22832576dbc44da0e1ef75a',
      sourceHashNormalization: 'cloudflare-data-cfemail-v1',
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

const CAROUSEL_EVENT_DETAIL_DRIFT = (member) => [{
  code: 'event-type-mismatch',
  section: 'events',
  member,
  expected: '{ index: number, slide: LyraCarouselItem }',
  actual: 'CustomEvent<{ index: number; slide: HTMLElement }>',
}];

const ACCORDION_EVENT_DETAIL_DRIFT = [
  'wa-after-collapse',
  'wa-after-expand',
  'wa-collapse',
  'wa-expand',
].map((member) => ({
  code: 'event-type-mismatch',
  section: 'events',
  member,
  expected: '{ item: LyraAccordionItem }',
  actual: 'CustomEvent<LyraAccordionEventDetail>',
}));

const DECISION_OVERRIDES = new Map([
  [
    'sl-checkbox',
    {
      classification: 'warning-required',
      rationale:
        'Lyra uses the checked attribute as the reset default while Shoelace reflects the live checked state; migration leaves the use unchanged and reports the reflection-sensitive CSS, observer, serialization, and property-write difference.',
      expectedDrift: [],
    },
  ],
  [
    'sl-carousel',
    {
      classification: 'warning-required',
      rationale:
        'Lyra accepts arbitrary HTMLElement slides, so its slide-change detail is wider than the upstream carousel-item class; migrated handlers that rely on item-specific members require review.',
      expectedDrift: CAROUSEL_EVENT_DETAIL_DRIFT('sl-slide-change'),
    },
  ],
  [
    'wa-carousel',
    {
      classification: 'warning-required',
      rationale:
        'Lyra accepts arbitrary HTMLElement slides, so its slide-change detail is wider than the upstream carousel-item class; migrated handlers that rely on item-specific members require review.',
      expectedDrift: CAROUSEL_EVENT_DETAIL_DRIFT('wa-slide-change'),
    },
  ],
  [
    'wa-accordion',
    {
      classification: 'warning-required',
      rationale:
        'Lyra preserves legacy direct <lr-details> panels, so the event detail item is a union rather than only LyraAccordionItem; migrated handlers that rely on item-specific members require review.',
      expectedDrift: ACCORDION_EVENT_DETAIL_DRIFT,
    },
  ],
  [
    'wa-markdown',
    {
      classification: 'warning-required',
      rationale:
        'The source and target light-DOM Markdown content models and optional-peer runtime requirements are not mechanically equivalent; migration leaves the use unchanged and reports the required review.',
      expectedDrift: [],
    },
  ],
  [
    'wa-random-content',
    {
      classification: 'warning-required',
      rationale:
        'Light-DOM candidate eligibility and selection behavior require an explicit compatibility review. Lyra also applies reduced-motion autoplay suppression and renders a visible pause/resume control; migration leaves the use unchanged instead of assuming behavioral equivalence from matching members.',
      expectedDrift: [],
    },
  ],
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
      // 8.0.0: lr-include gained the upstream-compatible `lr-error` alias alongside its canonical
      // `lr-include-error`, so `sl-error` is no longer missing and this drift now matches
      // wa-include's exactly. The remaining entries are the deliberate security divergence.
      expectedDrift: INCLUDE_SECURITY_DRIFT,
    },
  ],
]);

export function reviewedMigrationDecision(upstreamTag) {
  const decision = DECISION_OVERRIDES.get(upstreamTag);
  return decision ? structuredClone(decision) : null;
}

const BEHAVIOR_PARITY_OVERRIDES = new Map([
  [
    'sl-carousel',
    {
      behaviorReviewFlags: ['event-detail-slide-type-widening'],
    },
  ],
  [
    'wa-carousel',
    {
      behaviorReviewFlags: ['event-detail-slide-type-widening'],
    },
  ],
  [
    'wa-accordion',
    {
      behaviorReviewFlags: ['event-detail-item-type-widening', 'legacy-details-panels'],
    },
  ],
  [
    'wa-markdown',
    {
      lightDom: 'warning-required',
      behaviorReviewFlags: ['light-dom-markdown-source', 'optional-peer-runtime'],
    },
  ],
  [
    'wa-random-content',
    {
      lightDom: 'warning-required',
      behaviorReviewFlags: [
        'light-dom-candidate-model',
        'selection-semantics',
        'reduced-motion-autoplay',
        'visible-pause-control',
      ],
    },
  ],
]);

function accessibilityProfile(description, behaviors = {}) {
  return Object.freeze({
    description,
    ...Object.fromEntries(
      ACCESSIBILITY_PROFILE_SECTIONS.map((section) => [section, [...(behaviors[section] ?? [])].sort()]),
    ),
  });
}

const REVIEWED_ACCESSIBILITY_PROFILES = Object.freeze({
  'no-tag-owned-behavior': accessibilityProfile(
    'No tag-owned semantic, naming, keyboard, focus, state, announcement, or motion behavior.',
  ),
  'transparent-content': accessibilityProfile(
    'A transparent wrapper that preserves the semantics and focus behavior of authored descendants.',
    { semantics: ['transparent-content'] },
  ),
  'document-content': accessibilityProfile(
    'Rendered document content preserves authored headings, landmarks, links, and reading order.',
    { semantics: ['document', 'transparent-content'] },
  ),
  'text-content': accessibilityProfile('The rendered value remains ordinary readable text.', {
    semantics: ['text-content'],
  }),
  'animation-content': accessibilityProfile(
    'Animation leaves authored content semantics intact and suppresses nonessential motion when requested.',
    { semantics: ['transparent-content'], motion: ['respects-reduced-motion', 'suppresses-animation'] },
  ),
  alert: accessibilityProfile('An assertive status message is named from its content.', {
    semantics: ['alert'],
    naming: ['content-derived'],
    announcements: ['live-alert'],
  }),
  callout: accessibilityProfile('A callout preserves the semantics and reading order of its authored content.', {
    semantics: ['transparent-content'],
  }),
  'reactive-callout': accessibilityProfile(
    'Callout content remains readable, gains an optional authored group name, and announces only post-mount content changes.',
    {
      semantics: ['group', 'transparent-content'],
      naming: ['content-or-author-label'],
      announcements: ['content-change', 'live-alert', 'live-status'],
    },
  ),
  'animated-image': accessibilityProfile(
    'A named image exposes an operable playback control and reduced-motion behavior.',
    {
      semantics: ['button', 'img'],
      naming: ['alternative-text', 'control-labels-localized'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['paused'],
      motion: ['respects-reduced-motion', 'stops-autoplay', 'user-pause-control'],
    },
  ),
  'named-image': accessibilityProfile('Meaningful image content requires an authored accessible alternative.', {
    semantics: ['img'],
    naming: ['alternative-text', 'author-label-required'],
  }),
  navigation: accessibilityProfile('A named navigation landmark exposes the current destination.', {
    semantics: ['navigation'],
    naming: ['content-or-author-label', 'current-page'],
    states: ['current'],
  }),
  link: accessibilityProfile('A named link uses native keyboard activation and focus behavior.', {
    semantics: ['link'],
    naming: ['content-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled'],
  }),
  button: accessibilityProfile('A named button uses native activation and exposes disabled and pressed state.', {
    semantics: ['button'],
    naming: ['content-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled', 'pressed'],
  }),
  'button-group': accessibilityProfile('Related buttons share an author-provided group name.', {
    semantics: ['group'],
    naming: ['author-label-required'],
  }),
  carousel: accessibilityProfile(
    'A named carousel provides one keyboard navigation stop, slide state, and change announcements.',
    {
      semantics: ['group'],
      naming: ['author-label-required', 'control-labels-localized'],
      keyboard: ['arrow-navigation', 'home-end-navigation'],
      focus: ['focus-preserved', 'roving-focus'],
      states: ['current', 'disabled', 'selected'],
      announcements: ['selection-change'],
      motion: ['respects-reduced-motion', 'stops-autoplay'],
    },
  ),
  'carousel-item': accessibilityProfile('A carousel item exposes its selected position within the authored slide set.', {
    semantics: ['group'],
    naming: ['content-derived'],
    states: ['selected'],
  }),
  checkbox: accessibilityProfile('A labelled checkbox exposes checked, required, invalid, and disabled state.', {
    semantics: ['checkbox'],
    naming: ['visible-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['checked', 'disabled', 'invalid', 'required'],
    announcements: ['validation-message'],
  }),
  'checkbox-group': accessibilityProfile('Independent checkboxes share a labelled and described grouping.', {
    semantics: ['group'],
    naming: ['visible-or-author-label'],
    states: ['disabled', 'invalid', 'required'],
    announcements: ['validation-message'],
  }),
  'color-picker': accessibilityProfile(
    'A labelled color field and palette expose editable value, swatch names, selection, and dismissal behavior.',
    {
      semantics: ['button', 'listbox', 'textbox'],
      naming: ['control-labels-localized', 'value-text', 'visible-or-author-label'],
      keyboard: ['arrow-navigation', 'escape-dismiss', 'native-editing'],
      focus: ['focus-return', 'native-focus', 'roving-focus'],
      states: ['disabled', 'expanded', 'invalid', 'required', 'selected'],
      announcements: ['validation-message'],
    },
  ),
  'copy-button': accessibilityProfile('A named copy action announces success or failure after activation.', {
    semantics: ['button'],
    naming: ['author-label-required', 'control-labels-localized'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled'],
    announcements: ['copy-result'],
  }),
  disclosure: accessibilityProfile('A heading-aligned disclosure button exposes expanded and disabled state.', {
    semantics: ['button'],
    naming: ['content-derived', 'heading-level'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled', 'expanded'],
  }),
  accordion: accessibilityProfile('An accordion coordinates disclosure headings with roving arrow-key navigation.', {
    semantics: ['group'],
    naming: ['heading-level'],
    keyboard: ['arrow-navigation', 'home-end-navigation', 'native-activation'],
    focus: ['roving-focus'],
    states: ['disabled', 'expanded'],
  }),
  modal: accessibilityProfile('A named modal overlay traps initial focus, dismisses with Escape, and returns focus.', {
    semantics: ['dialog'],
    naming: ['visible-or-author-label'],
    keyboard: ['escape-dismiss', 'tab-cycle'],
    focus: ['focus-return', 'focus-trap', 'initial-focus'],
    states: ['modal'],
  }),
  separator: accessibilityProfile('A separator exposes its orientation without adding a keyboard stop.', {
    semantics: ['separator'],
    states: ['orientation'],
  }),
  'menu-button': accessibilityProfile('A named trigger exposes menu expansion and returns focus after dismissal.', {
    semantics: ['button', 'menu'],
    naming: ['content-or-author-label'],
    keyboard: ['arrow-navigation', 'escape-dismiss', 'native-activation'],
    focus: ['focus-return', 'native-focus'],
    states: ['disabled', 'expanded'],
  }),
  icon: accessibilityProfile('Unlabelled icons are presentational; meaningful icons use an authored alternative.', {
    semantics: ['img', 'presentation'],
    naming: ['alternative-text'],
    motion: ['respects-reduced-motion', 'suppresses-animation'],
  }),
  'image-comparison': accessibilityProfile('A named adjustable divider exposes its numeric position.', {
    semantics: ['slider'],
    naming: ['author-label-required', 'value-text'],
    keyboard: ['range-adjustment'],
    focus: ['native-focus'],
    states: ['disabled', 'orientation', 'value-range'],
  }),
  'text-input': accessibilityProfile('A labelled native-like text field exposes editing and form validity.', {
    semantics: ['textbox'],
    naming: ['visible-or-author-label'],
    keyboard: ['native-editing'],
    focus: ['native-focus'],
    states: ['disabled', 'invalid', 'readonly', 'required'],
    announcements: ['validation-message'],
  }),
  textarea: accessibilityProfile('A labelled multiline field exposes native editing, validity, and optional count updates.', {
    semantics: ['textbox'],
    naming: ['visible-or-author-label'],
    keyboard: ['native-editing'],
    focus: ['native-focus'],
    states: ['disabled', 'invalid', 'readonly', 'required'],
    announcements: ['character-count', 'validation-message'],
  }),
  menu: accessibilityProfile('A menu uses one roving tab stop with arrow, Home/End, and typeahead navigation.', {
    semantics: ['menu'],
    keyboard: ['arrow-navigation', 'escape-dismiss', 'home-end-navigation', 'typeahead'],
    focus: ['roving-focus'],
    states: ['orientation'],
  }),
  menuitem: accessibilityProfile('A named menu item exposes disabled, checked, selected, and submenu state.', {
    semantics: ['menuitem'],
    naming: ['content-derived'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['checked', 'disabled', 'expanded', 'selected'],
  }),
  'group-label': accessibilityProfile('Text labels an adjacent authored group without becoming a control.', {
    semantics: ['presentation', 'text-content'],
    naming: ['content-derived'],
  }),
  option: accessibilityProfile('A content-named option exposes disabled and selected state.', {
    semantics: ['option'],
    naming: ['content-derived'],
    states: ['disabled', 'selected'],
  }),
  'positioning-primitive': accessibilityProfile(
    'A positioning primitive deliberately supplies no standalone widget semantics or interaction.',
    { semantics: ['composition-primitive'] },
  ),
  progress: accessibilityProfile('A named progress indicator exposes determinate value or indeterminate busy state.', {
    semantics: ['progressbar'],
    naming: ['author-label-required', 'value-text'],
    states: ['busy', 'value-range'],
    announcements: ['progress-value'],
  }),
  'qr-image': accessibilityProfile('QR output is exposed as a named image rather than raw visual pixels alone.', {
    semantics: ['img'],
    naming: ['alternative-text', 'author-label-required'],
  }),
  radio: accessibilityProfile('A labelled radio exposes checked, disabled, required, and invalid state.', {
    semantics: ['radio'],
    naming: ['visible-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['checked', 'disabled', 'invalid', 'required'],
  }),
  'radio-group': accessibilityProfile('A labelled radio group owns one roving tab stop and arrow-key selection.', {
    semantics: ['radiogroup'],
    naming: ['visible-or-author-label'],
    keyboard: ['arrow-navigation', 'home-end-navigation'],
    focus: ['roving-focus'],
    states: ['disabled', 'invalid', 'orientation', 'required'],
    announcements: ['validation-message'],
  }),
  slider: accessibilityProfile('A labelled slider supports range keys and exposes value, orientation, and disabled state.', {
    semantics: ['slider'],
    naming: ['value-text', 'visible-or-author-label'],
    keyboard: ['range-adjustment'],
    focus: ['native-focus'],
    states: ['disabled', 'orientation', 'value-range'],
  }),
  select: accessibilityProfile('A labelled select coordinates a combobox, listbox, and selected options.', {
    semantics: ['combobox', 'listbox'],
    naming: ['visible-or-author-label'],
    keyboard: ['arrow-navigation', 'escape-dismiss', 'home-end-navigation', 'typeahead'],
    focus: ['focus-return', 'native-focus'],
    states: ['disabled', 'expanded', 'invalid', 'required', 'selected'],
    announcements: ['validation-message'],
  }),
  'decorative-placeholder': accessibilityProfile('A loading placeholder remains presentational and suppresses ambient motion.', {
    semantics: ['presentation'],
    motion: ['respects-reduced-motion', 'suppresses-animation'],
  }),
  'loading-status': accessibilityProfile('A loading placeholder can expose localized busy status and suppress ambient motion.', {
    semantics: ['presentation', 'status'],
    naming: ['control-labels-localized'],
    states: ['busy'],
    announcements: ['live-status'],
    motion: ['respects-reduced-motion', 'suppresses-animation'],
  }),
  'indeterminate-progress': accessibilityProfile(
    'An indeterminate operation is exposed as progress without creating a live status announcement.',
    {
      semantics: ['progressbar'],
      states: ['busy'],
    },
  ),
  'localized-indeterminate-progress': accessibilityProfile(
    'A non-live indeterminate progressbar has a localized or authored name and suppresses ambient motion.',
    {
      semantics: ['progressbar'],
      naming: ['content-or-author-label', 'control-labels-localized'],
      states: ['busy'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    },
  ),
  'split-panel': accessibilityProfile('An adjustable separator supports range keys and exposes value and orientation.', {
    semantics: ['separator'],
    naming: ['author-label-required', 'value-text'],
    keyboard: ['range-adjustment'],
    focus: ['native-focus'],
    states: ['disabled', 'orientation', 'value-range'],
  }),
  switch: accessibilityProfile('A labelled switch supports native activation and exposes checked and disabled state.', {
    semantics: ['switch'],
    naming: ['visible-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['checked', 'disabled', 'invalid', 'required'],
  }),
  tab: accessibilityProfile('A content-named tab exposes selected and disabled state.', {
    semantics: ['tab'],
    naming: ['content-derived'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled', 'selected'],
  }),
  'tab-group': accessibilityProfile('A tablist links tabs to panels with roving navigation and configurable activation.', {
    semantics: ['tablist', 'tabpanel'],
    keyboard: ['arrow-navigation', 'home-end-navigation', 'native-activation'],
    focus: ['focus-follows-selection', 'roving-focus'],
    states: ['orientation', 'selected'],
  }),
  'tab-panel': accessibilityProfile('A tab panel is labelled by its owning tab and exposes hidden versus active state.', {
    semantics: ['tabpanel'],
    naming: ['content-derived'],
    states: ['selected'],
  }),
  tag: accessibilityProfile('A content-named tag exposes a localized optional remove action.', {
    semantics: ['button', 'group'],
    naming: ['content-derived', 'control-labels-localized'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled'],
  }),
  tooltip: accessibilityProfile('Non-interactive descriptive content appears on pointer hover or keyboard focus.', {
    semantics: ['tooltip'],
    naming: ['content-derived'],
    keyboard: ['escape-dismiss'],
    focus: ['focus-return'],
  }),
  tree: accessibilityProfile('A tree uses roving hierarchical navigation and exposes selection and expansion.', {
    semantics: ['tree'],
    keyboard: ['arrow-navigation', 'home-end-navigation', 'typeahead'],
    focus: ['roving-focus'],
    states: ['disabled', 'expanded', 'multiselectable', 'selected'],
  }),
  treeitem: accessibilityProfile('A content-named tree item exposes level, expansion, selection, and disabled state.', {
    semantics: ['treeitem'],
    naming: ['content-derived'],
    states: ['disabled', 'expanded', 'selected'],
  }),
  'visually-hidden': accessibilityProfile('Visually hidden content remains in reading order and reveals focused descendants.', {
    semantics: ['transparent-content'],
    focus: ['focus-visible-on-reveal'],
  }),
  chart: accessibilityProfile('A named chart exposes a textual data representation alongside the visual rendering.', {
    semantics: ['img', 'table'],
    naming: ['author-label-required', 'value-text'],
    keyboard: ['data-point-navigation'],
    focus: ['roving-focus'],
    announcements: ['selection-change'],
    motion: ['respects-reduced-motion', 'suppresses-animation'],
  }),
  combobox: accessibilityProfile('A labelled editable combobox coordinates textbox, listbox, and selected options.', {
    semantics: ['combobox', 'listbox', 'textbox'],
    naming: ['visible-or-author-label'],
    keyboard: ['arrow-navigation', 'escape-dismiss', 'home-end-navigation', 'native-editing', 'typeahead'],
    focus: ['focus-return', 'native-focus'],
    states: ['disabled', 'expanded', 'invalid', 'multiselectable', 'required', 'selected'],
    announcements: ['selection-change', 'validation-message'],
  }),
  'data-grid': accessibilityProfile('A labelled data grid uses roving cell navigation and exposes selection and sorting.', {
    semantics: ['grid'],
    naming: ['author-label-required'],
    keyboard: ['arrow-navigation', 'home-end-navigation', 'page-navigation'],
    focus: ['focus-preserved', 'roving-focus'],
    states: ['disabled', 'multiselectable', 'selected', 'sort'],
    announcements: ['selection-change'],
  }),
  'segmented-field': accessibilityProfile('A labelled segmented field exposes editable date or time groups and validation.', {
    semantics: ['group', 'spinbutton'],
    naming: ['control-labels-localized', 'visible-or-author-label'],
    keyboard: ['arrow-navigation', 'native-editing'],
    focus: ['native-focus'],
    states: ['disabled', 'invalid', 'readonly', 'required', 'value-range'],
    announcements: ['validation-message'],
  }),
  'date-picker': accessibilityProfile('A labelled calendar grid uses roving date navigation and exposes selected/current dates.', {
    semantics: ['grid'],
    naming: ['control-labels-localized', 'visible-or-author-label'],
    keyboard: ['arrow-navigation', 'home-end-navigation', 'page-navigation'],
    focus: ['focus-preserved', 'roving-focus'],
    states: ['current', 'disabled', 'selected'],
    announcements: ['selection-change'],
  }),
  'file-input': accessibilityProfile('A labelled native file control exposes selection, removal, and validation state.', {
    semantics: ['button', 'list'],
    naming: ['control-labels-localized', 'visible-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled', 'invalid', 'required'],
    announcements: ['selection-change', 'validation-message'],
  }),
  'number-input': accessibilityProfile('A labelled spinbutton supports native editing, stepping, and range validity.', {
    semantics: ['spinbutton'],
    naming: ['control-labels-localized', 'visible-or-author-label'],
    keyboard: ['native-editing', 'range-adjustment'],
    focus: ['native-focus'],
    states: ['disabled', 'invalid', 'readonly', 'required', 'value-range'],
    announcements: ['validation-message'],
  }),
  'otp-input': accessibilityProfile('A labelled one-time-code field presents one editing and form target.', {
    semantics: ['textbox'],
    naming: ['author-label-required', 'visible-or-author-label'],
    keyboard: ['native-editing'],
    focus: ['native-focus'],
    states: ['disabled', 'invalid', 'required'],
    announcements: ['validation-message'],
  }),
  'page-landmarks': accessibilityProfile('An application page composes named header, navigation, main, and complementary regions.', {
    semantics: ['article', 'navigation', 'region'],
    naming: ['content-or-author-label'],
    focus: ['focus-preserved'],
  }),
  pagination: accessibilityProfile('A named pagination landmark marks the current page, preserves focus, and announces changes.', {
    semantics: ['navigation'],
    naming: ['author-label-required', 'control-labels-localized', 'current-page'],
    keyboard: ['native-activation'],
    focus: ['focus-preserved', 'native-focus'],
    states: ['current', 'disabled'],
    announcements: ['page-change'],
  }),
  popover: accessibilityProfile('A named non-modal popover dismisses with Escape and returns focus to its trigger.', {
    semantics: ['dialog'],
    naming: ['content-or-author-label'],
    keyboard: ['escape-dismiss'],
    focus: ['focus-return', 'initial-focus'],
    states: ['expanded'],
  }),
  'random-content-upstream': accessibilityProfile(
    'Rotating content pauses around pointer/focus interaction, suppresses motion, and announces every selection.',
    {
      semantics: ['region'],
      naming: ['content-derived'],
      focus: ['focus-preserved'],
      announcements: ['autoplay-content-change', 'content-change'],
      motion: ['respects-reduced-motion', 'suppresses-animation'],
    },
  ),
  'random-content-target': accessibilityProfile(
    'Rotating content preserves focused descendants, announces manual changes, and provides a visible pause control.',
    {
      semantics: ['button', 'region'],
      naming: ['content-derived', 'control-labels-localized'],
      keyboard: ['native-activation'],
      focus: ['focus-preserved', 'native-focus'],
      states: ['paused'],
      announcements: ['content-change'],
      motion: ['respects-reduced-motion', 'stops-autoplay', 'suppresses-animation', 'user-pause-control'],
    },
  ),
  scroller: accessibilityProfile('A labelled overflow region exposes localized keyboard-operable scroll controls.', {
    semantics: ['button', 'region'],
    naming: ['control-labels-localized', 'content-or-author-label'],
    keyboard: ['native-activation'],
    focus: ['native-focus'],
    states: ['disabled'],
  }),
  sparkline: accessibilityProfile('A compact chart exposes a textual value and accessible image name.', {
    semantics: ['img', 'text-content'],
    naming: ['author-label-required', 'value-text'],
  }),
  'toast-region': accessibilityProfile('A toast region queues status or alert items without moving focus.', {
    semantics: ['region', 'status'],
    announcements: ['live-alert', 'live-status'],
  }),
  video: accessibilityProfile('A named video exposes captions and keyboard-operable playback controls.', {
    semantics: ['video'],
    naming: ['author-label-required', 'control-labels-localized'],
    keyboard: ['media-controls', 'native-activation'],
    focus: ['native-focus'],
    states: ['disabled', 'paused'],
    announcements: ['playback-state'],
    motion: ['respects-reduced-motion', 'stops-autoplay'],
  }),
  'video-playlist': accessibilityProfile('A named video playlist exposes the active item and keyboard selection.', {
    semantics: ['listbox', 'option'],
    naming: ['content-or-author-label'],
    keyboard: ['arrow-navigation', 'home-end-navigation', 'native-activation'],
    focus: ['focus-preserved', 'roving-focus'],
    states: ['current', 'disabled', 'selected'],
    announcements: ['selection-change'],
  }),
  frame: accessibilityProfile('An embedded frame requires a title and can deliberately gate keyboard entry.', {
    semantics: ['iframe'],
    naming: ['frame-title'],
    focus: ['frame-focus-gated', 'native-focus'],
  }),
});

export function accessibilityProfileCatalog() {
  return structuredClone(REVIEWED_ACCESSIBILITY_PROFILES);
}

const ACCESSIBILITY_ASSIGNMENTS = new Map();

export function assertAccessibilityProfilesReferenced(profiles, assignments) {
  const referenced = new Set();
  for (const [tag, assignment] of assignments) {
    for (const field of ['upstreamProfile', 'targetProfile']) {
      const profile = assignment?.[field];
      if (typeof profile !== 'string' || !Object.hasOwn(profiles, profile)) {
        throw new Error(`${tag}: accessibility assignment references unknown ${field} ${String(profile)}`);
      }
      referenced.add(profile);
    }
  }

  const unreferenced = Object.keys(profiles)
    .filter((profile) => !referenced.has(profile))
    .sort();
  if (unreferenced.length > 0) {
    const noun = unreferenced.length === 1 ? 'profile' : 'profiles';
    throw new Error(`unreferenced accessibility ${noun} ${unreferenced.join(', ')}`);
  }
}

function assignAccessibility(upstreamProfile, tags, targetProfile = upstreamProfile) {
  for (const tag of tags) {
    if (ACCESSIBILITY_ASSIGNMENTS.has(tag)) throw new Error(`${tag}: duplicate accessibility review assignment`);
    ACCESSIBILITY_ASSIGNMENTS.set(tag, { upstreamProfile, targetProfile });
  }
}

assignAccessibility('alert', ['sl-alert', 'wa-toast-item']);
assignAccessibility('callout', ['wa-callout'], 'reactive-callout');
assignAccessibility('animated-image', ['sl-animated-image', 'wa-animated-image']);
assignAccessibility('animation-content', ['sl-animation', 'wa-animation']);
assignAccessibility('named-image', ['sl-avatar', 'wa-avatar']);
assignAccessibility('text-content', [
  'sl-badge',
  'sl-format-bytes',
  'sl-format-date',
  'sl-format-number',
  'sl-relative-time',
  'wa-badge',
  'wa-format-bytes',
  'wa-format-date',
  'wa-format-number',
  'wa-relative-time',
]);
assignAccessibility('navigation', ['sl-breadcrumb', 'wa-breadcrumb']);
assignAccessibility('link', ['sl-breadcrumb-item', 'wa-breadcrumb-item']);
assignAccessibility('button', ['sl-button', 'sl-icon-button', 'wa-button']);
assignAccessibility('button-group', ['sl-button-group', 'wa-button-group']);
assignAccessibility('no-tag-owned-behavior', ['sl-card', 'wa-card']);
assignAccessibility('carousel', ['sl-carousel', 'wa-carousel']);
assignAccessibility('carousel-item', ['sl-carousel-item', 'wa-carousel-item']);
assignAccessibility('checkbox', ['sl-checkbox', 'wa-checkbox']);
assignAccessibility('checkbox-group', ['wa-checkbox-group']);
assignAccessibility('color-picker', ['sl-color-picker', 'wa-color-picker']);
assignAccessibility('copy-button', ['sl-copy-button', 'wa-copy-button']);
assignAccessibility('disclosure', ['sl-details', 'wa-accordion-item', 'wa-details']);
assignAccessibility('accordion', ['wa-accordion']);
assignAccessibility('modal', ['sl-dialog', 'sl-drawer', 'wa-dialog', 'wa-drawer']);
assignAccessibility('separator', ['sl-divider', 'wa-divider']);
assignAccessibility('menu-button', ['sl-dropdown', 'wa-dropdown']);
assignAccessibility('icon', ['sl-icon', 'wa-icon']);
assignAccessibility('image-comparison', ['sl-image-comparer', 'wa-comparison']);
assignAccessibility('document-content', ['sl-include', 'wa-include', 'wa-markdown']);
assignAccessibility('text-input', ['sl-input', 'wa-input']);
assignAccessibility('textarea', ['sl-textarea', 'wa-textarea']);
assignAccessibility('menu', ['sl-menu']);
assignAccessibility('menuitem', ['sl-menu-item', 'wa-dropdown-item']);
assignAccessibility('group-label', ['sl-menu-label']);
assignAccessibility('transparent-content', [
  'sl-mutation-observer',
  'sl-resize-observer',
  'wa-intersection-observer',
  'wa-mutation-observer',
  'wa-resize-observer',
]);
assignAccessibility('option', ['sl-option', 'wa-option']);
assignAccessibility('positioning-primitive', ['sl-popup', 'wa-popup']);
assignAccessibility('progress', ['sl-progress-bar', 'sl-progress-ring', 'wa-progress-bar', 'wa-progress-ring']);
assignAccessibility('qr-image', ['sl-qr-code', 'wa-qr-code']);
assignAccessibility('radio', ['sl-radio', 'sl-radio-button', 'wa-radio']);
assignAccessibility('radio-group', ['sl-radio-group', 'wa-radio-group']);
assignAccessibility('slider', ['sl-range', 'sl-rating', 'wa-rating', 'wa-slider']);
assignAccessibility('select', ['sl-select', 'wa-select']);
assignAccessibility('decorative-placeholder', ['sl-skeleton', 'wa-skeleton'], 'loading-status');
assignAccessibility(
  'indeterminate-progress',
  ['sl-spinner', 'wa-spinner'],
  'localized-indeterminate-progress',
);
assignAccessibility('split-panel', ['sl-split-panel', 'wa-split-panel']);
assignAccessibility('switch', ['sl-switch', 'wa-switch']);
assignAccessibility('tab', ['sl-tab', 'wa-tab']);
assignAccessibility('tab-group', ['sl-tab-group', 'wa-tab-group']);
assignAccessibility('tab-panel', ['sl-tab-panel', 'wa-tab-panel']);
assignAccessibility('tag', ['sl-tag', 'wa-tag']);
assignAccessibility('tooltip', ['sl-tooltip', 'wa-tooltip']);
assignAccessibility('tree', ['sl-tree', 'wa-tree']);
assignAccessibility('treeitem', ['sl-tree-item', 'wa-tree-item']);
assignAccessibility('visually-hidden', ['sl-visually-hidden']);
assignAccessibility('chart', [
  'wa-bar-chart',
  'wa-bubble-chart',
  'wa-chart',
  'wa-doughnut-chart',
  'wa-line-chart',
  'wa-pie-chart',
  'wa-polar-area-chart',
  'wa-radar-chart',
  'wa-scatter-chart',
]);
assignAccessibility('combobox', ['wa-combobox']);
assignAccessibility('data-grid', ['wa-data-grid']);
assignAccessibility('segmented-field', ['wa-date-input', 'wa-known-date', 'wa-time-input']);
assignAccessibility('date-picker', ['wa-date-picker']);
assignAccessibility('file-input', ['wa-file-input']);
assignAccessibility('number-input', ['wa-number-input']);
assignAccessibility('otp-input', ['wa-otp-input']);
assignAccessibility('page-landmarks', ['wa-page']);
assignAccessibility('pagination', ['wa-pagination']);
assignAccessibility('popover', ['wa-popover']);
assignAccessibility('random-content-upstream', ['wa-random-content'], 'random-content-target');
assignAccessibility('scroller', ['wa-scroller']);
assignAccessibility('sparkline', ['wa-sparkline']);
assignAccessibility('toast-region', ['wa-toast']);
assignAccessibility('video', ['wa-video']);
assignAccessibility('video-playlist', ['wa-video-playlist']);
assignAccessibility('frame', ['wa-zoomable-frame']);

assertAccessibilityProfilesReferenced(REVIEWED_ACCESSIBILITY_PROFILES, ACCESSIBILITY_ASSIGNMENTS);

export function reviewedAccessibilityMetadata(upstreamTag, targetTag) {
  const assignment = ACCESSIBILITY_ASSIGNMENTS.get(upstreamTag);
  if (!assignment) throw new Error(`${upstreamTag}: missing reviewed accessibility profile assignment`);
  const profiles = REVIEWED_ACCESSIBILITY_PROFILES;
  const comparison = compareAccessibilityProfiles(
    profiles,
    assignment.upstreamProfile,
    assignment.targetProfile,
  );
  const sourceDescription = profiles[assignment.upstreamProfile].description;
  let rationale;
  if (comparison.status === 'not-applicable') {
    rationale = `${upstreamTag} and ${targetTag} assign no tag-owned accessibility behavior; authored descendants keep their own semantics.`;
  } else if (comparison.status === 'equivalent') {
    rationale = `${upstreamTag} and ${targetTag} share the reviewed behavior profile: ${sourceDescription}`;
  } else if (comparison.status === 'target-additive') {
    rationale = `${targetTag} retains the reviewed ${upstreamTag} behavior and adds ${comparison.additions.join(', ')}.`;
  } else {
    rationale = `${targetTag} does not claim ${comparison.missing.join(', ')} from ${upstreamTag}; the mapping requires manual accessibility review.`;
  }
  return {
    reviewStatus: 'complete',
    upstreamProfile: assignment.upstreamProfile,
    targetProfile: assignment.targetProfile,
    evidence: {
      upstream: 'pinned-public-contract',
      target: 'lyra-authored-contract-and-automated-tests',
    },
    comparison,
    rationale,
  };
}

export function migrationParityMetadata({ upstream, target, classification }) {
  const behaviorOverride = BEHAVIOR_PARITY_OVERRIDES.get(upstream.tag);
  const hasLightDomSurface = (upstream.surface.slots?.length ?? 0) > 0;
  return {
    staticApi: upstream.review?.status === 'complete' ? 'reviewed' : upstream.review?.status === 'tag-only' ? 'tag-only' : 'unreviewed',
    lightDom: behaviorOverride?.lightDom ?? (hasLightDomSurface ? 'surface-only' : 'not-applicable'),
    runtime: {
      registration: !target ? 'unavailable' : target.rootIncluded === false ? 'granular' : 'all',
      optionalPeers: [...(target?.optionalPeers ?? [])].sort(),
    },
    accessibility: reviewedAccessibilityMetadata(upstream.tag, target?.tag ?? 'no Lyra target'),
    behaviorReviewFlags:
      behaviorOverride?.behaviorReviewFlags ??
      (classification === 'exact' || classification === 'rewritten' ? [] : [`${classification}-mapping`]),
  };
}

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

// Widening an event's cancelability is a superset of the contract it replaces: `preventDefault()`
// on an event that was never cancelable is a silent no-op, and no shipped consumer writes code that
// depends on that no-op happening. A migrated listener that vetoes therefore cannot start behaving
// worse, only start working. Narrowing is the opposite and stays a blocking mismatch, so each rule
// below pins both observed labels per tag and per event rather than blanket-suppressing the code.
const reviewedCancelabilityEquivalence = (event, upstream, target) => ({ event, upstream, target });

// The one reviewable narrowing: Lyra keeps the event cancelable on every path the upstream tag
// documents and adds a path of its own that announces itself non-cancelable, which drops the
// summary label from `always` to `conditional` without taking any documented veto away. `addedPath`
// records which Lyra-only path that is, so the claim survives in the generated inventory instead of
// living only in a reviewer's head.
const reviewedCancelabilityPathAddition = (event, addedPath) => ({
  event,
  upstream: 'always',
  target: 'conditional',
  addedPath,
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
        ['formenctype'],
        "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'",
        'ButtonFormEnctype | undefined',
      ],
      ['attribute', ['formmethod'], "'post' | 'get'", 'ButtonFormMethod | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
    ],
  ],
  ['wa-markdown', [['property', ['marked'], 'Marked', 'LyraMarkedParser | undefined']]],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
    ],
  ],
  [
    'wa-polar-area-chart',
    [
      ['attribute', ['grid'], "'x' | 'y' | 'both' | 'none'", 'LyraChartGrid'],
      ['attribute', ['index-axis'], "'x' | 'y'", 'LyraChartIndexAxis'],
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['config'], "ChartJS['config']", 'LyraChartConfiguration | undefined'],
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
      ['property', ['filter'], '((option: WaOption, query: string) => boolean) | null', 'OptionFilter | null'],
      [
        'property',
        ['getTag'],
        '(option: WaOption, index: number) => TemplateResult | string | HTMLElement',
        'LyraComboboxTagRenderer | undefined',
      ],
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
        '| ((request: DataGridRequest) => Promise<DataGridResponse<Row>>) | null',
      ],
      ['property', ['expandedKeys', 'selectedKeys'], '(string | number)[]', 'DataGridKey[]'],
      ['property', ['filters'], '{ id: string; value: unknown }[]', 'DataGridFilter[]'],
      [
        'property',
        ['searchFn'],
        '((value: unknown, searchTerm: string, row: Row) => boolean) | null',
        '| ((value: unknown, term: string, row: Row) => boolean) | null',
      ],
    ],
  ],
  [
    'wa-date-input',
    [
      ['attribute', ['appearance'], "'filled' | 'outlined' | 'filled-outlined'", 'LyraDateInputAppearance'],
      ['attribute', ['mode'], 'WaDateInputMode', "'single' | 'range'"],
      ['property', ['dayContent'], 'WaDateInputDayContent | undefined', 'LyraDatePickerDayContent | undefined'],
      ['property', ['validators'], 'Validator[]', 'LyraDateInputValidator[]'],
      ['property', ['valueAsRange'], '{ from: Date | null; to: Date | null }', 'DateRange'],
    ],
  ],
  [
    'wa-date-picker',
    [
      ['attribute', ['mode'], 'WaDatePickerMode', 'CalendarMode'],
      ['attribute', ['weekday-format'], 'WaDatePickerWeekdayFormat', 'WeekdayFormat'],
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

// EventMap projection intentionally publishes Lyra's concrete runtime event classes and detail
// aliases. Some pinned upstream manifests expose only a detail object, an unparameterized
// `Event`/`CustomEvent`, or a narrower public alias. These exact per-tag/member pairs are the
// review boundary: event types are otherwise compared literally after prefix normalization, so a
// changed alias, newly broad `unknown`, or unrelated event cannot inherit an exception.
const REVIEWED_EVENT_TYPE_EQUIVALENCE_GROUPS = new Map([
  [
    'sl-dialog',
    [[
      'event',
      ['sl-request-close'],
      "{ source: 'close-button' | 'keyboard' | 'overlay' }",
      'CustomEvent<LyraDialogRequestCloseDetail>',
    ]],
  ],
  [
    'sl-drawer',
    [[
      'event',
      ['sl-request-close'],
      "{ source: 'close-button' | 'keyboard' | 'overlay' }",
      'CustomEvent<LyraDialogRequestCloseDetail>',
    ]],
  ],
  [
    'sl-include',
    [['event', ['sl-error'], '{ status: number }', 'CustomEvent<LyraIncludeErrorDetail>']],
  ],
  [
    'sl-menu',
    [['event', ['sl-select'], '{ item: SlMenuItem }', 'CustomEvent<MenuItemSelectDetail>']],
  ],
  [
    'sl-mutation-observer',
    [[
      'event',
      ['sl-mutation'],
      '{ mutationList: MutationRecord[] }',
      'CustomEvent<{ records: MutationRecord[]; mutationList: MutationRecord[] }>',
    ]],
  ],
  [
    'sl-rating',
    [[
      'event',
      ['sl-hover'],
      "{ phase: 'start' | 'move' | 'end', value: number }",
      'CustomEvent<{ phase: LyraRatingHoverPhase; value: number }>',
    ]],
  ],
  [
    'sl-tab-group',
    [[
      'event',
      ['sl-tab-hide', 'sl-tab-show'],
      '{ name: String }',
      'CustomEvent<{ tabId: string; name: string }>',
    ]],
  ],
  [
    'wa-color-picker',
    [[
      'event',
      ['wa-after-hide', 'wa-after-show', 'wa-hide', 'wa-show'],
      'CustomEvent',
      'CustomEvent<undefined>',
    ]],
  ],
  [
    'wa-combobox',
    [[
      'event',
      ['wa-after-hide', 'wa-after-show', 'wa-clear', 'wa-hide', 'wa-invalid', 'wa-show'],
      'Event',
      'CustomEvent<undefined>',
    ]],
  ],
  [
    'wa-data-grid',
    [
      ['event', ['request', 'wa-data-request'], 'Event', 'CustomEvent<DataGridRequest>'],
      ['event', ['wa-cell-click'], 'Event', 'CustomEvent<DataGridCellDetail<Row>>'],
      [
        'event',
        ['wa-cell-contextmenu'],
        'CustomEvent',
        'CustomEvent<DataGridCellContextMenuDetail<Row>>',
      ],
      ['event', ['wa-column-move'], 'Event', 'CustomEvent<DataGridColumnMoveDetail>'],
      ['event', ['wa-column-pin'], 'Event', 'CustomEvent<DataGridColumnPinDetail>'],
      ['event', ['wa-column-resize'], 'Event', 'CustomEvent<DataGridColumnResizeDetail>'],
      [
        'event',
        ['wa-column-visibility-change'],
        'Event',
        'CustomEvent<DataGridColumnVisibilityDetail>',
      ],
      ['event', ['wa-data-error'], 'Event', 'CustomEvent<DataGridDataErrorDetail>'],
      ['event', ['wa-filter-change'], 'Event', 'CustomEvent<{ filters: DataGridFilter[] }>'],
      ['event', ['wa-page-change'], 'Event', 'CustomEvent<DataGridPageDetail>'],
      [
        'event',
        ['wa-row-collapse', 'wa-row-expand'],
        'Event',
        'CustomEvent<DataGridRowDetail<Row>>',
      ],
      ['event', ['wa-row-select'], 'Event', 'CustomEvent<DataGridSelectionDetail<Row>>'],
      ['event', ['wa-sort-change'], 'Event', 'CustomEvent<{ sort: DataGridSortingState }>'],
    ],
  ],
  [
    'wa-date-input',
    [[
      'event',
      ['wa-after-hide', 'wa-after-show', 'wa-clear', 'wa-invalid'],
      'Event',
      'CustomEvent<undefined>',
    ]],
  ],
  [
    'wa-dialog',
    [['event', ['wa-hide'], '{ source: Element }', 'CustomEvent<LyraDialogHideDetail>']],
  ],
  [
    'wa-drawer',
    [['event', ['wa-hide'], '{ source: Element }', 'CustomEvent<LyraDialogHideDetail>']],
  ],
  [
    'wa-file-input',
    [['event', ['wa-invalid'], 'Event', 'CustomEvent<undefined>']],
  ],
  [
    'wa-include',
    [[
      'event',
      ['wa-include-error'],
      '{ status: number }',
      'CustomEvent<LyraIncludeErrorDetail>',
    ]],
  ],
  [
    'wa-known-date',
    [
      ['event', ['change'], 'Event', 'Event & { readonly detail: LyraKnownDateEventDetail }'],
      [
        'event',
        ['input'],
        'InputEvent',
        'InputEvent & { readonly detail: LyraKnownDateEventDetail }',
      ],
    ],
  ],
  [
    'wa-mutation-observer',
    [[
      'event',
      ['wa-mutation'],
      '{ mutationList: MutationRecord[] }',
      'CustomEvent<{ records: MutationRecord[]; mutationList: MutationRecord[] }>',
    ]],
  ],
  [
    'wa-random-content',
    [[
      'event',
      ['wa-content-change'],
      '{ items: Element[] }',
      'CustomEvent<{ items: HTMLElement[] }>',
    ]],
  ],
  [
    'wa-rating',
    [[
      'event',
      ['wa-hover'],
      "{ phase: 'start' | 'move' | 'end', value: number }",
      'CustomEvent<{ phase: LyraRatingHoverPhase; value: number }>',
    ]],
  ],
  [
    'wa-tab-group',
    [[
      'event',
      ['wa-tab-hide', 'wa-tab-show'],
      '{ name: String }',
      'CustomEvent<{ tabId: string; name: string }>',
    ]],
  ],
  [
    'wa-video-playlist',
    [[
      'event',
      ['wa-video-change'],
      'CustomEvent<{ previousIndex: number; currentIndex: number; video: { title: string; poster: string; sources: unknown[]; tracks: unknown[] } }>',
      'CustomEvent<LyraVideoPlaylistChangeDetail>',
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
    ...(REVIEWED_EVENT_TYPE_EQUIVALENCE_GROUPS.get(upstreamTag) ?? []),
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
        { attribute: 'autoSizeBoundary', property: 'autoSizeBoundary', explicit: true },
        { attribute: 'flipBoundary', property: 'flipBoundary', explicit: true },
        { attribute: 'shiftBoundary', property: 'shiftBoundary', explicit: true },
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
    },
  ],
  [
    'sl-rating',
    {
      inferredAttributeSuppressions: [{ attribute: 'getSymbol', property: 'getSymbol', explicit: true }],
    },
  ],
  [
    'sl-select',
    {
      defaultEquivalences: [
        reviewedDefaultEquivalence('form', '', null),
        reviewedDefaultEquivalence('size', 'medium', 'm'),
      ],
      inferredAttributeSuppressions: [{ attribute: 'getTag', property: 'getTag', explicit: true }],
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
  [
    'wa-combobox',
    {
      // `wa-invalid` is `preventDefault()`-able on `<lr-combobox>` because vetoing it also cancels
      // the native `invalid` event behind it, which is what suppresses the browser's own validation
      // bubble. `lr-show` is cancelable on every path. `lr-hide` is cancelable while connected, but
      // the disconnection cleanup path is not because the already-removed popup cannot stay open.
      cancelabilityEquivalences: [
        reviewedCancelabilityEquivalence('wa-hide', 'never', 'conditional'),
        reviewedCancelabilityEquivalence('wa-invalid', 'never', 'always'),
        reviewedCancelabilityEquivalence('wa-show', 'never', 'always'),
      ],
    },
  ],
  [
    'wa-date-input',
    {
      cancelabilityEquivalences: [reviewedCancelabilityEquivalence('wa-invalid', 'never', 'always')],
    },
  ],
  [
    'wa-dialog',
    {
      cancelabilityPathAdditions: [
        reviewedCancelabilityPathAddition(
          'wa-hide',
          'an open dialog removed from the document, where the close has already happened and no ' +
            'veto could undo it; every dismissal path the upstream tag documents stays cancelable',
        ),
      ],
    },
  ],
  [
    'wa-file-input',
    {
      cancelabilityEquivalences: [reviewedCancelabilityEquivalence('wa-invalid', 'never', 'always')],
    },
  ],
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
        parity: migrationParityMetadata({ upstream: component, target, classification }),
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
  const lyraManifestJson = expandLyraInventoryManifest(readJson(lyraManifest));
  const packageJson = readJson(path.join(packageDir, 'package.json'));
  const readme = fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8');
  const existing = fs.existsSync(output) ? readJson(output) : null;
  const components = lyraComponents(lyraManifestJson, existing, packageJson);
  const upstreams = {
    webawesome: {
      packages: [
        { name: '@awesome.me/webawesome', tiers: ['free'] },
        { name: '@awesome.me/webawesome-pro', tiers: ['free', 'pro'] },
      ],
      version: fixture.webawesome.version,
      commit: fixture.webawesome.commit,
      components: upstreamComponents(readJson(webawesomeManifest), 'webawesome', fixture, existing),
    },
    shoelace: {
      packages: [{ name: '@shoelace-style/shoelace', tiers: ['free'] }],
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
    accessibilityProfiles: accessibilityProfileCatalog(),
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
