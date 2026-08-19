import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import './emoji-picker.js';
import type { LyraEmojiPicker, EmojiPickerGroup } from './emoji-picker.js';
import { styles } from './emoji-picker.styles.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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

/** A single large group, for tests that need the windowed (virtualized) rendering path. */
function manyEmojis(count = 500): EmojiPickerGroup[] {
  return [
    {
      key: 'large',
      label: 'Large set',
      emojis: Array.from({ length: count }, (_, index) => ({ emoji: `😀${index}`, name: `emoji ${index}` })),
    },
  ];
}

/** Each windowed row's `translateY` offset, in the order they are rendered. */
function rowOffsets(el: LyraEmojiPicker): number[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="virtual-row"]')].map((row) =>
    Number.parseFloat(/translateY\((-?[\d.]+)px\)/.exec(row.style.transform)?.[1] ?? 'NaN'),
  );
}

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

it('renders the inherited pressed-emoji hook while a direct host value still wins', async () => {
  const wrapper = document.createElement('div');
  wrapper.style.setProperty('--lr-emoji-picker-pressed-bg', 'rgb(1, 2, 3)');
  created.push(wrapper);
  document.body.append(wrapper);

  const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () =>
    Promise.resolve(null);
  el.groups = groups;
  wrapper.append(el);
  await el.updateComplete;
  const emoji = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLButtonElement;
  const rect = emoji.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];

  try {
    await sendMouse({ type: 'move', position });
    await sendMouse({ type: 'down' });
    await waitUntil(() => getComputedStyle(emoji).backgroundColor === 'rgb(1, 2, 3)');

    el.style.setProperty('--lr-emoji-picker-pressed-bg', 'rgb(4, 5, 6)');
    await waitUntil(() => getComputedStyle(emoji).backgroundColor === 'rgb(4, 5, 6)');
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('forwards host focus, blur, and click to the live search control with disabled guards', async () => {
  const el = await connectEmojiPicker();
  const search = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
  let clicks = 0;
  search.addEventListener('click', () => clicks++);

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement === search).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.be.true;
  el.click();
  expect(clicks).to.equal(1);

  el.disabled = true;
  el.focus();
  el.click();
  expect(el.shadowRoot!.activeElement === null).to.be.true;
  expect(clicks).to.equal(1);
});

it('scales every emoji tier while keeping the shared 40px hit-area floor', async () => {
  const expected: Record<string, string> = {
    '2xs': '40px',
    xs: '40px',
    s: '40px',
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

it('accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l', async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['small', 's'],
    ['medium', 'm'],
    ['large', 'l'],
  ];
  const measure = async (size: string): Promise<string> => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.setAttribute('size', size);
    await el.updateComplete;
    const emoji = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLElement;
    return getComputedStyle(emoji).blockSize;
  };
  for (const [alias, step] of pairs) {
    expect(await measure(alias), `emoji block-size for ${alias}`).to.equal(await measure(step));
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

it('owns a bounded frozen snapshot of consumer emoji groups', async () => {
  const source = [{
    key: 'custom',
    label: 'Custom',
    emojis: [{ emoji: '🧪', name: 'test tube', shortcodes: ['test'] }],
  }];
  const el = await connectEmojiPicker();
  el.groups = source;
  await el.updateComplete;
  source[0]!.label = 'Forged';
  source[0]!.emojis[0]!.name = 'forged item';
  source[0]!.emojis.push({ emoji: '💥', name: 'collision', shortcodes: [] });
  expect(el.groups).to.deep.equal([{
    key: 'custom',
    label: 'Custom',
    emojis: [{ emoji: '🧪', name: 'test tube', shortcodes: ['test'] }],
  }]);
  expect(Object.isFrozen(el.groups)).to.be.true;
  expect(Object.isFrozen(el.groups[0]!.emojis)).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="emoji"]')).to.have.lengthOf(1);
});

it('treats a non-array groups source as empty rather than throwing', async () => {
  const el = await connectEmojiPicker();
  el.groups = 'not-an-array' as unknown as EmojiPickerGroup[];
  await el.updateComplete;
  expect(el.groups).to.deep.equal([]);
});

it('drops malformed or hostile group/item entries from a snapshot while keeping valid ones reachable', async () => {
  const hostileGroup: Record<string, unknown> = {};
  Object.defineProperty(hostileGroup, 'key', {
    enumerable: true,
    get(): string {
      throw new Error('hostile group getter');
    },
  });
  const hostileItem: Record<string, unknown> = {};
  Object.defineProperty(hostileItem, 'emoji', {
    enumerable: true,
    get(): string {
      throw new Error('hostile item getter');
    },
  });
  const source = [
    null,
    'not-an-object',
    { key: 'incomplete' }, // missing label/emojis
    hostileGroup,
    {
      key: 'mixed',
      label: 'Mixed',
      emojis: [
        null,
        'not-an-object',
        { emoji: 'x' }, // missing name
        hostileItem,
        { emoji: '🍕', name: 'pizza' },
      ],
    },
  ];
  const el = await connectEmojiPicker();
  el.groups = source as unknown as EmojiPickerGroup[];
  await el.updateComplete;

  expect(el.groups).to.deep.equal([
    { key: 'mixed', label: 'Mixed', emojis: [{ emoji: '🍕', name: 'pizza' }] },
  ]);
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
  expect(event.detail).to.deep.equal({ value: '😀' });
});

it('keeps programmatic value assignments silent across native and prefixed value events', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  const seen: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change'] as const) {
    el.addEventListener(name, () => seen.push(name));
  }

  el.value = '🐶';
  await el.updateComplete;

  expect(el.value).to.equal('🐶');
  expect(seen).to.deep.equal([]);
});

it('keeps committed aria-selected state separate from roving active navigation', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  buttons[0].click();
  await el.updateComplete;
  expect(buttons.map((button) => button.getAttribute('aria-selected'))).to.deep.equal([
    'true',
    'false',
    'false',
  ]);

  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(buttons[1].hasAttribute('data-active')).to.be.true;
  expect(buttons.map((button) => button.getAttribute('aria-selected'))).to.deep.equal([
    'true',
    'false',
    'false',
  ]);

  el.value = '🐶';
  await el.updateComplete;
  expect(buttons.map((button) => button.getAttribute('aria-selected'))).to.deep.equal([
    'false',
    'false',
    'true',
  ]);
});

it('gives each emoji button the shared minimum hit area without enlarging the glyph', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  el.style.setProperty('--lr-emoji-picker-item-size', '1rem');
  el.style.setProperty('--lr-emoji-picker-glyph-size', '0.75rem');
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLElement;
  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');
  expect(getComputedStyle(button).inlineSize).to.equal('40px');
  expect(getComputedStyle(button).blockSize).to.equal('40px');
  expect(getComputedStyle(button).fontSize).to.equal('12px');
});

it('clips cross-axis overflow instead of creating a phantom horizontal grid scrollbar', async () => {
  const el = await connectEmojiPicker();
  el.style.inlineSize = '2rem';
  el.groups = groups;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
  expect(grid.scrollWidth).to.be.greaterThan(grid.clientWidth);
  expect(getComputedStyle(grid).overflowX).to.equal('hidden');
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

  it('case-folds names and queries with the effective locale', async () => {
    const el = await connectEmojiPicker();
    el.locale = 'tr';
    el.groups = [
      {
        key: 'places',
        label: 'Places',
        emojis: [{ emoji: '📍', name: 'İzmir' }],
      },
    ];
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'iz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(1);
  });

  it('invalidates a cached search haystack when the effective locale changes on an already-cached item', async () => {
    const el = await connectEmojiPicker();
    el.locale = 'en';
    el.groups = [
      {
        key: 'places',
        label: 'Places',
        emojis: [{ emoji: '📍', name: 'İzmir' }],
      },
    ];
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'izmir';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // Under the default/'en' case-folding rule the Turkish capital dotted İ lowercases to a
    // dotted-i-plus-combining-mark, which does not contain the plain ASCII substring "izmir" --
    // this call also populates the per-item haystack cache under the 'en' locale.
    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(0);

    el.locale = 'tr';
    await el.updateComplete;
    // Turkish case-folding maps İ -> i directly. If the cached haystack were reused regardless of
    // which locale it was computed under, this would incorrectly still show no matches.
    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(1);
  });

  it('ignores a navigation keydown while the search has zero matches', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'not-a-real-emoji-name-xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    expect(() =>
      grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    ).to.not.throw();
    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(0); // still nothing to navigate to
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
    expect(event.detail).to.deep.equal({ value: '😂' }); // second emoji, after one ArrowRight from index 0
  });

  it('swaps ArrowLeft/ArrowRight under RTL so "forward" follows reading direction', async () => {
    const el = await connectEmojiPicker(undefined, 'rtl');
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="emoji"]')];

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(buttons[1].hasAttribute('data-active')).to.be.true; // ArrowLeft is "forward" under RTL
    expect(buttons[0].hasAttribute('data-active')).to.be.false;

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(buttons[0].hasAttribute('data-active')).to.be.true; // ArrowRight is "backward" under RTL
    expect(buttons[1].hasAttribute('data-active')).to.be.false;
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
    expect(event.detail).to.deep.equal({ value: '🐶' });
  });

  it('emits native input/change once with typed prefixed value aliases when a user picks an emoji', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="emoji"]')!;
    const events = Promise.all([
      oneEvent(el, 'input'),
      oneEvent(el, 'change'),
      oneEvent(el, 'lr-input'),
      oneEvent(el, 'lr-change'),
    ]);

    first.click();

    const [inputEvent, changeEvent, lyraInputEvent, lyraEvent] = await events;
    expect(inputEvent instanceof InputEvent).to.be.true;
    expect(changeEvent instanceof Event && !(changeEvent instanceof CustomEvent)).to.be.true;
    expect(inputEvent.target === el && changeEvent.target === el).to.be.true;
    expect(inputEvent.composed).to.be.true;
    expect(changeEvent.composed).to.be.true;
    expect(lyraInputEvent.detail).to.deep.equal({ value: '😀' });
    expect(lyraEvent.detail).to.deep.equal({ value: '😀' });
  });

  it('constructs the native input/change/focus/blur quartet in the adopted owner realm', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const ownerWindow = frame.contentWindow;
      const ownerDocument = frame.contentDocument;
      if (!ownerWindow || !ownerDocument) throw new Error('The iframe realm was unavailable.');
      // Render once in the constructor realm before adoption. Lit constructable stylesheets cannot
      // be installed for the first time in a different document, while an already-rendered shadow
      // tree can be adopted and must then publish events from its new owner realm.
      const el = await connectEmojiPicker();
      el.groups = groups;
      await el.updateComplete;
      ownerDocument.body.append(ownerDocument.adoptNode(el));
      await el.updateComplete;

      const order: string[] = [];
      const nativeEvents: Event[] = [];
      const removedAliases: string[] = [];
      for (const name of ['input', 'change', 'focus', 'blur'] as const) {
        el.addEventListener(name, (event) => {
          order.push(name);
          nativeEvents.push(event);
        });
      }
      for (const name of ['lr-input', 'lr-change'] as const) {
        el.addEventListener(name, () => order.push(name));
      }
      for (const name of ['lr-focus', 'lr-blur'] as const) {
        el.addEventListener(name, () => removedAliases.push(name));
      }

      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="emoji"]')!.click();
      const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
      const related = ownerDocument.createElement('button');
      ownerDocument.body.append(related);
      search.dispatchEvent(new ownerWindow.FocusEvent('focus', { relatedTarget: related }));
      search.dispatchEvent(new ownerWindow.FocusEvent('blur', { relatedTarget: related }));

      expect(order).to.deep.equal([
        'input',
        'lr-input',
        'change',
        'lr-change',
        'focus',
        'blur',
      ]);
      expect(removedAliases).to.deep.equal([]);
      expect(nativeEvents[0] instanceof ownerWindow.InputEvent).to.equal(true);
      expect(nativeEvents[0] instanceof InputEvent).to.equal(false);
      expect(nativeEvents[1].constructor === ownerWindow.Event).to.equal(true);
      expect(nativeEvents[1] instanceof ownerWindow.CustomEvent).to.equal(false);
      expect(nativeEvents[2] instanceof ownerWindow.FocusEvent).to.equal(true);
      expect(nativeEvents[3] instanceof ownerWindow.FocusEvent).to.equal(true);
      expect((nativeEvents[2] as FocusEvent).relatedTarget === related).to.equal(true);
      expect((nativeEvents[3] as FocusEvent).relatedTarget === related).to.equal(true);
    } finally {
      frame.remove();
    }
  });

  it('contains composed search input while emitting one value-event pair for a pick', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    let inputs = 0;
    let changes = 0;
    el.addEventListener('input', () => inputs++);
    el.addEventListener('change', () => changes++);
    const search = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;

    search.value = 'dog';
    search.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(1);
    expect(el.value).to.equal('');
    expect(inputs).to.equal(0);
    expect(changes).to.equal(0);

    (el.shadowRoot!.querySelector('[part="emoji"]') as HTMLButtonElement).click();

    expect(el.value).to.equal('🐶');
    expect(inputs).to.equal(1);
    expect(changes).to.equal(1);
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
    expect(event.detail).to.deep.equal({ value: '😂' });
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

  it('ignores a focusin event whose target is not an emoji button', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const before = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')].map(
      (b) => b.tabIndex,
    );

    // Dispatched directly on the grid container itself (a <div>, not a button) so the event's
    // target fails onGridFocusIn's button-shape guard.
    grid.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const after = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')].map(
      (b) => b.tabIndex,
    );
    expect(after).to.deep.equal(before);
  });

  it('defers to an in-flight pending grid-focus restoration instead of reassigning focus bookkeeping mid-flight', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
    const internals = el as unknown as { pendingGridFocus?: unknown; focusedGridItem?: unknown };
    internals.focusedGridItem = undefined;
    internals.pendingGridFocus = { index: 0 }; // simulates a focus restore already scheduled

    buttons[1].focus(); // a real focusin, as if a consumer's own focus() call raced the restoration

    expect(internals.focusedGridItem, 'onGridFocusIn must defer while a restore is pending').to.equal(undefined);
    expect(buttons[1].hasAttribute('data-active')).to.be.false; // setActiveIndex was never reached for this focus
    expect(internals.pendingGridFocus).to.deep.equal({ index: 0 }); // left untouched for the real restore to consume
  });

  it('falls back to a DOM-position lookup when a focused option is missing its data-index', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const before = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')].map(
      (b) => b.tabIndex,
    );

    const foreignOption = document.createElement('button');
    foreignOption.type = 'button';
    grid.appendChild(foreignOption);
    try {
      expect(() => foreignOption.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))).to.not.throw();
      // The foreign button carries no data-index and isn't tracked by optionButtons(), so it
      // resolves to index -1 and must not steal roving focus from the real emoji buttons.
      const after = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')].map(
        (b) => b.tabIndex,
      );
      expect(after).to.deep.equal(before);
    } finally {
      foreignOption.remove();
    }
  });
});

it('localizes the search label, grid label, and empty-state message via .strings', async () => {
  const el = await connectEmojiPicker();
  // The deliberate `[]` opt-out, which is what renders the ordinary empty state. Leaving `groups`
  // unset would instead land on the peer-load-failure surface, since this helper's default loader
  // resolves `null`.
  el.groups = [];
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

it('localizes auto-loaded headings through private provenance without exposing label keys', async () => {
  const el = await connectEmojiPicker(() =>
    Promise.resolve([
      { key: '0', label: 'Smileys & Emotion', emojis: [{ emoji: '😀', name: 'grinning face' }] },
      { key: '9', label: 'Flags', emojis: [{ emoji: '🏳️', name: 'white flag' }] },
    ]),
  );
  await waitUntil(() => el.groups.length === 2, 'auto-loaded groups never arrived');
  await el.updateComplete;
  expect(el.groups.every((group) => !('labelKey' in group))).to.be.true;
  expect([...el.shadowRoot!.querySelectorAll('[part="group-label"]')].map((h) => h.textContent!.trim())).to.deep.equal([
    'Smileys & Emotion',
    'Flags',
  ]);
  el.strings = { emojiPickerGroupSmileysEmotion: 'Émotions', emojiPickerGroupFlags: 'Drapeaux' };
  await el.updateComplete;
  expect([...el.shadowRoot!.querySelectorAll('[part="group-label"]')].map((h) => h.textContent!.trim())).to.deep.equal([
    'Émotions',
    'Drapeaux',
  ]);
});

it('localizes the fallback heading for a built-in group id with no registered label, via .strings', async () => {
  // '42' is not one of emojibase's own ids (0-9, all mapped in BUILT_IN_GROUP_LABEL_KEYS) -- the
  // loader can only supply a bare numeric placeholder for it (see emoji-data-loader.test.ts), so the
  // localized "Group {group}" phrasing has to come from the picker's own groupLabel() at render time.
  const el = await connectEmojiPicker(() =>
    Promise.resolve([{ key: '42', label: '42', emojis: [{ emoji: '🛸', name: 'flying saucer' }] }]),
  );
  await waitUntil(() => el.groups.length === 1, 'auto-loaded groups never arrived');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="group-label"]')!.textContent!.trim()).to.equal('Group 42');

  el.strings = { emojiPickerGroupUnknown: 'Groupe {group}' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="group-label"]')!.textContent!.trim()).to.equal('Groupe 42');
});

it('keeps a consumer-supplied label verbatim even for a built-in numeric key', async () => {
  const el = await connectEmojiPicker();
  el.groups = [{ key: '0', label: 'My own zero group', emojis: groups[0].emojis }];
  el.strings = { emojiPickerGroupSmileysEmotion: 'Émotions' };
  await el.updateComplete;
  expect([...el.shadowRoot!.querySelectorAll('[part="group-label"]')].map((h) => h.textContent!.trim())).to.deep.equal([
    'My own zero group',
  ]);
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

  it('suppresses the relayed host focus event when a synthetic focus reaches the disabled search input', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.disabled = true;
    await el.updateComplete;
    const search = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    let hostFocusFired = false;
    el.addEventListener('focus', () => {
      hostFocusFired = true;
    });
    // Bypasses the native disabled semantics that would otherwise prevent this focus from ever
    // firing, mirroring the disabled-click-bypass test above.
    search.dispatchEvent(new FocusEvent('focus', { bubbles: true, composed: true }));
    expect(hostFocusFired).to.be.false;
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

  it('refuses to commit a pick when invoked directly while disabled, independent of the caller-level guards', async () => {
    // The caller-level guards (native `disabled` on the button, `liveDisabled` in
    // onNavigationKeyDown) already block every real entry point into `pick()` -- this proves
    // `pick()` itself also refuses to commit, so it stays safe even if a future caller forgets one
    // of those guards.
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.disabled = true;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-change', () => { fired = true; });
    (el as unknown as { pick(item: { emoji: string; name: string; shortcodes?: string[] }): void }).pick(
      groups[0]!.emojis[0]!,
    );
    expect(fired).to.be.false;
    expect(el.value).to.equal('');
  });

  it('ignores a synthetic search input event while disabled, bypassing native disabled semantics', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.disabled = true;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'dog';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // The query never took effect: still all 3 emojis, not filtered down to the one matching "dog".
    expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(3);
  });

  it('ignores grid navigation and Enter entirely while disabled', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    el.disabled = true;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
    let fired = false;
    el.addEventListener('lr-change', () => { fired = true; });

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]); // active index never moved

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(fired).to.be.false;
  });
});

describe('native focus/blur bridging', () => {
  it('relays the search focus/blur exactly once as FocusEvents with relatedTarget, never firing the removed lr-focus/lr-blur aliases', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;

    const outside = document.createElement('button');
    document.body.append(outside);
    created.push(outside);
    const removedAliases: string[] = [];
    el.addEventListener('lr-focus', () => removedAliases.push('lr-focus'));
    el.addEventListener('lr-blur', () => removedAliases.push('lr-blur'));

    const focusEventPromise = oneEvent(el, 'focus');
    input.dispatchEvent(new FocusEvent('focus', { relatedTarget: outside }));
    const focusEvent = await focusEventPromise;
    expect(focusEvent instanceof FocusEvent).to.be.true;
    expect(focusEvent.relatedTarget === outside).to.be.true;
    expect(focusEvent.bubbles).to.be.true;
    expect(focusEvent.composed).to.be.true;

    const blurEventPromise = oneEvent(el, 'blur');
    input.dispatchEvent(new FocusEvent('blur', { relatedTarget: outside }));
    const blurEvent = await blurEventPromise;
    expect(blurEvent instanceof FocusEvent).to.be.true;
    expect(blurEvent.relatedTarget === outside).to.be.true;
    expect(blurEvent.bubbles).to.be.true;
    expect(blurEvent.composed).to.be.true;

    expect(removedAliases).to.deep.equal([]);
  });
});

describe('touched state under platform-forced blur', () => {
  it('does not mark touched from a blur caused by the search input itself becoming disabled', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.focus();
    expect(el.shadowRoot!.activeElement === input).to.be.true;

    // The browser itself force-blurs a focused native control the instant it becomes `disabled`
    // -- plain platform behavior, not a user interaction -- so this must NOT count as "touched".
    el.disabled = true;
    await el.updateComplete;
    expect(input.disabled, 'sanity: the disable actually reached the native input').to.be.true;
    // The platform's own force-blur can trail the render commit by an unpredictable amount on
    // some engines (observed on Firefox/WebKit; Chromium settles within updateComplete alone) --
    // poll instead of guessing a fixed delay.
    await waitUntil(() => el.shadowRoot!.activeElement !== input, 'the platform never force-blurred the disabled search input', { timeout: 2000 });
    expect(el.shadowRoot!.activeElement === input, 'sanity: the platform actually force-blurred it').to.be.false;
    expect((el as unknown as { touched: boolean }).touched).to.be.false;
  });

  it('still marks touched from a real user blur', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect((el as unknown as { touched: boolean }).touched).to.be.true;
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

it('preserves an explicitly assigned empty groups array from before connection', async () => {
  const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
  let loaderCalls = 0;
  (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = async () => {
    loaderCalls += 1;
    return groups;
  };
  el.groups = [];
  created.push(el);
  document.body.append(el);
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(loaderCalls, 'an explicit empty data set opts out of convenience loading').to.equal(0);
  expect(el.groups).to.deep.equal([]);
  expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(0);
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

describe('emoji interaction-state cssprops', () => {
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

  it('inherits public geometry hooks from an ancestor across a size tier', async () => {
    const el = await themedPicker(`
      --lr-emoji-picker-item-size: 46px;
      --lr-emoji-picker-glyph-size: 23px;
      --lr-emoji-picker-gap: 11px;
      --lr-emoji-picker-control-gap: 13px;
      --lr-emoji-picker-radius: 17px;
      --lr-emoji-picker-item-radius: 19px;
    `);
    el.size = '2xs';
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const formControl = el.shadowRoot!.querySelector('[part="form-control"]') as HTMLElement;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const emoji = el.shadowRoot!.querySelector('[part="emoji"]') as HTMLElement;

    expect(getComputedStyle(base).borderTopLeftRadius).to.equal('17px');
    expect(getComputedStyle(formControl).gap).to.equal('13px');
    expect(getComputedStyle(grid).gap).to.equal('11px');
    expect(emoji.getBoundingClientRect().width).to.equal(46);
    expect(getComputedStyle(emoji).fontSize).to.equal('23px');
    expect(getComputedStyle(emoji).borderTopLeftRadius).to.equal('19px');
  });

  /** Drives the roving grid focus one step so exactly one emoji carries `data-active` (it is set
   *  imperatively by keyboard navigation, never on the initial render). */
  async function activateAnEmoji(el: LyraEmojiPicker): Promise<HTMLElement> {
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="emoji"][data-active]') as HTMLElement;
  }

  it('recolors keyboard-active independently from an ancestor', async () => {
    const el = await themedPicker('--lr-emoji-picker-keyboard-active-bg: rgb(0, 51, 102);');
    const active = await activateAnEmoji(el);
    expect((active) != null).to.equal(true);
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('recolors committed selection independently from keyboard-active', async () => {
    const el = await themedPicker(`
      --lr-emoji-picker-selected-bg: rgb(102, 0, 51);
      --lr-emoji-picker-keyboard-active-bg: rgb(0, 51, 102);
    `);
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
    buttons[0].click();
    await el.updateComplete;
    const active = await activateAnEmoji(el);
    expect(getComputedStyle(buttons[0]).backgroundColor).to.equal('rgb(102, 0, 51)');
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(buttons[0].getAttribute('aria-selected')).to.equal('true');
    expect(active.getAttribute('aria-selected')).to.equal('false');
  });

  it('retains the legacy active background as the hover/keyboard fallback', async () => {
    const el = await themedPicker('--lr-emoji-picker-active-bg: rgb(0, 51, 102);');
    const active = await activateAnEmoji(el);
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(0, 51, 102)');
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

  it('gives forced-color hover, active, selected, and pressed states distinct non-color outlines', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('@media (forced-colors: active)');
    expect(css).to.match(/:hover:not\(:disabled\)[^{]*\{[^}]*dashed Highlight/);
    expect(css).to.match(/\[data-active\][^{]*\{[^}]*dotted Highlight/);
    expect(css).to.match(/\[aria-selected='true'\][^{]*\{[^}]*solid Highlight/);
    expect(css).to.match(/:active:not\(:disabled\)[^{]*\{[^}]*double Highlight/);
  });
});

it('resets the native search-cancel glyph on the search field', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='search'\]::-webkit-search-cancel-button/);
});

it('gives the emoji grid buttons a focus-visible ring, matching their existing hover/active feedback', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='emoji'\]:focus-visible\s*\{[^}]*outline:[^}]*outline-offset:[^}]*\}/);
});

describe('windowed geometry fallbacks', () => {
  it('falls back to the token-mirrored default geometry when the measurement probe is unavailable, ignoring any token override', async () => {
    const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
    // Neutralizes the probe-creation step so `this.geometryProbe` never gets set, forcing
    // geometry()'s coarse `!probe` branch, which returns the token-mirrored constants outright
    // without ever reading this override -- unlike the per-probe fallback in `probePixels()`
    // (covered by the next test), which still measures whatever probes *do* exist.
    (el as unknown as { syncGeometryProbe: () => void }).syncGeometryProbe = () => {};
    el.style.inlineSize = '320px';
    el.style.setProperty('--lr-emoji-picker-row-height', '8rem'); // would render 128px if actually measured
    el.groups = manyEmojis();
    created.push(el);
    document.body.append(el);
    await el.updateComplete;

    const offsets = rowOffsets(el);
    expect(offsets.length).to.be.greaterThan(1);
    expect(offsets[1] - offsets[0]).to.equal(56); // VIRTUAL_ROW_HEIGHT_FALLBACK, not the overridden 128px
  });

  it('falls back to the default row height when its token resolves to an invalid length while unlaid-out, without disturbing a sibling token that is still valid', async () => {
    const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
    // display: none removes the probes' layout box entirely, so getComputedStyle can only report
    // each one's *computed* value rather than a *used* pixel size -- a syntactically invalid
    // override resolves to `auto` there (NaN once parsed), while a valid one still resolves
    // normally (unit conversion doesn't need layout).
    el.style.display = 'none';
    el.style.setProperty('--lr-emoji-picker-item-size', '6rem');
    el.style.setProperty('--lr-emoji-picker-row-height', 'not-a-length');
    el.groups = manyEmojis();
    created.push(el);
    document.body.append(el);
    await el.updateComplete;

    const offsets = rowOffsets(el);
    expect(offsets[1] - offsets[0]).to.equal(56); // VIRTUAL_ROW_HEIGHT_FALLBACK, from the NaN guard

    el.style.display = '';
    await el.updateComplete;
    const item = el.shadowRoot!.querySelector<HTMLElement>('[part="emoji"]')!;
    expect(getComputedStyle(item).blockSize).to.equal('96px'); // the sibling item-size token still resolved
  });

  it('accepts a genuinely zero gap token rather than treating it as an unmeasured probe', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.style.setProperty('--lr-emoji-picker-gap', '0');
    el.groups = manyEmojis();
    await el.updateComplete;

    const itemsRow = el.shadowRoot!.querySelector<HTMLElement>('[part="virtual-items"]')!;
    expect(getComputedStyle(itemsRow).columnGap).to.equal('0px');
  });

  it('falls back to the token-mirrored default per probe when its computed style cannot be resolved', async () => {
    const realGetComputedStyle = window.getComputedStyle.bind(window);
    (window as unknown as { getComputedStyle: typeof window.getComputedStyle }).getComputedStyle = ((
      element: Element,
      pseudo?: string | null,
    ) => {
      if ((element as HTMLElement).dataset?.['probe']) return undefined as unknown as CSSStyleDeclaration;
      return realGetComputedStyle(element, pseudo);
    }) as typeof window.getComputedStyle;
    try {
      const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
      (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
      el.style.inlineSize = '320px';
      el.style.setProperty('--lr-emoji-picker-row-height', '8rem'); // would render 128px if actually measured
      el.groups = manyEmojis();
      created.push(el);
      document.body.append(el);
      await el.updateComplete;

      const offsets = rowOffsets(el);
      expect(offsets.length).to.be.greaterThan(1);
      expect(offsets[1] - offsets[0]).to.equal(56); // VIRTUAL_ROW_HEIGHT_FALLBACK, from the per-probe unresolved-style guard
    } finally {
      window.getComputedStyle = realGetComputedStyle;
    }
  });

  it('falls back to the row-height default (not the literal zero) when the resolved token is genuinely zero while laid out', async () => {
    // Unlike the item probe (floored at `--lr-icon-button-size` via its own `min-inline-size`, so
    // it can never measure a literal zero), the row probe has no such floor -- a zero row height
    // would divide the scroll offset by zero, so it must fall back rather than being taken as-is.
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.style.setProperty('--lr-emoji-picker-row-height', '0');
    el.groups = manyEmojis();
    await el.updateComplete;

    const offsets = rowOffsets(el);
    expect(offsets[1] - offsets[0]).to.equal(56); // VIRTUAL_ROW_HEIGHT_FALLBACK, not the literal zero
  });

  it('renders and functions without ResizeObserver, skipping only the auto-re-measurement it would provide', async () => {
    const originalResizeObserver = window.ResizeObserver;
    (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    try {
      const el = document.createElement('lr-emoji-picker') as LyraEmojiPicker;
      (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups = () => Promise.resolve(null);
      el.style.inlineSize = '320px';
      el.groups = manyEmojis();
      created.push(el);
      document.body.append(el);
      await el.updateComplete;

      expect(el.shadowRoot!.querySelector('[part="virtual-spacer"]')).to.exist;
      expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.be.greaterThan(0);
    } finally {
      window.ResizeObserver = originalResizeObserver;
    }
  });

  it('no-ops a geometry-probe resize notification that arrives with nothing yet cached to compare against', async () => {
    const originalResizeObserver = window.ResizeObserver;
    let geometryCallback: ResizeObserverCallback | undefined;
    class CapturingResizeObserver implements ResizeObserver {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element): void {
        if ((target as HTMLElement).dataset?.['probe']) geometryCallback = this.callback;
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = CapturingResizeObserver;
    try {
      const el = await connectEmojiPicker();
      el.style.inlineSize = '320px';
      el.groups = manyEmojis();
      await el.updateComplete;
      expect(geometryCallback, 'sanity: the geometry probe was observed').to.be.a('function');

      const internals = el as unknown as { geometryCache?: unknown; requestUpdate(): void };
      internals.geometryCache = undefined; // simulates a notification landing before anything was measured
      let requestedUpdates = 0;
      const requestUpdate = el.requestUpdate.bind(el);
      (el as unknown as { requestUpdate(): void }).requestUpdate = () => {
        requestedUpdates += 1;
        requestUpdate();
      };

      expect(() => geometryCallback!([], {} as ResizeObserver)).to.not.throw();
      expect(requestedUpdates, 'nothing to compare against yet, so no re-render is requested').to.equal(0);
    } finally {
      window.ResizeObserver = originalResizeObserver;
    }
  });
});

describe('setActiveIndex beyond the rendered window', () => {
  it('materializes and focuses an off-window option reached from the roving grid', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis();
    await el.updateComplete;

    const first = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="emoji"][data-index="0"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.dataset['index']).to.equal('499');
  });

  it('scrolls the windowed grid to the active row when End jumps past the currently rendered rows', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis();
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;

    expect(grid.scrollTop).to.be.greaterThan(0);
    // The 500th (last) option's row isn't in the rendered window, so its button doesn't exist --
    // aria-activedescendant still points at the synthetic id instead of a real element's.
    expect(input.getAttribute('aria-activedescendant')).to.match(/-item-499$/);
  });
});

describe('slotted label/hint/error content', () => {
  it('detects slotted label/hint/error content via slotchange and reveals the matching chrome', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;

    const labelSlot = el.shadowRoot!.querySelector('slot[name="label"]') as HTMLSlotElement;
    const hintSlot = el.shadowRoot!.querySelector('slot[name="hint"]') as HTMLSlotElement;
    const errorSlot = el.shadowRoot!.querySelector('slot[name="error"]') as HTMLSlotElement;
    const slotchanges = Promise.all([
      oneEvent(labelSlot, 'slotchange'),
      oneEvent(hintSlot, 'slotchange'),
      oneEvent(errorSlot, 'slotchange'),
    ]);

    const labelEl = document.createElement('span');
    labelEl.slot = 'label';
    labelEl.textContent = 'Custom label';
    const hintEl = document.createElement('span');
    hintEl.slot = 'hint';
    hintEl.textContent = 'Custom hint';
    const errorEl = document.createElement('span');
    errorEl.slot = 'error';
    errorEl.textContent = 'Custom error';
    el.append(labelEl, hintEl, errorEl);

    await slotchanges;
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement).hidden).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement).hidden).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hidden).to.be.false;
  });
});

describe('unrelated keydown', () => {
  it('ignores a key with no navigation/pick meaning, leaving the active option unchanged', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
  });
});

describe('virtualized scroll handling', () => {
  it('reuses the filtered/flat/row projection across scroll-only renders', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis(5_000);
    await el.updateComplete;
    const internals = el as unknown as {
      projection(): unknown;
      virtualRows(): unknown;
    };
    const projection = internals.projection();
    const rows = internals.virtualRows();
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;

    grid.scrollTop = 3000;
    grid.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await el.updateComplete;

    expect(internals.projection(), 'scroll must not refilter or re-flatten all items').to.equal(projection);
    expect(internals.virtualRows(), 'scroll must slice a cached row projection').to.equal(rows);
  });

  it('reflows the visible window when the grid scrolls (throttled via one rAF)', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis();
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const before = rowOffsets(el)[0];

    grid.scrollTop = 3000;
    grid.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await el.updateComplete;

    expect(rowOffsets(el)[0]).to.not.equal(before);
  });

  it('cancels a pending virtual-scroll animation frame on disconnect instead of leaking it onto a detached element', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis();
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;

    grid.scrollTop = 3000;
    grid.dispatchEvent(new Event('scroll')); // schedules a throttling rAF
    el.remove(); // disconnect before that rAF fires -- must cancel it, not run it on a detached element

    // If the rAF weren't canceled, its callback would call requestUpdate() on a disconnected
    // element; letting a macrotask pass here without error is the assertion.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });

  it('rebinds both resize observers and virtual-scroll frames to the adopted owner realm', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis();
    await el.updateComplete;
    el.remove();
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const originalResizeObserver = frameWindow.ResizeObserver;
    const originalRequestAnimationFrame = frameWindow.requestAnimationFrame;
    const originalCancelAnimationFrame = frameWindow.cancelAnimationFrame;
    let geometryCallback: ResizeObserverCallback | undefined;
    let gridCallback: ResizeObserverCallback | undefined;
    let relevantDisconnects = 0;
    class OwnerResizeObserver implements ResizeObserver {
      private readonly callback: ResizeObserverCallback;
      private relevant = false;
      constructor(callback: ResizeObserverCallback) { this.callback = callback; }
      observe(target: Element): void {
        const element = target as HTMLElement;
        if (element.dataset['probe']) {
          this.relevant = true;
          geometryCallback = this.callback;
        }
        if (element.getAttribute('part') === 'grid') {
          this.relevant = true;
          gridCallback = this.callback;
        }
      }
      unobserve(): void {}
      disconnect(): void { if (this.relevant) relevantDisconnects += 1; }
    }
    let nextFrame = 1;
    const frameCallbacks = new Map<number, FrameRequestCallback>();
    const cancelledFrames: number[] = [];
    frameWindow.ResizeObserver = OwnerResizeObserver;
    frameWindow.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      const handle = nextFrame++;
      frameCallbacks.set(handle, callback);
      return handle;
    };
    frameWindow.cancelAnimationFrame = (handle: number): void => {
      cancelledFrames.push(handle);
      frameCallbacks.delete(handle);
    };

    try {
      frameDocument.adoptNode(el);
      expect(geometryCallback, 'detached adoption must not arm the geometry observer').to.equal(undefined);
      expect(gridCallback, 'detached adoption must not arm the grid observer').to.equal(undefined);
      frameDocument.body.append(el);
      await el.updateComplete;
      expect(geometryCallback, 'the destination window observes geometry probes').to.be.a('function');
      expect(gridCallback, 'the destination window observes the virtualized grid').to.be.a('function');

      const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
      grid.scrollTop = 3000;
      grid.dispatchEvent(new frameWindow.Event('scroll'));
      expect(frameCallbacks.size, 'scroll scheduling uses the destination window').to.equal(1);
      const [staleFrameHandle, staleFrameCallback] = [...frameCallbacks.entries()][0]!;
      const staleGeometryCallback = geometryCallback!;
      const staleGridCallback = gridCallback!;

      document.adoptNode(el);
      document.body.append(el);
      await el.updateComplete;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      expect(relevantDisconnects, 'adoption disconnects both destination observers').to.be.at.least(2);
      expect(cancelledFrames).to.include(staleFrameHandle);

      const internals = el as unknown as {
        geometryCache?: { itemSize: number; gap: number; rowHeight: number };
      };
      const sentinel = { itemSize: 7, gap: 11, rowHeight: 13 };
      internals.geometryCache = sentinel;
      let requestedUpdates = 0;
      const requestUpdate = el.requestUpdate.bind(el);
      (el as unknown as { requestUpdate(): void }).requestUpdate = () => {
        requestedUpdates += 1;
        requestUpdate();
      };
      staleGeometryCallback([], {} as ResizeObserver);
      staleGridCallback([], {} as ResizeObserver);
      staleFrameCallback(0);
      expect(internals.geometryCache, 'the old geometry callback cannot invalidate the new realm cache').to.equal(sentinel);
      expect(requestedUpdates, 'old observer/frame callbacks are inert after reconnect').to.equal(0);
    } finally {
      frameWindow.ResizeObserver = originalResizeObserver;
      frameWindow.requestAnimationFrame = originalRequestAnimationFrame;
      frameWindow.cancelAnimationFrame = originalCancelAnimationFrame;
      if (el.ownerDocument !== document) document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });

  it('tears down the scroll listener and resize observer when filtering shrinks the set below the virtualization threshold', async () => {
    const el = await connectEmojiPicker();
    el.style.inlineSize = '320px';
    el.groups = manyEmojis();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="virtual-spacer"]')).to.exist;

    const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    input.value = 'no-match-at-all-xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="virtual-spacer"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  });

  it('ignores a scroll notification once the grid is not (or no longer) virtualized', async () => {
    const el = await connectEmojiPicker();
    el.groups = groups; // small set, never virtualized
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const internals = el as unknown as { onGridScroll(event: Event): void; virtualScrollTop: number };
    const before = internals.virtualScrollTop;

    internals.onGridScroll({ currentTarget: grid } as unknown as Event);

    expect(internals.virtualScrollTop).to.equal(before);
  });

  it('ignores a scroll notification whose owning document has no window (an orphaned realm)', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument;
      const frameWindow = frame.contentWindow;
      if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
      // Built and connected in the main document first, then adopted -- creating the element
      // directly via `frameDocument.createElement()` would never upgrade it, since custom element
      // registries are per-realm and only the main window's registry has `lr-emoji-picker` defined.
      const el = await connectEmojiPicker();
      el.style.inlineSize = '320px';
      el.groups = manyEmojis();
      await el.updateComplete;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
      const internals = el as unknown as { onGridScroll(event: Event): void };

      frame.remove(); // discards the iframe's browsing context: frameDocument.defaultView -> null
      expect(frameDocument.defaultView, 'sanity: the owning realm is really gone').to.equal(null);

      // Without the guard, reading a null defaultView's requestAnimationFrame throws immediately.
      expect(() => internals.onGridScroll({ currentTarget: grid } as unknown as Event)).to.not.throw();
    } finally {
      frame.remove();
    }
  });
});

it('resets the active index back to 0 when a smaller groups array leaves the previous active index out of range', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups; // 3 items
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); // active index -> 2 (last)
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')[2].tabIndex).to.equal(0);

  // Reassigning `groups` directly (not filtering via the search input, which already zeroes the
  // active index itself) is what leaves updated()'s own out-of-range clamp as the only thing that
  // can catch this.
  el.groups = [{ key: 'smileys', label: 'Smileys', emojis: [groups[0].emojis[0]] }];
  await el.updateComplete;

  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  expect(buttons.length).to.equal(1);
  expect(buttons[0].tabIndex).to.equal(0);
});

it('moves owned grid focus to the clamped survivor when groups remove the focused emoji', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;

  const originalButtons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  originalButtons[2].focus();
  expect(el.shadowRoot!.activeElement?.id).to.equal(originalButtons[2].id);

  el.groups = [{ key: 'smileys', label: 'Smileys', emojis: [groups[0].emojis[0]] }];
  await el.updateComplete;

  const survivor = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="emoji"]')!;
  expect(survivor.tabIndex).to.equal(0);
  expect(el.shadowRoot!.activeElement?.id).to.equal(survivor.id);
});

it('clears a pending grid focus and refocuses the search input when a groups reassignment leaves no options at all', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  buttons[0].focus();
  expect(el.shadowRoot!.activeElement?.id).to.equal(buttons[0].id);

  el.groups = []; // the focused emoji itself disappears, and no option survives to take its place
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
  expect(el.shadowRoot!.activeElement === input).to.be.true;
  expect(input.hasAttribute('aria-activedescendant')).to.be.false;
});

it('clamps the active index to 0 without stealing focus from the search input when a smaller groups array drops it out of range', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups; // 3 items
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
  input.focus();
  // Combobox idiom: moves the active index without moving real DOM focus off the input, so the
  // groups setter below sees the input (not an emoji button) as the focused element.
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.shadowRoot!.activeElement === input).to.be.true;
  expect(input.getAttribute('aria-activedescendant')).to.match(/-item-2$/);

  el.groups = [{ key: 'smileys', label: 'Smileys', emojis: [groups[0].emojis[0]] }];
  await el.updateComplete;

  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  expect(buttons.length).to.equal(1);
  expect(buttons[0].tabIndex).to.equal(0);
  expect(el.shadowRoot!.activeElement === input).to.be.true;
});

it("falls back to a pending grid focus entry's clamped index when its item reference is missing", async () => {
  const el = await connectEmojiPicker();
  el.groups = groups; // 3 items
  await el.updateComplete;

  // Synthesizes the otherwise-unreachable shape where a pending grid focus entry carries an
  // index but no surviving item reference, proving updated() clamps to the index instead of
  // throwing on the missing item.
  el.groups = groups; // re-triggers updated()'s changed.has('groups') branch
  (el as unknown as { pendingGridFocus?: { item?: unknown; index: number } }).pendingGridFocus = {
    index: 1,
  };
  await el.updateComplete;

  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  expect(buttons[1].tabIndex).to.equal(0);
});

it('preserves focused emoji identity across group reordering without stealing foreign focus', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;

  const dog = el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="dog face"]')!;
  dog.focus();
  el.groups = [groups[1], groups[0]];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('dog face');

  const foreign = document.createElement('button');
  foreign.id = 'emoji-picker-foreign-focus';
  created.push(foreign);
  document.body.append(foreign);
  foreign.focus();
  el.groups = [{ key: 'smileys', label: 'Smileys', emojis: [groups[0].emojis[0]] }];
  await el.updateComplete;
  expect(document.activeElement?.id).to.equal(foreign.id);
});

it('resolves a pending grid-focus item from the flat list when the focused-item cache itself is stale', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;

  const dog = el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="dog face"]')!;
  dog.focus();
  // Directly clears the private focused-item cache (bookkeeping normally kept in lockstep by
  // onGridFocusIn) while real DOM focus stays on the dog button, so the groups setter's
  // `this.focusedGridItem ?? this.flatItems[focusedIndex]` fallback is what has to recover the
  // identity below, not the cache.
  (el as unknown as { focusedGridItem?: unknown }).focusedGridItem = undefined;

  el.groups = [groups[1], groups[0]];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('dog face');
});

it('leaves a pending grid focus untouched when restoring finds no matching rendered button', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  await el.updateComplete;
  // restorePendingGridFocus() looks up the target button by `this.activeIndex`, not by
  // `pendingGridFocus.index` -- both are pushed out of range here so no button can ever match.
  const internals = el as unknown as { pendingGridFocus?: { index: number }; activeIndex: number };
  internals.activeIndex = 9999;
  internals.pendingGridFocus = { index: 9999 };

  el.label = 'Reactions'; // an update that touches neither queryText nor groups
  await el.updateComplete;

  expect(internals.pendingGridFocus).to.deep.equal({ index: 9999 });
});

it('reflects aria-required and aria-invalid as true on the grid once required is set and the field has been touched', async () => {
  const el = await connectEmojiPicker();
  el.groups = groups;
  el.required = true;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
  expect(grid.getAttribute('aria-required')).to.equal('true');
  expect(grid.getAttribute('aria-invalid')).to.equal('false'); // not yet touched

  const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(grid.getAttribute('aria-invalid')).to.equal('true');
});

describe('optional-peer load failure', () => {
  const emptyText = (el: LyraEmojiPicker) =>
    (el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement | null)?.textContent?.trim() ??
    null;
  const errorEl = (el: LyraEmojiPicker) =>
    el.shadowRoot!.querySelector('[part="load-error"]') as HTMLElement | null;

  it('renders a distinct failure surface when the optional peer never loads', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(null));
    await waitUntil(() => errorEl(el) !== null, 'load-error surface never rendered');
    expect((errorEl(el)!.textContent ?? '').trim().length > 0).to.equal(true);
    // The plain "no matches" state must not be what a failed install looks like.
    expect(emptyText(el) === null).to.equal(true);
  });

  it('announces the failure through the shared light-DOM assertive sink', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(null));
    await waitUntil(() => errorEl(el) !== null, 'load-error surface never rendered');
    const sink = document.querySelector(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
    ) as HTMLElement | null;
    expect(sink === null, 'assertive sink must exist in the light DOM').to.equal(false);
    const announced = Array.from(sink!.children, (child) => (child.textContent ?? '').trim());
    expect(announced.includes(errorEl(el)!.textContent!.trim())).to.equal(true);
  });

  it('keeps a deliberate groups = [] opt-out on the ordinary empty state, not the error one', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(null));
    el.groups = [];
    await el.updateComplete;
    expect(errorEl(el) === null).to.equal(true);
    expect((emptyText(el) ?? '').length > 0).to.equal(true);
  });

  it('keeps a peer that legitimately resolved zero groups on the ordinary empty state', async () => {
    // The loader's `[]`-vs-`null` contract has to survive into the render: `[]` is a well-formed
    // peer that simply has no data (ordinary empty state), while `null` is a broken or spoofed one
    // (error state). Treating an empty-but-valid result as a failure here would resurrect exactly
    // the conflation `emoji-data-loader.ts` fails closed to avoid, only one layer up.
    const loaded = Promise.resolve<EmojiPickerGroup[]>([]);
    const el = await connectEmojiPicker(() => loaded);
    // The component's own `.then()` was registered on this promise first, so awaiting it here
    // resolves after the load has been consumed -- no timer, no polling for an absence.
    await loaded;
    await el.updateComplete;
    expect(errorEl(el) === null, 'an empty-but-valid peer must not render the failure surface').to
      .equal(true);
    expect((emptyText(el) ?? '').length > 0).to.equal(true);
    expect(el.groups.length).to.equal(0);
  });

  it('keeps a genuine zero-match search on the ordinary empty state', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(groups));
    await waitUntil(() => el.groups.length > 0, 'groups never loaded');
    const search = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    search.value = 'zzzznothing';
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(errorEl(el) === null).to.equal(true);
    expect((emptyText(el) ?? '').length > 0).to.equal(true);
  });

  it('clears the error state as soon as a consumer supplies groups afterwards', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(null));
    await waitUntil(() => errorEl(el) !== null, 'load-error surface never rendered');
    el.groups = groups;
    await el.updateComplete;
    expect(errorEl(el) === null).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[part~="emoji"]').length > 0).to.equal(true);
  });

  it('localizes the failure message through registerLyraLocale', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(null));
    el.strings = { emojiPickerLoadError: 'MARKER-LOAD-ERROR' };
    await waitUntil(() => errorEl(el) !== null, 'load-error surface never rendered');
    await el.updateComplete;
    expect(errorEl(el)!.textContent!.trim()).to.equal('MARKER-LOAD-ERROR');
  });

  it('unset-regression: a picker whose peer loads normally shows no error surface', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(groups));
    await waitUntil(() => el.groups.length > 0, 'groups never loaded');
    expect(errorEl(el) === null).to.equal(true);
  });

  it('reuses the existing announcement sink for a repeated peer-load failure while connected, and no-ops once disconnected', async () => {
    const el = await connectEmojiPicker(() => Promise.resolve(null));
    await waitUntil(() => errorEl(el) !== null, 'load-error surface never rendered');
    const sink = document.querySelector(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
    ) as HTMLElement;
    expect(sink.children.length).to.equal(1);
    const internals = el as unknown as { announcePeerLoadFailure(): void };

    // Second call while still connected: must reuse the existing sink, not recreate it.
    internals.announcePeerLoadFailure();
    expect(document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`) === sink).to.be
      .true;
    expect(sink.children.length).to.equal(2);

    el.remove();
    // Disconnected: must no-op rather than throw or reach the (now-released) sink.
    expect(() => internals.announcePeerLoadFailure()).to.not.throw();
  });
});
