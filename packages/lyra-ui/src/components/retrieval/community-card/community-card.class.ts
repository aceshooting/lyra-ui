import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import '../../overlays/chip/chip.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './community-card.styles.js';

export interface LyraCommunity {
  id: string;
  label: string;
  summary?: string;
  /** Authoritative when it exceeds `members.length`. */
  memberCount?: number;
}

/** Visual chrome for `<lr-community-card>`'s root, mirroring `lr-card`'s `appearance` vocabulary
 *  and this component's sibling `lr-entity-card`'s identical property. */
export type CommunityCardAppearance = 'card' | 'plain';

export interface LyraCommunityCardEventMap {
  /** The drill button, header, or overflow chip -- all three mean "show me this whole community". */
  'lr-drill': CustomEvent<{ id: string }>;
  'lr-entity-activate': CustomEvent<{ id: string }>;
}

/**
 * `<lr-community-card>` — a cluster/community summary card (GraphRAG community report): label,
 * LLM summary excerpt, member count, member chips with overflow, and a drill-in action. Doesn't
 * own community rendering on the graph or membership fetching -- `lr-drill` asks the host to
 * load members/subgraph.
 *
 * @customElement lr-community-card
 * @slot actions - Extra header actions alongside the built-in drill button.
 * @event lr-drill - `detail: { id }`.
 * @event lr-entity-activate - A member chip was activated. `detail: { id }`.
 * @csspart base - The outer bordered container.
 * @csspart header - The header row.
 * @csspart title - The community label, `role="heading" aria-level="3"` wrapping a `<button>`.
 * @csspart member-count - The `"{count} members"` text.
 * @csspart summary - The LLM summary excerpt, omitted in `compact` mode.
 * @csspart members - The wrapper around member chips, omitted in `compact` mode.
 * @csspart member - One member chip button.
 * @csspart overflow - The "+N" overflow chip button.
 * @csspart drill-button - The built-in "Explore community" button.
 * @csspart actions - The wrapper around the `actions` slot and the drill button.
 * @csspart empty - The empty state shown when `community` is `null`.
 */
export class LyraCommunityCard extends LyraElement<LyraCommunityCardEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** `null` renders the `noData` empty state. */
  @property({ attribute: false }) community: LyraCommunity | null = null;
  /** Rendered as chips. */
  @property({ attribute: false }) members: LyraEntity[] = [];
  /** Visible member chips before the "+N" overflow chip. */
  @property({ type: Number, attribute: 'max-members' }) maxMembers = 8;
  /** Single-row layout (title + member count + drill button, no summary/chips). */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Visual chrome, mirroring `lr-card`'s `appearance` vocabulary and this component's sibling
   *  `lr-entity-card`'s identical property. `'card'` (the default) keeps the bordered, filled,
   *  padded box. `'plain'` removes the border, background, and padding, so a card nested inside a
   *  container that already draws a border doesn't double it. */
  @property({ reflect: true }) appearance: CommunityCardAppearance = 'card';

  /** `maxMembers` normalized to a finite, non-negative integer count -- passed straight to
   *  `Array.prototype.slice()` below, which would otherwise silently misbehave on a non-finite or
   *  negative input (e.g. a negative `end` slices from the far end of the array instead of
   *  limiting how many members show). */
  private get effectiveMaxMembers(): number {
    return finiteCount(this.maxMembers, 8);
  }

  private onDrill = (): void => {
    if (this.community) this.emit('lr-drill', { id: this.community.id });
  };

  override render(): TemplateResult {
    if (!this.community) {
      return html`<div part="base"><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
    }
    const community = this.community;
    const titleText = community.label || this.localize('untitledCommunity');
    const memberCount = community.memberCount ?? this.members.length;
    const visibleMembers = this.members.slice(0, this.effectiveMaxMembers);
    const overflowCount = Math.max(0, memberCount - visibleMembers.length);

    return html`
      <div part="base">
        <div part="header">
          <span part="title" role="heading" aria-level="3"><button type="button" @click=${this.onDrill}>${titleText}</button></span>
          <span part="member-count">${this.localize('communityMemberCount', undefined, { count: memberCount })}</span>
          <div part="actions">
            <slot name="actions"></slot>
            <lr-button part="drill-button" size="s" @click=${this.onDrill}>${this.localize('communityDrillIn')}</lr-button>
          </div>
        </div>
        ${!this.compact && community.summary ? html`<p part="summary">${community.summary}</p>` : nothing}
        ${!this.compact
          ? html`<div part="members">
              ${visibleMembers.map(
                (m) => html`<button part="member" type="button" @click=${() => this.emit('lr-entity-activate', { id: m.id })}>
                  <lr-chip>${m.label || m.id}</lr-chip>
                </button>`,
              )}
              ${overflowCount > 0
                ? html`<button part="overflow" type="button" @click=${this.onDrill}>
                    <lr-chip>${this.localize('showMoreCount', undefined, { count: overflowCount })}</lr-chip>
                  </button>`
                : nothing}
            </div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-community-card': LyraCommunityCard;
  }
}
