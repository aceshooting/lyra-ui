import '../src/components/retrieval/chunk-inspector/chunk-inspector.class.js';
import '../src/components/retrieval/source-card/source-card.class.js';
import '../src/components/retrieval/retrieval-trace/retrieval-trace.class.js';
import '../src/components/retrieval/retrieval-results/retrieval-results.class.js';
import '../src/components/retrieval/memory-panel/memory-panel.class.js';
import '../src/components/retrieval/entity-dossier/entity-dossier.class.js';
import '../src/components/retrieval/provenance-panel/provenance-panel.class.js';
import '../src/components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
import '../src/components/layout/widget/widget.class.js';

document.querySelector('lr-chunk-inspector')!.addEventListener('lr-toggle', event => {
  const formerDetail = { chunkId: event.detail.itemId, expanded: event.detail.expanded };
  void formerDetail;
});
document.querySelector('lr-source-card')!.addEventListener('lr-toggle', event => {
  const formerDetail = { sourceId: event.detail.itemId, expanded: event.detail.expanded };
  void formerDetail;
});
document.querySelector('lr-retrieval-trace')!.addEventListener('lr-toggle', event => {
  if (event.detail.stageId !== undefined) return;
  const formerDetail = { stageId: event.detail.itemId, expanded: event.detail.expanded };
  void formerDetail;
});
document.querySelector('lr-retrieval-results')!.addEventListener('lr-selection-change', event => {
  const formerDetail = { chunkIds: event.detail.selectedChunkIds, chunks: event.detail.chunks };
  void formerDetail;
});
document.querySelector('lr-memory-panel')!.addEventListener('lr-toggle', event => {
  if (event.detail.section !== undefined || event.detail.memoryId === undefined || event.detail.scope === undefined) return;
  const formerDetail = { memoryId: event.detail.memoryId, scope: event.detail.scope, expanded: event.detail.expanded };
  void formerDetail;
});
document.querySelector('lr-widget')!.addEventListener('lr-toggle', event => {
  const formerDetail = { collapsed: !event.detail.expanded };
  void formerDetail;
});
document.querySelector('lr-widget')!.addEventListener('lr-toggle-request', event => {
  const proposedCollapsed = !event.detail.expanded;
  if (proposedCollapsed) event.preventDefault();
});
document.querySelector('lr-rag-eval-dashboard')!.addEventListener('lr-run-activate', event => {
  const formerDetail = { run: event.detail.run };
  void formerDetail;
});
const entitySelect = (event: CustomEvent<{ entityId: string; occurrenceIndex?: number }>) => {
  const origin = event.composedPath().find(node => node instanceof Element &&
    node.matches('lr-community-card, lr-path-strip, lr-entity-card, lr-entity-chip, lr-neighbor-list'));
  if (!(origin instanceof Element) || !origin.matches('lr-community-card, lr-path-strip')) return;
  const formerDetail = { entityId: event.detail.entityId, occurrenceIndex: event.detail.occurrenceIndex };
  void formerDetail;
};
document.querySelector('lr-entity-dossier')!.addEventListener('lr-entity-select', entitySelect);
document.querySelector('lr-memory-panel')!.addEventListener('lr-entity-select', entitySelect);
document.querySelector('lr-provenance-panel')!.addEventListener('lr-entity-select', entitySelect);
