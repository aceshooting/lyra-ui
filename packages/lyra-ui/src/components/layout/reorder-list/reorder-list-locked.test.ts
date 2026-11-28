import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-reorder-list.js';
import '../../lr-reorder-item.js';
import type { LyraReorderList } from './reorder-list.class.js';
import type { LyraReorderItem } from './reorder-item.class.js';

type Detail = { order: string[]; fromIndex: number; toIndex: number };

const itemsOf = (el: LyraReorderList): LyraReorderItem[] => [...el.querySelectorAll<LyraReorderItem>('lr-reorder-item')];
const valuesOf = (el: LyraReorderList): string[] => itemsOf(el).map((item) => item.value);
const button = (item: LyraReorderItem, direction: 'up' | 'down'): (HTMLElement & { disabled: boolean }) | null =>
  item.shadowRoot!.querySelector(`[part='move-${direction}-button']`);
const settle = async (el: LyraReorderList): Promise<void> => {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  await Promise.all(itemsOf(el).map((item) => item.updateComplete));
};

function moveRequest(item: LyraReorderItem, direction: 'up' | 'down'): void {
  item.dispatchEvent(new CustomEvent('lr-move-request', { detail: { direction }, bubbles: true, composed: true }));
}

function ctrlArrow(target: EventTarget, key: 'ArrowUp' | 'ArrowDown'): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

async function renderList(dir: 'ltr' | 'rtl' = 'ltr'): Promise<LyraReorderList> {
  const el = await fixture<LyraReorderList>(html`<lr-reorder-list dir=${dir} label="Columns">
    <lr-reorder-item value="a">Row A</lr-reorder-item>
    <lr-reorder-item value="system" locked><span tabindex="0">System row</span></lr-reorder-item>
    <lr-reorder-item value="c">Row C</lr-reorder-item>
  </lr-reorder-list>`);
  await settle(el);
  return el;
}

describe('lr-reorder-item locked', () => {
  it('defaults to unlocked and keeps both move controls (unset regression)', async () => {
    const el = await fixture<LyraReorderList>(html`<lr-reorder-list>
      <lr-reorder-item value="a">Row A</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
      <lr-reorder-item value="c">Row C</lr-reorder-item>
    </lr-reorder-list>`);
    await settle(el);
    const [first, middle, last] = itemsOf(el);
    expect(middle!.locked).to.equal(false);
    expect(middle!.hasAttribute('locked')).to.equal(false);
    expect(button(middle!, 'up')?.disabled).to.equal(false);
    expect(button(middle!, 'down')?.disabled).to.equal(false);
    expect(button(first!, 'up')?.disabled).to.equal(true);
    expect(button(last!, 'down')?.disabled).to.equal(true);
    const listener = oneEvent(el, 'lr-reorder-request');
    moveRequest(last!, 'up');
    const request = (await listener) as CustomEvent<Detail>;
    expect(request.detail).to.deep.equal({ order: ['a', 'c', 'b'], fromIndex: 2, toIndex: 1 });
  });

  it('renders no move controls on a locked row but keeps its content and position', async () => {
    const el = await renderList();
    const locked = itemsOf(el)[1]!;
    expect(locked.locked).to.equal(true);
    expect(locked.hasAttribute('locked')).to.equal(true);
    expect(button(locked, 'up') === null).to.equal(true);
    expect(button(locked, 'down') === null).to.equal(true);
    expect(locked.shadowRoot!.querySelector('[part="content"] slot') !== null).to.equal(true);
    expect(locked.getAttribute('role')).to.equal('listitem');
    expect(locked.disabled).to.equal(false);
    expect(locked.focusMoveButton('up')).to.equal(false);
    expect(locked.focusMoveButton('down')).to.equal(false);
  });

  it('ignores move requests and Ctrl+Arrow shortcuts on a locked row', async () => {
    const el = await renderList();
    let requests = 0;
    el.addEventListener('lr-reorder-request', () => (requests += 1));
    const locked = itemsOf(el)[1]!;
    moveRequest(locked, 'up');
    moveRequest(locked, 'down');
    const focusable = locked.querySelector<HTMLElement>('span[tabindex]')!;
    focusable.focus();
    const up = ctrlArrow(focusable, 'ArrowUp');
    const down = ctrlArrow(focusable, 'ArrowDown');
    expect(up.defaultPrevented).to.equal(false);
    expect(down.defaultPrevented).to.equal(false);
    expect(requests).to.equal(0);
    expect(valuesOf(el)).to.deep.equal(['a', 'system', 'c']);
  });

  it('moves another row past a locked row, which keeps its index', async () => {
    const el = await renderList();
    const last = itemsOf(el)[2]!;
    const listener = oneEvent(el, 'lr-reorder-request');
    moveRequest(last, 'up');
    const request = (await listener) as CustomEvent<Detail>;
    expect(request.detail).to.deep.equal({ order: ['c', 'system', 'a'], fromIndex: 2, toIndex: 0 });
    await settle(el);
    expect(valuesOf(el)).to.deep.equal(['c', 'system', 'a']);

    const first = itemsOf(el)[0]!;
    expect(first.value).to.equal('c');
    const next = oneEvent(el, 'lr-reorder-request');
    ctrlArrow(button(first, 'down')!, 'ArrowDown');
    const keyboard = (await next) as CustomEvent<Detail>;
    expect(keyboard.detail).to.deep.equal({ order: ['a', 'system', 'c'], fromIndex: 0, toIndex: 2 });
    await settle(el);
    expect(valuesOf(el)).to.deep.equal(['a', 'system', 'c']);
  });

  it('restores focus onto the moved row after skipping a locked row', async () => {
    const el = await renderList();
    const last = itemsOf(el)[2]!;
    button(last, 'up')!.click();
    await settle(el);
    // Now first with no movable row above: focus falls back to the down control.
    await waitUntil(() => last.shadowRoot!.activeElement === button(last, 'down'), 'focus restored to move-down');
    expect(valuesOf(el)).to.deep.equal(['c', 'system', 'a']);
  });

  it('disables a neighbour control whose only target is a locked row, and re-enables it on unlock', async () => {
    const el = await fixture<LyraReorderList>(html`<lr-reorder-list>
      <lr-reorder-item value="header" locked>Header</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
      <lr-reorder-item value="c">Row C</lr-reorder-item>
      <lr-reorder-item value="footer" locked>Footer</lr-reorder-item>
    </lr-reorder-list>`);
    await settle(el);
    const [header, b, c] = itemsOf(el);
    expect(button(b!, 'up')?.disabled).to.equal(true);
    expect(button(b!, 'down')?.disabled).to.equal(false);
    expect(button(c!, 'up')?.disabled).to.equal(false);
    expect(button(c!, 'down')?.disabled).to.equal(true);
    expect(b!.focusMoveButton('up')).to.equal(false);
    // Positional boundary state is unchanged by locking.
    expect(b!.atStart).to.equal(false);
    expect(header!.atStart).to.equal(true);

    let requests = 0;
    el.addEventListener('lr-reorder-request', () => (requests += 1));
    moveRequest(b!, 'up');
    moveRequest(c!, 'down');
    expect(requests).to.equal(0);

    header!.locked = false;
    await settle(el);
    expect(button(header!, 'down')?.disabled).to.equal(false);
    expect(button(b!, 'up')?.disabled).to.equal(false);
    const listener = oneEvent(el, 'lr-reorder-request');
    moveRequest(b!, 'up');
    const request = (await listener) as CustomEvent<Detail>;
    expect(request.detail.order).to.deep.equal(['b', 'header', 'c', 'footer']);
  });

  it('refuses to finalize a held move once its row becomes locked', async () => {
    const el = await renderList();
    el.addEventListener('lr-reorder-request', (event) => event.preventDefault(), { once: true });
    const first = itemsOf(el)[0]!;
    moveRequest(first, 'down');
    await settle(el);
    first.locked = true;
    await settle(el);
    el.finalizePendingMove();
    await settle(el);
    expect(valuesOf(el)).to.deep.equal(['a', 'system', 'c']);
  });

  it('skips a locked row in controlled mode, expecting the swapped order', async () => {
    const el = await renderList();
    el.controlled = true;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-reorder-request');
    moveRequest(itemsOf(el)[0]!, 'down');
    const request = (await listener) as CustomEvent<Detail>;
    expect(request.detail).to.deep.equal({ order: ['c', 'system', 'a'], fromIndex: 0, toIndex: 2 });
    expect(valuesOf(el)).to.deep.equal(['a', 'system', 'c']);
    const [a, system, c] = itemsOf(el);
    el.replaceChildren(c!, system!, a!);
    await settle(el);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('false');
  });

  it('skips a locked row under dir="rtl" with the same logical order', async () => {
    const el = await renderList('rtl');
    expect(button(itemsOf(el)[1]!, 'up') === null).to.equal(true);
    const listener = oneEvent(el, 'lr-reorder-request');
    moveRequest(itemsOf(el)[0]!, 'down');
    const request = (await listener) as CustomEvent<Detail>;
    expect(request.detail.order).to.deep.equal(['c', 'system', 'a']);
  });

  it('passes axe with locked rows', async () => {
    const el = await renderList();
    await expect(el).to.be.accessible();
  });
});
