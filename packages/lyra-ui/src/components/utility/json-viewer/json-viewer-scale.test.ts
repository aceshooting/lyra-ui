import { expect, fixture, html } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraJsonViewer } from './json-viewer.class.js';
import './json-viewer.js';

it('moves the search cursor without rebuilding a 1,000-value JSON tree', async () => {
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${Array.from({ length: 1000 }, (_, index) => `Match ${index}`)}></lr-json-viewer>`);
  await el.runSearch('Match');
  await el.searchNext();
  const seam = el as unknown as { renderNode(...args: unknown[]): unknown };
  const original = seam.renderNode;
  let nodes = 0;
  seam.renderNode = function (...args) { nodes++; return original.apply(this, args); };
  try {
    await el.searchNext();
    await el.updateComplete;
    recordScaleMeasurement('lr-json-viewer', 'cursor@1000', { nodes });
    expect(nodes).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="value"][data-active]').length).to.equal(1);
  } finally { seam.renderNode = original; }
});

it('keeps already search-expanded branches stable when navigating nested matches', async () => {
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${Array.from({ length: 1000 }, (_, index) => ({ value: `Match ${index}` }))}></lr-json-viewer>`);
  await el.runSearch('Match');
  const seam = el as unknown as { renderNode(...args: unknown[]): unknown };
  const original = seam.renderNode;
  let nodes = 0;
  seam.renderNode = function (...args) { nodes++; return original.apply(this, args); };
  try {
    await el.searchNext();
    await el.updateComplete;
    recordScaleMeasurement('lr-json-viewer', 'nested-cursor@1000', { nodes });
    expect(nodes).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="value"][data-active]').length).to.equal(1);
  } finally { seam.renderNode = original; }
});

it('reopens a manually collapsed ancestor when navigating to its search match', async () => {
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${[{ value: 'Match one' }, { value: 'Match two' }]}></lr-json-viewer>`);
  await el.runSearch('Match');
  const seam = el as unknown as { toggle(pathKey: string, expanded: boolean): void; expandedOverrides: Map<string, boolean> };
  seam.expandedOverrides = new Map([['[0]', false]]);
  await el.updateComplete;
  await el.searchNext();
  await el.updateComplete;
  expect(seam.expandedOverrides.get('[0]')).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="value"][data-active]')?.textContent).to.include('Match one');
});
