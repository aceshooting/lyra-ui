import type { LyraCommand } from '../src/components/layout/command-palette/command-palette.class.js';
import type {
  LyraWidget,
  LyraWidgetView,
} from '../src/components/layout/widget/widget.class.js';
import type {
  LyraStepItem,
  LyraStepperEventMap,
} from '../src/components/layout/stepper/stepper.class.js';
import type { LyraDashboardCell } from '../src/components/layout/dashboard-grid/layout-types.js';
import type {
  LyraDashboardCellMoveDetail,
  LyraDashboardCollisionDetail,
} from '../src/components/layout/dashboard-grid/dashboard-grid.class.js';
import type { LyraFilterBarFilterDefinition } from '../src/components/layout/filter-bar/filter-bar.class.js';
import type { LyraAvCue } from '../src/components/media/av-player/av-metadata.js';
import type { HighlightActivateDetail } from '../src/components/viewers/document-viewer/anchors.js';
import type { LyraApprovalQueue } from '../src/components/agent-tools/approval-queue/approval-queue.class.js';
import type { LyraTraceTreeEventMap } from '../src/components/agent-tools/trace-tree/trace-tree.class.js';
import type { LyraTaskListEventMap } from '../src/components/agent-tools/task-list/task-list.class.js';
import type { LyraRealtimeSession } from '../src/components/conversation/realtime-session/realtime-session.class.js';
import type { LyraRetrievalTraceEventMap } from '../src/components/retrieval/retrieval-trace/retrieval-trace.class.js';
import type { LyraDocumentLibraryEventMap } from '../src/components/data/document-library/document-library.class.js';
import type { LyraFlowCanvasEventMap } from '../src/components/data/flow-canvas/flow-canvas.class.js';
import type { LyraEnvListEventMap } from '../src/components/data/env-list/env-list.class.js';

const command: LyraCommand = { commandId: 'save', label: 'Save' };

// @ts-expect-error command identity uses the domain-specific commandId name.
const legacyCommand: LyraCommand = { id: 'save', label: 'Save' };

void command;
void legacyCommand;

const view: LyraWidgetView = { viewId: 'chart', label: 'Chart' };
// @ts-expect-error widget view identity uses viewId.
const legacyView: LyraWidgetView = { id: 'chart', label: 'Chart' };
declare const widget: LyraWidget;
widget.activeViewId = 'chart';
// @ts-expect-error activeView was replaced by the domain-specific activeViewId.
widget.activeView = 'chart';

const step: LyraStepItem = { stepId: 'account', label: 'Account', state: 'current' };
// @ts-expect-error step identity uses stepId.
const legacyStep: LyraStepItem = { id: 'account', label: 'Account', state: 'current' };
const stepSelection: LyraStepperEventMap['lr-step-select']['detail'] = {
  stepId: 'account',
  index: 0,
};
// @ts-expect-error step selection detail no longer overloads id.
const legacyStepSelection: LyraStepperEventMap['lr-step-select']['detail'] = { id: 'account', index: 0 };

const cell: LyraDashboardCell = { cellId: 'revenue', x: 0, y: 0, w: 1, h: 1 };
// @ts-expect-error dashboard cell identity uses cellId.
const legacyCell: LyraDashboardCell = { id: 'revenue', x: 0, y: 0, w: 1, h: 1 };
const cellMove: LyraDashboardCellMoveDetail = {
  cellId: 'revenue',
  position: { x: 1, y: 0 },
  previous: { x: 0, y: 0 },
};
const collision: LyraDashboardCollisionDetail = {
  cellId: 'revenue',
  collidedCellIds: ['expenses'],
  policy: 'reject',
  accepted: false,
};

const filter: LyraFilterBarFilterDefinition = {
  filterId: 'status',
  type: 'text',
  label: 'Status',
};
// @ts-expect-error filter identity uses filterId.
const legacyFilter: LyraFilterBarFilterDefinition = { id: 'status', type: 'text', label: 'Status' };

const cue: LyraAvCue = { cueId: 'intro', start: 0, text: 'Intro' };
// @ts-expect-error cue identity uses cueId.
const legacyCue: LyraAvCue = { id: 'intro', start: 0, text: 'Intro' };

const highlightActivation: HighlightActivateDetail = { highlightId: 'finding' };
// @ts-expect-error highlight activation detail uses highlightId.
const legacyHighlightActivation: HighlightActivateDetail = { id: 'finding' };

declare const approvalQueue: LyraApprovalQueue;
approvalQueue.selectedInvocationId = 'call-1';
// @ts-expect-error selectedId was replaced by selectedInvocationId.
approvalQueue.selectedId = 'call-1';

const spanSelection: LyraTraceTreeEventMap['lr-span-select']['detail'] = { spanId: 'root' };
// @ts-expect-error span selection detail uses spanId.
const legacySpanSelection: LyraTraceTreeEventMap['lr-span-select']['detail'] = { id: 'root' };
const reorder: LyraTaskListEventMap['lr-reorder']['detail'] = {
  taskId: 'item-a',
  parentTaskId: null,
  fromIndex: 0,
  toIndex: 1,
};
// @ts-expect-error task reorder detail uses taskId and parentTaskId.
const legacyReorder: LyraTaskListEventMap['lr-reorder']['detail'] = { id: 'item-a', parentId: null, fromIndex: 0, toIndex: 1 };

declare const realtimeSession: LyraRealtimeSession;
realtimeSession.sessionId = 'voice-session-a';

const stageSelection: LyraRetrievalTraceEventMap['lr-stage-select']['detail'] = { stageId: 'retrieve' };
// @ts-expect-error stage selection detail uses stageId.
const legacyStageSelection: LyraRetrievalTraceEventMap['lr-stage-select']['detail'] = { id: 'retrieve' };

const documentOpen: LyraDocumentLibraryEventMap['lr-open']['detail'] = { documentId: 'document-a' };
// @ts-expect-error document open detail uses documentId.
const legacyDocumentOpen: LyraDocumentLibraryEventMap['lr-open']['detail'] = { id: 'document-a' };
const documentSelection: LyraDocumentLibraryEventMap['lr-selection-change']['detail'] = {
  documentIds: ['document-a'],
};
// @ts-expect-error document selection detail uses documentIds.
const legacyDocumentSelection: LyraDocumentLibraryEventMap['lr-selection-change']['detail'] = { ids: ['document-a'] };

const nodeActivation: LyraFlowCanvasEventMap['lr-node-activate']['detail'] = { nodeId: 'node-a' };
// @ts-expect-error flow node activation detail uses nodeId.
const legacyNodeActivation: LyraFlowCanvasEventMap['lr-node-activate']['detail'] = { id: 'node-a' };
const edgeActivation: LyraFlowCanvasEventMap['lr-edge-activate']['detail'] = {
  edgeId: 'edge-a',
  source: 'node-a',
  target: 'node-b',
};

const revealChange: LyraEnvListEventMap['lr-reveal-change']['detail'] = {
  envName: 'SERVICE_TOKEN',
  revealed: true,
};
// @ts-expect-error reveal detail uses envName.
const legacyRevealChange: LyraEnvListEventMap['lr-reveal-change']['detail'] = { name: 'SERVICE_TOKEN', revealed: true };

void view;
void legacyView;
void step;
void legacyStep;
void stepSelection;
void legacyStepSelection;
void cell;
void legacyCell;
void cellMove;
void collision;
void filter;
void legacyFilter;
void cue;
void legacyCue;
void highlightActivation;
void legacyHighlightActivation;
void spanSelection;
void legacySpanSelection;
void reorder;
void legacyReorder;
void stageSelection;
void legacyStageSelection;
void documentOpen;
void legacyDocumentOpen;
void documentSelection;
void legacyDocumentSelection;
void nodeActivation;
void legacyNodeActivation;
void edgeActivation;
void revealChange;
void legacyRevealChange;
