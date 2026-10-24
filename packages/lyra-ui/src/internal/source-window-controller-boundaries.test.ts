import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraIndexedView } from '../data-sources.js';
import { SourceWindowController, type SourceWindowOptions } from './source-window-controller.js';

type Row = { key: string };
function setup(options: Partial<SourceWindowOptions<Row>> = {}) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new SourceWindowController<Row>(host, {
    pageSize: 1, maxRows: 3, maxPages: 3, maxConcurrent: 1,
    normalize: value => {
      if (!value || typeof value !== 'object' || !('key' in value) || typeof value.key !== 'string') throw new TypeError('Invalid row');
      return { key: value.key };
    }, keyOf: value => value.key, onChange: () => {}, ...options,
  });
  const owner = {};
  return { control, host,
    bind: (view: LyraIndexedView<Row>) => control.bind({ owner, revision: 1, epoch: 0, locale: 'en', view }),
    cleanup: () => { host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); },
  };
}

describe('source window provider boundaries', () => {
  it('rejects ambiguous or absent access modes and clears previously admitted rows', () => {
    const test = setup();
    try {
      for (const ambiguous of [false, true]) {
        test.bind({ count: 1, itemAt: () => ({ key: 'original' }) });
        expect(test.control.source.itemAt(0).state).to.equal('ready');
        const candidate = { count: 1, itemAt: () => ({ key: 'invalid' }) };
        Reflect.set(candidate, ambiguous ? 'read' : 'itemAt', ambiguous ? () => [] : undefined);
        expect(() => test.bind(candidate)).to.throw('Source must provide indexed or ranged access');
        expect(test.control.source.count).to.equal(0);
        expect(test.control.source.indexOfKey!('original')).to.equal(-1);
      }
    } finally { test.cleanup(); }
  });

  it('retains a replacement bound from metadata access even when the abandoned count is invalid', () => {
    const test = setup();
    try {
      for (const count of [1, -1]) {
        const candidate = { get count() {
          test.bind({ count: 2, itemAt: index => ({ key: `replacement-${index}` }) });
          return count;
        }, itemAt: () => ({ key: 'obsolete' }) };
        if (count < 0) expect(() => test.bind(candidate)).to.throw(RangeError);
        else test.bind(candidate);
        expect(test.control.source.count).to.equal(2);
        const slot = test.control.source.itemAt(1);
        expect(slot.state === 'ready' ? slot.value.key : '').to.equal('replacement-1');
        expect(test.control.source.indexOfKey!('obsolete')).to.equal(-1);
      }
    } finally { test.cleanup(); }
  });

  it('settles a queued lookup if the host is removed before provider dispatch', async () => {
    const test = setup(); let lookups = 0;
    test.bind({ count: 1, itemAt: () => ({ key: 'row' }), indexOfKey: () => { lookups++; return 0; } });
    try {
      const result = test.control.resolveKey('row');
      test.host.remove();
      expect(await result).to.equal(null);
      expect(lookups).to.equal(0);
      expect(await test.control.ensure(0)).to.equal(false);
    } finally { test.cleanup(); }
  });

  it('discards row normalization when a key callback replaces the source', () => {
    const test = setup(); let replacement = false;
    try {
      test.bind({ count: 1, itemAt: () => ({ key: 'old' }), keyAt: () => {
        if (!replacement) {
          replacement = true;
          test.bind({ count: 1, itemAt: () => ({ key: 'new' }) });
        }
        return 'old';
      } });
      expect(test.control.source.itemAt(0).state).to.equal('loading');
      const slot = test.control.source.itemAt(0);
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal('new');
      expect(test.control.source.keyAt!(0)).to.equal('new');
      expect(test.control.source.indexOfKey!('old')).to.equal(-1);
    } finally { test.cleanup(); }
  });

  it('reports key mismatches and throwing synchronous lookups without publishing false identity', async () => {
    const test = setup();
    try {
      test.bind({ count: 1, itemAt: () => ({ key: 'row' }), keyAt: () => 'other',
        indexOfKey: () => { throw new Error('Unavailable index'); } });
      expect(await test.control.ensure(0)).to.equal(false);
      expect(test.control.source.itemAt(0).state).to.equal('error');
      expect(test.control.source.indexOfKey!('row')).to.equal(-1);
      expect(await test.control.resolveKey('row')).to.equal(null);
    } finally { test.cleanup(); }
  });

  it('rejects duplicate identities across completed pages while retaining the original page', async () => {
    const test = setup();
    try {
      test.bind({ count: 2, read: async () => [{ key: 'same' }] });
      expect(await test.control.ensure(0)).to.equal(true);
      expect(await test.control.ensure(1)).to.equal(false);
      expect(test.control.source.itemAt(0).state).to.equal('ready');
      expect(test.control.source.itemAt(1).state).to.equal('error');
      expect(test.control.source.indexOfKey!('same')).to.equal(0);
      expect(test.control.source.keyAt!(1)).to.equal(1);
    } finally { test.cleanup(); }
  });

  it('protects demanded indexed rows when their combined keys fill the cache budget', () => {
    const test = setup({ maxRows: 32, maxWeight: 32, weightOf: () => 1 });
    const key = (index: number) => String(index).padEnd(65_536, 'x');
    try {
      test.bind({ count: 32, itemAt: index => ({ key: key(index) }) });
      test.control.requestRange(0, 32);
      for (let index = 0; index < 30; index++) expect(test.control.source.itemAt(index).state).to.equal('ready');
      expect(test.control.source.itemAt(30).state).to.equal('error');
      expect(test.control.source.indexOfKey!(key(0))).to.equal(0);
      expect(test.control.source.indexOfKey!(key(29))).to.equal(29);
      expect(test.control.source.indexOfKey!(key(30))).to.equal(-1);
    } finally { test.cleanup(); }
  });

  it('rejects a complete range that would evict another demanded page for key storage', async () => {
    const test = setup({ pageSize: 16, maxRows: 32, maxPages: 2, maxWeight: 32, weightOf: () => 1 });
    const key = (index: number) => String(index).padEnd(65_536, 'x');
    try {
      test.bind({ count: 32, read: async ({ offset, limit }) => Array.from({ length: limit }, (_, index) => ({ key: key(offset + index) })) });
      test.control.requestRange(0, 32);
      expect(await test.control.ensure(0)).to.equal(true);
      expect(await test.control.ensure(16)).to.equal(false);
      expect(test.control.source.itemAt(0).state).to.equal('ready');
      expect(test.control.source.itemAt(16).state).to.equal('error');
      expect(test.control.source.indexOfKey!(key(15))).to.equal(15);
      expect(test.control.source.indexOfKey!(key(16))).to.equal(-1);
    } finally { test.cleanup(); }
  });
});
