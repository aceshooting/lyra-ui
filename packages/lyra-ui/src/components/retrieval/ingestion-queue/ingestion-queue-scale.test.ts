import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import './ingestion-queue.js';
import type { LyraIngestionQueue } from './ingestion-queue.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-ingestion-queue', 'items'));

it('normalizes only the replacement collection at n=10000', async () => {
  const items = Array.from({ length: 10000 }, (_, i) => ({ id: `q${i}`, document: { id: `d${i}`, name: 'Document' }, stage: 'queued' as const }));
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .items=${items}></lr-ingestion-queue>`);
  const seam = el as unknown as { normalizeItems(value: unknown): unknown[] };
  const original = seam.normalizeItems;
  let normalizations = 0;
  seam.normalizeItems = function (value) { normalizations++; return original.call(this, value); };
  try {
    el.items = [...items, { id: 'overflow', document: { id: 'extra', name: 'Extra' }, stage: 'queued' }];
    await el.updateComplete;
    recordScaleMeasurement('lr-ingestion-queue', 'n=10000 replacement', { normalizations, retained: el.items.length });
    expect(normalizations).to.equal(1);
    expect(el.items.length).to.equal(10000);
  } finally { seam.normalizeItems = original; }
});

it('does not invoke row accessors and refreshes malformed failure text on strings changes', async () => {
  let calls = 0;
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue
    .strings=${{ ingestionStageFailed: 'First failure' }}
    .items=${[{ get id() { calls++; return 'bad'; }, document: { id: 'bad', name: 'Bad' }, stage: 'queued' },
      { id: 'q', document: { id: 'd', name: 'Document' }, stage: 'failed', error: {} }]}
  ></lr-ingestion-queue>`);
  const seam = el as unknown as { normalizedItems: { id: string; error: string }[] };
  expect(calls).to.equal(0);
  expect(seam.normalizedItems.map(row => row.id)).to.deep.equal(['q']);
  expect(seam.normalizedItems[0]!.error).to.equal('First failure');
  el.strings = { ingestionStageFailed: 'Changed failure' };
  await el.updateComplete;
  expect(seam.normalizedItems[0]!.error).to.equal('Changed failure');
  expect(el.shadowRoot!.textContent).to.include('Changed failure');
});

it('announces a newly exceeded input boundary once and keeps the initial boundary silent', async () => {
  const row = { id: 'q', document: { id: 'd', name: 'Document' }, stage: 'queued' as const };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .strings=${{ ingestionQueueInputLimit: 'Only the first {count} of {total} queue items are retained.' }}></lr-ingestion-queue>`);
  const expected = 'Only the first 10,000 of 10,001 queue items are retained.';
  const before = sinkTexts().filter(text => text === expected).length;
  el.items = Array.from({ length: 10001 }, () => row);
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include(expected);
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
  el.requestUpdate();
  await el.updateComplete;
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
  const initial = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .items=${Array.from({ length: 10001 }, () => row)} .strings=${{ ingestionQueueInputLimit: 'Only the first {count} of {total} queue items are retained.' }}></lr-ingestion-queue>`);
  expect(initial.shadowRoot!.textContent).to.include(expected);
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
});

it('keeps an unchanged malformed failure silent when strings and items change together', async () => {
  const item = { id: 'q', document: { id: 'd', name: 'Document' }, stage: 'failed', error: {} };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .items=${[item]}
    .strings=${{ ingestionStageFailed: 'First failure' }}></lr-ingestion-queue>`);
  const before = sinkTexts('assertive').length;
  el.strings = { ingestionStageFailed: 'Changed failure' };
  el.items = [item] as unknown as LyraIngestionQueue['items'];
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('Changed failure');
  expect(el.shadowRoot!.querySelector('[part="failure-live"]')!.textContent!.trim()).to.equal('');
  expect(sinkTexts('assertive').length).to.equal(before);
  el.items = [{ ...item, stage: 'failed', error: 'New failure detail' }];
  await el.updateComplete;
  expect(sinkTexts('assertive').at(-1)).to.equal('New failure detail');
});
