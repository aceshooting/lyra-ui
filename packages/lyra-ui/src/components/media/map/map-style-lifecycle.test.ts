import { expect } from '@open-wc/testing';
import { MapStyleLifecycle, type MapStyleLifecycleEvent, type MapStyleLifecycleOptions } from './map-style-lifecycle.js';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(overrides: Partial<MapStyleLifecycleOptions> = {}) {
  const listeners = new Map<MapStyleLifecycleEvent, Set<(error?: unknown) => void>>();
  const calls: string[] = [];
  const options: MapStyleLifecycleOptions = {
    subscribe(event, listener) {
      const set = listeners.get(event) ?? new Set();
      listeners.set(event, set);
      set.add(listener);
      return () => { set.delete(listener); };
    },
    restore: () => { calls.push('restore'); },
    onStyleReady: () => { calls.push('ready'); },
    onIdle: () => { calls.push('idle'); },
    ...overrides,
  };
  return {
    options, calls,
    fire(event: MapStyleLifecycleEvent, error?: unknown) {
      for (const listener of [...listeners.get(event) ?? []]) listener(error);
    },
    count: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

async function rejection(promise: Promise<void>): Promise<unknown> {
  return promise.then(() => 'unexpected success', (error: unknown) => error);
}

describe('MapStyleLifecycle', () => {
  it('subscribes before synchronous mutation events and publishes once after restoration', async () => {
    const lifecycle = new MapStyleLifecycle();
    const peer = harness({ isIdle: () => true });
    lifecycle.begin({ ...peer.options, mutate: () => { peer.fire('style-ready'); peer.fire('style-ready'); } });
    await lifecycle.whenIdle();
    expect(peer.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(peer.count()).to.equal(0);
  });

  it('recognizes an already-ready and idle peer without another event', async () => {
    const lifecycle = new MapStyleLifecycle();
    const peer = harness({ isStyleReady: () => true, isIdle: () => true });
    lifecycle.begin(peer.options);
    await lifecycle.whenStyleReady();
    await lifecycle.whenIdle();
    expect(peer.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(peer.count()).to.equal(0);
  });

  it('waits for asynchronous restoration and a subsequent idle event', async () => {
    const lifecycle = new MapStyleLifecycle();
    const restored = deferred();
    const peer = harness({ restore: () => restored.promise });
    lifecycle.begin(peer.options);
    peer.fire('style-ready');
    peer.fire('idle');
    expect(peer.calls).to.deep.equal([]);
    restored.resolve();
    await lifecycle.whenStyleReady();
    expect(peer.calls).to.deep.equal(['ready']);
    peer.fire('idle');
    await lifecycle.whenIdle();
    expect(peer.calls).to.deep.equal(['ready', 'idle']);
    expect(peer.count()).to.equal(0);
  });

  it('aborts A and B during rapid replacement and ignores their late restore success or failure', async () => {
    const lifecycle = new MapStyleLifecycle();
    const aRestore = deferred();
    const bRestore = deferred();
    let aSignal!: AbortSignal;
    const a = harness({ restore: (signal) => { aSignal = signal; return aRestore.promise; } });
    lifecycle.begin(a.options);
    const aReady = rejection(lifecycle.whenStyleReady());
    const aIdle = rejection(lifecycle.whenIdle());
    a.fire('style-ready');
    await Promise.resolve();
    const b = harness({ restore: () => bRestore.promise });
    lifecycle.begin(b.options);
    const bReady = rejection(lifecycle.whenStyleReady());
    b.fire('style-ready');
    await Promise.resolve();
    const c = harness({ isStyleReady: () => true, isIdle: () => true });
    lifecycle.begin(c.options);
    aRestore.resolve();
    bRestore.reject(new Error('obsolete failure'));
    await lifecycle.whenIdle();
    expect((await aReady as Error).name).to.equal('AbortError');
    expect((await aIdle as Error).name).to.equal('AbortError');
    expect((await bReady as Error).name).to.equal('AbortError');
    expect(aSignal.aborted).to.equal(true);
    expect(a.calls.concat(b.calls)).to.deep.equal([]);
    expect(c.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(a.count() + b.count() + c.count()).to.equal(0);
  });

  for (const failure of ['mutation', 'restore', 'peer', 'owner'] as const) {
    it(`rejects current waiters and releases listeners after ${failure} failure`, async () => {
      const lifecycle = new MapStyleLifecycle();
      const error = new Error('style failed');
      const peer = harness({
        ...(failure === 'mutation' ? { mutate: () => { throw error; } } : {}),
        ...(failure === 'restore' ? { restore: () => Promise.reject(error) } : {}),
      });
      lifecycle.begin(peer.options);
      const ready = rejection(lifecycle.whenStyleReady());
      const idle = rejection(lifecycle.whenIdle());
      if (failure === 'restore') peer.fire('style-ready');
      if (failure === 'peer') peer.fire('error', error);
      if (failure === 'owner') lifecycle.fail(error);
      expect((await ready) === error).to.equal(true);
      expect((await idle) === error).to.equal(true);
      expect(peer.calls).to.deep.equal([]);
      expect(peer.count()).to.equal(0);
    });
  }

  it('cancels disconnect waiters and rejects requests outside a live generation', async () => {
    const lifecycle = new MapStyleLifecycle();
    expect((await rejection(lifecycle.whenStyleReady()) as Error).name).to.equal('AbortError');
    const peer = harness();
    lifecycle.begin(peer.options);
    const pending = rejection(lifecycle.whenIdle());
    lifecycle.cancel();
    lifecycle.cancel();
    peer.fire('style-ready');
    expect((await pending as Error).name).to.equal('AbortError');
    expect((await rejection(lifecycle.whenIdle()) as Error).name).to.equal('AbortError');
    expect(peer.calls).to.deep.equal([]);
    expect(peer.count()).to.equal(0);
  });

  it('does not publish idle from a generation replaced inside its ready callback', async () => {
    const lifecycle = new MapStyleLifecycle();
    const entered = deferred();
    const next = harness({ isStyleReady: () => true, isIdle: () => true });
    const old = harness({ isStyleReady: () => true, isIdle: () => true,
      onStyleReady: () => { lifecycle.begin(next.options); entered.resolve(); } });
    lifecycle.begin(old.options);
    await entered.promise;
    await lifecycle.whenIdle();
    expect(old.calls).to.deep.equal(['restore']);
    expect(next.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(old.count() + next.count()).to.equal(0);
  });

  it('retains idle emitted synchronously from the restored style callback', async () => {
    const lifecycle = new MapStyleLifecycle();
    const peer = harness({ onStyleReady: () => { peer.calls.push('ready'); peer.fire('idle'); } });
    lifecycle.begin(peer.options);
    peer.fire('style-ready');
    await lifecycle.whenIdle();
    expect(peer.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(peer.count()).to.equal(0);
  });

  for (const action of ['begin', 'cancel'] as const) {
    it(`preserves a newer generation begun by an abort listener during ${action}`, async () => {
      const lifecycle = new MapStyleLifecycle();
      const entered = deferred();
      const newer = harness({ isStyleReady: () => true, isIdle: () => true });
      const old = harness({ restore: (signal) => {
        signal.addEventListener('abort', () => { lifecycle.begin(newer.options); }, { once: true });
        entered.resolve();
        return new Promise<void>(() => undefined);
      } });
      lifecycle.begin(old.options);
      const oldReady = rejection(lifecycle.whenStyleReady());
      old.fire('style-ready');
      await entered.promise;
      const superseded = harness();
      if (action === 'begin') lifecycle.begin(superseded.options);
      else lifecycle.cancel();
      await lifecycle.whenIdle();
      expect((await oldReady as Error).name).to.equal('AbortError');
      expect(newer.calls).to.deep.equal(['restore', 'ready', 'idle']);
      expect(old.count() + superseded.count() + newer.count()).to.equal(0);
    });
  }
});

describe('MapStyleLifecycle boundaries', () => {
  it('rejects a style whose peer error is reported while its listeners are installed', async () => {
    const lifecycle = new MapStyleLifecycle(); const failure = new Error('style failed'); const installed: string[] = [];
    let removals = 0;
    lifecycle.begin({
      subscribe(event, listener) { installed.push(event); if (event === 'error') listener(failure); return () => { removals++; }; },
      restore: () => undefined,
    });
    expect((await rejection(lifecycle.whenStyleReady())) === failure).to.equal(true);
    expect((await rejection(lifecycle.whenIdle())) === failure).to.equal(true);
    expect(installed).to.deep.equal(['error']);
    expect(removals).to.equal(1);
  });

  it('releases the remaining listeners when one remover throws', () => {
    const lifecycle = new MapStyleLifecycle(); const removed: string[] = [];
    lifecycle.begin({
      subscribe: (event) => () => { removed.push(event); if (event === 'error') throw new Error('native detail'); },
      restore: () => undefined,
    });
    expect(() => lifecycle.cancel()).not.to.throw();
    expect([...removed].sort()).to.deep.equal(['error', 'idle', 'style-ready']);
  });

  it('rejects the idle wait when the idle callback throws', async () => {
    const lifecycle = new MapStyleLifecycle(); const failure = new Error('owner detail');
    const peer = harness({ isStyleReady: () => true, isIdle: () => true, onIdle: () => { throw failure; } });
    lifecycle.begin(peer.options);
    await lifecycle.whenStyleReady();
    expect((await rejection(lifecycle.whenIdle())) === failure).to.equal(true);
    expect(peer.count()).to.equal(0);
  });

  it('does not finish an idle wait that its own callback superseded', async () => {
    const lifecycle = new MapStyleLifecycle();
    const next = harness({ isStyleReady: () => true, isIdle: () => true });
    const old = harness({ isStyleReady: () => true, isIdle: () => true, onIdle: () => { old.calls.push('idle'); lifecycle.begin(next.options); } });
    lifecycle.begin(old.options);
    const oldIdle = rejection(lifecycle.whenIdle());
    expect((await oldIdle as Error).name).to.equal('AbortError');
    await lifecycle.whenIdle();
    expect(old.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(next.calls).to.deep.equal(['restore', 'ready', 'idle']);
    expect(old.count() + next.count()).to.equal(0);
  });

  it('ignores an idle event raised while the idle callback is running', async () => {
    const lifecycle = new MapStyleLifecycle(); let idles = 0;
    const peer = harness({ isStyleReady: () => true, isIdle: () => true, onIdle: () => { idles++; peer.fire('idle'); } });
    lifecycle.begin(peer.options);
    await lifecycle.whenIdle();
    expect(idles).to.equal(1);
    expect(peer.count()).to.equal(0);
  });
});
