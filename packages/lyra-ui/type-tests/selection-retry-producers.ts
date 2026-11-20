import type { LyraSubagentPanelEventMap } from '../src/components/agent-tools/subagent-panel/subagent-panel.class.js';
import type { LyraRetrievalCompareEventMap } from '../src/components/retrieval/retrieval-compare/retrieval-compare.class.js';

type SelectionDetail = LyraRetrievalCompareEventMap['lr-chunk-select']['detail'];
declare const chunk: SelectionDetail['chunk'];

export const selection: SelectionDetail = { setId: 'results', chunk };
export const retry: LyraSubagentPanelEventMap['lr-run-retry']['detail'] = { runId: 'run' };
