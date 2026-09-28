import { SURFACE_SECTIONS, applyRuntimeEventCancelabilityEvidence, applyRuntimeMethodEdgeSemanticsEvidence, emptySurface, normalizeManifest } from '../component-inventory.mjs';

function reviewedProperty(
  name,
  attribute,
  type,
  defaultValue,
  reflects = false
) {
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

function reviewedPropertyWithoutDefault(
  name,
  attribute,
  type,
  { readonly = false, reflects = false } = {}
) {
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
    typeof part === 'string' ? { name: part, deprecated: null } : part
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
  { bubbles = true, composed = true, cancelable = 'never' } = {}
) {
  const runtimeConstructor = /^CustomEvent</u.test(constructor)
    ? 'CustomEvent'
    : constructor;
  return {
    name,
    type: constructor,
    constructor: runtimeConstructor,
    bubbles,
    composed,
    cancelable,
  };
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
      staticProperties: [],
      staticMethods: [],
      moduleExports: [],
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

function reviewedMethod(
  name,
  parameters = [],
  returnType = UNSPECIFIED_PUBLIC_RETURN
) {
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

export const CHART_REVIEW_EVIDENCE = new Map([
  [
    'wa-chart',
    [
      'chart',
      'bar',
      '5165e2b004b5b1214a29aea843670e5b963ef5424cb27379c2b58b1611b8ee0e',
    ],
  ],
  [
    'wa-bar-chart',
    [
      'bar-chart',
      'bar',
      'fe2969c238434c32679554cf9e36e66f32d2faf8aa2100b4efa491967e2f7d43',
    ],
  ],
  [
    'wa-bubble-chart',
    [
      'bubble-chart',
      'bubble',
      'c18a710316888476a09008ce4f7ba0fa864f6a7c5d96ab7e972a50e492e46dbd',
    ],
  ],
  [
    'wa-doughnut-chart',
    [
      'doughnut-chart',
      'doughnut',
      'f0537eda572288c36700e54917f6915d3970126bdfb7b9718d93e3a4d3bfec57',
    ],
  ],
  [
    'wa-line-chart',
    [
      'line-chart',
      'line',
      'f318b950f8a0c7cdae1d436bd1d2cd2b02b8b678ef0164f86907309a87da54a2',
    ],
  ],
  [
    'wa-pie-chart',
    [
      'pie-chart',
      'pie',
      'a5ebc5a5fb6cae11d7d602ca37f536db81267a6af54e1bc9d9bfaeaf442238ff',
    ],
  ],
  [
    'wa-polar-area-chart',
    [
      'polar-area-chart',
      'polarArea',
      'b00297da3a51e7b5a5ce922cfe1f5c158a95b34669c3a55a53c8b47665b08ea5',
    ],
  ],
  [
    'wa-radar-chart',
    [
      'radar-chart',
      'radar',
      '5d54d45a9263bf16a2fde8a95e41e31c4fcfe428884d271cca537c1bc63bc53c',
    ],
  ],
  [
    'wa-scatter-chart',
    [
      'scatter-chart',
      'scatter',
      '1f5a3191e2895f28efc75aa5e441deb7eb1293d7ab48787c807c04ea93414a2a',
    ],
  ],
]);

export function reviewedWebAwesomeChart(tag) {
  const evidence = CHART_REVIEW_EVIDENCE.get(tag);
  if (!evidence)
    throw new Error(`Unknown reviewed Web Awesome chart tag: ${tag}`);
  const [slug, typeDefault, sha256] = evidence;
  const properties = [
    reviewedPropertyWithoutDefault('chart', null, 'ChartJS | undefined'),
    reviewedPropertyWithoutDefault('config', null, "ChartJS['config']"),
    reviewedProperty('description', 'description', 'string | null', null),
    reviewedProperty('grid', 'grid', "'x' | 'y' | 'both' | 'none'", 'both'),
    reviewedProperty('indexAxis', 'index-axis', "'x' | 'y'", 'x'),
    reviewedProperty('label', 'label', 'string | null', null),
    reviewedProperty(
      'legendPosition',
      'legend-position',
      "LayoutPosition | 'start' | 'end'",
      'top'
    ),
    reviewedProperty('max', 'max', 'number | null', null),
    reviewedProperty('min', 'min', 'number | null', null),
    reviewedProperty('plugins', 'plugins', 'array', '[]'),
    reviewedProperty('stacked', 'stacked', 'boolean', false),
    reviewedProperty('type', 'type', 'ChartType', typeDefault),
    reviewedProperty(
      'withoutAnimation',
      'without-animation',
      'boolean',
      false,
      true
    ),
    reviewedProperty('withoutLegend', 'without-legend', 'boolean', false, true),
    reviewedProperty(
      'withoutTooltip',
      'without-tooltip',
      'boolean',
      false,
      true
    ),
    reviewedProperty('xLabel', 'x-label', 'string | null', null),
    reviewedProperty('yLabel', 'y-label', 'string | null', null),
  ];
  return reviewedPublicDocumentation({
    tag,
    maturity: { status: 'stable', since: '3.3' },
    properties,
    methods: [reviewedMethod('renderChart')],
    slots: [''],
    cssProperties: CHART_CSS_PROPERTIES,
    url: `https://webawesome.com/docs/components/${slug}/`,
    sha256,
  });
}

export function reviewedWebAwesomeSparkline() {
  const properties = [
    reviewedProperty(
      'appearance',
      'appearance',
      "'gradient' | 'line' | 'solid'",
      'solid',
      true
    ),
    reviewedProperty(
      'curve',
      'curve',
      "'linear' | 'natural' | 'step'",
      'linear',
      true
    ),
    reviewedProperty('data', 'data', 'string', ''),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedPropertyWithoutDefault(
      'trend',
      'trend',
      "'positive' | 'negative' | 'neutral'",
      { reflects: true }
    ),
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
    reviewedProperty(
      'allowCustomValue',
      'allow-custom-value',
      'boolean',
      false
    ),
    reviewedProperty(
      'appearance',
      'appearance',
      "'filled' | 'outlined' | 'filled-outlined'",
      'outlined',
      true
    ),
    reviewedPropertyWithoutDefault(
      'autocapitalize',
      'autocapitalize',
      "'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'"
    ),
    reviewedPropertyWithoutDefault('autocorrect', 'autocorrect', 'boolean'),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedPropertyWithoutDefault(
      'enterkeyhint',
      'enterkeyhint',
      "'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'"
    ),
    reviewedProperty(
      'filter',
      null,
      '((option: WaOption, query: string) => boolean) | null',
      null
    ),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null'),
    reviewedPropertyWithoutDefault(
      'getTag',
      null,
      '(option: WaOption, index: number) => TemplateResult | string | HTMLElement'
    ),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedPropertyWithoutDefault(
      'inputmode',
      'inputmode',
      "'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'"
    ),
    reviewedProperty('inputValue', null, 'string', ''),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedProperty('maxOptionsVisible', 'max-options-visible', 'number', 3),
    reviewedProperty('multiple', 'multiple', 'boolean', false, true),
    reviewedProperty('name', 'name', 'string | null', '', true),
    reviewedProperty('open', 'open', 'boolean', false, true),
    reviewedProperty('pill', 'pill', 'boolean', false, true),
    reviewedProperty('placeholder', 'placeholder', 'string', ''),
    reviewedProperty(
      'placement',
      'placement',
      "'top' | 'bottom'",
      'bottom',
      true
    ),
    reviewedProperty('required', 'required', 'boolean', false, true),
    reviewedProperty(
      'size',
      'size',
      "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
      'm',
      true
    ),
    reviewedProperty('spellcheck', 'spellcheck', 'boolean', false),
    reviewedPropertyWithoutDefault(
      'validationTarget',
      null,
      'undefined | HTMLElement'
    ),
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
      reviewedNativeEvent(
        'change',
        'CustomEvent<{ value: string | string[] }>'
      ),
      reviewedNativeEvent('focus', 'FocusEvent'),
      reviewedNativeEvent(
        'input',
        'InputEvent | CustomEvent<{ value: string | string[] }>'
      ),
      reviewedEvent('wa-after-hide'),
      reviewedEvent('wa-after-show'),
      reviewedEvent('wa-clear'),
      reviewedEvent(
        'wa-create',
        'CustomEvent<{ inputValue: string }>',
        'always'
      ),
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
      reviewedMethod('focus', [
        reviewedOptionalParameter('options', 'FocusOptions'),
      ]),
      reviewedMethod('formStateRestoreCallback', [
        reviewedParameter('state', 'string | File | FormData | null'),
        reviewedParameter('reason', "'autocomplete' | 'restore'"),
      ]),
      reviewedMethod('hide'),
      reviewedMethod('resetValidity'),
      reviewedMethod('setCustomValidity', [
        reviewedParameter('message', 'string'),
      ]),
      reviewedMethod('show'),
    ],
    form: {
      associated: true,
      properties: ['form', 'name', 'disabled', 'required'],
      methods: ['setCustomValidity'],
    },
    native: {
      forwardedEvents: nativeEvents,
      delegatedMethods: ['blur', 'focus'],
    },
    url: 'https://webawesome.com/docs/components/combobox/',
    sha256: '878fceb16d17a6ced71602f22d51339958c16138a470858f5dccf2d8d6419ec3',
  });
}

export function reviewedWebAwesomeFileInput() {
  const properties = [
    reviewedProperty('accept', 'accept', 'string', ''),
    reviewedPropertyWithoutDefault(
      'capture',
      'capture',
      "'user' | 'environment'"
    ),
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
    reviewedProperty(
      'size',
      'size',
      "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
      'm',
      true
    ),
    reviewedPropertyWithoutDefault(
      'validationTarget',
      null,
      'undefined | HTMLElement'
    ),
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
      reviewedMethod('focus', [
        reviewedOptionalParameter('options', 'FocusOptions'),
      ]),
      reviewedMethod('formStateRestoreCallback', [
        reviewedParameter('state', 'string | File | FormData | null'),
        reviewedParameter('reason', "'autocomplete' | 'restore'"),
      ]),
      reviewedMethod('resetValidity'),
      reviewedMethod('setCustomValidity', [
        reviewedParameter('message', 'string'),
      ]),
    ],
    form: {
      associated: true,
      properties: ['form', 'name', 'disabled', 'required'],
      methods: ['setCustomValidity'],
    },
    native: {
      forwardedEvents: nativeEvents,
      delegatedMethods: ['blur', 'focus'],
    },
    url: 'https://webawesome.com/docs/components/file-input/',
    sha256: 'ce9311420d7f5e29ebfd736d8e99a61aeb412e36765729113fa23b84990a3b05',
  });
}

export function reviewedWebAwesomeDateInput() {
  const properties = [
    reviewedProperty(
      'appearance',
      'appearance',
      "'filled' | 'outlined' | 'filled-outlined'",
      'outlined',
      true
    ),
    reviewedProperty('assumeInteractionOn', null, 'string[]', "['input']"),
    reviewedProperty('autocomplete', 'autocomplete', 'string', ''),
    reviewedPropertyWithoutDefault(
      'dayContent',
      null,
      'WaDateInputDayContent | undefined'
    ),
    reviewedPropertyWithoutDefault('defaultValue', 'value', 'string', {
      reflects: true,
    }),
    reviewedProperty('disabled', 'disabled', 'boolean', false),
    reviewedProperty(
      'disabledDates',
      'disabled-dates',
      'string | string[] | Date[]',
      ''
    ),
    reviewedProperty(
      'disabledDaysOfWeek',
      'disabled-days-of-week',
      'string',
      ''
    ),
    reviewedProperty('disableFuture', 'disable-future', 'boolean', false, true),
    reviewedProperty('disablePast', 'disable-past', 'boolean', false, true),
    reviewedProperty('distance', 'distance', 'number', 0, true),
    reviewedProperty(
      'firstDayOfWeek',
      'first-day-of-week',
      'WaDateInputFirstDayOfWeek',
      'auto',
      true
    ),
    reviewedPropertyWithoutDefault('form', null, 'HTMLFormElement | null'),
    reviewedProperty('hint', 'hint', 'string', ''),
    reviewedPropertyWithoutDefault(
      'isDateDisabled',
      null,
      '(date: Date) => boolean | undefined'
    ),
    reviewedProperty('label', 'label', 'string', ''),
    reviewedProperty('max', 'max', 'string', '', true),
    reviewedProperty('maxRange', 'max-range', 'number', 0, true),
    reviewedProperty('min', 'min', 'string', '', true),
    reviewedProperty('minRange', 'min-range', 'number', 0, true),
    reviewedProperty('mode', 'mode', 'WaDateInputMode', 'single', true),
    reviewedProperty('months', 'months', '1 | 2', 1, true),
    reviewedProperty('name', 'name', 'string | null', '', true),
    reviewedProperty('open', 'open', 'boolean', false, true),
    reviewedProperty(
      'pageBy',
      'page-by',
      "'months' | 'single'",
      'months',
      true
    ),
    reviewedProperty('pill', 'pill', 'boolean', false, true),
    reviewedProperty(
      'placement',
      'placement',
      'WaDateInputPlacement',
      'bottom-start',
      true
    ),
    reviewedProperty('readonly', 'readonly', 'boolean', false, true),
    reviewedProperty('required', 'required', 'boolean', false, true),
    reviewedProperty(
      'size',
      'size',
      "WaDateInputSize | 'small' | 'medium' | 'large'",
      'm',
      true
    ),
    reviewedProperty('today', 'today', 'string', '', true),
    reviewedPropertyWithoutDefault(
      'validationTarget',
      null,
      'undefined | HTMLElement'
    ),
    reviewedProperty('validators', null, 'Validator[]', '[]'),
    reviewedPropertyWithoutDefault('value', null, 'string'),
    reviewedPropertyWithoutDefault('valueAsDate', null, 'Date | null'),
    reviewedPropertyWithoutDefault(
      'valueAsRange',
      null,
      '{ from: Date | null; to: Date | null }'
    ),
    reviewedProperty(
      'weekdayFormat',
      'weekday-format',
      "'narrow' | 'short' | 'long'",
      'short',
      true
    ),
    reviewedProperty('withClear', 'with-clear', 'boolean', false),
    reviewedProperty('withHint', 'with-hint', 'boolean', false),
    reviewedProperty('withLabel', 'with-label', 'boolean', false),
    reviewedProperty(
      'withOutsideDays',
      'with-outside-days',
      'boolean',
      false,
      true
    ),
    reviewedProperty(
      'withWeekNumbers',
      'with-week-numbers',
      'boolean',
      false,
      true
    ),
  ];
  const nativeEvents = ['blur', 'change', 'focus', 'input'];
  const method = (name, parameters = []) =>
    reviewedMethod(name, parameters, UNSPECIFIED_PUBLIC_RETURN);
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
      method('formStateRestoreCallback', [
        reviewedParameter('state', 'string | File | FormData | null'),
      ]),
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
    native: {
      forwardedEvents: nativeEvents,
      delegatedMethods: ['blur', 'focus'],
    },
    url: 'https://webawesome.com/docs/components/date-input/',
    sha256: 'f02d777c5ea505c9eeafee76a0418647b83aeff513e2830915547937cda418b9',
  });
}

export function reviewedWebAwesomeDatePicker() {
  const properties = [
    reviewedPropertyWithoutDefault(
      'dayContent',
      null,
      'WaDatePickerDayContent | undefined'
    ),
    reviewedProperty('disabled', 'disabled', 'boolean', false, true),
    reviewedPropertyWithoutDefault(
      'disabledDates',
      'disabled-dates',
      'string | string[] | Date[]'
    ),
    reviewedProperty(
      'disabledDaysOfWeek',
      'disabled-days-of-week',
      'string',
      ''
    ),
    reviewedProperty('disableFuture', 'disable-future', 'boolean', false, true),
    reviewedProperty('disablePast', 'disable-past', 'boolean', false, true),
    reviewedProperty(
      'firstDayOfWeek',
      'first-day-of-week',
      'WaDatePickerFirstDayOfWeek',
      'auto',
      true
    ),
    reviewedProperty('focusedDate', 'focused-date', 'string', '', true),
    reviewedPropertyWithoutDefault(
      'isDateDisabled',
      null,
      '(date: Date) => boolean | undefined'
    ),
    reviewedProperty('locale', 'locale', 'string', '', true),
    reviewedProperty('max', 'max', 'string', '', true),
    reviewedProperty('maxRange', 'max-range', 'number', 0, true),
    reviewedProperty('min', 'min', 'string', '', true),
    reviewedProperty('minRange', 'min-range', 'number', 0, true),
    reviewedProperty('mode', 'mode', 'WaDatePickerMode', 'single', true),
    reviewedProperty('months', 'months', '1 | 2', 1, true),
    reviewedProperty('pageBy', 'page-by', 'WaDatePickerPageBy', 'months', true),
    reviewedProperty('readonly', 'readonly', 'boolean', false, true),
    reviewedProperty(
      'size',
      'size',
      "WaDatePickerSize | 'small' | 'medium' | 'large'",
      'm',
      true
    ),
    reviewedProperty('today', 'today', 'string', '', true),
    reviewedPropertyWithoutDefault('value', 'value', 'string', {
      reflects: true,
    }),
    reviewedPropertyWithoutDefault('valueAsDate', null, 'Date | null', {
      readonly: true,
    }),
    reviewedPropertyWithoutDefault('valueAsRange', null, 'WaDatePickerRange', {
      readonly: true,
    }),
    reviewedProperty('view', 'view', 'WaDatePickerView', 'days', true),
    reviewedProperty(
      'weekdayFormat',
      'weekday-format',
      'WaDatePickerWeekdayFormat',
      'short',
      true
    ),
    reviewedProperty(
      'withOutsideDays',
      'with-outside-days',
      'boolean',
      false,
      true
    ),
    reviewedProperty(
      'withWeekNumbers',
      'with-week-numbers',
      'boolean',
      false,
      true
    ),
  ];
  const nativeEvents = ['change', 'input'];
  const method = (name, parameters = []) =>
    reviewedMethod(name, parameters, UNSPECIFIED_PUBLIC_RETURN);
  return reviewedPublicDocumentation({
    tag: 'wa-date-picker',
    maturity: { status: 'experimental', since: '3.8' },
    properties,
    slots: ['footer', 'header', 'next-icon', 'previous-icon'],
    events: [
      reviewedNativeEvent('change'),
      reviewedNativeEvent('input', 'InputEvent'),
      reviewedEvent('wa-focus-day', 'CustomEvent<{ date: Date }>'),
      reviewedEvent(
        'wa-view-change',
        'CustomEvent<{ view: WaDatePickerView; date: Date }>'
      ),
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

export const DATA_GRID_OPTION_TYPE =
  "{ columnIds?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }";
export const DATA_GRID_CSV_OPTION_TYPE =
  '{ fileName?: string; columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }';
export const DATA_GRID_GET_CSV_OPTION_TYPE =
  '{ columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }';
export const DATA_GRID_SCROLL_OPTION_TYPE = "{ align?: 'start' | 'center' | 'end' }";
export function reviewedWebAwesomeDataGrid() {
  const properties = [
    reviewedProperty(
      'appearance',
      'appearance',
      "'outlined' | 'plain'",
      'outlined',
      true
    ),
    reviewedProperty(
      'childRows',
      'child-rows',
      'string | ((row: Row) => Row[] | undefined) | null',
      null
    ),
    reviewedPropertyWithoutDefault('columnOrder', null, 'string[]'),
    reviewedProperty('columns', null, 'DataGridColumn[]', '[]'),
    reviewedProperty('data', null, 'Row[]', '[]'),
    reviewedProperty(
      'dataSource',
      null,
      '((request: DataGridRequest) => Promise<DataGridResponse>) | null',
      null
    ),
    reviewedPropertyWithoutDefault('expandedKeys', null, '(string | number)[]'),
    reviewedProperty('filterDebounce', 'filter-debounce', 'number', 250),
    reviewedPropertyWithoutDefault('filteredCount', null, 'number', {
      readonly: true,
    }),
    reviewedProperty(
      'filterFromLeafRows',
      'filter-from-leaf-rows',
      'boolean',
      false
    ),
    reviewedPropertyWithoutDefault(
      'filters',
      null,
      '{ id: string; value: unknown }[]'
    ),
    reviewedProperty('groupBy', 'group-by', 'string | string[] | null', null),
    reviewedProperty('label', 'label', 'string | null', null),
    reviewedProperty('loading', 'loading', 'boolean', false, true),
    reviewedProperty('maxMultiSort', 'max-multi-sort', 'number', 0),
    reviewedProperty('page', 'page', 'number', 0, true),
    reviewedPropertyWithoutDefault('pageCount', null, 'number', {
      readonly: true,
    }),
    reviewedProperty('pageSize', 'page-size', 'number', 20),
    reviewedProperty('pageSizeOptions', null, 'number[]', '[10, 20, 50, 100]'),
    reviewedProperty('paginate', 'paginate', 'boolean', false, true),
    reviewedProperty('pinnable', 'pinnable', 'boolean', false, true),
    reviewedProperty('reorderable', 'reorderable', 'boolean', false, true),
    reviewedProperty('resizable', 'resizable', 'boolean', false, true),
    reviewedProperty(
      'rowClass',
      null,
      '((row: Row) => string | null | undefined) | null',
      null
    ),
    reviewedProperty(
      'rowDetail',
      null,
      '((row: Row) => string | TemplateResult | Node) | null',
      null
    ),
    reviewedProperty('rowKey', 'row-key', 'string | null', null),
    reviewedProperty(
      'searchFn',
      null,
      '((value: unknown, searchTerm: string, row: Row) => boolean) | null',
      null
    ),
    reviewedProperty('searchTerm', null, 'string', ''),
    reviewedProperty(
      'selectable',
      'selectable',
      "'' | 'single' | 'multiple' | 'none'",
      'none',
      true
    ),
    reviewedProperty(
      'selectableRows',
      null,
      '((row: Row) => boolean) | null',
      null
    ),
    reviewedPropertyWithoutDefault('selectedKeys', null, '(string | number)[]'),
    reviewedPropertyWithoutDefault('selectedRows', null, 'Row[]'),
    reviewedProperty('server', 'server', 'boolean', false, true),
    reviewedProperty(
      'size',
      'size',
      "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'",
      'm',
      true
    ),
    reviewedPropertyWithoutDefault('sort', null, 'SortingState'),
    reviewedProperty('sortDescFirst', 'sort-desc-first', 'boolean', false),
    reviewedProperty('striped', 'striped', 'boolean', false, true),
    reviewedProperty('total', 'total', 'number', -1),
    reviewedProperty(
      'withColumnMenu',
      'with-column-menu',
      'boolean',
      false,
      true
    ),
    reviewedProperty(
      'withColumnsMenu',
      'with-columns-menu',
      'boolean',
      false,
      true
    ),
    reviewedProperty(
      'withoutSortRemoval',
      'without-sort-removal',
      'boolean',
      false,
      true
    ),
    reviewedProperty('withSearch', 'with-search', 'boolean', false, true),
  ];
  const method = (name, parameters = []) =>
    reviewedMethod(name, parameters, UNSPECIFIED_PUBLIC_RETURN);
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
      method('copySelectedRows', [
        reviewedOptionalParameter('options', DATA_GRID_OPTION_TYPE),
      ]),
      method('expandAllRows'),
      method('expandRow', [reviewedParameter('key', 'string | number')]),
      method('exportDataAsCsv', [
        reviewedParameter('options', DATA_GRID_CSV_OPTION_TYPE),
      ]),
      method('focus', [reviewedOptionalParameter('options', 'FocusOptions')]),
      method('getColumnFacets', [reviewedParameter('columnId', 'string')]),
      method('getColumnPin', [reviewedParameter('columnId', 'string')]),
      method('getDataAsCsv', [
        reviewedParameter('options', DATA_GRID_GET_CSV_OPTION_TYPE),
      ]),
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
        reviewedParameter('options', DATA_GRID_SCROLL_OPTION_TYPE),
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
    reviewedProperty(
      'autoplayOnVisible',
      'autoplay-on-visible',
      'boolean',
      false
    ),
    reviewedProperty(
      'controls',
      'controls',
      "'none' | 'standard' | 'full'",
      'standard',
      true
    ),
    reviewedProperty('currentTime', 'currentTime', 'number', 0),
    reviewedProperty('duration', 'duration', 'number', 0),
    reviewedProperty('iconLibrary', 'icon-library', 'string', 'system'),
    reviewedProperty('loop', 'loop', 'boolean', false),
    reviewedProperty('muted', 'muted', 'boolean', false, true),
    reviewedProperty('playing', 'playing', 'boolean', false, true),
    reviewedProperty('poster', 'poster', 'string', ''),
    reviewedProperty(
      'preload',
      'preload',
      "'auto' | 'metadata' | 'none'",
      'metadata'
    ),
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
  const nativeEvents = [
    'ended',
    'error',
    'loadedmetadata',
    'pause',
    'play',
    'timeupdate',
    'volumechange',
  ];

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
        reviewedNativeEvent(name, 'Event', { bubbles: false, composed: false })
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
        typeof part === 'string' ? { name: part, deprecated: null } : part
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
        reviewedMethod('setPlaybackRate', [
          reviewedParameter('rate', 'number'),
        ]),
        reviewedMethod('setVolume', [reviewedParameter('volume', 'number')]),
        reviewedMethod('toggleMute'),
        reviewedMethod('togglePlay'),
      ],
      staticProperties: [],
      staticMethods: [],
      moduleExports: [],
      form: { associated: false, properties: [], methods: [] },
      native: {
        forwardedEvents: nativeEvents,
        delegatedMethods: ['pause', 'play'],
      },
    },
    review: {
      status: 'complete',
      source: 'official-public-documentation',
      sourceUrl: 'https://webawesome.com/docs/components/video/',
      sourceVersion: '3.11.0',
      sourceSha256:
        '3823f6e9dbf7330a333dde9612e987b851f3fa8762b6cd007d93ccd1d71f6362',
      sourceHashNormalization: 'cloudflare-data-cfemail-v1',
      reviewedAt: '2026-08-02',
      unreviewedSections: [],
    },
  };
}

export function reviewedWebAwesomeVideoPlaylist() {
  const properties = [
    reviewedProperty(
      'controls',
      'controls',
      "'none' | 'standard' | 'full'",
      'full',
      true
    ),
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
          type: 'CustomEvent<{ previousIndex: number; currentIndex: number; video: { title: string; poster: string; sources: unknown[]; tracks: unknown[] } }>',
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
        typeof part === 'string' ? { name: part, deprecated: null } : part
      ),
      cssProperties: [],
      cssStates: [],
      methods: [
        reviewedMethod('goTo', [reviewedParameter('index', 'number')]),
        reviewedMethod('next'),
        reviewedMethod('previous'),
      ],
      staticProperties: [],
      staticMethods: [],
      moduleExports: [],
      form: { associated: false, properties: [], methods: [] },
      native: { forwardedEvents: [], delegatedMethods: [] },
    },
    review: {
      status: 'complete',
      source: 'official-public-documentation',
      sourceUrl: 'https://webawesome.com/docs/components/video-playlist/',
      sourceVersion: '3.11.0',
      sourceSha256:
        'bcb3e7ea61f1a5f5e3ced4b3be538e790c3ba8e1b22832576dbc44da0e1ef75a',
      sourceHashNormalization: 'cloudflare-data-cfemail-v1',
      reviewedAt: '2026-08-02',
      unreviewedSections: [],
    },
  };
}

const MANUAL_UPSTREAM_REVIEWS = new Map([
  ...[...CHART_REVIEW_EVIDENCE.keys()].map((tag) => [
    tag,
    reviewedWebAwesomeChart(tag),
  ]),
  ['wa-combobox', reviewedWebAwesomeCombobox()],
  ['wa-data-grid', reviewedWebAwesomeDataGrid()],
  ['wa-date-input', reviewedWebAwesomeDateInput()],
  ['wa-date-picker', reviewedWebAwesomeDatePicker()],
  ['wa-file-input', reviewedWebAwesomeFileInput()],
  ['wa-sparkline', reviewedWebAwesomeSparkline()],
  ['wa-video', reviewedWebAwesomeVideo()],
  ['wa-video-playlist', reviewedWebAwesomeVideoPlaylist()],
]);

export function upstreamComponents(manifest, ecosystem, fixture, existing) {
  const prefix = ecosystem === 'webawesome' ? 'wa-' : 'sl-';
  const tierByTag =
    ecosystem === 'webawesome'
      ? new Map([
          ...fixture.webawesome.free.map((tag) => [tag, 'free']),
          ...fixture.webawesome.pro.map((tag) => [tag, 'pro']),
        ])
      : new Map(fixture.shoelace.tags.map((tag) => [tag, 'free']));
  const normalized = applyRuntimeMethodEdgeSemanticsEvidence(
    applyRuntimeEventCancelabilityEvidence(
      normalizeManifest(manifest, { ecosystem, tierByTag }),
      fixture[ecosystem].runtimeEventCancelability,
      { ecosystem, version: fixture[ecosystem].version }
    ),
    fixture[ecosystem].runtimeMethodEdgeSemantics,
    { ecosystem, version: fixture[ecosystem].version }
  );
  const byTag = new Map(
    normalized
      .filter((entry) => entry.tag.startsWith(prefix))
      .map((entry) => [entry.tag, entry])
  );
  const previous = new Map(
    (existing?.upstreams?.[ecosystem]?.components ?? []).map((entry) => [
      entry.tag,
      entry,
    ])
  );
  const catalog =
    ecosystem === 'webawesome'
      ? [...fixture.webawesome.free, ...fixture.webawesome.pro]
      : [...fixture.shoelace.tags];

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
