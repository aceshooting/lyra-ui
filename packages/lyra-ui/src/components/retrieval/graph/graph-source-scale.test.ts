import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph, LyraGraphNode, LyraGraphEdge } from './graph.js';
import type { LyraGraphSource, LyraGraphRecord, LyraSourceRecord, LyraGraphSceneRequest, LyraGraphSourceQuery } from '../../../data-sources.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

type Source = LyraGraphSource<LyraGraphNode, LyraGraphEdge & { readonly id: string }>;
type Record = LyraSourceRecord<LyraGraphRecord<LyraGraphNode, LyraGraphEdge & { readonly id: string }>>;
type SourceGraph = LyraGraph & { graphSource?: Source; sourcePage: number; sourcePageSize: number; readonly sourceTotal: number | null; revealSourceKey(key: string): Promise<boolean> };
const total = { nodes: 1_000_000, edges: 1_000_000 };
function record(kind: 'nodes' | 'edges', index: number, prefix = ''): Record {
  return kind === 'nodes' ? { key: `node:${index}`, order: index, value: { kind: 'node', value: { id: String(index), label: `${prefix}Node ${index}` } } }
    : { key: `edge:${index}`, order: 1_000_000 + index, value: { kind: 'edge', value: { id: String(index), source: '0', target: String(index % 999_999 + 1), label: `${prefix}Edge ${index}` } } };
}
function provider() {
  const queries: { query: LyraGraphSourceQuery; page: number; pageSize: number }[] = [];
  const scenes: LyraGraphSceneRequest[] = [];
  let prefix = ''; let readRows = 0;
  const source: Source = { revision: 1, records: { revision: 1,
    query: async request => { queries.push(request); const start = request.page * request.pageSize;
      const rows = Array.from({ length: Math.min(request.pageSize, 1_000_000 - start) }, (_, offset) => record(request.query.kind, start + offset, prefix)); readRows += rows.length;
      return { rows, total: 1_000_000, summary: total };
    },
    locate: async key => Number(key.slice(key.indexOf(':') + 1)),
    lookup: async keys => keys.map(key => record(key.startsWith('node:') ? 'nodes' : 'edges', Number(key.slice(key.indexOf(':') + 1)), prefix)),
  }, scene: async request => {
    scenes.push(request);
    const keys = request.includeKeys.length ? request.includeKeys : ['node:0'];
    const nodeIds = new Set<string>(); const edges: Awaited<ReturnType<Source['scene']>>['edges'][number][] = [];
    for (const key of keys) {
      if (key.startsWith('node:')) nodeIds.add(key.slice(5));
      else { const item = record('edges', Number(key.slice(5))).value;
        if (item.kind === 'edge') { nodeIds.add(item.value.source); nodeIds.add(item.value.target); edges.push({ key, value: item.value, source: `node:${item.value.source}`, target: `node:${item.value.target}` }); }
      }
    }
    return { nodes: [...nodeIds].map(id => ({ key: `node:${id}`, value: { id, label: `Node ${id}` }, position: { x: Number(id) % 1000, y: 0, z: 0 } })), edges, total, coverage: 'neighborhood', worldBounds: null };
  } };
  return { source, queries, scenes, setPrefix: (value: string) => { prefix = value; }, get readRows() { return readRows; } };
}
const row = (el: LyraGraph, key: string) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-source-key]')].find(node => node.dataset['sourceKey'] === key);
async function ready(el: LyraGraph, key: string): Promise<void> { await waitUntil(() => !!row(el, key), `source row ${key}`, { timeout: 2000 }); }
// Positions arrive after the provider scene and the first layout frames, which can exceed the
// 1 s waitUntil default while other browser test files run in parallel.
async function placed(read: () => unknown, label: string): Promise<void> { await waitUntil(() => !!read(), label, { timeout: 4000 }); }

it('reaches first middle and final nodes and edges in the global million-record navigator without loading diagram peers', async () => {
  const data = provider();
  const graph = document.createElement('lr-graph') as SourceGraph; graph.view = 'list'; graph.graphSource = data.source;
  const seam = graph as unknown as { loadSpatialController(): Promise<never>; connect2d(): void };
  seam.loadSpatialController = () => { throw new Error('List navigation must not import the spatial renderer'); };
  seam.connect2d = () => { throw new Error('List navigation must not import D3'); };
  await fixture(graph);
  await ready(graph, 'node:0'); graph.sourcePage = 5000; await ready(graph, 'node:500000');
  graph.sourcePage = 9999; await ready(graph, 'node:999999');
  const kind = graph.shadowRoot!.querySelector<HTMLSelectElement>('[data-source-kind]')!;
  kind.value = 'edges'; kind.dispatchEvent(new Event('change', { bubbles: true }));
  await ready(graph, 'edge:0'); graph.sourcePage = 5000; await ready(graph, 'edge:500000');
  graph.sourcePage = 9999; await ready(graph, 'edge:999999');
  expect(graph.sourceTotal).to.equal(1_000_000);
  expect(data.scenes.length).to.equal(0);
  expect(data.readRows).to.equal(600);
  expect(graph.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(100);
  expect(graph.shadowRoot!.querySelector('[part="source-coverage"]')!.textContent).to.contain('1000000');
  recordScaleMeasurement('lr-graph', 'n=1000000 global nodes and edges first middle final', { recordsRead: data.readRows, sceneRequests: data.scenes.length, mountedRecords: graph.shadowRoot!.querySelectorAll('[data-source-key]').length });
});

it('reveals and focuses a global record without activation then preserves offscene controlled IDs on user selection', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" selection-mode="multiple" .graphSource=${data.source} .selectedNodeIds=${['42']} .selectedEdgeIds=${['43']}></lr-graph>`);
  graph.selectionMode = 'multiple';
  const activations: string[] = []; const selections: { selectedNodeIds: readonly string[]; selectedEdgeIds: readonly string[] }[] = [];
  graph.addEventListener('lr-node-activate', event => activations.push(event.detail.nodeId));
  graph.addEventListener('lr-selection-change', event => selections.push(event.detail));
  await ready(graph, 'node:0');
  expect(await graph.revealSourceKey('node:999999')).to.equal(true);
  expect(graph.shadowRoot!.activeElement === row(graph, 'node:999999')).to.equal(true);
  expect(activations).to.deep.equal([]); expect(selections).to.deep.equal([]);
  row(graph, 'node:999999')!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
  await waitUntil(() => selections.length === 1);
  expect(activations).to.deep.equal(['999999']);
  expect(selections[0]).to.deep.equal({ selectedNodeIds: ['42', '999999'], selectedEdgeIds: ['43'] });
  expect(graph.selectedNodeIds).to.deep.equal(['42']); expect(graph.selectedEdgeIds).to.deep.equal(['43']);
  expect(data.scenes.at(-1)!.includeKeys).to.include('node:999999');
});

it('pages a high-degree node through its final incident edge and keeps original endpoint event IDs', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-incident="node:0"]')!.click();
  await ready(graph, 'edge:0'); graph.sourcePage = 9999; await ready(graph, 'edge:999999');
  expect(data.queries.at(-1)!.query.centerKey).to.equal('node:0');
  expect(data.queries.at(-1)!.query.direction).to.equal('both');
  const details: unknown[] = []; graph.addEventListener('lr-edge-activate', event => details.push(event.detail));
  row(graph, 'edge:999999')!.click(); await waitUntil(() => details.length === 1);
  expect(details[0]).to.deep.equal({ sourceNodeId: '0', targetNodeId: '1', edgeId: '999999' });
  expect(data.scenes.at(-1)!.includeKeys).to.include.members(['edge:999999', 'node:0', 'node:1']);
});

it('refreshes same-source closures on coalesced keyless updates and restores unchanged legacy arrays on unset', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source} .nodes=${[{ id: 'legacy', label: 'Legacy' }]}></lr-graph>`);
  await ready(graph, 'node:0'); const legacy = graph.nodes;
  data.setPrefix('Changed '); graph.requestUpdate(); graph.selectedNodeIds = ['42'];
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('Changed Node 0') === true);
  const count = data.queries.length;
  graph.selectedNodeIds = ['43']; await graph.updateComplete;
  expect(data.queries.length).to.equal(count);
  expect(graph.nodes === legacy).to.equal(true);
  graph.graphSource = undefined; await graph.updateComplete;
  expect(graph.nodes === legacy).to.equal(true);
  expect(graph.shadowRoot!.querySelector('[part="source-navigator"]') === null).to.equal(true);
  await waitUntil(() => graph.shadowRoot!.textContent?.includes('Legacy') === true);
});

it('does not emit a selection proposal after an activation listener replaces controlled selection', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" selection-mode="multiple" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const selections: unknown[] = [];
  graph.addEventListener('lr-node-activate', () => { graph.selectedNodeIds = ['replacement']; });
  graph.addEventListener('lr-selection-change', event => selections.push(event.detail));
  row(graph, 'node:0')!.click();
  await waitUntil(() => graph.selectedNodeIds.includes('replacement'));
  await graph.updateComplete;
  expect(selections).to.deep.equal([]);
});

it('keeps source records independently usable after a diagram failure and renders an empty complete source honestly', async () => {
  const data = provider();
  data.source.scene = async () => { throw new Error('Private provider diagnostic'); };
  const graph = await fixture<SourceGraph>(html`<lr-graph .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('The graph view could not be loaded.'));
  expect(graph.shadowRoot!.textContent).not.to.include('Private provider diagnostic');
  expect(await graph.revealSourceKey('node:999999')).to.equal(true);
  graph.graphSource = { revision: 2, records: { revision: 2, query: async () => ({ rows: [], total: 0, summary: { nodes: 0, edges: 0 } }), lookup: async () => [], locate: async () => null },
    scene: async () => ({ nodes: [], edges: [], total: { nodes: 0, edges: 0 }, coverage: 'complete', worldBounds: null }) };
  await waitUntil(() => graph.sourceTotal === 0);
  await graph.updateComplete;
  expect(graph.shadowRoot!.textContent).not.to.include('could not be loaded');
  expect(graph.shadowRoot!.querySelector('[part="source-coverage"]')!.textContent).to.include('0');
});

it('revokes a pending global reveal on query change, provider removal and reconnect', async () => {
  const data = provider();
  let locate!: (value: number) => void;
  data.source.records.locate = () => new Promise(resolve => { locate = resolve; });
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const pending = graph.revealSourceKey('node:999999');
  await waitUntil(() => !!locate);
  const search = graph.shadowRoot!.querySelector<HTMLInputElement>('[part="source-search"]')!;
  search.value = 'new'; search.dispatchEvent(new Event('input', { bubbles: true }));
  locate(999999);
  expect(await pending).to.equal(false);
  await ready(graph, 'node:0');
  expect(graph.shadowRoot!.activeElement === row(graph, 'node:999999')).to.equal(false);
  graph.remove(); document.body.append(graph);
  await ready(graph, 'node:0');
  graph.graphSource = undefined; await graph.updateComplete;
  expect(graph.sourceTotal).to.equal(null);
  expect(graph.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
});

it('refreshes exactly once for both coalesced keyless update orders and same-source assignment', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const before = data.queries.length;
  data.setPrefix('First '); graph.selectedNodeIds = ['1']; graph.requestUpdate();
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('First') === true);
  expect(data.queries.length).to.equal(before + 1);
  data.setPrefix('Second '); graph.requestUpdate(); graph.selectedNodeIds = ['2'];
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('Second') === true);
  expect(data.queries.length).to.equal(before + 2);
  data.setPrefix('Third '); graph.graphSource = data.source;
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('Third') === true);
  expect(data.queries.length).to.equal(before + 3);
});

it('keeps scene geometry stable on page and selection changes and displays a bounded scene across renderers', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph seed="7" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  await placed(() => graph.getNodePosition('0'), 'node 0 placed');
  const calls = data.scenes.length;
  const position = graph.getNodePosition('0');
  graph.sourcePage = 5000; await ready(graph, 'node:500000');
  graph.selectedNodeIds = ['999999']; await graph.updateComplete;
  expect(data.scenes.length).to.equal(calls);
  expect(graph.getNodePosition('0')).to.deep.equal(position);
  expect(await graph.focusNode('999999')).to.equal(true);
  expect(data.scenes.at(-1)!.centerKey).to.equal('node:999999');
  expect(graph.getNodePosition('999999')).not.to.equal(undefined);
  graph.renderer = 'canvas'; await graph.updateComplete;
  await placed(() => graph.shadowRoot!.querySelector('canvas'), 'canvas renderer mounted');
  expect(graph.getNodePosition('999999')).not.to.equal(undefined);
  const sceneCalls = data.scenes.length;
  graph.view = '3d'; await graph.updateComplete;
  await placed(() => graph.getNodePosition3d('999999'), 'node 999999 placed in 3D');
  expect(data.scenes.length).to.equal(sceneCalls);
  expect(graph.getNodePosition3d('999999')).to.deep.equal({ x: 999, y: 0, z: 0 });
  expect(graph.shadowRoot!.querySelector('[part="source-navigator"]') !== null).to.equal(true);
});

it('validates page identities and text before retaining nested graph values without invoking accessors', async () => {
  const data = provider();
  let getters = 0;
  const bad = record('nodes', 0);
  Object.defineProperty(bad.value.value, 'label', { get: () => { getters++; return 'unreachable'; } });
  data.source.records.query = async () => ({ rows: [bad], total: 1_000_000, summary: total });
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'));
  expect(getters).to.equal(0); expect(graph.sourceTotal).to.equal(null);
  expect(graph.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
  data.source.records.query = async () => ({ rows: [{ ...record('nodes', 0), key: 'node:wrong' }], total: 1_000_000, summary: total });
  graph.requestUpdate(); await graph.updateComplete;
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'));
  expect(graph.sourceTotal).to.equal(null);
  data.source.records.query = async () => ({ rows: Array.from({ length: 40 }, (_, index) => ({ ...record('nodes', index), value: { kind: 'node', value: { id: String(index), label: 'x'.repeat(65_536) } } })), total: 1_000_000, summary: total });
  graph.requestUpdate(); await graph.updateComplete;
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'));
  expect(graph.sourceTotal).to.equal(null);
});

it('does not turn a failed global lookup into a missing-record result', async () => {
  const data = provider();
  data.source.records.lookup = async () => { throw new Error('Diagnostic'); };
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  row(graph, 'node:0')!.click();
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'));
  expect(graph.shadowRoot!.textContent).not.to.include('Diagnostic');
});

it('revokes ignored-abort scene activation on external selection assignment and provider replacement', async () => {
  const data = provider();
  const scene = data.source.scene;
  let finish!: () => void;
  data.source.scene = request => new Promise(resolve => { finish = () => { void Promise.resolve(scene(request)).then(resolve); }; });
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" selection-mode="multiple" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const actions: unknown[] = [];
  graph.addEventListener('lr-node-activate', event => actions.push(event.detail));
  graph.addEventListener('lr-selection-change', event => actions.push(event.detail));
  row(graph, 'node:0')!.click(); await waitUntil(() => !!finish);
  graph.selectedNodeIds = ['9'];
  const replacement = provider(); replacement.setPrefix('Replacement '); graph.graphSource = replacement.source;
  finish();
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('Replacement') === true);
  expect(actions).to.deep.equal([]);
  expect(graph.selectedNodeIds).to.deep.equal(['9']);
});

it('provides localized source names, host naming and bounded keyboard endpoints', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" aria-label="Relations" .graphSource=${data.source} .strings=${{ graphSourceRecords: 'Enregistrements', graphSourceNodes: 'Sommets' }}></lr-graph>`);
  await ready(graph, 'node:0');
  const navigator = graph.shadowRoot!.querySelector('[part="source-navigator"]')!;
  expect(graph.getAttribute('aria-label')).to.equal('Relations');
  expect(navigator.getAttribute('aria-label')).to.equal('Enregistrements');
  expect(graph.shadowRoot!.querySelector('[data-source-kind]')!.getAttribute('aria-label')).to.equal('Enregistrements');
  row(graph, 'node:0')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await graph.updateComplete;
  expect(graph.shadowRoot!.activeElement === row(graph, 'node:99')).to.equal(true);
  expect(graph.sourcePage).to.equal(0);
  graph.sourcePage = 9999; await ready(graph, 'node:999999');
  expect(graph.shadowRoot!.activeElement === row(graph, 'node:999900')).to.equal(true);
  expect(data.queries.length).to.equal(2);
  await expect(graph).to.be.accessible();
});

it('fails visibly on defined invalid source and recovers when a valid source replaces it', async () => {
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${null}></lr-graph>`);
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'));
  expect(graph.sourceTotal).to.equal(null);
  const data = provider(); graph.graphSource = data.source;
  await ready(graph, 'node:0');
  expect(graph.sourceTotal).to.equal(1_000_000);
});

it('lets a provider installed reentrantly by an abort listener own the next page', async () => {
  const first = provider(), second = provider(), latest = provider();
  latest.setPrefix('Latest ');
  let started = false, finish!: () => void;
  let graph!: SourceGraph;
  first.source.records.query = request => new Promise(resolve => {
    started = true;
    request.signal.addEventListener('abort', () => { graph.graphSource = latest.source; }, { once: true });
    finish = () => resolve({ rows: Array.from({ length: 100 }, (_, index) => record('nodes', index)), total: 1_000_000, summary: total });
  });
  graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${first.source}></lr-graph>`);
  await waitUntil(() => started);
  graph.graphSource = second.source;
  finish();
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('Latest') === true);
  expect(graph.graphSource === latest.source).to.equal(true);
  expect(second.queries.length).to.equal(0);
});

it('reserves the final global edge and both endpoints before selected keys within the fixed scene budget', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source} .selectedNodeIds=${Array.from({ length: 100 }, (_, index) => String(index + 100))}></lr-graph>`);
  await ready(graph, 'node:0');
  expect(await graph.revealSourceKey('edge:999999')).to.equal(true);
  expect(graph.shadowRoot!.activeElement === row(graph, 'edge:999999')).to.equal(true);
  const actions: unknown[] = []; graph.addEventListener('lr-edge-activate', event => actions.push(event.detail));
  row(graph, 'edge:999999')!.click(); await waitUntil(() => actions.length === 1);
  const reserved = data.scenes.at(-1)!.includeKeys;
  expect(reserved.slice(0, 3)).to.deep.equal(['edge:999999', 'node:0', 'node:1']);
  expect(reserved.length).to.equal(32);
  expect(graph.selectedNodeIds.length).to.equal(100);
  recordScaleMeasurement('lr-graph', 'n=1000000 explicit final edge and reservation priority', { reservedKeys: reserved.length, sceneRequests: data.scenes.length, mountedRecords: graph.shadowRoot!.querySelectorAll('[data-source-key]').length });
});

it('bounds retained positions across repeated neighborhoods without paging records for camera gestures', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph seed="7" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0'); await placed(() => graph.getNodePosition('0'), 'node 0 placed');
  for (const id of ['100000', '500000', '999999']) expect(await graph.focusNode(id)).to.equal(true);
  const seam = graph as unknown as { lastPositionById: Map<string, unknown>; simNodeById: Map<string, unknown> };
  expect(seam.lastPositionById.size).to.equal(1); expect(seam.simNodeById.size).to.equal(1);
  const queries = data.queries.length, scenes = data.scenes.length;
  await graph.fit();
  expect(data.queries.length).to.equal(queries); expect(data.scenes.length).to.equal(scenes);
  expect(graph.getNodeScreenPosition('100000')).to.equal(undefined);
  recordScaleMeasurement('lr-graph', 'n=1000000 repeated bounded neighborhoods', { retainedPositions: seam.lastPositionById.size, simulationNodes: seam.simNodeById.size, pageRequests: data.queries.length, sceneRequests: data.scenes.length });
});


it('offers full-query endpoint controls and retains pager focus after the final page arrives', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const pager = graph.shadowRoot!.querySelector<HTMLElement>('lr-pagination')!;
  const last = pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="last-button"]');
  expect(last !== null).to.equal(true);
  await focusByKeyboard(last!); last!.click();
  await ready(graph, 'node:999999');
  await graph.updateComplete;
  await waitUntil(() => pager.shadowRoot!.activeElement?.getAttribute('part') === 'page-input');
  expect(graph.shadowRoot!.activeElement === pager).to.equal(true);
  expect(pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="last-button"]')!.disabled).to.equal(true);
});

it('rejects an obsolete incident-record action after provider replacement', async () => {
  const first = provider(), next = provider(); next.setPrefix('New ');
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${first.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const old = graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-incident="node:0"]')!;
  graph.graphSource = next.source;
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('New ') === true);
  const before = next.queries.length;
  old.click(); await graph.updateComplete; await new Promise(resolve => setTimeout(resolve, 30));
  expect(next.queries.length).to.equal(before);
  expect(next.queries.at(-1)!.query.kind).to.equal('nodes');
});
it('rejects an obsolete records retry after provider replacement', async () => {
  const first = provider(), next = provider(); next.setPrefix('New ');
  first.source.records.query = async () => { throw new Error('failed'); };
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${first.source}></lr-graph>`);
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'));
  const old = graph.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-navigator"] > button')!;
  expect(old !== null).to.equal(true);
  graph.graphSource = next.source;
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('New ') === true);
  const before = next.queries.length;
  old.click(); await graph.updateComplete; await new Promise(resolve => setTimeout(resolve, 30));
  expect(next.queries.length).to.equal(before);
});


it('rejects an obsolete scene retry after provider replacement', async () => {
  const first = provider(), next = provider(); next.setPrefix('New ');
  first.source.scene = async () => { throw new Error('failed'); };
  const graph = await fixture<SourceGraph>(html`<lr-graph .graphSource=${first.source}></lr-graph>`);
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('The graph view could not be loaded.'));
  const old = graph.shadowRoot!.querySelector<HTMLButtonElement>('.source-diagram [part="source-status"] > button')!;
  expect(old !== null).to.equal(true);
  graph.graphSource = next.source;
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('New ') === true);
  const queries = next.queries.length, scenes = next.scenes.length;
  old.click(); await graph.updateComplete; await new Promise(resolve => setTimeout(resolve, 30));
  expect(next.queries.length).to.equal(queries); expect(next.scenes.length).to.equal(scenes);
});

it('revokes incident controls before render on page/query changes and removal', async () => {
  for (const change of ['page', 'query', 'remove'] as const) {
    const data = provider();
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    const old = graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-incident="node:0"]')!;
    if (change === 'page') graph.sourcePage = 1;
    else if (change === 'query') {
      const input = graph.shadowRoot!.querySelector<HTMLInputElement>('[part="source-search"]')!;
      input.value = 'new'; input.dispatchEvent(new Event('input', { bubbles: true }));
    } else graph.remove();
    old.click(); await graph.updateComplete; await new Promise(resolve => setTimeout(resolve, 30));
    expect(data.queries.at(-1)!.query.kind, change).to.equal('nodes');
    expect(data.queries.at(-1)!.query.centerKey, change).to.equal(null);
  }
});

it('rechecks incident authority after a provider metadata callback installs a new source', async () => {
  const first = provider(), next = provider(); next.setPrefix('New ');
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${first.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const old = graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-incident="node:0"]')!;
  let armed = true;
  Object.defineProperty(first.source, 'revision', { get: () => { if (armed) { armed = false; graph.graphSource = next.source; } return 1; } });
  old.click();
  await waitUntil(() => row(graph, 'node:0')?.textContent?.includes('New ') === true);
  expect(next.queries.length).to.equal(1);
  expect(next.queries[0]!.query.centerKey).to.equal(null);
  expect(next.queries[0]!.query.kind).to.equal('nodes');
});

it('still retries the current failed records and scene state', async () => {
  for (const kind of ['records', 'scene'] as const) {
    const data = provider();
    const query = data.source.records.query, scene = data.source.scene;
    if (kind === 'records') data.source.records.query = async () => { throw new Error('failed'); };
    else data.source.scene = async () => { throw new Error('failed'); };
    const graph = await fixture<SourceGraph>(html`<lr-graph view=${kind === 'records' ? 'list' : '2d'} .graphSource=${data.source}></lr-graph>`);
    const selector = kind === 'records' ? '[part="source-navigator"] > button' : '.source-diagram [part="source-status"] > button';
    await waitUntil(() => !!graph.shadowRoot!.querySelector(selector));
    let releaseRecords!: () => void;
    const recordsReady = new Promise<void>(resolve => { releaseRecords = resolve; });
    data.setPrefix('Retried ');
    data.source.records.query = async request => { await recordsReady; return query(request); };
    data.source.scene = scene;
    graph.shadowRoot!.querySelector<HTMLButtonElement>(selector)!.click();
    try {
      await waitUntil(() => !graph.shadowRoot!.querySelector(selector));
      expect(graph.sourceTotal, `${kind}: records still pending`).to.equal(null);
      expect(graph.shadowRoot!.querySelector('[part="source-navigator"]')!.getAttribute('aria-busy')).to.equal('true');
    } finally {
      releaseRecords();
    }
    await waitUntil(() => graph.sourceTotal === 1_000_000 && row(graph, 'node:0')?.textContent?.includes('Retried Node 0') === true,
      `${kind}: retried records committed`);
    expect(graph.sourceTotal).to.equal(1_000_000);
    expect(graph.shadowRoot!.querySelector(selector) === null).to.equal(true);
  }
});

it('revokes a global reveal when the final revision read installs a newer provider', async () => {
  const first = provider(), next = provider(); next.setPrefix('New ');
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${first.source}></lr-graph>`);
  await ready(graph, 'node:0');
  let armed = false;
  Object.defineProperty(first.source, 'revision', { get: () => {
    if (armed) { armed = false; graph.graphSource = next.source; }
    return 1;
  } });
  first.source.records.locate = async () => {
    queueMicrotask(() => queueMicrotask(() => { armed = true; }));
    return 999999;
  };
  expect(await graph.revealSourceKey('node:999999')).to.equal(false);
  await waitUntil(() => next.queries.length > 0);
  expect(graph.graphSource === next.source).to.equal(true);
  expect(graph.sourcePage).to.equal(0);
  expect(next.queries.every(request => request.page === 0)).to.equal(true);
});

for (const dir of ['ltr', 'rtl'] as const) it(`moves source row focus with ArrowDown/ArrowUp and the inline arrows under dir=${dir}, clamping at both ends`, async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" dir=${dir} .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const press = (key: string, from: string, cancelable = true) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable });
    row(graph, from)!.dispatchEvent(event);
    return event;
  };
  const active = () => (graph.shadowRoot!.activeElement as HTMLElement | null)?.dataset['sourceKey'];
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';

  expect(press('ArrowDown', 'node:0').defaultPrevented).to.equal(true);
  expect(active()).to.equal('node:1');
  press(forward, 'node:1');
  expect(active()).to.equal('node:2');
  const reserved = new KeyboardEvent('keydown', {
    key: backward, altKey: true, bubbles: true, cancelable: true,
  });
  row(graph, 'node:2')!.dispatchEvent(reserved);
  expect(reserved.defaultPrevented).to.equal(false);
  expect(active()).to.equal('node:2');
  press(backward, 'node:2');
  expect(active()).to.equal('node:1');
  press('ArrowUp', 'node:1');
  expect(active()).to.equal('node:0');
  press('ArrowUp', 'node:0');
  expect(active(), 'ArrowUp clamps at the first row').to.equal('node:0');
  press('End', 'node:0');
  press('ArrowDown', 'node:99');
  expect(active(), 'ArrowDown clamps at the last row').to.equal('node:99');
  expect(press('x', 'node:99').defaultPrevented, 'unrelated keys are left alone').to.equal(false);
});

it('moves source row focus to the first row on Home', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
  row(graph, 'node:42')!.dispatchEvent(event);
  expect(event.defaultPrevented).to.equal(true);
  expect((graph.shadowRoot!.activeElement as HTMLElement | null)?.dataset['sourceKey']).to.equal('node:0');
});

it('switches the record kind back to nodes and normalizes the incident direction control', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const kind = graph.shadowRoot!.querySelector<HTMLSelectElement>('[data-source-kind]')!;
  kind.value = 'edges'; kind.dispatchEvent(new Event('change', { bubbles: true }));
  await ready(graph, 'edge:0');
  kind.value = 'nodes'; kind.dispatchEvent(new Event('change', { bubbles: true }));
  await ready(graph, 'node:0');
  expect(data.queries.at(-1)!.query.kind).to.equal('nodes');

  graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-incident="node:0"]')!.click();
  await waitUntil(() => data.queries.at(-1)!.query.centerKey === 'node:0', 'incident edges requested');
  const direction = () => graph.shadowRoot!.querySelector<HTMLSelectElement>('select[aria-label="Direction"]')!;
  await waitUntil(() => !!direction(), 'direction control');
  direction().value = 'in'; direction().dispatchEvent(new Event('change', { bubbles: true }));
  await waitUntil(() => data.queries.at(-1)!.query.direction === 'in', 'inbound edges requested');
  const select = direction();
  const option = document.createElement('option'); option.value = 'sideways'; select.append(option);
  select.value = 'sideways'; select.dispatchEvent(new Event('change', { bubbles: true }));
  await waitUntil(() => data.queries.at(-1)!.query.direction === 'both', 'unknown direction normalized to both');
  graph.shadowRoot!.querySelector<HTMLButtonElement>('.source-toolbar button')!.click();
  await waitUntil(() => data.queries.at(-1)!.query.centerKey === null, 'all records restored');
});

it('names source rows by accessible label, then label, then id', async () => {
  const data = provider();
  const query = data.source.records.query;
  data.source.records.query = async request => {
    const result = await query(request);
    return { ...result, rows: result.rows.map(row => row.key === 'node:0' ? { ...row, value: { kind: 'node' as const, value: { id: '0', label: 'Visible', accessibleLabel: 'Spoken' } } }
      : row.key === 'node:1' ? { ...row, value: { kind: 'node' as const, value: { id: '1' } } } : row) };
  };
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:1');
  expect(row(graph, 'node:0')!.textContent!.trim()).to.equal('Spoken');
  expect(row(graph, 'node:1')!.textContent!.trim()).to.equal('1');
  expect(row(graph, 'node:2')!.textContent!.trim()).to.equal('Node 2');
});

it('describes aggregate scene coverage in the source navigator', async () => {
  const coverage = 'aggregate' as const;
  const data = provider();
  const scene = data.source.scene;
  data.source.scene = async request => ({ ...await scene(request), coverage });
  const graph = await fixture<SourceGraph>(html`<lr-graph .graphSource=${data.source}></lr-graph>`);
  await waitUntil(() => data.scenes.length > 0 && !!graph.shadowRoot!.querySelector('[part="source-coverage"]'), 'source coverage shown', { timeout: 4000 });
  await waitUntil(() => graph.shadowRoot!.querySelector('[part="source-coverage"]')!.textContent!.includes('Summary: showing'), 'aggregate coverage text', { timeout: 4000 });
});

describe('global reveal boundaries', () => {
  it('rejects malformed keys without querying the provider', async () => {
    const data = provider();
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    const before = data.queries.length;
    for (const key of ['node:', 'vertex:1', `node:${'x'.repeat(65_536)}`, 7 as unknown as string]) expect(await graph.revealSourceKey(key)).to.equal(false);
    expect(data.queries.length).to.equal(before);
  });

  it('reports a record the provider cannot locate as missing', async () => {
    const data = provider();
    data.source.records.locate = async () => null;
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    expect(await graph.revealSourceKey('node:123')).to.equal(false);
    await graph.updateComplete;
    expect(graph.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('This graph record is unavailable.');
  });

  it('resolves false when the provider is replaced while locating', async () => {
    const data = provider(), fresh = provider();
    let release!: () => void;
    data.source.records.locate = key => new Promise(resolve => { release = () => resolve(Number(key.slice(5))); });
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    const reveal = graph.revealSourceKey('node:500');
    await waitUntil(() => release !== undefined, 'locate pending');
    graph.graphSource = fresh.source;
    release();
    expect(await reveal).to.equal(false);
    await ready(graph, 'node:0');
    expect(fresh.queries.every(request => request.page === 0)).to.equal(true);
  });

  it('resolves false when the located row is no longer in the returned page', async () => {
    const data = provider();
    data.source.records.locate = async () => 250;
    const query = data.source.records.query;
    data.source.records.query = async request => request.page === 2 ? { ...await query(request), rows: [] } : query(request);
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    expect(await graph.revealSourceKey('node:250')).to.equal(false);
  });

  it('resolves false when the provider is replaced before the current page settles', async () => {
    const data = provider(), fresh = provider();
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    const reveal = graph.revealSourceKey('node:500');
    graph.graphSource = fresh.source;
    expect(await reveal).to.equal(false);
  });

  it('resolves false when the provider is replaced while the located page loads', async () => {
    const data = provider(), fresh = provider();
    const query = data.source.records.query;
    let release: (() => void) | undefined;
    data.source.records.query = request => request.page === 5 ? new Promise(resolve => { release = () => resolve(query(request)); }) : query(request);
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    const reveal = graph.revealSourceKey('node:500');
    await waitUntil(() => release !== undefined, 'located page pending');
    graph.graphSource = fresh.source;
    release!();
    expect(await reveal).to.equal(false);
  });

  it('resolves false when the element is removed as the located page renders', async () => {
    const data = provider();
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:0');
    const observer = new MutationObserver(() => { if (row(graph, 'node:500')) graph.remove(); });
    observer.observe(graph.shadowRoot!, { subtree: true, childList: true });
    try { expect(await graph.revealSourceKey('node:500')).to.equal(false); } finally { observer.disconnect(); }
    expect(graph.isConnected).to.equal(false);
  });

  it('marks an activated row missing when the provider can no longer resolve it, without emitting activation', async () => {
    const data = provider();
    data.source.records.lookup = async () => [];
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:3');
    let activations = 0; graph.addEventListener('lr-node-activate', () => activations++);
    row(graph, 'node:3')!.click();
    await waitUntil(() => graph.shadowRoot!.querySelector('[part="source-status"]')?.textContent === 'This graph record is unavailable.', 'missing status');
    expect(activations).to.equal(0);
  });

  it('caps the activation scene reservation at 32 keys across selected nodes and edges', async () => {
    const data = provider();
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}
      .selectedNodeIds=${Array.from({ length: 20 }, (_, index) => String(index + 100))}
      .selectedEdgeIds=${Array.from({ length: 20 }, (_, index) => String(index + 200))}></lr-graph>`);
    await ready(graph, 'node:3');
    const activated = new Promise(resolve => graph.addEventListener('lr-node-activate', resolve, { once: true }));
    row(graph, 'node:3')!.click();
    await activated;
    const keys = data.scenes.at(-1)!.includeKeys;
    expect(keys.length).to.equal(32);
    expect(keys[0]).to.equal('node:3');
    expect(keys.filter(key => key.startsWith('edge:')).length).to.equal(11);
  });

  it('does not activate a row whose record is absent from the accepted scene', async () => {
    const data = provider();
    const scene = data.source.scene;
    data.source.scene = async request => { const value = await scene(request); return { ...value, nodes: value.nodes.filter(node => node.key !== 'node:3') }; };
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:3');
    let activations = 0; graph.addEventListener('lr-node-activate', () => activations++);
    const scenes = data.scenes.length;
    row(graph, 'node:3')!.click();
    await waitUntil(() => data.scenes.length > scenes, 'activation scene requested');
    await graph.updateComplete; await new Promise(resolve => setTimeout(resolve, 50));
    expect(activations).to.equal(0);
  });

  it('does not activate a row when the element is removed as the accepted scene renders', async () => {
    const data = provider();
    let removeOnScene = false;
    const scene = data.source.scene;
    data.source.scene = async request => { const value = await scene(request); if (removeOnScene) queueMicrotask(() => queueMicrotask(() => graph.remove())); return value; };
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:3');
    let activations = 0; graph.addEventListener('lr-node-activate', () => activations++);
    removeOnScene = true;
    row(graph, 'node:3')!.click();
    await waitUntil(() => !graph.isConnected, 'removed');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(activations).to.equal(0);
  });

  it('ignores a click on a row retained from a previous page', async () => {
    const data = provider();
    const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${data.source}></lr-graph>`);
    await ready(graph, 'node:3');
    const stale = row(graph, 'node:3')!;
    graph.sourcePage = 1;
    await ready(graph, 'node:100');
    let activations = 0; graph.addEventListener('lr-node-activate', () => activations++);
    const scenes = data.scenes.length;
    stale.click();
    await graph.updateComplete; await new Promise(resolve => setTimeout(resolve, 50));
    expect(activations).to.equal(0);
    expect(data.scenes.length).to.equal(scenes);
  });
});

it('exposes themed source controls and clears the search through the localized action', async () => {
  const data = provider();
  const graph = await fixture<SourceGraph>(html`<lr-graph label="Network" view="list" .strings=${{clear:'Reset filter'}} .graphSource=${data.source}></lr-graph>`);
  await ready(graph, 'node:0');
  const root = graph.shadowRoot!;
  expect(root.querySelector('[part="source-navigator"]')!.getAttribute('aria-label')).to.equal('Graph records');
  expect(root.querySelector('[part="source-kind"]')?.localName).to.equal('select');
  const input = root.querySelector<HTMLInputElement>('[part="source-search"]')!;
  expect(input.spellcheck).to.equal(false);
  expect(input.autocomplete).to.equal('off');
  input.value = 'sample'; input.dispatchEvent(new Event('input'));
  await graph.updateComplete;
  const clear = root.querySelector<HTMLButtonElement>('[part="search-clear"]')!;
  expect(clear.getAttribute('aria-label')).to.equal('Reset filter');
  clear.click();
  await ready(graph, 'node:0');
  expect(input.value).to.equal('');
  root.querySelector<HTMLButtonElement>('[part="source-incident"]')!.click();
  await ready(graph, 'edge:0');
  expect(root.querySelector('[part="source-direction"]')?.localName).to.equal('select');
  root.querySelector<HTMLButtonElement>('[part="source-action"]')!.click();
  await graph.updateComplete;
  expect(root.querySelector('[part="source-direction"]') === null).to.equal(true);
});

it('leaves source-row navigation inactive inside an inert host', async () => {
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:0');
  graph.inert = true;
  const key = new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true, cancelable:true});
  row(graph, 'node:0')!.dispatchEvent(key);
  expect(key.defaultPrevented).to.equal(false);
});

it('skips unavailable source rows when moving focus', async () => {
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .sourcePageSize=${4}
    .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:0');
  const first = row(graph, 'node:0')!;
  row(graph, 'node:1')!.parentElement!.inert = true;
  row(graph, 'node:2')!.disabled = true;
  await focusByKeyboard(first);
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  expect(graph.shadowRoot!.activeElement === row(graph, 'node:3')).to.equal(true);
});

it('ignores navigation from a retired source row', async () => {
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:0');
  const retired = row(graph, 'node:0')!;
  graph.graphSource = undefined;
  await graph.updateComplete;
  graph.graphSource = provider().source;
  await ready(graph, 'node:0');
  expect(retired.isConnected).to.equal(false);
  const active = row(graph, 'node:2')!;
  await focusByKeyboard(active);
  const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
  retired.dispatchEvent(event);
  expect(event.defaultPrevented).to.equal(false);
  expect(graph.shadowRoot!.activeElement === active).to.equal(true);
});

it('leaves focus in place when a page change retires the source rows before render', async () => {
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:2');
  const active = row(graph, 'node:2')!;
  await focusByKeyboard(active);
  graph.sourcePage = 1;
  const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
  active.dispatchEvent(event);
  expect(event.defaultPrevented).to.equal(false);
  expect(graph.shadowRoot!.activeElement === active).to.equal(true);
});

it('makes incident edges reachable by Tab only on the current source row', async () => {
  const graph = await fixture<SourceGraph>(html`<lr-graph view="list" .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:0');
  const incident = () => [...graph.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-source-incident]')].filter(b => b.tabIndex === 0);
  expect(incident().map(b => b.dataset['sourceIncident'])).to.deep.equal(['node:0']);
  row(graph, 'node:0')!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true}));
  await graph.updateComplete;
  expect(incident().map(b => b.dataset['sourceIncident'])).to.deep.equal(['node:1']);
});

it('declines a reveal when a focus listener removes the graph', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="list" .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:0');
  graph.shadowRoot!.addEventListener('focusin', () => graph.remove(), { once: true });
  expect(await graph.revealSourceKey('node:9')).to.equal(false);
  expect(graph.isConnected).to.equal(false);
});

it('abandons a graph reveal when its scroll container is detached', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="list" .graphSource=${provider().source}></lr-graph>`);
  await ready(graph, 'node:0');
  const port = graph.shadowRoot!.querySelector<HTMLElement>('[part="source-navigator"]')!;
  port.style.cssText = 'display:block;overflow:auto;max-block-size:60px';
  const measure = port.getBoundingClientRect.bind(port);
  port.getBoundingClientRect = () => {
    const bounds = measure();
    graph.remove();
    return bounds;
  };
  expect(await graph.revealSourceKey('node:9')).to.equal(false);
  expect(graph.isConnected).to.equal(false);
});
