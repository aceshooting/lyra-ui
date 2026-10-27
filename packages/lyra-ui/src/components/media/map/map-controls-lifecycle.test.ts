import { sendKeys } from '@web/test-runner-commands';
import { expect } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
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

/** Peer-shaped compact disclosure: native installation leaves it compact, open and shown. */
class CompactAttribution extends Control {
  readonly root = document.createElement('details');
  constructor(readonly options?: Record<string, unknown>) { super(); }
  onAdd(): HTMLElement {
    this.root.className = 'maplibregl-ctrl maplibregl-ctrl-attrib';
    if (this.options?.['compact'] !== false) this.root.classList.add('maplibregl-compact', 'maplibregl-compact-show');
    this.root.open = true;
    return this.root;
  }
}
function attributionHarness() {
  const created: CompactAttribution[] = []; const corner = document.createElement('div');
  const manager = new MapControlsLifecycle(async () => class extends CompactAttribution {
    constructor(input?: Record<string, unknown>) { super(input); created.push(this); }
  });
  const map = {
    controlContainer: () => corner,
    addControl(control: MapManagedControl) { corner.append(control.onAdd!()); },
    removeControl(control: MapManagedControl) { (control as CompactAttribution).root.remove(); },
  };
  const context = { isCurrent: () => true, onEvent: () => undefined, onFailure: () => undefined };
  return { manager, map, context, created, corner };
}
const shown = (root: HTMLDetailsElement) => [root.open, root.classList.contains('maplibregl-compact-show')];

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
  it('installs in corner priority despite reversed completion and a failed import', async () => {
    for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      const h = harness(); const installed: string[] = [];
      const kinds = ['navigation', 'scale', 'geolocate', 'attribution'] as const;
      const resolve = new Map<string, (value: typeof Control | undefined) => void>();
      const manager = new MapControlsLifecycle(kind => new Promise(done => { resolve.set(kind, done); }));
      const input = Object.fromEntries(kinds.map(kind => [kind, { position }]));
      const sync = manager.sync({ ...h.map, addControl: control => { installed.push((control as Control & { kind: string }).kind); } }, options(input), h.context);
      for (const kind of [...kinds].reverse()) resolve.get(kind)!(kind === 'scale' ? undefined : class extends Control { readonly kind = kind; });
      await sync;
      expect(installed).to.deep.equal(position.startsWith('bottom') ? ['attribution', 'geolocate', 'navigation'] : ['navigation', 'geolocate', 'attribution']);
      expect(h.failures).to.deep.equal(['scale']); manager.dispose();
    }
  });
  it('sorts explicit orders and stable ties at every corner, including live focused moves', async () => {
    for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      const h = harness(); const parent = document.createElement('div'); document.body.append(parent);
      const kinds = ['navigation', 'scale', 'geolocate', 'attribution'] as const;
      const pending = new Map<string, (value: new () => Control) => void>();
      let created = 0, removed = 0;
      const manager = new MapControlsLifecycle(kind => new Promise(resolve => { pending.set(kind, resolve); }));
      const map = {
        controlContainer: () => parent,
        addControl(control: MapManagedControl) {
          const root = control.onAdd!();
          if (position.startsWith('bottom')) parent.prepend(root); else parent.append(root);
        },
        removeControl(control: MapManagedControl) { removed++; (control as Control & { root: HTMLElement }).root.remove(); },
      };
      const desired = (orders: readonly number[]) => options(Object.fromEntries(kinds.map((kind, index) => [kind, { position, order: orders[index] }])));
      const labels = () => [...parent.children].map(node => (node as HTMLElement).dataset['kind']);
      try {
        const sync = manager.sync(map, desired([1, -1, 1, 0]), h.context);
        for (const kind of [...kinds].reverse()) pending.get(kind)!(class extends Control {
          readonly root = document.createElement('div');
          constructor() { super(); created++; this.root.dataset['kind'] = kind; const button = document.createElement('button'); button.textContent = kind; this.root.append(button); }
          onAdd() { return this.root; }
        });
        await sync;
        expect(labels()).to.deep.equal(['scale', 'attribution', 'navigation', 'geolocate']);
        await focusByKeyboard(parent.querySelector<HTMLElement>('button')!);
        for (const kind of ['attribution', 'navigation', 'geolocate']) {
          await sendKeys({ press: 'Tab' });
          expect((document.activeElement?.parentElement as HTMLElement | null)?.dataset['kind']).to.equal(kind);
        }
        const button = parent.querySelector<HTMLElement>('[data-kind="geolocate"] button')!;
        await focusByKeyboard(button);
        await manager.sync(map, desired([0, 0, -2, 0]), h.context);
        expect(labels()).to.deep.equal(['geolocate', 'navigation', 'scale', 'attribution']);
        expect(document.activeElement === button).to.equal(true);
        for (const kind of ['navigation', 'scale', 'attribution']) {
          await sendKeys({ press: 'Tab' });
          expect((document.activeElement?.parentElement as HTMLElement | null)?.dataset['kind']).to.equal(kind);
        }
        expect(created).to.equal(4); expect(removed).to.equal(0);
        expect(h.failures).to.deep.equal([]);
      } finally { manager.dispose(); parent.remove(); }
    }
  });
  it('moves existing roots without rebuilding subscriptions and leaves focus on the same button', async () => {
    const wrapper = document.createElement('div'); document.body.append(wrapper);
    const corners = new Map(['top-right', 'bottom-left'].map(position => [position, document.createElement('div')]));
    for (const corner of corners.values()) wrapper.append(corner);
    const created: Control[] = []; const h = harness(); let removals = 0;
    const manager = new MapControlsLifecycle(async () => class extends Control {
      readonly root = document.createElement('div');
      constructor() { super(); this.root.append(document.createElement('button')); created.push(this); }
      onAdd() { return this.root; }
    });
    const map = {
      controlContainer: (position: string) => corners.get(position),
      addControl(control: MapManagedControl, position: string) {
        const root = control.onAdd!(); const corner = corners.get(position)!;
        if (position.startsWith('bottom')) corner.prepend(root); else corner.append(root);
      },
      removeControl(control: MapManagedControl) { removals++; (control as Control & { root: HTMLElement }).root.remove(); },
    };
    try {
      await manager.sync(map, options({ geolocate: { position: 'top-right' } }), h.context);
      const button = corners.get('top-right')!.querySelector('button')!;
      await focusByKeyboard(button);
      await manager.sync(map, options({ navigation: { position: 'bottom-left' }, scale: { position: 'bottom-left' }, geolocate: { position: 'bottom-left', order: 1 }, attribution: { position: 'bottom-left' } }), h.context);
      expect(document.activeElement === button).to.equal(true); expect(created.length).to.equal(4); expect(removals).to.equal(0);
      expect(created[0]!.retired).to.deep.equal([]);
      expect(corners.get('bottom-left')!.children.length).to.equal(4);
      expect(corners.get('bottom-left')!.children[3]!.contains(button)).to.equal(true);
      await manager.sync(map, options({ geolocate: { position: 'bottom-left' } }), h.context);
      expect(document.activeElement === button).to.equal(true); expect(removals).to.equal(3);
      manager.dispose(); expect(removals).to.equal(4);
      expect(created[0]!.retired).to.deep.equal(['error', 'outofmaxbounds', 'geolocate']);
      await manager.sync(map, options({ geolocate: { position: 'top-right' } }), h.context);
      expect(corners.get('top-right')!.children.length).to.equal(1);
    } finally { manager.dispose(); wrapper.remove(); }
  });

  it('does not move an owned root after a corner callback retires the generation', async () => {
    const h = harness(); const first = document.createElement('div'), next = document.createElement('div');
    let cancel = false;
    const manager = new MapControlsLifecycle(async () => class extends Control {
      readonly root = document.createElement('div');
      onAdd() { return this.root; }
    });
    const map = {
      controlContainer: (position: string) => {
        if (cancel) manager.dispose();
        return position === 'top-right' ? first : next;
      },
      addControl: (control: MapManagedControl) => { first.append(control.onAdd!()); },
      removeControl: (control: MapManagedControl) => { (control as Control & { root: HTMLElement }).root.remove(); },
    };
    await manager.sync(map, options({ navigation: true }), h.context);
    expect(first.children.length).to.equal(1); cancel = true;
    await manager.sync(map, options({ navigation: { position: 'bottom-left' } }), h.context);
    expect(first.children.length).to.equal(0); expect(next.children.length).to.equal(0);
    expect(h.failures).to.deep.equal([]); manager.dispose();
  });

  it('preserves external focus intent during a move and after delayed imports', async () => {
    for (const mode of ['focusout', 'delayed', 'removed'] as const) {
      const wrapper = document.createElement('div');
      const first = document.createElement('div'), next = document.createElement('div'), outside = document.createElement('button');
      outside.textContent = 'Outside'; wrapper.append(first, next, outside); document.body.append(wrapper);
      const h = harness(); let release!: (value: typeof NativeControl) => void;
      class NativeControl extends Control {
        readonly root = document.createElement('div');
        readonly button = document.createElement('button');
        constructor() { super(); this.button.textContent = 'Control'; this.root.append(this.button); }
        onAdd() { return this.root; }
      }
      const manager = new MapControlsLifecycle(kind => kind === 'scale' ? new Promise(done => { release = done; }) : Promise.resolve(NativeControl));
      const map = {
        controlContainer: (position: string) => position === 'top-right' ? first : next,
        addControl: (control: MapManagedControl, position: string) => { (position === 'top-right' ? first : next).append(control.onAdd!()); },
        removeControl: (control: MapManagedControl) => { (control as NativeControl).root.remove(); },
      };
      const insertBefore = next.insertBefore;
      try {
        await manager.sync(map, options({ navigation: true }), h.context);
        const button = first.querySelector('button')!; await focusByKeyboard(button);
        let transfers = 0;
        if (mode !== 'delayed') button.addEventListener('focusout', () => {
          transfers++;
          // Model a synchronous application focus reaction after keyboard modality was established.
          outside.focus();
        });
        if (mode !== 'delayed') {
          next.insertBefore = function <T extends Node>(node: T, before: Node | null): T {
            // A real blur invokes the application's focusout handler before the native DOM move.
            button.blur();
            if (mode === 'removed') button.remove();
            return insertBefore.call(this, node, before) as T;
          };
        }
        const moving = manager.sync(map, options({ navigation: { position: 'bottom-left' }, ...(mode === 'delayed' ? { scale: true } : {}) }), h.context);
        if (mode === 'delayed') { await focusByKeyboard(outside); release(NativeControl); }
        await moving;
        if (mode !== 'delayed') expect(transfers).to.be.greaterThan(0);
        expect(document.activeElement === outside).to.equal(true);
        expect(button.isConnected).to.equal(mode !== 'removed');
        expect(h.failures).to.deep.equal([]);
      } finally { next.insertBefore = insertBefore; manager.dispose(); wrapper.remove(); }
    }
  });

  it('restores exact onAdd ownership and descriptors across success, failures and cancellation', async () => {
    for (const own of [false, true]) for (const outcome of ['success', 'hook-throw', 'native-throw', 'cancel'] as const) {
      const h = harness(); const parent = document.createElement('div'); const token = {};
      let manager!: MapControlsLifecycle, control!: HookControl;
      let removals = 0, calls = 0, receiver = false, args = false;
      let listenersRetiredAtRemoval = false, methodRestoredAtRemoval = false;
      let descriptorAtRemoval: PropertyDescriptor | undefined;
      let originalDescriptor: PropertyDescriptor | undefined;
      class HookControl extends Control {
        readonly root = document.createElement('div');
        constructor() {
          super(); control = this;
          if (own) Object.defineProperty(this, 'onAdd', { value: this.onAdd, writable: true, configurable: true, enumerable: false });
          originalDescriptor = Object.getOwnPropertyDescriptor(this, 'onAdd');
        }
        onAdd(...input: unknown[]): HTMLElement {
          calls++; receiver = this === control; args = input.length === 2 && input[0] === map && input[1] === token;
          if (outcome === 'hook-throw') { parent.append(this.root); throw new Error('Hook failed'); }
          if (outcome === 'cancel') manager.dispose();
          return this.root;
        }
      }
      const map = {
        addControl(instance: MapManagedControl) {
          parent.append(instance.onAdd!(map, token));
          if (outcome === 'native-throw') throw new Error('Add failed');
        },
        removeControl(instance: MapManagedControl) {
          removals++;
          listenersRetiredAtRemoval = [...control.listeners.values()].every(set => set.size === 0);
          methodRestoredAtRemoval = instance.onAdd === HookControl.prototype.onAdd;
          descriptorAtRemoval = Object.getOwnPropertyDescriptor(instance, 'onAdd');
          control.root.remove();
        },
      };
      manager = new MapControlsLifecycle(async () => HookControl);
      await manager.sync(map, options({ geolocate: true }), h.context);
      expect(calls).to.equal(1); expect(receiver).to.equal(true); expect(args).to.equal(true);
      expect(Object.hasOwn(control, 'onAdd')).to.equal(own);
      expect(Object.getOwnPropertyDescriptor(control, 'onAdd')).to.deep.equal(originalDescriptor);
      expect(control.onAdd === HookControl.prototype.onAdd).to.equal(true);
      expect(removals).to.equal(outcome === 'success' ? 0 : 1);
      manager.dispose(); manager.dispose();
      expect(removals).to.equal(1); expect(parent.children.length).to.equal(0);
      expect(listenersRetiredAtRemoval).to.equal(true); expect(methodRestoredAtRemoval).to.equal(true);
      expect(descriptorAtRemoval).to.deep.equal(originalDescriptor);
      expect(control.retired).to.deep.equal(['error', 'outofmaxbounds', 'geolocate']);
      expect(h.failures).to.deep.equal(outcome === 'hook-throw' || outcome === 'native-throw' ? ['geolocate'] : []);
    }
  });

  it('keeps simultaneous mixed-corner subsets ordered without replacing retained controls', async () => {
    const h = harness(); const first = document.createElement('div'), second = document.createElement('div');
    const added: string[] = []; const removed: string[] = [];
    class NamedControl extends Control {
      readonly root = document.createElement('div');
      constructor(readonly kind: string) { super(); this.root.dataset['kind'] = kind; }
      onAdd() { return this.root; }
    }
    const resolve = new Map<string, (value: new () => NamedControl) => void>();
    const manager = new MapControlsLifecycle(kind => new Promise(done => { resolve.set(kind, done); }));
    const map = {
      controlContainer: (position: string) => position === 'top-left' ? first : second,
      addControl(instance: MapManagedControl, position: string) {
        const control = instance as NamedControl; added.push(control.kind);
        if (position === 'top-left') first.append(control.onAdd()); else second.prepend(control.onAdd());
      },
      removeControl(instance: MapManagedControl) { const control = instance as NamedControl; removed.push(control.kind); control.root.remove(); },
    };
    const sync = manager.sync(map, options({ navigation: { position: 'top-left' }, geolocate: { position: 'top-left' },
      scale: { position: 'bottom-right' }, attribution: { position: 'bottom-right' } }), h.context);
    for (const kind of ['attribution', 'geolocate', 'scale', 'navigation']) resolve.get(kind)!(class extends NamedControl { constructor() { super(kind); } });
    await sync;
    const kinds = (parent: HTMLElement) => [...parent.children].map(node => (node as HTMLElement).dataset['kind']);
    expect(added).to.deep.equal(['navigation', 'geolocate', 'attribution', 'scale']);
    expect(kinds(first)).to.deep.equal(['navigation', 'geolocate']); expect(kinds(second)).to.deep.equal(['scale', 'attribution']);
    await manager.sync(map, options({ geolocate: { position: 'top-left' }, attribution: { position: 'bottom-right' } }), h.context);
    expect(added.length).to.equal(4); expect(removed).to.deep.equal(['navigation', 'scale']);
    expect(kinds(first)).to.deep.equal(['geolocate']); expect(kinds(second)).to.deep.equal(['attribution']);
    manager.dispose(); expect(removed.length).to.equal(4);
  });

});

describe('map controls lifecycle boundaries', () => {
  class RootedControl extends Control {
    readonly root = document.createElement('div');
    constructor() { super(); this.root.append(document.createElement('button')); }
    onAdd() { return this.root; }
  }

  it('reports a failure for every control whose module cannot be imported', async () => {
    const h = harness(); const manager = new MapControlsLifecycle(async () => { throw new Error('import failed'); });
    await manager.sync(h.map, options({ navigation: true, scale: true }), h.context);
    expect(h.failures).to.deep.equal(['navigation', 'scale']); expect(h.installed.length).to.equal(0);
    manager.dispose();
  });

  it('rejects a geolocate control that cannot subscribe to events', async () => {
    const h = harness();
    const manager = new MapControlsLifecycle(async () => class { onAdd() { return document.createElement('div'); } });
    await manager.sync(h.map, options({ geolocate: true }), h.context);
    expect(h.failures).to.deep.equal(['geolocate']); expect(h.installed.length).to.equal(0);
    manager.dispose();
  });

  it('reports a geolocate success without a position when the event carries no coordinates', async () => {
    const h = harness(); await h.manager.sync(h.map, options({ geolocate: true }), h.context);
    const control = h.created[0]!;
    control.fire('geolocate', {}); control.fire('geolocate', { coords: null }); control.fire('geolocate', null);
    expect(h.events).to.deep.equal([{ kind: 'geolocate-success' }, { kind: 'geolocate-success' }, { kind: 'geolocate-success' }]);
    h.manager.dispose();
  });

  it('cleans every registered subscription when disposal re-enters on a later one', async () => {
    for (const reenterAt of [2, 3]) {
      const h = harness(); let manager!: MapControlsLifecycle; let constructed!: Control; let registrations = 0;
      manager = new MapControlsLifecycle(async () => class extends Control {
        constructor() { super(); constructed = this; }
        override on(type: string, callback: (event: unknown) => void): this {
          super.on(type, callback);
          if (++registrations === reenterAt) manager.dispose();
          return this;
        }
      });
      await manager.sync(h.map, options({ geolocate: true }), h.context);
      expect(h.installed.length, `registration ${reenterAt}`).to.equal(0);
      expect(constructed.retired, `registration ${reenterAt}`).to.deep.equal(['error', 'outofmaxbounds', 'geolocate'].slice(0, reenterAt));
      expect(h.failures.length, `registration ${reenterAt}`).to.equal(0);
    }
  });

  it('seeds a compact owned attribution once with open and compact-show aligned, never hiding a full credit surface', async () => {
    for (const [input, expected] of [
      [{ compact: true, initialExpanded: false }, [false, false]], [{ compact: true, initialExpanded: true }, [true, true]],
      [{ compact: true }, [true, true]], [{ compact: false, initialExpanded: false }, [true, false]],
    ] as const) {
      const h = attributionHarness();
      await h.manager.sync(h.map, options({ attribution: input }), h.context);
      expect(h.created.length).to.equal(1);
      expect(h.manager.ownedRoot('attribution') === h.created[0]!.root).to.equal(true);
      expect(shown(h.created[0]!.root), JSON.stringify(input)).to.deep.equal(expected);
      expect(h.created[0]!.options).to.deep.equal({ compact: input.compact });
      h.manager.dispose();
      expect(h.manager.ownedRoot('attribution') === undefined).to.equal(true);
    }
  });
  it('retains the user-selected disclosure on position-only changes and reseeds only a meaningful replacement', async () => {
    const h = attributionHarness();
    await h.manager.sync(h.map, options({ attribution: { compact: true, initialExpanded: false } }), h.context);
    const root = h.created[0]!.root;
    root.classList.add('maplibregl-compact-show'); root.open = true;
    await h.manager.sync(h.map, options({ attribution: { compact: true, initialExpanded: false, position: 'top-left', order: 2 } }), h.context);
    await h.manager.sync(h.map, options({ attribution: { compact: true, initialExpanded: false, position: 'top-left', order: 2 } }), h.context);
    expect(h.created.length).to.equal(1); expect(h.manager.ownedRoot('attribution') === root).to.equal(true);
    expect(shown(root)).to.deep.equal([true, true]);
    await h.manager.sync(h.map, options({ attribution: { compact: true, initialExpanded: true, position: 'top-left', order: 2 } }), h.context);
    expect(h.created.length).to.equal(2); expect(root.isConnected).to.equal(false);
    await h.manager.sync(h.map, options({ attribution: { compact: true, position: 'top-left', order: 2 } }), h.context);
    expect(h.created.length).to.equal(3);
    await h.manager.sync(h.map, options({ attribution: { compact: true, initialExpanded: false, position: 'top-left', order: 2 } }), h.context);
    expect(h.created.length).to.equal(4);
    expect(shown(h.created[3]!.root)).to.deep.equal([false, false]);
    expect(h.manager.ownedRoot('attribution') === h.created[3]!.root).to.equal(true);
    h.manager.dispose();
  });
  it('reports only explicitly pending kinds while imports are held, excluding retained installed controls', async () => {
    const h = harness(); const resolves: ((constructor: typeof Control) => void)[] = [];
    const manager = new MapControlsLifecycle(() => new Promise(resolve => { resolves.push(resolve); }));
    const first = manager.sync(h.map, options({ navigation: true }), h.context);
    expect([...manager.pendingKinds()]).to.deep.equal(['navigation']);
    resolves[0]!(Control); await first;
    expect([...manager.pendingKinds()]).to.deep.equal([]);
    const second = manager.sync(h.map, options({ navigation: true, scale: true }), h.context);
    expect([...manager.pendingKinds()]).to.deep.equal(['scale']);
    manager.dispose();
    expect([...manager.pendingKinds()]).to.deep.equal([]);
    resolves[1]!(Control); await second;
    expect(h.installed.length).to.equal(1);
  });
  it('leaves nothing installed or subscribed after disposal, wherever the context turns stale during a rearrangement', async () => {
    const rearrange = async (staleAt: number) => {
      const corners = new Map(['top-right', 'bottom-left'].map(position => [position, document.createElement('div')]));
      const created: RootedControl[] = [];
      let additions = 0, removals = 0, checks = 0, stale = Number.POSITIVE_INFINITY;
      const manager = new MapControlsLifecycle(async () => class extends RootedControl { constructor() { super(); created.push(this); } });
      const map = {
        controlContainer: (position: string) => corners.get(position),
        addControl(control: MapManagedControl, position: string) {
          additions++;
          const root = control.onAdd!(); const corner = corners.get(position)!;
          if (position.startsWith('bottom')) corner.prepend(root); else corner.append(root);
        },
        removeControl(control: MapManagedControl) { removals++; (control as RootedControl).root.remove(); },
      };
      const context = { isCurrent: () => ++checks < stale, onEvent: () => undefined, onFailure: () => undefined };
      await manager.sync(map, options({ geolocate: { position: 'top-right' }, scale: { position: 'bottom-left' } }), context);
      checks = 0; stale = staleAt;
      await manager.sync(map, options({ navigation: { position: 'bottom-left' }, scale: { position: 'bottom-left' },
        geolocate: { position: 'bottom-left' }, attribution: { position: 'bottom-left' } }), context);
      const consulted = checks;
      manager.dispose();
      expect(removals, `stale at ${staleAt}`).to.equal(additions);
      expect([...corners.values()].every(corner => corner.childElementCount === 0), `stale at ${staleAt}`).to.equal(true);
      expect(created.every(control => [...control.listeners.values()].every(set => set.size === 0)), `stale at ${staleAt}`).to.equal(true);
      return consulted;
    };
    // An uninterrupted run reveals how often the owner is consulted; turn it stale at each of those points.
    const consultations = await rearrange(Number.POSITIVE_INFINITY);
    expect(consultations).to.be.greaterThan(20);
    for (let staleAt = 1; staleAt <= consultations; staleAt++) await rearrange(staleAt);
  });
});
