import { fixture, expect, oneEvent, html, waitUntil } from '@open-wc/testing';
import './mention-popover.js';
import type { LyraMentionItem, LyraMentionPopover, LyraMentionSelectDetail } from './mention-popover.js';
import { styles } from './mention-popover.styles.js';
import { ignoreResizeObserverLoopErrors } from '../../../../test/resize-observer-noise.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import type { DeferredOperationHandle } from '../../../internal/anchored-overlay-runtime.js';
import { registerLyraLocale } from '../../../internal/localization.js';

// Several tests here mount an <iframe> (to exercise cross-document anchors) and then remove it in
// a `finally`, tearing the frame down while Floating UI's `autoUpdate` ResizeObservers are still
// attached to nodes inside it. That is exactly the shape that leaves observations undelivered at
// the end of a frame. It reproduces on Chromium under load and not at all on WebKit, and the
// assertions themselves pass -- only the uncaught page error fails the run, taking the rest of the
// file with it.
ignoreResizeObserverLoopErrors('iframe teardown races Floating UI autoUpdate observers');

const ITEMS: LyraMentionItem[] = [
  { suggestionId: 'alice', label: 'Alice Johansson', description: 'Product design' },
  { suggestionId: 'bob', label: 'Bob Nakamura', icon: '🤖' },
  { suggestionId: 'carol', label: 'Carol Ibarra', description: 'Engineering' },
];

type ReflectedTextarea = HTMLTextAreaElement & {
  ariaActiveDescendantElement?: Element | null;
  ariaControlsElements?: readonly Element[] | null;
};

type MentionPopoverInternals = {
  cleanup?: DeferredOperationHandle;
};

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

function politeAnnouncements(doc: Document = document): string[] {
  const sink = doc.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  );
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

async function openWithItems(items: LyraMentionItem[] = ITEMS): Promise<LyraMentionPopover> {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  el.anchor = anchor;
  el.items = items;
  el.open = true;
  await el.updateComplete;
  await waitFor(
    () => getComputedStyle(listbox(el)).visibility,
    (visibility) => visibility === 'visible',
  );
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

function createPendingPlacement(): {
  readonly handle: DeferredOperationHandle;
  readonly resolve: (positioned: boolean) => void;
} {
  let settleReady!: (positioned: boolean) => void;
  let settled = false;
  const settle = (positioned: boolean): void => {
    if (settled) return;
    settled = true;
    settleReady(positioned);
  };
  const ready = new Promise<boolean>((resolve) => {
    settleReady = resolve;
  });
  const handle = (() => settle(false)) as DeferredOperationHandle;
  handle.ready = ready;
  return { handle, resolve: settle };
}

function replacePlacement(el: LyraMentionPopover, handle: DeferredOperationHandle): void {
  const internals = el as unknown as MentionPopoverInternals;
  internals.cleanup?.();
  internals.cleanup = handle;
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

it('fails closed to a frozen empty snapshot for non-array items', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  (el as unknown as { items: unknown }).items = { suggestionId: 'not-a-list', label: 'Ignored' };
  await el.updateComplete;

  expect(el.items).to.deep.equal([]);
  expect(Object.isFrozen(el.items)).to.equal(true);
  expect(el.filteredItems).to.deep.equal([]);
});

it('omits malformed labels while a valid neighboring suggestion remains filterable and selectable', async () => {
  const el = await openWithItems([
    null,
    { suggestionId: 'missing' },
    { suggestionId: 'numeric', label: 42 },
    { suggestionId: 'kept', label: 'Kept suggestion' },
  ] as unknown as LyraMentionItem[]);

  el.query = 'kept';
  await el.updateComplete;

  expect(el.filteredItems.map((item) => item.suggestionId)).to.deep.equal(['kept']);
  expect(rows(el)).to.have.length(1);
  const selected = oneEvent(el, 'lr-mention-select');
  (rows(el)[0] as HTMLElement).click();
  expect((await selected).detail).to.deep.equal({
    suggestionId: 'kept',
    index: 3,
    label: 'Kept suggestion',
  });
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

it('lets an unhandled key fall through untouched', async () => {
  const el = await openWithItems();
  const evt = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
  expect(el.handleKeyDown(evt)).to.be.false;
  expect(evt.defaultPrevented).to.be.false;
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
  const row = rows(el)[2]!;
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

it('temporarily clears forbidden textarea semantics and restores authored ARIA/AOM after dismissal', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  const reflected = textarea as ReflectedTextarea;
  const authoredActiveDescendant = document.createElement('span');
  const authoredControls = document.createElement('div');
  authoredActiveDescendant.id = 'mention-authored-active';
  authoredControls.id = 'mention-authored-controls';
  document.body.append(textarea, authoredActiveDescendant, authoredControls);

  let nativeEmptyAttributeAom = false;
  if ('ariaActiveDescendantElement' in textarea && 'ariaControlsElements' in textarea) {
    try {
      reflected.ariaActiveDescendantElement = authoredActiveDescendant;
      reflected.ariaControlsElements = [authoredControls];
      nativeEmptyAttributeAom =
        reflected.ariaActiveDescendantElement === authoredActiveDescendant &&
        reflected.ariaControlsElements?.[0] === authoredControls &&
        textarea.getAttribute('aria-activedescendant') === '' &&
        textarea.getAttribute('aria-controls') === '';
    } catch {
      // Engines without usable native element reflection exercise the controlled fallback below.
    }
  }

  let activeDescendantElement: Element | null = authoredActiveDescendant;
  let controlsElements: readonly Element[] | null = [authoredControls];
  if (!nativeEmptyAttributeAom) {
    Object.defineProperties(textarea, {
      ariaActiveDescendantElement: {
        configurable: true,
        get: () => activeDescendantElement,
        set: (value: Element | null) => {
          activeDescendantElement = value;
        },
      },
      ariaControlsElements: {
        configurable: true,
        get: () => controlsElements,
        set: (value: readonly Element[] | null) => {
          controlsElements = value;
        },
      },
    });
    // Element-reference reflection uses empty attributes as its native serialization. This
    // fallback deliberately models that provenance instead of conflating it with an author IDREF.
    textarea.setAttribute('aria-controls', '');
    textarea.setAttribute('aria-activedescendant', '');
  }

  textarea.setAttribute('role', 'searchbox');
  textarea.setAttribute('aria-expanded', 'false');
  textarea.setAttribute('aria-haspopup', 'grid');
  textarea.setAttribute('aria-autocomplete', 'both');
  const authoredControlsAttribute = textarea.getAttribute('aria-controls');
  const authoredActiveDescendantAttribute = textarea.getAttribute('aria-activedescendant');
  try {
    el.anchor = textarea;
    await el.updateComplete;
    textarea.focus();

    const active = el.activeDescendantElement;
    expect(active?.getAttribute('data-id')).to.equal('alice');
    expect(textarea.hasAttribute('role')).to.equal(false);
    expect(textarea.hasAttribute('aria-expanded')).to.equal(false);
    expect(textarea.hasAttribute('aria-controls')).to.equal(false);
    expect(textarea.hasAttribute('aria-activedescendant')).to.equal(false);
    expect(textarea.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(textarea.getAttribute('aria-autocomplete')).to.equal('list');
    expect(el.syncActiveDescendant(textarea)).to.be.false;
    expect(reflected.ariaActiveDescendantElement === null).to.equal(true);
    expect(reflected.ariaControlsElements === null).to.equal(true);

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
    expect(textarea.getAttribute('role')).to.equal('searchbox');
    expect(textarea.getAttribute('aria-expanded')).to.equal('false');
    expect(textarea.getAttribute('aria-haspopup')).to.equal('grid');
    expect(textarea.getAttribute('aria-autocomplete')).to.equal('both');
    expect(textarea.getAttribute('aria-controls')).to.equal(authoredControlsAttribute);
    expect(textarea.getAttribute('aria-activedescendant')).to.equal(authoredActiveDescendantAttribute);
    expect(reflected.ariaActiveDescendantElement === authoredActiveDescendant).to.equal(true);
    expect(reflected.ariaControlsElements?.[0] === authoredControls).to.equal(true);
  } finally {
    textarea.remove();
    authoredActiveDescendant.remove();
    authoredControls.remove();
  }
});

it('restores temporary textarea ARIA plus focus and caret across replacement and adoption', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  el.items = ITEMS;
  const first = document.createElement('textarea');
  const reflectedFirst = first as ReflectedTextarea;
  const authoredActiveDescendant = document.createElement('span');
  const authoredControls = document.createElement('div');
  authoredActiveDescendant.id = 'mention-string-active';
  authoredControls.id = 'mention-string-controls';
  first.value = 'Hello @ad';
  first.setSelectionRange(6, 9);
  first.setAttribute('role', 'searchbox');
  first.setAttribute('aria-expanded', 'false');
  first.setAttribute('aria-haspopup', 'grid');
  first.setAttribute('aria-autocomplete', 'both');
  first.setAttribute('aria-controls', authoredControls.id);
  first.setAttribute('aria-activedescendant', authoredActiveDescendant.id);
  const second = document.createElement('textarea');
  second.setAttribute('aria-haspopup', 'menu');
  second.setAttribute('aria-autocomplete', 'inline');
  document.body.append(first, second, authoredActiveDescendant, authoredControls);
  try {
    el.anchor = first;
    el.open = true;
    await el.updateComplete;
    expect(first.hasAttribute('role')).to.be.false;
    expect(first.hasAttribute('aria-expanded')).to.be.false;
    expect(first.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(first.getAttribute('aria-autocomplete')).to.equal('list');
    expect(first.hasAttribute('aria-controls')).to.be.false;
    expect(first.hasAttribute('aria-activedescendant')).to.be.false;
    first.focus();
    expect(await el.focusActiveOption()).to.be.true;

    el.anchor = second;
    await el.updateComplete;
    expect(document.activeElement === first).to.be.true;
    expect(first.selectionStart).to.equal(6);
    expect(first.selectionEnd).to.equal(9);
    expect(first.getAttribute('role')).to.equal('searchbox');
    expect(first.getAttribute('aria-expanded')).to.equal('false');
    expect(first.getAttribute('aria-haspopup')).to.equal('grid');
    expect(first.getAttribute('aria-autocomplete')).to.equal('both');
    expect(first.getAttribute('aria-controls')).to.equal(authoredControls.id);
    expect(first.getAttribute('aria-activedescendant')).to.equal(authoredActiveDescendant.id);
    if ('ariaActiveDescendantElement' in first) {
      expect(reflectedFirst.ariaActiveDescendantElement === authoredActiveDescendant).to.equal(true);
    }
    if ('ariaControlsElements' in first) {
      expect(reflectedFirst.ariaControlsElements?.[0] === authoredControls).to.equal(true);
    }
    expect(second.hasAttribute('role')).to.be.false;
    expect(second.hasAttribute('aria-expanded')).to.be.false;
    expect(second.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(second.getAttribute('aria-autocomplete')).to.equal('list');
    expect(second.hasAttribute('aria-controls')).to.be.false;
    expect(second.hasAttribute('aria-activedescendant')).to.be.false;

    el.anchor = first;
    await el.updateComplete;
    expect(second.getAttribute('aria-haspopup')).to.equal('menu');
    expect(second.getAttribute('aria-autocomplete')).to.equal('inline');
    first.focus();
    expect(await el.focusActiveOption()).to.be.true;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      frame.contentDocument!.adoptNode(el);
      expect(document.activeElement === first).to.be.true;
      expect(first.selectionStart).to.equal(6);
      expect(first.selectionEnd).to.equal(9);
      expect(first.getAttribute('role')).to.equal('searchbox');
      expect(first.getAttribute('aria-expanded')).to.equal('false');
      expect(first.getAttribute('aria-haspopup')).to.equal('grid');
      expect(first.getAttribute('aria-autocomplete')).to.equal('both');
      expect(first.getAttribute('aria-controls')).to.equal(authoredControls.id);
      expect(first.getAttribute('aria-activedescendant')).to.equal(authoredActiveDescendant.id);
      if ('ariaActiveDescendantElement' in first) {
        expect(reflectedFirst.ariaActiveDescendantElement === authoredActiveDescendant).to.equal(true);
      }
      if ('ariaControlsElements' in first) {
        expect(reflectedFirst.ariaControlsElements?.[0] === authoredControls).to.equal(true);
      }
    } finally {
      frame.remove();
    }
  } finally {
    first.remove();
    second.remove();
    authoredActiveDescendant.remove();
    authoredControls.remove();
  }
});

it('restores nonempty textarea string IDREFs on disconnect without rewriting their provenance', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const textarea = document.createElement('textarea');
  const authoredActiveDescendant = document.createElement('span');
  const authoredControls = document.createElement('div');
  authoredActiveDescendant.id = 'mention-disconnect-active';
  authoredControls.id = 'mention-disconnect-controls';
  textarea.setAttribute('aria-activedescendant', authoredActiveDescendant.id);
  textarea.setAttribute('aria-controls', authoredControls.id);
  document.body.append(textarea, authoredActiveDescendant, authoredControls);
  try {
    el.anchor = textarea;
    el.items = ITEMS;
    el.open = true;
    await el.updateComplete;

    el.remove();

    expect(textarea.getAttribute('aria-activedescendant')).to.equal(authoredActiveDescendant.id);
    expect(textarea.getAttribute('aria-controls')).to.equal(authoredControls.id);
  } finally {
    textarea.remove();
    authoredActiveDescendant.remove();
    authoredControls.remove();
  }
});

it('restores a textarea session before a close listener mutates and reopens it', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const textarea = document.createElement('textarea');
  const initialActiveDescendant = document.createElement('span');
  const initialControls = document.createElement('div');
  const reopenedActiveDescendant = document.createElement('span');
  const reopenedControls = document.createElement('div');
  initialActiveDescendant.id = 'mention-close-initial-active';
  initialControls.id = 'mention-close-initial-controls';
  reopenedActiveDescendant.id = 'mention-close-reopened-active';
  reopenedControls.id = 'mention-close-reopened-controls';
  const reflected = textarea as ReflectedTextarea;
  document.body.append(
    textarea,
    initialActiveDescendant,
    initialControls,
    reopenedActiveDescendant,
    reopenedControls,
  );

  let nativeEmptyAttributeAom = false;
  if ('ariaActiveDescendantElement' in textarea && 'ariaControlsElements' in textarea) {
    try {
      reflected.ariaActiveDescendantElement = initialActiveDescendant;
      reflected.ariaControlsElements = [initialControls];
      nativeEmptyAttributeAom =
        reflected.ariaActiveDescendantElement === initialActiveDescendant &&
        reflected.ariaControlsElements?.[0] === initialControls &&
        textarea.getAttribute('aria-activedescendant') === '' &&
        textarea.getAttribute('aria-controls') === '';
    } catch {
      // The ordinary serialized-IDREF assertions below cover engines without native reflection.
    }
  }
  if (!nativeEmptyAttributeAom) {
    textarea.setAttribute('aria-activedescendant', initialActiveDescendant.id);
    textarea.setAttribute('aria-controls', initialControls.id);
  }
  textarea.setAttribute('role', 'searchbox');
  const initialActiveAttribute = textarea.getAttribute('aria-activedescendant');
  const initialControlsAttribute = textarea.getAttribute('aria-controls');
  let reopenedActiveAttribute: string | null = null;
  let reopenedControlsAttribute: string | null = null;
  let closeCount = 0;
  el.addEventListener('lr-mention-close', () => {
    closeCount += 1;
    if (closeCount !== 1) return;
    expect(textarea.getAttribute('role')).to.equal('searchbox');
    expect(textarea.getAttribute('aria-activedescendant')).to.equal(initialActiveAttribute);
    expect(textarea.getAttribute('aria-controls')).to.equal(initialControlsAttribute);
    if (nativeEmptyAttributeAom) {
      expect(reflected.ariaActiveDescendantElement === initialActiveDescendant).to.equal(true);
      expect(reflected.ariaControlsElements?.[0] === initialControls).to.equal(true);
    }

    textarea.setAttribute('role', 'textbox');
    if (nativeEmptyAttributeAom) {
      reflected.ariaActiveDescendantElement = reopenedActiveDescendant;
      reflected.ariaControlsElements = [reopenedControls];
    } else {
      textarea.setAttribute('aria-activedescendant', reopenedActiveDescendant.id);
      textarea.setAttribute('aria-controls', reopenedControls.id);
    }
    reopenedActiveAttribute = textarea.getAttribute('aria-activedescendant');
    reopenedControlsAttribute = textarea.getAttribute('aria-controls');
    el.open = true;
  });

  try {
    el.anchor = textarea;
    el.items = ITEMS;
    el.open = true;
    await el.updateComplete;

    el.open = false;
    await el.updateComplete;
    await el.updateComplete;
    expect(closeCount).to.equal(1);
    expect(el.open).to.equal(true);

    el.open = false;
    await el.updateComplete;
    await el.updateComplete;

    expect(closeCount).to.equal(2);
    expect(textarea.getAttribute('role')).to.equal('textbox');
    expect(textarea.getAttribute('aria-activedescendant')).to.equal(reopenedActiveAttribute);
    expect(textarea.getAttribute('aria-controls')).to.equal(reopenedControlsAttribute);
    if (nativeEmptyAttributeAom) {
      expect(reflected.ariaActiveDescendantElement === reopenedActiveDescendant).to.equal(true);
      expect(reflected.ariaControlsElements?.[0] === reopenedControls).to.equal(true);
    }
  } finally {
    textarea.remove();
    initialActiveDescendant.remove();
    initialControls.remove();
    reopenedActiveDescendant.remove();
    reopenedControls.remove();
  }
});

it('restores a textarea session before a select listener authors replacement semantics', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const textarea = document.createElement('textarea');
  const initialActiveDescendant = document.createElement('span');
  const initialControls = document.createElement('div');
  const selectedActiveDescendant = document.createElement('span');
  const selectedControls = document.createElement('div');
  initialActiveDescendant.id = 'mention-select-initial-active';
  initialControls.id = 'mention-select-initial-controls';
  selectedActiveDescendant.id = 'mention-select-authored-active';
  selectedControls.id = 'mention-select-authored-controls';
  const reflected = textarea as ReflectedTextarea;
  document.body.append(
    textarea,
    initialActiveDescendant,
    initialControls,
    selectedActiveDescendant,
    selectedControls,
  );

  let nativeEmptyAttributeAom = false;
  if ('ariaActiveDescendantElement' in textarea && 'ariaControlsElements' in textarea) {
    try {
      reflected.ariaActiveDescendantElement = initialActiveDescendant;
      reflected.ariaControlsElements = [initialControls];
      nativeEmptyAttributeAom =
        reflected.ariaActiveDescendantElement === initialActiveDescendant &&
        reflected.ariaControlsElements?.[0] === initialControls &&
        textarea.getAttribute('aria-activedescendant') === '' &&
        textarea.getAttribute('aria-controls') === '';
    } catch {
      // The serialized-IDREF fallback below covers engines without native element reflection.
    }
  }
  if (!nativeEmptyAttributeAom) {
    textarea.setAttribute('aria-activedescendant', initialActiveDescendant.id);
    textarea.setAttribute('aria-controls', initialControls.id);
  }
  textarea.value = '@a';
  textarea.setSelectionRange(2, 2);
  textarea.setAttribute('role', 'searchbox');
  textarea.setAttribute('aria-expanded', 'false');
  textarea.setAttribute('aria-haspopup', 'grid');
  textarea.setAttribute('aria-autocomplete', 'both');
  const initialActiveAttribute = textarea.getAttribute('aria-activedescendant');
  const initialControlsAttribute = textarea.getAttribute('aria-controls');
  let selectedActiveAttribute: string | null = null;
  let selectedControlsAttribute: string | null = null;
  let selectCount = 0;
  el.addEventListener('lr-mention-select', () => {
    selectCount += 1;
    expect(textarea.getAttribute('role')).to.equal('searchbox');
    expect(textarea.getAttribute('aria-expanded')).to.equal('false');
    expect(textarea.getAttribute('aria-haspopup')).to.equal('grid');
    expect(textarea.getAttribute('aria-autocomplete')).to.equal('both');
    expect(textarea.getAttribute('aria-activedescendant')).to.equal(initialActiveAttribute);
    expect(textarea.getAttribute('aria-controls')).to.equal(initialControlsAttribute);
    expect(document.activeElement === textarea).to.equal(true);
    expect(textarea.selectionStart).to.equal(2);
    expect(textarea.selectionEnd).to.equal(2);
    if (nativeEmptyAttributeAom) {
      expect(reflected.ariaActiveDescendantElement === initialActiveDescendant).to.equal(true);
      expect(reflected.ariaControlsElements?.[0] === initialControls).to.equal(true);
    }

    textarea.setAttribute('role', 'textbox');
    textarea.setAttribute('aria-expanded', 'true');
    textarea.setAttribute('aria-haspopup', 'menu');
    textarea.setAttribute('aria-autocomplete', 'none');
    if (nativeEmptyAttributeAom) {
      reflected.ariaActiveDescendantElement = selectedActiveDescendant;
      reflected.ariaControlsElements = [selectedControls];
    } else {
      textarea.setAttribute('aria-activedescendant', selectedActiveDescendant.id);
      textarea.setAttribute('aria-controls', selectedControls.id);
    }
    selectedActiveAttribute = textarea.getAttribute('aria-activedescendant');
    selectedControlsAttribute = textarea.getAttribute('aria-controls');
  });

  try {
    el.anchor = textarea;
    el.items = ITEMS;
    el.open = true;
    await el.updateComplete;
    textarea.focus();
    expect(await el.focusActiveOption()).to.equal(true);
    const active = el.shadowRoot!.activeElement as HTMLElement;
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    active.dispatchEvent(enter);
    await waitUntil(() => !el.open);
    await el.updateComplete;

    expect(enter.defaultPrevented).to.equal(true);
    expect(selectCount).to.equal(1);
    expect(textarea.getAttribute('role')).to.equal('textbox');
    expect(textarea.getAttribute('aria-expanded')).to.equal('true');
    expect(textarea.getAttribute('aria-haspopup')).to.equal('menu');
    expect(textarea.getAttribute('aria-autocomplete')).to.equal('none');
    expect(textarea.getAttribute('aria-activedescendant')).to.equal(selectedActiveAttribute);
    expect(textarea.getAttribute('aria-controls')).to.equal(selectedControlsAttribute);
    if (nativeEmptyAttributeAom) {
      expect(reflected.ariaActiveDescendantElement === selectedActiveDescendant).to.equal(true);
      expect(reflected.ariaControlsElements?.[0] === selectedControls).to.equal(true);
    }
  } finally {
    textarea.remove();
    initialActiveDescendant.remove();
    initialControls.remove();
    selectedActiveDescendant.remove();
    selectedControls.remove();
  }
});

it('retains the established single-line input route without applying textarea-only autocomplete', async () => {
  const el = await openWithItems();
  const input = document.createElement('input');
  input.type = 'search';
  input.setAttribute('aria-expanded', 'mixed-author-value');
  input.setAttribute('aria-autocomplete', 'both');
  document.body.appendChild(input);
  try {
    el.anchor = input;
    await el.updateComplete;
    expect(input.getAttribute('role')).to.equal('combobox');
    expect(input.getAttribute('aria-expanded')).to.equal('true');
    expect(input.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(input.getAttribute('aria-autocomplete')).to.equal('both');

    el.open = false;
    await el.updateComplete;
    expect(input.hasAttribute('role')).to.be.false;
    expect(input.getAttribute('aria-expanded')).to.equal('mixed-author-value');
    expect(input.hasAttribute('aria-haspopup')).to.be.false;
    expect(input.getAttribute('aria-autocomplete')).to.equal('both');
  } finally {
    input.remove();
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
    await waitFor(
      () => getComputedStyle(active).visibility,
      (visibility) => visibility === 'visible',
    );
    expect(getComputedStyle(active).visibility).to.equal('visible');
    expect(active.tabIndex).to.equal(-1);
    expect(await el.focusActiveOption()).to.be.true;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']).to.equal('alice');
  } finally {
    textarea.remove();
  }
});

it('resolves false immediately from focusActiveOption when the popover is not open', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  el.items = ITEMS;
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(await el.focusActiveOption()).to.equal(false);
});

it('resolves false and never moves focus when the ownsFocus predicate throws', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    textarea.focus();
    const result = await el.focusActiveOption({
      ownsFocus: () => {
        throw new Error('boom');
      },
    });
    expect(result).to.equal(false);
    expect(document.activeElement === textarea).to.be.true;
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

it('does not restore an option after placement settles once real focus has left the textarea session', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  const outside = document.createElement('button');
  const pendingPlacement = createPendingPlacement();
  document.body.append(textarea, outside);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    textarea.focus();
    expect(await el.focusActiveOption()).to.equal(true);

    replacePlacement(el, pendingPlacement.handle);
    el.items = ITEMS.slice(0, 2);
    await el.updateComplete;
    outside.focus();
    pendingPlacement.resolve(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement === outside).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]').length).to.equal(0);
  } finally {
    pendingPlacement.handle();
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

it('invalidates a textarea focus transfer when close/reopen, query, or anchor returns to its original snapshot', async () => {
  const invalidations: readonly {
    readonly name: string;
    readonly apply: (el: LyraMentionPopover, textarea: HTMLTextAreaElement, alternate: HTMLTextAreaElement) => void;
  }[] = [
    {
      name: 'close/reopen',
      apply: (el) => {
        el.open = false;
        el.open = true;
      },
    },
    {
      name: 'query roundtrip',
      apply: (el) => {
        el.query = 'bob';
        el.query = '';
      },
    },
    {
      name: 'anchor roundtrip',
      apply: (el, textarea, alternate) => {
        el.anchor = alternate;
        el.anchor = textarea;
      },
    },
  ];

  for (const { name, apply } of invalidations) {
    const el = await openWithItems();
    const textarea = document.createElement('textarea');
    const alternate = document.createElement('textarea');
    document.body.append(textarea, alternate);
    try {
      el.anchor = textarea;
      await el.updateComplete;
      await waitFor(
        () => getComputedStyle(listbox(el)).visibility,
        (visibility) => visibility === 'visible',
      );
      textarea.focus();
      // Schedule a render before starting the transfer. The later mutations return to this exact
      // snapshot before that render settles, which defeats value-only snapshot comparisons.
      el.query = 'bob';
      const pending = el.focusActiveOption({ ownsFocus: () => document.activeElement === textarea });
      if (name === 'query roundtrip') {
        el.query = '';
        el.query = 'bob';
      } else {
        apply(el, textarea, alternate);
      }
      await el.updateComplete;

      expect(await pending, `${name} must invalidate the stale textarea focus transfer`).to.equal(false);
      expect(document.activeElement === textarea).to.equal(true);
      expect(el.shadowRoot!.activeElement === null).to.equal(true);
    } finally {
      textarea.remove();
      alternate.remove();
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

it('drops fallback focus ownership on the next update once real focus has already left the shadow tree by any other means', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]').length).to.equal(1);

    // Focus leaves the shadow tree directly (not via blur/query/items/filter/open/disconnect --
    // e.g. some unrelated script on the page moving focus), so none of the other guarded paths
    // ever get a chance to notice.
    outside.focus();

    // A benign update that doesn't itself touch open/anchor/candidates-emptying.
    el.query = 'a';
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelectorAll('[tabindex="0"]').length,
      'ownership must have been dropped since focus already left the shadow tree',
    ).to.equal(0);
  } finally {
    textarea.remove();
    outside.remove();
  }
});

it('falls back to focusing the listbox itself when candidates empty out while the anchor is no longer connected', async () => {
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;

    // Disconnect the anchor without closing the popover or touching candidates yet, so
    // willUpdate's own anchor-connected empty-candidates guard can no longer apply once
    // candidates do empty out below.
    textarea.remove();
    el.items = [];
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement === listbox(el)).to.be.true;
  } finally {
    // textarea already removed above
  }
});

it('falls back to focusing the anchor when a non-idempotent filter predicate empties results only by render time, with the anchor still connected', async () => {
  // willUpdate() pre-emptively hands focus back to the anchor whenever a query/items/filter
  // change makes filteredItems empty -- but it decides that by calling the `filter` predicate
  // itself, once, for every item. A filter that isn't idempotent (returns a different answer on
  // a second pass over the same items) can make willUpdate's own check see a non-empty result
  // while render()'s later, separate pass over the same items sees an empty one -- landing on
  // updated()'s own independent "no active row rendered, but the anchor is still connected"
  // fallback instead, which is what this covers.
  const el = await openWithItems();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  try {
    el.anchor = textarea;
    await el.updateComplete;
    expect(await el.focusActiveOption()).to.be.true;
    // Settle the trailing requestUpdate() focusActiveOption() itself schedules before starting
    // the call-counted filter below, so that scheduled cycle can't be mistaken for one of the
    // two passes this test is deliberately choreographing.
    await el.updateComplete;

    // A non-empty query is required for filteredItems to ever consult `filter` at all -- its own
    // empty-query fast path returns `items` verbatim without calling the predicate.
    el.query = 'a';
    await el.updateComplete;

    let calls = 0;
    const total = el.items.length;
    el.filter = () => {
      calls += 1;
      return calls <= total;
    };
    await el.updateComplete;

    expect(document.activeElement === textarea).to.be.true;
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

it('cleans up the virtual caret anchor when a new text-control anchor lives in a different document', async () => {
  const textarea = document.createElement('textarea');
  textarea.style.cssText = 'position:absolute; width:300px; height:80px; font:16px monospace;';
  document.body.appendChild(textarea);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameTextarea = frameDocument.createElement('textarea');
  frameTextarea.style.cssText = 'position:absolute; width:300px; height:80px; font:16px monospace;';
  frameDocument.body.append(frameTextarea);

  const el = await openWithItems();
  try {
    el.anchor = textarea;
    await el.updateComplete;
    const firstVirtual = (el as unknown as { virtualAnchor: HTMLDivElement | null }).virtualAnchor;
    expect(firstVirtual !== null).to.be.true;
    expect(firstVirtual!.ownerDocument === document).to.equal(true);
    expect(firstVirtual!.isConnected).to.be.true;

    el.anchor = frameTextarea;
    await el.updateComplete;

    // The stale main-document virtual anchor must be detached, not merely orphaned in place.
    expect(firstVirtual!.isConnected).to.be.false;
    const secondVirtual = (el as unknown as { virtualAnchor: HTMLDivElement | null }).virtualAnchor;
    expect(secondVirtual !== firstVirtual).to.be.true;
    expect(secondVirtual!.ownerDocument === frameDocument).to.equal(true);
  } finally {
    textarea.remove();
    frame.remove();
  }
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

it('announces localized result state in the document light DOM without repeating an unchanged active row', async () => {
  const el = (await fixture(html`<lr-mention-popover></lr-mention-popover>`)) as LyraMentionPopover;
  const anchor = document.createElement('textarea');
  document.body.append(anchor);
  const before = politeAnnouncements().length;
  try {
    el.strings = {
      mentionResultCount: { one: '{count} result', other: '{count} results' },
      mentionResultPosition: 'Result {current} of {total}',
      noMatches: 'No matching suggestions',
    };
    el.anchor = anchor;
    el.items = ITEMS.slice(0, 2);
    el.open = true;
    await el.updateComplete;

    el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    await el.updateComplete;
    el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    await el.updateComplete;

    el.items = [];
    await el.updateComplete;
    el.items = [];
    await el.updateComplete;

    expect(politeAnnouncements().slice(before)).to.deep.equal([
      '2 results',
      'Result 1 of 2',
      'Result 2 of 2',
      'No matching suggestions',
    ]);
  } finally {
    el.remove();
    anchor.remove();
  }
});

it('reconciles open result announcements after an inherited locale update without duplicates', async () => {
  registerLyraLocale('x-mention-announcement', {
    mentionSuggestions: 'Suggestions de test',
    mentionResultCount: { one: '{count} résultat de test', other: '{count} résultats de test' },
    mentionResultPosition: 'Résultat de test {current} sur {total}',
  });
  const wrapper = await fixture<HTMLDivElement>(html`
    <div lang="en"><lr-mention-popover></lr-mention-popover></div>
  `);
  const el = wrapper.querySelector('lr-mention-popover') as LyraMentionPopover;
  const anchor = document.createElement('textarea');
  wrapper.append(anchor);
  const before = politeAnnouncements().length;
  try {
    el.anchor = anchor;
    el.items = ITEMS.slice(0, 2);
    el.open = true;
    await el.updateComplete;
    expect(politeAnnouncements().slice(before)).to.deep.equal([
      '2 suggestions',
      'Suggestion 1 of 2',
    ]);

    wrapper.setAttribute('lang', 'x-mention-announcement');
    await Promise.resolve();
    await el.updateComplete;
    await Promise.resolve();
    await el.updateComplete;

    expect(listbox(el).getAttribute('aria-label')).to.equal('Suggestions de test');
    expect(politeAnnouncements().slice(before)).to.deep.equal([
      '2 suggestions',
      'Suggestion 1 of 2',
      '2 résultats de test',
      'Résultat de test 1 sur 2',
    ]);

    const announcementCount = politeAnnouncements().length;
    el.requestUpdate();
    await el.updateComplete;
    expect(politeAnnouncements().length).to.equal(announcementCount);
  } finally {
    el.remove();
    anchor.remove();
  }
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

it('paints option hover feedback under a real pointer', async () => {
  const el = await openWithItems();
  el.style.setProperty('--lr-mention-popover-option-active-bg', 'rgb(10, 20, 30)');
  await el.updateComplete;
  const option = rows(el)[1]!;
  option.scrollIntoView({ block: 'center' });
  const rect = option.getBoundingClientRect();
  try {
    await resetMouse();
    await sendMouse({
      type: 'move',
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await waitUntil(
      () => getComputedStyle(option).backgroundColor === 'rgb(10, 20, 30)',
      'the mention option hover background never painted'
    );
  } finally {
    await resetMouse();
  }
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

it('centers a single-line option inside an enlarged hit-area allocation', async () => {
  const el = await openWithItems([{ suggestionId: 'alice', label: 'Alice', icon: '👤' }]);
  el.style.setProperty('--lr-icon-button-size', '80px');
  el.style.setProperty('--lr-space-xs', '0px');
  el.style.setProperty('--lr-space-s', '0px');
  await el.updateComplete;

  const option = rows(el)[0]!;
  const label = option.querySelector<HTMLElement>('[part="option-label"]')!;
  const optionBox = option.getBoundingClientRect();
  const labelBox = label.getBoundingClientRect();
  expect(
    Math.abs(labelBox.top + labelBox.height / 2 - (optionBox.top + optionBox.height / 2)),
    'the short label is centered rather than pinned to the option top'
  ).to.be.lessThan(1.5);
});

it('clamps its rendered floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = await openWithItems([
    {
      suggestionId: 'long',
      label: 'AnExceptionallyLongUnbrokenMentionSuggestionLabel',
      description: 'AnExceptionallyLongUnbrokenMentionSuggestionDescription',
    },
  ]);
  el.style.setProperty('--lr-popover-viewport-clamp', '100px');
  await el.updateComplete;
  const box = listbox(el);
  await waitUntil(
    () => box.getBoundingClientRect().width > 0,
    'the mention listbox never acquired rendered geometry'
  );
  expect(box.getBoundingClientRect().width).to.be.at.most(100.5);
});
