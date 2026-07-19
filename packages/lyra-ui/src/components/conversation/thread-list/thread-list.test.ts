import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './thread-list.js';
import '../../overlays/chip/chip.js';
import type { LyraThreadList } from './thread-list.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';

type ChatThreadLike = { id: string };
type RenderedThreadListItem =
  | { kind: 'group'; id: string; label: string }
  | { kind: 'thread'; thread: ChatThreadLike };

function renderedItems(el: LyraThreadList): RenderedThreadListItem[] {
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  return (list as unknown as { items: RenderedThreadListItem[] }).items;
}

function renderedThreadIds(el: LyraThreadList): string[] {
  return renderedItems(el).flatMap((item) => (item.kind === 'thread' ? [item.thread.id] : []));
}

function renderedGroupLabels(el: LyraThreadList): string[] {
  return renderedItems(el).flatMap((item) => (item.kind === 'group' ? [item.label] : []));
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

// In data mode, rendered rows live inside `lr-virtual-list`'s own shadow root (a separate shadow
// tree nested one level below `lr-thread-list`'s), since `renderItem`'s returned content is
// rendered by `lr-virtual-list` into its own render root -- `querySelector(All)` never crosses a
// shadow boundary, so reaching a row requires walking through `lr-virtual-list`'s shadow root
// explicitly rather than querying straight from the host's own `shadowRoot`.
function dataRows(el: LyraThreadList): LyraConversationItem[] {
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  return [...list.shadowRoot!.querySelectorAll<LyraConversationItem>('lr-conversation-item')];
}

function dataRow(el: LyraThreadList, id: string): LyraConversationItem {
  return dataRows(el).find((r) => r.id === id)!;
}

// Every timestamp below is computed relative to the actual test-run time (never a hardcoded date) --
// bucketFor()'s day-boundary math keys off the local calendar day, so a fixed-date fixture would
// silently drift into the wrong bucket (or fail outright) on any day other than the one it was
// written on.
const DAY_MS = 86_400_000;
const now = new Date();
const threads = [
  { id: 'p1', title: 'Pinned thread', pinned: true, timestamp: new Date(now.getTime() - 40 * DAY_MS) },
  { id: 't1', title: 'Today thread', timestamp: now, excerpt: 'hello there' },
  { id: 'y1', title: 'Yesterday thread', timestamp: new Date(now.getTime() - DAY_MS) },
  { id: 'a1', title: 'Archived thread', archived: true, timestamp: new Date(now.getTime() - 200 * DAY_MS) },
];

it('defaults to slotted mode (empty threads) and only fires lr-filter-change in that mode', async () => {
  const el = (await fixture(
    html`<lr-thread-list searchable
      ><lr-conversation-item title="Manual row"></lr-conversation-item
    ></lr-thread-list>`,
  )) as LyraThreadList;
  expect(el.threads).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="list"]')!.getAttribute('role')).to.equal('list');
  expect(el.querySelector('lr-conversation-item')).to.exist;
});

describe('data mode', () => {
  it('renders one lr-conversation-item per non-archived thread by default, grouped by date', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(renderedThreadIds(el).length).to.equal(3); // archived excluded by default
    expect(renderedGroupLabels(el)).to.deep.equal(['Pinned', 'Today', 'Yesterday']);
  });

  it('includes archived threads in a trailing Archived group when showArchived is set', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} show-archived></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    expect(renderedGroupLabels(el)).to.deep.equal(['Pinned', 'Today', 'Yesterday', 'Archived']);
  });

  it('uses the same controlled collapse model for built-in date groups', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
    )) as LyraThreadList;
    el.collapsedGroupIds = ['today'];
    await el.updateComplete;
    await nextFrame();

    expect(renderedGroupLabels(el)).to.include('Today');
    expect(renderedThreadIds(el)).to.not.include('t1');
    const todayToggle = [...el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="group-toggle"]',
    )].find((button) => button.textContent?.includes('Today'))!;
    expect(todayToggle.getAttribute('aria-expanded')).to.equal('false');
  });

  it('grouping="none" renders every visible thread in host order with no group headers', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} grouping="none" show-archived></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    expect(renderedGroupLabels(el)).to.deep.equal([]);
    expect(renderedThreadIds(el)).to.deep.equal(['p1', 't1', 'y1', 'a1']);
  });

  it('supports host-defined group keys, ordering, and rich labels', async () => {
    const projectThreads = [
      { id: 'a1', title: 'Alpha one', project: 'alpha' },
      { id: 'b1', title: 'Beta one', project: 'beta' },
      { id: 'a2', title: 'Alpha two', project: 'alpha' },
    ];
    const el = (await fixture(html`<lr-thread-list style="block-size:400px"></lr-thread-list>`)) as LyraThreadList;
    el.threads = projectThreads;
    el.grouping = 'custom';
    el.groupBy = (thread) => (thread as (typeof projectThreads)[number]).project;
    el.groupOrder = ['beta', 'alpha'];
    el.formatGroup = (key, groupedThreads) => html`<strong>${key}:${groupedThreads.length}</strong>`;
    await el.updateComplete;
    await nextFrame();

    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const groupLabels = [...list.shadowRoot!.querySelectorAll('[part~="group-label"]')].map((group) =>
      group.textContent?.trim(),
    );
    expect(groupLabels).to.deep.equal(['beta:1', 'alpha:2']);
    expect(dataRows(el).map((row) => row.id)).to.deep.equal(['b1', 'a1', 'a2']);
  });

  it('keeps group collapse controlled and removes collapsed rows from virtual-list measurement', async () => {
    const projectThreads = [
      { id: 'a1', title: 'Alpha one', project: 'alpha' },
      { id: 'b1', title: 'Beta one', project: 'beta' },
    ];
    const el = (await fixture(html`<lr-thread-list style="block-size:400px"></lr-thread-list>`)) as LyraThreadList;
    el.threads = projectThreads;
    el.grouping = 'custom';
    el.groupBy = (thread) => (thread as (typeof projectThreads)[number]).project;
    el.collapsedGroupIds = ['alpha'];
    await el.updateComplete;
    await nextFrame();

    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const alphaToggle = [...list.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="group-toggle"]')].find(
      (button) => button.textContent?.includes('alpha'),
    )!;
    expect(alphaToggle.getAttribute('aria-expanded')).to.equal('false');
    expect(alphaToggle.getAttribute('aria-label')).to.equal('Expand alpha');
    expect(alphaToggle.tabIndex).to.equal(0);
    expect(dataRows(el).map((row) => row.id)).to.deep.equal(['b1']);
    const measuredItems = (list as unknown as { items: unknown[] }).items;
    expect(measuredItems.length).to.equal(3); // two group headers plus the one expanded row

    const togglePromise = oneEvent(el, 'lr-group-toggle');
    alphaToggle.click();
    expect((await togglePromise).detail).to.deep.equal({ id: 'alpha', collapsed: false });
    expect(alphaToggle.getAttribute('aria-expanded')).to.equal('false');

    el.strings = { threadGroupExpand: 'Ouvrir {label}' };
    await el.updateComplete;
    expect(
      [...list.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="group-toggle"]')]
        .find((button) => button.textContent?.includes('alpha'))!
        .getAttribute('aria-label'),
    ).to.equal('Ouvrir alpha');

    el.collapsedGroupIds = [];
    await el.updateComplete;
    await nextFrame();
    expect(dataRows(el).map((row) => row.id)).to.deep.equal(['a1', 'b1']);
    await expect(el).to.be.accessible();
  });

  it('marks the row matching activeId as active', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} active-id="t1"></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const activeRow = dataRow(el, 't1');
    expect(activeRow.active).to.be.true;
  });

  it('re-emits lr-select/lr-thread-rename with the thread id attached', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const row = dataRow(el, 't1');

    const selectPromise = oneEvent(el, 'lr-select');
    row.dispatchEvent(new CustomEvent('lr-select', { bubbles: true, composed: true }));
    expect((await selectPromise).detail).to.deep.equal({ id: 't1' });

    const renamePromise = oneEvent(el, 'lr-thread-rename');
    row.dispatchEvent(
      new CustomEvent('lr-rename', { detail: { title: 'New title' }, bubbles: true, composed: true }),
    );
    expect((await renamePromise).detail).to.deep.equal({ id: 't1', title: 'New title' });
  });

  it('forwards editable via a property binding so editable=false actually disables row rename', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} editable></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    let row = dataRow(el, 't1');
    expect(row.editable).to.be.true;

    el.editable = false;
    await el.updateComplete;
    await nextFrame();
    row = dataRow(el, 't1');
    expect(row.editable).to.be.false; // regression guard for the ?editable=${false}-on-a-true-default trap
  });

  it('renders row actions with controlled pin/archive/delete events carrying the requested state', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const row = dataRow(el, 't1');
    const actionsSlot = row.querySelector('[slot="actions"]')!;
    const buttons = [...actionsSlot.querySelectorAll('button')];
    expect(buttons.length).to.equal(3);

    const pinPromise = oneEvent(el, 'lr-thread-pin');
    buttons[0].click();
    expect((await pinPromise).detail).to.deep.equal({ id: 't1', pinned: true });

    const archivePromise = oneEvent(el, 'lr-thread-archive');
    buttons[1].click();
    expect((await archivePromise).detail).to.deep.equal({ id: 't1', archived: true });

    const deletePromise = oneEvent(el, 'lr-thread-delete');
    buttons[2].click();
    expect((await deletePromise).detail).to.deep.equal({ id: 't1' });
  });

  it('gives every row-action button the shared minimum hit area', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const row = dataRow(el, 't1');
    const actionsSlot = row.querySelector('[slot="actions"]')!;
    const buttons = [...actionsSlot.querySelectorAll('button')];
    expect(buttons.length).to.equal(3);
    for (const button of buttons) {
      expect(getComputedStyle(button).minInlineSize).to.equal('40px');
      expect(getComputedStyle(button).minBlockSize).to.equal('40px');
    }
  });

  it('shows a small pin glyph in the meta slot for a pinned row', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const row = dataRow(el, 'p1');
    expect(row.querySelector('[slot="meta"]')).to.exist;
    const unpinnedRow = dataRow(el, 't1');
    expect(unpinnedRow.querySelector('[slot="meta"]')).to.not.exist;
  });

  describe('renderActions', () => {
    it('leaves rowActions output byte-for-byte unchanged when unset (regression guard)', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      await nextFrame();
      const row = dataRow(el, 't1');
      const actionsSlot = row.querySelector('[slot="actions"]')!;
      // Exactly the three built-in buttons and nothing else -- no extra wrapper/callback content
      // leaks in merely because the `renderActions` machinery now exists in the render path.
      expect(actionsSlot.children.length).to.equal(3);
      expect([...actionsSlot.children].every((c) => c.tagName === 'BUTTON')).to.be.true;
    });

    it("renders the callback's content in each row's actions slot, appended after rowActions, and its events reach the host", async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads} .rowActions=${['pin']}></lr-thread-list>`,
      )) as LyraThreadList;
      el.renderActions = (thread) =>
        html`<button
          type="button"
          class="custom-action"
          data-thread-id=${thread.id}
          @click=${() => el.dispatchEvent(new CustomEvent('custom-rename', { detail: { id: thread.id } }))}
        >
          Rename
        </button>`;
      await el.updateComplete;
      await nextFrame();
      const row = dataRow(el, 't1');
      const actionsSlot = row.querySelector('[slot="actions"]')!;
      const children = [...actionsSlot.children];
      // Built-in pin button first, custom content appended after it -- the documented precedence.
      expect(children.length).to.equal(2);
      expect(children[0].getAttribute('aria-label')).to.equal('Pin conversation');
      expect(children[1].classList.contains('custom-action')).to.be.true;

      const customPromise = oneEvent(el, 'custom-rename');
      (children[1] as HTMLButtonElement).click();
      expect((await customPromise).detail).to.deep.equal({ id: 't1' });
    });

    it('does not fire lr-select when a custom action is activated', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      el.renderActions = (thread) =>
        html`<button type="button" class="custom-action" data-thread-id=${thread.id}>Rename</button>`;
      await el.updateComplete;
      await nextFrame();
      const row = dataRow(el, 't1');
      const customButton = row.querySelector('.custom-action') as HTMLButtonElement;

      let selectFired = false;
      el.addEventListener('lr-select', () => {
        selectFired = true;
      });
      customButton.click();
      await nextFrame();
      expect(selectFired).to.be.false;
    });

    it('is re-invoked per row with the current thread on every render (not memoized)', async () => {
      const received: string[] = [];
      const localThreads = [{ id: 't1', title: 'Today thread', timestamp: now }];
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${localThreads}></lr-thread-list>`,
      )) as LyraThreadList;
      el.renderActions = (thread) => {
        received.push(thread.title);
        return html`<span class="custom-action">x</span>`;
      };
      await el.updateComplete;
      await nextFrame();
      // Virtual-list's own render passes (e.g. a measurement pass) can invoke `renderItem` more
      // than once even with no prop change -- the point under test isn't the exact call count, it's
      // that every invocation received the *current* thread, and that a later `threads` replacement
      // is reflected on the very next invocation rather than a stale/memoized value.
      expect(received.every((title) => title === 'Today thread')).to.be.true;

      el.threads = [{ id: 't1', title: 'Renamed thread', timestamp: now }];
      await el.updateComplete;
      await nextFrame();
      expect(received[received.length - 1]).to.equal('Renamed thread');
    });

    it('composes with wrapRow -- the custom actions still render inside the wrapped row', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      el.renderActions = (thread) =>
        html`<button type="button" class="custom-action" data-thread-id=${thread.id}>Rename</button>`;
      el.wrapRow = (thread, row) => html`<div class="row-wrapper" data-thread-id=${thread.id}>${row}</div>`;
      await el.updateComplete;
      await nextFrame();
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const wrapper = list.shadowRoot!.querySelector('.row-wrapper[data-thread-id="t1"]')!;
      expect(wrapper.querySelector('.custom-action')).to.exist;
    });
  });

  describe('wrapRow', () => {
    it('renders the built-in row unwrapped when unset (default)', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      await nextFrame();
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      // Boolean comparison, not a direct DOM-element assertion -- see this repo's own documented
      // chai/loupe DOM-node-serialization hang pitfall in AGENTS.md's testing conventions.
      expect(list.shadowRoot!.querySelector('.row-wrapper') === null).to.be.true;
      expect(dataRow(el, 't1').title).to.equal('Today thread');
    });

    it('lets wrapRow wrap the built-in row with host-supplied content that has no home in its own slots (e.g. a leading purpose icon)', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      el.wrapRow = (thread, row) =>
        html`<div class="row-wrapper" data-thread-id=${thread.id}><span class="purpose-icon">*</span>${row}</div>`;
      await el.updateComplete;
      await nextFrame();
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const wrapper = list.shadowRoot!.querySelector('.row-wrapper[data-thread-id="t1"]');
      expect(wrapper !== null).to.be.true;
      expect(wrapper!.querySelector('.purpose-icon')!.textContent).to.equal('*');
      // The wrapped lr-conversation-item is still the real, functional row -- not a static copy.
      const wrappedRow = wrapper!.querySelector('lr-conversation-item') as LyraConversationItem;
      expect(wrappedRow.title).to.equal('Today thread');
    });

    it('still fires lr-select from a wrapped row', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      el.wrapRow = (_thread, row) => html`<div class="row-wrapper">${row}</div>`;
      await el.updateComplete;
      await nextFrame();
      const row = dataRow(el, 't1');
      const selectPromise = oneEvent(el, 'lr-select');
      row.dispatchEvent(new CustomEvent('lr-select', { bubbles: true, composed: true }));
      expect((await selectPromise).detail).to.deep.equal({ id: 't1' });
    });
  });

  describe('search', () => {
    it('filters synchronously and fires lr-filter-change with the match count', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

      const eventPromise = oneEvent(el, 'lr-filter-change');
      input.value = 'today';
      input.dispatchEvent(new Event('input'));
      const ev = await eventPromise;
      expect(ev.detail).to.deep.equal({ text: 'today', matchCount: 1 });
    });

    it('matches against excerpt too, case-insensitively', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.value = 'HELLO';
      input.dispatchEvent(new Event('input'));
      await el.updateComplete;
      expect(renderedThreadIds(el)).to.deep.equal(['t1']);
    });

    it('supports a custom filter override', async () => {
      const el = (await fixture(
        html`<lr-thread-list
          style="block-size:400px"
          searchable
          .threads=${threads}
          .filter=${(t: { id: string }, q: string) => t.id.includes(q)}
        ></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.value = 'p1';
      input.dispatchEvent(new Event('input'));
      await el.updateComplete;
      expect(renderedThreadIds(el)).to.deep.equal(['p1']);
    });

    it('shows threadListEmpty with no query and noMatches once a query has zero results', async () => {
      const el = (await fixture(
        html`<lr-thread-list searchable .threads=${[]}></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No conversations yet');

      const withThreads = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      await withThreads.updateComplete;
      const input = withThreads.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.value = 'zzz-no-match';
      input.dispatchEvent(new Event('input'));
      await withThreads.updateComplete;
      expect(withThreads.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No matches');
    });

    it('ArrowDown from the search field moves focus into the first row', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      await nextFrame();
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
      await el.updateComplete;
      const firstRow = dataRows(el)[0];
      expect(firstRow.shadowRoot!.activeElement).to.exist;
    });
  });

  it('ArrowDown/ArrowUp rove focus across rendered rows', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} grouping="none"></lr-thread-list>`,
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const rows = dataRows(el);
    const firstOption = rows[0].shadowRoot!.querySelector('[part="option"]') as HTMLElement;
    firstOption.focus();

    el.shadowRoot!
      .querySelector('[part="list"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await nextFrame();
    const secondOption = rows[1].shadowRoot!.querySelector('[part="option"]');
    expect(document.activeElement).to.exist; // focus moved somewhere inside the shadow tree
    expect(rows[1].shadowRoot!.activeElement).to.equal(secondOption);
  });

  it('warns and prefers threads (data mode) when both threads and slotted content are supplied', async () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}><lr-conversation-item title="ignored"></lr-conversation-item
        ></lr-thread-list>`,
      )) as LyraThreadList;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
      expect(calls.some((args) => String(args[0]).includes('lr-thread-list'))).to.be.true;
    } finally {
      console.warn = originalWarn;
    }
  });
});

it('is accessible in both modes', async () => {
  const dataMode = (await fixture(
    html`<lr-thread-list style="block-size:400px" searchable .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lr-thread-list>`,
  )) as LyraThreadList;
  await dataMode.updateComplete;
  await expect(dataMode).to.be.accessible();

  const slottedMode = (await fixture(
    html`<lr-thread-list><lr-conversation-item title="Row"></lr-conversation-item></lr-thread-list>`,
  )) as LyraThreadList;
  await expect(slottedMode).to.be.accessible();
});

it('renders first-class leading, meta, and row-content hooks inside virtualized rows', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      grouping="none"
      .threads=${threads.slice(0, 1)}
      .renderLeading=${() => html`<span data-testid="leading">Purpose</span>`}
      .renderMeta=${() => html`<span data-testid="meta">3 sources</span>`}
      .renderRowContent=${() => html`<strong data-testid="content">Custom row body</strong>`}
    ></lr-thread-list>`,
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const row = dataRows(el)[0];
  expect(row.querySelector('[slot="leading"] [data-testid="leading"]')).to.exist;
  expect(row.querySelector('[slot="meta"] [data-testid="meta"]')).to.exist;
  expect(row.querySelector('[slot="content"] [data-testid="content"]')).to.exist;
  expect(row.shadowRoot!.querySelector('[part="title"]')).to.not.exist;
});

it('exports the real viewport and hook wrappers as externally styleable parts', async () => {
  const wrapper = await fixture(html`
    <div>
      <style>
        lr-thread-list::part(viewport) { scrollbar-gutter: stable; }
        lr-thread-list::part(row-leading) {
          color: rgb(12, 34, 56);
          --lr-theme-color-brand-fill-loud: rgb(21, 43, 65);
        }
      </style>
      <lr-thread-list
        style="block-size:400px"
        grouping="none"
        .threads=${threads.slice(0, 1)}
        .renderLeading=${() => html`<lr-chip tone="brand">Purpose</lr-chip>`}
        .renderMeta=${() => html`<span>Meta</span>`}
        .renderRowContent=${() => html`<span>Content</span>`}
        .renderActions=${() => html`<button type="button">Action</button>`}
      ></lr-thread-list>
    </div>
  `);
  const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  const viewport = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const leading = list.shadowRoot!.querySelector('[part~="row-leading"]') as HTMLElement;
  const chipBase = leading.querySelector('lr-chip')!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(getComputedStyle(viewport).scrollbarGutter).to.equal('stable');
  expect(getComputedStyle(leading).color).to.equal('rgb(12, 34, 56)');
  expect(getComputedStyle(chipBase).color).to.equal('rgb(21, 43, 65)');
  expect(list.getAttribute('exportparts')).to.contain('row-meta:row-meta');
  expect(list.getAttribute('exportparts')).to.contain('row-content:row-content');
  expect(list.getAttribute('exportparts')).to.contain('row-actions:row-actions');
});

it('allows group labels and month dates to be formatted by the host', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      .threads=${threads}
      .formatGroupLabel=${(key: string, date?: Date) => `custom:${key}:${date?.getFullYear() ?? ''}`}
    ></lr-thread-list>`,
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const groups = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelectorAll('[part~="group-label"]');
  expect([...groups].some((group) => group.textContent?.includes('custom:today'))).to.be.true;
});
