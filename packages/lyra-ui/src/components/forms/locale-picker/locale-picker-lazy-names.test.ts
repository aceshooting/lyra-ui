import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './locale-picker.js';
import type { LyraLocalePicker, LyraLocaleChangeDetail } from './locale-picker.js';
import { localeNativeName } from '../../media/flag/language-map.js';

// The shared Intl cache would answer a repeated tag from an earlier construction and hide a
// regression from the spy, so every test (and every retried attempt of one) uses tags carrying a
// fresh private-use suffix that nothing else in the page has resolved.
let attempt = 0;
beforeEach(() => { attempt += 1; });
const fresh = (tag: string): string => `${tag}-x-lazy${attempt}`;

interface DisplayNamesSpy {
  /** Locales passed to every `type: 'language'` construction, in order. */
  readonly languages: string[];
  restore(): void;
}

function spyLanguageDisplayNames(): DisplayNamesSpy {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')!;
  const Original = Intl.DisplayNames;
  const languages: string[] = [];
  class SpyDisplayNames extends Original {
    constructor(locales: Intl.LocalesArgument, options: Intl.DisplayNamesOptions) {
      super(locales, options);
      if (options?.type === 'language') languages.push(String(Array.isArray(locales) ? locales[0] : locales));
    }
  }
  Object.defineProperty(Intl, 'DisplayNames', { ...descriptor, value: SpyDisplayNames });
  return { languages, restore: () => Object.defineProperty(Intl, 'DisplayNames', descriptor) };
}

async function withSpy(body: (spy: DisplayNamesSpy) => Promise<void>): Promise<void> {
  const spy = spyLanguageDisplayNames();
  try {
    await body(spy);
  } finally {
    spy.restore();
  }
}

function triggerLabel(el: LyraLocalePicker): string {
  return el.shadowRoot!.querySelector('[part="trigger-label"]')!.textContent!.trim();
}

function optionLabels(el: LyraLocalePicker): string[] {
  return [...el.shadowRoot!.querySelectorAll('[part="option-label"] > span:first-child')]
    .map((node) => node.textContent!.trim());
}

async function openAndSettle(el: LyraLocalePicker): Promise<void> {
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="option"]').length > 0);
}

describe('lr-locale-picker lazy native names', () => {
  it('resolves only the trigger locale while closed and the remaining rows on open', async () => {
    const [sv, pt, fi] = ['sv-SE', 'pt-PT', 'fi-FI'].map(fresh) as [string, string, string];
    let names: string[] = [];
    let trigger = '';
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${pt}
        .locales=${[sv, pt, fi]}></lr-locale-picker>`);
      trigger = triggerLabel(el);
      expect(spy.languages, 'closed first render').to.deep.equal([pt]);
      await openAndSettle(el);
      expect([...spy.languages].sort(), 'opened listbox').to.deep.equal([fi, pt, sv]);
      names = optionLabels(el);
      el.open = false;
      await el.updateComplete;
      await openAndSettle(el);
      expect(spy.languages, 'reopening reuses resolved names').to.have.length(3);
    });
    expect(trigger).to.equal(localeNativeName(pt));
    expect(names).to.deep.equal([sv, pt, fi].map(localeNativeName));
  });

  it('constructs no language names when every row supplies its label', async () => {
    const [nl, el2] = ['nl-BE', 'el-GR'].map(fresh) as [string, string];
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${nl}
        .locales=${[{ tag: nl, label: 'Vlaams' }, { tag: el2, label: 'Greek' }]}></lr-locale-picker>`);
      expect(triggerLabel(el)).to.equal('Vlaams');
      expect(spy.languages, 'closed first render').to.deep.equal([]);
      await openAndSettle(el);
      expect(optionLabels(el)).to.deep.equal(['Vlaams', 'Greek']);
      expect(spy.languages, 'opened listbox').to.deep.equal([]);
    });
  });

  it('resolves only the unlabelled trigger row in a mixed catalog', async () => {
    const [cs, hu, ro] = ['cs-CZ', 'hu-HU', 'ro-RO'].map(fresh) as [string, string, string];
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${cs}
        .locales=${[cs, { tag: hu, label: 'Magyar (beta)' }, ro]}></lr-locale-picker>`);
      expect(spy.languages).to.deep.equal([cs]);
      await openAndSettle(el);
      expect([...spy.languages].sort()).to.deep.equal([cs, ro]);
      expect(optionLabels(el)[1]).to.equal('Magyar (beta)');
    });
  });

  it('survives rapid open/close without resolving names for a listbox that never renders', async () => {
    const catalog = ['sk-SK', 'sl-SI', 'hr-HR'].map(fresh);
    let labels: string[] = [];
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${catalog[0]!}
        .locales=${catalog}></lr-locale-picker>`);
      for (let i = 0; i < 5; i += 1) {
        el.open = true;
        el.open = false;
      }
      await el.updateComplete;
      expect(spy.languages, 'net-closed toggles').to.deep.equal([catalog[0]]);
      await openAndSettle(el);
      el.open = false;
      el.open = true;
      await el.updateComplete;
      labels = optionLabels(el);
      expect(spy.languages).to.have.length(3);
    });
    expect(labels).to.deep.equal(catalog.map(localeNativeName));
  });

  it('resolves only the newly shown locale when the value changes while closed', async () => {
    const [bg, uk, lt] = ['bg-BG', 'uk-UA', 'lt-LT'].map(fresh) as [string, string, string];
    let trigger = '';
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${bg}
        .locales=${[bg, uk, lt]}></lr-locale-picker>`);
      el.value = lt;
      await el.updateComplete;
      trigger = triggerLabel(el);
      expect(spy.languages).to.deep.equal([bg, lt]);
    });
    expect(trigger).to.equal(localeNativeName(lt));
  });

  it('keeps resolved names across reconnect and resolves the rest on the next open', async () => {
    const catalog = ['lv-LV', 'et-EE'].map(fresh);
    let labels: string[] = [];
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${catalog[0]!}
        .locales=${catalog}></lr-locale-picker>`);
      const parent = el.parentNode!;
      el.remove();
      parent.appendChild(el);
      await el.updateComplete;
      expect(spy.languages, 'closed reconnect').to.deep.equal([catalog[0]]);
      await openAndSettle(el);
      labels = optionLabels(el);
      expect([...spy.languages].sort()).to.deep.equal([...catalog].sort());
    });
    expect(labels).to.deep.equal(catalog.map(localeNativeName));
  });

  it('falls back to the literal tag for unknown or malformed tags only when they are shown', async () => {
    const catalog = [fresh('ga-IE'), fresh('qqq'), 'not a tag'];
    let labels: string[] = [];
    await withSpy(async (spy) => {
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value=${catalog[0]!}
        .locales=${catalog}></lr-locale-picker>`);
      expect(spy.languages).to.deep.equal([catalog[0]]);
      await openAndSettle(el);
      labels = optionLabels(el);
    });
    expect(labels).to.deep.equal(catalog.map(localeNativeName));
    expect(labels[2]).to.equal('not a tag');
  });

  it('closed typeahead still matches rows by their lazily resolved names', async () => {
    const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags value="da-DK"
      .locales=${['da-DK', 'is-IS', 'nb-NO']}></lr-locale-picker>`);
    const requests: string[] = [];
    el.addEventListener('lr-change-request', (event) => {
      requests.push((event as CustomEvent<LyraLocaleChangeDetail>).detail.value);
      event.preventDefault();
    });
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!);
    const initial = localeNativeName('nb-NO').charAt(0);
    await sendKeys({ press: initial });
    expect(requests).to.deep.equal(['nb-NO']);
    expect(el.value).to.equal('da-DK');
  });
});
