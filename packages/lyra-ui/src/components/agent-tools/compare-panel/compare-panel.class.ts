import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './compare-panel.styles.js';
import { overallSemanticLabel, overallSemanticRole } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_comparePanel, LYRA_DEFAULT_compareResponseA, LYRA_DEFAULT_compareResponseB, LYRA_DEFAULT_compareVoteBetter, LYRA_DEFAULT_compareVoteBothBad, LYRA_DEFAULT_compareVoteLabel, LYRA_DEFAULT_compareVoteRecorded, LYRA_DEFAULT_compareVoteTie } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type CompareVote = 'a' | 'b' | 'tie' | 'both-bad';

export interface LyraComparePanelEventMap {
  'lr-vote': CustomEvent<{ choice: CompareVote; itemId: string }>;
}

/**
 * `<lr-compare-panel>` — side-by-side A/B output comparison with a winner
 * vote (LMSYS-arena / LangSmith-pairwise style): two slotted panes, a vote
 * bar, synchronized reading.
 * A host may commit `itemId` and its controlled `vote` in either assignment order. Changing only
 * `itemId` clears the prior vote; an explicit vote in the same update is preserved.
 * `allowedVotes` is a clone-owned, bounded readonly snapshot; create and reassign a new array
 * after changing the permitted choices.
 *
 * @customElement lr-compare-panel
 * @slot a - The first output (any content — a chat message, markdown, a viewer).
 * @slot b - The second output.
 * @slot prompt - Optional shared-input header above both panes.
 * @event lr-vote - `detail: { choice, itemId }`. Cancelable; preventing it preserves the prior vote.
 * @csspart base - The outer wrapper.
 * @csspart prompt - The optional prompt header, hidden when the `prompt` slot is empty.
 * @csspart panes - The row (or, under 640px, column) wrapping both panes.
 * @csspart pane-a - The first pane's labeled scroll region.
 * @csspart pane-b - The second pane's labeled scroll region.
 * @csspart pane-header - A pane's visible heading.
 * @csspart vote-bar - The `role="group"` row of vote buttons.
 * @csspart vote-button - One vote button.
 * @csspart live-region - The internal vote-announcement live region.
 * @cssprop [--lr-compare-panel-max-height=var(--lr-size-24rem)] - Cap on how tall each pane's
 *   scroll region grows before it scrolls internally.
 * @cssprop [--lr-compare-panel-selected-background=var(--lr-color-brand-quiet)] - Selected vote
 *   button background.
 * @cssprop [--lr-compare-panel-selected-border-color=var(--lr-color-brand)] - Selected vote
 *   button border color.
 * @cssprop [--lr-compare-panel-selected-color=var(--lr-color-brand)] - Selected vote button text
 *   color.
 * @cssprop [--lr-compare-panel-selected-font-weight=var(--lr-font-weight-semibold)] - Selected
 *   vote button font weight.
 * @status stable
 * @since 4.0.0
 */
export class LyraComparePanel extends LyraElement<LyraComparePanelEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['allowedVotes']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    comparePanel: LYRA_DEFAULT_comparePanel,
    compareResponseA: LYRA_DEFAULT_compareResponseA,
    compareResponseB: LYRA_DEFAULT_compareResponseB,
    compareVoteBetter: LYRA_DEFAULT_compareVoteBetter,
    compareVoteBothBad: LYRA_DEFAULT_compareVoteBothBad,
    compareVoteLabel: LYRA_DEFAULT_compareVoteLabel,
    compareVoteRecorded: LYRA_DEFAULT_compareVoteRecorded,
    compareVoteTie: LYRA_DEFAULT_compareVoteTie,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override properties = {
    labelA: { attribute: 'label-a', noAccessor: true },
    labelB: { attribute: 'label-b', noAccessor: true },
    vote: { reflect: true, noAccessor: true },
    itemId: { attribute: 'item-id', noAccessor: true },
    syncScroll: { type: Boolean, attribute: 'sync-scroll', noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @state() private hasPromptSlot = false;

  @query('[part="pane-a"]') private paneAEl?: HTMLElement;
  @query('[part="pane-b"]') private paneBEl?: HTMLElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private _labelA = '';
  private _labelB = '';
  private _vote: CompareVote | null = null;
  private _itemId = '';
  private _syncScroll = false;
  private _disabled = false;
  private pendingScrollReset = false;
  private suppressSync = false;
  private syncScrollRafId?: number;
  private syncScrollRafOwner?: Window;
  private syncScrollRafDocument?: Document;
  private ownerRealmGeneration = 0;
  private voteAssignedInCommit = false;

  get labelA(): string {
    return this._labelA;
  }
  set labelA(next: string) {
    const old = this._labelA;
    this._labelA = next ?? '';
    this.requestUpdate('labelA', old);
  }

  get labelB(): string {
    return this._labelB;
  }
  set labelB(next: string) {
    const old = this._labelB;
    this._labelB = next ?? '';
    this.requestUpdate('labelB', old);
  }

  get vote(): CompareVote | null {
    return this._vote;
  }
  set vote(next: CompareVote | null) {
    this.voteAssignedInCommit = true;
    const old = this._vote;
    this._vote = next ?? null;
    if (this._vote) this.setAttribute('vote', this._vote);
    else this.removeAttribute('vote');
    this.requestUpdate('vote', old);
  }

  get itemId(): string {
    return this._itemId;
  }
  set itemId(next: string) {
    const old = this._itemId;
    this._itemId = next ?? '';
    if (old !== this._itemId) {
      this.pendingScrollReset = true;
    }
    this.requestUpdate('itemId', old);
  }

  /** Clone-owned vote choices shown in the canonical `a`, `b`, `tie`, `both-bad` order.
   *  JS-only so the positive choice list stays typed instead of relying on a
   *  lossy comma-separated attribute representation. Reassign a new array after changes. */
  @property({ attribute: false }) allowedVotes: readonly CompareVote[] = ['a', 'b', 'tie', 'both-bad'];

  get syncScroll(): boolean {
    return this._syncScroll;
  }
  set syncScroll(next: boolean) {
    const old = this._syncScroll;
    this._syncScroll = Boolean(next);
    this.requestUpdate('syncScroll', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  private onPromptSlotChange = (e: Event): void => {
    this.hasPromptSlot = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  };

  override disconnectedCallback(): void {
    this.resetScrollSyncFrame();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetScrollSyncFrame();
  }

  private resetScrollSyncFrame(): void {
    this.ownerRealmGeneration += 1;
    if (this.syncScrollRafId !== undefined) {
      this.syncScrollRafOwner?.cancelAnimationFrame(this.syncScrollRafId);
    }
    this.syncScrollRafId = undefined;
    this.syncScrollRafOwner = undefined;
    this.syncScrollRafDocument = undefined;
    this.suppressSync = false;
  }

  private castVote(choice: CompareVote): void {
    if (this.disabled) return;
    const itemId = this.itemId;
    const labelAText = this.labelA || this.localize('compareResponseA');
    const labelBText = this.labelB || this.localize('compareResponseB');
    const label =
      choice === 'a'
        ? labelAText
        : choice === 'b'
          ? labelBText
          : choice === 'tie'
            ? this.localize('compareVoteTie')
            : this.localize('compareVoteBothBad');
    const event = this.emit('lr-vote', { choice, itemId }, { cancelable: true });
    if (event.defaultPrevented) return;
    // A listener may re-entrantly advance itemId synchronously inside emit() above -- itemId's
    // own setter already resets `vote` to null for the new pair, and this write must not clobber
    // that reset by re-stamping `choice` onto the pair the user never actually saw vote on. The
    // announcement still fires unconditionally: `label`/`itemId` were captured before the
    // listener ran, so it correctly reports the vote against the *original* pair.
    if (this.itemId === itemId) this.vote = choice;
    this.liveRegion?.announce(this.localize('compareVoteRecorded', undefined, { label }), { force: true });
  }

  private voteButton(choice: CompareVote, label: string): TemplateResult | typeof nothing {
    if (!Array.isArray(this.allowedVotes) || !this.allowedVotes.includes(choice)) return nothing;
    return html`<button
      part="vote-button"
      type="button"
      ?disabled=${this.disabled}
      aria-pressed=${this.vote === choice ? 'true' : 'false'}
      ?data-selected=${this.vote === choice}
      @click=${() => this.castVote(choice)}
    >
      ${label}
    </button>`;
  }

  private onPaneScroll = (source: 'a' | 'b'): (() => void) => {
    return () => {
      if (!this.syncScroll || this.suppressSync) return;
      const from = source === 'a' ? this.paneAEl : this.paneBEl;
      const to = source === 'a' ? this.paneBEl : this.paneAEl;
      if (!from || !to) return;
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0) return;
      const ownerDocument = this.ownerDocument;
      const ownerWindow = ownerDocument.defaultView;
      if (!ownerWindow || !this.isConnected) return;
      const fraction = from.scrollTop / fromMax;
      this.suppressSync = true;
      to.scrollTop = fraction * toMax;
      const generation = this.ownerRealmGeneration;
      const handle = ownerWindow.requestAnimationFrame(() => {
        if (
          this.syncScrollRafId !== handle ||
          this.syncScrollRafOwner !== ownerWindow ||
          this.syncScrollRafDocument !== ownerDocument ||
          this.ownerRealmGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument !== ownerDocument
        ) {
          return;
        }
        this.syncScrollRafId = undefined;
        this.syncScrollRafOwner = undefined;
        this.syncScrollRafDocument = undefined;
        this.suppressSync = false;
      });
      this.syncScrollRafId = handle;
      this.syncScrollRafOwner = ownerWindow;
      this.syncScrollRafDocument = ownerDocument;
    };
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('itemId') && !this.voteAssignedInCommit) this.vote = null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.voteAssignedInCommit = false;
    if (changed.has('syncScroll') && !this.syncScroll) this.resetScrollSyncFrame();
    if (this.pendingScrollReset) {
      this.pendingScrollReset = false;
      if (this.paneAEl) this.paneAEl.scrollTop = 0;
      if (this.paneBEl) this.paneBEl.scrollTop = 0;
    }
  }

  override render(): TemplateResult {
    const labelAText = this.labelA || this.localize('compareResponseA');
    const labelBText = this.labelB || this.localize('compareResponseB');
    return html`
      <div
        part="base"
        role=${overallSemanticRole(this, 'group') ?? nothing}
        aria-label=${overallSemanticLabel(this, this.localize('comparePanel')) ?? nothing}
      >
        <div part="prompt" ?hidden=${!this.hasPromptSlot}>
          <slot name="prompt" @slotchange=${this.onPromptSlotChange}></slot>
        </div>
        <div part="panes">
          <div part="pane-a" role="region" aria-label=${labelAText} tabindex="0" @scroll=${this.onPaneScroll('a')}>
            <div part="pane-header">${labelAText}</div>
            <slot name="a"></slot>
          </div>
          <div part="pane-b" role="region" aria-label=${labelBText} tabindex="0" @scroll=${this.onPaneScroll('b')}>
            <div part="pane-header">${labelBText}</div>
            <slot name="b"></slot>
          </div>
        </div>
        <div part="vote-bar" role="group" aria-label=${this.localize('compareVoteLabel')}>
          ${this.voteButton('a', this.localize('compareVoteBetter', undefined, { label: labelAText }))}
          ${this.voteButton('b', this.localize('compareVoteBetter', undefined, { label: labelBText }))}
          ${this.voteButton('tie', this.localize('compareVoteTie'))}
          ${this.voteButton('both-bad', this.localize('compareVoteBothBad'))}
        </div>
      </div>
      <lr-live-region part="live-region" mode="polite"></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-compare-panel': LyraComparePanel;
  }
}
