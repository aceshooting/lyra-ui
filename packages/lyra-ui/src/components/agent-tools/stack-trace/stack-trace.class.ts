import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { styles } from './stack-trace.styles.js';
import { parseStackTrace, DEFAULT_INTERNAL_PATTERNS, type StackFrame, type StackGroup } from './stack-trace-parse.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styleMap } from 'lit/directives/style-map.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_stackTraceHideFrames, LYRA_DEFAULT_stackTraceLabel, LYRA_DEFAULT_stackTraceShowFrames } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** How long the "Copied!" confirmation state lasts before reverting -- matches
 *  `lr-copy-button`'s own confirmation duration. */
const COPY_CONFIRM_MS = 1500;

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
  'lr-copy': CustomEvent<{ text: string }>;
}

/**
 * `<lr-stack-trace>` — parses common V8/JS-TS, Firefox/Safari, and Python stack traces into a
 * leading message plus activatable frames, splitting chained/caused-by errors into separate
 * groups. Frames matching `internalPatterns` (`node_modules/`, `node:internal`,
 * `site-packages/`, ... by default) fold behind a count-labeled toggle. Falls back to verbatim
 * raw text when nothing parses. A malformed or unsafe numeric location remains visible as raw,
 * non-activatable trace text rather than becoming an invalid navigation target. First-party
 * invention (no Web Awesome equivalent).
 *
 * @customElement lr-stack-trace
 * @event lr-frame-select - `detail: { file, line, column?, raw }` — a frame with a safe parsed
 *   location was activated (`column` is always undefined for Python frames, which carry no column
 *   information). Malformed or unsafe locations render as raw text and never emit this event.
 * @event lr-copy - `detail: { text }` — the raw, unparsed trace text, fired regardless of
 *   whether the OS clipboard write actually succeeded.
 * @csspart base - The root wrapper; respects `max-height`. Drops its card chrome under
 *   `frame="plain"`.
 * @csspart message - The leading error message text for a group.
 * @csspart group - One chained-error group of frames.
 * @csspart frame - A selectable frame button (carrying `data-internal` for internal frames), or a
 *   non-activatable raw row when the source location is malformed or unsafe.
 * @csspart frame-function - The frame's function name.
 * @csspart frame-location - The frame's `file:line:col` text.
 * @csspart internal-toggle - The collapse/expand toggle for a run of internal frames.
 * @csspart raw - The verbatim `<pre>` fallback when zero structured frames parsed.
 * @csspart copy-button - The copy-to-clipboard button, only rendered while `copyable`.
 * @cssprop [--lr-stack-trace-max-height=none] - Cap on how tall `[part="base"]` grows before it
 *   scrolls internally. `none` lets the component grow with its content; the `max-height`
 *   attribute sets this token.
 * @cssprop [--lr-stack-trace-font=var(--lr-font-mono)] - Font family for the parsed frames and the
 *   verbatim raw fallback.
 * @cssprop [--lr-stack-trace-internal-frame-color=var(--lr-color-text-quiet)] - Internal frame foreground.
 * @cssprop [--lr-stack-trace-interactive-color=var(--lr-color-brand)] - Interactive frame/toggle accent.
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
    stackTraceHideFrames: LYRA_DEFAULT_stackTraceHideFrames,
    stackTraceLabel: LYRA_DEFAULT_stackTraceLabel,
    stackTraceShowFrames: LYRA_DEFAULT_stackTraceShowFrames,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The raw stack trace text to parse and render. */
  @property() trace = '';

  /** Folds runs of internal frames (matching `internalPatterns`) behind a toggle. */
  @property({ type: Boolean, attribute: 'collapse-internal', reflect: true, converter: trueDefaultBooleanConverter })
  collapseInternal = true;

  /** File-path substrings/`RegExp`s that mark a frame as internal. Defaults to
   *  `DEFAULT_INTERNAL_PATTERNS` (common Node/browser/Python framework locations). */
  @property({ attribute: false }) internalPatterns: (string | RegExp)[] = DEFAULT_INTERNAL_PATTERNS;

  /** Shows a copy-to-clipboard button for the raw trace text. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) copyable = true;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled, padded box. `'plain'` removes the border, background, padding and
   *  corner radius so a trace nested inside an `lr-result-card`/`lr-agent-run` (which already draws
   *  a border) doesn't double the box. The `max-height` scroll cap and the copy/stack-frame
   *  affordances are unaffected. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Caps the rendered block size and enables an internal scrollbar once content exceeds it
   *  (any valid CSS length, e.g. `'20rem'`). Empty string (the default) grows with content. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  @state() private groups: StackGroup[] = [];
  @state() private expandedInternalRuns = new Set<string>();
  @state() private justCopied = false;

  private copyTimer?: { owner: Window; handle: number };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cancelCopyTimer();
    this.justCopied = false;
  }

  adoptedCallback(): void {
    // A disconnected node can be adopted without another disconnect notification.
    this.cancelCopyTimer();
    this.justCopied = false;
  }

  private cancelCopyTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('trace') || changed.has('internalPatterns')) {
      this.groups = parseStackTrace(this.trace, this.internalPatterns);
      this.expandedInternalRuns = new Set();
    }
  }

  private onCopy = (): void => {
    const text = this.trace;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    try {
      void owner?.navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // best-effort -- lr-copy still fires with the intended text regardless
    }
    this.emit('lr-copy', { text });
    this.cancelCopyTimer();
    if (!owner) {
      this.justCopied = false;
      return;
    }
    this.justCopied = true;
    let handle = 0;
    handle = owner.setTimeout(() => {
      if (
        this.copyTimer?.owner !== owner
        || this.copyTimer.handle !== handle
        || !this.isConnected
        || this.ownerDocument.defaultView !== owner
      ) return;
      this.copyTimer = undefined;
      this.justCopied = false;
    }, COPY_CONFIRM_MS);
    this.copyTimer = { owner, handle };
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
        ${frame.functionName ? html`<span part="frame-function">${frame.functionName}</span>` : nothing}
        <span part="frame-location" dir="ltr">${location}</span>
      </button>
    `;
  }

  private renderGroup(group: StackGroup, groupIndex: number): TemplateResult {
    if (!this.collapseInternal) {
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
            ${expanded
              ? this.localize('stackTraceHideFrames', undefined, { count })
              : this.localize('stackTraceShowFrames', undefined, { count })}
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

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        role="group"
        aria-label=${this.getAttribute('aria-label') || this.localize('stackTraceLabel')}
        style=${(() => {
          // A free-form consumer string must never reach a declaration list verbatim --
          // `max-height="3rem;position:fixed"` would otherwise escape the custom property.
          const safeMaxHeight = sanitizeCssLength(this.maxHeight);
          return safeMaxHeight ? styleMap({ '--lr-stack-trace-max-height': safeMaxHeight }) : nothing;
        })()}
      >
        ${this.copyable
          ? html`<button part="copy-button" type="button" @click=${this.onCopy}>
              ${this.justCopied ? this.localize('copied') : this.localize('copy')}
            </button>`
          : nothing}
        ${this.groups.length === 0
          ? html`<pre part="raw" dir="ltr">${this.trace}</pre>`
          : this.groups.map(
              (group, index) => html`
                ${group.message ? html`<div part="message">${group.message}</div>` : nothing}
                ${this.renderGroup(group, index)}
              `,
            )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-stack-trace': LyraStackTrace;
  }
}
