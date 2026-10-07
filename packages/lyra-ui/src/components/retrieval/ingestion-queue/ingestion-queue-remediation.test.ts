import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { expect, fixture, html } from '@open-wc/testing';
import './ingestion-queue.js';
import type { IngestionQueueItem, LyraIngestionQueue } from './ingestion-queue.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

// Locale/numbering fixtures intentionally use English fallback text.
expectLocaleFallback('fr', [
  'ingestionQueueLabel',
  'ingestionRetryWithContext',
  'retry',
  'ingestionStageQueued',
  'ingestionCancelWithContext',
  'cancel',
]);
it('admits a newly failed record with nonstring error before formatting its announcement', async () => {
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
  (el as unknown as { items: unknown }).items = [{ id: 'a', document: { id: 'a', name: 'Document' }, stage: 'failed', error: 42 }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="failure-live"]')!.textContent!.trim()).to.equal('Failed');
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(1);
});

for (const error of [42, false, { message: 'Unsafe detail' }, ['Unsafe detail']]) {
  it(`renders and announces a localized fallback for malformed ${JSON.stringify(error)} failure text`, async () => {
    const malformed = { id: 'a', document: { id: 'doc', name: 'Document' }, stage: 'failed', error } as unknown as IngestionQueueItem;
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue
      lang="fr" .strings=${{ ingestionStageFailed: 'Échec' }} .items=${[malformed]}
    ></lr-ingestion-queue>`);
    const live = () => el.shadowRoot!.querySelector('[part="failure-live"]')!.textContent!.trim();
    expect(live()).to.equal('');
    expect(el.shadowRoot!.querySelector('[part="item-error"]')?.textContent).to.equal('Échec');
    el.items = [{ ...malformed, stage: 'queued' }];
    await el.updateComplete;
    const sink = document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
    const count = sink.children.length;
    el.items = [malformed, { id: 'b', document: { id: 'b', name: 'Other' }, stage: 'failed', error: 'Valid failure' }];
    await el.updateComplete;
    expect(live()).to.equal(new Intl.ListFormat('fr', { type: 'conjunction' }).format(['Échec', 'Valid failure']));
    expect(sink.children.length).to.equal(count + 1);
    expect(sink.lastElementChild!.textContent).to.equal(live());
    expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(2);
    el.items = [...el.items];
    await el.updateComplete;
    expect(live()).to.equal('');
    expect(sink.children.length).to.equal(count + 1);
  });
}

const queued = (id: string, name = `Doc ${id}`): IngestionQueueItem => ({ id, document: { id, name }, stage: 'failed', error: 'Boom' });

it('repaints virtualized rows when only the strings change', async () => {
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue
    virtualize-at="1" .items=${[queued('a'), queued('b')]}
  ></lr-ingestion-queue>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<unknown> };
  await list.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const retry = (): string => list.shadowRoot!.querySelector('[part="retry-button"] span')!.textContent!.trim();
  expect(retry()).to.equal('Retry');
  el.strings = { retry: 'Réessayer' };
  await el.updateComplete;
  await list.updateComplete;
  expect(retry()).to.equal('Réessayer');
});

it('names a blank-named document "Untitled source" in the row and its actions', async () => {
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .items=${[queued('a', '')]}></lr-ingestion-queue>`);
  expect(el.shadowRoot!.querySelector('[part="item-name"]')!.textContent!.trim()).to.equal('Untitled source');
  expect(el.shadowRoot!.querySelector('[part="retry-button"]')!.getAttribute('aria-label')).to.equal('Retry Untitled source');
  expect(el.shadowRoot!.querySelector('[part="cancel-button"]') === null).to.equal(true);
});

it('keeps the virtual list scroll and range events inside', async () => {
  const leaked: string[] = [];
  const onLeak = (event: Event): void => {
    leaked.push(event.type);
  };
  const names = ['lr-virtual-scroll', 'lr-visible-range-change'];
  for (const name of names) document.addEventListener(name, onLeak);
  try {
    const many = Array.from({ length: 20 }, (_, index) => queued(`m${index}`));
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue virtualize-at="3" .items=${many}></lr-ingestion-queue>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<unknown>; scrollToIndex(index: number, options?: { align?: 'start'; behavior?: 'auto' }): void };
    await list.updateComplete;
    list.scrollToIndex(15, { align: 'start', behavior: 'auto' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  } finally {
    for (const name of names) document.removeEventListener(name, onLeak);
  }
  expect(leaked).to.deep.equal([]);
});
