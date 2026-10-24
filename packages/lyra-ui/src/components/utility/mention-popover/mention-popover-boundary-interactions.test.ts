import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sinkTexts } from '../../../../test/announcements.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraMentionItem, LyraMentionPopover, LyraMentionSelectDetail } from './mention-popover.class.js';
import './mention-popover.js';

afterEach(async () => { await resetMouse(); });

function listbox(el: LyraMentionPopover): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
}

async function open(items: readonly LyraMentionItem[]): Promise<{ el: LyraMentionPopover; anchor: HTMLButtonElement }> {
  const wrapper = await fixture<HTMLElement>(html`<div><button>Suggestions</button><lr-mention-popover></lr-mention-popover></div>`);
  const anchor = wrapper.querySelector<HTMLButtonElement>('button')!;
  const el = wrapper.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  el.anchor = anchor;
  el.items = items;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => getComputedStyle(listbox(el)).visibility === 'visible');
  return { el, anchor };
}

it('keeps the source occurrence of a usable suggestion after holes, accessors and an unreadable record', async () => {
  let reads = 0;
  const items: LyraMentionItem[] = [];
  items.length = 5;
  Object.defineProperty(items, '1', { get() { reads += 1; throw new Error('candidate accessor'); } });
  items[2] = new Proxy({ suggestionId: 'unreadable', label: 'Unreadable' }, {
    ownKeys() { throw new Error('candidate keys'); },
  });
  items[4] = { suggestionId: 'available', label: 'Available suggestion' };
  const { el } = await open(items);
  expect(el.filteredItems.map(item => item.suggestionId)).to.deep.equal(['available']);
  expect(reads).to.equal(0);
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!;
  const selected = oneEvent(el, 'lr-mention-select');
  const rect = row.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
  const event = await selected as CustomEvent<LyraMentionSelectDetail>;
  expect(event.detail).to.deep.equal({ suggestionId: 'available', label: 'Available suggestion', index: 4 });
  expect(el.open).to.equal(false);
  expect(reads).to.equal(0);
});

it('announces a candidate admission limit introduced after mount and clears its visible notice on recovery', async () => {
  const { el } = await open([{ suggestionId: 'first', label: 'First' }]);
  const notice = 'Only the initial candidate set is available';
  el.strings = { mentionInputLimit: notice };
  await el.updateComplete;
  const items: LyraMentionItem[] = [];
  items.length = 10_001;
  items[0] = { suggestionId: 'first', label: 'First' };
  items[10_000] = { suggestionId: 'omitted', label: 'Omitted' };
  el.items = items;
  await el.updateComplete;
  expect(el.items.length).to.equal(10_000);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(notice);
  expect(el.filteredItems.map(item => item.suggestionId)).to.deep.equal(['first']);
  await waitUntil(() => sinkTexts().includes(notice));

  el.items = [{ suggestionId: 'recovered', label: 'Recovered' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
  expect(el.filteredItems.map(item => item.suggestionId)).to.deep.equal(['recovered']);
});

for (const [items, key, expected] of [
  [[{ suggestionId: 'enabled', label: 'Enabled' }, { suggestionId: 'disabled', label: 'Disabled', disabled: true }], 'ArrowDown', 'enabled'],
  [[{ suggestionId: 'disabled', label: 'Disabled', disabled: true }, { suggestionId: 'enabled', label: 'Enabled' }], 'ArrowUp', 'enabled'],
  [[{ suggestionId: 'disabled', label: 'Disabled', disabled: true }], 'ArrowDown', null],
] as const) {
  it(`keeps an enabled boundary selection when ${key} reaches unavailable suggestions (${String(expected)})`, async () => {
    const { el } = await open(items);
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    expect(el.handleKeyDown(event)).to.equal(true);
    expect(event.defaultPrevented).to.equal(true);
    await el.updateComplete;
    expect(el.activeDescendantElement?.dataset['id'] ?? null).to.equal(expected);
    if (expected === null) expect(el.activeDescendantId).to.equal(null);
  });
}

it('scrolls back to the first option on Home and honors a consumed native navigation key', async () => {
  const items = Array.from({ length: 30 }, (_, index) => ({ suggestionId: `member-${index}`, label: `Member ${index}` }));
  const { el, anchor } = await open(items);
  await focusByKeyboard(anchor);
  expect(await el.focusActiveOption()).to.equal(true);
  await sendKeys({ press: 'End' });
  await waitUntil(() => el.activeDescendantElement?.dataset['id'] === 'member-29' && listbox(el).scrollTop > 0);
  const endScrollTop = listbox(el).scrollTop;
  await sendKeys({ press: 'Home' });
  await waitUntil(() => el.activeDescendantElement?.dataset['id'] === 'member-0' && listbox(el).scrollTop < endScrollTop);
  const first = el.activeDescendantElement!.getBoundingClientRect();
  const viewport = listbox(el).getBoundingClientRect();
  expect(first.top >= viewport.top - 1 && first.bottom <= viewport.bottom + 1, 'Home reveals the whole first option').to.equal(true);
  el.shadowRoot!.addEventListener('keydown', event => event.preventDefault(), { capture: true, once: true });
  await sendKeys({ press: 'ArrowDown' });
  await el.updateComplete;
  expect(el.activeDescendantElement?.dataset['id']).to.equal('member-0');
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']).to.equal('member-0');
});

it('declines fallback focus while inert and succeeds when the suggestion surface becomes available', async () => {
  const { el, anchor } = await open([{ suggestionId: 'first', label: 'First' }]);
  await focusByKeyboard(anchor);
  el.inert = true;
  expect(await el.focusActiveOption()).to.equal(false);
  expect(document.activeElement === anchor).to.equal(true);
  el.inert = false;
  expect(await el.focusActiveOption()).to.equal(true);
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']).to.equal('first');
});
