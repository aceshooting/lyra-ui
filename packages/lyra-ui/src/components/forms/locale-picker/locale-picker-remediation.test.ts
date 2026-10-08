import { aTimeout, expect, fixture, fixtureCleanup, oneEvent, waitUntil } from '@open-wc/testing';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import { setLyraLocale } from '../../../internal/localization.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import type { LyraLocalePicker } from './locale-picker.js';
import type { LyraOtpInput } from '../otp-input/otp-input.js';
import type { LyraPhoneInput } from '../phone-input/phone-input.js';
import './locale-picker.js';
import '../otp-input/otp-input.js';
import '../phone-input/phone-input.js';

before(() => expectLocaleFallback('fr', ['localePickerLabel', 'loading']));

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
before(() => setFlagUrlResolver(async () => TEST_FLAG_SRC));
after(() => {
  fixtureCleanup();
  setFlagUrlResolver(null);
});

type Picker = LyraLocalePicker | LyraOtpInput | LyraPhoneInput;
const settle = async (el: Picker) => { await el.updateComplete; await aTimeout(0); await el.updateComplete; };
const descriptions = (target: Element): readonly Element[] =>
  (target as Element & { ariaDescribedByElements?: readonly Element[] }).ariaDescribedByElements ?? [];

for (const attribute of ['label', 'hint', 'error-text']) {
  it(`locale-picker renders safely after ${attribute} removal and recovers`, async () => {
    const el = await fixture<LyraLocalePicker>('<lr-locale-picker></lr-locale-picker>');
    const property = attribute === 'error-text' ? 'errorText' : attribute;
    el.setAttribute(attribute, 'Guidance');
    await settle(el);
    el.removeAttribute(attribute);
    await settle(el);
    expect(Reflect.get(el, property)).to.equal(null);
    expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
    el.setAttribute(attribute, '');
    await settle(el);
    expect(Reflect.get(el, property)).to.equal('');
    el.setAttribute(attribute, 'Recovered');
    await settle(el);
    expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
  });
}

for (const [tag, selector] of [
  ['lr-locale-picker', '[part="trigger"]'],
  ['lr-otp-input', '[part="control"]'],
  ['lr-phone-input', 'input[part="input"]'],
] as const) {
  it(`${tag} keeps external descriptions before local guidance across live target changes and reconnect`, async () => {
    const wrapper = await fixture<HTMLElement>(`<div><p id="${tag}-guidance">External guidance</p><${tag} label="Value" hint="Local hint" error-text="Local error" aria-describedby="${tag}-guidance missing ${tag}-guidance"></${tag}></div>`);
    const el = wrapper.querySelector<Picker>(tag)!;
    await settle(el);
    const target = el.shadowRoot!.querySelector(selector)!;
    const source = wrapper.querySelector('p')!;
    await waitUntil(() => descriptions(target)[0] === source);
    const expected = ['External guidance', 'Local error', 'Local hint'];
    expect(descriptions(target).map((node) => node.textContent?.trim())).to.deep.equal(expected);
    const replacement = source.cloneNode(true) as HTMLElement;
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => descriptions(target)[0] === replacement);
    replacement.remove();
    await waitUntil(() => descriptions(target).length === 2);
    wrapper.prepend(replacement);
    await waitUntil(() => descriptions(target)[0] === replacement);
    el.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions(target).length === 2);
    el.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => descriptions(target)[0] === replacement);
    el.hint = '';
    await settle(el);
    expect(descriptions(target).map((node) => node.textContent?.trim())).to.deep.equal(['Replacement', 'Local error']);
    el.remove();
    wrapper.append(el);
    await settle(el);
    await waitUntil(() => descriptions(target)[0] === replacement);
    if (tag === 'lr-phone-input') {
      expect(descriptions(el.shadowRoot!.querySelector('select')!).length).to.equal(0);
    }
  });

  it(`${tag} resolves missing descriptions and changed IDs in an adopted document`, async () => {
    const el = await fixture<Picker>(`<${tag} label="Value" hint="Local hint" aria-describedby="adopted-guidance"></${tag}>`);
    await settle(el);
    const target = el.shadowRoot!.querySelector(selector)!;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error('Expected iframe document');
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      const source = frameDocument.createElement('p');
      source.id = 'adopted-guidance';
      source.textContent = 'Adopted guidance';
      frameDocument.body.append(source);
      await waitUntil(() => descriptions(target)[0] === source);
      expect(descriptions(target).map((node) => node.textContent?.trim())).to.deep.equal(['Adopted guidance', 'Local hint']);
      source.id = 'missing';
      await waitUntil(() => descriptions(target).length === 1);
      source.id = 'adopted-guidance';
      await waitUntil(() => descriptions(target)[0] === source);
    } finally {
      document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });
}

describe('locale-picker type-ahead reset debounce', () => {
  const bufferOf = (el: LyraLocalePicker): string =>
    (el as unknown as { typeBuffer: { text: string } }).typeBuffer.text;
  const typeAhead = (el: LyraLocalePicker, char: string): void => {
    (el as unknown as { typeAhead(char: string): void }).typeAhead(char);
  };

  it('restarts the reset on every keystroke instead of clearing a buffer a later one owns', async () => {
    const el = await fixture<LyraLocalePicker>('<lr-locale-picker></lr-locale-picker>');
    await settle(el);
    typeAhead(el, 'e');
    expect(bufferOf(el)).to.equal('e');
    // wait-reason: the type-ahead buffer reset (~500 ms real timer) is the behavior under test
    await aTimeout(300);
    typeAhead(el, 'n');
    expect(bufferOf(el), 'a second keystroke extends the buffer').to.equal('en');
    // wait-reason: the type-ahead buffer reset (~500 ms real timer) is the behavior under test
    await aTimeout(350);
    expect(bufferOf(el), 'the superseded reset must not clear it').to.equal('en');
    // wait-reason: the type-ahead buffer reset (~500 ms real timer) is the behavior under test
    await aTimeout(400);
    expect(bufferOf(el), 'the surviving reset still fires on its own schedule').to.equal('');
  });

  it('still resets its buffer after a disconnect and reconnect', async () => {
    // The reset runs on the shared DebounceController. Teardown must `cancel()` it, never
    // `dispose()` it: a disconnect here may be a re-parent, and a disposed controller silently
    // refuses every later push, leaving a reconnected picker with a buffer that never clears.
    const el = await fixture<LyraLocalePicker>('<lr-locale-picker></lr-locale-picker>');
    await settle(el);
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await settle(el);
    typeAhead(el, 'f');
    expect(bufferOf(el), 'a reconnected picker still accumulates').to.equal('f');
    // wait-reason: the type-ahead buffer reset (~500 ms real timer) is the behavior under test
    await aTimeout(700);
    expect(bufferOf(el), 'and its reset still fires').to.equal('');
  });
});

it('locale-picker reveals the active row below its sticky search field by scrolling only the listbox', async () => {
  const tags = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'nb', 'fi', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'ar', 'he', 'fa', 'hi', 'bn', 'th', 'vi', 'id', 'ms', 'ja', 'ko'];
  const el = await fixture<LyraLocalePicker>(`<lr-locale-picker searchable></lr-locale-picker>`);
  el.locales = tags;
  el.open = true;
  await settle(el);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="option"]').length === tags.length);
  const original = Element.prototype.scrollIntoView;
  let calls = 0;
  Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element['scrollIntoView']>) {
    calls += 1;
    return original.apply(this, args);
  };
  try {
    const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
    for (let step = 0; step < tags.length; step++) search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await settle(el);
    const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    await waitUntil(() => listbox.scrollTop > 0);
    const row = listbox.querySelector<HTMLElement>('[part="option"][data-active]') ?? listbox.querySelector<HTMLElement>('[aria-selected="true"]')!;
    expect(row.getBoundingClientRect().bottom).to.be.at.most(listbox.getBoundingClientRect().bottom + 1);
    expect(calls, 'the page and its scrollers stay put').to.equal(0);
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});

const CATALOG = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'nb', 'fi', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'ar', 'he', 'fa', 'hi', 'bn', 'th', 'vi', 'id', 'ms', 'ja', 'ko'];
const trigger = (el: LyraLocalePicker) => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
const activeRow = (el: LyraLocalePicker) => el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]');

it('locale-picker opens on the committed locale, active and in view, and ArrowDown continues from it', async () => {
  const el = await fixture<LyraLocalePicker>('<lr-locale-picker value="vi"></lr-locale-picker>');
  el.locales = CATALOG;
  await settle(el);
  el.open = true;
  await settle(el);
  expect(activeRow(el)?.dataset['value']).to.equal('vi');
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  await waitUntil(() => activeRow(el)!.getBoundingClientRect().bottom <= listbox.getBoundingClientRect().bottom + 1);
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await settle(el);
  expect(activeRow(el)?.dataset['value']).to.equal('id');
});

it('locale-picker re-picking the committed locale changes nothing and only closes', async () => {
  setLyraLocale('en');
  const el = await fixture<LyraLocalePicker>('<lr-locale-picker value="en"></lr-locale-picker>');
  el.locales = ['en', 'fr'];
  await settle(el);
  const seen: string[] = [];
  for (const type of ['lr-change-request', 'lr-change', 'change', 'input']) el.addEventListener(type, () => seen.push(type));
  el.open = true;
  await settle(el);
  el.shadowRoot!.querySelector<HTMLElement>('[data-value="en"]')!.click();
  await settle(el);
  expect(seen).to.deep.equal([]);
  expect(el.open).to.be.false;
});

it('locale-picker dispatches the native input and change events with lr-input and lr-change after a commit', async () => {
  const el = await fixture<LyraLocalePicker>('<lr-locale-picker></lr-locale-picker>');
  el.locales = ['en', 'fr'];
  await settle(el);
  const seen: string[] = [];
  for (const type of ['lr-change-request', 'input', 'lr-input', 'change', 'lr-change']) el.addEventListener(type, () => seen.push(type));
  el.open = true;
  await settle(el);
  const changed = oneEvent(el, 'lr-change');
  el.shadowRoot!.querySelector<HTMLElement>('[data-value="fr"]')!.click();
  const event = await changed;
  expect(seen).to.deep.equal(['lr-change-request', 'input', 'lr-input', 'change', 'lr-change']);
  expect(event.detail.value).to.equal('fr');
  setLyraLocale('en');
});

for (const searchable of [false, true]) {
  it(`locale-picker ${searchable ? 'searchable ' : ''}listbox chrome presses keep focus where it is`, async () => {
    const el = await fixture<LyraLocalePicker>(`<lr-locale-picker ${searchable ? 'searchable' : ''}></lr-locale-picker>`);
    el.locales = ['en', 'fr'];
    el.open = true;
    await settle(el);
    const listbox = el.shadowRoot!.querySelector('[part="listbox"]')!;
    const onChrome = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    listbox.dispatchEvent(onChrome);
    expect(onChrome.defaultPrevented, 'padding, scrollbar and empty space').to.be.true;
    if (!searchable) return;
    const onSearch = new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true });
    el.shadowRoot!.querySelector('[part="search-input"]')!.dispatchEvent(onSearch);
    expect(onSearch.defaultPrevented, 'the field keeps native caret placement').to.be.false;
  });
}

it('locale-picker hides forwarded hint and error slots that carry nothing', async () => {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<lr-locale-picker><slot name="hint" slot="hint"></slot><slot name="error" slot="error"></slot></lr-locale-picker>';
  document.body.append(host);
  try {
    const el = root.querySelector('lr-locale-picker') as LyraLocalePicker;
    await settle(el);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="hint"]')!.hidden).to.be.true;
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="error"]')!.hidden).to.be.true;
  } finally {
    host.remove();
  }
});

it('locale-picker filters its catalog once per search keystroke', async () => {
  const el = await fixture<LyraLocalePicker>('<lr-locale-picker searchable></lr-locale-picker>');
  el.locales = CATALOG;
  el.open = true;
  await settle(el);
  const original = Intl.DisplayNames.prototype.of;
  let calls = 0;
  Intl.DisplayNames.prototype.of = function (this: Intl.DisplayNames, ...args: Parameters<Intl.DisplayNames['of']>) {
    calls += 1;
    return original.apply(this, args);
  };
  try {
    const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
    search.value = 'a';
    search.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await settle(el);
    expect(calls, 'one filter pass (three name lookups per row) plus flag renders').to.be.at.most(CATALOG.length * 6);
  } finally {
    Intl.DisplayNames.prototype.of = original;
  }
});
