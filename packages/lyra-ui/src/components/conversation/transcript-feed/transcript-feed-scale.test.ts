import { expect, fixture, html } from '@open-wc/testing';
import './transcript-feed.js';
import type { LyraTranscriptFeed } from './transcript-feed.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('bounds final-announcement identities to a rotating 1,000-entry transcript', async () => {
  const el = await fixture<LyraTranscriptFeed>(html`<lr-transcript-feed .entries=${Array.from({length: 1000}, (_, i) => ({id: `${i}`, text: ''}))}></lr-transcript-feed>`);
  for (let batch = 1; batch <= 15; batch++) { el.entries = Array.from({length: 1000}, (_, i) => ({id: `${batch * 1000 + i}`, text: ''})); await el.updateComplete; }
  const count = (el as unknown as {announcedFinalIds: Set<string>}).announcedFinalIds.size;
  expect(count).to.equal(10000);
  recordScaleMeasurement('lr-transcript-feed', 'rotating-window@1000', { announcementIds: count });
});

it('discloses newest caption retention independently of the rendered window', async () => {
  const { expectDevWarning } = await import('../../../../test/expected-dev-warnings.js');
  expectDevWarning('lyra-collection-truncated:lr-transcript-feed:entries');
  const el = await fixture<LyraTranscriptFeed>(html`<lr-transcript-feed .strings=${{transcriptFeedInputLimit: 'Newest captions retained'}} .entries=${Array.from({length:10001}, (_, i) => ({id:`${i}`, text:`${i}`}))}></lr-transcript-feed>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Newest captions retained');
  el.entries = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')).to.equal(null);
});
