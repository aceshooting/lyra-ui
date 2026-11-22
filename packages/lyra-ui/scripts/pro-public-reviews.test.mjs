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
  ['wa-chart', '5c78200d98c215029b6cf85b8bad62f63f8eaad858491d7adb66ce10199e8f26'],
  ['wa-bar-chart', '2730f0758c5a4702e6b03d6daa6ebb3fed4ad9ff45f0946c4e8c82303706127d'],
  ['wa-bubble-chart', 'f54ed13586cc067bc83649c099ac778a5ea37d65951864a4308052845c076685'],
  ['wa-doughnut-chart', '2b71e6183e611d464f893a276b7c6e985eb13755ac2268fe54796308620c54ab'],
  ['wa-line-chart', '699b556b5110da06914b40515c582858c835479858e4e1981a2a425498c80d4a'],
  ['wa-pie-chart', '2e8d6dce49d5f5191c0cba85286acd170af7187ded6b48fb461d00e551a2bbc7'],
  ['wa-polar-area-chart', 'a75df22813254d3044933979b42d2136978594686c5abf70b99f56cf6ada49c2'],
  ['wa-radar-chart', '807a084af346002fbd89b7a5f94ae9b5f7c47c8bb3096304f30c32ce5ae35596'],
  ['wa-scatter-chart', '6fd92d62dc0da18ac31fb6774b23e4fd2cf7ffbb504b4f79346fe46152b5ccda'],
  ['wa-sparkline', 'd9dff53cf50ab74307d515197c9b45ea7daad0743c3d6213e47691a296d39b1a'],
  ['wa-date-input', 'd0d610f481abbcc34547d79870c52e90bcbd292088912779472c54883b66d4c3'],
  ['wa-date-picker', 'c5c0adacd41ce1f1bddd91e034425c96f49f0b7656b0b5a92e29e4482a5dce74'],
  ['wa-data-grid', '4cb061d23c1ba79b87a8e07b0d780373c70b7acbdbd8d6bc91dee8ebfb997d78'],
  ['wa-combobox', 'b1f6fa105bdc60967afea41e7a6c99fb6be140dd615d153b7352c93f015020f2'],
  ['wa-file-input', '441cff764812b348a1ba9ecc5b1cec1ae5d474ecf2e9fd6c6f5e527b49030588'],
  ['wa-video', 'a8f47beaf656628f753f93fe5a2c5818a1ed05a430cb61ba59f6a09f865ebb3f'],
  ['wa-video-playlist', '285a89f59365df4b8ebb9c7e526234c754bb9d6f836565290c25b148cb622660'],
]);

function assertCompleteEvidence(review) {
  assert.equal(review.review.status, 'complete');
  assert.equal(review.review.source, 'official-public-documentation');
  assert.equal(review.review.sourceVersion, '3.15.0');
  assert.equal(review.review.reviewedAt, '2026-11-22');
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
      { properties: 17, attributes: 15, slots: 1, events: 0, parts: 0, cssProperties: 18, methods: 1 },
      tag,
    );
    assert.deepEqual(
      review.surface.properties.find(({ name }) => name === 'chart'),
      {
        name: 'chart',
        attribute: null,
        type: 'ChartJS | undefined',
        readonly: false,
        reflects: false,
        deprecated: null,
        hasDefault: false,
      },
      tag,
    );
    assert.deepEqual(review.surface.methods.map(({ name }) => name), ['renderChart'], tag);
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
    [35, 11, 13, 24, 8],
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
    [17, 3, 5, 19, 5],
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
    { properties: 42, slots: 10, events: 10, parts: 53, methods: 8 },
  );
  assert.equal(dateInput.maturity.status, 'stable');
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
    { properties: 27, slots: 5, events: 4, parts: 35, methods: 4 },
  );
  assert.equal(datePicker.maturity.status, 'stable');
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
  assert.equal(dataGrid.maturity.status, 'stable');
  assert.equal(dataGrid.surface.events.find(({ name }) => name === 'wa-cell-contextmenu').cancelable, 'always');
  assert.ok(dataGrid.surface.methods.every(({ overloads }) =>
    overloads.every(({ returnType }) => returnType === 'unspecified-public-documentation')),
  );
});

test('reviewed Video and Video Playlist snapshots retain their complete stable contracts', () => {
  const video = reviewedWebAwesomeVideo();
  const playlist = reviewedWebAwesomeVideoPlaylist();
  for (const review of [video, playlist]) {
    assertCompleteEvidence(review);
    assertNoInventedMethodReturns(review);
    assert.equal(review.maturity.status, 'stable');
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
  // comparison-only schema grows. These form-control mappings may carry exact type, default,
  // ownership, reflection, and deprecation reviews, but never event-path, method-return, derived
  // default, or CSS-default exceptions.
  const populated = (contract) => Object.keys(contract).filter((section) => contract[section].length > 0);
  const reviewedFormControlSections = new Set([
    'typeEquivalences',
    'defaultEquivalences',
    'inferredAttributeSuppressions',
    'attributePropertyEquivalences',
    'reflectionEquivalences',
    'deprecationEquivalences',
  ]);
  for (const contract of [slInput, slSelect, slTextarea, waInput, waTextarea]) {
    assert.deepEqual(Object.keys(contract), NORMALIZATION_SECTIONS);
    assert.deepEqual(
      populated(contract).filter((section) => !reviewedFormControlSections.has(section)),
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

test('explicitly protected framework controller fields stay internal', () => {
  const normalized = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'lr-controller-host',
      members: [
        { kind: 'field', name: 'localize', readonly: true, privacy: 'protected' },
        { kind: 'field', name: 'parts', readonly: true, description: 'Public part-token API.' },
        { kind: 'field', name: 'valueInput', readonly: true, description: 'Public value input.' },
      ],
    },
    { ecosystem: 'lyra' },
  );

  assert.deepEqual(
    normalized.properties.map(({ name }) => name),
    ['parts', 'valueInput'],
    'source visibility, rather than a controller-name heuristic, owns the public boundary',
  );
});

test('Lyra normalization retains directly authored lifecycle/form callbacks and property-only control members', () => {
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
        { kind: 'method', name: 'updateValidity', privacy: 'protected' },
        { kind: 'method', name: 'disconnectedCallback' },
      ],
    },
    { ecosystem: 'lyra' },
  );

  assert.deepEqual(normalized.properties.map(({ name }) => name), ['filter', 'form']);
  assert.deepEqual(
    normalized.methods.map(({ name }) => name),
    ['disconnectedCallback', 'formStateRestoreCallback', 'resetValidity'],
    'direct non-private lifecycle methods remain governed while protected implementation hooks do not',
  );
  assert.deepEqual(normalized.attributes.map(({ name }) => name), ['form']);
});
