import { expect, waitUntil } from '@open-wc/testing';
import { LitElement } from 'lit';
import {
  AllocationObserverController,
  HostChildrenObserver,
  OwnedIntersectionObserver,
  OwnedMutationObserver,
  OwnedResizeObserver,
  VisibilityGate,
  readInlineSize,
  readIntersecting,
  watchDevicePixelRatio,
} from './owned-observer.js';

type Fakeable = Record<string, unknown>;

/** Records constructions and exposes each callback so a test can deliver (or replay) entries. */
function installFake(view: Window, name: 'ResizeObserver' | 'IntersectionObserver' | 'MutationObserver') {
  const target = view as unknown as Fakeable;
  const original = target[name];
  const instances: Array<{ cb: (entries: unknown[]) => void; observed: unknown[]; disconnected: boolean }> = [];
  target[name] = class {
    private readonly record: { cb: (entries: unknown[]) => void; observed: unknown[]; disconnected: boolean };
    constructor(cb: (entries: unknown[]) => void) {
      this.record = { cb, observed: [], disconnected: false };
      instances.push(this.record);
    }
    observe(node: unknown): void { this.record.observed.push(node); }
    unobserve(): void { /* fake */ }
    disconnect(): void { this.record.disconnected = true; }
    takeRecords(): unknown[] { return []; }
  };
  return { instances, restore: () => { target[name] = original; } };
}

async function makeFrame(): Promise<{ frame: HTMLIFrameElement; view: Window; doc: Document }> {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  await waitUntil(() => frame.contentDocument?.readyState === 'complete');
  return { frame, view: frame.contentWindow!, doc: frame.contentDocument! };
}

class HostElement extends LitElement {}
if (!customElements.get('lr-owned-observer-host')) customElements.define('lr-owned-observer-host', HostElement);

describe('owned observers', () => {
  it('constructs each observer from the owner realm, not the module realm', async () => {
    const { frame, view, doc } = await makeFrame();
    const fakes = (['ResizeObserver', 'IntersectionObserver', 'MutationObserver'] as const).map((n) => installFake(view, n));
    const host = doc.createElement('div');
    doc.body.append(host);
    try {
      new OwnedResizeObserver(host, () => undefined).observe(host);
      new OwnedIntersectionObserver(host, () => undefined).observe(host);
      new OwnedMutationObserver(host, () => undefined).observe(host, { childList: true });
      expect(fakes.map((f) => f.instances.length)).to.deep.equal([1, 1, 1]);
      expect(fakes.map((f) => f.instances[0]!.observed[0] === host)).to.deep.equal([true, true, true]);
    } finally {
      fakes.forEach((f) => f.restore());
      frame.remove();
    }
  });

  it('ignores a stale callback after disconnect or reconnect and delivers the new one', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const fake = installFake(window, 'ResizeObserver');
    try {
      let calls = 0;
      const observer = new OwnedResizeObserver(host, () => { calls += 1; });
      observer.observe(host);
      const first = fake.instances[0]!;
      first.cb([{}]);
      expect(calls).to.equal(1);
      observer.disconnect();
      expect(first.disconnected).to.be.true;
      first.cb([{}]);
      expect(calls).to.equal(1);
      observer.resume();
      const second = fake.instances[1]!;
      expect(second.observed[0]).to.equal(host);
      first.cb([{}]);
      expect(calls).to.equal(1);
      second.cb([{}]);
      expect(calls).to.equal(2);
      host.remove();
      second.cb([{}]);
      expect(calls).to.equal(2);
    } finally {
      fake.restore();
      host.remove();
    }
  });

  it('rebuilds in the new realm when the host is adopted into another document', async () => {
    const { frame, view, doc } = await makeFrame();
    const inner = installFake(view, 'ResizeObserver');
    const outer = installFake(window, 'ResizeObserver');
    const host = document.createElement('div');
    document.body.append(host);
    try {
      let calls = 0;
      const observer = new OwnedResizeObserver(host, () => { calls += 1; });
      observer.observe(host);
      expect(outer.instances).to.have.length(1);
      doc.body.append(host); // adoption keeps the same task: no disconnect callback ran for the module
      observer.resume();
      expect(outer.instances[0]!.disconnected).to.be.true;
      expect(inner.instances).to.have.length(1);
      outer.instances[0]!.cb([{}]);
      expect(calls).to.equal(0);
      inner.instances[0]!.cb([{}]);
      expect(calls).to.equal(1);
    } finally {
      inner.restore();
      outer.restore();
      host.remove();
      frame.remove();
    }
  });

  it('degrades silently without a constructor or when construction throws', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const target = window as unknown as Fakeable;
    const original = target['ResizeObserver'];
    try {
      target['ResizeObserver'] = undefined;
      const observer = new OwnedResizeObserver(host, () => undefined);
      expect(() => observer.observe(host)).to.not.throw();
      expect(observer.active).to.be.false;
      target['ResizeObserver'] = class { constructor() { throw new Error('nope'); } };
      expect(() => observer.resume()).to.not.throw();
      expect(observer.active).to.be.false;
    } finally {
      target['ResizeObserver'] = original;
      host.remove();
    }
  });

  it('does not attach while the host is disconnected and attaches on resume', () => {
    const host = document.createElement('div');
    const fake = installFake(window, 'IntersectionObserver');
    try {
      const observer = new OwnedIntersectionObserver(host, () => undefined);
      observer.observe(host);
      expect(fake.instances).to.have.length(0);
      document.body.append(host);
      observer.resume();
      expect(fake.instances).to.have.length(1);
    } finally {
      fake.restore();
      host.remove();
    }
  });

  it('reads entries defensively', () => {
    const el = document.createElement('div');
    const other = document.createElement('div');
    expect(readIntersecting([{ target: other, isIntersecting: true }, { target: el, isIntersecting: false }], el)).to.equal(false);
    expect(readIntersecting(null, el)).to.be.undefined;
    const hostile = { get target(): never { throw new Error('x'); } };
    expect(readIntersecting([hostile, { target: el, isIntersecting: true }], el)).to.equal(true);
    expect(readInlineSize({ contentBoxSize: [{ inlineSize: 12 }], contentRect: { width: 3 } })).to.equal(12);
    expect(readInlineSize({ contentRect: { width: 3 } })).to.equal(3);
    expect(readInlineSize({ contentRect: { width: Number.NaN } })).to.be.undefined;
    expect(readInlineSize({ contentRect: { width: -1 } })).to.be.undefined;
    expect(readInlineSize(null)).to.be.undefined;
  });
  it('delivers an empty list for a revoked entries container instead of throwing', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const fakes = (['ResizeObserver', 'IntersectionObserver', 'MutationObserver'] as const).map((n) => installFake(window, n));
    const received: unknown[][] = [];
    try {
      new OwnedResizeObserver(host, (e) => received.push(e)).observe(host);
      new OwnedIntersectionObserver(host, (e) => received.push(e)).observe(host);
      new OwnedMutationObserver(host, (r) => received.push(r)).observe(host, { childList: true });
      for (const fake of fakes) {
        const { proxy, revoke } = Proxy.revocable([], {});
        revoke();
        fake.instances[0]!.cb(proxy);
        fake.instances[0]!.cb(undefined as never);
      }
      expect(received.map((list) => list.length)).to.deep.equal([0, 0, 0, 0, 0, 0]);
    } finally {
      fakes.forEach((f) => f.restore());
      host.remove();
    }
  });
});

describe('observer controllers', () => {
  it('HostChildrenObserver reports light-DOM changes and re-arms after a move', async () => {
    const host = document.createElement('lr-owned-observer-host') as HostElement;
    let changes = 0;
    new HostChildrenObserver(host, { onChange: () => { changes += 1; } });
    document.body.append(host);
    host.append(document.createElement('span'));
    await waitUntil(() => changes === 1);
    host.remove();
    host.append(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(changes).to.equal(1);
    document.body.append(host);
    host.append(document.createElement('span'));
    await waitUntil(() => changes === 2);
    host.remove();
  });

  it('HostChildrenObserver honours attributeFilter and subtree', async () => {
    const host = document.createElement('lr-owned-observer-host') as HostElement;
    const child = document.createElement('span');
    host.append(child);
    let changes = 0;
    new HostChildrenObserver(host, { attributeFilter: ['data-x'], subtree: true, onChange: () => { changes += 1; } });
    document.body.append(host);
    child.setAttribute('data-y', '1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(changes).to.equal(0);
    child.setAttribute('data-x', '1');
    await waitUntil(() => changes === 1);
    host.remove();
  });

  it('AllocationObserverController reports host and extra sizes and falls back to window resize', async () => {
    const host = document.createElement('lr-owned-observer-host') as HostElement;
    host.style.cssText = 'display:block;width:120px;height:10px';
    const extra = document.createElement('span');
    extra.style.cssText = 'display:inline-block;width:7px;height:7px';
    const seen: Array<[number, Element]> = [];
    new AllocationObserverController(host, { onInlineSize: (px, t) => seen.push([px, t]), extra: () => extra });
    document.body.append(host, extra);
    await waitUntil(() => seen.some(([, t]) => t === host) && seen.some(([, t]) => t === extra));
    expect(seen.find(([, t]) => t === host)![0]).to.equal(120);
    expect(seen.find(([, t]) => t === extra)![0]).to.equal(7);
    host.remove();
    extra.remove();

    const target = window as unknown as Fakeable;
    const original = target['ResizeObserver'];
    try {
      target['ResizeObserver'] = undefined;
      const lone = document.createElement('lr-owned-observer-host') as HostElement;
      lone.style.cssText = 'display:block;width:50px;height:10px';
      const sizes: number[] = [];
      new AllocationObserverController(lone, { onInlineSize: (px) => sizes.push(px) });
      document.body.append(lone);
      window.dispatchEvent(new Event('resize'));
      expect(sizes).to.deep.equal([50]);
      lone.remove();
      window.dispatchEvent(new Event('resize'));
      expect(sizes).to.deep.equal([50]);
    } finally {
      target['ResizeObserver'] = original;
    }
  });

  it('VisibilityGate follows intersection, tracks wasPaintable and survives reconnects', () => {
    const host = document.createElement('lr-owned-observer-host') as HostElement;
    const fake = installFake(window, 'IntersectionObserver');
    try {
      const events: Array<[boolean, boolean]> = [];
      const gate = new VisibilityGate(host, { onVisible: (v, was) => events.push([v, was]) });
      document.body.append(host);
      expect(gate.visible).to.be.false;
      fake.instances[0]!.cb([{ target: host, isIntersecting: true }]);
      fake.instances[0]!.cb([{ target: host, isIntersecting: false }]);
      expect(events).to.deep.equal([[true, false], [false, true]]);
      host.remove();
      fake.instances[0]!.cb([{ target: host, isIntersecting: true }]);
      expect(events).to.have.length(2);
      document.body.append(host);
      expect(fake.instances).to.have.length(2);
      expect(gate.known).to.be.false;
    } finally {
      fake.restore();
      host.remove();
    }
  });

  it('VisibilityGate degrades to visible when IntersectionObserver is unavailable or throws', () => {
    const target = window as unknown as Fakeable;
    const original = target['IntersectionObserver'];
    try {
      for (const broken of [undefined, class { constructor() { throw new Error('x'); } }]) {
        target['IntersectionObserver'] = broken;
        const host = document.createElement('lr-owned-observer-host') as HostElement;
        const events: boolean[] = [];
        const gate = new VisibilityGate(host, { onVisible: (v) => events.push(v) });
        document.body.append(host);
        expect(gate.visible).to.be.true;
        expect(gate.known).to.be.true;
        expect(events).to.deep.equal([true]);
        host.remove();
      }
    } finally {
      target['IntersectionObserver'] = original;
    }
  });
});

describe('watchDevicePixelRatio', () => {
  it('re-arms a fresh media query per change, ignores stale lists and disposes cleanly', () => {
    const lists: Array<{ query: string; listeners: Set<() => void> }> = [];
    let ratio = 1;
    const fakeView = {
      get devicePixelRatio() { return ratio; },
      matchMedia(query: string) {
        const record = { query, listeners: new Set<() => void>() };
        lists.push(record);
        return {
          addEventListener: (_: string, l: () => void) => record.listeners.add(l),
          removeEventListener: (_: string, l: () => void) => record.listeners.delete(l),
        };
      },
    } as unknown as Window;
    let calls = 0;
    const dispose = watchDevicePixelRatio(fakeView, () => { calls += 1; });
    expect(lists).to.have.length(1);
    expect(lists[0]!.query).to.equal('(resolution: 1dppx)');
    ratio = 2;
    [...lists[0]!.listeners][0]!();
    expect(calls).to.equal(1);
    expect(lists).to.have.length(2);
    expect(lists[0]!.listeners.size).to.equal(0);
    expect(lists[1]!.query).to.equal('(resolution: 2dppx)');
    dispose();
    expect(lists[1]!.listeners.size).to.equal(0);
    expect(calls).to.equal(1);
  });

  it('is a no-op without a window or matchMedia', () => {
    expect(() => watchDevicePixelRatio(null, () => undefined)()).to.not.throw();
    expect(() => watchDevicePixelRatio({} as Window, () => undefined)()).to.not.throw();
  });
});
