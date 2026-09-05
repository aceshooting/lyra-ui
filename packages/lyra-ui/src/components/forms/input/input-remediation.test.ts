import { aTimeout, expect, fixture } from '@open-wc/testing';
import type { LyraInput } from './input.js';
import type { LyraTimeInput } from './time-input.js';
import './input.js';
import './number-input.js';
import './native-time-input.js';
import './time-input.js';

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
