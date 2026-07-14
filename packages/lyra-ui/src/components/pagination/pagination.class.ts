import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { chevronIcon } from '../../internal/icons.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './pagination.styles.js';

export type LyraPaginationSize = 'xs' | 's' | 'm' | 'l' | 'xl';

export interface LyraPaginationEventMap {
  'lyra-page-change': CustomEvent<{ page: number }>;
}

/**
 * `<lyra-pagination>` — controlled, server-friendly page navigation with an
 * editable page jump and optional item-range summary.
 *
 * The component never mutates `page`. Activating a control emits
 * `lyra-page-change`; the consumer applies the requested page after its own
 * routing or data-fetch decision. Once the `page` property changes, a polite
 * live region announces the applied page.
 *
 * @customElement lyra-pagination
 * @event lyra-page-change - Fired when a user requests a valid page. `detail: { page }`.
 * @csspart base - The navigation wrapper.
 * @csspart summary - The item-range summary.
 * @csspart controls - The previous/page/next control group.
 * @csspart previous-button - The previous-page button.
 * @csspart previous-icon - The previous-page directional icon.
 * @csspart page-field - The current-page input and page-count wrapper.
 * @csspart page-input - The validated numeric page-jump input.
 * @csspart page-count - The total page count shown after the input.
 * @csspart next-button - The next-page button.
 * @csspart next-icon - The next-page directional icon.
 * @csspart live-region - The visually hidden applied-page announcement.
 * @cssprop --lyra-pagination-control-size - Control inline/block size; defaults from the `size` variant.
 * @cssprop --lyra-pagination-font-size - Control font size; defaults from the `size` variant.
 */
export class LyraPagination extends LyraElement<LyraPaginationEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The currently applied page. Controlled; this component never mutates it. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Number of items represented by one page. Non-positive values produce no pages. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = 20;
  /** Total number of items across every page. Non-positive values render the empty state. */
  @property({ type: Number, attribute: 'total-items' }) totalItems = 0;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Disables navigation and exposes `aria-busy="true"` while a page is loading. */
  @property({ type: Boolean, reflect: true }) loading = false;
  @property({ type: Boolean, attribute: 'hide-summary', reflect: true }) hideSummary = false;
  @property({ reflect: true }) size: LyraPaginationSize = 'm';

  /** Optional item noun used in the summary. Empty uses the localized `item`/`items` keys. */
  @property({ attribute: 'item-label' }) itemLabel = '';
  /** Accessible name forwarded from the host to the internal navigation landmark. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() label = 'Pagination';
  @property({ attribute: 'page-label' }) pageLabel = 'Page';
  @property({ attribute: 'previous-label' }) previousLabel = 'Previous';
  @property({ attribute: 'next-label' }) nextLabel = 'Next';

  @state() private draftPage = '';
  @state() private invalidDraft = false;
  @state() private liveText = '';
  private initialized = false;

  private get normalizedTotalItems(): number {
    if (!Number.isFinite(this.totalItems)) return 0;
    return Math.max(0, Math.trunc(this.totalItems));
  }

  private get normalizedPageSize(): number {
    if (!Number.isFinite(this.pageSize)) return 0;
    return Math.max(0, Math.trunc(this.pageSize));
  }

  /** Total page count derived from `totalItems` and `pageSize`. */
  get pageCount(): number {
    if (this.normalizedTotalItems === 0 || this.normalizedPageSize === 0) return 0;
    return Math.ceil(this.normalizedTotalItems / this.normalizedPageSize);
  }

  private get currentPage(): number {
    if (this.pageCount === 0) return 0;
    const page = Number.isFinite(this.page) ? Math.trunc(this.page) : 1;
    return Math.min(this.pageCount, Math.max(1, page));
  }

  private get controlsDisabled(): boolean {
    return this.disabled || this.loading || this.pageCount === 0;
  }

  private localizedProperty(key: string, defaultValue: string, value: string): string {
    return this.localize(key, value === defaultValue ? undefined : value);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat(this.effectiveLocale).format(value);
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

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('page') || changed.has('pageSize') || changed.has('totalItems')) {
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
    this.emit('lyra-page-change', { page });
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

  render(): TemplateResult {
    const previousLabel = this.localizedProperty('previous', 'Previous', this.previousLabel);
    const nextLabel = this.localizedProperty('next', 'Next', this.nextLabel);
    const pageLabel = this.localizedProperty('paginationPage', 'Page', this.pageLabel);
    const navigationLabel =
      this.accessibleLabel || this.localizedProperty('paginationLabel', 'Pagination', this.label);
    const current = this.currentPage;

    return html`
      <nav
        part="base"
        aria-label=${navigationLabel}
        aria-busy=${this.loading ? 'true' : 'false'}
      >
        ${this.hideSummary
          ? nothing
          : html`<span part="summary">${this.summaryText()}</span>`}
        <div part="controls">
          <button
            part="previous-button"
            type="button"
            aria-label=${previousLabel}
            ?disabled=${this.controlsDisabled || current <= 1}
            @click=${() => this.requestPage(current - 1)}
          >
            <span part="previous-icon">${chevronIcon()}</span>
          </button>
          <span part="page-field">
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
            />
            <span part="page-count" aria-hidden="true"> / ${this.formatNumber(this.pageCount)}</span>
          </span>
          <button
            part="next-button"
            type="button"
            aria-label=${nextLabel}
            ?disabled=${this.controlsDisabled || current >= this.pageCount}
            @click=${() => this.requestPage(current + 1)}
          >
            <span part="next-icon">${chevronIcon()}</span>
          </button>
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
    'lyra-pagination': LyraPagination;
  }
}
