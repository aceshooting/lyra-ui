import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { chevronIcon } from '../../../internal/icons.js';
import { srOnly } from '../../../internal/a11y.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { Announcer } from '../../../internal/announcer.js';
import { announceSearchResult } from '../../../internal/viewer-search.js';
import {
  DocumentAnchorTarget,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import type {
  LyraAnchor,
  LyraHighlightTone,
  TextSelectRect,
} from '../document-viewer/anchors.js';
import {
  getEpubJs,
  type EpubBook,
} from './ebook-loader.js';
import { assertEpubArchiveWithinLimits } from './epub-resource-guard.js';
import { styles } from './ebook-viewer.styles.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget, VIEWER_SEARCH_QUERY_LIMIT } from '../viewer-search-limits.js';
import { boundedSelectionRects, boundedSelectionText } from '../../../internal/text-quote.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_ebookViewerLoadError, LYRA_DEFAULT_ebookViewerNextChapter, LYRA_DEFAULT_ebookViewerPreviousChapter, LYRA_DEFAULT_ebookViewerRegionLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_next, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_previous, LYRA_DEFAULT_remove, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type EbookState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

/** One flattened entry of an EPUB's own navigation document (`book.navigation.toc`). `level`
 *  starts at 1 for a top-level entry and increases with nesting depth. */
export interface EbookTocItem {
  id: string;
  label: string;
  href: string;
  level: number;
}

/** One `search()` match: the CFI epub.js's own `item.find()` resolved it to, and the surrounding
 *  excerpt it reported alongside that CFI. */
interface EbookSearchMatch {
  cfi: string;
  excerpt: string;
}

const MAX_TOC_ITEMS = 10_000;
const MAX_TOC_DEPTH = 100;
const MAX_SEARCH_MATCHES = 10_000;
const MAX_SEARCH_SPINE_ITEMS = 1_000;
const MAX_FIND_RESULTS = 10_000;
const MAX_PAINTED_HIGHLIGHTS = 100;
const MAX_PEER_PROTOTYPES = 100;

interface SafeEpubBook {
  readonly ready: Promise<void>;
  readonly spine?: unknown;
  readonly load?: (...args: unknown[]) => unknown;
  getNavigation(): unknown;
  renderTo(element: Element, options?: Record<string, unknown>): unknown;
  destroy(): void;
}

interface SafeEpubAnnotations {
  highlight(
    cfi: string,
    data: Record<string, unknown>,
    callback?: (() => void) | undefined,
    className?: string,
    styles?: Record<string, unknown>,
  ): unknown;
  remove(cfi: string, type: string): void;
}

interface SafeEpubRendition {
  readonly annotations: SafeEpubAnnotations;
  display(target?: string): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  on(
    type: 'relocated' | 'selected',
    callback: ((location: unknown) => void) | ((cfiRange: string, contents: unknown) => void),
  ): void;
}

interface SafeEpubSpineItem {
  load(request?: unknown): unknown;
  find(query: string): unknown;
  unload(): void;
}

interface FindResultProjection {
  readonly matches: readonly EbookSearchMatch[];
  readonly exact: boolean;
}

interface TocWorkBudget {
  positions: number;
  nodes: number;
  readonly seen: WeakSet<object>;
}

function isObjectValue(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function isArrayValue(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

/** Resolves an own/inherited data descriptor without invoking a peer getter. An accessor shadows
 * farther prototypes just as normal property lookup would, but fails closed at the boundary. */
function inheritedDataDescriptor(value: object, key: PropertyKey): PropertyDescriptor | undefined {
  let current: object | null = value;
  for (let depth = 0; current && depth < MAX_PEER_PROTOTYPES; depth += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, key);
    } catch {
      return undefined;
    }
    if (descriptor) return 'value' in descriptor ? descriptor : undefined;
    try {
      current = Object.getPrototypeOf(current) as object | null;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function inheritedDataValue(value: unknown, key: PropertyKey): unknown {
  return isObjectValue(value) ? inheritedDataDescriptor(value, key)?.value : undefined;
}

function savedCallable(value: unknown, key: PropertyKey): ((...args: unknown[]) => unknown) | undefined {
  if (!isObjectValue(value)) return undefined;
  const candidate = inheritedDataDescriptor(value, key)?.value;
  if (typeof candidate !== 'function') return undefined;
  return (...args: unknown[]) => Reflect.apply(candidate, value, args);
}

function savedThenable(value: unknown): Promise<void> | undefined {
  const then = savedCallable(value, 'then');
  if (!then) return undefined;
  return new Promise<void>((resolve, reject) => {
    try {
      // Deliberately discard the fulfillment value. Passing a hostile peer result straight to a
      // native Promise resolver would assimilate it by reading `.then` before a descriptor-safe
      // projection has a chance to inspect it.
      then(() => resolve(), reject);
    } catch (error) {
      reject(error);
    }
  });
}

function taskFrom(call: (...args: unknown[]) => unknown, ...args: unknown[]): Promise<void> {
  try {
    return savedThenable(call(...args)) ?? Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

/** Awaits only a descriptor-validated thenable. The fulfillment is wrapped before resolving so a
 * synchronous proxy/array result never reaches Promise assimilation, which would value-read its
 * `.then` before the bounded descriptor projection can inspect it. */
function awaitPeerResult(value: unknown): Promise<{ readonly value: unknown }> {
  const then = savedCallable(value, 'then');
  const wrap = (resolved: unknown): { readonly value: unknown } => Object.freeze({ value: resolved });
  if (!then) return Promise.resolve(wrap(value));
  return new Promise<{ readonly value: unknown }>((resolve, reject) => {
    try {
      then((resolved: unknown) => resolve(wrap(resolved)), reject);
    } catch (error) {
      reject(error);
    }
  });
}

/** Captures mandatory book capabilities once, and captures optional navigation only after
 * `ready` settles, when epub.js has finished loading its navigation document. */
function normalizeBook(value: unknown): SafeEpubBook | undefined {
  if (!isObjectValue(value)) return undefined;
  const ready = savedThenable(inheritedDataValue(value, 'ready'));
  const renderTo = savedCallable(value, 'renderTo');
  const destroy = savedCallable(value, 'destroy');
  if (!ready || !renderTo || !destroy) return undefined;
  let navigationCaptured = false;
  let navigation: unknown;
  const getNavigation = (): unknown => {
    if (!navigationCaptured) {
      navigationCaptured = true;
      navigation = inheritedDataValue(value, 'navigation');
    }
    return navigation;
  };
  const spine = inheritedDataValue(value, 'spine');
  const load = savedCallable(value, 'load');
  return Object.freeze({
    ready,
    ...(spine === undefined ? {} : { spine }),
    ...(load === undefined ? {} : { load }),
    getNavigation,
    renderTo: (element: Element, options?: Record<string, unknown>) => renderTo(element, options),
    destroy: () => { void destroy(); },
  });
}

/** Captures the mandatory rendition/annotation capabilities once, before any callback is wired. */
function normalizeRendition(value: unknown): SafeEpubRendition | undefined {
  if (!isObjectValue(value)) return undefined;
  const display = savedCallable(value, 'display');
  const prev = savedCallable(value, 'prev');
  const next = savedCallable(value, 'next');
  const on = savedCallable(value, 'on');
  const annotationsValue = inheritedDataValue(value, 'annotations');
  const highlight = savedCallable(annotationsValue, 'highlight');
  const remove = savedCallable(annotationsValue, 'remove');
  if (!display || !prev || !next || !on || !highlight || !remove) return undefined;
  return Object.freeze({
    display: (target?: string) => taskFrom(display, target),
    prev: () => taskFrom(prev),
    next: () => taskFrom(next),
    on: (
      type: 'relocated' | 'selected',
      callback: ((location: unknown) => void) | ((cfiRange: string, contents: unknown) => void),
    ) => {
      void on(type, callback);
    },
    annotations: Object.freeze({
      highlight: (
        cfi: string,
        data: Record<string, unknown>,
        callback?: (() => void) | undefined,
        className?: string,
        styles?: Record<string, unknown>,
      ) => highlight(cfi, data, callback, className, styles),
      remove: (cfi: string, type: string) => { void remove(cfi, type); },
    }),
  });
}

function normalizeSpineItem(value: unknown): SafeEpubSpineItem | undefined {
  const load = savedCallable(value, 'load');
  const find = savedCallable(value, 'find');
  const unload = savedCallable(value, 'unload');
  if (!load || !find || !unload) return undefined;
  return Object.freeze({
    load: (request?: unknown) => load(request),
    find: (query: string) => find(query),
    unload: () => { void unload(); },
  });
}

function projectSpineItems(book: SafeEpubBook): { readonly items: readonly SafeEpubSpineItem[]; readonly exact: boolean } {
  const spineItems = inheritedDataValue(book.spine, 'spineItems');
  if (!isArrayValue(spineItems)) return Object.freeze({ items: Object.freeze([]), exact: spineItems === undefined });
  const length = getOwnDataDescriptor(spineItems, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR
    || length === UNSAFE_OWN_DATA_DESCRIPTOR
    || typeof length.value !== 'number'
    || !Number.isSafeInteger(length.value)
    || length.value < 0
  )
    return Object.freeze({ items: Object.freeze([]), exact: false });
  const items: SafeEpubSpineItem[] = [];
  let exact = length.value <= MAX_SEARCH_SPINE_ITEMS;
  const count = Math.min(length.value, MAX_SEARCH_SPINE_ITEMS);
  for (let index = 0; index < count; index += 1) {
    const descriptor = getOwnDataDescriptor(spineItems, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) {
      exact = false;
      continue;
    }
    const item = normalizeSpineItem(descriptor.value);
    if (!item) {
      exact = false;
      continue;
    }
    items.push(item);
  }
  return Object.freeze({ items: Object.freeze(items), exact });
}

/** Projects one peer `find()` result prefix through own data descriptors. Invalid/holey/capped
 * positions make an externally reported count inexact, but never discard a later valid sibling. */
function projectFindResults(value: unknown, work: ViewerSearchWorkBudget): FindResultProjection {
  if (!isArrayValue(value)) return Object.freeze({ matches: Object.freeze([]), exact: false });
  const length = getOwnDataDescriptor(value, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR
    || length === UNSAFE_OWN_DATA_DESCRIPTOR
    || typeof length.value !== 'number'
    || !Number.isSafeInteger(length.value)
    || length.value < 0
  )
    return Object.freeze({ matches: Object.freeze([]), exact: false });
  const matches: EbookSearchMatch[] = [];
  let exact = length.value <= MAX_FIND_RESULTS;
  const count = Math.min(length.value, MAX_FIND_RESULTS);
  for (let index = 0; index < count; index += 1) {
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || !isObjectValue(descriptor.value)) {
      exact = false;
      continue;
    }
    const cfi = getOwnDataDescriptor(descriptor.value, 'cfi');
    const excerpt = getOwnDataDescriptor(descriptor.value, 'excerpt');
    if (
      cfi === MISSING_OWN_DATA_DESCRIPTOR
      || cfi === UNSAFE_OWN_DATA_DESCRIPTOR
      || typeof cfi.value !== 'string'
    ) {
      exact = false;
      continue;
    }
    // Charge raw strings before trimming or retaining them. An over-budget CFI is skipped without
    // draining the shared budget, so a later bounded sibling can still be used.
    if (!work.canConsume(cfi.value) || !work.consume(cfi.value) || cfi.value.trim() === '') {
      exact = false;
      continue;
    }
    let excerptValue = '';
    if (excerpt !== MISSING_OWN_DATA_DESCRIPTOR) {
      if (excerpt === UNSAFE_OWN_DATA_DESCRIPTOR || typeof excerpt.value !== 'string') {
        exact = false;
      } else if (!work.canConsume(excerpt.value) || !work.consume(excerpt.value)) {
        exact = false;
      } else {
        excerptValue = excerpt.value;
      }
    }
    matches.push({
      cfi: cfi.value,
      excerpt: excerptValue,
    });
  }
  return Object.freeze({ matches: Object.freeze(matches), exact });
}

function pushTocEntries(
  value: unknown,
  level: number,
  budget: TocWorkBudget,
  stack: Array<{ readonly value: unknown; readonly level: number }>,
): void {
  if (!isArrayValue(value) || budget.positions >= MAX_TOC_ITEMS) return;
  const length = getOwnDataDescriptor(value, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR
    || length === UNSAFE_OWN_DATA_DESCRIPTOR
    || typeof length.value !== 'number'
    || !Number.isSafeInteger(length.value)
    || length.value < 0
  )
    return;
  const count = Math.min(length.value, MAX_TOC_ITEMS - budget.positions);
  for (let index = count - 1; index >= 0; index -= 1) {
    budget.positions += 1;
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
    stack.push({ value: descriptor.value, level });
  }
}

/** Bounded non-recursive navigation projection. Its single position/node budget covers every
 * nested child list, so a deep/cyclic optional TOC cannot grow work beyond 10,000 observations. */
function projectToc(value: unknown): readonly EbookTocItem[] {
  const budget: TocWorkBudget = { positions: 0, nodes: 0, seen: new WeakSet() };
  const stack: Array<{ readonly value: unknown; readonly level: number }> = [];
  pushTocEntries(value, 1, budget, stack);
  const items: EbookTocItem[] = [];
  while (stack.length > 0 && budget.nodes < MAX_TOC_ITEMS) {
    const current = stack.pop()!;
    if (!isObjectValue(current.value) || budget.seen.has(current.value)) continue;
    budget.seen.add(current.value);
    budget.nodes += 1;
    const href = getOwnDataDescriptor(current.value, 'href');
    const id = getOwnDataDescriptor(current.value, 'id');
    const label = getOwnDataDescriptor(current.value, 'label');
    const children = getOwnDataDescriptor(current.value, 'subitems');
    if (
      href !== MISSING_OWN_DATA_DESCRIPTOR
      && href !== UNSAFE_OWN_DATA_DESCRIPTOR
      && typeof href.value === 'string'
    ) {
      const idValue = id !== MISSING_OWN_DATA_DESCRIPTOR
        && id !== UNSAFE_OWN_DATA_DESCRIPTOR
        && typeof id.value === 'string'
        && id.value !== ''
        ? id.value
        : href.value;
      const labelValue = label !== MISSING_OWN_DATA_DESCRIPTOR
        && label !== UNSAFE_OWN_DATA_DESCRIPTOR
        && typeof label.value === 'string'
        ? label.value.trim()
        : '';
      items.push({ id: idValue, label: labelValue, href: href.value, level: current.level });
    }
    if (
      current.level < MAX_TOC_DEPTH
      && children !== MISSING_OWN_DATA_DESCRIPTOR
      && children !== UNSAFE_OWN_DATA_DESCRIPTOR
    ) {
      pushTocEntries(children.value, current.level + 1, budget, stack);
    }
  }
  return Object.freeze(items);
}

/** Tone -> the token (and its light-theme fallback) a painted `cfi` highlight resolves its `fill`
 *  from, mirroring `highlight-layer`'s own tone mapping. epub.js's `annotations.highlight()`
 *  applies its `styles` argument as raw SVG presentation attributes on the mark it paints (see
 *  `marks-pane`'s `Highlight.bind()`), not as a stylesheet declaration -- an unresolved `var(...)`
 *  string left in that attribute isn't guaranteed to repaint on a later theme change, so the
 *  concrete value is read via `getComputedStyle` at paint time instead. */
const TONE_FILL_TOKEN: Record<LyraHighlightTone, { token: string; fallback: string }> = {
  accent: { token: '--lr-color-brand-quiet', fallback: '#ddf4ff' },
  success: { token: '--lr-color-success-quiet', fallback: '#dafbe1' },
  warning: { token: '--lr-color-warning-quiet', fallback: '#fff8c5' },
  danger: { token: '--lr-color-danger-quiet', fallback: '#ffebe9' },
  neutral: { token: '--lr-color-surface-raised', fallback: '#f6f8fa' },
};

/** The active search match's own fill token/fallback -- mirrors `docx-viewer`'s
 *  `search-match-active` treatment (`--lr-color-warning`) rather than any highlight tone. */
const SEARCH_MATCH_FILL_TOKEN = { token: '--lr-color-warning', fallback: '#9a6700' };
const ACTIVE_HIGHLIGHT_STROKE_TOKEN = { token: '--lr-focus-ring-color', fallback: '#0969da' };

export interface LyraEbookViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-location-change': CustomEvent<{ cfi: string; href: string }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

class LyraEbookViewerBase extends LyraElement<LyraEbookViewerEventMap> {}

/**
 * Renders an EPUB with the optional `epubjs` peer. The mount element is kept
 * stable because epub.js imperatively owns it and renders chapters in iframes.
 *
 * Adopts `DocumentAnchorTarget`: a `cfi` anchor displays directly via epub.js's own
 * `rendition.display()`; a `text-quote` anchor resolves by scanning the book's spine sections
 * with epub.js's own `item.find()`, since chapter content lives inside epub.js-owned iframes
 * rather than this component's own shadow DOM (a native `Range`/`Selection` inside one of those
 * iframes is invisible to this component's own document, so selection handling below is bridged
 * through epub.js's own `selected` event instead of the mixin's default DOM-selection binding).
 * `highlights` (kind `cfi`) paint via `rendition.annotations.highlight()`, resolving each `tone`
 * to a concrete `fill` color (its `styles` 5th arg) so highlights actually differentiate by tone,
 * and are re-applied whenever the rendition is recreated (a `src` change, or a reconnect remount)
 * -- epub.js doesn't persist annotations across a fresh `renderTo()`. `getToc()` reads the EPUB's
 * own navigation document into a flat, document-ordered outline once `book.ready` resolves.
 * `location` (a CFI or
 * spine href) is recorded before the book is ready and applied once loading finishes, or applied
 * immediately once it already has; epub.js's own `relocated` event keeps it in sync with user
 * navigation without re-triggering a `display()` call for a change that originated from that same
 * event. `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()` scan the spine sequentially
 * via epub.js's own `item.find()`, aborting a superseded scan when a newer search or a `src`
 * change supersedes it.
 *
 * @customElement lr-ebook-viewer
 * @event lr-render-error - Fired when fetching, opening, or rendering fails.
 * @event lr-location-change - The reading location changed (from `rendition`'s own `relocated`
 *   event). `detail: { cfi, href }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   inspects at most 1,000 spine items and 4,000,000 result code units, and retains at most 10,000
 *   matches; a false `matchCountExact` makes `matchCount` a lower bound (including when a spine
 *   item cannot load or any ceiling is reached).
 * @event lr-highlight-activate - A painted `cfi` highlight was clicked.
 *   `detail: { highlightId }`.
 * @event lr-text-select - Fired on selection end inside a chapter iframe (mirrors epub.js's own
 *   `selected` event). `detail: { text, anchor, rects }`; `text` is capped at 4,096 code units,
 *   `rects` at 1,000, and `anchor` is a `cfi` `LyraAnchor`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The viewer container.
 * @csspart toolbar - Previous and next chapter controls.
 * @csspart previous-button - The previous chapter button.
 * @csspart next-button - The next chapter button.
 * @csspart previous-icon - The previous button icon.
 * @csspart next-icon - The next button icon.
 * @csspart mount - The stable element epub.js renders into.
 * @csspart error - Visible ordinary error text; transitions announce through the shared
 *   document-level assertive region. Search announcements are appended to the shared
 *   document-level polite region, which lives in the host's light DOM and has no part here.
 * @cssprop [--lr-ebook-viewer-max-height=none] - Maximum block size of the mount area epub.js
 *   renders into, before it scrolls internally. Also settable via the `max-height` property.
 * @status stable
 * @since 4.0.0
 */
export class LyraEbookViewer extends DocumentAnchorTarget(LyraEbookViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    ebookViewerLoadError: LYRA_DEFAULT_ebookViewerLoadError,
    ebookViewerNextChapter: LYRA_DEFAULT_ebookViewerNextChapter,
    ebookViewerPreviousChapter: LYRA_DEFAULT_ebookViewerPreviousChapter,
    ebookViewerRegionLabel: LYRA_DEFAULT_ebookViewerRegionLabel,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    next: LYRA_DEFAULT_next,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    previous: LYRA_DEFAULT_previous,
    remove: LYRA_DEFAULT_remove,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL fetched as an ArrayBuffer and rendered as an EPUB. */
  @property() src = '';
  /** Display name used as the reading region's accessible-name fallback. */
  @property() name = '';
  /** Host-level `aria-label` override for the internal reading region -- wins by attribute
   *  presence, including an explicitly empty value, over `name` and the localized fallback. Set as
   *  a plain `aria-label` attribute on `<lr-ebook-viewer>` itself, not a public JS property: the
   *  declaration exists only so Lit observes the attribute (the same private attribute-observer
   *  `<lr-dialog>`, `<lr-page>`, `<lr-app-rail>` and `<lr-tour>` use). */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

  /** A CSS `max-height` that caps the mount area epub.js renders into; invalid values are
   *  ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** A CFI or spine href identifying the current reading position. Set before the book has
   *  finished loading, it's recorded and applied via `rendition.display()` once loading
   *  finishes; set after, it applies immediately. Kept in sync with epub.js's own `relocated`
   *  event (fired on any user navigation) without re-triggering a `display()` call for a change
   *  that originated from that same event. Not reflected as an attribute -- CFIs are long. */
  @property() location = '';

  /** Anchor kinds this viewer resolves: `cfi` displays directly via `rendition.display()`;
   *  `text-quote` resolves by scanning the book's spine with epub.js's own `item.find()`. */
  override readonly anchorKinds = ['cfi', 'text-quote'] as const;

  @state() private ebookState: EbookState = { kind: 'idle' };
  @state() private searchMatches: EbookSearchMatch[] = [];
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;

  private readonly mountRef: Ref<HTMLDivElement> = createRef();
  private book?: SafeEpubBook;
  private rendition?: SafeEpubRendition;
  private generation = 0;
  private failedGeneration = -1;
  private searchQuery = '';
  private lastSearchLocale = '';
  private searchGeneration = 0;
  private pendingSearchResetEvent = false;
  private anchorOperationGeneration = 0;
  /** CFI most recently assigned by a peer `relocated` callback. Tracking the value rather than a
   * boolean lets a controlled consumer replace `location` synchronously from
   * `lr-location-change`: only the peer's exact CFI is suppressed as a display loop. */
  private relocatedLocation?: string;
  private paintedHighlightCfis: string[] = [];
  private searchAnnotationCfi?: string;
  private readonly announcements = new ViewerAnnouncementController(this);
  private readonly announcer = new Announcer({
    onFlush: (text) => this.announcements.announcePolite(text),
  });

  constructor() {
    super();
    // epub.js paints concrete SVG attributes inside its chapter iframe, outside this component's
    // CSS cascade. Re-resolve and transactionally replace those attributes whenever the scoped
    // theme watcher observes an effective-token change.
    new ThemeWatcher(this, () => this.repaintAnnotations());
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // reaches DocumentAnchorTarget's own cleanup/live-region wiring
    this.announcements.transition(
      'load',
      this.ebookState.kind,
      this.ebookState.kind === 'error' ? this.ebookState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (changed.has('src') && this.pendingSearchResetEvent) {
      this.pendingSearchResetEvent = false;
      this.emitSearchChange();
    }
    if (changed.has('location')) {
      const fromRelocated = this.relocatedLocation === this.location;
      this.relocatedLocation = undefined;
      if (!fromRelocated && this.rendition && this.location) this.displayLocation(this.location);
    }
    if ((changed.has('highlights') || changed.has('activeHighlightId')) && this.rendition) {
      this.repaintAnnotations();
    }
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
    if (changed.has('src')) {
      this.pendingSearchResetEvent ||= this.hasSearchState();
      this.resetSearchState();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    this.announcements.connect();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update in between, so updated()'s `changed.has('src')` gate never
    // fires again to reload the book. disconnectedCallback already reset
    // `ebookState` to idle and tore epub.js down, so re-arm the load here
    // whenever there's a `src` to load and this isn't the very first connect
    // (that case is already covered by updated()'s initial-render gate).
    if (this.hasUpdated && this.src.trim()) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.anchorOperationGeneration++;
    this.announcer.cancel();
    this.announcements.disconnect();
    this.teardown();
    // Reset rather than leaving a stale "ready" state: without this, a
    // reconnect that isn't followed by a fresh load (src unset, or the
    // reconnect races ahead of connectedCallback's reload) would keep
    // rendering the toolbar's previous/next controls as enabled and
    // live-looking against a destroyed rendition, which silently no-ops
    // every click instead of surfacing an empty/idle state.
    this.ebookState = { kind: 'idle' };
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry, selection binding)
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    this.announcements.adopted();
  }

  private teardown(): void {
    const shouldEmitSearchReset = this.hasSearchState();
    this.destroyBook(this.book);
    this.book = undefined;
    this.rendition = undefined;
    this.resetSearchState();
    this.paintedHighlightCfis = [];
    if (shouldEmitSearchReset && this.isConnected) this.emitSearchChange();
  }

  private destroyBook(book: SafeEpubBook | undefined): void {
    try {
      book?.destroy();
    } catch {
      // Teardown must not let an optional peer's cleanup failure strand the next load.
    }
  }

  private isCurrentLoad(generation: number, ownerView: Window): boolean {
    return this.isConnected
      && generation === this.generation
      && this.ownerDocument.defaultView === ownerView;
  }

  private isCurrentBookRendition(
    generation: number,
    ownerView: Window,
    book: SafeEpubBook,
    rendition: SafeEpubRendition,
  ): boolean {
    return this.isConnected
      && generation === this.generation
      && this.ownerDocument.defaultView === ownerView
      && this.book === book
      && this.rendition === rendition;
  }

  private failCurrentLoad(error: unknown, message = this.localize('ebookViewerLoadError')): void {
    if (this.failedGeneration === this.generation) return;
    this.failedGeneration = this.generation;
    this.ebookState = { kind: 'error', message };
    this.emit('lr-render-error', { error });
  }

  private hasSearchState(): boolean {
    return this.searchQuery !== ''
      || this.searchMatches.length > 0
      || !this.searchMatchCountExact
      || this.searchActiveIndex !== -1;
  }

  private resetSearchState(): void {
    this.searchGeneration++;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.searchAnnotationCfi = undefined;
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.teardown();
    if (!this.src.trim()) {
      this.ebookState = { kind: 'idle' };
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      this.failWithLocalizedMessage(this.localize('documentPreviewUrlNotAllowed'));
      return;
    }
    this.ebookState = { kind: 'loading' };
    let data: ArrayBuffer;
    let factory: ((data: ArrayBuffer) => EpubBook) | null;
    try {
      [data, factory] = await Promise.all([
        fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined).then((response) => {
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          return readResponseArrayBuffer(response);
        }),
        getEpubJs(),
      ]);
      if (!this.isCurrentLoad(generation, fetchTarget.view)) return;
      await assertEpubArchiveWithinLimits(data, undefined, undefined, { signal });
      if (!this.isCurrentLoad(generation, fetchTarget.view)) return;
    } catch (error) {
      if (isAbortError(error) || !this.isCurrentLoad(generation, fetchTarget.view)) return;
      this.failCurrentLoad(
        error,
        this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'ebookViewerLoadError'),
      );
      return;
    }
    if (!factory) {
      this.failWithLocalizedMessage(this.localize('ebookViewerLoadError'));
      return;
    }
    const mount = this.mountRef.value;
    if (!mount) {
      this.failWithLocalizedMessage(this.localize('ebookViewerLoadError'));
      return;
    }
    let candidateBook: SafeEpubBook | undefined;
    try {
      const book = normalizeBook(factory(data));
      if (!book) throw new Error('EPUB peer returned an unusable book.');
      candidateBook = book;
      const rendition = normalizeRendition(book.renderTo(mount, { width: '100%', height: '100%' }));
      if (!rendition) throw new Error('EPUB peer returned an unusable rendition.');
      await book.ready;
      if (!this.isCurrentLoad(generation, fetchTarget.view)) {
        this.destroyBook(book);
        candidateBook = undefined;
        return;
      }
      book.getNavigation();
      await rendition.display(this.location || undefined);
      if (!this.isCurrentLoad(generation, fetchTarget.view)) {
        this.destroyBook(book);
        candidateBook = undefined;
        return;
      }
      rendition.on('relocated', (loc: unknown) => {
        if (!this.isCurrentBookRendition(generation, fetchTarget.view, book, rendition)) return;
        const start = inheritedDataValue(loc, 'start');
        const cfi = inheritedDataValue(start, 'cfi');
        const href = inheritedDataValue(start, 'href');
        if (typeof cfi !== 'string' || cfi.trim() === '') return;
        if (!cfi || cfi === this.location) return;
        this.relocatedLocation = cfi;
        this.location = cfi;
        this.emit('lr-location-change', { cfi, href: typeof href === 'string' ? href : '' });
      });
      rendition.on('selected', (cfiRange: string, contents: unknown) => {
        if (!this.isCurrentBookRendition(generation, fetchTarget.view, book, rendition) || typeof cfiRange !== 'string') return;
        try {
          const contentsWindow = inheritedDataValue(contents, 'window') as Window | undefined;
          const getSelection = savedCallable(contentsWindow, 'getSelection');
          const selection = getSelection?.();
          const rangeCount = inheritedDataValue(selection, 'rangeCount');
          const getRangeAt = savedCallable(selection, 'getRangeAt');
          const range = typeof rangeCount === 'number' && rangeCount > 0 && getRangeAt
            ? getRangeAt(0) as Range
            : null;
          if (!range) return;
          const text = boundedSelectionText(range);
          if (!text) return;
          const rects = this.translateSelectionRects(
            boundedSelectionRects(range),
            contentsWindow,
          );
          this.emit('lr-text-select', { text, anchor: { kind: 'cfi', cfi: cfiRange }, rects });
        } catch {
          // A malformed optional selected-event payload cannot invalidate the loaded book.
        }
      });
      this.book = book;
      this.rendition = rendition;
      candidateBook = undefined;
      this.ebookState = { kind: 'ready' };
      this.repaintAnnotations();
    } catch (error) {
      this.destroyBook(candidateBook);
      if (isAbortError(error) || !this.isCurrentLoad(generation, fetchTarget.view)) return;
      this.failCurrentLoad(error);
    }
  }

  private failWithLocalizedMessage(message: string): void {
    const error = new LyraUserFacingError(message);
    this.failCurrentLoad(error, message);
  }

  private reportRenditionFailure(
    error: unknown,
    rendition: SafeEpubRendition,
    generation: number,
    ownerView = this.ownerDocument.defaultView,
  ): void {
    if (
      !this.isConnected
      || generation !== this.generation
      || this.ownerDocument.defaultView !== ownerView
      || rendition !== this.rendition
    ) return;
    this.failCurrentLoad(error);
  }

  /** Maps selection geometry from an epub.js chapter viewport through every containing iframe
   *  into this component's owner viewport. `getClientRects()` is already scroll-adjusted; each
   *  frame's live border box and content viewport ratio add its position, border and CSS scale. */
  private translateSelectionRects(
    rects: readonly TextSelectRect[],
    sourceWindow?: Window,
  ): TextSelectRect[] {
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow || !sourceWindow) return [];
    const translated: TextSelectRect[] = [];
    for (const rect of rects) {
      let x = Number(rect.x ?? rect.left);
      let y = Number(rect.y ?? rect.top);
      let width = Number(rect.width);
      let height = Number(rect.height);
      if (![x, y, width, height].every(Number.isFinite)) continue;
      let current: Window | null = sourceWindow;
      let valid = true;
      while (current && current !== ownerWindow) {
        // Keeps the peer seam usable with a minimal Window-shaped test double. Real Window
        // objects always expose `frameElement`, so production geometry never takes this branch.
        if (!('frameElement' in current)) {
          current = ownerWindow;
          break;
        }
        let frameElement: Element | null;
        try {
          frameElement = current.frameElement;
        } catch {
          valid = false;
          break;
        }
        const frameWindow = frameElement?.ownerDocument.defaultView;
        if (!frameElement || !frameWindow || !(frameElement instanceof frameWindow.HTMLElement)) {
          valid = false;
          break;
        }
        const frame = frameElement as HTMLElement;
        const frameRect = frame.getBoundingClientRect();
        const borderBoxWidth = frame.offsetWidth || frame.clientWidth;
        const borderBoxHeight = frame.offsetHeight || frame.clientHeight;
        const viewportWidth = current.innerWidth || frame.clientWidth;
        const viewportHeight = current.innerHeight || frame.clientHeight;
        if (
          borderBoxWidth <= 0
          || borderBoxHeight <= 0
          || viewportWidth <= 0
          || viewportHeight <= 0
        ) {
          valid = false;
          break;
        }
        const borderScaleX = frameRect.width / borderBoxWidth;
        const borderScaleY = frameRect.height / borderBoxHeight;
        const contentScaleX = (frame.clientWidth * borderScaleX) / viewportWidth;
        const contentScaleY = (frame.clientHeight * borderScaleY) / viewportHeight;
        x = frameRect.left + frame.clientLeft * borderScaleX + x * contentScaleX;
        y = frameRect.top + frame.clientTop * borderScaleY + y * contentScaleY;
        width *= contentScaleX;
        height *= contentScaleY;
        current = frame.ownerDocument.defaultView;
      }
      if (!valid || current !== ownerWindow) continue;
      translated.push(Object.freeze({
        x,
        y,
        width,
        height,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
      }));
    }
    return translated;
  }

  private displayLocation(location: string): void {
    const rendition = this.rendition;
    if (!rendition) return;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    if (!ownerView) return;
    try {
      void Promise.resolve(rendition.display(location)).catch((error: unknown) => {
        this.reportRenditionFailure(error, rendition, generation, ownerView);
      });
    } catch (error) {
      this.reportRenditionFailure(error, rendition, generation, ownerView);
    }
  }

  private runRenditionNavigation(action: 'previous' | 'next'): void {
    const rendition = this.rendition;
    if (!rendition) return;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    if (!ownerView) return;
    try {
      const task = action === 'previous' ? rendition.prev() : rendition.next();
      void Promise.resolve(task).catch((error: unknown) => {
        this.reportRenditionFailure(error, rendition, generation, ownerView);
      });
    } catch (error) {
      this.reportRenditionFailure(error, rendition, generation, ownerView);
    }
  }

  private previous = (): void => { this.runRenditionNavigation('previous'); };
  private next = (): void => { this.runRenditionNavigation('next'); };

  // -- table of contents -------------------------------------------------------------------------

  /** Flattens the EPUB's own navigation document (`book.navigation.toc`, populated once
   *  `book.ready` resolves) into a document-ordered outline. `level` starts at 1 for a top-level
   *  entry and increases with nesting depth; `id` falls back to `href` when a navigation entry
   *  has none. Resolves `[]` before a book has loaded. */
  async getToc(): Promise<EbookTocItem[]> {
    const book = this.book;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    if (!book || !ownerView) return [];
    try {
      await book.ready;
    } catch {
      return [];
    }
    if (!this.isCurrentLoad(generation, ownerView) || this.book !== book) return [];
    return [...projectToc(inheritedDataValue(book.getNavigation(), 'toc'))];
  }

  // -- anchor-target: applyAnchor per kind ---------------------------------------------------------

  override async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    const operation = ++this.anchorOperationGeneration;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    const book = this.book;
    const rendition = this.rendition;
    try {
      // Deliberately the mixin's `performScrollToAnchor()`, not `super.scrollToAnchor()`: the
      // mixin's own `scrollToAnchor()` now wraps a throwing `applyAnchor()` in its OWN safety net
      // (see `anchor-target.ts`'s doc comments on that split), which would otherwise catch this
      // call's throw before it ever reaches the catch block below -- making this component's own
      // localized rendition-failure alert unreachable. `performScrollToAnchor()` is the same
      // retry/generation logic
      // with no safety net of its own, so this override's behavior is otherwise unchanged.
      //
      // TypeScript cannot spell `super.performScrollToAnchor(target)` here: the mixin's exported
      // return type is deliberately narrowed to `LyraAnchorTarget`'s public surface (plus
      // `renderAnchorLiveRegion()`), so `performScrollToAnchor` -- a `protected` mixin member not
      // part of that public contract -- is invisible through `super`, even though it's the real
      // immediate-base implementation at runtime (mirrors `archive-viewer.class.ts`'s identical
      // `applyAnchor` workaround for the same narrowed-type limitation).
      const performScrollToAnchor = (
        Object.getPrototypeOf(LyraEbookViewer.prototype) as unknown as {
          performScrollToAnchor(anchorTarget: LyraAnchor | string): Promise<boolean>;
        }
      ).performScrollToAnchor;
      return await performScrollToAnchor.call(this, target);
    } catch (error) {
      if (
        operation !== this.anchorOperationGeneration
        || !ownerView
        || !this.isCurrentLoad(generation, ownerView)
        || this.book !== book
        || this.rendition !== rendition
      ) return false;
      if (rendition) this.reportRenditionFailure(error, rendition, generation, ownerView);
      this.emit('lr-anchor-result', { found: false });
      return false;
    }
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    const rendition = this.rendition;
    const operation = this.anchorOperationGeneration;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    if (!rendition || !ownerView) return false;
    if (anchor.kind === 'cfi') {
      if (
        operation !== this.anchorOperationGeneration
        || !this.isCurrentLoad(generation, ownerView)
        || rendition !== this.rendition
      )
        return false;
      await rendition.display(anchor.cfi);
      return operation === this.anchorOperationGeneration
        && this.isCurrentLoad(generation, ownerView)
        && rendition === this.rendition;
    }
    if (anchor.kind === 'text-quote') {
      const cfi = await this.findTextQuoteCfi(anchor.quote);
      if (!cfi) return false;
      if (
        operation !== this.anchorOperationGeneration
        || !this.isCurrentLoad(generation, ownerView)
        || rendition !== this.rendition
      )
        return false;
      await rendition.display(cfi);
      return operation === this.anchorOperationGeneration
        && this.isCurrentLoad(generation, ownerView)
        && rendition === this.rendition;
    }
    return false;
  }

  /** Scans the book's spine sections, in document order, for the first `item.find()` match of
   *  `quote` -- the same section-by-section load/find/unload cycle `search()` uses, but stops at
   *  the first hit instead of collecting every match. `null` when no section matches. */
  private async findTextQuoteCfi(quote: string): Promise<string | null> {
    const book = this.book;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    const boundedQuery = boundedViewerSearchQuery(quote, this.effectiveLocale);
    if (!book || !ownerView || !boundedQuery.accepted || !boundedQuery.needle) return null;
    const work = new ViewerSearchWorkBudget();
    const spine = projectSpineItems(book);
    for (const item of spine.items) {
      if (!work.consume('')) return null;
      let loaded = false;
      try {
        await awaitPeerResult(item.load(book.load));
        loaded = true;
        if (!this.isCurrentLoad(generation, ownerView) || this.book !== book) return null;
        const { value: rawResults } = await awaitPeerResult(item.find(quote));
        const results = projectFindResults(rawResults, work);
        if (!this.isCurrentLoad(generation, ownerView) || this.book !== book) return null;
        for (const result of results.matches) {
          if (!work.consume('')) return null;
          return result.cfi;
        }
      } catch {
        continue;
      } finally {
        if (loaded) {
          try {
            item.unload();
          } catch {
            // A malformed optional peer cleanup cannot invalidate an already-contained scan.
          }
        }
      }
    }
    return null;
  }

  // -- highlight painting --------------------------------------------------------------------------

  /** Re-applies every `cfi` highlight via `rendition.annotations.highlight()`, clearing whatever
   *  this instance previously painted first -- epub.js doesn't persist annotations across a fresh
   *  `renderTo()`, so this also runs once right after a (re)load finishes. Highlights whose anchor
   *  isn't `cfi` aren't paintable against epub.js's own annotation API and are skipped. */
  private repaintHighlights(): void {
    const rendition = this.rendition;
    if (!rendition) return;
    const book = this.book;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    const work = new ViewerSearchWorkBudget();
    for (const cfi of this.paintedHighlightCfis) {
      if (!work.consume(cfi)) break;
      rendition.annotations.remove(cfi, 'highlight');
    }
    this.paintedHighlightCfis = [];
    let painted = 0;
    for (const highlight of prioritizedHighlightCandidates(this.highlights, this.activeHighlightId)) {
      if (highlight.anchor.kind !== 'cfi') continue;
      if (painted >= MAX_PAINTED_HIGHLIGHTS) break;
      const cfi = highlight.anchor.cfi.trim();
      if (!cfi || cfi.length > VIEWER_SEARCH_QUERY_LIMIT || !work.consume(cfi)) continue;
      const tone = highlight.tone ?? 'accent';
      const active = highlight.id === this.activeHighlightId;
      const styles: Record<string, string> = this.resolveHighlightFill(TONE_FILL_TOKEN[tone]);
      if (active) {
        const forcedColors = this.ownerDocument.defaultView
          ?.matchMedia?.('(forced-colors: active)').matches ?? false;
        styles['stroke'] = forcedColors
          ? 'CanvasText'
          : this.resolveHighlightFill(ACTIVE_HIGHLIGHT_STROKE_TOKEN).fill;
        // Width/dash are unitless SVG presentation attributes. Together they preserve an active
        // distinction without depending on color, including under forced-colors substitution.
        styles['stroke-width'] = '3';
        styles['stroke-dasharray'] = '2 1';
      }
      rendition.annotations.highlight(
        cfi,
        { id: highlight.id },
        () => {
          if (!book || !ownerView || !this.isCurrentBookRendition(generation, ownerView, book, rendition)) return;
          this.emit('lr-highlight-activate', { highlightId: highlight.id });
        },
        active ? `lr-hl-${tone} lr-ebook-highlight-active` : `lr-hl-${tone}`,
        styles,
      );
      this.paintedHighlightCfis.push(cfi);
      painted++;
    }
  }

  private repaintSearchAnnotation(): void {
    const rendition = this.rendition;
    const cfi = this.searchAnnotationCfi;
    if (!rendition || !cfi) return;
    rendition.annotations.remove(cfi, 'highlight');
    rendition.annotations.highlight(
      cfi,
      {},
      undefined,
      'lr-ebook-search',
      this.resolveHighlightFill(SEARCH_MATCH_FILL_TOKEN),
    );
  }

  /** Repaints all concrete iframe annotation colors against one live rendition. Peer failures are
   *  correlated to the current load instead of escaping a property/theme update as an unhandled
   *  exception. */
  private repaintAnnotations(): void {
    const rendition = this.rendition;
    if (!rendition) return;
    try {
      this.repaintHighlights();
      this.repaintSearchAnnotation();
    } catch (error) {
      this.reportRenditionFailure(error, rendition, this.generation);
    }
  }

  // -- search ----------------------------------------------------------------------------------------

  /** Case-insensitive search across every spine section, in document order, via epub.js's own
   *  `item.load()`/`item.find()`/`item.unload()`. Navigates to and highlights the first match once
   *  the scan completes. A newer `search()` call, `clearSearch()`, or a `src` change (via
   *  `teardown()`) aborts an in-flight scan. An empty/whitespace-only query behaves like
   *  `clearSearch()` and resolves `0`. Queries are capped at 4,096 code units; at most 1,000 spine
   *  items and 4,000,000 result code units are inspected and 10,000 matches retained.
   *  `lr-search-change.detail.matchCountExact=false` identifies a ceiling-truncated return. */
  async search(query: string): Promise<number> {
    const generation = ++this.searchGeneration;
    const ownerView = this.ownerDocument.defaultView;
    const boundedQuery = boundedViewerSearchQuery(query, this.effectiveLocale);
    this.searchQuery = query;
    this.lastSearchLocale = this.effectiveLocale;
    this.clearSearchAnnotation();
    if (!boundedQuery.accepted) {
      this.searchMatches = [];
      this.searchMatchCountExact = false;
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    if (!this.book || !ownerView || !boundedQuery.needle) {
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    const matches: EbookSearchMatch[] = [];
    let matchCountExact = true;
    let matchCeilingExceeded = false;
    const book = this.book;
    const work = new ViewerSearchWorkBudget();
    const spine = projectSpineItems(book);
    if (!spine.exact) matchCountExact = false;
    for (const item of spine.items) {
      if (
        generation !== this.searchGeneration
        || this.ownerDocument.defaultView !== ownerView
        || !this.isConnected
      )
        return this.searchMatches.length;
      if (!work.consume('')) {
        matchCountExact = false;
        break;
      }
      let loaded = false;
      try {
        await awaitPeerResult(item.load(book.load));
        loaded = true;
        if (
          generation !== this.searchGeneration
          || this.ownerDocument.defaultView !== ownerView
          || !this.isConnected
          || this.book !== book
        )
          return this.searchMatches.length;
        const { value: rawResults } = await awaitPeerResult(item.find(query.trim()));
        const results = projectFindResults(rawResults, work);
        if (
          generation !== this.searchGeneration
          || this.ownerDocument.defaultView !== ownerView
          || !this.isConnected
          || this.book !== book
        )
          return this.searchMatches.length;
        if (!results.exact) matchCountExact = false;
        for (const r of results.matches) {
          if (!work.consume('')) {
            matchCountExact = false;
            matchCeilingExceeded = true;
            break;
          }
          if (matches.length === MAX_SEARCH_MATCHES) {
            matchCountExact = false;
            matchCeilingExceeded = true;
            break;
          }
          matches.push(r);
        }
      } catch {
        matchCountExact = false;
        continue;
      } finally {
        if (loaded) {
          try {
            item.unload();
          } catch {
            matchCountExact = false;
          }
        }
      }
      if (matchCeilingExceeded) break;
    }
    if (
      generation !== this.searchGeneration
      || this.ownerDocument.defaultView !== ownerView
      || !this.isConnected
      || this.book !== book
    )
      return this.searchMatches.length;
    this.searchMatches = matches;
    this.searchMatchCountExact = matchCountExact;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0) await this.showSearchMatch(this.searchActiveIndex, generation, ownerView);
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    const generation = ++this.searchGeneration;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    return this.showSearchMatch(this.searchActiveIndex, generation);
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    const generation = ++this.searchGeneration;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    return this.showSearchMatch(this.searchActiveIndex, generation);
  }

  /** Clears the query, matches, and any painted search annotation, and resets `lr-search-change`
   *  to a 0-match/no-active-index state. */
  clearSearch(): void {
    this.searchGeneration++;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.clearSearchAnnotation();
    this.emit('lr-search-change', { query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
  }

  private clearSearchAnnotation(): void {
    const cfi = this.searchAnnotationCfi;
    this.searchAnnotationCfi = undefined;
    const rendition = this.rendition;
    const generation = this.generation;
    const ownerView = this.ownerDocument.defaultView;
    if (!cfi || !rendition || !ownerView) return;
    try {
      rendition.annotations.remove(cfi, 'highlight');
    } catch (error) {
      this.reportRenditionFailure(error, rendition, generation, ownerView);
    }
  }

  private async showSearchMatch(
    index: number,
    generation = this.searchGeneration,
    ownerView = this.ownerDocument.defaultView,
  ): Promise<boolean> {
    const match = this.searchMatches[index];
    const rendition = this.rendition;
    if (
      !match
      || !rendition
      || generation !== this.searchGeneration
      || !ownerView
      || !this.isConnected
      || this.ownerDocument.defaultView !== ownerView
    ) return false;
    this.clearSearchAnnotation();
    try {
      await rendition.display(match.cfi);
    } catch (error) {
      if (
        generation === this.searchGeneration
        && rendition === this.rendition
        && this.ownerDocument.defaultView === ownerView
      ) {
        this.reportRenditionFailure(error, rendition, this.generation, ownerView);
      }
      return false;
    }
    if (
      generation !== this.searchGeneration
      || rendition !== this.rendition
      || this.searchMatches[index] !== match
      || !this.isConnected
      || this.ownerDocument.defaultView !== ownerView
    ) return false;
    try {
      rendition.annotations.highlight(
        match.cfi,
        {},
        undefined,
        'lr-ebook-search',
        this.resolveHighlightFill(SEARCH_MATCH_FILL_TOKEN),
      );
    } catch (error) {
      this.reportRenditionFailure(error, rendition, this.generation, ownerView);
      return false;
    }
    this.searchAnnotationCfi = match.cfi;
    return true;
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
      activeIndex: this.searchActiveIndex,
    });
    announceSearchResult(
      (key, fallback, values) => this.localize(key, fallback, values),
      this.announcer,
      this.effectiveLocale,
      this.searchMatches.length,
      this.searchActiveIndex,
    );
  }

  /** Resolves a `{ token, fallback }` pair to the mark's `fill` `styles` arg, reading the token's
   *  live concrete value off this instance via its owner window's `getComputedStyle` (falling back to its
   *  light-theme default when unresolved, e.g. before this element's own stylesheet is attached). */
  private resolveHighlightFill({ token, fallback }: { token: string; fallback: string }): { fill: string } {
    const value = this.ownerDocument.defaultView?.getComputedStyle(this).getPropertyValue(token).trim() ?? '';
    return { fill: value || fallback };
  }

  // -- rendering --------------------------------------------------------------------------------------------

  private renderStatus(): TemplateResult | typeof nothing {
    if (this.ebookState.kind === 'loading') {
      return html`<p class="status-note">${this.localize('loadingDocument')}</p>`;
    }
    if (this.ebookState.kind === 'error') return html`<div part="error">${this.ebookState.message}</div>`;
    if (this.ebookState.kind === 'idle') {
      return html`<p class="status-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
    return nothing;
  }

  override render(): TemplateResult {
    const disabled = this.ebookState.kind !== 'ready';
    return html`
      <div
        part="base"
        aria-busy=${this.ebookState.kind === 'loading' ? 'true' : 'false'}
        style=${sanitizeCssLength(this.maxHeight)
          ? styleMap({ '--lr-ebook-viewer-max-height': sanitizeCssLength(this.maxHeight)! })
          : nothing}
      >
        <div part="toolbar">
          <button part="previous-button" type="button" aria-label=${this.localize('ebookViewerPreviousChapter')} ?disabled=${disabled} @click=${this.previous}>
            <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
          </button>
          <button part="next-button" type="button" aria-label=${this.localize('ebookViewerNextChapter')} ?disabled=${disabled} @click=${this.next}>
            <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
          </button>
        </div>
        <div part="mount" role="region" aria-label=${this.accessibleLabel ?? (this.name || this.localize('ebookViewerRegionLabel'))} ${ref(this.mountRef)}></div>
        ${this.renderStatus()}
        ${this.renderAnchorLiveRegion()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-ebook-viewer': LyraEbookViewer; }
}
