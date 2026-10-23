import { expect } from '@open-wc/testing';
import { normalizeMapControlOptions } from './map-control-options.js';
import { MapControlsLifecycle, type MapManagedControl, type MapControlLifecycleEvent } from './map-controls-lifecycle.js';

class Control implements MapManagedControl {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  readonly retired: string[] = [];
  on(type: string, callback: (event: unknown) => void): this {
    const listeners = this.listeners.get(type) ?? new Set(); listeners.add(callback); this.listeners.set(type, listeners); return this;
  }
  off(type: string, callback: (event: unknown) => void): this {
    expect(this.listeners.get(type)?.has(callback)).to.equal(true);
    this.listeners.get(type)?.delete(callback); this.retired.push(type); return this;
  }
  fire(type: string, event: unknown): void { for (const callback of this.listeners.get(type) ?? []) callback(event); }
}
const options = (input: unknown) => normalizeMapControlOptions(input).controls;
function harness() {
  const installed: MapManagedControl[] = []; const removed: MapManagedControl[] = []; const created: Control[] = [];
  const events: MapControlLifecycleEvent[] = []; const failures: string[] = [];
  const map = {
    addControl(control: MapManagedControl) { installed.push(control); },
    removeControl(control: MapManagedControl) {
      expect([...((control as Control).listeners.values())].every(set => set.size === 0)).to.equal(true); removed.push(control);
    },
  };
  const context = { isCurrent: () => true, onEvent: (event: MapControlLifecycleEvent) => { events.push(event); },
    onFailure: (failure: { kind: string }) => { failures.push(failure.kind); } };
  const manager = new MapControlsLifecycle(async () => class extends Control { constructor() { super(); created.push(this); } });
  return { manager, map, context, installed, removed, created, events, failures };
}

describe('map controls lifecycle', () => {
  it('retains unchanged installed controls and uses the exact callbacks for retirement', async () => {
    const h = harness(); const desired = options({ geolocate: true, attribution: true });
    await h.manager.sync(h.map, desired, h.context); await h.manager.sync(h.map, desired, h.context);
    expect(h.installed.length).to.equal(2); h.manager.dispose();
    expect(h.removed.length).to.equal(2); expect(h.created[0]!.retired).to.deep.equal(['error', 'outofmaxbounds', 'geolocate']);
  });
  it('forwards only sanitized native error and out-of-bounds codes without activating location', async () => {
    const h = harness(); await h.manager.sync(h.map, options({ geolocate: true }), h.context);
    const control = h.created[0]!;
    control.fire('error', { code: 1, message: 'private', coords: [1, 2] });
    control.fire('error', { get code() { throw new Error('private'); } });
    control.fire('outofmaxbounds', { coords: [3, 4] });
    expect(h.events).to.deep.equal([{ kind: 'geolocate-error', code: 'permission-denied' },
      { kind: 'geolocate-error', code: 'unknown' }, { kind: 'geolocate-out-of-bounds', code: 'out-of-bounds' }]);
    const callback = [...control.listeners.get('error')!][0]!; h.manager.dispose(); callback({ code: 2 });
    expect(h.events.length).to.equal(3);
  });
  it('ignores a stale loader and retries an unchanged pending request on a new sync', async () => {
    const h = harness(); const resolves: ((constructor: typeof Control) => void)[] = [];
    const manager = new MapControlsLifecycle(() => new Promise(resolve => { resolves.push(resolve); }));
    const first = manager.sync(h.map, options({ navigation: true }), h.context);
    const second = manager.sync(h.map, options({ navigation: true }), h.context);
    resolves[0]!(Control); await first; expect(h.installed.length).to.equal(0);
    resolves[1]!(Control); await second; expect(h.installed.length).to.equal(1); manager.dispose();
  });
  it('reports a retry success with only a validated position and accuracy, and rejects a retired success callback', async () => {
    const h = harness(); await h.manager.sync(h.map, options({ geolocate: true }), h.context);
    const control = h.created[0]!;
    control.fire('error', { code: 1 });
    control.fire('geolocate', { coords: { longitude: 6.13, latitude: 49.61, accuracy: 25, altitude: 300, speed: 2 }, timestamp: 1 });
    control.fire('geolocate', { get coords() { throw new Error('Unreadable position'); } });
    control.fire('geolocate', { coords: { longitude: 200, latitude: 49, accuracy: 5 } });
    control.fire('geolocate', { coords: { longitude: 6, latitude: 49, accuracy: -1 } });
    expect(h.events).to.deep.equal([{ kind: 'geolocate-error', code: 'permission-denied' },
      { kind: 'geolocate-success', lngLat: [6.13, 49.61], accuracy: 25 },
      { kind: 'geolocate-success' }, { kind: 'geolocate-success' }, { kind: 'geolocate-success' }]);
    expect(Object.isFrozen(h.events[1]) && Object.isFrozen((h.events[1] as { lngLat: unknown }).lngLat)).to.equal(true);
    const callback = [...control.listeners.get('geolocate')!][0]!;
    await h.manager.sync(h.map, options({ attribution: false }), h.context); callback({ coords: { longitude: 1, latitude: 42, accuracy: 3 } });
    expect(h.events.length).to.equal(5); expect(control.retired).to.deep.equal(['error', 'outofmaxbounds', 'geolocate']);
  });
  it('retires listeners before removing a partially installed control when addControl throws', async () => {
    const h = harness(); h.map.addControl = control => { h.installed.push(control); throw new Error('private'); };
    await h.manager.sync(h.map, options({ geolocate: true }), h.context);
    expect(h.removed.length).to.equal(1); expect(h.failures).to.deep.equal(['geolocate']);
    h.manager.dispose(); expect(h.removed.length).to.equal(1);
  });
  it('does not install a control whose constructor reenters disposal', async () => {
    const h = harness(); let manager!: MapControlsLifecycle;
    manager = new MapControlsLifecycle(async () => class extends Control { constructor() { super(); manager.dispose(); } });
    await manager.sync(h.map, options({ navigation: true }), h.context); expect(h.installed.length).to.equal(0);
  });
  it('cleans exact subscriptions when on reenters disposal after registering a callback', async () => {
    const h = harness(); let manager!: MapControlsLifecycle; let constructed!: Control;
    manager = new MapControlsLifecycle(async () => class extends Control {
      constructor() { super(); constructed = this; }
      override on(type: string, callback: (event: unknown) => void): this { super.on(type, callback); manager.dispose(); return this; }
    });
    await manager.sync(h.map, options({ geolocate: true }), h.context);
    expect(h.installed.length).to.equal(0); expect(constructed.retired).to.deep.equal(['error']);
  });
  it('cleans a subscription registered after on reenters disposal, including a partial throw', async () => {
    for (const throws of [false, true]) {
      const h = harness(); let manager!: MapControlsLifecycle; let constructed!: Control;
      manager = new MapControlsLifecycle(async () => class extends Control {
        constructor() { super(); constructed = this; }
        override on(type: string, callback: (event: unknown) => void): this {
          manager.dispose(); super.on(type, callback); if (throws) throw new Error('private'); return this;
        }
      });
      await manager.sync(h.map, options({ geolocate: true }), h.context);
      expect(h.installed.length).to.equal(0); expect(constructed.retired).to.deep.equal(['error']); expect(h.failures.length).to.equal(0);
    }
  });
  it('removes a partial add after reentry without removing its successor', async () => {
    const h = harness(); let replacement: Promise<void> | undefined;
    h.map.addControl = control => { h.installed.push(control); if (h.installed.length === 1) replacement = h.manager.sync(h.map, options({ scale: true }), h.context); };
    await h.manager.sync(h.map, options({ navigation: true }), h.context); await replacement;
    expect(h.installed.length).to.equal(2); expect(h.removed.length).to.equal(1);
    expect(h.removed[0] === h.installed[0]).to.equal(true); h.manager.dispose(); expect(h.removed.length).to.equal(2);
  });
  it('guards connection changes and map replacement before callbacks or installation', async () => {
    const h = harness(); let current = true;
    await h.manager.sync(h.map, options({ geolocate: true }), { ...h.context, isCurrent: () => current });
    current = false; h.created[0]!.fire('error', { code: 3 }); expect(h.events.length).to.equal(0);
    const other = { ...h.map }; await h.manager.sync(other, options({ attribution: true }), h.context);
    expect(h.removed.length).to.equal(1); expect(h.installed.length).to.equal(2); h.manager.dispose();
  });
  it('replaces changed controls and reports missing capabilities without native error text', async () => {
    const h = harness(); await h.manager.sync(h.map, options({ scale: true }), h.context);
    await h.manager.sync(h.map, options({ scale: { unit: 'imperial' } }), h.context);
    expect(h.removed.length).to.equal(1); expect(h.installed.length).to.equal(2); h.manager.dispose();
    const manager = new MapControlsLifecycle(async () => undefined);
    await manager.sync(h.map, options({ attribution: true }), h.context); expect(h.failures).to.deep.equal(['attribution']);
  });
  it('forwards managed default attribution options unchanged and removes it when disabled', async () => {
    const h = harness(); const constructorOptions: unknown[] = [];
    const manager = new MapControlsLifecycle(async () => class extends Control {
      constructor(input?: Record<string, unknown>) { super(); constructorOptions.push(input); }
    });
    await manager.sync(h.map, options({ attribution: true }), h.context);
    expect(constructorOptions).to.deep.equal([{}]);
    await manager.sync(h.map, options({ attribution: false }), h.context); expect(h.removed.length).to.equal(1);
    await manager.sync(h.map, options({ attribution: { customAttribution: 'Author <text>' } }), h.context);
    expect(constructorOptions[1]).to.deep.equal({ customAttribution: 'Author &lt;text&gt;' }); manager.dispose();
  });
});
