import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { render, type CSSResult, type TemplateResult } from 'lit';
import type { LyraTable } from '@aceshooting/lyra-ui/components/lr-table.js';
import type { LyraLiteChart } from '@aceshooting/lyra-ui/components/lr-lite-chart.js';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { mountLiveDashboard } from '../../examples/dashboard.js';
import type { DashboardExampleOptions, DashboardExampleRow } from '../../examples/dashboard.js';
import { HostQueryRegistry } from '../../src/live-data.js';
import type { DashboardQueryResult } from '../../src/live-data.js';
import { DashboardGridBinding, bindDashboardSelection } from '../../src/dashboard-binding.js';
import { SharedDashboardState } from '../../src/dashboard.js';
import { initialCatalog } from '../../src/catalog.js';
import { exportLyraTemplate } from '../../src/export.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenView } from '../../src/types.js';

const context = { viewerId: 'viewer', tenantId: 'tenant', authorizationRevision: '1' };
const labels: DashboardExampleOptions['labels'] = { title: 'Activity dashboard', table: 'Activity records', chart: 'Activity by category', note: 'Personal note', refresh: 'Refresh', cancel: 'Cancel', pin: 'Pin records', unpin: 'Unpin records', category: 'Category', value: 'Value', sharedFilter: 'Shared category filter', previous: 'Previous page', next: 'Next page', overview: 'Overview', back: 'Back to overview', navigationDenied: 'Detail is unavailable.', detail: row => `Details: ${row.c0}`, page: page => `requested:${page.requestedOffset};shown:${page.shownOffset};limit:${page.limit};${page.stale ? 'stale' : 'fresh'}`, selection: ids => `Selected: ${ids.join(', ')}`, queue: metrics => `${metrics.items} pending; ${metrics.dropped} dropped`, provenance: snapshot => `${snapshot.result?.sources?.map(source => `${source.label}@${source.updatedAt}`).join(', ') || 'Unverified'}; ${snapshot.result?.sampled ? 'sampled' : 'complete'}; ${snapshot.result?.aggregation ?? 'raw'}; received:${snapshot.receivedAt ?? 'pending'}`, layoutError: code => code === 'save-failed' ? 'Layout could not be saved.' : 'Invalid layout.', status: snapshot => `${snapshot.status}${snapshot.stale ? ':stale' : ':fresh'}` };
const records = [{ c0: 'North', c1: 12 }, { c0: 'South', c1: 34 }];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function mounted(options: Partial<DashboardExampleOptions> = {}) {
  const registry = options.registry ?? new HostQueryRegistry();
  if (!options.registry) registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: () => true, execute: async () => ({ data: records }) });
  const root = await fixture<HTMLElement>(html`<section style="inline-size: 100%; max-inline-size: 60rem"></section>`);
  const dashboard = mountLiveDashboard(root, { registry, context, query: 'records', labels, ...options });
  await dashboard.ready;
  await waitUntil(() => dashboard.binding.panel('table')!.shadowRoot!.querySelector('lr-table') !== null && dashboard.binding.panel('chart')!.shadowRoot!.querySelector('lr-lite-chart') !== null);
  return { ...dashboard, root };
}
function table(dashboard: Awaited<ReturnType<typeof mounted>>): LyraTable<DashboardExampleRow, string> { return dashboard.binding.panel('table')!.shadowRoot!.querySelector<LyraTable<DashboardExampleRow, string>>('lr-table')!; }
function chart(dashboard: Awaited<ReturnType<typeof mounted>>): LyraLiteChart { return dashboard.binding.panel('chart')!.shadowRoot!.querySelector('lr-lite-chart')!; }
function cell(dashboard: Awaited<ReturnType<typeof mounted>>, id = 'table'): HTMLElement {
  const result = dashboard.grid.shadowRoot!.querySelector<HTMLElement>(`[part="cell"][data-cell-id="${id}"]`);
  if (!result) throw new Error('Dashboard cell was not rendered');
  return result;
}
async function loaded(dashboard: Awaited<ReturnType<typeof mounted>>, category = 'South') {
  await waitUntil(() => table(dashboard).shadowRoot?.textContent?.includes(category) ?? false);
  await chart(dashboard).updateComplete;
}

describe('controlled generated dashboard composition', () => {
  it('rejects accessor-bearing saved panel definitions before invoking them or changing the grid', async () => {
    const dashboard = await mounted();
    try {
      let reads = 0;
      let rejected = false;
      try {
        new DashboardGridBinding({ grid: dashboard.grid, catalog: initialCatalog, state: dashboard.binding.state, constraints: { columns: 6, maxRows: 20, maxPanels: 4, collision: 'reject' }, panels: [{ get id() { reads++; return 'table'; }, view: dashboard.binding.panel('table')!.document! }] });
      } catch { rejected = true; }
      expect(rejected).to.equal(true);
      expect(reads).to.equal(0);
      expect(dashboard.grid.querySelectorAll('lr-gen-view').length).to.equal(2);
    } finally { dashboard.dispose(); }
  });

  it('persists native keyboard move/resize/pin requests and preserves edited generated controls', async () => {
    const saved: unknown[] = [];
    const dashboard = await mounted({ persist: async next => { saved.push(next); return true; } });
    try {
      const view = dashboard.binding.panel('table')!;
      const note = view.shadowRoot!.querySelector<HTMLElement & { value: string; updateComplete: Promise<boolean> }>('[data-gen-id="note"]')!;
      note.value = 'Keep my draft';
      note.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true }));
      await view.updateComplete;
      await focusByKeyboard(cell(dashboard));
      await sendKeys({ press: 'Control+ArrowDown' });
      await waitUntil(() => dashboard.binding.state.revision === 1);
      expect(dashboard.binding.state.panels[0]!.row).to.equal(1);
      await sendKeys({ press: 'Control+Shift+ArrowDown' });
      await waitUntil(() => dashboard.binding.state.revision === 2);
      expect(dashboard.binding.state.panels[0]!.height).to.equal(5);
      dashboard.root.querySelectorAll('button')[2]!.click();
      await waitUntil(() => dashboard.binding.state.panels[0]!.pinned === true);
      await focusByKeyboard(cell(dashboard));
      await sendKeys({ press: 'Control+ArrowDown' });
      expect(dashboard.binding.state.revision).to.equal(3);
      expect(dashboard.grid.layout[0]!.locked).to.equal(true);
      expect(dashboard.binding.panel('table') === view).to.equal(true);
      expect(note.value).to.equal('Keep my draft');
      const restored = await mounted({ layout: dashboard.binding.state });
      try { expect(restored.binding.state).to.deep.equal(dashboard.binding.state); }
      finally { restored.dispose(); }
      expect(saved.length).to.equal(3);
    } finally { dashboard.dispose(); }
  });

  it('keeps native RTL keyboard operation and populated content inside a narrow allocation', async () => {
    const dashboard = await mounted({ layout: { version: 1, revision: 0, panels: [{ id: 'table', column: 0, row: 0, width: 2, height: 4 }, { id: 'chart', column: 3, row: 0, width: 3, height: 4 }] } });
    try {
      dashboard.root.style.inlineSize = '320px';
      dashboard.root.dir = 'rtl';
      await dashboard.refresh(); await loaded(dashboard);
      await focusByKeyboard(cell(dashboard));
      await sendKeys({ press: 'Control+ArrowLeft' });
      await waitUntil(() => dashboard.binding.state.revision === 1);
      expect(dashboard.binding.state.panels[0]!.column).to.equal(1);
      await sendKeys({ press: 'ArrowLeft' });
      expect(dashboard.grid.shadowRoot!.activeElement?.getAttribute('data-cell-id')).to.equal('chart');
      expect(dashboard.grid.getBoundingClientRect().width).to.be.at.most(320);
      expect(dashboard.root.scrollWidth).to.be.at.most(321);
      await expect(dashboard.root).to.be.accessible();
    } finally { dashboard.dispose(); }
  });

  it('links real chart/table activation once, keeps independent filters and clears dangling selections', async () => {
    let sourceRows = records;
    const registry = new HostQueryRegistry();
    registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: () => true, execute: async () => ({ data: sourceRows }) });
    const dashboard = await mounted({ registry });
    try {
      await dashboard.refresh(); await loaded(dashboard);
      let updates = 0;
      const off = dashboard.shared.subscribe('records', 'observer', () => { updates++; });
      table(dashboard).filterText = 'North';
      dashboard.shared.update('inventory', 'host', { filters: { region: 'Independent' } });
      const mark = chart(dashboard).shadowRoot!.querySelector<SVGElement>('[part="bar"][data-index="1"]')!;
      await focusByKeyboard(mark as unknown as HTMLElement);
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => dashboard.shared.snapshot('records').selection[0] === 'South');
      expect(updates).to.equal(1);
      expect([...table(dashboard).selectedRowKeys]).to.deep.equal(['South']);
      expect(table(dashboard).filterText).to.equal('North');
      expect(dashboard.shared.snapshot('inventory').filters).to.deep.equal({ region: 'Independent' });
      expect(dashboard.selected.textContent).to.equal('Selected: South');
      expect(chart(dashboard).description).to.equal('Selected: South');
      table(dashboard).filterText = '';
      await table(dashboard).updateComplete;
      await focusByKeyboard(table(dashboard).rowElement('North')!);
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => dashboard.shared.snapshot('records').selection[0] === 'North');
      expect(updates).to.equal(2);
      expect(chart(dashboard).description).to.equal('Selected: North');
      sourceRows = [{ c0: 'South', c1: 34 }];
      await dashboard.refresh(); await loaded(dashboard);
      await waitUntil(() => dashboard.shared.snapshot('records').selection.length === 0);
      expect([...table(dashboard).selectedRowKeys]).to.deep.equal([]);
      off();
      await expect(table(dashboard)).to.be.accessible();
      await expect(chart(dashboard)).to.be.accessible();
    } finally { dashboard.dispose(); }
  });

  it('retains off-page selection until the host supplies a complete set of remaining record ids', async () => {
    const dashboard = await mounted();
    const shared = new SharedDashboardState(() => true);
    const linked = bindDashboardSelection({ table: table(dashboard), chart: chart(dashboard), shared, scope: 'projection', rowId: row => row.c0, keys: ['North', 'South'] });
    try {
      shared.update('projection', 'host', { selection: ['South'] });
      linked.setKeys(['North']);
      expect(shared.snapshot('projection').selection).to.deep.equal(['South']);
      expect([...table(dashboard).selectedRowKeys]).to.deep.equal(['South']);
      linked.setKeys(['North'], new Set(['North']));
      expect(shared.snapshot('projection').selection).to.deep.equal([]);
      expect([...table(dashboard).selectedRowKeys]).to.deep.equal([]);
    } finally { linked.dispose(); shared.dispose(); dashboard.dispose(); }
  });

  it('keeps burst batches bounded and discloses drops while retaining only the latest response', async () => {
    const dashboard = await mounted();
    try {
      for (let index = 0; index < 1000; index++) dashboard.enqueue(index);
      expect(dashboard.queue.metrics.items).to.equal(4);
      expect(dashboard.queue.metrics.dropped).to.equal(996);
      expect(dashboard.queued.textContent).to.equal('4 pending; 996 dropped');
      expect(await dashboard.flush()).to.equal(2);
      await loaded(dashboard);
      expect(dashboard.queue.metrics.items).to.equal(2);
      expect(await dashboard.flush()).to.equal(2);
      expect(dashboard.queue.metrics.items).to.equal(0);
      expect(dashboard.status.textContent).to.equal('ready:fresh');
    } finally { dashboard.dispose(); }
  });

  it('discards superseded/cancelled responses, shows stale failures and clears revoked data', async () => {
    const registry = new HostQueryRegistry();
    const pending: ReturnType<typeof deferred<DashboardQueryResult>>[] = [];
    let fail = false;
    registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: current => current.viewerId === 'viewer', execute: async () => {
      if (fail) throw new Error('Host details');
      const request = deferred<DashboardQueryResult>(); pending.push(request); return request.promise;
    } });
    const dashboard = await mounted({ registry });
    try {
      const old = dashboard.refresh(); await waitUntil(() => pending.length === 1);
      const newer = dashboard.refresh(); await waitUntil(() => pending.length === 2);
      pending[1]!.resolve({ data: [{ c0: 'Current', c1: 20 }] }); await newer; await loaded(dashboard, 'Current');
      pending[0]!.resolve({ data: [{ c0: 'Obsolete', c1: 10 }] }); await old;
      expect(table(dashboard).shadowRoot!.textContent).not.to.include('Obsolete');
      const cancelled = dashboard.refresh(); await waitUntil(() => pending.length === 3);
      dashboard.live.cancel(); pending[2]!.resolve({ data: [{ c0: 'Cancelled result', c1: 30 }] }); await cancelled;
      expect(dashboard.status.textContent).to.equal('cancelled:stale');
      expect(table(dashboard).shadowRoot!.textContent).to.include('Current');
      fail = true; await dashboard.refresh();
      expect(dashboard.status.textContent).to.equal('error:stale');
      expect(table(dashboard).shadowRoot!.textContent).not.to.include('Host details');
      const note = dashboard.binding.panel('table')!.shadowRoot!.querySelector<HTMLElement & { value: string }>('[data-gen-id="note"]')!;
      note.value = 'Old viewer draft'; note.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true }));
      await dashboard.binding.panel('table')!.updateComplete;
      dashboard.shared.update('query', 'host', { filters: { category: 'Old scope' } });
      dashboard.live.setContext({ ...context, viewerId: 'revoked' });
      await dashboard.refresh();
      await waitUntil(() => !(table(dashboard).shadowRoot!.textContent ?? '').includes('Current'));
      expect(dashboard.status.textContent).to.equal('denied:stale');
      expect(note.value).to.equal('');
      expect(dashboard.shared.snapshot('query').filters).to.deep.equal({});
    } finally { dashboard.dispose(); }
  });

  it('shows partial freshness, source timestamps and sampled aggregation metadata beside real data', async () => {
    const registry = new HostQueryRegistry();
    registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: () => true, execute: async () => ({ data: records, partial: true, sampled: true, aggregation: 'daily', sources: [{ id: 'public-source', label: 'Published record', updatedAt: 5 }], lineage: { '/0/c1': 'public-source' } }) });
    const dashboard = await mounted({ registry });
    try {
      await dashboard.refresh(); await loaded(dashboard);
      expect(dashboard.status.textContent).to.equal('partial:stale');
      expect(dashboard.provenance.textContent).to.include('Published record@5; sampled; daily; received:');
      expect(dashboard.live.snapshot.receivedAt).to.be.a('number');
      await expect(dashboard.root).to.be.accessible();
    } finally { dashboard.dispose(); }
  });

  it('filters both tiles through the host query and returns from table/chart drilldown with parent edits intact', async () => {
    const registry = new HostQueryRegistry();
    const requests: { readonly category: unknown; readonly limit: unknown }[] = [];
    registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: () => true, execute: async params => {
      requests.push({ category: params['category'], limit: params['limit'] });
      return { data: records.filter(row => !params['category'] || row.c0.includes(String(params['category']))).slice(Number(params['offset']), Number(params['offset']) + Number(params['limit'])) };
    } });
    const dashboard = await mounted({ registry, authorizeDrilldown: id => id === 'North' });
    try {
      await dashboard.refresh(); await loaded(dashboard);
      const view = dashboard.binding.panel('table')!;
      const note = view.shadowRoot!.querySelector<HTMLElement & { value: string }>('[data-gen-id="note"]')!;
      note.value = 'Parent draft'; note.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true })); await view.updateComplete;
      table(dashboard).filterText = 'N';
      const filter = dashboard.root.querySelector<HTMLInputElement>('input[name="category"]')!;
      await focusByKeyboard(filter); await sendKeys({ type: 'North' }); await sendKeys({ press: 'Tab' });
      await waitUntil(() => chart(dashboard).labels.length === 1 && chart(dashboard).labels[0] === 'North');
      expect(table(dashboard).rows.map(row => row.c0)).to.deep.equal(['North']);
      expect(table(dashboard).filterText).to.equal('N');
      expect(requests.at(-1)?.category).to.equal('North');
      expect(requests.at(-1)?.limit).to.equal(20);
      dashboard.root.style.blockSize = '320px'; dashboard.root.style.overflow = 'auto'; dashboard.root.scrollTop = 100;
      await focusByKeyboard(table(dashboard).rowElement('North')!);
      const before = dashboard.root.scrollTop;
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => !dashboard.detail.hidden);
      expect(dashboard.breadcrumbs.textContent).to.include('Details: North');
      expect(dashboard.overview.hidden).to.equal(true);
      dashboard.root.querySelector<HTMLButtonElement>('[data-action="back"]')!.click();
      await waitUntil(() => dashboard.detail.hidden);
      expect(dashboard.binding.panel('table') === view).to.equal(true);
      expect(note.value).to.equal('Parent draft');
      expect(table(dashboard).filterText).to.equal('N');
      expect(dashboard.shared.snapshot('records').selection).to.deep.equal(['North']);
      expect(dashboard.shared.snapshot('query').filters['category']).to.equal('North');
      expect(dashboard.root.scrollTop).to.equal(before);
      expect(before).to.be.greaterThan(0);
      await waitUntil(() => chart(dashboard).shadowRoot!.querySelector('[part="bar"]') !== null);
      const mark = chart(dashboard).shadowRoot!.querySelector<SVGElement>('[part="bar"]')!;
      await focusByKeyboard(mark as unknown as HTMLElement); await sendKeys({ press: 'Enter' });
      await waitUntil(() => !dashboard.detail.hidden);
      expect(await dashboard.back()).to.equal(true);
      expect(dashboard.detail.contains(document.activeElement)).to.equal(false);
      expect(note.value).to.equal('Parent draft');
      await expect(dashboard.root).to.be.accessible();
    } finally { dashboard.dispose(); }
  });

  it('bounds paged query controls and labels retained rows as stale after cancellation and errors', async () => {
    const registry = new HostQueryRegistry();
    const pending: { readonly offset: number; readonly limit: number; readonly response: ReturnType<typeof deferred<DashboardQueryResult>> }[] = [];
    let fail = false;
    registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: () => true, execute: async params => {
      if (fail) throw new Error('Query failed');
      const response = deferred<DashboardQueryResult>(); pending.push({ offset: Number(params['offset']), limit: Number(params['limit']), response }); return response.promise;
    } });
    const dashboard = await mounted({ registry, pageSize: 1, totalRows: 2 });
    try {
      const first = dashboard.refresh(); await waitUntil(() => pending.length === 1);
      pending[0]!.response.resolve({ data: [records[0]!] }); await first; await loaded(dashboard, 'North');
      dashboard.root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
      await waitUntil(() => pending.length === 2);
      expect(pending[1]!.offset).to.equal(1); expect(pending[1]!.limit).to.equal(1);
      expect(dashboard.root.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled).to.equal(true);
      dashboard.live.cancel();
      expect(dashboard.root.querySelector('[data-page]')!.textContent).to.include('requested:1;shown:0;limit:1;stale');
      dashboard.root.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
      await waitUntil(() => pending.length === 3);
      pending[2]!.response.resolve({ data: [{ c0: 'Current page', c1: 50 }] });
      await loaded(dashboard, 'Current page');
      pending[1]!.response.resolve({ data: [{ c0: 'Cancelled page', c1: 99 }] });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(table(dashboard).shadowRoot!.textContent).not.to.include('Cancelled page');
      fail = true; dashboard.root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
      await waitUntil(() => dashboard.status.textContent === 'error:stale');
      expect(table(dashboard).shadowRoot!.textContent).to.include('Current page');
      expect(dashboard.root.querySelector('[data-page]')!.textContent).to.include('requested:1;shown:0;limit:1;stale');
    } finally { dashboard.dispose(); }
  });

  it('keeps inaccessible drilldown destinations in the overview', async () => {
    const dashboard = await mounted({ authorizeDrilldown: () => false });
    try {
      await dashboard.refresh(); await loaded(dashboard);
      expect(await dashboard.drilldown('South')).to.equal(false);
      expect(dashboard.detail.hidden).to.equal(true);
      expect(dashboard.overview.hidden).to.equal(false);
      expect(dashboard.layoutStatus.textContent).to.equal('Detail is unavailable.');
      expect(dashboard.navigation.breadcrumbs.length).to.equal(1);
    } finally { dashboard.dispose(); }
  });

  it('does not apply a failed conditional save or a late save after disposal', async () => {
    const response = deferred<boolean>();
    const dashboard = await mounted({ persist: () => response.promise });
    const pending = dashboard.binding.setPinned('table', true);
    expect(dashboard.grid.readonly).to.equal(true);
    response.resolve(false); expect(await pending).to.equal(false);
    expect(dashboard.binding.state.revision).to.equal(0);
    expect(dashboard.layoutStatus.textContent).to.equal('Layout could not be saved.');
    expect(Boolean(dashboard.grid.layout[0]!.locked)).to.equal(false);
    dashboard.dispose();
    const late = deferred<boolean>();
    let signal: AbortSignal | undefined;
    const removed = await mounted({ persist: (_next, _previous, received) => { signal = received; return late.promise; } });
    const saving = removed.binding.setPinned('table', true);
    removed.dispose(); late.resolve(true);
    expect(await saving).to.equal(false);
    expect(signal?.aborted).to.equal(true);
    expect(removed.binding.state.revision).to.equal(0);
  });
});

describe('graduated public Lit dashboard template', () => {
  it('compiles and renders reviewed table adapters, chart data and structural styles like the generated view', async () => {
    const view: LyraGenView = { version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'export-fixture', revision: 0, root: { id: 'root', type: 'stack', children: [
      { id: 'table', type: 'table', props: { caption: 'Public records', columns: [{ key: 'c0', label: 'Category' }, { key: 'c1', label: 'Value' }], rows: records } },
      { id: 'chart', type: 'chart', props: { label: 'Public chart', labels: ['North', 'South'], datasets: [{ label: 'Value', data: [12, 34] }], withDataTable: true } },
      { id: 'literal', type: 'text', text: '<script>never()</script> ${never()} `literal`\u0000\r\n' },
    ] } };
    const generated = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${initialCatalog} .document=${view}></lr-gen-view>`);
    await waitUntil(() => !generated.shadowRoot!.querySelector('[part="loading"]'));
    const result = exportLyraTemplate(view, initialCatalog, { components: {
      stack: { tag: 'div', properties: [] }, text: { tag: 'p', properties: [] },
      table: { tag: 'lr-table', import: '@aceshooting/lyra-ui/components/lr-table.js', properties: ['caption', 'columns', 'rows'] },
      chart: { tag: 'lr-lite-chart', import: '@aceshooting/lyra-ui/components/lr-lite-chart.js', properties: ['label', 'labels', 'datasets', 'withDataTable'] },
    }, allowProperty: () => true, allowText: () => true });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    // Resolve only the reviewed generated imports through this test server, then compile as an ES module.
    const code = result.value.code.replace(/from 'lit'/g, `from '${new URL('../../node_modules/lit/index.js', import.meta.url).href}'`).replace(/'@aceshooting\/lyra-ui\/components\/([a-z-]+)\.js'/g, (_match, tag: string) => `'${new URL(`../../../lyra-ui/dist/components/${tag}.js`, import.meta.url).href}'`);
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
      const module = await import(url) as { dashboardTemplate: TemplateResult; dashboardStyles: CSSResult };
      const exported = await fixture<HTMLElement>(html`<section></section>`);
      const shadow = exported.attachShadow({ mode: 'open' });
      const style = document.createElement('style'); style.textContent = module.dashboardStyles.cssText; shadow.append(style);
      const content = document.createElement('div'); shadow.append(content); render(module.dashboardTemplate, content);
      const sourceTable = generated.shadowRoot!.querySelector<LyraTable<DashboardExampleRow>>('lr-table')!;
      const targetTable = shadow.querySelector<LyraTable<DashboardExampleRow>>('lr-table')!;
      const sourceChart = generated.shadowRoot!.querySelector<LyraLiteChart>('lr-lite-chart')!;
      const targetChart = shadow.querySelector<LyraLiteChart>('lr-lite-chart')!;
      await Promise.all([sourceTable.updateComplete, targetTable.updateComplete, sourceChart.updateComplete, targetChart.updateComplete]);
      expect(targetTable.shadowRoot!.querySelector('tbody')!.textContent).to.equal(sourceTable.shadowRoot!.querySelector('tbody')!.textContent);
      expect(targetChart.datasets).to.deep.equal(sourceChart.datasets);
      expect(targetChart.labels).to.deep.equal(sourceChart.labels);
      expect(shadow.querySelector('p')!.textContent).to.equal(generated.shadowRoot!.querySelector('[data-gen-id="literal"]')!.textContent);
      expect(getComputedStyle(content.firstElementChild!).display).to.equal('flex');
      expect(shadow.querySelectorAll('script').length).to.equal(0);
      await expect(exported).to.be.accessible();
    } finally { URL.revokeObjectURL(url); }
  });
});
