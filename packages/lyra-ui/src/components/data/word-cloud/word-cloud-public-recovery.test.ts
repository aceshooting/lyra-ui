import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraPreparedWordCloud } from '../../../utilities/data-preparation.js';
import type { LyraWordCloud } from './word-cloud.class.js';
import './word-cloud.js';

function summary(revision = 'initial'): LyraPreparedWordCloud {
  return { revision, counts: { sourceCount: 4, validCount: 3, invalidCount: 1 }, totalWeight: 14, retainedWeight: 12,
    words: [{ id: 'alpha', text: 'Alpha', weight: 9 }, { id: 'beta', text: 'Beta', weight: 3 }] };
}

function svg(element: LyraWordCloud): SVGSVGElement {
  const target = element.shadowRoot?.querySelector<SVGSVGElement>('[part="svg"]');
  if (!target) throw new Error('Word cloud SVG missing');
  return target;
}

function texts(element: LyraWordCloud): string[] {
  return [...element.shadowRoot!.querySelectorAll('[part="word"]')].map(word => word.textContent ?? '');
}

for (const [name, candidate] of [
  ['null observation counts', { ...summary(), counts: null }],
  ['a non-array word collection', { ...summary(), words: { length: 1, 0: { id: 'alpha', text: 'Alpha', weight: 12 } } }],
  ['a null retained word', { ...summary(), words: [null] }],
] as const) {
  it(`rejects ${name} without showing legacy words, then recovers a valid prepared summary`, async () => {
    const element = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${[{ text: 'Legacy', weight: 1 }]}
      .strings=${{ wordCloudPreparedUnavailable: 'Prepared words rejected' }}></lr-word-cloud>`);
    Reflect.set(element, 'preparedWords', candidate);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Prepared words rejected');
    expect(texts(element)).to.deep.equal([]);
    element.preparedWords = summary('recovered');
    await element.updateComplete;
    expect(texts(element)).to.deep.equal(['Alpha', 'Beta']);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    const activations: unknown[] = [];
    element.addEventListener('lr-word-activate', event => activations.push((event as CustomEvent).detail));
    await focusByKeyboard(svg(element) as unknown as HTMLElement);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => activations.length === 1);
    expect(activations[0]).to.include({ id: 'alpha', revision: 'recovered', text: 'Alpha', weight: 9 });
  });
}

it('defers refreshTheme until an already-assigned prepared summary has been validated', async () => {
  const element = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${summary()}></lr-word-cloud>`);
  element.preparedWords = { ...summary('replacement'), words: [{ id: 'gamma', text: 'Gamma', weight: 12 }] };
  element.refreshTheme();
  expect(texts(element)).to.deep.equal(['Alpha', 'Beta']);
  await element.updateComplete;
  expect(texts(element)).to.deep.equal(['Gamma']);
  const activations: unknown[] = [];
  element.addEventListener('lr-word-activate', event => activations.push((event as CustomEvent).detail));
  await focusByKeyboard(svg(element) as unknown as HTMLElement);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activations.length === 1);
  expect(activations[0]).to.include({ id: 'gamma', revision: 'replacement', text: 'Gamma', weight: 12 });
});

it('drops a removed keyboard cursor when words shrink immediately before a public theme refresh', async () => {
  const element = await fixture<LyraWordCloud>(html`<lr-word-cloud
    .words=${[{ text: 'Alpha', weight: 9 }, { text: 'Beta', weight: 3 }]}></lr-word-cloud>`);
  await focusByKeyboard(svg(element) as unknown as HTMLElement);
  await sendKeys({ press: 'End' });
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="live-region"]')?.textContent).to.include('Beta');
  element.words = [{ text: 'Alpha', weight: 9 }];
  element.refreshTheme();
  await element.updateComplete;
  expect(texts(element)).to.deep.equal(['Alpha']);
  expect(element.shadowRoot!.querySelectorAll('[part="focus-ring"]').length).to.equal(0);
  expect(element.shadowRoot!.querySelector('[part="live-region"]')?.textContent).to.equal('');
  const activations: unknown[] = [];
  element.addEventListener('lr-word-activate', event => activations.push((event as CustomEvent).detail));
  await sendKeys({ press: 'Enter' });
  expect(activations).to.deep.equal([]);
  await sendKeys({ press: 'Home' });
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activations.length === 1);
  expect(activations[0]).to.include({ text: 'Alpha', weight: 9 });
});

it('accepts accumulation-order rounding in a bounded summary at the maximum safe source census', async () => {
  const fullWeights = [1e16, 1, 1, 1, 2];
  const retained = [1e16, 2, 1];
  const totalWeight = fullWeights.reduce((sum, value) => sum + value, 0);
  const retainedWeight = retained.reduce((sum, value) => sum + value, 0);
  expect(retainedWeight).to.be.greaterThan(totalWeight);
  const prepared: LyraPreparedWordCloud = {
    revision: 'large-census', counts: { sourceCount: Number.MAX_SAFE_INTEGER, validCount: 5, invalidCount: Number.MAX_SAFE_INTEGER - 5 },
    totalWeight, retainedWeight, words: retained.map((weight, index) => ({ id: String(index), text: `W${index}`, weight })),
  };
  const element = await fixture<LyraWordCloud>(html`<lr-word-cloud locale="en" .preparedWords=${prepared}
    .strings=${{ wordCloudPreparedSummary: 'Retained {retainedCount}; valid {validCount}' }}></lr-word-cloud>`);
  expect(texts(element)).to.deep.equal(['W0', 'W1', 'W2']);
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  expect(element.shadowRoot!.querySelector('[part="summary"]')?.textContent).to.equal('Retained 3; valid 5');
  element.preparedWords = { ...prepared, totalWeight: 1 };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  expect(texts(element)).to.deep.equal([]);
  element.preparedWords = prepared;
  await element.updateComplete;
  expect(texts(element)).to.deep.equal(['W0', 'W1', 'W2']);
});

it('refreshes typography and paint without a document window, then resumes native activation after adoption', async () => {
  const element = await fixture<LyraWordCloud>(html`<lr-word-cloud .preparedWords=${summary()}></lr-word-cloud>`);
  const parent = element.parentNode!;
  const detachedDocument = document.implementation.createHTMLDocument('Word cloud adoption');
  try {
    detachedDocument.adoptNode(element);
    expect(element.ownerDocument.defaultView === null).to.equal(true);
    element.refreshTheme();
    await element.updateComplete;
    expect(texts(element)).to.deep.equal(['Alpha', 'Beta']);
    for (const word of element.shadowRoot!.querySelectorAll<SVGTextElement>('[part="word"]')) {
      expect(Number(word.getAttribute('font-size'))).to.be.greaterThan(0);
      expect(word.getAttribute('fill')?.length ?? 0).to.be.greaterThan(0);
    }
  } finally {
    parent.appendChild(element);
    await element.updateComplete;
  }
  const activations: unknown[] = [];
  element.addEventListener('lr-word-activate', event => activations.push((event as CustomEvent).detail));
  await focusByKeyboard(svg(element) as unknown as HTMLElement);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activations.length === 1);
  expect(activations[0]).to.include({ id: 'alpha', revision: 'initial' });
});
