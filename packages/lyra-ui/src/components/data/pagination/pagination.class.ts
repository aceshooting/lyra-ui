import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { styles } from './pagination.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { safeLinkHref } from '../../../internal/safe-url.js';

export type LyraPaginationSize = 'xs' | 's' | 'm' | 'l' | 'xl';
/** `standard` renders the numbered page list; `compact` collapses it to the page-jump field. */
export type LyraPaginationFormat = 'standard' | 'compact';
export type LyraPaginationAppearance =
  | 'accent'
  | 'filled'
  | 'outlined'
  | 'filled-outlined'
  | 'plain';

export interface LyraPaginationEventMap {
  'lr-page-change': CustomEvent<{ page: number }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}

/** One rendered slot in the page list: a real page, or a run of pages that was skipped. */
type PaginationItem = { readonly type: 'page'; readonly page: number } | { readonly type: 'gap' };

/** Upper bound on rendered page slots. `pageCount` is derived from consumer-supplied item counts
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
  pageCount: number,
  siblingCount: number,
  boundaryCount: number,
): PaginationItem[] {
  if (pageCount <= 0) return [];
  const asPage = (page: number): PaginationItem => ({ type: 'page', page });
  // Both boundaries, both sibling runs, the current page, and one slot per potential gap.
  const budget = Math.min(boundaryCount * 2 + siblingCount * 2 + 3, MAX_PAGE_SLOTS);
  if (pageCount <= budget) return pageSequence(1, pageCount).map(asPage);

  const windowFloor = boundaryCount + 1; // first page after the leading boundary
  const windowCeiling = pageCount - boundaryCount; // last page before the trailing boundary
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
    ...(from > windowFloor ? [{ type: 'gap' } as const] : []),
    ...pageSequence(from, to).map(asPage),
    ...(to < windowCeiling ? [{ type: 'gap' } as const] : []),
    ...pageSequence(pageCount - boundaryCount + 1, pageCount).map(asPage),
  ];
}

/**
 * `<lr-pagination>` — controlled, server-friendly page navigation: a numbered
 * page list with elided gaps, optional first/last controls, an optional
 * item-range summary, and a compact layout that swaps the list for an
 * editable page jump.
 *
 * The component never mutates `page`. Activating a control emits
 * `lr-page-change`; the consumer applies the requested page after its own
 * routing or data-fetch decision. Once the `page` property changes, a polite
 * live region announces the applied page.
 *
 * @customElement lr-pagination
 * @event lr-page-change - Fired when a user requests a valid page. `detail: { page }`.
 * @event blur - Re-dispatched from an internal pagination control as a bubbling, composed event.
 * @event focus - Re-dispatched from an internal pagination control as a bubbling, composed event.
 * @csspart base - The navigation wrapper.
 * @csspart summary - The item-range summary.
 * @csspart controls - The previous/pages/next control group.
 * @csspart pages - The `role="list"` wrapper around the numbered page items.
 * @csspart page - One numbered page control; a `<button>`, or an `<a>` when `href-template` is set.
 * @csspart page-current - Also carried by the page control for the applied page, alongside `page`.
 * @csspart ellipsis - A non-interactive marker standing in for a skipped run of pages.
 * @csspart first-button - The first-page button, rendered with `with-edges`.
 * @csspart first-icon - The first-page directional icon.
 * @csspart previous-button - The previous-page button.
 * @csspart previous-icon - The previous-page directional icon.
 * @csspart page-field - The current-page input and page-count wrapper (`format="compact"`).
 * @csspart page-input - The validated numeric page-jump input (`format="compact"`).
 * @csspart page-count - The total page count shown after the input (`format="compact"`).
 * @csspart next-button - The next-page button.
 * @csspart next-icon - The next-page directional icon.
 * @csspart last-button - The last-page button, rendered with `with-edges`.
 * @csspart last-icon - The last-page directional icon.
 * @csspart live-region - The visually hidden applied-page announcement.
 * @cssprop --lr-pagination-control-size - Control inline/block size; defaults from the `size` variant.
 * @cssprop --lr-pagination-font-size - Control font size; defaults from the `size` variant.
 * @cssprop --lr-pagination-control-bg - Resting background of every control; defaults from the
 *   `appearance` variant.
 * @cssprop --lr-pagination-control-border-color - Resting border color of every control; defaults
 *   from the `appearance` variant.
 * @cssprop [--lr-pagination-control-radius=var(--lr-radius)] - Border radius of navigation
 * buttons and the page input.
 * @cssprop [--lr-pagination-control-padding=var(--lr-space-xs)] - Inner padding of the nav buttons
 * and the page input. Uniform across every `size` (the control footprint is fixed by
 * `--lr-pagination-control-size`, so this only adjusts the icon/digit inset).
 * @cssprop [--lr-pagination-invalid-border=var(--lr-color-danger)] - Border color of
 *   `[part="page-input"]` while the typed page is out of range (`aria-invalid="true"`).
 */
export class LyraPagination extends LyraElement<LyraPaginationEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The currently applied page. Controlled; this component never mutates it. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Number of items represented by one page. Non-positive values produce no pages. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = 20;
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
  @property({ type: Boolean, attribute: 'with-summary', reflect: true }) withSummary = false;
  @property({ reflect: true }) size: LyraPaginationSize = 'm';
  /** `standard` renders the numbered page list; `compact` swaps it for the editable page jump,
   *  which fits a toolbar or a card footer where a full list would not. */
  @property({ reflect: true }) format: LyraPaginationFormat = 'standard';
  /** Pages shown either side of the current page in the numbered list. */
  @property({ type: Number, attribute: 'sibling-count' }) siblingCount = 2;
  /** Pages always pinned at the start and at the end of the numbered list. */
  @property({ type: Number, attribute: 'boundary-count' }) boundaryCount = 1;
  /** Renders buttons that jump straight to the first and last page. */
  @property({ type: Boolean, attribute: 'with-edges', reflect: true }) withEdges = false;
  /** Renders each page as a link instead of a button, for SSR, crawlers, and no-JS navigation.
   *  A string uses `{page}` as the placeholder (`/products?page={page}`); a function receives the
   *  page number and returns the URL. A page whose resolved URL is not a safe navigation target
   *  falls back to a button. */
  @property({ attribute: 'href-template' }) hrefTemplate: string | ((page: number) => string) = '';
  /** Resting look of every control. The applied page stays a solid brand chip in all of them, so
   *  it is never the appearance that decides whether the current page is identifiable. */
  @property({ reflect: true }) appearance: LyraPaginationAppearance = 'outlined';

  /** Optional item noun used in the summary. Empty uses the localized `item`/`items` keys. */
  @property({ attribute: 'item-label' }) itemLabel = '';
  /** Accessible name forwarded from the host to the internal navigation landmark. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() label = 'Pagination';
  @property({ attribute: 'page-label' }) pageLabel = 'Page';
  @property({ attribute: 'previous-label' }) previousLabel = 'Previous';
  @property({ attribute: 'next-label' }) nextLabel = 'Next';
  @property({ attribute: 'first-label' }) firstLabel = 'First page';
  @property({ attribute: 'last-label' }) lastLabel = 'Last page';

  @state() private draftPage = '';
  @state() private invalidDraft = false;
  @state() private liveText = '';
  @query('[part="page-input"]') private pageInput?: HTMLInputElement;
  private initialized = false;

  /** Focus the editable page-jump input. */
  override focus(options?: FocusOptions): void {
    this.pageInput?.focus(options);
  }

  /** Blur the editable page-jump input. */
  override blur(): void {
    this.pageInput?.blur();
  }

  /** Forward host activation to the primary editable page control. */
  override click(): void {
    if (!this.controlsDisabled) this.pageInput?.click();
  }

  /** Read-time-safe view of `total` -- non-negative, finite, truncated to a whole item count. */
  private get normalizedTotalItems(): number {
    return finiteCount(this.total);
  }

  /** Read-time-safe view of `pageSize` -- non-negative, finite, truncated to a whole item count. */
  private get normalizedPageSize(): number {
    return finiteCount(this.pageSize);
  }

  /** Total page count derived from `total` and `pageSize`. */
  get pageCount(): number {
    if (this.normalizedTotalItems === 0 || this.normalizedPageSize === 0) return 0;
    return Math.ceil(this.normalizedTotalItems / this.normalizedPageSize);
  }

  /** Read-time-safe view of the controlled `page` property, clamped to `[1, pageCount]` (the
   *  page count itself depending on the now-safe `total`/`pageSize` above) -- never mutates
   *  `page` itself, matching this component's fully controlled contract. */
  private get currentPage(): number {
    if (this.pageCount === 0) return 0;
    return finiteInteger(this.page, 1, 1, this.pageCount);
  }

  private get controlsDisabled(): boolean {
    return this.disabled || this.loading || this.pageCount === 0;
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

  private localizedProperty(key: string, defaultValue: string, value: string): string {
    return this.localize(key, value === defaultValue ? undefined : value);
  }

  private formatNumber(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private summaryText(): string {
    const total = this.normalizedTotalItems;
    const itemLabel =
      this.itemLabel || this.localize(total === 1 ? 'item' : 'items');
    if (this.pageCount === 0) {
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
    if (changed.has('page') || changed.has('pageSize') || changed.has('total')) {
      this.draftPage = this.pageCount === 0 ? '' : String(this.currentPage);
      this.invalidDraft = false;
    }
    if (this.initialized && changed.has('page') && this.pageCount > 0) {
      this.liveText = this.localize('paginationApplied', undefined, {
        page: this.formatNumber(this.currentPage),
        totalPages: this.formatNumber(this.pageCount),
      });
    }
    this.initialized = true;
  }

  private validRequestedPage(value: string): number | null {
    if (value.trim() === '') return null;
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1 || page > this.pageCount) return null;
    return page;
  }

  private requestPage(page: number): void {
    if (this.controlsDisabled || page === this.currentPage || page < 1 || page > this.pageCount) {
      return;
    }
    this.emit('lr-page-change', { page });
    // A controlled input reflects the applied property again after a request.
    this.draftPage = this.pageCount === 0 ? '' : String(this.currentPage);
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
    event.stopPropagation();
    this.emit('focus');
  };

  private onControlBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('blur');
  };

  /** Previous/next. Both directions share one shape so the two never drift apart. */
  private renderNavButton(direction: 'previous' | 'next'): TemplateResult {
    const isPrevious = direction === 'previous';
    const current = this.currentPage;
    const label = isPrevious
      ? this.localizedProperty('previous', 'Previous', this.previousLabel)
      : this.localizedProperty('next', 'Next', this.nextLabel);
    const spent = isPrevious ? current <= 1 : current >= this.pageCount;

    return html`<button
      part=${isPrevious ? 'previous-button' : 'next-button'}
      type="button"
      aria-label=${label}
      ?disabled=${this.controlsDisabled || spent}
      @click=${() => this.requestPage(isPrevious ? current - 1 : current + 1)}
      @focus=${this.onControlFocus}
      @blur=${this.onControlBlur}
    >
      <span part=${isPrevious ? 'previous-icon' : 'next-icon'} aria-hidden="true"
        >${chevronIcon()}</span
      >
    </button>`;
  }

  /** First/last. The doubled chevron is the conventional "all the way to the end" glyph, and it
   *  mirrors under RTL through the wrapping part rather than the icon itself. */
  private renderEdgeButton(edge: 'first' | 'last'): TemplateResult {
    const isFirst = edge === 'first';
    const current = this.currentPage;
    const label = isFirst
      ? this.localizedProperty('paginationFirstPage', 'First page', this.firstLabel)
      : this.localizedProperty('paginationLastPage', 'Last page', this.lastLabel);
    const spent = isFirst ? current <= 1 : current >= this.pageCount;

    return html`<button
      part=${isFirst ? 'first-button' : 'last-button'}
      type="button"
      aria-label=${label}
      ?disabled=${this.controlsDisabled || spent}
      @click=${() => this.requestPage(isFirst ? 1 : this.pageCount)}
      @focus=${this.onControlFocus}
      @blur=${this.onControlBlur}
    >
      <span part=${isFirst ? 'first-icon' : 'last-icon'} aria-hidden="true"
        >${chevronIcon()}${chevronIcon()}</span
      >
    </button>`;
  }

  /** One numbered page. The visible number is its accessible name -- an extra `aria-label` would
   *  only make a screen reader announce the same digit twice. */
  private renderPage(page: number): TemplateResult {
    const isCurrent = page === this.currentPage;
    // Both branches render the same part names, so the state lives in the part token rather than
    // in an attribute: `::part(page)[aria-current]` is invalid CSS and would silently never match.
    const part = isCurrent ? 'page page-current' : 'page';
    const label = this.formatNumber(page);
    const href = this.pageHref(page);

    if (href !== null) {
      return html`<a
        part=${part}
        href=${isCurrent || this.controlsDisabled ? nothing : href}
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

  private renderPageList(): TemplateResult {
    const items = paginationItems(
      this.currentPage,
      this.pageCount,
      this.normalizedSiblingCount,
      this.normalizedBoundaryCount,
    );

    return html`<ul part="pages" role="list">
      ${items.map((item) =>
        item.type === 'gap'
          ? // Decorative on purpose: a skipped run is not a place the reader can go, so announcing
            // it as one more control would put a page button in the screen reader's element list
            // that leads nowhere. Sighted readers still get the gap.
            html`<li part="ellipsis" aria-hidden="true">…</li>`
          : html`<li role="listitem">${this.renderPage(item.page)}</li>`,
      )}
    </ul>`;
  }

  private renderPageField(): TemplateResult {
    const pageLabel = this.localizedProperty('paginationPage', 'Page', this.pageLabel);

    return html`<span part="page-field">
      <input
        part="page-input"
        type="number"
        inputmode="numeric"
        min="1"
        max=${Math.max(1, this.pageCount)}
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
      <span part="page-count" aria-hidden="true"> / ${this.formatNumber(this.pageCount)}</span>
    </span>`;
  }

  override render(): TemplateResult {
    const navigationLabel =
      this.accessibleLabel || this.localizedProperty('paginationLabel', 'Pagination', this.label);

    return html`
      <nav
        part="base"
        aria-label=${navigationLabel}
        aria-busy=${this.loading ? 'true' : 'false'}
      >
        ${!this.withSummary
          ? nothing
          : html`<span part="summary">${this.summaryText()}</span>`}
        <div part="controls">
          ${this.withEdges ? this.renderEdgeButton('first') : nothing}
          ${this.renderNavButton('previous')}
          ${this.format === 'compact' ? this.renderPageField() : this.renderPageList()}
          ${this.renderNavButton('next')}
          ${this.withEdges ? this.renderEdgeButton('last') : nothing}
        </div>
        <span
          part="live-region"
          class="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >${this.liveText}</span>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-pagination': LyraPagination;
  }
}
