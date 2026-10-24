import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraIndexedView } from '../data-sources.js';
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
