// Lean entry for a table-only state with no selected run.
// Set selectedRunId to an unmatched id to keep review/diff absent; import rubric-form.js
// and diff-view.js before allowing a run to become selected.
export * from './eval-result.class.js';
import { LyraEvalResult } from './eval-result.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../data/table/table.js';

defineElement('eval-result', LyraEvalResult);
