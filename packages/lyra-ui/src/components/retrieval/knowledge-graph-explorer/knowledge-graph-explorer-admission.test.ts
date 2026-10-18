import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';

it('discloses outer graph admission loss before child projection discards its provenance', async () => {
  const nodes = Array.from({ length: 10_001 }, (_, index) => ({ id: `n${index}`, label: 'Node' }));
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="list" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('10,001 nodes');
  el.strings = { graphNodeLimit: 'Retained {shown} from {total}' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Retained 10,000 from 10,001');
  el.nodes = nodes.slice(0, 1);
  el.edges = Array.from({ length: 10_001 }, (_, index) => ({ id: `e${index}`, source: 'n0', target: 'n0' }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('10,001 links');
  expect(sinkTexts().some(text => text.includes('10,001 links'))).to.equal(true);
  el.edges = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
});
