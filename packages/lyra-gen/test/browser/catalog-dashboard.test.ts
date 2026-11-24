import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { setReducedMotion } from '../../../lyra-ui/test/wtr-media.js';
import { dashboardCatalog, initialCatalog, liveDashboardCatalog, mapCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

interface UpdatingElement extends HTMLElement { readonly updateComplete: Promise<boolean> }
const overlay = dashboardCatalog();
const overlayRoles = Object.keys(overlay.components).filter(role => !Object.hasOwn(initialCatalog.components, role));

/** Authored independently of the reviewed examples; every overlay role needs one (checked below). */
const scenarios: Readonly<Record<string, LyraGenNode>> = {
  gauge: { id: 'subject', type: 'gauge', props: { label: 'Disk usage', value: 86, min: 0, max: 100, valueText: '86%', thresholds: [{ at: 0, variant: 'success' }, { at: 70, variant: 'warning' }, { at: 85, variant: 'danger' }] } },
  sparkline: { id: 'subject', type: 'sparkline', props: { label: 'Error rate this week', values: [3, 2, 4, 1, 0, 2, 1], mark: 'bar', trend: 'negative' } },
  'progress-bar': { id: 'subject', type: 'progress-bar', props: { label: 'Backfill progress', value: 65, max: 100, withValue: true, variant: 'brand' } },
  'progress-ring': { id: 'subject', type: 'progress-ring', props: { label: 'Checks passed', value: 7, max: 9 } },
  'budget-meter': { id: 'subject', type: 'budget-meter', props: { label: 'API calls this month', used: 8200, limit: 10000, unit: 'calls' } },
  'number-ticker': { id: 'subject', type: 'number-ticker', props: { value: 0.42, type: 'percent', maximumFractionDigits: 1 } },
  funnel: { id: 'subject', type: 'funnel', props: { label: 'Checkout funnel', stages: [{ label: 'Cart', value: 500 }, { label: 'Shipping', value: 310 }, { label: 'Paid', value: 205 }], comparison: [{ label: 'Cart', value: 450 }, { label: 'Shipping', value: 300 }, { label: 'Paid', value: 190 }], comparisonLabel: 'Last week' } },
  'poll-status': { id: 'subject', type: 'poll-status', props: { active: true, nextInMs: 15000 } },
  tabs: { id: 'subject', type: 'tabs', props: { label: 'Service views' }, children: [
    { id: 'latency-tab', type: 'tab', slot: 'nav', props: { panel: 'latency' }, text: 'Latency' },
    { id: 'errors-tab', type: 'tab', slot: 'nav', props: { panel: 'errors' }, text: 'Errors' },
    { id: 'latency-panel', type: 'tab-panel', props: { name: 'latency' }, children: [{ id: 'latency-text', type: 'text', text: 'Median 120 ms.' }] },
    { id: 'errors-panel', type: 'tab-panel', props: { name: 'errors' }, children: [{ id: 'errors-text', type: 'text', text: 'No errors today.' }] },
  ] },
  tab: { id: 'tab-parent', type: 'tabs', props: { label: 'Single view' }, children: [
    { id: 'subject', type: 'tab', slot: 'nav', props: { panel: 'only' }, text: 'Only view' },
    { id: 'only-panel', type: 'tab-panel', props: { name: 'only' }, children: [{ id: 'only-text', type: 'text', text: 'Content.' }] },
  ] },
  'tab-panel': { id: 'panel-parent', type: 'tabs', props: { label: 'Panel view' }, children: [
    { id: 'panel-tab', type: 'tab', slot: 'nav', props: { panel: 'main' }, text: 'Main' },
    { id: 'subject', type: 'tab-panel', props: { name: 'main' }, children: [{ id: 'main-text', type: 'text', text: 'Main content.' }] },
  ] },
  details: { id: 'subject', type: 'details', props: { summary: 'Data sources', open: true }, children: [{ id: 'sources-text', type: 'text', text: 'Billing export and usage logs.' }] },
  timeline: { id: 'subject', type: 'timeline', props: { label: 'Deployment history', ordered: true }, children: [
    { id: 'deploy-1', type: 'timeline-item', props: { timestamp: '2026-11-18T10:00:00Z' }, text: 'Version 4 deployed' },
    { id: 'deploy-2', type: 'timeline-item', props: { timestamp: '2026-11-21T15:30:00Z', variant: 'warning' }, text: 'Rollback started' },
  ] },
  'timeline-item': { id: 'item-parent', type: 'timeline', props: { label: 'Single event' }, children: [{ id: 'subject', type: 'timeline-item', props: { timestamp: '2026-11-22T12:00:00Z', variant: 'success' }, text: 'Audit passed' }] },
  'series-chart': { id: 'subject', type: 'series-chart', props: { label: 'Requests and errors', type: 'line', area: true, labels: ['08:00', '09:00', '10:00'], datasets: [{ label: 'Requests', data: [120, 180, 150] }, { label: 'Errors', data: [2, null, 4], axis: 'y2' }], yLabel: 'Requests', y2Label: 'Errors', withDataTable: true } },
  treemap: { id: 'subject', type: 'treemap', props: { label: 'Storage by team', nodes: [{ id: 'eng', label: 'Engineering', children: [{ id: 'eng-logs', label: 'Logs', value: 30 }, { id: 'eng-builds', label: 'Builds', value: 20 }] }, { id: 'ops', label: 'Operations', value: 25 }] } },
  sankey: { id: 'subject', type: 'sankey', props: { label: 'Ticket routing', nodes: [{ id: 'new', label: 'New' }, { id: 'triage', label: 'Triage' }, { id: 'done', label: 'Resolved' }], links: [{ source: 'new', target: 'triage', value: 40 }, { source: 'triage', target: 'done', value: 32 }] } },
  heatmap: { id: 'subject', type: 'heatmap', props: { label: 'Requests by weekday and hour', valueLabel: 'Requests', data: { kind: 'matrix', rowLabels: ['Mon', 'Tue', 'Wed'], colLabels: ['00', '06', '12', '18'], values: [[2, 8, 20, 11], [3, 9, 22, 10], [1, 7, 19, 12]] } } },
  'data-grid': { id: 'subject', type: 'data-grid', props: { label: 'Open incidents', columns: [{ field: 'c0', label: 'Incident', sortable: true }, { field: 'c1', label: 'Severity' }, { field: 'c2', label: 'Age (h)', sortable: true, align: 'end' }], data: [{ c0: 'INC-12', c1: 'High', c2: 5 }, { c0: 'INC-13', c1: 'Low', c2: 30 }] } },
  'time-range': { id: 'subject', type: 'time-range', props: { min: 0, max: 30, start: 7, end: 14, step: 1, startLabel: 'First day', endLabel: 'Last day' } },
  'filter-bar': { id: 'subject', type: 'filter-bar', props: { label: 'Incident filters', filters: [{ filterId: 'severity', label: 'Severity', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'low', label: 'Low' }] }], value: { severity: 'high' } } },
  'word-cloud': { id: 'subject', type: 'word-cloud', props: { words: [{ text: 'timeout', weight: 9 }, { text: 'billing', weight: 5 }, { text: 'login', weight: 3 }] } },
};

function findSubject(node: LyraGenNode): LyraGenNode {
  if (node.id === 'subject') return node;
  for (const child of node.children ?? []) { const found = findSubject(child); if (found.id === 'subject') return found; }
  return node;
}

async function mount(root: LyraGenNode, catalog: LyraGenCatalog = overlay, dir: 'ltr' | 'rtl' = 'ltr'): Promise<{ host: LyraGenViewElement; subject: UpdatingElement }> {
  const document: LyraGenView = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'dashboard-qualification', revision: 0, root };
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir}><lr-gen-view .catalog=${catalog} .document=${document}></lr-gen-view></div>`);
  const host = wrapper.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await waitUntil(() => host.status === 'ready' || host.status === 'error', 'Dashboard role settled', { timeout: 5000 });
  expect(host.status).to.equal('ready');
  const subject = host.shadowRoot!.querySelector<UpdatingElement>('[data-gen-id="subject"]');
  expect(subject !== null).to.equal(true);
  await subject!.updateComplete;
  return { host, subject: subject! };
}

describe('dashboard overlay rendered qualification', () => {
  it('keeps an explicit populated scenario for every overlay role', () => {
    expect(Object.keys(scenarios).sort()).to.deep.equal([...overlayRoles].sort());
  });

  for (const [role, root] of Object.entries(scenarios)) {
    it(`renders populated ${role} with its trusted tag and accessible semantics in LTR and RTL`, async () => {
      for (const dir of ['ltr', 'rtl'] as const) {
        const { host, subject } = await mount(root, overlay, dir);
        expect(subject.localName).to.equal(overlay.components[role]!.tag);
        for (const [key, value] of Object.entries(findSubject(root).props ?? {})) expect(Reflect.get(subject, key)).to.deep.equal(value);
        await expect(host).to.be.accessible();
      }
    });
  }

  it('settles every overlay role under reduced motion', async () => {
    await setReducedMotion('reduce');
    try {
      for (const root of Object.values(scenarios)) {
        const { host } = await mount(root);
        await expect(host).to.be.accessible();
      }
    } finally { await setReducedMotion('no-preference'); }
  });

  it('drives a gauge and a progress bar live from one slider through reads', async () => {
    const root: LyraGenNode = { id: 'root', type: 'stack', children: [
      { id: 'limit', type: 'slider', props: { label: 'Target load', min: 0, max: 100, step: 1, value: 30 }, bindings: { value: '/target' } },
      { id: 'subject', type: 'gauge', props: { label: 'Target preview', value: 0, max: 100 }, reads: { value: '/target' } },
      { id: 'bar', type: 'progress-bar', props: { label: 'Target share', value: 0, max: 100 }, reads: { value: '/target' } },
    ] };
    const { host, subject } = await mount(root, liveDashboardCatalog);
    const bar = host.shadowRoot!.querySelector<HTMLElement>('[data-gen-id="bar"]')!;
    expect(Reflect.get(subject, 'value')).to.equal(30);
    const slider = host.shadowRoot!.querySelector<HTMLElement & { value: number }>('[data-gen-id="limit"]')!;
    slider.value = 75;
    slider.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true }));
    await waitUntil(() => Reflect.get(subject, 'value') === 75 && Reflect.get(bar, 'value') === 75, 'Read-bound roles follow the slider');
    await expect(host).to.be.accessible();
  });

  /** CI does not build the optional map engine peer; its single load warning is expected here and nowhere else. */
  async function withoutMapPeerWarning(run: () => Promise<void>): Promise<void> {
    const original = console.warn;
    console.warn = (...args: unknown[]) => { if (!String(args[0]).includes('could not load the optional peer dependency')) original(...args); };
    try { await run(); } finally { console.warn = original; }
  }

  it('renders a generated map with host-owned style and bounded markers', () => withoutMapPeerWarning(async () => {
    const mapStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dde4ea' } }] };
    const catalog = mapCatalog(overlay, { mapStyle });
    const root: LyraGenNode = { id: 'subject', type: 'map', props: { label: 'Regional offices', center: [10, 50], zoom: 3, markers: [{ id: 'berlin', lngLat: [13.4, 52.52], label: 'Berlin' }, { id: 'madrid', lngLat: [-3.7, 40.42], label: 'Madrid' }] } };
    const { host, subject } = await mount(root, catalog);
    expect(subject.localName).to.equal('lr-map');
    expect(JSON.stringify(Reflect.get(subject, 'mapStyle'))).to.equal(JSON.stringify(mapStyle));
    expect((Reflect.get(subject, 'markers') as readonly { label: string }[]).map(marker => marker.label)).to.deep.equal(['Berlin', 'Madrid']);
    expect(Reflect.get(subject, 'label')).to.equal('Regional offices');
    await expect(host).to.be.accessible();
  }));

  it('colours host-declared regions from generated choropleth values', () => withoutMapPeerWarning(async () => {
    const mapStyle = { version: 8, sources: {}, layers: [] };
    const square = (code: string, x: number) => ({ type: 'Feature' as const, properties: { code }, geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 4, 0], [x + 4, 4], [x, 4], [x, 0]]] } });
    const catalog = mapCatalog(overlay, { mapStyle, regions: { geojson: { type: 'FeatureCollection', features: [square('west', 0), square('east', 5)] }, idProperty: 'code' } });
    const root: LyraGenNode = { id: 'subject', type: 'map', props: { label: 'Sales by region', center: [4, 2], zoom: 3, choropleth: { values: { west: 12, east: 30 } }, choroplethLegend: true } };
    const { host, subject } = await mount(root, catalog);
    const layer = Reflect.get(subject, 'choropleth') as { field: string; geojson: { features: { properties: Record<string, unknown> }[] } };
    expect(layer.geojson.features.map(feature => feature.properties[layer.field])).to.deep.equal([12, 30]);
    expect(Reflect.get(subject, 'choroplethLegend')).to.equal(true);
    await expect(host).to.be.accessible();
  }));
});
