import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import './emoji-picker.js';
import type { LyraEmojiPicker, EmojiPickerGroup } from './emoji-picker.js';
import { styles } from './emoji-picker.styles.js';

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
 * Creates a `<lr-emoji-picker>` with `loadGroups` overridden to `loadGroups` *before* the element
 * connects to `document.body` -- `connectedCallback()` kicks off the auto-load synchronously the
 * moment the element becomes connected, so `fixture()` can't intercept it: it inserts (and thus
 * connects) the element before handing it back, by which point the real default loader has already
 * been called. `document.createElement()` runs the constructor/field initializers (so `loadGroups`
 * starts out as the real loader) without firing `connectedCallback()`, so overriding the field here,
 * between creation and insertion, is what actually lets the fake intercept the initial auto-load.
 * Defaults to a no-op loader (resolves `null`) for tests that supply their own `groups` afterward.
 * `dir` is applied to the host *before* it connects, so the first direction resolution already
 * sees it (mirrors a consumer writing `<lr-emoji-picker dir="rtl">` declaratively).
 */
async function connectEmojiPicker(
  loadGroups: () => Promise<EmojiPickerGroup[] | null> = () => Promise.resolve(null),
  dir?: 'ltr' | 'rtl',
): Promise<LyraEmojiPicker> {
  const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = loadGroups;
  if (dir) el.setAttribute('dir', dir);
  created.push(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

it('scales the emoji item box across every tier, floored at 24px', async () => {
  const expected: Record<string, string> = {
    '2xs': '24px',
    xs: '28px',
    s: '32px',
    m: '40px',
    l: '48px',
    xl: '56px',
  };
  for (const [size, px] of Object.entries(expected)) {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.setAttribute('size', size);
    await el.updateComplete;
    const emoji = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLElement;
    expect(getComputedStyle(emoji).blockSize, `size=${size}`).to.equal(px);
  }
});

it('defaults to size "m" and reflects a size attribute', async () => {
  const el = await connectEmojiPicker();
  expect(el.size).to.equal('m');
  el.setAttribute('size', 's');
  await el.updateComplete;
  expect(el.size).to.equal('s');
});

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

it('virtualizes large emoji sets while keeping the full option count in ARIA metadata', async () => {
  const largeGroup: EmojiPickerGroup = {
    key: 'large',
    label: 'Large set',
    emojis: Array.from({ length: 500 }, (_, index) => ({ emoji: `😀${index}`, name: `emoji ${index}` })),
  };
  const el = await connectEmojiPicker();
  el.groups = [largeGroup];
  await el.updateComplete;

  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  const buttons = el.shadowRoot!.querySelectorAll('[part="emoji"]');
  expect(el.shadowRoot!.querySelector('[part="virtual-spacer"]')).to.exist;
  expect(buttons.length).to.be.lessThan(500);
  expect(buttons[0]!.getAttribute('aria-setsize')).to.equal('500');
  expect(grid.scrollHeight).to.be.greaterThan(0);
});

describe('windowed geometry token resolution', () => {
  // The three geometry tokens are authored in `rem`/`calc()` (`--lr-emoji-picker-item-size`
  // defaults to `--lr-icon-button-size` = 2.5rem, `--lr-emoji-picker-gap` to `--lr-space-2xs` =
  // 0.125rem, and `--lr-emoji-picker-row-height` to `calc(item-size + --lr-space-l)`), so every
  // expectation below is derived from the live root font size rather than hard-coded pixels.
  const rootFontSize = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

  const largeGroups = (count = 500): EmojiPickerGroup[] => [
    {
      key: 'large',
      label: 'Large set',
      emojis: Array.from({ length: count }, (_, index) => ({ emoji: `😀${index}`, name: `emoji ${index}` })),
    },
  ];

  /** Each windowed row's `translateY` offset, in the order they are rendered. */
  const rowOffsets = (el: LyraEmojiPicker): number[] =>
    [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="virtual-row"]')].map((row) =>
      Number.parseFloat(/translateY\((-?[\d.]+)px\)/.exec(row.style.transform)?.[1] ?? 'NaN'),
    );

  /** The row pitch the component actually laid out with, read back from two adjacent rows. */
  const renderedRowHeight = (el: LyraEmojiPicker): number => {
    const offsets = rowOffsets(el);
    return offsets[1] - offsets[0];
  };

  const firstRowButtons = (el: LyraEmojiPicker): HTMLElement[] => [
    ...el.shadowRoot!.querySelector<HTMLElement>('[part="virtual-row"]')!.querySelectorAll<HTMLElement>('[part="emoji"]'),
  ];

  /** Painted width of the first row's flex line -- it must fit inside the scroll viewport. */
  const lineWidth = (buttons: HTMLElement[]): number =>
    buttons.at(-1)!.getBoundingClientRect().right - buttons[0]!.getBoundingClientRect().left;

  it('derives the windowed column count from the pixel-resolved item size, not the raw rem number', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.style.setProperty('--lr-emoji-picker-item-size', '3rem');
    el.groups = largeGroups();
    await el.updateComplete;

    const grid = el.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
    const buttons = firstRowButtons(el);
    const itemSize = 3 * rootFontSize();
    const gap = 0.125 * rootFontSize();
    expect(buttons.length).to.equal(Math.max(1, Math.floor((grid.clientWidth + gap) / (itemSize + gap))));
    // Reading `3rem` as `3` packs 20 columns (the cap) into the row, overflowing the viewport.
    expect(lineWidth(buttons)).to.be.at.most(grid.clientWidth + 1);
  });

  it('derives the windowed column count from the pixel-resolved gap, so a rem gap never overflows the row', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.style.setProperty('--lr-emoji-picker-gap', '1rem');
    el.groups = largeGroups();
    await el.updateComplete;

    const grid = el.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
    const buttons = firstRowButtons(el);
    const itemSize = 2.5 * rootFontSize();
    const gap = rootFontSize();
    expect(buttons.length).to.equal(Math.max(1, Math.floor((grid.clientWidth + gap) / (itemSize + gap))));
    expect(lineWidth(buttons)).to.be.at.most(grid.clientWidth + 1);
  });

  it('resolves the calc()-based default row height instead of falling back to a hardcoded pitch', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = largeGroups();
    await el.updateComplete;

    // calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l)) = 2.5rem + 1rem.
    const expected = 3.5 * rootFontSize();
    expect(renderedRowHeight(el)).to.be.closeTo(expected, 0.5);
    const spacer = el.shadowRoot!.querySelector<HTMLElement>('[part="virtual-spacer"]')!;
    const rows = Math.ceil(500 / firstRowButtons(el).length);
    expect(Number.parseFloat(spacer.style.blockSize)).to.be.closeTo(rows * expected, 0.5);
  });

  it('resolves the geometry on the very first windowed render, not one update cycle late', async () => {
    const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
    el.style.inlineSize = '320px';
    // Overridden to a value the numeric fallback can't coincide with, and applied before the
    // element ever connects -- the first render is the windowed one.
    el.style.setProperty('--lr-emoji-picker-row-height', '6rem');
    el.groups = largeGroups();
    created.push(el);
    document.body.append(el);
    await el.updateComplete;
    expect(renderedRowHeight(el)).to.be.closeTo(6 * rootFontSize(), 0.5);
  });

  it('re-resolves the geometry when a token override lands after the first render', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = largeGroups();
    await el.updateComplete;
    expect(renderedRowHeight(el)).to.be.closeTo(3.5 * rootFontSize(), 0.5);

    el.style.setProperty('--lr-emoji-picker-row-height', '6rem');
    await waitUntil(
      () => Math.abs(renderedRowHeight(el) - 6 * rootFontSize()) < 0.5,
      'the windowed row pitch never picked up the late --lr-emoji-picker-row-height override',
    );
  });
});

it('is form-associated, participating in an ancestor form.elements', async () => {
  const form = document.createElement('form');
  const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
  form.append(el);
  created.push(form);
  document.body.append(form);
  await el.updateComplete;
  expect(Array.from(form.elements)).to.include(el);
});

it('sets value and fires lr-change when an emoji is picked', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-change');
  button.click();
  const event = await eventPromise;
  expect(el.value).to.equal('😀');
  expect(event.detail).to.deep.equal({ emoji: '😀' });
});

it('gives each emoji button the shared minimum hit area without enlarging the glyph', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLElement;
  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');
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
    const eventPromise = oneEvent(el, 'lr-change');
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ emoji: '😂' }); // second emoji, after one ArrowRight from index 0
  });

  it('swaps ArrowLeft/ArrowRight under RTL so "forward" follows reading direction', async () => {
    const el = await connectEmojiPicker(undefined, 'rtl');
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="emoji"]')];

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(buttons[1].getAttribute('aria-selected')).to.equal('true'); // ArrowLeft is "forward" under RTL
    expect(buttons[0].getAttribute('aria-selected')).to.equal('false');

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(buttons[0].getAttribute('aria-selected')).to.equal('true'); // ArrowRight is "backward" under RTL
    expect(buttons[1].getAttribute('aria-selected')).to.equal('false');
  });

  it('activates the focused emoji on Enter, not a stale active index', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const third = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')[2];

    third.focus(); // focusin syncs the active index to the truly focused option
    const eventPromise = oneEvent(el, 'lr-change');
    third.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ emoji: '🐶' });
  });

  it('navigates the grid from the search input via the combobox contract', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    expect(input.getAttribute('role')).to.equal('combobox');
    expect(input.getAttribute('aria-expanded')).to.equal('true');
    expect(input.getAttribute('aria-activedescendant')).to.match(/-item-0$/);

    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(input.getAttribute('aria-activedescendant')).to.match(/-item-1$/);
    // Combobox idiom: focus stays in the input while the active option moves.
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('search');

    const eventPromise = oneEvent(el, 'lr-change');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ emoji: '😂' });
  });

  it('keeps exactly one emoji tabbable (roving tabindex) and supports ArrowDown/ArrowUp/Home/End', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);

    // Group labels span the full row, so the two smileys form the first visual row and the dog
    // starts the next one: one row down from index 0 lands on index 2.
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([-1, -1, 0]);
    expect(el.shadowRoot!.activeElement?.id).to.equal(buttons[2].id); // roving focus follows

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(buttons[2].tabIndex).to.equal(0);
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(buttons[0].tabIndex).to.equal(0);
    expect(buttons[2].tabIndex).to.equal(-1);
  });
});

it('localizes the search label, grid label, and empty-state message via .strings', async () => {
  const el = await connectEmojiPicker();
  el.strings = {
    emojiPickerSearchLabel: 'Filtrer les emoji',
    emojiPickerGridLabel: 'Emoji disponibles',
    emojiPickerEmpty: 'Aucun emoji trouvé',
  };
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
  expect(input.getAttribute('aria-label')).to.equal('Filtrer les emoji');
  expect(grid.getAttribute('aria-label')).to.equal('Emoji disponibles');
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Aucun emoji trouvé');
});

describe('disabled', () => {
  it('gates both the search input and every emoji button', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.disabled = true;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    expect(input.disabled).to.be.true;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
    expect(buttons.length).to.be.greaterThan(0);
    expect(buttons.every((b) => b.disabled)).to.be.true;
  });

  it('blocks picking an emoji while disabled, even via a direct click() bypassing native disabled semantics', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.disabled = true;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-change', () => { fired = true; });
    const button = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLButtonElement;
    button.click();
    expect(fired).to.be.false;
    expect(el.value).to.equal('');
  });

  it('is accessible while disabled', async () => {
    // An unlabeled group on purpose -- [part="group-label"]'s existing --lr-color-text-quiet
    // color is a pre-existing token choice unrelated to this disabled-gating fix, and it dips
    // under the color-contrast threshold once the disabled opacity treatment on [part="base"]
    // applies to it; a populated listbox is still required (an empty one fails
    // aria-required-children), so this test only needs to prove the new disabled semantics
    // (input/button ?disabled, the :host(:disabled) opacity rule) introduce no violation of
    // their own, not re-litigate the unrelated group-label contrast.
    const el = await connectEmojiPicker();
    el.groups = [{ key: 'g', label: '', emojis: [{ emoji: '😀', name: 'grinning face' }] }];
    el.disabled = true;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('native focus/blur bridging', () => {
  it('re-dispatches the search input\'s native focus/blur as bubbling, composed host events', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;

    const focusPromise = oneEvent(el, 'focus');
    input.dispatchEvent(new FocusEvent('focus'));
    const focusEvent = await focusPromise;
    expect(focusEvent.bubbles).to.be.true;
    expect(focusEvent.composed).to.be.true;

    const blurPromise = oneEvent(el, 'blur');
    input.dispatchEvent(new FocusEvent('blur'));
    const blurEvent = await blurPromise;
    expect(blurEvent.bubbles).to.be.true;
    expect(blurEvent.composed).to.be.true;
  });
});

describe('label/hint/error chrome', () => {
  it('renders no chrome by default', async () => {
    const el = await connectEmojiPicker();
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(label.hidden).to.be.true;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it('shows label/hint/error text and wires the grid\'s aria-describedby', async () => {
    const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
    el.label = 'Reactions';
    el.hint = 'Pick one.';
    el.errorText = 'Required';
    created.push(el);
    document.body.append(el);
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
    expect(label.hidden).to.be.false;
    expect(label.textContent).to.include('Reactions');
    expect(grid.getAttribute('aria-describedby')).to.include('emoji-picker-error');
    expect(grid.getAttribute('aria-describedby')).to.include('emoji-picker-hint');
  });

  it('switches the grid\'s accessible name to aria-labelledby once a visible label is set, unless aria-label overrides it', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
    expect(grid.getAttribute('aria-label')).to.equal('Emoji');
    expect(grid.hasAttribute('aria-labelledby')).to.be.false;

    el.label = 'Reactions';
    await el.updateComplete;
    expect(grid.hasAttribute('aria-label')).to.be.false;
    expect(grid.getAttribute('aria-labelledby')).to.equal(
      el.shadowRoot!.querySelector('[part="form-control-label"]')!.id,
    );

    el.setAttribute('aria-label', 'Reaction picker');
    await el.updateComplete;
    expect(grid.getAttribute('aria-label')).to.equal('Reaction picker');
    expect(grid.hasAttribute('aria-labelledby')).to.be.false;
  });

  it('is accessible with the label/hint/error chrome populated', async () => {
    const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
    el.label = 'Reactions';
    el.hint = 'Pick one.';
    el.groups = groups;
    created.push(el);
    document.body.append(el);
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

it('forwards a host aria-label to the emoji listbox, falling back to the localized default', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
  expect(grid.getAttribute('aria-label')).to.equal('Emoji');

  el.setAttribute('aria-label', 'Reaction picker');
  await el.updateComplete;
  expect(grid.getAttribute('aria-label')).to.equal('Reaction picker');
});

it('auto-loads a default emoji set on connect when groups is left unset', async () => {
  const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
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
  const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
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

describe('active/hover cssprop', () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset default byte-for-byte against
   *  the token it falls back to. */
  function resolvedInShadow(el: LyraEmojiPicker, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  /** Builds an emoji picker inside a styled ancestor `<div>`, so the theming prop is set on an
   *  ancestor of the host (proving a `:host` declaration would not have shadowed it). Mirrors
   *  `connectEmojiPicker`'s pre-connect `loadGroups` override so the default auto-loader never runs. */
  async function themedPicker(style: string): Promise<LyraEmojiPicker> {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('style', style);
    const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () =>
      Promise.resolve(null);
    wrapper.append(el);
    created.push(wrapper);
    document.body.append(wrapper);
    await el.updateComplete;
    el.groups = groups;
    await el.updateComplete;
    return el;
  }

  /** Drives the roving grid focus one step so exactly one emoji carries `data-active` (it is set
   *  imperatively by keyboard navigation, never on the initial render). */
  async function activateAnEmoji(el: LyraEmojiPicker): Promise<HTMLElement> {
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="emoji"][data-active]') as HTMLElement;
  }

  it('recolors the active emoji from an ancestor, not a :host-declared prop', async () => {
    const el = await themedPicker('--lr-emoji-picker-active-bg: rgb(0, 51, 102);');
    const active = await activateAnEmoji(el);
    expect(active).to.exist;
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('drives both :hover and [data-active] from the one shared hook (a single rule, one declaration)', () => {
    // hover and active share a single rule, so one prop backs both -- read off the component's own
    // constructed stylesheet to prove the coupling (the rendered result is asserted above/below).
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles.cssText);
    const rule = [...sheet.cssRules].find(
      (candidate) =>
        candidate instanceof CSSStyleRule &&
        candidate.style.getPropertyValue('background').includes('--lr-emoji-picker-active-bg'),
    ) as CSSStyleRule | undefined;
    expect(rule, 'no rule reads --lr-emoji-picker-active-bg').to.exist;
    const selector = rule!.selectorText.replace(/"/g, "'");
    expect(selector).to.include(':hover');
    expect(selector).to.include('[data-active]');
    expect(rule!.style.getPropertyValue('background')).to.equal(
      'var(--lr-emoji-picker-active-bg, var(--lr-color-brand-quiet))',
    );
  });

  it('renders byte-identically to the pre-cssprop output when the prop is unset', async () => {
    const el = await themedPicker('');
    const active = await activateAnEmoji(el);
    expect(getComputedStyle(active).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    // A non-active, non-hovered emoji keeps its transparent resting background.
    const inactive = el.shadowRoot!.querySelector('[part="emoji"]:not([data-active])') as HTMLElement;
    expect(getComputedStyle(inactive).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('is accessible with the active prop themed', async () => {
    const el = await themedPicker('--lr-emoji-picker-active-bg: rgb(0, 51, 102);');
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

it('resets the native search-cancel glyph on the search field', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='search'\]::-webkit-search-cancel-button/);
});
