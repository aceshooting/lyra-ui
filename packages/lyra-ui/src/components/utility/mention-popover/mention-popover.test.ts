import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './mention-popover.js';
import type { LyraMentionItem, LyraMentionPopover, LyraMentionSelectDetail } from './mention-popover.js';
import { styles } from './mention-popover.styles.js';

const ITEMS: LyraMentionItem[] = [
  { suggestionId: 'alice', label: 'Alice Johansson', description: 'Product design' },
  { suggestionId: 'bob', label: 'Bob Nakamura', icon: '🤖' },
  { suggestionId: 'carol', label: 'Carol Ibarra', description: 'Engineering' },
];

class MentionPopoverShadowHarness extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.append(document.createElement('lr-mention-popover'));
  }
}
customElements.define('mention-popover-shadow-harness', MentionPopoverShadowHarness);

function listbox(el: LyraMentionPopover): HTMLElement {
  return el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
}

function rows(el: LyraMentionPopover): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

async function openWithItems(items: LyraMentionItem[] = ITEMS): Promise<LyraMentionPopover> {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  el.anchor = anchor;
  el.items = items;
  el.open = true;
  await el.updateComplete;
  return el;
}

/** Polls until `read()` satisfies `until`, or throws once `timeoutMs` elapses -- same idiom as
 *  internal/positioner.test.ts's identical helper, for waiting out place()'s async computePosition. */
async function waitFor<T>(read: () => T, until: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = read();
    if (until(value)) return value;
    if (performance.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

it('renders items as listbox rows, with icon/description parts only when set', async () => {
  const el = await openWithItems();
  const optionEls = rows(el);
  expect(optionEls.length).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('[part="option-icon"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="option-description"]').length).to.equal(2);
});

it('shows the empty-text row when items is empty', async () => {
  const el = await openWithItems([]);
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty != null).to.equal(true);
  expect(empty.textContent).to.equal('No matches');
  expect(empty.getAttribute('role')).to.equal('option');
  expect(empty.getAttribute('aria-disabled')).to.equal('true');
});

it('filters items against query using the built-in case-insensitive label/description match', async () => {
  const el = await openWithItems();
  el.query = 'engineering';
  await el.updateComplete;
  expect(el.filteredItems.map((i) => i.suggestionId)).to.deep.equal(['carol']);
});

it('owns a frozen item snapshot so later caller mutation cannot silently alter suggestions', async () => {
  const source = ITEMS.map((item) => ({ ...item }));
  const el = await openWithItems(source);
  expect(el.items).to.not.equal(source);
  expect(Object.isFrozen(el.items)).to.equal(true);
  expect(Object.isFrozen(el.items[0])).to.equal(true);
  source.push({ suggestionId: 'late', label: 'Late mutation' });
  source[0]!.label = 'Mutated caller label';
  expect(el.filteredItems.length).to.equal(3);
  expect(el.filteredItems[0]!.label).to.equal('Alice Johansson');
});

it('uses the effective locale for built-in case-insensitive filtering', async () => {
  const el = await openWithItems([{ suggestionId: 'istanbul', label: 'İstanbul' }]);
  el.lang = 'tr';
  el.query = 'istanbul';
  await el.updateComplete;
  expect(el.filteredItems.map((i) => i.suggestionId)).to.deep.equal(['istanbul']);
});

it('overrides the built-in filter via the filter property', async () => {
  const el = await openWithItems();
  el.filter = (item, query) => item.suggestionId === query;
  el.query = 'bob';
  await el.updateComplete;
  expect(el.filteredItems.map((i) => i.suggestionId)).to.deep.equal(['bob']);
});

it('pre-highlights the first match (index 0) as soon as it opens', async () => {
  const el = await openWithItems();
  expect(el.activeDescendantId).to.equal(el.listboxId + '-opt-0');
});

it('resets the active row to the top match whenever query changes', async () => {
  const el = await openWithItems();
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  await el.updateComplete;
  expect(el.activeDescendantId).to.equal(el.listboxId + '-opt-1');

  el.query = 'carol';
  await el.updateComplete;
  expect(el.filteredItems.map((i) => i.suggestionId)).to.deep.equal(['carol']);
  expect(el.activeDescendantId).to.equal(el.listboxId + '-opt-0');
});

it('returns false from handleKeyDown while closed', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const consumed = el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  expect(consumed).to.be.false;
});

it('moves the active row with ArrowDown/ArrowUp, clamped at the ends', async () => {
  const el = await openWithItems();
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  await el.updateComplete;
  // 3 items -> clamps at index 2, doesn't wrap back to 0.
  expect(el.activeDescendantId).to.equal(el.listboxId + '-opt-2');

  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
  await el.updateComplete;
  expect(el.activeDescendantId).to.equal(el.listboxId + '-opt-0');
});

it("scrolls the active row into view as ArrowDown moves it past the popup's visible, height-capped area", async () => {
  const manyItems: LyraMentionItem[] = Array.from({ length: 20 }, (_, i) => ({
    suggestionId: `item-${i}`,
    label: `Item ${i}`,
  }));
  const el = await openWithItems(manyItems);
  const box = listbox(el);

  // The popup is height-capped (max-block-size: 16rem) and scrollable -- 20
  // rows overflow it, so arrowing this far down would otherwise leave the
  // active row scrolled out of view.
  for (let i = 0; i < 15; i++) {
    el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    await el.updateComplete;
  }

  const activeRow = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
  expect(activeRow != null).to.equal(true);
  const rowRect = activeRow.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  expect(rowRect.top >= boxRect.top - 1, 'active row top must be within the scrolled listbox viewport').to.be.true;
  expect(rowRect.bottom <= boxRect.bottom + 1, 'active row bottom must be within the scrolled listbox viewport').to.be
    .true;
});

it('ArrowDown/ArrowUp preventDefault and report the key as consumed', async () => {
  const el = await openWithItems();
  const evt = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    cancelable: true,
  });
  const consumed = el.handleKeyDown(evt);
  expect(consumed).to.be.true;
  expect(evt.defaultPrevented).to.be.true;
});

it('leaves ArrowDown/ArrowUp unconsumed when there is nothing to navigate (no matches)', async () => {
  const el = await openWithItems();
  el.query = 'zzz-no-match';
  await el.updateComplete;
  expect(el.filteredItems.length).to.equal(0);

  const downEvt = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    cancelable: true,
  });
  expect(el.handleKeyDown(downEvt), 'ArrowDown must fall through, e.g. so the host textarea still moves its caret').to
    .be.false;
  expect(downEvt.defaultPrevented).to.be.false;

  const upEvt = new KeyboardEvent('keydown', {
    key: 'ArrowUp',
    cancelable: true,
  });
  expect(el.handleKeyDown(upEvt)).to.be.false;
  expect(upEvt.defaultPrevented).to.be.false;
});

it('commits the active item on Enter: fires lr-mention-select, closes, and does not fire lr-mention-close', async () => {
  const el = await openWithItems();
  let closeFired = false;
  el.addEventListener('lr-mention-close', () => (closeFired = true));

  const listener = oneEvent(el, 'lr-mention-select');
  const evt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
  const consumed = el.handleKeyDown(evt);
  const { detail } = (await listener) as CustomEvent<LyraMentionSelectDetail>;

  expect(consumed).to.be.true;
  expect(evt.defaultPrevented).to.be.true;
  expect(Object.isFrozen(detail)).to.equal(true);
  expect(detail).to.deep.equal({ suggestionId: 'alice', index: 0, label: 'Alice Johansson' });
  expect(el.open).to.be.false;
  await el.updateComplete;
  expect(closeFired).to.be.false;
});

it('commits the active item on Tab, same as Enter', async () => {
  const el = await openWithItems();
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  await el.updateComplete;

  const listener = oneEvent(el, 'lr-mention-select');
  const consumed = el.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
  const { detail } = (await listener) as CustomEvent<LyraMentionSelectDetail>;
  expect(consumed).to.be.true;
  expect(detail).to.deep.equal({ suggestionId: 'bob', index: 1, label: 'Bob Nakamura' });
});

it('leaves Enter/Tab unconsumed when there is no active row to commit (no matches)', async () => {
  const el = await openWithItems();
  el.query = 'zzz-no-match';
  await el.updateComplete;
  expect(el.filteredItems.length).to.equal(0);

  const enterEvt = new KeyboardEvent('keydown', {
    key: 'Enter',
    cancelable: true,
  });
  expect(el.handleKeyDown(enterEvt)).to.be.false;
  expect(enterEvt.defaultPrevented).to.be.false;
  expect(el.open).to.be.true;

  const tabEvt = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
  expect(el.handleKeyDown(tabEvt)).to.be.false;
  expect(el.open).to.be.true;
});

it('closes and fires lr-mention-close on Escape, without a select event', async () => {
  const el = await openWithItems();
  let selectFired = false;
  el.addEventListener('lr-mention-select', () => (selectFired = true));

  const listener = oneEvent(el, 'lr-mention-close');
  const evt = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  const consumed = el.handleKeyDown(evt);
  await listener;

  expect(consumed).to.be.true;
  expect(evt.defaultPrevented).to.be.true;
  expect(el.open).to.be.false;
  expect(selectFired).to.be.false;
});

it('fires lr-mention-close when a host directly sets open = false (no Escape involved)', async () => {
  const el = await openWithItems();
  const listener = oneEvent(el, 'lr-mention-close');
  el.open = false;
  await listener;
  expect(el.open).to.be.false;
});

it('resets `open` to false on disconnect so a reconnect never resumes half-open with stale positioning', async () => {
  // The actual fix behavior: `disconnectedCallback()` sets `open = false`
  // rather than leaving it `true` across the disconnect -- without this a
  // reconnect while still "open" never re-triggers updated()'s open-driven
  // reposition() branch (nothing else changes `open`/`anchor`/`query` on
  // reconnect), leaving the popup positioned incorrectly with no live
  // scroll/resize tracking. Mirrors lr-combobox's identical regression test.
  const el = await openWithItems();
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('does not fire lr-mention-close for markup that mounts already open="false"', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  let closeFired = false;
  el.addEventListener('lr-mention-close', () => (closeFired = true));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 20));
  expect(closeFired).to.be.false;
});

it('commits a row on click, and preventDefaults its own mousedown so focus never leaves the host input', async () => {
  const el = await openWithItems();

  const listener = oneEvent(el, 'lr-mention-select');
  const row = rows(el)[2];
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  row.dispatchEvent(down);
  expect(down.defaultPrevented, 'mousedown on a row must be prevented so focus never leaves the host input').to.be.true;
  row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { detail } = (await listener) as CustomEvent<LyraMentionSelectDetail>;
  expect(detail).to.deep.equal({ suggestionId: 'carol', index: 2, label: 'Carol Ibarra' });
});

it('reports the assigned collection occurrence so filtering and duplicate ids remain unambiguous', async () => {
  const el = await openWithItems([
    { suggestionId: 'duplicate', label: 'First occurrence' },
    { suggestionId: 'other', label: 'Filtered away' },
    { suggestionId: 'duplicate', label: 'Second occurrence' },
  ]);
  el.query = 'second';
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-mention-select');
  rows(el)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { detail } = (await listener) as CustomEvent<LyraMentionSelectDetail>;
  expect(detail).to.deep.equal({ suggestionId: 'duplicate', index: 2, label: 'Second occurrence' });
});

it('exposes activeDescendantId as null while closed', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  el.items = ITEMS;
  await el.updateComplete;
  expect(el.activeDescendantId).to.be.null;
});

it('uses element reflection when supported and otherwise offers a same-tree real-focus fallback', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea') as HTMLTextAreaElement & {
    ariaActiveDescendantElement: Element | null;
  };
  document.body.appendChild(textarea);
  el.anchor = textarea;
  await el.updateComplete;
  textarea.focus();

  const active = el.activeDescendantElement;
  expect(active?.getAttribute('data-id')).to.equal('alice');
  if (el.syncActiveDescendant(textarea)) {
    expect(textarea.ariaActiveDescendantElement === active).to.be.true;
  } else {
    expect(textarea.hasAttribute('aria-activedescendant')).to.be.false;
    expect(await el.focusActiveOption()).to.be.true;
    expect(el.shadowRoot!.activeElement === active).to.be.true;

    active!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('data-id')).to.equal('bob');

    el.shadowRoot!.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect(document.activeElement === textarea).to.be.true;
  }

  textarea.remove();
});

it('owns and restores the anchor combobox relationship across close, replacement, and adoption', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  el.items = ITEMS;
  const first = document.createElement('textarea') as HTMLTextAreaElement & {
    ariaControlsElements?: readonly Element[] | null;
    ariaActiveDescendantElement?: Element | null;
  };
  first.setAttribute('role', 'searchbox');
  first.setAttribute('aria-expanded', 'false');
  first.setAttribute('aria-haspopup', 'grid');
  first.setAttribute('aria-controls', 'author-results');
  first.setAttribute('aria-activedescendant', 'author-active');
  const second = document.createElement('input');
  second.type = 'search';
  second.setAttribute('aria-expanded', 'mixed-author-value');
  document.body.append(first, second);
  try {
    el.anchor = first;
    el.open = true;
    await el.updateComplete;
    expect(first.getAttribute('role')).to.equal('searchbox');
    expect(first.getAttribute('aria-expanded')).to.equal('true');
    expect(first.getAttribute('aria-haspopup')).to.equal('listbox');
    if ('ariaControlsElements' in first) {
      const controlled = first.ariaControlsElements?.[0];
      expect(controlled === listbox(el) || controlled === el).to.be.true;
    } else {
      expect(first.hasAttribute('aria-controls')).to.be.false;
    }
    if ('ariaActiveDescendantElement' in first) {
      const active = first.ariaActiveDescendantElement;
      expect(active === null || active === el.activeDescendantElement).to.be.true;
      if (active === null) expect(first.hasAttribute('aria-activedescendant')).to.be.false;
    } else {
      expect(first.hasAttribute('aria-activedescendant')).to.be.false;
    }

    el.anchor = second;
    await el.updateComplete;
    expect(first.getAttribute('role')).to.equal('searchbox');
    expect(first.getAttribute('aria-expanded')).to.equal('false');
    expect(first.getAttribute('aria-haspopup')).to.equal('grid');
    expect(first.getAttribute('aria-controls')).to.equal('author-results');
    expect(first.getAttribute('aria-activedescendant')).to.equal('author-active');
    expect(second.getAttribute('role')).to.equal('combobox');
    expect(second.getAttribute('aria-expanded')).to.equal('true');

    el.open = false;
    await el.updateComplete;
    expect(second.hasAttribute('role')).to.be.false;
    expect(second.getAttribute('aria-expanded')).to.equal('mixed-author-value');
    expect(second.hasAttribute('aria-haspopup')).to.be.false;

    el.anchor = first;
    el.open = true;
    await el.updateComplete;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      frame.contentDocument!.adoptNode(el);
      expect(first.getAttribute('role')).to.equal('searchbox');
      expect(first.getAttribute('aria-expanded')).to.equal('false');
      expect(first.getAttribute('aria-controls')).to.equal('author-results');
    } finally {
      frame.remove();
    }
  } finally {
    first.remove();
    second.remove();
  }
});

it('focuses the active fallback option when nested inside another shadow root', async () => {
  const harness = await fixture<MentionPopoverShadowHarness>(
    html`<mention-popover-shadow-harness></mention-popover-shadow-harness>`,
  );
  const el = harness.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    el.items = ITEMS;
    el.open = true;
    await el.updateComplete;

    textarea.focus();
    const active = el.activeDescendantElement!;
    expect(getComputedStyle(active).visibility).to.equal('visible');
    expect(active.tabIndex).to.equal(-1);
    expect(await el.focusActiveOption()).to.be.true;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']).to.equal('alice');
  } finally {
    textarea.remove();
  }
});

it('refuses a stale fallback focus transfer when caller ownership expires during its awaited render', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  const outside = document.createElement('button');
  document.body.append(textarea, outside);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    textarea.focus();

    // Leave a candidate render pending so focusActiveOption() must cross an actual await boundary.
    el.query = 'bob';
    let ownsFocus = true;
    const pending = el.focusActiveOption({ ownsFocus: () => ownsFocus });
    ownsFocus = false;
    outside.focus();

    expect(await pending).to.equal(false);
    expect(document.activeElement === outside).to.be.true;
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  } finally {
    textarea.remove();
    outside.remove();
  }
});

it('invalidates a pending fallback focus transfer on close, candidate replacement, and disconnect', async () => {
  for (const invalidate of [
    (el: LyraMentionPopover) => {
      el.open = false;
    },
    (el: LyraMentionPopover) => {
      el.items = [];
    },
    (el: LyraMentionPopover) => {
      el.remove();
    },
  ]) {
    const el = await openWithItems();
    const textarea = document.createElement('textarea');
    const outside = document.createElement('button');
    document.body.append(textarea, outside);
    try {
      el.anchor = textarea;
      await el.updateComplete;
      textarea.focus();
      el.query = 'bob';
      const pending = el.focusActiveOption({ ownsFocus: () => document.activeElement === textarea });
      outside.focus();
      invalidate(el);

      expect(await pending).to.equal(false);
      expect(document.activeElement === outside).to.be.true;
    } finally {
      el.remove();
      textarea.remove();
      outside.remove();
    }
  }
});

it('keeps the fallback open when the host blur contract recognizes focus entering the popover', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    let movedIntoPopover = false;
    textarea.addEventListener('blur', (event) => {
      movedIntoPopover = event.relatedTarget === el;
      if (!movedIntoPopover) el.open = false;
    });

    textarea.focus();
    expect(await el.focusActiveOption()).to.be.true;
    await el.updateComplete;
    expect(movedIntoPopover).to.be.true;
    expect(el.open).to.be.true;
  } finally {
    textarea.remove();
  }
});

it('recovers real fallback focus when filtering invalidates the focused option', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  textarea.id = 'mention-focus-return';
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;

    el.query = 'bob';
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']).to.equal('bob');

    el.query = 'no-match';
    await el.updateComplete;
    expect(document.activeElement?.id).to.equal(textarea.id);

    el.query = '';
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;
    el.items = [];
    await el.updateComplete;
    expect(document.activeElement?.id).to.equal(textarea.id);
  } finally {
    textarea.remove();
  }
});

it('reacts to a filter-only change and leaves no stale internal Tab stop when results empty', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  textarea.id = 'mention-filter-focus-return';
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    el.query = 'alice';
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;

    el.filter = () => false;
    await el.updateComplete;
    await el.updateComplete;
    expect(document.activeElement?.id).to.equal(textarea.id);
    expect(listbox(el).getAttribute('tabindex')).to.equal('-1');
    expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]').length).to.equal(0);
  } finally {
    textarea.remove();
  }
});

it('returns owned fallback focus to a surviving anchor before disconnecting', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  textarea.id = 'mention-disconnect-focus-return';
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;

    el.remove();
    expect(document.activeElement?.id).to.equal(textarea.id);
  } finally {
    textarea.remove();
  }
});

it('positions the popup (position: fixed) against a plain non-text-control anchor', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="trigger" style="position:absolute; top:120px; left:80px; width:40px; height:20px;">@</button>
      <lr-mention-popover></lr-mention-popover>
    </div>
  `);
  const trigger = wrap.querySelector('#trigger') as HTMLElement;
  const el = wrap.querySelector('lr-mention-popover') as LyraMentionPopover;
  el.anchor = trigger;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;

  await waitFor(
    () => listbox(el).style.left,
    (left) => left !== '',
  );
  expect(listbox(el).style.position).to.equal('fixed');
});

it('anchors caret-precisely against a real <textarea>, tracking selectionStart as query changes', async () => {
  const wrap = await fixture(html`
    <div>
      <textarea
        id="ta"
        style="position:absolute; top:50px; left:50px; width:300px; height:80px; font: 16px monospace;"
      ></textarea>
      <lr-mention-popover></lr-mention-popover>
    </div>
  `);
  const textarea = wrap.querySelector('#ta') as HTMLTextAreaElement;
  const el = wrap.querySelector('lr-mention-popover') as LyraMentionPopover;

  textarea.value = 'hello @world';
  textarea.setSelectionRange(7, 7);
  el.anchor = textarea;
  el.items = ITEMS;
  el.query = 'w';
  el.open = true;
  await el.updateComplete;
  await waitFor(
    () => listbox(el).style.left,
    (left) => left !== '',
  );
  const firstLeft = parseFloat(listbox(el).style.left);

  textarea.setSelectionRange(12, 12);
  el.query = 'world';
  await el.updateComplete;
  await waitFor(
    () => parseFloat(listbox(el).style.left),
    (left) => left !== firstLeft,
  );
  const secondLeft = parseFloat(listbox(el).style.left);

  expect(secondLeft).to.not.equal(firstLeft);
});

it('creates caret measurement and virtual-anchor nodes in the adopted anchor document', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const textarea = frameDocument.createElement('textarea');
  textarea.style.cssText = 'position:absolute; width:300px; height:80px; font:16px monospace;';
  textarea.value = 'hello @world';
  textarea.setSelectionRange(12, 12);
  frameDocument.body.append(textarea);
  const el = document.createElement('lr-mention-popover') as LyraMentionPopover;

  try {
    document.body.append(el);
    await el.updateComplete;
    frameDocument.body.append(frameDocument.adoptNode(el));
    el.anchor = textarea;
    el.items = ITEMS;
    el.open = true;
    await el.updateComplete;
    const virtual = (el as unknown as { virtualAnchor: HTMLDivElement | null }).virtualAnchor;
    expect(virtual !== null).to.be.true;
    expect(virtual!.ownerDocument === frameDocument).to.equal(true);
    expect(virtual!.parentElement === frameDocument.body).to.equal(true);
  } finally {
    el.remove();
    textarea.remove();
    frame.remove();
  }
});

it('defaults the listbox accessible name to "Suggestions", overridable via label', async () => {
  const el = await openWithItems();
  expect(listbox(el).getAttribute('aria-label')).to.equal('Suggestions');
  el.label = 'Mention someone';
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Mention someone');
});

it('a host aria-label attribute overrides the label property and the localized default', async () => {
  const el = (await fixture(
    html`<lr-mention-popover label="Mention someone" aria-label="Custom name"></lr-mention-popover>`,
  )) as LyraMentionPopover;
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  el.anchor = anchor;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Custom name');
});

it('forwards an explicitly empty host aria-label to the listbox owner', async () => {
  const wrapper = await fixture(html`
    <div>
      <div id="anchor"></div>
      <lr-mention-popover label="Mention someone" aria-label=""></lr-mention-popover>
    </div>
  `);
  const el = wrapper.querySelector('lr-mention-popover') as LyraMentionPopover;
  el.anchor = wrapper.querySelector('#anchor') as HTMLElement;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;
  const owner = listbox(el);
  expect(owner.hasAttribute('aria-label')).to.equal(true);
  expect(owner.getAttribute('aria-label')).to.equal('');
});

it('keeps a dynamically emptied host aria-label on the listbox owner and restores the label fallback when absent', async () => {
  const wrapper = await fixture(html`
    <div>
      <div id="anchor"></div>
      <lr-mention-popover label="Mention someone" aria-label="Custom name"></lr-mention-popover>
    </div>
  `);
  const el = wrapper.querySelector('lr-mention-popover') as LyraMentionPopover;
  el.anchor = wrapper.querySelector('#anchor') as HTMLElement;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;
  const owner = listbox(el);
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(owner.hasAttribute('aria-label')).to.equal(true);
  expect(owner.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(owner.getAttribute('aria-label')).to.equal('Mention someone');
});

it('honors a strings override for mentionSuggestions/noMatches while label/emptyText are left at their defaults', async () => {
  const el = await openWithItems([]);
  el.strings = {
    mentionSuggestions: 'Suggestions de mention',
    noMatches: 'Aucun résultat',
  };
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Suggestions de mention');
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty.textContent).to.equal('Aucun résultat');
});

it('keeps explicit empty and old-English label strings caller-owned', async () => {
  const el = await openWithItems([]);
  el.strings = {
    mentionSuggestions: 'Suggestions de mention',
    noMatches: 'Aucun résultat',
  };
  el.label = 'Suggestions';
  el.emptyText = 'No matches';
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Suggestions');
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No matches');

  el.label = '';
  el.emptyText = '';
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('');
});

it('is accessible (empty/closed default state)', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  await expect(el).to.be.accessible();
});

it('is accessible (populated, open state)', async () => {
  const el = await openWithItems();
  // `[part='listbox']`'s opacity transition (gated by :host([open])) is still running right after
  // openWithItems() settles. Left running, axe's color-contrast check factors in the listbox's
  // current (transitional) opacity, so sampling mid-fade blends its text and background toward
  // each other and reports a false "serious" violation. Finishing it outright matches the idiom
  // overlay.test.ts already uses for this same kind of reveal animation.
  listbox(el)
    .getAnimations()
    .forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

it('gives an option a :hover treatment, matching lr-select/lr-combobox/lr-model-select', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='option'\]:hover,\s*\[part='option'\]\[data-active\]\s*\{[^}]+\}/);
});

describe('active-option row cssprop indirection', () => {
  it('recolors the active suggestion row from --lr-mention-popover-option-active-bg on an ancestor, not a bare shared token', async () => {
    const el = await openWithItems();
    el.style.setProperty('--lr-mention-popover-option-active-bg', 'rgb(10, 20, 30)');
    await el.updateComplete;
    // Row 0 is pre-highlighted on open (see the class doc comment on activeIndex).
    const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
    expect(el.shadowRoot!.querySelectorAll('[part="option"][data-active]').length).to.equal(1);
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the pre-cssprop-indirection output when the prop is unset', async () => {
    const el = await openWithItems();
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
    // The fallback arm must resolve to the shared --lr-color-brand-quiet token, exactly as the
    // bare token did before the indirection. Resolve that token live, in the component's own
    // shadow scope, instead of restating a palette literal: the ramp behind --lr-color-brand-*
    // is generated, so a hard-coded hex would be asserting the palette rather than this
    // component and would break on every legitimate regeneration.
    const probe = document.createElement('div');
    el.shadowRoot!.appendChild(probe);
    probe.style.background = 'var(--lr-color-brand-quiet)';
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    // Guard against the comparison degenerating into a tautology: were the token undefined, both
    // the probe and the row would fall back to the transparent initial background-color and the
    // equality below would pass while proving nothing.
    expect(expected, '--lr-color-brand-quiet must resolve to a real opaque colour').to.match(/^rgb\(\d+, \d+, \d+\)$/);
    expect(getComputedStyle(active).backgroundColor).to.equal(expected);
  });
});

// -- Available-space clamping (internal/positioner.js's place()) ------------

it("declares [part='listbox']'s max-block-size/max-inline-size/min-inline-size against place()'s published --lr-positioner-available-* custom properties, mirroring lr-menu's/lr-combobox's identical clamp", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  const listboxBlock = /\[part=['"]?listbox['"]?\]\s*\{([^}]+)\}/.exec(css);
  expect(listboxBlock, 'expected a [part="listbox"] rule').to.not.equal(null);
  const body = listboxBlock![1];
  expect(body).to.match(/max-block-size:\s*min\([^;]*var\(--lr-positioner-available-block-size/);
  expect(body).to.match(/max-inline-size:\s*min\([^;]*var\(--lr-positioner-available-inline-size/);
  expect(body).to.match(/min-inline-size:\s*min\([^;]*var\(--lr-positioner-available-inline-size/);
});

it("actually applies place()'s available-space custom properties onto the rendered listbox once open, not just declaring them in CSS", async () => {
  const el = await openWithItems();
  await waitFor(
    () => listbox(el).style.getPropertyValue('--lr-positioner-available-block-size'),
    (v) => v !== '',
  );
  expect(listbox(el).style.getPropertyValue('--lr-positioner-available-inline-size')).to.not.equal('');
});

it('clips the non-scrolling inline axis and keeps every option at the shared hit-area floor', async () => {
  const el = await openWithItems();
  el.style.setProperty('--lr-icon-button-size', '44px');
  await el.updateComplete;

  const boxStyle = getComputedStyle(listbox(el));
  expect(['clip', 'hidden']).to.include(boxStyle.overflowX);
  expect(parseFloat(getComputedStyle(rows(el)[0]!).minBlockSize)).to.be.at.least(44);
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='listbox']")).to.equal('10px');
});
