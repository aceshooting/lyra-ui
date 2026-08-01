import { fixture, expect, html } from '@open-wc/testing';
import type { LyraNumberInput } from './number-input.class.js';
import './number-input.js';
import './time-input.js';

it('forces number-input to native number semantics and preserves range validation', async () => {
  const el = await fixture(html`<lr-number-input min="1" max="10" step="1"></lr-number-input>`);
  expect(el.type).to.equal('number');
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('number');
  (el as any).value = '20';
  expect((el as any).checkValidity()).to.be.false;
  await expect(el).to.be.accessible();
});

it('forces time-input to native time semantics', async () => {
  const el = await fixture(html`<lr-time-input label="Start time"></lr-time-input>`);
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('time');
  await expect(el).to.be.accessible();
});

// -- lr-number-input steppers (8.0) -----------------------------------------

describe('lr-number-input steppers', () => {
  const upOf = (el: Element) => el.shadowRoot!.querySelector('[part="stepper-up"]') as HTMLButtonElement;
  const downOf = (el: Element) => el.shadowRoot!.querySelector('[part="stepper-down"]') as HTMLButtonElement;

  it('renders an increment/decrement pair by default and hides the browser spin buttons', async () => {
    const el = (await fixture(
      html`<lr-number-input value="4" min="0" max="10" step="2" label="Qty"></lr-number-input>`,
    )) as LyraNumberInput;
    expect(el.steppers).to.be.true;
    expect(el.withoutSpinButtons).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="stepper-up"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="stepper-down"]').length).to.equal(1);
    const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(getComputedStyle(native).appearance).to.equal('textfield');
  });

  it('steps the value on click and reports it as a user edit', async () => {
    const el = (await fixture(
      html`<lr-number-input value="4" min="0" max="10" step="2" label="Qty"></lr-number-input>`,
    )) as LyraNumberInput;
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    upOf(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('6');
    downOf(el).click();
    downOf(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('2');
    expect(seen).to.deep.equal(['input', 'change', 'input', 'change', 'input', 'change']);
  });

  it('emits nothing when a click cannot move the value (already at the bound)', async () => {
    const el = (await fixture(
      html`<lr-number-input value="10" min="0" max="10" step="1" label="Qty"></lr-number-input>`,
    )) as LyraNumberInput;
    const seen: string[] = [];
    el.addEventListener('lr-input', () => seen.push('lr-input'));
    upOf(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('10');
    expect(seen).to.deep.equal([]);
  });

  it('disables both steppers while disabled or readonly', async () => {
    const disabled = (await fixture(html`<lr-number-input disabled label="a"></lr-number-input>`)) as LyraNumberInput;
    expect(upOf(disabled).disabled).to.be.true;
    expect(downOf(disabled).disabled).to.be.true;
    const readonlyEl = (await fixture(html`<lr-number-input readonly label="b"></lr-number-input>`)) as LyraNumberInput;
    expect(upOf(readonlyEl).disabled).to.be.true;
    expect(downOf(readonlyEl).disabled).to.be.true;
  });

  it('renders no steppers when opted out with steppers="false", and restores the browser spin buttons with without-spin-buttons="false"', async () => {
    const el = (await fixture(
      html`<lr-number-input steppers="false" without-spin-buttons="false" label="Qty"></lr-number-input>`,
    )) as LyraNumberInput;
    expect(el.steppers).to.be.false;
    expect(el.withoutSpinButtons).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="stepper-up"]').length).to.equal(0);
    expect(getComputedStyle(el.shadowRoot!.querySelector('input') as HTMLInputElement).appearance).to.not.equal(
      'textfield',
    );
  });

  it('floors both stepper hit areas at the shared icon-button size', async () => {
    const el = (await fixture(html`<lr-number-input label="Qty"></lr-number-input>`)) as LyraNumberInput;
    for (const button of [upOf(el), downOf(el)]) {
      const box = button.getBoundingClientRect();
      expect(box.width).to.be.at.least(40);
      expect(box.height).to.be.at.least(40);
    }
  });

  it('localizes both stepper labels', async () => {
    const el = (await fixture(html`<lr-number-input label="Qty"></lr-number-input>`)) as LyraNumberInput;
    el.strings = { numberInputIncrease: 'Augmenter', numberInputDecrease: 'Diminuer' };
    await el.updateComplete;
    expect(upOf(el).getAttribute('aria-label')).to.equal('Augmenter');
    expect(downOf(el).getAttribute('aria-label')).to.equal('Diminuer');
  });

  it('is accessible with the steppers rendered', async () => {
    const el = (await fixture(html`<lr-number-input label="Qty" value="3"></lr-number-input>`)) as LyraNumberInput;
    expect(el.shadowRoot!.querySelectorAll('[part="stepper-up"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

it('rotates the shared chevron into a real up/down pair rather than shipping an inert rule', async () => {
  const el = (await fixture(html`<lr-number-input label="Qty"></lr-number-input>`)) as LyraNumberInput;
  const up = el.shadowRoot!.querySelector('[part="stepper-up"] svg') as SVGElement;
  const down = el.shadowRoot!.querySelector('[part="stepper-down"] svg') as SVGElement;
  expect(getComputedStyle(up).transform).to.equal('matrix(0, -1, 1, 0, 0, 0)');
  expect(getComputedStyle(down).transform).to.equal('matrix(0, 1, -1, 0, 0, 0)');
});
