import { aTimeout, expect, fixture } from '@open-wc/testing';
import type { LyraInput } from './input.js';
import type { LyraTimeInput } from './time-input.js';
import './input.js';
import './number-input.js';
import './native-time-input.js';
import './time-input.js';
import '../textarea/textarea.js';

for (const tag of ['lr-input', 'lr-number-input', 'lr-native-time-input', 'lr-time-input']) {
  for (const attribute of tag === 'lr-time-input' ? ['label', 'hint'] : ['label', 'hint', 'help-text', 'error-text']) {
    it(`${tag} safely renders removed ${attribute} without changing null readback`, async () => {
      const el = await fixture<LyraInput | LyraTimeInput>(`<${tag}></${tag}>`);
      const property = attribute === 'help-text' ? 'helpText' : attribute === 'error-text' ? 'errorText' : attribute;
      el.setAttribute(attribute, 'Guidance');
      await el.updateComplete;
      el.removeAttribute(attribute);
      await el.updateComplete;
      expect(Reflect.get(el, property)).to.equal(null);
      expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
      el.setAttribute(attribute, '');
      await el.updateComplete;
      expect(Reflect.get(el, property)).to.equal('');
      el.setAttribute(attribute, 'Recovered');
      await el.updateComplete;
      expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
    });
  }
}

for (const tag of ['lr-input', 'lr-number-input', 'lr-native-time-input']) {
  const time = tag === 'lr-native-time-input';
  it(`${tag} steps with pending step/min/max/value properties and remains event-silent`, async () => {
    const form = await fixture<HTMLFormElement>(`<form><${tag} name="value" type="${time ? 'time' : 'number'}" value="${time ? '09:06' : '6'}"></${tag}></form>`);
    const el = form.firstElementChild as LyraInput;
    await el.updateComplete;
    const native = document.createElement('input');
    native.type = time ? 'time' : 'number';
    const events: string[] = [];
    for (const event of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(event, () => events.push(event));
    el.step = time ? 180 : 3;
    el.stepUp();
    expect(el.value).to.equal(time ? '09:09' : '9');
    expect(new FormData(form).get('value')).to.equal(el.value);
    for (const [direction, value, min, max, step] of [
      ['down', time ? '09:12' : '12', time ? '09:06' : '6', time ? '09:30' : '30', time ? 180 : 3],
      ['up', time ? '09:12' : '12', time ? '09:06' : '6', time ? '09:12' : '12', time ? 180 : 3],
      ['down', time ? '09:09' : '9', time ? '09:09' : '9', time ? '09:30' : '30', time ? 60 : 1],
    ] as const) {
      el.value = value;
      el.min = time ? min : Number(min);
      el.max = time ? max : Number(max);
      el.step = step;
      native.min = min;
      native.max = max;
      native.step = String(step);
      native.value = value;
      if (direction === 'up') { native.stepUp(); el.stepUp(); }
      else { native.stepDown(); el.stepDown(); }
      expect(el.value).to.equal(native.value);
      expect(new FormData(form).get('value')).to.equal(native.value);
    }
    await el.updateComplete;
    await aTimeout(0);
    expect(events).to.deep.equal([]);
  });

  it(`${tag} preserves no-render, readonly, disabled, and step-any stepping guards`, async () => {
    const unmounted = document.createElement(tag) as LyraInput;
    expect(() => unmounted.stepUp()).not.to.throw();
    expect(unmounted.shadowRoot?.querySelector('input') === null || unmounted.shadowRoot === null).to.equal(true);
    const el = await fixture<LyraInput>(`<${tag} type="${time ? 'time' : 'number'}" value="${time ? '09:06' : '6'}"></${tag}>`);
    const original = el.value;
    el.readonly = true;
    el.stepUp();
    expect(el.value).to.equal(original);
    el.readonly = false;
    el.disabled = true;
    el.stepDown();
    expect(el.value).to.equal(original);
    el.disabled = false;
    el.step = 'any';
    expect(() => el.stepUp()).not.to.throw();
    expect(el.value).to.equal(original);
  });
}

for (const [type, min, max, below] of [
  ['date', '2026-01-01', '2026-12-31', '2025-06-01'],
  ['datetime-local', '2026-01-01T09:00', '2026-12-31T17:00', '2025-06-01T12:00'],
  ['time', '09:00', '17:00', '08:00'],
] as const) {
  it(`lr-input type="${type}" forwards min/max written as attributes to the native control`, async () => {
    const el = await fixture<LyraInput>(`<lr-input type="${type}" min="${min}" max="${max}" value="${below}"></lr-input>`);
    await el.updateComplete;
    const native = el.shadowRoot!.querySelector('input')!;
    expect([el.min, el.max, native.min, native.max]).to.deep.equal([min, max, min, max]);
    expect(el.validity.rangeUnderflow, 'the attribute bound constrains the value').to.equal(true);
  });
}

it('lr-input keeps the numeric readback of numeric min/max attributes', async () => {
  const el = await fixture<LyraInput>('<lr-input type="number" min="1.5" max="-2e1"></lr-input>');
  expect([el.min, el.max]).to.deep.equal([1.5, -20]);
});

for (const tag of ['lr-input', 'lr-number-input']) {
  it(`${tag} keeps updating when the engine rejects a custom state name`, async () => {
    const el = await fixture<LyraInput>(`<${tag}></${tag}>`);
    const states = (el as unknown as { internals: ElementInternals }).internals.states;
    const reject = (): never => {
      throw new DOMException('The state name is not a valid custom state.', 'SyntaxError');
    };
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent): void => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    Object.defineProperty(states, 'add', { configurable: true, value: reject });
    Object.defineProperty(states, 'delete', { configurable: true, value: reject });
    try {
      el.value = '12';
      await el.updateComplete;
      el.dispatchEvent(new FocusEvent('focusin'));
      el.dispatchEvent(new FocusEvent('focusout'));
      el.value = '';
      await el.updateComplete;
    } finally {
      delete (states as unknown as Record<string, unknown>)['add'];
      delete (states as unknown as Record<string, unknown>)['delete'];
      window.removeEventListener('error', onError);
    }
    expect(errors.length, 'no uncaught error from a rejected state name').to.equal(0);
    expect(el.value).to.equal('');
  });
}

it('lr-input paints its placeholder from --lr-input-placeholder-color, falling back to the action token', async () => {
  const el = await fixture<LyraInput>('<lr-input placeholder="Search" style="--lr-input-action-color: rgb(255, 0, 0)"></lr-input>');
  const native = el.shadowRoot!.querySelector('input')!;
  expect(getComputedStyle(native, '::placeholder').color).to.equal('rgb(255, 0, 0)');
  el.style.setProperty('--lr-input-placeholder-color', 'rgb(0, 0, 255)');
  expect(getComputedStyle(native, '::placeholder').color).to.equal('rgb(0, 0, 255)');
});

describe('lr-input valueAsLocalDate and valueAsUTCDate', () => {
  const fields = (date: Date | null) =>
    date ? [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()] : null;

  it('reads date, time and datetime-local values in both conventions, the UTC one matching valueAsDate', async () => {
    const date = await fixture<LyraInput>('<lr-input type="date" value="2026-10-06"></lr-input>');
    expect(fields(date.valueAsLocalDate)).to.deep.equal([2026, 9, 6, 0, 0, 0]);
    expect(date.valueAsUTCDate!.toISOString()).to.equal('2026-10-06T00:00:00.000Z');
    expect(date.valueAsUTCDate!.getTime()).to.equal(date.valueAsDate!.getTime());

    const time = await fixture<LyraInput>('<lr-input type="time" value="09:30:15"></lr-input>');
    const today = new Date();
    expect(fields(time.valueAsLocalDate)).to.deep.equal([today.getFullYear(), today.getMonth(), today.getDate(), 9, 30, 15]);
    expect(time.valueAsUTCDate!.toISOString()).to.equal('1970-01-01T09:30:15.000Z');
    expect(time.valueAsUTCDate!.getTime()).to.equal(time.valueAsDate!.getTime());

    const both = await fixture<LyraInput>('<lr-input type="datetime-local" value="2026-10-06T09:30"></lr-input>');
    expect(fields(both.valueAsLocalDate)).to.deep.equal([2026, 9, 6, 9, 30, 0]);
    expect(both.valueAsUTCDate!.toISOString()).to.equal('2026-10-06T09:30:00.000Z');

    const number = await fixture<LyraInput>('<lr-input type="number" value="5"></lr-input>');
    expect([number.valueAsLocalDate, number.valueAsUTCDate]).to.deep.equal([null, null]);
  });

  it('writes the matching fields silently, clears on null, and ignores types without a date reading', async () => {
    const el = await fixture<LyraInput>('<lr-input type="date"></lr-input>');
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
    const written: string[] = [];
    el.valueAsUTCDate = new Date('2026-12-31T00:00:00Z');
    written.push(el.value);
    el.valueAsLocalDate = new Date(2027, 0, 2, 23, 59);
    written.push(el.value);
    el.type = 'time';
    el.valueAsUTCDate = new Date(Date.UTC(1970, 0, 1, 7, 5));
    written.push(el.value);
    el.valueAsLocalDate = new Date(2026, 0, 1, 18, 45, 30);
    written.push(el.value);
    el.type = 'datetime-local';
    el.valueAsUTCDate = new Date('2026-03-29T01:30:00Z');
    written.push(el.value);
    el.valueAsLocalDate = null;
    written.push(el.value);
    el.type = 'number';
    el.value = '5';
    el.valueAsUTCDate = new Date();
    written.push(el.value);
    expect(written).to.deep.equal(['2026-12-31', '2027-01-02', '07:05', '18:45:30', '2026-03-29T01:30', '', '5']);
    expect(events).to.deep.equal([]);
  });
});

for (const tag of ['lr-input', 'lr-textarea']) {
  it(`${tag} mirrors the user-invalid state on the data-invalid host hook every Lyra field publishes`, async () => {
    const el = await fixture<LyraInput>(`<${tag} required label="Name"></${tag}>`);
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid'), 'pristine').to.equal(false);
    el.reportValidity();
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid'), 'after a submit attempt').to.equal(true);
    el.value = 'Ada';
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.equal(false);
  });
}

it('lr-input exposes selectionDirection like its sibling text fields', async () => {
  const el = await fixture<LyraInput>('<lr-input value="hello world"></lr-input>');
  await el.updateComplete;
  el.setSelectionRange(0, 5, 'backward');
  expect(el.selectionDirection).to.equal('backward');
  el.selectionDirection = 'forward';
  expect(el.shadowRoot!.querySelector('input')!.selectionDirection).to.equal('forward');
  el.selectionDirection = null;
  const native = el.shadowRoot!.querySelector('input')!;
  expect(el.selectionDirection, 'mirrors the native normalization of none').to.equal(native.selectionDirection);
});
