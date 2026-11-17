import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import './virtual-list.js';

it('retires load demand when a range listener disconnects the list and recovers after reconnect', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-virtual-list style="--lr-virtual-list-height:200px" row-height="40" overscan="0" has-more
      .items=${Array.from({ length: 100 }, (_, index) => index)}
      .keyFunction=${(item: unknown) => Number(item)}
      .renderItem=${(item: unknown) => html`<div style="height:40px">Row ${item}</div>`}
    ></lr-virtual-list>
  </div>`);
  const list = wrapper.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await nextFrame();
  await list.updateComplete;
  await waitUntil(() => list.renderedRows.length > 0);

  const demandConnections: boolean[] = [];
  let lastEnd = -1;
  let retireOnEnd = false;
  let removedAtEnd = false;
  list.addEventListener('lr-load-more', () => demandConnections.push(list.isConnected));
  list.addEventListener('lr-visible-range-change', event => {
    lastEnd = event.detail.end;
    if (retireOnEnd && lastEnd === 99) {
      retireOnEnd = false;
      list.remove();
      removedAtEnd = true;
    }
  });

  list.scrollToIndex(99, { align: 'end', behavior: 'auto' });
  await waitUntil(() => demandConnections.length === 1 && lastEnd === 99);
  expect(demandConnections, 'ordinary end navigation requests data while connected').to.deep.equal([true]);

  list.scrollToIndex(0, { align: 'start', behavior: 'auto' });
  await waitUntil(() => lastEnd >= 0 && lastEnd < 99);
  await list.updateComplete;
  retireOnEnd = true;
  list.scrollToIndex(99, { align: 'end', behavior: 'auto' });
  await waitUntil(() => removedAtEnd, 'the end-range notification disconnects the list');
  await list.updateComplete;
  await nextFrame();
  expect(list.isConnected).to.equal(false);
  expect(demandConnections, 'the retired update must not dispatch a detached load demand').to.deep.equal([true]);

  wrapper.append(list);
  await list.updateComplete;
  await nextFrame();
  list.scrollToIndex(0, { align: 'start', behavior: 'auto' });
  await waitUntil(() => lastEnd >= 0 && lastEnd < 99);
  await list.updateComplete;
  const beforeRecovery = demandConnections.length;
  list.scrollToIndex(99, { align: 'end', behavior: 'auto' });
  await waitUntil(() => demandConnections.length === beforeRecovery + 1 && lastEnd === 99,
    'reconnected end navigation requests data again');
  expect(demandConnections.every(connected => connected)).to.equal(true);
  expect(list.renderedRows.some(row => row.dataset['rowIndex'] === '99')).to.equal(true);
});
