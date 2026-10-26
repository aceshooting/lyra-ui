import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { assertViewSemantics, createFixture, createViewDefinition, createViewCatalog, describeViewDefinition, expectedChartRows, fixtureDefinitions, resolveViewNativeTarget, viewNativeEventType, waitForChartGeometry, waitForSelectedCategory } from './views.js';
import { createHostServices } from './views-host.mjs';

const require = createRequire(new URL('../../../../packages/lyra-gen/package.json', import.meta.url));
const loadLibrary = specifier => import(pathToFileURL(require.resolve(specifier)).href);
const byId = document => {
  const nodes = new Map(); const visit = node => { assert.equal(nodes.has(node.id), false); nodes.set(node.id, node); node.children?.forEach(visit); };
  visit(document.root); return nodes;
};

test('view preparation stores verified inert input without mounting, registration or runtime admission', async () => {
  const originalFetch = globalThis.fetch;
  const previousRegistration = globalThis.customElements?.get('lr-gen-view');
  const host = { children: [], childNodes: [], querySelectorAll: () => [] };
  const measurement = { pendingOperations: 0, measureOperation() { throw new Error('Preparation cannot measure or mount.'); } };
  const body = JSON.stringify({ view: createViewDefinition('V'), markup: 'Not yet admitted Markup' });
  globalThis.fetch = async url => { assert.equal(url, '/host/view-inputs/V'); return new Response(body); };
  let fixture;
  try {
    fixture = await createFixture({ workload: 'V', host, measurement, signal: new AbortController().signal,
      services: { viewInputs: { V: { url: '/host/view-inputs/V', sha256: createHash('sha256').update(body).digest('hex') } } } });
    const prepared = await fixture.prepare({ definition: fixtureDefinitions.V, manifest: { workload: 'V', sha256: '0'.repeat(64) } });
    assert.equal(prepared.inputs.json.utf8Bytes, fixtureDefinitions.V.serialized.jsonUtf8Bytes);
    assert.equal(prepared.inputs.markup.utf16Units, 'Not yet admitted Markup'.length);
    assert.equal(host.childNodes.length, 0);
    assert.equal(globalThis.customElements?.get('lr-gen-view'), previousRegistration);
  } finally { globalThis.fetch = originalFetch; await fixture?.dispose(); }
});

test('chart geometry waits past empty readiness for a real nonzero mark, without accepting an expected count', async () => {
  let notify, disconnected = 0, observed = false, settled = false;
  class Observer {
    constructor(callback) { notify = callback; }
    observe() { observed = true; }
    disconnect() { disconnected++; }
  }
  const marks = [];
  const chart = { labels: ['A'], datasets: [{ data: [1] }], shadowRoot: { querySelectorAll: () => marks } };
  const pending = waitForChartGeometry(chart, new AbortController().signal, { Observer }).then(() => { settled = true; });
  await Promise.resolve(); assert.equal(observed, true); assert.equal(settled, false);
  notify(); await Promise.resolve(); assert.equal(settled, false);
  marks.push({ isConnected: true, getBoundingClientRect: () => ({ width: 0, height: 10 }) });
  notify(); await Promise.resolve(); assert.equal(settled, false);
  marks[0].getBoundingClientRect = () => ({ width: 1, height: 10 });
  notify(); await pending;
  assert.equal(settled, true); assert.equal(disconnected, 1);
  // Only the lifecycle barrier succeeds; the unchanged full oracle still rejects dropped marks.
  const rig = oracleRig(); rig.marks.pop(); assert.throws(() => assertViewSemantics(rig.view), /sampled observations/u);
});

test('chart geometry abort cleans observation and empty revoked data needs no observer', async () => {
  let notify, disconnected = 0;
  class Observer { constructor(callback) { notify = callback; } observe() {} disconnect() { disconnected++; } }
  const controller = new AbortController();
  const pending = waitForChartGeometry({ labels: ['A'], datasets: [{ data: [1] }], shadowRoot: { querySelectorAll: () => [] } }, controller.signal, { Observer });
  controller.abort(); await assert.rejects(pending, /aborted/u); notify(); assert.equal(disconnected, 1);
  await waitForChartGeometry({ labels: [], datasets: [] }, new AbortController().signal, { Observer: undefined });
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(waitForChartGeometry({ labels: [], datasets: [] }, alreadyAborted.signal), /aborted/u);
});

test('select-choice activates the select popup row rather than its hidden option declaration', () => {
  const visibleRow = { role: 'option', value: 'option-7' };
  const category = { shadowRoot: { querySelector: selector => selector === '[part="option"][data-value="option-7"]' ? visibleRow : null } };
  const hiddenOption = { shadowRoot: { querySelector: () => { throw new Error('Hidden option declarations cannot receive native selection.'); } } };
  const view = { shadowRoot: { querySelector: selector => selector === '[data-gen-id="category"]' ? category : hiddenOption } };
  assert.equal(resolveViewNativeTarget(view, 'select-choice'), visibleRow);
  const action = fixtureDefinitions.V.operations.find(operation => operation.id === 'select-choice').native;
  const [owner, ...descendant] = action.selector.split(' ');
  assert.equal(view.shadowRoot.querySelector(owner).shadowRoot.querySelector(descendant.join(' ')), visibleRow,
    'The Playwright descriptor and the measurement listener must select the same visible popup row.');
  assert.throws(() => hiddenOption.shadowRoot.querySelector('[part="base"]'), /Hidden option declarations/u);
});

test('maximum chart selection declares native Enter on the exact original datum rather than pointer activation', () => {
  const operation = fixtureDefinitions.X.operations.find(operation => operation.id === 'chart-select');
  assert.deepEqual(operation.native, { action: 'press', selector: '[data-gen-id="chart"] [part="bar"][data-dataset-index="0"][data-index="1"]', value: 'Enter' });
  const bar = { index: 1, series: 0 };
  const chart = { shadowRoot: { querySelector: selector => selector === '[part="bar"][data-dataset-index="0"][data-index="1"]' ? bar : null } };
  const view = { shadowRoot: { querySelector: selector => selector === '[data-gen-id="chart"]' ? chart : null } };
  assert.equal(resolveViewNativeTarget(view, operation.id), bar);
  assert.equal(viewNativeEventType(operation.id), 'keydown', 'The timestamp listener follows the actual keyboard activation.');
  assert.equal(viewNativeEventType('input'), 'input');
  assert.equal(viewNativeEventType('select-choice'), 'click');
  assert.deepEqual(JSON.parse(operation.expectedFingerprint).selected, [1]);
});

test('selection completion requires the matching admitted bound change, not the earlier row click', async () => {
  const view = new EventTarget(); view.document = { surfaceId: 'selection', revision: 2 };
  const detail = { surfaceId: 'selection', revision: 2, nodeId: 'category', values: { category: 'option-7' }, dirty: ['/category'] };
  const change = patch => view.dispatchEvent(new CustomEvent('lr-gen-state-change', { detail: { ...detail, ...patch } }));
  let settled = false;
  const pending = waitForSelectedCategory(view, 'option-7', new AbortController().signal).then(() => { settled = true; });
  view.dispatchEvent(new Event('click'));
  for (const patch of [{ surfaceId: 'other' }, { revision: 1 }, { nodeId: 'note' }, { values: { category: 'option-0' } }, { dirty: [] }]) change(patch);
  await Promise.resolve(); assert.equal(settled, false);
  change({}); await pending; assert.equal(settled, true);
});

test('selection waiting rejects cancellation and cannot admit a stale document callback', async () => {
  let removals = 0;
  class View extends EventTarget { removeEventListener(...args) { removals++; super.removeEventListener(...args); } }
  const view = new View(); view.document = { surfaceId: 'selection', revision: 2 };
  const controller = new AbortController();
  let settled = false;
  const pending = waitForSelectedCategory(view, 'option-7', controller.signal).then(() => { settled = true; });
  view.document = { surfaceId: 'selection', revision: 3 };
  view.dispatchEvent(new CustomEvent('lr-gen-state-change', { detail: { surfaceId: 'selection', revision: 2, nodeId: 'category', values: { category: 'option-7' }, dirty: ['/category'] } }));
  await Promise.resolve(); assert.equal(settled, false);
  controller.abort(); await assert.rejects(pending, /aborted/u); assert.equal(removals, 1);
});

test('V and X retain their exact independent form, scalar table and chart populations', () => {
  for (const [workload, rows, columns, series, categories] of [['V', 100, 8, 4, 100], ['X', 200, 16, 8, 200]]) {
    const document = createViewDefinition(workload), nodes = byId(document);
    assert.equal(nodes.size, 20); assert.equal(nodes.get('form').children.length, 7);
    assert.deepEqual(nodes.get('form').children.map(node => node.type), ['input', 'textarea', 'select', 'checkbox', 'switch', 'slider', 'button']);
    assert.equal(nodes.get('category').children.length, 8);
    const table = nodes.get('table').props;
    assert.equal(table.rows.length, rows); assert.equal(table.columns.length, columns); assert.equal(table.pageSize, 100); assert.equal(table.maxRows, rows);
    assert.deepEqual(table.rows[1], Object.fromEntries(Array.from({ length: columns }, (_, column) => [`c${column}`, column % 4 === 0 ? 'Record 1' : column % 4 === 1 ? 100 + column : column % 4 === 2 ? false : null])));
    const chart = nodes.get('chart').props;
    assert.equal(chart.datasets.length, series); assert.equal(chart.labels.length, categories); assert.equal(Object.hasOwn(chart, 'maxRecords'), false);
    for (let index = 0; index < series; index++) {
      assert.equal(chart.datasets[index].data.length, categories);
      assert.equal(chart.datasets[index].data.filter(value => value === null).length, categories / 10);
      assert.equal(chart.datasets[index].data[1], (index + 1) * 1000 + 1);
    }
    assert.equal(chart.withDataTable, true);
    assert.equal(describeViewDefinition(workload).retainedChartValues, series * categories);
  }
});

test('patches change one row and one point without sharing mutable fixture state', () => {
  const original = createViewDefinition('X'), patched = createViewDefinition('X', { patched: true, revision: 1, surfaceId: 'separate-surface' });
  const before = byId(original), after = byId(patched);
  assert.equal(patched.surfaceId, 'separate-surface'); assert.equal(patched.revision, 1);
  let changedCells = 0, changedPoints = 0;
  before.get('table').props.rows.forEach((row, index) => Object.keys(row).forEach(key => { if (row[key] !== after.get('table').props.rows[index][key]) changedCells++; }));
  before.get('chart').props.datasets.forEach((series, index) => series.data.forEach((value, point) => { if (value !== after.get('chart').props.datasets[index].data[point]) changedPoints++; }));
  assert.equal(changedCells, 1); assert.equal(changedPoints, 1);
  after.get('category').children.pop(); assert.equal(before.get('category').children.length, 8);
});

test('X declares its bounded sample independently of all 1600 retained values', () => {
  for (const patched of [false, true]) {
    const rows = expectedChartRows('X', patched);
    assert.equal(rows.length, 125); assert.equal(new Set(rows).size, 125);
    assert.equal(rows[0], 0); assert.equal(rows.at(-1), 199);
    for (const row of [10, 40, 80, 120, 160, 198]) assert.ok(rows.includes(row));
    assert.equal(rows.filter(row => row % 10 === 0).length, 14);
    assert.deepEqual(rows, [...rows].sort((a, b) => a - b));
  }
  assert.deepEqual(expectedChartRows('V'), Array.from({ length: 100 }, (_, index) => index));
  assert.equal(fixtureDefinitions.X.serialized.renderedChartRows, 125);
  assert.equal(fixtureDefinitions.X.serialized.renderedChartCellCap, 1000);
});

test('R contains exactly all thirteen static roles, one full first page and no chart or slider', () => {
  const document = createViewDefinition('R'), nodes = byId(document);
  assert.deepEqual([...new Set([...nodes.values()].map(node => node.type))].sort(), ['button', 'checkbox', 'form', 'heading', 'input', 'option', 'row', 'select', 'stack', 'switch', 'table', 'text', 'textarea']);
  assert.equal(nodes.size, 20); assert.equal(nodes.get('form').children.length, 6);
  assert.equal(nodes.get('table').props.rows.length, 100); assert.equal(nodes.get('literal').text, '</template><script>untrusted()</script> & report');
});

test('built public JSON and emitted Markup admit identical full trees before timing', async () => {
  const catalog = createViewCatalog(await loadLibrary('@aceshooting/lyra-gen/catalog.js'));
  const { validateView } = await loadLibrary('@aceshooting/lyra-gen/runtime.js');
  const { emitMarkup } = await loadLibrary('@aceshooting/lyra-gen/authoring.js');
  const { parseMarkup } = await loadLibrary('@aceshooting/lyra-gen/parser.js');
  for (const workload of ['V', 'X', 'R']) {
    const document = createViewDefinition(workload);
    const admitted = validateView(document, catalog); assert.equal(admitted.ok, true, JSON.stringify(admitted.diagnostics));
    const emitted = emitMarkup(document, catalog); assert.equal(emitted.ok, true, JSON.stringify(emitted.diagnostics));
    const parsed = parseMarkup(emitted.value, { catalog: document.catalog, surfaceId: document.surfaceId, revision: 0, allowedTags: Object.keys(catalog.components) });
    assert.equal(parsed.status, 'complete'); assert.deepEqual(JSON.parse(JSON.stringify(parsed.view)), document);
    const json = JSON.stringify(document); assert.equal(fixtureDefinitions[workload].serialized.jsonUtf8Bytes, Buffer.byteLength(json));
    assert.equal(fixtureDefinitions[workload].serialized.jsonUtf16Units, json.length);
    assert.ok(Object.isFrozen(fixtureDefinitions[workload].operations[0]));
  }
});

test('R host uses actual built static SSR and preserves escaped data plus dirty ownership', async () => {
  const service = await createHostServices({ loadLibrary });
  try {
    assert.deepEqual(service.routes.map(route => [route.path, route.methods]), ['/host/ssr/R', '/host/view-inputs/V', '/host/view-inputs/X', '/host/view-inputs/R'].map(path => [path, ['GET']]));
    for (const workload of ['V', 'X', 'R']) {
      const route = service.routes.find(route => route.path === `/host/view-inputs/${workload}`);
      const response = await route.handle();
      const input = JSON.parse(response.body);
      assert.equal(response.contentType, 'application/json');
      assert.deepEqual(input.view, createViewDefinition(workload));
      assert.ok(Buffer.byteLength(response.body) <= 262144);
      assert.equal(service.services.viewInputs[workload].sha256, createHash('sha256').update(response.body).digest('hex'));
      const { parseMarkup } = await loadLibrary('@aceshooting/lyra-gen/parser.js');
      const parsed = parseMarkup(input.markup, { catalog: input.view.catalog, surfaceId: input.view.surfaceId, revision: 0,
        allowedTags: [...new Set([...byId(input.view).values()].map(node => node.type))] });
      assert.equal(parsed.status, 'complete'); assert.deepEqual(JSON.parse(JSON.stringify(parsed.view)), input.view);
    }
    const first = await service.routes[0].handle(), second = await service.routes[0].handle();
    assert.equal(first.body, second.body); assert.equal(first.contentType, 'text/html');
    assert.ok(first.body.includes('data-lyra-gen-snapshot="lyra-gen-static-v1"'));
    assert.ok(first.body.includes('Saved user edit')); assert.equal(first.body.includes('<script>untrusted()'), false);
    const match = /data-lyra-gen-state="([^"]+)"/u.exec(first.body); assert.ok(match);
    const decoded = match[1].replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
    const envelope = JSON.parse(decoded);
    assert.deepEqual(envelope.snapshot.state.dirty, ['/note']); assert.equal(envelope.snapshot.state.values.note, 'Saved user edit');
    assert.equal(envelope.snapshot.state.owners['/note'].nodeId, 'note');
    assert.equal((first.body.match(/<td>/gu) ?? []).length, 800);
    assert.equal((first.body.match(/<option /gu) ?? []).length, 8);
  } finally { await service.dispose(); }
  await assert.rejects(service.routes[0].handle(), /disposed/u);
});

function oracleRig() {
  const document = createViewDefinition('V'), nodes = byId(document), elements = new Map();
  for (const [id, node] of nodes) elements.set(id, { ...node.props, textContent: node.text, getAttribute: name => name === 'aria-label' ? node.props?.ariaLabel : null });
  elements.get('category').querySelectorAll = () => Array.from({ length: 8 });
  const rows = nodes.get('table').props.rows.map(row => ({ cells: Object.values(row).map(value => ({ textContent: value === null ? '' : String(value) })), querySelectorAll() { return this.cells; } }));
  Object.assign(elements.get('table'), { page: 1, shadowRoot: { querySelectorAll: () => rows } });
  const chart = elements.get('chart'), marks = [], chartRows = [];
  for (let index = 0; index < 100; index++) {
    const cells = Array.from({ length: 4 }, (_, series) => ({ textContent: index % 10 === 0 ? '' : new Intl.NumberFormat('en-US').format((series + 1) * 1000 + index) }));
    chartRows.push({ cells, querySelector: () => ({ textContent: `Category ${index}` }), querySelectorAll: () => cells });
    if (index % 10 !== 0) for (let series = 0; series < 4; series++) marks.push({ getAttribute: name => ({ 'data-index': String(index), 'data-dataset-index': String(series), 'aria-pressed': 'false' })[name], getBoundingClientRect: () => ({ width: 1, height: 10 }) });
  }
  chart.shadowRoot = { querySelectorAll: selector => selector === '[part="bar"]' ? marks : chartRows, querySelector: () => ({ getBoundingClientRect: () => ({ width: 1000 }) }) };
  const view = { document, status: 'ready', shadowRoot: { querySelectorAll: () => [...elements.values()], querySelector: selector => elements.get(/data-gen-id="([^"]+)"/u.exec(selector)?.[1]) } };
  return { view, elements, rows, marks, chartRows };
}

test('the shared semantic oracle rejects missing DOM, dropped data, changed null gaps and duplicated marks', () => {
  assert.equal(assertViewSemantics(oracleRig().view).rows, 100);
  for (const mutate of [
    rig => { rig.view.document.revision = 1; },
    rig => { rig.elements.get('table').rows[77].c1 = 0; },
    rig => { rig.rows.pop(); },
    rig => { rig.rows[0].cells[1].textContent = 'Wrong cell'; },
    rig => { rig.elements.get('chart').datasets[2].data[10] = 123; },
    rig => { rig.chartRows.pop(); },
    rig => { rig.chartRows[1].cells[1].textContent = 'Wrong point'; },
    rig => { rig.marks[1] = rig.marks[0]; },
    rig => { rig.elements.get('category').querySelectorAll = () => []; },
  ]) {
    const rig = oracleRig(); mutate(rig); assert.throws(() => assertViewSemantics(rig.view));
  }
});
