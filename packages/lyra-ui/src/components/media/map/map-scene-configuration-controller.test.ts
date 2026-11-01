import { expect } from '@open-wc/testing';
import { MapSceneConfigurationController } from './map-scene-configuration-controller.js';

function harness() {
  let projection: unknown = { type: 'globe' };
  let terrain: unknown = { source: 'dem', exaggeration: 2 };
  let failed = 0;
  const writes: string[] = [];
  const preparations: unknown[] = [];
  const errors = new Set<() => void>();
  const peer = {
    getStyle: () => ({ sources: { dem: { type: 'raster-dem' } }, projection, terrain }),
    getProjection: () => projection,
    getTerrain: () => terrain,
    setProjection(value: unknown) { writes.push('projection'); projection = value; },
    setTerrain(value: unknown) { writes.push('terrain'); terrain = value; },
    prepareFeatures: async (requirements: unknown, _options?: { signal?: AbortSignal }) => { preparations.push(requirements); },
    on(_type: string, listener: () => void) { errors.add(listener); },
    off(_type: string, listener: () => void) { errors.delete(listener); },
  };
  const controller = new MapSceneConfigurationController({ changed: () => undefined, failed: () => { failed++; } });
  return { controller, peer, writes, preparations, errors, get failed() { return failed; }, get projection() { return projection; }, get terrain() { return terrain; } };
}

describe('map scene configuration controller', () => {
  it('captures once, applies only owned fields, and restores the original baseline', async () => {
    const h = harness();
    h.controller.sync(h.peer, 1, () => true, 'mercator', undefined); await h.controller.work;
    expect(h.writes).to.deep.equal(['projection']); expect(h.terrain).to.deep.equal({ source: 'dem', exaggeration: 2 });
    h.controller.sync(h.peer, 1, () => true, undefined, null); await h.controller.work;
    expect(h.projection).to.deep.equal({ type: 'globe' }); expect(h.terrain).to.equal(null);
    h.controller.sync(h.peer, 1, () => true, undefined, undefined); await h.controller.work;
    expect(h.terrain).to.deep.equal({ source: 'dem', exaggeration: 2 });
    const count = h.writes.length; h.controller.sync(h.peer, 1, () => true, undefined, undefined); await h.controller.work;
    expect(h.writes.length).to.equal(count);
  });
  it('releases a superseded uncooperative preparation without letting it mutate the map', async () => {
    const h = harness(); let resolve!: () => void;
    h.peer.prepareFeatures = () => new Promise<void>(yes => { resolve = yes; });
    h.controller.sync(h.peer, 1, () => true, 'mercator', undefined);
    const previous = h.controller.work;
    h.peer.prepareFeatures = async () => undefined;
    h.controller.sync(h.peer, 1, () => true, 'globe', null); await h.controller.work; await previous;
    expect(h.projection).to.deep.equal({ type: 'globe' }); expect(h.terrain).to.equal(null);
    resolve(); await Promise.resolve(); expect(h.writes).to.deep.equal(['terrain']);
  });
  it('rejects missing callable getters before any mutation', async () => {
    const h = harness(); Reflect.set(h.peer, 'getProjection', undefined);
    h.controller.sync(h.peer, 1, () => true, 'mercator', null); await h.controller.work;
    expect(h.failed).to.equal(1); expect(h.writes).to.deep.equal([]);
  });
  it('treats a native synchronous error event as failure even if the setter returns normally', async () => {
    const h = harness(); h.peer.setProjection = () => { for (const error of h.errors) error(); };
    h.controller.sync(h.peer, 1, () => true, 'mercator', null); await h.controller.work;
    expect(h.failed).to.equal(1); expect(h.writes).to.deep.equal([]); expect(h.errors.size).to.equal(0);
  });
  it('abandons a reentrant baseline getter when the style changes', async () => {
    const h = harness(); let current = true;
    h.peer.getProjection = () => { current = false; return { type: 'globe' }; };
    h.controller.sync(h.peer, 1, () => current, 'mercator', null); await h.controller.work;
    expect(h.writes).to.deep.equal([]); expect(h.failed).to.equal(0);
  });
  it('does not require optional scene APIs for an unset configuration', async () => {
    const h = harness();
    h.controller.sync({}, 1, () => true, undefined, undefined); await h.controller.work;
    expect(h.failed).to.equal(0); expect(h.controller.pending).to.equal(false);
  });
  it('revalidates the exact source after preparation and before either setter', async () => {
    const h = harness(); let release!: () => void;
    h.peer.prepareFeatures = () => new Promise<void>(resolve => { release = resolve; });
    h.controller.sync(h.peer, 1, () => true, 'mercator', { source: 'dem', exaggeration: 3 });
    Reflect.set(h.peer, 'getStyle', () => ({ sources: {}, projection: h.projection, terrain: h.terrain }));
    release(); await h.controller.work;
    expect(h.failed).to.equal(1); expect(h.writes).to.deep.equal([]);
  });
  it('validates capability and sources even for an explicit matching override', async () => {
    const h = harness(); Reflect.set(h.peer, 'setProjection', undefined);
    h.controller.sync(h.peer, 1, () => true, 'globe', undefined); await h.controller.work;
    expect(h.failed).to.equal(1); expect(h.writes).to.deep.equal([]);
  });
  it('records native effects before a synchronous callback releases ownership', async () => {
    const h = harness(); const set = h.peer.setProjection.bind(h.peer); let release = true;
    h.peer.setProjection = value => {
      set(value);
      if (release) { release = false; h.controller.sync(h.peer, 1, () => true, undefined, undefined); }
    };
    h.controller.sync(h.peer, 1, () => true, 'mercator', undefined);
    await h.controller.work; await Promise.resolve(); await h.controller.work;
    expect(h.projection).to.deep.equal({ type: 'globe' }); expect(h.failed).to.equal(0);
  });

  it('preserves live unowned fields and acquires ownership against their actual native value', async () => {
    const h = harness();
    h.controller.sync(h.peer, 1, () => true, 'mercator', undefined); await h.controller.work;
    h.peer.setTerrain(null);
    h.controller.sync(h.peer, 1, () => true, 'globe', undefined); await h.controller.work;
    expect(h.terrain).to.equal(null);
    expect(Object.hasOwn(h.preparations[h.preparations.length - 1] as object, 'terrain')).to.equal(false);
    h.controller.sync(h.peer, 1, () => true, 'globe', { source: 'dem', exaggeration: 2 }); await h.controller.work;
    expect(h.terrain).to.deep.equal({ source: 'dem', exaggeration: 2 });
    h.controller.sync(h.peer, 1, () => true, undefined, undefined); await h.controller.work;
    expect(h.projection).to.deep.equal({ type: 'globe' }); expect(h.terrain).to.deep.equal({ source: 'dem', exaggeration: 2 });
  });

  it('does not validate an obsolete unowned terrain source after pending preparation', async () => {
    const h = harness(); let release!: () => void;
    h.peer.prepareFeatures = async requirements => {
      h.preparations.push(requirements);
      await new Promise<void>(resolve => { release = resolve; });
    };
    h.controller.sync(h.peer, 1, () => true, 'mercator', undefined);
    h.peer.setTerrain({ source: 'replacement', exaggeration: 1 });
    h.writes.length = 0;
    Reflect.set(h.peer, 'getStyle', () => ({ sources: { replacement: { type: 'raster-dem' } }, projection: h.projection, terrain: h.terrain }));
    release(); await h.controller.work;
    expect(h.failed).to.equal(0); expect(h.writes).to.deep.equal(['projection']);
    expect(h.terrain).to.deep.equal({ source: 'replacement', exaggeration: 1 });
    expect(h.projection).to.deep.equal({ type: 'mercator' });
  });

  it('leaves a caller-owned custom projection intact when only terrain participates', async () => {
    const h = harness(); h.peer.setProjection({ type: 'custom-projection' }); h.writes.length = 0;
    h.controller.sync(h.peer, 1, () => true, undefined, null); await h.controller.work;
    expect(h.failed).to.equal(0); expect(h.writes).to.deep.equal(['terrain']);
    expect(h.projection).to.deep.equal({ type: 'custom-projection' });
    expect(Object.hasOwn(h.preparations[0] as object, 'projection')).to.equal(false);
  });

});
