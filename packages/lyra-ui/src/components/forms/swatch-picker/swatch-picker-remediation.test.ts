import { expect, fixture, html } from '@open-wc/testing';
import type { LyraSwatchPicker } from './swatch-picker.js';
import './swatch-picker.js';

const items = [{ value: 'a', color: 'var(--lr-color-brand)', label: 'Alpha' }, { value: 'b', color: 'var(--lr-color-success)', label: 'Beta' }];

for (const path of ['host', 'native']) {
  it(`swatch-picker blocks same-task disabled ${path} activation`, async () => {
    const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Pick" .items=${items}></lr-swatch-picker>`);
    const original = el.value;
    const changes: string[] = [];
    el.addEventListener('lr-change', (event) => changes.push(event.detail.value));
    el.disabled = true;
    if (path === 'host') el.click();
    else el.shadowRoot!.querySelector<HTMLButtonElement>('[part="swatch"]')!.click();
    expect(el.value).to.equal(original);
    expect(changes).to.deep.equal([]);
    await el.updateComplete;
    el.disabled = false;
    await el.updateComplete;
    el.click();
    expect(el.value).to.equal('a');
    expect(changes).to.deep.equal(['a']);
  });
}

it('swatch-picker preserves outside focus and emits no internal focus after same-task disablement', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><button>Outside</button><lr-swatch-picker aria-label="Pick" .items=${items}></lr-swatch-picker></div>`);
  const outside = wrapper.querySelector('button')!;
  const el = wrapper.querySelector<LyraSwatchPicker>('lr-swatch-picker')!;
  await el.updateComplete;
  outside.focus();
  let focuses = 0;
  el.shadowRoot!.addEventListener('focus', () => focuses += 1, true);
  el.disabled = true;
  el.focus();
  expect(document.activeElement === outside).to.equal(true);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(focuses).to.equal(0);
  await el.updateComplete;
  el.disabled = false;
  await el.updateComplete;
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('swatch');
  expect(focuses).to.equal(1);
});
