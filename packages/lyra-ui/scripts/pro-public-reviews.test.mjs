import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDeclaration } from './component-inventory.mjs';

import {
  reviewedWebAwesomeChart,
  reviewedWebAwesomeCombobox,
  reviewedWebAwesomeDataGrid,
  reviewedWebAwesomeDateInput,
  reviewedWebAwesomeDatePicker,
  reviewedWebAwesomeFileInput,
  reviewedWebAwesomeSparkline,
  reviewedWebAwesomeVideo,
  reviewedMappingNormalizations,
} from './generate-component-inventory.mjs';

const chartDefaults = new Map([
  ['wa-chart', 'bar'],
  ['wa-bar-chart', 'bar'],
  ['wa-bubble-chart', 'bubble'],
  ['wa-doughnut-chart', 'doughnut'],
  ['wa-line-chart', 'line'],
  ['wa-pie-chart', 'pie'],
  ['wa-polar-area-chart', 'polarArea'],
  ['wa-radar-chart', 'radar'],
  ['wa-scatter-chart', 'scatter'],
]);

function assertCompleteEvidence(review) {
  assert.equal(review.review.status, 'complete');
  assert.equal(review.review.source, 'official-public-documentation');
  assert.equal(review.review.sourceVersion, '3.11.0');
  assert.equal(review.review.reviewedAt, '2026-08-02');
  assert.match(review.review.sourceUrl, /^https:\/\/webawesome\.com\/docs\/components\//);
  assert.match(review.review.sourceSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(review.review.unreviewedSections, []);
}

function assertNativeContract(review, name, expected) {
  const event = review.surface.events.find((candidate) => candidate.name === name);
  assert.ok(event, `${review.tag}: missing reviewed ${name} event`);
  assert.deepEqual(
    {
      constructor: event.constructor,
      bubbles: event.bubbles,
      composed: event.composed,
      cancelable: event.cancelable,
    },
    expected,
    `${review.tag}#${name}`,
  );
}

test('all nine reviewed Chart snapshots share the exact public surface and preserve type defaults', () => {
  for (const [tag, typeDefault] of chartDefaults) {
    const review = reviewedWebAwesomeChart(tag);
    assertCompleteEvidence(review);
    assert.deepEqual(
      {
        properties: review.surface.properties.length,
        attributes: review.surface.attributes.length,
        slots: review.surface.slots.length,
        events: review.surface.events.length,
        parts: review.surface.parts.length,
        cssProperties: review.surface.cssProperties.length,
        methods: review.surface.methods.length,
      },
      { properties: 16, attributes: 15, slots: 1, events: 0, parts: 0, cssProperties: 18, methods: 0 },
      tag,
    );
    assert.equal(review.surface.properties.find(({ name }) => name === 'type').default, typeDefault, tag);
    assert.deepEqual(
      review.surface.properties.filter(({ reflects }) => reflects).map(({ name }) => name),
      ['withoutAnimation', 'withoutLegend', 'withoutTooltip'],
      tag,
    );
  }
  assert.throws(() => reviewedWebAwesomeChart('wa-invented-chart'), /Unknown reviewed Web Awesome chart tag/);
});

test('reviewed Sparkline, Combobox, and File Input snapshots are member-complete', () => {
  const sparkline = reviewedWebAwesomeSparkline();
  const combobox = reviewedWebAwesomeCombobox();
  const fileInput = reviewedWebAwesomeFileInput();
  for (const review of [sparkline, combobox, fileInput]) assertCompleteEvidence(review);

  assert.deepEqual(
    [
      sparkline.surface.properties.length,
      sparkline.surface.parts.length,
      sparkline.surface.cssProperties.length,
    ],
    [5, 4, 3],
  );
  assert.deepEqual(
    [
      combobox.surface.properties.length,
      combobox.surface.slots.length,
      combobox.surface.events.length,
      combobox.surface.parts.length,
      combobox.surface.methods.length,
    ],
    [30, 7, 11, 17, 7],
  );
  assert.equal(combobox.surface.events.find(({ name }) => name === 'wa-create').cancelable, 'always');
  assert.deepEqual(
    [
      fileInput.surface.properties.length,
      fileInput.surface.slots.length,
      fileInput.surface.events.length,
      fileInput.surface.parts.length,
      fileInput.surface.methods.length,
    ],
    [17, 4, 5, 17, 5],
  );
  assert.equal(fileInput.surface.properties.find(({ name }) => name === 'dragging').readonly, true);
  assert.equal(fileInput.surface.form.associated, true);
  assertNativeContract(combobox, 'input', {
    constructor: 'InputEvent | CustomEvent<{ value: string | string[] }>',
    bubbles: true,
    composed: true,
    cancelable: 'never',
  });
  assertNativeContract(combobox, 'change', {
    constructor: 'CustomEvent',
    bubbles: true,
    composed: true,
    cancelable: 'never',
  });
  assertNativeContract(fileInput, 'input', {
    constructor: 'Event',
    bubbles: true,
    composed: true,
    cancelable: 'never',
  });
  assertNativeContract(fileInput, 'blur', {
    constructor: 'FocusEvent',
    bubbles: true,
    composed: true,
    cancelable: 'never',
  });
});

test('reviewed Date and Data Grid snapshots preserve every counted public member', () => {
  const dateInput = reviewedWebAwesomeDateInput();
  const datePicker = reviewedWebAwesomeDatePicker();
  const dataGrid = reviewedWebAwesomeDataGrid();
  for (const review of [dateInput, datePicker, dataGrid]) assertCompleteEvidence(review);

  assert.deepEqual(
    {
      properties: dateInput.surface.properties.length,
      slots: dateInput.surface.slots.length,
      events: dateInput.surface.events.length,
      parts: dateInput.surface.parts.length,
      methods: dateInput.surface.methods.length,
    },
    { properties: 42, slots: 10, events: 10, parts: 19, methods: 8 },
  );
  assert.equal(dateInput.maturity.status, 'experimental');
  assert.equal(dateInput.surface.events.find(({ name }) => name === 'wa-show').cancelable, 'always');
  assert.equal(dateInput.surface.events.find(({ name }) => name === 'wa-hide').cancelable, 'always');
  for (const review of [dateInput, datePicker]) {
    assertNativeContract(review, 'input', {
      constructor: 'InputEvent',
      bubbles: true,
      composed: true,
      cancelable: 'never',
    });
    assertNativeContract(review, 'change', {
      constructor: 'Event',
      bubbles: true,
      composed: true,
      cancelable: 'never',
    });
  }
  for (const name of ['focus', 'blur']) {
    assertNativeContract(dateInput, name, {
      constructor: 'FocusEvent',
      bubbles: true,
      composed: true,
      cancelable: 'never',
    });
  }

  assert.deepEqual(
    {
      properties: datePicker.surface.properties.length,
      slots: datePicker.surface.slots.length,
      events: datePicker.surface.events.length,
      parts: datePicker.surface.parts.length,
      methods: datePicker.surface.methods.length,
    },
    { properties: 27, slots: 4, events: 4, parts: 35, methods: 4 },
  );
  assert.equal(datePicker.maturity.status, 'experimental');
  for (const component of [dateInput, datePicker]) {
    assert.ok(
      component.surface.methods.every(({ overloads }) =>
        overloads.every(({ returnType }) => returnType === 'unspecified-public-documentation')),
      `${component.tag} does not invent return types omitted by the rendered public documentation`,
    );
  }

  assert.deepEqual(
    {
      properties: dataGrid.surface.properties.length,
      attributes: dataGrid.surface.attributes.length,
      slots: dataGrid.surface.slots.length,
      events: dataGrid.surface.events.length,
      parts: dataGrid.surface.parts.length,
      cssProperties: dataGrid.surface.cssProperties.length,
      methods: dataGrid.surface.methods.length,
    },
    { properties: 42, attributes: 25, slots: 3, events: 15, parts: 42, cssProperties: 18, methods: 26 },
  );
  assert.equal(dataGrid.maturity.status, 'experimental');
  assert.equal(dataGrid.surface.events.find(({ name }) => name === 'wa-cell-contextmenu').cancelable, 'always');
  assert.ok(dataGrid.surface.methods.every(({ overloads }) =>
    overloads.every(({ returnType }) => returnType === 'unspecified-public-documentation')),
  );
});

test('reviewed Video native media events retain platform propagation flags', () => {
  const video = reviewedWebAwesomeVideo();
  assertCompleteEvidence(video);
  for (const name of ['ended', 'error', 'loadedmetadata', 'pause', 'play', 'timeupdate', 'volumechange']) {
    assertNativeContract(video, name, {
      constructor: 'Event',
      bubbles: false,
      composed: false,
      cancelable: 'never',
    });
  }
});

test('origin-aware analyzer normalizations are comparison-only and narrowly scoped', () => {
  const slInput = reviewedMappingNormalizations('sl-input');
  const slSelect = reviewedMappingNormalizations('sl-select');
  const slTextarea = reviewedMappingNormalizations('sl-textarea');
  const waInput = reviewedMappingNormalizations('wa-input');
  const waTextarea = reviewedMappingNormalizations('wa-textarea');

  for (const contract of [slInput, slSelect, slTextarea, waInput, waTextarea]) {
    assert.deepEqual(Object.keys(contract), ['defaultEquivalences', 'inferredAttributeSuppressions']);
  }
  assert.deepEqual(
    [slInput, slSelect, slTextarea].map((contract) => contract.defaultEquivalences),
    Array.from({ length: 3 }, () => [
      { memberKind: 'attribute', member: 'form', upstream: '', target: null },
      { memberKind: 'attribute', member: 'size', upstream: 'medium', target: 'm' },
    ]),
  );
  assert.deepEqual(slSelect.inferredAttributeSuppressions, [
    { attribute: 'get-tag', property: 'getTag' },
  ]);
  assert.deepEqual(waInput.defaultEquivalences, [
    { memberKind: 'attribute', member: 'name', upstream: null, target: '' },
  ]);
  assert.deepEqual(waTextarea, waInput);
  assert.deepEqual(reviewedMappingNormalizations('wa-unrelated'), {
    defaultEquivalences: [],
    inferredAttributeSuppressions: [],
  });
});

test('Lyra subclass normalization retains reviewed inherited property-only APIs without inferring attributes', () => {
  const normalized = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'lr-bubble-chart',
      members: [
        {
          kind: 'field',
          name: 'config',
          description: 'Public Chart.js configuration.',
          type: { text: 'ChartConfiguration | undefined' },
          inheritedFrom: { name: 'LyraChart', module: 'chart.class.ts' },
        },
        {
          kind: 'field',
          name: 'chartArea',
          description: 'Internal draw geometry.',
          type: { text: 'object | null' },
          inheritedFrom: { name: 'LyraChart', module: 'chart.class.ts' },
        },
      ],
    },
    { ecosystem: 'lyra' },
  );

  assert.deepEqual(normalized.properties.map(({ name }) => name), ['config']);
  assert.deepEqual(normalized.attributes, []);
});

test('framework controller fields stay internal unless public metadata establishes a surface', () => {
  const normalized = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'lr-controller-host',
      members: [
        { kind: 'field', name: 'localize', readonly: true },
        { kind: 'field', name: 'parts', readonly: true, description: 'Public part-token API.' },
        { kind: 'field', name: 'valueInput', readonly: true, description: 'Public value input.' },
      ],
    },
    { ecosystem: 'lyra' },
  );

  assert.deepEqual(
    normalized.properties.map(({ name }) => name),
    ['parts', 'valueInput'],
    'readonly alone does not publish a framework-owned controller field',
  );
});

test('Lyra normalization retains documented form callbacks and property-only control members', () => {
  const normalized = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'lr-control',
      attributes: [{ name: 'form', fieldName: 'form', type: { text: 'string' }, default: 'null' }],
      members: [
        { kind: 'field', name: 'filter', type: { text: 'Function | null' }, default: 'null' },
        { kind: 'field', name: 'form', type: { text: 'HTMLFormElement | null' } },
        { kind: 'method', name: 'formStateRestoreCallback' },
        { kind: 'method', name: 'resetValidity' },
        { kind: 'method', name: 'updateValidity' },
        { kind: 'method', name: 'disconnectedCallback' },
      ],
    },
    { ecosystem: 'lyra' },
  );

  assert.deepEqual(normalized.properties.map(({ name }) => name), ['filter', 'form']);
  assert.deepEqual(normalized.methods.map(({ name }) => name), ['formStateRestoreCallback', 'resetValidity']);
  assert.deepEqual(normalized.attributes.map(({ name }) => name), ['form']);
});
