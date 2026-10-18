import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';

it('discloses outer graph admission loss before child projection discards its provenance', async () => {
  const properties = ['nodes', 'edges'] as const;
  const warningKeys = properties.map(property => collectionTruncationWarningKey('lr-knowledge-graph-explorer', property));
  const warnings = properties.map(property => `<lr-knowledge-graph-explorer>: '${property}' kept 10000 of 10001 entries, the oldest; an assignment keeps at most 10000 per array and 50000 values, and drops values it cannot copy.`);
  const store = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  const previouslyIssued = warningKeys.map(key => store?.has(key));
  for (const key of warningKeys) store?.delete(key);
  const previousWarn = console.warn;
  const counts = warnings.map(() => 0);
  console.warn = (...args: unknown[]) => {
    const index = args.length === 1 && typeof args[0] === 'string' ? warnings.indexOf(args[0]) : -1;
    if (index !== -1) counts[index]!++;
    else previousWarn.apply(console, args);
  };
  let el: LyraKnowledgeGraphExplorer | undefined;
  try {
    const nodes = Array.from({ length: 10_001 }, (_, index) => ({ id: `n${index}`, label: 'Node' }));
    el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="list" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
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
  } finally {
    try {
      // Disconnect can schedule another render; keep the diagnostics captured through teardown.
      el?.remove();
      await el?.updateComplete;
    } finally {
      console.warn = previousWarn;
      warningKeys.forEach((key, index) => {
        if (previouslyIssued[index]) store?.add(key);
        else store?.delete(key);
      });
    }
  }
  expect(counts).to.deep.equal(store ? [1, 1] : [0, 0]);
});
