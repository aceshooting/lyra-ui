import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';
void LyraGraph;

it('does not instantiate spatial machinery for the default 2D view', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph></lr-graph>`);
  expect((graph as unknown as { spatial?: unknown }).spatial === undefined).to.equal(true);
  const optionalResources = performance.getEntriesByType('resource').filter(entry =>
    /\/(?:graph-spatial-controller|graph-spatial|layered-layout)\.js(?:\?|$)/.test(entry.name));
  expect(optionalResources.map(entry => entry.name)).to.deep.equal([]);
});

it('settles the spatial view through updateComplete and preserves synchronous world positions', async () => {
  const graph = new LyraGraph(); graph.nodes = [{ id: 'a', position: { x: 1, y: 2, z: 3 } }]; graph.view = '3d';
  expect(graph.getNodePosition3d('a')).to.deep.equal({ x: 1, y: 2, z: 3 });
  await fixture(graph); await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="spatial-canvas"]') !== null).to.equal(true);
  graph.view = '2d'; await graph.updateComplete;
  graph.view = '3d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="spatial-canvas"]') !== null).to.equal(true);
});

it('settles an opt-in layered layout and keeps its positions after a force round trip', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph layout="layered" .nodes=${[{ id: 'a' }, { id: 'b' }]} .edges=${[{ source: 'a', target: 'b' }]}></lr-graph>`);
  await waitUntil(() => graph.getNodePosition('b') !== undefined, 'layered layout ready', { timeout: 10000 });
  const point = graph.getNodePosition('b');
  graph.layout = 'force'; await graph.updateComplete;
  graph.layout = 'layered'; await graph.updateComplete;
  expect(graph.getNodePosition('b')).to.deep.equal(point);
});

it('ignores obsolete spatial module completion after a view switch or disconnect', async () => {
  const module = await import('./graph-spatial-controller.js');
  for (const disconnect of [false, true]) {
    const graph = await fixture<LyraGraph>(html`<lr-graph></lr-graph>`);
    let resolve!: (value: typeof module) => void;
    const work = graph as unknown as { loadSpatialController(): Promise<typeof module>; spatial?: unknown };
    work.loadSpatialController = () => new Promise(done => { resolve = done; });
    graph.view = '3d'; await Promise.resolve();
    if (disconnect) graph.remove(); else graph.view = '2d';
    await Promise.resolve(); resolve(module); await Promise.resolve(); await graph.updateComplete;
    expect(work.spatial === undefined).to.equal(true);
    expect(graph.shadowRoot!.querySelector('[part="spatial-canvas"]') === null).to.equal(true);
  }
});

it('shows a localized failure for a spatial module that cannot load', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph .strings=${{ graphSpatialUnavailable: 'Spatial unavailable' }}></lr-graph>`);
  (graph as unknown as { loadSpatialController(): Promise<never> }).loadSpatialController = () => Promise.reject(new Error('module failure'));
  graph.view = '3d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Spatial unavailable');
});

for (const rejected of [false, true]) it(`restores the force surface when a pending layered module becomes obsolete (rejected=${rejected})`, async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph .nodes=${[{ id: 'a' }]}></lr-graph>`);
  await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'force library ready', { timeout: 10000 });
  type LayeredModule = typeof import('../../../internal/layered-layout.js');
  let resolve!: (module: LayeredModule) => void;
  let reject!: (reason: Error) => void;
  (graph as unknown as { loadLayeredLayout(): Promise<LayeredModule> }).loadLayeredLayout =
    () => new Promise((done, fail) => { resolve = done; reject = fail; });
  graph.layout = 'layered';
  await Promise.resolve();
  expect(graph.getAttribute('aria-busy')).to.equal('true');
  graph.layout = 'force';
  await graph.updateComplete;
  expect(graph.getAttribute('aria-busy')).to.equal('false');
  expect(graph.shadowRoot!.querySelector('[part="loading"]') === null).to.equal(true);
  expect(graph.shadowRoot!.querySelector('[part="node"]') !== null).to.equal(true);
  if (rejected) reject(new Error('obsolete import'));
  else resolve(await import('../../../internal/layered-layout.js'));
  await Promise.resolve(); await graph.updateComplete;
  expect(graph.getAttribute('aria-busy')).to.equal('false');
  expect(graph.shadowRoot!.querySelector('[part="node"]') !== null).to.equal(true);
});
