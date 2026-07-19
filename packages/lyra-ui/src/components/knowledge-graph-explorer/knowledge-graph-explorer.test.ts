import { fixture, expect, html, oneEvent, waitUntil, aTimeout } from '@open-wc/testing';
import './knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import type { LyraGraph, GraphNode, GraphLink, GraphNodeType } from '../graph/graph.class.js';
import type { LyraGraphLegend } from '../graph-legend/graph-legend.class.js';
import type { LyraPopover } from '../overlay/popover.class.js';
import type { LyraEntityCard } from '../entity-card/entity-card.class.js';
import type { LyraNeighborList } from '../neighbor-list/neighbor-list.class.js';
import type { LyraInput } from '../input/input.class.js';

// d3-force's own timer runs on requestAnimationFrame -- Chromium throttles this heavily on a
// backgrounded tab, so tests that need the composed lr-graph to have actually rendered its
// [part="node"] circles (a direct-click test, a keyboard-activation test) give it generous
// headroom, matching graph.test.ts's own NODE_COUNT_TIMEOUT precedent.
const NODE_COUNT_TIMEOUT = 5000;

const nodeTypes: GraphNodeType[] = [{ id: 'person', label: 'Person' }];
const nodes: GraphNode[] = [
  { id: 'marie', label: 'Marie Curie', type: 'person' },
  { id: 'pierre', label: 'Pierre Curie', type: 'person' },
  { id: 'polonium', label: 'Polonium' },
];
const links: GraphLink[] = [
  { source: 'marie', target: 'pierre', label: 'married_to' },
  { source: 'marie', target: 'polonium', label: 'discovered' },
];

// `[part="node"]` lives inside `<lr-graph>`'s own nested shadow root, not this component's --
// `querySelectorAll` never pierces a shadow boundary, so every lookup below resolves the
// `[part="graph"]` host element first, then queries *its* `shadowRoot`.
function graphEl(el: LyraKnowledgeGraphExplorer): LyraGraph {
  return el.shadowRoot!.querySelector('[part="graph"]') as LyraGraph;
}
function graphNodeEls(el: LyraKnowledgeGraphExplorer): SVGElement[] {
  return Array.from(graphEl(el).shadowRoot!.querySelectorAll('[part="node"]'));
}

async function settledFixture(): Promise<LyraKnowledgeGraphExplorer> {
  const el = (await fixture(html`
    <lr-knowledge-graph-explorer .nodes=${nodes} .links=${links} .nodeTypes=${nodeTypes}></lr-knowledge-graph-explorer>
  `)) as LyraKnowledgeGraphExplorer;
  await el.updateComplete;
  await waitUntil(() => graphNodeEls(el).length === nodes.length, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  return el;
}

describe('lr-knowledge-graph-explorer', () => {
  it('defaults to empty data, no selection/pins/path, renderer="svg"', async () => {
    const el = (await fixture(html`<lr-knowledge-graph-explorer></lr-knowledge-graph-explorer>`)) as LyraKnowledgeGraphExplorer;
    expect(el.nodes).to.deep.equal([]);
    expect(el.links).to.deep.equal([]);
    expect(el.pinnedNodeIds).to.deep.equal([]);
    expect(el.path).to.deep.equal([]);
    expect(el.selectedNodeId).to.equal(null);
    expect(el.renderer).to.equal('svg');
  });

  it('registers every composed custom element', async () => {
    // Importing a *.class.js module alone never calls defineElement() -- only the barrel (*.js)
    // does; this proves the registration entry point actually pulls every composed child in.
    await fixture(html`<lr-knowledge-graph-explorer></lr-knowledge-graph-explorer>`);
    for (const tag of ['lr-graph', 'lr-graph-legend', 'lr-entity-card', 'lr-neighbor-list', 'lr-path-strip', 'lr-popover', 'lr-input', 'lr-chip', 'lr-button']) {
      expect(customElements.get(tag), `${tag} should be registered`).to.exist;
    }
  });

  it('passes graph data straight through to the composed lr-graph', async () => {
    const el = (await fixture(html`
      <lr-knowledge-graph-explorer .nodes=${nodes} .links=${links} .nodeTypes=${nodeTypes}></lr-knowledge-graph-explorer>
    `)) as LyraKnowledgeGraphExplorer;
    await el.updateComplete;
    const graph = el.shadowRoot!.querySelector('[part="graph"]') as LyraGraph;
    expect(graph.nodes).to.deep.equal(nodes);
    expect(graph.links).to.deep.equal(links);
    expect(graph.nodeTypes).to.deep.equal(nodeTypes);
  });

  it('wires the composed lr-graph-legend into hiddenTypes on both this component and lr-graph', async () => {
    const el = (await fixture(html`
      <lr-knowledge-graph-explorer .nodes=${nodes} .links=${links} .nodeTypes=${nodeTypes}></lr-knowledge-graph-explorer>
    `)) as LyraKnowledgeGraphExplorer;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const item = legend.shadowRoot!.querySelectorAll('[part~="item"]')[0] as HTMLButtonElement;
    item.click();
    await el.updateComplete;
    expect(el.hiddenTypes).to.deep.equal(['person']);
    const graph = el.shadowRoot!.querySelector('[part="graph"]') as LyraGraph;
    expect(graph.hiddenTypes).to.deep.equal(['person']);
  });

  it('filters search matches, shows a no-matches state, and dims non-matching nodes on lr-graph', async () => {
    const el = (await fixture(html`
      <lr-knowledge-graph-explorer .nodes=${nodes} .links=${links} .nodeTypes=${nodeTypes}></lr-knowledge-graph-explorer>
    `)) as LyraKnowledgeGraphExplorer;
    await el.updateComplete;
    const searchInput = el.shadowRoot!.querySelector('[part="search"]') as LyraInput;
    const native = searchInput.shadowRoot!.querySelector('input') as HTMLInputElement;
    native.value = 'curie';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    const results = el.shadowRoot!.querySelectorAll('[part="search-result"]');
    expect(results.length).to.equal(2);
    const graph = el.shadowRoot!.querySelector('[part="graph"]') as LyraGraph;
    expect(graph.dimmedNodeIds).to.deep.equal(['polonium']);

    native.value = 'nonexistent';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="search-empty"]')).to.exist;
    expect(graph.dimmedNodeIds).to.deep.equal(['marie', 'pierre', 'polonium']);
  });

  it('activating a search result focuses the node and opens the details popover with its entity card', async () => {
    const el = await settledFixture();
    const searchInput = el.shadowRoot!.querySelector('[part="search"]') as LyraInput;
    const native = searchInput.shadowRoot!.querySelector('input') as HTMLInputElement;
    native.value = 'polonium';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    const result = el.shadowRoot!.querySelector('[part="search-result"] button') as HTMLButtonElement;
    result.click();
    await waitUntil(() => (el.shadowRoot!.querySelector('[part="detail-popover"]') as LyraPopover).open, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.selectedNodeId).to.equal('polonium');
    const card = el.shadowRoot!.querySelector('[part="detail-card"]') as LyraEntityCard;
    expect(card.entity?.id).to.equal('polonium');
  });

  it('pins/unpins nodes, emits lr-pin-change, and reveals "Find path" only at exactly two pins', async () => {
    const el = await settledFixture();
    el.selectedNodeId = 'marie';
    await el.updateComplete;

    let listener = oneEvent(el, 'lr-pin-change');
    (el.shadowRoot!.querySelector('[part="detail-card"] lr-button[slot="actions"]') as HTMLElement).click();
    let event = await listener;
    expect(event.detail).to.deep.equal({ pinnedNodeIds: ['marie'] });
    expect(el.pinnedNodeIds).to.deep.equal(['marie']);
    expect(el.shadowRoot!.querySelector('[part="pinned"]')).to.exist;
    // Only one pin so far -- no "Find path" action yet.
    const pinnedRow = () => el.shadowRoot!.querySelector('[part="pinned"]') as HTMLElement;
    expect(pinnedRow().querySelectorAll('lr-button').length).to.equal(0);

    el.pinnedNodeIds = ['marie', 'pierre'];
    await el.updateComplete;
    const findPathButton = pinnedRow().querySelector('lr-button') as HTMLElement;
    expect(findPathButton).to.exist;
    const pathListener = oneEvent(el, 'lr-path-request');
    findPathButton.click();
    const pathEvent = await pathListener;
    expect(pathEvent.detail).to.deep.equal({ sourceId: 'marie', targetId: 'pierre' });

    listener = oneEvent(el, 'lr-pin-change');
    const chip = pinnedRow().querySelector('lr-chip') as HTMLElement;
    (chip.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement).click();
    event = await listener;
    expect(event.detail.pinnedNodeIds).to.have.members(['pierre']);
  });

  it('renders lr-path-strip only when path is non-empty', async () => {
    const el = (await fixture(html`<lr-knowledge-graph-explorer></lr-knowledge-graph-explorer>`)) as LyraKnowledgeGraphExplorer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="path"]')).to.not.exist;
    el.path = [{ kind: 'node', node: { id: 'marie', label: 'Marie Curie' } }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="path"]')).to.exist;
  });

  it('a direct click on a rendered graph node opens the details popover anchored to that node', async () => {
    const el = await settledFixture();
    const circle = graphNodeEls(el)[0]!;
    circle.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await waitUntil(() => (el.shadowRoot!.querySelector('[part="detail-popover"]') as LyraPopover).open, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.selectedNodeId).to.equal('marie');
    const popup = (el.shadowRoot!.querySelector('[part="detail-popover"]') as LyraPopover).shadowRoot!.querySelector(
      '[part="popup"]',
    ) as HTMLElement;
    // showAt() positions the popup as position:fixed with explicit left/top -- proves showAt() was
    // actually invoked with a resolved rect rather than the popover just toggling open with no
    // anchor. `place()`'s own positioning runs through an async computePosition() promise, one or
    // more ticks after `open` itself flips true, so wait for that specifically rather than assuming
    // it settled by the time `open` did.
    await waitUntil(() => popup.style.left !== '', undefined, { timeout: NODE_COUNT_TIMEOUT });
    expect(popup.style.position).to.equal('fixed');
  });

  it('keyboard Enter activation on a graph node (no native click) still opens the details popover', async () => {
    const el = await settledFixture();
    const circle = graphNodeEls(el)[0]!;
    circle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitUntil(() => (el.shadowRoot!.querySelector('[part="detail-popover"]') as LyraPopover).open, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.selectedNodeId).to.equal('marie');
  });

  it('lr-node-expand bubbles straight through from the composed lr-neighbor-list, unmodified', async () => {
    const el = await settledFixture();
    el.selectedNodeId = 'marie';
    await el.updateComplete;
    const neighborList = el.shadowRoot!.querySelector('[part="detail-card"] lr-neighbor-list') as LyraNeighborList;
    const listener = oneEvent(el, 'lr-node-expand');
    neighborList.dispatchEvent(new CustomEvent('lr-node-expand', { detail: { id: 'pierre' }, bubbles: true, composed: true }));
    const event = await listener;
    expect(event.detail).to.deep.equal({ id: 'pierre' });
  });

  it('closing the details popover clears the current selection', async () => {
    const el = await settledFixture();
    el.selectedNodeId = 'marie';
    await el.updateComplete;
    const popover = el.shadowRoot!.querySelector('[part="detail-popover"]') as LyraPopover;
    popover.showAt({ x: 10, y: 10 });
    await el.updateComplete;
    popover.open = false;
    await el.updateComplete;
    expect(el.selectedNodeId).to.equal(null);
  });

  it('localizes the pinned-heading text via this.localize() when .strings overrides graphExplorerPinnedHeading', async () => {
    const el = (await fixture(html`
      <lr-knowledge-graph-explorer .strings=${{ graphExplorerPinnedHeading: 'Épinglé' }}></lr-knowledge-graph-explorer>
    `)) as LyraKnowledgeGraphExplorer;
    el.pinnedNodeIds = ['marie'];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="pinned-heading"]')!.textContent).to.equal('Épinglé');
  });

  it('renders correctly under dir="rtl" and stays accessible', async () => {
    const wrapper = (await fixture(html`
      <div dir="rtl">
        <lr-knowledge-graph-explorer .nodes=${nodes} .links=${links} .nodeTypes=${nodeTypes}></lr-knowledge-graph-explorer>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    await expect(el).to.be.accessible();
  });

  it('shrinks to a 320px allocation without horizontal overflow', async () => {
    const el = (await fixture(html`
      <lr-knowledge-graph-explorer
        style="inline-size: 320px; max-inline-size: 100%;"
        .nodes=${nodes}
        .links=${links}
        .nodeTypes=${nodeTypes}
      ></lr-knowledge-graph-explorer>
    `)) as LyraKnowledgeGraphExplorer;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(el.clientWidth + 1);
  });

  it('is accessible with search results, a pinned node, a path, and an open details popover', async () => {
    const el = await settledFixture();
    el.pinnedNodeIds = ['marie'];
    el.path = [
      { kind: 'node', node: { id: 'marie', label: 'Marie Curie' } },
      { kind: 'edge', relation: 'discovered' },
      { kind: 'node', node: { id: 'polonium', label: 'Polonium' } },
    ];
    await el.updateComplete;
    const searchInput = el.shadowRoot!.querySelector('[part="search"]') as LyraInput;
    const native = searchInput.shadowRoot!.querySelector('input') as HTMLInputElement;
    native.value = 'curie';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const circle = graphNodeEls(el)[0]!;
    circle.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await waitUntil(() => (el.shadowRoot!.querySelector('[part="detail-popover"]') as LyraPopover).open, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(0);
    await expect(el).to.be.accessible();
  });
});
