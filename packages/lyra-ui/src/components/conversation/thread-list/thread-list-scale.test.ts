import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './thread-list.js';
import type { LyraThreadList } from './thread-list.js';
import type { LyraVirtualList, LyraVirtualListIndexedSource } from '../../layout/virtual-list/virtual-list.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('keeps all 10000 admitted threads addressable after structural group rows are added', async () => {
  const host = await fixture<LyraThreadList>(html`<lr-thread-list style="height:240px"
    .threads=${Array.from({ length: 10000 }, (_, i) => ({ id: `t${i}`, title: `Thread ${i}` }))}
    active-conversation-id="t9999"
  ></lr-thread-list>`);
  const list = host.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  for (let i = 0; i < 6; i++) { await host.updateComplete; await list.updateComplete; await nextFrame(); }
  const source = list.source ?? list.items;
  const count = Array.isArray(source) ? source.length : (source as LyraVirtualListIndexedSource).count;
  const last = (Array.isArray(source) ? source[count - 1] : (source as LyraVirtualListIndexedSource).itemAt(count - 1)) as { thread?: { id: string } };
  recordScaleMeasurement('lr-thread-list', 'n=10000 grouped admission', { admitted: host.threads.length, addressable: count, mountedRows: list.shadowRoot!.querySelectorAll('[part="row"]').length });
  expect(last.thread?.id).to.equal('t9999');
  list.scrollToIndex(count - 1, { align: 'end', behavior: 'auto' });
  for (let i = 0; i < 6; i++) { await list.updateComplete; await nextFrame(); }
  expect(list.shadowRoot!.querySelector('[data-row-key="string:thread:t9999"]') !== null).to.equal(true);
});

it('refreshes the derived indexed group model when a keyless update coalesces with a property', async () => {
  let group = 'before';
  const host = await fixture<LyraThreadList>(html`<lr-thread-list grouping="custom"
    .groupBy=${() => group}
    .threads=${Array.from({ length: 10000 }, (_, i) => ({ id: `t${i}`, title: `Thread ${i}` }))}
  ></lr-thread-list>`);
  const list = host.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await list.updateComplete;
  expect((list.source as LyraVirtualListIndexedSource).keyAt!(0)).to.equal('group:before');
  group = 'after';
  host.size = 's';
  host.requestUpdate();
  await host.updateComplete;
  await list.updateComplete;
  expect((list.source as LyraVirtualListIndexedSource).keyAt!(0)).to.equal('group:after');
});

it('keeps every admitted thread reachable when each has its own structural heading', async () => {
  const host = await fixture<LyraThreadList>(html`<lr-thread-list style="height:240px" grouping="custom"
    .groupBy=${(thread: { id: string }) => thread.id}
    .threads=${Array.from({ length: 10000 }, (_, i) => ({ id: `t${i}`, title: `Thread ${i}` }))}
  ></lr-thread-list>`);
  const list = host.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await list.updateComplete;
  const source = list.source as LyraVirtualListIndexedSource;
  expect(source.count).to.equal(20000);
  expect(source.indexOfKey!('thread:t9999')).to.equal(19999);
  list.scrollToIndex(19999, { align: 'end', behavior: 'auto' });
  for (let i = 0; i < 8; i++) { await list.updateComplete; await nextFrame(); }
  const row = list.shadowRoot!.querySelector<HTMLElement>('lr-conversation-item[conversation-id="t9999"]')!;
  expect(row !== null).to.equal(true);
  let selected = '';
  host.addEventListener('lr-select', event => { selected = event.detail.conversationId; });
  row.shadowRoot!.querySelector<HTMLButtonElement>('[part="select-button"]')!.click();
  expect(selected).to.equal('t9999');
  expect(list.shadowRoot!.querySelectorAll('[part="row"]').length).to.be.lessThan(40);
});

it('retains indexed groups and measurements during a render-only parent update', async () => {
  const host = await fixture<LyraThreadList>(html`<lr-thread-list style="height:240px" grouping="custom" sticky-groups
    .groupBy=${(thread: { id: string }) => thread.id}
    .threads=${Array.from({ length: 10000 }, (_, i) => ({ id: `t${i}`, title: `Thread ${i}` }))}
  ></lr-thread-list>`);
  const list = host.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  for (let i = 0; i < 8; i++) { await host.updateComplete; await list.updateComplete; await nextFrame(); }
  const source = list.source;
  const seam = list as unknown as { recomputeGroups(): void; measuredHeights: Map<string, number> };
  const recomputeGroups = seam.recomputeGroups;
  const clear = seam.measuredHeights.clear;
  let groupPasses = 0, measurementClears = 0;
  seam.recomputeGroups = function () { groupPasses++; recomputeGroups.call(this); };
  seam.measuredHeights.clear = function () { measurementClears++; clear.call(this); };
  try {
    host.label = 'New accessible label';
    await host.updateComplete;
    await list.updateComplete;
    await nextFrame();
    expect(list.source === source).to.equal(true);
    expect(groupPasses).to.equal(0);
    expect(measurementClears).to.equal(0);
    recordScaleMeasurement('lr-thread-list', 'n=10000 structural groups render-only refresh', { groupPasses, measurementClears });
  } finally {
    seam.recomputeGroups = recomputeGroups;
    seam.measuredHeights.clear = clear;
  }
  host.withoutRename = true;
  await host.updateComplete;
  await list.updateComplete;
  const row = list.shadowRoot!.querySelector<HTMLElement & { withoutRename: boolean }>('lr-conversation-item')!;
  expect(row.withoutRename).to.equal(true);
});
