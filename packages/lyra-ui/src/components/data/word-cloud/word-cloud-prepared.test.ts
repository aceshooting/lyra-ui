import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.js';
import { prepareLyraWordCloud, type LyraPreparedWordCloud } from '../../../utilities/data-preparation.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sinkTexts } from '../../../../test/announcements.js';

function summary(revision: string | number = 'one'): LyraPreparedWordCloud {
  return { revision, counts: { sourceCount: 100, validCount: 99, invalidCount: 1 }, totalWeight: 200,
    retainedWeight: 12, words: [{ id: 'first', text: 'same', weight: 9 }, { id: 'second', text: 'same', weight: 3 }] };
}
function words(el: LyraWordCloud): SVGTextElement[] {
  return [...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="word"]')];
}
function svg(el: LyraWordCloud): SVGSVGElement {
  return el.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"]')!;
}
function clickWord(el: LyraWordCloud, index: number): void {
  const node = words(el)[index]!;
  const point = new DOMPoint(Number(node.getAttribute('x')), Number(node.getAttribute('y'))).matrixTransform(svg(el).getScreenCTM()!);
  svg(el).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: point.x, clientY: point.y }));
}

it('gives prepared words precedence, discloses full weights and restores unchanged legacy input', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${[{ text: 'legacy', weight: 1 }]} .preparedWords=${summary()}></lr-word-cloud>`);
  expect(words(el).map(word => word.textContent)).to.deep.equal(['same', 'same']);
  expect(el.words.map(word => word.text)).to.deep.equal(['legacy']);
  const notice = el.shadowRoot!.querySelector('[part="summary"]')!.textContent!;
  expect(notice).to.contain('Word summary:'); expect(notice).to.contain('99'); expect(notice).to.contain('200'); expect(notice).to.contain('12');
  expect(svg(el).ariaDescribedByElements?.map(node => node.id)).to.contain('prepared-summary');
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  el.preparedWords = null; await el.updateComplete;
  expect(words(el).map(word => word.textContent)).to.deep.equal(['legacy']);
  expect(el.shadowRoot!.querySelector('[part="summary"]') === null).to.equal(true);
});

it('keeps legacy activation shape and gives duplicate text distinct original prepared IDs', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${[{ text: 'legacy', weight: 2 }]}></lr-word-cloud>`);
  let activation = oneEvent(el, 'lr-word-activate'); clickWord(el, 0);
  const legacy = (await activation).detail;
  expect(Object.keys(legacy).sort()).to.deep.equal(['group', 'text', 'weight']);
  expect(legacy).to.deep.equal({ text: 'legacy', weight: 2, group: undefined });
  el.preparedWords = summary('original'); await el.updateComplete;
  activation = oneEvent(el, 'lr-word-activate'); clickWord(el, 0);
  const first = (await activation).detail;
  expect([first.id, first.revision, first.weight]).to.deep.equal(['first', 'original', 9]);
  await focusByKeyboard(svg(el) as unknown as HTMLElement);
  await sendKeys({ press: 'End' });
  activation = oneEvent(el, 'lr-word-activate'); await sendKeys({ press: 'Enter' });
  const second = (await activation).detail;
  expect([second.id, second.revision, second.text, second.weight]).to.deep.equal(['second', 'original', 'same', 3]);
  expect(Object.isFrozen(second)).to.equal(true);
});

it('accepts helper accumulation-order rounding but rejects grossly underreported total weight', async () => {
  const values = [1e16, 1, 1, 1, 2];
  const prepared = await prepareLyraWordCloud({ revision: 1, count: values.length,
    read: (start, count) => values.slice(start, start + count).map((weight, index) => ({ id: `w${start + index}`, text: `w${start + index}`, weight })) });
  expect(prepared.retainedWeight).to.be.greaterThan(prepared.totalWeight);
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${prepared}></lr-word-cloud>`);
  expect(words(el).length).to.equal(5);
  expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  el.preparedWords = { ...summary(), totalWeight: 9 };
  await el.updateComplete;
  expect(words(el).length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});

it('refreshes same-identity and coalesced unnamed descriptors without changing committed old actions', async () => {
  const current = summary('old') as { -readonly [K in keyof LyraPreparedWordCloud]: LyraPreparedWordCloud[K] };
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${current}></lr-word-cloud>`);
  current.revision = 'new'; current.words = [{ id: 'new', text: 'replacement', weight: 12 }];
  el.preparedWords = current;
  const activation = oneEvent(el, 'lr-word-activate'); clickWord(el, 0);
  expect((await activation).detail.revision).to.equal('old');
  await el.updateComplete;
  expect(words(el).map(word => word.textContent)).to.deep.equal(['replacement']);
  current.words = [{ id: 'fresh', text: 'keyless', weight: 12 }];
  el.scale = 'sqrt'; el.requestUpdate(); await el.updateComplete;
  expect(words(el).map(word => word.textContent)).to.deep.equal(['keyless']);
});

it('rejects invalid bounded descriptors without invoking getters or falling back to legacy', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${[{ text: 'legacy', weight: 1 }]}></lr-word-cloud>`);
  let reads = 0;
  const hostile = { ...summary() };
  Object.defineProperty(hostile, 'totalWeight', { get() { reads++; return 200; } });
  el.preparedWords = hostile; await el.updateComplete;
  expect(reads).to.equal(0); expect(words(el).length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  const invalid = [
    { ...summary(), counts: { sourceCount: 100, validCount: 100, invalidCount: 1 } },
    { ...summary(), retainedWeight: 11 },
    { ...summary(), totalWeight: 0 },
    { ...summary(), words: [{ id: 'x', text: 'a', weight: 9 }, { id: 'x', text: 'b', weight: 3 }] },
    { ...summary(), words: [{ id: 'x', text: 'x'.repeat(257), weight: 12 }] },
    { ...summary(), words: Array(151).fill({ id: 'x', text: 'x', weight: 1 }) },
  ];
  for (const candidate of invalid) {
    el.preparedWords = candidate; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
    expect(words(el).length).to.equal(0);
  }
  el.preparedWords = summary(); await el.updateComplete;
  expect(words(el).length).to.equal(2);
});

it('keeps initial summary silent and applies string overrides to later summary and error announcements', async () => {
  const messages = { wordCloudPreparedSummary: 'Retained {retainedCount}; valid {validCount}; weight {retainedWeight}/{totalWeight}', wordCloudPreparedUnavailable: 'Summary unavailable override' };
  const before = sinkTexts().length;
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .strings=${messages} .preparedWords=${summary()}></lr-word-cloud>`);
  await aTimeout(30);
  expect(sinkTexts().length).to.equal(before);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.contain('Retained 2');
  el.preparedWords = { ...summary('next'), totalWeight: 300 }; await el.updateComplete;
  await aTimeout(40);
  expect(sinkTexts().some(text => text.includes('weight 12/300'))).to.equal(true);
  el.preparedWords = { ...summary(), retainedWeight: -1 }; await el.updateComplete;
  await aTimeout(40);
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Summary unavailable override');
  expect(sinkTexts('assertive').includes('Summary unavailable override')).to.equal(true);
});

it('bounds descriptor reads, avoids legacy rendering getters and preserves authored description references', async () => {
  let descriptors = 0;
  const prepared = new Proxy(summary(), { getOwnPropertyDescriptor(target, key) { descriptors++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud aria-label="Weighted catalog" .preparedWords=${prepared}></lr-word-cloud>`);
  const description = document.createElement('p'); description.id = 'word-catalog-description'; description.textContent = 'Catalog description';
  el.parentNode!.appendChild(description);
  try {
    el.setAttribute('aria-describedby', description.id); await el.updateComplete;
    expect(svg(el).getAttribute('aria-label')).to.equal('Weighted catalog');
    expect(svg(el).ariaDescribedByElements?.map(node => node.id)).to.include.members([description.id, 'prepared-summary']);
    const admittedReads = descriptors;
    expect(admittedReads).to.be.at.most(10);
    Object.defineProperty(el, 'words', { configurable: true, get() { throw new Error('Legacy route read'); } });
    try {
      el.scale = 'sqrt'; el.refreshTheme(); el.palette = ['red']; await el.updateComplete;
      expect(descriptors).to.equal(admittedReads);
      expect(words(el).length).to.equal(2);
    } finally { Reflect.deleteProperty(el, 'words'); }
  } finally { description.remove(); }
});

it('rejects retained old actions and refreshes current state quietly after reconnect and adoption', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${summary()}></lr-word-cloud>`);
  const seam = el as unknown as { cachedLayout: { placed: unknown[] }; activate(word: unknown): void };
  const original = seam.cachedLayout.placed[0];
  let calls = 0; el.addEventListener('lr-word-activate', () => { calls++; });
  el.preparedWords = { ...summary('replacement'), words: [{ id: 'other', text: 'new', weight: 12 }] };
  await el.updateComplete;
  seam.activate(original); expect(calls).to.equal(0);
  const parent = el.parentNode!; el.remove(); seam.activate(seam.cachedLayout.placed[0]); expect(calls).to.equal(0);
  el.preparedWords = { revision: 'empty', counts: { sourceCount: 4, validCount: 0, invalidCount: 4 }, totalWeight: 0, retainedWeight: 0, words: [] };
  const before = sinkTexts().length; parent.appendChild(el); await el.updateComplete; await aTimeout(30);
  expect(words(el).length).to.equal(0); expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.contain('4');
  expect(sinkTexts().length).to.equal(before);
  el.preparedWords = summary('adopted'); await el.updateComplete;
  const frame = document.createElement('iframe'); document.body.appendChild(frame);
  try {
    frame.contentDocument!.body.appendChild(el); await el.updateComplete;
    expect(words(el).length).to.equal(2);
    let revision: unknown; el.addEventListener('lr-word-activate', event => { revision = (event as CustomEvent).detail.revision; });
    clickWord(el, 0); expect(revision).to.equal('adopted');
  } finally { parent.appendChild(el); frame.remove(); }
});

it('validates exact label bounds, holes, zero counts and all scalar weight contradictions', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const exact = Array.from({ length: 64 }, (_, index) => ({ id: `label-${index}`, text: 'x'.repeat(256), weight: 1 }));
  el.preparedWords = { revision: 0, counts: { sourceCount: 64, validCount: 64, invalidCount: 0 }, totalWeight: 64, retainedWeight: 64, words: exact };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  const invalid: unknown[] = [
    { ...summary(), words: [...exact, { id: 'excess', text: 'z', weight: 1 }], retainedWeight: 65 },
    { ...summary(), words: new Array(2) },
    { ...summary(), words: [{ id: ' ', text: 'a', weight: 12 }] },
    { ...summary(), words: [{ id: 'x'.repeat(257), text: 'a', weight: 12 }] },
    { ...summary(), words: [{ id: 'a', text: ' ', weight: 12 }] },
    { ...summary(), revision: '' },
    { ...summary(), counts: { sourceCount: Number.MAX_SAFE_INTEGER + 1, validCount: 99, invalidCount: 1 } },
    { ...summary(), counts: { sourceCount: 0, validCount: 0, invalidCount: 0 }, words: [], retainedWeight: 0 },
    { ...summary(), words: [], retainedWeight: 0 },
    ...[NaN, Infinity, -1].flatMap(weight => [{ ...summary(), totalWeight: weight }, { ...summary(), retainedWeight: weight }, { ...summary(), words: [{ id: 'a', text: 'a', weight }] }]),
    { ...summary(), words: [{ id: 'a', text: 'a', weight: 10 }], totalWeight: 9, retainedWeight: 10 },
    { ...summary(), words: [{ id: 'a', text: 'a', weight: 1e308 }, { id: 'b', text: 'b', weight: 1e308 }], totalWeight: 1e308, retainedWeight: 1e308 },
  ];
  let indexReads = 0;
  const oversized = new Proxy(Array(1_000_000), { getOwnPropertyDescriptor(target, key) { if (key !== 'length') indexReads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  invalid.push({ ...summary(), words: oversized });
  for (const candidate of invalid) {
    el.preparedWords = candidate as LyraPreparedWordCloud; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  }
  expect(indexReads).to.equal(0);
  el.preparedWords = { revision: 0, counts: { sourceCount: 0, validCount: 0, invalidCount: 0 }, words: [], totalWeight: 0, retainedWeight: 0 };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="summary"]') !== null).to.equal(true);
});

it('keeps populated, empty and invalid prepared alternatives accessible', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud style="inline-size:320px" dir="rtl" .preparedWords=${summary()}></lr-word-cloud>`);
  await expect(el).to.be.accessible();
  await focusByKeyboard(svg(el) as unknown as HTMLElement);
  await sendKeys({ press: 'Home' }); await sendKeys({ press: 'ArrowLeft' });
  const activated = oneEvent(el, 'lr-word-activate'); await sendKeys({ press: 'Enter' });
  expect((await activated).detail.id).to.equal('second');
  el.preparedWords = { revision: 'zero', counts: { sourceCount: 0, validCount: 0, invalidCount: 0 }, totalWeight: 0, retainedWeight: 0, words: [] };
  await el.updateComplete; await expect(el).to.be.accessible();
  el.preparedWords = { ...summary(), totalWeight: NaN }; await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('rejects contradictory whole-catalog totals while preserving partial summaries and both helper rounding directions', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const complete = { ...summary(), counts: { sourceCount: 2, validCount: 2, invalidCount: 0 } };
  el.preparedWords = complete; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="error"]') !== null, 'all valid words must conserve full weight').to.equal(true);
  el.preparedWords = { ...complete, totalWeight: 12 }; await el.updateComplete;
  expect(words(el).length).to.equal(2);
  el.preparedWords = { revision: 'zero-weights', counts: { sourceCount: 2, validCount: 2, invalidCount: 0 },
    words: [{ id: 'a', text: 'a', weight: 0 }, { id: 'b', text: 'b', weight: 0 }], retainedWeight: 0, totalWeight: 1 };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  el.preparedWords = summary('partial'); await el.updateComplete;
  expect(words(el).length).to.equal(2);
  for (const [values, direction] of [[ [1e16, 1, 1, 1, 2], 'retained' ], [ [1, 1, 1, 1, 2, 1e16], 'total' ]] as const) {
    const prepared = await prepareLyraWordCloud({ revision: direction, count: values.length,
      read: (start, count) => values.slice(start, start + count).map((weight, index) => ({ id: `w${start + index}`, text: `w${start + index}`, weight })) });
    expect(direction === 'retained' ? prepared.retainedWeight > prepared.totalWeight : prepared.totalWeight > prepared.retainedWeight).to.equal(true);
    el.preparedWords = prepared; await el.updateComplete;
    expect(words(el).length).to.equal(values.length);
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  }
});

for (const zeroWeights of [false, true]) {
  it(`rejects whole-catalog ${zeroWeights ? 'zero-weight' : 'positive-weight'} contradictions despite a huge invalid count`, async () => {
    const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
    const sourceCount = Number.MAX_SAFE_INTEGER;
    el.preparedWords = { revision: 'huge-invalid', counts: { sourceCount, validCount: 2, invalidCount: sourceCount - 2 },
      words: [{ id: 'a', text: 'a', weight: zeroWeights ? 0 : 9 }, { id: 'b', text: 'b', weight: zeroWeights ? 0 : 3 }],
      retainedWeight: zeroWeights ? 0 : 12, totalWeight: zeroWeights ? 1 : 200 };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
    expect(words(el).length).to.equal(0);
  });
}
