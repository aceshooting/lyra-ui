import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import './retrieval-results.js';
import type { LyraRetrievalResults } from './retrieval-results.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-retrieval-results', 'chunks'));

it('admits 10000 chunks and reuses canonical identities during selection', async () => {
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .chunks=${Array.from({ length: 10001 }, (_, i) => ({ id: `c${i}`, text: 'chunk', score: 0.5, source: { id: 's', name: 'Source' } }))}
    .strings=${{ retrievalResultsInputLimit: 'Only the first {count} of {total} retrieval results are retained.' }}></lr-retrieval-results>`);
  const seam = el as unknown as { canonicalChunks(): unknown[]; ordinalById: Map<string, number> };
  const canonical = seam.canonicalChunks();
  const ordinals = seam.ordinalById;
  el.selectedChunkIds = ['c9999'];
  await el.updateComplete;
  recordScaleMeasurement('lr-retrieval-results', 'n=10001 input and selection', { retained: el.chunks.length, canonicalReused: Number(canonical === seam.canonicalChunks()) });
  expect(el.chunks.length).to.equal(10000);
  expect(canonical === seam.canonicalChunks()).to.equal(true);
  expect(el.selectedChunkIds).to.deep.equal(['c9999']);
  expect(seam.ordinalById === ordinals).to.equal(true);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')! as HTMLElement & { updateComplete: Promise<unknown> };
  await list.updateComplete;
  expect(list.shadowRoot!.querySelectorAll('lr-chunk-inspector').length).to.be.within(1, 80);
  expect(el.shadowRoot!.textContent).to.include('Only the first 10,000 of 10,001 retrieval results are retained.');
});

it('copies descriptor-safe display fields and refreshes a keyless custom grouping closure', async () => {
  let getterCalls = 0;
  const hostile = { get id() { getterCalls++; return 'bad'; }, text: 'bad', score: 1, source: { id: 's', name: 'S' } };
  const source = { id: 's', name: 'Original' };
  const good = { id: 'c', text: 'Original text', score: 0.5, source };
  let group = 'first';
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .chunks=${[hostile, good]} grouping="custom" .groupBy=${() => group}></lr-retrieval-results>`);
  const seam = el as unknown as { canonicalChunks(): typeof good[]; processedChunks: { groups: { id: string }[] } };
  expect(getterCalls).to.equal(0);
  expect(seam.canonicalChunks()).to.deep.equal([good]);
  source.name = 'Changed externally';
  good.text = 'Changed externally';
  el.loading = true;
  await el.updateComplete;
  expect(seam.canonicalChunks()[0]!.text).to.equal('Original text');
  expect(seam.canonicalChunks()[0]!.source.name).to.equal('Original');
  const firstGroups = seam.processedChunks.groups;
  group = 'second';
  el.requestUpdate();
  await el.updateComplete;
  expect(seam.processedChunks.groups === firstGroups).to.equal(false);
  expect(getterCalls).to.equal(0);
});

it('announces a newly exceeded input boundary once and keeps the initial boundary silent', async () => {
  const row = { id: 'c', text: 'Chunk', score: 0.5, source: { id: 's', name: 'Source' } };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .strings=${{ retrievalResultsInputLimit: 'Only the first {count} of {total} retrieval results are retained.' }}></lr-retrieval-results>`);
  const expected = 'Only the first 10,000 of 10,001 retrieval results are retained.';
  const before = sinkTexts().filter(text => text === expected).length;
  el.chunks = Array.from({ length: 10001 }, () => row);
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include(expected);
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
  el.requestUpdate();
  await el.updateComplete;
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
  const initial = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .chunks=${Array.from({ length: 10001 }, () => row)} .strings=${{ retrievalResultsInputLimit: 'Only the first {count} of {total} retrieval results are retained.' }}></lr-retrieval-results>`);
  expect(initial.shadowRoot!.textContent).to.include(expected);
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
});

it('refreshes rendered custom group headers when a keyless request coalesces with selection', async () => {
  let group = 'first';
  let label = 'First heading';
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="custom"
    .chunks=${[{ id: 'c', text: 'Chunk', score: 0.5, source: { id: 's', name: 'Source' } }]}
    .groupBy=${() => group} .groupLabel=${() => label}></lr-retrieval-results>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')! as HTMLElement & { updateComplete: Promise<unknown> };
  await list.updateComplete;
  expect(list.shadowRoot!.querySelector('[part="group"]')!.textContent).to.include('First heading');
  for (const refreshFirst of [true, false]) {
    group = refreshFirst ? 'second' : 'third';
    label = refreshFirst ? 'Second heading' : 'Third heading';
    if (refreshFirst) el.requestUpdate();
    el.selectedChunkIds = refreshFirst ? ['c'] : [];
    if (!refreshFirst) el.requestUpdate();
    await el.updateComplete;
    await list.updateComplete;
    expect(list.shadowRoot!.querySelector('[part="group"]')!.textContent).to.include(label);
  }
});
