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
