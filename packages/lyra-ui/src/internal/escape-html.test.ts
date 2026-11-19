import { expect } from '@open-wc/testing';
import { escapeHtml } from './escape-html.js';

describe('escape-html', () => {
  it('escapes the five significant characters', () => {
    expect(escapeHtml(`<a href="x" t='y'>&</a>`)).to.equal('&lt;a href=&quot;x&quot; t=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
  it('does not double escape its own output within one pass', () => {
    expect(escapeHtml('&lt;')).to.equal('&amp;lt;');
  });
  it('leaves CR alone by default and entity-encodes it for SVG text', () => {
    expect(escapeHtml('a\rb')).to.equal('a\rb');
    expect(escapeHtml('a\rb<', { svgText: true })).to.equal('a&#13;b&lt;');
  });
  it('round-trips through the DOM', () => {
    const text = `<>&"' plain`;
    const host = document.createElement('div');
    host.innerHTML = `<span title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
    expect(host.firstElementChild!.textContent).to.equal(text);
    expect(host.firstElementChild!.getAttribute('title')).to.equal(text);
  });
});
