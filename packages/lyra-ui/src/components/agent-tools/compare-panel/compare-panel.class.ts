import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.js';
import { styles } from './compare-panel.styles.js';

export type CompareVote = 'a' | 'b' | 'tie' | 'both-bad';

export interface LyraComparePanelEventMap {
  'lr-vote': CustomEvent<{ choice: CompareVote; itemId: string }>;
}

/**
 * `<lr-compare-panel>` — side-by-side A/B output comparison with a winner
 * vote (LMSYS-arena / LangSmith-pairwise style): two slotted panes, a vote
 * bar, synchronized reading.
 *
 * @customElement lr-compare-panel
 * @slot a - The first output (any content — a chat message, markdown, a viewer).
 * @slot b - The second output.
 * @slot prompt - Optional shared-input header above both panes.
 * @event lr-vote - `detail: { choice, itemId }`.
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
 */
export class LyraComparePanel extends LyraElement<LyraComparePanelEventMap> {
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    labelA: { attribute: 'label-a', noAccessor: true },
    labelB: { attribute: 'label-b', noAccessor: true },
    vote: { reflect: true, noAccessor: true },
    itemId: { attribute: 'item-id', noAccessor: true },
    hideTie: { type: Boolean, attribute: 'hide-tie', noAccessor: true },
    hideBothBad: { type: Boolean, attribute: 'hide-both-bad', noAccessor: true },
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
  private _hideTie = false;
  private _hideBothBad = false;
  private _syncScroll = false;
  private _disabled = false;
  private pendingScrollReset = false;
  private suppressSync = false;

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
      this.vote = null;
      this.pendingScrollReset = true;
    }
    this.requestUpdate('itemId', old);
  }

  get hideTie(): boolean {
    return this._hideTie;
  }
  set hideTie(next: boolean) {
    const old = this._hideTie;
    this._hideTie = Boolean(next);
    this.requestUpdate('hideTie', old);
  }

  get hideBothBad(): boolean {
    return this._hideBothBad;
  }
  set hideBothBad(next: boolean) {
    const old = this._hideBothBad;
    this._hideBothBad = Boolean(next);
    this.requestUpdate('hideBothBad', old);
  }

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

  private castVote(choice: CompareVote): void {
    if (this.disabled) return;
    this.vote = choice;
    this.emit('lr-vote', { choice, itemId: this.itemId });
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
    this.liveRegion?.announce(this.localize('compareVoteRecorded', undefined, { label }), { force: true });
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
      const fraction = from.scrollTop / fromMax;
      this.suppressSync = true;
      to.scrollTop = fraction * toMax;
      requestAnimationFrame(() => {
        this.suppressSync = false;
      });
    };
  };

  protected override updated(_changed: PropertyValues): void {
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
      <div part="base" role="group" aria-label=${this.getAttribute('aria-label') || this.localize('comparePanel')}>
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
          <button
            part="vote-button"
            type="button"
            ?disabled=${this.disabled}
            aria-pressed=${this.vote === 'a' ? 'true' : 'false'}
            ?data-selected=${this.vote === 'a'}
            @click=${() => this.castVote('a')}
          >
            ${this.localize('compareVoteBetter', undefined, { label: labelAText })}
          </button>
          <button
            part="vote-button"
            type="button"
            ?disabled=${this.disabled}
            aria-pressed=${this.vote === 'b' ? 'true' : 'false'}
            ?data-selected=${this.vote === 'b'}
            @click=${() => this.castVote('b')}
          >
            ${this.localize('compareVoteBetter', undefined, { label: labelBText })}
          </button>
          ${!this.hideTie
            ? html`<button
                part="vote-button"
                type="button"
                ?disabled=${this.disabled}
                aria-pressed=${this.vote === 'tie' ? 'true' : 'false'}
                ?data-selected=${this.vote === 'tie'}
                @click=${() => this.castVote('tie')}
              >
                ${this.localize('compareVoteTie')}
              </button>`
            : nothing}
          ${!this.hideBothBad
            ? html`<button
                part="vote-button"
                type="button"
                ?disabled=${this.disabled}
                aria-pressed=${this.vote === 'both-bad' ? 'true' : 'false'}
                ?data-selected=${this.vote === 'both-bad'}
                @click=${() => this.castVote('both-bad')}
              >
                ${this.localize('compareVoteBothBad')}
              </button>`
            : nothing}
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
