import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { Announcer } from '../../../internal/announcer.js';
import { createAnsiParser, type AnsiSegment, type AnsiStyles } from '../../../internal/ansi.js';
import { finiteCount } from '../../../internal/numbers.js';
import type {
  LyraAnchor,
  LyraHighlight,
  LyraHighlightTone,
  HighlightActivateDetail,
  TextSelectDetail,
} from '../../viewers/document-viewer/anchors.js';
import { styles } from './terminal.styles.js';
// The registering barrel (not virtual-list.class.js) -- this side effect is what makes
// <lr-virtual-list> an actually-defined tag by the time this component renders it.
import '../../layout/virtual-list/virtual-list.js';
import type { VirtualListRange } from '../../layout/virtual-list/virtual-list.class.js';

export interface TerminalCell {
  char: string;
  styles: AnsiStyles;
}

export interface TerminalLine {
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

const TONE_BACKGROUND_VAR: Record<LyraHighlightTone, string> = {
  accent: 'var(--lr-color-brand-quiet)',
  success: 'var(--lr-color-success-quiet)',
  warning: 'var(--lr-color-warning-quiet)',
  danger: 'var(--lr-color-danger-quiet)',
  neutral: 'var(--lr-color-surface)',
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

export interface LyraTerminalEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-download': CustomEvent<{ filename: string }>;
  'lr-follow-change': CustomEvent<{ following: boolean }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

/**
 * `<lr-terminal>` — read-only ANSI console for streamed agent/tool output. Not a PTY: no
 * stdin/keystroke handling, no cursor-addressed full-screen apps.
 *
 * @customElement lr-terminal
 * @event lr-copy - `detail: { text }` — the copy button copied the SGR-stripped plain text.
 * @event lr-download - `detail: { filename }` — the download button triggered a Blob download.
 * @event lr-follow-change - `detail: { following }` — stick-to-bottom engaged/disengaged.
 * @event lr-search-change - `detail: { query, matchCount, activeIndex }`.
 * @event lr-highlight-activate - `detail: { id }` — a highlighted line was clicked/activated.
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
 * @csspart jump-to-latest - The pill shown while `follow` is disengaged and new output has arrived.
 * @csspart announcer - The visually-hidden `role="status"` region used when `announce-output` is set.
 */
export class LyraTerminal extends LyraElement<LyraTerminalEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property() content = '';
  /** Line-count scrollback buffer limit. NaN/negative/oversized (e.g. `Infinity`) all normalize
   *  through `finiteCount`, with a floor of 1 -- see `appendLine()`. */
  @property({ type: Number, attribute: 'max-scrollback' }) maxScrollback = 5000;
  @property({ type: Boolean, reflect: true }) follow = true;
  @property({ type: Boolean, reflect: true }) wrap = true;
  @property({ type: Boolean, reflect: true }) copyable = true;
  @property({ type: Boolean, reflect: true }) downloadable = false;
  @property() filename = 'terminal.log';
  @property({ type: Boolean, attribute: 'announce-output' }) announceOutput = false;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property({ attribute: false }) highlights: LyraHighlight[] = [];
  @property({ attribute: false }) activeHighlightId: string | null = null;

  /** Feature-detectable capability mirror -- the same pattern `DocumentAnchorTarget`-adopting
   *  viewers use for their own `anchorKinds` field. This component isn't document-viewer-registry-
   *  routed, so it has no registry `capabilities.anchors` entry to declare this on instead. */
  readonly anchorKinds: LyraAnchor['kind'][] = ['line-range'];

  @state() private lines: TerminalLine[] = [];
  @state() private scrollTargetLineNumber: number | null = null;
  @state() private justCopied = false;

  private buffer: TerminalLine[] = [];
  private lineSeq = 0;
  private column = 0;
  private readonly ansiParser = createAnsiParser();
  private copyTimeoutId?: ReturnType<typeof setTimeout>;
  /** Plain text appended since the last announcer flush -- coalesced so a burst of small
   *  `write()` chunks (a common line-by-line stdout pattern) becomes one throttled announcement
   *  instead of one per chunk. Reset in the announcer's own `onFlush` callback below, so it always
   *  reflects exactly "what's new since the last thing actually spoken". */
  private pendingAnnounceText = '';
  private announceRegionEl?: HTMLElement;
  private readonly announcer = new Announcer({
    throttleMs: ANNOUNCE_THROTTLE_MS,
    onFlush: (text) => {
      this.pendingAnnounceText = '';
      if (this.announceRegionEl) this.announceRegionEl.textContent = text;
    },
  });

  private searchQuery = '';
  private searchMatches: SearchMatch[] = [];
  private searchActiveIndex = -1;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
    this.announcer.cancel();
  }

  firstUpdated(): void {
    this.announceRegionEl = this.renderRoot.querySelector<HTMLElement>('[part="announcer"]') ?? undefined;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('content')) {
      this.resetBuffer();
      this.writeInternal(this.content);
    }
  }

  // --- Buffer / cursor model -------------------------------------------------

  private resetBuffer(): void {
    this.ansiParser.reset();
    this.buffer = [];
    this.lineSeq = 0;
    this.column = 0;
    this.lines = [];
    this.scrollTargetLineNumber = null;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchActiveIndex = -1;
  }

  private appendLine(): void {
    this.buffer.push({ number: ++this.lineSeq, cells: [] });
    const max = Math.max(1, finiteCount(this.maxScrollback, 5000));
    while (this.buffer.length > max) this.buffer.shift();
    this.column = 0;
  }

  private putChar(ch: string, styles: AnsiStyles): void {
    if (this.buffer.length === 0) this.appendLine();
    const line = this.buffer[this.buffer.length - 1];
    if (this.column < line.cells.length) {
      line.cells[this.column] = { char: ch, styles };
    } else {
      while (line.cells.length < this.column) line.cells.push({ char: ' ', styles: EMPTY_CELL_STYLES });
      line.cells.push({ char: ch, styles });
    }
    this.column++;
  }

  private applyChunk(text: string, styles: AnsiStyles): void {
    for (const ch of text) {
      if (ch === '\n') this.appendLine();
      else if (ch === '\r') this.column = 0;
      else if (ch === '\b') this.column = Math.max(0, this.column - 1);
      else if (ch === '\t') this.column = (Math.floor(this.column / 8) + 1) * 8;
      else this.putChar(ch, styles);
    }
  }

  private writeInternal(raw: string): void {
    if (raw !== '') {
      const segments = this.ansiParser.push(raw);
      for (const seg of segments) this.applyChunk(seg.text, seg.styles);
    }
    this.lines = [...this.buffer];
    if (this.searchQuery) this.recomputeSearchMatches();
    if (this.follow) {
      const last = this.buffer[this.buffer.length - 1];
      this.scrollTargetLineNumber = last ? last.number : null;
    }
    if (this.announceOutput && raw !== '') {
      // Always hand the *cumulative* not-yet-spoken text to announce() -- Announcer.announce()
      // overwrites (never appends) its own pending text, and only the onFlush callback above
      // (fired at most once per throttle window) clears pendingAnnounceText, so a burst of small
      // write() chunks inside one throttle window still ends up fully spoken as a single
      // announcement instead of losing every chunk but the last.
      this.pendingAnnounceText += (this.pendingAnnounceText ? '\n' : '') + raw;
      this.announcer.announce(this.pendingAnnounceText);
    }
  }

  /** Append streamed output. Escape sequences may split across chunks -- the shared parser buffers
   *  partial sequences internally. */
  write(chunk: string): void {
    this.writeInternal(chunk);
  }

  clear(): void {
    this.resetBuffer();
  }

  getPlainText(): string {
    return this.buffer.map(plainTextOfLine).join('\n');
  }

  scrollToBottom(): void {
    const last = this.buffer[this.buffer.length - 1];
    this.scrollTargetLineNumber = last ? last.number : null;
  }

  private jumpToLatest = (): void => {
    this.follow = true;
    this.emit('lr-follow-change', { following: true });
    this.scrollToBottom();
  };

  // --- Search ------------------------------------------------------------

  private recomputeSearchMatches(): void {
    this.searchMatches = [];
    if (!this.searchQuery) return;
    const needle = this.searchQuery.toLocaleLowerCase(this.effectiveLocale);
    for (const line of this.buffer) {
      const haystack = plainTextOfLine(line).toLocaleLowerCase(this.effectiveLocale);
      let from = 0;
      for (;;) {
        const idx = haystack.indexOf(needle, from);
        if (idx < 0) break;
        this.searchMatches.push({ lineNumber: line.number });
        from = idx + needle.length;
      }
    }
    if (this.searchActiveIndex >= this.searchMatches.length) {
      this.searchActiveIndex = this.searchMatches.length > 0 ? 0 : -1;
    }
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      activeIndex: this.searchActiveIndex,
    });
  }

  private jumpToActiveMatch(): void {
    const match = this.searchMatches[this.searchActiveIndex];
    if (!match) return;
    if (this.follow) {
      this.follow = false;
      this.emit('lr-follow-change', { following: false });
    }
    this.scrollTargetLineNumber = match.lineNumber;
  }

  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.recomputeSearchMatches();
    this.searchActiveIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0) this.jumpToActiveMatch();
    await this.updateComplete;
    return this.searchMatches.length;
  }

  searchNext(): void {
    if (this.searchMatches.length === 0) return;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    this.jumpToActiveMatch();
  }

  searchPrevious(): void {
    if (this.searchMatches.length === 0) return;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    this.jumpToActiveMatch();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchActiveIndex = -1;
    this.emitSearchChange();
    this.requestUpdate();
  }

  // --- Highlights / anchors ------------------------------------------------

  private highlightForLine(lineNumber: number): LyraHighlight | undefined {
    return this.highlights.find(
      (h) =>
        h.anchor.kind === 'line-range' &&
        lineNumber >= h.anchor.start &&
        lineNumber <= (h.anchor.end ?? h.anchor.start),
    );
  }

  private activateHighlight(h: LyraHighlight): void {
    this.activeHighlightId = h.id;
    this.emit('lr-highlight-activate', { id: h.id });
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
      const highlight = this.highlights.find((h) => h.id === target);
      if (highlight?.anchor.kind === 'line-range') start = highlight.anchor.start;
    } else if (target.kind === 'line-range') {
      start = target.start;
    }
    if (start === undefined) return false;
    const found = this.buffer.some((line) => line.number === start);
    if (!found) return false;
    this.follow = false;
    this.scrollTargetLineNumber = start;
    await this.updateComplete;
    return true;
  }

  // --- Copy / download ------------------------------------------------------

  private onCopy = (): void => {
    const text = this.getPlainText();
    try {
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // best-effort
    }
    this.emit('lr-copy', { text });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, 1500);
  };

  private onDownload = (): void => {
    const blob = new Blob([this.getPlainText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename || 'terminal.log';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    this.emit('lr-download', { filename: this.filename || 'terminal.log' });
  };

  // --- Follow tracking via virtual-list's visible-range event ---------------

  private onVisibleRangeChanged = (e: CustomEvent<VirtualListRange>): void => {
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
    const selection = shadowGetSelection(listShadow) ?? shadowGetSelection(this.shadowRoot) ?? document.getSelection();
    const text = selection?.toString() ?? '';
    if (!selection || selection.isCollapsed || text === '') return;
    const lineNumberOf = (node: Node | null): number | null => {
      let el: Node | null = node;
      while (el) {
        if (el instanceof Element) {
          const attr = el.getAttribute('data-line-number');
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
    let rects: DOMRect[] = [];
    try {
      rects = [...selection.getRangeAt(0).getClientRects()];
    } catch {
      rects = [];
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
    isMatchLine: boolean,
    isActiveMatchLine: boolean,
  ): Record<string, string> {
    return {
      cursor: highlight ? 'pointer' : '',
      outline: isMatchLine
        ? `var(--lr-size-2px) solid ${isActiveMatchLine ? 'var(--lr-color-brand)' : 'var(--lr-color-warning)'}`
        : '',
      background: highlight?.tone ? TONE_BACKGROUND_VAR[highlight.tone] : '',
    };
  }

  private renderLine = (line: TerminalLine): TemplateResult => {
    const isMatchLine = this.searchMatches.some((m) => m.lineNumber === line.number);
    const isActiveMatchLine = this.searchMatches[this.searchActiveIndex]?.lineNumber === line.number;
    const highlight = this.highlightForLine(line.number);
    const tone: LyraHighlightTone | undefined = highlight?.tone;
    return html`
      <div
        part="line"
        dir="ltr"
        style=${styleMap(this.lineStateStyle(highlight, isMatchLine, isActiveMatchLine))}
        data-line-number=${line.number}
        data-match=${!isMatchLine ? nothing : isActiveMatchLine ? 'active' : ''}
        data-highlight-tone=${tone ?? nothing}
        tabindex=${highlight ? '0' : nothing}
        role=${highlight ? 'button' : nothing}
        @click=${highlight ? () => this.activateHighlight(highlight) : nothing}
        @keydown=${highlight ? (e: KeyboardEvent) => this.onLineKeyDown(e, highlight) : nothing}
      >${groupCells(line.cells).map(
        (seg) => html`<span style=${styleMap(this.segmentStyle(seg.styles))}>${seg.text}</span>`,
      )}</div>
    `;
  };

  private segmentStyle(s: AnsiStyles): Record<string, string> {
    const fg = s.fg ?? 'var(--lr-color-text)';
    const bg = s.bg ?? 'transparent';
    return {
      'font-weight': s.bold ? 'bold' : 'normal',
      opacity: s.dim ? '0.7' : '1',
      'font-style': s.italic ? 'italic' : 'normal',
      'text-decoration': s.underline ? 'underline' : 'none',
      color: s.inverse ? bg : fg,
      'background-color': s.inverse ? fg : bg,
    };
  }

  render(): TemplateResult {
    const hasToolbar = this.copyable || this.downloadable;
    const ariaLabel = this.accessibleLabel || this.localize('terminalLabel');
    return html`
      <div part="base">
        <div part="announcer" class="sr-only" role="status" aria-live="polite"></div>
        ${hasToolbar
          ? html`
              <div part="toolbar">
                ${this.copyable
                  ? html`<button part="copy-button" type="button" @click=${this.onCopy}>
                      ${this.justCopied ? this.localize('copied') : this.localize('copy')}
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
          aria-label=${ariaLabel}
          @keydown=${this.onViewportKeyDown}
          @pointerup=${this.onViewportPointerUp}
        >
          <lr-virtual-list
            .items=${this.lines}
            .renderItem=${(item: unknown) => this.renderLine(item as TerminalLine)}
            .keyFunction=${(item: unknown) => (item as TerminalLine).number}
            .activeId=${this.scrollTargetLineNumber ?? ''}
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
