import { expect, oneEvent, waitUntil } from '@open-wc/testing';
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

// Elements created below bypass `fixture()` (see `connectEmojiPicker()`), so they don't benefit
// from `fixture()`'s own automatic wrapper cleanup -- track and remove them here instead.
const created: Element[] = [];

afterEach(() => {
  for (const el of created) el.remove();
  created.length = 0;
});

/**
 * Creates a `<lyra-emoji-picker>` with `loadGroups` overridden to `loadGroups` *before* the element
 * connects to `document.body` -- `connectedCallback()` kicks off the auto-load synchronously the
 * moment the element becomes connected, so `fixture()` can't intercept it: it inserts (and thus
 * connects) the element before handing it back, by which point the real default loader has already
 * been called. `document.createElement()` runs the constructor/field initializers (so `loadGroups`
 * starts out as the real loader) without firing `connectedCallback()`, so overriding the field here,
 * between creation and insertion, is what actually lets the fake intercept the initial auto-load.
 * Defaults to a no-op loader (resolves `null`) for tests that supply their own `groups` afterward.
 */
async function connectEmojiPicker(
  loadGroups: () => Promise<EmojiPickerGroup[] | null> = () => Promise.resolve(null),
): Promise<LyraEmojiPicker> {
  const el = document.createElement('lyra-emoji-picker') as LyraEmojiPicker;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = loadGroups;
  created.push(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

it('defaults to value "" (unset, matching FormAssociated\'s native-<input>-like contract) and empty groups', async () => {
  const el = await connectEmojiPicker();
  expect(el.value).to.equal('');
  expect(el.groups).to.deep.equal([]);
});

it('renders one button per emoji, grouped under a heading per group', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(3);
  const headings = [...el.shadowRoot!.querySelectorAll('[part="group-label"]')].map((h) => h.textContent);
  expect(headings).to.deep.equal(['Smileys', 'Animals']);
});

it('is form-associated, participating in an ancestor form.elements', async () => {
  const form = document.createElement('form');
  const el = document.createElement('lyra-emoji-picker') as LyraEmojiPicker;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
  form.append(el);
  created.push(form);
  document.body.append(form);
  await el.updateComplete;
  expect(Array.from(form.elements)).to.include(el);
});

it('sets value and fires lyra-change when an emoji is picked', async () => {
  const el = await connectEmojiPicker();
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
    const el = await connectEmojiPicker();
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
    const el = await connectEmojiPicker();
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
    const el = await connectEmojiPicker();
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

it('auto-loads a default emoji set on connect when groups is left unset', async () => {
  const el = document.createElement('lyra-emoji-picker') as LyraEmojiPicker;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(groups);
  created.push(el);
  document.body.append(el);
  // The fake resolves asynchronously relative to the element's own first render (a real loader
  // would too), so poll for the rendered result rather than trusting a single `updateComplete`
  // right after connect to already include it -- same reasoning as `pdf-viewer.test.ts`'s/
  // `qr-code.test.ts`'s `waitFor()` helpers.
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="emoji"]').length > 0);
  await el.updateComplete;
  expect(el.groups).to.deep.equal(groups);
  expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="emoji"]')!.textContent).to.equal('😀');
});

it('does not let a slow auto-load overwrite an explicitly-set groups value', async () => {
  const el = document.createElement('lyra-emoji-picker') as LyraEmojiPicker;
  // Resolves asynchronously (a real microtask round-trip) rather than synchronously, so the
  // explicit `el.groups = groups` assignment below genuinely races it, matching what a slow real
  // import would do.
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () =>
    Promise.resolve().then(() => groups);
  created.push(el);
  document.body.append(el);
  el.groups = groups; // set immediately, before any real network/import round-trip could resolve
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 50)); // let any stray auto-load attempt settle
  expect(el.groups).to.deep.equal(groups);
});

it('is accessible with groups populated', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
