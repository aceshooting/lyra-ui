import { settle, visible } from './text.js';

const require = (condition, message) => { if (!condition) throw new Error(message); };
const encode = value => JSON.stringify(value);
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const sizes = { V: { rows: 100, columns: 8, series: 4, categories: 100, controls: 7, options: 8, pageSize: 100 },
  X: { rows: 200, columns: 16, series: 8, categories: 200, controls: 7, options: 8, pageSize: 100 },
  R: { rows: 100, columns: 8, series: 0, categories: 0, controls: 6, options: 8, pageSize: 100, roles: 13 } };
export const viewActionDefinitions = freeze({ save: { payload: { type: 'object', properties: {
  note: { type: 'string' }, details: { type: 'string' }, category: { type: 'string' }, agreed: { type: 'boolean' }, notify: { type: 'boolean' }, level: { type: 'number' },
}, required: ['note', 'details', 'category', 'agreed', 'notify'], additionalProperties: false } } });
export const createViewCatalog = ({ createCatalog, initialCatalog }) => createCatalog({ ...initialCatalog, actions: viewActionDefinitions });

/** Data only: importing this module never registers components or mounts a fixture. */
export function createViewDefinition(workload, { revision = 0, patched = false, surfaceId = `profile-${workload}`, noteDefault = 'Model default' } = {}) {
  const size = sizes[workload]; require(size, 'Unknown view workload.');
  const field = (id, type, props, property = 'value') => ({ id, type, props, bindings: { [property]: `/${id}` } });
  const controls = [
    field('note', 'input', { name: 'note', label: 'Review note', hint: 'Describe the report.', required: true, value: noteDefault }),
    field('details', 'textarea', { name: 'details', label: 'Details', value: 'Report details', rows: 2 }),
    { ...field('category', 'select', { name: 'category', label: 'Category', value: 'option-0', required: true }), children: Array.from({ length: 8 }, (_, index) => ({ id: `option-${index}`, type: 'option', props: { value: `option-${index}` }, text: `Category ${index}` })) },
    { ...field('agreed', 'checkbox', { name: 'agreed', checked: true }, 'checked'), text: 'Reviewed' },
    { ...field('notify', 'switch', { name: 'notify', checked: true }, 'checked'), text: 'Notify reviewer' },
    ...(workload === 'R' ? [] : [field('level', 'slider', { label: 'Confidence', min: 0, max: 100, step: 1, value: 50 })]),
    { id: 'submit', type: 'button', props: { type: 'submit' }, text: 'Save review' },
  ];
  const columns = Array.from({ length: size.columns }, (_, index) => ({ key: `c${index}`, label: `Column ${index}` }));
  const rows = Array.from({ length: size.rows }, (_, row) => Object.fromEntries(columns.map((column, index) => [column.key,
    [`Record ${row}`, row * 100 + index, row % 2 === 0, null][index % 4],
  ])));
  if (patched) rows[0].c0 = 'Updated record';
  const chart = { id: 'chart', type: 'chart', props: { label: 'Report observations', type: 'bar',
    labels: Array.from({ length: size.categories }, (_, index) => `Category ${index}`),
    datasets: Array.from({ length: size.series }, (_, series) => ({ label: `Series ${series}`, data: Array.from({ length: size.categories }, (_, index) => index % 10 === 0 ? null : (series + 1) * 1000 + index) })),
    withLegend: true, withDataTable: true, dataTableToggle: false } };
  if (patched && size.series) chart.props.datasets[0].data[1] = 9001;
  return { version: '1', surfaceId, revision, catalog: { id: 'lyra-reviewed', version: '1' }, root: { id: 'root', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: `Report revision ${revision}` },
    ...(workload === 'R' ? [{ id: 'context', type: 'row', children: [{ id: 'literal', type: 'text', text: '</template><script>untrusted()</script> & report' }] }] : []),
    { id: 'form', type: 'form', props: { ariaLabel: 'Review report' }, action: { name: 'save' }, children: controls },
    { id: 'table', type: 'table', props: { caption: 'Report records', columns, rows, pageSize: 100, maxRows: size.rows } },
    ...(workload === 'R' ? [] : [chart]),
  ] } };
}

const node = (view, id) => view.shadowRoot?.querySelector(`[data-gen-id="${id}"]`);
export function resolveViewNativeTarget(view, operation) {
  return operation === 'input' ? node(view, 'note').shadowRoot.querySelector('input')
    : operation === 'select-open' ? node(view, 'category').shadowRoot.querySelector('[part="trigger"]')
    : operation === 'select-choice' ? node(view, 'category').shadowRoot.querySelector('[part="option"][data-value="option-7"]')
    : operation === 'table-next' ? node(view, 'table').shadowRoot.querySelector('lr-pagination').shadowRoot.querySelector('[part~="next-button"]')
    : operation === 'chart-select' ? node(view, 'chart').shadowRoot.querySelector('[part="bar"][data-dataset-index="0"][data-index="1"]')
    : node(view, 'submit').shadowRoot.querySelector('button');
}
export const viewNativeEventType = operation => operation === 'input' ? 'input' : operation === 'chart-select' ? 'keydown' : 'click';
const scalarText = value => value === null ? '' : String(value);
/** Fixed-data expectation: five bucket extrema/gaps, then uniform fill, without importing the renderer sampler. */
export function expectedChartRows(workload, patched = false) {
  if (workload !== 'X') return Array.from({ length: sizes[workload].categories }, (_, index) => index);
  const indexes = new Set([0, 199, 1, 10, 39, 40, 41, 79, 80, 81, 118, 119, 120, 158, 159, 160, 198, ...(patched ? [2] : [])]);
  for (let index = 0; index < 125 && indexes.size < 125; index++) indexes.add(Math.round(index * 199 / 124));
  return [...indexes].sort((a, b) => a - b);
}
/** Fit charts render coordinate marks after their first observed allocation, beyond Lit readiness. */
export function waitForChartGeometry(chart, signal, { Observer = globalThis.MutationObserver } = {}) {
  require(signal && typeof signal.addEventListener === 'function', 'Chart geometry needs a bounded operation signal.');
  return new Promise((resolve, reject) => {
    let observer, finished = false;
    const finish = error => {
      if (finished) return;
      finished = true; observer?.disconnect(); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new Error('Chart geometry wait aborted.'));
    const inspect = () => {
      if (finished) return;
      const marks = chart.shadowRoot?.querySelectorAll('[part="bar"], [part="point"]') ?? [];
      if ([...marks].some(mark => { const bounds = mark.getBoundingClientRect(); return mark.isConnected && bounds.width > 0 && bounds.height > 0; })) finish();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    // An explicitly empty/revoked data set has no coordinate marks to wait for.
    if (!chart.labels?.length || !chart.datasets?.some(series => series.data.some(value => typeof value === 'number' && Number.isFinite(value)))) { finish(); return; }
    try {
      require(chart.shadowRoot && typeof Observer === 'function', 'Chart render observation is unavailable.');
      observer = new Observer(inspect);
      observer.observe(chart.shadowRoot, { childList: true, subtree: true, attributes: true });
      inspect();
    } catch (error) { finish(error); }
  });
}
/** Pre-arm the admitted bound selection, rather than completing on the popup row's earlier click. */
export function waitForSelectedCategory(view, value, signal) {
  const document = view.document;
  return new Promise((resolve, reject) => {
    const clear = () => { view.removeEventListener('lr-gen-state-change', changed); signal.removeEventListener('abort', abort); };
    const abort = () => { clear(); reject(new Error('Category selection aborted.')); };
    const changed = event => {
      const detail = event.detail;
      if (event.target !== view || view.document !== document || detail.surfaceId !== document.surfaceId || detail.revision !== document.revision
        || detail.nodeId !== 'category' || detail.values?.category !== value || !detail.dirty?.includes('/category')) return;
      clear(); resolve();
    };
    view.addEventListener('lr-gen-state-change', changed); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
/** Independent full-data and rendered-page oracle, shared by compositions using this schema. */
export function assertViewSemantics(view, { workload = 'V', revision = 0, surfaceId, note = 'Model default', category = 'option-0', page = 1, patched = false, selected = [] } = {}) {
  const size = sizes[workload]; require(size && view?.status === 'ready', 'Expected a ready view.');
  require(view.document?.revision === revision && (!surfaceId || view.document.surfaceId === surfaceId), 'Wrong view identity.');
  require(view.shadowRoot.querySelectorAll('[data-gen-id]').length === 20, 'Generated nodes were dropped or duplicated.');
  require(node(view, 'heading')?.textContent === `Report revision ${revision}`, 'Revision marker has not rendered.');
  require(node(view, 'form')?.getAttribute('aria-label') === 'Review report', 'Form accessible name changed.');
  for (const [id, value] of [['note', note], ['details', 'Report details'], ['category', category]]) require(node(view, id)?.value === value, `Wrong ${id} value.`);
  require(node(view, 'agreed')?.checked === true && node(view, 'notify')?.checked === true, 'Boolean field values changed.');
  require(workload === 'R' || node(view, 'level')?.value === 50, 'Slider value changed.');
  require(node(view, 'category')?.querySelectorAll('lr-option').length === 8, 'Select options were lost.');
  const table = node(view, 'table');
  require(table?.rows.length === size.rows && table.columns.length === size.columns && table.pageSize === 100 && table.page === page, 'Table bounds/page changed.');
  for (let row = 0; row < size.rows; row++) for (let column = 0; column < size.columns; column++) {
    let expected;
    switch (column % 4) { case 0: expected = patched && row === 0 && column === 0 ? 'Updated record' : `Record ${row}`; break;
      case 1: expected = row * 100 + column; break; case 2: expected = row % 2 === 0; break; default: expected = null; }
    require(table.rows[row][`c${column}`] === expected, 'Retained scalar table data changed.');
  }
  const rendered = [...table.shadowRoot.querySelectorAll('tbody tr')];
  require(rendered.length === 100, 'Expected the complete one-hundred-row page.');
  for (let index = 0; index < 100; index++) {
    const cells = [...rendered[index].querySelectorAll('td')];
    require(cells.length === size.columns, 'Table cells were dropped.');
    cells.forEach((cell, column) => require(cell.textContent.trim() === scalarText(table.rows[(page - 1) * 100 + index][`c${column}`]), 'Rendered table scalar differs from retained data.'));
  }
  if (size.series) {
    const chart = node(view, 'chart');
    require(chart?.labels.length === size.categories && chart.datasets.length === size.series && chart.withDataTable === true, 'Chart shape changed.');
    for (let index = 0; index < size.categories; index++) require(chart.labels[index] === `Category ${index}`, 'Chart labels changed.');
    for (let series = 0; series < size.series; series++) {
      require(chart.datasets[series].data.length === size.categories && chart.datasets[series].label === `Series ${series}`, 'Chart series changed.');
      for (let index = 0; index < size.categories; index++) require(chart.datasets[series].data[index] === (index % 10 === 0 ? null : patched && series === 0 && index === 1 ? 9001 : (series + 1) * 1000 + index), 'Chart point/gap changed.');
    }
    const indexes = expectedChartRows(workload, patched);
    require(chart.shadowRoot.querySelector('svg')?.getBoundingClientRect().width >= indexes.length, 'Chart plot is below the declared complete/sample width.');
    const marks = [...chart.shadowRoot.querySelectorAll('[part="bar"]')];
    const observed = new Set();
    require(marks.length === size.series * indexes.filter(index => index % 10 !== 0).length, 'Chart sampled observations changed.');
    for (const mark of marks) {
      const index = Number(mark.getAttribute('data-index')), series = Number(mark.getAttribute('data-dataset-index'));
      require(indexes.includes(index) && index % 10 !== 0 && series >= 0 && series < size.series, 'Unexpected sampled chart mark.');
      observed.add(`${series}:${index}`);
      require(mark.getAttribute('aria-pressed') === String(selected.includes(index)), 'Chart selection does not match its result.');
      const bounds = mark.getBoundingClientRect(); require(bounds.width > 0 && bounds.height > 0, 'Chart mark has no rendered geometry.');
    }
    require(observed.size === marks.length, 'Chart sampled marks were duplicated.');
    const alternative = [...chart.shadowRoot.querySelectorAll('[part="data-table"] tbody tr')];
    require(alternative.length === indexes.length, 'Chart accessible sample is incomplete.');
    alternative.forEach((row, position) => {
      const index = indexes[position]; require(row.querySelector('th')?.textContent.trim() === `Category ${index}`, 'Accessible chart sample indexes changed.');
      const cells = [...row.querySelectorAll('td')]; require(cells.length === size.series, 'Accessible chart series were dropped.');
      cells.forEach((cell, series) => require(cell.textContent.trim() === (index % 10 === 0 ? '' : new Intl.NumberFormat('en-US').format(patched && series === 0 && index === 1 ? 9001 : (series + 1) * 1000 + index)), 'Accessible chart values or null gaps changed.'));
    });
  }
  return { rows: size.rows, columns: size.columns, series: size.series, categories: size.categories, visibleRows: 100, revision, note, category, page, selected };
}

const projection = (workload, phase, overrides = {}) => ({ workload, phase, rows: sizes[workload].rows, columns: sizes[workload].columns,
  series: sizes[workload].series, categories: sizes[workload].categories, revision: 0, note: workload === 'R' ? 'Saved user edit' : 'Model default', category: 'option-0', page: 1, selected: [], actions: 0, ...overrides });
const operation = (workload, id, kind, trigger, overrides, native) => ({ id, kind, trigger, expectedFingerprint: encode(projection(workload, id, overrides)), ...(native ? { native } : {}) });
export function describeViewDefinition(workload) {
  const document = createViewDefinition(workload), json = encode(document);
  let jsonValues = 0, generatedNodes = 0;
  const count = value => { jsonValues++; if (value && typeof value === 'object') Object.values(value).forEach(count); }; count(document);
  const countNodes = node => { generatedNodes++; node.children?.forEach(countNodes); }; countNodes(document.root);
  return { jsonUtf8Bytes: new TextEncoder().encode(json).length, jsonUtf16Units: json.length, jsonValues, generatedNodes,
    sourceIds: [document.surfaceId], chunkOffsets: [], retainedChartValues: sizes[workload].series * sizes[workload].categories,
    renderedChartRows: expectedChartRows(workload).length, renderedChartCellCap: workload === 'R' ? 0 : 1000 };
}
export const fixtureDefinitions = freeze(Object.fromEntries(['V', 'X', 'R'].map(workload => {
  const ops = workload === 'R' ? [
    operation(workload, 'native-mount', 'ready', 'host'), operation(workload, 'restore', 'ready', 'host'), operation(workload, 'dirty-patch', 'interaction', 'host', { revision: 1 }),
    operation(workload, 'denied-submit', 'interaction', 'event', { revision: 1 }, { action: 'click', selector: '[data-gen-id="submit"] button' }),
    operation(workload, 'enable-action', 'interaction', 'host', { revision: 1 }),
    operation(workload, 'submit', 'interaction', 'event', { revision: 1, actions: 1 }, { action: 'click', selector: '[data-gen-id="submit"] button' }),
    operation(workload, 'failed-restore', 'interaction', 'host', { actions: 1 }), operation(workload, 'cancel-restore', 'interaction', 'host', { actions: 1 }),
  ] : workload === 'V' ? [
    operation(workload, 'mount', 'ready', 'host'), operation(workload, 'markup-admission', 'interaction', 'host'),
    operation(workload, 'input', 'interaction', 'event', { note: 'Edited review' }, { action: 'fill', selector: '[data-gen-id="note"] input', value: 'Edited review' }),
    operation(workload, 'select-open', 'interaction', 'event', { note: 'Edited review' }, { action: 'click', selector: '[data-gen-id="category"] [part="trigger"]' }),
    operation(workload, 'select-choice', 'interaction', 'event', { note: 'Edited review', category: 'option-7' }, { action: 'click', selector: '[data-gen-id="category"] [part="option"][data-value="option-7"]' }),
    operation(workload, 'submit', 'interaction', 'event', { note: 'Edited review', category: 'option-7', actions: 1 }, { action: 'click', selector: '[data-gen-id="submit"] button' }),
    operation(workload, 'sibling-patch', 'interaction', 'host', { revision: 1, note: 'Edited review', category: 'option-7', actions: 1 }),
  ] : [operation(workload, 'mount', 'ready', 'host'), operation(workload, 'data-patch', 'interaction', 'host', { revision: 1 }),
    operation(workload, 'table-next', 'interaction', 'event', { revision: 1, page: 2 }, { action: 'click', selector: '[data-gen-id="table"] [part~="next-button"]' }),
    operation(workload, 'chart-select', 'interaction', 'event', { revision: 1, page: 2, selected: [1] }, { action: 'press', selector: '[data-gen-id="chart"] [part="bar"][data-dataset-index="0"][data-index="1"]', value: 'Enter' }),
  ];
  return [workload, { workload, sizes: sizes[workload], serialized: describeViewDefinition(workload), oracleIds: ['full-retained-data', 'rendered-page-and-series', 'bound-form-values', 'current-revision-and-actions'], operations: ops }];
})));

function assertNativeSnapshot(section) {
  require(section?.isConnected && section.dataset.lyraGenSnapshot === 'lyra-gen-static-v1', 'Native server snapshot is missing.');
  require(section.querySelectorAll('[data-gen-id]').length === 20 && section.querySelectorAll('tbody tr').length === 100, 'Server roles or rows were lost.');
  require(section.querySelector('[data-gen-id="note"] input')?.value === 'Saved user edit', 'Server dirty note changed.');
  require(section.querySelector('[data-gen-id="literal"]')?.textContent === '</template><script>untrusted()</script> & report' && !section.querySelector('script'), 'Server text was not escaped.');
  require([...section.querySelectorAll('input,select,button')].every(control => control.disabled), 'Server controls became active.');
  require(section.querySelectorAll('select option').length === 8, 'Server select options changed.');
  const cells = [...section.querySelectorAll('tbody td')]; require(cells.length === 800, 'Server cells were dropped.');
  cells.forEach((cell, index) => {
    const row = Math.floor(index / 8), column = index % 8;
    const expected = column % 4 === 0 ? `Record ${row}` : column % 4 === 1 ? String(row * 100 + column) : column % 4 === 2 ? String(row % 2 === 0) : '';
    require(cell.textContent === expected, 'Server scalar table content changed.');
  });
}
async function assignReady(view, document, signal) {
  await new Promise((resolve, reject) => {
    const clear = () => { view.removeEventListener('lr-gen-ready', ready); signal?.removeEventListener('abort', abort); };
    const abort = () => { clear(); reject(new Error('View operation aborted.')); };
    const ready = event => {
      if (event.target !== view || event.detail.surfaceId !== document.surfaceId || event.detail.revision !== document.revision) return;
      clear(); resolve();
    };
    view.addEventListener('lr-gen-ready', ready); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else view.document = document;
  });
  await settle(view);
}

export async function createFixture({ workload, host, measurement, signal, services = {} }) {
  require(sizes[workload], 'Unknown view fixture.');
  let catalog, runtime, parseMarkup, restoreGenSnapshotElement, LyraGenViewElement;
  let generation, document, json, markup, nativeSection, nativeTemplate, view, echo, current, committed, activeController, pendingRun, disposed = false, operationEpoch = 0;
  const initialize = async activeSignal => {
    require(!disposed && !activeSignal.aborted, 'View initialization was aborted.');
    if (catalog) return;
    const [catalogLibrary, runtimeLibrary, routeLibrary, rendererLibrary] = await Promise.all([
      import('@aceshooting/lyra-gen/catalog.js'), import('@aceshooting/lyra-gen/runtime.js'),
      workload === 'R' ? import('@aceshooting/lyra-gen/ssr.js') : import('@aceshooting/lyra-gen/parser.js'),
      workload === 'R' ? Promise.resolve({}) : import('@aceshooting/lyra-gen/gen-view.js'),
    ]);
    require(!disposed && !activeSignal.aborted, 'View initialization was aborted.');
    catalog = createViewCatalog(catalogLibrary); runtime = runtimeLibrary;
    parseMarkup = routeLibrary.parseMarkup; restoreGenSnapshotElement = routeLibrary.restoreGenSnapshotElement;
    LyraGenViewElement = rendererLibrary.LyraGenViewElement;
  };
  let actions = [], lastValues, selection = [], release = () => {}, unwatch = () => {};
  const updateEcho = () => { if (echo) echo.textContent = `Note: ${lastValues?.note ?? (workload === 'R' ? 'Saved user edit' : 'Model default')}; category: ${lastValues?.category ?? 'option-0'}; saved: ${actions.length}; selected: ${selection.join(',')}; result: ${current.id}`; };
  const watch = element => {
    const changed = event => { lastValues = event.detail.values; updateEcho(); };
    const action = event => { actions.push(event.detail); updateEcho(); };
    const selected = event => {
      require(event.detail.datasetIndex === 0 && event.detail.index === 1, 'Wrong chart point activated.');
      selection = [1]; node(view, 'chart').selectedIndices = selection; updateEcho();
    };
    for (const [type, listener] of [['lr-gen-state-change', changed], ['lr-gen-action', action], ['lr-point-activate', selected]]) element.addEventListener(type, listener);
    unwatch = () => { for (const [type, listener] of [['lr-gen-state-change', changed], ['lr-gen-action', action], ['lr-point-activate', selected]]) element.removeEventListener(type, listener); };
  };
  const readOracle = ({ operation = current, generation: requested = generation } = {}) => {
    const base = { generation, status: 'pending', fingerprint: '', connected: host.isConnected && Boolean((view ?? nativeSection)?.isConnected), visible: visible(view ?? nativeSection) && visible(echo) };
    if (disposed || requested !== generation || !operation || committed !== operation.id) return base;
    try {
      const expected = JSON.parse(operation.expectedFingerprint);
      if (workload === 'R' && ['native-mount', 'cancel-restore', 'failed-restore'].includes(operation.id)) assertNativeSnapshot(nativeSection);
      else {
        assertViewSemantics(view, { workload, ...expected, patched: workload === 'X' && expected.revision > 0, selected: selection });
        require(operation.id !== 'select-open' || node(view, 'category').shadowRoot.querySelector('[part="trigger"]').getAttribute('aria-expanded') === 'true', 'Select did not open.');
      }
      require(actions.length === expected.actions && encode(selection) === encode(expected.selected), 'Wrong action or selection count.');
      require(echo.textContent === `Note: ${expected.note}; category: ${expected.category}; saved: ${expected.actions}; selected: ${expected.selected.join(',')}; result: ${operation.id}`, 'Visible host result has not changed.');
      for (const action of actions) require(action.name === 'save' && action.surfaceId === document.surfaceId && action.nodeId === 'form' && action.revision === (workload === 'R' ? 1 : 0)
        && canonical(action.payload) === canonical({ note: expected.note, details: 'Report details', category: expected.category, agreed: true, notify: true, ...(workload === 'R' ? {} : { level: 50 }) }), 'Admitted action payload changed.');
      return { ...base, status: 'committed', fingerprint: encode(projection(workload, operation.id, { revision: expected.revision, note: expected.note, category: expected.category, page: expected.page, selected: selection, actions: actions.length })) };
    } catch (error) { return { ...base, reason: error.message }; }
  };
  return {
    async prepare(context) {
      require(!generation && !host.children.length, 'Prepare must be inert and called once per fixture.');
      generation = `${workload}:${crypto.randomUUID()}`;
      require(context.manifest?.workload === workload && canonical(context.definition ?? fixtureDefinitions[workload]) === canonical(fixtureDefinitions[workload]), 'Frozen fixture definition mismatch.');
      const identify = async source => {
        const bytes = new TextEncoder().encode(source);
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
        return { sha256: digest, utf8Bytes: bytes.length, utf16Units: source.length };
      };
      const location = services.viewInputs?.[workload];
      require(location?.url === `/host/view-inputs/${workload}` && /^[a-f0-9]{64}$/u.test(location.sha256), 'Exact frozen view-input service is required.');
      const response = await fetch(location.url, { signal }); require(response.ok, 'View input host request failed.');
      const body = await response.text(), responseIdentity = await identify(body);
      require(responseIdentity.utf8Bytes <= 262144 && responseIdentity.sha256 === location.sha256, 'Frozen view input identity or bound changed.');
      const supplied = JSON.parse(body);
      require(supplied && Object.keys(supplied).sort().join(',') === 'markup,view' && typeof supplied.markup === 'string'
        && canonical(supplied.view) === canonical(createViewDefinition(workload)), 'Frozen view input differs from the declared workload.');
      document = supplied.view; json = encode(document); markup = supplied.markup;
      const inputs = { json: await identify(json), markup: await identify(markup) };
      if (workload === 'R') {
        require(services.ssr?.url === '/host/ssr/R' && /^[a-f0-9]{64}$/u.test(services.ssr.sha256), 'Exact SSR service identity is required.');
        const response = await fetch(services.ssr.url, { signal }); require(response.ok, 'SSR host request failed.');
        const html = await response.text(); const bytes = new TextEncoder().encode(html); require(bytes.length <= 262144, 'SSR response exceeds its frozen bound.');
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
        require(digest === services.ssr.sha256, 'SSR response identity changed.');
        inputs.ssr = { sha256: digest, utf8Bytes: bytes.length, utf16Units: html.length };
        nativeSection = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-lyra-gen-snapshot]');
        require(nativeSection, 'Actual server snapshot is missing.');
        nativeTemplate = nativeSection.cloneNode(true);
      }
      return { generation, manifest: context.manifest, inputs, operations: fixtureDefinitions[workload].operations };
    },
    async runOperation({ operation, generation: requested, signal: operationSignal = signal, onArmed }) {
      require(!disposed && requested === generation && fixtureDefinitions[workload].operations.some(item => encode(item) === encode(operation)), 'Stale or altered view operation.');
      require(!activeController, 'View operations must run serially.');
      activeController = new AbortController();
      const controller = activeController, epoch = ++operationEpoch;
      const abort = () => controller.abort(); operationSignal?.addEventListener('abort', abort, { once: true });
      if (operationSignal?.aborted) abort();
      current = operation; committed = undefined;
      let completion, commitSignal;
      const complete = async () => {
        await settle(host);
        require(!disposed && epoch === operationEpoch && !commitSignal?.aborted && !controller.signal.aborted, 'View completion is stale or aborted.');
        const chart = view && node(view, 'chart');
        if (chart) { await waitForChartGeometry(chart, commitSignal); await chart.updateComplete; }
        require(!disposed && epoch === operationEpoch && !commitSignal?.aborted && !controller.signal.aborted, 'View completion is stale or aborted.');
        updateEcho(); committed = operation.id;
        const result = readOracle(); require(result.status === 'committed', result.reason ?? 'View semantics did not commit.');
        completion.resolve();
      };
      const waitForCommit = ({ signal: pending }) => new Promise((resolve, reject) => {
        commitSignal = pending;
        const abort = () => reject(new Error('View operation aborted.'));
        pending.addEventListener('abort', abort, { once: true });
        release = () => pending.removeEventListener('abort', abort);
        completion = { resolve: () => { release(); resolve(); }, reject: error => { release(); reject(error); } };
        if (operation.id === 'select-choice') {
          void waitForSelectedCategory(view, 'option-7', pending).then(complete).catch(error => completion.reject(error));
        }
        if (pending.aborted) abort();
      });
      const trigger = async ({ signal: activeSignal }) => {
        if (operation.id === 'mount' || operation.id === 'native-mount') {
          if (workload !== 'R') await initialize(activeSignal);
          require(!disposed && !activeSignal.aborted, 'View mount was aborted.');
          echo = host.ownerDocument.createElement('output'); echo.setAttribute('aria-label', 'Review result'); host.append(echo); watch(host); updateEcho();
          if (workload === 'R') host.append(nativeSection);
          else {
            const admitted = runtime.validateView(JSON.parse(json), catalog); require(admitted.ok, 'Timed JSON fixture admission failed.');
            document = admitted.value; view = new LyraGenViewElement(); view.catalog = catalog; host.append(view); await assignReady(view, document, activeSignal);
          }
        } else if (operation.id === 'markup-admission') {
          const parsed = parseMarkup(markup, { catalog: document.catalog, surfaceId: document.surfaceId, revision: 0, allowedTags: Object.keys(catalog.components) });
          require(parsed.status === 'complete' && canonical(parsed.view) === canonical(document), 'Timed Markup admission changed the tree.');
        } else if (operation.id === 'sibling-patch' || operation.id === 'data-patch' || operation.id === 'dirty-patch') {
          const original = node(view, 'note');
          document = createViewDefinition(workload, { revision: 1, patched: workload === 'X', noteDefault: workload === 'X' ? 'Model default' : 'New model default' });
          await assignReady(view, document, activeSignal); require(node(view, 'note') === original, 'Sibling patch replaced the edited control.');
        } else if (operation.id === 'cancel-restore' || operation.id === 'failed-restore') {
          if (view) {
            const fallback = nativeTemplate.cloneNode(true); nativeSection.replaceWith(fallback); nativeSection = fallback; view = undefined;
          }
          const original = nativeSection.querySelector('table'); const revision = nativeSection.dataset.revision;
          if (operation.id === 'failed-restore') nativeSection.dataset.revision = '999';
          const controller = new AbortController();
          const pending = restoreGenSnapshotElement(nativeSection, catalog, { signal: controller.signal });
          if (operation.id === 'cancel-restore') controller.abort();
          const restored = await pending; nativeSection.dataset.revision = revision;
          require(!restored.ok && nativeSection.querySelector('table') === original && !nativeSection.querySelector('lr-gen-view'), 'Refused restore destroyed the native fallback.');
        } else if (operation.id === 'restore') {
          await initialize(activeSignal);
          const result = await restoreGenSnapshotElement(nativeSection, catalog, { signal: activeSignal }); require(result.ok, 'Actual SSR restoration failed.');
          view = result.value; require(view.enabledActions?.length === 0 && actions.length === 0, 'Restore enabled or replayed an action.');
        } else if (operation.id === 'enable-action') { view.enabledActions = ['save']; await view.updateComplete; }
        else throw new Error('Unknown host view operation.');
        await complete();
      };
      try {
        if (operation.trigger === 'host') {
          pendingRun = measurement.measureOperation({ operation, generation, signal: controller.signal, trigger, waitForCommit, readOracle: () => readOracle(), onArmed });
          return await pendingRun;
        }
        const target = resolveViewNativeTarget(view, operation.id);
        require(target, 'Native view operation target is missing.');
        const type = viewNativeEventType(operation.id);
        const finish = () => { void complete().catch(error => completion.reject(error)); };
        if (operation.id !== 'select-choice') target.addEventListener(type, finish, { once: true });
        try {
          pendingRun = measurement.measureOperation({ operation, generation, signal: controller.signal, event: { target, type }, onArmed, waitForCommit, readOracle: () => readOracle() });
          return await pendingRun;
        }
        finally { target.removeEventListener(type, finish); }
      } finally { release(); operationSignal?.removeEventListener('abort', abort); if (activeController === controller) activeController = undefined; pendingRun = undefined; }
    },
    readOracle,
    async diagnose() {
      const chart = view && node(view, 'chart');
      const snapshot = () => {
        const marks = [...chart?.shadowRoot?.querySelectorAll('[part="bar"], [part="point"]') ?? []];
        const rows = [...chart?.shadowRoot?.querySelectorAll('[part="data-table"] tbody tr') ?? []];
        const bounds = chart?.shadowRoot?.querySelector('svg')?.getBoundingClientRect();
        return { status: view?.status, maxRecords: chart?.maxRecords, layout: chart?.layout, labels: chart?.labels.length,
          datasets: chart?.datasets.map(series => series.data.length), svg: bounds ? { width: bounds.width, height: bounds.height } : null,
          marks: marks.length, markRows: [...new Set(marks.map(mark => Number(mark.getAttribute('data-index'))))],
          markSeries: [...new Set(marks.map(mark => Number(mark.getAttribute('data-dataset-index'))))],
          accessibleRows: rows.length, accessibleIndexes: rows.map(row => row.querySelector('th')?.textContent.trim()) };
      };
      const immediate = snapshot();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await chart?.updateComplete;
      return { workload, immediate, afterTwoFrames: snapshot() };
    },
    async dispose() {
      if (!disposed) { disposed = true; operationEpoch++; activeController?.abort(); await pendingRun?.catch(() => {}); release(); unwatch(); view?.remove(); nativeSection?.remove(); echo?.remove(); await Promise.resolve();
        view = undefined; nativeSection = undefined; nativeTemplate = undefined; echo = undefined; document = undefined; json = undefined; markup = undefined; actions = []; lastValues = undefined; selection = []; }
      return { connectedNodes: host.childNodes.length, connectedElements: host.querySelectorAll('*').length, retainedSources: 0, pendingOperations: measurement.pendingOperations };
    },
  };
}
