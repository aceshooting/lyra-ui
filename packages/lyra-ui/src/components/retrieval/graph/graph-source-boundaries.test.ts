import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph, LyraGraphNode, LyraGraphEdge } from './graph.js';
import type { LyraGraphSource, LyraGraphRecord, LyraSourceRecord } from '../../../data-sources.js';
import { focusGraphSourceComposition, resolveGraphSourceComposition, setGraphSourceComposition } from './graph-source-composition.js';

type Source = LyraGraphSource<LyraGraphNode, LyraGraphEdge & { readonly id: string }>;
type Row = LyraSourceRecord<LyraGraphRecord<LyraGraphNode, LyraGraphEdge & { readonly id: string }>>;
const node = (id = 'a', order = 0): Row => ({ key: `node:${id}`, order, value: { kind: 'node', value: { id, label: `Node ${id}`, accessibleLabel: `Accessible ${id}`, description: `Description ${id}` } } });
const summary = { nodes: 2, edges: 0 };
function source(): Source {
  return { revision: 1, records: { revision: 1,
    query: async request => ({ rows: [node(request.page === 0 ? 'a' : 'b', request.page)], total: 2, summary }),
    lookup: async keys => keys.flatMap(key => key === 'node:a' ? [node()] : key === 'node:b' ? [node('b', 1)] : []),
    locate: async key => key === 'node:a' ? 0 : key === 'node:b' ? 1 : null,
  }, scene: async request => ({ nodes: request.includeKeys.map(key => ({ key, value: { id: key.slice(5) }, position: { x: 0, y: 0, z: 0 } })), edges: [], total: summary, coverage: 'neighborhood', worldBounds: null }) };
}
async function mount(provider: Source): Promise<LyraGraph> {
  return fixture<LyraGraph>(html`<lr-graph view="list" source-page-size="1" .graphSource=${provider}></lr-graph>`);
}
async function ready(graph: LyraGraph): Promise<void> {
  await waitUntil(() => graph.shadowRoot!.querySelectorAll('[data-source-key]').length === 1, 'a current source record is rendered');
}
async function rejected(graph: LyraGraph): Promise<void> {
  await waitUntil(() => graph.shadowRoot!.textContent!.includes('Graph records could not be loaded.'), 'invalid source response is reported');
  expect(graph.sourceTotal).to.equal(null);
  expect(graph.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('graph source response boundaries', () => {
  const cases: readonly [string, unknown][] = [
    ['a null response', null],
    ['a non-array row collection', { rows: {}, total: 2, summary }],
    ['more rows than requested', { rows: [node(), node('b', 1)], total: 2, summary }],
    ['a null row', { rows: [null], total: 2, summary }],
    ['an unsupported record kind', { rows: [{ ...node(), value: { kind: 'community', value: { id: 'a' } } }], total: 2, summary }],
    ['a non-string description', { rows: [{ ...node(), value: { kind: 'node', value: { id: 'a', description: 42 } } }], total: 2, summary }],
    ['an edge in a node query', { rows: [{ key: 'edge:e', order: 0, value: { kind: 'edge', value: { id: 'e', source: 'a', target: 'b' } } }], total: 2, summary }],
    ['unexpected groups', { rows: [node()], total: 2, summary, groups: [] }],
    ['unexpected tags', { rows: [node()], total: 2, summary, tags: [] }],
    ['a total beyond the summary', { rows: [node()], total: 3, summary }],
    ['an incomplete unfiltered total', { rows: [node()], total: 1, summary }],
  ];
  for (const [name, response] of cases) it(`rejects ${name} before retaining records`, async () => {
    const provider = source();
    // Provider data crosses an untyped boundary even when the application uses TypeScript.
    provider.records.query = async () => response as Awaited<ReturnType<Source['records']['query']>>;
    await rejected(await mount(provider));
  });

  it('rejects a records revision mismatch without calling the provider and recovers on replacement', async () => {
    const base = source(); let calls = 0;
    const provider: Source = { ...base, records: { ...base.records, revision: 2,
      query: async () => { calls++; return { rows: [node()], total: 2, summary }; } } };
    const graph = await mount(provider); await rejected(graph);
    expect(calls).to.equal(0);
    graph.graphSource = source(); await ready(graph);
    expect(graph.sourceTotal).to.equal(2);
  });

  it('rejects invalid reveal and focus identities without asking the provider to locate them', async () => {
    const provider = source(); let calls = 0;
    provider.records.locate = async () => { calls++; return null; };
    const graph = await mount(provider); await ready(graph);
    for (const key of ['', 'node:', 'community:a', 'node:' + 'x'.repeat(65_536)]) expect(await graph.revealSourceKey(key)).to.equal(false);
    for (const id of ['', 'x'.repeat(65_536)]) expect(await graph.focusNode(id)).to.equal(false);
    expect(calls).to.equal(0);
    graph.graphSource = undefined;
    expect(await graph.revealSourceKey('node:a')).to.equal(false);
  });

  it('lets a replacement installed by the records getter own the next binding', async () => {
    const graph = document.createElement('lr-graph') as LyraGraph; graph.view = 'list'; graph.sourcePageSize = 1;
    const obsolete = source(), replacement = source(); let obsoleteQueries = 0;
    obsolete.records.query = async () => { obsoleteQueries++; return { rows: [node()], total: 2, summary }; };
    const records = obsolete.records;
    Object.defineProperty(obsolete, 'records', { get: () => { graph.graphSource = replacement; return records; } });
    graph.graphSource = obsolete; await fixture(graph); await ready(graph);
    expect(graph.graphSource === replacement).to.equal(true);
    expect(obsoleteQueries).to.equal(0); expect(graph.sourceTotal).to.equal(2);
  });

  it('rejects a newly requested diagram whose totals contradict the accepted records page', async () => {
    const provider = source();
    provider.scene = async () => ({ nodes: [{ key: 'node:a', value: { id: 'a' }, position: { x: 0, y: 0, z: 0 } }], edges: [],
      total: { nodes: 3, edges: 0 }, coverage: 'neighborhood', worldBounds: null });
    const graph = await mount(provider); await ready(graph);
    graph.view = '3d'; await rejected(graph); await graph.updateComplete;
    expect(graph.getNodePosition3d('a')).to.equal(undefined);
  });

  it('reports a missing reveal without selecting or activating anything', async () => {
    const graph = await mount(source()); await ready(graph);
    let activated = 0; graph.addEventListener('lr-node-activate', () => activated++);
    expect(await graph.revealSourceKey('node:missing')).to.equal(false);
    await graph.updateComplete;
    expect(graph.shadowRoot!.textContent).to.include('This graph record is unavailable.');
    expect(graph.selectedNodeIds).to.deep.equal([]); expect(activated).to.equal(0);
  });

  it('revokes a reveal during its first page request when its provider is removed', async () => {
    const provider = source(); const graph = await mount(provider); await ready(graph);
    const page = deferred<Awaited<ReturnType<Source['records']['query']>>>(); let started = false;
    provider.records.query = () => { started = true; return page.promise; };
    const reveal = graph.revealSourceKey('node:b');
    await waitUntil(() => started, 'reveal page request starts');
    graph.graphSource = undefined; page.resolve({ rows: [node()], total: 2, summary });
    expect(await reveal).to.equal(false);
  });

  it('revokes a reveal after locate while the destination page is pending', async () => {
    const provider = source(); const page = deferred<Awaited<ReturnType<Source['records']['query']>>>(); let destination = false;
    const query = provider.records.query;
    provider.records.query = request => { if (request.page === 1) { destination = true; return page.promise; } return query(request); };
    const graph = await mount(provider); await ready(graph);
    const reveal = graph.revealSourceKey('node:b');
    await waitUntil(() => destination, 'destination page request starts');
    graph.graphSource = source(); graph.sourcePage = 0; page.resolve({ rows: [node('b', 1)], total: 2, summary });
    expect(await reveal).to.equal(false);
    await ready(graph);
    expect(graph.shadowRoot!.querySelector('[data-source-key]')!.getAttribute('data-source-key')).to.equal('node:a');
  });
});

describe('graph source composition authority', () => {
  const profile = () => ({ search: '', nodeTypes: [], empty: false, accepted: () => undefined });
  it('cannot resolve or focus a provider record on a local graph', async () => {
    const graph = await fixture<LyraGraph>(html`<lr-graph view="list"></lr-graph>`);
    setGraphSourceComposition(graph, profile());
    expect(await resolveGraphSourceComposition(graph, ['node:a'])).to.equal(undefined);
    expect(await focusGraphSourceComposition(graph, 'node:a')).to.equal(undefined);
  });

  it('loads an off-page focus into the navigator and revokes its acceptance when the profile changes', async () => {
    const graph = await mount(source()); await ready(graph);
    setGraphSourceComposition(graph, profile()); await ready(graph);
    const accepted = await focusGraphSourceComposition(graph, 'node:b');
    expect(typeof accepted).to.equal('function'); expect(accepted!()).to.equal(true);
    expect(graph.sourcePage).to.equal(1);
    expect(graph.shadowRoot!.querySelector('[data-source-key]')!.getAttribute('data-source-key')).to.equal('node:b');
    setGraphSourceComposition(graph, { ...profile(), search: 'different' });
    expect(accepted!()).to.equal(false);
  });

  it('does not accept a requested focus absent from the returned scene', async () => {
    const provider = source(); provider.scene = async () => ({ nodes: [], edges: [], total: summary, coverage: 'neighborhood', worldBounds: null });
    const graph = await mount(provider); await ready(graph); setGraphSourceComposition(graph, profile());
    expect(await focusGraphSourceComposition(graph, 'node:b')).to.equal(undefined);
    expect(graph.sourcePage).to.equal(0);
  });

  it('declines a composed focus when its scene node cannot be located in the navigator', async () => {
    const provider = source(); provider.records.locate = async () => null;
    const graph = await mount(provider); await ready(graph); setGraphSourceComposition(graph, profile());
    expect(await focusGraphSourceComposition(graph, 'node:b')).to.equal(undefined);
    expect(graph.sourcePage).to.equal(0);
  });

  it('revokes a pending composed lookup on profile replacement', async () => {
    const provider = source(); const lookup = deferred<readonly Row[]>(); let started = false;
    provider.records.lookup = () => { started = true; return lookup.promise; };
    const graph = await mount(provider); await ready(graph); setGraphSourceComposition(graph, profile());
    const result = resolveGraphSourceComposition(graph, ['node:b']);
    await waitUntil(() => started, 'composition lookup starts');
    setGraphSourceComposition(graph, { ...profile(), search: 'replacement' }); lookup.resolve([node('b', 1)]);
    expect(await result).to.equal(undefined);
  });
});
