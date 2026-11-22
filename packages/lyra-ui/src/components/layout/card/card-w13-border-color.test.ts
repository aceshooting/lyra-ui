import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-card.js';
import type { LyraCard } from '../../lr-card.js';

const part = (el: LyraCard, selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!);

describe('lr-card --lr-card-border-color', () => {
  it('colours the outer border only, leaving the header and footer dividers on --border-color', async () => {
    const el = await fixture<LyraCard>(html`<lr-card
      style="--lr-card-border-color: rgb(1, 2, 3); --border-color: rgb(9, 8, 7)"
    >
      <span slot="header">Head</span>Body<span slot="footer">Foot</span>
    </lr-card>`);
    expect(part(el, '[part="base"]').borderTopColor).to.equal('rgb(1, 2, 3)');
    expect(part(el, '[part="header"]').borderBottomColor).to.equal('rgb(9, 8, 7)');
    expect(part(el, '[part="footer"]').borderTopColor).to.equal('rgb(9, 8, 7)');
  });

  it('does not inherit into slotted content, unlike --border-color', async () => {
    const el = await fixture<LyraCard>(html`<lr-card style="--lr-card-border-color: rgb(1, 2, 3)">
      <i id="probe" style="border: 1px solid var(--border-color, rgb(4, 5, 6))">x</i>
    </lr-card>`);
    expect(getComputedStyle(el.querySelector('#probe')!).borderTopColor).to.equal('rgb(4, 5, 6)');
  });

  it('colours an actionable card edge, and a wrapping link can drive a passive card on hover', async () => {
    const el = await fixture<LyraCard>(html`<lr-card actionable style="--lr-card-border-color: rgb(1, 2, 3)">x</lr-card>`);
    expect(part(el, '[part="base"]').borderTopColor).to.equal('rgb(1, 2, 3)');
    const wrapped = await fixture<HTMLElement>(html`<div style="--lr-card-border-color: rgb(10, 20, 30)"><lr-card>y</lr-card></div>`);
    expect(part(wrapped.querySelector('lr-card') as LyraCard, '[part="base"]').borderTopColor).to.equal('rgb(10, 20, 30)');
  });

  it('keeps the existing fallbacks when unset', async () => {
    const el = await fixture<LyraCard>(html`<lr-card style="--border-color: rgb(9, 8, 7)">x</lr-card>`);
    expect(part(el, '[part="base"]').borderTopColor).to.equal('rgb(9, 8, 7)');
  });
});
