import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './number-input.js';
import '../../../translations/de/forms.js';
import type { LyraNumberInput } from './number-input.class.js';

function nativeOf(el: LyraNumberInput): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
}

async function typeInto(el: LyraNumberInput, text: string): Promise<void> {
  await focusByKeyboard(nativeOf(el));
  nativeOf(el).select();
  await sendKeys({ type: text });
  await el.updateComplete;
}

describe('lr-number-input localized', () => {
  beforeEach(() => {
    expectLocaleFallback('de', ['fieldRequired', 'valueInvalid']);
  });

  it('keeps the native number contract when unset', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input lang="de" label="Amount" value="25000.5"></lr-number-input>`);
    expect(el.localized).to.equal(false);
    expect(nativeOf(el).type).to.equal('number');
    expect(nativeOf(el).value).to.equal('25000.5');
  });

  it('reads grouping and decimal separators of the effective locale into a canonical value', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form lang="de"><lr-number-input localized name="amount" label="Betrag" step="any"></lr-number-input></form>
    `);
    const el = form.querySelector<LyraNumberInput>('lr-number-input')!;
    expect(nativeOf(el).type).to.equal('text');
    await typeInto(el, '25.000');
    expect(el.value).to.equal('25000');
    expect(el.valueAsNumber).to.equal(25000);
    expect(new FormData(form).get('amount')).to.equal('25000');
    await typeInto(el, '10,24');
    expect(el.value).to.equal('10.24');
    expect(el.validity.valid).to.equal(true);
  });

  it('displays prefilled and programmatic values in the locale format and reformats on commit', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input lang="de" localized label="Betrag" value="1234567.5" step="any"></lr-number-input>`);
    expect(nativeOf(el).value).to.equal('1.234.567,5');
    el.value = '10.50';
    await el.updateComplete;
    expect(nativeOf(el).value).to.equal('10,50');
    await typeInto(el, '25000');
    expect(nativeOf(el).value, 'raw text stays while typing').to.equal('25000');
    const changed = oneEvent(el, 'change');
    nativeOf(el).blur();
    nativeOf(el).dispatchEvent(new Event('change', { bubbles: true }));
    await changed;
    await el.updateComplete;
    expect(nativeOf(el).value).to.equal('25.000');
    el.lang = 'en';
    await el.updateComplete;
    expect(nativeOf(el).value).to.equal('25,000');
  });

  it('reports badInput for text that is not a number in the locale, keeping the typed text', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input lang="de" localized label="Betrag" step="any"></lr-number-input>`);
    await typeInto(el, '10.24');
    expect(el.value).to.equal('');
    expect(el.validity.badInput).to.equal(true);
    expect(el.validity.valid).to.equal(false);
    expect(el.validationMessage).to.not.equal('');
    expect(nativeOf(el).value).to.equal('10.24');
    await typeInto(el, '10,24');
    expect(el.validity.valid).to.equal(true);
  });

  it('applies native range, step and required validity to the parsed value', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input lang="de" localized label="Betrag" min="0" max="1000" step="0.5" required></lr-number-input>`);
    expect(el.validity.valueMissing).to.equal(true);
    await typeInto(el, '1.500');
    expect(el.validity.rangeOverflow).to.equal(true);
    await typeInto(el, '2,25');
    expect(el.validity.stepMismatch).to.equal(true);
    await typeInto(el, '2,5');
    expect(el.validity.valid).to.equal(true);
  });

  it('steps with the steppers and ArrowUp/ArrowDown, emitting the user-edit sequence', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input lang="de" localized label="Betrag" value="999.5" step="0.5"></lr-number-input>`);
    el.stepUp();
    expect(el.value).to.equal('1000');
    await el.updateComplete;
    expect(nativeOf(el).value).to.equal('1.000');
    await focusByKeyboard(nativeOf(el));
    const input = oneEvent(el, 'lr-input');
    await sendKeys({ press: 'ArrowUp' });
    await input;
    expect(el.value).to.equal('1000.5');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'ArrowDown' });
    expect(el.value).to.equal('999.5');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="stepper-increment"]')!.click();
    expect(el.value).to.equal('1000');
  });

  it('keeps spinbutton semantics on the text field and passes axe', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input lang="de" localized label="Betrag" value="25000" min="0" max="100000"></lr-number-input>`);
    const native = nativeOf(el);
    expect(native.getAttribute('role')).to.equal('spinbutton');
    expect(native.getAttribute('aria-valuenow')).to.equal('25000');
    expect(native.getAttribute('aria-valuetext')).to.equal('25.000');
    expect(native.getAttribute('aria-valuemin')).to.equal('0');
    expect(native.getAttribute('aria-valuemax')).to.equal('100000');
    expect(native.getAttribute('inputmode')).to.equal('numeric');
    await expect(el).to.be.accessible();
    el.localized = false;
    await el.updateComplete;
    expect(native.type).to.equal('number');
    expect(native.hasAttribute('role')).to.equal(false);
    expect(native.hasAttribute('aria-valuenow')).to.equal(false);
    expect(native.value).to.equal('25000');
  });

  it('restores the default display on form reset', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form lang="de"><lr-number-input localized name="amount" label="Betrag" value="1500" step="any"></lr-number-input></form>
    `);
    const el = form.querySelector<LyraNumberInput>('lr-number-input')!;
    await typeInto(el, 'abc');
    expect(el.validity.badInput).to.equal(true);
    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal('1500');
    expect(nativeOf(el).value).to.equal('1.500');
    expect(el.validity.valid).to.equal(true);
  });
});
