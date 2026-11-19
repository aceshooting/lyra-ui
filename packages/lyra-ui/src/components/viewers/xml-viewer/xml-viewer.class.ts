import { hasHierarchySourceCopy, hierarchyCopyScope, HierarchySourceCopyController, HierarchySourceSearchController } from '../../../internal/hierarchy-source-search.js';
import { applyHierarchySourceEffects, captureHierarchySourceEffects } from '../../../internal/hierarchy-summary-source.js';
import { KeyedCopyFeedback } from '../../../internal/record-copy-feedback.js';
import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { lyraLocaleCatalogVersion } from '../../../internal/localization-runtime.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import { DocumentAnchorTarget, prioritizedHighlightCandidates } from '../../../internal/anchor-target.js';
import type {
  AnchorResultDetail,
  HighlightActivateDetail,
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
} from '../document-viewer/anchors.js';
import {
  DEFAULT_MAX_RESOURCE_BYTES,
  resolveMaxResourceBytes,
  isResourceLimitError,
  LyraResourceLimitError,
  LyraUserFacingError,
  yieldViewerTask,
} from '../../../internal/resource-loader.js';
import { chevronIcon } from '../../../internal/icons.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraInspectionNode } from '../../../data-sources.js';
import { HierarchySourceController, hierarchyField } from '../../../internal/hierarchy-source-controller.js';
import { hierarchySourceView } from '../../../internal/hierarchy-source-view.js';
import { hierarchySourceStyles } from '../../../internal/hierarchy-source-view.styles.js';
export type XmlViewerTreeSource = LyraHierarchySource<LyraInspectionNode, LyraHierarchyQuery>;
const INSPECTION_KINDS = new Set(['object', 'array', 'scalar', 'element', 'attribute', 'text', 'comment', 'processing-instruction']);

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
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_expand, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_retry, LYRA_DEFAULT_sourceSearchUnavailable, LYRA_DEFAULT_treeSourceError, LYRA_DEFAULT_treeSourceSummary, LYRA_DEFAULT_viewerSearchMatchCount } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_xmlViewerChildCount, LYRA_DEFAULT_xmlViewerCollapseNode, LYRA_DEFAULT_xmlViewerCopyDocument, LYRA_DEFAULT_xmlViewerCopyNode, LYRA_DEFAULT_xmlViewerExpandNode, LYRA_DEFAULT_xmlViewerLabel, LYRA_DEFAULT_xmlViewerLimit, LYRA_DEFAULT_xmlViewerParseError, LYRA_DEFAULT_xmlViewerTooManyNodes } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_NODES = 50_000;
const MAX_RENDERED_ROWS = 5_000;
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
  | { kind: 'error'; message: () => string };

function elementChildren(node: Element): Element[] {
  return Array.from(node.children);
}

interface PathResolutionBudget {
  remaining: number;
}

interface RenderBudget {
  remaining: number;
  truncated: boolean;
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

/** Rejects resource amplification before constructing a document. Quoted attributes and
 * comment/CDATA payloads are skipped as units, so markup-looking text cannot inflate the count. */
function preflightXml(raw: string, maxBytes = DEFAULT_MAX_RESOURCE_BYTES, maxNodes = MAX_NODES): void {
  if (raw.length > maxBytes || new TextEncoder().encode(raw).byteLength > maxBytes) throw new LyraResourceLimitError();
  let nodes = 1; // The Document itself participates in the post-parse node ceiling.
  let depth = 0;
  const count = (): void => { if (++nodes > maxNodes) throw new LyraResourceLimitError(); };
  for (let offset = 0; offset < raw.length;) {
    const open = raw.indexOf('<', offset);
    if (open < 0) { if (depth > 0 && offset < raw.length) count(); break; }
    if (depth > 0 && open > offset) count();
    if (raw.startsWith('<!--', open) || raw.startsWith('<![CDATA[', open) || raw.startsWith('<?', open)) {
      const comment = raw.startsWith('<!--', open);
      const cdata = raw.startsWith('<![CDATA[', open);
      const terminator = comment ? '-->' : cdata ? ']]>' : '?>';
      if (comment || cdata || !/^<\?xml(?:\s|\?)/.test(raw.slice(open, open + 8))) count();
      const end = raw.indexOf(terminator, open + (comment ? 4 : cdata ? 9 : 2));
      if (end < 0) break;
      offset = end + terminator.length;
      continue;
    }
    if (raw.slice(open, open + 9).toUpperCase() === '<!DOCTYPE') throw new XmlDoctypeError();
    let quote = '';
    let end = open + 1;
    for (; end < raw.length; end++) {
      const character = raw[end]!;
      if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '<') throw new Error('Invalid XML markup');
      else if (character === '>') break;
    }
    if (end === raw.length) break;
    if (raw[open + 1] === '/') depth = Math.max(0, depth - 1);
    else {
      count();
      if (depth + 1 > MAX_DEPTH) throw new LyraResourceLimitError();
      if (raw[end - 1] !== '/') depth++;
    }
    offset = end + 1;
  }
}

function parseXmlDocument(raw: string, ownerDocument: Document, maxBytes: number, maxNodes: number, prepared = false): Document {
  if (!prepared) preflightXml(raw, maxBytes, maxNodes);
  const DOMParserCtor = ownerDocument.defaultView?.DOMParser;
  if (!DOMParserCtor) throw new Error('DOMParser is unavailable without a browsing context.');
  return new DOMParserCtor().parseFromString(raw, 'application/xml');
}

function isRenderedXmlChild(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE
    || (node.nodeType === Node.TEXT_NODE && Boolean((node.textContent ?? '').trim()))
    || node.nodeType === Node.COMMENT_NODE
    || node.nodeType === Node.CDATA_SECTION_NODE
    || node.nodeType === Node.PROCESSING_INSTRUCTION_NODE;
}

function validateDocumentComplexity(node: Node, maxNodes: number): WeakMap<Node, number> {
  const childCounts = new WeakMap<Node, number>();
  const pending: Array<{ node: Node; depth: number }> = [{ node, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const current = pending.pop()!;
    count++;
    if (count > maxNodes || current.depth > MAX_DEPTH) throw new LyraResourceLimitError();
    // Push siblings in reverse document order without first materializing an attacker-sized
    // `childNodes` array. Fail before the pending stack itself can exceed the global node ceiling.
    let child: ChildNode | null = current.node.lastChild;
    let children = 0;
    while (child) {
      if (isRenderedXmlChild(child)) children++;
      if (count + pending.length >= maxNodes) throw new LyraResourceLimitError();
      pending.push({ node: child, depth: current.depth + 1 });
      child = child.previousSibling;
    }
    childCounts.set(current.node, children);
  }
  return childCounts;
}

/** Resolves a `node-path` (element child-indices, with an optional trailing `'@attrName'`
 *  segment addressing one of the resolved element's attributes) to its target. Returns `null`
 *  when any segment is out of range or a non-trailing segment isn't a valid element index. */
function resolvePath(
  root: Element,
  path: unknown,
  budget?: PathResolutionBudget,
): { element: Element; attr?: string } | null {
  if (!Array.isArray(path)) return null;
  if (budget && budget.remaining-- <= 0) return null;
  let current: Element = root;
  for (let i = 0; i < path.length; i++) {
    if (budget && budget.remaining-- <= 0) return null;
    const segment = path[i]!; // safe: i < path.length
    if (typeof segment === 'string') {
      if (!segment.startsWith('@') || i !== path.length - 1) return null;
      const attr = segment.slice(1);
      if (!attr || !current.hasAttribute(attr)) return null;
      return { element: current, attr };
    }
    const children = current.children;
    // A range check alone is not an index guard: NaN fails both comparisons and a fractional
    // index passes them, so `children[segment]` would non-null-assert `undefined` -- yielding a
    // truthy `{ element: undefined }` for a trailing segment (a false "found" result) or a
    // TypeError on the next iteration for a non-trailing one.
    if (!Number.isInteger(segment) || segment < 0 || segment >= children.length) return null;
    const child = children.item(segment);
    if (!child) return null;
    current = child;
  }
  return { element: current };
}

export interface LyraXmlViewerEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-load': CustomEvent<Record<string, never>>;
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
 * Property-only treeSource takes display precedence over xml/src without parsing provider records.
 * The xml setter still parses synchronously; readonly source reports the current legacy text source.
 * Removing treeSource restores current inline XML or normal src loading. Source rows bound each
 * name/path/value to 65,536 UTF-16 units and retained/staged/focused text plus projection state to
 * 2,000,000 units. Source search accepts 4,096 query units and retains at most 10,000 global node
 * hits independent of maxNodes/maxRows; it reveals the first hit. Copy requests complete provider
 * document/subtree/node text within maxBytes, never serialized mounted rows. Compact keys support
 * deep revealSourceKey access; node-path anchors require canonical JSON.stringify(path) keys
 * (at most 256 segments), with exact attribute targets and no promotion to parent elements.
 *
 * @csspart source-list - Source-only bounded virtual scroller.
 * @csspart source-row - Source-only flat tree item with logical hierarchy metadata.
 * @csspart source-toggle - Source-only expansion or retry action.
 * @csspart source-label - Source-only inspection text, copy and highlight content.
 * @csspart source-status - Source-only loading, empty and full-source count status.
 * @csspart source-error - Source-only projection or admission failure.
 * @csspart search-status - Unavailable or partial global provider search status.
 *
 * `<lr-xml-viewer>` — collapsible, copyable, `DOMParser`-based tree view for XML documents,
 * mirroring `lr-json-viewer`'s UX (`expand-depth`, `copyable`, structural-path-keyed expand
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
 * whose anchor kind or path this viewer cannot resolve -- including a missing or non-array path --
 * are ignored rather than partially painted, and a highlight inside a collapsed subtree paints
 * once that subtree is expanded.
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
 *   index changes, including source-reset and effective-locale re-evaluation. `detail: {
 *   query, matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code
 *   units, scans at most 4,000,000 tag/attribute/text code units, and retains at most 10,000
 *   matches; a false `matchCountExact` makes `matchCount` a lower bound after any ceiling.
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with empty detail.
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
 * @csspart limit - Notice shown when the expanded tree exceeds the rendered-row limit.
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
 * @csspart toggle - An element's expand/collapse button (only on elements with renderable
 *   children). Its collapsed chevron mirrors with effective RTL direction; the expanded chevron
 *   points down in either direction.
 * @csspart toggle-placeholder - A non-interactive alignment spacer in place of `toggle` on an
 *   empty element. It is accessibility-hidden and cannot be revealed into a phantom control by
 *   consumer CSS.
 * @csspart highlight-action - The focusable button a resolved `highlights` entry adds to its
 *   element row; emits `lr-highlight-activate`.
 * @csspart error - The error region.
 * @csspart spinner - Visible ordinary loading content with a motion-safe progress indicator.
 * @cssprop --lr-xml-viewer-action-background - Resting background of viewer actions.
 * @cssprop --lr-xml-viewer-action-hover-background - Hover background of viewer actions.
 * @cssprop --lr-xml-viewer-action-active-background - Pressed background of viewer actions.
 * @cssprop [--lr-xml-viewer-active-attribute-color=var(--lr-color-brand)] - Outline color of the
 *   `[part="attribute"]` an attribute-addressing `node-path` anchor resolved to.
 * @cssprop [--lr-xml-viewer-tag-color=var(--lr-color-brand)] - Text color of `[part="tag"]`, an
 *   element's rendered tag name, independent of the active-attribute outline above.
 * @cssprop [--lr-xml-viewer-highlight-accent-bg=var(--lr-color-brand-quiet)] - Row
 *   background of an accent-tone (the default tone) `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-success-bg=var(--lr-color-success-quiet)] - Row
 *   background of a success-tone `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-warning-bg=var(--lr-color-warning-quiet)] - Row
 *   background of a warning-tone `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-danger-bg=var(--lr-color-danger-quiet)] - Row
 *   background of a danger-tone `highlights` entry.
 * @cssprop [--lr-xml-viewer-highlight-neutral-bg=var(--lr-color-surface-raised)] - Row
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
    collapse: LYRA_DEFAULT_collapse,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    expand: LYRA_DEFAULT_expand,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    noData: LYRA_DEFAULT_noData,
    retry: LYRA_DEFAULT_retry,
    sourceSearchUnavailable: LYRA_DEFAULT_sourceSearchUnavailable,
    treeSourceError: LYRA_DEFAULT_treeSourceError,
    treeSourceSummary: LYRA_DEFAULT_treeSourceSummary,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    xmlViewerChildCount: LYRA_DEFAULT_xmlViewerChildCount,
    xmlViewerCollapseNode: LYRA_DEFAULT_xmlViewerCollapseNode,
    xmlViewerCopyDocument: LYRA_DEFAULT_xmlViewerCopyDocument,
    xmlViewerCopyNode: LYRA_DEFAULT_xmlViewerCopyNode,
    xmlViewerExpandNode: LYRA_DEFAULT_xmlViewerExpandNode,
    xmlViewerLabel: LYRA_DEFAULT_xmlViewerLabel,
    xmlViewerLimit: LYRA_DEFAULT_xmlViewerLimit,
    xmlViewerParseError: LYRA_DEFAULT_xmlViewerParseError,
    xmlViewerTooManyNodes: LYRA_DEFAULT_xmlViewerTooManyNodes,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, hierarchySourceStyles, specialistTokens, styles, viewerLoadingStyles, srOnly];


  /** Maximum parsed document nodes, from 1 to 500,000; invalid values use 50,000. */
  @property({ type: Number, attribute: 'max-nodes' }) maxNodes = 50000;
  /** Maximum displayed tree rows, from 1 to 50,000; invalid values use 5,000. */
  @property({ type: Number, attribute: 'max-rows' }) maxRows = 5000;
  /** Maximum UTF-8 input bytes, from 1 to 262,144,000; invalid values use 26,214,400.
   * @default 26214400 */
  @property({ type: Number, attribute: 'max-bytes' }) maxBytes = DEFAULT_MAX_RESOURCE_BYTES;
  private _treeSource?: XmlViewerTreeSource;
  private sourceMode = false;
  private sourceAnchorTask?: object;
  private sourceBinding?: { source: XmlViewerTreeSource | undefined; query: string; locale: string };
  private sourceAnnouncement?: string;
  private lastSourceStatus?: string;
  private readonly hierarchy = new HierarchySourceController<LyraInspectionNode>(this, {
    normalize: (value, key) => this.normalizeSourceNode(value, key),
    onChange: () => this.requestUpdate('sourceState', null), accepted: () => {},
    payload: { maxUnits: 2_000_000, maxRowUnits: 327_702,
      unitsOf: node => node.name.length + node.path.length + (node.value?.length ?? 0) + node.kind.length },
  });

  private readonly sourceSearch = new HierarchySourceSearchController({
    host: this,
    control: this.hierarchy,
    source: () => this.treeSource,
    query: () => this.searchQuery,
    revealFirst: true,
    beforeStep: () => { this.sourceAnchorTask = undefined; this.cancelPendingAnchor(); },
    cursor: () => this.activeSearchIndex,
    setCursor: (index) => { this.activeSearchIndex = index; },
    changed: () => this.requestUpdate('sourceSearchResult', null),
    emitChange: () => this.emitSearchChange(),
  });
  private readonly sourceCopy = new HierarchySourceCopyController({
    host: this,
    control: this.hierarchy,
    source: () => this.treeSource,
    sinks: {
      clearFeedback: () => this.resetCopyFeedback(),
      feedback: (key, ok) => this.copyFeedback.show(key, ok),
      message: (ok) => this.localize(ok ? 'copied' : 'copyFailed'),
      announce: (message) => this.announcements.announce(message),
      emit: (name, detail) => this.emit(name, detail),
    },
  });

  /** Whole-source inspection provider. Takes display precedence over xml/src; maxNodes, maxRows and expandDepth
   * apply only to legacy XML. The xml setter still parses synchronously. Reassign, including the same identity, or requestUpdate() to refresh.
   * Source search returns at most 10,000 global node hits, independent of maxNodes.
   * @default undefined */
  @property({ attribute: false })
  get treeSource(): XmlViewerTreeSource | undefined { return this._treeSource; }
  set treeSource(value: XmlViewerTreeSource | undefined) {
    const previous = this._treeSource;
    this._treeSource = value;
    this.cancelPendingAnchor();
    this.transport.cancel();
    this.invalidateSourceSearch();
    this.syncSource(true);
    this.requestUpdate('treeSource', previous);
  }

  /** Reveals and focuses an exact provider key; compact keys can address arbitrarily deep nodes.
   * Resolves false when absent, superseded, or no provider is active. */
  revealSourceKey(key: string): Promise<boolean> {
    this.sourceSearch.supersedeSteps();
    this.sourceAnchorTask = undefined;
    this.cancelPendingAnchor();
    return this.treeSource === undefined ? Promise.resolve(false) : this.hierarchy.reveal(key);
  }
  private syncSource(force = false): void {
    if (!this.hierarchy) return;
    const source = this.treeSource;
    const query = this.searchQuery ?? '';
    const locale = this.effectiveLocale;
    const binding = this.sourceBinding;
    if (source === undefined && !this.sourceMode && binding?.source === undefined) return;
    if (!force && binding && binding.source === source && binding.query === query && binding.locale === locale) return;
    this.cancelPendingAnchor();
    this.invalidateSourceSearch();
    this.hierarchy.update(source, locale, force, { search: query, hiddenKinds: [] });
    if (source === this.treeSource && query === (this.searchQuery ?? '') && locale === this.effectiveLocale)
      this.sourceBinding = { source, query, locale };
  }
  private normalizeSourceNode(value: unknown, key: string): LyraInspectionNode {
    const name = hierarchyField(value, 'name');
    const path = hierarchyField(value, 'path');
    const kind = hierarchyField(value, 'kind');
    const text = hierarchyField(value, 'value');
    if (typeof name !== 'string' || name.length > 65_536 || typeof path !== 'string' || path.length > 65_536 || path !== key ||
      typeof kind !== 'string' || !INSPECTION_KINDS.has(kind) || (text !== undefined && (typeof text !== 'string' || text.length > 65_536)))
      throw new TypeError('Invalid inspection node');
    return Object.freeze({ name, path, kind: kind as LyraInspectionNode['kind'], ...(text === undefined ? {} : { value: text as string }) });
  }
  private invalidateSourceSearch(): void {
    this.sourceSearch?.invalidate();
    this.sourceCopy?.invalidate();
    this.sourceAnchorTask = undefined;
    if (this.activeSearchIndex !== undefined && (this._treeSource !== undefined || this.sourceMode)) this.activeSearchIndex = -1;
    if (this.copyFeedback !== undefined) this.resetCopyFeedback();
  }
  private sourceSummary(): string {
    const projection = this.hierarchy.projection;
    return projection ? this.localize('treeSourceSummary', undefined, {
      visible: getNumberFormat(this.effectiveLocale).format(projection.rows.count),
      total: getNumberFormat(this.effectiveLocale).format(projection.total),
    }) : '';
  }
  private sourceCopyButton(node?: LyraInspectionNode): TemplateResult | typeof nothing {
    if (!this.copyable || !hasHierarchySourceCopy(() => this.treeSource)) return nothing;
    const source = this.treeSource;
    const epoch = this.hierarchy.epoch;
    const key = node?.path ?? null;
    const projection = this.hierarchy.projection;
    const label = node ? this.localize('xmlViewerCopyNode', undefined, { name: node.name }) : this.localize('xmlViewerCopyDocument');
    return html`<button part="copy-button" type="button" aria-label=${this.copyButtonLabel(key ?? 'document', label)}
      @keydown=${(event: KeyboardEvent) => event.stopPropagation()}
      @click=${(event: Event) => {
        event.stopPropagation();
        const button = event.currentTarget as HTMLButtonElement;
        if (button.isConnected && button.getRootNode() === this.renderRoot && !this.hierarchy.loading &&
          projection === this.hierarchy.projection && source === this.treeSource && epoch === this.hierarchy.epoch)
          void this.sourceCopy.copy(key, hierarchyCopyScope(node?.kind), this.effectiveMaxBytes, key ?? 'document');
      }}>${this.copyButtonLabel(key ?? 'document', this.localize('copy'))}</button>`;
  }
  private renderSourceNode(node: LyraInspectionNode): TemplateResult {
    const match = this.sourceSearch.isMatch(node.path);
    const active = this.sourceSearch.isActive(node.path);
    const highlight = this.renderedHighlights.get(node.path);
    const source = this.treeSource;
    const epoch = this.hierarchy.epoch;
    const projection = this.hierarchy.projection;
    const highlights = this.highlights;
    const part = node.kind === 'element' ? 'tag' : node.kind === 'attribute' ? 'attribute' : node.kind === 'comment' ? 'comment' : node.kind === 'processing-instruction' ? 'pi' : 'text';
    return html`<span class="syntax" part=${part} ?data-match=${match} ?data-active-match=${active}
      ?data-active=${this.activePath === node.path}
      data-highlight=${highlight ? highlight.highlight.tone ?? 'accent' : nothing}
      ?data-active-highlight=${Boolean(highlight) && highlight!.highlight.id === this.activeHighlightId}
      ><span part=${node.kind === 'attribute' ? 'attribute-name' : 'tag'}>${node.name}</span>${node.value === undefined ? nothing : html`<span part=${node.kind === 'attribute' ? 'attribute-value' : 'text'}>${node.value}</span>`}</span>${this.sourceCopyButton(node)}
      ${highlight ? html`<button type="button" part="highlight-action" aria-label=${this.highlightActionLabel(highlight.highlight, highlight.index, highlight.total)}
        @keydown=${(event: Event) => event.stopPropagation()}
        @click=${(event: Event) => {
          event.stopPropagation();
          const button = event.currentTarget as HTMLButtonElement;
          if (button.isConnected && button.getRootNode() === this.renderRoot && !this.hierarchy.loading &&
            source === this.treeSource && epoch === this.hierarchy.epoch && projection === this.hierarchy.projection &&
            highlights === this.highlights && this.renderedHighlights.get(node.path)?.highlight === highlight.highlight)
            this.emit('lr-highlight-activate', { highlightId: highlight.highlight.id });
        }}>${highlight.highlight.label || this.highlightActionLabel(highlight.highlight, highlight.index, highlight.total)}</button>` : nothing}`;
  }
  private renderSource(): TemplateResult {
    const partial = !this.sourceSearch.exact && Boolean(this.searchQuery);
    const count = this.sourceSearch.count;
    this.renderedHighlights = this.resolveHighlights();
    return html`<div class="source-shell" style=${styleMap({ '--lr-xml-viewer-max-height': sanitizeCssLength(this.maxHeight) ?? 'var(--lr-size-20rem)' })}>
      ${this.copyable && hasHierarchySourceCopy(() => this.treeSource) ? html`<div part="toolbar">${this.sourceCopyButton()}</div>` : nothing}
      ${hierarchySourceView(this.hierarchy, {
        label: hostAriaLabel(this) ?? (this.name || this.localize('xmlViewerLabel')), rtl: this.effectiveDirection === 'rtl', multiple: false,
        loading: this.localize('loading'), error: this.localize('treeSourceError'), empty: this.localize('noData'),
        retry: this.localize('retry'), expand: this.localize('expand'), collapse: this.localize('collapse'), summary: this.sourceSummary(),
        name: node => node.name, content: node => this.renderSourceNode(node), select: () => {},
      })}
      ${partial ? html`<div part="search-status">${this.sourceSearch.unavailable ? this.localize('sourceSearchUnavailable') :
        this.localize('viewerSearchMatchCount', undefined, { count: `≥${getNumberFormat(this.effectiveLocale).format(count)}`, pluralCount: count })}</div>` : nothing}
    </div>`;
  }

  private get effectiveMaxNodes(): number { return Math.max(1, finiteCount(this.maxNodes, MAX_NODES, 500000)); }
  private get effectiveMaxRows(): number { return Math.max(1, finiteCount(this.maxRows, MAX_RENDERED_ROWS, 50000)); }
  private get effectiveMaxBytes(): number { return resolveMaxResourceBytes(this.maxBytes); }

  /** URL to fetch and parse as XML. Ignored once `xml` is set. */
  @property() src = '';

  /** Raw XML text to parse and render, wins over `src`. Setting this parses synchronously;
   *  re-assigning identical text is a no-op. */
  @property({ attribute: false })
  get xml(): string | undefined {
    return this._xml;
  }
  set xml(value: string | undefined) {
    if (value === this._xml) return;
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
  /** Intentionally inert -- `source` is always derived live from `src`/`xml`. A getter with no
   *  setter throws (in strict-mode module code, which every consumer runs) the moment anything
   *  assigns to it, including a stray `.source=${x}` template binding; this no-op keeps that
   *  assignment harmless instead of throwing from inside framework internals. */
  set source(_value: LyraXmlViewerSource) {
    // Deliberate no-op; see getter doc comment above.
  }

  /** Display name used as the viewer's accessible label. */
  @property() name = '';

  /** Elements at or beyond this nesting depth (root = 0) start collapsed, so only the levels above
   *  it start expanded. Omit/undefined: nothing auto-collapses. */
  @property({ type: Number, attribute: 'expand-depth' }) expandDepth?: number;
  /** Shows copy-to-clipboard affordances: one for the whole document, plus one per element. */
  @property({ type: Boolean, reflect: true }) copyable = false;

  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height
   *  instead of growing the page. Invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['node-path'];

  private childCounts = new WeakMap<Node, number>();
  @state() private xmlState: XmlState = { kind: 'idle' };

  /** Per-path (`JSON.stringify(path)`) explicit expand/collapse, overriding the
   *  `expandDepth`/search defaults once an element's toggle has been used. Pruned whenever the
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
  private pendingSearchStateEvent = false;
  private get generation(): number { return this.transport.generation; }
  private readonly transport = new ViewerSourceController(this, {
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.xmlState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this), () => this.localize(error instanceof XmlDoctypeError ? 'xmlViewerParseError' : 'documentPreviewFailedToLoad')) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  private explicitRefresh = 0;
  private highlightDeps?: unknown[];
  private treeMemo?: { deps: unknown[]; template: TemplateResult };
  private readonly nodeElements = new Map<string, Element>();
  private readonly attributeElements = new Map<string, Element>();
  private cursorElements: (Element | undefined)[] = [];

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    // Feedback repaints must preserve the current provider and its clipboard request.
    if (!args.length && this.copyFeedback && this.copyFeedback.state !== this.previousFeedback) {
      this.previousFeedback = this.copyFeedback.state;
      super.requestUpdate();
      return;
    }
    if (this._treeSource !== undefined && args[0] === undefined) { this.invalidateSourceSearch(); this.syncSource(true); }
    if (args[0] === undefined) this.explicitRefresh = (this.explicitRefresh ?? 0) + 1;
    super.requestUpdate(...args);
  }

  private syncCursors(): void {
    const next = [
      this.activePath === null ? undefined : this.nodeElements.get(this.activePath),
      this.activeAttr === null ? undefined : this.attributeElements.get(this.activeAttr),
      this.nodeElements.get(this.searchState.ordered[this.activeSearchIndex] ?? ''),
    ];
    const attributes = ['data-active', 'data-active', 'data-active-match'];
    next.forEach((element, index) => {
      if (this.cursorElements[index] !== element) this.cursorElements[index]?.removeAttribute(attributes[index]!);
      element?.setAttribute(attributes[index]!, '');
    });
    this.cursorElements = next;
  }

  private readonly announcements = new ViewerAnnouncementController(this);
  private readonly copyFeedback = new KeyedCopyFeedback(this);
  private previousFeedback: KeyedCopyFeedback['state'] = null;
  private copyGeneration = 0;

  /** `expandDepth`, normalized to a finite non-negative integer when set -- `undefined`
   *  (nothing auto-collapses) is left as-is, since it's a meaningful, intentional value, not an
   *  invalid one. A raw `NaN` (e.g. an invalid `expand-depth` attribute) would otherwise make
   *  every `depth >= expandDepth` comparison false, silently disabling auto-collapse instead of
   *  falling back to a sane depth. Mirrors `<lr-json-viewer>`'s identical guard. */
  private get safeExpandDepth(): number | undefined {
    return this.expandDepth === undefined ? undefined : finiteCount(this.expandDepth);
  }

  protected override willUpdate(changed: PropertyValues): void {
    const wasSource = this.sourceMode;
    this.syncSource();
    super.willUpdate(changed);
    if (this.treeSource !== undefined) {
      this.sourceMode = true;
      this.treeMemo = undefined;
      if ((changed.has('maxNodes') || changed.has('maxBytes')) && this._xml !== undefined) this.parseInline(this._xml);
      this.sourceSearch.schedule();
      return;
    }
    this.sourceMode = false;
    if (wasSource) {
      this.resetSearchForSourceReplacement();
      if (this._xml !== undefined) this.parseInline(this._xml);
      else this.scheduleAfterUpdate(() => { void this.loadFromSrc(); });
    }
    if ((changed.has('maxNodes') || changed.has('maxBytes')) && this._xml !== undefined) this.parseInline(this._xml);
    if (this.hasUpdated && (changed.has('src') || changed.has('xml'))) this.resetCopyFeedback();
    if (changed.has('src') || changed.has('xml')) {
      this.pendingSearchStateEvent ||= this.resetSearchForSourceReplacement();
    }
    const locale = this.effectiveLocale;
    if (this.lastSearchLocale && locale !== this.lastSearchLocale && this.xmlState.kind === 'loaded') {
      this.searchState = this.computeSearch(this.xmlState.doc);
      this.activeSearchIndex = this.searchState.ordered.length
        ? Math.min(Math.max(0, this.activeSearchIndex), this.searchState.ordered.length - 1)
        : -1;
      if (this.searchQuery !== '') this.pendingSearchStateEvent = true;
    }
    this.lastSearchLocale = locale;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.treeSource !== undefined) {
      const source = this.treeSource;
      const binding = this.sourceBinding;
      const snapshot = captureHierarchySourceEffects(this, this.hierarchy,
        () => source === this.treeSource && binding === this.sourceBinding);
      const { current } = snapshot;
      const error = snapshot.error || snapshot.rowError;
      const message = applyHierarchySourceEffects({ ...snapshot, error }, {
        errorText: () => this.localize('treeSourceError'),
        loadingText: () => this.localize('loading'),
        summary: () => this.sourceSummary(),
        announce: text => { if (!error && !snapshot.loading) this.announcements.announcePolite(text); },
        rowsTransition: (state, text) => this.announcements.transition('source-rows', state, text),
      }, this.lastSourceStatus);
      if (message === undefined) return;
      this.lastSourceStatus = message;
      if (!snapshot.rowError) this.announcements.transition('source', error ? 'error' : snapshot.loading ? 'loading' : 'loaded', message);
      if (!current()) return;
      if (error && this.sourceAnnouncement !== message) this.emit('lr-render-error', { error });
      if (current()) this.sourceAnnouncement = error ? message : undefined;
      return;
    }
    this.syncCursors();
    this.announcements.transition(
      'load',
      this.xmlState.kind,
      this.xmlState.kind === 'error' ? this.xmlState.message() : this.localize('loadingDocument'),
    );
    if ((changed.has('src') || changed.has('xml') || changed.has('maxNodes') || changed.has('maxBytes')) && this._xml === undefined) {
      this.scheduleAfterUpdate(() => {
        void this.loadFromSrc();
      });
    }
    if (this.pendingSearchStateEvent) {
      this.pendingSearchStateEvent = false;
      this.emitSearchChange();
    }
    if (this.isConnected && changed.has('xmlState') && this.xmlState.kind === 'loaded') this.emit('lr-load', {});
  }

  private readonly detached = new DeferredTeardown(() => this.releaseDetachedDocument());

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    this.sourceBinding = undefined;
    this.lastSourceStatus = undefined;
    this.requestUpdate('sourceReconnect', null);
    this.renderRoot.addEventListener('click', this.cancelSourceAnchor, true);
    this.renderRoot.addEventListener('keydown', this.cancelSourceAnchor, true);
    // A move preserves parsed content, but inherited disconnect has aborted any pending transport.
    const moved = this.detached.cancel();
    if (this.hasUpdated && this.src && this._xml === undefined && (!moved || this.xmlState.kind === 'loading')) {
      this.scheduleAfterUpdate(() => {
        void this.loadFromSrc();
      });
    }
  }

  private readonly cancelSourceAnchor = (): void => {
    if (this.treeSource === undefined) return;
    this.cancelPendingAnchor();
    this.sourceSearch.supersedeSteps();
    if (this.sourceAnchorTask) {
      this.sourceAnchorTask = undefined;
      this.hierarchy.cancelPending();
    }
  };

  override disconnectedCallback(): void {
    if (this.xmlState.kind === 'loading') this.transport.cancel();
    this.invalidateSourceSearch();
    this.sourceBinding = undefined;
    this.lastSourceStatus = undefined;
    this.renderRoot.removeEventListener('click', this.cancelSourceAnchor, true);
    this.renderRoot.removeEventListener('keydown', this.cancelSourceAnchor, true);
    this.announcements.disconnect();
    this.resetCopyFeedback();
    super.disconnectedCallback();
    this.detached.schedule();
  }

  private releaseDetachedDocument(): void {
    this.transport.cancel();
    if (this._xml === undefined) this.xmlState = { kind: 'idle' };
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.invalidateSourceSearch();
    this.sourceBinding = undefined;
    this.lastSourceStatus = undefined;
    this.hierarchy.adopted();
    this.detached.flush(); // a move into another document reloads there
    this.announcements.adopted();
    this.resetCopyFeedback();
  }

  private parseInline(raw: string): void {
    this.transport.cancel();
    const generation = this.transport.generation;
    this.pendingSearchStateEvent ||= this.resetSearchForSourceReplacement();
    try {
      this.setDoc(parseXmlDocument(raw, this.ownerDocument, this.effectiveMaxBytes, this.effectiveMaxNodes), generation);
    } catch (error) {
      this.xmlState = {
        kind: 'error',
        message: isResourceLimitError(error)
          ? () => this.localize('xmlViewerTooManyNodes')
          : () => this.localize('xmlViewerParseError'),
      };
      this.emit('lr-render-error', { error });
    }
  }

  private async loadFromSrc(): Promise<void> {
    if (this.treeSource !== undefined || this._xml !== undefined) return;
    this.pendingSearchStateEvent ||= this.resetSearchForSourceReplacement();
    this.xmlState = this.src ? { kind: 'loading' } : { kind: 'idle' };
    await this.transport.begin(this.src);
  }

  private async readDocument(response: Response, token: ViewerSourceToken): Promise<void> {
    const text = await this.transport.readText(response, this.effectiveMaxBytes);
    if (this.transport.isStale(token)) return;
    preflightXml(text, this.effectiveMaxBytes, this.effectiveMaxNodes);
    await yieldViewerTask(this.ownerDocument.defaultView, () => !this.transport.isStale(token));
    if (this.transport.isStale(token)) return;
    this.setDoc(parseXmlDocument(text, this.ownerDocument, this.effectiveMaxBytes, this.effectiveMaxNodes, true), token.generation);
  }

  private resetSearchForSourceReplacement(): boolean {
    if (this.treeSource !== undefined) return false;
    const changed = this.searchQuery !== ''
      || this.searchState.ordered.length > 0
      || !this.searchState.matchCountExact
      || this.activeSearchIndex !== -1;
    this.searchQuery = '';
    this.searchState = EMPTY_SEARCH;
    this.activeSearchIndex = -1;
    return changed;
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
      this.xmlState = { kind: 'error', message: () => this.localize('xmlViewerParseError') };
      this.emit('lr-render-error', { error: new Error(parseError) });
      return;
    }
    try {
      this.childCounts = validateDocumentComplexity(doc, this.effectiveMaxNodes);
    } catch (error) {
      this.xmlState = { kind: 'error', message: () => this.localize('xmlViewerTooManyNodes') };
      this.emit('lr-render-error', { error });
      return;
    }
    this.xmlState = { kind: 'loaded', doc };
    if (this.treeSource !== undefined) return;
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
    if (!query && !this.expandedOverrides.size && boundedQuery.accepted) return EMPTY_SEARCH;
    const budget = new ViewerSearchWorkBudget();
    const matches = new Set<string>();
    const tagMatches = new Set<string>();
    const attrMatches = new Set<string>();
    const textMatches = new Set<string>();
    const forceExpand = new Set<string>();
    const paths = new Set<string>();
    const ordered: string[] = [];
    let matchCountExact = boundedQuery.accepted;

    const ancestors: string[] = [];
    const walk = (el: Element, pathKey: string): void => {
      if (this.expandedOverrides.size) paths.add(pathKey);
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
            for (let i = ancestors.length - 1; i >= 0; i--) {
              const ancestor = ancestors[i]!;
              if (forceExpand.has(ancestor)) break;
              forceExpand.add(ancestor);
            }
          }
        }
      }
      ancestors.push(pathKey);
      const prefix = pathKey === '[]' ? '[' : pathKey.slice(0, -1) + ',';
      elementChildren(el).forEach((child, i) => walk(child, `${prefix}${i}]`));
      ancestors.pop();
    };

    if (doc.documentElement) walk(doc.documentElement, '[]');
    return { matches, tagMatches, attrMatches, textMatches, forceExpand, paths, ordered, matchCountExact };
  }

  private sourcePathKey(path: unknown): string | undefined {
    if (!Array.isArray(path) || path.length > MAX_DEPTH) return undefined;
    const segments: PathSegment[] = [];
    for (let index = 0; index < path.length; index++) {
      const segment = hierarchyField(path, String(index));
      if (typeof segment === 'number' && Number.isSafeInteger(segment) && segment >= 0) segments.push(segment);
      else if (typeof segment === 'string' && index === path.length - 1 && segment.startsWith('@') && segment.length > 1 && segment.length <= 65_536) segments.push(segment);
      else return undefined;
    }
    const key = JSON.stringify(segments);
    return key.length <= 65_536 ? key : undefined;
  }

  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.treeSource !== undefined) {
      const key = anchor.kind === 'node-path' ? this.sourcePathKey(anchor.path) : undefined;
      if (key === undefined) return false;
      const task = {};
      this.sourceAnchorTask = task;
      try {
        const found = await this.hierarchy.reveal(key);
        if (!found || this.sourceAnchorTask !== task) return false;
        this.activePath = key;
        await this.updateComplete;
        return this.sourceAnchorTask === task;
      } finally {
        if (this.sourceAnchorTask === task) this.sourceAnchorTask = undefined;
      }
    }
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
    await this.updateComplete;
    return this.renderRoot.querySelector('[part="node"][data-active]') !== null;
  }

  /**
   * Host-supplied `highlights` resolved against the loaded document, keyed by the rendered path key
   * of the element each one addresses. Entries are deduplicated by public `id` (a host re-sending
   * the same citation must not paint twice), then filtered down to `node-path` anchors this
   * document can actually resolve -- an unresolvable entry is dropped whole rather than painted at
   * some coarser granularity. `index`/`total` position each surviving entry for its localized
   * accessible name, exactly as `<lr-svg-viewer>` numbers its own region highlights; two entries
   * resolving to the SAME element still both count toward `total`, while the first retained one
   * owns that row's paint. Painting retains at most 100 resolved entries from a 1,000-entry
   * candidate window; an active entry anywhere in the bounded host snapshot is placed first and
   * retained inside both ceilings.
   */
  private resolveHighlights(): Map<string, { highlight: LyraHighlight; index: number; total: number }> {
    const byPath = new Map<string, { highlight: LyraHighlight; index: number; total: number }>();
    if (this.treeSource !== undefined) {
      const admitted: Array<{ highlight: LyraHighlight; key: string }> = [];
      const seen = new Set<string>();
      for (const highlight of prioritizedHighlightCandidates(this.highlights, this.activeHighlightId)) {
        if (seen.has(highlight.id)) continue;
        seen.add(highlight.id);
        const key = highlight.anchor.kind === 'node-path' ? this.sourcePathKey(highlight.anchor.path) : undefined;
        if (key !== undefined) admitted.push({ highlight, key });
        if (admitted.length >= MAX_PAINTED_HIGHLIGHTS) break;
      }
      admitted.forEach(({ highlight, key }, index) => { if (!byPath.has(key)) byPath.set(key, { highlight, index, total: admitted.length }); });
      return byPath;
    }
    if (this.xmlState.kind !== 'loaded') return byPath;
    const root = this.xmlState.doc.documentElement;
    if (!root) return byPath;
    const seen = new Set<string>();
    const resolved: Array<{ highlight: LyraHighlight; pathKey: string }> = [];
    const candidates = prioritizedHighlightCandidates(this.highlights, this.activeHighlightId);
    const resolutionBudget: PathResolutionBudget = { remaining: this.effectiveMaxNodes };
    for (const highlight of candidates) {
      if (seen.has(highlight.id)) continue;
      seen.add(highlight.id);
      if (highlight.anchor.kind !== 'node-path') continue;
      if (!resolvePath(root, highlight.anchor.path, resolutionBudget)) continue;
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

  private expandAncestors(path: readonly PathSegment[], includeSelf = false): void {
    let next: Map<string, boolean> | undefined;
    const expand = (key: string, depth: number): void => {
      if (this.isExpanded(key, depth)) return;
      next ??= new Map(this.expandedOverrides);
      next.set(key, true);
    };
    for (let i = 0; i < path.length; i++) {
      if (typeof path[i] === 'number') expand(JSON.stringify(path.slice(0, i)), i);
    }
    if (includeSelf) expand(JSON.stringify(path), path.length);
    if (next) this.expandedOverrides = next;
  }

  /** Case-insensitive substring search over every element's tag name, attribute names/values,
   *  and own text, layered over the already-parsed document -- accepts at most 4,096 query code
   *  units, scans at most 4,000,000 code units, resolves at most 10,000 retained matches, and fires
   *  `lr-search-change`; `detail.matchCountExact=false` identifies a ceiling-truncated lower
   *  bound. Replacing the source invalidates document-relative matches and emits the canonical
   *  empty `lr-search-change` reset. Imperative navigation reopens the active match and its
   *  ancestors, including manually collapsed nodes; later manual collapse still takes precedence. */
  async search(query: string): Promise<number> {
    if (this.treeSource !== undefined) {
      this.cancelPendingAnchor();
      this.searchQuery = query;
      this.invalidateSourceSearch();
      this.syncSource();
      const intent = this.sourceSearch.generation;
      this.requestUpdate('sourceSearchIntent', null);
      await this.updateComplete;
      return intent === this.sourceSearch.generation ? this.sourceSearch.task : 0;
    }
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
    if (this.treeSource !== undefined) return this.sourceSearch.step(1);
    if (!this.searchState.ordered.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchState.ordered.length;
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `true` once the
   *  active match moved, `false` when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (this.treeSource !== undefined) return this.sourceSearch.step(-1);
    if (!this.searchState.ordered.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchState.ordered.length) % this.searchState.ordered.length;
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  clearSearch(): void {
    this.cancelPendingAnchor();
    if (this.treeSource !== undefined) {
      this.searchQuery = '';
      this.hierarchy.cancelSearch();
      this.invalidateSourceSearch();
      this.syncSource();
      this.requestUpdate('sourceSearchIntent', null);
      return;
    }
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
    const pathKey = this.searchState.ordered[this.activeSearchIndex];
    if (pathKey === undefined) return;
    // Search keys are bounded numeric paths created from the parsed document.
    this.expandAncestors(JSON.parse(pathKey) as PathSegment[], true);
    await this.updateComplete;
    const active = this.renderRoot.querySelector('[data-active-match]') as HTMLElement | null;
    active?.scrollIntoView({
      behavior: prefersReducedMotion(this) ? 'auto' : 'smooth',
      block: 'center',
    });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.treeSource !== undefined ? this.sourceSearch.count : this.searchState.ordered.length,
      matchCountExact: this.treeSource !== undefined ? this.sourceSearch.exact : this.searchState.matchCountExact,
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
    const expandDepth = this.safeExpandDepth;
    if (expandDepth !== undefined && depth >= expandDepth) return false;
    return true;
  }

  private resetCopyFeedback(): void {
    this.copyGeneration++;
    this.copyFeedback.clear();
  }

  private async copyText(text: string, key: string): Promise<void> {
    if (this.treeSource !== undefined) return;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const generation = ++this.copyGeneration;
    this.copyFeedback.clear();
    const outcome = await writeClipboardText(owner, text);
    if (
      !owner
      || !this.isConnected
      || generation !== this.copyGeneration
      || this.ownerDocument.defaultView !== owner
    ) return;
    if (outcome.ok) {
      this.copyFeedback.show(key, true);
      this.emit('lr-copy', outcome);
      return;
    }
    this.copyFeedback.show(key, false);
    const { src, xml } = this;
    this.emit('lr-error');
    if (this.isConnected && generation === this.copyGeneration && this.ownerDocument.defaultView === owner
      && this.treeSource === undefined && this.src === src && this.xml === xml) {
      this.emit('lr-copy-error', outcome);
    }
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
    const feedback = this.copyFeedback.for(key);
    return feedback ? this.localize(feedback.ok ? 'copied' : 'copyFailed') : rest;
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

  private renderNode(el: Element, path: PathSegment[], depth: number, budget: RenderBudget): TemplateResult | typeof nothing {
    if (budget.remaining-- <= 0) {
      budget.truncated = true;
      return nothing;
    }
    const pathKey = JSON.stringify(path);
    const childCount = this.childCounts.get(el) ?? 0;
    const hasChildren = childCount > 0;
    const expanded = hasChildren && this.isExpanded(pathKey, depth);
    const indentStyle = `padding-inline-start:calc(${depth} * var(--lr-space-l))`;
    const isMatch = this.searchState.matches.has(pathKey);
    const activeMatchKey = this.searchState.ordered[this.activeSearchIndex];
    const highlight = this.renderedHighlights.get(pathKey);
    const toggleLabel = el.tagName;
    let elementIndex = 0;
    // A collapsed node's descendants are never shown, so their rows are not built at all.
    const childRows: Array<TemplateResult | typeof nothing> = [];
    if (expanded) for (let node = el.firstChild; node; node = node.nextSibling) {
      if (!isRenderedXmlChild(node)) continue;
      if (budget.remaining <= 0) {
        budget.truncated = true;
        break;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        childRows.push(this.renderNode(node as Element, [...path, elementIndex++], depth + 1, budget));
        continue;
      }
      budget.remaining--;
      if (node.nodeType === Node.TEXT_NODE) {
        childRows.push(html`<div part="text" class="row" style=${indentStyle} ?data-match=${this.searchState.textMatches.has(pathKey)}>${node.textContent}</div>`);
        continue;
      }
      if (node.nodeType === Node.COMMENT_NODE) {
        childRows.push(html`<div part="comment" class="row" style=${indentStyle}>&lt;!--${node.textContent}--&gt;</div>`);
        continue;
      }
      if (node.nodeType === Node.CDATA_SECTION_NODE) {
        childRows.push(html`<div part="cdata" class="row" style=${indentStyle}>&lt;![CDATA[${node.textContent}]]&gt;</div>`);
        continue;
      }
      childRows.push(html`<div part="pi" class="row" style=${indentStyle}>&lt;?${(node as ProcessingInstruction).target} ${node.textContent}?&gt;</div>`);
    }

    return html`
      <div
        part="node"
        ${ref(element => { if (element) this.nodeElements.set(pathKey, element); })}
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
        <span class="syntax"
          >&lt;<span part="tag" ?data-match=${this.searchState.tagMatches.has(pathKey)}>${el.tagName}</span
          >${Array.from(el.attributes).map(
            (a) => html` <span part="attribute"
              ${ref(element => { if (element) this.attributeElements.set(attrKey(pathKey, a.name), element); })}
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
                childCount,
              ),
              pluralCount: childCount,
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
      ${childRows}
    `;
  }

  private renderLoadedTree(doc: Document): TemplateResult {
    const deps = [doc, this.searchState, this.expandedOverrides, this.expandDepth, this.copyable,
      this.copyFeedback.state, this.renderedHighlights, this.activeHighlightId, this.strings,
      this.effectiveLocale, lyraLocaleCatalogVersion(this.effectiveLocale), this.explicitRefresh, this.effectiveMaxRows];
    if (this.treeMemo && deps.every((value, index) => value === this.treeMemo!.deps[index])) return this.treeMemo.template;
    this.nodeElements.clear();
    this.attributeElements.clear();
    const template = this.buildLoadedTree(doc);
    this.treeMemo = { deps, template };
    return template;
  }

  private buildLoadedTree(doc: Document): TemplateResult {
    const budget: RenderBudget = { remaining: this.effectiveMaxRows, truncated: false };
    const tree = this.renderNode(doc.documentElement, [], 0, budget);
    return html`<div part="tree">${tree}</div>${budget.truncated
      ? html`<p part="limit">${this.localize('xmlViewerLimit', undefined, {
          count: getNumberFormat(this.effectiveLocale).format(this.effectiveMaxRows),
        })}</p>`
      : nothing}`;
  }

  override render(): TemplateResult {
    if (this.treeSource !== undefined) return this.renderSource();
    const maxHeight = sanitizeCssLength(this.maxHeight);
    const label = viewerSemanticLabel(this, this.name || this.localize('xmlViewerLabel'));
    const state = this.xmlState;
    const highlightDeps = [state, this.highlights, this.activeHighlightId, this.effectiveMaxNodes];
    if (!this.highlightDeps || highlightDeps.some((value, index) => value !== this.highlightDeps![index])) {
      this.highlightDeps = highlightDeps;
      this.renderedHighlights = this.resolveHighlights();
    }
    return html`
      <div
        part="base"
        role=${viewerSemanticRole(this, 'region') ?? nothing}
        style=${maxHeight
          ? styleMap({ '--lr-xml-viewer-max-height': maxHeight })
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
          ? this.renderLoadedTree(state.doc)
          : state.kind === 'loading'
            ? renderViewerLoading(this.localize('loadingDocument'))
            : state.kind === 'error'
              ? html`<div part="error">${state.message()}</div>`
              : html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`}
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
