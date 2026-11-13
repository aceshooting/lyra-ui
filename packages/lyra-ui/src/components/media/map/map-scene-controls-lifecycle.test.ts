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

describe('scene control callback retirement', () => {
  it('attempts every unsubscribe after partial subscription failure and can be installed again', () => {
    const h = peer(), control = new MapGlobeControl();
    const subscribe = h.value.on, unsubscribe = h.value.off;
    const removed: string[] = [];
    let attempts = 0;
    h.value.on = (type, listener) => {
      subscribe(type, listener);
      if (++attempts === 3) throw new Error('Peer subscription failed');
    };
    h.value.off = (type, listener) => {
      removed.push(type); unsubscribe(type, listener);
      if (type === 'terrain') throw new Error('Peer already removed');
    };
    control.setSceneContext(context([]).scene!);
    try {
      expect(() => control.onAdd(h.value)).to.throw('Peer subscription failed');
      expect(removed).to.deep.equal(['terrain', 'projectiontransition', 'style.load', 'sourcedata', 'idle']);
      expect([...h.listeners.values()].every(set => set.size === 0)).to.equal(true);
      h.value.on = subscribe; h.value.off = unsubscribe;
      const root = control.onAdd(h.value);
      expect(button(root).disabled).to.equal(false);
      expect([...h.listeners.values()].every(set => set.size === 1)).to.equal(true);
    } finally { control.onRemove(); }
  });

  it('ignores a queued refresh from the previous installation while servicing the replacement', async () => {
    const h = peer(), control = new MapGlobeControl();
    let reads = 0, activations = 0;
    control.setSceneContext({ isCurrent: () => true,
      state: () => { reads++; return { ready: true, busy: false, label: 'Globe' }; },
      unavailable: () => undefined });
    control.on('activate', () => { activations++; });
    try {
      const previous = control.onAdd(h.value);
      h.listeners.get('idle')!.forEach(listener => listener());
      control.onRemove();
      const current = control.onAdd(h.value);
      const before = reads;
      h.listeners.get('idle')!.forEach(listener => listener());
      await Promise.resolve();
      expect(reads).to.equal(before + 1);
      button(previous).click(); expect(activations).to.equal(0);
      button(current).click(); expect(activations).to.equal(1);
      await Promise.resolve();
      expect(button(current).disabled).to.equal(false);
      expect([...h.listeners.values()].every(set => set.size === 1)).to.equal(true);
    } finally { control.onRemove(); }
  });

  for (const boundary of ['state', 'projection'] as const) {
    it(`does not publish stale state after its ${boundary} callback retires the control`, () => {
      const h = peer(), control = new MapGlobeControl();
      let armed = false, publications = 0;
      const retire = () => { if (armed) { armed = false; control.onRemove(); } };
      const projection = h.value.getProjection;
      h.value.getProjection = () => { if (boundary === 'projection') retire(); return projection(); };
      control.setSceneContext({ isCurrent: () => true,
        state: () => { const label = armed ? 'Obsolete' : 'Globe'; if (boundary === 'state') retire(); return { ready: true, busy: false, label }; },
        unavailable: () => { publications++; } });
      try {
        const root = control.onAdd(h.value), initial = publications;
        armed = true;
        control.refreshSceneControl();
        expect(publications).to.equal(initial);
        expect(button(root).getAttribute('aria-label')).to.equal('Globe');
        expect([...h.listeners.values()].every(set => set.size === 0)).to.equal(true);
        const replacement = control.onAdd(h.value);
        expect(button(replacement).disabled).to.equal(false);
        expect(publications).to.equal(initial + 1);
      } finally { control.onRemove(); }
    });
  }

  it('stops an activation dispatch when the first subscriber removes the control', async () => {
    const h = peer(), control = new MapGlobeControl(), seen: string[] = [];
    const retire = () => { seen.push('first'); control.onRemove(); };
    control.on('activate', retire);
    control.on('activate', () => { seen.push('second'); });
    control.setSceneContext(context([]).scene!);
    try {
      const previous = control.onAdd(h.value);
      button(previous).click();
      expect(seen).to.deep.equal(['first']);
      expect([...h.listeners.values()].every(set => set.size === 0)).to.equal(true);
      control.off('activate', retire);
      const replacement = control.onAdd(h.value);
      button(replacement).click();
      expect(seen).to.deep.equal(['first', 'second']);
      await Promise.resolve();
      expect(button(replacement).disabled).to.equal(false);
    } finally { control.onRemove(); }
  });

  it('refuses unconfigured terrain activation but allows disabling an already active terrain', async () => {
    const h = peer(), control = new MapTerrainControl(), events: unknown[] = [], unavailable: boolean[] = [];
    let active = false;
    const backend = { ...h.value, getTerrain: () => active ? { source: 'dem' } : null };
    control.setSceneContext({ isCurrent: () => true, state: () => ({ ready: true, busy: false, label: 'Terrain' }),
      unavailable: (_kind, value) => { unavailable.push(value); } });
    control.on('activate', event => { events.push(event); });
    try {
      const root = control.onAdd(backend), target = button(root);
      expect(target.disabled).to.equal(true); expect(unavailable.at(-1)).to.equal(true);
      target.click();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(events).to.deep.equal([]);
      active = true; control.refreshSceneControl();
      expect(target.disabled).to.equal(false); expect(target.getAttribute('aria-pressed')).to.equal('true');
      target.click(); expect(events).to.deep.equal([{ kind: 'terrain', pressed: true }]);
      await Promise.resolve();
      expect(unavailable.at(-1)).to.equal(false); expect(target.disabled).to.equal(false);
    } finally { control.onRemove(); }
  });
});
