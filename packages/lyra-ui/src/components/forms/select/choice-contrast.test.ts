import { expect, fixture } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched } from '../../../../test/wtr-mouse.js';
import './select.js';
import '../combobox/combobox.js';
import '../combobox/option.js';
import '../switch/switch.js';
import '../radio/radio-button.js';

for (const name of ['select', 'combobox'] as const) {
  it(`${name} outlines the keyboard-current row in forced colors`, async () => {
    const control = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(`<lr-${name} open><lr-option value="x">One</lr-option></lr-${name}>`);
    await setForcedColors('active');
    try {
      control.shadowRoot!.querySelector('[role="combobox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await control.updateComplete;
      const row = control.shadowRoot!.querySelector('[data-active]')!;
      expect(getComputedStyle(row).outlineStyle).to.equal('solid');
    } finally {
      await setForcedColors('none');
    }
  });
}

it('outlines the focused option in forced colors', async () => {
  const option = await fixture<HTMLElement>('<lr-option tabindex="0">One</lr-option>');
  await setForcedColors('active');
  try {
    await focusByKeyboard(option);
    expect(getComputedStyle(option.shadowRoot!.querySelector('[part~="base"]')!).outlineStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});

for (const name of ['switch', 'radio-button']) {
  it(`${name} keeps its checked foreground visible under the pointer in forced colors`, async () => {
    const control = await fixture<HTMLElement>(`<lr-${name} checked>One</lr-${name}>`);
    const root = control.shadowRoot!;
    const paint = root.querySelector<HTMLElement>(name === 'switch' ? '[part~="track"]' : '[part~="button"]')!;
    await setForcedColors('active');
    try {
      await hoverUntilMatched(paint, 'pointer reaches the checked control');
      const foreground = name === 'switch' ? getComputedStyle(root.querySelector('[part="thumb"]')!).backgroundColor : getComputedStyle(paint).color;
      expect(getComputedStyle(paint).backgroundColor).not.to.equal(foreground);
    } finally {
      await setForcedColors('none');
    }
  });
}

it('keeps a disabled combobox row at its resting fill under the pointer', async () => {
  const combo = await fixture<HTMLElementTagNameMap['lr-combobox']>('<lr-combobox open style="--lr-combobox-option-active-bg: rgb(12, 34, 56)"><lr-option disabled value="one">One</lr-option></lr-combobox>');
  await combo.show();
  const row = combo.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!;
  await hoverUntilMatched(row, 'pointer reaches the disabled option');
  expect(getComputedStyle(row).backgroundColor).not.to.equal('rgb(12, 34, 56)');
});
