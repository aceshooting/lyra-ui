import { expect, fixture, html } from '@open-wc/testing';
import type { LyraXmlViewer } from './xml-viewer.class.js';
import './xml-viewer.js';

type Limits = { maxNodes: number; maxRows: number; maxBytes: number };
it('defaults XML ceilings and applies reduced node and row limits', async () => {
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
  const limits = el as unknown as Limits;
  expect([limits.maxNodes, limits.maxRows, limits.maxBytes]).to.deep.equal([50000, 5000, 26214400]);
  limits.maxRows = 3;
  el.xml = '<root><a/><b/><c/><d/></root>';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="limit"]') !== null).to.equal(true);
  limits.maxNodes = 2;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});
it('checks the configured byte budget before invoking the inline XML parser', async () => {
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
  (el as unknown as Limits).maxBytes = 8;
  await el.updateComplete;
  const original = DOMParser.prototype.parseFromString;
  let calls = 0;
  DOMParser.prototype.parseFromString = function (...args) { calls++; return Reflect.apply(original, this, args); };
  try {
    el.xml = '<root>too much</root>';
    await el.updateComplete;
    expect(calls).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  } finally { DOMParser.prototype.parseFromString = original; }
});
