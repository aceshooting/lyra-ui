import { expect, fixture, html } from '@open-wc/testing';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.js';

for (const values of [[], [3, 1, 2]]) {
  it(`treats removed data as absence with ${values.length ? 'fallback values' : 'no fallback samples'}`, async () => {
    const element = await fixture<LyraSparkline>(html`<lr-sparkline data="1 2 3" .values=${values}></lr-sparkline>`);
    const path = () => element.shadowRoot!.querySelector('[part="line"]')?.getAttribute('d');
    const suppliedPath = path();
    expect(typeof suppliedPath).to.equal('string');
    element.removeAttribute('data');
    await element.updateComplete;
    expect(element.data as unknown).to.equal(null);
    if (values.length) {
      expect(typeof path()).to.equal('string');
      expect(path()).not.to.equal(suppliedPath);
    } else expect(path()).to.equal(undefined);
    const absentPath = path();
    element.setAttribute('data', '');
    await element.updateComplete;
    expect(element.data).to.equal('');
    expect(path()).to.equal(absentPath);
    element.setAttribute('data', '1 2 3');
    await element.updateComplete;
    expect(path()).to.equal(suppliedPath);
  });
}
