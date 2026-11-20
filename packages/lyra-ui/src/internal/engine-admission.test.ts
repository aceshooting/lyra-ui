import { expect, waitUntil } from '@open-wc/testing';
import { ENGINE_FENCE_ATTRIBUTES, observeAdmission, observeAncestorFences } from './engine-admission.js';
import { watchEngineStyle } from './engine-style.js';

interface FakeIntersection {
  deliver(entries: unknown[]): void;
  readonly observed: unknown[];
  readonly disconnected: boolean;
}

/** Replaces the window's IntersectionObserver so a test decides when and what it reports. */
function fakeIntersections(): { instances: FakeIntersection[]; restore(): void } {
  const original = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver')!;
  const instances: FakeIntersection[] = [];
  class Fake {
    private readonly record: { deliver(entries: unknown[]): void; observed: unknown[]; disconnected: boolean };
    constructor(callback: (entries: unknown[]) => void) {
      this.record = { deliver: (entries) => callback(entries), observed: [], disconnected: false };
      instances.push(this.record);
    }
    observe(target: unknown): void { this.record.observed.push(target); }
    unobserve(): void { /* not used */ }
    disconnect(): void { this.record.disconnected = true; }
    takeRecords(): unknown[] { return []; }
  }
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: Fake });
  return { instances, restore: () => Object.defineProperty(window, 'IntersectionObserver', original) };
}

const created: Element[] = [];
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

function mount(markup: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = markup;
  document.body.append(root);
  created.push(root);
  return root;
}

afterEach(() => {
  for (const element of created.splice(0)) element.remove();
});

describe('observeAdmission', () => {
  it('admits once the surface intersects and the host is exposed, then retires every observer', () => {
    const fake = fakeIntersections();
    try {
      const root = mount('<div data-host><span data-surface></span></div>');
      const host = root.querySelector('[data-host]')!;
      const surface = root.querySelector('[data-surface]')!;
      let admitted = 0;
      const dispose = observeAdmission(host, surface, { isReady: () => true, onAdmit: () => admitted++ });
      expect(admitted).to.equal(0);
      expect(fake.instances.length === 1 && fake.instances[0]!.observed[0] === surface).to.equal(true);
      fake.instances[0]!.deliver([{ target: surface, isIntersecting: true }]);
      expect(admitted).to.equal(1);
      expect(fake.instances[0]!.disconnected).to.equal(true);
      fake.instances[0]!.deliver([{ target: surface, isIntersecting: true }]);
      dispose!();
      dispose!();
      expect(admitted).to.equal(1);
    } finally {
      fake.restore();
    }
  });

  it('follows the newest report for the surface and ignores other targets', () => {
    const fake = fakeIntersections();
    try {
      const root = mount('<div data-host><span data-surface></span></div>');
      const host = root.querySelector('[data-host]')!;
      const surface = root.querySelector('[data-surface]')!;
      let admitted = 0;
      observeAdmission(host, surface, { isReady: () => true, onAdmit: () => admitted++ });
      const deliver = fake.instances[0]!.deliver;
      deliver([{ target: surface, isIntersecting: true }, { target: surface, isIntersecting: false }]);
      deliver([{ target: host, isIntersecting: true }, { target: surface, isIntersecting: 'yes' }, null]);
      expect(admitted).to.equal(0);
      deliver([{ target: surface, isIntersecting: false }, { target: surface, isIntersecting: true }]);
      expect(admitted).to.equal(1);
    } finally {
      fake.restore();
    }
  });

  it('keeps waiting while the caller is not ready and admits on a later report', () => {
    const fake = fakeIntersections();
    try {
      const root = mount('<div data-host><span data-surface></span></div>');
      const host = root.querySelector('[data-host]')!;
      const surface = root.querySelector('[data-surface]')!;
      let ready = false;
      let admitted = 0;
      observeAdmission(host, surface, { isReady: () => ready, onAdmit: () => admitted++ });
      fake.instances[0]!.deliver([{ target: surface, isIntersecting: true }]);
      expect(admitted).to.equal(0);
      ready = true;
      fake.instances[0]!.deliver([{ target: surface, isIntersecting: true }]);
      expect(admitted).to.equal(1);
    } finally {
      fake.restore();
    }
  });

  it('admits when a composed ancestor fence lifts, through slots and shadow roots', async () => {
    const fake = fakeIntersections();
    try {
      const root = mount('<div hidden data-outer><div data-wrapper><div data-host><span data-surface></span></div></div></div>');
      const wrapper = root.querySelector('[data-wrapper]')!;
      wrapper.attachShadow({ mode: 'open' }).innerHTML = '<div inert data-inner><slot></slot></div>';
      const inner = wrapper.shadowRoot!.querySelector('[data-inner]')!;
      const host = root.querySelector('[data-host]')!;
      const surface = root.querySelector('[data-surface]')!;
      let admitted = 0;
      observeAdmission(host, surface, { isReady: () => true, onAdmit: () => admitted++ });
      fake.instances[0]!.deliver([{ target: surface, isIntersecting: true }]);
      root.querySelector('[data-outer]')!.removeAttribute('hidden');
      await settle();
      expect(admitted).to.equal(0);
      inner.removeAttribute('inert');
      await waitUntil(() => admitted === 1);
      expect(fake.instances.length).to.equal(1);
    } finally {
      fake.restore();
    }
  });

  it('never admits after it is disposed, whatever arrives later', async () => {
    const fake = fakeIntersections();
    try {
      const root = mount('<div hidden data-host><span data-surface></span></div>');
      const host = root.querySelector('[data-host]')!;
      const surface = root.querySelector('[data-surface]')!;
      let admitted = 0;
      const dispose = observeAdmission(host, surface, { isReady: () => true, onAdmit: () => admitted++ });
      const deliver = fake.instances[0]!.deliver;
      dispose!();
      host.removeAttribute('hidden');
      deliver([{ target: surface, isIntersecting: true }]);
      await settle();
      expect(admitted).to.equal(0);
    } finally {
      fake.restore();
    }
  });

  it('admits during setup when the owner window cannot report intersections', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver')!;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    try {
      const root = mount('<div data-host><span data-surface></span></div>');
      const host = root.querySelector('[data-host]')!;
      let admitted = 0;
      observeAdmission(host, root.querySelector('[data-surface]')!, { isReady: () => true, onAdmit: () => admitted++ });
      expect(admitted).to.equal(1);
    } finally {
      Object.defineProperty(window, 'IntersectionObserver', original);
    }
  });

  it('consults a caller exposure check and never admits a disconnected host', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver')!;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    try {
      const root = mount('<div hidden data-host><span data-surface></span></div>');
      const host = root.querySelector('[data-host]')!;
      const surface = root.querySelector('[data-surface]')!;
      let admitted = 0;
      observeAdmission(host, surface, { isReady: () => true, isExposed: () => true, onAdmit: () => admitted++ });
      expect(admitted).to.equal(1);
      const detached = document.createElement('div');
      observeAdmission(detached, detached, { isReady: () => true, isExposed: () => true, onAdmit: () => admitted++ });
      expect(admitted).to.equal(1);
    } finally {
      Object.defineProperty(window, 'IntersectionObserver', original);
    }
  });
});

describe('observeAncestorFences', () => {
  it('reports fence attributes only, on the start element and its first 256 composed ancestors', async () => {
    const root = mount('');
    let leaf: Element = root;
    const chain: Element[] = [];
    for (let depth = 0; depth < 300; depth++) {
      const next = document.createElement('div');
      leaf.append(next);
      chain.unshift(next);
      leaf = next;
    }
    let changes = 0;
    const dispose = observeAncestorFences(leaf, () => changes++);
    chain[0]!.setAttribute('data-unrelated', '');
    await settle();
    expect(changes).to.equal(0);
    chain[256]!.classList.add('fenced');
    await waitUntil(() => changes === 1);
    chain[257]!.setAttribute('hidden', '');
    chain[290]!.setAttribute('aria-hidden', 'true');
    await settle();
    expect(changes).to.equal(1);
    for (const attribute of ENGINE_FENCE_ATTRIBUTES) {
      chain[0]!.toggleAttribute(attribute);
      await waitUntil(() => changes > 1);
      changes = 1;
    }
    dispose();
    chain[0]!.setAttribute('hidden', '');
    await settle();
    expect(changes).to.equal(1);
    expect([...ENGINE_FENCE_ATTRIBUTES]).to.deep.equal(['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open']);
  });

  it('shares one observer per root across engines instead of one per instance', async () => {
    const root = mount('');
    let leaf: Element = root;
    for (let depth = 0; depth < 40; depth++) {
      const next = document.createElement('div');
      leaf.append(next);
      leaf = next;
    }
    const original = Object.getOwnPropertyDescriptor(window, 'MutationObserver')!;
    const Native = window.MutationObserver;
    let constructed = 0;
    Object.defineProperty(window, 'MutationObserver', { configurable: true, writable: true, value: class extends Native {
      constructor(callback: MutationCallback) { super(callback); constructed++; }
    } });
    let changes = 0;
    const disposers: (() => void)[] = [];
    try {
      for (let index = 0; index < 5; index++) disposers.push(observeAncestorFences(leaf, () => changes++));
    } finally {
      Object.defineProperty(window, 'MutationObserver', original);
    }
    expect(constructed <= 1).to.equal(true);
    root.setAttribute('inert', '');
    await waitUntil(() => changes === 5);
    for (const dispose of disposers) dispose();
    root.removeAttribute('inert');
    await settle();
    expect(changes).to.equal(5);
  });
});

describe('watchEngineStyle', () => {
  it('reports theme attributes on composed ancestors, ignores unrelated attributes and stops after disposal', async () => {
    const outer = document.createElement('div');
    const inner = document.createElement('span');
    outer.append(inner);
    document.body.append(outer);
    let calls = 0;
    const dispose = watchEngineStyle(inner, () => { calls++; });
    try {
      outer.setAttribute('data-unrelated', '1');
      outer.title = 'Unrelated';
      await new Promise((resolve) => setTimeout(resolve));
      expect(calls).to.equal(0);
      outer.setAttribute('data-lr-theme', 'dark');
      outer.style.setProperty('--lr-color-brand', 'rgb(1, 2, 3)');
      await new Promise((resolve) => setTimeout(resolve));
      expect(calls).to.equal(1);
      // A stylesheet toggled without any attribute on an ancestor still restyles the engine.
      const sheet = document.createElement('style');
      sheet.textContent = ':root { --lr-color-brand: rgb(4, 5, 6); }';
      document.head.append(sheet);
      await waitUntil(() => calls === 2);
      sheet.sheet!.disabled = true;
      await waitUntil(() => calls === 3);
      sheet.remove();
      await waitUntil(() => calls === 4);
      dispose!();
      dispose!();
      outer.setAttribute('data-lr-theme', 'light');
      await new Promise((resolve) => setTimeout(resolve));
      expect(calls).to.equal(4);
    } finally {
      dispose!();
      outer.remove();
    }
  });
});
