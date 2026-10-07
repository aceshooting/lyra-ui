import { resolvedMaxInlineSizeInShadow as resolvedInShadow } from '../../../../test/shadow-style.js';
import { expect, fixture, html } from '@open-wc/testing';
import './voice-picker.js';
import type { LyraVoicePicker } from './voice-picker.js';

const CATALOG = ['aria', 'nova'];

function trigger(el: LyraVoicePicker): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!;
}

function previewButton(el: LyraVoicePicker): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="preview-button"]')!;
}

describe('lr-voice-picker host width cap', () => {
  it('keeps the 24rem default cap when nothing is set (unset regression)', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    expect(getComputedStyle(el).maxInlineSize).to.equal(
      resolvedInShadow(el, 'var(--lr-size-24rem)'),
      'the default paint stays exactly where it shipped',
    );
  });

  it('honours --lr-voice-picker-max-inline-size, including none', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    const baseline = getComputedStyle(el).maxInlineSize;
    el.style.setProperty('--lr-voice-picker-max-inline-size', '12rem');
    expect(getComputedStyle(el).maxInlineSize).to.equal(resolvedInShadow(el, '12rem'));
    el.style.setProperty('--lr-voice-picker-max-inline-size', 'none');
    expect(getComputedStyle(el).maxInlineSize).to.equal('none');
    el.style.removeProperty('--lr-voice-picker-max-inline-size');
    expect(getComputedStyle(el).maxInlineSize).to.equal(baseline);
  });

  it('lets an ancestor theme wrapper set the cap (the token is never declared on :host)', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="--lr-voice-picker-max-inline-size: 10rem">
        <lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>
      </div>
    `);
    const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    expect(getComputedStyle(el).maxInlineSize).to.equal(resolvedInShadow(el, '10rem'));
  });
});

describe('lr-voice-picker trigger height hooks', () => {
  it('exposes independent padding, font and chevron size hooks in both modes', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    el.style.setProperty('--lr-voice-picker-trigger-padding', '7px 11px');
    el.style.setProperty('--lr-voice-picker-font-size', '21px');
    el.style.setProperty('--lr-voice-picker-expand-size', '18px');
    const control = trigger(el);
    const chevron = el.shadowRoot!.querySelector<HTMLElement>('[part="expand-icon"]')!;
    expect(getComputedStyle(control).paddingBlockStart).to.equal('7px');
    expect(getComputedStyle(control).paddingInlineStart).to.equal('11px');
    expect(getComputedStyle(control).fontSize).to.equal('21px');
    expect(getComputedStyle(chevron).minInlineSize).to.equal('18px');

    el.allowCustom = true;
    await el.updateComplete;
    const combobox = el.shadowRoot!.querySelector<HTMLElement>('[part="combobox"]')!;
    expect(getComputedStyle(combobox).paddingBlockStart).to.equal('7px');
    expect(getComputedStyle(combobox).fontSize).to.equal('21px');
  });

  it('keeps the shared form-control height as a floor only when nothing is set (unset regression)', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    const control = trigger(el);
    expect(getComputedStyle(control).minBlockSize).to.equal(
      resolvedInShadow(el, 'var(--lr-form-control-height)'),
    );
    const baselineBlockSize = getComputedStyle(control).blockSize;
    // Grown through the shared ladder knob that backs the picker-specific padding hook.
    el.style.setProperty('--lr-form-control-padding-block', '2rem');
    expect(parseFloat(getComputedStyle(control).blockSize) > parseFloat(baselineBlockSize)).to.equal(
      true,
      'without an exact height the trigger is still content-sized',
    );
    el.style.removeProperty('--lr-form-control-padding-block');
    expect(getComputedStyle(control).blockSize).to.equal(baselineBlockSize);
  });

  it('pins an exact trigger height through --lr-voice-picker-trigger-height', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    const control = trigger(el);
    const baselineBlockSize = getComputedStyle(control).blockSize;
    el.style.setProperty('--lr-voice-picker-trigger-height', '64px');
    expect(getComputedStyle(control).minBlockSize).to.equal('64px');
    expect(getComputedStyle(control).blockSize).to.equal('64px');
    // It caps as well as floors: content that would otherwise grow the row cannot escape it.
    // Grown through the font size rather than the padding, because padding plus border is a hard
    // floor on a border-box element -- it would clamp the used height back up and prove nothing.
    el.style.removeProperty('--lr-voice-picker-trigger-height');
    el.style.setProperty('--lr-form-control-font-size', '4rem');
    expect(parseFloat(getComputedStyle(control).blockSize) > 64).to.equal(
      true,
      'the oversized glyphs push the row past 64px on their own',
    );
    el.style.setProperty('--lr-voice-picker-trigger-height', '64px');
    expect(getComputedStyle(control).blockSize).to.equal('64px');
    el.style.removeProperty('--lr-form-control-font-size');
    el.style.removeProperty('--lr-voice-picker-trigger-height');
    expect(getComputedStyle(control).blockSize).to.equal(
      baselineBlockSize,
      'removing the exact height returns the control to its shipped geometry',
    );
  });

  it('exposes a floor-only hook that the exact height overrides', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    const control = trigger(el);
    el.style.setProperty('--lr-voice-picker-trigger-min-height', '72px');
    expect(getComputedStyle(control).minBlockSize).to.equal('72px');
    expect(getComputedStyle(control).blockSize).to.equal('72px');
    el.style.setProperty('--lr-voice-picker-trigger-height', '48px');
    expect(getComputedStyle(control).minBlockSize).to.equal('48px');
    expect(getComputedStyle(control).blockSize).to.equal('48px');
  });

  it('applies the exact height to the free-text combobox too, in both writing directions', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="--lr-voice-picker-trigger-height: 56px">
        <lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>
      </div>
    `);
    const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    await el.updateComplete;
    const combobox = el.shadowRoot!.querySelector<HTMLElement>('[part~="combobox"]')!;
    expect(combobox.localName).to.equal('div');
    expect(getComputedStyle(el).direction).to.equal('rtl');
    expect(getComputedStyle(combobox).blockSize).to.equal('56px');
    expect(getComputedStyle(combobox).minBlockSize).to.equal('56px');
  });

  it('floors the free-text combobox through the floor-only hook too', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="--lr-voice-picker-trigger-min-height: 72px">
        <lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>
      </div>
    `);
    const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    await el.updateComplete;
    const combobox = el.shadowRoot!.querySelector<HTMLElement>('[part~="combobox"]')!;
    expect(combobox.localName).to.equal('div');
    // The floor hook is documented as "Trigger/combobox block-size floor", so the combobox arm has
    // to read the same chain the trigger does -- not just the exact-height name.
    expect(getComputedStyle(combobox).minBlockSize).to.equal('72px');
    expect(getComputedStyle(combobox).blockSize).to.equal('72px');
  });

  it('survives a disconnect/reconnect with the hooks still applied', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    el.style.setProperty('--lr-voice-picker-trigger-height', '52px');
    el.style.setProperty('--lr-voice-picker-max-inline-size', '11rem');
    const parent = el.parentNode as HTMLElement;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).blockSize).to.equal('52px');
    expect(getComputedStyle(el).maxInlineSize).to.equal(resolvedInShadow(el, '11rem'));
  });
});

describe('lr-voice-picker preview action follows the trigger height', () => {
  it('matches the trigger at the shipped geometry (unset regression)', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    // `without-preview` defaults to false, so the action is in the row without opting in.
    expect(el.withoutPreview).to.equal(false);
    expect(previewButton(el).localName).to.equal('button');
    expect(getComputedStyle(previewButton(el)).blockSize).to.equal(
      resolvedInShadow(el, 'max(var(--lr-icon-button-size), var(--lr-form-control-height))'),
    );
  });

  it('keeps the action the same height as the field when one is pinned', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    el.style.setProperty('--lr-voice-picker-trigger-height', '3rem');
    // `.control-row` is align-items: stretch, but stretch never applies to an item with a definite
    // cross size -- so a pinned field used to leave a short, top-aligned square beside it.
    expect(getComputedStyle(previewButton(el)).blockSize).to.equal(
      getComputedStyle(trigger(el)).blockSize,
    );
    expect(previewButton(el).getBoundingClientRect().height).to.equal(
      trigger(el).getBoundingClientRect().height,
    );
    el.style.setProperty('--lr-voice-picker-trigger-height', '72px');
    expect(getComputedStyle(previewButton(el)).blockSize).to.equal('72px');
  });

  it('follows the floor-only hook as well as the exact height', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    el.style.setProperty('--lr-voice-picker-trigger-min-height', '72px');
    // Raising only the floor is the same geometry problem as pinning an exact height: the field
    // grows, and an action left at the ladder height would sit short and top-aligned beside it.
    expect(getComputedStyle(trigger(el)).blockSize).to.equal('72px');
    expect(getComputedStyle(previewButton(el)).blockSize).to.equal('72px');
    expect(previewButton(el).getBoundingClientRect().height).to.equal(
      trigger(el).getBoundingClientRect().height,
    );
  });

  it('never lets a short pin shrink the action below the WCAG hit-area floor', async () => {
    const el = await fixture<LyraVoicePicker>(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    );
    el.style.setProperty('--lr-voice-picker-trigger-height', '8px');
    const floor = resolvedInShadow(el, 'var(--lr-icon-button-size)');
    expect(getComputedStyle(previewButton(el)).blockSize).to.equal(floor);
    expect(getComputedStyle(previewButton(el)).inlineSize).to.equal(floor);
  });
});
