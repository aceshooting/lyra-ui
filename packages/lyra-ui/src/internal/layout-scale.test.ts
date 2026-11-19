import { expect, fixture, html } from '@open-wc/testing';
import { layoutScale, toLayoutRect } from './layout-scale.js';

describe('layout scale', () => {
  it('divides a scaled ancestor out of visual geometry', async () => {
    const wrap = await fixture<HTMLDivElement>(html`
      <div style="transform: scale(0.5); transform-origin: 0 0; width: 400px; height: 200px">
        <div id="box" style="width: 200px; height: 100px"></div>
      </div>`);
    const box = wrap.querySelector('#box') as HTMLElement;
    const scale = layoutScale(box);
    expect(scale.x).to.be.closeTo(0.5, 0.01);
    expect(scale.y).to.be.closeTo(0.5, 0.01);
    const rect = toLayoutRect(box, box.getBoundingClientRect());
    expect(rect.width).to.be.closeTo(200, 1);
    expect(rect.height).to.be.closeTo(100, 1);
  });

  it('is the identity for unscaled, hidden and detached elements', async () => {
    const box = await fixture<HTMLDivElement>(html`<div style="width: 30px; height: 10px"></div>`);
    expect(layoutScale(box)).to.deep.equal({ x: 1, y: 1 });
    const hidden = document.createElement('div');
    expect(layoutScale(hidden)).to.deep.equal({ x: 1, y: 1 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.append(svg);
    expect(layoutScale(svg)).to.deep.equal({ x: 1, y: 1 });
    svg.remove();
  });
});
