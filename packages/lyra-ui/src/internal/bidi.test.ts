import { expect, fixture } from '@open-wc/testing';
import { html, render } from 'lit';
import { bdi, isolateText, ltrIsolate } from './bidi.js';

describe('bidi isolation', () => {
  it('renders caller text in a bdi, auto by default and LTR on request', async () => {
    const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
    render(html`${isolateText('run-42')}${isolateText('-1.5', 'ltr')}${bdi(7)}${bdi(null)}`, host);
    const nodes = Array.from(host.querySelectorAll('bdi'));
    expect(nodes.map(n => n.getAttribute('dir'))).to.deep.equal(['auto', 'ltr', 'auto', 'auto']);
    expect(nodes.map(n => n.textContent)).to.deep.equal(['run-42', '-1.5', '7', '']);
    expect(getComputedStyle(nodes[0]!).unicodeBidi).to.equal('isolate');
  });

  it('wraps strings in LTR isolates for aria and title text', () => {
    expect(ltrIsolate('ID-9')).to.equal('⁦ID-9⁩');
    expect(`Row ${ltrIsolate('-1.5')} of`).to.contain('⁦-1.5⁩');
  });
});
