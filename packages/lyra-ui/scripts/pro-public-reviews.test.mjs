import assert from 'node:assert/strict';
import test from 'node:test';

import { NORMALIZATION_SECTIONS, emptyNormalizations, normalizeDeclaration } from './component-inventory.mjs';

import {
  reviewedWebAwesomeChart,
  reviewedWebAwesomeCombobox,
  reviewedWebAwesomeDataGrid,
  reviewedWebAwesomeDateInput,
  reviewedWebAwesomeDatePicker,
  reviewedWebAwesomeFileInput,
  reviewedWebAwesomeSparkline,
  reviewedWebAwesomeVideo,
  reviewedWebAwesomeVideoPlaylist,
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

const evidenceHashes = new Map([
  ['wa-chart', '5165e2b004b5b1214a29aea843670e5b963ef5424cb27379c2b58b1611b8ee0e'],
  ['wa-bar-chart', 'fe2969c238434c32679554cf9e36e66f32d2faf8aa2100b4efa491967e2f7d43'],
  ['wa-bubble-chart', 'c18a710316888476a09008ce4f7ba0fa864f6a7c5d96ab7e972a50e492e46dbd'],
  ['wa-doughnut-chart', 'f0537eda572288c36700e54917f6915d3970126bdfb7b9718d93e3a4d3bfec57'],
  ['wa-line-chart', 'f318b950f8a0c7cdae1d436bd1d2cd2b02b8b678ef0164f86907309a87da54a2'],
  ['wa-pie-chart', 'a5ebc5a5fb6cae11d7d602ca37f536db81267a6af54e1bc9d9bfaeaf442238ff'],
  ['wa-polar-area-chart', 'b00297da3a51e7b5a5ce922cfe1f5c158a95b34669c3a55a53c8b47665b08ea5'],
  ['wa-radar-chart', '5d54d45a9263bf16a2fde8a95e41e31c4fcfe428884d271cca537c1bc63bc53c'],
  ['wa-scatter-chart', '1f5a3191e2895f28efc75aa5e441deb7eb1293d7ab48787c807c04ea93414a2a'],
  ['wa-sparkline', 'f1ad77432edfdb1f5f45a2caf5a707187478d851295a66a4968c02fe78770516'],
  ['wa-date-input', 'f02d777c5ea505c9eeafee76a0418647b83aeff513e2830915547937cda418b9'],
  ['wa-date-picker', '9dc70a6ef8da5c99193cb82cb30887972f25133691f74963daf90f316678d6ff'],
  ['wa-data-grid', '4712e4032ddfb07bf32bacf18733c478b7b939e0af766609826d04d836d8239e'],
  ['wa-combobox', '878fceb16d17a6ced71602f22d51339958c16138a470858f5dccf2d8d6419ec3'],
  ['wa-file-input', 'ce9311420d7f5e29ebfd736d8e99a61aeb412e36765729113fa23b84990a3b05'],
  ['wa-video', '3823f6e9dbf7330a333dde9612e987b851f3fa8762b6cd007d93ccd1d71f6362'],
  ['wa-video-playlist', 'bcb3e7ea61f1a5f5e3ced4b3be538e790c3ba8e1b22832576dbc44da0e1ef75a'],
]);

function assertCompleteEvidence(review) {
  assert.equal(review.review.status, 'complete');
  assert.equal(review.review.source, 'official-public-documentation');
  assert.equal(review.review.sourceVersion, '3.11.0');
  assert.equal(review.review.reviewedAt, '2026-08-02');
  assert.match(review.review.sourceUrl, /^https:\/\/webawesome\.com\/docs\/components\//);
  assert.equal(review.review.sourceSha256, evidenceHashes.get(review.tag));
  assert.equal(review.review.sourceHashNormalization, 'cloudflare-data-cfemail-v1');
  assert.deepEqual(review.review.unreviewedSections, []);
}

function assertNoInventedMethodReturns(review) {
  assert.ok(
    review.surface.methods.every(({ overloads }) =>
      overloads.every(({ returnType }) => returnType === 'unspecified-public-documentation')),
    `${review.tag}: rendered public method tables do not publish return types`,
  );
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
  for (const review of [sparkline, combobox, fileInput]) {
    assertCompleteEvidence(review);
    assertNoInventedMethodReturns(review);
  }

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
  assert.equal(
    combobox.surface.properties.find(({ name }) => name === 'autocapitalize').type,
    "'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'",
  );
  assert.equal(
    combobox.surface.properties.find(({ name }) => name === 'filter').type,
    '((option: WaOption, query: string) => boolean) | null',
  );
  assert.equal(
    combobox.surface.properties.find(({ name }) => name === 'getTag').type,
    '(option: WaOption, index: number) => TemplateResult | string | HTMLElement',
  );
  assert.equal(combobox.surface.properties.find(({ name }) => name === 'value').attribute, 'value');
  assert.deepEqual(
    combobox.surface.methods.find(({ name }) => name === 'formStateRestoreCallback')
      .overloads[0].parameters.map(({ name }) => name),
    ['state', 'reason'],
  );
  assert.deepEqual(
    [
      fileInput.surface.properties.length,
      fileInput.surface.slots.length,
      fileInput.surface.events.length,
      fileInput.surface.parts.length,
      fileInput.surface.methods.length,
    ],
    [17, 3, 5, 17, 5],
  );
  assert.equal(fileInput.surface.properties.find(({ name }) => name === 'dragging').readonly, false);
  assert.equal(fileInput.surface.properties.find(({ name }) => name === 'dragging').attribute, null);
  assert.equal(fileInput.surface.properties.find(({ name }) => name === 'dragging').reflects, false);
  assert.equal(fileInput.surface.properties.find(({ name }) => name === 'fileCount').readonly, false);
  assert.deepEqual(
    fileInput.surface.properties.filter(({ reflects }) => reflects).map(({ name }) => name),
    ['multiple', 'name', 'required', 'size'],
  );
  assert.deepEqual(fileInput.surface.slots.map(({ name }) => name), ['dropzone', 'hint', 'label']);
  assert.deepEqual(
    fileInput.surface.methods.find(({ name }) => name === 'formStateRestoreCallback')
      .overloads[0].parameters.map(({ name }) => name),
    ['state', 'reason'],
  );
  assert.match(
    combobox.surface.parts.find(({ name }) => name === 'label').deprecated,
    /form-control-label/,
  );
  assert.match(fileInput.surface.parts.find(({ name }) => name === 'base').deprecated, /file-input/);
  assert.match(
    fileInput.surface.parts.find(({ name }) => name === 'label').deprecated,
    /form-control-label/,
  );
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
  for (const review of [dateInput, datePicker, dataGrid]) assertNoInventedMethodReturns(review);

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
  assert.equal(
    dateInput.surface.properties.find(({ name }) => name === 'isDateDisabled').type,
    '(date: Date) => boolean | undefined',
  );
  assert.equal(
    datePicker.surface.properties.find(({ name }) => name === 'isDateDisabled').type,
    '(date: Date) => boolean | undefined',
  );
  assert.equal(datePicker.surface.properties.find(({ name }) => name === 'valueAsDate').readonly, true);
  assert.equal(datePicker.surface.properties.find(({ name }) => name === 'valueAsRange').readonly, true);
  assert.equal(dataGrid.surface.properties.find(({ name }) => name === 'selectedRows').readonly, false);
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

test('reviewed Video and Video Playlist snapshots retain their complete experimental contracts', () => {
  const video = reviewedWebAwesomeVideo();
  const playlist = reviewedWebAwesomeVideoPlaylist();
  for (const review of [video, playlist]) {
    assertCompleteEvidence(review);
    assertNoInventedMethodReturns(review);
    assert.equal(review.maturity.status, 'experimental');
  }
  for (const name of ['ended', 'error', 'loadedmetadata', 'pause', 'play', 'timeupdate', 'volumechange']) {
    assertNativeContract(video, name, {
      constructor: 'Event',
      bubbles: false,
      composed: false,
      cancelable: 'never',
    });
  }
  assert.deepEqual(
    {
      properties: playlist.surface.properties.length,
      slots: playlist.surface.slots.length,
      events: playlist.surface.events.length,
      parts: playlist.surface.parts.length,
      methods: playlist.surface.methods.length,
    },
    { properties: 2, slots: 1, events: 1, parts: 7, methods: 3 },
  );
  assert.equal(video.surface.properties.find(({ name }) => name === 'currentTime').attribute, 'currentTime');
  assert.match(video.surface.parts.find(({ name }) => name === 'base').deprecated, /video-wrapper/);
  assert.match(playlist.surface.parts.find(({ name }) => name === 'base').deprecated, /video-playlist/);
  assert.equal(playlist.surface.properties.find(({ name }) => name === 'controls').default, 'full');
  assert.equal(playlist.surface.events[0].name, 'wa-video-change');
});

test('origin-aware analyzer normalizations are comparison-only and narrowly scoped', () => {
  const slInput = reviewedMappingNormalizations('sl-input');
  const slSelect = reviewedMappingNormalizations('sl-select');
  const slTextarea = reviewedMappingNormalizations('sl-textarea');
  const waInput = reviewedMappingNormalizations('wa-input');
  const waTextarea = reviewedMappingNormalizations('wa-textarea');

  // Asserting the populated sections rather than a frozen key list keeps this review honest as the
  // comparison-only schema grows: the claim is that these form-control mappings only ever carry
  // analyzer equivalences, never a cancelability review or a method-return wildcard.
  const populated = (contract) => Object.keys(contract).filter((section) => contract[section].length > 0);
  for (const contract of [slInput, slSelect, slTextarea, waInput, waTextarea]) {
    assert.deepEqual(Object.keys(contract), NORMALIZATION_SECTIONS);
    assert.deepEqual(
      populated(contract).filter(
        (section) =>
          !['typeEquivalences', 'defaultEquivalences', 'inferredAttributeSuppressions'].includes(section),
      ),
      [],
    );
  }
  assert.deepEqual(
    [slInput, slSelect, slTextarea].map((contract) => contract.defaultEquivalences),
    Array.from({ length: 3 }, () => [
      { memberKind: 'attribute', member: 'form', upstream: '', target: null },
      { memberKind: 'attribute', member: 'size', upstream: 'medium', target: 'm' },
    ]),
  );
  assert.deepEqual(slSelect.inferredAttributeSuppressions, [
    { attribute: 'getTag', property: 'getTag', explicit: true },
  ]);
  assert.deepEqual(reviewedMappingNormalizations('sl-dropdown').inferredAttributeSuppressions, []);
  assert.deepEqual(reviewedMappingNormalizations('sl-range').inferredAttributeSuppressions, []);
  assert.deepEqual(reviewedMappingNormalizations('sl-popup').inferredAttributeSuppressions, [
    { attribute: 'autoSizeBoundary', property: 'autoSizeBoundary', explicit: true },
    { attribute: 'flipBoundary', property: 'flipBoundary', explicit: true },
    { attribute: 'shiftBoundary', property: 'shiftBoundary', explicit: true },
  ]);
  assert.deepEqual(reviewedMappingNormalizations('sl-rating').inferredAttributeSuppressions, [
    { attribute: 'getSymbol', property: 'getSymbol', explicit: true },
  ]);
  assert.deepEqual(waInput.defaultEquivalences, [
    { memberKind: 'attribute', member: 'name', upstream: null, target: '' },
  ]);
  // Both Web Awesome form controls carry the same origin-aware default review. Their per-member
  // type equivalences legitimately differ (`resize` against `type`/`value`), so compare the review
  // that is meant to be shared rather than the whole assembled contract.
  assert.deepEqual(waTextarea.defaultEquivalences, waInput.defaultEquivalences);
  assert.deepEqual(waTextarea.inferredAttributeSuppressions, waInput.inferredAttributeSuppressions);
  assert.deepEqual(reviewedMappingNormalizations('wa-unrelated'), emptyNormalizations());
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
