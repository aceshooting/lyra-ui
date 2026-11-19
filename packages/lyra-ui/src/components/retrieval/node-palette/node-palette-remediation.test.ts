import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { WithCanvas } from './node-palette.stories.js';
import type { LyraNodePalette } from './node-palette.js';
import type { LyraFlowCanvas } from '../../data/flow-canvas/flow-canvas.js';

it('the actual WithCanvas story commits repeated native placements to visible canvas nodes', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>${WithCanvas.render!({}, {} as never)}</div>`);
  const palette = wrapper.querySelector<LyraNodePalette>('lr-node-palette')!;
  const canvas = wrapper.querySelector<LyraFlowCanvas>('lr-flow-canvas')!;
  await palette.updateComplete;
  const option = palette.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
  await focusByKeyboard(option);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => canvas.nodes.length === 1, 'first placement reaches public canvas model');
  await canvas.updateComplete;
  expect(canvas.nodes[0]!.type).to.equal('http-request');
  expect(canvas.shadowRoot!.querySelectorAll('lr-flow-node').length).to.equal(1);
  await focusByKeyboard(option);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => canvas.nodes.length === 2, 'second placement reaches public canvas model');
  await canvas.updateComplete;
  expect(new Set(canvas.nodes.map(node => node.id)).size).to.equal(2);
  expect(canvas.shadowRoot!.querySelectorAll('lr-flow-node').length).to.equal(2);
});

it('leaves modified and composing keys alone and places once per held Enter', async () => {
  const items = [{ type: 'a', label: 'Alpha' }, { type: 'b', label: 'Beta' }];
  const el = await fixture<LyraNodePalette>(html`<lr-node-palette .items=${items}></lr-node-palette>`);
  const first = el.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
  const input = el.shadowRoot!.querySelector<HTMLElement>('input')!;
  const send = (target: HTMLElement, key: string, init: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
    if ('altKey' in init || 'isComposing' in init)
      expect(send(first, 'ArrowDown', init).defaultPrevented, JSON.stringify(init)).to.equal(false);
    expect(send(first, 'Home', init).defaultPrevented, JSON.stringify(init)).to.equal(false);
    expect(send(input, 'ArrowDown', init).defaultPrevented, JSON.stringify(init)).to.equal(false);
  }
  let placed = 0;
  el.addEventListener('lr-palette-place', () => (placed += 1));
  send(first, 'Enter', {});
  send(first, 'Enter', { repeat: true });
  send(first, ' ', { repeat: true });
  expect(placed).to.equal(1);
});

it('announces the first filter result after the palette was moved in the DOM', async () => {
  const items = [{ type: 'api', label: 'API call' }, { type: 'b', label: 'Beta' }];
  const host = await fixture<HTMLDivElement>(html`<div><lr-node-palette .items=${items}></lr-node-palette></div>`);
  const el = host.querySelector<LyraNodePalette>('lr-node-palette')!;
  await el.updateComplete;
  el.remove();
  host.append(el);
  await el.updateComplete;
  const before = sinkTexts().length;
  const input = el.shadowRoot!.querySelector('input')!;
  input.value = 'API';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await waitUntil(() => sinkTexts().length > before, 'the moved palette announces the filter result', { timeout: 3000 });
});

it('does not emit lr-select once an lr-palette-place listener removed the palette', async () => {
  const items = [{ type: 'a', label: 'Alpha' }];
  const el = await fixture<LyraNodePalette>(html`<lr-node-palette .items=${items}></lr-node-palette>`);
  let selected = 0;
  el.addEventListener('lr-palette-place', () => el.remove());
  el.addEventListener('lr-select', () => (selected += 1));
  el.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })
  );
  expect(selected).to.equal(0);
});

it('stops placement when a listener replaces the item before selection', async () => {
  const original = { type: 'alpha', label: 'Alpha' };
  const el = await fixture<LyraNodePalette>(html`<lr-node-palette .items=${[original]}></lr-node-palette>`);
  const events: string[] = [];
  el.addEventListener('lr-palette-place', () => {
    events.push('place');
    el.items = [{ ...original, disabled: true }];
  });
  el.addEventListener('lr-select', () => events.push('select'));
  el.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!.click();
  expect(events).to.deep.equal(['place']);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="option"]')?.getAttribute('aria-disabled')).to.equal('true');
});

it('honors canceled keys in the search field and on a reorderable item', async () => {
  const items = [{ type: 'a', label: 'A' }, { type: 'b', label: 'B' }];
  const el = await fixture<LyraNodePalette>(html`<lr-node-palette reorderable .items=${items}></lr-node-palette>`);
  const field = el.shadowRoot!.querySelector('input')!;
  const item = el.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
  const actions: string[] = [];
  el.addEventListener('lr-reorder', () => actions.push('reorder'));
  el.addEventListener('lr-palette-place', () => actions.push('place'));
  await focusByKeyboard(field);
  const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  down.preventDefault();
  field.dispatchEvent(down);
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === field).to.equal(true);
  for (const init of [{ key: 'Enter' }, { key: 'ArrowDown', ctrlKey: true }]) {
    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    event.preventDefault();
    item.dispatchEvent(event);
  }
  expect(actions).to.deep.equal([]);
});

it('lays an item icon beside its label instead of stacking it above', async () => {
  const items = [{ type: 'a', label: 'Alpha', description: 'First', icon: html`<svg width="16" height="16"></svg>` }];
  const el = await fixture<LyraNodePalette>(html`<lr-node-palette .items=${items}></lr-node-palette>`);
  const rect = (part: string) => el.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect();
  expect(rect('item-icon').top).to.be.lessThan(rect('item-description').bottom);
  expect(rect('item-icon').right).to.be.at.most(rect('item-label').left + 1);
});

it('scrolls the list inside a definite-height host instead of overflowing it', async () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ type: `t${i}`, label: `Item ${i}` }));
  const wrapper = await fixture<HTMLDivElement>(html`<div style="block-size: 240px"><lr-node-palette style="block-size: 100%" .items=${items}></lr-node-palette></div>`);
  const el = wrapper.querySelector<LyraNodePalette>('lr-node-palette')!;
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;
  expect(el.getBoundingClientRect().height).to.be.at.most(241);
  expect(list.scrollHeight).to.be.greaterThan(list.clientHeight);
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="search-field"]')!.getBoundingClientRect().top).to.be.at.least(el.getBoundingClientRect().top);
});
