import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import './funnel.js';
import type { LyraFunnel } from './funnel.js';

function countingStages(length: number, entry: (index: number) => unknown): { input: unknown[]; reads: () => number } {
  let reads = 0;
  const input = new Proxy(new Array(length), {
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        reads++;
        const value = entry(Number(key));
        return value === undefined ? undefined : { value, writable: true, enumerable: true, configurable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) throw new Error('indexed get is never used');
      return Reflect.get(target, key, receiver);
    },
  });
  return { input, reads: () => reads };
}

it('admits only the leading 10,000 positions of a million-position source and reports the bound', async () => {
  const { input, reads } = countingStages(1_000_000, index =>
    index === 0 ? { label: 'Head stage', value: 100 } : index === 999_999 ? { label: 'Tail stage', value: 50 } : null);
  const el = await fixture<LyraFunnel>(html`<lr-funnel></lr-funnel>`);
  expectDevWarning('lyra-collection-truncated:lr-funnel:stages');
  el.stages = input as never;
  await el.updateComplete;
  expect(reads()).to.be.at.most(10_000);
  const labels = [...el.shadowRoot!.querySelectorAll('[part="stage-label"]')].map(node => node.textContent);
  expect(labels).to.deep.equal(['Head stage']);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-busy')).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Showing the first 10,000 of 1,000,000 stages.');
  recordScaleMeasurement('lr-funnel', 'n=1000000 bounded admission', { inspected: reads(), rendered: labels.length });
});

it('renders an admitted series synchronously without leaving work scheduled after replacement', async () => {
  const { input, reads } = countingStages(5_000, () => null);
  const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${[{ label: 'Current', value: 10 }]}></lr-funnel>`);
  el.stages = input as never;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  el.stages = [{ label: 'Replacement', value: 5 }];
  await el.updateComplete;
  const settled = reads();
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(reads()).to.equal(settled);
  expect(el.shadowRoot!.textContent).to.include('Replacement');
});

it('never invokes an indexed accessor of a caller array', async () => {
  const stages = [{ label: 'Visited', value: 10 }, null] as unknown[];
  let accessorReads = 0;
  Object.defineProperty(stages, 1, { get() { accessorReads++; return { label: 'Accessor', value: 1 }; }, enumerable: true });
  const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${stages as never}></lr-funnel>`);
  expect(accessorReads).to.equal(0);
  expect([...el.shadowRoot!.querySelectorAll('[part="stage-label"]')].map(node => node.textContent)).to.deep.equal(['Visited']);
});
