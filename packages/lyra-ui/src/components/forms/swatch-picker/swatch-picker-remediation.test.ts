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
    else el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="swatch"]')!.click();
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
  expect(el.shadowRoot!.activeElement?.part.contains('swatch')).to.equal(true);
  expect(focuses).to.equal(1);
});

const key = (el: LyraSwatchPicker, from: number, name: string): void => {
  el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="swatch"]')[from]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true }),
  );
};

it('tags the selected swatch with the swatch-selected part so it can be styled from outside', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><style>lr-swatch-picker::part(swatch-selected) { opacity: 0.5; }</style><lr-swatch-picker aria-label="Pick" value="b" .items=${items}></lr-swatch-picker></div>`);
  const el = wrapper.querySelector<LyraSwatchPicker>('lr-swatch-picker')!;
  await el.updateComplete;
  const [first, second] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="swatch"]')];
  expect(getComputedStyle(first!).opacity).to.equal('1');
  expect(getComputedStyle(second!).opacity).to.equal('0.5');
});

it('moves through a wrapped row with Up and Down as well as Left and Right', async () => {
  const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Pick" value="a" .items=${items}></lr-swatch-picker>`);
  await el.updateComplete;
  key(el, 0, 'ArrowDown');
  expect(el.value).to.equal('b');
  key(el, 1, 'ArrowUp');
  expect(el.value).to.equal('a');
});

it('renders an unavailable swatch disabled and keeps it out of selection and navigation', async () => {
  const row = [items[0]!, { ...items[1]!, disabled: true }, { value: 'c', color: 'var(--lr-color-warning)', label: 'Gamma' }];
  const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Pick" value="a" .items=${row}></lr-swatch-picker>`);
  await el.updateComplete;
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="swatch"]')];
  expect(buttons.map((button) => button.disabled)).to.deep.equal([false, true, false]);
  buttons[1]!.click();
  expect(el.value).to.equal('a');
  key(el, 0, 'ArrowRight');
  expect(el.value).to.equal('c');
  el.value = 'b';
  await el.updateComplete;
  expect(buttons.map((button) => button.tabIndex)).to.deep.equal([0, -1, -1]);
});
