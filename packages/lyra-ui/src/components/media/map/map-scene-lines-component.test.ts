import { expect, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { sceneArc, sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { deferred, renderEnvironment, renderTurns } from '../../../../test/map-scene-render-component-fixtures.js';
import type { RenderPeer } from '../../../../test/map-scene-render-component-fixtures.js';
import { invalidateLyraTheme } from '../../../internal/theme-watcher.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';
import type { LyraMap } from './map.js';

interface StateDetail { readonly revision: number; readonly state: string; readonly code?: string }
interface LineFeature { readonly properties: { readonly id: string; readonly color: string; readonly width: number };
  readonly geometry: { readonly coordinates: readonly (readonly number[])[] } }
interface LineData { readonly features: readonly LineFeature[] }

function sceneLayers(peer: RenderPeer) { return [...peer.layers.values()].filter(layer => layer.id.startsWith('lr-scene-lines-')); }
function sceneSources(peer: RenderPeer) { return [...peer.sources.keys()].filter(id => id.startsWith('lr-scene-lines-')); }
function lineData(peer: RenderPeer): LineData {
  const [id] = sceneSources(peer);
  return peer.sources.get(id!)!.spec['data'] as LineData;
}
function states(element: LyraMap): StateDetail[] {
  const values: StateDetail[] = [];
  element.addEventListener('lr-map-scene-state', event => { if (event instanceof CustomEvent) values.push(event.detail as StateDetail); });
  return values;
}
async function settled(values: StateDetail[], state: string, code?: string): Promise<void> {
  await waitUntil(() => values.at(-1)?.state === state && values.at(-1)?.code === code,
    `scene status ${state}${code ? `/${code}` : ''}`, { timeout: 2000 });
}
const flatArc = (id = 'arc') => ({ ...sceneArc(id), height: 0 });

describe('lr-map scene paths and arcs', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('draws flat paths and arcs as one owned data-driven line layer and reports ready', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => {
      reported = states(element);
      element.style.setProperty('--lr-color-brand', 'rgb(20, 40, 60)');
      element.scene = { objects: [{ ...scenePath('route'), width: 5, opacity: 0.5 }, { ...flatArc('link'), color: 'rgb(200, 100, 50)' }] };
    });
    await settled(reported, 'ready');
    expect(reported.map(row => row.state)).to.deep.equal(['loading', 'ready']);
    const [layer] = sceneLayers(peer);
    expect(sceneLayers(peer).length).to.equal(1); expect(sceneSources(peer).length).to.equal(1);
    expect(layer!.type).to.equal('line'); expect(layer!.source).to.equal(sceneSources(peer)[0]);
    expect(layer!.paint).to.deep.equal({ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] });
    const data = lineData(peer);
    expect(data.features.map(feature => feature.properties)).to.deep.equal([
      { id: 'route', kind: 'path', color: 'rgba(20, 40, 60, 1)', width: 5, opacity: 0.5 },
      { id: 'link', kind: 'arc', color: 'rgba(200, 100, 50, 1)', width: 2, opacity: 1 },
    ]);
    expect(data.features[0]!.geometry.coordinates.at(-1)).to.deep.equal([10, 0, 0]);
    expect(env.imports).to.equal(0);
    expect([peer.reads.container, peer.reads.ratio, peer.reads.padding]).to.deep.equal([0, 0, 0]);
    expect(element.shadowRoot!.querySelector('[part="scene-status"]') === null).to.equal(true);
  });

  it('reports elevated geometry as partial with the altitude code and keeps it as the third coordinate', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => {
      reported = states(element); element.strings = { mapScenePartial: 'Partly drawn scene' };
      element.scene = { objects: [sceneArc('raised')] };
    });
    await settled(reported, 'partial', 'altitude');
    const coordinates = lineData(peer).features[0]!.geometry.coordinates;
    expect(Math.max(...coordinates.map(row => row[2]!))).to.be.closeTo(100, 1e-9);
    await element.updateComplete;
    const status = element.shadowRoot!.querySelector('[part="scene-status"]');
    expect(status?.textContent).to.include('Partly drawn scene');
    expect(status?.hasAttribute('role') || status?.hasAttribute('aria-live')).to.equal(false);
    await waitUntil(() => [...document.querySelectorAll('[aria-live="polite"]')].some(sink => sink.textContent?.includes('Partly drawn scene')),
      'polite partial announcement', { timeout: 2000 });
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part="scene-toggle"]')!.click(); await element.updateComplete;
    await expect(element).to.be.accessible();
  });

  it('reports models as missing while still drawing lines, and model-only scenes as unavailable', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => { reported = states(element); element.scene = { objects: [scenePath(), sceneModel()] }; });
    await settled(reported, 'partial', 'model');
    expect(sceneLayers(peer).length).to.equal(1);
    element.scene = { objects: [sceneModel()] };
    await settled(reported, 'unavailable', 'model');
    expect(sceneLayers(peer).length).to.equal(0); expect(sceneSources(peer).length).to.equal(0);
  });

  it('updates the owned source in place for a newer accepted revision', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => { reported = states(element); element.scene = { objects: [scenePath('a')] }; });
    await settled(reported, 'ready');
    const [sourceId] = sceneSources(peer), [layer] = sceneLayers(peer), source = peer.sources.get(sourceId!)!;
    const updates: LineData[] = []; Object.defineProperty(source, 'setData', { configurable: true, value: (data: unknown) => { updates.push(data as LineData); } });
    const firstRevision = reported.at(-1)!.revision;
    element.scene = { objects: [{ ...scenePath('b'), interpolation: 'linear', positions: [{ lngLat: [1, 1] }, { lngLat: [2, 2] }] }] };
    await waitUntil(() => updates.length === 1 && reported.at(-1)!.revision > firstRevision && reported.at(-1)!.state === 'ready',
      'in-place update', { timeout: 2000 });
    expect(updates[0]!.features.map(feature => feature.properties.id)).to.deep.equal(['b']);
    expect(updates[0]!.features[0]!.geometry.coordinates).to.deep.equal([[1, 1, 0], [2, 2, 0]]);
    expect(sceneSources(peer)).to.deep.equal([sourceId]); expect(sceneLayers(peer)[0] === layer).to.equal(true);
  });

  it('applies only the latest scene when native preparation resolves late', async () => {
    const gates: ReturnType<typeof deferred<void>>[] = [];
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => { reported = states(element); },
      peer => {
        peer.prepareFeatures = (requirements?: { readonly sources?: Record<string, unknown> }) => {
          if (!Object.keys(requirements?.sources ?? {}).some(id => id.startsWith('lr-scene-lines'))) return Promise.resolve();
          const gate = deferred<void>(); gates.push(gate); return gate.promise;
        };
      });
    element.scene = { objects: [scenePath('old')] }; await element.updateComplete; await renderTurns();
    element.scene = { objects: [scenePath('new')] }; await element.updateComplete; await renderTurns();
    expect(gates.length).to.be.at.least(2);
    gates.at(-1)!.resolve(); await renderTurns(); gates[0]!.resolve(); await renderTurns();
    await settled(reported, 'ready');
    expect(sceneSources(peer).length).to.equal(1);
    expect(lineData(peer).features.map(feature => feature.properties.id)).to.deep.equal(['new']);
  });

  it('removes owned resources when lines leave the scene, when cleared and on disconnect', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => { reported = states(element); element.scene = { objects: [scenePath(), sceneMarker()] }; });
    await waitUntil(() => sceneLayers(peer).length === 1, 'line installed', { timeout: 2000 });
    element.scene = { objects: [sceneMarker()] }; await element.updateComplete; await renderTurns();
    expect(sceneLayers(peer).length).to.equal(0); expect(sceneSources(peer).length).to.equal(0);
    element.scene = { objects: [scenePath()] };
    await settled(reported, 'ready');
    element.scene = undefined; await element.updateComplete; await renderTurns();
    expect(sceneLayers(peer).length).to.equal(0); expect(sceneSources(peer).length).to.equal(0);
    element.scene = { objects: [scenePath()] };
    await waitUntil(() => sceneLayers(peer).length === 1, 'line reinstalled', { timeout: 2000 });
    env.trace.length = 0; element.remove(); await renderTurns();
    expect(sceneLayers(peer).length).to.equal(0); expect(sceneSources(peer).length).to.equal(0);
    expect(peer.removed).to.equal(true);
  });

  it('reinstalls the latest lines after a style replacement and refreshes theme colors in place', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => {
      reported = states(element);
      element.style.setProperty('--line-color', 'rgb(10, 20, 30)');
      element.scene = { objects: [{ ...scenePath(), color: 'var(--line-color)' }] };
    });
    await settled(reported, 'ready');
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Replacement style' };
    await element.updateComplete; await element.whenStyleReady(); await renderTurns();
    await waitUntil(() => sceneLayers(peer).length === 1, 'line reinstalled after style', { timeout: 2000 });
    await settled(reported, 'ready');
    expect(lineData(peer).features[0]!.properties.color).to.equal('rgba(10, 20, 30, 1)');
    const source = peer.sources.get(sceneSources(peer)[0]!)!, updates: LineData[] = [];
    Object.defineProperty(source, 'setData', { configurable: true, value: (data: unknown) => { updates.push(data as LineData); } });
    element.style.setProperty('--line-color', 'rgb(80, 100, 120)'); invalidateLyraTheme(element);
    await waitUntil(() => updates.at(-1)?.features[0]?.properties.color === 'rgba(80, 100, 120, 1)', 'theme color', { timeout: 2000 });
  });

  it('reports native failure, context loss and terrain draping truthfully', async () => {
    let reported: StateDetail[] = [];
    let refuse = true, terrain: { source: string } | null = null;
    const { element, peer } = await env.mount(element => { reported = states(element); }, peer => {
      const addLayer = peer.addLayer.bind(peer);
      peer.addLayer = (layer) => { if (refuse && layer.id.startsWith('lr-scene-lines-')) throw new Error('Refused'); return addLayer(layer); };
      Object.defineProperty(peer, 'getTerrain', { configurable: true, value: () => terrain });
    });
    element.scene = { objects: [scenePath()] };
    await settled(reported, 'unavailable', 'engine');
    expect(sceneLayers(peer).length).to.equal(0); expect(sceneSources(peer).length).to.equal(0);
    refuse = false; element.scene = { objects: [scenePath('retry')] };
    await settled(reported, 'ready');
    peer.getCanvas().dispatchEvent(new Event('webglcontextlost'));
    await settled(reported, 'unavailable', 'context-lost');
    peer.getCanvas().dispatchEvent(new Event('webglcontextrestored'));
    await settled(reported, 'ready');
    terrain = { source: 'dem' }; peer.fire('terrain');
    await settled(reported, 'partial', 'altitude');
    element.scene = { objects: [{ ...scenePath('draped'), positions: [{ lngLat: [0, 0], altitudeReference: 'terrain' }, { lngLat: [1, 0], altitudeReference: 'terrain' }] }] };
    await settled(reported, 'ready');
  });

  it('combines a marker installation report with drawn lines', async () => {
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => { reported = states(element); element.scene = { objects: [sceneMarker(), flatArc()] }; });
    const bridge = await env.bridge(peer);
    await waitUntil(() => sceneLayers(peer).length === 1, 'line installed', { timeout: 2000 });
    expect(reported.at(-1)?.state).to.equal('loading');
    const input = bridge.host.captureRenderInput();
    bridge.host.onState({ state: 'unavailable', acceptedSceneRevision: input.acceptedSceneRevision, presentationRevision: input.presentationRevision,
      allocationRevision: input.allocation?.revision, markerInstallationRevision: 0 });
    await settled(reported, 'partial', 'engine');
    bridge.host.onState({ state: 'installed', acceptedSceneRevision: input.acceptedSceneRevision, presentationRevision: input.presentationRevision,
      allocationRevision: input.allocation?.revision, markerInstallationRevision: 1 });
    await settled(reported, 'ready');
    expect(element.shadowRoot!.querySelector('[part="scene-status"]') === null).to.equal(true);
  });

  it('leaves maps without line intent free of scene line resources', async () => {
    const { element, peer } = await env.mount();
    for (const scene of [undefined, { objects: [] }, { objects: [sceneMarker()] }, { objects: [sceneModel()] }]) {
      element.scene = scene; await element.updateComplete; await renderTurns();
    }
    expect(sceneLayers(peer).length).to.equal(0); expect(sceneSources(peer).length).to.equal(0);
  });
});
