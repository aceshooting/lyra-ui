import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';
import { getRegisteredLyraLocales, registerLyraLocale, setLyraLocale, getLyraLocale } from '../../../internal/localization.js';
import { localeNativeName } from '../../media/flag/language-map.js';

function trigger(el: LyraLocalePicker): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function rows(el: LyraLocalePicker): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

// -- Baseline rendering / form participation --------------------------------

it('renders a trigger button and a closed listbox by default', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  expect(trigger(el)).to.exist;
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

it('re-dispatches trigger blur/focus as bubbling, composed host events', async () => {
  const el = (await fixture(
    html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  let focusFired = false;
  let blurFired = false;
  el.addEventListener('focus', () => (focusFired = true));
  el.addEventListener('blur', () => (blurFired = true));
  trigger(el).dispatchEvent(new FocusEvent('focus'));
  trigger(el).dispatchEvent(new FocusEvent('blur'));
  expect(focusFired).to.be.true;
  expect(blurFired).to.be.true;
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

// -- Spec obligation 1 (registry export) is covered by localization.test.ts;
//    obligations below map to this component's own contract. --------------

// Obligation 3: locales unset -> matches getRegisteredLyraLocales(), live-updates.
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

// Obligation 4: an explicit `locales` catalog overrides auto-discovery entirely, in both forms.
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

// Obligation 5: flag/native-name/tag per row; showFlags=false omits the flag element entirely.
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

it('a locales entry with country overrides that row\'s flag; a row without it keeps deriving from the tag', async () => {
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

// Obligation 6: selecting a row commits value, fires lr-change, and applies setLyraLocale().
it('selecting a row updates value, fires lr-change with {value, previousValue}, and calls setLyraLocale', async () => {
  setLyraLocale('en');
  const el = (await fixture(
    html`<lr-locale-picker value="fr" .locales=${['fr', 'de']}></lr-locale-picker>`,
  )) as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;

  let detail: { value: string; previousValue: string } | undefined;
  el.addEventListener('lr-change', (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() => rows(el)[1].click());
  await oneEvent(el, 'lr-change');
  expect(el.value).to.equal('de');
  expect(detail).to.deep.equal({ value: 'de', previousValue: 'fr' });
  expect(getLyraLocale()).to.equal('de');
  setLyraLocale('en');
});

// Obligation 7: preventDefault() updates value but leaves the active locale untouched.
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

// Obligation 8: value unset previews effectiveLocale, but required stays invalid until a real commit.
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

// Obligation 9: keyboard nav.
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

// Obligation 10: axe, closed and open.
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
  await expect(el).to.be.accessible();
});

// Obligation 11: RTL fixture -- logical layout, no accidental Left/Right remap.
it('mirrors row text-align via logical properties under dir="rtl", with no Left/Right remap added', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div dir="rtl"><lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker></div>
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

// Obligation 12: unset-regression.
it('unset (only locales, or nothing) renders deterministically with no other new property touched', async () => {
  const el = (await fixture(html`<lr-locale-picker></lr-locale-picker>`)) as LyraLocalePicker;
  expect(el.value).to.equal('');
  expect(el.required).to.be.false;
  expect(el.showFlags).to.be.true;
  expect(el.open).to.be.false;
  expect(el.size).to.equal('m');
  expect(el.disabled).to.be.false;
  expect(trigger(el)).to.exist;
});
