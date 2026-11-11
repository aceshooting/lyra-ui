import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraIndexedView, LyraSourceContext } from '../data-sources.js';
import { SourceWindowController, type SourceWindowOptions } from './source-window-controller.js';

type Row = { key: string };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const normalize = (value: unknown): Row => {
  if (!value || typeof value !== 'object' || typeof (value as Row).key !== 'string') throw new TypeError('Invalid row');
  return { key: (value as Row).key };
};
function setup(options: Partial<SourceWindowOptions<Row>> = {}) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new SourceWindowController<Row>(host, {
    pageSize: 1, maxRows: 2, maxPages: 2, maxConcurrent: 1,
    normalize, keyOf: (value) => value.key, onChange: () => {}, ...options,
  });
  const owner = {};
  return {
    control, host,
    bind: (view: LyraIndexedView<Row>, revision = 1) => control.bind({ owner, revision, epoch: 0, locale: 'en', view }),
    cleanup: () => { host.remove(); controllers.forEach((controller) => controller.hostDisconnected?.()); },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe('SourceWindowController construction', () => {
  const host = (): HTMLElement & ReactiveControllerHost => Object.assign(document.createElement('div'), {
    addController: () => {}, removeController: () => {}, requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  });
  const base: SourceWindowOptions<Row> = {
    pageSize: 1, maxRows: 2, maxPages: 2, maxConcurrent: 1, normalize, keyOf: (value) => value.key, onChange: () => {},
  };

  it('rejects window bounds outside the supported ceilings', () => {
    for (const overrides of [
      { pageSize: 0 }, { pageSize: 3 }, { maxRows: 0 }, { maxRows: 501 }, { maxPages: 0 }, { maxPages: 6 },
      { maxConcurrent: 0 as never }, { maxConcurrent: 3 as never },
    ]) {
      expect(() => new SourceWindowController<Row>(host(), { ...base, ...overrides }), JSON.stringify(overrides))
        .to.throw(RangeError, 'Invalid source window bounds');
    }
    for (const concurrent of [1, 2] as const) {
      expect(() => new SourceWindowController<Row>(host(), { ...base, maxConcurrent: concurrent })).to.not.throw();
    }
  });

  it('requires a weight ceiling and a weight function together, with a positive safe-integer ceiling', () => {
    for (const overrides of [
      { maxWeight: 10 }, { weightOf: () => 1 }, { maxWeight: 0, weightOf: () => 1 },
      { maxWeight: 1.5, weightOf: () => 1 }, { maxWeight: 10, weightOf: 'heavy' as never },
    ]) {
      expect(() => new SourceWindowController<Row>(host(), { ...base, ...overrides }), JSON.stringify(overrides))
        .to.throw(RangeError, 'Invalid source weight bounds');
    }
    expect(() => new SourceWindowController<Row>(host(), { ...base, maxWeight: 10, weightOf: () => 1 })).to.not.throw();
  });
});

describe('SourceWindowController requests and lookups', () => {
  it('rejects an inverted or malformed range but accepts an empty one', () => {
    const test = setup();
    try {
      test.bind({ count: 3, read: async () => [{ key: 'a' }] });
      expect(() => test.control.requestRange(2, 1)).to.throw(RangeError, 'Invalid source range');
      expect(() => test.control.requestRange(-1, 1)).to.throw(RangeError, 'Invalid source count');
      expect(() => test.control.requestRange(1, 1)).to.not.throw();
    } finally { test.cleanup(); }
  });

  it('re-reads a row whose earlier read failed when it is ensured again', async () => {
    const test = setup({ maxRows: 3, maxPages: 3 });
    try {
      let attempts = 0;
      test.bind({ count: 2, itemAt: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient failure');
        return { key: 'row' };
      } });
      expect(test.control.source.itemAt(0).state).to.equal('error');
      expect(await test.control.ensure(0)).to.equal(true);
      expect(attempts).to.equal(2);
      expect(await test.control.ensure(9), 'an index outside the source is never ensured').to.equal(false);
    } finally { test.cleanup(); }
  });

  it('settles a replaced lookup as unresolved and answers null without a binding', async () => {
    const test = setup();
    try {
      expect(await test.control.resolveKey('row'), 'nothing is bound').to.equal(null);
      test.bind({ count: 2, itemAt: (index) => ({ key: `row-${index}` }), indexOfKey: () => 1 });
      const stale = test.control.resolveKey('row-0');
      const latest = test.control.resolveKey('row-1');
      expect(await stale).to.equal(null);
      expect(await latest).to.equal(1);
    } finally { test.cleanup(); }
  });

  it('discards a lookup answer when the source is replaced before the provider is asked', async () => {
    const test = setup();
    try {
      let asked = 0;
      test.bind({ count: 2, read: async () => [], indexOfKey: async () => { asked += 1; return 1; } });
      const lookup = test.control.resolveKey('row-1');
      queueMicrotask(() => test.bind({ count: 2, read: async () => [], indexOfKey: async () => 0 }, 2));
      expect(await lookup).to.equal(null);
      expect(asked).to.equal(0);
      expect(await test.control.resolveKey('row-0'), 'the replacement answers its own lookups').to.equal(0);
    } finally { test.cleanup(); }
  });

  it('reports rows of a disconnected host as still loading', () => {
    const test = setup();
    try {
      test.bind({ count: 2, itemAt: (index) => ({ key: `row-${index}` }) });
      expect(test.control.source.itemAt(0).state).to.equal('ready');
      test.host.remove();
      expect(test.control.source.itemAt(1).state).to.equal('loading');
      expect(test.control.source.keyAt!(1)).to.equal(1);
    } finally { test.cleanup(); }
  });
});

describe('SourceWindowController source replacement during page work', () => {
  it('keeps a replacement bound by the abort callback of the page a moving window evicts', async () => {
    const test = setup({ maxRows: 1, maxPages: 1 });
    try {
      let replaced = 0;
      test.bind({
        count: 10,
        read: ({ offset, signal }) => {
          signal.addEventListener('abort', () => {
            replaced += 1;
            test.bind({ count: 4, read: async ({ offset: replacementOffset }) => [{ key: `new-${replacementOffset}` }] }, 2);
          }, { once: true });
          return Promise.resolve([{ key: `old-${offset}` }]);
        },
      });
      expect(await test.control.ensure(0)).to.equal(true);
      // The finished page still holds its lease when the caller resumes, so evicting it for the
      // moved window revokes the lease and runs the provider's abort callback.
      test.control.requestRange(5, 6);
      expect(replaced, 'evicting the page revoked its read').to.equal(1);
      expect(test.control.source.count, 'the replacement binding survived the interrupted request').to.equal(4);
      expect(await test.control.ensure(1)).to.equal(true);
      const slot = test.control.source.itemAt(1);
      expect(slot.state === 'ready' && slot.value.key).to.equal('new-1');
    } finally { test.cleanup(); }
  });

  it('drops a queued page when a finished read is revoked by the next page starting', async () => {
    const test = setup({ maxRows: 2, maxPages: 2, maxConcurrent: 1 });
    try {
      let replaced = false;
      let secondReads = 0;
      test.bind({
        count: 4,
        read: ({ offset, signal }) => {
          if (offset === 1) secondReads += 1;
          if (offset === 0) {
            signal.addEventListener('abort', () => {
              replaced = true;
              test.bind({ count: 3, read: async ({ offset: replacementOffset }) => [{ key: `new-${replacementOffset}` }] }, 2);
            }, { once: true });
          }
          return Promise.resolve([{ key: `old-${offset}` }]);
        },
      });
      expect(await test.control.ensure(0)).to.equal(true);
      const second = test.control.ensure(1);
      expect(await second, 'the page that triggered the revocation never lands').to.equal(false);
      expect(replaced).to.equal(true);
      expect(secondReads).to.equal(0);
      expect(await test.control.ensure(1), 'the replacement serves the same index').to.equal(true);
      const slot = test.control.source.itemAt(1);
      expect(slot.state === 'ready' && slot.value.key).to.equal('new-1');
    } finally { test.cleanup(); }
  });

  it('does not start a read for a page whose source was replaced before the pump ran', async () => {
    const test = setup();
    try {
      let oldReads = 0;
      test.bind({ count: 3, read: async () => { oldReads += 1; return [{ key: 'old' }]; } });
      const page = test.control.ensure(0);
      queueMicrotask(() => test.bind({ count: 3, read: async () => [{ key: 'new' }] }, 2));
      expect(await page).to.equal(false);
      expect(oldReads).to.equal(0);
      expect(await test.control.ensure(0)).to.equal(true);
    } finally { test.cleanup(); }
  });

  it('ignores a read that fails after its source was replaced', async () => {
    const test = setup();
    try {
      const failing = deferred<readonly Row[]>();
      test.bind({ count: 3, read: () => failing.promise });
      const page = test.control.ensure(0);
      await tick();
      test.bind({ count: 3, read: async () => [{ key: 'new' }] }, 2);
      expect(await page).to.equal(false);
      failing.reject(new Error('late failure'));
      await tick();
      expect(await test.control.ensure(0)).to.equal(true);
      const slot = test.control.source.itemAt(0);
      expect(slot.state === 'ready' && slot.value.key, 'the late failure did not poison the replacement').to.equal('new');
    } finally { test.cleanup(); }
  });
});

describe('SourceWindowController lookup capability ownership', () => {
  for (const kind of ['indexed', 'range'] as const) {
    it(`preserves the ${kind} provider receiver and lookup arguments`, async () => {
      const test = setup();
      let receiver: unknown, args: unknown[] = [];
      const view: LyraIndexedView<Row> = kind === 'indexed'
        ? {
          count: 2, itemAt: (index) => ({ key: `row-${index}` }),
          indexOfKey(...values: unknown[]) { receiver = this; args = values; return 1; },
        }
        : {
          count: 2, read: async () => [{ key: 'row-0' }],
          async indexOfKey(...values: unknown[]) { receiver = this; args = values; return 1; },
        };
      try {
        test.bind(view);
        expect(await test.control.resolveKey('row-1')).to.equal(1);
        expect(receiver === view).to.equal(true);
        expect(args.length).to.equal(kind === 'indexed' ? 1 : 2);
        expect(typeof args[0]).to.equal('string');
        expect(args[0]).to.equal('row-1');
        if (kind === 'range') {
          const context = args[1] as LyraSourceContext;
          expect(context.revision).to.equal(1);
          expect(context.locale).to.equal('en');
          expect(context.signal.aborted).to.equal(false);
        }
      } finally { test.cleanup(); }
    });

    for (const unavailable of ['absent', 'throws'] as const) {
      it(`retries a ${kind} lookup whose capability was initially ${unavailable}`, async () => {
        const test = setup();
        let available = false, calls = 0;
        const view: LyraIndexedView<Row> = kind === 'indexed'
          ? { count: 2, itemAt: (index) => ({ key: `row-${index}` }) }
          : { count: 2, read: async () => [{ key: 'row-0' }] };
        const lookup = kind === 'indexed'
          ? () => { calls++; return 1; }
          : async () => { calls++; return 1; };
        Object.defineProperty(view, 'indexOfKey', { get() {
          if (available) return lookup;
          if (unavailable === 'throws') throw new Error('Lookup capability unavailable');
          return undefined;
        } });
        try {
          test.bind(view);
          expect(await test.control.resolveKey('row-1')).to.equal(null);
          expect(calls).to.equal(0);
          available = true;
          expect(await test.control.resolveKey('row-1')).to.equal(1);
          expect(calls).to.equal(1);
        } finally { test.cleanup(); }
      });
    }

    for (const boundary of ['kind', 'lookup'] as const) {
      for (const retirement of ['replace', 'disconnect'] as const) {
        it(`does not invoke a retired ${kind} lookup when its ${boundary} getter causes ${retirement}`, async () => {
          const test = setup();
          let armed = false, retiredCalls = 0;
          const replacement: LyraIndexedView<Row> = {
            count: 2, itemAt: (index) => ({ key: `new-${index}` }), indexOfKey: () => 0,
          };
          const retire = () => {
            if (!armed) return;
            armed = false;
            if (retirement === 'replace') test.bind(replacement, 2);
            else test.host.remove();
          };
          const view: LyraIndexedView<Row> = kind === 'indexed'
            ? { count: 2, itemAt: (index) => ({ key: `old-${index}` }) }
            : { count: 2, read: async () => [{ key: 'old-0' }] };
          const itemAt: unknown = Reflect.get(view, 'itemAt');
          Object.defineProperty(view, 'itemAt', {
            configurable: true,
            get() { if (boundary === 'kind') retire(); return itemAt; },
          });
          const lookup = kind === 'indexed'
            ? () => { retiredCalls++; return 1; }
            : async () => { retiredCalls++; return 1; };
          Object.defineProperty(view, 'indexOfKey', {
            configurable: true,
            get() { if (boundary === 'lookup') retire(); return lookup; },
          });
          try {
            test.bind(view);
            armed = true;
            expect(await test.control.resolveKey('old-1')).to.equal(null);
            expect(retiredCalls, 'a revoked provider must never start lookup work').to.equal(0);
            if (retirement === 'disconnect') {
              document.body.append(test.host);
              test.bind(replacement, 2);
            }
            expect(await test.control.resolveKey('new-0'), 'the replacement lookup is not stranded').to.equal(0);
          } finally { test.cleanup(); }
        });
      }
    }
  }
});

describe('SourceWindowController synchronous capability ownership', () => {
  for (const operation of ['indexOfKey', 'keyAt', 'itemAt'] as const) {
    for (const boundary of ['kind', 'callback'] as const) {
      for (const retirement of ['replace', 'disconnect'] as const) {
        it(`stops ${operation} when its ${boundary} getter causes ${retirement}`, () => {
          const test = setup();
          let armed = false, retired = false, lateCalls = 0, kindReads = 0;
          const replacement: LyraIndexedView<Row> = {
            count: 2, itemAt: index => ({ key: `new-${index}` }), keyAt: index => `new-${index}`, indexOfKey: () => 0,
          };
          const retire = () => {
            if (!armed) return;
            armed = false; retired = true;
            if (retirement === 'replace') test.bind(replacement, 2);
            else { test.host.remove(); test.control.hostDisconnected(); }
          };
          const view = {
            count: 2,
            itemAt: (index: number) => { if (retired) lateCalls++; return { key: `old-${index}` }; },
            keyAt: (index: number) => { if (retired) lateCalls++; return `old-${index}`; },
            indexOfKey: () => { if (retired) lateCalls++; return 1; },
          };
          const read = view.itemAt;
          Object.defineProperty(view, 'itemAt', { get() {
            if (armed && ++kindReads === (boundary === 'callback' && operation === 'itemAt' ? 2 : 1) &&
                (boundary === 'kind' || operation === 'itemAt')) retire();
            return read;
          } });
          if (operation !== 'itemAt') {
            const callback = view[operation];
            Object.defineProperty(view, operation, { get() {
              if (boundary === 'callback') retire();
              return callback;
            } });
          }
          try {
            test.bind(view);
            armed = true;
            const result = operation === 'indexOfKey' ? test.control.source.indexOfKey!('old-1')
              : operation === 'keyAt' ? test.control.source.keyAt!(0) : test.control.source.itemAt(0).state;
            expect(result).to.equal(operation === 'indexOfKey' ? -1 : operation === 'keyAt' ? 0 : 'loading');
            expect(lateCalls, 'a capability read must not start retired provider work').to.equal(0);
            if (retirement === 'disconnect') {
              document.body.append(test.host); test.control.hostConnected(); test.bind(replacement, 2);
            }
            const slot = test.control.source.itemAt(0);
            expect(slot.state === 'ready' ? slot.value.key : '').to.equal('new-0');
            expect(test.control.source.keyAt!(0)).to.equal('new-0');
            expect(test.control.source.indexOfKey!('new-0')).to.equal(0);
          } finally { test.cleanup(); }
        });
      }
    }
  }

  for (const operation of ['indexOfKey', 'keyAt'] as const) {
    it(`contains a throwing ${operation} capability getter and recovers when it becomes available`, () => {
      const test = setup(); let available = false;
      const view = { count: 2, itemAt: (index: number) => ({ key: `row-${index}` }) };
      Object.defineProperty(view, operation, { get() {
        if (!available) throw new Error('Lookup capability unavailable');
        return operation === 'indexOfKey' ? () => 1 : () => 'row-1';
      } });
      try {
        test.bind(view);
        const lookup = () => operation === 'indexOfKey' ? test.control.source.indexOfKey!('row-1') : test.control.source.keyAt!(1);
        expect(lookup()).to.equal(operation === 'indexOfKey' ? -1 : 1);
        available = true;
        expect(lookup()).to.equal(operation === 'indexOfKey' ? 1 : 'row-1');
      } finally { test.cleanup(); }
    });
  }

  it('does not invoke a retired key verifier while admitting a synchronous row', () => {
    const test = setup(); let lateKeys = 0;
    const view = { count: 2, itemAt: (index: number) => ({ key: `old-${index}` }), get keyAt() {
      test.bind({ count: 2, itemAt: index => ({ key: `new-${index}` }) }, 2);
      return () => { lateKeys++; return 'old-0'; };
    } };
    try {
      test.bind(view);
      expect(test.control.source.itemAt(0).state).to.equal('loading');
      expect(lateKeys).to.equal(0);
      const slot = test.control.source.itemAt(0);
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal('new-0');
    } finally { test.cleanup(); }
  });

  it('does not transfer an indexed ensure request to a replacement from the kind getter', async () => {
    const test = setup(); let armed = false, newReads = 0;
    const read = (index: number) => ({ key: `old-${index}` });
    const view = { count: 2, get itemAt() {
      if (armed) { armed = false; test.bind({ count: 2, itemAt: () => { newReads++; return { key: 'new' }; } }, 2); }
      return read;
    } };
    try {
      test.bind(view); armed = true;
      expect(await test.control.ensure(0)).to.equal(false);
      expect(newReads).to.equal(0);
      expect(await test.control.ensure(0)).to.equal(true);
      expect(newReads).to.equal(1);
    } finally { test.cleanup(); }
  });

  for (const retirement of ['replace', 'disconnect'] as const) {
    it(`does not start a range read after its getter causes ${retirement}`, async () => {
      const test = setup(); let armed = false, lateReads = 0;
      const replacement = { count: 2, read: async () => [{ key: 'new' }] };
      const view = { count: 2, get read() {
        if (armed) {
          armed = false;
          if (retirement === 'replace') test.bind(replacement, 2);
          else { test.host.remove(); test.control.hostDisconnected(); }
        }
        return async () => { lateReads++; return [{ key: 'old' }]; };
      } };
      try {
        test.bind(view); armed = true;
        expect(await test.control.ensure(0)).to.equal(false);
        expect(lateReads).to.equal(0);
        if (retirement === 'disconnect') {
          document.body.append(test.host); test.control.hostConnected(); test.bind(replacement, 2);
        }
        expect(await test.control.ensure(0)).to.equal(true);
      } finally { test.cleanup(); }
    });
  }

  it('does not consume a replacement page queued from the range-pump kind getter', async () => {
    const test = setup(); let armed = false, reads = 0, kinds = 0;
    let replacementPage: Promise<boolean> | undefined;
    const view = { count: 2, read: async () => [{ key: 'old' }], get itemAt() {
      if (armed && ++kinds === 2) {
        armed = false;
        test.bind({ count: 2, read: async () => { reads++; return [{ key: 'new' }]; } }, 2);
        replacementPage = test.control.ensure(0);
      }
      return undefined;
    } };
    try {
      test.bind(view); armed = true;
      expect(await test.control.ensure(0)).to.equal(false);
      expect(await replacementPage).to.equal(true);
      expect(reads).to.equal(1);
    } finally { test.cleanup(); }
  });
});

describe('SourceWindowController provider call contracts', () => {
  it('preserves indexed receivers and arguments for rows, keys and cached lookups', () => {
    const test = setup(); const receivers: boolean[] = [], indices: number[] = [], keys: string[] = [];
    const view = {
      count: 2,
      itemAt(index: number) { receivers.push(this === view); indices.push(index); return { key: `row-${index}` }; },
      keyAt(index: number) { receivers.push(this === view); indices.push(index); return `row-${index}`; },
      indexOfKey(key: string) { receivers.push(this === view); keys.push(key); return 1; },
    };
    try {
      test.bind(view);
      const slot = test.control.source.itemAt(1);
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal('row-1');
      expect(test.control.source.keyAt!(1)).to.equal('row-1');
      expect(test.control.source.indexOfKey!('row-1')).to.equal(1);
      expect(receivers).to.deep.equal([true, true, true, true]);
      expect(indices).to.deep.equal([1, 1, 1]);
      expect(keys).to.deep.equal(['row-1']);
    } finally { test.cleanup(); }
  });

  it('preserves the range receiver and request context', async () => {
    const test = setup(); let receiver: unknown, request: (LyraSourceContext & { offset: number; limit: number }) | undefined;
    const view = { count: 2, async read(context: LyraSourceContext & { offset: number; limit: number }) {
      receiver = this; request = context;
      return [{ key: 'row-1' }];
    } };
    try {
      test.bind(view);
      expect(await test.control.ensure(1)).to.equal(true);
      expect(receiver === view).to.equal(true);
      expect(request?.offset).to.equal(1);
      expect(request?.limit).to.equal(1);
      expect(request?.revision).to.equal(1);
      expect(request?.locale).to.equal('en');
      expect(request?.signal.aborted).to.equal(false);
    } finally { test.cleanup(); }
  });
});

describe('SourceWindowController replacement page ownership', () => {
  it('does not drop a replacement page queued from a requestRange kind getter', async () => {
    const test = setup(); let armed = false, reads = 0;
    let replacementPage: Promise<boolean> | undefined;
    const view = { count: 2, read: async () => [{ key: 'old' }], get itemAt() {
      if (armed) {
        armed = false;
        test.bind({ count: 2, read: async () => { reads++; return [{ key: 'new' }]; } }, 2);
        replacementPage = test.control.ensure(1);
      }
      return undefined;
    } };
    try {
      test.bind(view); armed = true;
      test.control.requestRange(0, 1);
      expect(await replacementPage).to.equal(true);
      expect(reads).to.equal(1);
      const slot = test.control.source.itemAt(1);
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal('new');
    } finally { test.cleanup(); }
  });

  it('keeps replacement pages when an earlier read aborts during concurrent channel acquisition', async () => {
    const test = setup({ maxConcurrent: 2 }); let armed = false, reads = 0;
    let replacementPage: Promise<boolean> | undefined;
    const replacement = { count: 2, read: async () => { reads++; return [{ key: 'new' }]; } };
    const view = { count: 2, async read(request: LyraSourceContext & { offset: number }) {
      request.signal.addEventListener('abort', () => {
        if (!armed) return;
        armed = false;
        test.bind(replacement, 2);
        replacementPage = test.control.ensure(0);
      }, { once: true });
      return [{ key: `old-${request.offset}` }];
    } };
    try {
      test.bind(view);
      expect(await test.control.ensure(0)).to.equal(true);
      await tick();
      armed = true;
      expect(await test.control.ensure(1)).to.equal(false);
      expect(await replacementPage).to.equal(true);
      expect(reads).to.equal(1);
    } finally { test.cleanup(); }
  });
});

for (const boundary of ['count', 'kind'] as const) {
  it(`stops inspecting a binding after its ${boundary} getter replaces it`, () => {
    const test = setup(); let retired = false, lateReads = 0;
    const replace = () => {
      retired = true;
      test.bind({ count: 2, itemAt: index => ({ key: `new-${index}` }) }, 2);
    };
    const view = {
      get count() { if (boundary === 'count') replace(); return 2; },
      get itemAt() {
        if (retired) lateReads++;
        if (boundary === 'kind') replace();
        return (index: number) => ({ key: `old-${index}` });
      },
      get read() { if (retired) lateReads++; return undefined; },
    };
    try {
      test.bind(view);
      expect(lateReads, 'retired bindings must not supply any more capabilities').to.equal(0);
      expect(test.control.source.count).to.equal(2);
      const slot = test.control.source.itemAt(0);
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal('new-0');
    } finally { test.cleanup(); }
  });
}
