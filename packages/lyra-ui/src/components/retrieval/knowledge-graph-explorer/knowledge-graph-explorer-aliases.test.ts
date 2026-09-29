import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import type { LyraGraph, LyraGraphEdge, LyraGraphNode } from '../graph/graph.class.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

const TIMEOUT = 5000;
const nodes: LyraGraphNode[] = [
  { id: 'marie', label: 'Marie Curie', communityId: 'lab' },
  { id: 'pierre', label: 'Pierre Curie', communityId: 'lab' },
  { id: 'polonium', label: 'Polonium' },
];
const edges: LyraGraphEdge[] = [{ source: 'marie', target: 'pierre', label: 'married_to' }];

const ALIASES: readonly DeprecatedUsage[] = [
  { tag: 'lr-knowledge-graph-explorer', kind: 'property', name: 'links' },
  { tag: 'lr-knowledge-graph-explorer', kind: 'property', name: 'searchQuery' },
  { tag: 'lr-knowledge-graph-explorer', kind: 'event', name: 'lr-community-click' },
  { tag: 'lr-graph', kind: 'event', name: 'lr-community-click' },
];

function graphOf(el: LyraKnowledgeGraphExplorer): LyraGraph {
  return el.shadowRoot!.querySelector('[part="graph"]') as LyraGraph;
}

function searchState(el: LyraKnowledgeGraphExplorer): string {
  return JSON.stringify([
    [...el.shadowRoot!.querySelectorAll('[part="search-result"]')].map((row) =>
      row.textContent!.trim()
    ),
    graphOf(el).dimmedNodeIds,
  ]);
}

describe('lr-knowledge-graph-explorer canonical names after alias retirement', () => {
  it('forwards edges and applies query without a deprecation warning', async () => {
    let forwarded: readonly LyraGraphEdge[] = [];
    let state = '';
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
        query="polonium"
        .nodes=${nodes}
        .edges=${edges}
      ></lr-knowledge-graph-explorer>`);
      await el.updateComplete;
      forwarded = graphOf(el).edges;
      state = searchState(el);
    });
    expect(forwarded).to.deep.equal(edges);
    expect(state).to.include('Polonium');
    expect(warnings).to.have.length(0);
  });

  it('ignores search-query in either order and keeps canonical edges clone-owned', async () => {
    for (const markup of [
      html`<lr-knowledge-graph-explorer query="marie" search-query="pierre" .nodes=${nodes} .edges=${edges}></lr-knowledge-graph-explorer>`,
      html`<lr-knowledge-graph-explorer search-query="pierre" query="marie" .nodes=${nodes} .edges=${edges}></lr-knowledge-graph-explorer>`,
    ]) {
      const el = await fixture<LyraKnowledgeGraphExplorer>(markup);
      await el.updateComplete;
      expect(el.query).to.equal('marie');
      expect(el.edges).to.deep.equal(edges);
      expect(Object.isFrozen(el.edges)).to.equal(true);
      expect('links' in el).to.equal(false);
      expect('searchQuery' in el).to.equal(false);
    }
  });

  it('bubbles lr-community-activate without the retired alias from the composed graph', async () => {
    const seen: string[] = [];
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
        .nodes=${nodes}
        .edges=${edges}
        .communities=${[{ id: 'lab', label: 'Lab', memberIds: [] }]}
      ></lr-knowledge-graph-explorer>`);
      for (const type of ['lr-community-activate', 'lr-community-click']) {
        el.addEventListener(type, (event) =>
          seen.push(`${type}:${JSON.stringify((event as CustomEvent).detail)}`)
        );
      }
      const graph = graphOf(el);
      await waitUntil(
        () => graph.shadowRoot!.querySelector('[part="hull"]') != null,
        'composed graph never drew its community hull',
        { timeout: TIMEOUT }
      );
      graph.shadowRoot!.querySelector('[part="hull"]')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });
    const detail = JSON.stringify({ communityId: 'lab' });
    expect(seen).to.deep.equal([
      `lr-community-activate:${detail}`,
    ]);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-knowledge-graph-explorer CSS-length width and height', () => {
  it('forwards a plain number normalized and a CSS length verbatim to the composed graph', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
      width="500"
      height="20rem"
    ></lr-knowledge-graph-explorer>`);
    await el.updateComplete;
    const graph = graphOf(el);
    expect([el.width, el.height]).to.deep.equal([500, '20rem']);
    expect([graph.getAttribute('width'), graph.getAttribute('height')]).to.deep.equal([
      '500',
      '20rem',
    ]);
    expect([graph.width, graph.height]).to.deep.equal([500, '20rem']);
  });

  it('keeps forwarding the defaults for a value it cannot resolve', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
      width="wide"
      height="-5"
    ></lr-knowledge-graph-explorer>`);
    await el.updateComplete;
    const graph = graphOf(el);
    expect([graph.getAttribute('width'), graph.getAttribute('height')]).to.deep.equal([
      '800',
      '1',
    ]);
  });
});

expectStaleAttribute('lr-knowledge-graph-explorer', 'search-query');
