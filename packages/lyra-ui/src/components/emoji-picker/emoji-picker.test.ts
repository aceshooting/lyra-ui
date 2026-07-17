import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './emoji-picker.js';
import type { LyraEmojiPicker, EmojiPickerGroup } from './emoji-picker.js';

const groups: EmojiPickerGroup[] = [
  {
    key: 'smileys',
    label: 'Smileys',
    emojis: [
      { emoji: '😀', name: 'grinning face', shortcodes: ['grinning'] },
      { emoji: '😂', name: 'face with tears of joy', shortcodes: ['joy'] },
    ],
  },
  {
    key: 'animals',
    label: 'Animals',
    emojis: [{ emoji: '🐶', name: 'dog face', shortcodes: ['dog'] }],
  },
];

it('defaults to value "" (unset, matching FormAssociated\'s native-<input>-like contract) and empty groups', async () => {
  const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
  expect(el.value).to.equal('');
  expect(el.groups).to.deep.equal([]);
});

it('renders one button per emoji, grouped under a heading per group', async () => {
  const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
  el.groups = groups;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(3);
  const headings = [...el.shadowRoot!.querySelectorAll('[part="group-label"]')].map((h) => h.textContent);
  expect(headings).to.deep.equal(['Smileys', 'Animals']);
});

it('is form-associated, participating in an ancestor form.elements', async () => {
  const form = (await fixture(html`<form><lyra-emoji-picker></lyra-emoji-picker></form>`)) as HTMLFormElement;
  const el = form.querySelector('lyra-emoji-picker') as LyraEmojiPicker;
  expect(Array.from(form.elements)).to.include(el);
});

it('sets value and fires lyra-change when an emoji is picked', async () => {
  const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
  el.groups = groups;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lyra-change');
  button.click();
  const event = await eventPromise;
  expect(el.value).to.equal('😀');
  expect(event.detail).to.deep.equal({ emoji: '😀' });
});

describe('search filtering', () => {
  it('filters emojis by name and shortcode, case-insensitively', async () => {
    const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'DOG';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="emoji"]')!.textContent).to.equal('🐶');
  });

  it('shows an empty state when the search matches nothing', async () => {
    const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'not-a-real-emoji-name-xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  });
});

describe('keyboard navigation', () => {
  it('moves the active grid index with ArrowRight/ArrowLeft and picks on Enter', async () => {
    const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const eventPromise = oneEvent(el, 'lyra-change');
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ emoji: '😂' }); // second emoji, after one ArrowRight from index 0
  });
});

it('does not let a slow auto-load overwrite an explicitly-set groups value', async () => {
  const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
  el.groups = groups; // set immediately, before any real network/import round-trip could resolve
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 50)); // let any stray auto-load attempt settle
  expect(el.groups).to.deep.equal(groups);
});

it('is accessible with groups populated', async () => {
  const el = (await fixture(html`<lyra-emoji-picker></lyra-emoji-picker>`)) as LyraEmojiPicker;
  el.groups = groups;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
