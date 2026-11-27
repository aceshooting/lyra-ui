import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { eligibleTransferIds, normalizeTransfers, sampleTransfers, totalTransferMetrics, transferMetrics,
  type LyraTransfer, type LyraTransferStatus } from './transfer-manager-metrics.js';

const statuses = ['queued', 'active', 'paused', 'done', 'error', 'cancelled'] as const;
const status = fc.constantFrom(...statuses);
const counter = fc.oneof(fc.double(), fc.constantFrom(NaN, Infinity, -Infinity, Number.MAX_VALUE));
const row = fc.record({ id: fc.constantFrom('a', 'b', 'c', '', '__proto__'), name: fc.constant('File'),
  status, bytesDone: counter, bytesTotal: fc.option(counter, { nil: undefined }) });
const active = (bytesDone: number, bytesTotal?: number): LyraTransfer => ({ id: 'one', name: 'File', status: 'active', bytesDone, bytesTotal });

describe('transfer metrics', () => {
  it('keeps the first accepted identity, bounds byte counts and propagates unknown totals', () => {
    fc.assert(fc.property(fc.array(row), input => {
      const rows = normalizeTransfers(input);
      expect(rows.map(item => item.id)).to.deep.equal([...new Set(input.filter(item => item.id).map(item => item.id))]);
      expect(Object.isFrozen(rows)).to.equal(true);
      for (const item of rows) {
        expect(Object.isFrozen(item)).to.equal(true);
        expect(Number.isSafeInteger(item.bytesDone) && item.bytesDone >= 0).to.equal(true);
        if (item.bytesTotal !== undefined) expect(item.bytesDone <= item.bytesTotal).to.equal(true);
      }
      const totals = totalTransferMetrics(rows, new Map());
      expect(totals.bytesDone).to.equal(rows.reduce((sum, item) => sum + item.bytesDone, 0));
      if (rows.some(item => item.bytesTotal === undefined)) {
        expect(totals.bytesTotal).to.equal(undefined);
        expect(totals.progress).to.equal(undefined);
        expect(totals.etaSeconds).to.equal(undefined);
      } else {
        expect(totals.progress).to.be.within(0, 100);
      }
    }), propertyRuns());
  });

  it('copies counters without invoking accessors or letting a malformed duplicate reserve its ID', () => {
    const original = active(5, 10);
    let accesses = 0;
    const hostile = Object.defineProperty({ ...original }, 'name', { get() { accesses++; return 'Ignored accessor'; } });
    const rows = normalizeTransfers([hostile, original]);
    Object.assign(original, { bytesDone: 10 });
    expect(rows.map(item => item.bytesDone)).to.deep.equal([5]);
    expect(accesses).to.equal(0);
    expect(normalizeTransfers([null, { ...original, status: 'invalid' }])).to.deep.equal([]);
  });

  it('includes offscreen and late entries in bulk requests and aggregate counts', () => {
    const rows = normalizeTransfers(Array.from({ length: 10005 }, (_, i) =>
      ({ ...active(1, 2), id: String(i), status: i === 10004 ? 'paused' : 'done' })));
    expect(eligibleTransferIds(rows, 'resume')).to.deep.equal(['10004']);
    expect(totalTransferMetrics(rows, new Map()).bytesDone).to.equal(10005);
  });

  it('walks present transfer indices in order even across very large sparse gaps', () => {
    const rows: LyraTransfer[] = [];
    rows[2 ** 31] = { ...active(3), id: 'later' };
    rows[4] = { ...active(2), id: 'earlier' };
    expect(eligibleTransferIds(normalizeTransfers(rows), 'pause')).to.deep.equal(['earlier', 'later']);
  });

  it('rates use elapsed time and ETA uses remaining bytes for each known-size transfer', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1000000 }), fc.integer({ min: 1, max: 60000 }), (delta, ms) => {
      const initial = sampleTransfers([active(0)], new Map(), 0);
      const item = active(delta, delta * 3);
      const samples = sampleTransfers([item], initial, ms);
      const measured = transferMetrics(item, samples.get(item.id));
      expect(measured.bytesPerSecond).to.equal(delta * 1000 / ms);
      expect(measured.etaSeconds).to.equal(Math.ceil(2 * delta / measured.bytesPerSecond!));
      const unknown = active(delta);
      expect(transferMetrics(unknown, samples.get(item.id)).etaSeconds).to.equal(undefined);
      expect(totalTransferMetrics([item], samples)).to.deep.equal(measured);
    }), propertyRuns());
  });

  it('smooths changes in rate independently of the sample cadence', () => {
    const seed = sampleTransfers([active(1000)], sampleTransfers([active(0)], new Map(), 0), 1000);
    const split = sampleTransfers([active(1200)], sampleTransfers([active(1100)], seed, 2000), 3000);
    const single = sampleTransfers([active(1200)], seed, 3000);
    const rate = single.get('one')!.bytesPerSecond!;
    expect(rate).to.be.within(101, 999);
    expect(split.get('one')!.bytesPerSecond).to.be.closeTo(rate, 1e-9);
  });

  it('restarts estimates on pause, completion, failure, retry, removal and counter or clock rollback', () => {
    const previous = sampleTransfers([active(1000)], sampleTransfers([active(0)], new Map(), 0), 1000);
    for (const state of statuses.filter(value => value !== 'active')) {
      const row = { ...active(1000), status: state };
      const held = sampleTransfers([row], previous, 3000);
      expect(transferMetrics(row, held.get('one')).bytesPerSecond).to.equal(undefined);
      expect(sampleTransfers([active(1000)], held, 5000).get('one')!.bytesPerSecond).to.equal(undefined);
    }
    expect(sampleTransfers([], previous, 3000).size).to.equal(0);
    expect(sampleTransfers([active(1)], previous, 2000).get('one')!.bytesPerSecond).to.equal(undefined);
    expect(sampleTransfers([active(1000)], previous, 999).get('one')!.bytesPerSecond).to.equal(undefined);
    expect(sampleTransfers([active(1000)], previous, NaN).size).to.equal(0);
    const sameTime = sampleTransfers([active(1200)], previous, 1000);
    expect(sameTime.get('one')).to.equal(previous.get('one'));
  });

  it('distinguishes known empty transfers from unknown sizes and sums active rates', () => {
    expect(transferMetrics({ ...active(0, 0), status: 'done' }).progress).to.equal(100);
    expect(transferMetrics({ ...active(0, 0), status: 'queued' }).progress).to.equal(0);
    const rows = [active(100, 400), { ...active(200, 600), id: 'two' }];
    const initial = sampleTransfers(rows.map(item => ({ ...item, bytesDone: 0 })), new Map(), 0);
    const samples = sampleTransfers(rows, initial, 1000);
    expect(totalTransferMetrics(rows, samples)).to.deep.equal({
      bytesDone: 300, bytesTotal: 1000, progress: 30, bytesPerSecond: 300, etaSeconds: 3,
    });
    expect(transferMetrics(rows[0]!, initial.get('one')).etaSeconds).to.equal(undefined);
  });

  it('returns exactly the eligible IDs in host order for each bulk action', () => {
    const expected: Record<string, readonly LyraTransferStatus[]> = {
      pause: ['active', 'queued'], resume: ['paused'], cancel: ['queued', 'active', 'paused'], retry: ['error', 'cancelled'],
    };
    fc.assert(fc.property(fc.array(status), states => {
      const rows = states.map((state, index) => ({ ...active(0), status: state, id: String(index) }));
      for (const action of ['pause', 'resume', 'cancel', 'retry'] as const) {
        const ids = eligibleTransferIds(rows, action);
        expect(ids).to.deep.equal(rows.filter(item => expected[action]!.includes(item.status)).map(item => item.id));
        expect(Object.isFrozen(ids)).to.equal(true);
      }
    }), propertyRuns());
  });
});
