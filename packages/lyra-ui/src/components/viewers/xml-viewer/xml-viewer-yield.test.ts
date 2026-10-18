import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraXmlViewer } from './xml-viewer.class.js';
import './xml-viewer.js';

it('yields before remote XML parsing while preserving synchronous inline assignment', async () => {
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
  const seam = el as unknown as { xmlState: { kind: string } };
  const fetch = window.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'scheduler');
  const parse = DOMParser.prototype.parseFromString;
  const stages: string[] = [];
  window.fetch = async () => new Response('<root><item/></root>');
  Object.defineProperty(window, 'scheduler', { configurable: true, value: { yield: async () => { stages.push('yield'); } } });
  DOMParser.prototype.parseFromString = function (...args) { stages.push('parse'); return Reflect.apply(parse, this, args); };
  try {
    el.src = '/yield.xml';
    await waitUntil(() => seam.xmlState.kind === 'loaded');
    expect(stages).to.deep.equal(['yield', 'parse']);
    stages.length = 0;
    el.xml = '<inline/>';
    expect(seam.xmlState.kind).to.equal('loaded');
    expect(stages).to.deep.equal(['parse']);
  } finally {
    window.fetch = fetch;
    DOMParser.prototype.parseFromString = parse;
    if (descriptor) Object.defineProperty(window, 'scheduler', descriptor);
    else Reflect.deleteProperty(window, 'scheduler');
  }
});
