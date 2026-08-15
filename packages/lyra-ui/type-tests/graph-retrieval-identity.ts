import type {
  LyraGraph,
  LyraGraphEventMap,
} from '../src/components/retrieval/graph/graph.class.js';
import type { LyraKnowledgeGraphExplorerEventMap } from '../src/components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.js';
import type { LyraPathStripEventMap } from '../src/components/retrieval/path-strip/path-strip.class.js';
import type { LyraMindMapEventMap } from '../src/components/retrieval/mind-map/mind-map.class.js';

declare const graph: LyraGraph;
graph.focusNodeId = 'entity-a';
// @ts-expect-error focusId was replaced by the domain-specific focusNodeId.
graph.focusId = 'entity-a';

const nodeClick: LyraGraphEventMap['lr-node-click']['detail'] = {
  nodeId: 'entity-a',
  x: 1,
  y: 2,
};
const legacyNodeClick: LyraGraphEventMap['lr-node-click']['detail'] = {
  // @ts-expect-error graph node events no longer overload id.
  id: 'entity-a',
  x: 1,
  y: 2,
};
const linkClick: LyraGraphEventMap['lr-link-click']['detail'] = {
  sourceNodeId: 'entity-a',
  targetNodeId: 'entity-b',
  linkId: 'relationship-a',
};
const pathRequest: LyraKnowledgeGraphExplorerEventMap['lr-path-request']['detail'] =
  {
    sourceNodeId: 'entity-a',
    targetNodeId: 'entity-b',
  };
const pathEntity: LyraPathStripEventMap['lr-entity-activate']['detail'] = {
  entityId: 'entity-a',
  occurrenceIndex: 2,
};
const pathRelation: LyraPathStripEventMap['lr-relation-activate']['detail'] = {
  relation: 'related-to',
  sourceNodeId: 'entity-a',
  targetNodeId: 'entity-b',
  occurrenceIndex: 1,
};
const topicSelection: LyraMindMapEventMap['lr-topic-select']['detail'] = {
  topicId: 'topic-a',
};

void nodeClick;
void legacyNodeClick;
void linkClick;
void pathRequest;
void pathEntity;
void pathRelation;
void topicSelection;
