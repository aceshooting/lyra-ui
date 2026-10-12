import { expect } from '@open-wc/testing';
import './knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import type { LyraGraphNode } from '../graph/graph.class.js';
import { measureArrayMembership } from '../../../../test/array-membership-cost.js';

type SearchProjection = {
  matchingNodes(): LyraGraphNode[] | undefined;
  isVisibleGraphNode(node: LyraGraphNode): boolean;
};

it('indexes hidden types per search pass while retaining memo hits and fresh visibility checks', () => {
  const explorer = document.createElement('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;
  const nodes: LyraGraphNode[] = Array.from({ length: 128 }, (_, index) => ({
    id: `node-${index}`, label: `Match ${index}`, type: `search-cost-${index}`,
  }));
  nodes.push({ id: 'untyped', label: 'Match untyped' });
  explorer.nodes = nodes;
  explorer.hiddenTypes = [...nodes.filter((_node, index) => index % 2 === 0 && index < 128).map((node) => node.type!).reverse(), '', 'search-cost-0'];
  explorer.query = 'Match';
  const internal = explorer as unknown as SearchProjection;
  const measured = measureArrayMembership('search-cost-', () => internal.matchingNodes());
  const expected = nodes.filter((_node, index) => index % 2 !== 0 || index === 128).map((node) => node.id);
  expect(measured.value?.map((node) => node.id)).to.deep.equal(expected);
  expect(measured.comparisons).to.be.at.most(nodes.length * 2);
  expect(internal.matchingNodes() === measured.value).to.equal(true);

  explorer.hiddenTypes = ['search-cost-1'];
  expect(internal.isVisibleGraphNode(nodes[0]!)).to.equal(true);
  expect(internal.isVisibleGraphNode(nodes[1]!)).to.equal(false);
  expect(internal.matchingNodes()?.map((node) => node.id)).to.deep.equal(nodes.filter((_node, index) => index !== 1).map((node) => node.id));
  explorer.query = '';
  expect(internal.matchingNodes()).to.equal(undefined);
});
