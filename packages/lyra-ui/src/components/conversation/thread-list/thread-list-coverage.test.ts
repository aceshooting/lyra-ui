import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import './thread-list.js';
import type { LyraThreadList } from './thread-list.js';

expectLocaleFallback('de-DE', [
  'threadGroupPrevious7Days',
  'threadGroupCollapse',
  'threadListLabel',
  'rename',
]);

function renderedContent(el: LyraThreadList): { groups: string[]; threadLabels: string[] } {
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  return {
    groups: list.renderedRows.flatMap((row) =>
      [...row.querySelectorAll<HTMLElement>('[part="group-label"]')]
        .map((label) => label.textContent?.trim() ?? '')
    ),
    threadLabels: list.renderedRows.flatMap((row) =>
      [...row.querySelectorAll<HTMLElement>('lr-conversation-item')].map(
        (item) => item.getAttribute('label') ?? ''
      )
    ),
  };
}

it('keeps healthy custom groups when one row callback throws', async () => {
  const rows = [
    { id: 'one', title: 'First', group: 'alpha' },
    { id: 'bad', title: 'Unavailable group', group: 'broken' },
    { id: 'two', title: 'Second', group: 'beta' },
  ];
  const el = (await fixture(html`<lr-thread-list style="block-size:400px"></lr-thread-list>`)) as LyraThreadList;
  el.threads = rows;
  el.grouping = 'custom';
  el.groupBy = (thread) => {
    if (thread.id === 'bad') throw new Error('Group is unavailable');
    return rows.find((row) => row.id === thread.id)!.group;
  };
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await list.updateComplete;
  await waitUntil(
    () => list.renderedRows.some((row) => row.querySelector('lr-conversation-item') !== null),
    'thread rows entered the virtual window'
  );

  expect(renderedContent(el)).to.deep.equal({
    groups: ['alpha', 'beta'],
    threadLabels: ['First', 'Second'],
  });
});

it('groups a thread from three local calendar days ago and lets the host localize that label', async () => {
  const timestamp = new Date();
  timestamp.setHours(12, 0, 0, 0);
  timestamp.setDate(timestamp.getDate() - 3);
  const el = (await fixture(html`<lr-thread-list style="block-size:400px"></lr-thread-list>`)) as LyraThreadList;
  el.lang = 'de-DE';
  el.threads = [{ id: 'recent', title: 'Recent thread', timestamp }];
  await el.updateComplete;
  let list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await list.updateComplete;
  await waitUntil(
    () => list.renderedRows.some((row) => row.querySelector('lr-conversation-item') !== null),
    'the dated thread entered the virtual window'
  );
  expect(renderedContent(el).groups).to.deep.equal(['Previous 7 days']);

  el.strings = { threadGroupPrevious7Days: 'Past week' };
  await el.updateComplete;
  list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await list.updateComplete;
  await waitUntil(
    () => list.renderedRows.some((row) => row.querySelector('lr-conversation-item') !== null),
    'the localized thread remained in the virtual window'
  );
  expect(renderedContent(el).groups).to.deep.equal(['Past week']);
});
