import { expect, fixture, html } from '@open-wc/testing';
import './stack-trace.js';
import type { LyraStackTrace } from './stack-trace.js';

describe('lr-stack-trace removed trace', () => {
  it('clears parsed frames and recovers without changing null readback', async () => {
    const el = await fixture<LyraStackTrace>(html`<lr-stack-trace trace="Error: before&#10;    at run (/app/main.js:3:4)"></lr-stack-trace>`);
    expect(el.shadowRoot!.textContent!.includes('/app/main.js')).to.equal(true);
    el.removeAttribute('trace');
    await el.updateComplete;
    expect(el.trace).to.equal(null);
    expect(el.shadowRoot!.textContent!.includes('/app/main.js')).to.equal(false);
    el.setAttribute('trace', '');
    await el.updateComplete;
    expect(el.trace).to.equal('');
    el.setAttribute('trace', 'Error: restored\n    at next (/app/next.js:5:6)');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent!.includes('/app/next.js')).to.equal(true);
  });
});
