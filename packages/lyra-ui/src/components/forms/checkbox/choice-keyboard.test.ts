import { expect, fixture } from '@open-wc/testing';
import type { LyraElement } from '../../../internal/lyra-element.js';
import './checkbox.js';
import '../switch/switch.js';
import '../radio/radio.js';
import '../radio/radio-group.js';
import '../slider/slider.js';
import '../toggle-group/toggle-group.js';
import '../toggle/toggle.js';
import '../select/select.js';
import '../combobox/combobox.js';

for (const [name, role, key] of [
  ['checkbox', 'checkbox', ' '], ['switch', 'switch', 'ArrowRight'],
  ['radio', 'radio', ' '], ['slider', 'slider', 'ArrowRight'],
  ['select', 'combobox', 'ArrowDown'], ['combobox', 'combobox', 'ArrowDown'],
]) {
  it(`${name} leaves modified, composing and consumed keys alone`, async () => {
    const host = await fixture<LyraElement>(`<lr-${name}></lr-${name}>`);
    const target = host.shadowRoot!.querySelector<HTMLElement>(`[role="${role}"]`)!;
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }, {}]) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      const consumed = !Object.keys(init).length;
      if (consumed) event.preventDefault();
      const before = ['aria-valuenow', 'aria-expanded', 'aria-checked'].map(attr => target.getAttribute(attr));
      target.dispatchEvent(event);
      await host.updateComplete;
      expect(event.defaultPrevented).to.equal(consumed);
      expect(['aria-valuenow', 'aria-expanded', 'aria-checked'].map(attr => target.getAttribute(attr))).to.deep.equal(before);
    }
  });
}

for (const name of ['radio', 'switch', 'checkbox']) {
  it(`${name} ignores a repeated Space activation`, async () => {
    const host = await fixture<LyraElement>(`<lr-${name}></lr-${name}>`);
    const target = host.shadowRoot!.querySelector('[aria-checked]')!;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, cancelable: true }));
    await host.updateComplete;
    expect(target.getAttribute('aria-checked')).to.equal('false');
    const press = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    target.dispatchEvent(press);
    await host.updateComplete;
    expect(press.defaultPrevented).to.equal(true);
    expect(target.getAttribute('aria-checked')).to.equal('true');
  });
}

for (const name of ['radio', 'toggle']) {
  it(`${name} group leaves composing navigation available`, async () => {
    const group = await fixture<LyraElement>(`<lr-${name}-group><lr-${name} value="one">One</lr-${name}><lr-${name} value="two">Two</lr-${name}></lr-${name}-group>`);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', isComposing: true, bubbles: true, composed: true, cancelable: true });
    group.firstElementChild!.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false);
  });
}

for (const name of ['checkbox', 'switch', 'radio'] as const) {
  it(`${name} reports the original user edit when an input listener replaces the value`, async () => {
    const control = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(`<lr-${name} value="original"></lr-${name}>`);
    const values: unknown[] = [];
    control.addEventListener('input', () => { control.value = 'replacement'; });
    for (const event of ['lr-input', 'lr-change']) {
      control.addEventListener(event, e => values.push((e as CustomEvent<{ value: string }>).detail.value));
    }
    control.click();
    expect(values).to.deep.equal(['original', 'original']);
    expect(control.value).to.equal('replacement');
  });
}

it('reports the slider position that triggered input and change when listeners move it again', async () => {
  const slider = await fixture<HTMLElementTagNameMap['lr-slider']>('<lr-slider value="10"></lr-slider>');
  const thumb = slider.shadowRoot!.querySelector('[role="slider"]')!;
  const values: number[] = [];
  slider.addEventListener('input', () => { slider.value = 20; });
  slider.addEventListener('change', () => { slider.value = 30; });
  for (const event of ['lr-input', 'lr-change']) {
    slider.addEventListener(event, e => values.push((e as CustomEvent<{ value: number }>).detail.value));
  }
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
  expect(values).to.deep.equal([11, 20]);
});

for (const name of ['checkbox', 'switch', 'radio'] as const) {
  for (const action of ['disable', 'remove'] as const) {
    it(`${name} still completes its committed change when its input listener requests ${action}`, async () => {
      const control = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(`<lr-${name}></lr-${name}>`);
      const events: string[] = [];
      control.addEventListener('input', () => {
        if (action === 'remove') control.remove();
        else control.disabled = true;
      });
      for (const type of ['lr-input', 'change', 'lr-change']) {
        control.addEventListener(type, () => events.push(type));
      }
      control.click();
      expect(control.checked).to.equal(true);
      expect(events).to.deep.equal(['lr-input', 'change', 'lr-change']);
    });
  }
}
