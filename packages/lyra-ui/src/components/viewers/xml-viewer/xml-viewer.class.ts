import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { DocumentAnchorTarget, prioritizedHighlightCandidates } from '../../../internal/anchor-target.js';
import type {
  AnchorResultDetail,
  HighlightActivateDetail,
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
} from '../document-viewer/anchors.js';
import {
  isAbortError,
  isResourceLimitError,
  readResponseText,
  LyraResourceLimitError,
  LyraUserFacingError,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { chevronIcon } from '../../../internal/icons.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount } from '../../../internal/numbers.js';
import { styles } from './xml-viewer.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { resolveViewerSource, type LyraViewerSource } from '../viewer-source.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_xmlViewerChildCount, LYRA_DEFAULT_xmlViewerCollapseNode, LYRA_DEFAULT_xmlViewerCopyDocument, LYRA_DEFAULT_xmlViewerCopyNode, LYRA_DEFAULT_xmlViewerExpandNode, LYRA_DEFAULT_xmlViewerLabel, LYRA_DEFAULT_xmlViewerParseError, LYRA_DEFAULT_xmlViewerTooManyNodes } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_NODES = 50_000;
const MAX_DEPTH = 256;
const MAX_SEARCH_MATCHES = 10_000;
const MAX_PAINTED_HIGHLIGHTS = 100;

type PathSegment = number | string;

/** Composite key for `attrMatches`/`activeAttr` bookkeeping: an element's own path key plus an
 *  attribute name, joined with a separator that can never appear inside a `JSON.stringify()`'d
 *  path array. */
function attrKey(pathKey: string, attrName: string): string {
  return `${pathKey}\u0000${attrName}`;
}

interface SearchState {
  /** Path key of every node with *any* hit (tag, an attribute, or its own text) -- drives
   *  row-level highlighting and is what `ordered`/`searchNext()`/`searchPrevious()` navigate. */
  matches: Set<string>;
  tagMatches: Set<string>;
  attrMatches: Set<string>;
  textMatches: Set<string>;
  /** Stringified paths of every node that must render for a match to be reachable: every
   *  *ancestor* of a match, plus the matched node's own path (XML text content, unlike a JSON
   *  leaf value, is gated behind its own element's expand state, so revealing a text match also
   *  requires expanding the element that owns it, not just that element's ancestors). */
  forceExpand: Set<string>;
  /** Every path key reachable in the tree as of the last walk -- used to prune
   *  `expandedOverrides` down to it whenever the document reloads. */
  paths: Set<string>;
  /** Match path keys in document order -- what `activeSearchIndex` indexes into. */
  ordered: string[];
  /** False when more than `MAX_SEARCH_MATCHES` nodes match and `ordered.length` is a lower bound. */
  matchCountExact: boolean;
}

const EMPTY_SEARCH: SearchState = {
  matches: new Set(),
  tagMatches: new Set(),
  attrMatches: new Set(),
  textMatches: new Set(),
  forceExpand: new Set(),
  paths: new Set(),
  ordered: [],
  matchCountExact: true,
};

type XmlState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; doc: Document }
  | { kind: 'error'; message: string };

function elementChildren(node: Element): Element[] {
  return Array.from(node.children);
}

/** Detects the `<parsererror>` document `DOMParser` produces instead of throwing, whose exact
 *  shape (root element vs. nested inside the root) differs across browser engines. */
function findParserError(doc: Document): string | null {
  const root = doc.documentElement;
  const onRoot = root?.tagName === 'parsererror';
  const onFirstChild = root?.firstElementChild?.tagName === 'parsererror';
  const errorEl = onRoot ? root : onFirstChild ? (root!.firstElementChild as Element) : null;
  return errorEl ? (errorEl.textContent ?? 'XML parse error') : null;
}

class XmlDoctypeError extends Error {
  constructor() {
    super('XML document type declarations are not supported.');
    this.name = 'XmlDoctypeError';
  }
}

/** Finds an active document type declaration without mistaking comment/CDATA contents for markup.
 * Rejecting it before DOMParser is important: browser XML parsers do not fetch external entities,
 * but they can expand an internal entity graph before Lyra gets a document to count. */
function containsXmlDoctype(raw: string): boolean {
  for (let offset = 0; offset < raw.length;) {
    if (raw.startsWith('<!--', offset)) {
      const end = raw.indexOf('-->', offset + 4);
      if (end < 0) return false;
      offset = end + 3;
      continue;
    }
    if (raw.startsWith('<![CDATA[', offset)) {
      const end = raw.indexOf(']]>', offset + 9);
      if (end < 0) return false;
      offset = end + 3;
      continue;
    }
    if (raw.slice(offset, offset + 9).toUpperCase() === '<!DOCTYPE') return true;
    offset++;
  }
  return false;
}

function parseXmlDocument(raw: string, ownerDocument: Document): Document {
  if (containsXmlDoctype(raw)) throw new XmlDoctypeError();
  const DOMParserCtor = ownerDocument.defaultView?.DOMParser;
  if (!DOMParserCtor) throw new Error('DOMParser is unavailable without a browsing context.');
  return new DOMParserCtor().parseFromString(raw, 'application/xml');
}

function validateDocumentComplexity(node: Node): void {
  const pending: Array<{ node: Node; depth: number }> = [{ node, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const current = pending.pop()!;
    count++;
    if (count > MAX_NODES || current.depth > MAX_DEPTH) throw new LyraResourceLimitError();
    // Push siblings in reverse document order without first materializing an attacker-sized
    // `childNodes` array. Fail before the pending stack itself can exceed the global node ceiling.
    let child: ChildNode | null = current.node.lastChild;
    while (child) {
      if (count + pending.length >= MAX_NODES) throw new LyraResourceLimitError();
      pending.push({ node: child, depth: current.depth + 1 });
      child = child.previousSibling;
    }
  }
}

/** Resolves a `node-path` (element child-indices, with an optional trailing `'@attrName'`
 *  segment addressing one of the resolved element's attributes) to its target. Returns `null`
 *  when any segment is out of range or a non-trailing segment isn't a valid element index. */
function resolvePath(root: Element, path: PathSegment[]): { element: Element; attr?: string } | null {
  let current: Element = root;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]!; // safe: i < path.length
    if (typeof segment === 'string') {
      if (!segment.startsWith('@') || i !== path.length - 1) return null;
      const attr = segment.slice(1);
      if (!attr || !current.hasAttribute(attr)) return null;
      return { element: current, attr };
    }
    const children = elementChildren(current);
    // A range check alone is not an index guard: NaN fails both comparisons and a fractional
    // index passes them, so `children[segment]` would non-null-assert `undefined` -- yielding a
    // truthy `{ element: undefined }` for a trailing segment (a false "found" result) or a
    // TypeError on the next iteration for a non-trailing one.
    if (!Number.isInteger(segment) || segment < 0 || segment >= children.length) return null;
    current = children[segment]!; // safe: integer + bounds checked on the line above
  }
  return { element: current };
}

export interface LyraXmlViewerEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
}

/** Effective XML source authority. Inline presence wins, including an empty string. */
export type LyraXmlViewerSource = LyraViewerSource<string>;

// Same one-line base every other `DocumentAnchorTarget()` adopter uses: the mixin takes a
// constructor, so the event map has to be bound before it is applied -- otherwise this component
// keeps `LyraElement`'s permissive default and its own `emit()` calls go unchecked.
class LyraXmlViewerBase extends LyraElement<LyraXmlViewerEventMap> {}

/**
 * `<lr-xml-viewer>` — collapsible, copyable, `DOMParser`-based tree view for XML documents,
 * mirroring `lr-json-viewer`'s UX (`collapsed-depth`, `copyable`, structural-path-keyed expand
 * state that survives a same-shape `xml` reassignment -- e.g. a streaming document being patched
 * in place) adapted for XML's own node kinds: elements with attributes, text, comments, CDATA
 * sections, and processing instructions, rendered in their original mixed-child source order.
 *
 * Search is a purely imperative surface (`search()`/`searchNext()`/`searchPrevious()`/
 * `clearSearch()`), the same uniform contract every anchor-target, search-capable viewer in this
 * library implements (`lr-pdf-viewer`, `lr-ebook-viewer`, `lr-notebook-viewer`) rather than
 * a settable property. Each of the three navigating methods resolves only once the newly active
 * match's row has been scrolled into view, the same way `lr-docx-viewer` follows its own active
 * match: marking `data-active-match` without scrolling leaves a find-in-page host stepping through
 * matches the reader never sees. `node-path` anchors address an element by child-index chain from
 * the document root, with an optional trailing `'@attrName'` segment addressing one of that
 * element's attributes. Resolving one paints `data-active` on the addressed `[part="node"]` row and,
 * for an attribute-addressing path, on that one `[part="attribute"]` pair -- so a citation pointing
 * at a single attribute value of a multi-attribute element stays distinguishable in the rendered
 * DOM.
 *
 * Host-supplied `highlights` are resolved the same way: every entry whose anchor is a `node-path`
 * this document can resolve tints its element row (`data-highlight`, carrying the entry's tone) and
 * gains a focusable `[part="highlight-action"]` button that emits `lr-highlight-activate`. Entries
 * whose anchor kind or path this viewer cannot resolve are ignored rather than partially painted,
 * and a highlight inside a collapsed subtree paints once that subtree is expanded.
 *
 * Namespace-literal: qualified names render exactly as authored, with no namespace-URI-aware
 * matching. Every document type declaration is rejected before `DOMParser`, preventing both
 * external-entity access and browser-specific internal-entity expansion.
 *
 * @customElement lr-xml-viewer
 * @event lr-copy - The clipboard write fulfilled. `detail: { ok: true, text }`.
 * @event lr-error - A clipboard write failed; generic no-detail notification.
 * @event lr-copy-error - A clipboard write failed. `detail: { ok: false, text, reason, error }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match
 *   index changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: {
 *   query, matchCount, matchCountExact, activeIndex }`. At most 10,000 matches are retained; a
 *   false `matchCountExact` makes `matchCount` a lower bound.
 * @event lr-render-error - Fired when fetching or parsing the document fails, including a
 *   parse error or exceeding the node cap. `detail: { error }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. Non-cancelable. `detail: { found }`.
 * @event lr-highlight-activate - A `highlights` entry's `[part="highlight-action"]` button was
 *   activated by click or Enter/Space. Non-cancelable. `detail: { highlightId }`.
 * @csspart base - The root scroll container.
 * @csspart toolbar - The whole-document copy button row (only when `copyable`).
 * @csspart copy-button - A copy-to-clipboard button -- the whole-document one (in `toolbar`) or a
 *   per-node one (only when `copyable`).
 * @csspart tree - The rendered node tree.
 * @csspart node - One element row (`data-active` while it's the resolved anchor target,
 *   `data-match` while any part of it matches the current search, `data-active-match` while it's
 *   the currently active search match, `data-highlight` carrying the tone of a `highlights` entry
 *   resolved to it, and `data-active-highlight` while that entry is `activeHighlightId`).
 * @csspart tag - An element's tag name (`data-match`).
 * @csspart attribute - One attribute's name/value pair wrapper (`data-active` while a `node-path`
 *   anchor's trailing `'@attrName'` segment addresses this specific attribute).
 * @csspart attribute-name - An attribute's name.
 * @csspart attribute-value - An attribute's value (`data-match`).
 * @csspart text - A text leaf (`data-match`).
 * @csspart comment - A comment leaf.
 * @csspart cdata - A CDATA section leaf.
 * @csspart pi - A processing-instruction leaf.
 * @csspart toggle - An element's expand/collapse button (hidden, but present for row alignment,
 *   only on elements with renderable children).
 * @csspart toggle-placeholder - A non-interactive alignment spacer in place of `toggle` on an
 *   empty element. It is accessibility-hidden and cannot be revealed into a phantom control by
 *   consumer CSS.
 * @csspart highlight-action - The focusable button a resolved `highlights` entry adds to its
 *   element row; emits `lr-highlight-activate`.
 * @csspart error - The error region.
 * @csspart spinner - Visible ordinary loading content with a motion-safe progress indicator.
 * @cssprop [--lr-xml-viewer-active-attribute-color=var(--lr-color-brand)] - Outline color of the
 *   `[part="attribute"]` an attribute-addressing `node-path` anchor resolved to.
 * @cssprop [--lr-xml-viewer-highlight-accent-background=var(--lr-color-brand-quiet)] - Row
 *   background of an accent-tone (the default tone) `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-success-background=var(--lr-color-success-quiet)] - Row
 *   background of a success-tone `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-warning-background=var(--lr-color-warning-quiet)] - Row
 *   background of a warning-tone `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-danger-background=var(--lr-color-danger-quiet)] - Row
 *   background of a danger-tone `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-neutral-background=var(--lr-color-surface-raised)] - Row
 *   background of a neutral-tone `highlights` entry. Deliberately not `--lr-color-surface`: the
 *   viewer's own ambient background would render a neutral highlight as unhighlighted.
 * @cssprop [--lr-xml-viewer-highlight-active-outline=var(--lr-color-brand)] - Outline color of the
 *   `highlights` entry currently named by `activeHighlightId`.
 * @cssprop [--lr-xml-viewer-max-height=none] - Maximum block size of the scrollable body before
 *   it scrolls internally. Also settable via the `max-height` property.
 * @cssprop [--lr-xml-viewer-active-match-color=var(--lr-color-warning)] - Outline color of the
 *   `[part="node"]` holding the current search match. Scoped to the active match, so the dashed
 *   outline on the other matches keeps the shared warning token.
 * @cssprop [--lr-xml-viewer-match-color=var(--lr-color-warning)] - Outline color of a
 *   (non-active) `[part="node"]` search match, and the tint source for a matching
 *   `[part="text"]`'s background. Distinct from `--lr-xml-viewer-active-match-color`, so the
 *   non-active matches can be recolored without touching the active one.
 * @cssprop [--lr-xml-viewer-match-bg=var(--lr-color-warning-quiet)] - Background of a matching
 *   `[part="tag"]`/`[part="attribute-value"]`.
 * @status stable
 * @since 4.0.0
 */
export class LyraXmlViewer extends DocumentAnchorTarget(LyraXmlViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    xmlViewerChildCount: LYRA_DEFAULT_xmlViewerChildCount,
    xmlViewerCollapseNode: LYRA_DEFAULT_xmlViewerCollapseNode,
    xmlViewerCopyDocument: LYRA_DEFAULT_xmlViewerCopyDocument,
    xmlViewerCopyNode: LYRA_DEFAULT_xmlViewerCopyNode,
    xmlViewerExpandNode: LYRA_DEFAULT_xmlViewerExpandNode,
    xmlViewerLabel: LYRA_DEFAULT_xmlViewerLabel,
    xmlViewerParseError: LYRA_DEFAULT_xmlViewerParseError,
    xmlViewerTooManyNodes: LYRA_DEFAULT_xmlViewerTooManyNodes,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles, viewerLoadingStyles];

  /** URL to fetch and parse as XML. Ignored once `xml` is set. */
  @property() src = '';

  /** Raw XML text to parse and render, wins over `src`. Setting this parses synchronously. */
  @property({ attribute: false })
  get xml(): string | undefined {
    return this._xml;
  }
  set xml(value: string | undefined) {
    const old = this._xml;
    this._xml = value;
    this.requestUpdate('xml', old);
    if (value !== undefined) this.parseInline(value);
  }
  private _xml?: string;

  /** Readonly discriminated snapshot of the effective source authority. */
  get source(): LyraXmlViewerSource {
    return resolveViewerSource(this.src, this._xml);
  }

  /** Display name used as the viewer's accessible label. */
  @property() name = '';

  /** Elements at or beyond this nesting depth (root = 0) start collapsed. Omit/undefined:
   *  nothing auto-collapses. */
  @property({ type: Number, attribute: 'collapsed-depth' }) collapsedDepth?: number;

  /** Shows copy-to-clipboard affordances: one for the whole document, plus one per element. */
  @property({ type: Boolean, reflect: true }) copyable = false;

  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height
   *  instead of growing the page. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['node-path'];

  @state() private xmlState: XmlState = { kind: 'idle' };

  /** Per-path (`JSON.stringify(path)`) explicit expand/collapse, overriding the
   *  `collapsedDepth`/search defaults once an element's toggle has been used. Pruned whenever the
   *  document reloads (see `setDoc()`), so a long-lived instance bound to reshaping/streaming XML
   *  doesn't accumulate one entry per path ever toggled for the life of the instance. */
  @state() private expandedOverrides = new Map<string, boolean>();

  @state() private activePath: string | null = null;
  /** `attrKey(pathKey, attrName)` of the attribute a `node-path` anchor's trailing `'@attrName'`
   *  segment addressed, or `null` when the current anchor stops at element granularity. */
  @state() private activeAttr: string | null = null;
  @state() private activeSearchIndex = -1;

  private searchQuery = '';
  /** Resolved once per `render()` and read by every recursive `renderNode()` call, so painting N
   *  rows never re-resolves M highlights N times. */
  private renderedHighlights = new Map<string, { highlight: LyraHighlight; index: number; total: number }>();
  private searchState: SearchState = EMPTY_SEARCH;
  private lastSearchLocale = '';
  private generation = 0;
  private readonly announcements = new ViewerAnnouncementController(this);
  @state() private copyFeedback: { key: string; status: 'success' | 'error' } | null = null;
  private copyGeneration = 0;
  private copyTimer?: { owner: Window; handle: number; generation: number };

  /** `collapsedDepth`, normalized to a finite non-negative integer when set -- `undefined`
   *  (nothing auto-collapses) is left as-is, since it's a meaningful, intentional value, not an
   *  invalid one. A raw `NaN` (e.g. an invalid `collapsed-depth` attribute) would otherwise make
   *  every `depth >= collapsedDepth` comparison false, silently disabling auto-collapse instead of
   *  falling back to a sane depth. Mirrors `<lr-json-viewer>`'s identical guard. */
  private get safeCollapsedDepth(): number | undefined {
    return this.collapsedDepth === undefined ? undefined : finiteCount(this.collapsedDepth);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && (changed.has('src') || changed.has('xml'))) this.resetCopyFeedback();
    const locale = this.effectiveLocale;
    if (this.lastSearchLocale && locale !== this.lastSearchLocale && this.xmlState.kind === 'loaded') {
      this.searchState = this.computeSearch(this.xmlState.doc);
      this.activeSearchIndex = this.searchState.ordered.length
        ? Math.min(Math.max(0, this.activeSearchIndex), this.searchState.ordered.length - 1)
        : -1;
    }
    this.lastSearchLocale = locale;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.xmlState.kind,
      this.xmlState.kind === 'error' ? this.xmlState.message : this.localize('loadingDocument'),
    );
    if ((changed.has('src') || changed.has('xml')) && this._xml === undefined) {
      this.scheduleAfterUpdate(() => {
        void this.loadFromSrc();
      });
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src && this._xml === undefined) {
      this.scheduleAfterUpdate(() => {
        void this.loadFromSrc();
      });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.beginAbortableLoad();
    if (this._xml === undefined) this.xmlState = { kind: 'idle' };
    this.announcements.disconnect();
    this.resetCopyFeedback();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
    this.resetCopyFeedback();
  }

  private parseInline(raw: string): void {
    const generation = ++this.generation;
    try {
      this.setDoc(parseXmlDocument(raw, this.ownerDocument), generation);
    } catch (error) {
      this.xmlState = { kind: 'error', message: this.localize('xmlViewerParseError') };
      this.emit('lr-render-error', { error });
    }
  }

  private async loadFromSrc(): Promise<void> {
    // Re-checked here (not just by updated()'s scheduling guard) -- this call is deferred via
    // scheduleAfterUpdate(), so a synchronous `xml` assignment arriving after it was scheduled
    // but before it actually runs must still win; otherwise this stale src-fetch attempt would
    // overwrite the freshly-parsed inline document's `loaded` state back to `idle`.
    if (this._xml !== undefined) return;
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.xmlState = { kind: 'idle' };
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.xmlState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.xmlState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      this.setDoc(parseXmlDocument(text, this.ownerDocument), generation);
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.xmlState = {
        kind: 'error',
        message: this.localize(
          error instanceof XmlDoctypeError
            ? 'xmlViewerParseError'
            : isResourceLimitError(error)
              ? 'documentPreviewResourceTooLarge'
              : 'documentPreviewFailedToLoad',
        ),
      };
      this.emit('lr-render-error', { error });
    }
  }

  private setDoc(doc: Document, generation: number): void {
    if (generation !== this.generation) return;
    const parseError = findParserError(doc);
    if (parseError) {
      // The visible error text and document-level assertive announcement are always this component's own stable, localized
      // message -- never the browser engine's raw <parsererror> diagnostic (Chrome/Firefox/
      // Safari each word it completely differently, and always in English regardless of the
      // page's locale). The raw diagnostic is preserved only in the emitted event's `error`
      // detail, mirroring every other viewer in this family (LyraUserFacingError's convention).
      this.xmlState = { kind: 'error', message: this.localize('xmlViewerParseError') };
      this.emit('lr-render-error', { error: new Error(parseError) });
      return;
    }
    try {
      validateDocumentComplexity(doc);
    } catch (error) {
      this.xmlState = { kind: 'error', message: this.localize('xmlViewerTooManyNodes') };
      this.emit('lr-render-error', { error });
      return;
    }
    this.xmlState = { kind: 'loaded', doc };
    const next = this.computeSearch(doc);
    this.searchState = next;
    const hasSearchQuery = Boolean(this.searchQuery.trim());
    if (hasSearchQuery) {
      this.activeSearchIndex = next.ordered.length
        ? Math.min(Math.max(this.activeSearchIndex, 0), next.ordered.length - 1)
        : -1;
      this.emitSearchChange();
    }
    if (this.expandedOverrides.size) {
      let pruned: Map<string, boolean> | null = null;
      for (const key of this.expandedOverrides.keys()) {
        if (!next.paths.has(key)) {
          pruned ??= new Map(this.expandedOverrides);
          pruned.delete(key);
        }
      }
      if (pruned) this.expandedOverrides = pruned;
    }
  }

  private computeSearch(doc: Document): SearchState {
    const locale = this.effectiveLocale;
    const boundedQuery = boundedViewerSearchQuery(this.searchQuery, locale);
    const query = boundedQuery.needle;
    const budget = new ViewerSearchWorkBudget();
    const matches = new Set<string>();
    const tagMatches = new Set<string>();
    const attrMatches = new Set<string>();
    const textMatches = new Set<string>();
    const forceExpand = new Set<string>();
    const paths = new Set<string>();
    const ordered: string[] = [];
    let matchCountExact = boundedQuery.accepted;

    const markAncestors = (path: PathSegment[]): void => {
      for (let i = path.length - 1; i >= 0; i--) forceExpand.add(JSON.stringify(path.slice(0, i)));
    };

    const walk = (el: Element, path: PathSegment[]): void => {
      const pathKey = JSON.stringify(path);
      paths.add(pathKey);
      if (query && matchCountExact) {
        let hit = false;
        if (budget.includes(el.tagName, query, locale)) {
          tagMatches.add(pathKey);
          hit = true;
        }
        for (const attr of el.attributes) {
          if (
            budget.includes(attr.name, query, locale) ||
            budget.includes(attr.value, query, locale)
          ) {
            attrMatches.add(attrKey(pathKey, attr.name));
            hit = true;
          }
          if (!budget.complete) break;
        }
        const ownTextParts = function* (): Generator<string> {
          for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) yield child.textContent ?? '';
          }
        };
        if (budget.complete && budget.includesJoined(ownTextParts(), query, locale)) {
          textMatches.add(pathKey);
          hit = true;
        }
        if (!budget.complete) matchCountExact = false;
        if (hit) {
          if (ordered.length === MAX_SEARCH_MATCHES) {
            matchCountExact = false;
            tagMatches.delete(pathKey);
            textMatches.delete(pathKey);
            for (const attr of el.attributes) {
              attrMatches.delete(attrKey(pathKey, attr.name));
            }
          } else {
            matches.add(pathKey);
            ordered.push(pathKey);
            // Reveals the match itself, not just its ancestors -- a text match specifically is
            // gated behind its own element's expand state (see the SearchState.forceExpand doc).
            forceExpand.add(pathKey);
            markAncestors(path);
          }
        }
      }
      elementChildren(el).forEach((child, i) => walk(child, [...path, i]));
    };

    if (doc.documentElement) walk(doc.documentElement, []);
    return { matches, tagMatches, attrMatches, textMatches, forceExpand, paths, ordered, matchCountExact };
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'node-path' || this.xmlState.kind !== 'loaded' || !this.xmlState.doc.documentElement) return false;
    const resolved = resolvePath(this.xmlState.doc.documentElement, anchor.path);
    if (!resolved?.element) return false;
    const numericPath = anchor.path.filter((s): s is number => typeof s === 'number');
    this.expandAncestors(anchor.path);
    const pathKey = JSON.stringify(numericPath);
    this.activePath = pathKey;
    // An attribute-addressing path resolves to one specific attribute of that element, so mark it
    // as such -- element-only `data-active` on the row would leave a consumer citing one attribute
    // value of a multi-attribute element unable to tell which attribute was meant. Always
    // reassigned (to `null` for a bare element path) so a later element-granularity anchor clears
    // the previous attribute-level distinction instead of leaving it stranded.
    this.activeAttr = resolved.attr ? attrKey(pathKey, resolved.attr) : null;
    return true;
  }

  /**
   * Host-supplied `highlights` resolved against the loaded document, keyed by the rendered path key
   * of the element each one addresses. Entries are deduplicated by public `id` (a host re-sending
   * the same citation must not paint twice), then filtered down to `node-path` anchors this
   * document can actually resolve -- an unresolvable entry is dropped whole rather than painted at
   * some coarser granularity. `index`/`total` position each surviving entry for its localized
   * accessible name, exactly as `<lr-svg-viewer>` numbers its own region highlights; two entries
   * resolving to the SAME element still both count toward `total`, while the first retained one
   * owns that row's paint. Painting retains at most 100 resolved entries after inspecting at most
   * 1,000 candidates; an active entry is inspected first and retained inside that cap.
   */
  private resolveHighlights(): Map<string, { highlight: LyraHighlight; index: number; total: number }> {
    const byPath = new Map<string, { highlight: LyraHighlight; index: number; total: number }>();
    if (this.xmlState.kind !== 'loaded') return byPath;
    const root = this.xmlState.doc.documentElement;
    if (!root) return byPath;
    const seen = new Set<string>();
    const resolved: Array<{ highlight: LyraHighlight; pathKey: string }> = [];
    const candidates = prioritizedHighlightCandidates(this.highlights, this.activeHighlightId);
    for (const highlight of candidates) {
      if (seen.has(highlight.id)) continue;
      seen.add(highlight.id);
      if (highlight.anchor.kind !== 'node-path') continue;
      if (!resolvePath(root, highlight.anchor.path)) continue;
      resolved.push({
        highlight,
        pathKey: JSON.stringify(highlight.anchor.path.filter((s): s is number => typeof s === 'number')),
      });
      if (resolved.length >= MAX_PAINTED_HIGHLIGHTS) break;
    }
    resolved.forEach(({ highlight, pathKey }, index) => {
      if (!byPath.has(pathKey)) byPath.set(pathKey, { highlight, index, total: resolved.length });
    });
    return byPath;
  }

  /** The localized accessible name of one highlight's action button -- its own `label` when the
   *  host supplied one, otherwise its position in the resolved set. Mirrors `<lr-svg-viewer>`. */
  private highlightActionLabel(highlight: LyraHighlight, index: number, total: number): string {
    if (highlight.label) return this.localize('highlightWithLabel', undefined, { label: highlight.label });
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return this.localize('highlightOfTotal', undefined, {
      index: numberFormat.format(index + 1),
      total: numberFormat.format(total),
    });
  }

  private expandAncestors(path: PathSegment[]): void {
    const next = new Map(this.expandedOverrides);
    for (let i = 0; i < path.length; i++) {
      if (typeof path[i] !== 'number') continue;
      next.set(JSON.stringify(path.slice(0, i)), true);
    }
    this.expandedOverrides = next;
  }

  /** Case-insensitive substring search over every element's tag name, attribute names/values,
   *  and own text, layered over the already-parsed document -- resolves at most 10,000 retained
   *  matches and fires `lr-search-change`; `detail.matchCountExact=false` identifies that return
   *  as a lower bound. Matches are re-derived automatically whenever the document
   *  reloads with the same query still set; the active index is clamped and the recomputed state
   *  fires `lr-search-change` again (see `setDoc()`). */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.searchState = this.xmlState.kind === 'loaded' ? this.computeSearch(this.xmlState.doc) : EMPTY_SEARCH;
    this.activeSearchIndex = this.searchState.ordered.length ? 0 : -1;
    this.requestUpdate();
    this.emitSearchChange();
    if (this.activeSearchIndex >= 0) await this.scrollActiveMatchIntoView();
    return this.searchState.ordered.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `true` once the
   *  active match moved, `false` when there are no matches -- the shape the shared
   *  `LyraTextViewerTarget` search contract declares, so a find-in-page host can drive every
   *  searchable component through one typed surface. */
  async searchNext(): Promise<boolean> {
    if (!this.searchState.ordered.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchState.ordered.length;
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `true` once the
   *  active match moved, `false` when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchState.ordered.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchState.ordered.length) % this.searchState.ordered.length;
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchState = this.xmlState.kind === 'loaded' ? this.computeSearch(this.xmlState.doc) : EMPTY_SEARCH;
    this.activeSearchIndex = -1;
    this.requestUpdate();
    this.emitSearchChange();
  }

  /** Brings the row carrying `data-active-match` on screen once the state change that moved the
   *  marker has actually rendered -- the tree is Lit-rendered, so unlike `<lr-docx-viewer>`'s
   *  synchronously-painted marks the row does not exist yet at call time. Marking the active match
   *  without scrolling to it leaves a find-in-page host stepping through matches the reader never
   *  sees, which is what every other search-capable viewer here avoids. Reduced motion drops the
   *  smooth behavior, matching the sibling viewers. */
  private async scrollActiveMatchIntoView(): Promise<void> {
    await this.updateComplete;
    const active = this.renderRoot.querySelector('[data-active-match]') as HTMLElement | null;
    active?.scrollIntoView({
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth',
      block: 'center',
    });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchState.ordered.length,
      matchCountExact: this.searchState.matchCountExact,
      activeIndex: this.activeSearchIndex,
    });
  }

  private toggleNode(pathKey: string, expanded: boolean): void {
    const next = new Map(this.expandedOverrides);
    next.set(pathKey, !expanded);
    this.expandedOverrides = next;
  }

  private isExpanded(pathKey: string, depth: number): boolean {
    const override = this.expandedOverrides.get(pathKey);
    if (override !== undefined) return override;
    if (this.searchState.forceExpand.has(pathKey)) return true;
    const collapsedDepth = this.safeCollapsedDepth;
    if (collapsedDepth !== undefined && depth >= collapsedDepth) return false;
    return true;
  }

  private cancelCopyTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  private resetCopyFeedback(): void {
    this.copyGeneration++;
    this.cancelCopyTimer();
    this.copyFeedback = null;
  }

  private showCopyFeedback(
    key: string,
    status: 'success' | 'error',
    generation: number,
    owner: Window,
  ): void {
    this.copyFeedback = { key, status };
    this.cancelCopyTimer();
    let handle = 0;
    handle = owner.setTimeout(() => {
      if (
        this.copyTimer?.owner !== owner
        || this.copyTimer.handle !== handle
        || this.copyTimer.generation !== generation
        || generation !== this.copyGeneration
        || !this.isConnected
        || this.ownerDocument.defaultView !== owner
      ) return;
      this.copyTimer = undefined;
      this.copyFeedback = null;
    }, 1_500);
    this.copyTimer = { owner, handle, generation };
  }

  private async copyText(text: string, key: string): Promise<void> {
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const generation = ++this.copyGeneration;
    this.cancelCopyTimer();
    this.copyFeedback = null;
    const outcome = await writeClipboardText(owner, text);
    if (
      !owner
      || !this.isConnected
      || generation !== this.copyGeneration
      || this.ownerDocument.defaultView !== owner
    ) return;
    if (outcome.ok) {
      this.showCopyFeedback(key, 'success', generation, owner);
      this.emit('lr-copy', outcome);
      return;
    }
    this.showCopyFeedback(key, 'error', generation, owner);
    this.emit('lr-error');
    this.emit('lr-copy-error', outcome);
  }

  private serializeXml(node: Node): string | null {
    const XMLSerializerCtor = this.isConnected
      ? this.ownerDocument.defaultView?.XMLSerializer
      : undefined;
    return XMLSerializerCtor ? new XMLSerializerCtor().serializeToString(node) : null;
  }

  private copySerializedXml(node: Node, key: string): void {
    const text = this.serializeXml(node);
    if (text !== null) void this.copyText(text, key);
  }

  private copyButtonLabel(key: string, rest: string): string {
    const feedback = this.copyFeedback?.key === key ? this.copyFeedback.status : undefined;
    return feedback === 'success'
      ? this.localize('copied')
      : feedback === 'error'
        ? this.localize('copyFailed')
        : rest;
  }

  private renderCopyButton(
    getNode: () => Node,
    name: string,
    key: string,
  ): TemplateResult | typeof nothing {
    if (!this.copyable) return nothing;
    const label = this.copyButtonLabel(
      key,
      this.localize('xmlViewerCopyNode', undefined, { name }),
    );
    return html`
      <button
        part="copy-button"
        type="button"
        aria-label=${label}
        @click=${(e: Event) => {
          e.stopPropagation();
          this.copySerializedXml(getNode(), key);
        }}
      >
        ${this.copyButtonLabel(key, this.localize('copy'))}
      </button>
    `;
  }

  private renderNode(el: Element, path: PathSegment[], depth: number): TemplateResult {
    const pathKey = JSON.stringify(path);
    const renderedChildren = Array.from(el.childNodes).filter((node) => (
      node.nodeType === Node.ELEMENT_NODE
      || (node.nodeType === Node.TEXT_NODE && Boolean((node.textContent ?? '').trim()))
      || node.nodeType === Node.COMMENT_NODE
      || node.nodeType === Node.CDATA_SECTION_NODE
      || node.nodeType === Node.PROCESSING_INSTRUCTION_NODE
    ));
    const hasChildren = renderedChildren.length > 0;
    const expanded = hasChildren && this.isExpanded(pathKey, depth);
    const indentStyle = `padding-inline-start:calc(${depth} * var(--lr-space-l))`;
    const isMatch = this.searchState.matches.has(pathKey);
    const activeMatchKey = this.searchState.ordered[this.activeSearchIndex];
    const highlight = this.renderedHighlights.get(pathKey);
    const toggleLabel = el.tagName;
    let elementIndex = 0;
    const childRows = renderedChildren.map((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return this.renderNode(node as Element, [...path, elementIndex++], depth + 1);
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return html`<div part="text" class="row" style=${indentStyle} ?data-match=${this.searchState.textMatches.has(pathKey)}>${node.textContent}</div>`;
      }
      if (node.nodeType === Node.COMMENT_NODE) {
        return html`<div part="comment" class="row" style=${indentStyle}>&lt;!--${node.textContent}--&gt;</div>`;
      }
      if (node.nodeType === Node.CDATA_SECTION_NODE) {
        return html`<div part="cdata" class="row" style=${indentStyle}>&lt;![CDATA[${node.textContent}]]&gt;</div>`;
      }
      return html`<div part="pi" class="row" style=${indentStyle}>&lt;?${(node as ProcessingInstruction).target} ${node.textContent}?&gt;</div>`;
    });

    return html`
      <div
        part="node"
        class="row"
        style=${indentStyle}
        ?data-active=${this.activePath === pathKey}
        ?data-match=${isMatch}
        ?data-active-match=${isMatch && pathKey === activeMatchKey}
        data-highlight=${highlight ? (highlight.highlight.tone ?? 'accent') : nothing}
        ?data-active-highlight=${Boolean(highlight) && highlight!.highlight.id === this.activeHighlightId}
      >
        ${hasChildren
          ? html`<button
              part="toggle"
              type="button"
              aria-expanded=${expanded ? 'true' : 'false'}
              aria-label=${this.localize(
                expanded ? 'xmlViewerCollapseNode' : 'xmlViewerExpandNode',
                undefined,
                { name: toggleLabel },
              )}
              @click=${() => this.toggleNode(pathKey, expanded)}
            >
              <span class="chevron">${chevronIcon()}</span>
            </button>`
          : html`<span part="toggle-placeholder" aria-hidden="true"></span>`}
        <span
          >&lt;<span part="tag" ?data-match=${this.searchState.tagMatches.has(pathKey)}>${el.tagName}</span
          >${Array.from(el.attributes).map(
            (a) => html` <span part="attribute"
              ?data-active=${this.activeAttr === attrKey(pathKey, a.name)}
              ><span part="attribute-name">${a.name}</span>="<span
                part="attribute-value"
                ?data-match=${this.searchState.attrMatches.has(attrKey(pathKey, a.name))}
                >${a.value}</span
              >"</span
            >`,
          )}&gt;</span
        >
        ${!expanded && hasChildren
          ? html`<span class="preview">${this.localize('xmlViewerChildCount', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(
                renderedChildren.length,
              ),
              pluralCount: renderedChildren.length,
            })}</span>`
          : nothing}
        ${highlight
          ? html`<button
              part="highlight-action"
              type="button"
              data-highlight-id=${highlight.highlight.id}
              aria-label=${this.highlightActionLabel(highlight.highlight, highlight.index, highlight.total)}
              @click=${(e: Event) => {
                e.stopPropagation();
                this.emit('lr-highlight-activate', { highlightId: highlight.highlight.id });
              }}
            >
              ${highlight.highlight.label
                || this.highlightActionLabel(highlight.highlight, highlight.index, highlight.total)}
            </button>`
          : nothing}
        ${this.renderCopyButton(() => el, toggleLabel, pathKey)}
      </div>
      ${expanded
        ? childRows
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const label = viewerSemanticLabel(this, this.name || this.localize('xmlViewerLabel'));
    const state = this.xmlState;
    this.renderedHighlights = this.resolveHighlights();
    return html`
      <div
        part="base"
        role=${viewerSemanticRole(this, 'region') ?? nothing}
        style=${sanitizeCssLength(this.maxHeight)
          ? styleMap({ '--lr-xml-viewer-max-height': sanitizeCssLength(this.maxHeight)! })
          : nothing}
        aria-label=${label ?? nothing}
        aria-busy=${state.kind === 'loading' ? 'true' : 'false'}
      >
        ${this.copyable && state.kind === 'loaded'
          ? html`
              <div part="toolbar">
                <button
                  part="copy-button"
                  type="button"
                  aria-label=${this.copyButtonLabel('document', this.localize('xmlViewerCopyDocument'))}
                  @click=${() => this.copySerializedXml(state.doc, 'document')}
                >
                  ${this.copyButtonLabel('document', this.localize('copy'))}
                </button>
              </div>
            `
          : nothing}
        ${state.kind === 'loaded' && state.doc.documentElement
          ? html`<div part="tree">${this.renderNode(state.doc.documentElement, [], 0)}</div>`
          : state.kind === 'loading'
            ? renderViewerLoading(this.localize('loadingDocument'))
            : state.kind === 'error'
              ? html`<div part="error">${state.message}</div>`
              : html`<p>${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`}
        ${this.renderAnchorLiveRegion()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-xml-viewer': LyraXmlViewer;
  }
}
