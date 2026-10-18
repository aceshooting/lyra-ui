import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraIndexedView, LyraRangeSource } from '../data-sources.js';
import { SourceWindowController, type SourceWindowOptions } from './source-window-controller.js';

type Row = { key: string; text: string };
type WeightedOptions = Partial<SourceWindowOptions<Row>> & {
  maxWeight?: number; weightOf?: (value: Row, index: number) => number;
};
const row = (index: number, units = 3): Row => ({ key: `key-${index}`, text: 'x'.repeat(units) });
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const hosts: HTMLElement[] = [];
function setup(options: WeightedOptions = {}) {
  const controllers = new Set<ReactiveController>();
  let paints = 0;
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host); hosts.push(host);
  const control = new SourceWindowController<Row>(host, {
    pageSize: 2, maxRows: 6, maxPages: 3, maxConcurrent: 2,
    maxWeight: 12, weightOf: value => value.text.length,
    keyOf: value => value.key, normalize: value => value as Row,
    onChange: () => { paints++; }, ...options,
  });
  const owner = {};
  return { control, host, paints: () => paints,
    bind: (view: LyraIndexedView<Row>, epoch = 0) => control.bind({ owner, revision: 1, epoch, locale: 'en', view }),
    disconnect: () => { host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); },
    reconnect: () => { document.body.append(host); controllers.forEach(controller => controller.hostConnected?.()); },
  };
}
function ranged(reads: number[], units: (index: number) => number = () => 3): LyraRangeSource<Row> {
  return { count: 1_000_000, read: async ({ offset, limit }) => {
    reads.push(offset); return Array.from({ length: limit }, (_, i) => row(offset + i, units(offset + i)));
  } };
}

describe('SourceWindowController optional payload accounting', () => {
  afterEach(() => { for (const host of hosts.splice(0)) host.remove(); });

  it('requires a paired positive safe maximum and callback', () => {
    for (const maxWeight of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => setup({ maxWeight })).to.throw();
    expect(() => setup({ maxWeight: undefined })).to.throw();
    expect(() => setup({ weightOf: undefined })).to.throw();
    expect(() => setup({ weightOf: null as unknown as (value: Row) => number })).to.throw();
    expect(() => setup({ maxWeight: undefined, weightOf: undefined })).not.to.throw();
    expect(() => setup({ maxWeight: Number.MAX_SAFE_INTEGER })).not.to.throw();
  });

  it('rejects invalid row weights without retaining a key and allows zero', async () => {
    for (const indexed of [true, false]) {
      for (const weight of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 13, '3']) {
        const test = setup({ pageSize: 1, weightOf: () => weight as number });
        test.bind(indexed ? { count: 1, itemAt: row } : { count: 1, read: async () => [row(0)] });
        expect(await test.control.ensure(0), `${indexed}/${String(weight)}`).to.equal(false);
        expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
        test.disconnect();
      }
      const test = setup({ pageSize: 1, weightOf: () => 0 });
      test.bind(indexed ? { count: 1, itemAt: row } : { count: 1, read: async () => [row(0)] });
      expect(await test.control.ensure(0)).to.equal(true);
      test.disconnect();
    }
  });

  it('protects an indexed requested interval and retains stable error slots under pressure', async () => {
    const test = setup({ maxWeight: 6 });
    let reads = 0;
    test.bind({ count: 1_000_000, itemAt: index => { reads++; return row(index); } });
    test.control.requestRange(0, 3);
    expect(test.control.source.itemAt(0).state).to.equal('ready');
    expect(test.control.source.itemAt(1).state).to.equal('ready');
    expect(test.control.source.itemAt(2).state).to.equal('error');
    for (let pass = 0; pass < 10; pass++) for (let index = 0; index < 3; index++) test.control.source.itemAt(index);
    expect(reads).to.equal(3);
    expect(test.control.source.indexOfKey!('key-0')).to.equal(0);
    test.control.requestRange(2, 3);
    expect(await test.control.ensure(2)).to.equal(true);
    expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
    expect(reads).to.equal(4);
  });

  it('protects demanded pages across concurrent replies and releases failed staging', async () => {
    const reads: number[] = [];
    const test = setup();
    test.bind(ranged(reads, index => index === 2 || index === 3 ? 4 : 3));
    test.control.requestRange(0, 6);
    await tick();
    expect(reads).to.deep.equal([0, 2, 4]);
    expect(test.control.source.itemAt(0).state).to.equal('ready');
    expect(test.control.source.itemAt(2).state).to.equal('error');
    expect(test.control.source.itemAt(4).state).to.equal('ready');
    for (let pass = 0; pass < 10; pass++) {
      test.control.requestRange(0, 6);
      for (let index = 0; index < 6; index++) test.control.source.itemAt(index);
      await tick();
    }
    expect(reads).to.deep.equal([0, 2, 4]);
    expect(test.paints()).to.be.at.most(3);
    test.control.requestRange(2, 4);
    expect(await test.control.ensure(2)).to.equal(true);
    expect(reads).to.deep.equal([0, 2, 4, 2]);
  });

  it('charges staged normalized rows before reading the next row, evicting only outside demand', async () => {
    const oldPresent: boolean[] = [];
    const test = setup({ pageSize: 3, maxRows: 6, maxPages: 2, maxWeight: 10,
      normalize: (value, index) => {
        if (index >= 3) oldPresent.push(test.control.source.indexOfKey!('key-0') === 0);
        return value as Row;
      },
    });
    const reads: number[] = [];
    test.bind(ranged(reads, index => index < 3 ? 2 : 3));
    expect(await test.control.ensure(0)).to.equal(true);
    expect(await test.control.ensure(3)).to.equal(true);
    expect(oldPresent).to.deep.equal([true, true, false]);
    expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
    expect(test.control.source.indexOfKey!('key-3')).to.equal(3);
  });

  it('rejects an indivisible page atomically and retries the exact boundary', async () => {
    let units = 6;
    let normalized = 0;
    const reads: number[] = [];
    const test = setup({ maxWeight: 10, normalize: value => { normalized++; return value as Row; } });
    test.bind(ranged(reads, () => units));
    expect(await test.control.ensure(0)).to.equal(false);
    expect(normalized).to.equal(2);
    expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
    units = 5;
    expect(await test.control.ensure(0)).to.equal(true);
    expect(test.control.source.indexOfKey!('key-1')).to.equal(1);
    expect(reads).to.deep.equal([0, 0]);
  });

  it('releases partial staging after a callback throws and on explicit retry', async () => {
    let fail = true;
    const test = setup({ maxWeight: 6, weightOf: (value, index) => {
      if (fail && index === 1) throw new TypeError('Invalid value');
      return value.text.length;
    } });
    test.bind(ranged([]));
    expect(await test.control.ensure(0)).to.equal(false);
    fail = false;
    expect(await test.control.ensure(0)).to.equal(true);
    expect(test.control.source.itemAt(1).state).to.equal('ready');
  });

  it('releases cached and staged reservations on replacement, disconnect and adoption', async () => {
    for (const boundary of ['replace', 'disconnect', 'adopt']) {
      const test = setup({ maxWeight: 6 });
      test.bind(ranged([]));
      expect(await test.control.ensure(0)).to.equal(true);
      if (boundary === 'replace') test.bind(ranged([]), 1);
      if (boundary === 'disconnect') { test.disconnect(); test.reconnect(); }
      if (boundary === 'adopt') {
        const frame = document.createElement('iframe'); document.body.append(frame);
        frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(test.host));
        test.control.adopted();
        document.body.append(document.adoptNode(test.host)); test.control.adopted(); frame.remove();
      }
      expect(await test.control.ensure(4)).to.equal(true);
      expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
      test.disconnect();
    }
  });

  it('does not commit or evict replacement authority from any normalization callback', async () => {
    for (const indexed of [true, false]) for (const hook of ['normalize', 'keyOf', 'weightOf']) {
      let armed = true;
      const replace = () => {
        if (!armed) return;
        armed = false;
        test.bind({ count: 1, itemAt: () => ({ key: 'replacement', text: '123456' }) }, 1);
        expect(test.control.source.itemAt(0).state).to.equal('ready');
      };
      const test = setup({ maxWeight: 6,
        normalize: value => { if (hook === 'normalize') replace(); return value as Row; },
        keyOf: value => { if (hook === 'keyOf') replace(); return value.key; },
        weightOf: value => { if (hook === 'weightOf') replace(); return value.text.length; },
      });
      test.bind(indexed ? { count: 2, itemAt: row } : ranged([]));
      expect(await test.control.ensure(0)).to.equal(false);
      const slot = test.control.source.itemAt(0);
      expect(slot.state).to.equal('ready');
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal('replacement');
      expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
      test.disconnect();
    }
  });

  it('cannot commit an old row after a weight callback changes same-binding demand', async () => {
    for (const indexed of [true, false]) {
      let armed = true;
      const test = setup({ maxWeight: 6, weightOf: (value, index) => {
        if (armed && index === 0) { armed = false; test.control.requestRange(4, 6); }
        return value.text.length;
      } });
      test.bind(indexed ? { count: 10, itemAt: index => row(index) } : ranged([]));
      expect(await test.control.ensure(0)).to.equal(false);
      expect(await test.control.ensure(4)).to.equal(true);
      expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
      test.disconnect();
    }
  });

  it('permits reentrant cached reads without treating them as a new viewport', async () => {
    const test = setup({ weightOf: (value, index) => {
      if (index === 2) expect(test.control.source.itemAt(0).state).to.equal('ready');
      return value.text.length;
    } });
    test.bind(ranged([]));
    test.control.requestRange(0, 4); await tick();
    expect(test.control.source.itemAt(2).state).to.equal('ready');
    expect(test.control.source.indexOfKey!('key-0')).to.equal(0);
    expect(test.control.source.indexOfKey!('key-3')).to.equal(3);
  });

  it('releases partial staging before a replacement callback admits its own full budget', async () => {
    let armed = true;
    const test = setup({ maxWeight: 6, weightOf: (value, index) => {
      if (armed && index === 1) {
        armed = false;
        test.bind({ count: 1, itemAt: () => ({ key: 'replacement', text: '123456' }) }, 1);
        expect(test.control.source.itemAt(0).state).to.equal('ready');
      }
      return value.text.length;
    } });
    test.bind(ranged([]));
    expect(await test.control.ensure(0)).to.equal(false);
    const slot = test.control.source.itemAt(0);
    expect(slot.state === 'ready' ? slot.value.key : '').to.equal('replacement');
    test.bind({ count: 2, itemAt: index => row(index) }, 2);
    test.control.requestRange(0, 2);
    expect(test.control.source.itemAt(0).state).to.equal('ready');
    expect(test.control.source.itemAt(1).state).to.equal('ready');
  });

  it('retains a bounded own error instead of a callback exception payload', async () => {
    const failure = { retainedPayload: 'provider-owned failure' };
    for (const indexed of [true, false]) {
      const test = setup({ weightOf: () => { throw failure; } });
      test.bind(indexed ? { count: 2, itemAt: row } : ranged([]));
      expect(await test.control.ensure(0)).to.equal(false);
      const slot = test.control.source.itemAt(0);
      expect(slot.state).to.equal('error');
      expect(slot.state === 'error' && slot.error === failure).to.equal(false);
      test.disconnect();
    }
  });

  for (const changed of [false, true]) for (const triggerIndex of [0, 1]) {
    it(`preserves valid admission after ${changed ? 'overlapping' : 'identical'} demand during row ${triggerIndex}`, async () => {
      let armed = true;
      const reads: number[] = [];
      const test = setup({ maxConcurrent: 1, maxWeight: 6, weightOf: (value, index) => {
        if (armed && index === triggerIndex) {
          armed = false;
          test.control.requestRange(changed ? 1 : 0, 2);
          expect(reads).to.deep.equal([0]);
        }
        return value.text.length;
      } });
      test.bind(ranged(reads));
      test.control.requestRange(0, 2);
      const pending = test.control.ensure(1);
      await tick();
      expect(test.control.source.itemAt(1).state).to.equal('ready');
      expect(await pending).to.equal(true);
      expect(test.control.source.indexOfKey!('key-0')).to.equal(0);
      expect(test.control.source.indexOfKey!('key-1')).to.equal(1);
      expect(reads).to.deep.equal(changed ? [0, 0] : [0]);
      for (let pass = 0; pass < 10; pass++) {
        test.control.requestRange(changed ? 1 : 0, 2);
        expect(test.control.source.itemAt(1).state).to.equal('ready');
        await tick();
      }
      expect(reads).to.deep.equal(changed ? [0, 0] : [0]);
    });
  }

  it('preserves unweighted cache behavior and never calls a missing weight callback', async () => {
    const reads: number[] = [];
    const test = setup({ maxWeight: undefined, weightOf: undefined });
    test.bind(ranged(reads, () => 100));
    test.control.requestRange(0, 6); await tick();
    for (let index = 0; index < 6; index++) expect(test.control.source.itemAt(index).state).to.equal('ready');
    expect(reads).to.deep.equal([0, 2, 4]);
  });
});
