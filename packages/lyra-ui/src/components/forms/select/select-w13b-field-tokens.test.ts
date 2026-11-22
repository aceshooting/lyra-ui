import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-select.js';
import '../../lr-input.js';
import type { LyraSelect } from '../../lr-select.js';
import type { LyraInput } from '../../lr-input.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const trigger = (el: LyraSelect) => el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
const wrapper = (el: LyraInput) => el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;

describe('shared form-control field tokens', () => {
  it('keeps no transition on the field unset and applies --lr-form-control-transition to select and input', async () => {
    const select = await fixture<LyraSelect>(html`<lr-select label="S"></lr-select>`);
    expect(getComputedStyle(trigger(select)).transitionDuration).to.equal('0s');
    const tuned = await fixture<HTMLElement>(html`<div style="--lr-form-control-transition: border-color 200ms, box-shadow 200ms">
      <lr-select label="S"></lr-select><lr-input label="I"></lr-input></div>`);
    const s = trigger(tuned.querySelector('lr-select') as LyraSelect);
    expect(getComputedStyle(s).transitionProperty).to.equal('border-color, box-shadow');
    expect(getComputedStyle(s).transitionDuration).to.equal('0.2s, 0.2s');
    expect(getComputedStyle(wrapper(tuned.querySelector('lr-input') as LyraInput)).transitionDuration).to.equal('0.2s, 0.2s');
  });

  it('replaces the select focus outline with --lr-form-control-focus-outline, keeping the halo', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select label="S"
      style="--lr-form-control-focus-outline: 0 solid transparent; --lr-form-control-focus-shadow: 0 0 0 3px rgb(20, 22, 24)"></lr-select>`);
    await focusByKeyboard(trigger(el));
    expect(getComputedStyle(trigger(el)).outlineWidth).to.equal('0px');
    expect(getComputedStyle(trigger(el)).boxShadow).to.contain('rgb(20, 22, 24)');
  });

  it('keeps the default focus outline when the token is unset', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select label="S"></lr-select>`);
    await focusByKeyboard(trigger(el));
    expect(getComputedStyle(trigger(el)).outlineStyle).to.equal('solid');
    expect(parseFloat(getComputedStyle(trigger(el)).outlineWidth)).to.be.greaterThan(0);
  });

  it('paints --lr-select-open-shadow while open, falling back to the shared halo', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select label="S"
      style="--lr-form-control-focus-shadow: 0 0 0 3px rgb(20, 22, 24)"></lr-select>`);
    el.setAttribute('open', '');
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).boxShadow).to.contain('rgb(20, 22, 24)');
    const own = await fixture<LyraSelect>(html`<lr-select label="S"
      style="--lr-form-control-focus-shadow: 0 0 0 3px rgb(20, 22, 24); --lr-select-open-shadow: 0 0 0 5px rgb(30, 31, 32)"></lr-select>`);
    own.setAttribute('open', '');
    await own.updateComplete;
    expect(getComputedStyle(trigger(own)).boxShadow).to.contain('rgb(30, 31, 32)');
    expect(getComputedStyle(trigger(own)).boxShadow).not.to.contain('rgb(20, 22, 24)');
  });

  it('restores the standard ring under forced colors whatever the outline token says', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select label="S" style="--lr-form-control-focus-outline: none"></lr-select>`);
    await setForcedColors('active');
    try {
      await focusByKeyboard(trigger(el));
      expect(getComputedStyle(trigger(el)).outlineStyle).to.equal('solid');
    } finally {
      await setForcedColors('none');
    }
  });
});
