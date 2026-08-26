import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isNonBlankIdentity, firstByRetrievalIdentity } from '../retrieval-identity.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
export type { LyraEntity } from '../entity-card/entity-card.class.js';
import '../../overlays/chip/chip.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './community-card.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_communityDrillIn, LYRA_DEFAULT_communityMemberCount, LYRA_DEFAULT_noData, LYRA_DEFAULT_showMoreCount, LYRA_DEFAULT_untitledCommunity } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraCommunity {
  id: string;
  label: string;
  summary?: string;
  /** Total record count for paged data. Values below the supplied `members.length` cannot reduce
   * the truthful known count; omitted values use `members.length`. */
  memberCount?: number;
}

/** Container treatment for `<lr-community-card>`'s root. The library-wide {@linkcode LyraFrame}
 *  vocabulary under this component's own export name. */
export type CommunityCardAppearance = LyraFrame;

export interface LyraCommunityCardEventMap {
  /** The drill button, header, or overflow chip -- all three mean "show me this whole community". */
  'lr-drill': CustomEvent<{ communityId: string }>;
  'lr-entity-activate': CustomEvent<{ entityId: string }>;
}

/**
 * `<lr-community-card>` — a cluster/community summary card (GraphRAG community report): label,
 * LLM summary excerpt, member count, member chips with overflow, and a drill-in action. Doesn't
 * own community rendering on the graph or membership fetching -- `lr-drill` asks the host to
 * load members/subgraph.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-community-card
 * @slot actions - Extra header actions alongside the built-in drill button.
 * @event lr-drill - `detail: { communityId }`.
 * @event lr-entity-activate - A member chip was activated. `detail: { entityId }`.
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
 * @status stable
 * @since 4.0.0
 */
export class LyraCommunityCard extends LyraElement<LyraCommunityCardEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    communityDrillIn: LYRA_DEFAULT_communityDrillIn,
    communityMemberCount: LYRA_DEFAULT_communityMemberCount,
    noData: LYRA_DEFAULT_noData,
    showMoreCount: LYRA_DEFAULT_showMoreCount,
    untitledCommunity: LYRA_DEFAULT_untitledCommunity,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['members']);

  static override styles = [LyraElement.styles, styles];

  /** `null` renders the `noData` empty state. */
  @property({ attribute: false }) community: LyraCommunity | null = null;
  /** Rendered as chips. */
  @property({ attribute: false }) members: readonly LyraEntity[] = [];
  /** Visible member chips before the "+N" overflow chip. */
  @property({ type: Number, attribute: 'max-members' }) maxMembers = 8;
  /** Single-row layout (title + member count + drill button, no summary/chips). */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Container treatment, in the shared `LyraFrame` vocabulary — the same property this
   *  component's sibling `lr-entity-card` carries. `'card'` (the default) keeps the bordered,
   *  filled, padded box. `'plain'` removes the border, background, and padding, so a card nested
   *  inside a container that already draws a border doesn't double it. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** `maxMembers` normalized to a finite, non-negative integer count -- passed straight to
   *  `Array.prototype.slice()` below, which would otherwise silently misbehave on a non-finite or
   *  negative input (e.g. a negative `end` slices from the far end of the array instead of
   *  limiting how many members show). */
  private get effectiveMaxMembers(): number {
    return finiteCount(this.maxMembers, 8);
  }

  private onDrill = (): void => {
    if (this.community && isNonBlankIdentity(this.community.id)) {
      this.emit('lr-drill', { communityId: this.community.id });
    }
  };

  override render(): TemplateResult {
    if (!this.community || !isNonBlankIdentity(this.community.id)) {
      return html`<div part="base">
        <lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>
      </div>`;
    }
    const community = this.community;
    const members = firstByRetrievalIdentity(
      this.members,
      (member) => member?.id
    );
    const titleText = community.label || this.localize('untitledCommunity');
    const suppliedMemberCount = community.memberCount;
    const memberCount = Math.max(
      members.length,
      suppliedMemberCount !== undefined &&
        Number.isSafeInteger(suppliedMemberCount) &&
        suppliedMemberCount >= 0
        ? suppliedMemberCount
        : members.length
    );
    const visibleMembers = members.slice(0, this.effectiveMaxMembers);
    const overflowCount = Math.max(0, memberCount - visibleMembers.length);
    const numberFormat = getNumberFormat(this.effectiveLocale);

    return html`
      <div part="base">
        <div part="header">
          <span part="title" role="heading" aria-level="3"
            ><button type="button" @click=${this.onDrill}>
              ${titleText}
            </button></span
          >
          <span part="member-count"
            >${this.localize('communityMemberCount', undefined, {
              count: numberFormat.format(memberCount),
            })}</span
          >
          <div part="actions">
            <slot name="actions"></slot>
            <lr-button part="drill-button" size="s" @click=${this.onDrill}
              >${this.localize('communityDrillIn')}</lr-button
            >
          </div>
        </div>
        ${!this.compact && community.summary
          ? html`<p part="summary">${community.summary}</p>`
          : nothing}
        ${!this.compact
          ? html`<div part="members">
              ${visibleMembers.map(
                (m) => html`<button
                  part="member"
                  type="button"
                  @click=${() =>
                    this.emit('lr-entity-activate', { entityId: m.id })}
                >
                  <lr-chip>${m.label || m.id}</lr-chip>
                </button>`
              )}
              ${overflowCount > 0
                ? html`<button
                    part="overflow"
                    type="button"
                    @click=${this.onDrill}
                  >
                    <lr-chip
                      >${this.localize('showMoreCount', undefined, {
                        count: numberFormat.format(overflowCount),
                      })}</lr-chip
                    >
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
