import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './emoji-picker.js';
import type { EmojiPickerGroup, LyraEmojiPicker } from './emoji-picker.js';

const groups: EmojiPickerGroup[] = [{
  key: 'faces',
  label: 'Faces',
  emojis: Array.from({ length: 500 }, (_, index) => ({ emoji: '😀', name: `Face ${index}` })),
}];

it('keeps the active search option mounted when the virtual window scrolls away', async () => {
  const picker = await fixture<LyraEmojiPicker>(html`<lr-emoji-picker
    style="inline-size: 320px" .groups=${groups}
  ></lr-emoji-picker>`);
  const root = picker.shadowRoot!;
  const search = root.querySelector<HTMLInputElement>('[part="search"]')!;
  const grid = root.querySelector<HTMLElement>('[part="grid"]')!;
  await focusByKeyboard(search);
  await sendKeys({ press: 'Home' });
  await picker.updateComplete;
  const activeId = search.getAttribute('aria-activedescendant')!;
  expect(root.getElementById(activeId)?.dataset['index']).to.equal('0');
  const before = root.querySelectorAll('[part="emoji"]').length;
  expect(before).to.be.greaterThan(0).and.lessThan(200);

  grid.scrollTop = grid.scrollHeight;
  await waitUntil(() => root.querySelector('[part="emoji"][data-index="499"]') !== null);
  await twoFrames();
  await picker.updateComplete;
  expect(grid.scrollTop).to.be.greaterThan(grid.clientHeight);
  expect(root.activeElement === search).to.equal(true);
  expect(search.getAttribute('aria-activedescendant')).to.equal(activeId);
  expect(root.getElementById(activeId)?.getAttribute('role')).to.equal('option');
  expect(root.getElementById(activeId)?.dataset['index']).to.equal('0');
  expect(root.querySelectorAll('[part="emoji"]').length).to.be.lessThan(200);
  picker.style.inlineSize = '256px';
  await twoFrames();
  await picker.updateComplete;
  expect(root.getElementById(activeId)?.dataset['index']).to.equal('0');

  await sendKeys({ press: 'ArrowRight' });
  await picker.updateComplete;
  const nextId = search.getAttribute('aria-activedescendant')!;
  await waitUntil(() => root.getElementById(nextId) !== null);
  expect(root.getElementById(nextId)?.dataset['index']).to.equal('1');
  expect(root.activeElement === search).to.equal(true);

  picker.groups = [];
  await picker.updateComplete;
  expect(search.hasAttribute('aria-activedescendant')).to.equal(false);
  expect(root.querySelectorAll('[part="emoji"]').length).to.equal(0);
});

it('retains the final active row after scrolling back to the beginning', async () => {
  const picker = await fixture<LyraEmojiPicker>(html`<lr-emoji-picker
    style="inline-size: 320px" .groups=${groups}
  ></lr-emoji-picker>`);
  const root = picker.shadowRoot!;
  const search = root.querySelector<HTMLInputElement>('[part="search"]')!;
  const grid = root.querySelector<HTMLElement>('[part="grid"]')!;
  await focusByKeyboard(root.querySelector<HTMLButtonElement>('[part="emoji"][data-index="0"]')!);
  await sendKeys({ press: 'End' });
  await waitUntil(() => root.querySelector('[part="emoji"][data-index="499"]') !== null);
  const last = root.querySelector<HTMLButtonElement>('[part="emoji"][data-index="499"]')!;
  await focusByKeyboard(last);
  await twoFrames();
  await picker.updateComplete;
  grid.scrollTop = 0;
  await waitUntil(() => root.querySelector('[part="emoji"][data-index="0"]') !== null);
  await twoFrames();
  expect(root.activeElement === last).to.equal(true);
  expect(root.getElementById(search.getAttribute('aria-activedescendant')!) === last).to.equal(true);
  expect(grid.scrollTop).to.equal(0);
  const indices = Array.from(root.querySelectorAll<HTMLElement>('[part="emoji"]'), (option) => Number(option.dataset['index']));
  expect(indices).to.deep.equal([...indices].sort((a, b) => a - b));
  expect(new Set(indices).size).to.equal(indices.length);
  expect(indices.length).to.be.lessThan(200);
});

it('retains a focused option node when scrolling beyond its virtual row', async () => {
  const picker = await fixture<LyraEmojiPicker>(html`<lr-emoji-picker
    style="inline-size: 320px" .groups=${groups}
  ></lr-emoji-picker>`);
  const root = picker.shadowRoot!;
  const first = root.querySelector<HTMLButtonElement>('[part="emoji"][data-index="0"]')!;
  const grid = root.querySelector<HTMLElement>('[part="grid"]')!;
  await focusByKeyboard(first);
  await twoFrames();
  await picker.updateComplete;
  grid.scrollTop = grid.scrollHeight;
  await waitUntil(() => root.querySelector('[part="emoji"][data-index="499"]') !== null);
  await twoFrames();
  expect(root.activeElement === first).to.equal(true);
  expect(first.isConnected).to.equal(true);
  expect(grid.scrollTop).to.be.greaterThan(grid.clientHeight);
  const indices = Array.from(root.querySelectorAll<HTMLElement>('[part="emoji"]'), (option) => Number(option.dataset['index']));
  expect(indices).to.deep.equal([...indices].sort((a, b) => a - b));
  expect(new Set(indices).size).to.equal(indices.length);
  expect(indices.length).to.be.lessThan(200);
});
