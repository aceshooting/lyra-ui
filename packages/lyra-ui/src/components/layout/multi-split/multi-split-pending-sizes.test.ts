import { expect, fixture, html } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

for (const [name, sizes] of [
  ['nonfinite', [Number.NaN, Number.POSITIVE_INFINITY, 25, 25]],
  ['zero', [0, 0, 0, 0]],
  ['short', [100]],
  ['negative', [-25, 75, 25, 25]],
  ['overfull', [60, 60, 60, 60]],
] as const) {
  it(`publishes a finite folded layout when ${name} sizes are assigned immediately before folding`, async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split style="inline-size:720px;block-size:160px">
      <div panel-id="a">A</div><div panel-id="b">B</div><div panel-id="c">C</div><div panel-id="d">D</div>
    </lr-multi-split>`);
    const published: (readonly number[])[] = [];
    split.addEventListener('lr-multi-split-panel-collapse-change', event => { published.push(event.detail.sizes); });
    if (name === 'overfull') {
      split.panelConstraints = [0, 1, 2, 3].map(() => ({ maxPx: 300 }));
      await split.updateComplete;
    }
    split.sizes = [...sizes];
    expect(split.collapsePanel('b')).to.equal(true);
    expect(published.length).to.equal(1);
    expect(published[0]!.length).to.equal(4);
    expect(published[0]![1]).to.equal(0);
    expect(published[0]!.every((value, index) => Number.isFinite(value) && (index === 1 ? value === 0 : value > 0))).to.equal(true);
    expect(published[0]!.reduce((total, value) => total + value, 0)).to.be.closeTo(100, .001);
    await split.updateComplete;
    expect([...split.sizes]).to.deep.equal([...published[0]!]);
    expect(split.querySelector('[panel-id="b"]')!.hasAttribute('data-panel-collapsed')).to.equal(true);
    expect(split.expandPanel('b')).to.equal(true);
    await split.updateComplete;
    expect(split.sizes.every(value => Number.isFinite(value) && value > 0)).to.equal(true);
    expect(split.sizes.reduce((total, value) => total + value, 0)).to.be.closeTo(100, .001);
    expect(split.querySelectorAll('[data-panel-collapsed]').length).to.equal(0);
  });
}
