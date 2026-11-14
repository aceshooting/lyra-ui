import { expect, fixture, html } from '@open-wc/testing';
import './swatch-picker.js';
import type { LyraSwatchPicker } from './swatch-picker.js';

const checked = (el: LyraSwatchPicker): string[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="radio"]')].map((radio) => radio.getAttribute('aria-checked')!);

describe('lr-swatch-picker duplicate values', () => {
  it('moves the checked swatch to a re-picked duplicate without changing the value', async () => {
    const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Accent" .items=${[
      { value: 'red', color: '#d1242f', label: 'Red' },
      { value: 'red', color: '#cf222e', label: 'Brick' },
    ]}></lr-swatch-picker>`);
    const radios = el.shadowRoot!.querySelectorAll<HTMLElement>('[role="radio"]');
    radios[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('red');
    expect(checked(el)).to.deep.equal(['true', 'false']);

    const changes: string[] = [];
    el.addEventListener('lr-change', (event) => changes.push((event as CustomEvent<{ value: string }>).detail.value));
    radios[1]!.click();
    await el.updateComplete;

    expect(el.value).to.equal('red');
    expect(checked(el)).to.deep.equal(['false', 'true']);
    expect(changes).to.deep.equal(['red']);
  });
});
