import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { DocumentAnchorTarget } from '../../../internal/anchor-target.js';
import type { AnchorResultDetail, LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { createAnsiParser, type AnsiStyles } from '../../../internal/ansi.js';
import { loadNotebookSanitizer } from './dompurify-loader.js';
import { styles } from './notebook-viewer.styles.js';
import { sanitizeCssColor, sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { sanitizePassiveMarkup } from '../passive-markup.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { resolveViewerSource, type LyraViewerSource } from '../viewer-source.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_documentViewerMissingSanitizer, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_notebookViewerCodeCell, LYRA_DEFAULT_notebookViewerCollapseOutput, LYRA_DEFAULT_notebookViewerErrorOutput, LYRA_DEFAULT_notebookViewerInPrompt, LYRA_DEFAULT_notebookViewerInPromptEmpty, LYRA_DEFAULT_notebookViewerInvalid, LYRA_DEFAULT_notebookViewerLabel, LYRA_DEFAULT_notebookViewerMarkdownCell, LYRA_DEFAULT_notebookViewerRawCell, LYRA_DEFAULT_notebookViewerShowAllOutput, LYRA_DEFAULT_notebookViewerTooManyCells, LYRA_DEFAULT_notebookViewerUnrenderedOutput, LYRA_DEFAULT_notebookViewerUnsupportedVersion } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_CELLS = 2000;
const MAX_OUTPUTS = 20_000;
const MAX_JSON_NODES = 100_000;
const SUPPORTED_MAJOR = 4;
const SUPPORTED_MINORS = [0, 1, 2, 3, 4, 5];

interface NotebookOutput {
  readonly output_type: 'stream' | 'error' | 'display_data' | 'execute_result';
  readonly name?: 'stdout' | 'stderr';
  readonly text?: string | readonly string[];
  readonly ename?: string;
  readonly evalue?: string;
  readonly traceback?: readonly string[];
  readonly data?: Readonly<Record<string, unknown>>;
}
interface NotebookCell {
  readonly cell_type: 'markdown' | 'code' | 'raw';
  readonly id?: string;
  readonly source: string | readonly string[];
  readonly execution_count?: number | null;
  readonly outputs?: readonly NotebookOutput[];
  readonly metadata?: Readonly<{ language_info?: unknown }>;
}
interface NotebookDoc {
  readonly nbformat: number;
  readonly nbformat_minor: number;
  readonly cells: readonly NotebookCell[];
  readonly metadata?: Readonly<{
    language_info?: Readonly<{ name?: string }>;
    kernelspec?: Readonly<{ language?: string }>;
  }>;
}

const OMIT_NOTEBOOK_SNAPSHOT = Symbol('omit-notebook-snapshot');

function invalidNotebookSnapshot(): NotebookDoc {
  return Object.freeze({}) as NotebookDoc;
}

interface NotebookSnapshotTask {
  readonly source: object;
  readonly target: unknown[] | Record<string, unknown>;
  readonly keys: readonly string[];
  readonly array: boolean;
}

/** Custom-prototype JSON records are valid notebook payloads, but class/platform instances are
 * not. Admit an ordinary/null-prototype record or one data-only prototype layer; the prototype's
 * keys are never enumerated or copied. */
function isNotebookDataRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const parent = Object.getPrototypeOf(prototype);
    const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    if (parent === null) {
      return !constructor || (
        'value' in constructor &&
        typeof constructor.value === 'function' &&
        constructor.value.name === 'Object'
      );
    }
    if (constructor) return false;
    const parentConstructor = Object.getOwnPropertyDescriptor(parent, 'constructor');
    return Boolean(
      Object.getPrototypeOf(parent) === null &&
      parentConstructor &&
      'value' in parentConstructor &&
      typeof parentConstructor.value === 'function' &&
      parentConstructor.value.name === 'Object'
    );
  } catch {
    return false;
  }
}

/** Notebook assignments need their own schema-domain budget: unlike the generic public collection
 * boundary, nbformat explicitly permits custom-prototype JSON records and validates up to 100,000
 * JSON nodes. Reflection stays local to this opt-in boundary; values are read only from own data
 * descriptors, traversal is iterative, repeated object references fail atomically, and every
 * admitted container is frozen before the setter publishes it. */
function snapshotNotebookDocument(value: unknown): NotebookDoc | typeof OMIT_NOTEBOOK_SNAPSHOT {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return OMIT_NOTEBOOK_SNAPSHOT;

  let remaining = MAX_JSON_NODES;
  const seen = new WeakSet<object>();
  const created: Array<unknown[] | Record<string, unknown>> = [];
  const pending: NotebookSnapshotTask[] = [];

  const createContainer = (
    source: object
  ): unknown[] | Record<string, unknown> | typeof OMIT_NOTEBOOK_SNAPSHOT => {
    let array = false;
    try {
      array = Array.isArray(source);
    } catch {
      return OMIT_NOTEBOOK_SNAPSHOT;
    }
    let keys: string[];
    let target: unknown[] | Record<string, unknown>;
    if (array) {
      let lengthDescriptor: PropertyDescriptor | undefined;
      try {
        lengthDescriptor = Object.getOwnPropertyDescriptor(source, 'length');
      } catch {
        return OMIT_NOTEBOOK_SNAPSHOT;
      }
      if (
        !lengthDescriptor ||
        !('value' in lengthDescriptor) ||
        typeof lengthDescriptor.value !== 'number' ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > remaining
      )
        return OMIT_NOTEBOOK_SNAPSHOT;
      keys = Array.from({ length: lengthDescriptor.value }, (_, index) => String(index));
      target = new Array(lengthDescriptor.value) as unknown[];
    } else {
      if (!isNotebookDataRecord(source)) return OMIT_NOTEBOOK_SNAPSHOT;
      try {
        // Own-key reflection is intentionally confined to this notebook-specific boundary. The
        // generic LyraElement snapshot rejects custom prototypes because no incremental own-key
        // reflection API exists; nbformat's 100k domain budget governs the resulting projection.
        keys = Object.keys(source);
      } catch {
        return OMIT_NOTEBOOK_SNAPSHOT;
      }
      if (keys.length > remaining) return OMIT_NOTEBOOK_SNAPSHOT;
      target = {};
    }
    seen.add(source);
    created.push(target);
    pending.push({ source, target, keys, array });
    return target;
  };

  remaining -= 1;
  const root = createContainer(value);
  if (root === OMIT_NOTEBOOK_SNAPSHOT) return root;

  while (pending.length) {
    const task = pending.pop()!;
    for (const key of task.keys) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(task.source, key);
      } catch {
        return OMIT_NOTEBOOK_SNAPSHOT;
      }
      if (!descriptor) {
        if (task.array) continue;
        return OMIT_NOTEBOOK_SNAPSHOT;
      }
      if (!descriptor.enumerable || !('value' in descriptor))
        return OMIT_NOTEBOOK_SNAPSHOT;
      if (remaining <= 0) return OMIT_NOTEBOOK_SNAPSHOT;
      remaining -= 1;
      const entry = descriptor.value as unknown;
      let snapshot = entry;
      if (entry !== null && (typeof entry === 'object' || typeof entry === 'function')) {
        if (typeof entry === 'function' || seen.has(entry))
          return OMIT_NOTEBOOK_SNAPSHOT;
        snapshot = createContainer(entry);
        if (snapshot === OMIT_NOTEBOOK_SNAPSHOT) return snapshot;
      }
      Object.defineProperty(task.target, key, {
        value: snapshot,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }

  for (let index = created.length - 1; index >= 0; index -= 1)
    Object.freeze(created[index]!);
  return root as unknown as NotebookDoc;
}

function joinSource(source: string | readonly string[] | undefined): string {
  return typeof source === 'string' ? source : (source?.join('') ?? '');
}

function isDenseArray(value: readonly unknown[]): boolean {
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

function* notebookSearchTextParts(text: unknown): Generator<string> {
  if (typeof text === 'string') {
    yield text;
    return;
  }
  if (!Array.isArray(text) || !isDenseArray(text)) return;
  for (const part of text) if (typeof part === 'string') yield part;
}

function* notebookOutputSearchParts(outputs: readonly NotebookOutput[]): Generator<string> {
  for (const output of outputs) {
    yield* notebookSearchTextParts(output.text);
    const data = output.data;
    if (data) {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          yield* notebookSearchTextParts(data[key]);
        }
      }
    }
    yield ' ';
  }
}

function isTextValue(value: unknown): value is string | readonly string[] {
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

/** Effective source authority. Inline values win by presence (including an empty string); clearing
 *  them returns authority to the already configured URL without requiring a `src` reassignment. */
export type LyraNotebookViewerSource = LyraViewerSource<NotebookDoc | string>;

export interface LyraNotebookViewerEventMap {
  'lr-load': CustomEvent<{ cellCount: number; language: string }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
}

// Same one-line base every other `DocumentAnchorTarget()` adopter uses: the mixin takes a
// constructor, so the event map has to be bound before it is applied -- otherwise this component
// keeps `LyraElement`'s permissive default and its own `emit()` calls go unchecked.
class LyraNotebookViewerBase extends LyraElement<LyraNotebookViewerEventMap> {}

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
 * `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()` follow the shared viewer search
 * contract (`internal/text-viewer-target.ts`'s `LyraTextViewerTarget`): `search()` resolves the
 * match count and the two navigation methods resolve `true` once the active match moved, `false`
 * when there is nothing to move to. A find-in-page host can therefore drive this viewer through the
 * same typed surface as every other one.
 *
 * Parsed `notebook` assignments are synchronously clone-owned and recursively frozen. Mutate a
 * copy and reassign it to update the viewer; later changes to the source object are not observed.
 *
 * @customElement lr-notebook-viewer
 * @event lr-load - Fired once a notebook has been parsed and validated. `detail: { cellCount,
 *   language }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Notebook validation caps the corpus at 2,000
 *   cells and search retains at most one match per cell. Search accepts at most 4,096 query code
 *   units and scans at most 4,000,000 source/output code units; a false `matchCountExact` makes the
 *   returned count a lower bound after either ceiling is reached.
 * @event lr-render-error - Fired when fetching, parsing, or validating the notebook fails.
 *   `detail: { error }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. Non-cancelable. `detail: { found }`.
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
 * @csspart spinner - Visible ordinary loading content with a motion-safe progress indicator.
 * @cssprop [--lr-notebook-viewer-max-height=none] - Maximum block size of the scrollable body
 *   before it scrolls internally. Also settable via the `max-height` property.
 * @cssprop [--lr-notebook-viewer-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `[part="cell"]` currently targeted by an anchor or the active search match.
 * @status stable
 * @since 4.0.0
 */
export class LyraNotebookViewer extends DocumentAnchorTarget(LyraNotebookViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    documentViewerMissingSanitizer: LYRA_DEFAULT_documentViewerMissingSanitizer,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    notebookViewerCodeCell: LYRA_DEFAULT_notebookViewerCodeCell,
    notebookViewerCollapseOutput: LYRA_DEFAULT_notebookViewerCollapseOutput,
    notebookViewerErrorOutput: LYRA_DEFAULT_notebookViewerErrorOutput,
    notebookViewerInPrompt: LYRA_DEFAULT_notebookViewerInPrompt,
    notebookViewerInPromptEmpty: LYRA_DEFAULT_notebookViewerInPromptEmpty,
    notebookViewerInvalid: LYRA_DEFAULT_notebookViewerInvalid,
    notebookViewerLabel: LYRA_DEFAULT_notebookViewerLabel,
    notebookViewerMarkdownCell: LYRA_DEFAULT_notebookViewerMarkdownCell,
    notebookViewerRawCell: LYRA_DEFAULT_notebookViewerRawCell,
    notebookViewerShowAllOutput: LYRA_DEFAULT_notebookViewerShowAllOutput,
    notebookViewerTooManyCells: LYRA_DEFAULT_notebookViewerTooManyCells,
    notebookViewerUnrenderedOutput: LYRA_DEFAULT_notebookViewerUnrenderedOutput,
    notebookViewerUnsupportedVersion: LYRA_DEFAULT_notebookViewerUnsupportedVersion,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'notebook',
  ]);

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly, viewerLoadingStyles];

  /** URL to fetch and parse as a notebook. Ignored while `notebook` is present. */
  @property() src = '';

  /** A parsed notebook document, or its raw JSON text. Presence wins over `src` (including `''`)
   *  and is parsed synchronously. Assigning `undefined` clears inline authority, invalidates its
   *  rendering/sanitization work, and immediately resumes the already configured `src`. */
  @property({ attribute: false })
  get notebook(): NotebookDoc | string | undefined {
    return this._notebook;
  }
  set notebook(value: NotebookDoc | string | undefined) {
    const old = this._notebook;
    const next = typeof value === 'string' || value === undefined
      ? value
      : (() => {
        const snapshot = snapshotNotebookDocument(value);
        return snapshot === OMIT_NOTEBOOK_SNAPSHOT
          ? invalidNotebookSnapshot()
          : snapshot;
      })();
    if (Object.is(old, next)) return;
    this._notebook = next;
    this.requestUpdate('notebook', old);
    if (next === undefined) {
      this.beginSourceTransition(this.src ? 'loading' : 'idle');
      if (this.isConnected) this.scheduleSourceLoad();
    } else {
      this.parseInline();
    }
  }
  private _notebook?: NotebookDoc | string;

  /** Readonly discriminated snapshot of the effective source authority. */
  get source(): LyraNotebookViewerSource {
    return resolveViewerSource(this.src, this._notebook);
  }

  /** Display name used as the viewer's accessible label, and matched against a `fragment` anchor's
   *  cell id. */
  @property() name = '';

  /** A plain-text output longer than this many lines renders collapsed behind a toggle. `0`
   *  disables collapsing. */
  @property({ type: Number, attribute: 'output-collapse-lines' }) outputCollapseLines = 40;

  /** A CSS length (e.g. `"30rem"`); once set, the notebook scrolls internally past this height
   *  instead of growing the page. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['node-path', 'fragment'];

  @state() private loadState: NotebookState = { kind: 'idle' };
  /** Keyed by `${cellIndex}:${outputIndex}` (a colon-separated string, not a packed number) --
   *  `cellIndex * 1000 + outputIndex` would collide once a cell holds >= 1000 outputs (e.g.
   *  cell 0's output 1000 and cell 1's output 0 both reduced to 1000). */
  @state() private expandedOutputs = new Set<string>();
  @state() private activeCellIndex: number | null = null;
  @state() private searchQuery = '';
  @state() private searchMatches: number[] = [];
  private searchMatchCountExact = true;
  @state() private activeSearchIndex = -1;
  @query('lr-virtual-list') private virtualListEl?: HTMLElement & {
    scrollToIndex(index: number, options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }): void;
  };

  private generation = 0;
  private lastSearchLocale = '';
  private sanitizerGeneration = 0;
  private sanitizerFailureReported = false;
  private sourceLoadScheduled = false;
  private readonly announcements = new ViewerAnnouncementController(this);

  /** `outputCollapseLines`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `40`) -- a raw `NaN` (e.g. an invalid `output-collapse-lines`
   *  attribute) would otherwise make `lines.length > outputCollapseLines` always false, silently
   *  disabling collapsing instead of falling back to the default threshold. */
  private get effectiveOutputCollapseLines(): number {
    return finiteCount(this.outputCollapseLines, 40);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.loadState.kind,
      this.loadState.kind === 'error' ? this.loadState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src') && this._notebook === undefined) this.scheduleSourceLoad();
    const locale = this.effectiveLocale;
    if (locale !== this.lastSearchLocale) {
      const shouldRecompute = this.searchQuery !== '';
      this.lastSearchLocale = locale;
      if (shouldRecompute) {
        this.scheduleAfterUpdate(() => {
          void this.search(this.searchQuery);
        }, 'search');
      }
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('src') && this._notebook === undefined) {
      this.beginSourceTransition(this.src ? 'loading' : 'idle');
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src && this._notebook === undefined) {
      this.scheduleSourceLoad();
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
    this.sourceLoadScheduled = false;
    if (this._notebook === undefined) this.loadState = { kind: 'idle' };
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  private parseInline(): void {
    if (this._notebook === undefined) return;
    const generation = ++this.generation;
    this.beginAbortableLoad();
    this.resetParsedState();
    this.loadState = { kind: 'idle' };
    try {
      const raw = typeof this._notebook === 'string' ? JSON.parse(this._notebook) : this._notebook;
      this.setDoc(raw, generation);
    } catch (error) {
      this.loadState = { kind: 'error', message: this.localize('notebookViewerInvalid') };
      this.emit('lr-render-error', { error });
    }
  }

  private resetParsedState(): void {
    const shouldEmitSearchReset = this.searchQuery !== ''
      || this.searchMatches.length > 0
      || !this.searchMatchCountExact
      || this.activeSearchIndex !== -1;
    this.sanitizerGeneration++;
    this.sanitizedOutputCache.clear();
    this.sanitizationTasks.clear();
    this.sanitizerFailureReported = false;
    this.expandedOutputs = new Set();
    this.clearSearchState();
    this.activeCellIndex = null;
    if (shouldEmitSearchReset) this.emitSearchChange();
  }

  private beginSourceTransition(kind: 'idle' | 'loading'): void {
    this.generation++;
    this.beginAbortableLoad();
    this.resetParsedState();
    this.loadState = { kind };
  }

  private scheduleSourceLoad(): void {
    if (this.sourceLoadScheduled) return;
    this.sourceLoadScheduled = true;
    this.scheduleAfterUpdate(() => {
      this.sourceLoadScheduled = false;
      if (this.isConnected && this._notebook === undefined) void this.loadFromSrc();
    });
  }

  private async loadFromSrc(): Promise<void> {
    // Re-checked here (not just by updated()'s scheduling guard) -- this call is deferred via
    // scheduleAfterUpdate(), so a synchronous `notebook` assignment arriving after it was scheduled
    // but before it actually runs must still win; otherwise this stale src-fetch attempt would
    // overwrite the freshly-parsed inline notebook's `loaded` state back to `idle`.
    if (!this.isConnected || this._notebook !== undefined) return;
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.loadState = { kind: 'idle' };
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.loadState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
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
    this.resetParsedState();
    this.loadState = { kind: 'loaded', doc: raw };
    const language = raw.metadata?.language_info?.name ?? raw.metadata?.kernelspec?.language ?? '';
    this.emit('lr-load', { cellCount: raw.cells.length, language });
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.loadState.kind !== 'loaded') return false;
    const cells = this.loadState.doc.cells;
    let index = -1;
    if (anchor.kind === 'node-path' && Number.isInteger(anchor.path[0])) index = anchor.path[0] as number;
    else if (anchor.kind === 'fragment') index = cells.findIndex((c) => c.id === anchor.id);
    else return false;
    if (index < 0 || index >= cells.length) return false;
    this.activeCellIndex = index;
    return true;
  }

  /** Case-insensitive substring search over every accepted cell's joined source text and
   *  text-bearing outputs -- at most one match per cell. Queries are capped at 4,096 code units
   *  and one pass scans at most 4,000,000 source/output code units; `matchCountExact=false`
   *  identifies a truncated lower bound. */
  async search(query: string): Promise<number> {
    const boundedQuery = boundedViewerSearchQuery(query, this.effectiveLocale);
    const q = boundedQuery.needle;
    this.searchQuery = query;
    this.lastSearchLocale = this.effectiveLocale;
    this.searchMatchCountExact = boundedQuery.accepted;
    if (this.loadState.kind !== 'loaded' || !q || !boundedQuery.accepted) {
      this.searchMatches = [];
    } else {
      const budget = new ViewerSearchWorkBudget();
      const matches: number[] = [];
      for (let index = 0; index < this.loadState.doc.cells.length; index++) {
        const cell = this.loadState.doc.cells[index]!;
        const sourceParts = typeof cell.source === 'string' ? [cell.source] : cell.source;
        const sourceMatch = budget.includesJoined(sourceParts, q, this.effectiveLocale);
        const outputMatch = sourceMatch
          ? false
          : budget.includesJoined(notebookOutputSearchParts(cell.outputs ?? []), q, this.effectiveLocale);
        if (sourceMatch || outputMatch) matches.push(index);
        if (!budget.complete) {
          this.searchMatchCountExact = false;
          break;
        }
      }
      this.searchMatches = matches;
    }
    this.activeSearchIndex = this.searchMatches.length ? 0 : -1;
    this.activateSearchMatch();
    this.emitSearchChange();
    return this.searchMatches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `true` once the
   *  active match moved, `false` (no-op) when there are no matches -- the same shape every other
   *  viewer's `searchNext()` resolves, so a find-in-page host can drive them all through the shared
   *  `LyraTextViewerTarget` surface. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchMatches.length;
    this.activateSearchMatch();
    this.emitSearchChange();
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `true` once the
   *  active match moved, `false` (no-op) when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.activateSearchMatch();
    this.emitSearchChange();
    return true;
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.clearSearchState();
    this.emitSearchChange();
  }

  private clearSearchState(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
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
    this.emit('lr-search-change', { query: this.searchQuery, matchCount: this.searchMatches.length, matchCountExact: this.searchMatchCountExact, activeIndex: this.activeSearchIndex });
  }

  private toggleOutput(index: string): void {
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
    const fg = sanitizeCssColor(s.fg) ?? 'var(--lr-color-text)';
    const bg = sanitizeCssColor(s.bg) ?? 'transparent';
    return {
      'font-weight': s.bold ? 'bold' : 'normal',
      opacity: s.dim ? '0.7' : '1',
      'font-style': s.italic ? 'italic' : 'normal',
      'text-decoration': s.underline ? 'underline' : 'none',
      color: s.inverse ? bg : fg,
      'background-color': s.inverse ? fg : bg,
    };
  }

  private renderTextOutput(index: string, text: string, tone?: 'danger'): TemplateResult {
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
    // A colon-separated string, not `cellIndex * 1000 + outputIndex` -- that packed-number scheme
    // collides once a cell holds >= 1000 outputs (cell 0's output 1000 and cell 1's output 0 both
    // reduce to the same numeric key).
    const key = `${cellIndex}:${outputIndex}`;
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
    const mediaName =
      joinText(data['text/plain']) ||
      this.localize('notebookViewerCodeCell', undefined, {
        index: getNumberFormat(this.effectiveLocale).format(cellIndex + 1),
      });
    if (data['image/png']) {
      return html`<div part="output" data-output-type=${output.output_type}><img src="data:image/png;base64,${joinText(data['image/png'])}" alt=${mediaName} /></div>`;
    }
    if (data['image/jpeg']) {
      return html`<div part="output" data-output-type=${output.output_type}><img src="data:image/jpeg;base64,${joinText(data['image/jpeg'])}" alt=${mediaName} /></div>`;
    }
    if (data['image/svg+xml']) {
      // The image role goes on the SANITIZED result only. role="img" makes every descendant
      // presentational, so wrapping the whole renderSanitized() call would bury the loading
      // notice and the peer-missing alert -- and any focusable control inside the text fallback
      // becomes a tab stop that axe reports as `nested-interactive`. Same shape as
      // svg-viewer.class.ts, which names only its `loaded` branch.
      const svg = this.renderSanitized(joinText(data['image/svg+xml']), 'svg', key, joinText(data['text/plain']));
      const named = this.sanitizedOutputCache.get(`svg:${joinText(data['image/svg+xml'])}`);
      return named
        ? html`<div part="output" data-output-type=${output.output_type} role="img" aria-label=${mediaName}>${svg}</div>`
        : html`<div part="output" data-output-type=${output.output_type}>${svg}</div>`;
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
          ? sanitizePassiveMarkup(
              sanitizer,
              raw,
              this.ownerDocument,
              profile === 'svg' ? 'passive-svg' : 'passive-document',
            )
          : null;
        if (!this.isConnected || generation !== this.sanitizerGeneration) return;
        if (!sanitizer && !this.sanitizerFailureReported) {
          this.sanitizerFailureReported = true;
          const message = this.localize('documentViewerMissingSanitizer');
          this.announcements.announceAssertive(message);
          this.emit('lr-render-error', {
            error: new LyraUserFacingError(message),
          });
        }
        this.sanitizedOutputCache.set(cacheKey, clean);
        this.requestUpdate();
      } catch (error) {
        if (!this.isConnected || generation !== this.sanitizerGeneration) return;
        this.sanitizedOutputCache.set(cacheKey, null);
        if (!this.sanitizerFailureReported) {
          this.sanitizerFailureReported = true;
          this.announcements.announceAssertive(this.localize('documentViewerMissingSanitizer'));
        }
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
    outputKey: string,
    textFallback: string,
  ): TemplateResult {
    const cacheKey = `${profile}:${raw}`;
    const cached = this.sanitizedOutputCache.get(cacheKey);
    if (cached === undefined) {
      void this.ensureSanitized(raw, profile);
      return html`<span class="sr-only">${this.localize('loadingDocument')}</span>`;
    }
    if (cached === null) {
      // A failed optional peer must fail closed visibly with localized ordinary text while the
      // transition is announced through the document-level assertive sink. No `part` here on purpose -- these per-output notices
      // render inside <lr-virtual-list>'s shadow root, so the document-level `error` part name
      // would both collide and be unreachable from this component's own stylesheet.
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
          ? html`<lr-markdown .content=${joinSource(c.source)} html-mode="sanitize"></lr-markdown>`
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
    const label = viewerSemanticLabel(this, this.name || this.localize('notebookViewerLabel'));
    return html`<div
      part="base"
      style=${sanitizeCssLength(this.maxHeight)
        ? styleMap({ '--lr-notebook-viewer-max-height': sanitizeCssLength(this.maxHeight)! })
        : nothing}
      role=${viewerSemanticRole(this, 'region') ?? nothing}
      aria-label=${label ?? nothing}
      aria-busy=${this.loadState.kind === 'loading' ? 'true' : 'false'}
    >
      ${this.loadState.kind === 'loaded'
        ? html`<lr-virtual-list
            exportparts="cell:cell, cell-active:cell-active, cell-gutter:cell-gutter, cell-source:cell-source, raw-source:raw-source, outputs:outputs, output:output, output-error:output-error, error-output-label:error-output-label, output-toggle:output-toggle"
            .items=${this.loadState.doc.cells}
            .renderItem=${this.renderCell}
            .keyFunction=${(item: unknown, i: number) => (item as NotebookCell).id ?? i}
            .activeItemId=${this.activeCellIndex ?? ''}
            @lr-visible-range-changed=${this.stopVirtualListEvent}
            @lr-virtual-scroll=${this.stopVirtualListEvent}
          ></lr-virtual-list>`
        : this.loadState.kind === 'loading'
          ? renderViewerLoading(this.localize('loadingDocument'))
          : this.loadState.kind === 'error'
            ? html`<div part="error">${this.loadState.message}</div>`
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
