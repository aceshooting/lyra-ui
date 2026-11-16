import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.js';
import type { LyraChatThread, LyraThreadList } from './thread-list.js';
import './thread-list.js';

function virtualList(host: LyraThreadList): LyraVirtualList {
  return host.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
}

function row(host: LyraThreadList, id: string): LyraConversationItem | undefined {
  return Array.from(virtualList(host).shadowRoot!.querySelectorAll<LyraConversationItem>('lr-conversation-item'))
    .find(item => item.conversationId === id);
}

async function settledRow(host: LyraThreadList, id: string): Promise<LyraConversationItem> {
  await host.updateComplete;
  await virtualList(host).updateComplete;
  await waitUntil(() => row(host, id) !== undefined, `conversation ${id} is mounted`);
  const item = row(host, id)!;
  await item.updateComplete;
  await twoFrames();
  await item.updateComplete;
  return item;
}

function contentHeight(item: LyraConversationItem): number {
  const label = item.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
  const content = item.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
  expect(label.getBoundingClientRect().height, 'the row has a rendered title').to.be.greaterThan(0);
  return content.getBoundingClientRect().height;
}

function expectFilledExcerpt(item: LyraConversationItem, text: string): void {
  const excerpt = item.shadowRoot!.querySelector<HTMLElement>('[part="excerpt"]')!;
  const mark = item.querySelector<HTMLElement>('[slot="excerpt"] mark')!;
  expect(mark !== null, 'the rich row retains its highlighted content').to.equal(true);
  expect(mark.textContent).to.equal(text);
  expect(excerpt.getBoundingClientRect().height, 'the rich excerpt occupies a rendered line').to.be.greaterThan(0);
  expect(getComputedStyle(excerpt).display).not.to.equal('none');
}

function renderer(ids: ReadonlySet<string>): (thread: LyraChatThread) => TemplateResult {
  return thread => ids.has(thread.id) ? html`<mark>Match ${thread.id}</mark>` : html``;
}

for (const direction of ['ltr', 'rtl'] as const) {
  it(`retains nontext excerpt content and reconciles callbacks after reconnect in ${direction}`, async () => {
    const host = await fixture<LyraThreadList>(html`<lr-thread-list
      dir=${direction}
      label="Conversations"
      grouping="none"
      without-rename
      style="inline-size:320px;block-size:180px"
      .threads=${[{ id: 'one', title: 'Conversation' }]}
    ></lr-thread-list>`);
    const baseline = contentHeight(await settledRow(host, 'one'));
    host.renderExcerpt = () => html`<svg aria-label="Status" role="img" width="16" height="16"><circle cx="8" cy="8" r="4"></circle></svg>`;
    const populated = await settledRow(host, 'one');
    const excerpt = populated.shadowRoot!.querySelector<HTMLElement>('[part="excerpt"]')!;
    expect(populated.querySelectorAll('[slot="excerpt"] svg').length).to.equal(1);
    expect(excerpt.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(getComputedStyle(excerpt).display).not.to.equal('none');

    const parent = host.parentNode!;
    host.remove();
    host.renderExcerpt = () => html``;
    parent.appendChild(host);
    expect(contentHeight(await settledRow(host, 'one')), 'reconnected empty content contributes no gap').to.be.closeTo(baseline, 0.5);
    host.renderExcerpt = renderer(new Set(['one']));
    expectFilledExcerpt(await settledRow(host, 'one'), 'Match one');
  });

  it(`omits layout space for an empty excerpt template beside a populated excerpt at 320px in ${direction}`, async () => {
    const host = await fixture<LyraThreadList>(html`<lr-thread-list
      dir=${direction}
      label="Conversations"
      grouping="none"
      without-rename
      style="inline-size:320px;block-size:180px"
      .threads=${[
        { id: 'empty', title: 'Conversation' },
        { id: 'filled', title: 'Conversation' },
      ]}
    ></lr-thread-list>`);
    const baseline = contentHeight(await settledRow(host, 'empty'));
    expect(baseline).to.be.greaterThan(0);
    host.renderExcerpt = renderer(new Set(['filled']));
    const filled = await settledRow(host, 'filled');
    expectFilledExcerpt(filled, 'Match filled');
    const empty = await settledRow(host, 'empty');
    expect(contentHeight(empty), 'an empty template adds no excerpt line or flex gap').to.be.closeTo(baseline, 0.5);
    expect(empty.querySelectorAll('[slot="excerpt"] mark').length).to.equal(0);
  });

  it(`collapses changed empty excerpts after reordering and virtualized remount at 320px in ${direction}`, async () => {
    const threads: LyraChatThread[] = Array.from({ length: 48 }, (_, index) => ({ id: `t${index}`, title: 'Conversation' }));
    const host = await fixture<LyraThreadList>(html`<lr-thread-list
      dir=${direction}
      label="Conversations"
      grouping="none"
      without-rename
      style="inline-size:320px;block-size:180px"
      .threads=${threads}
    ></lr-thread-list>`);
    const baseline = contentHeight(await settledRow(host, 't0'));
    host.renderExcerpt = renderer(new Set(['t0']));
    expectFilledExcerpt(await settledRow(host, 't0'), 'Match t0');

    host.renderExcerpt = renderer(new Set(['t1']));
    host.threads = [threads[1]!, threads[0]!, ...threads.slice(2)];
    expectFilledExcerpt(await settledRow(host, 't1'), 'Match t1');
    expect(contentHeight(await settledRow(host, 't0')), 'a formerly populated row loses all excerpt space').to.be.closeTo(baseline, 0.5);

    const list = virtualList(host);
    list.scrollToIndex(30, { align: 'start', behavior: 'auto' });
    await waitUntil(() => row(host, 't30') !== undefined && row(host, 't0') === undefined,
      'scrolling mounts a distant conversation and retires the original row');
    expect(contentHeight(await settledRow(host, 't30')), 'a reused window adds no space for an empty template').to.be.closeTo(baseline, 0.5);
    list.scrollToIndex(0, { align: 'start', behavior: 'auto' });
    expectFilledExcerpt(await settledRow(host, 't1'), 'Match t1');
    expect(contentHeight(await settledRow(host, 't0')), 'the empty row remains collapsed when mounted again').to.be.closeTo(baseline, 0.5);
  });
}
