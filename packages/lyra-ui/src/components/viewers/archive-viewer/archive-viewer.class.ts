import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { srOnly } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { fileIcon, folderIcon } from '../../../internal/icons.js';
import { isAbortError, isResourceLimitError, readResponseArrayBuffer, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  boundedSelectionRects,
  boundedSelectionText,
  buildQuoteAnchor,
  resolveTextQuote,
  scopeFromElement,
} from '../../../internal/text-quote.js';
import { FILE_SIZE_UNIT_KEYS, formatFileSize } from '../../media/attachment-chip/attachment-chip.class.js';
import type { LyraAnchor } from '../document-viewer/anchors.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { assertZipArchiveMetadataWithinLimits } from './zip-resource-guard.js';
import { styles, virtualListHighlightStyles } from './archive-viewer.styles.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_archiveViewerEmpty, LYRA_DEFAULT_archiveViewerFile, LYRA_DEFAULT_archiveViewerFolder, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_loading, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ArchiveEntry { name: string; dir: boolean; size: number; }
type ArchiveState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; entries: ArchiveEntry[] } | { kind: 'error'; message: string };
export interface LyraArchiveViewerEventMap extends LyraTextViewerTargetEventMap { 'lr-render-error': CustomEvent<{ error: unknown }>; }

const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
class LyraArchiveViewerBase extends LyraElement<LyraArchiveViewerEventMap> {}
const ArchiveTextViewerTargetBase = TextViewerTarget(LyraArchiveViewerBase);

function archiveSelectionRange(viewer: LyraElement, contentRoot: Element): Range | null {
  const document = viewer.ownerDocument;
  const view = document.defaultView;
  const nestedRoot = contentRoot.getRootNode();
  const outerRoot = viewer.shadowRoot;
  const ShadowRootCtor = view?.ShadowRoot;
  const shadowRoots = [outerRoot, nestedRoot].filter(
    (root, index, roots): root is ShadowRoot => (
      ShadowRootCtor !== undefined
      && root instanceof ShadowRootCtor
      && roots.indexOf(root) === index
    ),
  );
  const globalSelection = view?.getSelection() as
    | (Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] })
    | null
    | undefined;
  if (globalSelection?.getComposedRanges) {
    const [composed] = globalSelection.getComposedRanges({ shadowRoots });
    if (composed && (
      composed.startContainer !== composed.endContainer
      || composed.startOffset !== composed.endOffset
    )) {
      const range = document.createRange();
      range.setStart(composed.startContainer, composed.startOffset);
      range.setEnd(composed.endContainer, composed.endOffset);
      return range;
    }
  }
  const nestedSelection = (
    nestedRoot as { getSelection?: () => Selection | null }
  ).getSelection?.();
  const selection = nestedSelection ?? globalSelection ?? null;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  return selection.getRangeAt(0);
}

/** Lists names and declared uncompressed sizes in a ZIP archive without rendering entry contents
 * or loading an archive parser. One owned central-directory parser is the listing and validation
 * authority: it enforces the 10,000-entry and 100 MB declared-expansion ceilings, validates local
 * header bounds and supported compression methods, and never inflates entry bodies.
 * Fragment anchors use the exact ZIP entry path as their `id`; text-quote anchors resolve against
 * each complete entry path before the matching virtual row is scrolled into view. Text selections
 * and painted highlights are likewise scoped to entry paths rendered in the nested virtual list.
 *
 * @customElement lr-archive-viewer
 * @event lr-render-error - Fired when fetching or parsing the archive fails.
 * @event lr-search-change - Fired when archive-path search state or its active match changes.
 *   Search accepts at most 4,096 query code units and scans at most 4,000,000 path code units;
 *   `detail.matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @event lr-text-select - Fired after a selection within one entry path. `detail: { text, anchor,
 *   rects }`; `anchor` is an entry-scoped text quote, or `null` when it cannot be anchored.
 * @event lr-anchor-result - Fired after an `anchor` assignment or `scrollToAnchor()` call is
 *   applied. `detail: { found }`.
 * @csspart base - The root container with explicit `aria-busy` loading state.
 * @csspart body - The archive listing body.
 * @csspart entry - An archive entry row.
 * @csspart entry-icon - The decorative folder or file icon.
 * @csspart entry-name - The entry path.
 * @csspart entry-name-dir - The entry path of a directory row (also carries `entry-name`).
 * @csspart entry-size - The human-readable file size.
 * @csspart highlight - A painted entry-path highlight (`<mark>` fallback path only).
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @csspart error - The error region.
 * @cssprop --lr-archive-viewer-highlight-accent-background - Accent highlight background.
 * @cssprop --lr-archive-viewer-highlight-success-background - Success highlight background.
 * @cssprop --lr-archive-viewer-highlight-warning-background - Warning highlight background.
 * @cssprop --lr-archive-viewer-highlight-danger-background - Danger highlight background.
 * @cssprop --lr-archive-viewer-highlight-neutral-background - Neutral highlight background.
 * @cssprop --lr-archive-viewer-highlight-active-background - Active highlight background.
 * @cssprop --lr-archive-viewer-highlight-active-outline - Active fallback-highlight outline.
 * @status stable
 * @since 4.0.0
 */
export class LyraArchiveViewer extends ArchiveTextViewerTargetBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    archiveViewerEmpty: LYRA_DEFAULT_archiveViewerEmpty,
    archiveViewerFile: LYRA_DEFAULT_archiveViewerFile,
    archiveViewerFolder: LYRA_DEFAULT_archiveViewerFolder,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    fileSizeUnitB: LYRA_DEFAULT_fileSizeUnitB,
    fileSizeUnitGb: LYRA_DEFAULT_fileSizeUnitGb,
    fileSizeUnitKb: LYRA_DEFAULT_fileSizeUnitKb,
    fileSizeUnitMb: LYRA_DEFAULT_fileSizeUnitMb,
    fileSizeUnitTb: LYRA_DEFAULT_fileSizeUnitTb,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly, viewerLoadingStyles];
  /** URL to fetch and parse as a ZIP archive. */
  @property() src = '';
  /** Display name used on the shadow listing owner when host `aria-label` is absent. A non-empty
   *  host label remains on the host; an explicitly empty one is preserved on the shadow owner. */
  @property() name = '';

  /** Case-insensitive search over loaded entry paths, with next/previous navigation that scrolls
   * the active virtualized row into view. Queries are capped at 4,096 code units and one pass scans
   * at most 4,000,000 path code units; `matchCountExact=false` identifies a truncated lower bound. */
  override async search(query: string): Promise<number> {
    this.archiveSearchQuery = query;
    this.recomputeArchiveSearch();
    await this.updateComplete;
    this.scrollActiveArchiveMatch();
    return this.archiveSearchMatches.length;
  }

  override async searchNext(): Promise<boolean> {
    if (!this.archiveSearchMatches.length) return false;
    this.archiveSearchActiveIndex =
      (this.archiveSearchActiveIndex + 1) % this.archiveSearchMatches.length;
    this.emitArchiveSearchChange();
    await this.updateComplete;
    this.scrollActiveArchiveMatch();
    return true;
  }

  override async searchPrevious(): Promise<boolean> {
    if (!this.archiveSearchMatches.length) return false;
    this.archiveSearchActiveIndex =
      (this.archiveSearchActiveIndex - 1 + this.archiveSearchMatches.length)
      % this.archiveSearchMatches.length;
    this.emitArchiveSearchChange();
    await this.updateComplete;
    this.scrollActiveArchiveMatch();
    return true;
  }

  override clearSearch(): void {
    this.archiveSearchQuery = '';
    this.archiveSearchMatches = [];
    this.archiveSearchMatchCountExact = true;
    this.archiveSearchActiveIndex = -1;
    this.emitArchiveSearchChange();
  }

  @state() private fetchState: ArchiveState = { kind: 'idle' };
  @state() private archiveSearchMatches: ArchiveEntry[] = [];
  @state() private archiveSearchActiveIndex = -1;
  private archiveSearchMatchCountExact = true;
  private generation = 0;
  private archiveSearchQuery = '';
  private archiveSelectionRoot: Element | null = null;
  private archiveSelectionCleanup?: () => void;
  private styledVirtualListRoot: ShadowRoot | null = null;
  private archiveNestedUpdatePending = false;
  private readonly archiveEntryKey = (item: unknown): string => (item as ArchiveEntry).name;
  private readonly announcements = new ViewerAnnouncementController(this);

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message : this.localize('loadingDocument'),
    );
    this.syncArchiveNestedRoot();
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.archiveSelectionCleanup?.();
    this.archiveSelectionCleanup = undefined;
    this.archiveSelectionRoot = null;
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  /** The rows' real DOM lives inside the embedded virtual list, not the archive viewer's own body. */
  protected textContentRoot(): Element | null {
    return this.archiveVirtualList()?.shadowRoot?.querySelector('[part="spacer"]') ?? null;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.fetchState.kind !== 'loaded') return false;
    // Captured before any await so the post-wait checks below can tell a completed jump apart from
    // one whose archive was replaced underneath it by a concurrent `src` reassignment.
    const loadGeneration = this.generation;
    let index = -1;
    let resolvedName: string | undefined;
    if (anchor.kind === 'fragment') {
      index = this.fetchState.entries.findIndex((entry) => entry.name === anchor.id);
      resolvedName = this.fetchState.entries[index]?.name;
    } else if (anchor.kind === 'text-quote') {
      const probe = this.ownerDocument.createElement('span');
      index = this.fetchState.entries.findIndex((entry) => {
        probe.textContent = entry.name;
        return resolveTextQuote(scopeFromElement(probe), anchor, this.effectiveLocale) !== null;
      });
    }
    if (index < 0) return false;
    const list = this.archiveVirtualList();
    if (!list) return false;
    list.scrollToIndex(index, { align: 'auto', behavior: 'auto' });
    if (!await this.waitForArchiveRow(list, index)) return false;
    this.requestUpdate();
    await this.updateComplete;
    // A `src` reassignment landing inside either wait above (a citation/file-tab click on top of a
    // still-resolving jump) reruns load(), replacing `fetchState.entries` -- so the index and name
    // resolved from the previous archive address nothing in the one now rendered. Reporting
    // success here would stop the shared retry loop and fire `lr-anchor-result: { found: true }`
    // for a row that was never located, let alone scrolled to.
    if (loadGeneration !== this.generation || this.fetchState.kind !== 'loaded') return false;
    if (anchor.kind === 'fragment') {
      // Resolved entirely here rather than delegating to the shared base's own fragment handling:
      // that generic path finds its target by DOM `id === anchor.id`, and `anchor.id` is this
      // same attacker-controlled entry.name -- entry rows deliberately carry no `id` attribute
      // (DOM-clobbering hazard; see renderEntry's own comment), so match the already
      // data-resolved entry by its rendered text content instead, scoped to the row this method
      // already confirmed is mounted.
      const root = this.textContentRoot();
      const target = root
        ? Array.from(root.querySelectorAll<HTMLElement>('[part~="entry-name"]'))
          .find((el) => el.textContent === resolvedName)
        : null;
      // The optional call is a silent no-op when nothing matched, so the found-state of this query
      // -- not an unconditional `true` -- is this branch's real result.
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
      return target != null;
    }
    // TextViewerTarget's deliberately narrowed exported mixin type omits its protected hooks, so
    // TypeScript cannot spell `super.applyAnchor(anchor)` here even though that method is the real
    // immediate-base implementation at runtime. Referencing the named base prototype directly
    // preserves the same delegation without walking this class's prototype chain.
    const applyTextAnchor = (
      ArchiveTextViewerTargetBase.prototype as unknown as {
        applyAnchor(target: LyraAnchor): Promise<boolean>;
      }
    ).applyAnchor;
    return applyTextAnchor.call(this, anchor);
  }

  /** A quote emitted from selection is scoped to one entry path; a cross-row selection is not a
   * stable archive anchor because either endpoint may be unmounted by virtualization. */
  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const entryName = (node: Node): Element | null => {
      const elementNode = this.ownerDocument.defaultView?.Node.ELEMENT_NODE ?? 1;
      const element = node.nodeType === elementNode ? node as Element : node.parentElement;
      return element?.closest('[part~="entry-name"]') ?? null;
    };
    const start = entryName(range.startContainer);
    const end = entryName(range.endContainer);
    if (!start || start !== end) return null;
    return buildQuoteAnchor(range, scopeFromElement(start));
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new Error('Unsafe archive source URL');
      this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (!this.isConnected || generation !== this.generation) return;
      const buffer = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      // The local-file signature must be byte zero; an appended valid ZIP must not turn an
      // arbitrary prefix into an accepted archive. The returned immutable metadata is also the
      // listing authority, so the validated entry graph cannot diverge from a peer parser's view.
      const metadata = assertZipArchiveMetadataWithinLimits(buffer, {
        description: 'ZIP',
        maxEntries: MAX_ARCHIVE_ENTRIES,
        maxUncompressedBytes: MAX_ARCHIVE_UNCOMPRESSED_BYTES,
        signal,
      });
      if (!this.isConnected || generation !== this.generation) return;
      const entries = metadata!.entries.map(({ name, dir, uncompressedBytes }) => ({
        name,
        dir,
        size: uncompressedBytes,
      }));
      this.fetchState = { kind: 'loaded', entries };
      if (this.archiveSearchQuery) this.recomputeArchiveSearch();
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private renderEntry = (item: unknown): TemplateResult => {
    const entry = item as ArchiveEntry;
    const kind = this.localize(entry.dir ? 'archiveViewerFolder' : 'archiveViewerFile');
    // entry.name is an attacker-controlled ZIP central-directory filename -- never bind it as a
    // DOM id (the canonical DOM-clobbering primitive). applyAnchor() resolves a fragment anchor
    // by matching entry.name against the loaded DATA and then, for the exact scroll target,
    // against rendered text content -- never against a DOM id -- so no id was ever needed here.
    return html`<div part="entry" data-dir=${entry.dir ? 'true' : 'false'}><span part="entry-icon">${entry.dir ? folderIcon() : fileIcon()}</span><span class="sr-only">${kind}</span><span part=${entry.dir ? 'entry-name entry-name-dir' : 'entry-name'} dir="auto" title=${entry.name}>${entry.name}</span>${entry.dir ? nothing : html`<span part="entry-size" dir="auto">${formatFileSize(
      entry.size,
      (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]),
      (value, fractionDigits) => getNumberFormat(this.effectiveLocale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value),
    )}</span>`}</div>`;
  };

  private stopVirtualListEvent(event: Event): void {
    event.stopPropagation();
    if (this.archiveNestedUpdatePending) return;
    this.archiveNestedUpdatePending = true;
    queueMicrotask(() => {
      this.archiveNestedUpdatePending = false;
      if (this.isConnected) this.requestUpdate();
    });
  }

  private archiveVirtualList(): LyraVirtualList | null {
    return this.renderRoot.querySelector('lr-virtual-list') as LyraVirtualList | null;
  }

  private async waitForArchiveRow(list: LyraVirtualList, index: number): Promise<boolean> {
    const view = this.ownerDocument.defaultView;
    for (let attempt = 0; attempt < 5; attempt++) {
      await list.updateComplete;
      if (list.shadowRoot?.querySelector(`[data-row-index="${index}"]`)) return true;
      if (!view) return false;
      await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
    }
    return false;
  }

  /** Replaces TextViewerTarget's outer-shadow selection binding with one that includes the nested
   * virtual-list ShadowRoot in composed-range lookup. Highlight painting still uses the mixin, but
   * its content root is redirected to the same nested spacer above. */
  private syncArchiveNestedRoot(): void {
    const root = this.textContentRoot();
    if (root !== this.archiveSelectionRoot) {
      (this as unknown as { unbindTextSelection(): void }).unbindTextSelection();
      this.archiveSelectionCleanup?.();
      this.archiveSelectionCleanup = undefined;
      this.archiveSelectionRoot = root;
      if (root) {
        const emitSelection = (): void => {
          const range = archiveSelectionRange(this, root);
          if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
          const text = boundedSelectionText(range);
          if (!text) return;
          const anchor = this.computeSelectionAnchor(range);
          const rects = boundedSelectionRects(range);
          this.emit('lr-text-select', { text, anchor, rects });
        };
        root.addEventListener('pointerup', emitSelection);
        root.addEventListener('keyup', emitSelection);
        this.archiveSelectionCleanup = () => {
          root.removeEventListener('pointerup', emitSelection);
          root.removeEventListener('keyup', emitSelection);
        };
      }
    }

    const listRoot = this.archiveVirtualList()?.shadowRoot ?? null;
    if (listRoot && listRoot !== this.styledVirtualListRoot) {
      const existing = listRoot.querySelector('style[data-lr-archive-highlight-styles]');
      if (existing) {
        this.styledVirtualListRoot = listRoot;
      } else {
        const style = this.ownerDocument.createElement('style');
        style.dataset['lrArchiveHighlightStyles'] = '';
        style.textContent = virtualListHighlightStyles.cssText;
        listRoot.append(style);
        this.styledVirtualListRoot = listRoot;
      }
    }
    if (root) {
      for (const mark of root.querySelectorAll('mark[data-lr-highlight-tone]')) {
        if (!mark.hasAttribute('part')) mark.setAttribute('part', 'highlight');
      }
    }
  }

  private recomputeArchiveSearch(): void {
    const entries = this.fetchState.kind === 'loaded' ? this.fetchState.entries : [];
    const boundedQuery = boundedViewerSearchQuery(this.archiveSearchQuery, this.effectiveLocale);
    const query = boundedQuery.needle;
    const matches: ArchiveEntry[] = [];
    const budget = new ViewerSearchWorkBudget();
    if (boundedQuery.accepted && query) {
      for (const entry of entries) {
        if (budget.includes(entry.name, query, this.effectiveLocale)) matches.push(entry);
        if (!budget.complete) break;
      }
    }
    this.archiveSearchMatches = matches;
    this.archiveSearchMatchCountExact = boundedQuery.accepted && budget.complete;
    this.archiveSearchActiveIndex = this.archiveSearchMatches.length > 0 ? 0 : -1;
    this.emitArchiveSearchChange();
  }

  private emitArchiveSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.archiveSearchQuery,
      matchCount: this.archiveSearchMatches.length,
      matchCountExact: this.archiveSearchMatchCountExact,
      activeIndex: this.archiveSearchActiveIndex,
    });
  }

  private scrollActiveArchiveMatch(): void {
    if (this.fetchState.kind !== 'loaded') return;
    const match = this.archiveSearchMatches[this.archiveSearchActiveIndex];
    if (!match) return;
    const index = this.fetchState.entries.indexOf(match);
    const list = this.renderRoot.querySelector('lr-virtual-list') as
      | { scrollToIndex(index: number, options?: { behavior?: ScrollBehavior }): void }
      | null;
    if (index >= 0) list?.scrollToIndex(index, { behavior: 'auto' });
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return this.fetchState.entries.length ? html`<lr-virtual-list exportparts="entry:entry, entry-icon:entry-icon, entry-name:entry-name, entry-name-dir:entry-name-dir, entry-size:entry-size, highlight:highlight" .items=${this.fetchState.entries} .renderItem=${this.renderEntry} .keyFunction=${this.archiveEntryKey} .activeId=${this.archiveSearchMatches[this.archiveSearchActiveIndex]?.name ?? ''} @lr-visible-range-changed=${this.stopVirtualListEvent} @lr-virtual-scroll=${this.stopVirtualListEvent}></lr-virtual-list>` : html`<p class="empty-note">${this.localize('archiveViewerEmpty')}</p>`;
      case 'loading': return renderViewerLoading(this.localize('loadingDocument'));
      case 'error': return html`<div part="error">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    // `name` names the shadow listing region. A non-empty host label owns the overall semantics
    // itself; with neither source there is nothing meaningful to announce, so no region is added.
    const label = viewerSemanticLabel(this, this.name || null);
    const role = label === null ? null : viewerSemanticRole(this, 'region');
    return html`<div part="base" role=${role ?? nothing} aria-label=${label ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-archive-viewer': LyraArchiveViewer; } }
