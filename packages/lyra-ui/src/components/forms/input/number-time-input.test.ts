import { fixture, expect, html } from '@open-wc/testing';
import type { LyraNumberInput } from './number-input.class.js';
import './number-input.js';
import './native-time-input.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const centerOf = (node: Element): [number, number] => {
  const rect = node.getBoundingClientRect();
  return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
};

it('inherits the shared input radius in number and native-time subclasses', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-input-radius: 18px">
      <lr-number-input></lr-number-input>
      <lr-native-time-input></lr-native-time-input>
    </div>
  `);
  for (const tagName of ['lr-number-input', 'lr-native-time-input']) {
    const el = wrapper.querySelector(tagName)!;
    const row = el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
    expect(getComputedStyle(row).borderTopLeftRadius, tagName).to.equal('18px');
  }
});

it('forces number-input to native number semantics and preserves range validation', async () => {
  const el = await fixture(html`<lr-number-input min="1" max="10" step="1"></lr-number-input>`);
  expect(el.type).to.equal('number');
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('number');
  (el as any).value = '20';
  expect((el as any).checkValidity()).to.be.false;
  await expect(el).to.be.accessible();
});

it('preserves native time semantics on native-time-input', async () => {
  const el = await fixture(html`<lr-native-time-input label="Start time"></lr-native-time-input>`);
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('time');
  await expect(el).to.be.accessible();
});

// -- lr-number-input steppers (8.0) -----------------------------------------

describe('lr-number-input steppers', () => {
  const upOf = (el: Element) => el.shadowRoot!.querySelector('[part~="stepper-up"]') as HTMLButtonElement;
  const downOf = (el: Element) => el.shadowRoot!.querySelector('[part~="stepper-down"]') as HTMLButtonElement;

  it('renders an increment/decrement pair by default and hides the browser spin buttons', async () => {
    const el = (await fixture(
      html`<lr-number-input value="4" min="0" max="10" step="2" label="Qty"></lr-number-input>`,
    )) as LyraNumberInput;
    expect(el.steppers).to.be.true;
    expect(el.withoutSpinButtons).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part~="stepper-up"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part~="stepper-down"]').length).to.equal(1);
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

  it('does not paint a hover affordance on a disabled stepper', async () => {
    const el = (await fixture(html`<lr-number-input disabled value="4" label="Qty"></lr-number-input>`)) as LyraNumberInput;
    const up = upOf(el);
    const resting = getComputedStyle(up).color;
    try {
      await sendMouse({ type: 'move', position: centerOf(up) });
      const hovered = getComputedStyle(up).color;
      expect(hovered, 'disabled stepper-up hover vs resting color').to.equal(resting);
    } finally {
      await resetMouse();
    }
  });

  it('does not paint a press affordance on a disabled stepper', async () => {
    const el = (await fixture(html`<lr-number-input disabled value="4" label="Qty"></lr-number-input>`)) as LyraNumberInput;
    const down = downOf(el);
    const restingColor = getComputedStyle(down).color;
    const restingBackground = getComputedStyle(down).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: centerOf(down) });
      await sendMouse({ type: 'down' });
      const pressedColor = getComputedStyle(down).color;
      const pressedBackground = getComputedStyle(down).backgroundColor;
      expect(pressedColor, 'disabled stepper-down active vs resting color').to.equal(restingColor);
      expect(pressedBackground, 'disabled stepper-down active vs resting background').to.equal(restingBackground);
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('renders no steppers when opted out with steppers="false", and restores the browser spin buttons with without-spin-buttons="false"', async () => {
    const el = (await fixture(
      html`<lr-number-input steppers="false" without-spin-buttons="false" label="Qty"></lr-number-input>`,
    )) as LyraNumberInput;
    expect(el.steppers).to.be.false;
    expect(el.withoutSpinButtons).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part~="stepper-up"]').length).to.equal(0);
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

  it('keeps stepper-bearing rows on the shared hit-floor-aware height ladder', async () => {
    const expected: Record<string, number> = { '2xs': 42, xs: 42, s: 42, m: 42, l: 48, xl: 56 };
    for (const [size, height] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-number-input size=${size} label="Qty"></lr-number-input>`)) as LyraNumberInput;
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      expect(row.getBoundingClientRect().height, `size=${size}`).to.equal(height);
    }
  });

  it('renders upstream size aliases at the canonical number-input geometry', async () => {
    for (const [alias, canonical] of [['small', 's'], ['medium', 'm'], ['large', 'l']] as const) {
      const aliasEl = (await fixture(
        html`<lr-number-input size=${alias} label="Alias"></lr-number-input>`,
      )) as LyraNumberInput;
      const canonicalEl = (await fixture(
        html`<lr-number-input size=${canonical} label="Canonical"></lr-number-input>`,
      )) as LyraNumberInput;
      const rowOf = (host: LyraNumberInput) =>
        host.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      const inputOf = (host: LyraNumberInput) =>
        host.shadowRoot!.querySelector<HTMLElement>('[part="input"]')!;
      const aliasRowStyle = getComputedStyle(rowOf(aliasEl));
      const canonicalRowStyle = getComputedStyle(rowOf(canonicalEl));

      expect(rowOf(aliasEl).getBoundingClientRect().height, `size=${alias} height`).to.equal(
        rowOf(canonicalEl).getBoundingClientRect().height,
      );
      expect(getComputedStyle(inputOf(aliasEl)).fontSize, `size=${alias} font-size`).to.equal(
        getComputedStyle(inputOf(canonicalEl)).fontSize,
      );
      expect(aliasRowStyle.paddingInlineStart, `size=${alias} padding-inline`).to.equal(
        canonicalRowStyle.paddingInlineStart,
      );
      expect(aliasRowStyle.paddingBlockStart, `size=${alias} padding-block`).to.equal(
        canonicalRowStyle.paddingBlockStart,
      );
    }
  });

  it('contains long RTL stepper content in an exact 320px allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 320px">
        <lr-number-input
          value="2"
          label="InternationalizedUnbrokenQuantityLabelThatMustRemainInsideTheAllocation"
          hint="Supporting copy wraps within the same narrow allocation."
        ></lr-number-input>
      </div>
    `);
    const el = wrapper.querySelector('lr-number-input') as LyraNumberInput;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    expect(el.getBoundingClientRect().width).to.be.at.most(wrapper.getBoundingClientRect().width);
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
    expect(el.shadowRoot!.querySelectorAll('[part~="stepper-up"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });

  it('matches the numeric defaults and exposes the positive without-steppers switch', async () => {
    const el = (await fixture(html`<lr-number-input label="Qty"></lr-number-input>`)) as LyraNumberInput;
    expect(el.appearance).to.equal('outlined');
    expect(el.inputMode).to.equal('numeric');
    expect(el.step).to.equal(1);
    expect(el.withoutSteppers).to.be.false;

    el.withoutSteppers = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="stepper"]').length).to.equal(0);
    expect(el.hasAttribute('without-steppers')).to.be.false;
  });

  it('keeps the legacy steppers alias and exposes shared mapped parts and icon slots', async () => {
    const el = (await fixture(html`
      <lr-number-input label="Qty">
        <span slot="decrement-icon">minus</span>
        <span slot="increment-icon">plus</span>
      </lr-number-input>
    `)) as LyraNumberInput;
    const decrement = el.shadowRoot!.querySelector('[part~="stepper-decrement"]') as HTMLButtonElement;
    const increment = el.shadowRoot!.querySelector('[part~="stepper-increment"]') as HTMLButtonElement;
    expect(decrement?.part.contains('stepper')).to.be.true;
    expect(decrement?.part.contains('stepper-down')).to.be.true;
    expect(increment?.part.contains('stepper')).to.be.true;
    expect(increment?.part.contains('stepper-up')).to.be.true;
    expect(decrement?.querySelector('slot')?.name).to.equal('decrement-icon');
    expect(increment?.querySelector('slot')?.name).to.equal('increment-icon');

    el.steppers = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="stepper"]').length).to.equal(0);
  });

  it('lets a cancelable native beforeinput cross the shadow boundary and be vetoed on the host', async () => {
    const el = (await fixture(html`<lr-number-input label="Qty"></lr-number-input>`)) as LyraNumberInput;
    const native = el.input!;
    let received: InputEvent | undefined;
    el.addEventListener('beforeinput', (event) => {
      received = event as InputEvent;
      event.preventDefault();
    });
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      composed: true,
      cancelable: true,
      data: '4',
      inputType: 'insertText',
    });
    expect(native.dispatchEvent(event)).to.be.false;
    expect(received?.constructor === InputEvent).to.be.true;
    expect(received?.defaultPrevented).to.be.true;
  });
});

it('rotates the shared chevron into a real up/down pair rather than shipping an inert rule', async () => {
  const el = (await fixture(html`<lr-number-input label="Qty"></lr-number-input>`)) as LyraNumberInput;
  const up = el.shadowRoot!.querySelector('[part~="stepper-up"] svg') as SVGElement;
  const down = el.shadowRoot!.querySelector('[part~="stepper-down"] svg') as SVGElement;
  expect(getComputedStyle(up).transform).to.equal('matrix(0, -1, 1, 0, 0, 0)');
  expect(getComputedStyle(down).transform).to.equal('matrix(0, 1, -1, 0, 0, 0)');
});
