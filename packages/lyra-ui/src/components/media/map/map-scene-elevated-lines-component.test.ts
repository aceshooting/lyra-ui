import { expect, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { sceneArc, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { renderEnvironment } from '../../../../test/map-scene-render-component-fixtures.js';
import type { RenderPeer } from '../../../../test/map-scene-render-component-fixtures.js';
import type { LyraMapCustomLayer } from '../../../internal/map-custom-layer-types.js';
import type { LyraMap } from './map.js';

interface StateDetail { readonly revision: number; readonly state: string; readonly code?: string }
interface FakeSceneLayer {
  readonly map: unknown;
  readonly layer: LyraMapCustomLayer;
  readonly host: { readonly signal: AbortSignal; onState?(state: string, code?: string): void };
  readonly calls: string[];
  disposed: boolean;
}
interface LineData { readonly features: readonly { readonly properties: { readonly id: string } }[] }

function states(element: LyraMap): StateDetail[] {
  const values: StateDetail[] = [];
  element.addEventListener('lr-map-scene-state', event => { if (event instanceof CustomEvent) values.push(event.detail as StateDetail); });
  return values;
}
async function settled(values: StateDetail[], state: string, code?: string): Promise<void> {
  await waitUntil(() => values.at(-1)?.state === state && values.at(-1)?.code === code,
    `scene status ${state}${code ? `/${code}` : ''}`, { timeout: 2000 });
}
function fakeRuntime() {
  const layers: FakeSceneLayer[] = [];
  const module = {
    createSceneLayer(map: unknown, layer: LyraMapCustomLayer, host: FakeSceneLayer['host']) {
      const record: FakeSceneLayer = { map, layer, host, calls: [], disposed: false };
      layers.push(record);
      queueMicrotask(() => host.onState?.('loading'));
      return {
        invalidateStyle() { record.calls.push('style'); }, styleReady() { record.calls.push('ready'); },
        requestFrame() { record.calls.push('frame'); }, setVisible(value: boolean) { record.calls.push(`visible:${value}`); },
        pick: async () => null, dispose() { record.disposed = true; },
      };
    },
  };
  return { layers, module, live: () => layers.filter(layer => !layer.disposed) };
}
/** The scripted source ignores updates; record them so assertions read the latest draped data. */
function recordSourceData(peer: RenderPeer): void {
  const set = peer.sources.set.bind(peer.sources);
  peer.sources.set = (key, value) => {
    Object.defineProperty(value, 'setData', { configurable: true, value: (data: unknown) => { value.spec['data'] = data; } });
    return set(key, value);
  };
}
function flatIds(peer: RenderPeer): string[] {
  const id = [...peer.sources.keys()].find(key => key.startsWith('lr-scene-lines-'));
  return id ? (peer.sources.get(id)!.spec['data'] as LineData).features.map(feature => feature.properties.id) : [];
}

describe('lr-map elevated scene paths and arcs', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('draws elevated arcs through the custom 3D layer bridge and reports ready', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => {
      reported = states(element);
      element.scene = { objects: [sceneArc('raised'), { ...scenePath('ground'), width: 3 }] };
    }, recordSourceData);
    await waitUntil(() => runtime.live().length === 1, 'elevated layer created', { timeout: 2000 });
    const [layer] = runtime.live();
    expect(layer!.map === peer).to.equal(true);
    expect(layer!.layer.id).to.equal('lr-scene-elevated-lines');
    await waitUntil(() => flatIds(peer).join() === 'ground', 'grounded lines stay draped', { timeout: 2000 });
    expect(reported.at(-1)?.state).to.equal('loading');
    layer!.host.onState?.('ready');
    await settled(reported, 'ready');
    expect(element.shadowRoot!.querySelector('[part="scene-status"]') === null).to.equal(true);
  });

  it('keeps the ground-track fallback and partial altitude status without the bridge', async () => {
    let reported: StateDetail[] = [];
    const { peer } = await env.mount(element => { reported = states(element); element.scene = { objects: [sceneArc('raised')] }; });
    await settled(reported, 'partial', 'altitude');
    await waitUntil(() => flatIds(peer).join() === 'raised', 'ground-track fallback', { timeout: 2000 });
  });

  it('falls back to ground tracks when the elevated renderer fails, and keeps context loss distinct', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    let reported: StateDetail[] = [];
    const { element, peer } = await env.mount(element => { reported = states(element); element.scene = { objects: [sceneArc('raised')] }; }, recordSourceData);
    await waitUntil(() => runtime.live().length === 1, 'elevated layer created', { timeout: 2000 });
    runtime.live()[0]!.host.onState?.('ready'); await settled(reported, 'ready');
    runtime.live()[0]!.host.onState?.('unavailable', 'context-lost'); await settled(reported, 'unavailable', 'context-lost');
    runtime.live()[0]!.host.onState?.('ready'); await settled(reported, 'ready');
    runtime.live()[0]!.host.onState?.('unavailable', 'render');
    await settled(reported, 'partial', 'altitude');
    expect(runtime.live().length).to.equal(0);
    await waitUntil(() => flatIds(peer).join() === 'raised', 'ground-track fallback', { timeout: 2000 });
    // A newer accepted scene retries the renderer.
    element.scene = { objects: [sceneArc('again')] };
    await waitUntil(() => runtime.live().length === 1, 'renderer retried', { timeout: 2000 });
  });

  it('forwards style replacement, replaces the layer for a new scene and disposes it on disconnect', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    const { element } = await env.mount(element => { element.scene = { objects: [sceneArc('raised')] }; });
    await waitUntil(() => runtime.live().length === 1, 'elevated layer created', { timeout: 2000 });
    const first = runtime.live()[0]!, before = first.calls.length;
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady(); await element.updateComplete;
    await waitUntil(() => first.calls.slice(before).includes('ready'), 'style replay forwarded', { timeout: 2000 });
    expect(first.calls.slice(before).filter(call => call === 'style' || call === 'ready')).to.deep.equal(['style', 'ready']);
    element.scene = { objects: [sceneArc('other')] };
    await waitUntil(() => first.disposed && runtime.live().length === 1, 'replacement layer', { timeout: 2000 });
    const second = runtime.live()[0]!;
    expect(second.host.signal.aborted).to.equal(false);
    element.scene = { objects: [{ ...scenePath('flat') }] };
    await waitUntil(() => second.disposed, 'flat-only scene retires the elevated layer', { timeout: 2000 });
    element.scene = { objects: [sceneArc('raised')] };
    await waitUntil(() => runtime.live().length === 1, 'elevated layer again', { timeout: 2000 });
    const third = runtime.live()[0]!;
    element.remove();
    expect(third.disposed).to.equal(true); expect(third.host.signal.aborted).to.equal(true);
  });

  it('treats a module without a valid handle as unavailable', async () => {
    env.setLayerImporter(async () => ({ createSceneLayer: () => ({}) }));
    let reported: StateDetail[] = [];
    await env.mount(element => { reported = states(element); element.scene = { objects: [sceneArc('raised')] }; });
    await settled(reported, 'partial', 'altitude');
  });

  it('leaves flat lines on the draped layer and never loads the bridge for them', async () => {
    let imports = 0; env.setLayerImporter(async () => { imports++; return {}; });
    let reported: StateDetail[] = [];
    await env.mount(element => { reported = states(element); element.scene = { objects: [scenePath('flat')] }; });
    await settled(reported, 'ready');
    expect(imports).to.equal(0);
  });
});
