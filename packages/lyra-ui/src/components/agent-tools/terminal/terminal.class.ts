import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  Announcer,
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { createAnsiParser, type AnsiSegment, type AnsiStyles } from '../../../internal/ansi.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { firstByIdentity } from '../collection-identity.js';
import {
  boundedSelectionRects,
  boundedSelectionText,
} from '../../../internal/text-quote.js';
import type {
  LyraAnchor,
  LyraHighlight,
  LyraHighlightTone,
  HighlightActivateDetail,
  TextSelectDetail,
} from '../../viewers/document-viewer/anchors.js';
import { styles } from './terminal.styles.js';
import type { LyraFrame } from '../../../internal/variants.js';
import type { LyraVirtualListRange } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_jumpToLatest, LYRA_DEFAULT_terminalDownload, LYRA_DEFAULT_terminalHighlightLine, LYRA_DEFAULT_terminalLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


interface TerminalCell {
  char: string;
  styles: AnsiStyles;
}

interface TerminalLine {
  /** Absolute (1-based) line number since the last `clear()`/`content` assignment. Survives
   *  scrollback trimming as a stable identity even though the line itself may later be trimmed. */
  number: number;
  cells: TerminalCell[];
}

const EMPTY_CELL_STYLES: AnsiStyles = {
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
};

/** Throttle window for the `announce-output` live region -- much shorter than
 *  `<lr-live-region>`'s general-purpose 500ms default. Console/tool output can arrive in rapid,
 *  irregularly-sized bursts (a build log, a streaming agent trace); a short window still coalesces
 *  same-tick chunks into one announcement while keeping a screen-reader user's sense of the log
 *  close to real time, rather than lagging half a second behind the visible text. */
const ANNOUNCE_THROTTLE_MS = 10;
/** A search match currently identifies a line, not a character range. Keep occurrence counting
 * bounded so a single adversarial line cannot allocate an unbounded navigation array. */
const MAX_SEARCH_MATCHES = 10_000;
/** Total input and retained-cell ceilings. These bound work even when output contains no newline,
 * contains only tabs/newlines, or supplies an arbitrarily large finite `maxScrollback`. */
const MAX_INPUT_CHARACTERS = 1_000_000;
const MAX_CELLS_PER_LINE = 20_000;
const MAX_RETAINED_CELLS = 200_000;
const MAX_SCROLLBACK_LINES = 10_000;
const SCROLLBACK_PRUNE_BATCH = 256;

// Each tone reads its own scoped cssprop (falling back to today's exact shared token) rather than
// the bare shared --lr-color-*-quiet token directly -- `accent` in particular would otherwise
// consume the identical --lr-color-brand-quiet token terminal.styles.ts's copy/download-button
// hover also consumes, for a visually distinct purpose (per-line highlight tint vs. toolbar-button
// hover feedback); retinting one via that shared token would silently retint the other too. Also
// decouples this from a ::part('line') stylesheet override, which -- since the background is set
// inline via styleMap below -- couldn't beat it without !important. Mirrors
// <lr-span-waterfall>'s analogous --lr-span-waterfall-row-active-bg fix for its own active-row
// background.
const TONE_BACKGROUND_VAR: Record<LyraHighlightTone, string> = {
  accent: 'var(--lr-terminal-highlight-accent-bg, var(--lr-color-brand-quiet))',
  success: 'var(--lr-terminal-highlight-success-bg, var(--lr-color-success-quiet))',
  warning: 'var(--lr-terminal-highlight-warning-bg, var(--lr-color-warning-quiet))',
  danger: 'var(--lr-terminal-highlight-danger-bg, var(--lr-color-danger-quiet))',
  neutral: 'var(--lr-terminal-highlight-neutral-bg, var(--lr-color-surface))',
};

function plainTextOfLine(line: TerminalLine): string {
  return line.cells.map((c) => c.char).join('');
}

/** Merges consecutive same-style cells into render-friendly segments -- avoids one <span> per
 *  character while keeping styling accurate. */
function groupCells(cells: TerminalCell[]): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  for (const cell of cells) {
    const last = segments[segments.length - 1];
    if (last && stylesEqual(last.styles, cell.styles)) {
      last.text += cell.char;
    } else {
      segments.push({ text: cell.char, styles: cell.styles });
    }
  }
  return segments;
}

function stylesEqual(a: AnsiStyles, b: AnsiStyles): boolean {
  return (
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse &&
    a.fg === b.fg &&
    a.bg === b.bg
  );
}

interface SearchMatch {
  lineNumber: number;
}

interface SearchState {
  query: string;
  matchCount: number;
  matchCountExact: boolean;
  activeIndex: number;
}

export interface LyraTerminalEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-download': CustomEvent<{ filename: string }>;
  'lr-follow-change': CustomEvent<{ following: boolean }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

/**
 * `<lr-terminal>` — read-only ANSI console for streamed agent/tool output. Not a PTY: no
 * stdin/keystroke handling, no cursor-addressed full-screen apps. Split ANSI sequences retain at
 * most 4,096 characters; an overlong unterminated control sequence is dropped so later chunks
 * resume without an unbounded hidden carry.
 *
 * `compact` tightens the toolbar and line padding for dense transcript rows, and `frame="plain"`
 * removes the outer card chrome when a surrounding container already supplies it — the same pair
 * `lr-result-card`, `lr-stack-trace`, `lr-task-list`, and `lr-thinking-panel` expose.
 *
 * @customElement lr-terminal
 * @event lr-copy - `detail: { ok: true, text }` — the plain-text clipboard write completed.
 * @event lr-error - The clipboard write failed; generic no-detail notification.
 * @event lr-copy-error - `detail: { ok: false, text, reason, error }` — typed clipboard failure.
 * @event lr-download - `detail: { filename }` — the download button was activated. Cancelable: by
 *   default this component itself builds an in-memory Blob of the current plain-text log and
 *   triggers a browser download via a synthetic `<a download>` click; a host that calls
 *   `preventDefault()` on this event suppresses that built-in download entirely and can substitute
 *   its own handling (e.g. routing a large log through a server-side export instead), mirroring
 *   `<lr-media-card>`'s `lr-open` convention.
 * @event lr-follow-change - `detail: { following }` — a user viewport/jump action changed
 *   stick-to-bottom. Direct `follow` assignments and imperative navigation do not echo an event.
 * @event lr-search-change - `detail: { query, matchCount, matchCountExact, activeIndex }`.
 *   `matchCountExact` is `false` once a search hits the 10,000-match retention ceiling, marking
 *   `matchCount` as a lower bound rather than an exact total.
 * @event lr-highlight-activate - `detail: { highlightId }` — a highlighted line was
 *   clicked/activated.
 * @event lr-text-select - `detail: { text, anchor, rects }` — fires on pointerup after a text
 *   selection ending inside the viewport. `anchor` is `null` when either selection endpoint isn't
 *   inside a currently-mounted (non-virtualized-out) line.
 * @csspart base - The outer container.
 * @csspart toolbar - The header row, only rendered when copy/download are enabled.
 * @csspart copy-button - The copy-to-clipboard button.
 * @csspart download-button - The download button.
 * @csspart viewport - The `role="log"` scrollable region wrapping the virtualized line list.
 * @csspart line - One rendered line; carries `data-line-number`, `data-match`, `data-highlight-tone`.
 *   Rendered through `<lr-virtual-list>`'s `renderItem`, so it lives inside that element's own
 *   shadow root rather than this component's -- this component's own stylesheet reaches it via
 *   `lr-virtual-list::part(line)`, one hop of the standard CSS Shadow Parts selector.
 * @csspart line-interactive - Alias on a line that owns an activatable highlight.
 * @csspart line-highlight-accent - Alias on an accent-highlighted line.
 * @csspart line-highlight-success - Alias on a success-highlighted line.
 * @csspart line-highlight-warning - Alias on a warning-highlighted line.
 * @csspart line-highlight-danger - Alias on a danger-highlighted line.
 * @csspart line-highlight-neutral - Alias on a neutral-highlighted line.
 * @csspart line-match - Alias on a line containing a search match.
 * @csspart line-active-match - Alias on the active search-match line.
 * @csspart jump-to-latest - The pill shown while `follow` is disengaged and new output has arrived.
 * @csspart announcer - The visually-hidden, `aria-hidden` mirror of the text last announced while
 *   `announce-output` is set. The announcement itself lands in the shared light-DOM region
 *   (`acquireAnnouncementSink()` in `internal/announcer.ts`), because a live region inside a shadow
 *   root is not reliably announced; this part is a styling/inspection surface only.
 * @cssprop [--lr-terminal-height=var(--lr-size-20rem)] - Block size of `[part="viewport"]`, the
 *   scrollable log region. Not declared on `:host`, so it is inherited — set it on the host or any
 *   ancestor.
 * @cssprop [--lr-terminal-highlight-accent-bg=var(--lr-color-brand-quiet)] - Background of an
 *   `accent`-tone highlighted line. Decoupled from the shared `--lr-color-brand-quiet` token also
 *   used by `[part="copy-button"]`/`[part="download-button"]`'s hover state, and from any
 *   `::part('line')` override (the background is applied inline, so a stylesheet rule can't beat it
 *   without `!important`).
 * @cssprop [--lr-terminal-highlight-success-bg=var(--lr-color-success-quiet)] - Background of a
 *   `success`-tone highlighted line.
 * @cssprop [--lr-terminal-highlight-warning-bg=var(--lr-color-warning-quiet)] - Background of a
 *   `warning`-tone highlighted line.
 * @cssprop [--lr-terminal-highlight-danger-bg=var(--lr-color-danger-quiet)] - Background of a
 *   `danger`-tone highlighted line.
 * @cssprop [--lr-terminal-highlight-neutral-bg=var(--lr-color-surface)] - Background of a
 *   `neutral`-tone highlighted line.
 * @cssprop [--lr-terminal-search-outline-color=var(--lr-color-warning)] - Outline color for a
 *   line containing a non-active search match.
 * @cssprop [--lr-terminal-search-active-outline-color=var(--lr-color-brand)] - Outline color for
 *   the active search match's line.
 * @cssprop [--lr-terminal-compact-toolbar-padding=var(--lr-space-2xs) var(--lr-space-xs)] -
 *   `[part="toolbar"]` padding while `compact`.
 * @cssprop [--lr-terminal-compact-toolbar-gap=var(--lr-space-2xs)] - Gap between
 *   `[part="toolbar"]`'s buttons while `compact`.
 * @cssprop [--lr-terminal-compact-line-padding-inline=var(--lr-space-xs)] - Inline padding of each
 *   rendered `[part="line"]` while `compact`.
 * @status stable
 * @since 4.0.0
 */
export class LyraTerminal extends LyraElement<LyraTerminalEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    jumpToLatest: LYRA_DEFAULT_jumpToLatest,
    terminalDownload: LYRA_DEFAULT_terminalDownload,
    terminalHighlightLine: LYRA_DEFAULT_terminalHighlightLine,
    terminalLabel: LYRA_DEFAULT_terminalLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-text-select',
  ]);

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  @property() content = '';
  /** Line-count scrollback buffer limit. NaN/negative/oversized (e.g. `Infinity`) normalize to a
   *  1..10,000 range; total retained cells and cells per line have independent hard ceilings. */
  @property({ type: Number, attribute: 'max-scrollback' }) maxScrollback = 5000;
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) wrap = true;
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) copyable = true;
  @property({ type: Boolean, reflect: true }) downloadable = false;
  @property() filename = 'terminal.log';
  @property({ type: Boolean, attribute: 'announce-output' }) announceOutput = false;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Line-range highlights keyed by stable id. Empty/blank ids are omitted and duplicates normalize
   *  first-wins before range ownership, activation, and anchor lookup. */
  @property({ attribute: false }) highlights: readonly LyraHighlight[] = [];
  @property({ attribute: false }) activeHighlightId: string | null = null;

  private get normalizedHighlights(): readonly LyraHighlight[] {
    return firstByIdentity(Array.isArray(this.highlights) ? this.highlights : [], (highlight) => highlight.id);
  }

  /** Tightens the toolbar's padding/gap and each rendered line's inline padding for a terminal
   *  embedded in an already-padded transcript row -- same convention as `lr-task-list`'s and
   *  `lr-thinking-panel`'s `compact`. Defaults to `false`, i.e. the full padding. Purely a density
   *  knob: the card border and background stay, so use `frame="plain"` to drop the chrome. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps `[part="base"]`'s border, corner radius, and raised surface; `'plain'` removes all
   *  three so a terminal nested inside a container that already draws a border (an agent-run
   *  panel, a message bubble) doesn't double it. Plain keeps the toolbar/log divider and whichever
   *  regular or compact padding applies -- it controls outer chrome only. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Feature-detectable capability mirror -- the same pattern `DocumentAnchorTarget`-adopting
   *  viewers use for their own `anchorKinds` field. This component isn't document-viewer-registry-
   *  routed, so it has no registry `capabilities.anchors` entry to declare this on instead. */
  readonly anchorKinds: readonly LyraAnchor['kind'][] = ['line-range'];

  @state() private lines: TerminalLine[] = [];
  @state() private scrollTargetLineNumber: number | null = null;
  @state() private copyStatus: 'rest' | 'success' | 'error' = 'rest';

  private buffer: TerminalLine[] = [];
  private retainedCellCount = 0;
  private lineSeq = 0;
  private column = 0;
  private appliedContent = '';
  private readonly ansiParser = createAnsiParser();
  private copyTimeoutId?: number;
  private copyTimeoutWindow?: Window;
  private copyTimeoutGeneration?: number;
  private copyGeneration = 0;
  /** Plain text appended since the last announcer flush -- coalesced so a burst of small
   *  `write()` chunks (a common line-by-line stdout pattern) becomes one throttled announcement
   *  instead of one per chunk. Reset in the announcer's own `onFlush` callback below, so it always
   *  reflects exactly "what's new since the last thing actually spoken". */
  private pendingAnnounceText = '';
  private announceRegionEl?: HTMLElement;
  /** Handle on the shared light-DOM live region every flush actually announces through -- a region
   *  rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores one
   *  outright), so `[part="announcer"]` below is only an `aria-hidden` mirror. */
  private sink?: AnnouncementSink;
  private readonly announcer = new Announcer({
    throttleMs: ANNOUNCE_THROTTLE_MS,
    onFlush: (text) => {
      this.pendingAnnounceText = '';
      this.sink?.announce(text);
      if (this.announceRegionEl) this.announceRegionEl.textContent = text;
    },
  });

  private searchQuery = '';
  private searchMatches: SearchMatch[] = [];
  /** `false` once `recomputeSearchMatches()` hits `MAX_SEARCH_MATCHES` -- marks `searchMatches`
   *  as a truthful lower bound rather than the true total. */
  private searchMatchCountExact = true;
  private searchActiveIndex = -1;

  override connectedCallback(): void {
    super.connectedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    // Acquired on connect, not on the first announcement: assistive tech has to have been
    // observing a live region *before* text arrives for the change to be announced at all, and
    // streamed output can start in the same task the element is appended in.
    this.sink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetCopyFeedback();
    this.cancelPendingAnnouncement();
    this.sink?.release();
    this.sink = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetCopyFeedback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.announceRegionEl = this.renderRoot.querySelector<HTMLElement>('[part="announcer"]') ?? undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('content')) {
      this.commitPendingContent();
    }
    if (changed.has('maxScrollback')) this.trimScrollback();
    if (changed.has('announceOutput') && !this.announceOutput) this.cancelPendingAnnouncement();
  }

  // --- Buffer / cursor model -------------------------------------------------

  private resetBuffer(): void {
    this.ansiParser.reset();
    this.buffer = [];
    this.retainedCellCount = 0;
    this.lineSeq = 0;
    this.column = 0;
    this.lines = [];
    this.scrollTargetLineNumber = null;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
  }

  private appendLine(): void {
    this.buffer.push({ number: ++this.lineSeq, cells: [] });
    const max = this.effectiveMaxScrollback();
    if (this.buffer.length - max >= SCROLLBACK_PRUNE_BATCH) this.trimScrollback(false);
    this.column = 0;
  }

  private effectiveMaxScrollback(): number {
    return Math.max(1, finiteCount(this.maxScrollback, 5000, MAX_SCROLLBACK_LINES));
  }

  private trimScrollback(notifySearch = true): void {
    const previousSearch = this.searchState();
    const max = this.effectiveMaxScrollback();
    const removeCount = Math.max(0, this.buffer.length - max);
    const removed = removeCount > 0 ? this.buffer.splice(0, removeCount) : [];
    for (const line of removed) this.retainedCellCount -= line.cells.length;
    let resourceTrimmed = false;
    while (this.retainedCellCount > MAX_RETAINED_CELLS && this.buffer.length > 1) {
      const line = this.buffer.shift();
      if (line) this.retainedCellCount -= line.cells.length;
      resourceTrimmed = true;
    }
    const trimmed = removed.length > 0 || resourceTrimmed;
    if (!trimmed) return;
    this.lines = [...this.buffer];
    if (this.searchQuery) this.recomputeSearchMatches();
    if (
      this.scrollTargetLineNumber !== null &&
      !this.buffer.some((line) => line.number === this.scrollTargetLineNumber)
    ) {
      this.scrollTargetLineNumber = this.buffer[0]?.number ?? null;
    }
    if (notifySearch) this.emitSearchChangeIfChanged(previousSearch);
  }

  private putChar(ch: string, styles: AnsiStyles): void {
    if (this.buffer.length === 0) this.appendLine();
    const line = this.buffer[this.buffer.length - 1]!; // safe: appendLine() above guarantees ≥1 line
    if (this.column >= MAX_CELLS_PER_LINE) return;
    if (this.column < line.cells.length) {
      line.cells[this.column] = { char: ch, styles };
    } else {
      const before = line.cells.length;
      while (line.cells.length < this.column && line.cells.length < MAX_CELLS_PER_LINE) {
        line.cells.push({ char: ' ', styles: EMPTY_CELL_STYLES });
      }
      line.cells.push({ char: ch, styles });
      this.retainedCellCount += line.cells.length - before;
    }
    this.column = Math.min(MAX_CELLS_PER_LINE, this.column + 1);
  }

  private applyChunk(text: string, styles: AnsiStyles): void {
    for (const ch of text) {
      if (ch === '\n') this.appendLine();
      else if (ch === '\r') this.column = 0;
      else if (ch === '\b') this.column = Math.max(0, this.column - 1);
      else if (ch === '\t') this.column = Math.min(MAX_CELLS_PER_LINE, (Math.floor(this.column / 8) + 1) * 8);
      else this.putChar(ch, styles);
    }
  }

  private writeInternal(raw: string, notifySearch = true): void {
    const previousSearch = this.searchState();
    const previousText = this.getPlainText();
    const boundedRaw = raw.slice(0, MAX_INPUT_CHARACTERS);
    if (boundedRaw !== '') {
      const segments = this.ansiParser.push(boundedRaw);
      for (const seg of segments) {
        this.applyChunk(seg.text, seg.styles);
      }
    }
    this.trimScrollback(false);
    this.lines = [...this.buffer];
    if (this.searchQuery) this.recomputeSearchMatches();
    if (this.follow) {
      const last = this.buffer[this.buffer.length - 1];
      this.scrollTargetLineNumber = last ? last.number : null;
    }
    const nextText = this.getPlainText();
    const visibleAnnouncement = nextText.startsWith(previousText)
      ? nextText.slice(previousText.length)
      : nextText;
    if (this.hasUpdated && this.announceOutput && visibleAnnouncement !== '') {
      // Always hand the *cumulative* not-yet-spoken text to announce() -- Announcer.announce()
      // overwrites (never appends) its own pending text, and only the onFlush callback above
      // (fired at most once per throttle window) clears pendingAnnounceText, so a burst of small
      // write() chunks inside one throttle window still ends up fully spoken as a single
      // announcement instead of losing every chunk but the last.
      this.pendingAnnounceText += (this.pendingAnnounceText ? '\n' : '') + visibleAnnouncement;
      this.announcer.announce(this.pendingAnnounceText);
    }
    if (notifySearch) this.emitSearchChangeIfChanged(previousSearch);
  }

  /** Append streamed output. Escape sequences may split across chunks -- the shared parser buffers
   *  partial sequences internally up to its 4,096-character ceiling, then drops an unterminated
   *  sequence and resumes from a clean boundary on the next write. */
  write(chunk: string): void {
    this.commitPendingContent();
    this.writeInternal(typeof chunk === 'string' ? chunk : String(chunk));
  }

  /** Synchronously replaces the buffer and the reactive `content` source. This is the explicit
   *  commit-order primitive for code that mixes replacement with same-turn `write()`/`clear()`. */
  replace(content: string): void {
    this.content = typeof content === 'string' ? content : String(content);
    this.commitPendingContent();
  }

  private commitPendingContent(): void {
    if (this.appliedContent === this.content) return;
    const previousSearch = this.searchState();
    this.cancelPendingAnnouncement();
    this.resetBuffer();
    this.appliedContent = this.content;
    this.writeInternal(this.content, false);
    this.emitSearchChangeIfChanged(previousSearch);
  }

  clear(): void {
    const previousSearch = this.searchState();
    this.cancelPendingAnnouncement();
    // `clear()` wins over a pending reactive replacement in the same turn; willUpdate sees this
    // marker and cannot resurrect the just-cleared content.
    this.appliedContent = this.content;
    this.resetBuffer();
    this.emitSearchChangeIfChanged(previousSearch);
  }

  getPlainText(): string {
    return this.buffer.map(plainTextOfLine).join('\n');
  }

  scrollToBottom(): void {
    this.follow = true;
    const last = this.buffer[this.buffer.length - 1];
    this.scrollTargetLineNumber = last ? last.number : null;
  }

  private jumpToLatest = (): void => {
    const changed = !this.follow;
    this.scrollToBottom();
    if (changed) this.emit('lr-follow-change', { following: true });
  };

  // --- Search ------------------------------------------------------------

  private recomputeSearchMatches(): void {
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    if (!this.searchQuery) return;
    const needle = this.searchQuery.toLocaleLowerCase(this.effectiveLocale);
    for (const line of this.buffer) {
      const haystack = plainTextOfLine(line).toLocaleLowerCase(this.effectiveLocale);
      let from = 0;
      for (;;) {
        const idx = haystack.indexOf(needle, from);
        if (idx < 0) break;
        this.searchMatches.push({ lineNumber: line.number });
        if (this.searchMatches.length >= MAX_SEARCH_MATCHES) {
          this.searchMatchCountExact = false;
          break;
        }
        from = idx + needle.length;
      }
      if (this.searchMatches.length >= MAX_SEARCH_MATCHES) break;
    }
    if (this.searchActiveIndex >= this.searchMatches.length) {
      this.searchActiveIndex = this.searchMatches.length > 0 ? 0 : -1;
    }
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
      activeIndex: this.searchActiveIndex,
    });
  }

  private searchState(): SearchState {
    return {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
      activeIndex: this.searchActiveIndex,
    };
  }

  private emitSearchChangeIfChanged(previous: SearchState): void {
    if (
      previous.query !== this.searchQuery ||
      previous.matchCount !== this.searchMatches.length ||
      previous.matchCountExact !== this.searchMatchCountExact ||
      previous.activeIndex !== this.searchActiveIndex
    ) {
      this.emitSearchChange();
    }
  }

  private jumpToActiveMatch(): void {
    const match = this.searchMatches[this.searchActiveIndex];
    if (!match) return;
    if (this.follow) {
      this.follow = false;
    }
    this.scrollTargetLineNumber = match.lineNumber;
  }

  /** Resolves the retained match count. The emitted `lr-search-change.matchCountExact` is `false`
   *  when that return value is only a lower bound because the 10,000-match retention ceiling was
   *  reached. */
  async search(query: string): Promise<number> {
    const previousSearch = this.searchState();
    this.searchQuery = query;
    this.recomputeSearchMatches();
    this.searchActiveIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.emitSearchChangeIfChanged(previousSearch);
    if (this.searchActiveIndex >= 0) this.jumpToActiveMatch();
    await this.updateComplete;
    return this.searchMatches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `true` once the
   *  active match moved, `false` when there are no matches -- the shape the shared
   *  `LyraTextViewerTarget` search contract declares, so a find-in-page host can drive every
   *  searchable component through one typed surface. */
  async searchNext(): Promise<boolean> {
    if (this.searchMatches.length === 0) return false;
    const previousSearch = this.searchState();
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChangeIfChanged(previousSearch);
    this.jumpToActiveMatch();
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `true` once the
   *  active match moved, `false` when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (this.searchMatches.length === 0) return false;
    const previousSearch = this.searchState();
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChangeIfChanged(previousSearch);
    this.jumpToActiveMatch();
    return true;
  }

  clearSearch(): void {
    const previousSearch = this.searchState();
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.emitSearchChangeIfChanged(previousSearch);
    this.requestUpdate();
  }

  // --- Highlights / anchors ------------------------------------------------

  /** Resolves, in one O(highlights + covered-lines) pass, both (a) `perLine` -- the same winning
   *  highlight a per-line `this.highlights.find(...)` scan would have returned for every line
   *  currently in the buffer, first match in `this.highlights` array order winning any overlap --
   *  and (b) `owners`, the first (lowest-numbered) line each highlight actually wins, i.e. the one
   *  `renderLine()` renders as the highlight's single interactive (`role="button"`) owner. Replaces
   *  what used to be a per-line `.find()` scan of the whole `highlights` array (O(lines ×
   *  highlights) every render). `this.lines`' numbers are always contiguous (see `appendLine()`),
   *  so a highlight's `[start, end]` range is
   *  clamped to the buffer's actual `[minLine, maxLine]` and then walked directly -- an end far
   *  outside the buffer (or omitted) never costs more than a pass over the lines actually present.
   *  Highlights are processed in array order and a line already claimed by an earlier (higher
   *  priority) highlight is skipped, which reproduces `.find()`'s first-match-wins tie-break
   *  exactly, including when a later-array, wider/earlier-starting highlight would otherwise have
   *  looked like the "obvious" winner by start position alone. */
  private resolvedHighlightLines(): {
    perLine: Map<number, LyraHighlight>;
    owners: Map<LyraHighlight, number>;
  } {
    const perLine = new Map<number, LyraHighlight>();
    const owners = new Map<LyraHighlight, number>();
    const highlights = this.normalizedHighlights;
    if (this.lines.length === 0 || highlights.length === 0) return { perLine, owners };
    const minLine = this.lines[0]!.number;
    const maxLine = this.lines[this.lines.length - 1]!.number;
    for (const highlight of highlights) {
      if (highlight.anchor.kind !== 'line-range') continue;
      const start = Math.max(highlight.anchor.start, minLine);
      const end = Math.min(highlight.anchor.end ?? highlight.anchor.start, maxLine);
      for (let lineNumber = start; lineNumber <= end; lineNumber++) {
        if (perLine.has(lineNumber)) continue;
        perLine.set(lineNumber, highlight);
        if (!owners.has(highlight)) owners.set(highlight, lineNumber);
      }
    }
    return { perLine, owners };
  }

  private activateHighlight(h: LyraHighlight): void {
    this.activeHighlightId = h.id;
    this.emit('lr-highlight-activate', { highlightId: h.id });
  }

  private onLineKeyDown = (e: KeyboardEvent, h: LyraHighlight): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activateHighlight(h);
    }
  };

  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    let start: number | undefined;
    if (typeof target === 'string') {
      const highlight = this.normalizedHighlights.find((h) => h.id === target);
      if (highlight?.anchor.kind === 'line-range') start = highlight.anchor.start;
    } else if (target.kind === 'line-range') {
      start = target.start;
    }
    if (start === undefined) return false;
    const found = this.buffer.some((line) => line.number === start);
    if (!found) return false;
    if (this.follow) {
      this.follow = false;
    }
    this.scrollTargetLineNumber = start;
    await this.updateComplete;
    return true;
  }

  // --- Copy / download ------------------------------------------------------

  private onCopy = (): void => {
    void this.copyOutput();
  };

  private async copyOutput(): Promise<void> {
    const text = this.getPlainText();
    const ownerWindow = this.isConnected ? this.ownerDocument.defaultView : null;
    const generation = ++this.copyGeneration;
    this.clearCopyTimeout();
    this.copyStatus = 'rest';
    const outcome = await writeClipboardText(ownerWindow, text);
    if (!ownerWindow || !this.isCurrentCopy(generation, ownerWindow)) return;
    if (!outcome.ok) {
      this.showCopyStatus('error', generation, ownerWindow);
      this.emit('lr-error');
      this.emit('lr-copy-error', outcome);
      return;
    }
    this.showCopyStatus('success', generation, ownerWindow);
    this.emit('lr-copy', outcome);
  }

  private isCurrentCopy(generation: number, ownerWindow: Window): boolean {
    return this.isConnected
      && generation === this.copyGeneration
      && this.ownerDocument.defaultView === ownerWindow;
  }

  private showCopyStatus(status: 'success' | 'error', generation: number, ownerWindow: Window): void {
    this.copyStatus = status;
    this.clearCopyTimeout();
    this.copyTimeoutWindow = ownerWindow;
    this.copyTimeoutGeneration = generation;
    this.copyTimeoutId = ownerWindow.setTimeout(() => {
      if (
        this.copyTimeoutWindow !== ownerWindow
        || this.copyTimeoutGeneration !== generation
        || generation !== this.copyGeneration
        || !this.isConnected
        || this.ownerDocument.defaultView !== ownerWindow
      ) return;
      this.copyTimeoutId = undefined;
      this.copyTimeoutWindow = undefined;
      this.copyTimeoutGeneration = undefined;
      this.copyStatus = 'rest';
    }, 1500);
  }

  private resetCopyFeedback(): void {
    this.copyGeneration += 1;
    this.clearCopyTimeout();
    this.copyStatus = 'rest';
  }

  private clearCopyTimeout(): void {
    if (this.copyTimeoutId !== undefined) this.copyTimeoutWindow?.clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = undefined;
    this.copyTimeoutWindow = undefined;
    this.copyTimeoutGeneration = undefined;
  }

  private cancelPendingAnnouncement(): void {
    this.pendingAnnounceText = '';
    this.announcer.cancel();
    if (this.announceRegionEl) this.announceRegionEl.textContent = '';
  }

  private onDownload = (): void => {
    const filename = this.filename || 'terminal.log';
    // `lr-download` fires first and is cancelable -- a host that calls preventDefault() on it
    // suppresses the built-in Blob download below and can substitute its own handling instead
    // (e.g. routing a large log through a server-side export), matching <lr-media-card>'s
    // `lr-open` convention. See the class doc's event list.
    if (this.emit('lr-download', { filename }, { cancelable: true }).defaultPrevented) return;
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const blob = new ownerWindow.Blob([this.getPlainText()], { type: 'text/plain' });
    const url = ownerWindow.URL.createObjectURL(blob);
    const a = this.ownerDocument.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    ownerWindow.setTimeout(() => ownerWindow.URL.revokeObjectURL(url), 5000);
  };

  // --- Follow tracking via virtual-list's visible-range event ---------------

  private onVisibleRangeChanged = (e: CustomEvent<LyraVirtualListRange>): void => {
    e.stopPropagation();
    const atBottom = this.lines.length === 0 || e.detail.end >= this.lines.length - 1;
    if (atBottom !== this.follow) {
      this.follow = atBottom;
      this.emit('lr-follow-change', { following: atBottom });
    }
  };

  private onViewportKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'End') this.jumpToLatest();
  };

  /** Best-effort: resolves a user text selection ending inside the viewport into `lr-text-select`.
   *  Walks each selection endpoint up to its nearest `[data-line-number]` ancestor to build a
   *  `line-range` anchor; `anchor` is `null` when either endpoint isn't inside a currently-mounted
   *  line (virtualized out, or the selection reaches outside the viewport entirely) -- matching
   *  `TextSelectDetail`'s own documented "`anchor` is `null` when the selection couldn't be
   *  anchored" case, shared by every anchor-capable viewer. Cross-shadow-boundary text selection
   *  has known browser-support variance; this degrades to no event firing rather than a broken one
   *  when the platform doesn't expose a usable Selection here. */
  private onViewportPointerUp = (): void => {
    // Selectable text lives inside <lr-virtual-list>'s own shadow root (renderItem's render
    // root, not this component's -- see the class doc's `line` csspart note), so a shadow-scoped
    // selection read is anchored there, not on `this.shadowRoot`. `ShadowRoot.getSelection` is a
    // Chromium-only extension absent from the standard DOM lib types (same cast the shared
    // `internal/anchor-target.ts` selection helper uses for its own shadow-scoped read).
    const shadowGetSelection = (root: ShadowRoot | null | undefined) =>
      (root as unknown as { getSelection?: () => Selection | null } | null | undefined)?.getSelection?.();
    const listShadow = this.renderRoot.querySelector('lr-virtual-list')?.shadowRoot;
    const selection =
      shadowGetSelection(listShadow) ?? shadowGetSelection(this.shadowRoot) ?? this.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed) return;
    let range: Range;
    try {
      range = selection.getRangeAt(0);
    } catch {
      return;
    }
    const text = boundedSelectionText(range);
    if (text === '') return;
    const lineNumberOf = (node: Node | null): number | null => {
      let el: Node | null = node;
      while (el) {
        if (el.nodeType === 1) {
          const attr = (el as Element).getAttribute('data-line-number');
          if (attr !== null) return Number(attr);
        }
        el = (el as ParentNode).parentNode ?? (el as unknown as { host?: Node }).host ?? null;
      }
      return null;
    };
    const startLine = lineNumberOf(selection.anchorNode);
    const endLine = lineNumberOf(selection.focusNode);
    const anchor: LyraAnchor | null =
      startLine !== null && endLine !== null
        ? { kind: 'line-range', start: Math.min(startLine, endLine), end: Math.max(startLine, endLine) }
        : null;
    let rects: TextSelectDetail['rects'] = Object.freeze([]);
    try {
      rects = boundedSelectionRects(range);
    } catch {
      // A live Range can be invalidated between text and geometry capture. Keep the bounded
      // text/anchor event useful while failing closed on its optional geometry.
    }
    this.emit('lr-text-select', { text, anchor, rects });
  };

  // --- Render ------------------------------------------------------------

  /** Per-line state styling (cursor, search-match outline, highlight-tone background). Applied
   *  inline rather than through `data-match`/`data-highlight-tone` stylesheet selectors, since those
   *  attributes live on the same element `part="line"` names -- and a `::part()` selector (needed to
   *  reach across `<lr-virtual-list>`'s shadow boundary, see `terminal.styles.ts`) cannot be
   *  combined with a trailing attribute selector the way a same-shadow-root rule could. */
  private lineStateStyle(
    highlight: LyraHighlight | undefined,
    interactive: boolean,
    isMatchLine: boolean,
    isActiveMatchLine: boolean,
  ): Record<string, string> {
    return {
      cursor: interactive ? 'pointer' : '',
      outline: isMatchLine
        ? `var(--lr-size-2px) solid ${
            isActiveMatchLine
              ? 'var(--lr-terminal-search-active-outline-color, var(--lr-color-brand))'
              : 'var(--lr-terminal-search-outline-color, var(--lr-color-warning))'
          }`
        : '',
      background: highlight?.tone ? TONE_BACKGROUND_VAR[highlight.tone] : '',
    };
  }

  private renderLine = (
    line: TerminalLine,
    highlightByLine: Map<number, LyraHighlight>,
    highlightOwnerLines: Map<LyraHighlight, number>,
    matchedLineNumbers: Set<number>,
    activeMatchLineNumber: number | null,
  ): TemplateResult => {
    const isMatchLine = matchedLineNumbers.has(line.number);
    const isActiveMatchLine = activeMatchLineNumber !== null && activeMatchLineNumber === line.number;
    const highlight = highlightByLine.get(line.number);
    const highlightOwner =
      highlight && highlightOwnerLines.get(highlight) === line.number
        ? highlight
        : undefined;
    const tone: LyraHighlightTone | undefined = highlight?.tone;
    const lineText = plainTextOfLine(line).trim();
    const lineLabel =
      lineText ||
      this.localize('terminalHighlightLine', undefined, {
        line: getNumberFormat(this.effectiveLocale).format(line.number),
      });
    const highlightLabel = highlightOwner?.label
      ? [
          this.localize('highlightWithLabel', undefined, { label: highlightOwner.label }),
          lineLabel,
        ].join(this.localize('accessibleLabelSeparator'))
      : lineLabel;
    const stateParts = [
      'line',
      highlightOwner ? 'line-interactive' : '',
      tone ? `line-highlight-${tone}` : '',
      isMatchLine ? 'line-match' : '',
      isActiveMatchLine ? 'line-active-match' : '',
    ].filter(Boolean).join(' ');
    return html`
      <div
        part=${stateParts}
        dir="ltr"
        style=${styleMap(this.lineStateStyle(highlight, highlightOwner !== undefined, isMatchLine, isActiveMatchLine))}
        data-line-number=${line.number}
        data-match=${!isMatchLine ? nothing : isActiveMatchLine ? 'active' : ''}
        data-highlight-tone=${tone ?? nothing}
        tabindex=${highlightOwner ? '0' : nothing}
        role=${highlightOwner ? 'button' : nothing}
        aria-label=${highlightOwner ? highlightLabel : nothing}
        aria-current=${highlightOwner ? (highlightOwner.id === this.activeHighlightId ? 'true' : 'false') : nothing}
        @click=${highlightOwner ? () => this.activateHighlight(highlightOwner) : nothing}
        @keydown=${highlightOwner ? (e: KeyboardEvent) => this.onLineKeyDown(e, highlightOwner) : nothing}
      >${groupCells(line.cells).map(
        (seg) => html`<span style=${styleMap(this.segmentStyle(seg.styles))}>${seg.text}</span>`,
      )}</div>
    `;
  };

  private segmentStyle(s: AnsiStyles): Record<string, string> {
    const fg = sanitizeCssColor(s.fg) ?? 'var(--lr-color-text)';
    const bg = sanitizeCssColor(s.bg);
    const defaultSurface = 'var(--lr-terminal-surface-color, var(--lr-color-surface-raised))';
    return {
      'font-weight': s.bold ? 'bold' : 'normal',
      opacity: s.dim ? '0.7' : '1',
      'font-style': s.italic ? 'italic' : 'normal',
      'text-decoration': s.underline ? 'underline' : 'none',
      color: s.inverse ? (bg ?? defaultSurface) : fg,
      'background-color': s.inverse ? fg : (bg ?? 'transparent'),
    };
  }

  override render(): TemplateResult {
    const hasToolbar = this.copyable || this.downloadable;
    const ariaLabel = this.accessibleLabel || this.localize('terminalLabel');
    // Computed once per render, then consumed with O(1) lookups inside renderLine() for every
    // visible row -- rather than each row independently re-scanning `highlights`/`searchMatches`.
    const { perLine: highlightByLine, owners: highlightOwnerLines } = this.resolvedHighlightLines();
    const matchedLineNumbers = new Set(this.searchMatches.map((m) => m.lineNumber));
    const activeMatchLineNumber = this.searchMatches[this.searchActiveIndex]?.lineNumber ?? null;
    return html`
      <div part="base">
        <div part="announcer" class="sr-only" aria-hidden="true"></div>
        ${hasToolbar
          ? html`
              <div part="toolbar">
                ${this.copyable
                  ? html`<button part="copy-button" type="button" data-copy-status=${this.copyStatus} @click=${this.onCopy}>
                      ${this.copyStatus === 'success'
                        ? this.localize('copied')
                        : this.copyStatus === 'error'
                          ? this.localize('copyFailed')
                          : this.localize('copy')}
                    </button>`
                  : nothing}
                ${this.downloadable
                  ? html`<button part="download-button" type="button" @click=${this.onDownload}>
                      ${this.localize('terminalDownload')}
                    </button>`
                  : nothing}
              </div>
            `
          : nothing}
        <div
          part="viewport"
          role="log"
          aria-live="off"
          aria-label=${ariaLabel}
          @keydown=${this.onViewportKeyDown}
          @pointerup=${this.onViewportPointerUp}
        >
          <lr-virtual-list
            exportparts="line:line, line-interactive:line-interactive, line-highlight-accent:line-highlight-accent, line-highlight-success:line-highlight-success, line-highlight-warning:line-highlight-warning, line-highlight-danger:line-highlight-danger, line-highlight-neutral:line-highlight-neutral, line-match:line-match, line-active-match:line-active-match"
            .items=${this.lines}
            .renderItem=${(item: unknown) =>
              this.renderLine(
                item as TerminalLine,
                highlightByLine,
                highlightOwnerLines,
                matchedLineNumbers,
                activeMatchLineNumber,
              )}
            .keyFunction=${(item: unknown) => (item as TerminalLine).number}
            .activeItemId=${this.scrollTargetLineNumber ?? ''}
            row-height=${this.wrap ? 'auto' : '24'}
            @lr-visible-range-changed=${this.onVisibleRangeChanged}
          ></lr-virtual-list>
          ${!this.follow && this.lines.length > 0
            ? html`<button part="jump-to-latest" type="button" @click=${this.jumpToLatest}>
                ${this.localize('jumpToLatest')}
              </button>`
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-terminal': LyraTerminal;
  }
}
