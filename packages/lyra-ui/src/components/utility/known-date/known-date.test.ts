import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './known-date.js';
import '../../forms/input/input.js';
import type { LyraKnownDate } from './known-date.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './known-date.styles.js';

function fields(el: LyraKnownDate): HTMLInputElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll('input[part="field-input"]'));
}

function fieldOrder(el: LyraKnownDate): string[] {
  return fields(el).map((input) => input.dataset.field!);
}

function fieldFor(el: LyraKnownDate, name: 'day' | 'month' | 'year'): HTMLInputElement {
  return el.shadowRoot!.querySelector(`input[data-field="${name}"]`) as HTMLInputElement;
}

function typeInto(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

it('renders three fields in en-GB locale order (day, month, year) by default when lang is inherited', async () => {
  const wrapper = await fixture(html`
    <div lang="en-GB"><lr-known-date></lr-known-date></div>
  `);
  const el = wrapper.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;
  expect(fieldOrder(el)).to.deep.equal(['day', 'month', 'year']);
});

it('renders month, day, year order for en-US and year, month, day for ja-JP', async () => {
  const us = (await fixture(html`<lr-known-date locale="en-US"></lr-known-date>`)) as LyraKnownDate;
  await us.updateComplete;
  expect(fieldOrder(us)).to.deep.equal(['month', 'day', 'year']);

  const jp = (await fixture(html`<lr-known-date locale="ja-JP"></lr-known-date>`)) as LyraKnownDate;
  await jp.updateComplete;
  expect(fieldOrder(jp)).to.deep.equal(['year', 'month', 'day']);
});

it('lets an explicit locale property override an inherited lang ancestor', async () => {
  const wrapper = await fixture(html`
    <div lang="en-GB"><lr-known-date locale="en-US"></lr-known-date></div>
  `);
  const el = wrapper.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;
  expect(fieldOrder(el)).to.deep.equal(['month', 'day', 'year']);
});

it('commits a complete, calendar-valid typed date as canonical ISO and fires change', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;

  typeInto(fieldFor(el, 'day'), '27');
  typeInto(fieldFor(el, 'month'), '3');
  const eventPromise = oneEvent(el, 'change');
  typeInto(fieldFor(el, 'year'), '2007');
  fieldFor(el, 'year').dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
  const event = (await eventPromise) as CustomEvent;

  expect(el.value).to.equal('2007-03-27');
  expect(event.detail.value).to.equal('2007-03-27');
  expect(event.detail.field).to.equal('year');
});

it('fires input on every keystroke with live per-field text, even while incomplete', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'input');
  typeInto(fieldFor(el, 'day'), '5');
  const event = (await eventPromise) as CustomEvent;

  expect(event.detail.value).to.equal('');
  expect(event.detail.day).to.equal('5');
  expect(event.detail.month).to.equal('');
  expect(event.detail.year).to.equal('');
  expect(event.detail.field).to.equal('day');
});

it('leaves value empty and out of FormData while any field is blank', async () => {
  const form = (await fixture(html`
    <form><lr-known-date name="dob" locale="en-GB"></lr-known-date></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;

  typeInto(fieldFor(el, 'day'), '27');
  typeInto(fieldFor(el, 'month'), '3');
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(new FormData(form).get('dob')).to.equal('');
});

it('flags a calendar-invalid combination (Feb 30) as badInput and shows dateInputInvalid once touched', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;

  typeInto(fieldFor(el, 'day'), '30');
  typeInto(fieldFor(el, 'month'), '2');
  typeInto(fieldFor(el, 'year'), '2026');
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(el.internals.validity.badInput).to.be.true;

  fieldFor(el, 'year').dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
  await el.updateComplete;
  expect(el.internals.validationMessage).to.equal('Enter a valid date.');
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(errorPart.textContent).to.contain('Enter a valid date.');
});

describe('auto-advance and backspace navigation', () => {
  it('auto-advances focus after the 2nd digit in day or month, but not after the 4th digit in year', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    typeInto(fieldFor(el, 'day'), '27');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(fieldFor(el, 'month'));

    typeInto(fieldFor(el, 'month'), '03');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(fieldFor(el, 'year'));

    fieldFor(el, 'year').focus();
    typeInto(fieldFor(el, 'year'), '2007');
    await el.updateComplete;
    // Nothing after year -- focus stays put instead of moving off the control.
    expect(el.shadowRoot!.activeElement).to.equal(fieldFor(el, 'year'));
  });

  it('moves focus to the previous field on Backspace in an already-empty field, without altering its content', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    const month = fieldFor(el, 'month');
    month.value = '';
    month.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await el.updateComplete;

    month.focus();
    month.setSelectionRange(0, 0);
    month.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement).to.equal(fieldFor(el, 'day'));
    expect(fieldFor(el, 'day').value).to.equal('27'); // untouched by the previous field's Backspace
  });

  it('is a no-op pressing Backspace on the first field (locale order) when it is already empty', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    const day = fieldFor(el, 'day');
    day.focus();
    day.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(day);
  });
});

describe('arrow-key field-to-field navigation and RTL', () => {
  it('moves to the next field on ArrowRight at the end of the text, and to the previous on ArrowLeft at the start', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    const day = fieldFor(el, 'day');
    day.focus();
    day.setSelectionRange(2, 2); // caret at the end of "27"
    day.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(fieldFor(el, 'month'));

    const month = fieldFor(el, 'month');
    month.setSelectionRange(0, 0); // caret at the start
    month.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(day);
  });

  it('flips which physical arrow key means "next field" under an inherited RTL ancestor, without changing the field order itself', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl"><lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date></div>
    `);
    const el = wrapper.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;

    // Field order itself is unaffected by direction.
    expect(fieldOrder(el)).to.deep.equal(['day', 'month', 'year']);

    const day = fieldFor(el, 'day');
    day.focus();
    day.setSelectionRange(2, 2); // caret at the end of "27"
    // Under RTL, ArrowRight-at-end moves toward the *previous* field visually
    // (physically pointing back toward the start of the reading direction) --
    // there is no previous field before "day", so this must be a no-op.
    day.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(day);

    // ArrowLeft-at-start now means "toward the next field" under RTL.
    day.setSelectionRange(0, 0);
    day.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(fieldFor(el, 'month'));
  });
});

describe('required vs. partially-filled validity', () => {
  it('reports valueMissing with fieldRequired only when all three fields are blank', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB" required></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.internals.validity.valueMissing).to.be.true;
    expect(el.internals.validity.badInput).to.be.false;
    expect(el.internals.validationMessage).to.equal('This field is required.');
  });

  it('reports badInput, not valueMissing, once required is partially filled', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB" required></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    typeInto(fieldFor(el, 'day'), '27');
    await el.updateComplete;

    expect(el.internals.validity.valueMissing).to.be.false;
    expect(el.internals.validity.badInput).to.be.true;
  });
});

describe('min/max bounds', () => {
  it('produces rangeUnderflow/rangeOverflow with interpolated messages', async () => {
    const el = (await fixture(html`
      <lr-known-date locale="en-GB" min="2020-01-01" max="2020-12-31"></lr-known-date>
    `)) as LyraKnownDate;
    await el.updateComplete;

    el.value = '2019-06-01';
    expect(el.internals.validity.rangeUnderflow).to.be.true;
    expect(el.internals.validationMessage).to.equal('Date must be on or after 2020-01-01.');

    el.value = '2021-06-01';
    expect(el.internals.validity.rangeOverflow).to.be.true;
    expect(el.internals.validationMessage).to.equal('Date must be on or before 2020-12-31.');
  });
});

describe('disabled', () => {
  it('disables all three fields and reflects the attribute', async () => {
    const el = (await fixture(html`<lr-known-date disabled></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.hasAttribute('disabled')).to.be.true;
    for (const input of fields(el)) expect(input.disabled).to.be.true;
  });

  it('reflects an ancestor fieldset disabled state without mutating the component own disabled property', async () => {
    const form = (await fixture(html`
      <form><fieldset disabled><lr-known-date name="dob"></lr-known-date></fieldset></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    expect(el.disabled).to.be.false;
    expect(el.effectiveDisabled).to.be.true;
    for (const input of fields(el)) expect(input.disabled).to.be.true;
  });
});

describe('readonly', () => {
  it('bars required validation while active and restores it once cleared', async () => {
    const el = (await fixture(html`<lr-known-date required></lr-known-date>`)) as LyraKnownDate;
    expect(el.checkValidity()).to.be.false;

    el.readonly = true;
    expect(el.checkValidity()).to.be.true;
    expect(el.internals.willValidate).to.be.false;

    el.readonly = false;
    expect(el.internals.willValidate).to.be.true;
    expect(el.internals.validity.valueMissing).to.be.true;
  });
});

describe('form participation', () => {
  it('includes name/value in FormData only once complete and valid, and restores the constructed default on reset', async () => {
    const form = (await fixture(html`
      <form><lr-known-date name="dob" value="2007-03-27"></lr-known-date></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    expect(new FormData(form).get('dob')).to.equal('2007-03-27');

    el.value = '2010-01-01';
    expect(new FormData(form).get('dob')).to.equal('2010-01-01');

    form.reset();
    expect(el.value).to.equal('2007-03-27');
  });

  it('round-trips a string state via formStateRestoreCallback', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    (el as unknown as { formStateRestoreCallback(state: string): void }).formStateRestoreCallback('2007-03-27');
    expect(el.value).to.equal('2007-03-27');
  });
});

describe('declarative value sanitization', () => {
  it('sanitizes a non-padded and a calendar-invalid declarative value to empty', async () => {
    const nonPadded = (await fixture(html`<lr-known-date value="2007-3-27"></lr-known-date>`)) as LyraKnownDate;
    expect(nonPadded.value).to.equal('');

    const invalid = (await fixture(html`<lr-known-date value="2007-02-30"></lr-known-date>`)) as LyraKnownDate;
    expect(invalid.value).to.equal('');
  });
});

describe('valueAsDate', () => {
  it('round-trips through the getter/setter, zero-padding single-digit day/month', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    expect(el.valueAsDate).to.equal(null);

    el.valueAsDate = new Date(2026, 2, 5); // March 5th
    expect(el.value).to.equal('2026-03-05');
    expect(el.valueAsDate?.getTime()).to.equal(new Date(2026, 2, 5).getTime());

    el.valueAsDate = null;
    expect(el.value).to.equal('');
  });
});

describe(':state(blank)', () => {
  it('toggles present/absent as the composite value goes blank/complete/blank again', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.internals.states.has('blank')).to.be.true;

    el.value = '2007-03-27';
    await el.updateComplete;
    expect(el.internals.states.has('blank')).to.be.false;

    (el as unknown as { formResetCallback(): void }).formResetCallback();
    await el.updateComplete;
    expect(el.internals.states.has('blank')).to.be.true;
  });
});

describe('focus/blur bridging', () => {
  it('fires a bubbling, composed focus event when any internal field focuses', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const eventPromise = oneEvent(el, 'focus');
    fieldFor(el, 'day').focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('does not fire blur on the host while Tabbing day -> month -> year, only when leaving the whole control', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    let blurCount = 0;
    el.addEventListener('blur', () => blurCount++);

    const day = fieldFor(el, 'day');
    const month = fieldFor(el, 'month');
    const year = fieldFor(el, 'year');

    // Real focus() calls fire real, non-bubbling native blur/focus pairs with
    // a real, browser-computed relatedTarget -- more faithful than a
    // hand-constructed FocusEvent, and avoids accidentally giving a synthetic
    // event `bubbles`/`composed` (native blur/focus never has either).
    day.focus();
    month.focus();
    await el.updateComplete;
    year.focus();
    await el.updateComplete;
    expect(blurCount).to.equal(0);

    const eventPromise = oneEvent(el, 'blur');
    year.blur(); // nothing else takes focus -> relatedTarget is null -> leaves the whole control
    const ev = await eventPromise;
    expect(blurCount).to.equal(1);
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('per-field labels', () => {
  it('reaches the rendered per-field label text and is wired through localize()', async () => {
    const el = (await fixture(html`
      <lr-known-date
        locale="en-GB"
        day-label="Jour"
        .strings=${{ knownDateMonth: 'Mois' }}
      ></lr-known-date>
    `)) as LyraKnownDate;
    await el.updateComplete;

    const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="field-label"]')) as HTMLLabelElement[];
    const dayText = labels.find((l) => l.htmlFor === fieldFor(el, 'day').id)?.textContent?.trim();
    const monthText = labels.find((l) => l.htmlFor === fieldFor(el, 'month').id)?.textContent?.trim();
    const yearText = labels.find((l) => l.htmlFor === fieldFor(el, 'year').id)?.textContent?.trim();

    expect(dayText).to.equal('Jour'); // explicit day-label attribute override
    expect(monthText).to.equal('Mois'); // .strings override of knownDateMonth
    expect(yearText).to.equal('Year'); // untouched built-in default
  });

  it('renders the built-in English fallback with no locale registered', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="field-label"]')).map((l) =>
      l.textContent?.trim(),
    );
    expect(labels).to.deep.equal(['Day', 'Month', 'Year']);
  });
});

describe('slot vs. attribute precedence and empty-state hiding', () => {
  it('hides the hint and error parts when empty, shows them once populated', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(getComputedStyle(hintPart).display).to.equal('none');
    expect(getComputedStyle(errorPart).display).to.equal('none');

    el.hint = 'DD MM YYYY';
    el.errorText = 'Required';
    await el.updateComplete;
    expect(getComputedStyle(hintPart).display).to.not.equal('none');
    expect(getComputedStyle(errorPart).display).to.not.equal('none');
  });

  it('assigns slotted label content to the label slot instead of falling back to the label attribute', async () => {
    // `Element.textContent` never flattens slot assignment (it walks the
    // shadow tree's own literal children, which for a <slot> means its
    // fallback content) -- checking `assignedElements()` is what actually
    // proves the light-DOM child won the slot, matching how the browser's
    // own slot-projection renders it, rather than asserting on textContent.
    const el = (await fixture(
      html`<lr-known-date label="Ignored"><span slot="label">Birth date</span></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector('slot[name="label"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.length(1);
    expect(assigned[0].textContent).to.equal('Birth date');
  });
});

describe('required-field asterisk', () => {
  it('appears only when both required and a real label are set', async () => {
    const el = (await fixture(
      html`<lr-known-date label="Birth date" required></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    const after = getComputedStyle(legend, '::after');
    expect(after.content).to.contain('*');
  });

  it('does not render an orphaned asterisk when required but no label is provided', async () => {
    const el = (await fixture(html`<lr-known-date required></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    expect(getComputedStyle(legend).display).to.equal('none');
  });
});

describe('size', () => {
  it('reflects the attribute and drives the --lr-known-date-field-* custom properties', async () => {
    const el = (await fixture(html`<lr-known-date size="l"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.getAttribute('size')).to.equal('l');
    const input = fieldFor(el, 'day');
    const fontSize = getComputedStyle(input).fontSize;
    expect(fontSize).to.not.equal('');

    el.size = 'xs';
    await el.updateComplete;
    const smallFontSize = getComputedStyle(input).fontSize;
    expect(smallFontSize).to.not.equal(fontSize);
  });
});

describe('accessibility', () => {
  it('is accessible when empty and untouched', async () => {
    const el = (await fixture(
      html`<lr-known-date label="Birth date" hint="DD MM YYYY"></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('is accessible when touched and invalid with a rendered error message', async () => {
    const el = (await fixture(
      html`<lr-known-date label="Birth date" required></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    fieldFor(el, 'day').focus();
    fieldFor(el, 'day').dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.true;
    await expect(el).to.be.accessible();
  });

  it('forwards a host aria-label onto the fieldset, winning over the legend', async () => {
    const el = (await fixture(
      html`<lr-known-date label="Ignored legend" aria-label="Date of birth"></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    const fieldset = el.shadowRoot!.querySelector('[part="fieldset"]') as HTMLElement;
    expect(fieldset.getAttribute('aria-label')).to.equal('Date of birth');
  });

  it('wires aria-describedby, aria-invalid, and aria-required onto every field-input', async () => {
    const el = (await fixture(
      html`<lr-known-date hint="DD MM YYYY" required></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    for (const input of fields(el)) {
      expect(input.getAttribute('aria-describedby')).to.include('known-date-hint');
      expect(input.getAttribute('aria-required')).to.equal('true');
      expect(input.getAttribute('aria-invalid')).to.equal('false');
    }
  });

  it('marks each field-input aria-readonly when readonly is set', async () => {
    const el = (await fixture(html`<lr-known-date readonly></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    for (const input of fields(el)) {
      expect(input.readOnly).to.be.true;
      expect(input.getAttribute('aria-readonly')).to.equal('true');
    }
  });
});

describe('autocomplete forwarding', () => {
  it('expands "bday" into per-field companion tokens', async () => {
    const el = (await fixture(html`<lr-known-date autocomplete="bday"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(fieldFor(el, 'day').getAttribute('autocomplete')).to.equal('bday-day');
    expect(fieldFor(el, 'month').getAttribute('autocomplete')).to.equal('bday-month');
    expect(fieldFor(el, 'year').getAttribute('autocomplete')).to.equal('bday-year');
  });

  it('forwards any other non-empty value verbatim to all three fields', async () => {
    const el = (await fixture(html`<lr-known-date autocomplete="off"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    for (const input of fields(el)) expect(input.getAttribute('autocomplete')).to.equal('off');
  });
});

it('rejects non-digit keystrokes before they reach a field state', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  const day = fieldFor(el, 'day');
  typeInto(day, 'ab');
  await el.updateComplete;
  expect(day.value).to.equal('');
});

describe('per-tier field min-height and exact-height hatch', () => {
  const anyField = (el: LyraKnownDate): HTMLElement =>
    el.shadowRoot!.querySelector('[part="field-input"]') as HTMLElement;

  it('does NOT declare the --lr-known-date-field-height sentinel (guards the lr-select trap)', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(getComputedStyle(el).getPropertyValue('--lr-known-date-field-height').trim()).to.equal('');
  });

  it('wires --lr-known-date-field-min-height per tier (rendered min-block-size), matching lr-input\'s own scale', async () => {
    // xs=1.5rem/24px, s=1.875rem/30px, m=2.5rem/40px, l=3rem/48px, xl=3.5rem/56px -- lr-input's/
    // lr-date-input's own --lr-*-control-min-height scale, not lr-button's (previously xs=20px,
    // s=24px, m=32px, l=40px, xl=48px, an 8px/25% mismatch at the shared default tier).
    const expected: Record<string, string> = {
      xs: '24px',
      s: '30px',
      m: '40px',
      l: '48px',
      xl: '56px',
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-known-date size=${size}></lr-known-date>`)) as LyraKnownDate;
      await el.updateComplete;
      expect(getComputedStyle(anyField(el)).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it('renders at the same height as a sibling lr-input at the shared default size, closing the visible seam', async () => {
    const kd = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await kd.updateComplete;
    const input = (await fixture(html`<lr-input></lr-input>`)) as HTMLElement & { updateComplete: Promise<unknown> };
    await input.updateComplete;
    const kdBlockSize = getComputedStyle(anyField(kd)).blockSize;
    const inputWrapper = input.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    expect(kdBlockSize).to.equal(getComputedStyle(inputWrapper).blockSize);
  });

  it('leaves the rendered field height at or above the per-tier floor when the height hatch is unset', async () => {
    for (const size of ['xs', 's', 'm', 'l', 'xl'] as const) {
      const el = (await fixture(html`<lr-known-date size=${size}></lr-known-date>`)) as LyraKnownDate;
      await el.updateComplete;
      const field = anyField(el);
      const natural = getComputedStyle(field).blockSize;
      // At xs/s/m the per-tier floor now exceeds the field's own padding/font-driven content
      // height and actively pins the rendered box to the floor (natural === minBlockSize); at
      // l/xl the content height still exceeds the floor, so the floor stays dead there, same as
      // before. Either way the rendered height never drops below the floor.
      expect(Number.parseFloat(natural), `size=${size}`).to.be.at.least(
        Number.parseFloat(getComputedStyle(field).minBlockSize),
      );
      el.style.setProperty('--lr-known-date-field-height', '90px');
      await el.updateComplete;
      expect(getComputedStyle(field).blockSize, `size=${size} pinned`).to.equal('90px');
      el.style.removeProperty('--lr-known-date-field-height');
      await el.updateComplete;
      expect(getComputedStyle(field).blockSize, `size=${size} restored`).to.equal(natural);
    }
  });

  it('lets a consumer raise --lr-known-date-field-min-height past the field content', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const field = anyField(el);
    const natural = Number.parseFloat(getComputedStyle(field).blockSize);
    el.style.setProperty('--lr-known-date-field-min-height', `${natural + 24}px`);
    await el.updateComplete;
    expect(Number.parseFloat(getComputedStyle(field).blockSize)).to.equal(natural + 24);
  });

  it('stays accessible with a pinned exact field height', async () => {
    const el = (await fixture(
      html`<lr-known-date label="Birth date" style="--lr-known-date-field-height: 44px;"></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('field-input hover (mouse-user parity with :focus-visible)', () => {
  it('changes the border color on hover, matching the keyboard focus-visible affordance', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const field = el.shadowRoot!.querySelector('[part="field-input"]') as HTMLElement;
    const restBorder = getComputedStyle(field).borderColor;

    // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
    // event, so the rule is asserted directly from the stylesheet instead, matching how other
    // components in this library prove a :hover rule exists for a given selector.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='field-input'\]:hover\s*\{[^}]*border-color/);
    // Sanity: the rest-state border is a real resolved color, not a bare custom property string.
    expect(restBorder).to.match(/^rgb/);
  });
});

describe('invalid-border cssprop indirection', () => {
  it('recolors the invalid-field border from --lr-known-date-invalid-border-color on an ancestor, not a bare shared token', async () => {
    const el = (await fixture(html`<lr-known-date required></lr-known-date>`)) as LyraKnownDate;
    el.style.setProperty('--lr-known-date-invalid-border-color', 'rgb(10, 20, 30)');
    const day = el.shadowRoot!.querySelector('input[data-field="day"]') as HTMLInputElement;
    day.focus();
    day.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.true;
    const field = el.shadowRoot!.querySelector('[part="field-input"]') as HTMLElement;
    expect(getComputedStyle(field).borderColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the pre-cssprop-indirection output when the prop is unset', async () => {
    const el = (await fixture(html`<lr-known-date required></lr-known-date>`)) as LyraKnownDate;
    const day = el.shadowRoot!.querySelector('input[data-field="day"]') as HTMLInputElement;
    day.focus();
    day.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
    await el.updateComplete;
    const field = el.shadowRoot!.querySelector('[part="field-input"]') as HTMLElement;
    // Fallback arm resolves to the same --lr-color-danger token as before the indirection
    // (light-theme default #cf222e).
    expect(getComputedStyle(field).borderColor).to.equal('rgb(207, 34, 46)');
  });
});

describe('lifecycle: willUpdate calls super', () => {
  it('calls super.willUpdate() so a future base-class/mixin hook is not silently skipped', async () => {
    let sawCall = false;
    const original = LyraElement.prototype.willUpdate;
    (LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void }).willUpdate = function (
      this: LyraElement,
      changed: PropertyValues,
    ) {
      sawCall = true;
      return (original as (changed: PropertyValues) => void).call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
      await el.updateComplete;
      expect(sawCall).to.be.true;
    } finally {
      LyraElement.prototype.willUpdate = original;
    }
  });
});
