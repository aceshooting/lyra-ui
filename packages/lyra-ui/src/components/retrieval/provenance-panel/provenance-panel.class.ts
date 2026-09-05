import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type {
  LyraPathElement,
  LyraPathStripEventMap,
} from '../path-strip/path-strip.class.js';
import type {
  LyraCommunity,
  LyraCommunityCardEventMap,
} from '../community-card/community-card.class.js';
import type {
  LyraChunk,
  LyraChunkInspectorEventMap,
} from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraEntityChipEventMap } from '../entity-chip/entity-chip.class.js';
import '../entity-chip/entity-chip.class.js';
import '../path-strip/path-strip.class.js';
import '../community-card/community-card.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './provenance-panel.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
export type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import type { LyraScoreThresholds } from '../graph/graph.class.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_provenanceChunks, LYRA_DEFAULT_provenanceCommunities, LYRA_DEFAULT_provenanceEmpty, LYRA_DEFAULT_provenanceEntities, LYRA_DEFAULT_provenancePanelLabel, LYRA_DEFAULT_provenanceRelationships, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraProvenance {
  readonly entities?: readonly LyraEntity[];
  /** One `lr-path-strip` row each. */
  readonly relationships?: readonly Readonly<{
    path: readonly LyraPathElement[];
  }>[];
  readonly communities?: readonly LyraCommunity[];
  readonly chunks?: readonly LyraChunk[];
}

type Section = 'entities' | 'relationships' | 'communities' | 'chunks';

/** The panel is a conduit, so its event map is the union of every affordance it renders: its own
 *  section toggle plus the entity chips', community cards', path strips', and chunk inspector's
 *  events, all of which are `composed` and therefore reach a host listener on
 *  `<lr-provenance-panel>` itself. Declaring only `lr-toggle` typed those controls out of existence
 *  for anyone building handlers off this type. */
export interface LyraProvenancePanelEventMap
  extends Omit<LyraCommunityCardEventMap, 'lr-entity-activate'>,
    Omit<LyraEntityChipEventMap, 'lr-entity-select'>,
    Omit<LyraPathStripEventMap, 'lr-entity-activate'>,
    LyraChunkInspectorEventMap {
  /** Canonical name for the "user picked this entity" gesture, surfaced unchanged from an
   *  embedded entity chip. No composed child emits this with an `occurrenceIndex` (only the
   *  community card and the relationship path strip's own `lr-entity-activate` do), so unlike
   *  those this stays the plain shape. */
  'lr-entity-select': CustomEvent<{ entityId: string }>;
  'lr-entity-activate': CustomEvent<{
    entityId: string;
    occurrenceIndex?: number;
  }>;
  'lr-toggle': CustomEvent<{ section: Section; expanded: boolean }>;
}

/**
 * `<lr-provenance-panel>` — the grounding breakdown for one answer: a sectioned disclosure
 * panel (Entities / Relationships / Communities / Text chunks) composing this family's own pieces.
 * The chat <-> graph <-> document glue component. Pure projection + event conduit: no fetching, no
 * graph/viewer imports, no persistence.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-provenance-panel
 * @event lr-toggle - A section header was toggled. `detail: { section, expanded }`.
 * @event lr-entity-select - Surfaced unchanged from an embedded entity chip.
 *   `detail: { entityId }`.
 * @event lr-entity-activate - Surfaced unchanged from an embedded community card or relationship
 *   path strip. `detail: { entityId, occurrenceIndex? }`.
 * @event lr-entity-open - Surfaced unchanged from an embedded entity chip (double-click, or Space
 *   while focused). `detail: { entityId }`.
 * @event lr-drill - Surfaced unchanged from an embedded community card's title, drill button, or
 *   overflow chip. `detail: { communityId }`.
 * @event lr-relation-activate - Surfaced unchanged from an embedded relationship path strip's edge.
 *   `detail: { relation, sourceNodeId?, targetNodeId?, occurrenceIndex }`.
 * @event lr-chunk-open - Surfaced unchanged from an embedded chunk inspector.
 *   `detail: { chunkId, sourceId, anchor? }`.
 * @event lr-expand - Surfaced unchanged from an embedded chunk inspector.
 *   `detail: { chunkId, expanded }`.
 * @csspart base - The root wrapper.
 * @csspart section - One section's wrapper.
 * @csspart header - A section's disclosure `<button>`.
 * @csspart count - A section's item-count badge.
 * @csspart body - A section's content wrapper, `hidden` while collapsed.
 * @csspart entity-row - The wrapping row of entity chips inside the entities section. Style this to
 *   change how the chip lines pack (`justify-content`, `row-gap`).
 * @csspart empty - The empty state, shown when every section is empty.
 * @cssprop [--lr-provenance-panel-entity-justify=flex-start] - Main-axis packing of the entity-chip
 *   row. `center` centers every line, the wrapped final one included.
 * @status stable
 * @since 4.0.0
 */
export class LyraProvenancePanel extends LyraElement<LyraProvenancePanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    provenanceChunks: LYRA_DEFAULT_provenanceChunks,
    provenanceCommunities: LYRA_DEFAULT_provenanceCommunities,
    provenanceEmpty: LYRA_DEFAULT_provenanceEmpty,
    provenanceEntities: LYRA_DEFAULT_provenanceEntities,
    provenancePanelLabel: LYRA_DEFAULT_provenancePanelLabel,
    provenanceRelationships: LYRA_DEFAULT_provenanceRelationships,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'provenance',
    'types',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** Provenance model whose entity, relationship, community, and chunk sections are rendered. */
  @property({ attribute: false }) provenance: Readonly<LyraProvenance> | null =
    null;
  /** `lr-graph` `nodeTypes` pass-through; resolves each `entity.type` for the entity chips' `typeLabel`.
   *  Malformed type rows are ignored so later valid matching records remain available. */
  @property({ attribute: false }) types: readonly LyraNodeTypeStyle[] = [];
  /** Score boundaries forwarded to the composed chunk inspector. */
  @property({ attribute: false }) thresholds: LyraScoreThresholds = {
    high: 0.75,
    medium: 0.5,
  };
  /** Fallback name for the provenance group, used when omitted; falls back to the localized
   *  `provenancePanelLabel`. A non-empty host `aria-label` makes the host the sole overall owner;
   *  an explicitly empty host label stays empty on the group, and so does an explicitly empty
   *  `label`. */
  @property() label?: string;

  @state() private expandedSections: Record<Section, boolean> = {
    entities: true,
    relationships: true,
    communities: true,
    chunks: true,
  };

  private readonly sectionIdBase = nextId('provenance-panel');

  private toggleSection(section: Section): void {
    const expanded = !this.expandedSections[section];
    this.expandedSections = { ...this.expandedSections, [section]: expanded };
    this.emit('lr-toggle', { section, expanded });
  }

  private renderSection(
    section: Section,
    titleKey: LyraMessageKey,
    count: number,
    body: TemplateResult
  ) {
    if (count === 0) return nothing;
    const expanded = this.expandedSections[section];
    const bodyId = `${this.sectionIdBase}-${section}`;
    return html`
      <div part="section">
        <button
          part="header"
          type="button"
          aria-expanded=${expanded ? 'true' : 'false'}
          aria-controls=${bodyId}
          @click=${() => this.toggleSection(section)}
        >
          <span>${this.localize(titleKey)}</span>
          <span part="count"
            >${getNumberFormat(this.effectiveLocale).format(count)}</span
          >
        </button>
        <div part="body" id=${bodyId} ?hidden=${!expanded}>${body}</div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const p = this.provenance;
    const entities = firstByRetrievalIdentity(
      Array.isArray(p?.entities) ? p.entities : [],
      (entity) => entity?.id
    );
    const relationships = (
      Array.isArray(p?.relationships) ? p.relationships : []
    ).filter(
      (
        relationship
      ): relationship is Readonly<{ path: readonly LyraPathElement[] }> =>
        relationship !== null &&
        typeof relationship === 'object' &&
        Array.isArray(relationship.path)
    );
    const communities = firstByRetrievalIdentity(
      Array.isArray(p?.communities) ? p.communities : [],
      (community) => community?.id
    );
    const chunks = firstByRetrievalIdentity(
      Array.isArray(p?.chunks) ? p.chunks : [],
      (chunk) => chunk?.id
    );
    const allEmpty =
      entities.length === 0 &&
      relationships.length === 0 &&
      communities.length === 0 &&
      chunks.length === 0;
    const groupLabel = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('provenancePanelLabel') : this.label
    );
    const groupRole = retrievalSemanticRole(this, 'group');

    if (!p || allEmpty) {
      return html`<div
        part="base"
        role=${groupRole ?? nothing}
        aria-label=${groupLabel ?? nothing}
      >
        <lr-empty
          part="empty"
          heading=${this.localize('provenanceEmpty')}
        ></lr-empty>
      </div>`;
    }

    return html`
      <div
        part="base"
        role=${groupRole ?? nothing}
        aria-label=${groupLabel ?? nothing}
      >
        ${this.renderSection(
          'entities',
          'provenanceEntities',
          entities.length,
          html`<div part="entity-row" class="entity-row">
            ${entities.map((entity) => {
              const typeLabel =
                firstByRetrievalIdentity(this.types, (type) => type?.id)
                  .find((type) => type.id === entity.type)?.label ??
                entity.type ??
                '';
              return html`<lr-entity-chip
                entity-id=${entity.id}
                text=${entity.label}
                type=${entity.type ?? ''}
                type-label=${typeLabel}
              ></lr-entity-chip>`;
            })}
          </div>`
        )}
        ${this.renderSection(
          'relationships',
          'provenanceRelationships',
          relationships.length,
          html`<div>
            ${relationships.map(
              (r) => html`<lr-path-strip .path=${r.path}></lr-path-strip>`
            )}
          </div>`
        )}
        ${this.renderSection(
          'communities',
          'provenanceCommunities',
          communities.length,
          html`<div>
            ${communities.map(
              (c) =>
                html`<lr-community-card
                  compact
                  .community=${c}
                ></lr-community-card>`
            )}
          </div>`
        )}
        ${this.renderSection(
          'chunks',
          'provenanceChunks',
          chunks.length,
          html`<lr-chunk-inspector
            compact
            .chunks=${chunks}
            .thresholds=${this.thresholds}
          ></lr-chunk-inspector>`
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-provenance-panel': LyraProvenancePanel;
  }
}
