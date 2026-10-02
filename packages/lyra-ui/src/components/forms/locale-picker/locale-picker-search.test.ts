import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { getLyraLocale, setLyraLocale } from '../../../localization.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.class.js';

const CATALOG = ['en', 'fr', 'de', 'pt-BR'];
const trigger = (el: LyraLocalePicker) => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
const input = (el: LyraLocalePicker) => el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
const tags = (el: LyraLocalePicker) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')]
  .map(row => row.dataset['value']);
const create = () => fixture<LyraLocalePicker>(html`<lr-locale-picker searchable locale="en"
  value="en" .locales=${CATALOG}></lr-locale-picker>`);

async function openSearch(el: LyraLocalePicker): Promise<HTMLInputElement> {
  await focusByKeyboard(trigger(el));
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'search-input');
  return input(el);
}

async function filter(el: LyraLocalePicker, query: string): Promise<void> {
  input(el).value = query;
  input(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' }));
  await el.updateComplete;
}

function activeTag(el: LyraLocalePicker): string | undefined {
  return el.shadowRoot!.getElementById(input(el).getAttribute('aria-activedescendant') ?? '')?.dataset['value'];
}

describe('lr-locale-picker optional text filtering', () => {
  let previousLocale: string;
  beforeEach(() => {
    previousLocale = getLyraLocale();
    setLyraLocale('en');
    setFlagUrlResolver(async () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E');
  });
  afterEach(async () => {
    fixtureCleanup();
    setFlagUrlResolver(null);
    setLyraLocale(previousLocale);
    await resetMouse();
  });

  it('leaves the unset flag trigger, direct listbox and closed type-ahead unchanged', async () => {
    const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker locale="en" value="en"
      trigger-display="flag" option-display="label" .locales=${CATALOG}></lr-locale-picker>`);
    expect(el.searchable).to.equal(false);
    expect(el.input === null).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[part="search-input"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="trigger-flag"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="listbox"]')?.getAttribute('role')).to.equal('listbox');
    expect(trigger(el).getAttribute('aria-haspopup')).to.equal('listbox');
    let changes = 0;
    el.addEventListener('lr-change', () => { changes++; });
    await focusByKeyboard(trigger(el));
    await sendKeys({ type: 'f' });
    await el.updateComplete;
    expect(el.value).to.equal('fr');
    expect(changes).to.equal(1);
    expect(el.open).to.equal(false);
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
  });

  it('gives the focused filter its own named listbox inside the named popup', async () => {
    const el = await create();
    const field = await openSearch(el);
    const popup = el.shadowRoot!.getElementById(trigger(el).getAttribute('aria-controls')!);
    const listbox = el.shadowRoot!.getElementById(field.getAttribute('aria-controls')!);
    expect(popup?.getAttribute('role')).to.equal('dialog');
    expect(popup?.getAttribute('aria-label')).to.equal('Language');
    expect(trigger(el).getAttribute('aria-haspopup')).to.equal('dialog');
    expect(field.getAttribute('role')).to.equal('combobox');
    expect(field.getAttribute('aria-label')).to.equal('Search languages');
    expect(field.getAttribute('placeholder')).to.equal('Search languages');
    expect(field.getAttribute('aria-expanded')).to.equal('true');
    expect(listbox?.getAttribute('role')).to.equal('listbox');
    expect(listbox?.getAttribute('aria-label')).to.equal('Language');
    expect(popup?.id === listbox?.id).to.equal(false);
    expect(field.closest('[role="listbox"]') === null).to.equal(true);
    expect(tags(el)).to.deep.equal(CATALOG);
    await expect(el).to.be.accessible();
  });

  it('matches tags, native names, localized language names and caller labels without committing', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-locale-picker searchable locale="fr"
      name="language" value="en" .locales=${[
        { tag: 'en', label: 'Workspace language' }, { tag: 'de' },
        { tag: 'es', label: 'Café central' }, { tag: 'pt-BR' }, { tag: 'not_a_locale', label: 'Custom entry' },
      ]}></lr-locale-picker></form>`);
    const el = form.querySelector<LyraLocalePicker>('lr-locale-picker')!;
    let events = 0;
    let loads = 0;
    for (const name of ['lr-change-request', 'lr-change', 'lr-input', 'input', 'change']) {
      el.addEventListener(name, () => { events++; });
    }
    el.localeLoader = async () => { loads++; };
    await openSearch(el);
    for (const [query, expected] of [
      [' ENG ', 'en'], ['allemand', 'de'], ['cafe', 'es'], ['PT-br', 'pt-BR'], ['not_a_', 'not_a_locale'],
    ]) {
      await filter(el, query!);
      expect(tags(el)).to.deep.equal([expected]);
      expect(activeTag(el)).to.equal(expected);
    }
    expect(el.value).to.equal('en');
    expect(new FormData(form).get('language')).to.equal('en');
    expect(getLyraLocale()).to.equal('en');
    expect(events).to.equal(0);
    expect(loads).to.equal(0);
    await filter(el, '  ');
    expect(tags(el).length).to.equal(5);
  });

  it('keeps text editing native and uses arrows and Enter only for visible matches', async () => {
    const el = await create();
    const field = await openSearch(el);
    await sendKeys({ type: 'eng' });
    expect(tags(el)).to.deep.equal(['en']);
    await sendKeys({ press: 'Space' });
    expect(field.value).to.equal('eng ');
    expect(el.open).to.equal(true);
    expect(el.value).to.equal('en');
    await filter(el, '');
    await sendKeys({ press: 'ArrowDown' });
    expect(activeTag(el)).to.equal('fr');
    await sendKeys({ press: 'ArrowUp' });
    expect(activeTag(el)).to.equal('en');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.value).to.equal('fr');
    expect(getLyraLocale()).to.equal('fr');
    expect(el.open).to.equal(false);
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
    expect(input(el).value).to.equal('');
  });

  it('matches Turkish dotted letters before stripping accents', async () => {
    const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker searchable locale="tr"
      .locales=${['en', 'de']}></lr-locale-picker>`);
    await openSearch(el);
    await filter(el, 'ing');
    expect(tags(el)).to.deep.equal(['en']);
    expect(el.value).to.equal('');
  });

  it('retains native names and caller labels if localized names are unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')!;
    try {
      Object.defineProperty(Intl, 'DisplayNames', { configurable: true, value: undefined });
      // A distinct valid locale avoids any previously cached language-name formatter.
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker searchable locale="en-x-picker-fallback"
        .locales=${[{ tag: 'en', label: 'Workspace' }, { tag: 'de', label: 'Second choice' }]}></lr-locale-picker>`);
      await openSearch(el);
      await filter(el, 'eng');
      expect(tags(el)).to.deep.equal(['en']);
      await filter(el, 'second');
      expect(tags(el)).to.deep.equal(['de']);
    } finally {
      Object.defineProperty(Intl, 'DisplayNames', descriptor);
    }
  });

  it('exposes the native filter and reactively forwards editing assistance', async () => {
    const el = await create();
    await openSearch(el);
    expect(el.input === input(el)).to.equal(true);
    expect(el.spellcheck).to.equal(false);
    expect(el.autocorrect).to.equal(true);
    el.autocomplete = 'language';
    el.inputMode = 'search';
    el.enterKeyHint = 'search';
    el.spellcheck = true;
    el.autocapitalize = 'words';
    el.autocorrect = false;
    await el.updateComplete;
    expect(input(el).autocomplete).to.equal('language');
    expect(input(el).inputMode).to.equal('search');
    expect(input(el).enterKeyHint).to.equal('search');
    expect(input(el).spellcheck).to.equal(true);
    expect(input(el).autocapitalize).to.equal('words');
    expect(input(el).getAttribute('autocorrect')).to.equal('off');
    el.setAttribute('spellcheck', 'true');
    await el.updateComplete;
    el.removeAttribute('spellcheck');
    el.setAttribute('autocorrect', 'off');
    await el.updateComplete;
    el.removeAttribute('autocorrect');
    await el.updateComplete;
    expect(el.spellcheck).to.equal(false);
    expect(input(el).spellcheck).to.equal(false);
    expect(el.autocorrect).to.equal(true);
    expect(input(el).getAttribute('autocorrect')).to.equal('on');
    el.input!.value = 'de';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(tags(el)).to.deep.equal(['de']);
    expect(el.value).to.equal('en');
    el.searchable = false;
    await el.updateComplete;
    expect(el.input === null).to.equal(true);
  });

  it('starts printable trigger input as a query and never commits an IME Enter', async () => {
    const el = await create();
    let changes = 0;
    el.addEventListener('lr-change', () => { changes++; });
    await focusByKeyboard(trigger(el));
    await sendKeys({ type: 'f' });
    await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'search-input');
    expect(input(el).value).to.equal('f');
    expect(tags(el)).to.deep.equal(['fr']);
    input(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true }));
    input(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.value).to.equal('en');
    expect(el.open).to.equal(true);
    expect(changes).to.equal(0);
  });

  it('keeps internal focus moves pristine and lets public blur leave the focused filter', async () => {
    const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker searchable required
      spellcheck="true" autocapitalize="words" autocorrect="on" .locales=${CATALOG}></lr-locale-picker>`);
    let focuses = 0;
    let blurs = 0;
    el.addEventListener('focus', () => { focuses++; });
    el.addEventListener('blur', () => { blurs++; });
    await openSearch(el);
    expect(focuses).to.equal(1);
    expect(blurs).to.equal(0);
    expect(el.matches(':state(user-invalid)')).to.equal(false);
    expect(input(el).getAttribute('spellcheck')).to.equal('true');
    expect(input(el).getAttribute('autocapitalize')).to.equal('words');
    expect(input(el).getAttribute('autocorrect')).to.equal('on');
    await sendKeys({ press: 'Shift+Tab' });
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
    expect(el.open).to.equal(true);
    expect(blurs).to.equal(0);
    await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
    el.blur();
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect(blurs).to.equal(1);
    expect(el.matches(':state(user-invalid)')).to.equal(true);
    expect(input(el).disabled).to.equal(true);
    expect(input(el).tabIndex).to.equal(-1);
  });

  it('renders the unregistered English empty fallback without focusing on programmatic open', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button id="keep-focus">Keep focus</button>
      <lr-locale-picker searchable locale="en" .locales=${[]}></lr-locale-picker></div>`);
    const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
    await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#keep-focus')!);
    el.open = true;
    await el.updateComplete;
    expect(document.activeElement?.id).to.equal('keep-focus');
    expect(el.shadowRoot!.querySelector('[part="empty"]')?.textContent).to.equal('No matching languages.');
  });

  it('localizes empty results, retains the query on Enter and restores focus on Escape', async () => {
    const el = await create();
    el.strings = { localePickerSearchLabel: 'Rechercher une langue', localePickerEmpty: 'Aucune langue correspondante.' };
    await openSearch(el);
    expect(input(el).getAttribute('aria-label')).to.equal('Rechercher une langue');
    await sendKeys({ type: 'zzzz' });
    await el.updateComplete;
    expect(tags(el)).to.deep.equal([]);
    expect(input(el).getAttribute('aria-activedescendant')).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="empty"]')?.textContent).to.equal('Aucune langue correspondante.');
    expect(el.shadowRoot!.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length).to.equal(0);
    await expect(el).to.be.accessible();
    await sendKeys({ press: 'Enter' });
    expect(el.open).to.equal(true);
    expect(el.value).to.equal('en');
    expect(input(el).value).to.equal('zzzz');
    await sendKeys({ press: 'Escape' });
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
    await openSearch(el);
    expect(input(el).value).to.equal('');
    expect(tags(el)).to.deep.equal(CATALOG);
  });

  it('allows Tab to leave and does not reclaim an external focus move while opening', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-locale-picker searchable
      .locales=${CATALOG}></lr-locale-picker><button id="after-picker">Next</button></div>`);
    const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
    const next = wrapper.querySelector<HTMLButtonElement>('#after-picker')!;
    await openSearch(el);
    await sendKeys({ press: 'Tab' });
    await el.updateComplete;
    expect(document.activeElement?.id).to.equal('after-picker');
    expect(el.open).to.equal(false);
    await focusByKeyboard(trigger(el));
    el.click();
    // An application intentionally transfers focus during the opening turn.
    next.focus();
    await el.updateComplete;
    await Promise.resolve();
    expect(document.activeElement?.id).to.equal('after-picker');
  });

  it('keeps selection veto and asynchronous loading on the existing commit path', async () => {
    const el = await create();
    const veto = (event: Event) => event.preventDefault();
    let loads = 0;
    let resolve!: () => void;
    const pending = new Promise<void>(done => { resolve = done; });
    el.localeLoader = () => { loads++; return pending; };
    el.addEventListener('lr-change-request', veto);
    await openSearch(el);
    await sendKeys({ type: 'fr' });
    await sendKeys({ press: 'Enter' });
    expect(el.open).to.equal(true);
    expect(input(el).value).to.equal('fr');
    expect(el.value).to.equal('en');
    expect(loads).to.equal(0);
    el.removeEventListener('lr-change-request', veto);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => loads === 1);
    expect(el.value).to.equal('en');
    expect(getLyraLocale()).to.equal('en');
    await filter(el, 'eng');
    resolve();
    await waitUntil(() => el.value === 'fr');
    expect(getLyraLocale()).to.equal('fr');
    expect(el.open).to.equal(false);
    expect(input(el).value).to.equal('');
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
  });

  for (const dismiss of ['Escape', 'Tab']) {
    it(`does not cancel an accepted load when a later ${dismiss} closes the filter`, async () => {
      const el = await create();
      let resolve!: () => void;
      let started = false;
      const pending = new Promise<void>(done => { resolve = done; });
      el.localeLoader = () => { started = true; return pending; };
      await openSearch(el);
      await sendKeys({ type: 'fr' });
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => started);
      await filter(el, 'zzzz');
      await sendKeys({ press: dismiss });
      await el.updateComplete;
      expect(el.open).to.equal(false);
      resolve();
      await waitUntil(() => el.value === 'fr');
      expect(getLyraLocale()).to.equal('fr');
      expect(input(el).value).to.equal('');
    });
  }

  it('allows Tab to reach Retry while preserving the open query', async () => {
    const el = await create();
    el.localeLoader = () => Promise.reject(new Error('not rendered'));
    await openSearch(el);
    await sendKeys({ type: 'fr' });
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.shadowRoot!.querySelector('[part="load-retry"]') !== null);
    await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('load-retry');
    expect(el.open).to.equal(true);
    expect(input(el).value).to.equal('fr');
  });

  for (const asynchronous of [false, true]) {
    it(`preserves a host focus transfer from the ${asynchronous ? 'asynchronous' : 'synchronous'} change notification`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div><lr-locale-picker searchable value="en"
        .locales=${CATALOG}></lr-locale-picker><button id="change-target">Host target</button></div>`);
      const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
      if (asynchronous) el.localeLoader = async () => undefined;
      el.addEventListener('lr-change', () => {
        wrapper.querySelector<HTMLButtonElement>('#change-target')!.focus();
      });
      await openSearch(el);
      await sendKeys({ type: 'fr' });
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => el.value === 'fr');
      expect(document.activeElement?.id).to.equal('change-target');
    });
  }

  it('accepts a real pointer row while the search field holds focus', async () => {
    const el = await create();
    await openSearch(el);
    await sendKeys({ type: 'fr' });
    await settlePointer();
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!;
    const bounds = row.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)] });
    await waitUntil(() => el.value === 'fr');
    expect(el.open).to.equal(false);
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
  });

  for (const action of ['close', 'disabled', 'fieldset', 'reset', 'reconnect', 'mode-off'] as const) {
    it(`clears the private query after ${action} without a selection event`, async () => {
      const wrapper = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-locale-picker searchable
        value="en" .locales=${CATALOG}></lr-locale-picker></fieldset>`);
      const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
      let changes = 0;
      el.addEventListener('lr-change', () => { changes++; });
      await openSearch(el);
      await sendKeys({ type: 'fr' });
      if (action === 'close') el.open = false;
      if (action === 'disabled') { el.disabled = true; el.disabled = false; }
      if (action === 'fieldset') { wrapper.disabled = true; await el.updateComplete; wrapper.disabled = false; }
      if (action === 'reset') el.formResetCallback();
      if (action === 'reconnect') { el.remove(); wrapper.appendChild(el); }
      if (action === 'mode-off') { el.searchable = false; await el.updateComplete; el.searchable = true; }
      await el.updateComplete;
      if (!el.open) await openSearch(el);
      expect(input(el).value).to.equal('');
      expect(tags(el)).to.deep.equal(CATALOG);
      expect(el.value).to.equal('en');
      expect(changes).to.equal(0);
    });
  }

  it('keeps active ownership valid when filtered catalogs shrink and locale names change', async () => {
    const el = await create();
    await openSearch(el);
    await filter(el, 'en');
    expect(tags(el)).to.deep.equal(['en', 'fr']);
    await sendKeys({ press: 'ArrowDown' });
    el.locales = ['ja'];
    await el.updateComplete;
    expect(input(el).getAttribute('aria-activedescendant')).to.equal(null);
    el.locales = ['de'];
    el.locale = 'fr';
    await filter(el, 'allemand');
    expect(tags(el)).to.deep.equal(['de']);
    expect(activeTag(el)).to.equal('de');
    expect(input(el).getAttribute('aria-controls')).to.equal(el.shadowRoot!.querySelector('[role="listbox"]')?.id);
  });

  it('recomputes localized names after an inherited language change', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div lang="en"><lr-locale-picker searchable
      .locales=${['de']}></lr-locale-picker></div>`);
    const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
    await openSearch(el);
    await filter(el, 'german');
    expect(tags(el)).to.deep.equal(['de']);
    wrapper.lang = 'fr';
    await waitUntil(() => tags(el).length === 0);
    expect(input(el).getAttribute('aria-activedescendant')).to.equal(null);
    await filter(el, 'allemand');
    expect(tags(el)).to.deep.equal(['de']);
  });

  for (const direction of ['ltr', 'rtl']) {
    it(`retains comfortable filtered rows and bounded top-layer search in a narrow ${direction} viewport`, async () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      try {
        await setViewport({ width: 320, height: 480 });
        const wrapper = await fixture<HTMLDivElement>(html`<div dir=${direction} style="max-inline-size:100%">
          <lr-locale-picker searchable top-layer trigger-display="flag" option-display="label"
            size="2xs" style="font-size:12px" .locales=${CATALOG}></lr-locale-picker>
        </div>`);
        const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
        await openSearch(el);
        await filter(el, 'fr');
        const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!;
        expect(row.getBoundingClientRect().height).to.be.at.least(48);
        expect(getComputedStyle(input(el)).textAlign).to.equal('start');
        const popup = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
        await waitUntil(() => popup.getBoundingClientRect().left >= -1 && popup.getBoundingClientRect().right <= 321);
        expect(input(el).scrollWidth).to.be.at.most(input(el).clientWidth + 1);
        await expect(el).to.be.accessible();
      } finally {
        await setViewport(viewport);
      }
    });
  }
});
