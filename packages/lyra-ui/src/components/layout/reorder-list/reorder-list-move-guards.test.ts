import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './reorder-list.js';
import './reorder-item.js';
import type { LyraReorderList } from './reorder-list.class.js';
import type { LyraReorderItem } from './reorder-item.class.js';

class ReorderNestedWidget extends HTMLElement {
  constructor() {
    super();
    this.tabIndex = 0;
  }
}
if (!customElements.get('reorder-nested-widget')) customElements.define('reorder-nested-widget', ReorderNestedWidget);

const itemsOf = (el: LyraReorderList): LyraReorderItem[] => [...el.querySelectorAll<LyraReorderItem>('lr-reorder-item')];
const valuesOf = (el: LyraReorderList): string[] => itemsOf(el).map((item) => item.value);

function moveRequest(item: LyraReorderItem, direction: 'up' | 'down'): void {
  item.dispatchEvent(new CustomEvent('lr-move-request', { detail: { direction }, bubbles: true, composed: true }));
}

function ctrlArrow(target: EventTarget, key: 'ArrowUp' | 'ArrowDown'): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

async function renderList(): Promise<LyraReorderList> {
  const el = await fixture<LyraReorderList>(html`<lr-reorder-list>
    <lr-reorder-item value="a">Row A</lr-reorder-item>
    <lr-reorder-item value="b">Row B <reorder-nested-widget>widget</reorder-nested-widget></lr-reorder-item>
    <lr-reorder-item value="c">Row C</lr-reorder-item>
  </lr-reorder-list>`);
  await Promise.all(itemsOf(el).map((item) => item.updateComplete));
  return el;
}

describe('lr-reorder-list move guards', () => {
  it('moves the middle item up via Ctrl+ArrowUp from its own move control', async () => {
    const el = await renderList();
    const upButton = itemsOf(el)[1]!.shadowRoot!.querySelector<HTMLElement>('[part="move-up-button"]')!;
    upButton.focus();
    const listener = oneEvent(el, 'lr-reorder-request');
    const event = ctrlArrow(upButton, 'ArrowUp');
    const request = (await listener) as CustomEvent<{ order: string[]; fromIndex: number; toIndex: number }>;
    expect(event.defaultPrevented).to.equal(true);
    expect(request.detail).to.deep.equal({ order: ['b', 'a', 'c'], fromIndex: 1, toIndex: 0 });
    expect(valuesOf(el)).to.deep.equal(['b', 'a', 'c']);
  });

  it('leaves Ctrl+Arrow keys from a nested custom element to that element', async () => {
    const el = await renderList();
    let requests = 0;
    el.addEventListener('lr-reorder-request', () => (requests += 1));
    const widget = el.querySelector<HTMLElement>('reorder-nested-widget')!;
    widget.focus();
    const event = ctrlArrow(widget, 'ArrowDown');
    expect(event.defaultPrevented).to.equal(false);
    expect(requests).to.equal(0);
    expect(valuesOf(el)).to.deep.equal(['a', 'b', 'c']);
  });

  it('ignores move requests past either end or from a disabled row', async () => {
    const el = await renderList();
    let requests = 0;
    el.addEventListener('lr-reorder-request', () => (requests += 1));
    const [first, middle, last] = itemsOf(el);
    moveRequest(first!, 'up');
    moveRequest(last!, 'down');
    middle!.disabled = true;
    await middle!.updateComplete;
    moveRequest(middle!, 'down');
    expect(requests).to.equal(0);
    expect(valuesOf(el)).to.deep.equal(['a', 'b', 'c']);
  });

  it('ignores a move request from a row that has left the list', async () => {
    const el = await renderList();
    let requests = 0;
    el.addEventListener('lr-reorder-request', () => (requests += 1));
    const detached = itemsOf(el)[2]!;
    const wrapper = document.createElement('div');
    el.append(wrapper);
    wrapper.append(detached);
    moveRequest(detached, 'up');
    expect(requests).to.equal(0);
    expect(valuesOf(el)).to.deep.equal(['a', 'b', 'c']);
  });
});
