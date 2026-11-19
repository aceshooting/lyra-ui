import { expect, fixture, html } from '@open-wc/testing';
import { disclosureChevron, formControlIconHitTarget } from './interactive-control.styles.js';

describe('formControlIconHitTarget', () => {
  it('caps the icon-button floor at the field tier and never drops below 24px', async () => {
    const root = await fixture<HTMLDivElement>(html`<div style="--lr-size-24px: 24px; --lr-icon-button-size: 40px;">
      <style>.t { ${formControlIconHitTarget.cssText} }</style>
      <button class="t" id="m" style="--lr-form-control-height: 44px"></button>
      <button class="t" id="s" style="--lr-form-control-height: 32px"></button>
      <button class="t" id="xs" style="--lr-form-control-height: 20px"></button>
    </div>`);
    const size = (id: string) => getComputedStyle(root.querySelector(`#${id}`)!).minBlockSize;
    expect([size('m'), size('s'), size('xs')]).to.deep.equal(['40px', '32px', '24px']);
  });
});

describe('disclosureChevron', () => {
  it('rotates when expanded, mirrors collapsed under RTL and leaves expanded RTL unmirrored', async () => {
    const css = disclosureChevron({
      glyph: '.g',
      expanded: '[aria-expanded="true"] > .g',
      collapsedRtl: '[dir="rtl"] [aria-expanded="false"] > .g',
    }).cssText;
    const root = await fixture<HTMLDivElement>(html`<div data-lr-theme-scope style="--lr-transition-fast: 0s">
      <style>${css}</style>
      <button aria-expanded="true"><span class="g" id="open"></span></button>
      <button aria-expanded="false"><span class="g" id="closed"></span></button>
      <div dir="rtl">
        <button aria-expanded="false"><span class="g" id="rtl-closed"></span></button>
        <button aria-expanded="true"><span class="g" id="rtl-open"></span></button>
      </div>
    </div>`);
    const transform = (id: string) => getComputedStyle(root.querySelector(`#${id}`)!).transform;
    const open = new DOMMatrix(transform('open'));
    expect([Math.round(open.a), Math.round(open.b), Math.round(open.c), Math.round(open.d)]).to.deep.equal([0, 1, -1, 0]);
    expect(transform('closed')).to.equal('none');
    expect(new DOMMatrix(transform('rtl-closed')).a).to.equal(-1);
    expect(transform('rtl-open')).to.equal(transform('open'));
    expect(getComputedStyle(root.querySelector('#closed')!).display).to.equal('inline-flex');
  });
});
