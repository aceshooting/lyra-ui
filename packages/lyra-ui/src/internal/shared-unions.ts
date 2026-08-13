/**
 * String-literal unions that several components' own exported type aliases resolve to.
 *
 * This is deliberately NOT the styling vocabulary: `variant`/`appearance`/`frame`/`size` live in
 * `variants.ts`, and `scripts/check-style-vocabulary.mjs` polices component-local copies of those
 * specific member sets. What lives here is the smaller set of *value* vocabularies that several
 * components had each spelled out for themselves character-for-character — two native-platform
 * ones forwarded straight to a wrapped `<input>`/`<textarea>`, and two agent-domain ones.
 *
 * Every component keeps its own exported alias name: those names are published API, and renaming
 * one to import this module's name instead would break consumers for no benefit. Each alias is now
 * `export type X = <the name below>` rather than a re-typed literal union, so the member sets can
 * no longer drift apart the way ten copies of the tone vocabulary once did. Adding a member here is
 * therefore, correctly, a change to every alias at once.
 */

/**
 * The three values `HTMLInputElement`/`HTMLTextAreaElement`'s own `selectionDirection` property and
 * `setSelectionRange()` accept. Any component wrapping a native text surface forwards this
 * verbatim; it is the platform's vocabulary, not this library's, so it is never extended.
 */
export type LyraSelectionDirection = 'forward' | 'backward' | 'none';

/**
 * The three values `<textarea wrap>` accepts, forwarded verbatim by every component that wraps a
 * native multi-line text surface. Platform vocabulary, never extended.
 */
export type LyraTextWrap = 'hard' | 'soft' | 'off';

/**
 * The lifecycle a single tool/function call (or the span standing in for one) moves through. One
 * vocabulary across the chip, the result dialog, the trace span, and the flow-canvas run so a call
 * reads identically wherever it is shown. `denied` is a policy rejection, distinct from a runtime
 * `error`.
 */
export type LyraToolStatus = 'pending' | 'running' | 'success' | 'error' | 'denied';

/**
 * Whether a reasoning/activity surface is streaming a run as it happens or replaying a finished
 * one. Drives whether the surface auto-follows new content and how it announces updates.
 */
export type LyraTranscriptMode = 'live' | 'post-hoc';
