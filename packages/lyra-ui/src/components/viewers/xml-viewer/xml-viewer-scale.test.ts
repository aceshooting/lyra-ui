import { expect, fixture, html } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraXmlViewer } from './xml-viewer.class.js';
import './xml-viewer.js';

it('moves the XML search cursor without rebuilding nodes or resolving highlights', async () => {
  const xml = `<root>${'<item>Match</item>'.repeat(1000)}</root>`;
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .xml=${xml}></lr-xml-viewer>`);
  await el.search('Match');
  const seam = el as unknown as { renderNode(...args: unknown[]): unknown; resolveHighlights(): unknown };
  const originalNode = seam.renderNode;
  const originalHighlights = seam.resolveHighlights;
  let nodes = 0;
  let highlights = 0;
  seam.renderNode = function (...args) { nodes++; return originalNode.apply(this, args); };
  seam.resolveHighlights = function () { highlights++; return originalHighlights.call(this); };
  try {
    await el.searchNext();
    await el.updateComplete;
    recordScaleMeasurement('lr-xml-viewer', 'cursor@1000', { nodes, highlights });
    expect(nodes).to.equal(0);
    expect(highlights).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="node"][data-active-match]').length).to.equal(1);
  } finally { seam.renderNode = originalNode; seam.resolveHighlights = originalHighlights; }
});

it('rejects excessive inline XML nodes before calling DOMParser', async () => {
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
  const original = DOMParser.prototype.parseFromString;
  let parses = 0;
  DOMParser.prototype.parseFromString = function (...args) { parses++; return Reflect.apply(original, this, args); };
  try {
    el.xml = `<root>${'<item/>'.repeat(50001)}</root>`;
    await el.updateComplete;
    recordScaleMeasurement('lr-xml-viewer', 'preflight@50001', { parses });
    expect(parses).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  } finally { DOMParser.prototype.parseFromString = original; }
});

it('does not materialize child-node arrays when refreshing a collapsed tree', async () => {
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer expand-depth="0" .xml=${`<root>${'<item/>'.repeat(1000)}</root>`}></lr-xml-viewer>`);
  const original = Array.from;
  let lists = 0;
  Array.from = function (this: ArrayConstructor, source: unknown, ...args: unknown[]) {
    if (source instanceof NodeList) lists++;
    return Reflect.apply(original, this, [source, ...args]);
  } as typeof Array.from;
  try {
    el.requestUpdate();
    await el.updateComplete;
    recordScaleMeasurement('lr-xml-viewer', 'collapsed-refresh@1000', { childNodeArrays: lists });
    expect(lists).to.equal(0);
    expect(el.shadowRoot!.querySelector('.preview')?.textContent).to.include('1,000');
  } finally { Array.from = original; }
});
