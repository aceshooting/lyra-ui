import { expect, fixture, html } from '@open-wc/testing';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.js';
import { prepareLyraWordCloud } from '../../../utilities/data-preparation.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';

it('reuses word hit rectangles across pointer moves over a 10000-word source', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const warnings = await captureDevWarnings(async () => {
    el.words = Array.from({ length: 10_000 }, (_, index) => ({ text: `w${index}`, weight: 1 }));
    await el.updateComplete;
  });
  expect(warnings).to.deep.equal([
    '<lr-word-cloud> could not place 9850 word(s) (blank text, over the 150-word cap, or the layout search was exhausted) -- they were dropped, not rendered.',
  ]);
  const seam = el as unknown as { focusRingRect(word: unknown): unknown; nearestWord(event: MouseEvent): unknown };
  const original = seam.focusRingRect;
  let rectangles = 0;
  const svg = el.shadowRoot!.querySelector('svg')!;
  const matrix = svg.getScreenCTM;
  let matrixReads = 0;
  svg.getScreenCTM = function () { matrixReads++; return matrix.call(this); };
  seam.focusRingRect = word => { rectangles++; return original.call(el, word); };
  try { seam.nearestWord(new MouseEvent('pointermove', { clientX: 10, clientY: 10 })); }
  finally { seam.focusRingRect = original; svg.getScreenCTM = matrix; }
  expect(rectangles).to.equal(0);
  expect(matrixReads).to.equal(1);
  recordScaleMeasurement('lr-word-cloud', '10000 words pointer move', { rectangles, matrixReads });
});

it('does not strongly retain the caller collections after admission', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const words = [{ text: 'a', weight: 1 }];
  const palette = ['red'];
  const legend = [{ label: 'A', color: 'red' }];
  el.words = words; el.palette = palette; el.legend = legend;
  const retained = Object.values(el).filter(value => value === words || value === palette || value === legend).length;
  expect(retained).to.equal(0);
});


it('reads invariant font tokens once each for a 10000-word layout', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const seam = el as unknown as { fontWeight(): string; fontFamily(): string };
  const weight = seam.fontWeight;
  const family = seam.fontFamily;
  let weightReads = 0;
  let familyReads = 0;
  seam.fontWeight = () => { weightReads++; return weight.call(el); };
  seam.fontFamily = () => { familyReads++; return family.call(el); };
  try {
    const warnings = await captureDevWarnings(async () => {
      el.words = Array.from({length:10_000},(_,index)=>({text:`w${index}`,weight:1}));
      await el.updateComplete;
    });
    expect(warnings).to.deep.equal([
      '<lr-word-cloud> could not place 9850 word(s) (blank text, over the 150-word cap, or the layout search was exhausted) -- they were dropped, not rendered.',
    ]);
  } finally { seam.fontWeight = weight; seam.fontFamily = family; }
  expect(weightReads).to.equal(1);
  expect(familyReads).to.equal(1);
});

it('renders globally selected words from a complete million-entry weighted catalog without interaction rereads', async function () {
  this.timeout(20000);
  const count = 1_000_000;
  let sourceReads = 0, sourcePositions = 0, largestRead = 0;
  const prepared = await prepareLyraWordCloud({ revision: 'catalog', count,
    read(start, size) {
      sourceReads++; sourcePositions += size; largestRead = Math.max(largestRead, size);
      return Array.from({ length: size }, (_, offset) => {
        const index = start + offset;
        return { id: `word-${index}`, text: `w${index}`, weight: index === count - 1 ? 3_000_000 : index === 500_000 ? 2_000_000 : 1 };
      });
    },
  }, { batchSize: 8192 });
  expect(prepared.counts).to.deep.equal({ sourceCount: count, validCount: count, invalidCount: 0 });
  expect([prepared.totalWeight, prepared.retainedWeight]).to.deep.equal([5_999_998, 5_000_148]);
  expect(prepared.words.slice(0, 4).map(word => word.id)).to.deep.equal(['word-999999', 'word-500000', 'word-0', 'word-1']);
  const readsAfterPreparation = sourceReads;
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${prepared}></lr-word-cloud>`);
  const rendered = [...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="word"]')];
  expect(rendered.length).to.equal(150);
  expect(rendered[0]!.textContent).to.equal('w999999');
  expect(Number(rendered[0]!.getAttribute('font-size'))).to.be.greaterThan(Number(rendered.at(-1)!.getAttribute('font-size')));
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.contain('1,000,000');
  const surface = el.shadowRoot!.querySelector<SVGSVGElement>('svg')!;
  let activatedId: unknown; el.addEventListener('lr-word-activate', event => { activatedId = (event as CustomEvent).detail.id; });
  const point = new DOMPoint(Number(rendered[0]!.getAttribute('x')), Number(rendered[0]!.getAttribute('y'))).matrixTransform(surface.getScreenCTM()!);
  surface.dispatchEvent(new MouseEvent('click', { clientX: point.x, clientY: point.y }));
  expect(activatedId).to.equal('word-999999');
  el.refreshTheme(); el.style.inlineSize = '320px'; el.requestUpdate(); await el.updateComplete;
  expect(sourceReads).to.equal(readsAfterPreparation);
  expect(sourcePositions).to.equal(count); expect(largestRead).to.be.at.most(8192);
  const nodes = el.shadowRoot!.querySelectorAll('*').length;
  expect(nodes).to.be.lessThan(200);
  recordScaleMeasurement('lr-word-cloud', 'prepared million unique weighted words', { sourceReads, sourcePositions, largestRead, words: rendered.length, nodes });
});
