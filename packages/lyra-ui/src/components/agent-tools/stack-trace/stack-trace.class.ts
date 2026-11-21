import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import { styles } from './stack-trace.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import { parseStackTrace, DEFAULT_INTERNAL_PATTERNS, type StackFrame, type StackGroup } from './stack-trace-parse.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styleMap } from 'lit/directives/style-map.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { trackScrollRegions } from '../../../internal/scroll-region.js';
import type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../../../internal/clipboard.js';
import { RecordCopyFeedback, reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_stackTraceInternalFrames, LYRA_DEFAULT_stackTraceLabel, LYRA_DEFAULT_stackTraceLimit } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const regexpSource = Object.getOwnPropertyDescriptor(RegExp.prototype, 'source')!.get!;
const MAX_INTERNAL_PATTERNS = 10_000;

function snapshotInternalPatterns(value: unknown): readonly (string | RegExp)[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  let length = 0;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      descriptor
      && 'value' in descriptor
      && typeof descriptor.value === 'number'
      && Number.isSafeInteger(descriptor.value)
      && descriptor.value >= 0
    ) {
      length = Math.min(descriptor.value, MAX_INTERNAL_PATTERNS);
    }
  } catch {
    return Object.freeze([]);
  }
  const patterns: (string | RegExp)[] = [];
  for (let index = 0; index < length; index += 1) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) continue;
      const pattern = descriptor.value;
      if (typeof pattern === 'string') {
        if (pattern.trim().length > 0) patterns.push(pattern);
      } else {
        const source: string = regexpSource.call(pattern);
        patterns.push(new RegExp(source, pattern.flags));
      }
    } catch {
      // A malformed entry cannot suppress later valid patterns.
    }
  }
  return Object.freeze(patterns);
}

/** A parsed frame is navigable only when its complete location survived the parser's safe-integer
 *  validation. This guard intentionally repeats at the event boundary so a future parser change
 *  cannot turn an unsafe raw frame into an emitted navigation request. */
function isSelectableFrame(frame: StackFrame): frame is StackFrame & { file: string; line: number; column?: number } {
  return (
    typeof frame.file === 'string'
    && frame.file.length > 0
    && Number.isSafeInteger(frame.line)
    && (frame.column === undefined || Number.isSafeInteger(frame.column))
  );
}

/** Visual chrome for `<lr-stack-trace>`'s root — the library's shared container-frame vocabulary. */
export type StackTraceAppearance = LyraFrame;

export interface LyraStackTraceEventMap {
  'lr-frame-select': CustomEvent<{ file: string; line: number; column?: number; raw: string }>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
}

/**
 * `<lr-stack-trace>` — parses common V8/JS-TS, Firefox/Safari, and Python stack traces into a
 * leading message plus activatable frames, splitting chained/caused-by errors into separate
 * groups. Frames matching `internalPatterns` (`node_modules/`, `node:internal`,
 * `site-packages/`, ... by default) fold behind a count-labeled toggle. Falls back to verbatim
 * raw text when nothing parses. A malformed or unsafe numeric location remains visible as raw,
 * non-activatable trace text rather than becoming an invalid navigation target. Parsing and raw
 * rendering are bounded by the exported `STACK_TRACE_LIMITS`; `[part="limit"]` makes any omitted
 * input explicit. First-party invention (no Web Awesome equivalent).
 * `internalPatterns` is a clone-owned, bounded readonly snapshot; create and reassign a new array
 * after changing the matcher sequence.
 *
 * @customElement lr-stack-trace
 * @event lr-frame-select - `detail: { file, line, column?, raw }` — a frame with a safe parsed
 *   location was activated (`column` is always undefined for Python frames, which carry no column
 *   information). Malformed or unsafe locations render as raw text and never emit this event.
 * @event lr-copy - `detail: { ok: true, text }` — the raw-trace clipboard write completed.
 * @event lr-error - The clipboard write failed; generic no-detail notification.
 * @event lr-copy-error - `detail: { ok: false, text, reason, error }` — typed clipboard failure.
 * @csspart base - The root wrapper; respects `max-height`. Tightens its padding under `size="s"`
 *   and drops its card chrome under `frame="plain"`.
 * @csspart message - The leading error message text for a group.
 * @csspart group - One chained-error group of frames.
 * @csspart frame - A selectable frame button (carrying `data-internal` for internal frames), or a
 *   non-activatable raw row when the source location is malformed or unsafe.
 * @csspart frame-function - The frame's function name.
 * @csspart frame-location - The frame's `file:line:col` text.
 * @csspart internal-toggle - The collapse/expand toggle for a run of internal frames, named by the
 *   constant `stackTraceInternalFrames` count while `aria-expanded` reports the state.
 * @csspart raw - The verbatim `<pre>` fallback when zero structured frames parsed.
 * @csspart limit - Localized notice rendered when a parser resource ceiling omitted input.
 * @csspart copy-button - The copy-to-clipboard button, not rendered while `without-copy-button`.
 * @cssprop [--lr-stack-trace-max-height=none] - Cap on how tall `[part="base"]` grows before it
 *   scrolls internally. `none` lets the component grow with its content; the `max-height`
 *   attribute sets this token.
 * @cssprop [--lr-stack-trace-font=var(--lr-font-mono)] - Font family for the parsed frames and the
 *   verbatim raw fallback.
 * @cssprop [--lr-stack-trace-internal-frame-color=var(--lr-color-text-quiet)] - Internal frame foreground.
 * @cssprop [--lr-stack-trace-interactive-color=var(--lr-color-brand)] - Interactive frame/toggle accent.
 * @cssprop [--lr-stack-trace-compact-padding=var(--lr-space-2xs)] - `[part="base"]` padding while
 *   `size` is `s` or smaller. Overridden entirely by `frame="plain"`.
 * @cssprop [--lr-stack-trace-compact-gap=var(--lr-space-2xs)] - Space below `[part="message"]` and
 *   between `[part="group"]`s while `size` is `s` or smaller.
 * @cssprop [--lr-stack-trace-bg=var(--lr-color-surface)] - Fill of the outer card
 *   (`[part="base"]`) while `frame="card"`. `frame="plain"` still removes the fill entirely.
 * @cssprop [--lr-stack-trace-border-color=var(--lr-color-border-subtle)] - Colour of the outer card's
 *   border.
 * @cssprop [--lr-stack-trace-radius=var(--lr-radius)] - Corner radius of the outer card.
 *   `frame="plain"` still squares the corners.
 * @cssprop [--lr-stack-trace-internal-toggle-hover-bg=var(--lr-color-brand-quiet)] - Hover background of `[part="internal-toggle"]`.
 * @cssprop --lr-stack-trace-internal-toggle-active-bg - Pressed background of the internal-frames toggle. Defaults to the hover background mixed by the press step.
 * @status stable
 * @since 4.0.0
 */
export class LyraStackTrace extends LyraElement<LyraStackTraceEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    stackTraceInternalFrames: LYRA_DEFAULT_stackTraceInternalFrames,
    stackTraceLabel: LYRA_DEFAULT_stackTraceLabel,
    stackTraceLimit: LYRA_DEFAULT_stackTraceLimit,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];

  /** The raw stack trace text to parse and render. Removing the attribute clears its displayed text. */
  @property() trace = '';

  /** Shows runs of internal frames (matching `internalPatterns`) inline instead of folding them
   *  behind a count-labeled toggle. */
  @property({ type: Boolean, attribute: 'expand-internal', reflect: true }) expandInternal = false;

  private _internalPatterns = snapshotInternalPatterns(DEFAULT_INTERNAL_PATTERNS);
  private patternsSource: unknown = DEFAULT_INTERNAL_PATTERNS;
  /** Clone-owned file-path substrings/`RegExp`s that mark a frame as internal. Defaults to
   *  `DEFAULT_INTERNAL_PATTERNS` (common Node/browser/Python framework locations). Assignment
   *  retains non-blank strings, clone-owns `RegExp`s, drops malformed entries without suppressing
   *  valid later entries, bounds the result, and freezes it. Reassign a new array after changes. */
  @property({ attribute: false })
  get internalPatterns(): readonly (string | RegExp)[] {
    return this._internalPatterns;
  }
  set internalPatterns(value: readonly (string | RegExp)[]) {
    if (value === this.patternsSource) return;
    this.patternsSource = value;
    const previous = this._internalPatterns;
    this._internalPatterns = snapshotInternalPatterns(value);
    this.requestUpdate('internalPatterns', previous);
  }

  /** Hides the copy-to-clipboard button for the raw trace text. */
  @property({ type: Boolean, attribute: 'without-copy-button', reflect: true }) withoutCopyButton = false;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled, padded box. `'plain'` removes the border, background, padding and
   *  corner radius so a trace nested inside an `lr-result-card`/`lr-agent-run` (which already draws
   *  a border) doesn't double the box. `plain` wins over the dense `size` tier when both are set
   *  (nothing left to tighten). The `max-height` scroll cap and the copy/stack-frame affordances are unaffected. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /**
   * Density on the shared size scale. `s` (and the smaller `xs`/`2xs`) tightens the root padding and
   * between-group spacing for dense contexts (a trace rendered as a row in an error list, a side
   * panel) -- same convention as `<lr-agent-run>`'s and `<lr-thinking-panel>`'s `size`. `m` (the
   * default) and larger keep the full card padding. Purely a density knob: the border, corner radius
   * and background stay, so use `frame="plain"` to drop the chrome entirely.
   */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Caps the rendered block size and enables an internal scrollbar once content exceeds it
   *  (any valid CSS length, e.g. `'20rem'`). Empty string (the default) grows with content. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  @state() private groups: StackGroup[] = [];
  @state() private boundedSource = '';
  @state() private parseTruncated = false;
  @state() private expandedInternalRuns = new Set<string>();
  private readonly copyFeedback = new RecordCopyFeedback(this, () => this.trace ?? '', (outcome) => {
    reportCopyOutcome(
      {
        emit: (name, detail) => {
          if (name === 'lr-copy') this.emit('lr-copy', detail as LyraClipboardWriteSuccess);
          else if (name === 'lr-error') this.emit('lr-error');
          else this.emit('lr-copy-error', detail as LyraClipboardWriteFailure);
        },
        announce: (ok) => this.announcements.announcePolite(this.localize(ok ? 'copied' : 'copyFailed')),
      },
      outcome,
    );
  });

  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private limitAnnouncementInitialized = false;
  private previouslyTruncated = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.limitAnnouncementInitialized = this.hasUpdated;
    this.previouslyTruncated = this.parseTruncated;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // A disconnected node can be adopted without another disconnect notification.
    this.copyFeedback.reset();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('trace') || changed.has('internalPatterns')) {
      const result = parseStackTrace(this.trace ?? '', { internalPatterns: this.internalPatterns });
      this.groups = result.groups;
      this.boundedSource = result.source;
      this.parseTruncated = result.truncated;
      this.expandedInternalRuns = new Set();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.limitAnnouncementInitialized && this.parseTruncated && !this.previouslyTruncated) {
      this.announcements.announcePolite(this.localize('stackTraceLimit'));
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.parseTruncated;
  }

  private onCopy = (): void => {
    void this.copyFeedback.write(this.trace ?? '');
  };

  private onFrameClick(frame: StackFrame): void {
    if (!isSelectableFrame(frame)) return;
    this.emit('lr-frame-select', { file: frame.file, line: frame.line, column: frame.column, raw: frame.raw });
  }

  private toggleInternalRun(runKey: string): void {
    const next = new Set(this.expandedInternalRuns);
    if (next.has(runKey)) next.delete(runKey);
    else next.add(runKey);
    this.expandedInternalRuns = next;
  }

  private renderFrame(frame: StackFrame): TemplateResult {
    if (!isSelectableFrame(frame)) return html`<span part="frame" data-raw dir="ltr">${frame.raw}</span>`;
    const location = `${frame.file}:${frame.line}${frame.column !== undefined ? `:${frame.column}` : ''}`;
    return html`
      <button part="frame" type="button" ?data-internal=${frame.internal} @click=${() => this.onFrameClick(frame)}>
        ${frame.functionName ? html`<span part="frame-function" dir="ltr">${frame.functionName}</span>` : nothing}
        <span part="frame-location" dir="ltr">${location}</span>
      </button>
    `;
  }

  private renderGroup(group: StackGroup, groupIndex: number): TemplateResult {
    if (this.expandInternal) {
      return html`<div part="group">${group.frames.map((frame) => this.renderFrame(frame))}</div>`;
    }
    const rendered: TemplateResult[] = [];
    let run: StackFrame[] = [];
    let runIndex = 0;
    const flushRun = (): void => {
      if (run.length === 0) return;
      const runKey = `${groupIndex}:${runIndex++}`;
      const expanded = this.expandedInternalRuns.has(runKey);
      if (run.length === 1) {
        rendered.push(this.renderFrame(run[0]!));
      } else {
        const count = getNumberFormat(this.effectiveLocale).format(run.length);
        rendered.push(html`
          <button
            part="internal-toggle"
            type="button"
            aria-expanded=${expanded ? 'true' : 'false'}
            @click=${() => this.toggleInternalRun(runKey)}
          >
            ${this.localize('stackTraceInternalFrames', undefined, { count })}
          </button>
          ${expanded ? run.map((frame) => this.renderFrame(frame)) : nothing}
        `);
      }
      run = [];
    };
    for (const frame of group.frames) {
      if (frame.internal) {
        run.push(frame);
      } else {
        flushRun();
        rendered.push(this.renderFrame(frame));
      }
    }
    flushRun();
    return html`<div part="group">${rendered}</div>`;
  }

  constructor() {
    super();
    // A capped raw trace (no copy button, no selectable frames) has nothing else to scroll it by.
    trackScrollRegions(this, () => {
      const el = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      return [el && { el }];
    });
  }

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        role="group"
        aria-label=${hostAriaLabel(this) ?? this.localize('stackTraceLabel')}
        style=${(() => {
          // A free-form consumer string must never reach a declaration list verbatim --
          // `max-height="3rem;position:fixed"` would otherwise escape the custom property.
          const safeMaxHeight = sanitizeCssLength(this.maxHeight);
          return safeMaxHeight ? styleMap({ '--lr-stack-trace-max-height': safeMaxHeight }) : nothing;
        })()}
      >
        ${!this.withoutCopyButton
          ? html`<button part="copy-button" data-agent-action="neutral" type="button" data-copy-status=${this.copyFeedback.status} @click=${this.onCopy}>
              ${this.copyFeedback.status === 'success'
                ? this.localize('copied')
                : this.copyFeedback.status === 'error'
                  ? this.localize('copyFailed')
                  : this.localize('copy')}
            </button>`
          : nothing}
        ${this.groups.length === 0
          ? html`<pre part="raw" dir="ltr">${this.boundedSource}</pre>`
          : this.groups.map(
              (group, index) => html`
                ${group.message ? html`<div part="message">${group.message}</div>` : nothing}
                ${this.renderGroup(group, index)}
              `,
            )}
        ${this.parseTruncated
          ? html`<p part="limit" role="note">${this.localize('stackTraceLimit')}</p>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-stack-trace': LyraStackTrace;
  }
}
