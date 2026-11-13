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

  it('keeps a layer hidden across pending bridge loading and preserves the admitted insertion target', async () => {
    const runtime = fakeRuntime(); let finish: (() => void) | undefined;
    env.setLayerImporter(async () => { await new Promise<void>(resolve => { finish = resolve; }); return runtime.module; });
    const { element, peer } = await env.mount();
    const descriptor = { ...layer({ before: 'labels' }) };
    const handle = addMapCustomLayer(element, descriptor);
    handle.setVisible(false);
    descriptor.before = 'changed'; descriptor.label = 'Changed';
    await waitUntil(() => finish !== undefined, 'bridge loading is pending');
    expect(runtime.records).to.have.lengthOf(0);
    finish!();
    await waitUntil(() => runtime.live().length === 1, 'hidden layer receives its bridge');
    const record = runtime.live()[0]!;
    expect(record.layer.before).to.equal('labels'); expect(record.layer.label).to.equal('Coverage cone');
    expect(record.calls).to.deep.equal(['visible:false']);
    record.hit = { id: 'target' };
    let activations = 0;
    element.addEventListener('lr-map-scene-activate', () => { activations++; });
    peer.fire('click', { point: { x: 1, y: 2 } }); await renderTurns();
    expect(record.calls).to.deep.equal(['visible:false']); expect(activations).to.equal(0);
    handle.setVisible(true);
    const activated = oneEvent(element, 'lr-map-scene-activate');
    peer.fire('click', { point: { x: 1, y: 2 } });
    expect((await activated).detail.id).to.equal('target'); expect(activations).to.equal(1);
  });

  it('does not construct a removed layer after its bridge resolves and accepts a later layer', async () => {
    const runtime = fakeRuntime(); let finish: (() => void) | undefined;
    env.setLayerImporter(async () => { await new Promise<void>(resolve => { finish = resolve; }); return runtime.module; });
    const { element } = await env.mount();
    const retired = addMapCustomLayer(element, layer());
    await waitUntil(() => finish !== undefined, 'bridge loading is pending');
    retired.remove(); finish!(); await renderTurns();
    expect(runtime.records).to.have.lengthOf(0); expect(retired.status.state).to.equal('removed');
    const replacement = addMapCustomLayer(element, layer());
    await waitUntil(() => runtime.live().length === 1, 'replacement layer installs from the loaded bridge');
    const record = runtime.live()[0]!;
    retired.remove(); retired.requestRender(); retired.setVisible(false);
    expect(record.disposed).to.equal(false); expect(record.calls).to.deep.equal([]);
    replacement.requestRender(); expect(record.calls).to.deep.equal(['frame']);
    replacement.remove(); expect(record.disposed).to.equal(true);
  });

  for (const invalid of [undefined, {}]) {
    it(`reports an unavailable bridge for a ${invalid === undefined ? 'missing' : 'malformed'} handle and allows a valid replacement`, async () => {
      env.setLayerImporter(async () => ({ createSceneLayer: () => invalid }));
      const { element } = await env.mount();
      const failed = addMapCustomLayer(element, layer());
      await waitUntil(() => failed.status.state === 'unavailable', 'invalid bridge handle is rejected');
      expect(failed.status).to.deep.equal({ state: 'unavailable', code: 'engine' });
      expect(await failed.pick([1, 2])).to.equal(null);
      failed.remove();
      const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
      const replacement = addMapCustomLayer(element, layer());
      await waitUntil(() => runtime.live().length === 1, 'a valid bridge remains usable');
      runtime.live()[0]!.host.onState?.('ready');
      expect(replacement.status.state).to.equal('ready');
    });
  }

  it('contains observer failures while updating status and disposing the layer', async () => {
    const runtime = fakeRuntime(); env.setLayerImporter(async () => runtime.module);
    const { element } = await env.mount();
    const seen: string[] = [];
    const handle = addMapCustomLayer(element, layer(), { onStateChange: status => {
      seen.push(status.state); throw new Error('Observer unavailable');
    } });
    await waitUntil(() => runtime.live().length === 1, 'layer installs independently of its status observer');
    const record = runtime.live()[0]!;
    record.host.onState?.('ready'); expect(handle.status.state).to.equal('ready');
    record.host.onState?.('unavailable', 'context-lost'); expect(handle.status.code).to.equal('context-lost');
    handle.remove();
    expect(handle.status.state).to.equal('removed'); expect(record.disposed).to.equal(true);
    expect(record.host.signal.aborted).to.equal(true);
    expect(seen).to.deep.equal(['ready', 'unavailable', 'removed']);
    record.host.onState?.('ready'); expect(handle.status.state).to.equal('removed');
    expect(seen).to.have.lengthOf(3);
  });

  it('disposes a bridge handle returned after its status observer removes the layer', async () => {
    const runtime = fakeRuntime(), create = runtime.module.createSceneLayer;
    runtime.module.createSceneLayer = (map, descriptor, host) => {
      const created = create(map, descriptor, host);
      host.onState?.('ready');
      return created;
    };
    env.setLayerImporter(async () => runtime.module);
    const { element } = await env.mount();
    const statuses: string[] = [];
    const handle = addMapCustomLayer(element, layer(), { onStateChange: status => {
      statuses.push(status.state);
      if (status.state === 'ready') handle.remove();
    } });
    await waitUntil(() => runtime.records.length === 1, 'bridge construction completes');
    const record = runtime.records[0]!;
    expect(record.disposed).to.equal(true); expect(record.host.signal.aborted).to.equal(true);
    expect(handle.status.state).to.equal('removed'); expect(statuses).to.deep.equal(['ready', 'removed']);
    handle.requestRender(); expect(record.calls).to.deep.equal([]);
  });

  it('discards a pending explicit pick after the layer is removed', async () => {
    const runtime = fakeRuntime(), create = runtime.module.createSceneLayer;
    let finish: ((hit: FakeHandleRecord['hit']) => void) | undefined;
    runtime.module.createSceneLayer = (map, descriptor, host) => ({
      ...create(map, descriptor, host),
      pick: () => new Promise<FakeHandleRecord['hit']>(resolve => { finish = resolve; }),
    });
    env.setLayerImporter(async () => runtime.module);
    const { element } = await env.mount();
    const handle = addMapCustomLayer(element, layer());
    await waitUntil(() => runtime.live().length === 1, 'bridge is available');
    const pending = handle.pick([1, 2]);
    await waitUntil(() => finish !== undefined, 'pick is pending in the bridge');
    handle.remove(); finish!({ id: 'obsolete' });
    expect(await pending).to.equal(null);
    expect(runtime.records[0]!.disposed).to.equal(true); expect(handle.status.state).to.equal('removed');
  });

  it('finishes removal when bridge disposal and native listener cleanup throw after releasing resources', async () => {
    const runtime = fakeRuntime(), create = runtime.module.createSceneLayer;
    runtime.module.createSceneLayer = (map, descriptor, host) => {
      const created = create(map, descriptor, host);
      return { ...created, dispose() { created.dispose(); throw new Error('Bridge cleanup failed'); } };
    };
    env.setLayerImporter(async () => runtime.module);
    const { element, peer } = await env.mount();
    const listenersBefore = peer.events.get('click')?.size ?? 0;
    const handle = addMapCustomLayer(element, layer());
    await waitUntil(() => runtime.live().length === 1, 'bridge is available');
    expect(peer.events.get('click')?.size).to.equal(listenersBefore + 1);
    const descriptor = Object.getOwnPropertyDescriptor(peer, 'off'), original = peer.off.bind(peer);
    Object.defineProperty(peer, 'off', { configurable: true, value: (name: string, listener: (event: Record<string, unknown>) => void) => {
      original(name, listener); throw new Error('Native cleanup failed');
    } });
    try {
      handle.remove(); handle.remove();
      expect(handle.status.state).to.equal('removed'); expect(runtime.records[0]!.disposed).to.equal(true);
      expect(runtime.records[0]!.host.signal.aborted).to.equal(true);
      expect(peer.events.get('click')?.size).to.equal(listenersBefore);
    } finally {
      if (descriptor) Object.defineProperty(peer, 'off', descriptor); else Reflect.deleteProperty(peer, 'off');
    }
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
    for (const event of [{ point: 'nowhere' }, { point: null },
      { point: { x: NaN, y: 1 } }, { point: { x: 1, y: Infinity } }, { point: { x: '1', y: 2 } }]) peer.fire('click', event);
    await renderTurns();
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
  for (const failure of ['capability', 'disposal-getter', 'disposal-call'] as const) {
    it(`reports unavailable when bridge validation encounters a throwing ${failure}`, async () => {
      const runtime = fakeRuntime(), create = runtime.module.createSceneLayer;
      runtime.module.createSceneLayer = (map, descriptor, host) => {
        const created = create(map, descriptor, host);
        if (failure === 'disposal-getter') {
          Object.defineProperty(created, 'dispose', { get() { throw new Error('Disposal getter failed'); } });
        } else {
          Object.defineProperty(created, 'invalidateStyle', { get() { throw new Error('Capability getter failed'); } });
          if (failure === 'disposal-call') {
            const dispose = created.dispose;
            created.dispose = () => { dispose(); throw new Error('Disposal call failed'); };
          }
        }
        return created;
      };
      env.setLayerImporter(async () => runtime.module);
      const { element } = await env.mount();
      const failed = addMapCustomLayer(element, layer());
      await waitUntil(() => failed.status.state === 'unavailable', 'invalid bridge settles as unavailable');
      expect(failed.status).to.deep.equal({ state: 'unavailable', code: 'engine' });
      expect(runtime.records[0]!.host.signal.aborted).to.equal(true);
      if (failure !== 'disposal-getter') expect(runtime.records[0]!.disposed).to.equal(true);
      expect(await failed.pick([1, 2])).to.equal(null);
      failed.remove();
      const replacementRuntime = fakeRuntime(); env.setLayerImporter(async () => replacementRuntime.module);
      const replacement = addMapCustomLayer(element, layer());
      await waitUntil(() => replacementRuntime.live().length === 1, 'a replacement bridge can install');
      replacementRuntime.live()[0]!.host.onState?.('ready');
      expect(replacement.status.state).to.equal('ready');
      replacement.remove(); expect(replacementRuntime.records[0]!.disposed).to.equal(true);
    });
  }
});
