import { expect, fixture, html } from '@open-wc/testing';
import {
  disclosureChevron,
  focusRing,
  focusRingInset,
  focusRingInsetOffset,
  focusRingInwardMax,
  focusRingInwardOffset,
  focusRingOffset,
  focusRingOffsetFrom,
  focusRingOffsetInset,
  focusRingOffsetInward,
  focusRingOffsetInsetOffset,
  focusRingOutline,
  focusRingShorthandInset,
  focusRingShorthandInsetOffset,
  focusRingShorthandInward,
  focusRingShorthandInsetPastFrame,
  focusRingShorthandOutline,
  focusRingShorthand,
  formControlIconHitTarget,
} from './interactive-control.styles.js';

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

describe('focus ring fragments', () => {
  it('paint the documented outline and offset for each spelling', async () => {
    const root = await fixture<HTMLDivElement>(html`<div data-lr-theme-scope style="--lr-focus-ring-width: 3px; --lr-focus-ring-color: rgb(1, 2, 3); --lr-focus-ring-offset: 5px; --lr-focus-ring: 7px dashed rgb(9, 8, 7);">
      <style>
        #a { ${focusRing.cssText} }
        #b { ${focusRingInset.cssText} }
        #c { ${focusRingInsetOffset.cssText} }
        #d { ${focusRingInwardOffset.cssText} }
        #e { ${focusRingShorthand.cssText} }
      </style>
      <i id="a"></i><i id="b"></i><i id="c"></i><i id="d"></i><i id="e"></i>
    </div>`);
    const read = (id: string) => {
      const style = getComputedStyle(root.querySelector(`#${id}`)!);
      return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset];
    };
    expect(read('a')).to.deep.equal(['solid', '3px', 'rgb(1, 2, 3)', '5px']);
    expect(read('b')).to.deep.equal(['solid', '3px', 'rgb(1, 2, 3)', '-3px']);
    expect(read('c')).to.deep.equal(['solid', '3px', 'rgb(1, 2, 3)', '-8px']);
    expect(read('d')).to.deep.equal(['solid', '3px', 'rgb(1, 2, 3)', '-5px']);
    expect(read('e')).to.deep.equal(['dashed', '7px', 'rgb(9, 8, 7)', '5px']);
  });
});

describe('focus ring variants', () => {
  it('compose the outline and the offset independently, with documented hooks and colours', async () => {
    const root = await fixture<HTMLDivElement>(html`<div data-lr-theme-scope style="--lr-focus-ring-width: 3px; --lr-focus-ring-color: rgb(1, 2, 3); --lr-focus-ring-offset: 5px; --lr-border-width-thin: 1px; --lr-focus-ring: 7px dashed rgb(9, 8, 7); --lr-hook: 11px;">
      <style>
        #a { ${focusRingInwardMax.cssText} }
        #b { ${focusRingShorthandInward.cssText} }
        #c { ${focusRingShorthandInset.cssText} }
        #d { ${focusRingShorthandInsetOffset.cssText} }
        #e { ${focusRingShorthandInsetPastFrame.cssText} }
        #f { ${focusRingShorthandOutline.cssText} }
        #g { ${focusRingOutline('rgb(4, 5, 6)').cssText} ${focusRingOffset.cssText} }
        #h { ${focusRingOutline('rgb(4, 5, 6)', '--lr-hook').cssText} ${focusRingOffsetInset.cssText} }
        #i { ${focusRingOffsetInward.cssText} }
        #j { ${focusRingOffsetInsetOffset.cssText} }
        #k { ${focusRingOffsetFrom('--lr-hook').cssText} }
        #l { ${focusRingOffsetFrom('--lr-unset-hook', 'inward').cssText} }
      </style>
      <i id="a"></i><i id="b"></i><i id="c"></i><i id="d"></i><i id="e"></i><i id="f"></i>
      <i id="g"></i><i id="h"></i><i id="i"></i><i id="j"></i><i id="k"></i><i id="l"></i>
    </div>`);
    const read = (id: string) => {
      const style = getComputedStyle(root.querySelector(`#${id}`)!);
      return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset];
    };
    expect(read('a')).to.deep.equal(['solid', '3px', 'rgb(1, 2, 3)', '-5px']);
    expect(read('b')).to.deep.equal(['dashed', '7px', 'rgb(9, 8, 7)', '-5px']);
    expect(read('c')).to.deep.equal(['dashed', '7px', 'rgb(9, 8, 7)', '-3px']);
    expect(read('d')).to.deep.equal(['dashed', '7px', 'rgb(9, 8, 7)', '-8px']);
    expect(read('e')).to.deep.equal(['dashed', '7px', 'rgb(9, 8, 7)', '-8px']);
    expect(read('f').slice(0, 3)).to.deep.equal(['dashed', '7px', 'rgb(9, 8, 7)']);
    expect(read('g')).to.deep.equal(['solid', '3px', 'rgb(4, 5, 6)', '5px']);
    expect(read('h')).to.deep.equal(['solid', '11px', 'rgb(4, 5, 6)', '-3px']);
    expect(read('i')[3]).to.equal('-5px');
    expect(read('j')[3]).to.equal('-8px');
    expect(read('k')[3]).to.equal('11px');
    expect(read('l')[3]).to.equal('-5px');
  });
});
