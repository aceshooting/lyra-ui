import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-button.js';
import type { LyraButton } from '../../lr-button.js';

const label = (el: LyraButton) => el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;

describe('lr-button --lr-button-label-wrap', () => {
  it('stays single-line unset', async () => {
    const el = await fixture<LyraButton>(html`<lr-button>Save</lr-button>`);
    expect(getComputedStyle(label(el)).whiteSpace).to.equal('nowrap');
  });

  it('lets a container wrap every button label through inheritance, and the wrap attribute still wins', async () => {
    const row = await fixture<HTMLElement>(html`<div style="--lr-button-label-wrap: normal; inline-size: 120px">
      <lr-button>A fairly long action label that must wrap</lr-button>
      <lr-button wrap>Attribute</lr-button>
    </div>`);
    const [a, b] = Array.from(row.querySelectorAll<LyraButton>('lr-button')) as [LyraButton, LyraButton];
    expect(getComputedStyle(label(a)).whiteSpace).to.equal('normal');
    expect(getComputedStyle(label(b)).whiteSpace).to.equal('normal');
    expect(a.getBoundingClientRect().height).to.be.greaterThan(60);
  });
});
