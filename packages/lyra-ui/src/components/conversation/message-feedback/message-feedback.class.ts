import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './message-feedback.styles.js';
import type { LyraToolbarAction } from '../message-actions/toolbar-actions.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_feedbackCommentLabel, LYRA_DEFAULT_feedbackCommentPlaceholder, LYRA_DEFAULT_feedbackNegative, LYRA_DEFAULT_feedbackPositive, LYRA_DEFAULT_feedbackReasonsLabel, LYRA_DEFAULT_feedbackSubmit, LYRA_DEFAULT_feedbackSubmitted } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface MessageFeedbackReason {
  readonly id: string;
  readonly label: string;
}

export type MessageFeedbackRating = 'up' | 'down';
export type MessageFeedbackValue = MessageFeedbackRating | null;

export type MessageFeedbackDetailFor = 'none' | 'up' | 'down' | 'both';

export interface MessageFeedbackDetailConfiguration {
  readonly reasons?: readonly MessageFeedbackReason[];
  readonly commentable?: boolean;
}

export interface MessageFeedbackSubmitDetail {
  rating: MessageFeedbackValue;
  reasonIds: string[];
  comment: string;
}

export interface LyraMessageFeedbackEventMap {
  'lr-feedback-change': CustomEvent<{ rating: MessageFeedbackValue }>;
  'lr-feedback-submit': CustomEvent<LyraEventDetailSnapshot<MessageFeedbackSubmitDetail>>;
  'lr-toolbar-actions-change': Event;
  blur: CustomEvent<null>;
  focus: CustomEvent<null>;
}

// A one-off thumb glyph, sharing internal/icons.ts's 24x24 viewBox / 1em sizing / stroke-width
// conventions so it reads as part of the same visual language as the rest of the library's inline
// icons, without adding a feedback-specific shape to that shared, general-purpose module. Same
// approach several sibling chat components' own local glyphs take for the identical reason.
// `filled` swaps the fill so the pressed state is never conveyed by aria-pressed/color alone.
function thumbIcon(direction: MessageFeedbackRating, filled: boolean): SVGTemplateResult {
  const cuff =
    direction === 'up'
      ? 'M7 11v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z'
      : 'M17 13V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v8h4Z';
  const hand =
    direction === 'up'
      ? 'M7 11l3.5-7A2 2 0 0 1 12 3a1 1 0 0 1 1 1v6h4.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.3 21H9a2 2 0 0 1-2-2v-8Z'
      : 'M17 13l-3.5 7A2 2 0 0 1 12 21a1 1 0 0 1-1-1v-6H6.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 7.7 3H15a2 2 0 0 1 2 2v8Z';
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill=${filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><path d=${cuff}></path><path d=${hand}></path></svg>
  `;
}

/**
 * `<lr-message-feedback>` — thumbs up/down for one assistant message, with an optional inline
 * detail step (categorical reason chips + a free-text comment) that opens as a disclosure directly
 * below the thumbs. `rating` is the current presentation state; every terminal persistence request
 * uses the same cancelable `lr-feedback-submit` transaction.
 *
 * Activating the pressed thumb while its detail panel is open toggles it off to `null` (mirrors
 * `<lr-rating>`'s re-activate-to-clear contract). If that applicable panel was closed without
 * changing the rating (for example with Escape), activating the still-pressed thumb reopens it with
 * the surviving draft. A thumbs-only configuration (no `detail`, e.g.
 * `<lr-message-actions>`'s embedded built-in) never has a panel to reopen, so its thumbs always
 * behave as a plain toggle.
 * The detail record and its reasons are a bounded clone-owned readonly snapshot. Create and
 * reassign a new detail record after changes.
 *
 * @customElement lr-message-feedback
 * @event lr-feedback-change - `detail: { rating }`. Fires whenever thumb interaction changes the
 *   provisional rating, including clearing it to `null`.
 * @event lr-feedback-submit - `detail: { rating, reasonIds, comment }`, fired immediately for a
 *   thumbs-only terminal choice or by the detail panel's submit button.
 *   Cancelable: `preventDefault()` holds the panel in its reflected `pending` state until the host
 *   calls `finalizePendingSubmit()` after persistence succeeds or `revertPendingSubmit()` after it
 *   fails. An uncanceled submit retains the synchronous close/announce/focus behavior.
 * @event blur - Re-dispatched from the comment `<textarea>`'s own native `blur` -- bubbling and
 *   composed (unlike the native event, which is neither), so a listener above the shadow boundary
 *   can observe it. Mirrors `<lr-model-select>`'s identical re-dispatch for its own free-text
 *   `<input>`.
 * @event focus - Re-dispatched from the comment `<textarea>`'s own native `focus`, for the same
 *   reason as `blur`.
 * @event lr-toolbar-actions-change - No-detail coordination event emitted when the logical
 *   toolbar actions exposed by this provider change availability or order.
 * @csspart base - The root.
 * @csspart thumbs - The wrapper around both thumb buttons.
 * @csspart up-button - The thumbs-up toggle button.
 * @csspart down-button - The thumbs-down toggle button.
 * @csspart panel - The inline detail disclosure. Only rendered for a non-empty `detail`.
 * @csspart reasons - The reason-chip group. Only rendered when `detail.reasons` is non-empty.
 * @csspart comment - The comment `<textarea>`. Only rendered when `detail.commentable` is true.
 * @csspart submit-button - The panel's submit button.
 *
 * @cssprop [--lr-message-feedback-up-active-color=var(--lr-color-success)] - Glyph color of the
 *   pressed thumbs-up button. Not declared on `:host`, so it can be set on the element or any
 *   ancestor; scoped to the pressed state, unlike overriding the shared `--lr-color-success`.
 * @cssprop [--lr-message-feedback-up-active-bg=var(--lr-color-success-quiet)] - Background of the
 *   pressed thumbs-up button.
 * @cssprop [--lr-message-feedback-up-active-border=var(--lr-color-success)] - Border color of the
 *   pressed thumbs-up button.
 * @cssprop [--lr-message-feedback-down-active-color=var(--lr-color-danger)] - Glyph color of the
 *   pressed thumbs-down button.
 * @cssprop [--lr-message-feedback-down-active-bg=var(--lr-color-danger-quiet)] - Background of the
 *   pressed thumbs-down button.
 * @cssprop [--lr-message-feedback-down-active-border=var(--lr-color-danger)] - Border color of the
 *   pressed thumbs-down button.
 * @status stable
 * @since 4.0.0
 */
export class LyraMessageFeedback extends LyraElement<LyraMessageFeedbackEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['detail']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    feedbackCommentLabel: LYRA_DEFAULT_feedbackCommentLabel,
    feedbackCommentPlaceholder: LYRA_DEFAULT_feedbackCommentPlaceholder,
    feedbackNegative: LYRA_DEFAULT_feedbackNegative,
    feedbackPositive: LYRA_DEFAULT_feedbackPositive,
    feedbackReasonsLabel: LYRA_DEFAULT_feedbackReasonsLabel,
    feedbackSubmit: LYRA_DEFAULT_feedbackSubmit,
    feedbackSubmitted: LYRA_DEFAULT_feedbackSubmitted,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-feedback-submit',
  ]);

  /** Current provisional or persisted rating. Host-writable for controlled restoration. */
  @property({ reflect: true }) rating: MessageFeedbackValue = null;

  /** One clone-owned explicit detail configuration. Omit it for a thumbs-only control; reassign a
   *  new record after changing its reasons. */
  @property({ attribute: false }) detail?: MessageFeedbackDetailConfiguration;

  /** Which rating opens the configured detail panel. `'none'` explicitly makes even a populated
   *  configuration thumbs-only; `'up'`, `'down'` (default), and `'both'` select ownership. */
  @property({ attribute: 'detail-for' }) detailFor: MessageFeedbackDetailFor = 'down';

  /** Read-only display of a recorded rating -- both thumbs become inert. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** A canceled `lr-feedback-submit` is awaiting host persistence. While true, every feedback control is
   *  disabled and the open panel is busy. Resolve through `finalizePendingSubmit()` or
   *  `revertPendingSubmit()`; the component sets this state automatically. */
  @property({ type: Boolean, reflect: true }) pending = false;

  @state() private panelOpen = false;
  @state() private selectedReasonIds: string[] = [];
  @state() private commentDraft = '';
  private pendingInternalRating: { rating: MessageFeedbackValue } | undefined;
  private submitGeneration = 0;
  private pendingSubmission?: {
    token: number;
    previousRating: MessageFeedbackValue;
    panelWasOpen: boolean;
  };

  @query('[part="up-button"]') private upButtonEl?: HTMLButtonElement;
  @query('[part="down-button"]') private downButtonEl?: HTMLButtonElement;
  @query('[part="submit-button"]') private submitButtonEl?: HTMLButtonElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private readonly panelId = nextId('message-feedback-panel');
  private readonly upToolbarAction = this.createToolbarAction('up');
  private readonly downToolbarAction = this.createToolbarAction('down');

  private createToolbarAction(direction: MessageFeedbackRating): LyraToolbarAction {
    const host = this;
    const button = () => direction === 'up' ? host.upButtonEl : host.downButtonEl;
    return {
      id: direction,
      get disabled() {
        return !button() || button()!.disabled;
      },
      focus(options) {
        button()?.focus(options);
      },
      setTabIndex(tabIndex) {
        const target = button();
        if (target) target.tabIndex = tabIndex;
      },
      matchesEventPath(path) {
        const target = button();
        return target !== undefined && path.includes(target);
      },
    };
  }

  /** Ordered logical actions exposed to an enclosing toolbar without exposing shadow nodes. */
  getToolbarActions(): readonly LyraToolbarAction[] {
    return [this.upToolbarAction, this.downToolbarAction];
  }

  /** Focuses the thumb matching the current `rating` (the up thumb when `rating` is `null`) --
   *  lets a toolbar embedding this component (e.g. `<lr-message-actions>`) treat it as one
   *  arrow-key stop. */
  override focus(options?: FocusOptions): void {
    (this.rating === 'down' ? this.downButtonEl : this.upButtonEl)?.focus(options);
  }

  override blur(): void {
    this.upButtonEl?.blur();
    this.downButtonEl?.blur();
  }

  /** Activates the thumb matching the current rating (the up thumb when unset). */
  override click(): void {
    if (this.disabled || this.pending) return;
    (this.rating === 'down' ? this.downButtonEl : this.upButtonEl)?.click();
  }

  private get detailReasons(): readonly MessageFeedbackReason[] {
    const seen = new Set<string>();
    return (this.detail?.reasons ?? []).filter((reason) => {
      if (!reason.id || seen.has(reason.id)) return false;
      seen.add(reason.id);
      return true;
    });
  }

  private get detailCommentable(): boolean {
    return this.detail?.commentable === true;
  }

  private get hasDetailContent(): boolean {
    return this.detailReasons.length > 0 || this.detailCommentable;
  }

  private detailApplies(direction: MessageFeedbackRating): boolean {
    return this.detailFor === 'both' || this.detailFor === direction;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('rating')) {
      const internal = this.pendingInternalRating?.rating === this.rating;
      this.pendingInternalRating = undefined;
      if (!internal) {
        this.pendingSubmission = undefined;
        this.pending = false;
        this.panelOpen = false;
        this.selectedReasonIds = [];
        this.commentDraft = '';
      }
    }
    if (changed.has('detail')) {
      const validIds = new Set(this.detailReasons.map((reason) => reason.id));
      this.selectedReasonIds = this.selectedReasonIds.filter((id) => validIds.has(id));
      if (!this.detailCommentable) this.commentDraft = '';
    }
    if (this.panelOpen && (!this.rating || !this.detailApplies(this.rating) || !this.hasDetailContent)) {
      this.pending = false;
      this.panelOpen = false;
      if (changed.has('detailFor')) {
        this.selectedReasonIds = [];
        this.commentDraft = '';
      }
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('disabled') || changed.has('pending')) {
      this.emit('lr-toolbar-actions-change');
    }
  }

  private setRatingFromInteraction(rating: MessageFeedbackValue): void {
    this.pendingInternalRating = { rating };
    this.rating = rating;
  }

  private activateThumb(next: MessageFeedbackRating): void {
    if (this.disabled || this.pending) return;
    const previousRating = this.rating;
    if (this.rating === next) {
      if (this.panelOpen) {
        this.setRatingFromInteraction(null);
        this.panelOpen = false;
        this.selectedReasonIds = [];
        this.commentDraft = '';
        this.emit('lr-feedback-change', { rating: null });
        this.requestSubmission({ rating: null, reasonIds: [], comment: '' }, previousRating, true);
        return;
      }
      if (this.detailApplies(next) && this.hasDetailContent) {
        // Panel was closed (Escape, or a prior submit) without clearing `rating` -- re-open it
        // showing whatever draft survived. Nothing about `rating` changed, so no change event.
        this.panelOpen = true;
        return;
      }
      this.setRatingFromInteraction(null);
      this.emit('lr-feedback-change', { rating: null });
      this.requestSubmission({ rating: null, reasonIds: [], comment: '' }, previousRating, false);
      return;
    }
    this.selectedReasonIds = [];
    this.commentDraft = '';
    this.setRatingFromInteraction(next);
    this.panelOpen = this.detailApplies(next) && this.hasDetailContent;
    this.emit('lr-feedback-change', { rating: next });
    if (!this.panelOpen) {
      this.requestSubmission({ rating: next, reasonIds: [], comment: '' }, previousRating, false);
    }
  }

  private focusActiveThumb(): void {
    (this.rating === 'down' ? this.downButtonEl : this.upButtonEl)?.focus();
  }

  private closePanel(): void {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    this.focusActiveThumb();
  }

  private onPanelKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    this.closePanel();
  };

  private toggleReason(id: string): void {
    if (this.disabled || this.pending) return;
    this.selectedReasonIds = this.selectedReasonIds.includes(id)
      ? this.selectedReasonIds.filter((r) => r !== id)
      : [...this.selectedReasonIds, id];
  }

  private onCommentInput = (e: Event): void => {
    this.commentDraft = (e.target as HTMLTextAreaElement).value;
  };

  // Native `focus`/`blur` on the comment textarea neither bubble nor cross the shadow boundary --
  // re-dispatched (bubbling + composed, via this.emit()) so a host-level listener on
  // <lr-message-feedback> can observe them, mirroring <lr-model-select>'s identical bridge for
  // its own free-text <input>.
  private onCommentFocus = (): void => {
    this.emit('focus', null);
  };

  private onCommentBlur = (): void => {
    this.emit('blur', null);
  };

  private completeSubmission(): void {
    this.pending = false;
    this.panelOpen = false;
    this.liveRegion?.announce(this.localize('feedbackSubmitted'), { force: true });
    void this.updateComplete.then(() => {
      if (this.isConnected && !this.pending) this.focusActiveThumb();
    });
  }

  /** Completes a submit held by `preventDefault()`, closing and announcing success. */
  finalizePendingSubmit(): void {
    if (!this.pendingSubmission) return;
    this.pendingSubmission = undefined;
    this.completeSubmission();
  }

  /** Releases a submit held by `preventDefault()`, restoring the rating that preceded the request
   *  without announcing success or clearing a detailed draft. */
  revertPendingSubmit(): void {
    const transaction = this.pendingSubmission;
    if (!transaction) return;
    this.pendingSubmission = undefined;
    this.pending = false;
    this.setRatingFromInteraction(transaction.previousRating);
    this.panelOpen = transaction.panelWasOpen;
    void this.updateComplete.then(() => {
      if (!this.isConnected || this.pending) return;
      if (this.panelOpen) this.submitButtonEl?.focus();
      else this.focusActiveThumb();
    });
  }

  private requestSubmission(
    detail: MessageFeedbackSubmitDetail,
    previousRating: MessageFeedbackValue,
    panelWasOpen: boolean,
  ): void {
    const token = ++this.submitGeneration;
    // Install the transaction before dispatch: a synchronous listener may finalize or revert it.
    this.pendingSubmission = { token, previousRating, panelWasOpen };
    this.pending = true;
    const event = this.emit('lr-feedback-submit', detail, { cancelable: true });
    if (this.pendingSubmission?.token !== token) return;
    if (event.defaultPrevented) return;
    this.finalizePendingSubmit();
  }

  private onSubmit = (): void => {
    if (this.disabled || this.pending || !this.rating || !this.panelOpen) return;
    const validReasonIds = new Set(this.detailReasons.map((reason) => reason.id));
    this.requestSubmission(
      {
        rating: this.rating,
        reasonIds: this.selectedReasonIds.filter((id) => validReasonIds.has(id)),
        comment: this.detailCommentable ? this.commentDraft.trim() : '',
      },
      this.rating,
      true,
    );
  };

  private renderThumb(direction: MessageFeedbackRating): TemplateResult {
    const pressed = this.rating === direction;
    const canExpand = this.detailApplies(direction) && this.hasDetailContent;
    return html`
      <button
        part=${direction === 'up' ? 'up-button' : 'down-button'}
        type="button"
        aria-pressed=${pressed ? 'true' : 'false'}
        aria-label=${this.localize(direction === 'up' ? 'feedbackPositive' : 'feedbackNegative')}
        aria-expanded=${canExpand ? (pressed && this.panelOpen ? 'true' : 'false') : nothing}
        aria-controls=${canExpand ? this.panelId : nothing}
        ?disabled=${this.disabled || this.pending}
        @click=${() => this.activateThumb(direction)}
      >
        ${thumbIcon(direction, pressed)}
      </button>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        <div part="thumbs">${this.renderThumb('up')}${this.renderThumb('down')}</div>
        ${this.hasDetailContent
          ? html`
              <div
                part="panel"
                id=${this.panelId}
                ?data-open=${this.panelOpen}
                ?inert=${!this.panelOpen}
                aria-hidden=${this.panelOpen ? 'false' : 'true'}
                aria-busy=${this.pending ? 'true' : 'false'}
                @keydown=${this.onPanelKeyDown}
              >
                <div class="panel-inner">
                  ${this.detailReasons.length > 0
                    ? html`
                        <div part="reasons" role="group" aria-label=${this.localize('feedbackReasonsLabel')}>
                          ${this.detailReasons.map(
                            (reason) => html`
                              <lr-chip
                                toggleable
                                ?selected=${this.selectedReasonIds.includes(reason.id)}
                                .disabled=${this.disabled || this.pending}
                                @lr-chip-select=${(event: Event) => {
                                  event.stopPropagation();
                                  this.toggleReason(reason.id);
                                }}
                                >${reason.label}</lr-chip
                              >
                            `
                          )}
                        </div>
                      `
                    : nothing}
                  ${this.detailCommentable
                    ? html`
                        <textarea
                          part="comment"
                          aria-label=${this.localize('feedbackCommentLabel')}
                          placeholder=${this.localize('feedbackCommentPlaceholder')}
                          .value=${this.commentDraft}
                          ?disabled=${this.disabled || this.pending}
                          @input=${this.onCommentInput}
                          @focus=${this.onCommentFocus}
                          @blur=${this.onCommentBlur}
                        ></textarea>
                      `
                    : nothing}
                  <button
                    part="submit-button"
                    type="button"
                    ?disabled=${this.disabled || this.pending}
                    @click=${this.onSubmit}
                  >
                    ${this.localize('feedbackSubmit')}
                  </button>
                </div>
              </div>
            `
          : nothing}
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-feedback': LyraMessageFeedback;
  }
}
