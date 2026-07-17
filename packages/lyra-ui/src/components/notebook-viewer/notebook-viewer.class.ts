import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../internal/anchor-target.js';
import type { LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { loadNotebookSanitizer } from './dompurify-loader.js';
import '../virtual-list/virtual-list.js';
import '../markdown/markdown.js';
import '../code-block/code-block.js';
import '../json-viewer/json-viewer.js';
import { styles } from './notebook-viewer.styles.js';

const MAX_CELLS = 2000;
const SUPPORTED_MAJOR = 4;
const SUPPORTED_MINORS = [0, 1, 2, 3, 4, 5];

interface NotebookOutput {
  output_type: 'stream' | 'error' | 'display_data' | 'execute_result';
  name?: 'stdout' | 'stderr';
  text?: string | string[];
  ename?: string;
  evalue?: string;
  traceback?: string[];
  data?: Record<string, string | string[]>;
}
interface NotebookCell {
  cell_type: 'markdown' | 'code' | 'raw';
  id?: string;
  source: string | string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
  metadata?: { language_info?: unknown };
}
interface NotebookDoc {
  nbformat: number;
  nbformat_minor: number;
  cells: NotebookCell[];
  metadata?: { language_info?: { name?: string }; kernelspec?: { language?: string } };
}

function joinSource(source: string | string[] | undefined): string {
  return Array.isArray(source) ? source.join('') : (source ?? '');
}
function joinText(text: string | string[] | undefined): string {
  return Array.isArray(text) ? text.join('') : (text ?? '');
}

function isNotebookShape(value: unknown): value is NotebookDoc {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.nbformat === 'number' && typeof v.nbformat_minor === 'number' && Array.isArray(v.cells);
}

type NotebookState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; doc: NotebookDoc }
  | { kind: 'error'; message: string };

export interface LyraNotebookViewerEventMap {
  'lyra-load': CustomEvent<{ cellCount: number; language: string }>;
  'lyra-highlight-activate': CustomEvent<{ id: string }>;
  'lyra-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * `<lyra-notebook-viewer>` — read-only Jupyter notebook (nbformat 4.x) renderer, composing existing
 * components per cell. Execution is a hard non-goal.
 *
 * Markdown cells render through `<lyra-markdown>`, code cells through `<lyra-code-block>` (using the
 * notebook's kernel language for syntax highlighting), and raw cells as plain preformatted text. A
 * code cell's `execute_result`/`display_data` outputs prefer, in order, `image/png`, `image/jpeg`,
 * `image/svg+xml` (sanitized), `text/html` (sanitized), `application/json` (via `<lyra-json-viewer>`),
 * then `text/plain`. Stream/error outputs render as plain preformatted text this round (tinted
 * `danger` for stderr/tracebacks) rather than interpreting ANSI escapes. Sanitizing raw HTML/SVG
 * output markup lazy-loads the optional peer dependency `dompurify` via `dompurify-loader.ts`; when
 * that peer isn't installed, the output renders a localized notice instead of raw markup.
 *
 * Cells are virtualized through `<lyra-virtual-list>` so a notebook with many cells stays cheap to
 * scroll. `node-path` anchors resolve `path[0]` as a cell index; `fragment` anchors resolve a cell's
 * own `id`.
 *
 * @customElement lyra-notebook-viewer
 * @event lyra-load - Fired once a notebook has been parsed and validated. `detail: { cellCount,
 *   language }`.
 * @event lyra-highlight-activate - `detail: { id }`.
 * @event lyra-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @event lyra-render-error - Fired when fetching, parsing, or validating the notebook fails.
 *   `detail: { error }`.
 * @csspart base - The root scroll container.
 * @csspart cell - One cell row (`data-cell-type`, `data-active`).
 * @csspart cell-gutter - The `In [n]`/`Out [n]` label column.
 * @csspart cell-source - A cell's source content.
 * @csspart outputs - The wrapper around a code cell's outputs.
 * @csspart output - One output (`data-output-type`, `data-stream`).
 * @csspart output-toggle - Expands/collapses a long text output.
 * @csspart error - The error region.
 * @csspart spinner - The loading status region.
 * @cssprop [--lyra-notebook-viewer-max-height=none] - Maximum block size of the scrollable body
 *   before it scrolls internally. Also settable via the `max-height` property.
 */
export class LyraNotebookViewer extends DocumentAnchorTarget(LyraElement) {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and parse as a notebook. Ignored once `notebook` is set. */
  @property() src = '';

  /** A parsed notebook document, or its raw JSON text. Setting this wins over `src` and is parsed
   *  (and validated) synchronously. */
  @property({ attribute: false })
  get notebook(): NotebookDoc | string | undefined {
    return this._notebook;
  }
  set notebook(value: NotebookDoc | string | undefined) {
    const old = this._notebook;
    this._notebook = value;
    this.requestUpdate('notebook', old);
    this.parseInline();
  }
  private _notebook?: NotebookDoc | string;

  /** Display name used as the viewer's accessible label, and matched against a `fragment` anchor's
   *  cell id. */
  @property() name = '';

  /** A plain-text output longer than this many lines renders collapsed behind a toggle. `0`
   *  disables collapsing. */
  @property({ type: Number, attribute: 'output-collapse-lines' }) outputCollapseLines = 40;

  /** A CSS length (e.g. `"30rem"`); once set, the notebook scrolls internally past this height
   *  instead of growing the page. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  readonly anchorKinds: readonly LyraAnchorKind[] = ['node-path', 'fragment'];

  @state() private loadState: NotebookState = { kind: 'idle' };
  @state() private expandedOutputs = new Set<number>();
  @state() private activeCellIndex: number | null = null;
  @state() private searchQuery = '';
  @state() private searchMatches: number[] = [];
  @state() private activeSearchIndex = -1;

  private generation = 0;

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src') && !this._notebook) this.scheduleAfterUpdate(() => { void this.loadFromSrc(); });
  }

  private parseInline(): void {
    if (this._notebook === undefined) return;
    const generation = ++this.generation;
    try {
      const raw = typeof this._notebook === 'string' ? JSON.parse(this._notebook) : this._notebook;
      this.setDoc(raw, generation);
    } catch (error) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerInvalid') };
      this.emit('lyra-render-error', { error });
    }
  }

  private async loadFromSrc(): Promise<void> {
    // Re-checked here (not just by updated()'s scheduling guard) -- this call is deferred via
    // scheduleAfterUpdate(), so a synchronous `notebook` assignment arriving after it was scheduled
    // but before it actually runs must still win; otherwise this stale src-fetch attempt would
    // overwrite the freshly-parsed inline notebook's `loaded` state back to `idle`.
    if (this._notebook !== undefined) return;
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.loadState = { kind: 'idle' };
      return;
    }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.loadState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      return;
    }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      this.setDoc(JSON.parse(text), generation);
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.loadState = {
        kind: 'error',
        message: error instanceof LyraUserFacingError
          ? error.message
          : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'),
      };
      this.emit('lyra-render-error', { error });
    }
  }

  private setDoc(raw: unknown, generation: number): void {
    if (generation !== this.generation) return;
    if (!isNotebookShape(raw)) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerInvalid') };
      this.emit('lyra-render-error', { error: new Error('invalid notebook shape') });
      return;
    }
    if (raw.nbformat !== SUPPORTED_MAJOR || !SUPPORTED_MINORS.includes(raw.nbformat_minor)) {
      this.loadState = {
        kind: 'error',
        message: this.localize('notebookViewerUnsupportedVersion', undefined, { version: `${raw.nbformat}.${raw.nbformat_minor}` }),
      };
      this.emit('lyra-render-error', { error: new Error('unsupported nbformat version') });
      return;
    }
    if (raw.cells.length > MAX_CELLS) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerTooManyCells') };
      this.emit('lyra-render-error', { error: new Error('too many cells') });
      return;
    }
    this.loadState = { kind: 'loaded', doc: raw };
    const language = raw.metadata?.language_info?.name ?? raw.metadata?.kernelspec?.language ?? '';
    this.emit('lyra-load', { cellCount: raw.cells.length, language });
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.loadState.kind !== 'loaded') return false;
    const cells = this.loadState.doc.cells;
    let index = -1;
    if (anchor.kind === 'node-path' && typeof anchor.path[0] === 'number') index = anchor.path[0];
    else if (anchor.kind === 'fragment') index = cells.findIndex((c) => c.id === anchor.id);
    else return false;
    if (index < 0 || index >= cells.length) return false;
    this.activeCellIndex = index;
    return true;
  }

  /** Case-insensitive substring search over every cell's joined source text and text-bearing
   *  outputs -- at most one match per cell. Resolves the match count and fires
   *  `lyra-search-change`. */
  async search(query: string): Promise<number> {
    const q = query.trim().toLowerCase();
    this.searchQuery = query;
    if (this.loadState.kind !== 'loaded' || !q) {
      this.searchMatches = [];
    } else {
      this.searchMatches = this.loadState.doc.cells.reduce<number[]>((acc, cell, i) => {
        const source = joinSource(cell.source).toLowerCase();
        const outputText = (cell.outputs ?? [])
          .map((o) => joinText(o.text) + Object.values(o.data ?? {}).map(joinText).join(''))
          .join(' ')
          .toLowerCase();
        if (source.includes(q) || outputText.includes(q)) acc.push(i);
        return acc;
      }, []);
    }
    this.activeSearchIndex = this.searchMatches.length ? 0 : -1;
    this.emitSearchChange();
    return this.searchMatches.length;
  }

  searchNext(): void {
    if (!this.searchMatches.length) return;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
  }

  searchPrevious(): void {
    if (!this.searchMatches.length) return;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.activeSearchIndex = -1;
    this.emitSearchChange();
  }

  private emitSearchChange(): void {
    this.emit('lyra-search-change', { query: this.searchQuery, matchCount: this.searchMatches.length, activeIndex: this.activeSearchIndex });
  }

  private toggleOutput(index: number): void {
    const next = new Set(this.expandedOutputs);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.expandedOutputs = next;
  }

  private renderTextOutput(index: number, text: string, tone?: 'danger'): TemplateResult {
    const lines = text.split('\n');
    const collapsible = this.outputCollapseLines > 0 && lines.length > this.outputCollapseLines;
    const expanded = this.expandedOutputs.has(index) || !collapsible;
    const shown = expanded ? text : lines.slice(0, this.outputCollapseLines).join('\n');
    return html`<div part="output" data-output-type="stream" data-stream=${tone === 'danger' ? 'stderr' : 'stdout'}
      >${shown}${collapsible
        ? html`<button
            part="output-toggle"
            type="button"
            aria-expanded=${expanded ? 'true' : 'false'}
            @click=${() => this.toggleOutput(index)}
          >${this.localize(expanded ? 'notebookViewerCollapseOutput' : 'notebookViewerShowAllOutput')}</button>`
        : nothing}</div
    >`;
  }

  private renderOutput(cellIndex: number, output: NotebookOutput, outputIndex: number): TemplateResult | typeof nothing {
    const key = cellIndex * 1000 + outputIndex;
    if (output.output_type === 'stream') {
      return this.renderTextOutput(key, joinText(output.text), output.name === 'stderr' ? 'danger' : undefined);
    }
    if (output.output_type === 'error') {
      const text = [`${output.ename ?? ''}: ${output.evalue ?? ''}`, ...(output.traceback ?? [])].join('\n');
      return html`<div part="output" data-output-type="error">${this.localize('notebookViewerErrorOutput')}: ${text}</div>`;
    }
    const data = output.data ?? {};
    if (data['image/png']) {
      return html`<div part="output" data-output-type=${output.output_type}><img src="data:image/png;base64,${joinText(data['image/png'])}" alt="" /></div>`;
    }
    if (data['image/jpeg']) {
      return html`<div part="output" data-output-type=${output.output_type}><img src="data:image/jpeg;base64,${joinText(data['image/jpeg'])}" alt="" /></div>`;
    }
    if (data['image/svg+xml']) {
      return html`<div part="output" data-output-type=${output.output_type}>${this.renderSanitized(joinText(data['image/svg+xml']), 'svg')}</div>`;
    }
    if (data['text/html']) {
      return html`<div part="output" data-output-type=${output.output_type}>${this.renderSanitized(joinText(data['text/html']), 'html')}</div>`;
    }
    if (data['application/json']) {
      const parsed = typeof data['application/json'] === 'string' ? JSON.parse(joinText(data['application/json'])) : data['application/json'];
      return html`<div part="output" data-output-type=${output.output_type}><lyra-json-viewer .data=${parsed} collapsed-depth="1"></lyra-json-viewer></div>`;
    }
    if (data['text/plain']) return this.renderTextOutput(key, joinText(data['text/plain']));
    return html`<div part="output" data-output-type=${output.output_type}>${this.localize('notebookViewerUnrenderedOutput')}</div>`;
  }

  /** Cache of already-sanitized SVG/HTML output markup, keyed by `profile:rawMarkup` -- `undefined`
   *  means "not requested yet", `null` means "sanitizer peer unavailable" (missing-peer notice),
   *  otherwise the sanitized string. Sanitizing is async (`loadNotebookSanitizer()` lazy-loads the
   *  `dompurify` peer), which can't resolve inside a synchronous `render()` pass -- `renderSanitized()`
   *  kicks off the async work on first render and repaints via `requestUpdate()` once it resolves. */
  private sanitizedOutputCache = new Map<string, string | null>();

  private async ensureSanitized(raw: string, profile: 'svg' | 'html'): Promise<void> {
    const cacheKey = `${profile}:${raw}`;
    if (this.sanitizedOutputCache.has(cacheKey)) return;
    const sanitizer = await loadNotebookSanitizer();
    if (!this.isConnected) return;
    const clean = sanitizer
      ? profile === 'svg'
        ? (sanitizer.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } }) as string)
        : (sanitizer.sanitize(raw) as string)
      : null;
    this.sanitizedOutputCache.set(cacheKey, clean);
    this.requestUpdate();
  }

  private renderSanitized(raw: string, profile: 'svg' | 'html'): TemplateResult {
    const cacheKey = `${profile}:${raw}`;
    const cached = this.sanitizedOutputCache.get(cacheKey);
    if (cached === undefined) {
      void this.ensureSanitized(raw, profile);
      return html`<span class="sr-only">${this.localize('loadingDocument')}</span>`;
    }
    if (cached === null) return html`<p>${this.localize('documentViewerMissingSanitizer')}</p>`;
    return profile === 'svg' ? html`${unsafeSVG(cached)}` : html`${unsafeHTML(cached)}`;
  }

  private renderCell = (cell: unknown, index: number): TemplateResult => {
    const c = cell as NotebookCell;
    const inCount = c.execution_count == null
      ? this.localize('notebookViewerInPromptEmpty')
      : this.localize('notebookViewerInPrompt', undefined, { count: c.execution_count });
    const rowLabel = c.cell_type === 'code'
      ? this.localize('notebookViewerCodeCell', undefined, { index: index + 1 })
      : c.cell_type === 'markdown'
        ? this.localize('notebookViewerMarkdownCell', undefined, { index: index + 1 })
        : this.localize('notebookViewerRawCell', undefined, { index: index + 1 });
    return html`<div part="cell" role="group" aria-label=${rowLabel} data-cell-type=${c.cell_type} ?data-active=${this.activeCellIndex === index}>
      <div part="cell-gutter">${c.cell_type === 'code' ? inCount : ''}</div>
      <div part="cell-source">
        ${c.cell_type === 'markdown'
          ? html`<lyra-markdown .content=${joinSource(c.source)} escape-html sanitize></lyra-markdown>`
          : c.cell_type === 'code'
            ? html`<lyra-code-block .code=${joinSource(c.source)} language=${this.notebookLanguage()} line-numbers></lyra-code-block>`
            : html`<pre>${joinSource(c.source)}</pre>`}
        ${c.cell_type === 'code' && c.outputs?.length
          ? html`<div part="outputs">${c.outputs.map((o, i) => this.renderOutput(index, o, i))}</div>`
          : nothing}
      </div>
    </div>`;
  };

  private notebookLanguage(): string {
    return this.loadState.kind === 'loaded'
      ? (this.loadState.doc.metadata?.language_info?.name ?? this.loadState.doc.metadata?.kernelspec?.language ?? '')
      : '';
  }

  render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('notebookViewerLabel');
    return html`<div
      part="base"
      style=${this.maxHeight ? `--lyra-notebook-viewer-max-height:${this.maxHeight}` : nothing}
      aria-label=${label}
      aria-busy=${this.loadState.kind === 'loading' ? 'true' : 'false'}
    >
      ${this.loadState.kind === 'loaded'
        ? html`<lyra-virtual-list
            .items=${this.loadState.doc.cells}
            .renderItem=${this.renderCell}
            .keyFunction=${(item: unknown, i: number) => (item as NotebookCell).id ?? i}
            .activeId=${this.activeCellIndex ?? ''}
          ></lyra-virtual-list>`
        : this.loadState.kind === 'loading'
          ? html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`
          : this.loadState.kind === 'error'
            ? html`<div part="error" role="alert">${this.loadState.message}</div>`
            : html`<p>${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`}
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-notebook-viewer': LyraNotebookViewer;
  }
}
