import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';
void LyraGraph;
import { stubIntersectionObserver } from '../../../../test/graph-test-support.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

interface GraphWork {
  simulation?: { stop(): void };
  onTick(): void;
  drawCanvas(): void;
  buildCanvasScene(...args: unknown[]): unknown;
  computedStyle(...args: unknown[]): CSSStyleDeclaration;
  linkCoordinates(...args: unknown[]): unknown;
  nodeAccessibleText(...args: unknown[]): string;
  focusGraphItem(index: number): void;
  lastPositionById: Map<string, { x: number; y: number }>;
}
async function graphAtScale(renderer: 'canvas' | 'svg'): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`<lr-graph renderer=${renderer} width="400" height="300"></lr-graph>`);
  await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'graph ready', { timeout: 10000 });
  if (renderer === 'svg') (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.add('lr-graph-svg-scale');
  graph.nodes = Array.from({ length: 10000 }, (_, i) => ({ id: `n${i}`, x: i % 100, y: Math.floor(i / 100) }));
  graph.edges = Array.from({ length: 1000 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` }));
  await graph.updateComplete;
  (graph as unknown as GraphWork).simulation?.stop();
  return graph;
}

describe('lr-graph measured work', function () {
  this.timeout(60000);
  it('retains position objects during canvas ticks at n=10000', async () => {
    const graph = await graphAtScale('canvas');
    const work = graph as unknown as GraphWork;
    work.onTick();
    const positions = [...work.lastPositionById.values()];
    const coordinates = countCalls(work, 'linkCoordinates');
    try {
      work.onTick();
      const replacedPositions = [...work.lastPositionById.values()].filter((value, i) => value !== positions[i]).length;
      recordScaleMeasurement('lr-graph', 'n=10000 canvas simulation tick', { geometryCoordinates: coordinates.calls, replacedPositions });
      expect(replacedPositions).to.equal(0);
    } finally { coordinates.restore(); }
  });

  it('updates canvas frame geometry without rebuilding paint at n=10000', async () => {
    const graph = await graphAtScale('canvas');
    const work = graph as unknown as GraphWork;
    work.drawCanvas();
    const builds = countCalls(work, 'buildCanvasScene');
    const styles = countCalls(work, 'computedStyle');
    try {
      for (let i = 0; i < 3; i++) { work.onTick(); work.drawCanvas(); }
      recordScaleMeasurement('lr-graph', 'n=10000 three canvas frames', { sceneBuilds: builds.calls, styleReads: styles.calls });
      expect(builds.calls).to.equal(0);
      expect(styles.calls).to.equal(0);
    } finally { builds.restore(); styles.restore(); }
  });

  it('retains canvas scene paint on selection updates at n=10000', async () => {
    const graph = await graphAtScale('canvas');
    const work = graph as unknown as GraphWork;
    work.drawCanvas();
    const builds = countCalls(work, 'buildCanvasScene');
    try {
      graph.selectedNodeIds = ['n1']; graph.minZoom = 0.2; await graph.updateComplete; work.drawCanvas();
      recordScaleMeasurement('lr-graph', 'n=10000 canvas selection', { sceneBuilds: builds.calls });
      expect(builds.calls).to.equal(0);
    } finally { builds.restore(); }
  });

  it('moves the SVG cursor without evaluating node templates or querying all items at n=10000', async () => {
    const graph = await graphAtScale('svg');
    const work = graph as unknown as GraphWork;
    const templates = countCalls(work, 'nodeAccessibleText');
    const originalQuery = graph.shadowRoot!.querySelectorAll;
    let itemQueries = 0;
    let sharedQueries = 0;
    graph.shadowRoot!.querySelectorAll = function (...args: Parameters<ShadowRoot['querySelectorAll']>) {
      if (args[0] === '*') sharedQueries++; else itemQueries++;
      return originalQuery.apply(this, args);
    };
    try {
      work.focusGraphItem(1);
      await graph.updateComplete;
      await Promise.resolve();
      recordScaleMeasurement('lr-graph', 'n=10000 SVG cursor move', { nodeTemplates: templates.calls, itemQueries, sharedQueries });
      expect(templates.calls).to.equal(0);
      expect(itemQueries).to.equal(0);
      const nodes = graph.shadowRoot!.querySelectorAll('[part="node"]');
      expect(nodes[0]!.getAttribute('tabindex')).to.equal('-1');
      expect(nodes[1]!.getAttribute('tabindex')).to.equal('0');
      expect(graph.shadowRoot!.activeElement === nodes[1]).to.equal(true);
    } finally { templates.restore(); graph.shadowRoot!.querySelectorAll = originalQuery; }
  });
});


it('indexes community membership without scanning every node per community at n=10000', async function () {
  this.timeout(60000);
  const graph = await graphAtScale('canvas');
  graph.communities = Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, memberIds: [`n${i}`] }));
  await graph.updateComplete;
  const work = graph as unknown as { simNodes: unknown[]; visibleCommunitiesCache?: unknown; visibleCommunities(): { members: { id: string }[] }[] };
  work.visibleCommunitiesCache = undefined;
  const filter = work.simNodes.filter;
  let visited = 0;
  Object.defineProperty(work.simNodes, 'filter', { configurable: true, writable: true, value: function (this: unknown[], predicate: (value: unknown, index: number, array: unknown[]) => unknown, receiver?: unknown) {
    return filter.call(this, (value, index, array) => { visited++; return predicate.call(receiver, value, index, array); });
  } });
  try {
    const result = work.visibleCommunities();
    recordScaleMeasurement('lr-graph', 'n=10000 community membership', { visited, communities: result.length });
    expect(visited).to.be.at.most(work.simNodes.length);
    expect(result[0]!.members[0]!.id).to.equal('n0');
  } finally { work.simNodes.filter = filter; }
});

it('stops force work while hidden and resumes an unsettled simulation', async () => {
  const observer = stubIntersectionObserver();
  try {
    const graph = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" .nodes=${[{ id: 'a' }, { id: 'b' }]}></lr-graph>`);
    await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'graph ready', { timeout: 10000 });
    const simulation = (graph as unknown as { simulation: { stop(): void; restart(): void; alpha(value: number): unknown } }).simulation;
    const stops = countCalls(simulation, 'stop');
    const starts = countCalls(simulation, 'restart');
    const instance = observer.instances[0]!;
    const entry = (visible: boolean): IntersectionObserverEntry => ({ isIntersecting: visible, target: graph,
      boundingClientRect: graph.getBoundingClientRect(), intersectionRect: graph.getBoundingClientRect(), rootBounds: null, intersectionRatio: visible ? 1 : 0, time: performance.now() });
    try {
      instance.callback([entry(false)], instance as unknown as IntersectionObserver);
      expect(stops.calls).to.equal(1);
      simulation.alpha(0.3);
      instance.callback([entry(true)], instance as unknown as IntersectionObserver);
      expect(starts.calls).to.equal(1);
    } finally { stops.restore(); starts.restore(); }
  } finally { observer.restore(); }
});

it('retains context-free color resolutions across width changes', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" .nodes=${[{ id: 'a', color: 'rgb(1, 2, 3)' }]}></lr-graph>`);
  await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'graph ready', { timeout: 10000 });
  const work = graph as unknown as GraphWork & { resolvedCssColorCache: Map<string, string> };
  work.drawCanvas();
  const entries = [...work.resolvedCssColorCache].filter(([value]) => /^rgb/.test(value));
  expect(entries.length).to.be.greaterThan(0);
  work.resolvedCssColorCache.set('var(--responsive-color)', 'rgb(4, 5, 6)');
  graph.width = Number(graph.width) + 10;
  await graph.updateComplete;
  expect(entries.filter(([value]) => work.resolvedCssColorCache.has(value)).length).to.equal(entries.length);
  expect(work.resolvedCssColorCache.has('var(--responsive-color)')).to.equal(false);
});
