import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './emoji-picker.js';
import type { LyraEmojiPicker, EmojiPickerGroup } from './emoji-picker.js';

const mounted: Element[] = [];
const samples: EmojiPickerGroup[] = [{
  key: '0', label: 'Caller heading', emojis: [
    { emoji: '😀', name: 'grinning face', shortcodes: ['grinning'] },
    { emoji: '🐶', name: 'dog face', shortcodes: ['dog'] },
  ],
}];

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
});

async function picker(autoGroups?: EmojiPickerGroup[]): Promise<LyraEmojiPicker> {
  const el = document.createElement('lr-emoji-picker');
  if (autoGroups) {
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[]> }).loadGroups =
      () => Promise.resolve(autoGroups);
  } else el.groups = samples;
  mounted.push(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function search(el: LyraEmojiPicker): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
}

function grid(el: LyraEmojiPicker): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
}

function descriptions(owner: HTMLElement): string[] {
  return Reflect.has(owner, 'ariaDescribedByElements')
    ? Array.from(owner.ariaDescribedByElements ?? []).map((element) => element.id)
    : owner.getAttribute('aria-describedby')?.match(/\S+/g) ?? [];
}

for (const [attribute, property, part] of [
  ['label', 'label', 'form-control-label'],
  ['hint', 'hint', 'hint'],
  ['error-text', 'errorText', 'error'],
] as const) {
  it(`renders safely after removing ${attribute}, preserving null readback and later values`, async () => {
    const el = await picker();
    el.setAttribute(attribute, 'Supplied content');
    await el.updateComplete;
    el.removeAttribute(attribute);
    let failure: unknown;
    try { await el.updateComplete; } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : failure).to.equal(undefined);
    expect(el[property]).to.equal(null);
    const chrome = el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
    expect(chrome.hidden).to.equal(true);
    el.setAttribute(attribute, '');
    await el.updateComplete;
    expect(el[property]).to.equal('');
    expect(chrome.hidden).to.equal(true);
    el.setAttribute(attribute, 'Recovered content');
    await el.updateComplete;
    expect(chrome.hidden).to.equal(false);
    expect(chrome.textContent).to.include('Recovered content');
  });
}

for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
  for (const key of ['Enter', 'ArrowRight', 'ArrowDown']) {
    it(`leaves search ${key} unconsumed during ${'isComposing' in composition ? 'composition' : 'legacy composition'}`, async () => {
      const el = await picker();
      const input = search(el);
      input.focus();
      const before = input.getAttribute('aria-activedescendant');
      let picks = 0;
      el.addEventListener('lr-change', () => picks++);
      const event = new KeyboardEvent('keydown', { key, ...composition, bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(event);
      await el.updateComplete;
      expect(event.defaultPrevented).to.equal(false);
      expect(picks).to.equal(0);
      expect(el.value).to.equal('');
      expect(input.getAttribute('aria-activedescendant')).to.equal(before);
      expect(el.shadowRoot!.activeElement === input).to.equal(true);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(picks).to.equal(1);
      expect(el.value).to.equal('😀');
    });
  }
}

expectLocaleFallback('fr', ['emojiPickerGridLabel', 'emojiPickerGroupSmileysEmotion', 'emojiPickerSearchLabel', 'emojiPickerSearchPlaceholder']);

it('projects live host descriptions onto the value listbox with external-first identity ordering', async () => {
  const el = await picker();
  el.hint = 'Local hint';
  el.errorText = 'Local error';
  el.setAttribute('aria-describedby', 'emoji-first emoji-late emoji-first');
  const first = document.createElement('span');
  first.id = 'emoji-first';
  first.textContent = 'External guidance';
  mounted.push(first);
  document.body.append(first);
  await el.updateComplete;
  const owner = grid(el);
  const baseline = [
    el.shadowRoot!.querySelector<HTMLElement>('[part="error"]')!.id,
    el.shadowRoot!.querySelector<HTMLElement>('[part="hint"]')!.id,
  ];
  if (!(Reflect.has(owner, 'ariaDescribedByElements'))) {
    expect(descriptions(owner)).to.deep.equal(baseline);
    return;
  }
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === first, 'external description did not reach the listbox');
  expect(descriptions(owner)).to.deep.equal([first.id, ...baseline]);
  expect(descriptions(search(el))).to.deep.equal([]);
  const replacement = document.createElement('span');
  replacement.id = first.id;
  replacement.textContent = 'Replacement guidance';
  mounted.push(replacement);
  first.replaceWith(replacement);
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === replacement);
  replacement.remove();
  await waitUntil(() => descriptions(owner).join(' ') === baseline.join(' '));
  document.body.append(replacement);
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === replacement);
  const late = document.createElement('span');
  late.id = 'emoji-late';
  mounted.push(late);
  document.body.append(late);
  await waitUntil(() => descriptions(owner).join(' ') === [first.id, late.id, ...baseline].join(' '));
  el.hint = '';
  await el.updateComplete;
  expect(descriptions(owner)).to.deep.equal([first.id, late.id, baseline[0]]);
  el.removeAttribute('aria-describedby');
  await waitUntil(() => descriptions(owner).join(' ') === baseline[0]);
});

it('rebinds listbox descriptions after reconnect and adoption into a different root', async () => {
  const el = await picker();
  const source = document.createElement('span');
  source.id = 'emoji-realm-guidance';
  source.textContent = 'Original guidance';
  mounted.push(source);
  document.body.append(source);
  el.setAttribute('aria-describedby', source.id);
  const owner = grid(el);
  if (!(Reflect.has(owner, 'ariaDescribedByElements'))) return;
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === source);
  el.remove();
  document.body.append(el);
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === source);
  const frame = document.createElement('iframe');
  mounted.push(frame);
  document.body.append(frame);
  const foreignDocument = frame.contentDocument!;
  const foreignSource = foreignDocument.createElement('span');
  foreignSource.id = source.id;
  foreignSource.textContent = 'Adopted guidance';
  foreignDocument.body.append(foreignSource);
  try {
    foreignDocument.body.append(foreignDocument.adoptNode(el));
    await waitUntil(() => owner.ariaDescribedByElements?.[0] === foreignSource);
    foreignSource.remove();
    await waitUntil(() => descriptions(owner).length === 0);
    foreignDocument.body.append(foreignSource);
    await waitUntil(() => owner.ariaDescribedByElements?.[0] === foreignSource);
  } finally {
    document.adoptNode(el);
    el.remove();
  }
});

it('resets local interaction state while retaining required and custom invalidity and the default value', async () => {
  const el = await picker();
  const form = document.createElement('form');
  const outside = document.createElement('button');
  outside.type = 'button';
  mounted.push(form, outside);
  document.body.append(form, outside);
  form.append(el);
  el.required = true;
  await el.updateComplete;
  el.focus();
  outside.focus();
  await el.updateComplete;
  expect(grid(el).getAttribute('aria-invalid')).to.equal('true');
  expect(el.matches(':state(user-invalid)')).to.equal(true);
  form.reset();
  await el.updateComplete;
  expect(grid(el).getAttribute('aria-invalid')).to.equal('false');
  expect(el.matches(':state(user-invalid)')).to.equal(false);
  expect(el.validity.valueMissing).to.equal(true);
  el.defaultValue = '😀';
  el.value = '🐶';
  el.setCustomValidity('Custom validation');
  el.focus();
  outside.focus();
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('😀');
  expect(el.validity.customError).to.equal(true);
  expect(el.validationMessage).to.equal('Custom validation');
  expect(grid(el).getAttribute('aria-invalid')).to.equal('false');
});

for (const count of [2, 250]) {
  it(`keeps built-in headings localized through search and live strings changes with ${count} items`, async () => {
    const el = await picker([{ key: '0', label: 'Smileys & Emotion', emojis: Array.from({ length: count }, (_, index) => ({
      emoji: `😀${index}`, name: `grinning ${index}`,
    })) }]);
    el.strings = { emojiPickerGroupSmileysEmotion: 'Émotions' };
    await el.updateComplete;
    const heading = () => el.shadowRoot!.querySelector('[part="group-label"]')?.textContent;
    expect(heading()).to.equal('Émotions');
    search(el).value = 'grinning';
    search(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(heading()).to.equal('Émotions');
    el.strings = { emojiPickerGroupSmileysEmotion: 'Gefühle' };
    await el.updateComplete;
    expect(heading()).to.equal('Gefühle');
    el.groups = [{ key: '0', label: 'Literal caller heading', emojis: el.groups[0]!.emojis }];
    await el.updateComplete;
    expect(heading()).to.equal('Literal caller heading');
  });
}

it('refreshes reused source contents on groups reassignment while preserving frozen snapshots and focused identity', async () => {
  const el = await picker();
  const mutable = { emoji: '😀', name: 'old face', shortcodes: ['old'] };
  const other = { emoji: '🐶', name: 'dog' };
  el.groups = [{ key: '0', label: 'Caller heading', emojis: [mutable, other] }];
  await el.updateComplete;
  const old = el.groups;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="emoji"]')!.focus();
  mutable.emoji = '😁';
  mutable.name = 'new face';
  mutable.shortcodes[0] = 'updated';
  el.label = 'Re-render without reassignment';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="emoji"]')?.getAttribute('aria-label')).to.equal('old face');
  el.groups = [{ key: '0', label: 'Caller heading', emojis: [other, mutable] }];
  await el.updateComplete;
  expect(el.groups[0]!.emojis[1]!.emoji).to.equal('😁');
  expect(el.groups[0]!.emojis[1]!.name).to.equal('new face');
  expect(el.groups[0]!.emojis[1]!.shortcodes).to.deep.equal(['updated']);
  expect(Object.isFrozen(old[0]!.emojis[0])).to.equal(true);
  expect(old[0]!.emojis[0]!.emoji).to.equal('😀');
  expect(old[0]!.emojis[0]!.shortcodes).to.deep.equal(['old']);
  expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('new face');
  search(el).value = 'updated';
  search(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="emoji"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="emoji"]')?.textContent).to.equal('😁');
});


it('threads effectiveLocale into the built-in auto-loader and reloads it when locale changes', async () => {
  const calls: string[] = [];
  const el = document.createElement('lr-emoji-picker');
  (el as unknown as { loadGroups: (locale: string) => Promise<EmojiPickerGroup[] | null> }).loadGroups =
    (locale: string) => {
      calls.push(locale);
      return Promise.resolve([
        { key: '0', label: 'Group', emojis: [{ emoji: '😀', name: `name-${locale}` }] },
      ]);
    };
  mounted.push(el);
  document.body.append(el);
  await el.updateComplete;
  await waitUntil(() => calls.length === 1);
  expect(calls).to.deep.equal(['en']);
  await waitUntil(
    () => el.shadowRoot!.querySelector('[part="emoji"]')?.getAttribute('aria-label') === 'name-en',
  );

  el.locale = 'fr';
  await el.updateComplete;
  await waitUntil(() => calls.length === 2);
  expect(calls).to.deep.equal(['en', 'fr']);
  await waitUntil(
    () => el.shadowRoot!.querySelector('[part="emoji"]')?.getAttribute('aria-label') === 'name-fr',
  );
});

it('never reloads the built-in dataset once the consumer explicitly assigns groups', async () => {
  const calls: string[] = [];
  const el = document.createElement('lr-emoji-picker');
  (el as unknown as { loadGroups: (locale: string) => Promise<EmojiPickerGroup[] | null> }).loadGroups =
    (locale: string) => {
      calls.push(locale);
      return Promise.resolve([
        { key: '0', label: 'Group', emojis: [{ emoji: '😀', name: `name-${locale}` }] },
      ]);
    };
  mounted.push(el);
  document.body.append(el);
  await el.updateComplete;
  await waitUntil(() => calls.length === 1);

  el.groups = samples;
  el.locale = 'fr';
  await el.updateComplete;
  expect(calls).to.deep.equal(['en']);
  expect(el.groups).to.deep.equal(samples);
});

it('keeps windowed rows at the grid width so group headings remain on one line', async () => {
  const groups: EmojiPickerGroup[] = [{
    key: '0',
    label: 'Smileys & Emotion',
    emojis: Array.from({ length: 240 }, (_, index) => ({ emoji: '😀', name: `face ${index}` })),
  }];
  const el = await picker(groups);
  el.style.inlineSize = '360px';
  await el.updateComplete;

  const gridEl = grid(el);
  const spacer = el.shadowRoot!.querySelector<HTMLElement>('[part="virtual-spacer"]')!;
  const row = spacer.querySelector<HTMLElement>('[part="virtual-row"]')!;
  const heading = row.querySelector<HTMLElement>('[part="group-label"]')!;
  const headingText = document.createRange();
  headingText.selectNodeContents(heading);
  const gridWidth = gridEl.clientWidth;

  expect(spacer.getBoundingClientRect().width).to.be.closeTo(gridWidth, 1);
  expect(row.getBoundingClientRect().width).to.be.closeTo(gridWidth, 1);
  expect(headingText.getClientRects().length).to.equal(1);
});

it('shows a dedicated localized search placeholder, separate from the accessible name', async () => {
  const el = await picker();
  const searchInput = search(el);
  expect(searchInput.placeholder, 'English fallback').to.equal('Search emoji…');
  expect(searchInput.getAttribute('aria-label')).to.equal('Search emoji');
  el.strings = { emojiPickerSearchPlaceholder: 'Rechercher des emojis…' };
  await el.updateComplete;
  expect(searchInput.placeholder, '.strings reaches the placeholder').to.equal('Rechercher des emojis…');
  expect(searchInput.getAttribute('aria-label'), 'the name is untouched').to.equal('Search emoji');
});

it('lets searchPlaceholder override the localized placeholder', async () => {
  const el = await picker();
  const searchInput = search(el);
  el.searchPlaceholder = 'Find a reaction';
  await el.updateComplete;
  expect(searchInput.placeholder).to.equal('Find a reaction');
  el.setAttribute('search-placeholder', 'Type to filter');
  await el.updateComplete;
  expect(searchInput.placeholder, 'reflected from the attribute').to.equal('Type to filter');
  el.removeAttribute('search-placeholder');
  await el.updateComplete;
  expect(searchInput.placeholder, 'removal restores the localized default').to.equal('Search emoji…');
});

it('falls back to the search label when the placeholder is blank', async () => {
  const el = await picker();
  const searchInput = search(el);
  el.strings = { emojiPickerSearchLabel: 'Rechercher des emojis', emojiPickerSearchPlaceholder: '' };
  await el.updateComplete;
  expect(searchInput.placeholder, 'blank localized placeholder').to.equal('Rechercher des emojis');
  el.searchPlaceholder = '   ';
  await el.updateComplete;
  expect(searchInput.placeholder, 'blank property').to.equal('Rechercher des emojis');
});

it('does not reacquire external-description observers from a queued update after disconnect', async () => {
  const Original = window.MutationObserver;
  const active = new Map<MutationObserver, Node>();
  window.MutationObserver = class extends Original {
    override observe(target: Node, options?: MutationObserverInit) {
      super.observe(target, options);
      if (options?.attributeFilter?.length === 1 && options.attributeFilter[0] === 'aria-describedby') active.set(this, target);
    }
    override disconnect() { super.disconnect(); active.delete(this); }
  };
  try {
    const el = await fixture<LyraEmojiPicker>(html`<lr-emoji-picker aria-describedby="outside-guidance"></lr-emoji-picker>`);
    const count = () => [...active.values()].filter((target) => target === el).length;
    expect(count()).to.equal(1);
    el.hint = 'Queued render';
    el.remove();
    expect(count()).to.equal(0);
    await el.updateComplete;
    expect(count()).to.equal(0);
    document.body.append(el);
    await el.updateComplete;
    expect(count()).to.equal(1);
    el.remove();
    expect(count()).to.equal(0);
  } finally { window.MutationObserver = Original; }
});

for (const count of [150, 300]) {
  it(`emoji-picker reveals the active ${count > 200 ? 'windowed ' : ''}option by scrolling only its grid`, async () => {
    const el = document.createElement('lr-emoji-picker');
    el.groups = [{ key: 'many', label: 'Many', emojis: Array.from({ length: count }, (_, index) => ({ emoji: String.fromCodePoint(0x1F300 + index), name: `emoji ${index}`, shortcodes: [] })) }];
    mounted.push(el);
    document.body.append(el);
    await el.updateComplete;
    const original = Element.prototype.scrollIntoView;
    let calls = 0;
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element['scrollIntoView']>) {
      calls += 1;
      return original.apply(this, args);
    };
    try {
      for (let step = 0; step < 12; step++) search(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      await waitUntil(() => grid(el).scrollTop > 0);
      await el.updateComplete;
      const active = grid(el).querySelector<HTMLElement>('[part="emoji"][data-active]')!;
      expect(active.getBoundingClientRect().bottom).to.be.at.most(grid(el).getBoundingClientRect().bottom + 1);
      expect(active.getBoundingClientRect().top).to.be.at.least(grid(el).getBoundingClientRect().top - 1);
      expect(calls, 'the page and its scrollers stay put').to.equal(0);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
}

it('emoji-picker hover paints through CSS and leaves the keyboard-active option alone', async () => {
  const el = await picker();
  const buttons = grid(el).querySelectorAll<HTMLButtonElement>('[part="emoji"]');
  const before = search(el).getAttribute('aria-activedescendant');
  buttons[1]!.dispatchEvent(new MouseEvent('mouseenter'));
  await el.updateComplete;
  expect(buttons[0]!.hasAttribute('data-active')).to.equal(true);
  expect(buttons[1]!.hasAttribute('data-active')).to.equal(false);
  expect(search(el).getAttribute('aria-activedescendant')).to.equal(before);
});

it('emoji-picker hides forwarded hint and error slots that carry nothing', async () => {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<lr-emoji-picker><slot name="hint" slot="hint"></slot><slot name="error" slot="error"></slot></lr-emoji-picker>';
  document.body.append(host);
  try {
    const el = root.querySelector('lr-emoji-picker') as LyraEmojiPicker;
    await el.updateComplete;
    const chrome = (part: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
    await waitUntil(() => chrome('hint').hidden && chrome('error').hidden);
  } finally {
    host.remove();
  }
});

it('emoji-picker groups its options under their labelled headings', async () => {
  const el = await picker();
  const group = grid(el).querySelector<HTMLElement>('[role="group"]')!;
  const heading = el.shadowRoot!.getElementById(group.getAttribute('aria-labelledby')!)!;
  expect(heading.textContent!.trim()).to.equal('Caller heading');
  expect(group.querySelectorAll('[part="emoji"]').length).to.equal(2);
  expect(grid(el).querySelectorAll(':scope > [role="listbox"] > *, :scope > *:not([role])').length).to.equal(0);
});

it('emoji-picker virtualized rows are named by their group', async () => {
  const el = document.createElement('lr-emoji-picker');
  el.groups = [{ key: 'many', label: 'Many', emojis: Array.from({ length: 300 }, (_, index) => ({ emoji: String.fromCodePoint(0x1F300 + index), name: `emoji ${index}`, shortcodes: [] })) }];
  mounted.push(el);
  document.body.append(el);
  await el.updateComplete;
  const rows = [...grid(el).querySelectorAll<HTMLElement>('[part="virtual-row"]')];
  expect(rows.length).to.be.greaterThan(1);
  for (const row of rows) {
    expect(row.getAttribute('role')).to.equal('group');
    expect(row.getAttribute('aria-label')).to.equal('Many');
  }
});

it('emoji-picker reports the previous value in its change details', async () => {
  const el = await picker();
  el.value = '😀';
  const details: Array<{ value: string; previousValue: string }> = [];
  el.addEventListener('lr-input', (event) => details.push(event.detail));
  el.addEventListener('lr-change', (event) => details.push(event.detail));
  grid(el).querySelectorAll<HTMLButtonElement>('[part="emoji"]')[1]!.click();
  expect(details).to.deep.equal([{ value: '🐶', previousValue: '😀' }, { value: '🐶', previousValue: '😀' }]);
});

describe('emoji-picker load failure recovery', () => {
  it('announces a failed load, offers a retry and reloads on demand', async () => {
    const el = document.createElement('lr-emoji-picker');
    let loads = 0;
    (el as unknown as { loadGroups: () => Promise<EmojiPickerGroup[] | null> }).loadGroups =
      () => Promise.resolve(++loads === 1 ? null : samples);
    const errors: number[] = [];
    el.addEventListener('lr-load-error', () => errors.push(loads));
    mounted.push(el);
    document.body.append(el);
    const retry = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-retry"]');
    await waitUntil(() => retry() !== null, 'no retry control after a failed load');
    expect(errors).to.deep.equal([1]);
    retry()!.click();
    await waitUntil(() => grid(el).querySelectorAll('[part="emoji"]').length === 2, 'the retry never reloaded');
    expect(retry() === null).to.equal(true);
    expect(loads).to.equal(2);
  });
});
