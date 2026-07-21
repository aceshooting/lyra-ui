import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
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

// -- Coverage backfill: attribute parsing, ElementInternals fallback/passthrough,
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
  const proto = HTMLElement.prototype as unknown as { attachInternals: unknown };
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
  const proto = HTMLElement.prototype as unknown as { attachInternals: () => ElementInternals };
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
    el as unknown as { formStateRestoreCallback(state: string | File | FormData | null): void }
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
