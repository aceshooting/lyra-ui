import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './thread-list.js';
import '../../overlays/chip/chip.js';
import '../../layout/menu/menu.js';
import '../../layout/menu/menu-item.js';
import type { LyraThreadList } from './thread-list.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraMenu } from '../../layout/menu/menu.class.js';
import { styles } from './thread-list.styles.js';

type ChatThreadLike = { id: string };
type RenderedThreadListItem = { kind: 'group'; id: string; label: string } | { kind: 'thread'; thread: ChatThreadLike };

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

async function suppressExpectedDataSlotWarning(callback: () => Promise<void>): Promise<void> {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (!String(args[0]).includes('[lr-thread-list] both `threads` and slotted content')) {
      originalWarn(...args);
    }
  };
  try {
    await callback();
  } finally {
    console.warn = originalWarn;
  }
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
    html`<lr-thread-list searchable><lr-conversation-item title="Manual row"></lr-conversation-item></lr-thread-list>`
  )) as LyraThreadList;
  expect(el.threads).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="list"]')!.getAttribute('role')).to.equal('list');
  expect(el.querySelector('lr-conversation-item')).to.exist;
});

it('leaves row navigation untouched for a foreign-realm group-toggle descendant', async () => {
  const el = (await fixture(html`<lr-thread-list></lr-thread-list>`)) as LyraThreadList;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const toggle = iframe.contentDocument!.createElement('button');
    toggle.setAttribute('part', 'group-toggle');
    const icon = iframe.contentDocument!.createElement('span');
    toggle.append(icon);
    expect(icon instanceof Element, 'fixture really crosses constructor realms').to.equal(false);

    const access = el as unknown as {
      focusTaskGeneration: number;
      onListKeyDown(event: KeyboardEvent): void;
    };
    const before = access.focusTaskGeneration;
    access.onListKeyDown({
      key: 'ArrowDown',
      composedPath: () => [icon, toggle],
      preventDefault: () => undefined,
    } as unknown as KeyboardEvent);
    expect(access.focusTaskGeneration).to.equal(before);
  } finally {
    iframe.remove();
  }
});

it('applies the host accessible name to the element that owns the list role', async () => {
  const el = (await fixture(html`
    <lr-thread-list aria-label="Saved chats">
      <lr-conversation-item title="Manual row"></lr-conversation-item>
    </lr-thread-list>
  `)) as LyraThreadList;
  expect(el.shadowRoot!.querySelector('[part="list"]')!.getAttribute('aria-label')).to.equal('Saved chats');
});

it('restores injected slotted roles outside slotted mode and reapplies them on return/reconnect', async () => {
  const el = (await fixture(html`
    <lr-thread-list>
      <lr-conversation-item title="Manual row"></lr-conversation-item>
    </lr-thread-list>
  `)) as LyraThreadList;
  const row = el.querySelector('lr-conversation-item')!;
  expect(row.getAttribute('role')).to.equal('listitem');

  await suppressExpectedDataSlotWarning(async () => {
    el.threads = [{ id: 'data', title: 'Data row' }];
    await el.updateComplete;
    expect(row.hasAttribute('role')).to.be.false;

    el.threads = [];
    await el.updateComplete;
  });
  expect(row.getAttribute('role')).to.equal('listitem');

  el.remove();
  expect(row.hasAttribute('role')).to.be.false;
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(row.getAttribute('role')).to.equal('listitem');
  } finally {
    el.remove();
  }
});

it('preserves an author-supplied slotted role across mode changes and reconnects', async () => {
  const el = (await fixture(html`
    <lr-thread-list>
      <lr-conversation-item role="option" title="Manual row"></lr-conversation-item>
    </lr-thread-list>
  `)) as LyraThreadList;
  const row = el.querySelector('lr-conversation-item')!;
  expect(row.getAttribute('role')).to.equal('option');

  await suppressExpectedDataSlotWarning(async () => {
    el.threads = [{ id: 'data', title: 'Data row' }];
    await el.updateComplete;
    expect(row.getAttribute('role')).to.equal('option');

    el.threads = [];
    await el.updateComplete;
  });
  expect(row.getAttribute('role')).to.equal('option');

  el.remove();
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(row.getAttribute('role')).to.equal('option');
  } finally {
    el.remove();
  }
});

it('restores a removed slotted child and marks its replacement as a list item', async () => {
  const el = (await fixture(html`
    <lr-thread-list>
      <lr-conversation-item title="First row"></lr-conversation-item>
    </lr-thread-list>
  `)) as LyraThreadList;
  const first = el.querySelector('lr-conversation-item')!;
  expect(first.getAttribute('role')).to.equal('listitem');

  const replacement = document.createElement('lr-conversation-item');
  replacement.setAttribute('title', 'Replacement row');
  first.replaceWith(replacement);
  await nextFrame();

  expect(first.hasAttribute('role')).to.be.false;
  expect(replacement.getAttribute('role')).to.equal('listitem');
});

describe('data mode', () => {
  it('renders one lr-conversation-item per non-archived thread by default, grouped by date', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(renderedThreadIds(el).length).to.equal(3); // archived excluded by default
    expect(renderedGroupLabels(el)).to.deep.equal(['Pinned', 'Today', 'Yesterday']);
  });

  it('contains long data rows inside an exact 320px RTL flex allocation', async () => {
    const long = 'ConversationIdentifierWithoutNaturalBreaks'.repeat(12);
    const container = (await fixture(html`
      <div dir="rtl" style="display:flex;inline-size:320px;block-size:260px">
        <lr-thread-list
          searchable
          show-archived
          active-id="rtl-active"
          .threads=${[
            { id: 'rtl-active', title: long, excerpt: long, pinned: true, timestamp: now },
            { id: 'rtl-archived', title: long, excerpt: long, archived: true, timestamp: now },
          ]}
          .rowActions=${['pin', 'archive', 'delete']}
        ></lr-thread-list>
      </div>
    `)) as HTMLDivElement;
    const el = container.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await waitUntil(() => dataRows(el).length > 0, 'the constrained RTL virtual rows were not mounted', {
      timeout: 3000,
    });

    expect(Math.round(container.getBoundingClientRect().width)).to.equal(320);
    expect(container.scrollWidth).to.be.at.most(container.clientWidth + 1);
    for (const row of dataRows(el)) {
      const wrapper = row.parentElement as HTMLElement;
      expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
    }
  });

  it('includes archived threads in a trailing Archived group when showArchived is set', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} show-archived></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    expect(renderedGroupLabels(el)).to.deep.equal(['Pinned', 'Today', 'Yesterday', 'Archived']);
  });

  it('uses the same controlled collapse model for built-in date groups', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
    )) as LyraThreadList;
    el.collapsedGroupIds = ['today'];
    await el.updateComplete;
    await nextFrame();

    expect(renderedGroupLabels(el)).to.include('Today');
    expect(renderedThreadIds(el)).to.not.include('t1');
    const todayToggle = [
      ...el
        .shadowRoot!.querySelector('lr-virtual-list')!
        .shadowRoot!.querySelectorAll<HTMLElement>('[part~="group-toggle"]'),
    ].find((button) => button.textContent?.includes('Today'))!;
    expect(todayToggle.getAttribute('aria-expanded')).to.equal('false');
  });

  it('gives the group-toggle a :hover rule matching its :focus-visible affordance', () => {
    // `:hover` can't be driven synthetically in this headless runner, so this proves the
    // stylesheet declares a real hover background for the part (mirroring the sibling
    // `row-action` rule in this same file), the same convention `<lr-artifact-panel>`'s own
    // hover-coverage test already uses for exactly this defect class.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /lr-virtual-list::part\(group-toggle\):hover\s*\{[^}]*background:\s*var\(--lr-color-surface-raised\)/
    );
  });

  it('grouping="none" renders every visible thread in host order with no group headers', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} grouping="none" show-archived></lr-thread-list>`
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
    const groupLabels = [...list.shadowRoot!.querySelectorAll('span[part~="group-label"]')].map((group) =>
      group.textContent?.trim()
    );
    expect(groupLabels).to.deep.equal(['beta:1', 'alpha:2']);
    expect(dataRows(el).map((row) => row.id)).to.deep.equal(['b1', 'a1', 'a2']);
    const toggles = [...list.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[part~="group-toggle"]')];
    expect(toggles.every((toggle) => !toggle.hasAttribute('aria-label'))).to.be.true;
    expect(toggles.map((toggle) => toggle.querySelector('[part~="group-label"]')?.textContent?.trim())).to.deep.equal([
      'beta:1',
      'alpha:2',
    ]);
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
      (button) => button.textContent?.includes('alpha')
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
        .getAttribute('aria-label')
    ).to.equal('Ouvrir alpha');

    el.collapsedGroupIds = [];
    await el.updateComplete;
    await nextFrame();
    expect(dataRows(el).map((row) => row.id)).to.deep.equal(['a1', 'b1']);
    await expect(el).to.be.accessible();
  });

  it('marks the row matching activeId as active', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} active-id="t1"></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const activeRow = dataRow(el, 't1');
    expect(activeRow.active).to.be.true;
    expect(activeRow.shadowRoot!.querySelectorAll('[part="active-indicator"]').length).to.equal(1);
  });

  it('keeps an off-window thread active when its id collides with a group key', async () => {
    const collidingThreads = Array.from({ length: 30 }, (_, index) => ({
      id: index === 29 ? 'group:today' : `ordinary-${index}`,
      title: `Thread ${index}`,
      group: 'today',
    }));
    const el = (await fixture(html`
      <lr-thread-list
        style="block-size:200px"
        grouping="custom"
        .threads=${collidingThreads}
        .groupBy=${(thread: { group: string }) => thread.group}
      ></lr-thread-list>
    `)) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();

    el.activeId = 'group:today';
    await el.updateComplete;
    await nextFrame();
    await nextFrame();

    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    expect(list.activeId).to.equal('thread:group:today');
    const targetIndex = (list.items as Array<{ kind: string; thread?: { id: string } }>).findIndex(
      (item) => item.kind === 'thread' && item.thread?.id === 'group:today'
    );
    expect(targetIndex).to.be.greaterThan(0);
    expect(list.keyFunction?.(list.items[targetIndex], targetIndex)).to.equal('thread:group:today');
    await waitUntil(
      () => dataRows(el).some((row) => row.id === 'group:today'),
      'the namespaced active thread was not mounted',
      { timeout: 3000 }
    );
    const target = dataRows(el).find((row) => row.id === 'group:today');
    expect(target !== undefined, 'the active thread is mounted instead of the colliding header').to.equal(true);
    expect(target?.active).to.equal(true);
    expect(viewportEl(el).scrollTop, 'the off-window thread was scrolled into view').to.be.greaterThan(0);
  });

  it('re-emits lr-select/lr-thread-rename with the thread id attached, and never leaks the original bare lr-select', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const row = dataRow(el, 't1');

    const selectEvents: CustomEvent[] = [];
    el.addEventListener('lr-select', (e) => selectEvents.push(e as CustomEvent));
    row.dispatchEvent(new CustomEvent('lr-select', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(
      selectEvents.length,
      'exactly one lr-select must reach the list, not the re-emit plus a leaked original'
    ).to.equal(1);
    expect(selectEvents[0]!.detail).to.deep.equal({ id: 't1' });

    const rawRenames: CustomEvent[] = [];
    el.addEventListener('lr-rename', (event) => rawRenames.push(event as CustomEvent));
    const renamePromise = oneEvent(el, 'lr-thread-rename');
    row.dispatchEvent(new CustomEvent('lr-rename', { detail: { title: 'New title' }, bubbles: true, composed: true }));
    expect((await renamePromise).detail).to.deep.equal({ id: 't1', title: 'New title' });
    expect(rawRenames).to.have.length(0);
  });

  describe('empty slot', () => {
    it('never renders slotted empty content while threads are populated (zero footprint, not merely styled away)', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}>
          <div slot="empty" id="custom-empty">No conversations.</div>
        </lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      await nextFrame();
      const custom = el.querySelector('#custom-empty')!;
      const box = custom.getBoundingClientRect();
      expect(box.width).to.equal(0);
      expect(box.height).to.equal(0);
      expect(dataRows(el).length).to.be.greaterThan(0);
    });

    it('renders slotted empty content (not the built-in state) once threads is empty', async () => {
      const el = (await fixture(
        html`<lr-thread-list>
          <div slot="empty" id="custom-empty">No conversations.</div>
        </lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      const custom = el.querySelector('#custom-empty')!;
      expect(custom.getBoundingClientRect().height).to.be.greaterThan(0);
      expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
    });

    it('still renders the built-in empty state when nothing is slotted', async () => {
      const el = (await fixture(html`<lr-thread-list></lr-thread-list>`)) as LyraThreadList;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
    });

    it('keeps hasEmptySlot accurate for content slotted after connect even while threads stay populated', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      const custom = document.createElement('div');
      custom.setAttribute('slot', 'empty');
      custom.id = 'late-empty';
      custom.textContent = 'No conversations.';
      el.append(custom);
      await el.updateComplete;
      // Still populated -- must stay invisible, but the slot must have registered the addition.
      expect(custom.getBoundingClientRect().height).to.equal(0);
      el.threads = [];
      await el.updateComplete;
      // Now empty -- the late-added slotted content must be picked up, not the built-in state.
      expect(custom.getBoundingClientRect().height).to.be.greaterThan(0);
      expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
    });
  });

  it('forwards editable via a property binding so editable=false actually disables row rename', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} editable></lr-thread-list>`
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

  it('disables row rename via the plain editable="false" attribute, not just a property binding', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} editable="false"></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(el.editable).to.be.false;
    const row = dataRow(el, 't1');
    expect(row.editable).to.be.false;
  });

  it('renders row actions with controlled pin/archive/delete events carrying the requested state', async () => {
    const el = (await fixture(
      html`<lr-thread-list
        style="block-size:400px"
        .threads=${threads}
        .rowActions=${['pin', 'archive', 'delete']}
      ></lr-thread-list>`
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
      html`<lr-thread-list
        style="block-size:400px"
        .threads=${threads}
        .rowActions=${['pin', 'archive', 'delete']}
      ></lr-thread-list>`
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
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list
          style="block-size:400px"
          .threads=${threads}
          .rowActions=${['pin', 'archive', 'delete']}
        ></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" .threads=${threads} .rowActions=${['pin']}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
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

    it('paints a real open menu in an earlier virtual row above the later rows it overlaps', async () => {
      const el = (await fixture(
        html`<lr-thread-list
          grouping="none"
          style="block-size:240px"
          .threads=${threads.filter((thread) => !thread.archived)}
          .renderActions=${(thread: { id: string }) => html`
            <lr-menu id="menu-${thread.id}" label="Conversation actions" placement="bottom-end">
              <button slot="trigger" type="button" aria-label="Conversation actions">⋮</button>
              <lr-menu-item id="item-${thread.id}" value="rename">Rename</lr-menu-item>
              <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
            </lr-menu>
          `}
        ></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      await nextFrame();

      const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
      const rowBoxes = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
      const firstMenu = dataRows(el)[0].querySelector<LyraMenu>('lr-menu')!;
      const firstRowBox = rowBoxes.find((row) => row.querySelector('#menu-p1'))!;
      expect(getComputedStyle(firstRowBox).zIndex).to.equal('auto');

      firstMenu.show();
      await firstMenu.updateComplete;
      await nextFrame();
      expect(firstMenu.open).to.equal(true);
      expect(getComputedStyle(firstRowBox).zIndex).to.equal('1');

      const popupRect = firstMenu.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!.getBoundingClientRect();
      const overlappingLaterRow = rowBoxes
        .filter((row) => row !== firstRowBox)
        .find((row) => {
          const rect = row.getBoundingClientRect();
          return (
            Math.min(popupRect.right, rect.right) > Math.max(popupRect.left, rect.left) &&
            Math.min(popupRect.bottom, rect.bottom) > Math.max(popupRect.top, rect.top)
          );
        });
      expect(overlappingLaterRow !== undefined).to.equal(true);

      const laterRect = overlappingLaterRow!.getBoundingClientRect();
      const x = (Math.max(popupRect.left, laterRect.left) + Math.min(popupRect.right, laterRect.right)) / 2;
      const y = (Math.max(popupRect.top, laterRect.top) + Math.min(popupRect.bottom, laterRect.bottom)) / 2;
      const topmost = list.shadowRoot!.elementFromPoint(x, y);
      expect(topmost === firstMenu || (topmost !== null && firstMenu.contains(topmost))).to.equal(true);
    });

    it('is re-invoked per row with the current thread on every render (not memoized)', async () => {
      const received: string[] = [];
      const localThreads = [{ id: 't1', title: 'Today thread', timestamp: now }];
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${localThreads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.value = 'HELLO';
      input.dispatchEvent(new Event('input'));
      await el.updateComplete;
      expect(renderedThreadIds(el)).to.deep.equal(['t1']);
    });

    it('case-folds search with the effective locale and locale-formats announced match counts', async () => {
      const el = (await fixture(html`
        <lr-thread-list
          lang="tr-u-nu-arab"
          style="block-size:400px"
          searchable
          grouping="none"
          .threads=${[
            { id: 'one', title: 'ISPARTA' },
            { id: 'two', title: 'IĞDIR' },
          ]}
          .strings=${{ threadListMatchAnnounce: 'MATCHES {count}' }}
        ></lr-thread-list>
      `)) as LyraThreadList;
      const liveRegion = el.shadowRoot!.querySelector('lr-live-region')!;
      liveRegion.throttleMs = 0;
      await liveRegion.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.value = 'ı';
      input.dispatchEvent(new Event('input'));
      await el.updateComplete;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(renderedThreadIds(el)).to.deep.equal(['one', 'two']);
      const region = liveRegion.shadowRoot!.querySelector('[part="region"]')!;
      expect(region.textContent).to.equal(`MATCHES ${new Intl.NumberFormat('tr-u-nu-arab').format(2)}`);
    });

    it('supports a custom filter override', async () => {
      const el = (await fixture(
        html`<lr-thread-list
          style="block-size:400px"
          searchable
          .threads=${threads}
          .filter=${(t: { id: string }, q: string) => t.id.includes(q)}
        ></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.value = 'p1';
      input.dispatchEvent(new Event('input'));
      await el.updateComplete;
      expect(renderedThreadIds(el)).to.deep.equal(['p1']);
    });

    it('shows threadListEmpty with no query and noMatches once a query has zero results', async () => {
      const el = (await fixture(html`<lr-thread-list searchable .threads=${[]}></lr-thread-list>`)) as LyraThreadList;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No conversations yet');

      const withThreads = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`
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
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      await nextFrame();
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
      await el.updateComplete;
      const firstRow = dataRows(el)[0];
      expect(firstRow.shadowRoot!.activeElement != null).to.equal(true);
    });

    it("colors the search-input's placeholder text instead of leaving the UA default", async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
      const placeholderStyle = getComputedStyle(input, '::placeholder');

      // Resolve the --lr-color-text-quiet token the same way the stylesheet does, via a probe
      // element in the same shadow tree, rather than hardcoding an expected color string.
      const probe = document.createElement('span');
      probe.setAttribute('style', 'color: var(--lr-color-text-quiet)');
      el.shadowRoot!.appendChild(probe);
      const expectedColor = getComputedStyle(probe).color;
      probe.remove();

      expect(placeholderStyle.color).to.equal(expectedColor);
    });

    it('bridges native focus/blur on the search input to the host, since neither crosses the shadow boundary on its own', async () => {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" searchable .threads=${threads}></lr-thread-list>`
      )) as LyraThreadList;
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;

      const focusPromise = oneEvent(el, 'focus');
      input.dispatchEvent(new FocusEvent('focus'));
      await focusPromise;

      const blurPromise = oneEvent(el, 'blur');
      input.dispatchEvent(new FocusEvent('blur'));
      await blurPromise;
    });
  });

  it('ArrowDown/ArrowUp rove focus across rendered rows', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads} grouping="none"></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const rows = dataRows(el);
    const firstOption = rows[0].shadowRoot!.querySelector('[part="option"]') as HTMLElement;
    firstOption.focus();

    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    await nextFrame();
    const secondOption = rows[1].shadowRoot!.querySelector('[part="option"]');
    expect(document.activeElement != null).to.equal(true); // focus moved somewhere inside the shadow tree
    expect(rows[1].shadowRoot!.activeElement === secondOption).to.equal(true);
  });

  it('skips a row whose wrapRow ancestor is inert instead of stranding arrow focus', async () => {
    const el = (await fixture(html`
      <lr-thread-list
        style="block-size:400px"
        grouping="none"
        .threads=${[
          { id: 'first', title: 'First' },
          { id: 'inert-middle', title: 'Unavailable' },
          { id: 'third', title: 'Third' },
        ]}
        .wrapRow=${(thread: { id: string }, row: unknown) =>
          thread.id === 'inert-middle' ? html`<div inert>${row}</div>` : row}
      ></lr-thread-list>
    `)) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    dataRow(el, 'first').shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.focus();

    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    await nextFrame();

    const focusedId =
      dataRows(el).find((row) => row.shadowRoot!.activeElement?.getAttribute('part') === 'option')?.id ?? 'none';
    expect(focusedId).to.equal('third');
  });

  it('does not reinterpret row-navigation keys originating on a group toggle', async () => {
    const el = (await fixture(html`
      <lr-thread-list
        style="block-size:400px"
        grouping="custom"
        .threads=${[
          { id: 'a', title: 'Alpha', group: 'first' },
          { id: 'b', title: 'Beta', group: 'second' },
        ]}
        .groupBy=${(thread: { group: string }) => thread.group}
      ></lr-thread-list>
    `)) as LyraThreadList;
    await nextFrame();
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const toggles = [...list.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="group-toggle"]')];
    toggles[1]!.focus();
    toggles[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    expect(list.shadowRoot!.activeElement?.textContent?.trim()).to.contain('second');
  });

  it('warns and prefers threads (data mode) when both threads and slotted content are supplied', async () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const el = (await fixture(
        html`<lr-thread-list style="block-size:400px" .threads=${threads}
          ><lr-conversation-item title="ignored"></lr-conversation-item
        ></lr-thread-list>`
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
    html`<lr-thread-list
      style="block-size:400px"
      searchable
      .threads=${threads}
      .rowActions=${['pin', 'archive', 'delete']}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await dataMode.updateComplete;
  await expect(dataMode).to.be.accessible();

  const slottedMode = (await fixture(
    html`<lr-thread-list><lr-conversation-item title="Row"></lr-conversation-item></lr-thread-list>`
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
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const row = dataRows(el)[0];
  expect(row.querySelector('[slot="leading"] [data-testid="leading"]')).to.exist;
  expect(row.querySelector('[slot="meta"] [data-testid="meta"]')).to.exist;
  expect(row.querySelector('[slot="content"] [data-testid="content"]')).to.exist;
  expect(row.shadowRoot!.querySelector('[part="title"]')).to.not.exist;
});

it('makes injected row-content hooks noninteractive inside the selectable option', async () => {
  const el = (await fixture(html`
    <lr-thread-list
      grouping="none"
      .threads=${threads.slice(0, 1)}
      .renderLeading=${() => html`<button type="button">Nested action</button>`}
    ></lr-thread-list>
  `)) as LyraThreadList;
  await nextFrame();
  const row = dataRows(el)[0]!;
  const wrapper = row.querySelector('[slot="leading"]') as HTMLElement;
  const nested = wrapper.querySelector('button')!;
  expect(wrapper.inert).to.be.true;
  nested.focus();
  expect(row.querySelector(':focus')?.localName).to.not.equal('button');
});

it("renders a renderExcerpt hook into the row item's excerpt slot, winning over the excerpt property", async () => {
  const el = (await fixture(
    html`<lr-thread-list
      grouping="none"
      .threads=${[{ id: 't1', title: 'Thread 1', excerpt: 'plain excerpt' }]}
      .renderExcerpt=${() => html`<mark data-testid="excerpt">rich <b>match</b></mark>`}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const row = dataRows(el)[0];
  const slotted = row.querySelector('[slot="excerpt"] [data-testid="excerpt"]');
  expect(slotted != null).to.equal(true);
  expect(slotted!.textContent).to.contain('rich');

  await row.updateComplete;
  const excerptPart = row.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement;
  // Slotted content wins over the plain-string `excerpt` property per lr-conversation-item's own
  // slot doc -- the plain "plain excerpt" text must not be what's rendered.
  expect(excerptPart.textContent).to.not.contain('plain excerpt');
});

it('gives renderExcerpt marks token-driven default highlight styling', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      grouping="none"
      .threads=${[{ id: 't1', title: 'Thread 1', excerpt: 'plain excerpt' }]}
      .renderExcerpt=${() => html`
        <span
          data-testid="highlight-reference"
          style="
            background:var(--lr-color-warning-quiet);
            color:inherit;
            border-radius:var(--lr-radius-xs);
            padding:0;
          "
        ></span>
        <mark data-testid="highlight">match</mark>
      `}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const row = dataRows(el)[0];
  const mark = row.querySelector<HTMLElement>('[data-testid="highlight"]')!;
  const reference = row.querySelector<HTMLElement>('[data-testid="highlight-reference"]')!;
  const actual = getComputedStyle(mark);
  const expected = getComputedStyle(reference);

  expect(actual.backgroundColor).to.equal(expected.backgroundColor);
  expect(actual.color).to.equal(expected.color);
  expect(actual.borderRadius).to.equal(expected.borderRadius);
  expect(actual.paddingTop).to.equal(expected.paddingTop);
  expect(actual.paddingRight).to.equal(expected.paddingRight);
});

it('themes renderExcerpt marks through component-scoped custom properties', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      grouping="none"
      style="
        --lr-thread-list-excerpt-highlight-background:rgb(1, 2, 3);
        --lr-thread-list-excerpt-highlight-foreground:rgb(4, 5, 6);
        --lr-thread-list-excerpt-highlight-radius:7px;
        --lr-thread-list-excerpt-highlight-padding:3px 5px;
      "
      .threads=${[{ id: 't1', title: 'Thread 1', excerpt: 'plain excerpt' }]}
      .renderExcerpt=${() => html`<mark data-testid="highlight">match</mark>`}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const mark = dataRows(el)[0].querySelector<HTMLElement>('[data-testid="highlight"]')!;
  const computed = getComputedStyle(mark);

  expect(computed.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(computed.color).to.equal('rgb(4, 5, 6)');
  expect(computed.borderRadius).to.equal('7px');
  expect(computed.paddingTop).to.equal('3px');
  expect(computed.paddingRight).to.equal('5px');
});

it('does not apply excerpt-highlight hooks to marks outside renderExcerpt', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      grouping="none"
      style="
        --lr-thread-list-excerpt-highlight-background:rgb(1, 2, 3);
        --lr-thread-list-excerpt-highlight-radius:7px;
      "
      .threads=${[{ id: 't1', title: 'Thread 1', excerpt: 'plain excerpt' }]}
      .renderRowContent=${() => html`<mark data-testid="content-mark">content</mark>`}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const mark = dataRows(el)[0].querySelector<HTMLElement>('[data-testid="content-mark"]')!;
  const computed = getComputedStyle(mark);

  expect(computed.backgroundColor).to.not.equal('rgb(1, 2, 3)');
  expect(computed.borderRadius).to.not.equal('7px');
});

it('leaves rendering unchanged when renderExcerpt is unset', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      grouping="none"
      .threads=${[{ id: 't1', title: 'Thread 1', excerpt: 'plain excerpt' }]}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const row = dataRows(el)[0];
  expect(row.querySelector('[slot="excerpt"]')).to.not.exist;
  await row.updateComplete;
  expect(row.shadowRoot!.querySelector('[part="excerpt"]')!.textContent).to.contain('plain excerpt');
});

it('exports the real viewport and hook wrappers as externally styleable parts', async () => {
  const wrapper = await fixture(html`
    <div>
      <style>
        lr-thread-list::part(viewport) {
          scrollbar-gutter: stable;
        }
        lr-thread-list::part(row-leading) {
          color: rgb(12, 34, 56);
          --lr-theme-color-brand-fill-loud: rgb(21, 43, 65);
        }
      </style>
      <lr-thread-list
        style="block-size:400px"
        grouping="none"
        .threads=${threads.slice(0, 1)}
        .renderLeading=${() => html`<lr-chip variant="brand">Purpose</lr-chip>`}
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
  expect(list.getAttribute('exportparts')).to.contain('row-excerpt:row-excerpt');
  expect(list.getAttribute('exportparts')).to.contain('row-item-active-indicator:row-item-active-indicator');
});

it('allows group labels and month dates to be formatted by the host', async () => {
  const el = (await fixture(
    html`<lr-thread-list
      .threads=${threads}
      .formatGroupLabel=${(key: string, date?: Date) => `custom:${key}:${date?.getFullYear() ?? ''}`}
    ></lr-thread-list>`
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const groups = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelectorAll('[part~="group-label"]');
  expect([...groups].some((group) => group.textContent?.includes('custom:today'))).to.be.true;
});

// 60 rows: comfortably more than any viewport under test can show at once, so the internal
// virtual list always has something to scroll regardless of which container height is applied.
const manyThreads = Array.from({ length: 60 }, (_, i) => ({
  id: `m${i}`,
  title: `Thread ${i}`,
  timestamp: now,
}));

/** The internal `lr-virtual-list`'s real scroll container -- the box whose height decides how much
 *  of the list is visible at once. */
function viewportEl(el: LyraThreadList): HTMLElement {
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  return list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
}

/** `--lr-virtual-list-height`'s shipped default (`var(--lr-size-24rem)`) in px, resolved against
 *  the document's real root font size rather than hardcoding 384. */
function defaultViewportPx(): number {
  return 24 * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

describe('internal virtual-list sizing', () => {
  // Regression guard, written before the sizing fix: an auto-height container gives the host no
  // resolvable height, so anything percentage-based (`--lr-virtual-list-height: 100%`) either
  // collapses the viewport to 0 or lets it grow to the full un-virtualized content height. The
  // shipped 24rem default has to survive there byte-for-byte.
  it('keeps the shipped 24rem viewport default in an auto-height container', async () => {
    const wrapper = await fixture(html`
      <div style="display:flex; flex-direction:column;">
        <lr-thread-list grouping="none" .threads=${manyThreads}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(viewportEl(el).getBoundingClientRect().height).to.be.closeTo(defaultViewportPx(), 1);
  });

  it('keeps a non-zero viewport in an auto-height container with zero rows', async () => {
    const wrapper = await fixture(html`
      <div style="display:flex; flex-direction:column;">
        <lr-thread-list grouping="none" .threads=${[{ id: 'only', title: 'Only', timestamp: now }]}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(viewportEl(el).getBoundingClientRect().height).to.be.closeTo(defaultViewportPx(), 1);
  });

  it('scrolls over the full height of a bounded flex pane with no consumer CSS', async () => {
    const wrapper = await fixture(html`
      <div style="block-size:700px; display:flex; flex-direction:column;">
        <lr-thread-list grouping="none" .threads=${manyThreads}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const viewport = viewportEl(el);
    expect(viewport.getBoundingClientRect().height).to.be.closeTo(700, 1);
    expect(viewport.scrollHeight).to.be.greaterThan(viewport.clientHeight);
  });

  it('shrinks below the 24rem default when the bounded pane is shorter than it', async () => {
    const wrapper = await fixture(html`
      <div style="block-size:200px; display:flex; flex-direction:column;">
        <lr-thread-list grouping="none" .threads=${manyThreads}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(viewportEl(el).getBoundingClientRect().height).to.be.closeTo(200, 1);
  });

  it('leaves room for the search field when searchable', async () => {
    const wrapper = await fixture(html`
      <div style="block-size:700px; display:flex; flex-direction:column;">
        <lr-thread-list searchable grouping="none" .threads=${manyThreads}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const searchHeight = (el.shadowRoot!.querySelector('[part="search"]') as HTMLElement).getBoundingClientRect()
      .height;
    expect(searchHeight).to.be.greaterThan(0);
    expect(viewportEl(el).getBoundingClientRect().height).to.be.closeTo(700 - searchHeight, 1);
  });
});

describe('wrapRow row-wrapper part', () => {
  /** Every rendered `[part="row"]` box height in document order -- the boxes `lr-virtual-list`
   *  itself measures with its `ResizeObserver` to build the windowing offsets. */
  function rowBoxHeights(el: LyraThreadList): number[] {
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    return [...list.shadowRoot!.querySelectorAll('[part="row"]')].map((row) =>
      Number(row.getBoundingClientRect().height.toFixed(2))
    );
  }

  async function mount(wrapRow?: LyraThreadList['wrapRow']): Promise<LyraThreadList> {
    const el = (await fixture(
      html`<lr-thread-list
        style="block-size:400px"
        grouping="none"
        .threads=${manyThreads.slice(0, 12)}
      ></lr-thread-list>`
    )) as LyraThreadList;
    if (wrapRow) el.wrapRow = wrapRow;
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  // Written first: the library-added wrapper was originally omitted precisely because a new
  // element inside `[part="row"]` risks becoming a competing layout box and changing what the
  // virtual list measures. A plain, unstyled block wrapper contributes exactly its child's height,
  // so every measured row box must stay identical to the no-`wrapRow` baseline.
  it('does not change measured row heights versus a no-wrapRow baseline', async () => {
    const baseline = rowBoxHeights(await mount());
    const wrapped = rowBoxHeights(await mount((_thread, row) => row));
    expect(baseline.length).to.be.greaterThan(0);
    expect(wrapped).to.deep.equal(baseline);
  });

  it('wraps wrapRow output in part="row-wrapper", reachable through the exportparts alias', async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-thread-list::part(row-wrapper) {
            background-color: rgb(9, 8, 7);
          }
        </style>
        <lr-thread-list style="block-size:400px" grouping="none" .threads=${manyThreads.slice(0, 3)}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    el.wrapRow = (thread, row) => html`<span data-thread-id=${thread.id}>${row}</span>`;
    await el.updateComplete;
    await nextFrame();
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const wrappers = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="row-wrapper"]')];
    expect(wrappers.length).to.equal(3);
    expect(wrappers[0].querySelector('span[data-thread-id]') === null).to.be.false;
    expect(getComputedStyle(wrappers[0]).backgroundColor).to.equal('rgb(9, 8, 7)');
    expect(list.getAttribute('exportparts')).to.contain('row-wrapper:row-wrapper');
  });

  it('adds no wrapper at all when wrapRow is unset', async () => {
    const el = await mount();
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    expect(list.shadowRoot!.querySelector('[part~="row-wrapper"]') === null).to.be.true;
  });

  it('never wraps group headers -- the part is row-only', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
    )) as LyraThreadList;
    el.wrapRow = (_thread, row) => row;
    await el.updateComplete;
    await nextFrame();
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const headers = [...list.shadowRoot!.querySelectorAll('[part~="group-header"]')];
    expect(headers.length).to.be.greaterThan(0);
    expect(headers.every((header) => header.closest('[part~="row-wrapper"]') === null)).to.be.true;
  });

  it('still resolves rows and their [part="option"] through the extra wrapper level', async () => {
    const el = (await fixture(
      html`<lr-thread-list
        style="block-size:400px"
        searchable
        grouping="none"
        .threads=${manyThreads.slice(0, 6)}
      ></lr-thread-list>`
    )) as LyraThreadList;
    el.wrapRow = (_thread, row) => html`<span>${row}</span>`;
    await el.updateComplete;
    await nextFrame();
    const rows = dataRows(el);
    expect(rows.length).to.be.greaterThan(1);

    const input = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(rows[0].shadowRoot!.activeElement === rows[0].shadowRoot!.querySelector('[part="option"]')).to.equal(true);

    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    await nextFrame();
    expect(rows[1].shadowRoot!.activeElement === rows[1].shadowRoot!.querySelector('[part="option"]')).to.equal(true);
  });

  it('is accessible with wrapped rows', async () => {
    const el = (await fixture(
      html`<lr-thread-list
        style="block-size:400px"
        searchable
        grouping="none"
        .threads=${manyThreads.slice(0, 6)}
        .rowActions=${['pin', 'archive', 'delete']}
      ></lr-thread-list>`
    )) as LyraThreadList;
    el.wrapRow = (thread, row) => html`<span data-thread-id=${thread.id}>${row}</span>`;
    await el.updateComplete;
    await nextFrame();
    await expect(el).to.be.accessible();
  });
});

// In data mode this component builds the `<lr-conversation-item>` rows itself, two shadow roots
// deep (thread-list -> lr-virtual-list -> lr-conversation-item), so none of the item's own eleven
// parts were reachable from outside -- unlike slotted mode, where the consumer owns the element and
// can style all of them. Row density in particular lives entirely in unreachable declarations
// (`:host { font-size }` and `[part="base"] { padding }`), which forced consumers onto
// `::part(row) { --lr-theme-*: … }`: a whole-subtree retheme that also shrinks everything nested in
// the row, `renderActions` popups included.
describe('data-mode row part forwarding', () => {
  const injected: HTMLStyleElement[] = [];

  function injectStyle(cssText: string): void {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.append(style);
    injected.push(style);
  }

  afterEach(() => {
    for (const style of injected.splice(0)) style.remove();
  });

  const probeThreads = [{ id: 't1', title: 'Today thread', excerpt: 'hello there', timestamp: now }];

  async function mountRow(): Promise<{ el: LyraThreadList; row: LyraConversationItem }> {
    const el = (await fixture(
      html`<lr-thread-list
        grouping="none"
        .threads=${probeThreads}
        .renderLeading=${() => html`<span>L</span>`}
        .renderMeta=${() => html`<span>M</span>`}
        .renderActions=${() =>
          html`<span class="probe" style="padding-block: var(--lr-space-s); font-size: var(--lr-font-size-md-sm)"
            >⋯</span
          >`}
      ></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const row = dataRow(el, 't1');
    await row.updateComplete;
    return { el, row };
  }

  function partEl(row: LyraConversationItem, name: string): HTMLElement {
    return row.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  }

  it('forwards every lr-conversation-item part out under the row-item-* namespace', async () => {
    // `row-item-*`, not `row-*`: the existing `row-leading`/`row-content`/`row-meta`/`row-actions`/
    // `row-wrapper` parts wrap *callback output* this component renders, which is a different thing
    // from the item's own internals -- four of the eleven names would otherwise collide outright.
    const names = [
      'base',
      'option',
      'leading',
      'content',
      'title',
      'excerpt',
      'meta',
      'timestamp',
      'rename-button',
      'actions',
    ];
    injectStyle(
      names.map((name, i) => `lr-thread-list::part(row-item-${name}) { padding-block-start: ${i + 1}px; }`).join('\n')
    );
    const { row } = await mountRow();
    for (const [i, name] of names.entries()) {
      expect(getComputedStyle(partEl(row, name)).paddingBlockStart, `row-item-${name}`).to.equal(`${i + 1}px`);
    }
  });

  it('forwards the rename input part, which only exists while a row is being renamed', async () => {
    injectStyle('lr-thread-list::part(row-item-title-input) { padding-block-start: 7px; }');
    const { row } = await mountRow();
    partEl(row, 'rename-button').click();
    await row.updateComplete;
    expect(getComputedStyle(partEl(row, 'title-input')).paddingBlockStart).to.equal('7px');
  });

  it('lets a consumer set row density through ::part() without touching --lr-theme-*', async () => {
    const before = await mountRow();
    const baselineProbe = getComputedStyle(before.row.querySelector<HTMLElement>('.probe')!);
    const baselineProbePadding = baselineProbe.paddingBlockStart;
    const baselineProbeFontSize = baselineProbe.fontSize;
    expect(baselineProbePadding).to.not.equal('2px');

    injectStyle(`
      lr-thread-list::part(row-item-base) { padding-block: 2px; }
      lr-thread-list::part(row-item-title) { font-size: 12px; }
    `);
    const { row } = await mountRow();

    expect(getComputedStyle(partEl(row, 'base')).paddingBlockStart).to.equal('2px');
    expect(getComputedStyle(partEl(row, 'title')).fontSize).to.equal('12px');
    // The exact collateral damage the --lr-theme-* workaround caused: a control rendered by
    // `renderActions` must keep its own spacing and type scale.
    const probe = getComputedStyle(row.querySelector<HTMLElement>('.probe')!);
    expect(probe.paddingBlockStart).to.equal(baselineProbePadding);
    expect(probe.fontSize).to.equal(baselineProbeFontSize);
  });

  it('still leaks into renderActions content when density is set the old --lr-theme-* way', async () => {
    const before = await mountRow();
    expect(getComputedStyle(before.row.querySelector<HTMLElement>('.probe')!).paddingBlockStart).to.not.equal('2px');

    injectStyle('lr-thread-list::part(row) { --lr-theme-space-s: 2px; }');
    const { row } = await mountRow();

    expect(getComputedStyle(row.querySelector<HTMLElement>('.probe')!).paddingBlockStart).to.equal('2px');
  });

  it('is accessible with a part-styled dense row and a renderActions control', async () => {
    injectStyle(`
      lr-thread-list::part(row-item-base) { padding-block: 2px; }
      lr-thread-list::part(row-item-title) { font-size: 12px; }
    `);
    const { el } = await mountRow();
    await expect(el).to.be.accessible();
  });
});

it('resets the native search-cancel glyph on the search field', async () => {
  if (!CSS.supports('selector(input::-webkit-search-cancel-button)')) return;
  const el = (await fixture(
    html`<lr-thread-list style="inline-size: 320px" searchable .threads=${threads}></lr-thread-list>`,
  )) as LyraThreadList;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  const nativeDecoration = document.createElement('style');
  nativeDecoration.textContent = `
    [part='search-input']::-webkit-search-cancel-button {
      appearance: auto !important;
      -webkit-appearance: searchfield-cancel-button !important;
      display: block !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  `;
  el.shadowRoot!.append(nativeDecoration);
  input.focus();
  const rect = input.getBoundingClientRect();
  try {
    let cancelPosition: [number, number] | undefined;
    for (let offset = 2; offset <= 48; offset += 2) {
      input.value = 'clear me';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const candidate: [number, number] = [
        Math.round(rect.right - offset),
        Math.round(rect.top + rect.height / 2),
      ];
      await sendMouse({ type: 'click', position: candidate });
      if (input.value === '') {
        cancelPosition = candidate;
        break;
      }
    }
    expect(cancelPosition !== undefined, 'positive control exposes the native clear action').to.equal(true);

    nativeDecoration.remove();
    input.value = 'keep me';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await sendMouse({ type: 'click', position: cancelPosition! });
    expect(input.value, 'component styling removes the native clear action').to.equal('keep me');
  } finally {
    await resetMouse();
  }
});

describe('keyboard navigation past the rendered window', () => {
  async function mountKeyboardWindow(): Promise<LyraThreadList> {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-thread-list::part(row) {
            block-size: 48px;
            overflow: hidden;
          }
        </style>
        <lr-thread-list
          style="block-size:200px"
          grouping="none"
          searchable
          .threads=${manyThreads.slice(0, 20)}
        ></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;
    return el;
  }

  function startPastRenderedEdge(el: LyraThreadList): string {
    const rendered = dataRows(el);
    const last = rendered[rendered.length - 1]!;
    (last.shadowRoot!.querySelector('[part="option"]') as HTMLElement).focus();
    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    return rendered[0]!.id;
  }

  it('moves Home and End to the complete model boundaries from a middle virtual window', async () => {
    const el = await mountKeyboardWindow();
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    const listRegion = el.shadowRoot!.querySelector('[part="list"]')!;

    const focusMiddleWindow = async (): Promise<void> => {
      list.scrollToIndex(10, { align: 'start', behavior: 'auto' });
      await nextFrame();
      await list.updateComplete;
      const middle = dataRows(el).find((row) => row.id !== 'm0' && row.id !== 'm19')!;
      middle.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.focus();
    };

    await focusMiddleWindow();
    listRegion.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    await waitUntil(
      () =>
        dataRows(el).some((row) => row.id === 'm0' && row.shadowRoot!.activeElement?.getAttribute('part') === 'option'),
      'Home did not focus the first full-model thread',
      { timeout: 3000 }
    );

    await focusMiddleWindow();
    listRegion.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    await waitUntil(
      () =>
        dataRows(el).some(
          (row) => row.id === 'm19' && row.shadowRoot!.activeElement?.getAttribute('part') === 'option'
        ),
      'End did not focus the last full-model thread',
      { timeout: 3000 }
    );
  });

  it('skips collapsed groups and unavailable endpoint rows for full-model Home and End', async () => {
    const groupedThreads = [
      { id: 'hidden-first', title: 'Collapsed first', group: 'collapsed-first' },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `visible-${index}`,
        title: `Visible ${index}`,
        group: 'visible',
      })),
      { id: 'hidden-last', title: 'Collapsed last', group: 'collapsed-last' },
    ];
    const el = (await fixture(html`
      <lr-thread-list
        style="block-size:200px"
        grouping="custom"
        .threads=${groupedThreads}
        .groupBy=${(thread: { group: string }) => thread.group}
        .groupOrder=${['collapsed-first', 'visible', 'collapsed-last']}
        .collapsedGroupIds=${['collapsed-first', 'collapsed-last']}
        .wrapRow=${(thread: { id: string }, row: unknown) =>
          thread.id === 'visible-0' || thread.id === 'visible-19' ? html`<div inert>${row}</div>` : row}
      ></lr-thread-list>
    `)) as LyraThreadList;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    const listRegion = el.shadowRoot!.querySelector('[part="list"]')!;
    list.scrollToIndex(12, { align: 'start', behavior: 'auto' });
    await nextFrame();
    await list.updateComplete;
    dataRows(el)[0]!.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.focus();

    listRegion.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    await waitUntil(
      () =>
        dataRows(el).some(
          (row) => row.id === 'visible-1' && row.shadowRoot!.activeElement?.getAttribute('part') === 'option'
        ),
      'Home did not skip the collapsed group and inert first visible row',
      { timeout: 3000 }
    );

    list.scrollToIndex(12, { align: 'start', behavior: 'auto' });
    await nextFrame();
    await list.updateComplete;
    dataRows(el)[0]!.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.focus();
    listRegion.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    await waitUntil(
      () =>
        dataRows(el).some(
          (row) => row.id === 'visible-18' && row.shadowRoot!.activeElement?.getAttribute('part') === 'option'
        ),
      'End did not skip the collapsed group and inert last visible row',
      { timeout: 3000 }
    );
  });

  it('mounts and focuses the next row without dispatching a synthetic scroll event', async () => {
    // Pinning each row box to exactly the internal list's own unmeasured-row estimate keeps this
    // fixture's offsets stable as new rows mount: measurement then never moves an earlier row, so
    // the list's scroll-anchoring correction never runs and Chromium's ResizeObserver loop guard
    // stays out of it. What this test is about -- which rows exist, where focus lands, and what
    // events reach the scroll container -- is unaffected.
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-thread-list::part(row) {
            block-size: 48px;
            overflow: hidden;
          }
        </style>
        <lr-thread-list style="block-size:200px" grouping="none" .threads=${manyThreads.slice(0, 20)}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    const viewport = viewportEl(el);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    const scrollEvents: boolean[] = [];
    viewport.addEventListener('scroll', (e) => scrollEvents.push(e.isTrusted));

    const rowsBefore = dataRows(el);
    expect(rowsBefore.length).to.be.greaterThan(1);
    expect(rowsBefore.length, 'the window is smaller than the full list').to.be.lessThan(20);
    const lastId = rowsBefore[rowsBefore.length - 1].id;
    const expectedNextId = manyThreads[manyThreads.findIndex((thread) => thread.id === lastId) + 1]!.id;
    (rowsBefore[rowsBefore.length - 1].shadowRoot!.querySelector('[part="option"]') as HTMLElement).focus();

    const scrollComplete = oneEvent(list, 'lr-scroll');
    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    await scrollComplete;
    await list.updateComplete;
    await nextFrame();
    await el.updateComplete;

    const rowsAfter = dataRows(el);
    const newLast = rowsAfter[rowsAfter.length - 1];
    const focusedRowId =
      rowsAfter.find((row) => row.shadowRoot?.activeElement?.getAttribute('part') === 'option')?.id ?? 'no focused row';
    expect(newLast.id, 'a further row mounted past the previous window edge').to.not.equal(lastId);
    expect(viewport.scrollTop, 'the list actually scrolled').to.be.greaterThan(0);
    expect(focusedRowId, 'focus reaches the next row beyond the old window edge').to.equal(expectedNextId);

    expect(scrollEvents.length, 'the scroll really happened').to.be.greaterThan(0);
    expect(
      scrollEvents.every((trusted) => trusted),
      'no synthetic scroll event is dispatched at the child'
    ).to.be.true;
  });

  it('continues past an inert row mounted beyond the prior virtual window edge', async () => {
    const el = await mountKeyboardWindow();
    const rendered = dataRows(el);
    const last = rendered[rendered.length - 1]!;
    const lastIndex = manyThreads.findIndex((thread) => thread.id === last.id);
    const inertId = manyThreads[lastIndex + 1]!.id;
    const expectedId = manyThreads[lastIndex + 2]!.id;
    el.wrapRow = (thread, row) => (thread.id === inertId ? html`<div inert>${row}</div>` : row);
    await el.updateComplete;
    const currentLast = dataRows(el).find((row) => row.id === last.id)!;
    await currentLast.updateComplete;
    currentLast.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.focus();

    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    await waitUntil(
      () =>
        dataRows(el).some(
          (row) => row.id === expectedId && row.shadowRoot!.activeElement?.getAttribute('part') === 'option'
        ),
      'focus did not continue past the inert virtual row',
      { timeout: 3000 }
    );

    const focusedId =
      dataRows(el).find((row) => row.shadowRoot!.activeElement?.getAttribute('part') === 'option')?.id ?? 'none';
    expect(focusedId).to.equal(expectedId);
  });

  it('does nothing at the very end of the list', async () => {
    const el = (await fixture(
      html`<lr-thread-list
        style="block-size:400px"
        grouping="none"
        .threads=${manyThreads.slice(0, 3)}
      ></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const rows = dataRows(el);
    (rows[rows.length - 1].shadowRoot!.querySelector('[part="option"]') as HTMLElement).focus();

    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
    );
    await nextFrame();
    await nextFrame();
    expect(viewportEl(el).scrollTop).to.equal(0);
    const last = rows[rows.length - 1];
    expect(last.shadowRoot!.activeElement === last.shadowRoot!.querySelector('[part="option"]')).to.be.true;
  });

  it('does not let an older two-frame task override newer keyboard navigation', async () => {
    const el = await mountKeyboardWindow();
    const firstId = startPastRenderedEdge(el);
    el.shadowRoot!.querySelector('[part="list"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true })
    );

    await nextFrame();
    await nextFrame();
    const focusedId =
      dataRows(el).find((row) => row.shadowRoot!.activeElement?.getAttribute('part') === 'option')?.id ?? 'none';
    expect(focusedId).to.equal(firstId);
  });

  it('does not steal focus back from a search that supersedes edge navigation', async () => {
    const el = await mountKeyboardWindow();
    startPastRenderedEdge(el);
    const search = el.shadowRoot!.querySelector('[part="search-input"]') as HTMLInputElement;
    search.focus();
    search.value = 'thread';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('search-input');
  });

  it('cancels an edge-focus task across a disconnect and reconnect', async () => {
    const el = await mountKeyboardWindow();
    startPastRenderedEdge(el);
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);

    await nextFrame();
    await nextFrame();
    const focusedId =
      dataRows(el).find((row) => row.shadowRoot!.activeElement?.getAttribute('part') === 'option')?.id ?? 'none';
    expect(focusedId).to.equal('none');
  });
});

describe('sticky group headers', () => {
  // Two well-populated date groups, so there is something to scroll through *inside* a group and a
  // real boundary to cross -- a single group can never show the swap.
  const groupedThreads = [
    ...Array.from({ length: 25 }, (_, i) => ({ id: `today-${i}`, title: `Today thread ${i}`, timestamp: now })),
    ...Array.from({ length: 25 }, (_, i) => ({
      id: `yday-${i}`,
      title: `Yesterday thread ${i}`,
      timestamp: new Date(now.getTime() - DAY_MS),
    })),
  ];

  function virtualList(el: LyraThreadList): LyraVirtualList {
    return el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
  }

  function band(el: LyraThreadList): HTMLElement | null {
    return virtualList(el).shadowRoot!.querySelector<HTMLElement>('[part~="sticky-group"]');
  }

  async function mount(sticky: boolean): Promise<LyraThreadList> {
    const el = (await fixture(
      html`<lr-thread-list
        style="block-size:300px"
        ?sticky-groups=${sticky}
        .threads=${groupedThreads}
      ></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;
    return el;
  }

  async function scrollTo(el: LyraThreadList, top: number): Promise<void> {
    const viewport = viewportEl(el);
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;
    await nextFrame();
    await virtualList(el).updateComplete;
  }

  /** The index of a group header item inside the virtual list's own item array. */
  function groupIndex(el: LyraThreadList, id: string): number {
    return renderedItems(el).findIndex((item) => item.kind === 'group' && item.id === id);
  }

  it('pins the current group header and swaps it at the next group', async () => {
    const el = await mount(true);
    const list = virtualList(el);
    const viewport = viewportEl(el);

    const pinned = band(el);
    expect(pinned === null, 'a band is rendered for the first group').to.be.false;
    expect(pinned!.textContent).to.contain('Today');
    expect(pinned!.getBoundingClientRect().top).to.be.closeTo(viewport.getBoundingClientRect().top, 1);

    // Deep inside the Today group -- still pinned to the top of the viewport.
    await scrollTo(el, list.offsetForIndex(10));
    expect(band(el)!.textContent).to.contain('Today');
    expect(band(el)!.getBoundingClientRect().top).to.be.closeTo(viewport.getBoundingClientRect().top, 1);

    // Past the Yesterday header row.
    const yesterdayIndex = groupIndex(el, 'yesterday');
    expect(yesterdayIndex).to.be.greaterThan(0);
    await scrollTo(el, list.offsetForIndex(yesterdayIndex + 4));
    expect(band(el)!.textContent).to.contain('Yesterday');
  });

  it('keeps the pinned toggle clickable, emitting lr-group-toggle for the pinned group', async () => {
    const el = await mount(true);
    const pinnedToggle = band(el)!.querySelector<HTMLButtonElement>('[part~="group-toggle"]')!;
    expect(getComputedStyle(pinnedToggle).pointerEvents, 'the copy opts back into pointer events').to.equal('auto');

    const event = oneEvent(el, 'lr-group-toggle');
    pinnedToggle.click();
    const detail = (await event).detail;
    expect(detail.id).to.equal('today');
    expect(detail.collapsed).to.be.true;
  });

  it('keeps the real row as the only exposed heading, and adds no tab stop', async () => {
    const el = await mount(true);
    const root = virtualList(el).shadowRoot!;

    const realHeaders = [...root.querySelectorAll('[part~="group-header"][role="heading"]')];
    expect(realHeaders.length, 'the real group header row owns the heading').to.equal(1);
    expect(realHeaders[0].getAttribute('aria-level')).to.equal('2');

    const copy = band(el)!;
    expect(copy.getAttribute('aria-hidden')).to.equal('true');
    expect(copy.querySelector('[role="heading"]') === null, 'the copy is not a second heading').to.be.true;
    expect(copy.querySelector<HTMLElement>('[part~="group-toggle"]')!.tabIndex).to.equal(-1);

    // Every remaining Tab stop is a real row's, not the copy's.
    const tabbable = [...root.querySelectorAll<HTMLElement>('button, [tabindex]')].filter((node) => node.tabIndex >= 0);
    expect(tabbable.every((node) => node.closest('[part~="sticky-group"]') === null)).to.be.true;
  });

  it('renders exactly as before when sticky-groups is unset', async () => {
    const plain = await mount(false);
    const list = virtualList(plain);
    expect(band(plain) === null, 'no band element at all').to.be.true;
    expect(list.renderStickyGroup === undefined, 'no sticky callback is handed to the list').to.be.true;
    expect(list.groups === undefined, 'no position anchors are handed to the list').to.be.true;
    expect(plain.stickyGroups).to.be.false;
    expect(plain.hasAttribute('sticky-groups')).to.be.false;
    // The anchor-only entries must never render a second, empty group marker either.
    expect(list.shadowRoot!.querySelectorAll('[part="group"]').length).to.equal(0);

    const sticky = await mount(true);
    expect(sticky.hasAttribute('sticky-groups'), 'the attribute reflects').to.be.true;
    expect(virtualList(sticky).shadowRoot!.querySelectorAll('[part="group"]').length, 'still no markers').to.equal(0);
  });

  it('exports the band as the group-sticky part', async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-thread-list::part(group-sticky) {
            outline: 3px solid rgb(1, 2, 3);
          }
        </style>
        <lr-thread-list style="block-size:300px" sticky-groups .threads=${groupedThreads}></lr-thread-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;
    expect(virtualList(el).getAttribute('exportparts')).to.contain('sticky-group:group-sticky');
    expect(getComputedStyle(band(el)!).outlineColor).to.equal('rgb(1, 2, 3)');
  });

  it('is accessible with a pinned group header', async () => {
    const el = await mount(true);
    expect(band(el) === null, 'the band is present for the axe run').to.be.false;
    await expect(el).to.be.accessible();
  });
});

describe('compact forwarding', () => {
  it('forwards compact onto every data-mode row', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" compact .threads=${threads}></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    const rows = dataRows(el);
    expect(rows.length).to.be.greaterThan(0);
    expect(rows.filter((r) => r.compact).length).to.equal(rows.length);
    expect(rows.filter((r) => r.hasAttribute('compact')).length).to.equal(rows.length);
  });

  it('leaves data-mode rows without the compact attribute while unset, and toggles them live', async () => {
    const el = (await fixture(
      html`<lr-thread-list style="block-size:400px" .threads=${threads}></lr-thread-list>`
    )) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    expect(el.compact).to.be.false;
    expect(el.hasAttribute('compact')).to.be.false;
    expect(dataRows(el).filter((r) => r.hasAttribute('compact')).length).to.equal(0);

    el.compact = true;
    await el.updateComplete;
    await nextFrame();
    const rows = dataRows(el);
    expect(rows.filter((r) => r.hasAttribute('compact')).length).to.equal(rows.length);

    el.compact = false;
    await el.updateComplete;
    await nextFrame();
    expect(dataRows(el).filter((r) => r.hasAttribute('compact')).length).to.equal(0);
  });

  it('does not touch host-supplied items in slotted mode (documented no-op)', async () => {
    const el = (await fixture(html`
      <lr-thread-list compact>
        <lr-conversation-item id="s1" title="Manual row"></lr-conversation-item>
        <lr-conversation-item id="s2" title="Another manual row" compact></lr-conversation-item>
      </lr-thread-list>
    `)) as LyraThreadList;
    await el.updateComplete;
    await nextFrame();
    // Slotted mode: no internal virtual list at all, so nothing forwards anything.
    expect(el.shadowRoot!.querySelectorAll('lr-virtual-list').length).to.equal(0);
    expect(el.compact).to.be.true;

    const slotted = [...el.querySelectorAll<LyraConversationItem>('lr-conversation-item')];
    expect(slotted.length).to.equal(2);
    // The host owns its own items' density here, exactly as it owns every other row property.
    expect(slotted[0].hasAttribute('compact')).to.be.false;
    expect(slotted[0].compact).to.be.false;
    expect(slotted[1].compact).to.be.true;
  });
});
