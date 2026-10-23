import type {
  LyraChunkInspector,
  LyraChunkInspectorEventMap,
} from '../src/components/retrieval/chunk-inspector/chunk-inspector.class.js';
import type {
  LyraRetrievalResults,
  LyraRetrievalResultsEventMap,
  RetrievalResultsSelectDetail,
} from '../src/components/retrieval/retrieval-results/retrieval-results.class.js';
import type {
  LyraSourcePicker,
  LyraSourcePickerEventMap,
} from '../src/components/retrieval/source-picker/source-picker.class.js';

declare const inspector: LyraChunkInspector;
inspector.activeChunkId = 'chunk-a';
// @ts-expect-error chunk inspector state uses activeChunkId.
inspector.activeId = 'chunk-a';

const chunkOpen: LyraChunkInspectorEventMap['lr-chunk-open']['detail'] = {
  chunkId: 'chunk-a',
  sourceId: 'source-a',
};
const chunkExpand: LyraChunkInspectorEventMap['lr-toggle']['detail'] = {
  itemId: 'chunk-a',
  expanded: true,
};
// @ts-expect-error The old chunk toggle event was replaced by lr-toggle.
export type _RemovedChunkToggle = LyraChunkInspectorEventMap['lr-chunk-toggle'];

declare const results: LyraRetrievalResults;
results.activeChunkId = 'chunk-a';
results.selectedChunkIds = ['chunk-a'];
// @ts-expect-error retrieval result state uses activeChunkId.
results.activeId = 'chunk-a';
// @ts-expect-error retrieval selection uses selectedChunkIds.
results.selectedIds = ['chunk-a'];
const resultSelection: RetrievalResultsSelectDetail = {
  chunkIds: ['chunk-a'],
  chunks: [],
};
const resultChunkOpen: LyraRetrievalResultsEventMap['lr-chunk-open']['detail'] = {
  chunkId: 'chunk-a',
  sourceId: 'source-a',
};

declare const picker: LyraSourcePicker;
picker.selectedSourceIds = ['source-a'];
// @ts-expect-error source selection uses selectedSourceIds.
picker.selectedIds = ['source-a'];
const sourceSelection: LyraSourcePickerEventMap['lr-selection-change']['detail'] = {
  selectedSourceIds: ['source-a'],
};
// @ts-expect-error The old source picker event was replaced by lr-selection-change.
export type _RemovedSourcesChange = LyraSourcePickerEventMap['lr-sources-change'];

void chunkOpen;
void chunkExpand;
void resultSelection;
void resultChunkOpen;
void sourceSelection;
