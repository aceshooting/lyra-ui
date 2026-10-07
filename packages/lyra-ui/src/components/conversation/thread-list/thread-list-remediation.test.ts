import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import './thread-list.js';
import type { LyraThreadList } from './thread-list.js';

it('treats an explicitly empty slot attribute as default thread content', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list><lr-conversation-item slot="" label="Thread"></lr-conversation-item></lr-thread-list>`);
  const item = el.querySelector('lr-conversation-item')!;
  await waitUntil(() => item.getAttribute('role') === 'listitem', 'default slotted thread should belong to the list');
  expect(el.shadowRoot!.querySelector('[part="list"]')?.getAttribute('role')).to.equal('list');
  item.setAttribute('slot', 'empty');
  await waitUntil(() => item.getAttribute('role') === null, 'moving out of default slot should release its generated role');
  const parent = el.parentElement!;
  el.remove();
  item.setAttribute('slot', '');
  parent.append(el);
  await el.updateComplete;
  await waitUntil(() => item.getAttribute('role') === 'listitem');
});

it('keeps row focus/blur and internal list events inside the component', async () => {
  const wrapper = await fixture(html`<div><lr-thread-list .threads=${[{ id: 'a', title: 'A' }]}></lr-thread-list></div>`);
  const el = wrapper.querySelector('lr-thread-list') as LyraThreadList;
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => el.itemElement('a') !== null);
  const leaked: string[] = [];
  const names = ['focus', 'blur', 'lr-visible-range-change', 'lr-load-more', 'lr-virtual-scroll'];
  for (const name of names) wrapper.addEventListener(name, () => leaked.push(name));
  for (const name of names.slice(0, 2)) {
    el.itemElement('a')!.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }
  for (const name of names.slice(2)) {
    list.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail: null }));
  }
  expect(leaked).to.deep.equal([]);
  let hostFocus = 0;
  el.addEventListener('focus', () => hostFocus++);
  el.itemElement('a')!.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!.focus();
  expect(hostFocus, 'native focus still reaches the host').to.equal(1);
});

const tenThreads = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, title: `Thread ${i}` }));

it('keeps its item model across updates that do not change it, while rows still update', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .threads=${tenThreads}></lr-thread-list>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
  await waitUntil(() => el.itemElement('t1') !== null);
  const items = list.items;
  el.activeConversationId = 't1';
  el.size = 's';
  await el.updateComplete;
  await list.updateComplete;
  expect(list.items === items, 'the same item model stays bound').to.be.true;
  expect(el.itemElement('t1')?.active).to.be.true;
  expect(el.itemElement('t1')?.getAttribute('size')).to.equal('s');
});

it('moves ArrowDown/ArrowUp from a row action to the adjacent row', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .rowActions=${['pin', 'archive']} .threads=${tenThreads}></lr-thread-list>`);
  await waitUntil(() => el.itemElement('t5') !== null);
  const focusedRow = () => (el.itemElement('t4')!.shadowRoot!.activeElement ? 't4' : el.itemElement('t6')!.shadowRoot!.activeElement ? 't6' : 'other');
  await focusByKeyboard(el.itemElement('t5')!.querySelector<HTMLElement>('[part="row-action"]')!);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => focusedRow() !== 'other', 'ArrowDown moved focus to a neighbour');
  expect(focusedRow()).to.equal('t6');
  await focusByKeyboard(el.itemElement('t5')!.querySelector<HTMLElement>('[part="row-action"]')!);
  await sendKeys({ press: 'ArrowUp' });
  await waitUntil(() => focusedRow() !== 'other' && focusedRow() !== 't6', 'ArrowUp moved focus to a neighbour');
  expect(focusedRow()).to.equal('t4');
});

it('files a future-dated thread under Today', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .threads=${[{ id: 'f', title: 'Future', timestamp: Date.now() + 86_400_000 }]}></lr-thread-list>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
  const labels = (list.items as { kind: string; label?: string }[]).filter((item) => item.kind === 'group').map((item) => item.label);
  expect(labels).to.deep.equal(['Today']);
});

it('draws group disclosure with the shared chevron glyph', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .threads=${[{ id: 'a', title: 'A', timestamp: Date.now() }]}></lr-thread-list>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
  await waitUntil(() => list.shadowRoot!.querySelector('[part="group-icon"]'));
  const icon = list.shadowRoot!.querySelector('[part="group-icon"]')!;
  expect(icon.querySelector('svg polyline')?.getAttribute('points')).to.equal('9 6 15 12 9 18');
  expect(icon.textContent!.trim()).to.equal('');
});

it('paints row actions and the clear button from the shared icon-button tokens', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list style="--lr-icon-button-radius: 7px; --lr-icon-button-color: rgb(1, 2, 3); --lr-icon-button-bg: rgb(4, 5, 6)" searchable grouping="none" .rowActions=${['pin']} .threads=${[{ id: 'a', title: 'A' }]}></lr-thread-list>`);
  await waitUntil(() => el.itemElement('a') !== null);
  const action = el.itemElement('a')!.querySelector<HTMLElement>('[part="row-action"]')!;
  const style = getComputedStyle(action);
  expect([style.borderTopLeftRadius, style.color, style.backgroundColor]).to.deep.equal(['7px', 'rgb(1, 2, 3)', 'rgb(4, 5, 6)']);
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  input.value = 'a';
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  const clear = el.shadowRoot!.querySelector<HTMLElement>('[part="clear-button"]')!;
  expect(getComputedStyle(clear).borderTopLeftRadius).to.equal('7px');
});
