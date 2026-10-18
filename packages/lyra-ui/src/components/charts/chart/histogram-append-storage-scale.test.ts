import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, waitUntil } from '@open-wc/testing';
import './histogram.js';

it('reads only the retained newest finite tail of a million-sample append', () => {
  let reads = 0;
  const input = new Proxy(new Array<number>(1_000_000), {
    has(target, key) { return typeof key === 'string' && /^\d+$/.test(key) ? true : Reflect.has(target, key); },
    get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return Number(key); } return Reflect.get(target, key, receiver); },
  });
  const el = document.createElement('lr-histogram');
  el.appendSamples(input);
  expect(reads).to.be.at.most(10_000);
  recordScaleMeasurement('lr-histogram', 'n=1000000 finite append tail', { reads, retained: el.values.length });
  expect(el.values.length).to.equal(10_000);
  expect(el.values[0]).to.equal(990_000);
  expect(el.values.at(-1)).to.equal(999_999);
});

it('keeps finite append ordering and the earlier window without retaining invalid values', () => {
  const el = document.createElement('lr-histogram'); el.values = [1, 2, 3];
  el.appendSamples([null, NaN, 4, Infinity, 5], 4);
  expect(el.values).to.deep.equal([2, 3, 4, 5]);
  el.appendSamples([NaN, null], 3);
  expect(el.values).to.deep.equal([3, 4, 5]);
});

it('yields an invalid-heavy million-sample append without losing its early finite survivor', async () => {
  let reads = 0;
  const input = new Proxy(new Array<number>(1_000_000), {
    get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return key === '0' ? 7 : NaN; } return Reflect.get(target, key, receiver); },
  });
  const el = document.createElement('lr-histogram'); el.values = [1];
  el.appendSamples(input, 3);
  expect(reads).to.be.at.most(10_000);
  expect(el.values).to.deep.equal([1]);
  el.appendSamples([8], 3);
  await waitUntil(() => el.values.at(-1) === 8, 'queued append lost its ordering', { timeout: 5000 });
  expect(el.values).to.deep.equal([1, 7, 8]);
  expect(reads).to.equal(1_000_000);
});

it('revokes unfinished appends on a later values assignment or disconnect', async () => {
  for (const disconnect of [false, true]) {
    let reads = 0;
    const input = new Proxy(new Array<number>(1_000_000), {
      get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return key === '0' ? 7 : NaN; } return Reflect.get(target, key, receiver); },
    });
    const el = document.createElement('lr-histogram');
    el.values = [1]; el.appendSamples(input);
    if (disconnect) el.disconnectedCallback(); else el.values = [9];
    const stopped = reads;
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(reads).to.equal(stopped);
    expect(el.values).to.deep.equal(disconnect ? [1] : [9]);
  }
});

for (const throwingIndex of [20_000, 10_000]) {
  it(`continues queued appends after an unreadable entry at reverse index ${throwingIndex}`, async () => {
    const failure = new Error('Unreadable histogram sample');
    const onError = (event: ErrorEvent) => { if (event.error === failure) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener('error', onError, true);
    const input = new Proxy(new Array<number>(20_001), {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) {
          if (Number(key) === throwingIndex) throw failure;
          return key === '0' ? 7 : NaN;
        }
        return Reflect.get(target, key, receiver);
      },
    });
    const el = document.createElement('lr-histogram'); el.values = [1];
    try {
      try { el.appendSamples(input, 3); } catch (error) { if (error !== failure) throw error; }
      el.appendSamples([8], 3);
      await waitUntil(() => el.values.at(-1) === 8, 'unreadable input poisoned the append queue', { timeout: 4000 });
      expect(el.values).to.deep.equal([1, 7, 8]);
    } finally { el.disconnectedCallback(); window.removeEventListener('error', onError, true); }
  });
}
