import { createLiveUniverse, liveQueryResult, createSavedCatalog, projectSavedDefinition, assertDashboardChartShape } from '../profile-fixture/workloads/dashboards.js';
import { createViewDefinition, assertViewSemantics, waitForChartGeometry } from '../profile-fixture/workloads/views.js';
import { settle, visible } from '../profile-fixture/workloads/text.js';

const require = (condition, message) => { if (!condition) throw new Error(message); };
const phases = ['mounted', 'released', 'disposed', 'restored', 'restored-disposed'];
const node = (view, id) => view?.shadowRoot?.querySelector(`[data-gen-id="${id}"]`);
export function dashboardMemoryNotes(cycle) {
  require(Number.isSafeInteger(cycle) && cycle > 0, 'Invalid dashboard memory cycle.');
  return { live: `Live edited note ${cycle}`, saved: `Saved edited note ${cycle}` };
}
export function expectedMemoryApplication(phase, { cycle }) {
  require(phases.includes(phase), 'Unknown dashboard memory phase.');
  const notes = dashboardMemoryNotes(cycle), gone = phase === 'disposed' || phase === 'restored-disposed';
  return { application: 'full-dashboard', phase, cycle, livePanels: gone ? 0 : 2, liveRows: gone ? 0 : 100,
    liveColumns: gone ? 0 : 2, liveSeries: gone ? 0 : 1, savedPanels: gone ? 0 : 1, savedRows: gone ? 0 : 100,
    savedColumns: gone ? 0 : 8, savedSeries: gone ? 0 : 4, categories: gone ? 0 : 100,
    liveNote: gone ? '' : notes.live, savedNote: gone ? '' : notes.saved,
    higherDefault: phase === 'restored', actions: phase === 'restored-disposed' ? 2 : 1 };
}
export function validateMemoryDashboardArchive(value, cycle) {
  require(value && Object.keys(value).sort().join(',') === 'cycle,instanceRevision,layout,live,saved,version'
    && value.version === 1 && value.cycle === cycle && Number.isSafeInteger(value.instanceRevision) && value.instanceRevision >= 2, 'Invalid dashboard memory archive.');
  require(value.layout?.version === 1 && value.layout.panels?.length === 2 && value.live?.length === 2, 'Incomplete live dashboard archive.');
  const notes = dashboardMemoryNotes(cycle);
  for (const [snapshot, surface, note] of [[value.live[0], 'table', notes.live], [value.live[1], 'chart'], [value.saved, 'saved-report', notes.saved]]) {
    require(snapshot?.version === '1' && snapshot.view?.surfaceId === surface && snapshot.state?.surfaceId === surface
      && snapshot.view.revision === snapshot.state.revision, 'Archived dashboard surface changed.');
    if (note) require(snapshot.state.values?.note === note && snapshot.state.dirty?.includes('/note'), 'Archived dirty note is missing.');
  }
  require(new TextEncoder().encode(JSON.stringify(value)).length <= 512 * 1024, 'Dashboard archive exceeds the shared archive ceiling.');
  return value;
}

export function validateMemoryDashboardAction(action, { cycle, higherDefault, actions }) {
  require(action?.name === 'save' && action.surfaceId === 'saved-report' && action.nodeId === 'form'
    && action.revision === (higherDefault ? 1 : 0), 'Unexpected dashboard action identity.');
  const expected = { note: dashboardMemoryNotes(cycle).saved, details: 'Report details', category: 'option-0', agreed: true, notify: true, level: 50 };
  require(action.payload && Object.keys(action.payload).length === 6 && Object.entries(expected).every(([key, value]) => action.payload[key] === value), 'Dashboard action lost dirty form values.');
  require(actions === (higherDefault ? 1 : 0), 'Dashboard action replayed.'); return actions + 1;
}

export function waitForMemoryDashboardView(view, signal, { Observer = globalThis.MutationObserver } = {}) {
  return new Promise((resolve, reject) => {
    let observer;
    const clear = () => { observer?.disconnect(); view.removeEventListener('lr-gen-ready', inspect); view.removeEventListener('lr-gen-error', inspect); signal?.removeEventListener('abort', abort); };
    const abort = () => { clear(); reject(new Error('Dashboard memory readiness aborted.')); };
    const inspect = () => {
      if (signal?.aborted) { abort(); return; }
      if (view.status === 'ready') { clear(); resolve(); }
      else if (view.status === 'error') { clear(); reject(new Error('Dashboard memory view failed.')); }
    };
    try {
      observer = new Observer(inspect); observer.observe(view, { attributes: true, attributeFilter: ['aria-busy'] });
      view.addEventListener('lr-gen-ready', inspect); view.addEventListener('lr-gen-error', inspect); signal?.addEventListener('abort', abort, { once: true }); inspect();
    } catch (error) { clear(); reject(error); }
  });
}

const labels = {
  title: 'Live report', table: 'Report records', chart: 'Report categories', note: 'Personal note', refresh: 'Refresh', cancel: 'Cancel', pin: 'Pin records', unpin: 'Unpin records',
  category: 'Category', value: 'Value', sharedFilter: 'Shared filter', previous: 'Previous page', next: 'Next page', overview: 'Overview', back: 'Back', navigationDenied: 'Detail unavailable',
  detail: row => `Details: ${row.c0}`, page: page => `offset:${page.shownOffset};limit:${page.limit};${page.stale ? 'stale' : 'fresh'}`,
  selection: ids => `Selected: ${ids.join(', ')}`, queue: metrics => `${metrics.items} pending; ${metrics.dropped} dropped`,
  provenance: snapshot => snapshot.result?.sources?.map(source => `${source.label}@${source.updatedAt}`).join(', ') ?? 'Unverified',
  layoutError: code => `Layout: ${code}`, status: snapshot => `${snapshot.status}:${snapshot.stale ? 'stale' : 'fresh'}`,
};
const loadRuntime = async () => {
  const [example, live, application, binding, grid, catalog, state] = await Promise.all([
    import('../../../packages/lyra-gen/examples/dashboard.ts'), import('@aceshooting/lyra-gen/live-data.js'),
    import('@aceshooting/lyra-gen/application.js'), import('@aceshooting/lyra-gen/dashboard-binding.js'),
    import('@aceshooting/lyra-ui/components/lr-dashboard-grid.js'), import('@aceshooting/lyra-gen/catalog.js'), import('@aceshooting/lyra-gen/runtime.js'),
  ]);
  return { ...example, ...live, ...application, ...binding, ...grid, ...state, catalog };
};

/** Full live and saved applications; the harness owns the external archive and protocol region. */
export async function createMemoryApplication({ host, signal, services, cycle, load = loadRuntime }) {
  require(services?.dashboard?.url === '/host/dashboard' && services.dashboard.simulatedSessions === true, 'Dashboard host service is required.');
  const notes = dashboardMemoryNotes(cycle), states = new Map(), pendingRequests = new Set(), pendingQueries = new Set(), tasks = new Set();
  let runtime, catalog, root, liveRoot, savedRoot, echo, liveApp, savedApp, savedBinding, savedView, unregister;
  let presentation, universe, sourceCharacters = 0, instanceRevision = 0, savedThisPresentation = false, actions = 0, higherDefault = false, restored = false, closed = false, native;
  let liveBaseRevision = 0, actionFailure, activeWork = 0;
  const abort = () => presentation?.abort(); signal?.addEventListener('abort', abort);
  const check = active => require(!closed && !signal?.aborted && !active?.aborted, 'Dashboard memory application aborted.');
  const track = work => {
    activeWork++;
    const task = (async () => { try { return await work(); } finally { activeWork--; } })();
    tasks.add(task); void task.finally(() => tasks.delete(task)).catch(() => {}); return task;
  };
  const request = async (operation, values = {}, session = 'viewer', active = presentation?.signal ?? signal) => {
    check(active); const controller = new AbortController(), stop = () => controller.abort();
    active?.addEventListener('abort', stop, { once: true });
    let finish; const completed = new Promise(resolve => { finish = resolve; }); pendingRequests.add({ controller, completed });
    try {
      const body = JSON.stringify({ operation, ...values }); require(new TextEncoder().encode(body).length <= 262144, 'Dashboard host request exceeds ceiling.');
      const response = await fetch(services.dashboard.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-fixture-session': session }, body, signal: controller.signal });
      const text = await response.text(); check(active); require(new TextEncoder().encode(text).length <= 262144, 'Dashboard host response exceeds ceiling.');
      const result = JSON.parse(text); require(response.ok, `Dashboard host refused ${operation}.`); return result.value;
    } finally {
      active?.removeEventListener('abort', stop); for (const pending of pendingRequests) if (pending.controller === controller) pendingRequests.delete(pending); finish();
    }
  };
  const views = () => [liveApp?.binding.panel('table'), liveApp?.binding.panel('chart'), savedView].filter(Boolean);
  const changed = event => {
    const view = event.target; if (!views().includes(view)) return;
    states.set(view, { values: event.detail.values, dirty: event.detail.dirty }); paint();
  };
  const paint = () => { if (echo) echo.textContent = `Live: ${node(liveApp?.binding.panel('table'), 'note')?.value ?? ''}; saved: ${node(savedView, 'note')?.value ?? ''}; actions: ${actions}`; };
  const onAction = event => {
    try {
      require(event.target === savedView, 'Unexpected dashboard action owner.');
      actions = validateMemoryDashboardAction(event.detail, { cycle, higherDefault, actions }); paint();
    } catch (error) { actionFailure = error; }
  };
  const ready = async () => {
    const active = presentation.signal;
    await Promise.all(views().map(view => waitForMemoryDashboardView(view, active))); await settle(root);
    await Promise.all([node(liveApp.binding.panel('chart'), 'summary'), node(savedView, 'chart')].map(chart => waitForChartGeometry(chart, active)));
    check(active); paint();
  };
  const snapshot = view => {
    const state = states.get(view), fresh = runtime.createSurfaceState(view.document, state?.values ?? view.bindingState);
    return runtime.createSnapshot(view.document, { ...fresh, dirty: state?.dirty ?? [] });
  };
  const construct = async archive => {
    require(!root && !presentation, 'Previous dashboard presentation is still mounted.'); check(signal);
    presentation = new AbortController(); const active = presentation.signal, restoring = Boolean(archive), archivedInstanceRevision = archive?.instanceRevision;
    const loaded = await load(); check(active); runtime = loaded; catalog = createSavedCatalog(runtime.catalog); restored = restoring; savedThisPresentation = false;
    check(active); universe = createLiveUniverse(); sourceCharacters = JSON.stringify(universe).length;
    root = document.createElement('section'); root.dataset.memoryDashboard = '';
    liveRoot = document.createElement('section'); liveRoot.dataset.memoryLive = '';
    savedRoot = document.createElement('section'); savedRoot.dataset.memorySaved = '';
    echo = document.createElement('output'); echo.dataset.memoryDashboardResult = '';
    root.append(liveRoot, savedRoot, echo); root.addEventListener('lr-gen-state-change', changed); root.addEventListener('lr-gen-action', onAction); host.append(root);
    const registry = new runtime.HostQueryRegistry();
    unregister = registry.register('records', { maxBytes: 65536, maxRows: 100, authorize: context => context.viewerId === 'memory-viewer', execute: async parameters => {
      let done; const pending = new Promise(resolve => { done = resolve; }); pendingQueries.add(pending);
      try { await Promise.resolve(); check(active); require(universe, 'Released live source is unavailable.'); return liveQueryResult(universe, parameters); }
      finally { pendingQueries.delete(pending); done(); }
    } });
    liveApp = runtime.mountLiveDashboard(liveRoot, { registry, context: { viewerId: 'memory-viewer', tenantId: 'profile', authorizationRevision: '1' }, query: 'records',
      labels, pageSize: 100, totalRows: 1000, layout: archive?.layout, persist: async () => true, authorizeDrilldown: () => true,
      sources: { available: () => true, activate: () => {}, label: 'Value provenance', unverified: 'Unverified', citation: source => source.label } });
    await liveApp.ready; check(active); await liveApp.refresh(); check(active);
    liveBaseRevision = liveApp.binding.panel('table').document.revision;
    savedApp = new runtime.DashboardApplication({ context: () => ({ actorId: 'viewer', tenantId: 'profile', workspaceId: 'reports' }),
      store: { resolve: () => request('resolve', {}, 'viewer', active) }, mount: async ({ dashboard, signal: mountSignal }) => {
        const [data, state] = await Promise.all([request('data', {}, 'viewer', mountSignal), request('load-state', {}, 'viewer', mountSignal)]);
        check(active); check(mountSignal); instanceRevision = state?.revision ?? 0;
        require(Number.isSafeInteger(instanceRevision) && instanceRevision >= 1 && typeof state?.state.values.note === 'string'
          && (!restoring || instanceRevision === archivedInstanceRevision && state.state.values.note === notes.saved), 'Saved instance state changed.');
        const grid = new runtime.LyraDashboardGrid(); grid.accessibleLabel = 'Saved report layout'; grid.rowHeight = 100;
        const binding = new runtime.DashboardGridBinding({ grid, catalog, panels: [{ id: 'report', view: projectSavedDefinition(dashboard.definition, data) }],
          state: { version: 1, revision: 0, panels: [{ id: 'report', column: 0, row: 0, width: 6, height: 12 }] },
          constraints: { columns: 6, maxRows: 20, maxPanels: 1, collision: 'reject' }, readonly: true });
        savedBinding = binding; savedView = binding.panel('report'); savedView.enabledActions = ['save']; savedView.bindingState = state.state.values;
        savedRoot.append(grid);
        return () => { binding.dispose(); grid.remove(); savedView = undefined; savedBinding = undefined; };
      } });
    require(await savedApp.navigate({ documentId: services.dashboard.documentId, policy: { mode: 'follow' } }) === 'mounted', 'Saved dashboard did not mount.');
    check(active);
    if (archive) {
      for (const [view, saved] of [[liveApp.binding.panel('table'), archive.live[0]], [liveApp.binding.panel('chart'), archive.live[1]], [savedView, archive.saved]]) {
        require(view.restoreSnapshot(saved).ok, 'Public dashboard snapshot restore failed.'); states.set(view, { values: saved.state.values, dirty: saved.state.dirty });
      }
    }
    await ready();
  };
  const descriptors = stage => {
    if (stage === 'presentation') return [];
    if (stage === 'second') return [{ id: 'save-restored', native: { action: 'click', selector: '[data-memory-saved] [data-gen-id="submit"] button' } }];
    require(stage === 'initial', 'Unknown dashboard native stage.');
    return [{ id: 'edit-live-note', native: { action: 'fill', selector: '[data-memory-live] [data-gen-id="note"] input', value: notes.live } },
      { id: 'edit-saved-note', native: { action: 'fill', selector: '[data-memory-saved] [data-gen-id="note"] input', value: notes.saved } },
      { id: 'save-initial', native: { action: 'click', selector: '[data-memory-saved] [data-gen-id="submit"] button' } }];
  };
  const clearPresentation = async () => {
    presentation?.abort(); native?.cancel(); native = undefined;
    for (const item of pendingRequests) item.controller.abort();
    await Promise.allSettled([...pendingRequests].map(item => item.completed)); await Promise.allSettled([...pendingQueries]);
    savedApp?.dispose(); liveApp?.dispose(); unregister?.(); savedBinding?.dispose();
    root?.removeEventListener('lr-gen-state-change', changed); root?.removeEventListener('lr-gen-action', onAction); root?.remove();
    root = liveRoot = savedRoot = echo = liveApp = savedApp = savedBinding = savedView = unregister = presentation = universe = undefined;
    states.clear(); sourceCharacters = 0; higherDefault = false; restored = false;
  };
  const disposePresentation = async () => { await clearPresentation(); await Promise.allSettled([...tasks]); };
  return {
    async mount() { return track(async () => { try { await construct(undefined); } catch (error) { await clearPresentation(); throw error; } }); },
    nativeActions: descriptors,
    armNative(id) {
      require(!native && root, 'Native dashboard operation is already pending or unmounted.');
      const editing = id.startsWith('edit-'), view = id === 'edit-live-note' ? liveApp.binding.panel('table') : savedView;
      require(descriptors(higherDefault ? 'second' : 'initial').some(item => item.id === id), 'Unexpected dashboard native action.');
      const target = node(view, editing ? 'note' : 'submit').shadowRoot.querySelector(editing ? 'input' : 'button');
      const eventType = editing ? 'input' : 'click', semanticType = editing ? 'lr-gen-state-change' : 'lr-gen-action';
      let receipt = false, semantic = false, resolve, reject;
      const completion = new Promise((yes, no) => { resolve = yes; reject = no; }); void completion.catch(() => {});
      const clear = () => { target.removeEventListener(eventType, received, true); view.removeEventListener(semanticType, committed); presentation?.signal.removeEventListener('abort', cancel); };
      const cancel = () => { clear(); reject(new Error('Native dashboard action aborted.')); };
      const finish = () => { if (receipt && semantic) { clear(); resolve(); } };
      const received = event => { if (!event.isTrusted) { clear(); reject(new Error('Dashboard action requires trusted native input.')); return; } receipt = true; finish(); };
      const committed = event => { if (event.target === view) { semantic = true; finish(); } };
      target.addEventListener(eventType, received, true); view.addEventListener(semanticType, committed); presentation.signal.addEventListener('abort', cancel, { once: true });
      native = { id, completion, cancel };
    },
    async completeNative(id) { return track(async () => {
      require(native?.id === id, 'Dashboard native completion changed identity.'); const current = native;
      try { await current.completion; await ready(); if (actionFailure) throw actionFailure;
        if (id.startsWith('edit-')) require(node(id === 'edit-live-note' ? liveApp.binding.panel('table') : savedView, 'note').value === (id === 'edit-live-note' ? notes.live : notes.saved), 'Native note edit did not commit.');
        else require(actions === (id === 'save-initial' ? 1 : 2), 'Native save did not execute exactly once.');
      } finally { current.cancel(); if (native === current) native = undefined; }
    }); },
    async completeMount() { await ready(); },
    async save() { return track(async () => {
      require(actions === 1 && !restored && !higherDefault && !savedThisPresentation, 'Dashboard save requires the first action only.');
      const previousRevision = instanceRevision;
      const saved = await request('save-state', { expectedRevision: previousRevision, state: { version: 1, values: { note: notes.saved } } });
      require(saved.revision === previousRevision + 1, 'Saved instance CAS revision did not advance once.'); instanceRevision = saved.revision; savedThisPresentation = true;
      return validateMemoryDashboardArchive({ version: 1, cycle, instanceRevision, layout: structuredClone(liveApp.binding.state),
        live: [snapshot(liveApp.binding.panel('table')), snapshot(liveApp.binding.panel('chart'))], saved: snapshot(savedView) }, cycle);
    }); },
    releaseSources() { require(root && actions === 1 && savedThisPresentation, 'No dashboard sources to release.'); universe = undefined; sourceCharacters = 0; },
    disposePresentation,
    async restore(archive) { return track(async () => { validateMemoryDashboardArchive(archive, cycle);
      try { await construct(archive); } catch (error) { await clearPresentation(); throw error; }
    }); },
    async applyHigherRevision() { return track(async () => {
      require(root && restored && actions === 1 && !higherDefault, 'Dashboard higher revision is out of sequence.');
      const live = liveApp.binding.panel('table'), revised = structuredClone(live.document); revised.revision = liveBaseRevision + 1;
      revised.root.children.find(child => child.id === 'note').props.value = `New live default ${cycle}`;
      liveApp.binding.updatePanel('table', revised);
      const saved = createViewDefinition('V', { revision: 1, surfaceId: 'saved-report', noteDefault: `New saved default ${cycle}` }); saved.catalog = { id: catalog.id, version: catalog.version };
      savedBinding.updatePanel('report', saved); higherDefault = true; await ready();
      require(node(live, 'note').value === notes.live && node(savedView, 'note').value === notes.saved && actions === 1, 'Higher defaults overwrote dirty state or replayed an action.');
    }); },
    readOracle(phase) {
      const expected = expectedMemoryApplication(phase, { cycle }), gone = phase === 'disposed' || phase === 'restored-disposed';
      require(!actionFailure && !native && activeWork === 0 && pendingRequests.size === 0 && pendingQueries.size === 0, 'Dashboard has pending or failed work.');
      require(actions === expected.actions, 'Dashboard action count differs.');
      if (gone) { require(!root && !liveApp && !savedApp && !savedView && states.size === 0 && !universe && host.childNodes.length === 0, 'Disposed dashboard retained presentation.'); return expected; }
      require(root?.isConnected && visible(root) && views().length === 3 && views().every(view => view.status === 'ready'), 'Full dashboard is not ready.');
      const tableView = liveApp.binding.panel('table'), chart = node(liveApp.binding.panel('chart'), 'summary'), table = node(tableView, 'records');
      require(table.rows.length === 100 && table.columns.length === 2 && table.pageSize === 100, 'Live page bounds changed.');
      const rendered = [...table.shadowRoot.querySelectorAll('tbody tr')]; require(rendered.length === 100, 'Live rendered page was truncated.');
      for (let index = 0; index < 100; index++) {
        const label = `${index < 50 ? 'Focus' : 'Record'}-${String(index).padStart(3, '0')}`, cells = rendered[index].querySelectorAll('td');
        require(table.rows[index].c0 === label && table.rows[index].c1 === index + 1 && cells.length === 2 && cells[0].textContent.trim() === label && cells[1].textContent.trim() === String(index + 1), 'Live page data changed.');
        require(chart.labels[index] === label && chart.datasets[0].data[index] === index + 1, 'Live chart differs from its page.');
        require(liveApp.valueSources.querySelector(`[data-value-pointer="/${index}/c1"] button`)?.textContent === 'Reviewed report', 'Live value provenance is missing.');
      }
      assertDashboardChartShape(chart, 100, true);
      require(liveApp.live.snapshot.status === 'ready' && !liveApp.overview.hidden && liveApp.detail.hidden && liveApp.queue.metrics.items === 0 && liveApp.binding.state.panels.length === 2, 'Live application state changed.');
      assertViewSemantics(savedView, { workload: 'V', revision: higherDefault ? 1 : 0, surfaceId: 'saved-report', note: notes.saved });
      require(savedApp.current?.selectedRevision === 2 && savedRoot.querySelectorAll('lr-dashboard-grid').length === 1, 'Saved application publication/layout changed.');
      require(node(tableView, 'note').value === notes.live && states.get(tableView)?.dirty.includes('/note') && states.get(savedView)?.dirty.includes('/note'), 'Dirty dashboard ownership was lost.');
      require(higherDefault === (phase === 'restored') && echo.textContent === `Live: ${notes.live}; saved: ${notes.saved}; actions: ${actions}`, 'Dashboard visible result differs.');
      if (phase === 'released') require(!universe && sourceCharacters === 0, 'Released dashboard retained source data.');
      return { ...expected, actions, liveRows: table.rows.length, liveColumns: table.columns.length, liveSeries: chart.datasets.length,
        savedRows: node(savedView, 'table').rows.length, savedSeries: node(savedView, 'chart').datasets.length, liveNote: node(tableView, 'note').value, savedNote: node(savedView, 'note').value, higherDefault };
    },
    metrics() { return { sourceCharacters, controllerParts: views().length, controllerIslands: views().length,
      pendingOperations: activeWork + pendingRequests.size + pendingQueries.size + (native ? 1 : 0), actions }; },
    async close() { closed = true; await disposePresentation(); signal?.removeEventListener('abort', abort); runtime = catalog = undefined; },
  };
}
