import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import {
  html,
  nothing,
  svg,
  type PropertyDeclaration,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { composedContains } from '../../../internal/overlay-stack.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import {
  autocorrectConverter,
  declaredDefaultConverter,
  normalizeAutocorrect,
  omittedEmptyStringConverter,
  trueDefaultSpellcheckConverter,
} from '../../../internal/converters.js';
import type { LyraTextWrap } from '../../../internal/shared-unions.js';
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

/** Native `<textarea wrap>` values accepted by the optional comment field. */
export type MessageFeedbackWrap = LyraTextWrap;

export interface MessageFeedbackSubmitDetail {
  rating: MessageFeedbackValue;
  reasonIds: string[];
  comment: string;
  /** Opaque, nonblank correlation identity for this one feedback persistence transaction. */
  readonly submissionId: string;
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

const MAX_PROJECTED_FEEDBACK_REASONS = 10_000;

interface FeedbackDetailProjection {
  readonly reasons: readonly MessageFeedbackReason[];
  readonly commentable: boolean;
}

const EMPTY_FEEDBACK_DETAIL_PROJECTION: FeedbackDetailProjection = Object.freeze({
  reasons: Object.freeze([]),
  commentable: false,
});

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

/**
 * Admits only own-data reason fields and copies their later-used values once. The shared ownership
 * boundary protects the outer collection, but schema projection still must not re-read a retained
 * row: it may be an opaque object with accessor-backed fields after a caller bypasses TypeScript.
 */
function projectFeedbackDetail(detail: unknown): FeedbackDetailProjection {
  if (!isObjectValue(detail)) return EMPTY_FEEDBACK_DETAIL_PROJECTION;
  const reasonsDescriptor = getOwnDataDescriptor(detail, 'reasons');
  const commentableDescriptor = getOwnDataDescriptor(detail, 'commentable');
  const commentable =
    commentableDescriptor !== MISSING_OWN_DATA_DESCRIPTOR &&
    commentableDescriptor !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    commentableDescriptor.value === true;
  const reasonsValue =
    reasonsDescriptor !== MISSING_OWN_DATA_DESCRIPTOR &&
    reasonsDescriptor !== UNSAFE_OWN_DATA_DESCRIPTOR
      ? reasonsDescriptor.value
      : undefined;
  if (!isArrayValue(reasonsValue)) {
    return commentable
      ? Object.freeze({ reasons: Object.freeze([]), commentable })
      : EMPTY_FEEDBACK_DETAIL_PROJECTION;
  }
  const lengthDescriptor = getOwnDataDescriptor(reasonsValue, 'length');
  if (
    lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
    lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    return commentable
      ? Object.freeze({ reasons: Object.freeze([]), commentable })
      : EMPTY_FEEDBACK_DETAIL_PROJECTION;
  }
  const reasons: MessageFeedbackReason[] = [];
  const seen = new Set<string>();
  const length = Math.min(lengthDescriptor.value, MAX_PROJECTED_FEEDBACK_REASONS);
  for (let index = 0; index < length; index += 1) {
    const rowDescriptor = getOwnDataDescriptor(reasonsValue, String(index));
    if (
      rowDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      rowDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !isObjectValue(rowDescriptor.value)
    )
      continue;
    const row = rowDescriptor.value;
    const idDescriptor = getOwnDataDescriptor(row, 'id');
    const labelDescriptor = getOwnDataDescriptor(row, 'label');
    if (
      idDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      idDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      labelDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      labelDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof idDescriptor.value !== 'string' ||
      typeof labelDescriptor.value !== 'string'
    )
      continue;
    const id = idDescriptor.value;
    const label = labelDescriptor.value;
    if (id.trim().length === 0 || seen.has(id)) continue;
    seen.add(id);
    reasons.push(Object.freeze({ id, label }));
  }
  return Object.freeze({ reasons: Object.freeze(reasons), commentable });
}

type PendingSubmissionSettlement = 'finalize' | 'revert';

interface PendingMessageFeedbackSubmission {
  readonly submissionId: string;
  readonly sequence: number;
  readonly lifecycleGeneration: number;
  readonly rating: MessageFeedbackValue;
  readonly detail: MessageFeedbackDetailConfiguration | undefined;
  readonly detailFor: MessageFeedbackDetailFor;
  readonly previousRating: MessageFeedbackValue;
  readonly panelWasOpen: boolean;
  settlement?: PendingSubmissionSettlement;
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
 * reassign a new detail record after changes. When the detail record enables a comment textarea,
 * its native `spellcheck`, `autocapitalize`, `autocorrect`, and `wrap` properties forward from
 * this element; no textarea exists, and those values have no rendered target, otherwise.
 *
 * Asynchronous finalization or reversion preserves focus on an outside control. Settlement retains the existing thumb/submit fallback when focus remains within the feedback or was lost as its pending controls became disabled.
 *
 * @customElement lr-message-feedback
 * @event lr-feedback-change - `detail: { rating }`. Fires whenever thumb interaction changes the
 *   provisional rating, including clearing it to `null`.
 * @event lr-feedback-submit - Frozen `detail: { rating, reasonIds, comment, submissionId }`, fired
 *   immediately for a thumbs-only terminal choice or by the detail panel's submit button.
 *   `submissionId` is a nonblank, never-reused transaction identity. Cancelable:
 *   `preventDefault()` holds the panel in its reflected `pending` state until the host calls
 *   `finalizePendingSubmit(submissionId)` after persistence succeeds or
 *   `revertPendingSubmit(submissionId)` after it fails. The legacy no-argument settle form works
 *   only for this instance's first never-invalidated transaction; later calls fail closed. An
 *   uncanceled submit retains the synchronous close/announce/focus behavior.
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

  protected static override readonly ownedCollectionProperties = Object.freeze(['detail']);

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

  /** Native spellcheck state for the optional comment textarea. `spellcheck="false"` parses false. */
  @property({ converter: trueDefaultSpellcheckConverter }) override spellcheck = true;

  /** Native autocapitalization hint for the optional comment textarea. Empty preserves its default. */
  @property({ converter: omittedEmptyStringConverter }) override autocapitalize = '';

  private autocorrectValue = true;

  /** Native autocorrect state for the optional comment textarea. Reads are boolean; writes also
   *  accept the legacy `'off'` and `'false'` string forms. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    const previous = this.autocorrectValue;
    this.autocorrectValue = normalizeAutocorrect(next);
    this.requestUpdate('autocorrect', previous);
  }

  /** Native wrapping mode for the optional comment textarea. Removing `wrap` restores `'soft'`. */
  @property({ converter: declaredDefaultConverter<MessageFeedbackWrap>('soft') })
  wrap: MessageFeedbackWrap = 'soft';

  @state() private panelOpen = false;
  @state() private selectedReasonIds: string[] = [];
  @state() private commentDraft = '';
  private detailProjectionSource: unknown = Symbol('unprojected-feedback-detail');
  private detailProjection = EMPTY_FEEDBACK_DETAIL_PROJECTION;
  private pendingInternalRating: { rating: MessageFeedbackValue } | undefined;
  private submissionSequence = 0;
  private submissionCount = 0;
  private legacyNoArgumentSettlementInvalidated = false;
  private lifecycleGeneration = 0;
  private focusGeneration = 0;
  private settingPending = false;
  private dispatchingSubmission?: PendingMessageFeedbackSubmission;
  private pendingSubmission?: PendingMessageFeedbackSubmission;

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
    let leasedButton: HTMLButtonElement | undefined;
    let authoredTabIndex: string | null = null;
    let lastManagedTabIndex: string | null = null;
    let consumerOwnsTabIndex = false;
    const releaseTabIndex = (): void => {
      const target = leasedButton;
      if (target && target.getAttribute('tabindex') === lastManagedTabIndex) {
        if (authoredTabIndex === null) target.removeAttribute('tabindex');
        else target.setAttribute('tabindex', authoredTabIndex);
      }
      leasedButton = undefined;
      authoredTabIndex = null;
      lastManagedTabIndex = null;
      consumerOwnsTabIndex = false;
    };
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
        if (!target) {
          releaseTabIndex();
          return;
        }
        if (leasedButton !== target) {
          releaseTabIndex();
          leasedButton = target;
          authoredTabIndex = target.getAttribute('tabindex');
        }
        if (
          consumerOwnsTabIndex ||
          (lastManagedTabIndex !== null &&
            target.getAttribute('tabindex') !== lastManagedTabIndex)
        ) {
          consumerOwnsTabIndex = true;
          return;
        }
        target.tabIndex = tabIndex;
        lastManagedTabIndex = target.getAttribute('tabindex');
      },
      releaseTabIndex,
      matchesEventPath(path) {
        const target = button();
        return target !== undefined && path.includes(target);
      },
    };
  }

  /** Ordered logical actions exposed to an enclosing toolbar without exposing shadow nodes.
   *  A parent releases its optional lease when this provider leaves, restoring an untouched
   *  authored thumb tabindex without replacing a later consumer value. */
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
    return this.currentDetailProjection.reasons;
  }

  private get detailCommentable(): boolean {
    return this.currentDetailProjection.commentable;
  }

  private get currentDetailProjection(): FeedbackDetailProjection {
    const detail = this.detail;
    if (detail !== this.detailProjectionSource) {
      this.detailProjectionSource = detail;
      this.detailProjection = projectFeedbackDetail(detail);
    }
    return this.detailProjection;
  }

  private get hasDetailContent(): boolean {
    return this.detailReasons.length > 0 || this.detailCommentable;
  }

  private detailApplies(direction: MessageFeedbackRating): boolean {
    return this.detailFor === 'both' || this.detailFor === direction;
  }

  override requestUpdate(
    name?: PropertyKey,
    oldValue?: unknown,
    options?: PropertyDeclaration,
  ): void {
    const currentValue =
      name === 'rating'
        ? this.rating
        : name === 'detail'
        ? this.detail
        : name === 'detailFor'
        ? this.detailFor
        : name === 'pending'
        ? this.pending
        : undefined;
    const changed = oldValue !== currentValue;
    const internalRatingWrite =
      name === 'rating' && this.pendingInternalRating?.rating === this.rating;
    if (
      changed &&
      (name === 'rating' || name === 'detail' || name === 'detailFor' || name === 'pending') &&
      !(name === 'rating' && internalRatingWrite)
    ) {
      this.focusGeneration = (this.focusGeneration ?? 0) + 1;
      if (
        this.pendingSubmission &&
        (name !== 'pending' || (!this.settingPending && this.pending === false))
      ) {
        this.invalidatePendingSubmission();
      }
    }
    super.requestUpdate(name, oldValue, options);
  }

  override disconnectedCallback(): void {
    this.lifecycleGeneration += 1;
    this.invalidatePendingSubmission();
    this.upToolbarAction.releaseTabIndex?.();
    this.downToolbarAction.releaseTabIndex?.();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.lifecycleGeneration += 1;
    this.invalidatePendingSubmission();
    this.upToolbarAction.releaseTabIndex?.();
    this.downToolbarAction.releaseTabIndex?.();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('rating')) {
      const internal = this.pendingInternalRating?.rating === this.rating;
      this.pendingInternalRating = undefined;
      if (!internal) {
        this.invalidatePendingSubmission();
        this.setPending(false);
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
      this.invalidatePendingSubmission();
      this.setPending(false);
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

  private setPending(pending: boolean): void {
    this.settingPending = true;
    this.pending = pending;
    this.settingPending = false;
  }

  /** Retires a transaction synchronously so a later same-turn settlement cannot affect it. */
  private invalidatePendingSubmission(): void {
    const transaction = this.pendingSubmission;
    if (!transaction) return;
    this.pendingSubmission = undefined;
    if (this.dispatchingSubmission === transaction) {
      this.dispatchingSubmission = undefined;
    }
    this.legacyNoArgumentSettlementInvalidated = true;
    this.focusGeneration += 1;
    this.setPending(false);
  }

  private isCurrentPendingSubmission(
    transaction: PendingMessageFeedbackSubmission,
  ): boolean {
    if (
      this.pendingSubmission === transaction &&
      this.pending &&
      this.isConnected &&
      transaction.lifecycleGeneration === this.lifecycleGeneration &&
      transaction.rating === this.rating &&
      transaction.detail === this.detail &&
      transaction.detailFor === this.detailFor
    ) {
      return true;
    }
    if (this.pendingSubmission === transaction) this.invalidatePendingSubmission();
    return false;
  }

  private canSettleWithoutSubmissionId(
    transaction: PendingMessageFeedbackSubmission,
  ): boolean {
    return (
      !this.legacyNoArgumentSettlementInvalidated &&
      this.submissionCount === 1 &&
      transaction.sequence === 1
    );
  }

  private scheduleSettlementFocus(
    transaction: PendingMessageFeedbackSubmission,
    destination: 'thumb' | 'submit',
  ): void {
    const focusGeneration = ++this.focusGeneration;
    const lifecycleGeneration = transaction.lifecycleGeneration;
    if (!this.ownsSettlementFocus()) return;
    void this.updateComplete.then(() => {
      if (
        focusGeneration !== this.focusGeneration ||
        lifecycleGeneration !== this.lifecycleGeneration ||
        !this.isConnected ||
        this.pending ||
        this.pendingSubmission ||
        !this.ownsSettlementFocus()
      )
        return;
      if (destination === 'submit' && this.panelOpen) this.submitButtonEl?.focus();
      else this.focusActiveThumb();
    });
  }

  private ownsSettlementFocus(): boolean {
    const doc = this.ownerDocument;
    const active = deepActiveElementIn(doc);
    return active === null || active === doc.body || active === doc.documentElement || composedContains(this, active);
  }

  private settlePendingSubmission(
    settlement: PendingSubmissionSettlement,
    submissionId?: string,
  ): boolean {
    const transaction = this.pendingSubmission;
    if (!transaction || !this.isCurrentPendingSubmission(transaction)) return false;
    if (submissionId === undefined) {
      if (!this.canSettleWithoutSubmissionId(transaction)) return false;
    } else if (submissionId !== transaction.submissionId) {
      return false;
    }
    if (transaction.settlement) return false;
    // Synchronous listeners choose the first matching outcome but leave the transaction installed
    // until dispatch unwinds. That makes veto/listener ordering deterministic and prevents a later
    // synchronous callback from observing a half-completed panel.
    if (this.dispatchingSubmission === transaction) {
      transaction.settlement = settlement;
      return true;
    }
    this.commitSettlement(transaction, settlement);
    return true;
  }

  private commitSettlement(
    transaction: PendingMessageFeedbackSubmission,
    settlement: PendingSubmissionSettlement,
  ): void {
    if (!this.isCurrentPendingSubmission(transaction)) return;
    this.pendingSubmission = undefined;
    if (this.dispatchingSubmission === transaction) {
      this.dispatchingSubmission = undefined;
    }
    this.setPending(false);
    if (settlement === 'finalize') {
      this.panelOpen = false;
      this.liveRegion?.announce(this.localize('feedbackSubmitted'), { force: true });
      this.scheduleSettlementFocus(transaction, 'thumb');
      return;
    }
    this.setRatingFromInteraction(transaction.previousRating);
    this.panelOpen = transaction.panelWasOpen;
    this.scheduleSettlementFocus(
      transaction,
      transaction.panelWasOpen ? 'submit' : 'thumb',
    );
  }

  /** Completes a live held submit. Pass its event `submissionId`; a no-argument call is retained
   *  only for this instance's never-invalidated first transaction. Returns whether this call won. */
  finalizePendingSubmit(submissionId?: string): boolean {
    return this.settlePendingSubmission('finalize', submissionId);
  }

  /** Reverts a live held submit to the rating preceding it. Pass its event `submissionId`; the
   *  restricted legacy no-argument form follows `finalizePendingSubmit()`. Returns whether it won. */
  revertPendingSubmit(submissionId?: string): boolean {
    return this.settlePendingSubmission('revert', submissionId);
  }

  private requestSubmission(
    detail: Omit<MessageFeedbackSubmitDetail, 'submissionId'>,
    previousRating: MessageFeedbackValue,
    panelWasOpen: boolean,
  ): void {
    this.focusGeneration += 1;
    const sequence = ++this.submissionSequence;
    this.submissionCount += 1;
    const transaction: PendingMessageFeedbackSubmission = {
      submissionId: nextId('message-feedback-submission'),
      sequence,
      lifecycleGeneration: this.lifecycleGeneration,
      rating: this.rating,
      detail: this.detail,
      detailFor: this.detailFor,
      previousRating,
      panelWasOpen,
    };
    // Install before dispatch: a listener can synchronously select the first matching outcome.
    this.pendingSubmission = transaction;
    this.setPending(true);
    this.dispatchingSubmission = transaction;
    const event = this.emit(
      'lr-feedback-submit',
      { ...detail, submissionId: transaction.submissionId },
      { cancelable: true },
    );
    if (this.dispatchingSubmission === transaction) {
      this.dispatchingSubmission = undefined;
    }
    if (!this.isCurrentPendingSubmission(transaction)) return;
    if (transaction.settlement) {
      this.commitSettlement(transaction, transaction.settlement);
      return;
    }
    if (!event.defaultPrevented) this.commitSettlement(transaction, 'finalize');
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
                          spellcheck=${this.spellcheck}
                          autocapitalize=${this.autocapitalize || nothing}
                          autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
                            ? this.autocorrect
                              ? 'on'
                              : 'off'
                            : nothing}
                          wrap=${this.wrap}
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
