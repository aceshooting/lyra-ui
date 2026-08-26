import { fixture, expect, oneEvent, html, waitUntil } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './known-date.js';
import '../../forms/input/input.js';
import '../../forms/button/button.js';
import { LyraKnownDate, type LyraKnownDateParts } from './known-date.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

class KnownDateErrorForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const knownDate = this.ownerDocument.createElement('lr-known-date');
    const errorSlot = this.ownerDocument.createElement('slot');
    errorSlot.name = 'error';
    errorSlot.slot = 'error';
    knownDate.append(errorSlot);
    root.append(knownDate);
  }
}
customElements.define('known-date-error-forward-wrapper', KnownDateErrorForwardWrapper);

function fields(el: LyraKnownDate): HTMLInputElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll('input[part="field-input"]'));
}

function fieldOrder(el: LyraKnownDate): string[] {
  return fields(el).map((input) => input.dataset['field']!);
}

function fieldFor(el: LyraKnownDate, name: 'day' | 'month' | 'year'): HTMLInputElement {
  return el.shadowRoot!.querySelector(`input[data-field="${name}"]`) as HTMLInputElement;
}

function typeInto(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

it('exposes fresh callable static validators that project live composite validity', async () => {
  const first = LyraKnownDate.validators;
  const second = LyraKnownDate.validators;
  expect(first === second).to.be.false;
  expect(first).to.have.lengthOf(1);
  expect(first[0]!.observedAttributes).to.deep.equal([
    'required',
    'disabled',
    'readonly',
    'value',
    'min',
    'max',
  ]);

  const el = await fixture<LyraKnownDate>(html`<lr-known-date required></lr-known-date>`);
  const missing = first[0]!.checkValidity(el);
  expect(missing.isValid).to.be.false;
  expect(missing.invalidKeys).to.deep.equal(['valueMissing']);
  expect(missing.message).to.equal(el.validationMessage);

  el.value = '2007-03-27';
  const valid = first[0]!.checkValidity(el);
  expect(valid).to.deep.equal({ isValid: true, message: '', invalidKeys: [] });
});

it('renders three fields in en-GB locale order (day, month, year) by default when lang is inherited', async () => {
  const wrapper = await fixture(html` <div lang="en-GB"><lr-known-date></lr-known-date></div> `);
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
  const wrapper = await fixture(html` <div lang="en-GB"><lr-known-date locale="en-US"></lr-known-date></div> `);
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

it('emits one translated input event and suppresses raw private input/change events', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
  let inputs = 0;
  let changes = 0;
  el.addEventListener('input', () => inputs++);
  el.addEventListener('change', () => changes++);

  const day = fieldFor(el, 'day');
  typeInto(day, '5');
  day.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  expect(inputs).to.equal(1);
  expect(changes).to.equal(0);
});

it('uses native InputEvent/Event constructors while retaining the shipped detail payload', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;

  const inputPromise = oneEvent(el, 'input');
  typeInto(fieldFor(el, 'day'), '27');
  const observedInput = await inputPromise;
  if (!(observedInput instanceof InputEvent)) throw new Error('Expected a native InputEvent');
  const inputEvent = observedInput as InputEvent & { detail: { day: string } };
  expect(inputEvent.constructor.name).to.equal('InputEvent');
  expect(inputEvent.bubbles).to.be.true;
  expect(inputEvent.composed).to.be.true;
  expect(inputEvent.cancelable).to.be.false;
  expect(inputEvent.detail.day).to.equal('27');

  typeInto(fieldFor(el, 'month'), '3');
  const changePromise = oneEvent(el, 'change');
  typeInto(fieldFor(el, 'year'), '2007');
  fieldFor(el, 'year').dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
  const changeEvent = (await changePromise) as Event & {
    detail: { value: string };
  };
  expect(changeEvent.constructor).to.equal(Event);
  expect(changeEvent.bubbles).to.be.true;
  expect(changeEvent.composed).to.be.true;
  expect(changeEvent.cancelable).to.be.false;
  expect(changeEvent.detail.value).to.equal('2007-03-27');
});

it('preserves the native inputType when translating a private field input event', async () => {
  const el = await fixture<LyraKnownDate>(html`
    <lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>
  `);
  const day = fieldFor(el, 'day');
  const translatedInput = oneEvent(el, 'input');
  day.value = '';
  day.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    composed: true,
    inputType: 'deleteContentBackward',
  }));

  const event = await translatedInput;
  if (!(event instanceof InputEvent)) throw new Error('Expected a native InputEvent');
  expect(event.inputType).to.equal('deleteContentBackward');
});

describe('mirrored Web Awesome public surface', () => {
  it('defaults appearance/pill and renders distinct filled and pill treatments', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const day = fieldFor(el, 'day');
    const outlinedBackground = getComputedStyle(day).backgroundColor;
    const outlinedRadius = getComputedStyle(day).borderRadius;

    expect(el.appearance).to.equal('outlined');
    expect(el.pill).to.be.false;

    el.appearance = 'filled';
    el.pill = true;
    await el.updateComplete;
    expect(el.getAttribute('appearance')).to.equal('filled');
    expect(el.hasAttribute('pill')).to.be.true;
    expect(getComputedStyle(day).backgroundColor).to.not.equal(outlinedBackground);
    expect(getComputedStyle(day).borderRadius).to.not.equal(outlinedRadius);
  });

  it('uses with-label/with-hint as SSR slot-presence signals and supports unsetting them', async () => {
    const el = (await fixture(html`<lr-known-date with-label with-hint></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part~="legend"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    expect(getComputedStyle(legend).display).to.not.equal('none');
    expect(getComputedStyle(hint).display).to.not.equal('none');

    el.withLabel = false;
    el.withHint = false;
    await el.updateComplete;
    expect(getComputedStyle(legend).display).to.equal('none');
    expect(getComputedStyle(hint).display).to.equal('none');
  });

  it('publishes the exact compatibility part aliases', async () => {
    const el = (await fixture(
      html`<lr-known-date locale="en-GB" label="Birth date"></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
    const fieldsRow = el.shadowRoot!.querySelector('[part~="form-control-input"]') as HTMLElement;
    expect(label.part.contains('label')).to.be.true;
    expect(fieldsRow.part.contains('fields')).to.be.true;
    for (const field of ['day', 'month', 'year'] as const) {
      const block = fieldFor(el, field).parentElement!;
      expect(block.part.contains('field')).to.be.true;
      expect(block.part.contains(`field-${field}`)).to.be.true;
    }
  });

  it('round-trips the public parts object and keeps the hidden valueInput mirror synchronized', async () => {
    const el = (await fixture(html`
      <lr-known-date locale="en-GB" min="2000-01-01" max="2030-12-31" required></lr-known-date>
    `)) as LyraKnownDate;
    await el.updateComplete;

    el.parts = { day: '5', month: '3', year: '2026' };
    await el.updateComplete;
    expect(el.value).to.equal('2026-03-05');
    expect(fieldFor(el, 'day').value).to.equal('5');
    expect(el.valueInput?.constructor.name === 'HTMLInputElement').to.equal(true);
    expect(el.valueInput.type).to.equal('date');
    expect(el.valueInput.value).to.equal('2026-03-05');
    expect(el.valueInput.min).to.equal('2000-01-01');
    expect(el.valueInput.max).to.equal('2030-12-31');
    expect(el.valueInput.required).to.be.true;

    el.value = '2027-04-06';
    await el.updateComplete;
    expect(el.parts).to.deep.equal({ day: '6', month: '4', year: '2027' });
    expect(el.valueInput.value).to.equal('2027-04-06');
  });

  it('publishes blank and disabled custom states, including fieldset-cascaded disablement', async () => {
    const form = (await fixture(html`
      <form>
        <fieldset><lr-known-date></lr-known-date></fieldset>
      </form>
    `)) as HTMLFormElement;
    const fieldset = form.querySelector('fieldset')!;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    expect(el.internals.states.has('blank')).to.be.true;
    expect(el.internals.states.has('disabled')).to.be.false;

    fieldset.disabled = true;
    await el.updateComplete;
    expect(el.internals.states.has('disabled')).to.be.true;

    el.value = '2026-03-05';
    await el.updateComplete;
    expect(el.internals.states.has('blank')).to.be.false;
  });

  it('focuses the first empty field and resetValidity clears only consumer validity', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB" required></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    el.parts = { day: '5', month: '', year: '' };
    await el.updateComplete;
    el.focus();
    expect(el.shadowRoot!.activeElement === fieldFor(el, 'month')).to.equal(true);

    el.setCustomValidity('Server rejected this date');
    expect(el.validity.customError).to.be.true;
    el.resetValidity();
    expect(el.validity.customError).to.be.false;
    expect(el.validity.badInput).to.be.true;
  });

  it('anchors validationTarget on the first visible field, not the hidden native mirror', async () => {
    const el = (await fixture(
      html`<lr-known-date locale="en-GB" required></lr-known-date>`
    )) as LyraKnownDate;
    await el.updateComplete;

    const visibleFields = fields(el);
    expect(visibleFields.length).to.equal(3);
    expect(el.validationTarget === visibleFields[0]).to.be.true;
    expect(el.validationTarget === el.valueInput).to.be.false;
    expect(el.validationTarget?.hasAttribute('hidden')).to.be.false;
    expect(el.validationTarget?.getAttribute('tabindex')).to.not.equal('-1');
  });

  it('lets validationTarget be overridden and restored to the default field anchor', async () => {
    const el = (await fixture(
      html`<lr-known-date locale="en-GB"></lr-known-date>`
    )) as LyraKnownDate;
    await el.updateComplete;

    const defaultTarget = el.validationTarget;
    const anchor = document.createElement('span');
    expect(defaultTarget === fields(el)[0]).to.be.true;

    el.validationTarget = anchor;
    expect(el.validationTarget === anchor).to.equal(true);

    el.validationTarget = undefined;
    expect(el.validationTarget === defaultTarget).to.equal(true);
  });
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

it('announces a newly shown validation error once through a pre-mounted assertive light-DOM sink', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-known-date') as LyraKnownDate;
  el.locale = 'en-GB';
  container.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  let sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  expect(sink !== null, 'the sink exists before validation changes').to.be.true;
  expect(sink.childElementCount).to.equal(0);
  const errorPart = el.shadowRoot!.querySelector<HTMLElement>('[part="error"]')!;
  expect(errorPart.hasAttribute('role')).to.be.false;
  expect(errorPart.hasAttribute('aria-live')).to.be.false;

  typeInto(fieldFor(el, 'day'), '30');
  typeInto(fieldFor(el, 'month'), '2');
  typeInto(fieldFor(el, 'year'), '2026');
  fieldFor(el, 'year').dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
  await el.updateComplete;
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Enter a valid date.']);

  el.requestUpdate();
  await el.updateComplete;
  expect(sink.childElementCount, 'an unrelated render does not duplicate the error').to.equal(1);

  typeInto(fieldFor(el, 'day'), '28');
  await el.updateComplete;
  typeInto(fieldFor(el, 'day'), '30');
  await el.updateComplete;
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Enter a valid date.',
    'Enter a valid date.',
  ]);

  el.remove();
  expect(sink.isConnected).to.be.false;
  container.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;
  sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  expect(sink.childElementCount, 'reconnect does not replay the existing error').to.equal(0);
});

it('announces only newly visible accessible text from the slotted error', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-known-date') as LyraKnownDate;
  const error = document.createElement('span');
  error.slot = 'error';
  error.hidden = true;
  error.innerHTML = `
    <span aria-hidden="true">Decorative warning</span>
    <span data-visible aria-label="">Initial error</span>
    <span hidden>Hidden detail</span>
    <span style="visibility: hidden">CSS-hidden detail</span>
  `;
  el.append(error);
  container.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  expect(sink !== null, 'the assertive sink is pre-mounted').to.be.true;
  expect(sink.childElementCount).to.equal(0);

  const visible = error.querySelector<HTMLElement>('[data-visible]')!;
  visible.textContent = 'Visible error';
  await Promise.resolve();
  expect(sink.childElementCount, 'changes made while hidden stay silent').to.equal(0);

  error.hidden = false;
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Visible error']);

  const decoration = error.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  decoration.setAttribute('aria-hidden', ' TRUE ');
  decoration.textContent = 'Changed decoration';
  await Promise.resolve();
  expect(sink.childElementCount, 'aria-hidden text changes do not create a new message').to.equal(1);

  error.style.display = 'none';
  visible.textContent = 'Updated while CSS-hidden';
  await Promise.resolve();
  expect(sink.childElementCount, 'CSS-hidden changes stay silent').to.equal(1);

  error.style.removeProperty('display');
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Visible error',
    'Updated while CSS-hidden',
  ]);
});

it('announces visibility-overridden descendants without hidden parent text', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-known-date') as LyraKnownDate;
  const error = document.createElement('span');
  error.slot = 'error';
  error.innerHTML = `
    <span data-wrapper style="visibility: hidden">
      Excluded parent text
      <span data-visible style="visibility: visible">Initial exposed error</span>
    </span>
  `;
  el.append(error);
  container.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  const wrapper = error.querySelector<HTMLElement>('[data-wrapper]')!;
  const visible = error.querySelector<HTMLElement>('[data-visible]')!;

  visible.textContent = 'Exposed hidden error';
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Exposed hidden error']);

  wrapper.style.visibility = 'collapse';
  visible.textContent = 'Exposed collapsed error';
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Exposed hidden error',
    'Exposed collapsed error',
  ]);
});

it('tracks accessible error text through a forwarding slot and its assigned-node mutations', async () => {
  const wrapper = (await fixture(html`
    <known-date-error-forward-wrapper>
      <span slot="error">Initial forwarded error</span>
    </known-date-error-forward-wrapper>
  `)) as KnownDateErrorForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  const initial = wrapper.querySelector<HTMLElement>('[slot="error"]')!;
  initial.textContent = 'Changed forwarded error';
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Changed forwarded error']);

  initial.style.visibility = 'hidden';
  initial.textContent = 'Changed while forwarded error is hidden';
  await Promise.resolve();
  expect(sink.childElementCount, 'hidden assigned-node changes stay silent').to.equal(1);

  initial.style.visibility = 'visible';
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Changed forwarded error',
    'Changed while forwarded error is hidden',
  ]);

  const slot = el.querySelector('slot')!;
  const slotChanged = oneEvent(slot, 'slotchange');
  const replacement = document.createElement('span');
  replacement.slot = 'error';
  replacement.textContent = 'Replacement forwarded error';
  wrapper.replaceChildren(replacement);
  await slotChanged;
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Changed forwarded error',
    'Changed while forwarded error is hidden',
    'Replacement forwarded error',
  ]);
});

it('recreates its error observer in the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const descriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
  const NativeMutationObserver = frameWindow.MutationObserver;
  let constructions = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions += 1;
    }
  }
  Object.defineProperty(frameWindow, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });
  const el = (await fixture(html` <lr-known-date error-text="Initial frame error"></lr-known-date> `)) as LyraKnownDate;
  el.remove();
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(constructions, 'base and error observers use the adopted window').to.be.greaterThan(1);
  } finally {
    el.remove();
    if (descriptor) Object.defineProperty(frameWindow, 'MutationObserver', descriptor);
    else Reflect.deleteProperty(frameWindow, 'MutationObserver');
    frame.remove();
  }
});

it('keeps property errors silent while the host or a composed ancestor is hidden', async () => {
  const container = (await fixture(html`<div><lr-known-date></lr-known-date></div>`)) as HTMLDivElement;
  const el = container.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  expect(sink !== null).to.be.true;

  el.hidden = true;
  el.errorText = 'Hidden host error';
  await el.updateComplete;
  expect(sink.childElementCount, 'a hidden host does not announce').to.equal(0);

  el.hidden = false;
  await Promise.resolve();
  await el.updateComplete;
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Hidden host error']);

  container.style.visibility = 'hidden';
  el.errorText = 'Hidden ancestor error';
  await el.updateComplete;
  expect(sink.childElementCount, 'a CSS-hidden ancestor does not announce').to.equal(1);

  container.style.removeProperty('visibility');
  await Promise.resolve();
  await el.updateComplete;
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Hidden host error',
    'Hidden ancestor error',
  ]);

  container.hidden = true;
  el.errorText = 'Hidden-attribute ancestor error';
  await el.updateComplete;
  expect(sink.childElementCount).to.equal(2);

  container.hidden = false;
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal([
    'Hidden host error',
    'Hidden ancestor error',
    'Hidden-attribute ancestor error',
  ]);

  container.inert = true;
  el.errorText = 'Inert ancestor error';
  await el.updateComplete;
  expect(sink.childElementCount).to.equal(3);
  container.inert = false;
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Inert ancestor error');

  container.setAttribute('aria-hidden', ' TRUE ');
  el.errorText = 'ARIA-hidden ancestor error';
  await el.updateComplete;
  expect(sink.childElementCount).to.equal(4);
  container.setAttribute('aria-hidden', 'false');
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('ARIA-hidden ancestor error');
});

it('announces from a boxless host that explicitly overrides an ancestor hidden visibility', async () => {
  const container = (await fixture(html`
    <div style="visibility: hidden">
      <lr-known-date style="display: contents; visibility: visible"></lr-known-date>
    </div>
  `)) as HTMLDivElement;
  const el = container.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  el.errorText = 'Visible override error';
  await el.updateComplete;
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Visible override error']);
});

describe('auto-advance and backspace navigation', () => {
  it('auto-advances focus after the 2nd digit in day or month, but not after the 4th digit in year', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    typeInto(fieldFor(el, 'day'), '27');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === fieldFor(el, 'month')).to.equal(true);

    typeInto(fieldFor(el, 'month'), '03');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === fieldFor(el, 'year')).to.equal(true);

    fieldFor(el, 'year').focus();
    typeInto(fieldFor(el, 'year'), '2007');
    await el.updateComplete;
    // Nothing after year -- focus stays put instead of moving off the control.
    expect(el.shadowRoot!.activeElement === fieldFor(el, 'year')).to.equal(true);
  });

  it('moves focus to the previous field on Backspace in an already-empty field, without altering its content', async () => {
    const el = (await fixture(
      html`<lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;

    const month = fieldFor(el, 'month');
    month.value = '';
    month.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await el.updateComplete;

    month.focus();
    month.setSelectionRange(0, 0);
    month.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement === fieldFor(el, 'day')).to.equal(true);
    expect(fieldFor(el, 'day').value).to.equal('27'); // untouched by the previous field's Backspace
  });

  it('is a no-op pressing Backspace on the first field (locale order) when it is already empty', async () => {
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;

    const day = fieldFor(el, 'day');
    day.focus();
    day.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === day).to.equal(true);
  });
});

describe('arrow-key field-to-field navigation and RTL', () => {
  it('moves to the next field on ArrowRight at the end of the text, and to the previous on ArrowLeft at the start', async () => {
    const el = (await fixture(
      html`<lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;

    const day = fieldFor(el, 'day');
    day.focus();
    day.setSelectionRange(2, 2); // caret at the end of "27"
    day.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === fieldFor(el, 'month')).to.equal(true);

    const month = fieldFor(el, 'month');
    month.setSelectionRange(0, 0); // caret at the start
    month.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === day).to.equal(true);
  });

  it('flips which physical arrow key means "next field" under an inherited RTL ancestor, without changing the field order itself', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>
      </div>
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
    day.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === day).to.equal(true);

    // ArrowLeft-at-start now means "toward the next field" under RTL.
    day.setSelectionRange(0, 0);
    day.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === fieldFor(el, 'month')).to.equal(true);
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
      <form>
        <fieldset disabled><lr-known-date name="dob"></lr-known-date></fieldset>
      </form>
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
    el.formStateRestoreCallback('2007-03-27');
    expect(el.value).to.equal('2007-03-27');

    el.formStateRestoreCallback(new FormData());
    expect(el.value).to.equal('');
  });
});

describe('declarative value sanitization', () => {
  it('sanitizes a non-padded and a calendar-invalid declarative value to empty', async () => {
    const nonPadded = (await fixture(html`<lr-known-date value="2007-3-27"></lr-known-date>`)) as LyraKnownDate;
    expect(nonPadded.value).to.equal('');

    const invalid = (await fixture(html`<lr-known-date value="2007-02-30"></lr-known-date>`)) as LyraKnownDate;
    expect(invalid.value).to.equal('');
  });

  it('accepts valid four-digit ISO years below 100 without the Date constructor remap', async () => {
    const el = await fixture<LyraKnownDate>(html`
      <lr-known-date value="0001-01-01"></lr-known-date>
    `);
    expect(el.value).to.equal('0001-01-01');
    expect(el.parts).to.deep.equal({ day: '1', month: '1', year: '1' });
    expect(el.valueAsDate?.getFullYear()).to.equal(1);

    el.parts = { day: '29', month: '2', year: '4' };
    expect(el.value).to.equal('0004-02-29');
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

  it('zero-pads a valueAsDate year below 100 to canonical four-digit ISO', async () => {
    const el = await fixture<LyraKnownDate>(html`<lr-known-date></lr-known-date>`);
    const ancient = new Date(0);
    ancient.setHours(0, 0, 0, 0);
    ancient.setFullYear(99, 11, 31);

    el.valueAsDate = ancient;
    expect(el.value).to.equal('0099-12-31');
    expect(el.valueAsDate?.getFullYear()).to.equal(99);
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

  it('delivers exactly one public focus event for a trusted internal focus transition', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    let focusCount = 0;
    el.addEventListener('focus', () => focusCount++);
    fieldFor(el, 'day').focus();
    await Promise.resolve();
    expect(focusCount).to.equal(1);
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

  it('recognizes internal focus transitions after adoption without consulting ambient element constructors', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    el.remove();
    const descriptor = Object.getOwnPropertyDescriptor(window, 'HTMLInputElement');

    try {
      frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(el));
      await el.updateComplete;
      const day = fieldFor(el, 'day');
      const month = fieldFor(el, 'month');
      let blurCount = 0;
      el.addEventListener('blur', () => blurCount++);

      Object.defineProperty(window, 'HTMLInputElement', {
        configurable: true,
        value: class AmbientInputTrap {},
      });
      day.focus();
      month.focus();
      await el.updateComplete;

      expect(blurCount).to.equal(0);
    } finally {
      el.remove();
      if (descriptor) Object.defineProperty(window, 'HTMLInputElement', descriptor);
      frame.remove();
    }
  });

  it('does not mark touched from a blur caused by a field itself becoming disabled', async () => {
    // Regression test: disabling the control mid-focus force-blurs
    // whichever internal native field currently holds focus -- a platform reaction to the
    // field's own `?disabled=${this.effectiveDisabled}` binding turning true, not a user
    // interaction. onFieldBlur() unconditionally marking `touched = true` for it was, depending on
    // timing, capable of reentering an in-flight update and tripping Lit's dev-mode "scheduled an
    // update after an update completed" warning for a state flip nothing observable needed (a
    // disabled control is barred from validation regardless). Proven observably here:
    // re-enabling afterwards must still see the field as untouched.
    const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    const isTouched = () => (el as unknown as { touched: boolean }).touched;

    fieldFor(el, 'day').focus();
    await el.updateComplete;

    el.disabled = true;
    expect(isTouched(), 'a disable-forced blur must not mark touched').to.be.false;
    await el.updateComplete;
    el.disabled = false;
    await el.updateComplete;
    expect(isTouched(), 'still not touched after re-enabling').to.be.false;

    // A genuine user-driven blur (not caused by disablement) still marks touched, unchanged.
    fieldFor(el, 'day').focus();
    await el.updateComplete;
    fieldFor(el, 'day').blur();
    expect(isTouched(), 'a real blur still marks touched').to.be.true;
  });
});

describe('per-field labels', () => {
  it('reaches the rendered per-field label text and is wired through localize()', async () => {
    const el = (await fixture(html`
      <lr-known-date locale="en-GB" day-label="Jour" .strings=${{ knownDateMonth: 'Mois' }}></lr-known-date>
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

  it('keeps explicit empty and old-English per-field labels caller-owned', async () => {
    const el = (await fixture(html`
      <lr-known-date
        day-label="Day"
        month-label=""
        .strings=${{ knownDateDay: 'Jour', knownDateMonth: 'Mois', knownDateYear: 'Année' }}
      ></lr-known-date>
    `)) as LyraKnownDate;
    await el.updateComplete;
    const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="field-label"]')) as HTMLLabelElement[];
    expect(labels.find((label) => label.htmlFor === fieldFor(el, 'day').id)?.textContent).to.equal('Day');
    expect(labels.find((label) => label.htmlFor === fieldFor(el, 'month').id)?.textContent).to.equal('');
    expect(labels.find((label) => label.htmlFor === fieldFor(el, 'year').id)?.textContent).to.equal('Année');
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
    expect(assigned[0]!.textContent).to.equal('Birth date');
  });
});

describe('required-field asterisk', () => {
  it('appears only when both required and a real label are set', async () => {
    const el = (await fixture(html`<lr-known-date label="Birth date" required></lr-known-date>`)) as LyraKnownDate;
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

  // The tiers come from the library's one shared ladder, which matches both spellings of each
  // step in the same selector list -- so migrating from an upstream that spells them
  // small/medium/large is an attribute-value no-op rather than a rewrite.
  it('accepts the small/medium/large spellings at the same rendered field height as s/m/l', async () => {
    const heightOf = async (size: string): Promise<string> => {
      const el = (await fixture(html`<lr-known-date size=${size}></lr-known-date>`)) as LyraKnownDate;
      await el.updateComplete;
      return getComputedStyle(fieldFor(el, 'day')).minBlockSize;
    };
    for (const [alias, step] of [
      ['small', 's'],
      ['medium', 'm'],
      ['large', 'l'],
    ] as const) {
      expect(await heightOf(alias), alias).to.equal(await heightOf(step));
    }
  });

  // The shared ladder's own 2xs height is 1.25rem/20px; a text field is a pointer target, so the
  // per-tier floor clamps at WCAG 2.2 SC 2.5.8's 24px minimum rather than following it down.
  it('supports the 2xs tier, floored at the 24px pointer-target minimum', async () => {
    const el = (await fixture(html`<lr-known-date size="2xs"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.getAttribute('size')).to.equal('2xs');
    expect(getComputedStyle(fieldFor(el, 'day')).minBlockSize).to.equal('24px');
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
    const el = (await fixture(html`<lr-known-date label="Birth date" required></lr-known-date>`)) as LyraKnownDate;
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

  it('preserves an explicitly empty host aria-label on the fieldset', async () => {
    const el = (await fixture(
      html`<lr-known-date label="Ignored legend" aria-label=""></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    const fieldset = el.shadowRoot!.querySelector('[part="fieldset"]') as HTMLElement;
    expect(fieldset.hasAttribute('aria-label')).to.be.true;
    expect(fieldset.getAttribute('aria-label')).to.equal('');
  });

  it('wires aria-describedby, aria-invalid, and aria-required onto every field-input', async () => {
    const el = (await fixture(html`<lr-known-date hint="DD MM YYYY" required></lr-known-date>`)) as LyraKnownDate;
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

  it('forwards the field-agnostic "off" token to all three fields', async () => {
    const el = (await fixture(html`<lr-known-date autocomplete="off"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    for (const input of fields(el)) expect(input.getAttribute('autocomplete')).to.equal('off');
  });

  it('forwards a field-specific token only to the year field', async () => {
    const el = (await fixture(html`<lr-known-date autocomplete="one-time-code"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(fieldFor(el, 'day').hasAttribute('autocomplete')).to.be.false;
    expect(fieldFor(el, 'month').hasAttribute('autocomplete')).to.be.false;
    expect(fieldFor(el, 'year').getAttribute('autocomplete')).to.equal('one-time-code');
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

it('accepts Arabic-Indic and Persian digits and canonicalizes them to ISO ASCII', async () => {
  const arabic = (await fixture(html`<lr-known-date locale="ar"></lr-known-date>`)) as LyraKnownDate;
  typeInto(fieldFor(arabic, 'day'), '٢٧');
  typeInto(fieldFor(arabic, 'month'), '٠٣');
  typeInto(fieldFor(arabic, 'year'), '٢٠٠٧');
  await arabic.updateComplete;
  expect(arabic.value).to.equal('2007-03-27');
  expect(fieldFor(arabic, 'day').value).to.equal('27');

  const persian = (await fixture(html`<lr-known-date locale="fa"></lr-known-date>`)) as LyraKnownDate;
  typeInto(fieldFor(persian, 'day'), '۲۷');
  typeInto(fieldFor(persian, 'month'), '۰۳');
  typeInto(fieldFor(persian, 'year'), '۲۰۰۷');
  await persian.updateComplete;
  expect(persian.value).to.equal('2007-03-27');
});

it('forwards host click() to the first field in locale order', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-US"></lr-known-date>`)) as LyraKnownDate;
  let clicks = 0;
  fieldFor(el, 'month').addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);

  el.disabled = true;
  await el.updateComplete;
  el.click();
  expect(clicks).to.equal(1);
});

it('contains long labels and messages inside a narrow allocation', async () => {
  const wrapper = await fixture(html`
    <div style="inline-size: 320px; overflow: auto;">
      <lr-known-date
        label="ExtremelyLongUnbrokenLocalizedBirthDateFieldLabelThatMustWrap"
        day-label="ExtremelyLongUnbrokenDayLabelThatMustWrap"
        hint="ExtremelyLongUnbrokenLocalizedHintThatMustWrapInsideTheControl"
      ></lr-known-date>
    </div>
  `);
  const el = wrapper.querySelector('lr-known-date') as LyraKnownDate;
  await el.updateComplete;
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
});

describe('per-tier field min-height and exact-height hatch', () => {
  const anyField = (el: LyraKnownDate): HTMLElement =>
    el.shadowRoot!.querySelector('[part="field-input"]') as HTMLElement;

  it('does NOT declare the --lr-known-date-field-height sentinel (guards the lr-select trap)', async () => {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(getComputedStyle(el).getPropertyValue('--lr-known-date-field-height').trim()).to.equal('');
  });

  it("wires --lr-known-date-field-min-height per tier (rendered min-block-size), matching lr-input's own scale", async () => {
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
    const inputWrapper = input.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
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
    const rect = field.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(field).borderColor).to.not.equal(restBorder);
    } finally {
      await resetMouse();
    }
  });

  // Hover is border-only here, so an appearance that repaints the border out-ranking the hover rule
  // leaves that appearance with no pointer feedback whatsoever -- not a dimmer one.
  for (const appearance of ['outlined', 'filled', 'filled-outlined'] as const) {
    it(`changes the border color on hover in the ${appearance} appearance`, async () => {
      const el = (await fixture(html`
        <lr-known-date appearance=${appearance} style="--lr-transition-fast: 0s"></lr-known-date>
      `)) as LyraKnownDate;
      await el.updateComplete;
      const field = el.shadowRoot!.querySelector('[part="field-input"]') as HTMLElement;
      const restBorder = getComputedStyle(field).borderTopColor;
      const rect = field.getBoundingClientRect();
      try {
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        await waitUntil(
          () => getComputedStyle(field).borderTopColor !== restBorder,
          `${appearance} field never picked up its hover border`,
        );
      } finally {
        await resetMouse();
      }
    });
  }
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
    // The invariant is that the fallback arm still resolves to --lr-color-danger -- NOT that danger
    // is any particular hex. Resolving the token here rather than restating its value keeps this
    // honest across a palette regeneration, which is exactly what broke the literal it replaced.
    const probe = document.createElement('span');
    probe.style.color = getComputedStyle(el).getPropertyValue('--lr-color-danger').trim();
    el.shadowRoot!.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    expect(danger).to.match(/^rgb/);
    expect(getComputedStyle(field).borderColor).to.equal(danger);
  });
});

describe('lifecycle: willUpdate calls super', () => {
  it('calls super.willUpdate() so a future base-class/mixin hook is not silently skipped', async () => {
    let sawCall = false;
    const basePrototype = LyraElement.prototype as unknown as {
      willUpdate: (changed: PropertyValues) => void;
    };
    const original = basePrototype.willUpdate;
    basePrototype.willUpdate = function (this: LyraElement, changed: PropertyValues) {
      sawCall = true;
      return (original as (changed: PropertyValues) => void).call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-known-date locale="en-GB"></lr-known-date>`)) as LyraKnownDate;
      await el.updateComplete;
      expect(sawCall).to.be.true;
    } finally {
      basePrototype.willUpdate = original;
    }
  });
});

// -- Host focus/blur forwarding to the internal fields ----------------------

it('focus() activates the first field in locale order and blur() releases it', async () => {
  const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  el.focus();
  const focused = el.shadowRoot!.activeElement as HTMLInputElement | null;
  expect(focused != null, 'focus() reaches an internal field').to.equal(true);
  expect(focused!.tagName).to.equal('INPUT');
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

describe('lr-known-date implicit form submission', () => {
  const enterOn = (el: LyraKnownDate, init: KeyboardEventInit = {}) =>
    fields(el)[0]!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      }),
    );

  it('submits the ancestor form when Enter is pressed in a date field', async () => {
    const form = (await fixture(html`
      <form>
        <lr-known-date name="bday" value="2007-03-27" label="Birthdate"></lr-known-date>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    let submits = 0;
    let submittedValue: string | null = null;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submits += 1;
      submittedValue = new FormData(form).get('bday') as string | null;
    });
    enterOn(el);
    expect(submits).to.equal(1);
    expect(submittedValue).to.equal('2007-03-27');
  });

  it('flushes a pending change before submitting, so a listener sees the committed date', async () => {
    const form = (await fixture(html`
      <form><lr-known-date name="bday" label="Birthdate"></lr-known-date></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    const order: string[] = [];
    el.addEventListener('change', () => order.push('change'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      order.push('submit');
    });
    for (const input of fields(el)) {
      input.value = input.dataset['field'] === 'year' ? '2007' : input.dataset['field'] === 'month' ? '03' : '27';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    }
    await el.updateComplete;
    expect(el.value, 'the three fields resolve to a real date').to.equal('2007-03-27');
    enterOn(el);
    expect(order.join(','), 'change is flushed ahead of the submission').to.equal('change,submit');
  });

  it('submits through an lr-button submitter, which requestSubmit() itself would reject', async () => {
    const form = (await fixture(html`
      <form>
        <lr-known-date name="bday" value="2007-03-27" label="Birthdate"></lr-known-date>
        <lr-button type="submit" name="action" value="save">Go</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    let submits = 0;
    let submitterName = '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submits += 1;
      submitterName = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.name ?? '';
    });
    enterOn(el);
    expect(submits).to.equal(1);
    expect(submitterName, 'the lr-button was the submitter').to.equal('action');
  });

  it('never submits while readonly, on a held modifier, during IME composition, or after a veto', async () => {
    const form = (await fixture(html`
      <form>
        <lr-known-date name="bday" value="2007-03-27" label="Birthdate"></lr-known-date>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submits += 1;
    });
    enterOn(el, { shiftKey: true });
    enterOn(el, { ctrlKey: true });
    enterOn(el, { altKey: true });
    enterOn(el, { metaKey: true });
    enterOn(el, { isComposing: true });
    expect(submits).to.equal(0);

    // Capture on the host runs before the internal input's own listener.
    const veto = (e: Event): void => e.preventDefault();
    el.addEventListener('keydown', veto, true);
    enterOn(el);
    el.removeEventListener('keydown', veto, true);
    expect(submits).to.equal(0);

    el.readonly = true;
    await el.updateComplete;
    enterOn(el);
    expect(submits, 'a readonly control never submits').to.equal(0);

    el.readonly = false;
    await el.updateComplete;
    enterOn(el);
    expect(submits, 'a bare Enter still submits').to.equal(1);
  });
});

it('falls back to month/day/year ordering and ASCII digits under an unusable locale', async () => {
  const el = (await fixture(html`<lr-known-date lang="!!"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  expect(fieldOrder(el)).to.deep.equal(['month', 'day', 'year']);

  const month = fieldFor(el, 'month');
  month.value = '0a3';
  month.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(month.value).to.equal('03');
});

it('normalizes locale-native digits into the canonical ISO value', async () => {
  const el = (await fixture(html`<lr-known-date lang="fa"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  const type = (name: 'day' | 'month' | 'year', text: string): void => {
    const input = fieldFor(el, name);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };
  type('year', '۲۰۲۴');
  type('month', '۰۳');
  type('day', '۰۹');
  await el.updateComplete;
  expect(el.value).to.equal('2024-03-09');
});

it('uses caller-supplied field labels ahead of the localized defaults', async () => {
  const el = (await fixture(html`
    <lr-known-date day-label="Jour" month-label="Mois" year-label="Annee"></lr-known-date>
  `)) as LyraKnownDate;
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="field-label"]')].map((label) => label.textContent!.trim());
  expect(labels).to.include.members(['Jour', 'Mois', 'Annee']);
});

it('treats a null min/max assignment as no bound at all', async () => {
  const el = (await fixture(
    html`<lr-known-date value="2024-03-09" min="2024-01-01" max="2024-12-31"></lr-known-date>`,
  )) as LyraKnownDate;
  await el.updateComplete;
  expect(el.checkValidity()).to.equal(true);

  el.min = null as unknown as string;
  el.max = null as unknown as string;
  await el.updateComplete;
  expect(el.min).to.equal('');
  expect(el.max).to.equal('');
  expect(el.checkValidity()).to.equal(true);
});

it('rejects a non-padded or calendar-impossible declarative value', async () => {
  const loose = (await fixture(html`<lr-known-date value="2007-3-27"></lr-known-date>`)) as LyraKnownDate;
  await loose.updateComplete;
  expect(loose.value).to.equal('');

  const impossible = (await fixture(html`<lr-known-date value="2007-02-30"></lr-known-date>`)) as LyraKnownDate;
  await impossible.updateComplete;
  expect(impossible.value).to.equal('');

  const valid = (await fixture(html`<lr-known-date value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
  await valid.updateComplete;
  expect(valid.value).to.equal('2007-03-27');
  valid.value = '';
  await valid.updateComplete;
  expect(valid.value).to.equal('');
  expect(fields(valid).map((input) => input.value)).to.deep.equal(['', '', '']);
});

// A control barred from constraint validation is neither :valid nor :invalid natively -- a real
// `<input required disabled>` and `<input required readonly>` both match neither -- so a barred
// composite date must publish no violation at all. This override used to guard only `readonly`, so
// a disabled required field kept `valueMissing` raised and `:state(invalid)` published.
describe('lr-known-date barred from constraint validation', () => {
  it('reports no violation while disabled, and restores it on re-enable', async () => {
    const el = (await fixture(html`<lr-known-date required disabled></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing while disabled').to.be.false;
    expect(el.validationMessage, 'no message while disabled').to.equal('');

    el.disabled = false;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing once enabled').to.be.true;
  });

  it('reports no range violation while disabled', async () => {
    const el = (await fixture(
      html`<lr-known-date value="2026-07-15" min="2026-08-01" disabled></lr-known-date>`,
    )) as LyraKnownDate;
    await el.updateComplete;
    expect(el.validity.rangeUnderflow, 'rangeUnderflow while disabled').to.be.false;
    expect(el.validity.valid, 'valid while disabled').to.be.true;
  });

  it('reports no violation inside a disabled fieldset', async () => {
    const form = (await fixture(html`
      <form>
        <fieldset disabled><lr-known-date required></lr-known-date></fieldset>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-known-date') as LyraKnownDate;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing inside a disabled fieldset').to.be.false;
    expect(el.checkValidity(), 'checkValidity() inside a disabled fieldset').to.be.true;
  });

  it('still reports no violation while readonly', async () => {
    const el = (await fixture(html`<lr-known-date required readonly></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing while readonly').to.be.false;
  });
});

// The remaining tests close narrow, hard-to-reach branches in known-date.class.ts: defensive
// fallbacks for a caller-supplied `parts`/`value` that skips normal per-keystroke digit
// normalization, forced Intl-formatter failures, and a stripped-down adopted realm missing
// several platform globals. Five structurally-present branches are NOT covered here because
// call-site tracing (and, in two cases, the DOM spec itself) shows they are unreachable through
// this class's own call graph:
//   - parseISO()'s own `isNaN(date.getTime())` check: never true given its regex-gated inputs are
//     always finite digit-only numbers, and `new Date(y, m, d)` never returns Invalid Date for any
//     finite numeric arguments (it rolls over out-of-range values instead).
//   - the `locale || undefined` fallback in `localeDateOrder()` and in `normalizeFieldDigits()`:
//     both are only ever called with `this.effectiveLocale`, which (via `resolveIntlLocale()`)
//     always resolves to a non-empty tag, so the falsy side of `||` can never be taken.
//   - `observeErrorNode()`'s own `!this.errorObserver` guard: redundant with its sole caller
//     (`bindErrorObserverTargets()`)'s identical guard one frame up, which already returns first.
//   - `observeErrorNode()`'s final `node.nodeType !== 1` guard: per the DOM spec, only Element and
//     Text nodes are ever "slottables" (declarative slot="x", fallback content, or the imperative
//     `slot.assign()` API all enforce this) and `this` is always an Element, so every real caller
//     hands this function only Element or Text nodes -- by the time the earlier `nodeType === 3`
//     check has already returned for Text, the remaining node is guaranteed to be an Element.

it("tolerates a non-digit parts assignment that survives computeCanonicalValue's blank guard but fails the stricter ISO regex", async () => {
  // parseISO()'s own `!match` branch (it is never exported, so this is the only way to reach it):
  // every internal caller already pre-validates with an equivalent regex before calling it, EXCEPT
  // the public `parts` setter, which stores whatever strings a caller supplies verbatim.
  const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  el.parts = { day: 'xx', month: '03', year: '2007' };
  await el.updateComplete;
  expect(el.value, 'a non-numeric day never resolves to a composite value').to.equal('');
});

it('tolerates a null or partial parts assignment, defaulting missing fields to empty strings', async () => {
  const el = (await fixture(html`<lr-known-date value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;

  el.parts = null as unknown as LyraKnownDateParts;
  await el.updateComplete;
  expect(el.parts).to.deep.equal({ day: '', month: '', year: '' });
  expect(el.value).to.equal('');

  el.parts = { day: '27' } as unknown as LyraKnownDateParts;
  await el.updateComplete;
  expect(el.parts, 'month/year missing from the assignment default to empty').to.deep.equal({
    day: '27',
    month: '',
    year: '',
  });
  expect(el.value, 'an incomplete parts assignment never produces a composite value').to.equal('');
});

it('treats a null or undefined value assignment as an empty composite value', async () => {
  const el = (await fixture(html`<lr-known-date value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  el.value = null as unknown as string;
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(el.parts).to.deep.equal({ day: '', month: '', year: '' });
});

it('falls back to month/day/year field order when Intl reports fewer than three date fields', async () => {
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  Intl.DateTimeFormat.prototype.formatToParts = function (...args: Parameters<typeof original>) {
    return original.apply(this, args).filter((p) => p.type !== 'year');
  };
  try {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(fieldOrder(el)).to.deep.equal(['month', 'day', 'year']);
  } finally {
    Intl.DateTimeFormat.prototype.formatToParts = original;
  }
});

it('falls back to the hardcoded month/day/year order when Intl.DateTimeFormat.formatToParts throws', async () => {
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  Intl.DateTimeFormat.prototype.formatToParts = function () {
    throw new RangeError('forced failure for coverage');
  };
  try {
    const el = (await fixture(html`<lr-known-date></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    expect(fieldOrder(el)).to.deep.equal(['month', 'day', 'year']);
  } finally {
    Intl.DateTimeFormat.prototype.formatToParts = original;
  }
});

it('still normalizes Arabic-Indic and Persian digits when Intl.NumberFormat construction throws', async () => {
  // A fresh, never-before-used locale in this file guarantees a cache miss in getNumberFormat()'s
  // shared memo, so the forced-throwing constructor actually runs instead of returning a formatter
  // some earlier test already cached.
  const original = Intl.NumberFormat;
  Intl.NumberFormat = function () {
    throw new RangeError('forced failure for coverage');
  } as unknown as typeof Intl.NumberFormat;
  try {
    const el = (await fixture(html`<lr-known-date locale="de-DE"></lr-known-date>`)) as LyraKnownDate;
    await el.updateComplete;
    typeInto(fieldFor(el, 'day'), '٠٩');
    expect(
      fieldFor(el, 'day').value,
      'the two static Unicode digit ranges remain available without the locale-native formatter',
    ).to.equal('09');
  } finally {
    Intl.NumberFormat = original;
  }
});

it('ignores a bubbling slotchange event whose target is not a forwarding slot element', async () => {
  // The child carries no slot attribute, so it is not assigned into any of this component's own
  // named shadow slots (label/hint/error) -- it only needs to bubble a 'slotchange' up to the host
  // itself, where onForwardedSlotChange listens for a forwarding wrapper's own slot changes.
  const el = (await fixture(html`<lr-known-date><div>plain child</div></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  const plainChild = el.querySelector('div')!;
  expect(() => plainChild.dispatchEvent(new Event('slotchange', { bubbles: true }))).to.not.throw();
  await el.updateComplete;
  expect(el.value).to.equal('');
});

it('observes a bare text fallback node reached through a forwarding slot', async () => {
  const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const shadow = host.attachShadow({ mode: 'open' });
  const el = document.createElement('lr-known-date') as LyraKnownDate;
  const errorSlot = document.createElement('slot');
  errorSlot.name = 'error';
  errorSlot.slot = 'error';
  // Not overridden by an outer consumer, so assignedNodes({flatten:true}) falls back to this
  // literal child -- a bare text node, covering observeErrorNode()'s characterData branch. (A
  // sibling comment node was tried here too, but per the DOM spec only Element/Text nodes are ever
  // "slottables" -- a Comment is silently excluded by assignedNodes() itself before this class's
  // own code ever sees it, so observeErrorNode()'s final `nodeType !== 1` guard is unreachable
  // through any real caller and is not covered here.)
  errorSlot.append(document.createTextNode('fallback text'));
  el.append(errorSlot);
  shadow.append(el);
  await el.updateComplete;
  expect(el.isConnected, 'renders without throwing on a text-node slot fallback').to.be.true;
});

it('excludes a comment node while computing the announced slotted error text', async () => {
  const el = (await fixture(html`
    <lr-known-date>
      <span slot="error">Initial</span>
    </lr-known-date>
  `)) as LyraKnownDate;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  const span = el.querySelector('span[slot="error"]')!;
  span.append(document.createComment(' ignored comment '), document.createTextNode(' more'));
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Initial more']);
});

it("prefers a nested element's own non-empty aria-label over its visible text when announcing", async () => {
  const el = (await fixture(html`
    <lr-known-date>
      <span slot="error">Initial</span>
    </lr-known-date>
  `)) as LyraKnownDate;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)!;
  const outer = el.querySelector('span[slot="error"]')!;
  outer.innerHTML = '<span aria-label="Read this instead">Visually different text</span>';
  await Promise.resolve();
  expect(Array.from(sink.children, (node) => node.textContent)).to.deep.equal(['Read this instead']);
});

it('focus() falls back to the first field in locale order once every field is already filled', async () => {
  const el = (await fixture(html`<lr-known-date locale="en-GB" value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
  await el.updateComplete;
  el.focus();
  const focused = el.shadowRoot!.activeElement as HTMLInputElement | null;
  expect(focused?.dataset['field']).to.equal('day');
});

it('falls back to ambient globals in a window missing MutationObserver, requestAnimationFrame, Event, and InputEvent', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const removable = ['MutationObserver', 'requestAnimationFrame', 'Event', 'InputEvent'] as const;
  const descriptors = new Map(
    removable.map((name) => [name, Object.getOwnPropertyDescriptor(frameWindow, name)] as const),
  );
  for (const name of removable) delete (frameWindow as unknown as Record<string, unknown>)[name];

  const el = (await fixture(html`<lr-known-date value="2007-03-27"></lr-known-date>`)) as LyraKnownDate;
  el.remove();
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(
      (el as unknown as { errorObserver?: MutationObserver }).errorObserver,
      'no MutationObserver constructor available in the adopted realm',
    ).to.equal(undefined);

    // Lets connectedCallback's own promise chain settle without requestAnimationFrame -- it falls
    // back to a bare Promise.resolve() when the adopted window has none.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    typeInto(fieldFor(el, 'day'), '5');
    fieldFor(el, 'day').dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
    expect(el.value, 'still commits through the module-level Event/InputEvent fallback').to.equal('2007-03-05');
  } finally {
    el.remove();
    for (const name of removable) {
      const descriptor = descriptors.get(name);
      if (descriptor) Object.defineProperty(frameWindow, name, descriptor);
    }
    frame.remove();
  }
});
