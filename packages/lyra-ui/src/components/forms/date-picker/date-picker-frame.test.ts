// The container `frame` treatment and the frame tokens of `[part="base"]`.
import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-date-picker.js';
import type { LyraDatePicker } from '../../lr-date-picker.js';

function base(el: LyraDatePicker): HTMLElement {
  return el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
}

/** Resolves a CSS declaration to its computed value inside the picker's shadow root. */
function resolved(el: LyraDatePicker, property: 'backgroundColor' | 'borderTopColor' | 'paddingTop', declaration: string): string {
  const probe = document.createElement('span');
  probe.setAttribute('style', `display:block;border-top:1px solid transparent;${declaration}`);
  el.shadowRoot!.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

describe('lr-date-picker frame', () => {
  it('defaults to frame="card" and keeps the bordered, filled, padded surface (unset regression)', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker value="2026-07-15"></lr-date-picker>`);
    expect(el.frame).to.equal('card');
    expect(el.getAttribute('frame')).to.equal('card');
    const style = getComputedStyle(base(el));
    expect(style.backgroundColor).to.equal(resolved(el, 'backgroundColor', 'background-color:var(--lr-color-surface)'));
    expect(style.borderTopStyle).to.equal('solid');
    expect(style.borderTopColor).to.equal(resolved(el, 'borderTopColor', 'border-top-color:var(--lr-color-border)'));
    expect(style.paddingTop).to.equal(resolved(el, 'paddingTop', 'padding-top:var(--lr-space-s)'));
    expect(style.paddingTop).not.to.equal('0px');
  });

  it('frame="plain" removes the background, border and padding and inherits the host radius', async () => {
    const el = await fixture<LyraDatePicker>(
      html`<lr-date-picker frame="plain" style="border-radius: 7px" value="2026-07-15"></lr-date-picker>`,
    );
    const style = getComputedStyle(base(el));
    expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(style.borderTopStyle).to.equal('none');
    expect(style.borderTopWidth).to.equal('0px');
    expect(style.paddingTop).to.equal('0px');
    expect(style.paddingInlineStart).to.equal('0px');
    expect(style.borderTopLeftRadius).to.equal('7px');
  });

  it('switches between card and plain when the property changes', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker></lr-date-picker>`);
    el.frame = 'plain';
    await el.updateComplete;
    expect(el.getAttribute('frame')).to.equal('plain');
    expect(getComputedStyle(base(el)).borderTopStyle).to.equal('none');
    el.frame = 'card';
    await el.updateComplete;
    expect(getComputedStyle(base(el)).borderTopStyle).to.equal('solid');
  });

  it('the frame tokens restyle the card surface', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker
      style="--lr-date-picker-padding: 13px; --lr-date-picker-bg: rgb(1, 2, 3); --lr-date-picker-border-color: rgb(4, 5, 6)"
    ></lr-date-picker>`);
    const style = getComputedStyle(base(el));
    expect(style.paddingTop).to.equal('13px');
    expect(style.paddingInlineEnd).to.equal('13px');
    expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(style.borderTopColor).to.equal('rgb(4, 5, 6)');
  });

  it('frame="plain" honors --lr-date-picker-padding but never paints the background or border tokens', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker
      frame="plain"
      style="--lr-date-picker-padding: 9px; --lr-date-picker-bg: rgb(1, 2, 3); --lr-date-picker-border-color: rgb(4, 5, 6)"
    ></lr-date-picker>`);
    const style = getComputedStyle(base(el));
    expect(style.paddingTop).to.equal('9px');
    expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(style.borderTopStyle).to.equal('none');
  });

  it('a plain picker passes axe', async () => {
    const el = await fixture<HTMLElement>(html`<div>
      <lr-date-picker frame="plain" aria-label="Departure date" value="2026-07-15"></lr-date-picker>
    </div>`);
    await (el.querySelector('lr-date-picker') as LyraDatePicker).updateComplete;
    await expect(el).to.be.accessible();
  });
});
