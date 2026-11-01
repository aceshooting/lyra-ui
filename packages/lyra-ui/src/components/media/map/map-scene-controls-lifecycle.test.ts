import { expect } from '@open-wc/testing';
import { normalizeMapControlOptions } from './map-control-options.js';
import { MapControlsLifecycle, type MapControlLifecycleContext, type MapControlLifecycleEvent,
  type MapManagedControl, type MapManagedControlConstructor } from './map-controls-lifecycle.js';
import { MapGlobeControl, MapTerrainControl } from './map-scene-controls.js';

const options = (input: unknown) => normalizeMapControlOptions(input).controls;
function peer() {
  const canvas = document.createElement('canvas');
  const corner = document.createElement('div');
  const listeners = new Map<string, Set<() => void>>();
  const installed: { control: MapManagedControl; root: HTMLElement }[] = [];
  const removed: MapManagedControl[] = [];
  const value = {
    projection: { type: 'mercator' },
    terrain: null,
    onFirstSubscription: undefined as (() => void) | undefined,
    getCanvas: () => canvas,
    getStyle: () => ({ sources: { dem: { type: 'raster-dem' } } }),
    getProjection: () => value.projection,
    getTerrain: () => value.terrain,
    setProjection: () => { throw new Error('Control must not mutate projection'); },
    setTerrain: () => { throw new Error('Control must not mutate terrain'); },
    on(type: string, listener: () => void) {
      const set = listeners.get(type) ?? new Set(); set.add(listener); listeners.set(type, set);
      const callback = value.onFirstSubscription; value.onFirstSubscription = undefined; callback?.();
    },
    off(type: string, listener: () => void) { listeners.get(type)?.delete(listener); },
    addControl(control: MapManagedControl) {
      const root = control.onAdd!(value); installed.push({ control, root }); corner.append(root);
    },
    removeControl(control: MapManagedControl) {
      removed.push(control); (control as MapGlobeControl).onRemove();
    },
    controlContainer: () => corner,
  };
  return { value, listeners, installed, removed, corner };
}
function context(events: MapControlLifecycleEvent[], label = 'Globe', busy = false): MapControlLifecycleContext {
  return {
    isCurrent: () => true,
    onEvent: event => { events.push(event); },
    onFailure: () => { throw new Error('Unexpected scene control failure'); },
    scene: {
      isCurrent: () => true,
      state: () => ({ ready: true, busy, label }),
      unavailable: () => undefined,
    },
  };
}
function button(root: HTMLElement): HTMLButtonElement {
  const result = root.querySelector('button');
  if (!result) throw new Error('Missing scene control button');
  return result;
}
const loader = async (kind: string) => kind === 'globe' ? MapGlobeControl : MapTerrainControl;

describe('scene adapter lifecycle ownership', () => {
  for (const retirement of ['removal', 'dispose'] as const) {
    it(`does not install a delayed scene adapter after ${retirement}`, async () => {
      const h = peer(), events: MapControlLifecycleEvent[] = [];
      let release!: (value: MapManagedControlConstructor) => void;
      const manager = new MapControlsLifecycle(() => new Promise(resolve => { release = resolve; }));
      const pending = manager.sync(h.value, options({ globe: true }), context(events));
      if (retirement === 'dispose') manager.dispose();
      else await manager.sync(h.value, options({}), context(events));
      release(MapGlobeControl); await pending;
      expect(h.installed.length).to.equal(0); expect(h.corner.children.length).to.equal(0);
      expect(events).to.deep.equal([]); expect([...h.listeners.values()].every(set => set.size === 0)).to.equal(true);
      manager.dispose();
    });
  }

  for (const retirement of ['replace', 'dispose'] as const) {
    it(`retires native subscriptions and activation after onAdd reenters ${retirement}`, async () => {
      const h = peer(), events: MapControlLifecycleEvent[] = [];
      const manager = new MapControlsLifecycle(loader);
      let replacement: Promise<void> | undefined;
      h.value.onFirstSubscription = () => {
        if (retirement === 'dispose') manager.dispose();
        else replacement = manager.sync(h.value, options({ terrain: { source: 'dem' } }), context(events, 'Terrain'));
      };
      await manager.sync(h.value, options({ globe: true }), context(events));
      await replacement;
      expect(h.installed.length).to.equal(retirement === 'replace' ? 2 : 1);
      expect(h.removed.length).to.equal(1);
      const old = h.installed[0]!;
      expect(old.root.isConnected).to.equal(false);
      button(old.root).click(); expect(events).to.deep.equal([]);
      if (retirement === 'replace') {
        const current = h.installed[1]!;
        expect(h.corner.contains(current.root)).to.equal(true);
        button(current.root).click();
        expect(events).to.deep.equal([{ kind: 'scene-action', action: { kind: 'terrain', pressed: false, terrain: { source: 'dem', exaggeration: 1 } } }]);
        expect([...h.listeners.values()].every(set => set.size === 1)).to.equal(true);
      }
      manager.dispose();
      expect([...h.listeners.values()].every(set => set.size === 0)).to.equal(true);
      expect(h.corner.children.length).to.equal(0);
    });
  }

  it('retains its root while refreshing state and dispatching through the newest context', async () => {
    const h = peer(), first: MapControlLifecycleEvent[] = [], latest: MapControlLifecycleEvent[] = [];
    const manager = new MapControlsLifecycle(loader), desired = options({ globe: true });
    await manager.sync(h.value, desired, context(first));
    const root = h.installed[0]!.root, target = button(root);
    h.value.projection = { type: 'globe' };
    await manager.sync(h.value, desired, context(latest, 'Planet', true));
    expect(h.installed.length).to.equal(1); expect(h.removed.length).to.equal(0);
    expect(target.getAttribute('aria-label')).to.equal('Planet');
    expect(target.disabled).to.equal(true); expect(target.getAttribute('aria-busy')).to.equal('true');
    target.click(); expect(latest).to.deep.equal([]);
    await manager.sync(h.value, desired, context(latest, 'Planet', false));
    expect(target.getAttribute('aria-pressed')).to.equal('true'); expect(target.disabled).to.equal(false);
    target.click();
    expect(first).to.deep.equal([]);
    expect(latest).to.deep.equal([{ kind: 'scene-action', action: { kind: 'globe', pressed: true } }]);
    manager.dispose();
    expect([...h.listeners.values()].every(set => set.size === 0)).to.equal(true);
  });
});
