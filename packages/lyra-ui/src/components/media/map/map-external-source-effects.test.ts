import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { MapExternalSourceEffects } from './map-external-source-effects.js';
import type { MapLibreMapCapability } from './map-loader.js';
import type { PreparedMapLocalImage } from './map-local-image.js';

const coordinates = [[-10, 10], [10, 10], [10, -10], [-10, -10]];
describe('external source effects', () => {
  afterEach(fixtureCleanup);
  async function setup() {
    const owner = await fixture<HTMLElement>(html`<div></div>`);
    const source = { loaded: () => settled, play: () => { calls.push('play'); }, pause: () => { calls.push('pause'); } };
    const calls: string[] = [], disposed: string[] = [];
    let settled = false, current = true, live = true, retired = 0, index = 0;
    const sources = new Map<string, unknown>([['canvas', source], ['image', source]]);
    const listeners = new Set<() => void>();
    const map = { getSource: (id: string) => sources.get(id), on: (_type: string, callback: () => void) => { listeners.add(callback); },
      off: (_type: string, callback: () => void) => { listeners.delete(callback); } } as unknown as MapLibreMapCapability;
    const context = { owner, signal: new AbortController().signal, isCurrent: () => current, isLive: () => live, retire: () => { retired++; live = false; }, canPauseCanvas: () => true };
    const effects = new MapExternalSourceEffects(async (): Promise<PreparedMapLocalImage> => {
      const url = `blob:https://example.test/owned-${++index}`;
      return { url, encodedBytes: 8, dispose: () => { disposed.push(url); } };
    });
    return { effects, map, context, source, calls, disposed, sources, listeners,
      settle: () => { settled = true; for (const callback of listeners) callback(); },
      cancel: () => { current = false; }, retire: () => { live = false; }, retired: () => retired };
  }
  it('admits prepared URLs before exposure and disposes a rejected preparation exactly once', async () => {
    const state = await setup(); let applied = 0;
    const input = [{ id: 'image', source: { type: 'image', url: `data:image/png;base64,${'A'.repeat(1_100_000)}`, coordinates } }];
    let seen = '';
    try {
      await state.effects.reconcile(state.map, 1, input, new Map(), state.context,
        async () => { applied++; }, async sources => {
          seen = sources[0]!.source['url'] as string;
          expect(seen.startsWith('blob:')).to.equal(true);
          throw new Error('Complete descriptor proposal exceeds admission limits.');
        });
    } catch { /* Pure admission rejects before exposure. */ }
    expect(applied).to.equal(0); expect(state.disposed).to.deep.equal([seen]);
    state.effects.dispose(); expect(state.disposed).to.deep.equal([seen]);
  });
  it('finishes prepared admission before application and retains accepted URLs until disposal', async () => {
    const state = await setup(); const order: string[] = [];
    await state.effects.reconcile(state.map, 1,
      [{ id: 'image', source: { type: 'image', url: 'data:image/png;base64,AAAA', coordinates } }], new Map(), state.context,
      async () => { order.push('apply'); expect(state.disposed).to.deep.equal([]); },
      async () => { order.push('preflight'); await Promise.resolve(); order.push('admitted'); });
    expect(order).to.deep.equal(['preflight', 'admitted', 'apply']);
    expect(state.disposed).to.deep.equal([]); state.effects.dispose(); expect(state.disposed).to.have.length(1);
  });
  it('keeps initial/unset and equal revisions quiet, coalescing moved coordinates before one upload', async () => {
    const state = await setup(); const canvas = document.createElement('canvas');
    const sources = [{ id: 'canvas', source: { type: 'canvas', canvas, coordinates, animate: false } }];
    for (const revision of [0, 0]) await state.effects.reconcile(state.map, 1, sources, new Map([['canvas', revision]]), state.context, async () => {});
    expect(state.calls).to.deep.equal([]);
    await state.effects.reconcile(state.map, 1, sources, new Map([['canvas', 1]]), state.context, async () => { state.calls.push('coordinates'); });
    expect(state.calls).to.deep.equal(['coordinates', 'play', 'pause']);
    await state.effects.reconcile(state.map, 2, sources, new Map([['canvas', 1]]), state.context, async () => {});
    expect(state.calls).to.have.length(3);
    state.effects.dispose();
  });
  it('never pauses a source after play retires its peer', async () => {
    const state = await setup(); const sources = [{ id: 'canvas', source: { type: 'canvas', canvas: document.createElement('canvas'), animate: false } }];
    await state.effects.reconcile(state.map, 1, sources, new Map(), state.context, async () => {});
    state.source.play = () => { state.calls.push('play'); state.cancel(); state.retire(); };
    let rejected = false;
    try { await state.effects.reconcile(state.map, 1, sources, new Map([['canvas', 1]]), state.context, async () => {}); } catch { rejected = true; }
    expect(rejected).to.equal(true); expect(state.calls).to.deep.equal(['play']); state.effects.dispose();
  });
  it('retires a live poisoned peer when pause repeatedly throws', async () => {
    const state = await setup(); const sources = [{ id: 'canvas', source: { type: 'canvas', canvas: document.createElement('canvas'), animate: false } }];
    await state.effects.reconcile(state.map, 1, sources, new Map(), state.context, async () => {});
    state.source.pause = () => { throw new Error('private native detail'); };
    try { await state.effects.reconcile(state.map, 1, sources, new Map([['canvas', 1]]), state.context, async () => {}); } catch { /* Expected native failure. */ }
    expect(state.retired()).to.equal(1); state.effects.dispose();
  });
  it('retains old owned URLs during update loading, releases them after settlement and preserves caller ownership', async () => {
    const state = await setup();
    const image = (url: string) => [{ id: 'image', source: { type: 'image', url, coordinates } }];
    const seen: string[] = [];
    for (const url of ['blob:https://example.test/input-a', 'blob:https://example.test/input-b']) {
      await state.effects.reconcile(state.map, 1, image(url), new Map(), state.context, async sources => { seen.push(sources[0]!.source['url'] as string); });
    }
    expect(state.disposed).to.deep.equal([]);
    state.settle(); expect(state.disposed).to.deep.equal([seen[0]]);
    await state.effects.reconcile(state.map, 2, image('blob:https://example.test/input-b'), new Map(), state.context, async sources => {
      expect(sources[0]!.source['url']).to.equal(seen[1]);
    });
    state.effects.dispose(); expect(state.disposed).to.deep.equal(seen);
    expect(state.disposed.some(url => url.includes('input-'))).to.equal(false);
  });
  it('disposes preparation cancelled before any native exposure', async () => {
    const state = await setup(); let disposed = 0, applied = 0;
    const effects = new MapExternalSourceEffects(async () => {
      state.cancel(); return { url: 'blob:https://example.test/prepared', encodedBytes: 8, dispose: () => { disposed++; } };
    });
    try { await effects.reconcile(state.map, 1, [{ id: 'image', source: { type: 'image', url: 'data:image/png;base64,AAAA' } }], new Map(), state.context, async () => { applied++; }); } catch { /* Expected cancellation. */ }
    expect(applied).to.equal(0); expect(disposed).to.equal(1); effects.dispose();
  });
  for (const animate of [false, true]) for (const throws of [false, true]) {
    it(`preserves animate=${animate} after data-only redraw supersession with throw=${throws}`, async () => {
      const state = await setup();
      const sources = [{ id: 'canvas', source: { type: 'canvas', canvas: document.createElement('canvas'), animate } }];
      await state.effects.reconcile(state.map, 1, sources, new Map(), state.context, async () => {});
      state.source.play = () => { state.calls.push('play'); state.cancel(); if (throws) throw new Error('native callback'); };
      let rejected = false;
      try { await state.effects.reconcile(state.map, 1, sources, new Map([['canvas', 1]]), state.context, async () => {}); }
      catch { rejected = true; }
      expect(rejected).to.equal(true);
      expect(state.calls).to.deep.equal(animate ? ['play'] : ['play', 'pause']);
      expect(state.retired()).to.equal(0); state.effects.dispose();
    });
  }
  it('does not pause a static redraw after its successor requests animation', async () => {
    const state = await setup();
    const sources = [{ id: 'canvas', source: { type: 'canvas', canvas: document.createElement('canvas'), animate: false } }];
    await state.effects.reconcile(state.map, 1, sources, new Map(), state.context, async () => {});
    let animatedSuccessor = false;
    state.context.canPauseCanvas = () => !animatedSuccessor;
    state.source.play = () => { state.calls.push('play'); animatedSuccessor = true; state.cancel(); };
    try { await state.effects.reconcile(state.map, 1, sources, new Map([['canvas', 1]]), state.context, async () => {}); }
    catch { /* Superseded after native play. */ }
    expect(state.calls).to.deep.equal(['play']); state.effects.dispose();
  });
  it('retires several local handles after an HTTP successor settles on the retained source', async () => {
    const state = await setup(), image = (url: string) => [{ id: 'image', source: { type: 'image', url, coordinates } }];
    const seen: string[] = [];
    for (const input of ['blob:https://example.test/a', 'blob:https://example.test/b', 'https://example.test/remote.png']) {
      await state.effects.reconcile(state.map, 1, image(input), new Map(), state.context,
        async sources => { seen.push(sources[0]!.source['url'] as string); });
    }
    expect(state.disposed).to.deep.equal([]);
    state.settle(); state.settle(); expect(state.disposed).to.deep.equal(seen.slice(0, 2));
    await state.effects.reconcile(state.map, 1, image('blob:https://example.test/c'), new Map(), state.context,
      async sources => { seen.push(sources[0]!.source['url'] as string); });
    expect(state.disposed).to.have.length(2);
    state.effects.dispose(); expect(state.disposed).to.deep.equal([seen[0], seen[1], seen[3]]);
  });
  for (const replacement of [false, true]) {
    it(`releases local retirees when their native source is ${replacement ? 'replaced' : 'removed'}`, async () => {
      const state = await setup();
      await state.effects.reconcile(state.map, 1, [{ id: 'image', source: { type: 'image', url: 'blob:https://example.test/input' } }], new Map(), state.context, async () => {});
      await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {
        if (replacement) state.sources.set('image', { loaded: () => false }); else state.sources.delete('image');
      });
      expect(state.disposed).to.have.length(1); state.effects.dispose(); expect(state.disposed).to.have.length(1);
    });
  }
  it('admits the exact local retention ceiling and sweeps settlement during preparation before reserving', async () => {
    const state = await setup(); let index = 0, applied = 0, settleDuringPrepare = false;
    const disposed: number[] = [];
    const effects = new MapExternalSourceEffects(async () => {
      const id = ++index;
      if (settleDuringPrepare) state.settle();
      return { url: `blob:https://example.test/${id}`, encodedBytes: id === 9 ? 1 : 1024 * 1024, dispose: () => { disposed.push(id); } };
    });
    const apply = async () => { applied++; };
    const image = (id: number) => [{ id: 'image', source: { type: 'image', url: `blob:https://example.test/input-${id}` } }];
    for (let id = 1; id <= 8; id++) await effects.reconcile(state.map, 1, image(id), new Map(), state.context, apply);
    expect(applied).to.equal(8); expect(disposed).to.deep.equal([]);
    let rejected = false;
    try { await effects.reconcile(state.map, 1, image(9), new Map(), state.context, apply); } catch { rejected = true; }
    expect(rejected).to.equal(true); expect(applied).to.equal(8); expect(disposed).to.deep.equal([9]);
    settleDuringPrepare = true;
    await effects.reconcile(state.map, 1, image(10), new Map(), state.context, apply);
    expect(applied).to.equal(9); expect(disposed).to.deep.equal([9, 1, 2, 3, 4, 5, 6, 7, 8]);
    effects.dispose(); expect(disposed).to.deep.equal([9, 1, 2, 3, 4, 5, 6, 7, 8, 10]);
  });
  it('keeps ambiguous failed exposure charged until a successful successor settles', async () => {
    const state = await setup();
    const image = (url: string) => [{ id: 'image', source: { type: 'image', url } }];
    await state.effects.reconcile(state.map, 1, image('blob:https://example.test/a'), new Map(), state.context, async () => {});
    state.settle();
    try { await state.effects.reconcile(state.map, 1, image('blob:https://example.test/b'), new Map(), state.context,
      async () => { throw new Error('accepted URL then failed'); }); } catch { /* Ambiguous native exposure. */ }
    state.settle(); expect(state.disposed).to.deep.equal([]);
    await state.effects.reconcile(state.map, 1, image('https://example.test/successor.png'), new Map(), state.context, async () => {});
    expect(state.disposed).to.have.length(2); state.effects.dispose(); expect(state.disposed).to.have.length(2);
  });

  it('protects a fresh URL while native application awaits preparation, then retires it once', async () => {
    const state = await setup();
    await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {});
    let entered!: () => void, release!: () => void;
    const applying = new Promise<void>(resolve => { entered = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    let forwarded = '';
    const pending = state.effects.reconcile(state.map, 1,
      [{ id: 'fresh', source: { type: 'image', url: 'blob:https://example.test/input' } }], new Map(), state.context,
      async sources => {
        forwarded = sources[0]!.source['url'] as string; entered(); await barrier;
        state.sources.set('fresh', { loaded: () => false });
      });
    await applying;
    expect(state.sources.has('fresh')).to.equal(false);
    state.settle(); expect(state.disposed).to.deep.equal([]);
    release(); await pending;
    state.settle(); expect(state.disposed).to.deep.equal([]);
    await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => { state.sources.delete('fresh'); });
    state.settle(); expect(state.disposed).to.deep.equal([forwarded]);
    state.effects.dispose(); expect(state.disposed).to.deep.equal([forwarded]);
  });
  it('protects all prepared URLs when an earlier source emits settlement before a later source installs', async () => {
    const state = await setup();
    await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {});
    const rows = ['first', 'second'].map(id => ({ id, source: { type: 'image', url: `blob:https://example.test/${id}` } }));
    const forwarded: string[] = [];
    await state.effects.reconcile(state.map, 1, rows, new Map(), state.context, async sources => {
      for (const entry of sources) {
        forwarded.push(entry.source['url'] as string);
        state.sources.set(entry.id, { loaded: () => false });
        state.settle(); expect(state.disposed).to.deep.equal([]);
      }
    });
    expect(forwarded).to.have.length(2); state.settle(); expect(state.disposed).to.deep.equal([]);
    await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {
      for (const entry of rows) { state.sources.delete(entry.id); state.settle(); }
    });
    expect(state.disposed).to.deep.equal(forwarded);
    state.effects.dispose(); expect(state.disposed).to.deep.equal(forwarded);
  });
  for (const outcome of ['fail-before-install', 'fail-after-install', 'cancel'] as const) {
    it(`protects pending exposure through ${outcome} and releases only after application ends or native retirement`, async () => {
      const state = await setup();
      await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {});
      let entered!: () => void, release!: () => void;
      const applying = new Promise<void>(resolve => { entered = resolve; });
      const barrier = new Promise<void>(resolve => { release = resolve; });
      const pending = state.effects.reconcile(state.map, 1,
        [{ id: 'fresh', source: { type: 'image', url: 'blob:https://example.test/input' } }], new Map(), state.context,
        async () => {
          entered(); await barrier;
          if (outcome === 'fail-after-install') state.sources.set('fresh', { loaded: () => true });
          if (outcome !== 'cancel') throw new Error('application interrupted');
        });
      const rejected = pending.then(() => false, () => true);
      await applying;
      if (outcome === 'cancel') state.cancel();
      state.settle(); expect(state.disposed).to.deep.equal([]);
      release(); expect(await rejected).to.equal(true);
      if (outcome === 'fail-after-install') {
        // A loaded source after failed exposure is not proof of which URL it accepted.
        state.settle(); expect(state.disposed).to.deep.equal([]);
        state.sources.delete('fresh'); state.settle();
      }
      expect(state.disposed).to.have.length(1);
      state.settle(); state.effects.dispose(); expect(state.disposed).to.have.length(1);
    });
  }
  for (const successorStyle of [1, 2]) {
    it(`keeps an old application protected after a style-${successorStyle} successor finishes, then sweeps the latest owner`, async () => {
      const state = await setup();
      await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {});
      let entered!: () => void, release!: () => void;
      const applying = new Promise<void>(resolve => { entered = resolve; });
      const barrier = new Promise<void>(resolve => { release = resolve; });
      const old = state.effects.reconcile(state.map, 1,
        [{ id: 'fresh', source: { type: 'image', url: 'blob:https://example.test/input' } }], new Map(), state.context,
        async () => { entered(); await barrier; });
      const rejected = old.then(() => false, () => true);
      await applying; state.settle(); expect(state.disposed).to.deep.equal([]);
      await state.effects.reconcile(state.map, successorStyle,
        [{ id: 'fresh', source: { type: 'image', url: 'https://example.test/successor.png' } }], new Map(), state.context,
        async () => { state.sources.set('fresh', { loaded: () => true }); });
      state.settle(); expect(state.disposed).to.deep.equal([]);
      // The superseded native operation has now finished without installing its old URL.
      release(); expect(await rejected).to.equal(true);
      expect(state.disposed).to.have.length(1);
      state.settle(); state.effects.dispose(); expect(state.disposed).to.have.length(1);
    });
  }

  it('keeps partial multi-source exposure until failure settles and proves each handle retired separately', async () => {
    const state = await setup();
    await state.effects.reconcile(state.map, 1, [], new Map(), state.context, async () => {});
    const rows = ['first', 'second'].map(id => ({ id, source: { type: 'image', url: `blob:https://example.test/${id}` } }));
    let during: string[] = [], forwarded: string[] = [];
    const rejected = await state.effects.reconcile(state.map, 1, rows, new Map(), state.context, async sources => {
      forwarded = sources.map(entry => entry.source['url'] as string);
      state.sources.set('first', { loaded: () => true });
      state.settle(); during = [...state.disposed];
      throw new Error('second source was not installed');
    }).then(() => false, () => true);
    expect(rejected).to.equal(true); expect(during).to.deep.equal([]);
    expect(state.disposed).to.deep.equal([forwarded[1]]);
    state.settle(); expect(state.disposed).to.deep.equal([forwarded[1]]);
    state.sources.delete('first'); state.settle();
    expect(state.disposed).to.deep.equal([forwarded[1], forwarded[0]]);
    state.effects.dispose(); expect(state.disposed).to.deep.equal([forwarded[1], forwarded[0]]);
  });

});
