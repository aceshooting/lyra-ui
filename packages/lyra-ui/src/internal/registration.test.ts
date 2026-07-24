import { expect } from '@open-wc/testing';
import { LyraEmpty } from '../components/overlays/empty/empty.class.js';
import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './root-registration-allowlist.js';
import '../components/agent-tools/activity-feed/activity-feed.class.js';
import '../components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js';
import '../components/agent-tools/agent-run/agent-run.class.js';
import '../components/agent-tools/agent-trace/agent-trace.class.js';
import '../components/agent-tools/approval-queue/approval-queue.class.js';
import '../components/agent-tools/artifact-panel/artifact-panel.class.js';
import '../components/agent-tools/compare-panel/compare-panel.class.js';
import '../components/agent-tools/eval-dataset/eval-dataset.class.js';
import '../components/agent-tools/evaluation-run/evaluation-run.class.js';
import '../components/agent-tools/task-list/task-list.class.js';
import '../components/agent-tools/terminal/terminal.class.js';
import '../components/agent-tools/test-results/test-results.class.js';
import '../components/agent-tools/tool-timeline/tool-timeline.class.js';
import '../components/conversation/agent-workspace/agent-workspace.class.js';
import '../components/conversation/handoff-divider/handoff-divider.class.js';
import '../components/conversation/message-feedback/message-feedback.class.js';
import '../components/conversation/message-parts/message-parts.class.js';
import '../components/conversation/prompt-input/prompt-input.class.js';
import '../components/conversation/prompt-queue/prompt-queue.class.js';
import '../components/conversation/selection-toolbar/selection-toolbar.class.js';
import '../components/conversation/thread-list/thread-list.class.js';
import '../components/data/document-library/document-library.class.js';
import '../components/data/env-list/env-list.class.js';
import '../components/data/file-tree/file-tree.class.js';
import '../components/data/table/table.class.js';
import '../components/data/tree/tree.class.js';
import '../components/layout/reorder-list/reorder-list.class.js';
import '../components/media/av-player/av-player.class.js';
import '../components/media/file-icon/file-icon.class.js';
import '../components/media/image-viewer/image-viewer.class.js';
import '../components/retrieval/ingestion-queue/ingestion-queue.class.js';
import '../components/retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import '../components/retrieval/knowledge-base/knowledge-base.class.js';
import '../components/retrieval/rag-answer/rag-answer.class.js';
import '../components/retrieval/retrieval-results/retrieval-results.class.js';
import '../components/viewers/archive-viewer/archive-viewer.class.js';
import '../components/viewers/csv-viewer/csv-viewer.class.js';
import '../components/viewers/dataset-viewer/dataset-viewer.class.js';
import '../components/viewers/document-compare/document-compare.class.js';
import '../components/viewers/document-preview/document-preview.class.js';
import '../components/viewers/geojson-view/geojson-view.class.js';
import '../components/viewers/notebook-viewer/notebook-viewer.class.js';
import '../components/viewers/page-rail/page-rail.class.js';
import '../components/viewers/pdf-viewer/pdf-viewer.class.js';
import '../components/viewers/pptx-viewer/pptx-viewer.class.js';
import '../components/viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';
import '../components/viewers/svg-viewer/svg-viewer.class.js';

it('keeps every affected class-module import out of the custom-element registry', () => {
  const registered = [...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS].filter((name) =>
    customElements.get(name),
  );
  expect(registered).to.deep.equal([]);
  expect(LyraEmpty.prototype).to.be.instanceOf(Object);
});
