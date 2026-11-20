import type { SVGTemplateResult } from 'lit';
import {
  statusDeniedIcon,
  statusErrorIcon,
  statusIncompleteIcon,
  statusPendingIcon,
  statusRunningIcon,
  statusSuccessIcon,
} from '../../internal/icons.js';
import type { LyraToolStatus } from '../../internal/shared-unions.js';

/**
 * A tool call's status: the shared tool lifecycle plus `incomplete`, a call that ended without a
 * result (an interrupted stream, a cancelled run). The one status union for the chip, result
 * dialog, result view, timeline and call block.
 */
export type ToolStatus = LyraToolStatus | 'incomplete';

/**
 * The one tool-call status vocabulary shared by `<lr-tool-call-chip>`, `<lr-tool-result-dialog>`,
 * `<lr-tool-timeline>` and `<lr-tool-call-block>`, so a call reads with the same glyph, label and
 * normalization rule wherever it is shown.
 *
 * @internal
 */
export const TOOL_CALL_STATUSES = Object.freeze([
  'pending',
  'running',
  'success',
  'error',
  'denied',
  'incomplete',
] as const satisfies readonly ToolStatus[]);

const TOOL_CALL_STATUS_SET: ReadonlySet<string> = new Set<string>(TOOL_CALL_STATUSES);

/** True when `value` is a member of the shared tool-call status vocabulary.
 *
 * @internal
 */
export function isToolCallStatus(value: unknown): value is ToolStatus {
  return typeof value === 'string' && TOOL_CALL_STATUS_SET.has(value);
}

const STATUS_ICON: Readonly<Record<ToolStatus, () => SVGTemplateResult>> = Object.freeze({
  pending: statusPendingIcon,
  running: statusRunningIcon,
  success: statusSuccessIcon,
  error: statusErrorIcon,
  denied: statusDeniedIcon,
  incomplete: statusIncompleteIcon,
});

/** The decorative glyph for `status`; any value outside the vocabulary renders the pending glyph.
 *
 * @internal
 */
export function toolStatusIcon(status: unknown): SVGTemplateResult {
  return STATUS_ICON[isToolCallStatus(status) ? status : 'pending']();
}

/** `localize()` key for each status's visible text twin -- the state is always carried as text,
 *  never by colour or glyph alone.
 *
 * @internal
 */
// A plain object literal (typed read-only) rather than a frozen call, so the default-string gate
// can resolve every `localize(TOOL_STATUS_LABEL_KEY[status])` call site to this closed key set.
export const TOOL_STATUS_LABEL_KEY: Readonly<Record<ToolStatus, string>> = {
  pending: 'statusPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusError',
  denied: 'statusDenied',
  incomplete: 'statusIncomplete',
};
