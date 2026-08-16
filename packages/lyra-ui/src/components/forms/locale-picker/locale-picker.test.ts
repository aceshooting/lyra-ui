import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './locale-picker.js';
import '../../../translations/fa.js';
import '../../../translations/he.js';
import type { LyraLocalePicker } from './locale-picker.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getRegisteredLyraLocales, registerLyraLocale, setLyraLocale, getLyraLocale } from '../../../internal/localization.js';
import { localeNativeName } from '../../media/flag/language-map.js';
import { setForcedColors } from "../../../../test/wtr-media.js";

function trigger(el: LyraLocalePicker): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function rows(el: LyraLocalePicker): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

it('rejects direct open writes while disabled or synchronously fieldset-disabled', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset><lr-locale-picker .locales=${['en', 'fr']}></lr-locale-picker></fieldset>
  `);
  const el = fieldset.querySelector('lr-locale-picker') as LyraLocalePicker;
  el.disabled = true;
  el.open = true;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;

  el.disabled = false;
  fieldset.disabled = true;
  el.setAttribute('open', '');
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
});

it("restores its declared size default when the attribute is removed", async () => {
  const el = (await fixture(
    html`<lr-locale-picker size="xl"></lr-locale-picker>`
  )) as LyraLocalePicker;
  el.removeAttribute("size");
  await el.updateComplete;
  expect(el.size).to.equal("m");
});

it("keeps active and selected options visually distinct in forced-colors mode", async () => {
  await setForcedColors("active");
  try {
    const el = (await fixture(html`
      <lr-locale-picker value="en" .locales=${["en", "fr"]}></lr-locale-picker>
    `)) as LyraLocalePicker;
    el.open = true;
    await el.updateComplete;
    const [selected, active] = rows(el);
    active!.setAttribute("data-active", "");

    expect(getComputedStyle(selected!).borderStyle).to.equal("double");
    expect(getComputedStyle(active!).outlineStyle).to.equal("dashed");
  } finally {
    await setForcedColors("none");
  }
});

it('inherits public trigger geometry from an ancestor across a size tier', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-locale-picker-trigger-padding: 7px 11px; --lr-locale-picker-trigger-min-height: 49px; --lr-locale-picker-font-size: 18px; --lr-locale-picker-expand-size: 22px; --lr-locale-picker-gap: 13px; --lr-locale-picker-radius: 17px">
      <lr-locale-picker size="2xs" .locales=${['en', 'fr']}></lr-locale-picker>
    </div>
  `);
  const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
  await el.updateComplete;
  const button = trigger(el);
  const computed = getComputedStyle(button);
  expect(computed.paddingTop).to.equal('7px');
  expect(computed.paddingInlineStart).to.equal('11px');
  expect(computed.minBlockSize).to.equal('49px');
  expect(computed.fontSize).to.equal('18px');
  expect(computed.gap).to.equal('13px');
  expect(computed.borderTopLeftRadius).to.equal('17px');
  const expand = el.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
  expect(getComputedStyle(expand).minInlineSize).to.equal('22px');
});

it('inherits the theme-wide form-control radius at a compact size tier', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-theme-form-control-radius: 17px">
      <lr-locale-picker size="xs" .locales=${['en', 'fr']}></lr-locale-picker>
    </div>
  `);
  const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
  await el.updateComplete;
  expect(getComputedStyle(trigger(el)).borderTopLeftRadius).to.equal('17px');
});

it('uses the scoped selected-option font weight inherited from an ancestor', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-locale-picker-option-selected-font-weight: 350">
      <lr-locale-picker value="fr" .locales=${['en', 'fr']}></lr-locale-picker>
    </div>
  `);
  const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][aria-selected="true"]')!;
  expect(getComputedStyle(selected).fontWeight).to.equal('350');
});

// -- Baseline rendering / form participation --------------------------------

it('renders a trigger button and a closed listbox by default', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  expect(trigger(el) != null).to.equal(true);
  expect(el.open).to.be.false;
});

it('opens the listbox by clicking the trigger, and closes it by clicking again', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('disabled prevents opening and reflects the attribute', async () => {
  const el = (await fixture(
    html`<lr-locale-picker disabled .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  expect(el.hasAttribute('disabled')).to.be.true;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('participates in native form submission via name/value', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-locale-picker name="locale" value="fr" .locales=${['fr', 'de']}></lr-locale-picker>
    </form>
  `);
  const data = new FormData(form);
  expect(data.get('locale')).to.equal('fr');
});

it('formResetCallback restores the value-attribute default', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-locale-picker name="locale" value="fr" .locales=${['fr', 'de']}></lr-locale-picker>
    </form>
  `);
  const el = form.querySelector('lr-locale-picker') as LyraLocalePicker;
  el.value = 'de';
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('fr');
});

it('relays trigger blur/focus once as native FocusEvents with relatedTarget, and never lr-focus/lr-blur', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const outside = document.createElement('button');
  const aliases: string[] = [];
  el.addEventListener('lr-focus', () => aliases.push('lr-focus'));
  el.addEventListener('lr-blur', () => aliases.push('lr-blur'));

  const focusEvent = oneEvent(el, 'focus');
  trigger(el).dispatchEvent(new FocusEvent('focus', { relatedTarget: outside }));
  const focus = await focusEvent;
  expect(focus instanceof FocusEvent).to.be.true;
  expect(focus.relatedTarget === outside).to.be.true;
  const blurEvent = oneEvent(el, 'blur');
  trigger(el).dispatchEvent(new FocusEvent('blur', { relatedTarget: outside }));
  const blur = await blurEvent;
  expect(blur instanceof FocusEvent).to.be.true;
  expect(blur.relatedTarget === outside).to.be.true;
  // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
  expect(aliases).to.deep.equal([]);
});

it('click()/focus()/blur() forward to the internal trigger', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  el.open = false;
  await el.updateComplete;

  // Compare a derived primitive, never the DOM node itself, as chai's actual/expected -- a
  // failing DOM-node assertion hangs the whole file under wtr (see docs/agents/testing.md).
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.be.true;
});

it('suppresses host focus/click in the same task that fieldset disablement starts', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset><lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker></fieldset>
  `);
  const el = fieldset.querySelector('lr-locale-picker') as LyraLocalePicker;
  fieldset.disabled = true;
  el.focus();
  el.click();
  expect(el.shadowRoot!.activeElement === null).to.be.true;
  expect(el.open).to.be.false;
});

// -- Registry export behavior is covered by localization.test.ts;
//    obligations below map to this component's own contract. --------------

// An unset locales catalog matches getRegisteredLyraLocales() and updates live.
it('with locales unset, the offered list matches getRegisteredLyraLocales and updates live when a new locale registers', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const before = getRegisteredLyraLocales();
  expect(rows(el).length).to.equal(before.length);

  registerLyraLocale('x-locale-picker-live-test', { noData: 'test' });
  await el.updateComplete;
  const after = getRegisteredLyraLocales();
  expect(after.length).to.equal(before.length + 1);
  expect(rows(el).length).to.equal(after.length);
});

// An explicit `locales` catalog overrides auto-discovery entirely, in both forms.
it('locales set as a plain string[] overrides the auto-discovered list', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  expect(rows(el).length).to.equal(2);
  expect(rows(el)[0].dataset.value).to.equal('fr');
  expect(rows(el)[1].dataset.value).to.equal('de');
});

it('treats an explicit empty locale catalog as authoritative and undefined as automatic', async () => {
  const el = await fixture<LyraLocalePicker>(html`
    <lr-locale-picker .locales=${[]}></lr-locale-picker>
  `);
  el.open = true;
  await el.updateComplete;
  expect(rows(el)).to.have.length(0);

  el.locales = undefined;
  await el.updateComplete;
  expect(rows(el).length).to.equal(getRegisteredLyraLocales().length);
});

it('owns a bounded readonly snapshot of an explicit locale catalog', async () => {
  const source = [{ tag: 'fr', label: 'Français' }];
  const el = await fixture<LyraLocalePicker>(html`
    <lr-locale-picker .locales=${source}></lr-locale-picker>
  `);
  el.open = true;
  await el.updateComplete;
  source[0]!.label = 'Forged';
  source.push({ tag: 'de', label: 'Deutsch' });
  expect(el.locales).to.deep.equal([{ tag: 'fr', label: 'Français' }]);
  expect(Object.isFrozen(el.locales)).to.be.true;
  expect(Object.isFrozen(el.locales![0])).to.be.true;
  expect(rows(el)).to.have.length(1);
  expect(rows(el)[0]!.textContent).to.contain('Français');
});

it('locales set as {tag,label}[] overrides the auto-discovered list and honors a custom label', async () => {
  const el = (await fixture(
    html`<lr-locale-picker
      .locales=${[{ tag: 'fr', label: 'Français (bientôt)' }, { tag: 'de' }]}
    ></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  expect(rows(el)[0].textContent).to.contain('Français (bientôt)');
  expect(rows(el)[1].dataset.value).to.equal('de');
  expect(rows(el)[1].textContent).to.contain(localeNativeName('de'));
});

// Each row includes its flag, native name, and tag; showFlags=false omits the flag entirely.
it('shows a flag, native name, and tag per row when showFlags is on (the default)', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const row = rows(el)[0];
  expect(row.querySelector('lr-flag')).to.exist;
  expect(row.textContent).to.contain(localeNativeName('fr'));
  expect(row.textContent).to.contain('fr');
});

it('renders Persian and Hebrew regional entries with native names and derived regional flags', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fa-IR', 'he-IL']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;

  const offered = [...rows(el)];
  expect(offered.map((row) => row.dataset.value)).to.deep.equal(['fa-IR', 'he-IL']);
  expect(offered[0].textContent).to.contain(localeNativeName('fa-IR'));
  expect(offered[1].textContent).to.contain(localeNativeName('he-IL'));
  expect((offered[0].querySelector('lr-flag') as HTMLElement).getAttribute('language')).to.equal('fa-IR');
  expect((offered[1].querySelector('lr-flag') as HTMLElement).getAttribute('language')).to.equal('he-IL');
});

it('auto-discovers imported Persian and Hebrew catalogs', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const offered = [...rows(el)].map((row) => row.dataset.value);
  expect(offered).to.include('fa');
  expect(offered).to.include('he');
});

it('uses the Persian and Hebrew catalog labels through regional fallback', async () => {
  const persian = (await fixture(
    html`<lr-locale-picker locale="fa-IR" .locales=${['fa', 'he']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const hebrew = (await fixture(
    html`<lr-locale-picker locale="he-IL" .locales=${['fa', 'he']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  expect(trigger(persian).getAttribute('aria-label')).to.equal('زبان');
  expect(trigger(hebrew).getAttribute('aria-label')).to.equal('שפה');
});

it('showFlags=false omits the flag element entirely, not just visually', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr']} .showFlags=${false}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  // .length (a number), never the queried node itself, as chai's actual -- see the
  // click()/focus()/blur() test above for why a failing DOM-node assertion hangs the file.
  expect(rows(el)[0].querySelectorAll('lr-flag').length).to.equal(0);
});

it("a locales entry with country overrides that row's flag; a row without it keeps deriving from the tag", async () => {
  const el = (await fixture(
    html`<lr-locale-picker
      .locales=${[
        { tag: 'ar', country: 'lb' },
        { tag: 'fr' },
      ]}
    ></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;

  const arFlag = rows(el)[0].querySelector('lr-flag') as HTMLElement;
  expect(arFlag.getAttribute('country')).to.equal('lb');
  expect(arFlag.hasAttribute('language')).to.be.false;

  const frFlag = rows(el)[1].querySelector('lr-flag') as HTMLElement;
  expect(frFlag.getAttribute('language')).to.equal('fr');
  expect(frFlag.hasAttribute('country')).to.be.false;
});

it('a plain string[] locales catalog never emits a country attribute', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['ar']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const flag = rows(el)[0].querySelector('lr-flag') as HTMLElement;
  expect(flag.getAttribute('language')).to.equal('ar');
  expect(flag.hasAttribute('country')).to.be.false;
});

it("shows the current value's flag in the trigger, not just in the open listbox", async () => {
  const el = (await fixture(
    html`<lr-locale-picker value="fr" .locales=${['en', 'fr']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const flag = trigger(el).querySelector('lr-flag') as HTMLElement;
  expect(flag != null).to.equal(true);
  expect(flag.getAttribute('language')).to.equal('fr');
});

it("trigger flag honors a locales entry's country override, same as the row does", async () => {
  const el = (await fixture(
    html`<lr-locale-picker value="ar" .locales=${[{ tag: 'ar', country: 'lb' }]}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const flag = trigger(el).querySelector('lr-flag') as HTMLElement;
  expect(flag.getAttribute('country')).to.equal('lb');
  expect(flag.hasAttribute('language')).to.be.false;
});

it('showFlags=false omits the trigger flag too, not just the row flags', async () => {
  const el = (await fixture(
    html`<lr-locale-picker value="fr" .locales=${['fr']} .showFlags=${false}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  expect(trigger(el).querySelectorAll('lr-flag').length).to.equal(0);
});

// Selecting a row commits value, fires lr-change, and applies setLyraLocale().
it('selecting a row updates value, fires lr-change with {value, previousValue}, and calls setLyraLocale', async () => {
  setLyraLocale('en');
  const el = (await fixture(
    html`<lr-locale-picker value="fr" .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;

  let detail:
    | { value: string; previousValue: string; direction: string } | undefined;
  el.addEventListener('lr-change', (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() => rows(el)[1].click());
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('de');
  expect(detail).to.deep.equal({ value: 'de', previousValue: 'fr', direction: 'ltr' });
  expect(getLyraLocale()).to.equal('de');
  setLyraLocale('en');
});

// The picked locale's writing direction travels with the pick, so a host applying `dir` to the
// page does not have to keep its own tag -> direction table.
it('reports the picked locale writing direction in lr-change detail', async () => {
  setLyraLocale('en');
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['he', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;

  let detail: { direction: string } | undefined;
  el.addEventListener('lr-change', (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() => rows(el)[0].click());
  await oneEvent(el, 'lr-change');
  expect(detail?.direction).to.equal('rtl');
  setLyraLocale('en');
});

// preventDefault() updates value but leaves the active locale untouched.
it('event.preventDefault() on lr-change updates value but leaves the active locale untouched', async () => {
  setLyraLocale('en');
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.addEventListener('lr-change', (e) => e.preventDefault());
  el.open = true;
  await el.updateComplete;

  setTimeout(() => rows(el)[0].click());
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('fr');
  expect(getLyraLocale()).to.equal('en');
});

// An unset value previews effectiveLocale, but required stays invalid until a real commit.
it('with value unset, the trigger previews effectiveLocale but required stays invalid until a real commit', async () => {
  // Pin the page-level locale explicitly -- effectiveLocale falls back to it, and other tests in
  // this file call setLyraLocale(), so this test does not rely on running after them in order.
  setLyraLocale('en');
  const el = (await fixture(
    html`<lr-locale-picker required .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(trigger(el).textContent).to.contain(localeNativeName('en'));
  expect(el.checkValidity()).to.be.false;

  el.open = true;
  await el.updateComplete;
  setTimeout(() => rows(el)[0].click());
  await oneEvent(el, 'lr-change');
  expect(el.checkValidity()).to.be.true;
});

it('the default English required-validation message is localized via this.localize(), not hardcoded', async () => {
  const el = (await fixture(
    html`<lr-locale-picker required .locales=${['fr']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  expect(el.validationMessage).to.equal('Please choose a language.');
});

// Keyboard navigation.
it('navigates with ArrowDown/ArrowUp and commits the active row with Enter', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('de');
});

it('Home/End jump to the first/last row', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('it');
});

it('scrolls Arrow, Home, End, typeahead, and replacement active rows into view safely', async () => {
  const catalog = Array.from({ length: 60 }, (_, index) => ({
    tag: `x-scroll-${index}`,
    label: index === 59 ? 'Zulu last locale' : `Locale ${String(index).padStart(2, '0')}`,
  }));
  const el = await fixture<LyraLocalePicker>(html`
    <lr-locale-picker .locales=${catalog} .showFlags=${false}></lr-locale-picker>
  `);
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(listbox.scrollTop).to.be.greaterThan(0);
  const endScrollTop = listbox.scrollTop;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(listbox.scrollTop).to.be.lessThan(endScrollTop);

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(listbox.scrollTop).to.be.greaterThan(0);

  el.locales = catalog.slice(0, 2);
  await el.updateComplete;
  expect(btn.getAttribute('aria-activedescendant')).to.equal(rows(el)[1]?.id);
  expect(listbox.scrollTop).to.be.at.least(0);

  el.remove();
  await Promise.resolve();
});

it('rehomes the active option immediately when an open locale catalog shrinks', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  el.locales = ['fr'];
  await el.updateComplete;

  const optionIds = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'), (row) => row.id);
  expect(optionIds).to.have.length(1);
  expect(btn.getAttribute('aria-activedescendant')).to.equal(optionIds[0]);
  expect(el.shadowRoot!.querySelectorAll('[part="option"][data-active]').length).to.equal(1);

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(btn.getAttribute('aria-activedescendant')).to.equal(optionIds[0]);
});

it('type-ahead by native-name first letter jumps the active row to the match while open', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);
  const firstLetter = localeNativeName('de').charAt(0);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: firstLetter, bubbles: true, cancelable: true }));
  await el.updateComplete;
  const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
  expect(active.dataset.value).to.equal('de');
});

it('Escape closes the listbox without changing value', async () => {
  const el = (await fixture(
    html`<lr-locale-picker value="fr" .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.value).to.equal('fr');
});

// Accessibility checks in closed and open states.
it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-locale-picker label="Language" .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await expect(el).to.be.accessible();
});

it('is accessible while open', async () => {
  const el = (await fixture(
    html`<lr-locale-picker label="Language" .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  // `[part='listbox']`'s opacity transition (gated by :host([open])) is still running right after
  // `open` is set and the update settles. Left running, axe's color-contrast check factors in the
  // listbox's current (transitional) opacity, so sampling mid-fade blends its text and background
  // toward each other and reports a false "serious" violation. Finishing it outright matches the
  // idiom overlay.test.ts already uses for this same kind of reveal animation.
  el.shadowRoot!.querySelector('[part="listbox"]')?.getAnimations().forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

// RTL fixture: logical layout with no accidental Left/Right remap.
it('mirrors row text-align via logical properties under dir="rtl", with no Left/Right remap added', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div dir="rtl" lang="fa-IR"><lr-locale-picker .locales=${['fa-IR', 'he-IL']}></lr-locale-picker></div>
  `);
  const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const option = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  expect(getComputedStyle(option).textAlign).to.equal('start');

  const btn = trigger(el);
  const before = el.value;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.value).to.equal(before);
});

it('applies size="2xs" with a 20px trigger min-height', async () => {
  const el = await fixture(html`<lr-locale-picker size="2xs"></lr-locale-picker>`);
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(triggerEl).minBlockSize).to.equal('20px');
});

it('reflects size="2xs" as a host attribute', async () => {
  const el = (await fixture(html`<lr-locale-picker size="2xs"></lr-locale-picker>`)) as LyraLocalePicker;
  expect(el.size).to.equal('2xs');
  expect(el.getAttribute('size')).to.equal('2xs');
});

it('renders the same trigger height at every tier as before the shared ladder', async () => {
  const expected: ReadonlyArray<readonly [string, string]> = [
    ['2xs', '20px'],
    ['xs', '24px'],
    ['s', '30px'],
    ['m', '40px'],
    ['l', '48px'],
    ['xl', '56px'],
  ];
  for (const [size, px] of expected) {
    const el = await fixture(html`<lr-locale-picker size=${size}></lr-locale-picker>`);
    const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(triggerEl).minBlockSize, `size=${size}`).to.equal(px);
  }
});

it('accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l', async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['small', 's'],
    ['medium', 'm'],
    ['large', 'l'],
  ];
  const box = (el: Element) => el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  for (const [alias, step] of pairs) {
    const aliasEl = await fixture(html`<lr-locale-picker size=${alias}></lr-locale-picker>`);
    const stepEl = await fixture(html`<lr-locale-picker size=${step}></lr-locale-picker>`);
    expect(getComputedStyle(box(aliasEl)).minBlockSize, `min-block-size for ${alias}`).to.equal(
      getComputedStyle(box(stepEl)).minBlockSize,
    );
    expect(getComputedStyle(box(aliasEl)).fontSize, `font-size for ${alias}`).to.equal(
      getComputedStyle(box(stepEl)).fontSize,
    );
    expect(box(aliasEl).getBoundingClientRect().height, `laid-out height for ${alias}`).to.equal(
      box(stepEl).getBoundingClientRect().height,
    );
  }
});

// Unset-property behavior.
it('unset (only locales, or nothing) renders deterministically with no other new property touched', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  expect(el.value).to.equal('');
  expect(el.required).to.be.false;
  expect(el.showFlags).to.be.true;
  expect(el.open).to.be.false;
  expect(el.size).to.equal('m');
  expect(el.disabled).to.be.false;
  expect(trigger(el) != null).to.equal(true);
});

// -- Attribute parsing, ElementInternals fallback/passthrough,
//    setter edge cases, form-state restoration, type-ahead edge cases, keyboard
//    edge cases, and aria/describedby wiring. -------------------------------

it('parses a plain show-flags="false" HTML attribute via fromAttribute, not just the .showFlags property', async () => {
  const el = (await fixture(
    html`<lr-locale-picker show-flags="false" .locales=${['fr']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  expect(el.showFlags).to.be.false;
  el.open = true;
  await el.updateComplete;
  expect(rows(el)[0].querySelectorAll('lr-flag').length).to.equal(0);
});

it('falls back to a no-op ElementInternals when attachInternals is unavailable', async () => {
  const proto = HTMLElement.prototype as unknown as { attachInternals: unknown;
  };
  const original = proto.attachInternals;
  proto.attachInternals = undefined;
  try {
    const el = document.createElement('lr-locale-picker') as LyraLocalePicker;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.form === null).to.be.true;
    expect(el.labels.length).to.equal(0);
    expect(el.willValidate).to.be.false;
    el.remove();
  } finally {
    proto.attachInternals = original;
  }
});

it('falls back to a no-op ElementInternals when attachInternals throws', async () => {
  const proto = HTMLElement.prototype as unknown as { attachInternals: () => ElementInternals;
  };
  const original = proto.attachInternals;
  proto.attachInternals = () => {
    throw new Error('simulated attachInternals failure');
  };
  try {
    const el = document.createElement('lr-locale-picker') as LyraLocalePicker;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.form === null).to.be.true;
    expect(el.checkValidity()).to.be.true;
    el.remove();
  } finally {
    proto.attachInternals = original;
  }
});

it('exposes form/labels/validity/willValidate via ElementInternals passthrough getters', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-locale-picker name="locale" .locales=${['fr', 'de']}></lr-locale-picker></form>
  `);
  const el = form.querySelector('lr-locale-picker') as LyraLocalePicker;
  expect(el.form === form).to.be.true;
  expect(el.labels.length).to.equal(0);
  expect(el.validity.valid).to.be.true;
  expect(el.willValidate).to.be.true;
});

it('name setter removes the attribute when cleared, and tolerates a null assignment', async () => {
  const el = (await fixture(html`<lr-locale-picker name="locale"></lr-locale-picker>`)) as LyraLocalePicker;
  expect(el.getAttribute('name')).to.equal('locale');
  el.name = '';
  // Checked synchronously (before any pending Lit update flush): the hand-written setter calls
  // removeAttribute() immediately. A later microtask can re-add it via Lit's own separate
  // reflect:true property-to-attribute sync (using the default string converter, unrelated to
  // this setter's own removeAttribute call), so this assertion intentionally does not await
  // updateComplete first.
  expect(el.hasAttribute('name')).to.be.false;

  (el as unknown as { name: string | null }).name = null;
  expect(el.name).to.equal('');
});

it('value setter tolerates a null assignment, normalizing to an empty string', async () => {
  const el = (await fixture(html`<lr-locale-picker value="fr"></lr-locale-picker>`)) as LyraLocalePicker;
  expect(el.value).to.equal('fr');
  (el as unknown as { value: string | null }).value = null;
  expect(el.value).to.equal('');
});

it('formStateRestoreCallback restores a string state and clears on a non-string state', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const restore = (
    el as unknown as { formStateRestoreCallback(state: string | File | FormData | null): void;
    }
  ).formStateRestoreCallback;
  restore.call(el, 'de');
  expect(el.value).to.equal('de');

  restore.call(el, null);
  expect(el.value).to.equal('');
});

it('reportValidity() delegates to the internal ElementInternals', async () => {
  const el = (await fixture(
    html`<lr-locale-picker required .locales=${['fr']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  expect(el.reportValidity()).to.be.false;
  el.value = 'fr';
  await el.updateComplete;
  expect(el.reportValidity()).to.be.true;
});

it('resets the type-ahead buffer once the debounce window elapses', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);
  const deFirstLetter = localeNativeName('de').charAt(0);
  const itFirstLetter = localeNativeName('it').charAt(0);

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: itFirstLetter, bubbles: true, cancelable: true }));
  await el.updateComplete;
  let active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
  expect(active.dataset.value).to.equal('it');

  await aTimeout(600); // let the debounce timer clear the buffer

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: deFirstLetter, bubbles: true, cancelable: true }));
  await el.updateComplete;
  active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
  // If the buffer had NOT been reset by the debounce timer, this keystroke would search for
  // "<i-letter><d-letter>" (no match) and the active row would stay on "it" instead of moving.
  expect(active.dataset.value).to.equal('de');
});

it('type-ahead while closed commits the matching row immediately', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const btn = trigger(el);
  const firstLetter = localeNativeName('de').charAt(0);
  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: firstLetter, bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('de');
});

it('type-ahead with no matching row leaves the active row unchanged', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="option"][data-active]') === null).to.be.true;
});

it('typeAhead no-ops defensively when there are no offered rows', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  Object.defineProperty(el, 'normalizedEntries', { get: () => [], configurable: true });
  expect(() => (el as unknown as { typeAhead(char: string): void }).typeAhead('a')).to.not.throw();
  expect(el.value).to.equal('');
});

it('show()/hide() are no-ops in already-settled states (open, disabled, or already closed)', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const api = el as unknown as { show(): void; hide(): void };
  api.hide(); // already closed -- no-op
  expect(el.open).to.be.false;

  api.show();
  await el.updateComplete;
  expect(el.open).to.be.true;
  api.show(); // already open -- no-op
  expect(el.open).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  expect(el.open).to.be.false; // the disabled setter itself hides
  api.show(); // disabled -- no-op
  expect(el.open).to.be.false;
});

it('the trigger-click handler no-ops while disabled even when invoked directly', async () => {
  const el = (await fixture(
    html`<lr-locale-picker disabled .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  (el as unknown as { onTriggerClick(): void }).onTriggerClick();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('ignores listbox row clicks while disabled', async () => {
  const el = (await fixture(
    html`<lr-locale-picker disabled .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  rows(el)[0].click();
  await el.updateComplete;
  expect(el.value).to.equal('');
});

it('clicking the listbox background (not a row) does not commit anything', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
  listbox.click();
  await el.updateComplete;
  expect(el.value).to.equal('');
});

it('ArrowDown/ArrowUp open a closed listbox instead of moving the active row', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const btn = trigger(el);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.open = false;
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('Enter with no active row hides the listbox without committing', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const btn = trigger(el);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.value).to.equal('');
});

it('Home jumps to the first row while open', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de', 'it']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  await el.updateComplete;
  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('fr');
});

it('wires aria-describedby to the visible hint/error text', async () => {
  const el = (await fixture(
    html`<lr-locale-picker hint="Pick one" error-text="Required"></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  const describedBy = trigger(el).getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.include('locale-picker-hint');
  expect(describedBy).to.include('locale-picker-error');
});

it('reflects aria-invalid=true on the trigger once a required field is touched and empty', async () => {
  const el = (await fixture(
    html`<lr-locale-picker required .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  expect(trigger(el).getAttribute('aria-invalid')).to.equal('false');
  trigger(el).dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(trigger(el).getAttribute('aria-invalid')).to.equal('true');
});

// Regression coverage for the lifecycle-super-call-omitted defect class. Scoped by tagName rather
// than the fixture()-returned reference: <lr-locale-picker> renders <lr-flag> children in its
// shadow DOM, and those extend LyraElement and override the same hooks on their own, so an
// unscoped flag would be satisfied by a *different* element's call. Mirrors flag.test.ts's pair.
it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in (regression)', async () => {
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void;
  };
  const original = proto.willUpdate;
  let calledOnSelf = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    if (this.tagName === 'LR-LOCALE-PICKER') calledOnSelf = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`)) as LyraLocalePicker;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in (regression)', async () => {
  const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void;
  };
  const original = proto.updated;
  let calledOnSelf = false;
  proto.updated = function (this: LyraElement, changed: PropertyValues): void {
    if (this.tagName === 'LR-LOCALE-PICKER') calledOnSelf = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`)) as LyraLocalePicker;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.updated = original;
  }
});

// -- Dismissal, slotted supporting text, listbox pointer, validity ----------

it('closes an open listbox on an outside pointerdown but not one inside the host', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open, 'a pointerdown on the host stays open').to.be.true;
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('tracks slotted label, hint and error content through slotchange', async () => {
  const el = (await fixture(html`
    <lr-locale-picker .locales=${['fr', 'de']}>
      <span slot="label">Language</span>
      <span slot="hint">Applies immediately</span>
      <span slot="error">Required</span>
    </lr-locale-picker>
  `)) as LyraLocalePicker;
  await el.updateComplete;
  const flags = el as unknown as { hasLabelSlot: boolean; hasHintSlot: boolean; hasErrorSlot: boolean;
  };
  expect(flags.hasLabelSlot).to.be.true;
  expect(flags.hasHintSlot).to.be.true;
  expect(flags.hasErrorSlot).to.be.true;

  for (const slot of ['label', 'hint', 'error']) el.querySelector(`[slot="${slot}"]`)!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(flags.hasLabelSlot).to.be.false;
  expect(flags.hasHintSlot).to.be.false;
  expect(flags.hasErrorSlot).to.be.false;
});

it('prevents mousedown on a listbox option but not on listbox chrome', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  const onOption = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  el.shadowRoot!.querySelector('[part="option"]')!.dispatchEvent(onOption);
  expect(onOption.defaultPrevented).to.be.true;

  const onChrome = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  el.shadowRoot!.querySelector('[part="listbox"]')!.dispatchEvent(onChrome);
  expect(onChrome.defaultPrevented).to.be.false;
});

it('reports validity through the native surface', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  await el.updateComplete;
  expect(el.reportValidity()).to.be.true;
});


// -- Degraded-DOM form-association fallback ---------------------------------

describe('ElementInternals fallback (lr-locale-picker)', () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraLocalePicker) => void | Promise<void>,
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as { attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`)) as LyraLocalePicker;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it('answers inertly when attachInternals is missing', async () => {
    await withoutAttachInternals(undefined, async (el) => {
      const internals = (el as unknown as { internals: ElementInternals }).internals;
      expect(internals.form === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal('');
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue('x')).to.not.throw();
      expect(() => internals.setValidity({}, '')).to.not.throw();
      el.value = 'de';
      await el.updateComplete;
    });
  });

  it('answers inertly when attachInternals throws', async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException('unsupported');
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals }).internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
        expect(internals.checkValidity()).to.be.true;
      },
    );
  });
});

// `CustomStateSet` and the `:state()` selector ship separately from each other and from the rest
// of `ElementInternals` -- these two guards are why the same block passes on WebKit, where a
// missing `CustomStateSet` would otherwise throw on the very first assertion.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(x)');
    return true;
  } catch {
    return false;
  }
})();

describe('validity custom states', () => {
  it('publishes required/optional and valid/invalid from the first update', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-locale-picker required name="locale" .locales=${['fr', 'de']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    await el.updateComplete;
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;

    el.value = 'fr';
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid once committed').to.be.true;
    expect(el.matches(':state(invalid)'), 'invalid once committed').to.be.false;

    el.required = false;
    await el.updateComplete;
    expect(el.matches(':state(optional)'), 'optional after clearing required').to.be.true;
    expect(el.matches(':state(required)'), 'required after clearing required').to.be.false;
  });

  it('keeps user-valid/user-invalid off a pristine control and turns them on at first interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-locale-picker required name="locale" .locales=${['fr', 'de']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    await el.updateComplete;
    expect(el.matches(':state(invalid)'), 'invalid while pristine').to.be.true;
    expect(el.matches(':state(user-invalid)'), 'user-invalid while pristine').to.be.false;
    expect(el.matches(':state(user-valid)'), 'user-valid while pristine').to.be.false;

    trigger(el).dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid after the trigger blurs').to.be.true;

    el.value = 'de';
    await el.updateComplete;
    expect(el.matches(':state(user-valid)'), 'user-valid once satisfied').to.be.true;
    expect(el.matches(':state(user-invalid)'), 'user-invalid once satisfied').to.be.false;
  });

  it('counts a reportValidity() call as interaction, and a form reset as going pristine again', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(html`
      <form><lr-locale-picker required name="locale" .locales=${['fr']}></lr-locale-picker></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-locale-picker') as LyraLocalePicker;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid before reporting').to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid after reporting').to.be.true;

    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid after reset').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid after reset').to.be.true;
  });
});

describe('touched state', () => {
  it('a real trigger blur marks the field touched', async () => {
    const el = (await fixture(
      html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    await el.updateComplete;
    expect((el as unknown as { touched: boolean }).touched, 'touched before blur').to.be.false;
    trigger(el).dispatchEvent(new FocusEvent('blur'));
    expect((el as unknown as { touched: boolean }).touched, 'touched after a real blur').to.be.true;
  });

  // Regression coverage: a focused native control's own `disabled`
  // state becoming true force-blurs it as a platform reaction, not a user interaction -- that
  // blur must not mark the field touched.
  it('does not mark touched from a blur caused by the trigger itself becoming disabled', async () => {
    const el = (await fixture(
      html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    await el.updateComplete;
    el.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('part'), 'trigger holds focus before disabling').to.equal(
      'trigger',
    );

    el.disabled = true;
    await el.updateComplete;

    expect((el as unknown as { touched: boolean }).touched, 'touched after disable-forced blur').to.be.false;
  });
});

describe('lr-locale-picker setCustomValidity()', () => {
  it('blocks form submission and becomes the validationMessage', async () => {
    const form = (await fixture(html`
      <form><lr-locale-picker name="locale"></lr-locale-picker></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-locale-picker') as LyraLocalePicker;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, 'an otherwise-valid picker submits').to.equal(1);

    el.setCustomValidity('That locale is not enabled for your account');
    expect(el.validationMessage).to.equal('That locale is not enabled for your account');
    expect(el.validity.customError, 'customError').to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(1);
  });

  it('survives an intrinsic revalidation', async () => {
    const el = (await fixture(html`<lr-locale-picker required></lr-locale-picker>`)) as LyraLocalePicker;
    el.setCustomValidity('Server says no');
    el.value = 'en'; // clears valueMissing and re-runs the intrinsic recompute
    expect(el.validity.valueMissing, 'valueMissing cleared').to.be.false;
    expect(el.validity.customError, 'custom error survives the recompute').to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it('keeps the custom error across a form reset', async () => {
    const form = (await fixture(html`
      <form><lr-locale-picker name="locale"></lr-locale-picker></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-locale-picker') as LyraLocalePicker;
    el.setCustomValidity('Server says no');
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  it('restores the computed validity when cleared, rather than forcing the control valid', async () => {
    const el = (await fixture(html`<lr-locale-picker required></lr-locale-picker>`)) as LyraLocalePicker;
    el.setCustomValidity('Server says no');
    el.setCustomValidity('');
    expect(el.validity.customError, 'custom error cleared').to.be.false;
    expect(
      el.validity.valueMissing,
      'an empty custom error must not force a still-uncommitted required picker valid',
    ).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.not.equal('');
    el.value = 'en';
    expect(el.checkValidity()).to.be.true;
  });

  it('drives the valid/invalid custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid before').to.be.true;
    el.setCustomValidity('Server says no');
    expect(el.matches(':state(invalid)'), 'invalid while a custom error is set').to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;
    el.setCustomValidity('');
    expect(el.matches(':state(valid)'), 'valid again once cleared').to.be.true;
  });
});

// A control barred from constraint validation is neither :valid nor :invalid natively -- a real
// `<input required disabled>` matches neither -- so a barred picker must publish no violation at
// all. Before the shared `isBarredFromValidation()` guard reached this component, a disabled
// required picker kept `valueMissing` raised and painted itself with the documented
// `:state(user-invalid)` error styling.
describe('barred from constraint validation', () => {
  it('reports no violation while disabled, and restores it on re-enable', async () => {
    const el = (await fixture(
      html`<lr-locale-picker required disabled name="locale" .locales=${['fr']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing while disabled').to.be.false;
    expect(el.validity.valid, 'valid while disabled').to.be.true;
    expect(el.validationMessage, 'no message while disabled').to.equal('');

    el.disabled = false;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing once enabled').to.be.true;
    expect(el.validationMessage, 'a message once enabled').to.not.equal('');
  });

  it('keeps the invalid custom states off a disabled required picker', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-locale-picker required name="locale" .locales=${['fr']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid while enabled').to.be.true;

    el.disabled = true;
    await el.updateComplete;
    expect(el.matches(':state(invalid)'), 'invalid while disabled').to.be.false;
    expect(el.matches(':state(user-invalid)'), 'user-invalid while disabled').to.be.false;
    expect(el.matches(':state(valid)'), 'a barred control is not valid either').to.be.false;
  });

  it('reports no violation inside a disabled fieldset', async () => {
    const form = (await fixture(html`
      <form>
        <fieldset disabled>
          <lr-locale-picker required name="locale" .locales=${['fr']}></lr-locale-picker>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-locale-picker') as LyraLocalePicker;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing inside a disabled fieldset').to.be.false;
    expect(el.checkValidity(), 'checkValidity() inside a disabled fieldset').to.be.true;
  });
});
