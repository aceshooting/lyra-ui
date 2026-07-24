import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../../internal/anchor-target.js';
import type { LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import {
  isAbortError,
  isResourceLimitError,
  readResponseText,
  LyraResourceLimitError,
  LyraUserFacingError,
} from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteCount } from '../../../internal/numbers.js';
import { styles } from './xml-viewer.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';

const MAX_NODES = 50_000;
const MAX_DEPTH = 256;

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
}

const EMPTY_SEARCH: SearchState = {
  matches: new Set(),
  tagMatches: new Set(),
  attrMatches: new Set(),
  textMatches: new Set(),
  forceExpand: new Set(),
  paths: new Set(),
  ordered: [],
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

function validateDocumentComplexity(node: Node): void {
  const pending: Array<{ node: Node; depth: number }> = [{ node, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const current = pending.pop()!;
    count++;
    if (count > MAX_NODES || current.depth > MAX_DEPTH) throw new LyraResourceLimitError();
    for (const child of Array.from(current.node.childNodes)) {
      pending.push({ node: child, depth: current.depth + 1 });
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
      return { element: current, attr: segment.slice(1) };
    }
    const children = elementChildren(current);
    if (segment < 0 || segment >= children.length) return null;
    current = children[segment]!; // safe: bounds checked on the line above
  }
  return { element: current };
}

export interface LyraXmlViewerEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * `<lr-xml-viewer>` — collapsible, copyable, `DOMParser`-based tree view for XML documents,
 * mirroring `lr-json-viewer`'s UX (`collapsed-depth`, `copyable`, structural-path-keyed expand
 * state that survives a same-shape `xml` reassignment -- e.g. a streaming document being patched
 * in place) adapted for XML's own node kinds: elements with attributes, text, comments, CDATA
 * sections, and processing instructions.
 *
 * Search is a purely imperative surface (`search()`/`searchNext()`/`searchPrevious()`/
 * `clearSearch()`), the same uniform contract every anchor-target, search-capable viewer in this
 * library implements (`lr-pdf-viewer`, `lr-ebook-viewer`, `lr-notebook-viewer`) rather than
 * a settable property. `node-path` anchors address an element by child-index chain from the
 * document root, with an optional trailing `'@attrName'` segment addressing one of that
 * element's attributes.
 *
 * Namespace-literal: qualified names render exactly as authored, with no namespace-URI-aware
 * matching. `DOMParser` never resolves external entities or DTDs, so XXE injection is
 * structurally out of reach.
 *
 * @customElement lr-xml-viewer
 * @event lr-copy - `detail: { text }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match
 *   index changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: {
 *   query, matchCount, activeIndex }`.
 * @event lr-render-error - Fired when fetching or parsing the document fails, including a
 *   parse error or exceeding the node cap. `detail: { error }`.
 * @csspart base - The root scroll container.
 * @csspart toolbar - The whole-document copy button row (only when `copyable`).
 * @csspart copy-button - A copy-to-clipboard button -- the whole-document one (in `toolbar`) or a
 *   per-node one (only when `copyable`).
 * @csspart tree - The rendered node tree.
 * @csspart node - One element row (`data-active` while it's the resolved anchor target,
 *   `data-match` while any part of it matches the current search, `data-active-match` while it's
 *   the currently active search match).
 * @csspart tag - An element's tag name (`data-match`).
 * @csspart attribute - One attribute's name/value pair wrapper.
 * @csspart attribute-name - An attribute's name.
 * @csspart attribute-value - An attribute's value (`data-match`).
 * @csspart text - A text leaf (`data-match`).
 * @csspart comment - A comment leaf.
 * @csspart cdata - A CDATA section leaf.
 * @csspart pi - A processing-instruction leaf.
 * @csspart toggle - An element's expand/collapse button (hidden, but present for row alignment,
 *   on leaf/empty elements).
 * @csspart error - The error region.
 * @csspart spinner - The loading status region.
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
 */
export class LyraXmlViewer extends DocumentAnchorTarget(LyraElement) {
  static override styles = [LyraElement.styles, styles, srOnly];

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

  /** Display name used as the viewer's accessible label. */
  @property() name = '';

  /** Elements at or beyond this nesting depth (root = 0) start collapsed. Omit/undefined:
   *  nothing auto-collapses. */
  @property({ type: Number, attribute: 'collapsed-depth' }) collapsedDepth?: number;

  /** Shows copy-to-clipboard affordances: one for the whole document, plus one per element. */
  @property({ type: Boolean, reflect: true }) copyable = false;

  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height
   *  instead of growing the page. */
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
  @state() private activeSearchIndex = -1;

  private searchQuery = '';
  private searchState: SearchState = EMPTY_SEARCH;
  private lastSearchLocale = '';
  private generation = 0;

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
    if ((changed.has('src') || changed.has('xml')) && this._xml === undefined) {
      this.scheduleAfterUpdate(() => {
        void this.loadFromSrc();
      });
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
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
    super.disconnectedCallback();
  }

  private parseInline(raw: string): void {
    const generation = ++this.generation;
    try {
      const doc = new DOMParser().parseFromString(raw, 'application/xml');
      this.setDoc(doc, generation);
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
    const url = safeFetchUrl(this.src);
    if (!url) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.xmlState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.xmlState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      this.setDoc(new DOMParser().parseFromString(text, 'application/xml'), generation);
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.xmlState = {
        kind: 'error',
        message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'),
      };
      this.emit('lr-render-error', { error });
    }
  }

  private setDoc(doc: Document, generation: number): void {
    if (generation !== this.generation) return;
    const parseError = findParserError(doc);
    if (parseError) {
      // The rendered role="alert" text is always this component's own stable, localized
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
    const query = this.searchQuery.trim().toLocaleLowerCase(locale);
    const matches = new Set<string>();
    const tagMatches = new Set<string>();
    const attrMatches = new Set<string>();
    const textMatches = new Set<string>();
    const forceExpand = new Set<string>();
    const paths = new Set<string>();
    const ordered: string[] = [];

    const markAncestors = (path: PathSegment[]): void => {
      for (let i = path.length - 1; i >= 0; i--) forceExpand.add(JSON.stringify(path.slice(0, i)));
    };

    const walk = (el: Element, path: PathSegment[]): void => {
      const pathKey = JSON.stringify(path);
      paths.add(pathKey);
      if (query) {
        let hit = false;
        if (el.tagName.toLocaleLowerCase(locale).includes(query)) {
          tagMatches.add(pathKey);
          hit = true;
        }
        for (const attr of Array.from(el.attributes)) {
          if (
            attr.name.toLocaleLowerCase(locale).includes(query) ||
            attr.value.toLocaleLowerCase(locale).includes(query)
          ) {
            attrMatches.add(attrKey(pathKey, attr.name));
            hit = true;
          }
        }
        const ownText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .toLocaleLowerCase(locale);
        if (ownText.includes(query)) {
          textMatches.add(pathKey);
          hit = true;
        }
        if (hit) {
          matches.add(pathKey);
          ordered.push(pathKey);
          // Reveals the match itself, not just its ancestors -- a text match specifically is
          // gated behind its own element's expand state (see the SearchState.forceExpand doc).
          forceExpand.add(pathKey);
          markAncestors(path);
        }
      }
      elementChildren(el).forEach((child, i) => walk(child, [...path, i]));
    };

    if (doc.documentElement) walk(doc.documentElement, []);
    return { matches, tagMatches, attrMatches, textMatches, forceExpand, paths, ordered };
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'node-path' || this.xmlState.kind !== 'loaded' || !this.xmlState.doc.documentElement) return false;
    const resolved = resolvePath(this.xmlState.doc.documentElement, anchor.path);
    if (!resolved) return false;
    const numericPath = anchor.path.filter((s): s is number => typeof s === 'number');
    this.expandAncestors(anchor.path);
    this.activePath = JSON.stringify(numericPath);
    return true;
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
   *  and own text, layered over the already-parsed document -- resolves the match count and
   *  fires `lr-search-change`. Matches are re-derived automatically whenever the document
   *  reloads with the same query still set (see `setDoc()`). */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.searchState = this.xmlState.kind === 'loaded' ? this.computeSearch(this.xmlState.doc) : EMPTY_SEARCH;
    this.activeSearchIndex = this.searchState.ordered.length ? 0 : -1;
    this.requestUpdate();
    this.emitSearchChange();
    return this.searchState.ordered.length;
  }

  searchNext(): void {
    if (!this.searchState.ordered.length) return;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchState.ordered.length;
    this.emitSearchChange();
  }

  searchPrevious(): void {
    if (!this.searchState.ordered.length) return;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchState.ordered.length) % this.searchState.ordered.length;
    this.emitSearchChange();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchState = this.xmlState.kind === 'loaded' ? this.computeSearch(this.xmlState.doc) : EMPTY_SEARCH;
    this.activeSearchIndex = -1;
    this.requestUpdate();
    this.emitSearchChange();
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchState.ordered.length,
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

  private writeClipboard(text: string): void {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers, and some engines
      // throw synchronously rather than rejecting -- either way this is best-effort; copyText()
      // below always emits lr-copy regardless of whether the OS clipboard was actually reached.
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // see above
    }
  }

  private copyText(text: string): void {
    this.writeClipboard(text);
    this.emit('lr-copy', { text });
  }

  private renderCopyButton(getText: () => string, name: string): TemplateResult | typeof nothing {
    if (!this.copyable) return nothing;
    return html`
      <button
        part="copy-button"
        type="button"
        aria-label=${this.localize('xmlViewerCopyNode', undefined, { name })}
        @click=${(e: Event) => {
          e.stopPropagation();
          this.copyText(getText());
        }}
      >
        ${this.localize('copy')}
      </button>
    `;
  }

  private renderNode(el: Element, path: PathSegment[], depth: number): TemplateResult {
    const pathKey = JSON.stringify(path);
    const children = elementChildren(el);
    const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim());
    const commentNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.COMMENT_NODE);
    const cdataNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.CDATA_SECTION_NODE);
    const piNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.PROCESSING_INSTRUCTION_NODE);
    const hasChildren = children.length > 0 || textNodes.length > 0 || commentNodes.length > 0 || cdataNodes.length > 0 || piNodes.length > 0;
    const expanded = hasChildren && this.isExpanded(pathKey, depth);
    const indentStyle = `padding-inline-start:calc(${depth} * var(--lr-space-l))`;
    const isMatch = this.searchState.matches.has(pathKey);
    const activeMatchKey = this.searchState.ordered[this.activeSearchIndex];
    const toggleLabel = el.tagName;

    return html`
      <div
        part="node"
        class="row"
        style=${indentStyle}
        ?data-active=${this.activePath === pathKey}
        ?data-match=${isMatch}
        ?data-active-match=${isMatch && pathKey === activeMatchKey}
      >
        <button
          part="toggle"
          type="button"
          ?hidden=${!hasChildren}
          tabindex=${hasChildren ? nothing : -1}
          aria-hidden=${hasChildren ? nothing : 'true'}
          aria-expanded=${hasChildren ? (expanded ? 'true' : 'false') : nothing}
          aria-label=${
            hasChildren
              ? this.localize(expanded ? 'xmlViewerCollapseNode' : 'xmlViewerExpandNode', undefined, { name: toggleLabel })
              : nothing
          }
          @click=${() => hasChildren && this.toggleNode(pathKey, expanded)}
        >
          <span class="chevron">${chevronIcon()}</span>
        </button>
        <span
          >&lt;<span part="tag" ?data-match=${this.searchState.tagMatches.has(pathKey)}>${el.tagName}</span
          >${Array.from(el.attributes).map(
            (a) => html` <span part="attribute"
              ><span part="attribute-name">${a.name}</span>="<span
                part="attribute-value"
                ?data-match=${this.searchState.attrMatches.has(attrKey(pathKey, a.name))}
                >${a.value}</span
              >"</span
            >`,
          )}&gt;</span
        >
        ${!expanded && hasChildren
          ? html`<span class="preview">${this.localize(
              children.length === 1 ? 'xmlViewerChildCount' : 'xmlViewerChildCountPlural',
              undefined,
              { count: getNumberFormat(this.effectiveLocale).format(children.length) },
            )}</span>`
          : nothing}
        ${this.renderCopyButton(() => new XMLSerializer().serializeToString(el), toggleLabel)}
      </div>
      ${expanded
        ? html`
            ${children.map((child, i) => this.renderNode(child, [...path, i], depth + 1))}
            ${textNodes.map(
              (n) => html`<div part="text" class="row" style=${indentStyle} ?data-match=${this.searchState.textMatches.has(pathKey)}>${n.textContent}</div>`,
            )}
            ${commentNodes.map((n) => html`<div part="comment" class="row" style=${indentStyle}>&lt;!--${n.textContent}--&gt;</div>`)}
            ${cdataNodes.map((n) => html`<div part="cdata" class="row" style=${indentStyle}>&lt;![CDATA[${n.textContent}]]&gt;</div>`)}
            ${piNodes.map(
              (n) => html`<div part="pi" class="row" style=${indentStyle}>&lt;?${(n as ProcessingInstruction).target} ${n.textContent}?&gt;</div>`,
            )}
          `
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('xmlViewerLabel');
    const state = this.xmlState;
    return html`
      <div
        part="base"
        role="region"
        style=${this.maxHeight ? `--lr-xml-viewer-max-height:${this.maxHeight}` : nothing}
        aria-label=${label}
        aria-busy=${state.kind === 'loading' ? 'true' : 'false'}
      >
        ${this.copyable && state.kind === 'loaded'
          ? html`
              <div part="toolbar">
                <button
                  part="copy-button"
                  type="button"
                  aria-label=${this.localize('xmlViewerCopyDocument')}
                  @click=${() => this.copyText(new XMLSerializer().serializeToString(state.doc))}
                >
                  ${this.localize('copy')}
                </button>
              </div>
            `
          : nothing}
        ${state.kind === 'loaded' && state.doc.documentElement
          ? html`<div part="tree">${this.renderNode(state.doc.documentElement, [], 0)}</div>`
          : state.kind === 'loading'
            ? html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`
            : state.kind === 'error'
              ? html`<div part="error" role="alert">${state.message}</div>`
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
