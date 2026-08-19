import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { expandIcon } from '../../../internal/icons.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  getCollator,
  getListFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraVirtualListGroup } from '../../layout/virtual-list/virtual-list.class.js';
import '../../layout/virtual-list/virtual-list.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './neighbor-list.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_neighborDirectionBoth, LYRA_DEFAULT_neighborDirectionIn, LYRA_DEFAULT_neighborDirectionOut, LYRA_DEFAULT_neighborExpand, LYRA_DEFAULT_neighborGroupHeader, LYRA_DEFAULT_neighborListEmpty, LYRA_DEFAULT_neighborListLabel, LYRA_DEFAULT_neighborRowLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraNeighborRow {
  /** Edge label, e.g. `'works_for'`. */
  relation: string;
  direction: 'in' | 'out' | 'both';
  node: LyraEntity;
}

export interface LyraNeighborListEventMap {
  /** Canonical name for the "user picked this entity" gesture. */
  'lr-entity-select': CustomEvent<{ entityId: string }>;
  /** Deliberately the *same name and detail* as the `lr-graph` event, so one host handler
   *  serves both ("expand this node's neighborhood"). */
  'lr-node-expand': CustomEvent<{ nodeId: string }>;
}

/**
 * `<lr-neighbor-list>` — one entity's relationship rows: relation, direction, neighbor, with
 * per-row navigate and expand-in-graph affordances. Never computes neighbors itself (the host
 * derives rows from its own graph data) and never mutates a graph.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-neighbor-list
 * @event lr-entity-select - A row's node button was activated. `detail: { entityId }`.
 * @event lr-node-expand - A row's expand button was activated (only rendered when `expandable`).
 * `detail: { nodeId }`.
 * @csspart base - The stable root wrapper across empty, populated and virtualized states. It owns
 *   `role="group"` and the fallback name unless a non-empty host `aria-label` owns the component;
 *   a nested list owns the row semantics in non-virtualized mode.
 * @csspart group-header - A relation group header, only rendered when `groupByRelation`. Above
 *   `virtualizeAt` this is the internal virtual-list's own group label, re-exported under the same
 *   name so both paths present identically.
 * @csspart row - One relationship row (`role="listitem"`). Above `virtualizeAt` this is the
 *   internal virtual-list's own row wrapper, re-exported under the same name.
 * @csspart direction - The `aria-hidden` direction glyph.
 * @csspart relation - The relation text.
 * @csspart node-label - The row's node `<button>`.
 * @csspart node-meta - Secondary node text (type/degree), when present.
 * @csspart expand-button - The per-row expand-in-graph icon button, only rendered when `expandable`.
 * @csspart empty - The empty-state message, shown when `rows` is empty.
 * @status stable
 * @since 4.0.0
 */
export class LyraNeighborList extends LyraElement<LyraNeighborListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    neighborDirectionBoth: LYRA_DEFAULT_neighborDirectionBoth,
    neighborDirectionIn: LYRA_DEFAULT_neighborDirectionIn,
    neighborDirectionOut: LYRA_DEFAULT_neighborDirectionOut,
    neighborExpand: LYRA_DEFAULT_neighborExpand,
    neighborGroupHeader: LYRA_DEFAULT_neighborGroupHeader,
    neighborListEmpty: LYRA_DEFAULT_neighborListEmpty,
    neighborListLabel: LYRA_DEFAULT_neighborListLabel,
    neighborRowLabel: LYRA_DEFAULT_neighborRowLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['rows']);

  static override styles = [LyraElement.styles, styles];

  /** Neighbor relationships to render, including direction, relation, and target node data. */
  @property({ attribute: false }) rows: readonly LyraNeighborRow[] = [];
  /** Stable-sorts rows by relation and renders one group header per relation with a count. */
  @property({ type: Boolean, attribute: 'group-by-relation' }) groupByRelation =
    false;
  /** Shows a per-row expand icon-button emitting `lr-node-expand`. */
  @property({ type: Boolean }) expandable = false;
  /** Above this row count the list renders through an internal `lr-virtual-list`. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 100;
  /** Accessible name for the stable group when the host has no `aria-label`; falls back to the
   *  localized `neighborListLabel` default when omitted. An explicitly empty host label stays
   *  empty, and so does an explicitly empty `label`. */
  @property() label?: string;

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the property's
   *  own default of `100`) -- a raw `NaN` (e.g. an invalid `virtualize-at` attribute) would
   *  otherwise make `sorted.length > virtualizeAt` always false, silently disabling
   *  virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 100);
  }

  private sortedRows(): readonly LyraNeighborRow[] {
    const rows = firstByRetrievalIdentity(this.rows, (row) => row?.node?.id);
    if (!this.groupByRelation) return rows;
    // Array.prototype.sort is spec-guaranteed stable (ES2019+) -- rows sharing a relation keep
    // their original relative order.
    return rows.sort((a, b) =>
      getCollator(this.effectiveLocale).compare(a.relation, b.relation)
    );
  }

  private groups(sorted: readonly LyraNeighborRow[]): LyraVirtualListGroup[] | undefined {
    if (!this.groupByRelation) return undefined;
    const groups: LyraVirtualListGroup[] = [];
    const counts = new Map<string, number>();
    for (const row of sorted)
      counts.set(row.relation, (counts.get(row.relation) ?? 0) + 1);
    const numberFormat = getNumberFormat(this.effectiveLocale);
    let lastRelation: string | undefined;
    sorted.forEach((row, i) => {
      if (row.relation !== lastRelation) {
        const count = numberFormat.format(counts.get(row.relation) ?? 0);
        groups.push({
          key: row.relation,
          label: this.localize('neighborGroupHeader', undefined, {
            relation: row.relation,
            count,
          }),
          startIndex: i,
        });
        lastRelation = row.relation;
      }
    });
    return groups;
  }

  /** The arrow encodes the graph edge's actual direction (outgoing vs incoming) -- real semantic
   *  data about which entity points to which -- so its meaning must stay fixed regardless of
   *  reading direction; it is never derived from `isRtl()`. Only the row's overall layout (icon
   *  position, text order) mirrors under RTL, and it already does so for free via this row's
   *  inline-axis flex flow (`neighbor-list.styles.ts`'s `[part='row']` rule) -- no code here needs
   *  to reason about direction at all. See docs/agents/i18n-rtl-theming.md: "directional glyphs
   *  mirror via the wrapping part, not the icon." */
  private directionGlyph(direction: LyraNeighborRow['direction']): string {
    if (direction === 'both') return '↔';
    return direction === 'out' ? '→' : '←';
  }

  private directionText(direction: LyraNeighborRow['direction']): string {
    return this.localize(
      direction === 'in'
        ? 'neighborDirectionIn'
        : direction === 'out'
        ? 'neighborDirectionOut'
        : 'neighborDirectionBoth'
    );
  }

  private renderRow = (item: unknown): TemplateResult =>
    this.renderNeighborRow(item as LyraNeighborRow);

  /** Returns only a row's *content*, not its surrounding `role="listitem"`/`part="row"` wrapper:
   *  `<lr-virtual-list>` already supplies exactly such a wrapper (exported from here as `row`) for
   *  every virtualized row, and a second nested one would both duplicate the `listitem` role and
   *  be matched a second time by `lr-virtual-list::part(row)` -- `::part()` uses `part~=` semantics
   *  and reaches any depth of the target shadow tree -- doubling the row's padding and divider
   *  border. The non-virtualized path below supplies the identical wrapper itself. */
  private renderNeighborRow(row: LyraNeighborRow): TemplateResult {
    const nodeLabel = row.node.label || row.node.id;
    const directionText = this.directionText(row.direction);
    const accessibleName = this.localize('neighborRowLabel', undefined, {
      label: nodeLabel,
      relation: row.relation,
      direction: directionText,
    });
    const meta = [
      row.node.type,
      row.node.degree != null
        ? getNumberFormat(this.effectiveLocale).format(
            finiteCount(row.node.degree)
          )
        : undefined,
    ].filter((v): v is string => !!v);
    const metaText = getListFormat(this.effectiveLocale, {
      style: 'short',
      type: 'unit',
    }).format(meta);
    return html`
      <button
        part="node-label"
        type="button"
        aria-label=${accessibleName}
        aria-description=${metaText || nothing}
        @click=${() => {
          this.emit('lr-entity-select', { entityId: row.node.id });
        }}
      >
        <span part="direction" aria-hidden="true"
          >${this.directionGlyph(row.direction)}</span
        >
        <span part="relation">${row.relation}</span>
        <span>${nodeLabel}</span>
        ${metaText ? html`<span part="node-meta">${metaText}</span>` : nothing}
      </button>
      ${this.expandable
        ? html`<button
            part="expand-button"
            type="button"
            aria-label=${this.localize('neighborExpand', undefined, {
              label: nodeLabel,
            })}
            @click=${() => this.emit('lr-node-expand', { nodeId: row.node.id })}
          >
            ${expandIcon()}
          </button>`
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const sorted = this.sortedRows();
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('neighborListLabel') : this.label
    );
    const role = retrievalSemanticRole(this, 'group');
    if (sorted.length === 0) {
      // `heading` is passed as slotted light-DOM content (rather than the `heading` attribute)
      // so `[part="empty"]`'s `.textContent` -- a plain DOM accessor, which never pierces
      // `lr-empty`'s own shadow root -- actually includes the message; see
      // `<lr-chunk-inspector>`'s identical pattern/comment for the same reasoning.
      return html`<div
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        <lr-empty part="empty"
          ><span slot="heading"
            >${this.localize('neighborListEmpty')}</span
          ></lr-empty
        >
      </div>`;
    }
    if (sorted.length > this.effectiveVirtualizeAt) {
      return html`
        <div
          part="base"
          role=${role ?? nothing}
          aria-label=${label ?? nothing}
        >
          <lr-virtual-list
            exportparts="row:row, node-label:node-label, direction:direction, relation:relation, node-meta:node-meta, expand-button:expand-button, group:group-header"
            .items=${sorted}
            .renderItem=${this.renderRow}
            .keyFunction=${(item: unknown) => (item as LyraNeighborRow).node.id}
            .groups=${this.groups(sorted)}
          ></lr-virtual-list>
        </div>
      `;
    }
    const groups = this.groups(sorted);
    // Looked up once per row below -- indexing by startIndex up front keeps the render O(rows +
    // groups) instead of rescanning the whole `groups` array (O(groups)) for every row
    // (O(rows x groups), worst-case O(n^2) since groups can scale with distinct relations up to
    // one per row).
    const groupsByStartIndex = new Map(
      groups?.map((g) => [g.startIndex, g]) ?? []
    );
    return html`
      <div
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        <div role="list">
          ${sorted.map((row, i) => {
            const group = groupsByStartIndex.get(i);
            // `role="presentation"` (not `role="heading"`) -- ARIA's `list` role only owns
            // `listitem` children, so an explicit `heading` role here would be a disallowed child
            // (same convention as `<lr-node-palette>`'s identical category-header part).
            return html`${group
                ? html`<div part="group-header" role="presentation">
                    ${group.label}
                  </div>`
                : nothing}
              <div part="row" role="listitem">
                ${this.renderNeighborRow(row)}
              </div>`;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-neighbor-list': LyraNeighborList;
  }
}
