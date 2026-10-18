import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html } from '@open-wc/testing';
import { LyraRetrievalCompare, type RetrievalComparisonSet } from './retrieval-compare.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-retrieval-compare', 'sets'));

function chunk(index: number) {
  return { id: `c${index}`, text: `Result ${index}`, score: 1, source: { id: `s${index}`, name: `Source ${index}` } };
}

it('bounds a thousand admitted empty sets to eight columns and twenty-eight overlap pairs', async () => {
  const el = new LyraRetrievalCompare();
  el.sets = Array.from({ length: 1000 }, (_, index) => ({ id: `set${index}`, label: `Set ${index}`, chunks: [] }));
  const seam = el as unknown as { overlaps: (...args: unknown[]) => unknown[] };
  const original = seam.overlaps.bind(el);
  let pairs = 0;
  // Count the real pair derivation while omitting its enormous pre-fix text DOM from this probe.
  seam.overlaps = (...args) => { const result = original(...args); pairs = result.length; return []; };
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(pairs).to.be.at.most(28);
    expect(el.shadowRoot!.querySelectorAll('[part="set"]').length).to.equal(8);
    recordScaleMeasurement('lr-retrieval-compare', 'n=1000 paged comparison', { pairs, mountedSets: el.shadowRoot!.querySelectorAll('[part="set"]').length });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="last"]')!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('Set 999');
    el.sets = [{ id: 'small', label: 'Small', chunks: [] }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="set-heading"]')?.textContent).to.equal('Small');
  } finally { el.remove(); }
});

it('caps requested top-k at one hundred retained results and discloses the visible subset', async () => {
  const el = await fixture<LyraRetrievalCompare>(html`<lr-retrieval-compare .sets=${[{ id: 'set', label: 'Set', chunks: Array.from({ length: 150 }, (_, index) => chunk(index)) }]} .topK=${1000}></lr-retrieval-compare>`);
  expect(el.shadowRoot!.querySelectorAll('[part~="chunk"]').length).to.equal(100);
  expect(el.shadowRoot!.querySelector('[part="result-limit"]')?.textContent).to.include('100 of 150 retained results');
});

it('does not rebuild ranking or overlap on label, selection or locale-only updates', async () => {
  const sets: RetrievalComparisonSet[] = [{ id: 'a', label: 'A', chunks: [chunk(1)] }, { id: 'b', label: 'B', chunks: [chunk(1), chunk(2)] }];
  const el = await fixture<LyraRetrievalCompare>(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`);
  const seam = el as unknown as { orderedChunks: (set: RetrievalComparisonSet) => unknown[]; overlaps: (...args: unknown[]) => unknown[] };
  let rankings = 0;
  let pairs = 0;
  const ordered = seam.orderedChunks.bind(el);
  const overlaps = seam.overlaps.bind(el);
  seam.orderedChunks = set => { rankings++; return ordered(set); };
  seam.overlaps = (...args) => { pairs++; return overlaps(...args); };
  el.label = 'Other label';
  el.selectedChunkId = 'c1';
  el.strings = { retrievalCompareOverlap: '{left}/{right}: {percent}' };
  await el.updateComplete;
  expect(rankings).to.equal(0);
  expect(pairs).to.equal(0);
  recordScaleMeasurement('lr-retrieval-compare', 'n=2 presentation update', { rankings, pairDerivations: pairs });
  expect(el.shadowRoot!.querySelector('[part="overlap"]')?.textContent).to.include('A/B: 50%');
});

it('preserves selected chunk state and focused set identity across page-changing replacement', async () => {
  const sets = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, label: `Set ${index}`, chunks: [chunk(index)] }));
  const el = await fixture<LyraRetrievalCompare>(html`<lr-retrieval-compare .sets=${sets} selected-chunk-id="c0"></lr-retrieval-compare>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-set-id="s0"] [part~="chunk"]')!);
  el.sets = [...sets.slice(1), sets[0]!];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.closest('[data-set-id]')?.getAttribute('data-set-id')).to.equal('s0');
  expect(el.shadowRoot!.querySelector('[part~="chunk-selected"]')?.getAttribute('data-chunk-id')).to.equal('c0');
});

it('separates input loss from paging and keeps initial notices quiet', async () => {
  const source = Array.from({ length: 10_001 }, (_, index) => ({ id: `s${index}`, label: `Set ${index}`, chunks: [] }));
  const el = await fixture<LyraRetrievalCompare>(html`<lr-retrieval-compare .sets=${source}></lr-retrieval-compare>`);
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Some comparison sets or results were omitted');
  expect(sinkTexts().some(text => text.includes('Some comparison sets or results were omitted'))).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="page-status"]')?.textContent).to.include('1 of 1,250');
  el.strings = { retrievalCompareInputLimit: 'Comparison input omitted' };
  el.sets = source.slice(0, 1);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
  el.sets = source;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.equal('Comparison input omitted');
  expect(sinkTexts()).to.include('Comparison input omitted');
});

it('keeps focus in the comparison when replacement removes a focused pager or its final chunk', async () => {
  const sets = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, label: `Set ${index}`, chunks: [chunk(index)] }));
  const el = await fixture<LyraRetrievalCompare>(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="next"]')!);
  el.sets = [sets[0]!];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-chunk-id')).to.equal('c0');
  el.sets = [];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});


it('moves endpoint pager focus to an enabled control in both directions', async () => {
  const el = await fixture<LyraRetrievalCompare>(html`<lr-retrieval-compare .sets=${Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, label: `Set ${index}`, chunks: [] }))}></lr-retrieval-compare>`);
  for (const action of ['next', 'previous']) {
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)!;
    await focusByKeyboard(button);
    button.click();
    await el.updateComplete;
    const focused = el.shadowRoot!.activeElement as HTMLButtonElement | null;
    expect(focused?.hasAttribute('data-page-action')).to.equal(true);
    expect(focused?.disabled).to.equal(false);
  }
});
