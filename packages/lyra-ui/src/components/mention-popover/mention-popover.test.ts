import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './mention-popover.js';
import type { LyraMentionPopover, MentionItem, MentionSelectDetail } from './mention-popover.js';

const ITEMS: MentionItem[] = [
  { id: 'alice', label: 'Alice Johansson', description: 'Product design' },
  { id: 'bob', label: 'Bob Nakamura', icon: '🤖' },
  { id: 'carol', label: 'Carol Ibarra', description: 'Engineering' },
];

function listbox(el: LyraMentionPopover): HTMLElement {
  return el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
}

function rows(el: LyraMentionPopover): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

async function openWithItems(items: MentionItem[] = ITEMS): Promise<LyraMentionPopover> {
  const el = (await fixture(html`<lyra-mention-popover></lyra-mention-popover>`)) as LyraMentionPopover;
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
  expect(empty).to.exist;
  expect(empty.textContent).to.equal('No matches');
  expect(empty.getAttribute('role')).to.equal('option');
  expect(empty.getAttribute('aria-disabled')).to.equal('true');
});

it('filters items against query using the built-in case-insensitive label/description match', async () => {
  const el = await openWithItems();
  el.query = 'engineering';
  await el.updateComplete;
  expect(el.filteredItems.map((i) => i.id)).to.deep.equal(['carol']);
});

it('overrides the built-in filter via the filter property', async () => {
  const el = await openWithItems();
  el.filter = (item, query) => item.id === query;
  el.query = 'bob';
  await el.updateComplete;
  expect(el.filteredItems.map((i) => i.id)).to.deep.equal(['bob']);
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
  expect(el.filteredItems.map((i) => i.id)).to.deep.equal(['carol']);
  expect(el.activeDescendantId).to.equal(el.listboxId + '-opt-0');
});

it('returns false from handleKeyDown while closed', async () => {
  const el = (await fixture(html`<lyra-mention-popover></lyra-mention-popover>`)) as LyraMentionPopover;
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

it('scrolls the active row into view as ArrowDown moves it past the popup\'s visible, height-capped area', async () => {
  const manyItems: MentionItem[] = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}` }));
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
  expect(activeRow).to.exist;
  const rowRect = activeRow.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  expect(rowRect.top >= boxRect.top - 1, 'active row top must be within the scrolled listbox viewport').to.be.true;
  expect(rowRect.bottom <= boxRect.bottom + 1, 'active row bottom must be within the scrolled listbox viewport').to.be
    .true;
});

it('ArrowDown/ArrowUp preventDefault and report the key as consumed', async () => {
  const el = await openWithItems();
  const evt = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
  const consumed = el.handleKeyDown(evt);
  expect(consumed).to.be.true;
  expect(evt.defaultPrevented).to.be.true;
});

it('leaves ArrowDown/ArrowUp unconsumed when there is nothing to navigate (no matches)', async () => {
  const el = await openWithItems();
  el.query = 'zzz-no-match';
  await el.updateComplete;
  expect(el.filteredItems.length).to.equal(0);

  const downEvt = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
  expect(el.handleKeyDown(downEvt), 'ArrowDown must fall through, e.g. so the host textarea still moves its caret')
    .to.be.false;
  expect(downEvt.defaultPrevented).to.be.false;

  const upEvt = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
  expect(el.handleKeyDown(upEvt)).to.be.false;
  expect(upEvt.defaultPrevented).to.be.false;
});

it('commits the active item on Enter: fires lyra-mention-select, closes, and does not fire lyra-mention-close', async () => {
  const el = await openWithItems();
  let closeFired = false;
  el.addEventListener('lyra-mention-close', () => (closeFired = true));

  const listener = oneEvent(el, 'lyra-mention-select');
  const evt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
  const consumed = el.handleKeyDown(evt);
  const { detail } = (await listener) as CustomEvent<MentionSelectDetail>;

  expect(consumed).to.be.true;
  expect(evt.defaultPrevented).to.be.true;
  expect(detail).to.deep.equal({ id: 'alice', label: 'Alice Johansson' });
  expect(el.open).to.be.false;
  await el.updateComplete;
  expect(closeFired).to.be.false;
});

it('commits the active item on Tab, same as Enter', async () => {
  const el = await openWithItems();
  el.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  await el.updateComplete;

  const listener = oneEvent(el, 'lyra-mention-select');
  const consumed = el.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
  const { detail } = (await listener) as CustomEvent<MentionSelectDetail>;
  expect(consumed).to.be.true;
  expect(detail).to.deep.equal({ id: 'bob', label: 'Bob Nakamura' });
});

it('leaves Enter/Tab unconsumed when there is no active row to commit (no matches)', async () => {
  const el = await openWithItems();
  el.query = 'zzz-no-match';
  await el.updateComplete;
  expect(el.filteredItems.length).to.equal(0);

  const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
  expect(el.handleKeyDown(enterEvt)).to.be.false;
  expect(enterEvt.defaultPrevented).to.be.false;
  expect(el.open).to.be.true;

  const tabEvt = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
  expect(el.handleKeyDown(tabEvt)).to.be.false;
  expect(el.open).to.be.true;
});

it('closes and fires lyra-mention-close on Escape, without a select event', async () => {
  const el = await openWithItems();
  let selectFired = false;
  el.addEventListener('lyra-mention-select', () => (selectFired = true));

  const listener = oneEvent(el, 'lyra-mention-close');
  const evt = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  const consumed = el.handleKeyDown(evt);
  await listener;

  expect(consumed).to.be.true;
  expect(evt.defaultPrevented).to.be.true;
  expect(el.open).to.be.false;
  expect(selectFired).to.be.false;
});

it('fires lyra-mention-close when a host directly sets open = false (no Escape involved)', async () => {
  const el = await openWithItems();
  const listener = oneEvent(el, 'lyra-mention-close');
  el.open = false;
  await listener;
  expect(el.open).to.be.false;
});

it('does not fire lyra-mention-close for markup that mounts already open="false"', async () => {
  const el = (await fixture(html`<lyra-mention-popover></lyra-mention-popover>`)) as LyraMentionPopover;
  let closeFired = false;
  el.addEventListener('lyra-mention-close', () => (closeFired = true));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 20));
  expect(closeFired).to.be.false;
});

it('commits a row on click, and preventDefaults its own mousedown so focus never leaves the host input', async () => {
  const el = await openWithItems();

  const listener = oneEvent(el, 'lyra-mention-select');
  const row = rows(el)[2];
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  row.dispatchEvent(down);
  expect(down.defaultPrevented, 'mousedown on a row must be prevented so focus never leaves the host input').to.be
    .true;
  row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { detail } = (await listener) as CustomEvent<MentionSelectDetail>;
  expect(detail).to.deep.equal({ id: 'carol', label: 'Carol Ibarra' });
});

it('exposes activeDescendantId as null while closed', async () => {
  const el = (await fixture(html`<lyra-mention-popover></lyra-mention-popover>`)) as LyraMentionPopover;
  el.items = ITEMS;
  await el.updateComplete;
  expect(el.activeDescendantId).to.be.null;
});

it('positions the popup (position: fixed) against a plain non-text-control anchor', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="trigger" style="position:absolute; top:120px; left:80px; width:40px; height:20px;">@</button>
      <lyra-mention-popover></lyra-mention-popover>
    </div>
  `);
  const trigger = wrap.querySelector('#trigger') as HTMLElement;
  const el = wrap.querySelector('lyra-mention-popover') as LyraMentionPopover;
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
      <lyra-mention-popover></lyra-mention-popover>
    </div>
  `);
  const textarea = wrap.querySelector('#ta') as HTMLTextAreaElement;
  const el = wrap.querySelector('lyra-mention-popover') as LyraMentionPopover;

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

it('defaults the listbox accessible name to "Suggestions", overridable via label', async () => {
  const el = await openWithItems();
  expect(listbox(el).getAttribute('aria-label')).to.equal('Suggestions');
  el.label = 'Mention someone';
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Mention someone');
});

it('a host aria-label attribute overrides the label property and the localized default', async () => {
  const el = (await fixture(
    html`<lyra-mention-popover label="Mention someone" aria-label="Custom name"></lyra-mention-popover>`,
  )) as LyraMentionPopover;
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  el.anchor = anchor;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Custom name');
});

it('honors a strings override for mentionSuggestions/noMatches while label/emptyText are left at their defaults', async () => {
  const el = await openWithItems([]);
  el.strings = { mentionSuggestions: 'Suggestions de mention', noMatches: 'Aucun résultat' };
  await el.updateComplete;
  expect(listbox(el).getAttribute('aria-label')).to.equal('Suggestions de mention');
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty.textContent).to.equal('Aucun résultat');
});

it('is accessible (empty/closed default state)', async () => {
  const el = (await fixture(html`<lyra-mention-popover></lyra-mention-popover>`)) as LyraMentionPopover;
  await expect(el).to.be.accessible();
});

it('is accessible (populated, open state)', async () => {
  const el = await openWithItems();
  await expect(el).to.be.accessible();
});
