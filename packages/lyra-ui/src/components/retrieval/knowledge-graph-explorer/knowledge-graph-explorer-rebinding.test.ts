import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import type { LyraGraph, LyraGraphEdge, LyraGraphNode } from '../graph/graph.class.js';
import type { LyraEntityCard } from '../entity-card/entity-card.class.js';
import type { LyraNeighborList } from '../neighbor-list/neighbor-list.class.js';

const nodeTypes = [{ id: 'person', label: 'Person' }];
const nodes: LyraGraphNode[] = [
  { id: 'marie', label: 'Marie Curie', type: 'person' },
  { id: 'pierre', label: 'Pierre Curie', type: 'person' },
  { id: 'polonium', label: 'Polonium' },
  { id: 'radium', label: 'Radium' },
];
const edges: LyraGraphEdge[] = [
  { source: 'marie', target: 'pierre', label: 'married_to' },
  { source: 'marie', target: 'polonium', label: 'discovered' },
];

async function mountExplorer(
  template = html`<lr-knowledge-graph-explorer
    .nodes=${nodes}
    .edges=${edges}
    .nodeTypes=${nodeTypes}
  ></lr-knowledge-graph-explorer>`
): Promise<{ explorer: LyraKnowledgeGraphExplorer; graph: LyraGraph }> {
  const explorer = await fixture<LyraKnowledgeGraphExplorer>(template);
  const graph = explorer.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
  await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'graph loaded', {
    timeout: 5000,
  });
  return { explorer, graph };
}

describe('lr-knowledge-graph-explorer derived bindings', () => {
  it('filters search matches once per update, not once per consumer', async () => {
    const many = Array.from({ length: 200 }, (_, index) => ({
      id: `n${index}`,
      label: `Node ${index}`,
    }));
    const { explorer } = await mountExplorer(html`<lr-knowledge-graph-explorer
      .nodes=${many}
    ></lr-knowledge-graph-explorer>`);
    const prototype = String.prototype as unknown as {
      toLocaleLowerCase: (...args: unknown[]) => string;
    };
    const native = prototype.toLocaleLowerCase;
    let calls = 0;
    prototype.toLocaleLowerCase = function (this: string, ...args: unknown[]) {
      calls += 1;
      return native.apply(this, args);
    };
    try {
      explorer.query = 'zzz';
      await explorer.updateComplete;
    } finally {
      prototype.toLocaleLowerCase = native;
    }
    // Two searchable names per node (label, id): one filtering pass lowercases 400 strings.
    expect(calls).to.be.below(3 * many.length);
  });

  it('keeps every composed binding identical across a re-render with unchanged inputs', async () => {
    const { explorer, graph } = await mountExplorer();
    explorer.selectedNodeId = 'marie';
    await explorer.updateComplete;
    await graph.updateComplete;
    const card = explorer.shadowRoot!.querySelector<LyraEntityCard>('lr-entity-card')!;
    const list = explorer.shadowRoot!.querySelector<LyraNeighborList>('lr-neighbor-list')!;
    const before = {
      selected: graph.selectedNodeIds,
      dimmedNodes: graph.dimmedNodeIds,
      dimmedEdges: graph.dimmedEdgeIds,
      entity: card.entity,
      rows: list.rows,
    };
    expect(before.dimmedNodes).to.deep.equal(['radium']);
    explorer.requestUpdate();
    await explorer.updateComplete;
    expect(graph.selectedNodeIds === before.selected, 'selectedNodeIds').to.equal(true);
    expect(graph.dimmedNodeIds === before.dimmedNodes, 'dimmedNodeIds').to.equal(true);
    expect(graph.dimmedEdgeIds === before.dimmedEdges, 'dimmedEdgeIds').to.equal(true);
    expect(card.entity === before.entity, 'entity').to.equal(true);
    expect(list.rows === before.rows, 'rows').to.equal(true);
  });

  it('stops dimming around a hovered node once it is hidden or the explorer reconnects', async () => {
    const { explorer, graph } = await mountExplorer(html`<lr-knowledge-graph-explorer
      highlight="hover"
      .nodes=${nodes}
      .edges=${edges}
      .nodeTypes=${nodeTypes}
    ></lr-knowledge-graph-explorer>`);
    graph.dispatchEvent(
      new CustomEvent('lr-node-enter', { detail: { nodeId: 'marie' }, bubbles: true, composed: true })
    );
    await explorer.updateComplete;
    expect([...graph.dimmedNodeIds]).to.deep.equal(['radium']);
    explorer.hiddenTypes = ['person'];
    await explorer.updateComplete;
    expect([...graph.dimmedNodeIds]).to.deep.equal([]);

    explorer.hiddenTypes = [];
    await explorer.updateComplete;
    graph.dispatchEvent(
      new CustomEvent('lr-node-enter', { detail: { nodeId: 'marie' }, bubbles: true, composed: true })
    );
    await explorer.updateComplete;
    expect([...graph.dimmedNodeIds]).to.deep.equal(['radium']);
    const parent = explorer.parentNode!;
    explorer.remove();
    parent.appendChild(explorer);
    await explorer.updateComplete;
    expect([...graph.dimmedNodeIds]).to.deep.equal([]);
  });

  it('caps search results and gives them one roving tab stop', async () => {
    const many = Array.from({ length: 120 }, (_, index) => ({ id: `n${index}`, label: `Node ${index}` }));
    const { explorer } = await mountExplorer(html`<lr-knowledge-graph-explorer
      query="node"
      .nodes=${many}
    ></lr-knowledge-graph-explorer>`);
    const buttons = () => [...explorer.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="search-result"] button')];
    expect(buttons().length).to.equal(50);
    expect(buttons().filter((button) => button.tabIndex === 0).length).to.equal(1);
    await focusByKeyboard(buttons()[0]!);
    await sendKeys({ press: 'ArrowDown' });
    await explorer.updateComplete;
    expect(explorer.shadowRoot!.activeElement === buttons()[1], 'focus moved down').to.equal(true);
    expect(buttons()[1]!.tabIndex).to.equal(0);
  });
});
