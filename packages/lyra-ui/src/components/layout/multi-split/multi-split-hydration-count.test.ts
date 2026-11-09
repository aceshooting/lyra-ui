import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMultiSplit } from './multi-split.js';
import './multi-split.js';

for (const seed of ['NaN', 'Infinity', '-Infinity', '-1', '1.5', '1e100']) {
  it(`preserves live panels after an invalid hydration count of ${seed}`, async () => {
    const element = await fixture<LyraMultiSplit>(html`
      <lr-multi-split .sizes=${[40, 60]} style="inline-size:400px;block-size:100px">
        <section panel-id="one">First</section><section panel-id="two">Second</section>
      </lr-multi-split>
    `);
    await waitUntil(() => element.shadowRoot!.querySelectorAll('[role="separator"]').length === 1);
    element.setAttribute('data-lr-panel-count', seed);
    await element.updateComplete;
    expect(element.sizes).to.deep.equal([40, 60]);
    expect(element.shadowRoot!.querySelectorAll('[role="separator"]').length).to.equal(1);
    expect(element.shadowRoot!.querySelector('[role="separator"]')!.getAttribute('aria-valuenow')).to.equal('40');
    const panel = document.createElement('section'); panel.textContent = 'Third'; panel.setAttribute('panel-id', 'three');
    element.append(panel);
    await waitUntil(() => element.shadowRoot!.querySelectorAll('[role="separator"]').length === 2);
    expect(element.sizes.length).to.equal(3);
    expect(element.sizes.every(value => Number.isFinite(value) && value > 0)).to.equal(true);
    expect(element.sizes.reduce((sum, value) => sum + value, 0)).to.be.closeTo(100, 0.001);
    expect(element.getAttribute('data-lr-panel-count')).to.equal('3');
  });
}
