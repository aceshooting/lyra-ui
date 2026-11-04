import { expect, fixtureCleanup, oneEvent, waitUntil } from '@open-wc/testing';
import { renderEnvironment, renderTurns } from '../test/map-scene-render-component-fixtures.js';
import type { LyraMapCustomLayer, LyraMapCustomLayerStatus } from './map-custom-layers.js';
import { addMapCustomLayer } from './map-custom-layers.js';

interface FakeHandleRecord {
  readonly map: unknown;
  readonly layer: LyraMapCustomLayer;
  readonly host: { readonly signal: AbortSignal; onState?(state: string, code?: string): void; reducedMotion?(): boolean };
  readonly calls: string[];
  disposed: boolean;
  hit: { id: string; position?: { lngLat: readonly [number, number] } } | null;
}

function fakeRuntime() {
  const records: FakeHandleRecord[] = [];
  const module = {
    createSceneLayer(map: unknown, layer: LyraMapCustomLayer, host: FakeHandleRecord['host']) {
      const record: FakeHandleRecord = { map, layer, host, calls: [], disposed: false, hit: null };
      records.push(record);
      return {
        invalidateStyle() { record.calls.push('style'); }, styleReady() { record.calls.push('ready'); },
        requestFrame() { record.calls.push('frame'); }, setVisible(value: boolean) { record.calls.push(`visible:${value}`); },
        pick: async (point: readonly [number, number]) => { record.calls.push(`pick:${point.join(',')}`); return record.hit; },
        dispose() { record.disposed = true; },
      };
    },
  };
  return { records, module, live: () => records.filter(record => !record.disposed) };
}
const layer = (overrides: Partial<LyraMapCustomLayer> = {}): LyraMapCustomLayer => ({
  id: 'cone', label: 'Coverage cone', create: () => ({ render() {}, dispose() {} }), ...overrides,
});

describe('addMapCustomLayer()', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });

  it('installs on the style-ready native map and reports engine states', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    const { element, peer } = await env.mount();
    const statuses: LyraMapCustomLayerStatus[] = [];
    let created = 0;
    const source = { id: 'cone', label: 'Cone', create() { created++; expect(this === source).to.equal(true); return { render() {}, dispose() {} }; } };
    const handle = addMapCustomLayer(element, source, { onStateChange: status => statuses.push(status) });
    expect(handle.id).to.equal('cone'); expect(handle.status).to.deep.equal({ state: 'loading' });
    await waitUntil(() => runtime.live().length === 1, 'engine layer created', { timeout: 2000 });
    const [record] = runtime.live();
    expect(record!.map === peer).to.equal(true);
    expect([record!.layer.id, record!.layer.label, record!.layer.before]).to.deep.equal(['cone', 'Cone', undefined]);
    expect(Object.isFrozen(record!.layer)).to.equal(true);
    record!.layer.create({} as never); expect(created).to.equal(1);
    expect(record!.host.reducedMotion?.()).to.equal(false);
    record!.host.onState?.('ready');
    expect(handle.status).to.deep.equal({ state: 'ready' });
    record!.host.onState?.('ready');
    record!.host.onState?.('unavailable', 'context-lost');
    expect(statuses).to.deep.equal([{ state: 'ready' }, { state: 'unavailable', code: 'context-lost' }]);
    handle.requestRender(); handle.setVisible(false); handle.setVisible(true);
    expect(record!.calls).to.deep.equal(['frame', 'visible:false', 'visible:true']);
    handle.remove(); handle.remove();
    expect(record!.disposed).to.equal(true); expect(record!.host.signal.aborted).to.equal(true);
    expect(handle.status).to.deep.equal({ state: 'removed' }); expect(statuses.at(-1)).to.deep.equal({ state: 'removed' });
    expect(await handle.pick([1, 2])).to.equal(null);
  });

  it('replays style replacement and disposes permanently on disconnect', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    const { element } = await env.mount();
    const handle = addMapCustomLayer(element, layer());
    await waitUntil(() => runtime.live().length === 1, 'engine layer created', { timeout: 2000 });
    const [record] = runtime.live();
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady(); await element.updateComplete; await renderTurns();
    expect(record!.calls.filter(call => call === 'style' || call === 'ready')).to.deep.equal(['style', 'ready']);
    expect(runtime.records.length).to.equal(1);
    element.remove(); await renderTurns();
    expect(record!.disposed).to.equal(true); expect(handle.status.state).to.equal('removed');
    document.body.append(element); await element.updateComplete; await renderTurns();
    expect(runtime.records.length).to.equal(1, 'a disconnected layer never resurrects');
    element.remove();
  });

  it('emits lr-map-scene-activate with kind custom for a pointer pick hit', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    const { element, peer } = await env.mount();
    addMapCustomLayer(element, layer());
    await waitUntil(() => runtime.live().length === 1, 'engine layer created', { timeout: 2000 });
    const [record] = runtime.live();
    peer.fire('click', { point: { x: 5, y: 6 } }); await renderTurns();
    expect(record!.calls).to.include('pick:5,6');
    record!.hit = { id: 'beam-1', position: { lngLat: [6, 49] } };
    const activation = oneEvent(element, 'lr-map-scene-activate');
    peer.fire('click', { point: { x: 7, y: 8 } });
    const event = await activation;
    expect(event.detail).to.deep.equal({ id: 'beam-1', kind: 'custom', layerId: 'cone', source: 'pointer', position: { lngLat: [6, 49] } });
    expect([event.bubbles, event.composed, event.cancelable]).to.deep.equal([true, true, false]);
    peer.fire('click', { point: 'nowhere' }); await renderTurns();
    expect(record!.calls.filter(call => call.startsWith('pick')).length).to.equal(2);
  });

  it('reports an unavailable engine when the optional bridge cannot load or misbehaves', async () => {
    const { element } = await env.mount();
    const failed = addMapCustomLayer(element, layer());
    await waitUntil(() => failed.status.state === 'unavailable', 'unavailable', { timeout: 2000 });
    expect(failed.status).to.deep.equal({ state: 'unavailable', code: 'engine' });
    env.setLayerImporter(async () => ({ createSceneLayer: () => { throw new Error('refused'); } }));
    const refused = addMapCustomLayer(element, layer({ id: 'b' }));
    await waitUntil(() => refused.status.state === 'unavailable', 'refused', { timeout: 2000 });
    env.setLayerImporter(async () => { throw new Error('offline'); });
    const offline = addMapCustomLayer(element, layer({ id: 'c' }));
    await waitUntil(() => offline.status.state === 'unavailable', 'offline', { timeout: 2000 });
  });

  it('refuses malformed descriptors and elements that are not connected maps', async () => {
    const { element } = await env.mount();
    for (const value of [null, {}, { id: ' ', label: 'x', create() {} }, { id: 'x', label: 'x' },
      { id: 'x', label: 'x', create() {}, before: '' }, Object.defineProperty({ label: 'x', create() {} }, 'id', { get: () => 'x' })]) {
      expect(() => addMapCustomLayer(element, value as never)).to.throw(TypeError);
    }
    expect(() => addMapCustomLayer(document.createElement('div'), layer())).to.throw(TypeError, /connected lr-map/u);
  });

  it('waits for the native map before installing when added during construction', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    let handleState = '';
    await env.mount(element => {
      element.addEventListener('lr-map-load', () => { handleState ||= 'loaded'; });
      // Connected but not yet constructed: the lease has no native map until its style is ready.
      queueMicrotask(() => { const handle = addMapCustomLayer(element, layer()); handleState = handle.status.state; });
    });
    await waitUntil(() => runtime.live().length === 1, 'installed after style ready', { timeout: 2000 });
    expect(handleState).to.equal('loading');
  });
});
