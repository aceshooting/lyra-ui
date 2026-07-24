import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../../internal/anchor-target.js';
import type { LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { createAnsiParser, type AnsiStyles } from '../../../internal/ansi.js';
import { loadNotebookSanitizer } from './dompurify-loader.js';
import { styles } from './notebook-viewer.styles.js';

const MAX_CELLS = 2000;
const MAX_OUTPUTS = 20_000;
const MAX_JSON_NODES = 100_000;
const SUPPORTED_MAJOR = 4;
const SUPPORTED_MINORS = [0, 1, 2, 3, 4, 5];

interface NotebookOutput {
  output_type: 'stream' | 'error' | 'display_data' | 'execute_result';
  name?: 'stdout' | 'stderr';
  text?: string | string[];
  ename?: string;
  evalue?: string;
  traceback?: string[];
  data?: Record<string, unknown>;
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

function isDenseArray(value: unknown[]): boolean {
  for (let index = 0; index < value.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function joinText(text: unknown): string {
  if (typeof text === 'string') return text;
  return Array.isArray(text) && isDenseArray(text) && text.every((item) => typeof item === 'string')
    ? text.join('')
    : '';
}

function isTextValue(value: unknown): value is string | string[] {
  return typeof value === 'string' ||
    (Array.isArray(value) && isDenseArray(value) && value.every((item) => typeof item === 'string'));
}

function isJsonValue(value: unknown): boolean {
  const pending: unknown[] = [value];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop();
    if (++nodes > MAX_JSON_NODES) return false;
    if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) return false;
      continue;
    }
    if (Array.isArray(current)) {
      if (current.length > MAX_JSON_NODES - nodes - pending.length) return false;
      for (let index = current.length - 1; index >= 0; index--) pending.push(current[index]);
      continue;
    }
    if (typeof current !== 'object') return false;
    for (const key in current) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
      if (pending.length >= MAX_JSON_NODES - nodes) return false;
      pending.push((current as Record<string, unknown>)[key]);
    }
  }
  return true;
}

function isNotebookOutput(value: unknown): value is NotebookOutput {
  if (typeof value !== 'object' || value === null) return false;
  const output = value as Record<string, unknown>;
  if (!['stream', 'error', 'display_data', 'execute_result'].includes(String(output['output_type']))) return false;
  if (output['text'] !== undefined && !isTextValue(output['text'])) return false;
  if (output['traceback'] !== undefined && !isTextValue(output['traceback'])) return false;
  if (output['ename'] !== undefined && typeof output['ename'] !== 'string') return false;
  if (output['evalue'] !== undefined && typeof output['evalue'] !== 'string') return false;
  if (output['name'] !== undefined && output['name'] !== 'stdout' && output['name'] !== 'stderr') return false;
  const data = output['data'];
  if (data === undefined) return true;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const mimeData = data as Record<string, unknown>;
  for (const [mime, payload] of Object.entries(mimeData)) {
    if (mime === 'application/json') {
      if (typeof payload === 'string') {
        try {
          if (!isJsonValue(JSON.parse(payload))) return false;
        } catch {
          return false;
        }
      } else if (!isJsonValue(payload)) return false;
    } else if (!isTextValue(payload) && !isJsonValue(payload)) {
      return false;
    }
  }
  return true;
}

function isNotebookShape(value: unknown): value is NotebookDoc {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Number.isInteger(v['nbformat']) || !Number.isInteger(v['nbformat_minor']) || !Array.isArray(v['cells'])) return false;
  const cells = v['cells'];
  let outputCount = 0;
  for (let index = 0; index < cells.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(cells, index)) return false;
    const value = cells[index];
    if (typeof value !== 'object' || value === null) return false;
    const cell = value as Record<string, unknown>;
    if (!['markdown', 'code', 'raw'].includes(String(cell['cell_type']))) return false;
    if (!isTextValue(cell['source'])) return false;
    if (cell['id'] !== undefined && typeof cell['id'] !== 'string') return false;
    if (cell['execution_count'] !== undefined && cell['execution_count'] !== null &&
        (!Number.isInteger(cell['execution_count']) || (cell['execution_count'] as number) < 0)) return false;
    if (cell['outputs'] === undefined) continue;
    if (!Array.isArray(cell['outputs'])) return false;
    if (!isDenseArray(cell['outputs'])) return false;
    outputCount += cell['outputs'].length;
    if (outputCount > MAX_OUTPUTS || !cell['outputs'].every(isNotebookOutput)) return false;
  }
  return true;
}

type NotebookState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; doc: NotebookDoc }
  | { kind: 'error'; message: string };

/** Which DOMPurify profile to sanitize an embedded output under -- `svg` output enables the
 *  `svg`/`svgFilters` profiles, `html` uses DOMPurify's default profile. */
type SanitizeProfile = 'svg' | 'html';

export interface LyraNotebookViewerEventMap {
  'lr-load': CustomEvent<{ cellCount: number; language: string }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * `<lr-notebook-viewer>` — read-only Jupyter notebook (nbformat 4.x) renderer, composing existing
 * components per cell. Execution is a hard non-goal.
 *
 * Markdown cells render through `<lr-markdown>`, code cells through `<lr-code-block>` (using the
 * notebook's kernel language for syntax highlighting), and raw cells as plain preformatted text. A
 * code cell's `execute_result`/`display_data` outputs prefer, in order, `image/png`, `image/jpeg`,
 * `image/svg+xml` (sanitized), `text/html` (sanitized), `application/json` (via `<lr-json-viewer>`),
 * then `text/plain`. Stream/error outputs (tinted `danger` for stderr/tracebacks) interpret embedded
 * ANSI SGR color/style escapes via the shared `internal/ansi.ts` parser, same as `<lr-terminal>`.
 * Sanitizing raw HTML/SVG
 * output markup lazy-loads the optional peer dependency `dompurify` via `dompurify-loader.ts`; when
 * that peer isn't installed, the output renders a localized notice instead of raw markup.
 *
 * Cells are virtualized through `<lr-virtual-list>` so a notebook with many cells stays cheap to
 * scroll. `node-path` anchors resolve `path[0]` as a cell index; `fragment` anchors resolve a cell's
 * own `id`.
 *
 * @customElement lr-notebook-viewer
 * @event lr-load - Fired once a notebook has been parsed and validated. `detail: { cellCount,
 *   language }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @event lr-render-error - Fired when fetching, parsing, or validating the notebook fails.
 *   `detail: { error }`.
 * @csspart base - The root scroll container.
 * @csspart cell - One cell row (`data-cell-type`, `data-active`).
 * @csspart cell-active - Added alongside `cell` on the cell currently targeted by an anchor or the
 *   active search match. A second part name rather than an attribute selector, because Shadow Parts
 *   forbids an attribute selector after `::part()`.
 * @csspart cell-gutter - The `In [n]`/`Out [n]` label column.
 * @csspart cell-source - A cell's source content.
 * @csspart raw-source - A horizontally scrollable raw-cell source surface.
 * @csspart outputs - The wrapper around a code cell's outputs.
 * @csspart output - One output (`data-output-type`, `data-stream`).
 * @csspart output-error - Added alongside `output` on a stderr stream or an error output.
 * @csspart error-output-label - The label introducing an error output's traceback.
 * @csspart output-toggle - Expands/collapses a long text output.
 * @csspart error - The error region.
 * @csspart spinner - The loading status region.
 * @cssprop [--lr-notebook-viewer-max-height=none] - Maximum block size of the scrollable body
 *   before it scrolls internally. Also settable via the `max-height` property.
 * @cssprop [--lr-notebook-viewer-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `[part="cell"]` currently targeted by an anchor or the active search match.
 */
export class LyraNotebookViewer extends DocumentAnchorTarget(LyraElement) {
  static override styles = [LyraElement.styles, styles, srOnly];

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
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['node-path', 'fragment'];

  @state() private loadState: NotebookState = { kind: 'idle' };
  @state() private expandedOutputs = new Set<number>();
  @state() private activeCellIndex: number | null = null;
  @state() private searchQuery = '';
  @state() private searchMatches: number[] = [];
  @state() private activeSearchIndex = -1;
  @query('lr-virtual-list') private virtualListEl?: HTMLElement & {
    scrollToIndex(index: number, options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }): void;
  };

  private generation = 0;
  private sanitizerGeneration = 0;
  private sanitizerFailureReported = false;

  /** `outputCollapseLines`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `40`) -- a raw `NaN` (e.g. an invalid `output-collapse-lines`
   *  attribute) would otherwise make `lines.length > outputCollapseLines` always false, silently
   *  disabling collapsing instead of falling back to the default threshold. */
  private get effectiveOutputCollapseLines(): number {
    return finiteCount(this.outputCollapseLines, 40);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src') && !this._notebook) this.scheduleAfterUpdate(() => { void this.loadFromSrc(); });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.src && this._notebook === undefined) {
      this.scheduleAfterUpdate(() => { void this.loadFromSrc(); });
    }
    if (this.hasUpdated && this._notebook !== undefined && this.loadState.kind === 'loaded') {
      // Disconnect invalidates and clears every in-flight/cached sanitizer result. A pure DOM move
      // schedules no Lit update of its own, so explicitly repaint the retained inline document to
      // let each still-visible HTML/SVG output enqueue fresh sanitization work.
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.sanitizerGeneration++;
    this.beginAbortableLoad();
    this.sanitizedOutputCache.clear();
    this.sanitizationTasks.clear();
    this.sanitizerFailureReported = false;
    if (this._notebook === undefined) this.loadState = { kind: 'idle' };
    super.disconnectedCallback();
  }

  private parseInline(): void {
    if (this._notebook === undefined) return;
    const generation = ++this.generation;
    try {
      const raw = typeof this._notebook === 'string' ? JSON.parse(this._notebook) : this._notebook;
      this.setDoc(raw, generation);
    } catch (error) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerInvalid') };
      this.emit('lr-render-error', { error });
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
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.loadState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
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
      this.emit('lr-render-error', { error });
    }
  }

  private setDoc(raw: unknown, generation: number): void {
    if (generation !== this.generation) return;
    if (!isNotebookShape(raw)) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerInvalid') };
      this.emit('lr-render-error', { error: new Error('invalid notebook shape') });
      return;
    }
    if (raw.nbformat !== SUPPORTED_MAJOR || !SUPPORTED_MINORS.includes(raw.nbformat_minor)) {
      this.loadState = {
        kind: 'error',
        message: this.localize('notebookViewerUnsupportedVersion', undefined, { version: `${raw.nbformat}.${raw.nbformat_minor}` }),
      };
      this.emit('lr-render-error', { error: new Error('unsupported nbformat version') });
      return;
    }
    if (raw.cells.length > MAX_CELLS) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerTooManyCells') };
      this.emit('lr-render-error', { error: new Error('too many cells') });
      return;
    }
    this.sanitizerGeneration++;
    this.sanitizedOutputCache.clear();
    this.sanitizationTasks.clear();
    this.sanitizerFailureReported = false;
    this.expandedOutputs = new Set();
    this.clearSearchState();
    this.loadState = { kind: 'loaded', doc: raw };
    const language = raw.metadata?.language_info?.name ?? raw.metadata?.kernelspec?.language ?? '';
    this.emit('lr-load', { cellCount: raw.cells.length, language });
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
   *  `lr-search-change`. */
  async search(query: string): Promise<number> {
    const q = query.trim().toLocaleLowerCase(this.effectiveLocale);
    this.searchQuery = query;
    if (this.loadState.kind !== 'loaded' || !q) {
      this.searchMatches = [];
    } else {
      this.searchMatches = this.loadState.doc.cells.reduce<number[]>((acc, cell, i) => {
        const source = joinSource(cell.source).toLocaleLowerCase(this.effectiveLocale);
        const outputText = (cell.outputs ?? [])
          .map((o) => joinText(o.text) + Object.values(o.data ?? {}).map(joinText).join(''))
          .join(' ')
          .toLocaleLowerCase(this.effectiveLocale);
        if (source.includes(q) || outputText.includes(q)) acc.push(i);
        return acc;
      }, []);
    }
    this.activeSearchIndex = this.searchMatches.length ? 0 : -1;
    this.activateSearchMatch();
    this.emitSearchChange();
    return this.searchMatches.length;
  }

  searchNext(): void {
    if (!this.searchMatches.length) return;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchMatches.length;
    this.activateSearchMatch();
    this.emitSearchChange();
  }

  searchPrevious(): void {
    if (!this.searchMatches.length) return;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.activateSearchMatch();
    this.emitSearchChange();
  }

  clearSearch(): void {
    this.clearSearchState();
    this.emitSearchChange();
  }

  private clearSearchState(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.activeSearchIndex = -1;
  }

  private activateSearchMatch(): void {
    const index = this.searchMatches[this.activeSearchIndex];
    if (index === undefined) return;
    this.activeCellIndex = index;
    this.scheduleAfterUpdate(() => {
      this.virtualListEl?.scrollToIndex(index, {
        align: 'auto',
        behavior: 'auto',
      });
    });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', { query: this.searchQuery, matchCount: this.searchMatches.length, activeIndex: this.activeSearchIndex });
  }

  private toggleOutput(index: number): void {
    const next = new Set(this.expandedOutputs);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.expandedOutputs = next;
  }

  /** Feeds `text` through a fresh, one-shot ANSI parser (this is always a complete, already-final
   *  string -- never a live stream chunk -- so there is no parser state to persist across renders,
   *  unlike `<lr-terminal>`'s incremental `push()` usage) and renders the resulting segments as
   *  styled spans, same color/style token mapping `<lr-terminal>` uses. */
  private renderAnsiText(text: string): TemplateResult {
    const segments = createAnsiParser().push(text);
    return html`${segments.map((seg) => html`<span style=${styleMap(this.segmentStyle(seg.styles))}>${seg.text}</span>`)}`;
  }

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

  private renderTextOutput(index: number, text: string, tone?: 'danger'): TemplateResult {
    const lines = text.split('\n');
    const outputCollapseLines = this.effectiveOutputCollapseLines;
    const collapsible = outputCollapseLines > 0 && lines.length > outputCollapseLines;
    const expanded = this.expandedOutputs.has(index) || !collapsible;
    const shown = expanded ? text : lines.slice(0, outputCollapseLines).join('\n');
    const part = tone === 'danger' ? 'output output-error' : 'output';
    return html`<div part=${part} data-output-type="stream" data-stream=${tone === 'danger' ? 'stderr' : 'stdout'}
      >${this.renderAnsiText(shown)}${collapsible
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
      // The localized label sits in its own block element rather than being
      // string-joined onto the traceback, so the label's position relative to
      // the data never depends on the sentence order of any one language.
      return html`<div part="output output-error" data-output-type="error"
        ><span part="error-output-label">${this.localize('notebookViewerErrorOutput')}</span>${this.renderAnsiText(text)}</div
      >`;
    }
    const data = output.data ?? {};
    if (data['image/png']) {
      return html`<div part="output" data-output-type=${output.output_type}><img src="data:image/png;base64,${joinText(data['image/png'])}" alt=${joinText(data['text/plain'])} /></div>`;
    }
    if (data['image/jpeg']) {
      return html`<div part="output" data-output-type=${output.output_type}><img src="data:image/jpeg;base64,${joinText(data['image/jpeg'])}" alt=${joinText(data['text/plain'])} /></div>`;
    }
    if (data['image/svg+xml']) {
      return html`<div part="output" data-output-type=${output.output_type}>${this.renderSanitized(joinText(data['image/svg+xml']), 'svg', key, joinText(data['text/plain']))}</div>`;
    }
    if (data['text/html']) {
      return html`<div part="output" data-output-type=${output.output_type}>${this.renderSanitized(joinText(data['text/html']), 'html', key, joinText(data['text/plain']))}</div>`;
    }
    if (data['application/json']) {
      const parsed = typeof data['application/json'] === 'string' ? JSON.parse(joinText(data['application/json'])) : data['application/json'];
      return html`<div part="output" data-output-type=${output.output_type}><lr-json-viewer .data=${parsed} collapsed-depth="1"></lr-json-viewer></div>`;
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
  private sanitizationTasks = new Map<string, Promise<void>>();

  private async ensureSanitized(raw: string, profile: SanitizeProfile): Promise<void> {
    const cacheKey = `${profile}:${raw}`;
    if (this.sanitizedOutputCache.has(cacheKey)) return;
    const existing = this.sanitizationTasks.get(cacheKey);
    if (existing) return existing;
    const generation = this.sanitizerGeneration;
    const task = (async () => {
      try {
        const sanitizer = await loadNotebookSanitizer();
        if (!this.isConnected || generation !== this.sanitizerGeneration) return;
        const clean = sanitizer
          ? profile === 'svg'
            ? (sanitizer.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } }) as string)
            : (sanitizer.sanitize(raw) as string)
          : null;
        if (!this.isConnected || generation !== this.sanitizerGeneration) return;
        if (!sanitizer && !this.sanitizerFailureReported) {
          this.sanitizerFailureReported = true;
          this.emit('lr-render-error', {
            error: new LyraUserFacingError(this.localize('documentViewerMissingSanitizer')),
          });
        }
        this.sanitizedOutputCache.set(cacheKey, clean);
        this.requestUpdate();
      } catch (error) {
        if (!this.isConnected || generation !== this.sanitizerGeneration) return;
        this.sanitizedOutputCache.set(cacheKey, null);
        this.emit('lr-render-error', { error });
        this.requestUpdate();
      } finally {
        if (generation === this.sanitizerGeneration) this.sanitizationTasks.delete(cacheKey);
      }
    })();
    this.sanitizationTasks.set(cacheKey, task);
    return task;
  }

  private renderSanitized(
    raw: string,
    profile: SanitizeProfile,
    outputKey: number,
    textFallback: string,
  ): TemplateResult {
    const cacheKey = `${profile}:${raw}`;
    const cached = this.sanitizedOutputCache.get(cacheKey);
    if (cached === undefined) {
      void this.ensureSanitized(raw, profile);
      return html`<span class="sr-only">${this.localize('loadingDocument')}</span>`;
    }
    if (cached === null) {
      return textFallback
        ? this.renderTextOutput(outputKey, textFallback)
        : html`<p>${this.localize('documentViewerMissingSanitizer')}</p>`;
    }
    return profile === 'svg' ? html`${unsafeSVG(cached)}` : html`${unsafeHTML(cached)}`;
  }

  private renderCell = (cell: unknown, index: number): TemplateResult => {
    const c = cell as NotebookCell;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const inCount = c.execution_count == null
      ? this.localize('notebookViewerInPromptEmpty')
      : this.localize('notebookViewerInPrompt', undefined, { count: numberFormat.format(c.execution_count) });
    const rowLabel = c.cell_type === 'code'
      ? this.localize('notebookViewerCodeCell', undefined, { index: numberFormat.format(index + 1) })
      : c.cell_type === 'markdown'
        ? this.localize('notebookViewerMarkdownCell', undefined, { index: numberFormat.format(index + 1) })
        : this.localize('notebookViewerRawCell', undefined, { index: numberFormat.format(index + 1) });
    const active = this.activeCellIndex === index;
    const part = active ? 'cell cell-active' : 'cell';
    return html`<div part=${part} role="group" aria-label=${rowLabel} data-cell-type=${c.cell_type} ?data-active=${active}>
      <div part="cell-gutter">${c.cell_type === 'code' ? inCount : ''}</div>
      <div part="cell-source">
        ${c.cell_type === 'markdown'
          ? html`<lr-markdown .content=${joinSource(c.source)} escape-html sanitize></lr-markdown>`
          : c.cell_type === 'code'
            ? html`<lr-code-block .code=${joinSource(c.source)} language=${this.notebookLanguage()} line-numbers></lr-code-block>`
            : html`<pre part="raw-source" tabindex="0">${joinSource(c.source)}</pre>`}
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

  private stopVirtualListEvent(event: Event): void {
    event.stopPropagation();
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('notebookViewerLabel');
    return html`<div
      part="base"
      style=${this.maxHeight ? `--lr-notebook-viewer-max-height:${this.maxHeight}` : nothing}
      role="region"
      aria-label=${label}
      aria-busy=${this.loadState.kind === 'loading' ? 'true' : 'false'}
    >
      ${this.loadState.kind === 'loaded'
        ? html`<lr-virtual-list
            exportparts="cell:cell, cell-active:cell-active, cell-gutter:cell-gutter, cell-source:cell-source, raw-source:raw-source, outputs:outputs, output:output, output-error:output-error, error-output-label:error-output-label, output-toggle:output-toggle"
            .items=${this.loadState.doc.cells}
            .renderItem=${this.renderCell}
            .keyFunction=${(item: unknown, i: number) => (item as NotebookCell).id ?? i}
            .activeId=${this.activeCellIndex ?? ''}
            @lr-visible-range-changed=${this.stopVirtualListEvent}
          ></lr-virtual-list>`
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
    'lr-notebook-viewer': LyraNotebookViewer;
  }
}
