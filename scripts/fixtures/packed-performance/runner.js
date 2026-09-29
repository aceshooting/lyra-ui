const config = await (await fetch('/workloads.json')).json();
const packageSpec = window.__lyraPackage;
const packageBase = `/packages/${packageSpec.key}/dist/`;
const registrationTags = ['input', 'select', 'option', 'dialog', 'data-grid', 'tree', 'button'];
const tags = registrationTags.map((name) => `lr-${name}`);
const eventRecords = { typing: [], select: [], dialog: [] };
const failures = [];
const pending = { typing: undefined, select: undefined, dialog: undefined };
const frameIntervalsMs = [];
const longTasks = [];
const longTaskSupported = globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask') === true;
let previousFrame;
let recordFrames = false;
let longTaskObserver;
const stylePaintProbe = document.createElement('span');
stylePaintProbe.style.cssText = 'position:fixed;inset-inline-start:-10000px;inset-block-start:-10000px;background-color:var(--lr-color-brand-fill-loud)';

document.body.innerHTML = `
  <main style="font: 16px sans-serif">
    <lr-input id="input" label="Search"></lr-input>
    <lr-select id="select" label="Destination">
      <lr-option value="first">First</lr-option>
      <lr-option value="second">Second</lr-option>
    </lr-select>
    <button id="dialog-opener" type="button">Open details</button>
    <lr-dialog id="dialog" label="Details"><p>Dialog content</p></lr-dialog>
    <lr-data-grid id="grid" label="Records"
      style="display:block;width:640px;height:${config.grid.viewportHeight}px"></lr-data-grid>
    <lr-button id="style-probe" variant="brand" appearance="accent">Style probe</lr-button>
    <section id="scope-outer">
      <span id="scope-outer-paint" style="background-color:var(--lr-color-brand-fill-loud)"></span>
      <lr-button id="scope-outer-probe" variant="brand" appearance="accent">Outer probe</lr-button>
      <section id="scope-inner">
        <span id="scope-inner-paint" style="background-color:var(--lr-color-brand-fill-loud)"></span>
        <lr-button id="scope-inner-probe" variant="brand" appearance="accent">Inner probe</lr-button>
      </section>
    </section>
    <div id="tree-viewport" style="height:${config.tree.viewportHeight}px;overflow:auto;width:640px">
      <lr-tree id="tree" label="Records tree"></lr-tree>
    </div>
  </main>`;
document.body.append(stylePaintProbe);

const startedAt = performance.now();
await Promise.all(
  registrationTags.map((name) => import(`${packageBase}components/lr-${name}.js`)),
);
await Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
const registeredAt = performance.now();

const input = document.querySelector('#input');
const select = document.querySelector('#select');
const dialog = document.querySelector('#dialog');
const opener = document.querySelector('#dialog-opener');
const grid = document.querySelector('#grid');
const tree = document.querySelector('#tree');
const treeViewport = document.querySelector('#tree-viewport');
const styleProbe = document.querySelector('#style-probe');
const scopeOuter = document.querySelector('#scope-outer');
const scopeInner = document.querySelector('#scope-inner');

await Promise.all([input.updateComplete, select.updateComplete, dialog.updateComplete]);
await waitFor(() => input.shadowRoot?.querySelector('input') !== null, 'native input did not render');
const nativeInput = input.shadowRoot.querySelector('input');
const nativeInputRect = nativeInput.getBoundingClientRect();
if (nativeInputRect.width <= 0 || nativeInputRect.height <= 0 || nativeInput.disabled) {
  throw new Error('the first registered input is not visible and usable');
}
if (tags.some((tag) => !customElements.get(tag))) {
  throw new Error('not all requested custom-element tags were registered');
}
const firstUsableAt = performance.now();

const gridData = Array.from({ length: config.grid.rowCount }, (_, index) => ({
  id: `row-${index}`,
  value: `value-${index}`,
}));
grid.rowKey = 'id';
grid.columns = config.grid.columns;
grid.data = gridData;
tree.data = Array.from({ length: config.tree.nodeCount }, (_, index) => ({
  id: `node-${index}`,
  label: `Node ${index}`,
}));

await Promise.all([
  input.updateComplete,
  select.updateComplete,
  dialog.updateComplete,
  grid.updateComplete,
  tree.updateComplete,
]);

const { setLyraStyle, getLyraStyle, applyLyraStyleScope } = await import(window.__lyraThemeUrl);

function waitFor(predicate, message, timeoutMs = 10000) {
  const deadline = performance.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve();
      if (performance.now() >= deadline) return reject(new Error(message));
      requestAnimationFrame(check);
    };
    check();
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function deepPathIncludes(event, host) {
  return event.composedPath().includes(host);
}

document.addEventListener('keydown', (event) => {
  if (event.key === config.key && deepPathIncludes(event, input)) {
    pending.typing = performance.now();
  }
  if (event.key === 'Enter' && deepPathIncludes(event, select)) {
    pending.select = performance.now();
  }
}, true);

input.addEventListener('lr-input', (event) => {
  const start = pending.typing;
  pending.typing = undefined;
  if (start === undefined) {
    failures.push('lr-input arrived without a matching native keydown');
    return;
  }
  const value = event.detail?.value;
  if (value !== nativeInput.value || value !== input.value) {
    failures.push('lr-input detail, host value, and native value disagree');
  }
  const record = { keydownToEventMs: performance.now() - start };
  eventRecords.typing.push(record);
  input.updateComplete.then(() => nextFrame()).then(() => {
    record.keydownToRenderedFrameMs = performance.now() - start;
    record.renderedValue = nativeInput.value === input.value && input.value === value;
    if (!record.renderedValue) failures.push('typed value did not reach the rendered native control');
  });
});

select.addEventListener('lr-change', (event) => {
  const start = pending.select;
  pending.select = undefined;
  if (start === undefined) {
    failures.push('lr-change arrived without a matching Enter keydown');
    return;
  }
  const value = event.detail?.value;
  const record = { keydownToEventMs: performance.now() - start, value };
  eventRecords.select.push(record);
  select.updateComplete.then(() => nextFrame()).then(() => {
    const trigger = select.shadowRoot?.querySelector('button');
    record.visibleSelection = value === 'second' && select.value === value &&
      Boolean(trigger?.textContent?.includes('Second'));
    if (!record.visibleSelection) failures.push('selected option was not reflected on the trigger');
  });
});

opener.addEventListener('click', () => {
  pending.dialog = performance.now();
  void dialog.show();
}, true);
dialog.addEventListener('lr-after-show', () => {
  const start = pending.dialog;
  pending.dialog = undefined;
  if (start === undefined) {
    failures.push('dialog opened without a matching native opener click');
    return;
  }
  const record = { clickToAfterShowMs: performance.now() - start };
  eventRecords.dialog.push(record);
  dialog.updateComplete.then(() => nextFrame()).then(() => {
    const panel = dialog.shadowRoot?.querySelector('[role="dialog"]');
    const rect = panel?.getBoundingClientRect();
    record.visibleAndOpen = dialog.open === true && Boolean(rect && rect.width > 0 && rect.height > 0);
    if (!record.visibleAndOpen) failures.push('dialog did not become visibly open');
  });
});

async function startFrameSampling() {
  const idleFrameIntervalsMs = [];
  let idlePreviousFrame;
  await new Promise((resolve) => {
    const sampleIdle = (time) => {
      if (idlePreviousFrame !== undefined) idleFrameIntervalsMs.push(time - idlePreviousFrame);
      idlePreviousFrame = time;
      if (idleFrameIntervalsMs.length === config.frameSampling.idleIntervals) resolve();
      else requestAnimationFrame(sampleIdle);
    };
    requestAnimationFrame(sampleIdle);
  });
  if (longTaskSupported) {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
      }
    });
    longTaskObserver.observe({ type: 'longtask' });
  }
  recordFrames = true;
  previousFrame = undefined;
  const sample = (time) => {
    if (!recordFrames) return;
    if (previousFrame !== undefined) frameIntervalsMs.push(time - previousFrame);
    previousFrame = time;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  return idleFrameIntervalsMs;
}

function visibleGridRow(rowId) {
  const body = grid.shadowRoot?.querySelector('[part~="body"]');
  const bodyRect = body?.getBoundingClientRect();
  if (!body || !bodyRect) return undefined;
  const row = Array.from(grid.shadowRoot.querySelectorAll('[part~="row"][data-visible-index]'))
    .find((candidate) => candidate.textContent?.includes(rowId));
  if (!row) return undefined;
  const rect = row.getBoundingClientRect();
  return rect.bottom > bodyRect.top && rect.top < bodyRect.bottom ? { body, row } : undefined;
}

function visibleTreeItem(nodeId) {
  const item = Array.from(tree.querySelectorAll('lr-tree-item'))
    .find((candidate) => candidate.nodeId === nodeId);
  if (!item) return undefined;
  const viewport = treeViewport.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  return rect.bottom > viewport.top && rect.top < viewport.bottom ? item : undefined;
}

function visibleTreeItemCount() {
  const viewport = treeViewport.getBoundingClientRect();
  return Array.from(tree.querySelectorAll('lr-tree-item')).filter((item) => {
    const rect = item.getBoundingClientRect();
    return rect.bottom > viewport.top && rect.top < viewport.bottom;
  }).length;
}

function exactStylePaint(look, mode, density, accent) {
  const rootStyle = getComputedStyle(document.documentElement);
  const base = styleProbe.shadowRoot?.querySelector('[part~="base"]');
  if (!base) return false;
  const expectedPaint = getComputedStyle(stylePaintProbe).backgroundColor;
  const snapshot = getLyraStyle();
  const installedLook = rootStyle.getPropertyValue('--_lr-look-installed').trim();
  const installedAccent = rootStyle.getPropertyValue('--_lr-accent-installed').trim();
  return snapshot.look === look && snapshot.mode === mode && snapshot.density === density &&
    snapshot.accentName === accent && document.documentElement.dataset.lrLook === look &&
    document.documentElement.dataset.lrTheme === mode && document.documentElement.dataset.lrDensity === density &&
    document.documentElement.dataset.lrAccent === accent && installedLook === `${look}-1` &&
    installedAccent === `${accent}-1` && getComputedStyle(base).backgroundColor === expectedPaint &&
    base.getBoundingClientRect().height > 0;
}

async function settledStyleSwitch(sampleIndex) {
  const workload = config.styleSwitch;
  const { look, mode, accent, density } = workload.plan[sampleIndex];
  const rafIntervalsMs = [];
  let previousFrame;
  const startedAt = performance.now();
  setLyraStyle({ look, mode, density, accent });
  let stableFrames = 0;
  await new Promise((resolve, reject) => {
    const deadline = performance.now() + workload.settledPaintTimeoutMs;
    const check = (time) => {
      if (previousFrame !== undefined) rafIntervalsMs.push(time - previousFrame);
      previousFrame = time;
      if (exactStylePaint(look, mode, density, accent)) stableFrames += 1;
      else stableFrames = 0;
      if (stableFrames >= workload.stableAnimationFrames) {
        resolve();
        return;
      }
      if (performance.now() >= deadline) {
        reject(new Error(`style switch did not settle exact ${look}/${mode}/${density}/${accent} paint`));
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
  return {
    durationMs: performance.now() - startedAt,
    look,
    mode,
    density,
    accent,
    paint: getComputedStyle(styleProbe.shadowRoot.querySelector('[part~="base"]')).backgroundColor,
    geometryHeight: styleProbe.shadowRoot.querySelector('[part~="base"]').getBoundingClientRect().height,
    rafIntervalsMs,
  };
}

function scopedPaintMatches(scope, probeId, paintId, choices) {
  const computed = getComputedStyle(scope);
  const base = document.querySelector(probeId)?.shadowRoot?.querySelector('[part~="base"]');
  const sentinel = document.querySelector(paintId);
  if (!base || !sentinel) return false;
  const expectedPaint = getComputedStyle(sentinel).backgroundColor;
  const actualPaint = getComputedStyle(base).backgroundColor;
  return scope.dataset.lrLook === choices.look && scope.dataset.lrMode === choices.mode &&
    scope.dataset.lrDensity === choices.density && scope.dataset.lrAccent === choices.accent &&
    scope.dataset.lrSurface === 'glass' && computed.getPropertyValue('--_lr-look-installed').trim() === `${choices.look}-1` &&
    computed.getPropertyValue('--_lr-surface-installed').trim() === '1' &&
    computed.getPropertyValue('--_lr-accent-installed').trim() === `${choices.accent}-1` &&
    actualPaint === expectedPaint && base.getBoundingClientRect().height > 0;
}

async function settledNestedGlassSwitch(sampleIndex) {
  const workload = config.styleSwitch;
  const outer = workload.plan[sampleIndex];
  const inner = {
    look: workload.looks[(sampleIndex + 3) % workload.looks.length],
    mode: outer.mode === 'light' ? 'dark' : 'light',
    accent: outer.accent === 'sapphire' ? 'emerald' : 'sapphire',
    density: workload.densities[(workload.densities.indexOf(outer.density) + 1) % workload.densities.length],
  };
  const rafIntervalsMs = [];
  let previousFrame;
  const startedAt = performance.now();
  applyLyraStyleScope(scopeOuter, { ...outer, surface: 'glass' });
  applyLyraStyleScope(scopeInner, { ...inner, surface: 'glass' });
  let stableFrames = 0;
  await new Promise((resolve, reject) => {
    const deadline = performance.now() + workload.settledPaintTimeoutMs;
    const check = (time) => {
      if (previousFrame !== undefined) rafIntervalsMs.push(time - previousFrame);
      previousFrame = time;
      if (scopedPaintMatches(scopeOuter, '#scope-outer-probe', '#scope-outer-paint', outer) &&
          scopedPaintMatches(scopeInner, '#scope-inner-probe', '#scope-inner-paint', inner)) stableFrames += 1;
      else stableFrames = 0;
      if (stableFrames >= workload.stableAnimationFrames) {
        resolve();
        return;
      }
      if (performance.now() >= deadline) {
        reject(new Error(`nested glass switch did not settle exact outer ${outer.look} / inner ${inner.look} paint`));
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
  const outerBase = document.querySelector('#scope-outer-probe').shadowRoot.querySelector('[part~="base"]');
  const innerBase = document.querySelector('#scope-inner-probe').shadowRoot.querySelector('[part~="base"]');
  return {
    durationMs: performance.now() - startedAt,
    outer: { ...outer, surface: 'glass', paint: getComputedStyle(outerBase).backgroundColor },
    inner: { ...inner, surface: 'glass', paint: getComputedStyle(innerBase).backgroundColor },
    rafIntervalsMs,
  };
}

async function gridScrollSample() {
  const index = config.grid.targetIndex;
  const targetId = grid.data[index].id;
  grid.scrollToIndex(0, { align: 'start' });
  await waitFor(() => Boolean(visibleGridRow(grid.data[0].id)), 'data grid failed to return to the first row');
  const start = performance.now();
  grid.scrollToIndex(index, { align: 'center' });
  await waitFor(() => Boolean(visibleGridRow(targetId)), `data grid failed to reveal ${targetId}`);
  const currentWindow = Array.from(grid.shadowRoot.querySelectorAll('[part~="row"][data-visible-index]'));
  const body = grid.shadowRoot.querySelector('[part~="body"]');
  if (
    grid.data.length !== config.grid.rowCount ||
    currentWindow.length >= grid.data.length ||
    currentWindow.length === 0
  ) {
    throw new Error('data-grid row window accounting does not match the fixed dataset');
  }
  const visible = visibleGridRow(targetId);
  if (!visible || !visible.row.textContent.includes(targetId)) {
    throw new Error(`data grid visible identity assertion failed for ${targetId}`);
  }
  return {
    durationMs: performance.now() - start,
    requestedIndex: index,
    requestedId: targetId,
    visibleDataRows: currentWindow.length,
    dataRows: grid.data.length,
    shadowDomNodes: grid.shadowRoot.querySelectorAll('*').length,
    bodyScrollHeight: body.scrollHeight,
    bodyClientHeight: body.clientHeight,
  };
}

async function gridUpdateSample(revision) {
  const index = config.grid.targetIndex;
  const targetId = grid.data[index].id;
  const updatedValue = `revision-${revision}`;
  const next = grid.data.map((row, rowIndex) => rowIndex === index ? { ...row, value: updatedValue } : row);
  const start = performance.now();
  grid.data = next;
  await grid.updateComplete;
  await waitFor(() => {
    const target = visibleGridRow(targetId);
    return Boolean(target && target.row.textContent?.includes(updatedValue));
  }, `data grid did not render ${updatedValue} for ${targetId}`);
  const currentWindow = Array.from(grid.shadowRoot.querySelectorAll('[part~="row"][data-visible-index]'));
  if (
    grid.data.length !== config.grid.rowCount ||
    currentWindow.length >= grid.data.length ||
    currentWindow.length === 0
  ) {
    throw new Error('data-grid update changed the fixed row-window accounting');
  }
  return {
    durationMs: performance.now() - start,
    requestedIndex: index,
    requestedId: targetId,
    updatedValue,
    visibleDataRows: currentWindow.length,
    dataRows: grid.data.length,
    shadowDomNodes: grid.shadowRoot.querySelectorAll('*').length,
  };
}

async function treeScrollSample() {
  const index = config.tree.targetIndex;
  const nodeId = tree.data[index].id;
  const item = Array.from(tree.querySelectorAll('lr-tree-item')).find((candidate) => candidate.nodeId === nodeId);
  if (!item) throw new Error(`tree did not render requested node ${nodeId}`);
  tree.querySelectorAll('lr-tree-item')[0]?.scrollIntoView({ block: 'start' });
  await waitFor(() => visibleTreeItem(tree.data[0].id), 'tree failed to return to its first node');
  const start = performance.now();
  item.scrollIntoView({ block: 'center' });
  await waitFor(() => Boolean(visibleTreeItem(nodeId)), `tree failed to reveal ${nodeId}`);
  const items = Array.from(tree.querySelectorAll('lr-tree-item'));
  if (items.length !== config.tree.nodeCount || !visibleTreeItem(nodeId)) {
    throw new Error('tree item identity or full-data DOM accounting failed after scrolling');
  }
  const nestedShadowNodes = items.reduce(
    (total, row) => total + (row.shadowRoot?.querySelectorAll('*').length ?? 0),
    0,
  );
  return {
    durationMs: performance.now() - start,
    requestedIndex: index,
    requestedId: nodeId,
    dataNodes: tree.data.length,
    renderedItems: items.length,
    visibleItems: visibleTreeItemCount(),
    nestedShadowDomNodes: nestedShadowNodes,
    viewportScrollHeight: treeViewport.scrollHeight,
    viewportClientHeight: treeViewport.clientHeight,
  };
}

async function treeUpdateSample(revision) {
  const index = config.tree.targetIndex;
  const nodeId = tree.data[index].id;
  const updatedLabel = `Node ${index} revision ${revision}`;
  const next = tree.data.map((node, nodeIndex) => nodeIndex === index ? { ...node, label: updatedLabel } : node);
  const start = performance.now();
  tree.data = next;
  await tree.updateComplete;
  await waitFor(() => {
    const target = Array.from(tree.querySelectorAll('lr-tree-item')).find((candidate) => candidate.nodeId === nodeId);
    const renderedLabel = target?.shadowRoot?.querySelector('[part="label"]')?.textContent;
    return Boolean(visibleTreeItem(nodeId) && renderedLabel?.includes(updatedLabel));
  }, `tree did not render ${updatedLabel} for ${nodeId}`);
  const items = Array.from(tree.querySelectorAll('lr-tree-item'));
  if (tree.data.length !== config.tree.nodeCount || items.length !== config.tree.nodeCount) {
    throw new Error('tree update changed full-data DOM accounting');
  }
  const nestedShadowNodes = items.reduce(
    (total, row) => total + (row.shadowRoot?.querySelectorAll('*').length ?? 0),
    0,
  );
  return {
    durationMs: performance.now() - start,
    requestedIndex: index,
    requestedId: nodeId,
    updatedLabel,
    dataNodes: tree.data.length,
    renderedItems: items.length,
    visibleTarget: Boolean(visibleTreeItem(nodeId)),
    visibleItems: visibleTreeItemCount(),
    nestedShadowDomNodes: nestedShadowNodes,
  };
}

const optionTrigger = select.shadowRoot?.querySelector('button');
if (!optionTrigger) throw new Error('select trigger was not rendered');
if (tree.querySelectorAll('lr-tree-item').length !== config.tree.nodeCount) {
  throw new Error('tree initial data count differs from the workload configuration');
}
if (!grid.shadowRoot?.querySelector('[part~="body"]')) throw new Error('data-grid body did not render');

window.__lyraPerformance = {
  config,
  boot: {
    registrationMs: registeredAt - startedAt,
    firstUsableMs: firstUsableAt - startedAt,
    registeredTags: tags.filter((tag) => Boolean(customElements.get(tag))),
    firstUsable: true,
    gridRows: grid.data.length,
    treeNodes: tree.data.length,
    gridRenderedRows: grid.shadowRoot.querySelectorAll('[part~="row"][data-visible-index]').length,
    gridShadowDomNodes: grid.shadowRoot.querySelectorAll('*').length,
    treeRenderedItems: tree.querySelectorAll('lr-tree-item').length,
  },
  eventRecords,
  failures,
  frameIntervalsMs,
  longTaskSupported,
  longTasks,
  input,
  nativeInput,
  select,
  optionTrigger,
  dialog,
  opener,
  grid,
  tree,
  treeViewport,
  startFrameSampling,
  async resetInput() {
    input.value = '';
    await input.updateComplete;
    nativeInput.focus();
  },
  async resetSelect() {
    select.value = 'first';
    await select.updateComplete;
    optionTrigger.focus();
  },
  async finishDialogSample() {
    await dialog.close();
    await waitFor(() => dialog.open === false, 'dialog did not close between samples');
  },
  async runGridScroll() { return gridScrollSample(); },
  async runGridUpdate(revision) { return gridUpdateSample(revision); },
  async runTreeScroll() { return treeScrollSample(); },
  async runTreeUpdate(revision) { return treeUpdateSample(revision); },
  async runStyleSwitch(scenario, index) {
    if (scenario === 'root') return settledStyleSwitch(index);
    if (scenario === 'nested-glass') return settledNestedGlassSwitch(index);
    throw new Error(`Unknown style scenario ${scenario}`);
  },
  async stopFrameSampling() {
    recordFrames = false;
    await nextFrame();
    for (const entry of longTaskObserver?.takeRecords() ?? []) {
      longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
    }
    longTaskObserver?.disconnect();
  },
};

document.documentElement.dataset.lyraPerformanceReady = 'true';
