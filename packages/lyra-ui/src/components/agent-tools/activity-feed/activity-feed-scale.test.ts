import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './activity-feed.js';
import type { LyraActivityFeed } from './activity-feed.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

it('keeps the newest 10,000 activity entries', async () => {
  expectDevWarning('lyra-collection-truncated:lr-activity-feed:entries');
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed .entries=${Array.from({length:10001}, (_, i) => ({id:`${i}`, text:`${i}`}))}></lr-activity-feed>`);
  expect(el.entries[0]!.id).to.equal('1');
  expect(el.entries.at(-1)!.id).to.equal('10000');
  recordScaleMeasurement('lr-activity-feed', 'tail@10001', {retainedEntries: el.entries.length});
});

it('keeps the virtual renderer stable across unrelated updates of 1,000 entries', async () => {
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed expanded .entries=${Array.from({length:1000}, (_, i) => ({id:`${i}`, text:`${i}`}))}></lr-activity-feed>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as {renderItem: unknown};
  const render = list.renderItem;
  el.label = 'Updated';
  await el.updateComplete;
  expect(list.renderItem === render).to.equal(true);
});

it('discloses newest-entry retention and clears the notice', async () => {
  expectDevWarning('lyra-collection-truncated:lr-activity-feed:entries');
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed .strings=${{activityFeedInputLimit: 'Newest entries retained'}} .entries=${Array.from({length:10001}, (_, i) => ({id:`${i}`, text:`${i}`}))}></lr-activity-feed>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Newest entries retained');
  el.entries = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('refreshes virtual callback output after an explicit coalesced update', async () => {
  let text = 'First closure';
  const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed expanded .entries=${Array.from({length:1000}, (_, i) => ({id:`${i}`, text:'one'}))} .renderText=${() => html`${text}`}></lr-activity-feed>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {updateComplete: Promise<boolean>};
  await list.updateComplete;
  await waitUntil(() => list.shadowRoot!.textContent!.includes('First closure'));
  expect(list.shadowRoot!.textContent).to.contain('First closure');
  text = 'Newest closure';
  el.label = 'Coalesced label';
  el.requestUpdate();
  await el.updateComplete;
  await list.updateComplete;
  expect(list.shadowRoot!.textContent).to.contain('Newest closure');
});
