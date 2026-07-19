import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { expandIcon } from '../../../internal/icons.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { VirtualListGroup } from '../../layout/virtual-list/virtual-list.class.js';
import '../../layout/virtual-list/virtual-list.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './neighbor-list.styles.js';

export interface LyraNeighborRow {
  /** Edge label, e.g. `'works_for'`. */
  relation: string;
  direction: 'in' | 'out' | 'both';
  node: LyraEntity;
}

export interface LyraNeighborListEventMap {
  'lr-entity-activate': CustomEvent<{ id: string }>;
  /** Deliberately the *same name and detail* as the `lr-graph` event, so one host handler
   *  serves both ("expand this node's neighborhood"). */
  'lr-node-expand': CustomEvent<{ id: string }>;
}

/**
 * `<lr-neighbor-list>` — one entity's relationship rows: relation, direction, neighbor, with
 * per-row navigate and expand-in-graph affordances. Never computes neighbors itself (the host
 * derives rows from its own graph data) and never mutates a graph.
 *
 * @customElement lr-neighbor-list
 * @event lr-entity-activate - A row's node button was activated. `detail: { id }`.
 * @event lr-node-expand - A row's expand button was activated (only rendered when `expandable`).
 * `detail: { id }`.
 * @csspart base - The root wrapper (`role="list"`).
 * @csspart group-header - A relation group header, only rendered when `groupByRelation`.
 * @csspart row - One relationship row (`role="listitem"`).
 * @csspart direction - The `aria-hidden` direction glyph.
 * @csspart relation - The relation text.
 * @csspart node-label - The row's node `<button>`.
 * @csspart node-meta - Secondary node text (type/degree), when present.
 * @csspart expand-button - The per-row expand-in-graph icon button, only rendered when `expandable`.
 * @csspart empty - The empty-state message, shown when `rows` is empty.
 */
export class LyraNeighborList extends LyraElement<LyraNeighborListEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) rows: LyraNeighborRow[] = [];
  /** Stable-sorts rows by relation and renders one group header per relation with a count. */
  @property({ type: Boolean, attribute: 'group-by-relation' }) groupByRelation = false;
  /** Shows a per-row expand icon-button emitting `lr-node-expand`. */
  @property({ type: Boolean }) expandable = false;
  /** Above this row count the list renders through an internal `lr-virtual-list`. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 100;
  /** Accessible name; falls back to the localized `neighborListLabel`. */
  @property() label = '';

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the property's
   *  own default of `100`) -- a raw `NaN` (e.g. an invalid `virtualize-at` attribute) would
   *  otherwise make `sorted.length > virtualizeAt` always false, silently disabling
   *  virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 100);
  }

  private sortedRows(): LyraNeighborRow[] {
    if (!this.groupByRelation) return this.rows;
    // Array.prototype.sort is spec-guaranteed stable (ES2019+) -- rows sharing a relation keep
    // their original relative order.
    return [...this.rows].sort((a, b) => a.relation.localeCompare(b.relation));
  }

  private groups(sorted: LyraNeighborRow[]): VirtualListGroup[] | undefined {
    if (!this.groupByRelation) return undefined;
    const groups: VirtualListGroup[] = [];
    let lastRelation: string | undefined;
    sorted.forEach((row, i) => {
      if (row.relation !== lastRelation) {
        const count = sorted.filter((r) => r.relation === row.relation).length;
        groups.push({
          key: row.relation,
          label: this.localize('neighborGroupHeader', undefined, { relation: row.relation, count }),
          startIndex: i,
        });
        lastRelation = row.relation;
      }
    });
    return groups;
  }

  private directionGlyph(direction: LyraNeighborRow['direction']): string {
    if (direction === 'both') return '↔';
    const rtl = isRtl(this);
    const pointsInlineEnd = direction === 'out';
    return pointsInlineEnd ? (rtl ? '←' : '→') : rtl ? '→' : '←';
  }

  private directionText(direction: LyraNeighborRow['direction']): string {
    return this.localize(
      direction === 'in' ? 'neighborDirectionIn' : direction === 'out' ? 'neighborDirectionOut' : 'neighborDirectionBoth',
    );
  }

  private renderRow = (item: unknown): TemplateResult => this.renderNeighborRow(item as LyraNeighborRow);

  private renderNeighborRow(row: LyraNeighborRow): TemplateResult {
    const nodeLabel = row.node.label || row.node.id;
    const directionText = this.directionText(row.direction);
    const accessibleName = this.localize('neighborRowLabel', undefined, {
      label: nodeLabel,
      relation: row.relation,
      direction: directionText,
    });
    const meta = [row.node.type, row.node.degree != null ? String(row.node.degree) : undefined]
      .filter((v): v is string => !!v)
      .join(' · ');
    return html`
      <div part="row" role="listitem">
        <button part="node-label" type="button" aria-label=${accessibleName} @click=${() => this.emit('lr-entity-activate', { id: row.node.id })}>
          <span part="direction" aria-hidden="true">${this.directionGlyph(row.direction)}</span>
          <span part="relation">${row.relation}</span>
          <span>${nodeLabel}</span>
          ${meta ? html`<span part="node-meta">${meta}</span>` : nothing}
        </button>
        ${this.expandable
          ? html`<button
              part="expand-button"
              type="button"
              aria-label=${this.localize('neighborExpand', undefined, { label: nodeLabel })}
              @click=${() => this.emit('lr-node-expand', { id: row.node.id })}
            >
              ${expandIcon()}
            </button>`
          : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    const sorted = this.sortedRows();
    const label = this.label || this.localize('neighborListLabel');
    if (sorted.length === 0) {
      // `heading` is passed as slotted light-DOM content (rather than the `heading` attribute)
      // so `[part="empty"]`'s `.textContent` -- a plain DOM accessor, which never pierces
      // `lr-empty`'s own shadow root -- actually includes the message; see
      // `<lr-chunk-inspector>`'s identical pattern/comment for the same reasoning.
      return html`<div part="base">
        <lr-empty part="empty"><span slot="heading">${this.localize('neighborListEmpty')}</span></lr-empty>
      </div>`;
    }
    if (sorted.length > this.effectiveVirtualizeAt) {
      return html`
        <div part="base" role="group" aria-label=${label}>
          <lr-virtual-list
            .items=${sorted}
            .renderItem=${this.renderRow}
            .keyFunction=${(item: unknown) => (item as LyraNeighborRow).node.id}
            .groups=${this.groups(sorted)}
          ></lr-virtual-list>
        </div>
      `;
    }
    const groups = this.groups(sorted);
    return html`
      <div part="base" role="list" aria-label=${label}>
        ${sorted.map((row, i) => {
          const group = groups?.find((g) => g.startIndex === i);
          // `role="presentation"` (not `role="heading"`) -- ARIA's `list` role only owns
          // `listitem` children, so an explicit `heading` role here would be a disallowed child
          // (same convention as `<lr-node-palette>`'s identical category-header part).
          return html`${group ? html`<div part="group-header" role="presentation">${group.label}</div>` : nothing}${this.renderNeighborRow(row)}`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-neighbor-list': LyraNeighborList;
  }
}
