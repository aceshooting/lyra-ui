import { expect, fixture, html } from '@open-wc/testing';
import { revealInOwnScroller } from './reveal-row.js';

async function nested(style = '') {
  const outer = await fixture<HTMLElement>(html`
    <div style="block-size: 200px; overflow: auto; ${style}">
      <div style="block-size: 400px"></div>
      <div data-inner style="block-size: 100px; overflow: auto">
        <div style="block-size: 300px"></div>
        <div data-target style="block-size: 20px">Target</div>
        <div style="block-size: 300px"></div>
      </div>
      <div style="block-size: 400px"></div>
    </div>
  `);
  return { outer, inner: outer.querySelector<HTMLElement>('[data-inner]')!, target: outer.querySelector<HTMLElement>('[data-target]')! };
}

describe('revealInOwnScroller', () => {
  it('scrolls only the owned scrollport, never an outer scroller', async () => {
    const { outer, inner, target } = await nested();
    revealInOwnScroller(target);
    expect(outer.scrollTop).to.equal(0);
    expect(inner.scrollTop).to.equal(220);
    revealInOwnScroller(target, 'center');
    expect(inner.scrollTop).to.equal(260);
    revealInOwnScroller(target);
    expect(inner.scrollTop, 'an already visible target stays put').to.equal(260);
  });

  it('measures in layout pixels under a scaled ancestor', async () => {
    const { outer, inner, target } = await nested('transform: scale(0.5); transform-origin: 0 0');
    revealInOwnScroller(target);
    expect(outer.scrollTop).to.equal(0);
    expect(inner.scrollTop).to.equal(220);
  });

  it('falls back to a nearest reveal when nothing inside its tree scrolls', async () => {
    const outer = await fixture<HTMLElement>(html`<div><span data-target>Visible</span></div>`);
    const before = document.scrollingElement!.scrollTop;
    revealInOwnScroller(outer.querySelector('[data-target]')!);
    expect(document.scrollingElement!.scrollTop).to.equal(before);
  });
});
