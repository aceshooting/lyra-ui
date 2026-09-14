import { expect, fixture, html } from '@open-wc/testing';
import './model-select.js';
import type { LyraModelSelect } from './model-select.js';

const CATALOG = ['gpt-4o', 'claude-opus'];

/** Resolves what `expression` computes to *inside this component's shadow root*, where the `--lr-*`
 *  design tokens actually live (declared on `:host`, so a light-DOM probe would see none of them). */
function resolvedInShadow(el: LyraModelSelect, expression: string): string {
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.maxInlineSize = expression;
  el.shadowRoot!.append(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

function trigger(el: LyraModelSelect): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!;
}

describe('lr-model-select host width cap', () => {
  it('keeps the 24rem default cap when nothing is set (unset regression)', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    expect(getComputedStyle(el).maxInlineSize).to.equal(
      resolvedInShadow(el, 'var(--lr-size-24rem)'),
      'the default paint stays exactly where it shipped',
    );
  });

  it('honours --lr-model-select-max-inline-size set on the element', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    const baseline = getComputedStyle(el).maxInlineSize;
    el.style.setProperty('--lr-model-select-max-inline-size', '12rem');
    expect(getComputedStyle(el).maxInlineSize).to.equal(resolvedInShadow(el, '12rem'));
    el.style.removeProperty('--lr-model-select-max-inline-size');
    expect(getComputedStyle(el).maxInlineSize).to.equal(baseline);
  });

  it('accepts none, so a full-width row no longer needs a ::part override', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    el.style.setProperty('--lr-model-select-max-inline-size', 'none');
    expect(getComputedStyle(el).maxInlineSize).to.equal('none');
  });

  it('lets an ancestor theme wrapper set the cap (the token is never declared on :host)', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="--lr-model-select-max-inline-size: 10rem">
        <lr-model-select .catalog=${CATALOG}></lr-model-select>
      </div>
    `);
    const el = wrapper.querySelector('lr-model-select') as LyraModelSelect;
    expect(getComputedStyle(el).maxInlineSize).to.equal(resolvedInShadow(el, '10rem'));
  });
});

describe('lr-model-select trigger height hooks', () => {
  it('keeps the shared form-control height as a floor only when nothing is set (unset regression)', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    const control = trigger(el);
    const ladderHeight = resolvedInShadow(el, 'var(--lr-form-control-height)');
    expect(getComputedStyle(control).minBlockSize).to.equal(ladderHeight);
    const baselineBlockSize = getComputedStyle(control).blockSize;

    // A floor, not a cap: extra padding still grows the trigger while no exact height is set.
    el.style.setProperty('--lr-model-select-trigger-padding', '2rem 1rem');
    const grown = parseFloat(getComputedStyle(control).blockSize);
    expect(grown > parseFloat(baselineBlockSize)).to.equal(
      true,
      'without an exact height the trigger is still content-sized',
    );
    el.style.removeProperty('--lr-model-select-trigger-padding');
    expect(getComputedStyle(control).blockSize).to.equal(baselineBlockSize);
  });

  it('pins an exact trigger height through --lr-model-select-trigger-height', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    const control = trigger(el);
    const baselineBlockSize = getComputedStyle(control).blockSize;
    el.style.setProperty('--lr-model-select-trigger-height', '64px');
    expect(getComputedStyle(control).minBlockSize).to.equal('64px');
    expect(getComputedStyle(control).blockSize).to.equal('64px');

    // It caps as well as floors: content that would otherwise grow the row cannot escape it.
    // Grown through the font size rather than the padding, because padding plus border is a hard
    // floor on a border-box element -- it would clamp the used height back up and prove nothing.
    el.style.removeProperty('--lr-model-select-trigger-height');
    el.style.setProperty('--lr-model-select-font-size', '4rem');
    expect(parseFloat(getComputedStyle(control).blockSize) > 64).to.equal(
      true,
      'the oversized glyphs push the row past 64px on their own',
    );
    el.style.setProperty('--lr-model-select-trigger-height', '64px');
    expect(getComputedStyle(control).blockSize).to.equal('64px');
    el.style.removeProperty('--lr-model-select-font-size');

    el.style.removeProperty('--lr-model-select-trigger-height');
    expect(getComputedStyle(control).blockSize).to.equal(
      baselineBlockSize,
      'removing the exact height returns the control to its shipped geometry',
    );
  });

  it('keeps --lr-model-select-trigger-min-height a floor and lets the exact height win over it', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    const control = trigger(el);
    el.style.setProperty('--lr-model-select-trigger-min-height', '72px');
    expect(getComputedStyle(control).minBlockSize).to.equal('72px');
    expect(getComputedStyle(control).blockSize).to.equal('72px');

    el.style.setProperty('--lr-model-select-trigger-height', '48px');
    expect(getComputedStyle(control).minBlockSize).to.equal(
      '48px',
      'an exact height replaces the floor rather than fighting it',
    );
    expect(getComputedStyle(control).blockSize).to.equal('48px');
  });

  it('applies the exact height to the free-text combobox too, in both writing directions', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="--lr-model-select-trigger-height: 56px">
        <lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>
      </div>
    `);
    const el = wrapper.querySelector('lr-model-select') as LyraModelSelect;
    await el.updateComplete;
    const combobox = el.shadowRoot!.querySelector<HTMLElement>('[part~="combobox"]')!;
    expect(combobox.localName).to.equal('div');
    expect(getComputedStyle(el).direction).to.equal('rtl');
    expect(getComputedStyle(combobox).blockSize).to.equal('56px');
    expect(getComputedStyle(combobox).minBlockSize).to.equal('56px');
  });

  it('survives a disconnect/reconnect with the hooks still applied', async () => {
    const el = await fixture<LyraModelSelect>(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`,
    );
    el.style.setProperty('--lr-model-select-trigger-height', '52px');
    el.style.setProperty('--lr-model-select-max-inline-size', '11rem');
    const parent = el.parentNode as HTMLElement;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).blockSize).to.equal('52px');
    expect(getComputedStyle(el).maxInlineSize).to.equal(resolvedInShadow(el, '11rem'));
  });
});
