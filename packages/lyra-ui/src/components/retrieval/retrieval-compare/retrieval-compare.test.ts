import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { RetrievalChunk } from '../../../ai/types.js';
import './retrieval-compare.js';
import type { LyraRetrievalCompare, RetrievalComparisonSet } from './retrieval-compare.js';

function chunk(id: string, score: number, rank?: number): RetrievalChunk {
  return {
    id,
    text: `Text for ${id}`,
    score,
    rank,
    source: { id: `source-${id}`, name: `Source ${id}` },
    scores: { dense: score - 0.1, sparse: score - 0.2, final: score },
  };
}

const sets: RetrievalComparisonSet[] = [
  { id: 'baseline', label: 'Baseline', chunks: [chunk('a', 0.8, 2), chunk('b', 0.9, 1)] },
  { id: 'reranked', label: 'Reranked', chunks: [chunk('a', 0.95, 1), chunk('c', 0.7, 2)] },
];

it('sorts explicit ranks, reports overlap, and shows score breakdowns', async () => {
  const el = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  const firstColumn = el.shadowRoot!.querySelector('[part="set"]')!;
  expect(firstColumn.querySelector('[part="chunk-title"]')!.textContent).to.contain('Source b');
  expect(el.shadowRoot!.querySelector('[part="overlap"]')!.textContent).to.contain('33');
  expect(el.shadowRoot!.textContent).to.contain('Dense');
  expect(el.shadowRoot!.textContent).to.contain('Sparse');
});

it('uses the chunk score as the final breakdown when optional score details are absent', async () => {
  const bareChunk: RetrievalChunk = {
    id: 'bare',
    text: 'No provider breakdown',
    score: 0.75,
    source: { id: 'source-bare', name: 'Bare source' },
  };
  const el = await fixture<LyraRetrievalCompare>(html`
    <lr-retrieval-compare
      .sets=${[{ id: 'bare-set', label: 'Bare results', chunks: [bareChunk] }]}
    ></lr-retrieval-compare>
  `);
  const scores = el.shadowRoot!.querySelector('[part="scores"]')!;

  expect(scores.querySelectorAll('[part="score"]')).to.have.lengthOf(1);
  expect(scores.textContent).to.contain('Final');
  expect(scores.textContent).to.contain('75%');
});

it('omits valid-id chunks whose nested source record is malformed', async () => {
  const el = (await fixture(html`
    <lr-retrieval-compare
      .sets=${[
        {
          id: 'mixed',
          label: 'Mixed',
          chunks: [
            { id: 'missing-source', text: 'bad', score: 0.8 },
            chunk('valid', 0.7),
          ],
        },
      ]}
    ></lr-retrieval-compare>
  `)) as LyraRetrievalCompare;

  expect(el.shadowRoot!.querySelectorAll('[part="chunk"]')).to.have.length(1);
  expect(el.shadowRoot!.textContent).to.contain('Source valid');
  expect(el.shadowRoot!.textContent).to.not.contain('missing-source');
});

it('honors top-k and emits the full selected set/chunk pair', async () => {
  const el = (await fixture(html`<lr-retrieval-compare .sets=${sets} top-k="1"></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelectorAll('[part="chunk"]').length).to.equal(2);
  const pending = oneEvent(el, 'lr-chunk-select');
  (el.shadowRoot!.querySelector('[part="chunk"]') as HTMLButtonElement).click();
  expect((await pending).detail).to.deep.equal({ setId: 'baseline', chunk: sets[0]!.chunks[1] });
});

it('renders a localized empty state and remains accessible at populated state', async () => {
  const empty = (await fixture(
    html`<lr-retrieval-compare
      .strings=${{ retrievalCompareEmpty: 'Aucun résultat à comparer' }}
    ></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  expect(empty.shadowRoot!.querySelector('lr-empty')?.getAttribute('heading')).to.equal(
    'Aucun résultat à comparer',
  );
  const populated = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  await expect(populated).shadowDom.to.be.accessible();
});

it('applies per-instance strings to the comparison region label', async () => {
  const el = (await fixture(html`<lr-retrieval-compare
    .strings=${{ retrievalCompareLabel: 'Localized retrieval comparison' }}
  ></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Localized retrieval comparison',
  );
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  expect(el.label).to.equal(undefined);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Retrieval comparison',
  );

  el.label = '';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('keeps exactly one comparison owner across explicit-empty and dynamic host naming', async () => {
  const el = (await fixture(html`
    <lr-retrieval-compare aria-label="Author comparison" label="Result comparison" .sets=${sets}></lr-retrieval-compare>
  `)) as LyraRetrievalCompare;
  const region = () => el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Author comparison');
  expect(region().getAttribute('aria-label')).to.equal(null);
  expect(region().getAttribute('role')).to.equal(null);
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(region().getAttribute('aria-label')).to.equal('');
  expect(region().getAttribute('role')).to.equal('region');
  el.setAttribute('aria-label', 'Revised comparison');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised comparison');
  expect(region().getAttribute('aria-label')).to.equal(null);
  expect(region().getAttribute('role')).to.equal(null);
});

it('uses instance-safe heading ids instead of caller set ids', async () => {
  const hostileSets: RetrievalComparisonSet[] = [
    { id: 'same id', label: 'First', chunks: [chunk('a', 0.8)] },
    { id: 'same id', label: 'Second', chunks: [chunk('b', 0.7)] },
  ];
  const first = (await fixture(
    html`<lr-retrieval-compare .sets=${hostileSets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  const second = (await fixture(
    html`<lr-retrieval-compare .sets=${hostileSets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  const headings = [
    ...first.shadowRoot!.querySelectorAll('[part="set-heading"]'),
    ...second.shadowRoot!.querySelectorAll('[part="set-heading"]'),
  ];
  const ids = headings.map((heading) => heading.id);
  expect(new Set(ids).size).to.equal(2);
  expect(ids.some((id) => id.includes('same id'))).to.be.false;
  for (const set of first.shadowRoot!.querySelectorAll('[part="set"]')) {
    expect(set.getAttribute('aria-labelledby')).to.equal(
      set.querySelector('[part="set-heading"]')!.id,
    );
  }
});

it('formats ranks with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-retrieval-compare lang="ar-u-nu-arab" .sets=${sets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelector('[part="chunk-rank"]')!.textContent).to.contain('١');
});

it('lets the localized overlap template compose caller-supplied set labels', async () => {
  const el = (await fixture(
    html`<lr-retrieval-compare
      .sets=${sets}
      .strings=${{ retrievalCompareOverlap: 'Comparison: {right} / {left} ({percent})' }}
    ></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  expect(el.shadowRoot!.querySelector('[part="overlap"]')!.textContent).to.equal(
    'Comparison: Reranked / Baseline (33.3%)',
  );
});

it('renders a labeled overlap summary for every pair of result sets', async () => {
  const threeSets: RetrievalComparisonSet[] = [
    ...sets,
    { id: 'hybrid', label: 'Hybrid', chunks: [chunk('a', 0.9), chunk('d', 0.6)] },
  ];
  const el = (await fixture(
    html`<lr-retrieval-compare .sets=${threeSets}></lr-retrieval-compare>`,
  )) as LyraRetrievalCompare;
  const summaries = [...el.shadowRoot!.querySelectorAll('[part="overlap"]')];
  expect(summaries.length).to.equal(3);
  expect(summaries.map((summary) => summary.textContent)).to.deep.include.members([
    'Top-k overlap between Baseline and Reranked: 33.3%',
    'Top-k overlap between Baseline and Hybrid: 33.3%',
    'Top-k overlap between Reranked and Hybrid: 33.3%',
  ]);
});

it('scrolls the sets row only on the inline axis and never clips a taller comparison-set column', async () => {
  const el = (await fixture(html`<lr-retrieval-compare .sets=${sets}></lr-retrieval-compare>`)) as LyraRetrievalCompare;
  const setsRow = el.shadowRoot!.querySelector('[part="sets"]') as HTMLElement;
  const style = getComputedStyle(setsRow);
  expect(style.overflowX).to.equal('auto');
  // `overflow-y` is authored as `visible` (never `hidden`/`clip`) so a "set" column with extra
  // chunks is never clipped at the row boundary. The CSS Overflow spec's cross-axis rule then
  // force-computes that `visible` to `auto` because `overflow-x` is a scrolling value on the same
  // box (https://www.w3.org/TR/css-overflow-3/#overflow-control) -- `auto` still never clips
  // content, it only becomes technically scrollable if the row's intrinsic block size is ever
  // exceeded, which is the same non-clipping guarantee `visible` gives.
  expect(style.overflowY).to.equal('auto');
  expect(style.overflowY).not.to.equal('hidden');
  expect(style.overflowY).not.to.equal('clip');
});

it('omits blank and later duplicate set and nested chunk ids before overlap, rendering, and actions', async () => {
  const firstChunk = chunk('chunk-1', 0.8);
  const firstSet: RetrievalComparisonSet = {
    id: 'set-1',
    label: 'First set',
    chunks: [
      { ...firstChunk, id: '' },
      firstChunk,
      { ...firstChunk, text: 'Later duplicate' },
    ],
  };
  const el = (await fixture(html`
    <lr-retrieval-compare
      .sets=${[
        { ...firstSet, id: ' ' },
        firstSet,
        { ...firstSet, label: 'Later set' },
      ]}
    ></lr-retrieval-compare>
  `)) as LyraRetrievalCompare;

  expect(el.shadowRoot!.querySelectorAll('[part="set"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part~="chunk"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="overlap"]') === null).to.be.true;
  expect(
    el.shadowRoot!.querySelector('[part="set-heading"]')!.textContent
  ).to.equal(firstSet.label);

  const selected = oneEvent(el, 'lr-chunk-select');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="chunk"]')!.click();
  expect((await selected).detail).to.deep.equal({
    setId: firstSet.id,
    chunk: firstChunk,
  });
});

describe('chunk-selected cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraRetrievalCompare, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('recolors the selected chunk border from --lr-retrieval-compare-selected-border set on the host', async () => {
    const el = (await fixture(
      html`<lr-retrieval-compare
        style="--lr-retrieval-compare-selected-border: rgb(0, 51, 102)"
        .sets=${sets}
        selected-chunk-id="b"
      ></lr-retrieval-compare>`,
    )) as LyraRetrievalCompare;
    const selectedChunk = el.shadowRoot!.querySelector('[part~="chunk-selected"]') as HTMLElement;
    expect(getComputedStyle(selectedChunk).borderTopColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the brand token when unset', async () => {
    const el = (await fixture(
      html`<lr-retrieval-compare .sets=${sets} selected-chunk-id="b"></lr-retrieval-compare>`,
    )) as LyraRetrievalCompare;
    const selectedChunk = el.shadowRoot!.querySelector('[part~="chunk-selected"]') as HTMLElement;
    expect(getComputedStyle(selectedChunk).borderTopColor).to.equal(
      resolvedInShadow(el, 'border-top-color: var(--lr-color-brand)', 'border-top-color'),
    );
  });
});
