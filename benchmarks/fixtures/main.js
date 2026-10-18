import '@aceshooting/lyra-ui/components/lr-document-library.js';
import '@aceshooting/lyra-ui/components/lr-eval-dataset.js';
import '@aceshooting/lyra-ui/components/lr-retrieval-results.js';
import '@aceshooting/lyra-ui/components/lr-ingestion-queue.js';
import { makeListInputs } from './list-inputs.mjs';
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/components/lr-table.js';
import '@aceshooting/lyra-ui/components/lr-select.js';
import '@aceshooting/lyra-ui/components/lr-combobox.js';
import '@aceshooting/lyra-ui/components/lr-option.js';
import '@aceshooting/lyra-ui/components/lr-bar-chart.js';
import Chart from 'chart.js/auto';
import { SCENARIOS, ERROR_CODES } from './catalog.mjs';

const stage = document.querySelector('#stage');
const knownErrors = new Set(ERROR_CODES);
const descriptors = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));
const taskTurn = () => new Promise((resolve) => setTimeout(resolve, 0));
let active;
let busy = false;

class BenchmarkError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function bounded(promise, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new BenchmarkError('TIMEOUT')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function updates(state) {
  // Options notify their owner from their own update. Await both sides, including a follow-up
  // microtask checkpoint, before reporting the first completed component update phase.
  if (state.options) await Promise.all(state.options.map((option) => option.updateComplete));
  await state.element.updateComplete;
  for (const child of state.element.shadowRoot?.querySelectorAll('lr-table, lr-virtual-list') ?? []) {
    await child.updateComplete;
    for (const control of child.shadowRoot?.querySelectorAll('lr-checkbox, lr-progress-bar, lr-chunk-inspector') ?? []) await control.updateComplete;
  }
  await Promise.resolve();
  await state.element.updateComplete;
}

async function settle(state) {
  for (let turn = 0; turn < 2; turn++) {
    await taskTurn();
    await updates(state);
  }
}

async function paint() {
  if (document.visibilityState !== 'visible') throw new BenchmarkError('PAGE_NOT_VISIBLE');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function phase(state, mutate) {
  const start = performance.now();
  mutate();
  const assigned = performance.now();
  await bounded(updates(state));
  const updated = performance.now();
  await bounded(settle(state));
  const settled = performance.now();
  await bounded(paint());
  const painted = performance.now();
  return { assignmentMs: assigned - start, updateMs: updated - assigned,
    settleMs: settled - updated, paintMs: painted - settled, totalMs: painted - start };
}

function create(tag) {
  const element = document.createElement(tag);
  element.lang = 'en';
  stage.append(element);
  return element;
}

function row(index, offset = 0) {
  return { id: index, name: `Record ${index}`, amount: index + offset };
}

function configureTable(element) {
  element.setAttribute('aria-label', 'Synthetic records');
  element.rowKey = (value) => value.id;
  element.columns = [
    { key: 'id', label: 'ID', cell: (value) => value.id },
    { key: 'name', label: 'Name', cell: (value) => value.name },
    { key: 'amount', label: 'Amount', sortable: true,
      sortValue: (value) => value.amount, cell: (value) => value.amount },
  ];
  element.pageSize = 100;
}

function tableState(descriptor) {
  const element = create('lr-table');
  configureTable(element);
  const state = { element, descriptor, variant: 0 };
  if (descriptor.id === 'table-million-page') {
    // A complete caller-owned dataset stays outside the component. Both slices and their source
    // are prepared before any measured setter; no million-row DOM is constructed.
    state.source = Array.from({ length: descriptor.size }, (_, index) => row(index));
    state.pages = [1, 10000];
    state.inputs = [state.source.slice(0, 100), state.source.slice(-100)];
    element.paginationMode = 'server';
    element.sortMode = 'server';
    element.totalItems = descriptor.size;
  } else if (descriptor.id === 'table-million-boundary') {
    const first = Array.from({ length: descriptor.size }, (_, index) => row(index));
    const second = first.slice();
    // Keep two input identities without allocating a second million record objects. Only the
    // accepted prefix changes; every visible record still differs between successive samples.
    for (let index = 0; index < 10000; index++) second[index] = row(index, 1);
    state.inputs = [first, second];
  } else {
    state.inputs = [0, 1].map((offset) =>
      Array.from({ length: descriptor.size }, (_, index) => row(index, offset)));
  }
  element.rows = state.inputs[0];
  state.mutate = () => {
    state.variant = 1 - state.variant;
    element.rows = state.inputs[state.variant];
    if (state.pages) element.page = state.pages[state.variant];
  };
  state.validate = () => {
    const input = state.inputs[state.variant];
    const expectedRetained = Math.min(input.length, 10000);
    const rendered = [...element.shadowRoot.querySelectorAll('tbody tr[data-row-key]')];
    const expected = input.slice(0, 100);
    // cellElement is public and checks each rendered row against its stable identity.
    const correctOrder = rendered.length === expected.length && expected.every((value, index) =>
      element.rowElement(value.id) === rendered[index]);
    const correctValues = correctOrder && expected.every((value) =>
      element.cellElement(value.id, 'id')?.textContent.trim() === String(value.id) &&
      element.cellElement(value.id, 'name')?.textContent.trim() === value.name &&
      element.cellElement(value.id, 'amount')?.textContent.trim() === String(value.amount));
    const checks = [
      ['table-retained-count', element.rows.length === expectedRetained],
      ['table-truncation-state', element.rowsTruncated === (input.length > 10000)],
      ['table-page-bound', rendered.length === expected.length],
      ['table-rendered-values', correctValues],
    ];
    if (state.pages) checks.push(
      ['table-total-items', element.totalItems === descriptor.size],
      ['table-controlled-page', element.page === state.pages[state.variant]],
    );
    return { checks, counts: { sourceCount: descriptor.size, retainedCount: element.rows.length,
      renderedRowCount: rendered.length, page: element.page,
      totalItems: state.pages ? element.totalItems : element.rows.length } };
  };
  return state;
}

function tableOperationState(descriptor) {
  const element = create('lr-table');
  configureTable(element);
  const sorting = descriptor.id === 'table-sort-10000';
  const state = { element, descriptor, variant: 0 };
  const source = Array.from({ length: descriptor.size }, (_, index) => ({
    id: index,
    name: `Record ${index} Group${index % 10}`,
    // 7919 is coprime with 10000, so input order is a permutation of unique numeric values.
    amount: (index * 7919) % descriptor.size,
  }));
  let expectedViews;
  if (sorting) {
    // Build the oracle by numeric position, independently of a comparator or the table's sort.
    const ascending = new Array(source.length);
    for (const value of source) ascending[value.amount] = value;
    expectedViews = [ascending, [...ascending].reverse()];
    element.sortKey = 'amount';
    element.sortDir = 'asc';
  } else {
    expectedViews = [[], []];
    // Compute membership from the generated group number, independently of text matching.
    for (let index = 0; index < source.length; index++) {
      if (index % 10 === 2) expectedViews[0].push(source[index]);
      if (index % 10 === 7) expectedViews[1].push(source[index]);
    }
    element.filterText = 'Group2';
  }
  const expectedPages = expectedViews.map((view) => view.slice(0, 100));
  const directions = ['asc', 'desc'];
  const queries = ['Group2', 'Group7'];
  element.rows = source;
  state.mutate = () => {
    state.variant = 1 - state.variant;
    if (sorting) element.sortDir = directions[state.variant];
    else element.filterText = queries[state.variant];
  };
  state.validate = () => {
    const expectedView = expectedViews[state.variant];
    const expectedPage = expectedPages[state.variant];
    const actualView = element.viewRows;
    const rendered = [...element.shadowRoot.querySelectorAll('tbody tr[data-row-key]')];
    const viewMatches = actualView.length === expectedView.length && actualView.every((value, index) =>
      value.id === expectedView[index].id && value.name === expectedView[index].name &&
      value.amount === expectedView[index].amount);
    const ordered = !sorting || actualView.every((value, index) => index === 0 ||
      (state.variant === 0 ? actualView[index - 1].amount < value.amount : actualView[index - 1].amount > value.amount));
    const pageMatches = rendered.length === expectedPage.length && expectedPage.every((value, index) =>
      element.rowElement(value.id) === rendered[index] &&
      element.cellElement(value.id, 'id')?.textContent.trim() === String(value.id) &&
      element.cellElement(value.id, 'name')?.textContent.trim() === value.name &&
      element.cellElement(value.id, 'amount')?.textContent.trim() === String(value.amount));
    return { checks: [
      ['table-retained-count', element.rows.length === source.length],
      ['table-truncation-state', element.rowsTruncated === false],
      ['table-page-bound', rendered.length === expectedPage.length],
      ['table-rendered-values', pageMatches],
      ['table-view-values', viewMatches && ordered],
    ], counts: { sourceCount: source.length, retainedCount: element.rows.length,
      viewRowCount: actualView.length, renderedRowCount: rendered.length,
      page: element.page, totalItems: actualView.length } };
  };
  return state;
}

async function peerReady(element) {
  const started = performance.now();
  while (performance.now() - started < 15000) {
    const canvas = element.shadowRoot?.querySelector('canvas');
    if (canvas && Chart.getChart(canvas)) return;
    await bounded(element.updateComplete);
    await taskTurn();
  }
  throw new BenchmarkError('PEER_UNAVAILABLE');
}

function canvasIsDrawn(canvas, peer) {
  if (!canvas || !peer || canvas.width <= 0 || canvas.height <= 0) return false;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return false;
  const area = peer.chartArea;
  if (!area || ![area.left, area.right, area.top, area.bottom, area.width, area.height].every(Number.isFinite) ||
      area.width <= 0 || area.height <= 0 || area.right <= area.left || area.bottom <= area.top) return false;
  const context = canvas.getContext('2d');
  if (!context) return false;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let painted = false;
  let varied = false;
  for (let index = 0; index < pixels.length && (!painted || !varied); index += 4) {
    painted ||= pixels[index + 3] > 0;
    varied ||= pixels[index] !== pixels[0] || pixels[index + 1] !== pixels[1] ||
      pixels[index + 2] !== pixels[2] || pixels[index + 3] !== pixels[3];
  }
  return painted && varied;
}

function chartState(descriptor) {
  const element = create('lr-bar-chart');
  element.withoutAnimation = true;
  element.withoutLegend = true;
  element.height = '260px';
  element.label = 'Synthetic chart 0';
  const state = { element, descriptor, variant: 0, tableCalls: 0 };
  state.labels = Array.from({ length: descriptor.size }, (_, index) => `Category ${index}`);
  state.inputs = [0, 1].map((offset) => [{ label: 'Values',
    data: Array.from({ length: descriptor.size }, (_, index) => index + 10 + offset),
  }]);
  element.formatter = (context) => {
    if (context.surface === 'table') state.tableCalls++;
    return String(context.value);
  };
  element.labels = state.labels;
  element.datasets = state.inputs[0];
  state.mutate = () => {
    state.variant = 1 - state.variant;
    if (descriptor.parameters.labelOnly) element.label = `Synthetic chart ${state.variant}`;
    else element.datasets = state.inputs[state.variant];
  };
  state.validate = () => {
    const canvas = element.shadowRoot.querySelector('canvas');
    // Chart.getChart is the peer's public lookup API; no component implementation state is read.
    const peer = canvas ? Chart.getChart(canvas) : undefined;
    const plotted = peer?.data.datasets[0]?.data ?? [];
    const labels = peer?.data.labels ?? [];
    const table = element.shadowRoot.querySelector('[part="data-table"] table');
    const rows = [...(table?.querySelectorAll('tbody tr') ?? [])];
    const expectedRows = Math.min(descriptor.size, 1000);
    const offset = descriptor.parameters.labelOnly ? 0 : state.variant;
    const expectedIndices = Array.from({ length: expectedRows }, (_, index) =>
      Math.round(index * (descriptor.size - 1) / (expectedRows - 1)));
    const correctValues = rows.length === expectedRows && rows.every((entry, index) =>
      entry.querySelector('th')?.textContent.trim() === `Category ${expectedIndices[index]}` &&
      entry.querySelector('td button')?.textContent.trim() === String(expectedIndices[index] + 10 + offset));
    return { checks: [
      ['chart-peer-ready', Boolean(peer)],
      ['chart-retained-count', element.labels.length === descriptor.size && element.datasets[0]?.data.length === descriptor.size],
      ['chart-plot-bound', plotted.length === expectedRows],
      ['chart-table-bound', rows.length === expectedRows],
      ['chart-sample-endpoints', labels[0] === 'Category 0' && labels.at(-1) === `Category ${descriptor.size - 1}`],
      ['chart-plot-values', canvasIsDrawn(canvas, peer) && plotted.length === expectedRows && plotted.every((value, index) =>
        value === expectedIndices[index] + 10 + offset)],
      ['chart-table-values', correctValues],
      ['chart-accessible-label', canvas?.getAttribute('aria-label')?.includes(element.label) === true],
    ], counts: { sourceCount: descriptor.size, retainedCount: element.datasets[0]?.data.length ?? 0,
      plottedRecordCount: plotted.length, renderedRowCount: rows.length,
      tableCellCount: table?.querySelectorAll('tbody td').length ?? 0 } };
  };
  return state;
}

function optionState(descriptor) {
  const tag = descriptor.id.includes('-combobox-') ? 'lr-combobox' : 'lr-select';
  const element = create(tag);
  element.label = 'Synthetic options';
  element.style.inlineSize = '360px';
  const state = { element, descriptor, variant: 0, options: [] };
  state.labels = [0, 1].map((generation) => Array.from({ length: descriptor.size },
    (_, index) => `Option ${index} revision ${generation}`));
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < descriptor.size; index++) {
    const option = document.createElement('lr-option');
    option.value = `value-${index}`;
    option.label = state.labels[0][index];
    option.textContent = `Option ${index}`;
    state.options.push(option);
    fragment.append(option);
  }
  element.append(fragment);
  element.value = `value-${descriptor.size - 1}`;
  state.mutate = () => {
    state.variant = 1 - state.variant;
    const labels = state.labels[state.variant];
    for (let index = 0; index < descriptor.size; index++) state.options[index].label = labels[index];
  };
  state.validate = () => {
    const labels = state.labels[state.variant];
    const correctLabels = state.options.every((option, index) =>
      option.isConnected && option.value === `value-${index}` && option.label === labels[index]);
    const selectedLabel = tag === 'lr-select'
      ? element.shadowRoot.querySelector('[part="display-input"]')?.textContent.trim()
      : element.shadowRoot.querySelector('[part="combobox-input"]')?.value;
    return { checks: [
      ['option-catalog-count', element.querySelectorAll('lr-option').length === descriptor.size],
      ['option-labels-current', correctLabels],
      ['option-selected-label', selectedLabel === labels.at(-1)],
      ['option-stays-closed', element.open === false],
    ], counts: { sourceCount: descriptor.size, retainedCount: state.options.length,
      checkedLabels: state.options.length,
      renderedRowCount: element.shadowRoot.querySelectorAll('[role="option"]').length } };
  };
  return state;
}

function listState(descriptor) {
  const inputs = makeListInputs();
  const tag = descriptor.id.startsWith('document') ? 'lr-document-library'
    : descriptor.id.startsWith('eval') ? 'lr-eval-dataset'
    : descriptor.id.startsWith('retrieval') ? 'lr-retrieval-results' : 'lr-ingestion-queue';
  const element = create(tag);
  const state = { element, descriptor, variant: 0, selectionEvent: undefined, expectedRetained: undefined };
  const table = () => element.shadowRoot.querySelector('lr-table');
  const list = () => element.shadowRoot.querySelector('lr-virtual-list');
  if (tag === 'lr-document-library') {
    element.documents = inputs.documents;
    element.sortKey = 'name';
    element.sortDir = 'asc';
    element.searchTerm = 'group2';
    state.mutate = () => { state.variant = 1 - state.variant; element.searchTerm = ['group2', 'group7'][state.variant]; };
    state.validate = () => {
      const grid = table();
      const rows = [...grid.shadowRoot.querySelectorAll('tbody tr[data-row-key]')];
      const expected = inputs.documentPages[state.variant];
      return { checks: [
        ['list-retained-count', element.documents.length === descriptor.size && grid.rows.length === 1000],
        ['list-render-bound', rows.length === 100],
        ['list-visible-values', expected.every((document, index) => grid.rowElement(document.id) === rows[index] && rows[index]?.textContent.includes(document.name))],
      ], counts: { sourceCount: descriptor.size, retainedCount: element.documents.length, renderedRowCount: rows.length, viewRowCount: grid.rows.length } };
    };
  } else if (tag === 'lr-eval-dataset') {
    element.examples = inputs.examples;
    element.searchable = false;
    element.addEventListener('lr-example-select', event => { state.selectionEvent = event.detail.exampleId; });
    state.mutate = () => {
      state.variant = 1 - state.variant;
      state.selectionEvent = undefined;
      table().rowElement(inputs.examples[state.variant].id).click();
    };
    state.validate = () => {
      const grid = table();
      const target = inputs.examples[state.variant].id;
      const rows = grid.shadowRoot.querySelectorAll('tbody tr[part="row"]');
      return { checks: [
        ['list-retained-count', element.examples.length === descriptor.size && grid.rows.length === descriptor.size],
        ['list-render-bound', rows.length === 100],
        ['list-selection-event', state.selectionEvent === target],
        ['list-selection-state', grid.selectedRowKeys.has(target) && grid.rowElement(target)?.getAttribute('aria-selected') === 'true'],
      ], counts: { sourceCount: descriptor.size, retainedCount: element.examples.length, renderedRowCount: rows.length, selectedCount: grid.selectedRowKeys.size } };
    };
  } else if (tag === 'lr-retrieval-results') {
    element.sort = 'none';
    element.virtualizeAt = 50;
    element.chunks = inputs.chunks;
    element.addEventListener('lr-selection-change', event => { state.selectionEvent = event.detail; });
    // Toggle the first mounted checkbox; the same public action alternates selected/unselected.
    state.mutate = () => {
      state.variant = 1 - state.variant;
      state.selectionEvent = undefined;
      list().shadowRoot.querySelector('lr-checkbox[data-chunk-id="chunk-00000"]').shadowRoot.querySelector('[part~="base"]').click();
    };
    state.validate = () => {
      const virtual = list();
      const inspectors = virtual.shadowRoot.querySelectorAll('lr-chunk-inspector[data-chunk-id]');
      const checkbox = virtual.shadowRoot.querySelector('lr-checkbox[data-chunk-id="chunk-00000"]');
      const selected = state.variant === 1;
      const ids = element.selectedChunkIds;
      return { checks: [
        ['list-retained-count', virtual.items.length === element.chunks.length && (state.expectedRetained === undefined
          ? element.chunks.length >= descriptor.parameters.retainedMin && element.chunks.length <= descriptor.parameters.retainedMax
          : element.chunks.length === state.expectedRetained)],
        ['list-render-bound', inspectors.length > 0 && inspectors.length <= descriptor.parameters.renderBound],
        ['list-selection-event', state.selectionEvent?.selectedChunkIds.length === Number(selected) && (!selected || state.selectionEvent.selectedChunkIds[0] === 'chunk-00000') && state.selectionEvent.chunks.length === Number(selected) && (!selected || state.selectionEvent.chunks[0].id === 'chunk-00000')],
        ['list-selection-state', ids.length === Number(selected) && (!selected || ids[0] === 'chunk-00000') && checkbox?.checked === selected],
      ], counts: { sourceCount: descriptor.size, retainedCount: element.chunks.length, renderedRowCount: inspectors.length, selectedCount: ids.length } };
    };
  } else {
    element.items = inputs.ticks[0];
    state.mutate = () => { state.variant = 1 - state.variant; element.items = inputs.ticks[state.variant]; };
    state.validate = () => {
      const virtual = list();
      const rows = virtual.shadowRoot.querySelectorAll('[part="item"]');
      const name = virtual.shadowRoot.querySelector('[part="item-name"]');
      const stageLabel = virtual.shadowRoot.querySelector('[part="item-stage"]');
      const progress = virtual.shadowRoot.querySelector('[part="item-progress"]');
      return { checks: [
        ['list-retained-count', element.items.length === descriptor.size && virtual.items.length === descriptor.size],
        ['list-render-bound', rows.length > 0 && rows.length <= descriptor.parameters.renderBound],
        ['list-visible-values', name?.textContent.trim() === 'Document 00000' && stageLabel?.textContent.trim().toLowerCase() === 'embedding'],
        ['list-progress-value', progress?.value === 40 + state.variant],
      ], counts: { sourceCount: descriptor.size, retainedCount: element.items.length, renderedRowCount: rows.length, progressValue: progress?.value ?? 0 } };
    };
  }
  return state;
}

async function setup(descriptor) {
  active = undefined;
  stage.replaceChildren();
  let state;
  if (descriptor.id === 'table-sort-10000' || descriptor.id === 'table-filter-10000') state = tableOperationState(descriptor);
  else if (descriptor.family === 'table') state = tableState(descriptor);
  else if (descriptor.family === 'chart') state = chartState(descriptor);
  else if (descriptor.family === 'option') state = optionState(descriptor);
  else if (descriptor.family === 'list') state = listState(descriptor);
  else {
    const element = create('div');
    element.textContent = 'Scheduling control';
    state = { element, descriptor, mutate() {},
      validate: () => ({ checks: [['control-connected', element.isConnected]], counts: { sourceCount: 0 } }) };
  }
  await bounded(updates(state));
  if (descriptor.family === 'chart') await bounded(peerReady(state.element));
  await bounded(settle(state));
  await bounded(paint());
  active = state;
  return state;
}

async function run(id, options = {}) {
  if (busy) return { status: 'failed', code: 'BUSY' };
  const descriptor = descriptors.get(id);
  if (!descriptor) return { status: 'failed', code: 'UNKNOWN_SCENARIO' };
  if (!Number.isSafeInteger(options.sampleIndex) || options.sampleIndex < 0 || typeof options.warmup !== 'boolean')
    return { status: 'failed', code: 'INVALID_SAMPLE' };
  busy = true;
  let setupComplete = false;
  try {
    const state = active?.descriptor.id === id ? active : await setup(descriptor);
    setupComplete = true;
    state.tableCalls = 0;
    const metrics = await phase(state, state.mutate);
    const formatterTableCalls = state.tableCalls;
    // Validate before the matched control so a late update cannot conceal incomplete settling.
    const outcome = state.validate();
    state.tableCalls = 0;
    const noop = await phase(state, () => {});
    const noopFormatterTableCalls = state.tableCalls;
    for (const [key, value] of Object.entries(noop))
      metrics[`noop${key[0].toUpperCase()}${key.slice(1)}`] = value;
    const assertions = outcome.checks.map(([checkId, passed]) => ({ id: checkId, passed: Boolean(passed) }));
    const passed = assertions.every((check) => check.passed);
    return { status: passed ? 'passed' : 'failed', ...(passed ? {} : { code: 'SEMANTIC_CHECK_FAILED' }),
      metrics, assertions, counts: { ...outcome.counts, formatterTableCalls, noopFormatterTableCalls,
        shadowElementCount: state.element.shadowRoot?.querySelectorAll('*').length ?? 0 } };
  } catch (error) {
    active = undefined;
    stage.replaceChildren();
    return { status: 'failed', code: knownErrors.has(error?.code)
      ? error.code : setupComplete ? 'OPERATION_FAILED' : 'SETUP_FAILED' };
  } finally { busy = false; }
}

async function check(id, { expectedRetained } = {}) {
  if (busy) return { status: 'failed', code: 'BUSY' };
  const descriptor = descriptors.get(id);
  if (!descriptor) return { status: 'failed', code: 'UNKNOWN_SCENARIO' };
  if (expectedRetained !== undefined && (!Number.isSafeInteger(expectedRetained) || expectedRetained < 1 || expectedRetained > descriptor.size || descriptor.id !== 'retrieval-results-select-10000')) return { status: 'failed', code: 'INVALID_SAMPLE' };
  busy = true;
  try {
    const state = await setup(descriptor);
    state.expectedRetained = expectedRetained ?? descriptor.size;
    const outcomes = [];
    for (let index = 0; index < 2; index++) {
      state.mutate();
      await bounded(updates(state));
      await bounded(settle(state));
      await bounded(paint());
      outcomes.push(state.validate());
    }
    return { status: outcomes.every(outcome => outcome.checks.every(([, passed]) => passed)) ? 'passed' : 'failed', expectedRetained: state.expectedRetained ?? descriptor.size, outcomes };
  } finally { busy = false; active = undefined; stage.replaceChildren(); }
}

window.__benchmark = { ready: Promise.resolve(), scenarios: SCENARIOS, run, check };
