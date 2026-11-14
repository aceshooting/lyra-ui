import { expect, fixture, html } from '@open-wc/testing';
import './radio-group.js';
import './radio.js';
import type { LyraRadioGroup } from './radio-group.class.js';
import type { LyraRadio } from './radio.class.js';

const deepActive = (): Element | null => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};

describe('lr-radio-group under a disabled fieldset', () => {
  it('does not move focus into its radios', async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset disabled>
      <lr-radio-group label="Size" value="m">
        <lr-radio value="s">Small</lr-radio>
        <lr-radio value="m">Medium</lr-radio>
      </lr-radio-group>
    </fieldset>`);
    const group = fieldset.querySelector<LyraRadioGroup>('lr-radio-group')!;
    await group.updateComplete;
    group.focus();
    const active = deepActive();
    expect(active === null || active === document.body, 'focus stays outside the group').to.equal(true);

    fieldset.disabled = false;
    await group.updateComplete;
    group.focus();
    expect(fieldset.querySelector<LyraRadio>('lr-radio[value="m"]')!.matches(':focus-within')).to.equal(true);
  });
});

describe('lr-radio form state restoration', () => {
  it('leaves restoration of a grouped radio to its group', async () => {
    const group = await fixture<LyraRadioGroup>(html`<lr-radio-group label="Size">
      <lr-radio value="s">Small</lr-radio>
    </lr-radio-group>`);
    const radio = group.querySelector<LyraRadio>('lr-radio')!;
    await radio.updateComplete;
    radio.formStateRestoreCallback('checked', 'restore');
    expect(radio.checked).to.equal(false);
  });

  it('restores a standalone radio from its saved state', async () => {
    const radio = await fixture<LyraRadio>(html`<lr-radio value="s">Small</lr-radio>`);
    radio.formStateRestoreCallback('checked', 'restore');
    expect(radio.checked).to.equal(true);
  });
});
