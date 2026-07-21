import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import type { LyraProvenance } from '../provenance-panel/provenance-panel.class.js';
import type { ConfirmBarTone } from '../../agent-tools/confirm-bar/confirm-bar.class.js';
import '../provenance-panel/provenance-panel.class.js';
import '../../agent-tools/confirm-bar/confirm-bar.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './memory-panel.styles.js';

/** A local, non-exported structural copy of `lr-provenance-panel`'s own (also un-exported)
 *  `NodeTypeStyle` shape, declared here rather than imported so this component has no build-time
 *  coupling to that module's internals -- a `types` array assigned onto either component's `types`
 *  property interops with no mapping needed. */
type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

/**
 * One item held in a memory panel's short-term or long-term list. `provenance` reuses
 * `lr-provenance-panel`'s own `LyraProvenance` shape verbatim -- assigning `item.provenance` onto
 * that component's `provenance` property needs no adapter.
 */
export interface LyraMemoryItem {
  id: string;
  /** The memory's content, rendered as plain text. */
  text: string;
  /** 0-1 confidence that this memory is accurate/current. Omit when confidence isn't tracked for
   *  this item -- the confidence indicator is omitted entirely rather than rendering a 0%/unknown
   *  placeholder. */
  confidence?: number;
  /** What grounded this memory (entities/relationships/communities/source chunks), rendered
   *  through `lr-provenance-panel` behind a per-item disclosure toggle. Omit when this memory
   *  carries no traceable grounding -- the toggle is omitted entirely in that case. */
  provenance?: LyraProvenance;
}

type MemoryScope = 'short-term' | 'long-term';

interface ItemPending {
  kind: 'add' | 'remove';
  item: LyraMemoryItem;
  scope: MemoryScope;
}

type PendingAction = ItemPending | { kind: 'forget-all' };

export interface LyraMemoryAddDetail {
  item: LyraMemoryItem;
}

export interface LyraMemoryRemoveDetail {
  id: string;
  scope: MemoryScope;
}

export interface LyraMemoryExpandDetail {
  id: string;
  expanded: boolean;
}

export interface LyraMemoryPanelEventMap {
  'lr-add': CustomEvent<LyraMemoryAddDetail>;
  'lr-remove': CustomEvent<LyraMemoryRemoveDetail>;
  'lr-forget': CustomEvent<undefined>;
  'lr-expand': CustomEvent<LyraMemoryExpandDetail>;
}

type Tier = 'high' | 'medium' | 'low';

const CONFIRM_HEADING_KEY: Record<'add' | 'remove' | 'forget-all', string> = {
  add: 'memoryPanelConfirmAddHeading',
  remove: 'memoryPanelConfirmRemoveHeading',
  'forget-all': 'memoryPanelConfirmForgetHeading',
};

const TIER_LABEL_KEY: Record<Tier, string> = {
  high: 'citationHighConfidence',
  medium: 'citationMediumConfidence',
  low: 'citationLowConfidence',
};

const TIER_TONE: Record<Tier, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
};

/**
 * `<lr-memory-panel>` — an agent's working memory surface: short-term context and long-term
 * memories, each item's confidence and (optional) grounding provenance, and add/remove/forget
 * actions gated behind an explicit confirmation step before anything is reported as decided.
 *
 * Composes `lr-provenance-panel` for a per-item's provenance breakdown (revealed behind a
 * disclosure toggle, only rendered when `item.provenance` is set) and `lr-confirm-bar` for every
 * add/remove/forget confirmation -- this component never re-implements a new inline-confirmation
 * pattern of its own. A memory item's confidence reuses `lr-citation-badge`'s own confidence
 * vocabulary (`citationHighConfidence`/`citationMediumConfidence`/`citationLowConfidence`), tiered
 * against `thresholds` the same way `lr-chunk-inspector` tiers a chunk's relevance score.
 *
 * `shortTerm`/`longTerm` are controlled and never mutated by this component -- approving a pending
 * action only fires the matching event; the host applies the resulting state change (adding to
 * `longTerm`, removing an item, clearing `longTerm`) and passes new arrays back down. At most one
 * confirmation is ever pending at a time: starting a new action (on the same item or a different
 * one) silently cancels whichever confirmation was already open, the same way only one row can be
 * mid-edit in a list at once.
 *
 * Three distinct, non-overlapping actions: `add` promotes a short-term item into long-term memory
 * (only offered on short-term items -- long-term items are already there); `remove` deletes one
 * specific item from whichever list it's in (offered on every item); `forget` is deliberately
 * scoped to the whole long-term list at once (a single "Forget all" control in that section's
 * header, only rendered while `longTerm` is non-empty) -- a bulk, more consequential action kept
 * distinct from the per-item `remove`.
 *
 * @customElement lr-memory-panel
 * @event lr-add - A pending "add to long-term memory" action was approved. `detail: { item }` --
 * the short-term item as-is; the host decides how/whether to persist it.
 * @event lr-remove - A pending "remove" action was approved. `detail: { id, scope }`.
 * @event lr-forget - The pending "forget all long-term memories" action was approved. No detail.
 * @event lr-expand - A memory item's provenance disclosure was toggled. `detail: { id, expanded }`.
 * @csspart base - The root wrapper.
 * @csspart empty - The all-empty `lr-empty` state, shown when both lists are empty.
 * @csspart section - One of the two (short-term/long-term) sections; carries `data-scope`.
 * @csspart section-header - A section's heading + (long-term only) "Forget all" control row.
 * @csspart heading - A section's visible heading text.
 * @csspart section-empty - A section's "no items" text, shown when that section's own list is empty.
 * @csspart list - A section's `role="list"` wrapper, omitted while that section is empty.
 * @csspart item - One memory item row (`role="listitem"`); carries `data-id`/`data-scope` and a
 * stable `tabindex="-1"` so focus has somewhere to land after a pending confirmation on this row
 * resolves.
 * @csspart item-row - The wrapper around an item's text and confidence indicator.
 * @csspart item-text - The item's `text`.
 * @csspart confidence - The item's confidence tier text, carrying `data-tone`. Omitted when
 * `confidence` is unset.
 * @csspart expand-toggle - The provenance disclosure toggle. Omitted when `provenance` is unset.
 * @csspart item-body - The disclosed `lr-provenance-panel` wrapper, `hidden` while collapsed.
 * Omitted when `provenance` is unset.
 * @csspart item-actions - The wrapper around an item's action row (or its pending `lr-confirm-bar`).
 * @csspart add-button - The "Add to long-term memory" action. Only rendered on short-term items.
 * @csspart remove-button - The "Remove" action. Rendered on every item.
 * @csspart forget-all-button - The long-term section's bulk "Forget all" action. Only rendered
 * while `longTerm` is non-empty.
 * @cssprop [--lr-memory-panel-confidence-success-color=var(--lr-color-success)] - Text color for a
 * high-confidence item's confidence indicator.
 * @cssprop [--lr-memory-panel-confidence-warning-color=var(--lr-color-warning)] - Text color for a
 * medium-confidence item's confidence indicator.
 * @cssprop [--lr-memory-panel-confidence-danger-color=var(--lr-color-danger)] - Text color for a
 * low-confidence item's confidence indicator.
 */
export class LyraMemoryPanel extends LyraElement<LyraMemoryPanelEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Ephemeral, working-context items. Controlled and never mutated by this component. */
  @property({ attribute: false }) shortTerm: LyraMemoryItem[] = [];

  /** Persisted memories. Controlled and never mutated by this component. */
  @property({ attribute: false }) longTerm: LyraMemoryItem[] = [];

  /** `lr-provenance-panel` `types` pass-through, forwarded verbatim to every expanded item's panel. */
  @property({ attribute: false }) types: NodeTypeStyle[] = [];

  /** Confidence-tier and (forwarded) provenance relevance-tier boundaries. */
  @property({ attribute: false }) thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 };

  /** Overall accessible label override. */
  @property() label = '';

  @state() private expandedIds = new Set<string>();
  @state() private pending: PendingAction | null = null;

  private readonly idBase = nextId('memory-panel');

  private tier(score: number): Tier {
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  private toggleExpand(item: LyraMemoryItem): void {
    const next = new Set(this.expandedIds);
    const expanded = !next.has(item.id);
    if (expanded) next.add(item.id);
    else next.delete(item.id);
    this.expandedIds = next;
    this.emit<LyraMemoryExpandDetail>('lr-expand', { id: item.id, expanded });
  }

  private startItemPending(kind: 'add' | 'remove', item: LyraMemoryItem, scope: MemoryScope): void {
    this.pending = { kind, item, scope };
  }

  private startForgetAllPending(): void {
    this.pending = { kind: 'forget-all' };
  }

  private refocus(selector: string): void {
    void this.updateComplete.then(() => {
      (this.renderRoot.querySelector(selector) as HTMLElement | null)?.focus();
    });
  }

  private resolveItemDecision(p: ItemPending, approved: boolean): void {
    this.pending = null;
    if (approved) {
      if (p.kind === 'add') this.emit<LyraMemoryAddDetail>('lr-add', { item: p.item });
      else this.emit<LyraMemoryRemoveDetail>('lr-remove', { id: p.item.id, scope: p.scope });
    }
    this.refocus(`[part="item"][data-id="${p.item.id}"]`);
  }

  private resolveForgetAllDecision(approved: boolean): void {
    this.pending = null;
    if (approved) this.emit<undefined>('lr-forget');
    this.refocus('[part="forget-all-button"]');
  }

  private renderConfidence(item: LyraMemoryItem): TemplateResult | typeof nothing {
    if (item.confidence == null) return nothing;
    const tier = this.tier(item.confidence);
    return html`<span part="confidence" data-tone=${TIER_TONE[tier]}>${this.localize(TIER_LABEL_KEY[tier])}</span>`;
  }

  private renderItemConfirm(p: ItemPending): TemplateResult {
    return html`
      <lr-confirm-bar
        tone=${p.kind === 'add' ? ('neutral' as ConfirmBarTone) : ('danger' as ConfirmBarTone)}
        heading=${this.localize(CONFIRM_HEADING_KEY[p.kind])}
        @lr-approve=${(e: CustomEvent) => {
          e.stopPropagation();
          this.resolveItemDecision(p, true);
        }}
        @lr-deny=${(e: CustomEvent) => {
          e.stopPropagation();
          this.resolveItemDecision(p, false);
        }}
        >${p.item.text}</lr-confirm-bar
      >
    `;
  }

  private renderItem(item: LyraMemoryItem, scope: MemoryScope): TemplateResult {
    const itemPending = this.pending && this.pending.kind !== 'forget-all' && this.pending.item.id === item.id ? this.pending : null;
    const expanded = this.expandedIds.has(item.id);
    const bodyId = `${this.idBase}-${item.id}`;

    return html`
      <div part="item" role="listitem" data-id=${item.id} data-scope=${scope} tabindex="-1">
        <div part="item-row">
          <p part="item-text">${item.text}</p>
          ${this.renderConfidence(item)}
        </div>
        ${item.provenance
          ? html`
              <button
                part="expand-toggle"
                type="button"
                aria-expanded=${expanded ? 'true' : 'false'}
                aria-controls=${bodyId}
                @click=${() => this.toggleExpand(item)}
              >
                ${this.localize(expanded ? 'showLess' : 'showMore')}
              </button>
            `
          : nothing}
        <div part="item-actions">
          ${itemPending
            ? this.renderItemConfirm(itemPending)
            : html`
                ${scope === 'short-term'
                  ? html`
                      <button
                        part="add-button"
                        type="button"
                        aria-label=${this.localize('memoryPanelAddWithContext', undefined, { label: item.text })}
                        @click=${() => this.startItemPending('add', item, scope)}
                      >
                        ${this.localize('memoryPanelAdd')}
                      </button>
                    `
                  : nothing}
                <button
                  part="remove-button"
                  type="button"
                  aria-label=${this.localize('removeWithContext', undefined, { label: item.text })}
                  @click=${() => this.startItemPending('remove', item, scope)}
                >
                  ${this.localize('remove')}
                </button>
              `}
        </div>
        ${item.provenance
          ? html`
              <div part="item-body" id=${bodyId} ?hidden=${!expanded}>
                <lr-provenance-panel .provenance=${item.provenance} .types=${this.types} .thresholds=${this.thresholds}></lr-provenance-panel>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderForgetAllControl(): TemplateResult {
    const forgetPending = this.pending?.kind === 'forget-all' ? this.pending : null;
    if (forgetPending) {
      return html`
        <lr-confirm-bar
          tone="danger"
          heading=${this.localize('memoryPanelConfirmForgetHeading')}
          @lr-approve=${(e: CustomEvent) => {
            e.stopPropagation();
            this.resolveForgetAllDecision(true);
          }}
          @lr-deny=${(e: CustomEvent) => {
            e.stopPropagation();
            this.resolveForgetAllDecision(false);
          }}
          >${this.localize('memoryPanelConfirmForgetBody', undefined, { count: this.longTerm.length })}</lr-confirm-bar
        >
      `;
    }
    return html`
      <button part="forget-all-button" type="button" @click=${() => this.startForgetAllPending()}>
        ${this.localize('memoryPanelForgetAll')}
      </button>
    `;
  }

  private renderSection(scope: MemoryScope, headingKey: string, items: LyraMemoryItem[]): TemplateResult {
    const headingId = `${this.idBase}-${scope}-heading`;
    return html`
      <section part="section" data-scope=${scope}>
        <div part="section-header">
          <h3 part="heading" id=${headingId}>${this.localize(headingKey)}</h3>
          ${scope === 'long-term' && this.longTerm.length > 0 ? this.renderForgetAllControl() : nothing}
        </div>
        ${items.length === 0
          ? html`<p part="section-empty">${this.localize('noData')}</p>`
          : html`<div part="list" role="list" aria-labelledby=${headingId}>${items.map((item) => this.renderItem(item, scope))}</div>`}
      </section>
    `;
  }

  override render(): TemplateResult {
    const allEmpty = this.shortTerm.length === 0 && this.longTerm.length === 0;
    const groupLabel = this.getAttribute('aria-label') || this.label || this.localize('memoryPanelLabel');

    if (allEmpty) {
      return html`<div part="base" aria-label=${groupLabel}><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
    }

    return html`
      <div part="base" role="group" aria-label=${groupLabel}>
        ${this.renderSection('short-term', 'memoryPanelShortTermHeading', this.shortTerm)}
        ${this.renderSection('long-term', 'memoryPanelLongTermHeading', this.longTerm)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-memory-panel': LyraMemoryPanel;
  }
}
