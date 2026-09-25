import { svg, type SVGTemplateResult } from 'lit';
import type { LyraToolStatus } from '../../internal/shared-unions.js';

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
] as const satisfies readonly LyraToolStatus[]);

const TOOL_CALL_STATUS_SET: ReadonlySet<string> = new Set<string>(TOOL_CALL_STATUSES);

/** True when `value` is a member of the shared tool-call status vocabulary.
 *
 * @internal
 */
export function isToolCallStatus(value: unknown): value is LyraToolStatus {
  return typeof value === 'string' && TOOL_CALL_STATUS_SET.has(value);
}

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts's chevronIcon() and
// its neighbours) without adding tool-specific glyphs to that module, so these read as part of the
// same visual language as the rest of the library's inline icons.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

/** Wraps glyph `paths` in the library's 24-unit, 1.75-stroke, decorative inline SVG frame.
 *
 * @internal
 */
export function toolGlyph(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

function pendingIcon(): SVGTemplateResult {
  return toolGlyph(
    svg`<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>`
  );
}

/** A three-quarter arc, spun by each component's running-status CSS animation -- a full circle
 *  would not visibly convey rotation. */
function runningIcon(): SVGTemplateResult {
  return toolGlyph(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

function successIcon(): SVGTemplateResult {
  return toolGlyph(
    svg`<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline>`
  );
}

function errorIcon(): SVGTemplateResult {
  return toolGlyph(svg`
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="9" y1="9" x2="15" y2="15"></line>
    <line x1="15" y1="9" x2="9" y2="15"></line>
  `);
}

/** A "blocked" glyph (circle + diagonal slash) -- distinct from the error glyph since a denial is a
 *  policy rejection, not a runtime failure. */
function deniedIcon(): SVGTemplateResult {
  return toolGlyph(
    svg`<circle cx="12" cy="12" r="9"></circle><line x1="6" y1="18" x2="18" y2="6"></line>`
  );
}

const STATUS_ICON: Readonly<Record<LyraToolStatus, () => SVGTemplateResult>> = Object.freeze({
  pending: pendingIcon,
  running: runningIcon,
  success: successIcon,
  error: errorIcon,
  denied: deniedIcon,
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
export const TOOL_STATUS_LABEL_KEY: Readonly<Record<LyraToolStatus, string>> = {
  pending: 'statusPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusError',
  denied: 'statusDenied',
};
