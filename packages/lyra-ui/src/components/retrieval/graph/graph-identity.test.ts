import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './graph.js';
import '../knowledge-graph-explorer/knowledge-graph-explorer.js';
import '../neighbor-list/neighbor-list.js';
import '../community-card/community-card.js';
import '../entity-card/entity-card.js';
import '../entity-chip/entity-chip.js';
import '../path-strip/path-strip.js';
import '../mind-map/mind-map.js';
import '../graph-legend/graph-legend.js';
import type { LyraGraph } from './graph.js';
import { graphLinkIdentity, normalizeGraphModel } from './graph-model.js';
import type {
  LyraGraphCommunity,
  LyraGraphLink,
} from './graph-model.js';
import type { LyraKnowledgeGraphExplorer } from '../knowledge-graph-explorer/knowledge-graph-explorer.js';
import type { LyraNeighborList } from '../neighbor-list/neighbor-list.js';
import type { LyraCommunityCard } from '../community-card/community-card.js';
import type { LyraEntityCard } from '../entity-card/entity-card.js';
import type { LyraEntityChip } from '../entity-chip/entity-chip.js';
import type { LyraPathStrip } from '../path-strip/path-strip.js';
import type { LyraMindMap } from '../mind-map/mind-map.js';
import type { LyraGraphLegend } from '../graph-legend/graph-legend.js';

it('normalizes every keyed graph collection with nonblank first-wins identities', () => {
  const firstNode = { id: 'node-a', label: 'First' };
  const firstLink = {
    id: 'edge-a',
    source: 'node-a',
    target: 'node-b',
    label: 'First edge',
  };
  const model = normalizeGraphModel(
    [
      firstNode,
      { id: ' ', label: 'Blank' },
      { id: 'node-a', label: 'Later' },
      { id: 'node-b', label: 'Second' },
    ],
    [
      firstLink,
      { id: 'edge-a', source: 'node-b', target: 'node-a' },
      { source: 'node-a', target: 'node-b' },
      { source: 'node-a', target: 'node-b' },
      { id: ' ', source: 'node-a', target: 'node-b' },
      { source: '', target: 'node-b' },
    ],
    [
      { id: 'person', label: 'Person' },
      { id: '', label: 'Blank' },
      { id: 'person', label: 'Later' },
    ],
    [
      {
        id: 'community-a',
        label: 'First community',
        memberIds: ['node-a', '', 'node-a', 'node-b'],
      },
      { id: 'community-a', label: 'Later community', memberIds: [] },
      { id: ' ', label: 'Blank community', memberIds: [] },
    ]
  );

  expect(model.nodes).to.deep.equal([
    firstNode,
    { id: 'node-b', label: 'Second' },
  ]);
  expect(model.links).to.deep.equal([
    firstLink,
    { source: 'node-a', target: 'node-b' },
  ]);
  expect(model.nodeTypes).to.deep.equal([{ id: 'person', label: 'Person' }]);
  expect(model.communities).to.deep.equal([
    {
      id: 'community-a',
      label: 'First community',
      memberIds: ['node-a', 'node-b'],
    },
  ]);
});

it('normalizes malformed runtime links and missing community membership', () => {
  const malformedLinks = normalizeGraphModel(
    [],
    null as unknown as readonly LyraGraphLink[],
    [],
    []
  );
  expect(malformedLinks.links).to.deep.equal([]);

  const mixedLinks = normalizeGraphModel(
    [],
    [null, 42, { source: 'node-a', target: 'node-b' }] as unknown as readonly LyraGraphLink[],
    [],
    [{ id: 'empty-members' } as LyraGraphCommunity]
  );
  expect(mixedLinks.links).to.deep.equal([
    { source: 'node-a', target: 'node-b' },
  ]);
  expect(mixedLinks.communities).to.deep.equal([
    { id: 'empty-members', memberIds: [] },
  ]);
});

it('keeps an explicit link id distinct from an implicit endpoint identity', () => {
  const model = normalizeGraphModel(
    [],
    [
      { source: 'a', target: 'b' },
      { id: 'a->b', source: 'a', target: 'b' },
    ],
    [],
    []
  );

  expect(model.links).to.have.length(2);
  expect(model.links.map((link) => graphLinkIdentity(link))).to.deep.equal([
    'implicit:a->b',
    'a->b',
  ]);
});

it('projects the same canonical graph model through the explorer and graph', async () => {
  const explorer = await fixture<LyraKnowledgeGraphExplorer>(
    html`<lr-knowledge-graph-explorer></lr-knowledge-graph-explorer>`
  );
  explorer.nodes = [
    { id: 'node-a', label: 'First' },
    { id: 'node-a', label: 'Later' },
    { id: '', label: 'Blank' },
  ];
  explorer.links = [
    { source: 'node-a', target: 'node-a' },
    { source: 'node-a', target: 'node-a' },
  ];
  explorer.nodeTypes = [
    { id: 'person', label: 'First type' },
    { id: 'person', label: 'Later type' },
  ];
  explorer.communities = [
    { id: 'group', label: 'First group', memberIds: ['node-a', 'node-a'] },
    { id: 'group', label: 'Later group', memberIds: [] },
  ];
  await explorer.updateComplete;
  const graph = explorer.shadowRoot!.querySelector('lr-graph') as LyraGraph;
  expect(graph.nodes.map((node) => node.label)).to.deep.equal(['First']);
  expect(graph.links).to.have.length(1);
  expect(graph.nodeTypes.map((type) => type.label)).to.deep.equal([
    'First type',
  ]);
  expect(graph.communities[0]!.memberIds).to.deep.equal(['node-a']);
});

it('omits blank and later duplicate entity rows before rendering or events', async () => {
  const list = await fixture<LyraNeighborList>(
    html`<lr-neighbor-list></lr-neighbor-list>`
  );
  list.rows = [
    {
      relation: 'first',
      direction: 'out',
      node: { id: 'node-a', label: 'First' },
    },
    { relation: 'blank', direction: 'out', node: { id: ' ', label: 'Blank' } },
    {
      relation: 'later',
      direction: 'out',
      node: { id: 'node-a', label: 'Later' },
    },
  ];
  await list.updateComplete;
  const buttons = list.shadowRoot!.querySelectorAll<HTMLButtonElement>(
    '[part="node-label"]'
  );
  expect(buttons).to.have.length(1);
  expect(buttons[0]!.textContent).to.include('First');
  const activation = oneEvent(list, 'lr-entity-select');
  buttons[0]!.click();
  expect((await activation).detail).to.deep.equal({ entityId: 'node-a' });
});

it('renders blank cards and chips inert while retaining first type and member rows', async () => {
  const chip = await fixture<LyraEntityChip>(
    html`<lr-entity-chip entity-id=" " text="Blank"></lr-entity-chip>`
  );
  const chipButton = chip.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  expect(chipButton.disabled).to.be.true;

  const entityCard = await fixture<LyraEntityCard>(
    html`<lr-entity-card></lr-entity-card>`
  );
  entityCard.entity = { id: 'entity-a', label: 'Entity', type: 'person' };
  entityCard.types = [
    { id: 'person', label: 'First type' },
    { id: '', label: 'Blank type' },
    { id: 'person', label: 'Later type' },
  ];
  await entityCard.updateComplete;
  expect(
    entityCard.shadowRoot!.querySelector('[part="type-badge"]')!.textContent
  ).to.include('First type');
  entityCard.entity = { id: ' ', label: 'Blank entity' };
  await entityCard.updateComplete;
  expect(entityCard.shadowRoot!.querySelector('[part="empty"]')).to.exist;

  const community = await fixture<LyraCommunityCard>(
    html`<lr-community-card></lr-community-card>`
  );
  community.community = { id: 'group', label: 'Group' };
  community.members = [
    { id: 'entity-a', label: 'First member' },
    { id: '', label: 'Blank member' },
    { id: 'entity-a', label: 'Later member' },
  ];
  await community.updateComplete;
  expect(
    community.shadowRoot!.querySelectorAll('[part="member"]')
  ).to.have.length(1);
  community.community = { id: ' ', label: 'Blank group' };
  await community.updateComplete;
  expect(community.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('retains deliberate path repetitions with caller occurrence indices', async () => {
  const path = await fixture<LyraPathStrip>(
    html`<lr-path-strip></lr-path-strip>`
  );
  path.path = [
    { kind: 'node', node: { id: 'entity-a', label: 'First occurrence' } },
    { kind: 'edge', relation: 'related' },
    { kind: 'node', node: { id: '', label: 'Blank occurrence' } },
    { kind: 'node', node: { id: 'entity-a', label: 'Second occurrence' } },
  ];
  await path.updateComplete;
  const nodes =
    path.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="node"]');
  expect(nodes).to.have.length(2);
  const entityActivation = oneEvent(path, 'lr-entity-activate');
  nodes[1]!.click();
  expect((await entityActivation).detail).to.deep.equal({
    entityId: 'entity-a',
    occurrenceIndex: 3,
  });
  const relationActivation = oneEvent(path, 'lr-relation-activate');
  path
    .shadowRoot!.querySelector<HTMLButtonElement>('[part="relation"]')!
    .click();
  expect((await relationActivation).detail).to.deep.equal({
    relation: 'related',
    sourceNodeId: 'entity-a',
    targetNodeId: 'entity-a',
    occurrenceIndex: 1,
  });
});

it('canonicalizes legend types and emits topic identities with domain names', async () => {
  const legend = await fixture<LyraGraphLegend>(
    html`<lr-graph-legend></lr-graph-legend>`
  );
  legend.types = [
    { id: 'person', label: 'First' },
    { id: '', label: 'Blank' },
    { id: 'person', label: 'Later' },
  ];
  await legend.updateComplete;
  expect(legend.shadowRoot!.querySelectorAll('[part~="item"]')).to.have.length(
    1
  );

  const mindMap = await fixture<LyraMindMap>(html`<lr-mind-map></lr-mind-map>`);
  mindMap.topics = [{ id: 'topic-a', label: 'Topic' }];
  await mindMap.updateComplete;
  const selection = oneEvent(mindMap, 'lr-topic-select');
  mindMap
    .shadowRoot!.querySelector<SVGGElement>('[part="node"]')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect((await selection).detail).to.deep.equal({ topicId: 'topic-a' });
});
