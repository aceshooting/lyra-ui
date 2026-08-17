import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { styles } from './pagination.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_item, LYRA_DEFAULT_items, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_next, LYRA_DEFAULT_open, LYRA_DEFAULT_paginationApplied, LYRA_DEFAULT_paginationEmptySummary, LYRA_DEFAULT_paginationFirstPage, LYRA_DEFAULT_paginationJumpToPage, LYRA_DEFAULT_paginationLabel, LYRA_DEFAULT_paginationLastPage, LYRA_DEFAULT_paginationPage, LYRA_DEFAULT_paginationSummary, LYRA_DEFAULT_popover, LYRA_DEFAULT_previous, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** `standard` renders the numbered page list; `compact` collapses it to the page-jump field. */
export type LyraPaginationFormat = 'standard' | 'compact';

function normalizePaginationFormat(value: unknown): LyraPaginationFormat {
  return value === 'compact' ? 'compact' : 'standard';
}

export interface LyraPaginationChangeDetail {
  readonly page: number;
  readonly pageSize: number;
}

export interface LyraPaginationEventMap {
  'lr-before-page-change': CustomEvent<LyraPaginationChangeDetail>;
  'lr-page-change': CustomEvent<LyraPaginationChangeDetail>;
  blur: FocusEvent;
  focus: FocusEvent;
}

/** One rendered slot in the page list: a real page, or a run of pages that was skipped. */
type PaginationItem =
  | { readonly type: 'page'; readonly page: number }
  | { readonly type: 'gap'; readonly target: number };

/** Upper bound on rendered page slots. `totalPages` is derived from consumer-supplied item counts
 *  and can be arbitrarily large (a million items at one per page), so the list length is capped
 *  rather than trusted; `siblingCount`/`boundaryCount` are clamped to keep it reachable. */
const MAX_PAGE_SLOTS = 101;
const MAX_WINDOW_COUNT = 25;

/** Inclusive integer sequence, empty when the bounds cross. */
function pageSequence(from: number, to: number): number[] {
  return to < from ? [] : Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
}

/**
 * Lays out the page list: `boundaryCount` pages pinned at each end, a window of `siblingCount`
 * pages either side of the current page, and a gap wherever a run of pages was skipped.
 *
 * The rendered slot count stays the same on every page, so the control keeps its width while the
 * reader pages through instead of jittering as gaps appear and disappear. That is what the last
 * step buys: a side that turns out not to need a gap hands its slot back to the window as one more
 * page number.
 */
function paginationItems(
  current: number,
  totalPages: number,
  siblingCount: number,
  boundaryCount: number
): PaginationItem[] {
  if (totalPages <= 0) return [];
  const asPage = (page: number): PaginationItem => ({ type: 'page', page });
  // Both boundaries, both sibling runs, the current page, and one slot per potential gap.
  const budget = Math.min(boundaryCount * 2 + siblingCount * 2 + 3, MAX_PAGE_SLOTS);
  if (totalPages <= budget) return pageSequence(1, totalPages).map(asPage);

  const windowFloor = boundaryCount + 1; // first page after the leading boundary
  const windowCeiling = totalPages - boundaryCount; // last page before the trailing boundary
  let from = current - siblingCount;
  let to = current + siblingCount;
  // Push the window back inside the boundaries, spending the overflow on the opposite side rather
  // than shortening the window.
  if (from < windowFloor) {
    to += windowFloor - from;
    from = windowFloor;
  }
  if (to > windowCeiling) {
    from -= to - windowCeiling;
    to = windowCeiling;
  }
  from = Math.max(from, windowFloor);
  to = Math.min(to, windowCeiling);

  let spare = (from > windowFloor ? 0 : 1) + (to < windowCeiling ? 0 : 1);
  while (spare > 0) {
    if (to < windowCeiling) to += 1;
    else if (from > windowFloor) from -= 1;
    else break;
    spare -= 1;
  }

  return [
    ...pageSequence(1, boundaryCount).map(asPage),
    ...(from > windowFloor
      ? [
          {
            type: 'gap',
            target: Math.max(windowFloor, from - Math.max(1, siblingCount * 2 + 1)),
          } as const,
        ]
      : []),
    ...pageSequence(from, to).map(asPage),
    ...(to < windowCeiling
      ? [
          {
            type: 'gap',
            target: Math.min(windowCeiling, to + Math.max(1, siblingCount * 2 + 1)),
          } as const,
        ]
      : []),
    ...pageSequence(totalPages - boundaryCount + 1, totalPages).map(asPage),
  ];
}

/**
 * `<lr-pagination>` — controlled, server-friendly page navigation: a numbered
 * page list with elided gaps, optional first/last controls, an optional
 * item-range summary, and a compact layout that swaps the list for an
 * editable page jump.
 *
 * The component never mutates `page`. Button and compact-field activation emits
 * `lr-page-change`; link-mode anchors navigate without either page-change event. The consumer
 * applies a button/field request after its own routing or data-fetch decision. Once the `page` property changes, a polite
 * live region announces the applied page and focus follows the newly current
 * page control (or the compact page field).
 * Public `focus()`, `blur()`, and `click()` resolve the primary control for the active format:
 * the applied page control in standard format, or the page-jump input in compact format.
 *
 * @customElement lr-pagination
 * @event lr-before-page-change - Fired before a valid button or compact-field page request.
 *   `detail: { page, pageSize }`. Cancelable; vetoing it suppresses `lr-page-change`. Link-mode
 *   anchors navigate without emitting.
 * @event lr-page-change - Fired when a button or compact field requests a valid page.
 *   `detail: { page, pageSize }`. The component remains controlled and never mutates `page`
 *   itself; link-mode anchors navigate without emitting.
 * @slot first-icon - Replacement for the first-page icon.
 * @slot previous-icon - Replacement for the previous-page icon.
 * @slot next-icon - Replacement for the next-page icon.
 * @slot last-icon - Replacement for the last-page icon.
 * @event {FocusEvent} blur - Re-dispatched from an internal pagination control as one bubbling,
 *   composed native `FocusEvent`, preserving its focus payload.
 * @event {FocusEvent} focus - Re-dispatched from an internal pagination control as one bubbling,
 *   composed native `FocusEvent`, preserving its focus payload.
 * @csspart base - Compatibility name for the navigation wrapper; use `pagination`.
 * @csspart pagination - The navigation wrapper. It is the same node as `base`.
 * @csspart summary - The item-range summary.
 * @csspart controls - The previous/pages/next control group.
 * @csspart pages - The `role="list"` wrapper around the numbered page items.
 * @csspart page - One numbered page control; a `<button>`, or an `<a>` when `href-template` is set.
 * @csspart page-current - Also carried by the page control for the applied page, alongside `page`.
 * @csspart button - Shared part on every page, ellipsis, and navigation control.
 * @csspart ellipsis - An interactive control that jumps across a skipped run of pages.
 * @csspart first-button - The first-page button, rendered with `with-edges`.
 * @csspart first-icon - The first-page directional icon.
 * @csspart previous-button - The previous-page button.
 * @csspart previous-icon - The previous-page directional icon.
 * @csspart page-field - The current-page input and page-count wrapper (`format="compact"`).
 * @csspart label - Upstream alias on the same compact wrapper as `page-field`.
 * @csspart page-input - The validated numeric page-jump input (`format="compact"`).
 * @csspart page-count - The total page count shown after the input (`format="compact"`).
 * @csspart next-button - The next-page button.
 * @csspart next-icon - The next-page directional icon.
 * @csspart last-button - The last-page button, rendered with `with-edges`.
 * @csspart last-icon - The last-page directional icon.
 * @csspart live-region - The visually hidden, `aria-hidden` mirror of the applied-page
 * announcement. The announcement itself lands in the shared light-DOM polite region
 * (`acquireAnnouncementSink()` in `internal/announcer.ts`), because a live region inside a shadow
 * root is not reliably announced; this part is a styling/inspection surface only.
 * @cssstate disabled - Applied when the public `disabled` property is true.
 * @cssprop --lr-pagination-control-size - Control inline/block size; defaults from the `size` variant.
 * @cssprop --lr-pagination-font-size - Control font size; defaults from the `size` variant.
 * @cssprop --lr-pagination-control-bg - Resting background of every control; defaults from the
 *   `appearance` variant.
 * @cssprop --lr-pagination-control-border-color - Resting border color of every control; defaults
 *   from the `appearance` variant.
 * @cssprop [--lr-pagination-control-color=var(--lr-color-text)] - Resting control foreground.
 * @cssprop [--lr-pagination-current-bg=var(--lr-color-brand)] - Current-page background.
 * @cssprop [--lr-pagination-current-border-color=transparent] - Current-page border color.
 * @cssprop [--lr-pagination-current-color=var(--lr-color-on-brand)] - Current-page foreground.
 * @cssprop [--lr-pagination-hover-bg=var(--lr-color-brand-quiet)] - Ordinary control hover background.
 * @cssprop [--lr-pagination-hover-border-color=var(--lr-color-brand)] - Ordinary control hover border color.
 * @cssprop --lr-pagination-active-bg - Ordinary control pressed background; defaults to the
 *   current quiet-brand active mix.
 * @cssprop [--lr-pagination-active-border-color=var(--lr-color-brand)] - Ordinary control pressed border color.
 * @cssprop [--lr-pagination-current-hover-bg=var(--lr-color-brand)] - Current-page hover background.
 * @cssprop [--lr-pagination-current-hover-border-color=transparent] - Current-page hover border color.
 * @cssprop --lr-pagination-current-active-bg - Current-page pressed background; defaults to the
 *   current brand active mix.
 * @cssprop [--lr-pagination-current-active-border-color=transparent] - Current-page pressed border color.
 * @cssprop [--lr-pagination-control-radius=var(--lr-radius)] - Border radius of navigation
 * buttons and the page input.
 * @cssprop [--lr-pagination-control-padding=var(--lr-space-xs)] - Inner padding of the nav buttons
 * and the page input. Uniform across every `size` (the control footprint is fixed by
 * `--lr-pagination-control-size`, so this only adjusts the icon/digit inset).
 * @cssprop [--lr-pagination-base-gap=var(--lr-space-m)] - Gap between the summary and controls.
 * @cssprop [--lr-pagination-controls-gap=var(--lr-space-xs)] - Gap between the navigation controls
 *   and the numbered-page list or compact page field.
 * @cssprop [--lr-pagination-pages-gap=var(--lr-space-xs)] - Gap between numbered page controls.
 * @cssprop [--lr-pagination-invalid-border=var(--lr-color-danger)] - Border color of
 *   `[part="page-input"]` while the typed page is out of range (`aria-invalid="true"`).
 * @status stable
 * @since 4.0.0
 */
export class LyraPagination extends LyraElement<LyraPaginationEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    item: LYRA_DEFAULT_item,
    items: LYRA_DEFAULT_items,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    next: LYRA_DEFAULT_next,
    open: LYRA_DEFAULT_open,
    paginationApplied: LYRA_DEFAULT_paginationApplied,
    paginationEmptySummary: LYRA_DEFAULT_paginationEmptySummary,
    paginationFirstPage: LYRA_DEFAULT_paginationFirstPage,
    paginationJumpToPage: LYRA_DEFAULT_paginationJumpToPage,
    paginationLabel: LYRA_DEFAULT_paginationLabel,
    paginationLastPage: LYRA_DEFAULT_paginationLastPage,
    paginationPage: LYRA_DEFAULT_paginationPage,
    paginationSummary: LYRA_DEFAULT_paginationSummary,
    popover: LYRA_DEFAULT_popover,
    previous: LYRA_DEFAULT_previous,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  /** The currently applied page. Controlled; this component never mutates it. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Number of items represented by one page. Non-positive values produce no pages. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = 10;
  /** Total number of items across every page. Non-positive values render the empty state.
   *  Named `total` to match `wa-pagination`; it used to be `total-items`, which a mechanical
   *  rename left unset — silently rendering the empty state. */
  @property({ type: Number }) total = 0;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Disables navigation and exposes `aria-busy="true"` while a page is loading. */
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Renders the localized "showing X–Y of Z" summary row. Opt-in and `false` by default,
   *  matching `wa-pagination`. It used to be `hide-summary`, an opt-*out* whose default showed the
   *  summary, so a mechanical rename silently added a row to every migrated pager. */
  @property({ type: Boolean, attribute: 'with-summary', reflect: true })
  withSummary = false;
  /** Control footprint, on the library-wide six-step ladder. Web Awesome's and Shoelace's
   *  `small`/`medium`/`large` spellings are accepted as exact synonyms of `s`/`m`/`l`, so
   *  migrating from either is a tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  private _format: LyraPaginationFormat = 'standard';
  /** `standard` renders the numbered page list; `compact` swaps it for the editable page jump,
   *  which fits a toolbar or a card footer where a full list would not. Unknown runtime values
   *  normalize to `standard`. */
  @property({ reflect: true })
  get format(): LyraPaginationFormat {
    return this._format;
  }
  set format(value: LyraPaginationFormat) {
    const previous = this._format;
    this._format = normalizePaginationFormat(value);
    this.requestUpdate('format', previous);
  }
  /** Pages shown either side of the current page in the numbered list. */
  @property({ type: Number, attribute: 'sibling-count' }) siblingCount = 2;
  /** Pages always pinned at the start and at the end of the numbered list. */
  @property({ type: Number, attribute: 'boundary-count' }) boundaryCount = 1;
  /** Renders buttons that jump straight to the first and last page. */
  @property({ type: Boolean, attribute: 'with-edges', reflect: true })
  withEdges = false;
  /** Hides the previous and next controls while retaining pages and optional edge controls. */
  @property({ type: Boolean, attribute: 'without-nav', reflect: true })
  withoutNav = false;
  /** Renders nothing when zero or one page exists. */
  @property({ type: Boolean, attribute: 'hide-single-page', reflect: true })
  hideSinglePage = false;
  /** Renders each page as a link instead of a button, for SSR, crawlers, and no-JS navigation.
   *  A string uses `{page}` as the placeholder (`/products?page={page}`); a function receives the
   *  page number and returns the URL. A page whose resolved URL is not a safe navigation target
   *  falls back to a button. */
  @property({ attribute: 'href-template' }) hrefTemplate:
    | string | ((page: number) => string) = '';
  /** Resting look of every control. The applied page stays a solid brand chip in all of them, so
   *  it is never the appearance that decides whether the current page is identifiable. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';

  /** Optional item noun used in the summary. Empty uses the localized `item`/`items` keys. */
  @property({ attribute: 'item-label' }) itemLabel = '';
  /** Accessible name forwarded from the host to the internal navigation landmark. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Accessible-name override for the internal navigation landmark, applied when no host
   *  `aria-label` is set. Optional. Omitting it localizes the default `paginationLabel` message;
   *  an explicit empty string renders no visible/accessible label. */
  @property() label?: string;
  /** Optional control-label overrides. Omission localizes the matching message key; supplied
   * strings, including the built-in English text or an empty string, render verbatim. */
  @property({ attribute: 'page-label' }) pageLabel?: string;
  @property({ attribute: 'previous-label' }) previousLabel?: string;
  @property({ attribute: 'next-label' }) nextLabel?: string;
  @property({ attribute: 'first-label' }) firstLabel?: string;
  @property({ attribute: 'last-label' }) lastLabel?: string;

  @state() private draftPage = '';
  @state() private invalidDraft = false;
  @state() private liveText = '';
  @query('[part="page-input"]') private pageInput?: HTMLInputElement;
  private readonly internals = attachInternalsSafely(this);
  private initialized = false;
  /** Handle on the shared light-DOM live region page changes actually announce through -- a region
   *  rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores one
   *  outright), so `[part="live-region"]` is only an `aria-hidden` mirror. */
  private sink?: AnnouncementSink;
  private pendingFocusPage?: number;
  private pendingFocusOrigin: Element | null = null;

  private clearPendingFocus(): void {
    this.pendingFocusPage = undefined;
    this.pendingFocusOrigin = null;
  }

  private focusTargetIsInside(target: EventTarget): boolean {
    if (typeof target !== 'object' || !('nodeType' in target)) return false;
    const node = target as Node;
    return this.contains(node) || this.renderRoot.contains(node);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Acquired on connect, not on the first page change: assistive tech has to have been observing
    // a live region *before* text arrives for the change to be announced at all.
    this.sink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.clearPendingFocus();
    this.sink?.release();
    this.sink = undefined;
    super.disconnectedCallback();
  }

  /** The primary page control for the active format. */
  private get primaryControl(): HTMLElement | undefined {
    return this.format === 'compact'
      ? this.pageInput
      : this.renderRoot.querySelector<HTMLElement>('[part~="page-current"]') ?? undefined;
  }

  /** Focus the current-page button/link, or the editable page-jump input in compact format. */
  override focus(options?: FocusOptions): void {
    this.primaryControl?.focus(options);
  }

  /** Blur the primary page control for the active format. */
  override blur(): void {
    this.primaryControl?.blur();
  }

  /** Forward host activation to the primary page control for the active format. */
  override click(): void {
    if (!this.controlsDisabled) this.primaryControl?.click();
  }

  /** Read-time-safe view of `total` -- non-negative, finite, truncated to a whole item count. */
  private get normalizedTotalItems(): number {
    return finiteCount(this.total);
  }

  /** Read-time-safe view of `pageSize` -- non-negative, finite, truncated to a whole item count. */
  private get normalizedPageSize(): number {
    return finiteCount(this.pageSize);
  }

  /** Private total-page calculation used by rendering and navigation. */
  private get calculatedTotalPages(): number {
    if (this.normalizedTotalItems === 0 || this.normalizedPageSize === 0) return 0;
    return Math.ceil(this.normalizedTotalItems / this.normalizedPageSize);
  }

  /** The total number of pages, derived from `total` and `pageSize`. */
  get totalPages(): number {
    return this.calculatedTotalPages;
  }

  /** Read-time-safe view of the controlled `page` property, clamped to `[1, totalPages]` (the
   *  page count itself depending on the now-safe `total`/`pageSize` above) -- never mutates
   *  `page` itself, matching this component's fully controlled contract. */
  private get currentPage(): number {
    if (this.calculatedTotalPages === 0) return 0;
    return finiteInteger(this.page, 1, 1, this.calculatedTotalPages);
  }

  private get controlsDisabled(): boolean {
    return this.disabled || this.loading || this.calculatedTotalPages === 0;
  }

  /** Read-time-safe view of `siblingCount`, clamped so the rendered list stays bounded. */
  private get normalizedSiblingCount(): number {
    return finiteCount(this.siblingCount, 2, MAX_WINDOW_COUNT);
  }

  /** Read-time-safe view of `boundaryCount`, clamped so the rendered list stays bounded. */
  private get normalizedBoundaryCount(): number {
    return finiteCount(this.boundaryCount, 1, MAX_WINDOW_COUNT);
  }

  /** The URL this page would navigate to, or `null` when there is no template or the resolved URL
   *  is not a safe navigation target (a `javascript:`/`data:` template fails closed to a button
   *  rather than shipping the scheme into an anchor). */
  private pageHref(page: number): string | null {
    const template = this.hrefTemplate;
    if (typeof template === 'function') return safeLinkHref(template(page));
    if (typeof template !== 'string' || template === '') return null;
    return safeLinkHref(template.split('{page}').join(String(page)));
  }

  private get hasHrefTemplate(): boolean {
    const template = this.hrefTemplate;
    return (
      typeof template === 'function' || (typeof template === 'string' && template !== '')
    );
  }

  /** Resolve a URL only for a control that can navigate. Configured link mode keeps inactive
   * controls as anchors without invoking a consumer callback or exposing an `href`. */
  private pageLink(page: number, inactive: boolean): { href: string | null; renderAnchor: boolean } {
    if (!this.hasHrefTemplate) return { href: null, renderAnchor: false };
    if (inactive || page < 1 || page > this.calculatedTotalPages) {
      return { href: null, renderAnchor: true };
    }
    const href = this.pageHref(page);
    return { href, renderAnchor: href !== null };
  }

  private localizedProperty(key: string, value: string | undefined): string {
    return value == null ? this.localize(key) : value;
  }

  private formatNumber(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private summaryText(): string {
    const total = this.normalizedTotalItems;
    const itemLabel = this.itemLabel || this.localize(total === 1 ? 'item' : 'items');
    if (this.calculatedTotalPages === 0) {
      return this.localize('paginationEmptySummary', undefined, {
        total: this.formatNumber(0),
        itemLabel,
      });
    }
    const start = (this.currentPage - 1) * this.normalizedPageSize + 1;
    const end = Math.min(total, this.currentPage * this.normalizedPageSize);
    return this.localize('paginationSummary', undefined, {
      start: this.formatNumber(start),
      end: this.formatNumber(end),
      total: this.formatNumber(total),
      itemLabel,
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    setCustomState(this.internals, 'disabled', this.disabled);
    if (changed.has('page') || changed.has('pageSize') || changed.has('total')) {
      this.draftPage = this.calculatedTotalPages === 0 ? '' : String(this.currentPage);
      this.invalidDraft = false;
    }
    if (this.initialized && changed.has('page') && this.calculatedTotalPages > 0) {
      this.liveText = this.localize('paginationApplied', undefined, {
        page: this.formatNumber(this.currentPage),
        totalPages: this.formatNumber(this.calculatedTotalPages),
      });
      // Announced from the computation, not from a rendered text change: the shared region appends
      // each announcement as its own node, so returning to a page already announced is read again
      // instead of being a silent no-op.
      this.sink?.announce(this.liveText);
    }
    this.initialized = true;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('page') || this.pendingFocusPage === undefined) return;
    const requestedPage = this.pendingFocusPage;
    const active = deepActiveElementIn(this.ownerDocument);
    const focusMovedOutside =
      active !== this.pendingFocusOrigin &&
      active !== null &&
      active !== this.ownerDocument.body &&
      !this.focusTargetIsInside(active);
    this.clearPendingFocus();
    if (this.currentPage !== requestedPage || focusMovedOutside) return;
    const target =
      this.format === 'compact' ? this.pageInput : this.renderRoot.querySelector<HTMLElement>('[part~="page-current"]');
    target?.focus();
  }

  private validRequestedPage(value: string): number | null {
    if (value.trim() === '') return null;
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1 || page > this.calculatedTotalPages) return null;
    return page;
  }

  private requestPage(page: number): void {
    if (this.controlsDisabled || page === this.currentPage || page < 1 || page > this.calculatedTotalPages) {
      return;
    }
    const focusOrigin = deepActiveElementIn(this.ownerDocument);
    const detail = (): LyraPaginationChangeDetail =>
      Object.freeze({ page, pageSize: this.normalizedPageSize });
    if (this.emit('lr-before-page-change', detail(), { cancelable: true }).defaultPrevented) {
      this.draftPage = this.calculatedTotalPages === 0 ? '' : String(this.currentPage);
      this.invalidDraft = false;
      return;
    }
    this.pendingFocusPage = page;
    this.pendingFocusOrigin = focusOrigin;
    this.emit('lr-page-change', detail());
    // A controlled input reflects the applied property again after a request.
    this.draftPage = this.calculatedTotalPages === 0 ? '' : String(this.currentPage);
    this.invalidDraft = false;
  }

  private onPageInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.draftPage = input.value;
    this.invalidDraft = input.value !== '' && this.validRequestedPage(input.value) == null;
  };

  private commitPage = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    const page = this.validRequestedPage(input.value);
    if (page == null) {
      this.invalidDraft = true;
      return;
    }
    this.requestPage(page);
  };

  private onPageKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.commitPage(event);
  };

  private onControlFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onControlBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  /** Previous/next. Both directions share one shape so the two never drift apart. */
  private renderNavButton(direction: 'previous' | 'next'): TemplateResult {
    const isPrevious = direction === 'previous';
    const current = this.currentPage;
    const label = isPrevious
      ? this.localizedProperty('previous', this.previousLabel)
      : this.localizedProperty('next', this.nextLabel);
    const spent = isPrevious ? current <= 1 : current >= this.calculatedTotalPages;
    const target = isPrevious ? current - 1 : current + 1;
    const inactive = this.controlsDisabled || spent;
    const { href, renderAnchor } = this.pageLink(target, inactive);
    const part = isPrevious ? 'button previous-button' : 'button next-button';
    const icon = html`<span part=${isPrevious ? 'previous-icon' : 'next-icon'} aria-hidden="true"
      ><slot name=${isPrevious ? 'previous-icon' : 'next-icon'}>${chevronIcon()}</slot></span
    >`;

    if (renderAnchor) {
      return html`<a
        part=${part}
        href=${href ?? nothing}
        aria-label=${label}
        aria-disabled=${inactive ? 'true' : 'false'}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
        >${icon}</a
      >`;
    }

    return html`<button
      part=${part}
      type="button"
      aria-label=${label}
      ?disabled=${this.controlsDisabled || spent}
      @click=${() => this.requestPage(target)}
      @focus=${this.onControlFocus}
      @blur=${this.onControlBlur}
    >
      ${icon}
    </button>`;
  }

  /** First/last. The doubled chevron is the conventional "all the way to the end" glyph, and it
   *  mirrors under RTL through the wrapping part rather than the icon itself. */
  private renderEdgeButton(edge: 'first' | 'last'): TemplateResult {
    const isFirst = edge === 'first';
    const current = this.currentPage;
    const label = isFirst
      ? this.localizedProperty('paginationFirstPage', this.firstLabel)
      : this.localizedProperty('paginationLastPage', this.lastLabel);
    const spent = isFirst ? current <= 1 : current >= this.calculatedTotalPages;
    const target = isFirst ? 1 : this.calculatedTotalPages;
    const inactive = this.controlsDisabled || spent;
    const { href, renderAnchor } = this.pageLink(target, inactive);
    const part = isFirst ? 'button first-button' : 'button last-button';
    const icon = html`<span part=${isFirst ? 'first-icon' : 'last-icon'} aria-hidden="true"
      ><slot name=${isFirst ? 'first-icon' : 'last-icon'}>${chevronIcon()}${chevronIcon()}</slot></span
    >`;

    if (renderAnchor) {
      return html`<a
        part=${part}
        href=${href ?? nothing}
        aria-label=${label}
        aria-disabled=${inactive ? 'true' : 'false'}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
        >${icon}</a
      >`;
    }

    return html`<button
      part=${part}
      type="button"
      aria-label=${label}
      ?disabled=${this.controlsDisabled || spent}
      @click=${() => this.requestPage(target)}
      @focus=${this.onControlFocus}
      @blur=${this.onControlBlur}
    >
      ${icon}
    </button>`;
  }

  /** One numbered page. The visible number is its accessible name -- an extra `aria-label` would
   *  only make a screen reader announce the same digit twice. */
  private renderPage(page: number): TemplateResult {
    const isCurrent = page === this.currentPage;
    // Both branches render the same part names, so the state lives in the part token rather than
    // in an attribute: `::part(page)[aria-current]` is invalid CSS and would silently never match.
    const part = isCurrent ? 'button page page-current' : 'button page';
    const label = this.formatNumber(page);
    const inactive = isCurrent || this.controlsDisabled;
    const { href, renderAnchor } = this.pageLink(page, inactive);

    if (renderAnchor) {
      return html`<a
        part=${part}
        href=${href ?? nothing}
        tabindex=${isCurrent && !this.controlsDisabled ? '0' : nothing}
        aria-current=${isCurrent ? 'page' : 'false'}
        aria-disabled=${this.controlsDisabled ? 'true' : 'false'}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
        >${label}</a
      >`;
    }

    return html`<button
      part=${part}
      type="button"
      aria-current=${isCurrent ? 'page' : 'false'}
      ?disabled=${this.controlsDisabled}
      @click=${() => this.requestPage(page)}
      @focus=${this.onControlFocus}
      @blur=${this.onControlBlur}
    >
      ${label}
    </button>`;
  }

  /** One skipped range. Its target lands several pages toward that side while remaining inside
   * the omitted range, so repeated activation makes steady progress without duplicating a visible
   * page button. */
  private renderEllipsis(target: number): TemplateResult {
    const label = this.localize('paginationJumpToPage', undefined, {
      page: this.formatNumber(target),
    });
    const inactive = this.controlsDisabled;
    const { href, renderAnchor } = this.pageLink(target, inactive);
    if (renderAnchor) {
      return html`<a
        part="button ellipsis"
        href=${href ?? nothing}
        aria-label=${label}
        aria-disabled=${this.controlsDisabled ? 'true' : 'false'}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
        >…</a
      >`;
    }
    return html`<button
      part="button ellipsis"
      type="button"
      aria-label=${label}
      ?disabled=${this.controlsDisabled}
      @click=${() => this.requestPage(target)}
      @focus=${this.onControlFocus}
      @blur=${this.onControlBlur}
    >
      …
    </button>`;
  }

  private renderPageList(): TemplateResult {
    const items = paginationItems(
      this.currentPage,
      this.calculatedTotalPages,
      this.normalizedSiblingCount,
      this.normalizedBoundaryCount
    );

    return html`<ul part="pages" role="list">
      ${items.map((item) =>
        item.type === 'gap'
          ? html`<li role="listitem">${this.renderEllipsis(item.target)}</li>`
          : html`<li role="listitem">${this.renderPage(item.page)}</li>`
      )}
    </ul>`;
  }

  private renderPageField(): TemplateResult {
    const pageLabel = this.localizedProperty('paginationPage', this.pageLabel);

    return html`<span part="page-field label">
      <input
        part="page-input"
        type="number"
        inputmode="numeric"
        min="1"
        max=${Math.max(1, this.calculatedTotalPages)}
        step="1"
        required
        aria-label=${pageLabel}
        aria-invalid=${this.invalidDraft ? 'true' : 'false'}
        .value=${live(this.draftPage)}
        ?disabled=${this.controlsDisabled}
        @input=${this.onPageInput}
        @change=${this.commitPage}
        @keydown=${this.onPageKeyDown}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
      />
      <span part="page-count" aria-hidden="true"> / ${this.formatNumber(this.calculatedTotalPages)}</span>
    </span>`;
  }

  override render(): TemplateResult | typeof nothing {
    if (this.hideSinglePage && this.calculatedTotalPages <= 1) return nothing;
    const navigationLabel =
      this.accessibleLabel || this.localizedProperty('paginationLabel', this.label);

    return html`
      <nav part="base pagination" aria-label=${navigationLabel} aria-busy=${this.loading ? 'true' : 'false'}>
        ${!this.withSummary ? nothing : html`<span part="summary">${this.summaryText()}</span>`}
        <div part="controls">
          ${this.withEdges ? this.renderEdgeButton('first') : nothing}
          ${this.withoutNav ? nothing : this.renderNavButton('previous')}
          ${this.format === 'compact' ? this.renderPageField() : this.renderPageList()}
          ${this.withoutNav ? nothing : this.renderNavButton('next')}
          ${this.withEdges ? this.renderEdgeButton('last') : nothing}
        </div>
        <span part="live-region" class="sr-only" aria-hidden="true">${this.liveText}</span>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-pagination': LyraPagination;
  }
}
