import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './message-feedback.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_feedbackCommentLabel, LYRA_DEFAULT_feedbackCommentPlaceholder, LYRA_DEFAULT_feedbackNegative, LYRA_DEFAULT_feedbackPositive, LYRA_DEFAULT_feedbackReasonsLabel, LYRA_DEFAULT_feedbackSubmit, LYRA_DEFAULT_feedbackSubmitted } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface MessageFeedbackReason {
  id: string;
  label: string;
}

export type MessageFeedbackRating = 'up' | 'down';
export type MessageFeedbackValue = MessageFeedbackRating | null;

export interface LyraMessageFeedbackEventMap {
  'lr-change': CustomEvent<{ value: MessageFeedbackValue }>;
  'lr-submit': CustomEvent<{ value: MessageFeedbackRating; reasonIds: string[]; comment: string }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
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
 * below the thumbs. Emits; never persists — a host reflects a previously-recorded rating back via
 * `value` (+ `disabled` for a read-only display).
 *
 * Activating the pressed thumb again toggles it off to `null` (mirrors `<lr-rating>`'s
 * re-activate-to-clear contract) *unless* its own detail panel is currently open, in which case that
 * click re-opens the panel instead (showing whatever reason/comment draft survived a prior Escape or
 * submit). A thumbs-only configuration (`reasons` empty and `commentable` false, e.g.
 * `<lr-message-actions>`'s embedded built-in) never has a panel to reopen, so its thumbs always
 * behave as a plain toggle.
 *
 * @customElement lr-message-feedback
 * @event lr-change - `detail: { value }`. Activating a thumb sets it; re-activating the pressed
 *   thumb (with no panel open) clears it to `null`. The terminal signal when no detail panel is
 *   configured for that thumb.
 * @event lr-submit - `detail: { value, reasonIds, comment }`, fired by the panel's submit button.
 *   Cancelable: `preventDefault()` holds the panel in its reflected `pending` state until the host
 *   calls `finalizePendingSubmit()` after persistence succeeds or `revertPendingSubmit()` after it
 *   fails. An uncanceled submit retains the synchronous close/announce/focus behavior.
 * @event blur - Re-dispatched from the comment `<textarea>`'s own native `blur` -- bubbling and
 *   composed (unlike the native event, which is neither), so a listener above the shadow boundary
 *   can observe it. Mirrors `<lr-model-select>`'s identical re-dispatch for its own free-text
 *   `<input>`.
 * @event focus - Re-dispatched from the comment `<textarea>`'s own native `focus`, for the same
 *   reason as `blur`.
 * @csspart base - The root.
 * @csspart thumbs - The wrapper around both thumb buttons.
 * @csspart up-button - The thumbs-up toggle button.
 * @csspart down-button - The thumbs-down toggle button.
 * @csspart panel - The inline detail disclosure. Only rendered when `reasons` is non-empty or
 *   `commentable` is set.
 * @csspart reasons - The reason-chip group. Only rendered when `reasons` is non-empty.
 * @csspart comment - The comment `<textarea>`. Only rendered when `commentable`.
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

  /** Current rating. Host-writable (e.g. to reflect a previously-recorded rating back). */
  @property({ reflect: true }) value: MessageFeedbackValue = null;

  /** Categorical reasons offered as multi-select chips inside the detail panel. Empty renders no
   *  reason-chip group at all. */
  @property({ attribute: false }) reasons: MessageFeedbackReason[] = [];

  /** Adds a free-text comment field to the detail panel. */
  @property({ type: Boolean, reflect: true }) commentable = false;

  /** Which rating opens the detail panel (only when it would have content -- `reasons` non-empty or
   *  `commentable`). `'down'` (the default) matches the dominant product pattern of elaborating only
   *  on negative feedback; `'both'` opens it for either thumb. */
  @property({ attribute: 'detail-for' }) detailFor: 'down' | 'both' = 'down';

  /** Read-only display of a recorded rating -- both thumbs become inert. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** A canceled `lr-submit` is awaiting host persistence. While true, every feedback control is
   *  disabled and the open panel is busy. Resolve through `finalizePendingSubmit()` or
   *  `revertPendingSubmit()`; the component sets this state automatically. */
  @property({ type: Boolean, reflect: true }) pending = false;

  @state() private panelOpen = false;
  @state() private selectedReasonIds: string[] = [];
  @state() private commentDraft = '';
  private pendingInternalValue: { value: MessageFeedbackValue } | undefined;

  @query('[part="up-button"]') private upButtonEl?: HTMLButtonElement;
  @query('[part="down-button"]') private downButtonEl?: HTMLButtonElement;
  @query('[part="submit-button"]') private submitButtonEl?: HTMLButtonElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private readonly panelId = nextId('message-feedback-panel');

  /** Focuses the thumb matching the current `value` (the up thumb when `value` is `null`) --
   *  lets a toolbar embedding this component (e.g. `<lr-message-actions>`) treat it as one
   *  arrow-key stop. */
  override focus(options?: FocusOptions): void {
    (this.value === 'down' ? this.downButtonEl : this.upButtonEl)?.focus(options);
  }

  override blur(): void {
    this.upButtonEl?.blur();
    this.downButtonEl?.blur();
  }

  /** Activates the thumb matching the current value (the up thumb when unset). */
  override click(): void {
    if (this.disabled || this.pending) return;
    (this.value === 'down' ? this.downButtonEl : this.upButtonEl)?.click();
  }

  private get hasDetailContent(): boolean {
    return this.reasons.length > 0 || this.commentable;
  }

  private detailApplies(direction: MessageFeedbackRating): boolean {
    return this.detailFor === 'both' || direction === 'down';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('value')) {
      const internal = this.pendingInternalValue?.value === this.value;
      this.pendingInternalValue = undefined;
      if (!internal) {
        this.pending = false;
        this.panelOpen = false;
        this.selectedReasonIds = [];
        this.commentDraft = '';
      }
    }
    if (changed.has('reasons')) {
      const validIds = new Set(this.reasons.map((reason) => reason.id));
      this.selectedReasonIds = this.selectedReasonIds.filter((id) => validIds.has(id));
    }
    if (changed.has('commentable') && !this.commentable) this.commentDraft = '';
    if (this.panelOpen && (!this.value || !this.detailApplies(this.value) || !this.hasDetailContent)) {
      this.pending = false;
      this.panelOpen = false;
      if (changed.has('detailFor')) {
        this.selectedReasonIds = [];
        this.commentDraft = '';
      }
    }
  }

  private setValueFromActivation(value: MessageFeedbackValue): void {
    this.pendingInternalValue = { value };
    this.value = value;
  }

  private activateThumb(next: MessageFeedbackRating): void {
    if (this.disabled || this.pending) return;
    if (this.value === next) {
      if (this.panelOpen) {
        this.setValueFromActivation(null);
        this.panelOpen = false;
        this.selectedReasonIds = [];
        this.commentDraft = '';
        this.emit('lr-change', { value: null });
        return;
      }
      if (this.detailApplies(next) && this.hasDetailContent) {
        // Panel was closed (Escape, or a prior submit) without clearing `value` -- re-open it
        // showing whatever draft survived. Nothing about `value` changed, so no lr-change.
        this.panelOpen = true;
        return;
      }
      this.setValueFromActivation(null);
      this.emit('lr-change', { value: null });
      return;
    }
    this.selectedReasonIds = [];
    this.commentDraft = '';
    this.setValueFromActivation(next);
    this.panelOpen = this.detailApplies(next) && this.hasDetailContent;
    this.emit('lr-change', { value: next });
  }

  private focusActiveThumb(): void {
    (this.value === 'down' ? this.downButtonEl : this.upButtonEl)?.focus();
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
    this.emit('focus');
  };

  private onCommentBlur = (): void => {
    this.emit('blur');
  };

  private completeSubmission(): void {
    this.panelOpen = false;
    this.liveRegion?.announce(this.localize('feedbackSubmitted'), { force: true });
    this.focusActiveThumb();
  }

  /** Completes a submit held by `preventDefault()`, closing and announcing success. */
  finalizePendingSubmit(): void {
    if (!this.pending) return;
    this.pending = false;
    this.panelOpen = false;
    this.liveRegion?.announce(this.localize('feedbackSubmitted'), { force: true });
    void this.updateComplete.then(() => {
      if (this.isConnected && !this.pending) this.focusActiveThumb();
    });
  }

  /** Releases a submit held by `preventDefault()` without announcing success or clearing its draft. */
  revertPendingSubmit(): void {
    if (!this.pending) return;
    this.pending = false;
    void this.updateComplete.then(() => {
      if (this.isConnected && !this.pending && this.panelOpen) this.submitButtonEl?.focus();
    });
  }

  private onSubmit = (): void => {
    if (this.disabled || this.pending || !this.value || !this.panelOpen) return;
    const validReasonIds = new Set(this.reasons.map((reason) => reason.id));
    const event = this.emit(
      'lr-submit',
      {
        value: this.value,
        reasonIds: this.selectedReasonIds.filter((id) => validReasonIds.has(id)),
        comment: this.commentable ? this.commentDraft.trim() : '',
      },
      { cancelable: true }
    );
    if (event.defaultPrevented) {
      this.pending = true;
      return;
    }
    this.completeSubmission();
  };

  private renderThumb(direction: MessageFeedbackRating): TemplateResult {
    const pressed = this.value === direction;
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
                  ${this.reasons.length > 0
                    ? html`
                        <div part="reasons" role="group" aria-label=${this.localize('feedbackReasonsLabel')}>
                          ${this.reasons.map(
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
                  ${this.commentable
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
