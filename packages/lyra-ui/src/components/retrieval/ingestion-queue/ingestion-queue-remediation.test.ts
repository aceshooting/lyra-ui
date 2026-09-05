import { expect, fixture, html } from '@open-wc/testing';
import './ingestion-queue.js';
import type { IngestionQueueItem, LyraIngestionQueue } from './ingestion-queue.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

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
