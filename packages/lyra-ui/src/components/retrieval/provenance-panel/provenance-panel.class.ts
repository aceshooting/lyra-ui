import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraPathElement, LyraPathStripEventMap } from '../path-strip/path-strip.class.js';
import type { LyraCommunity, LyraCommunityCardEventMap } from '../community-card/community-card.class.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraEntityChipEventMap } from '../entity-chip/entity-chip.class.js';
import '../entity-chip/entity-chip.class.js';
import '../path-strip/path-strip.class.js';
import '../community-card/community-card.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './provenance-panel.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_provenanceChunks, LYRA_DEFAULT_provenanceCommunities, LYRA_DEFAULT_provenanceEmpty, LYRA_DEFAULT_provenanceEntities, LYRA_DEFAULT_provenancePanelLabel, LYRA_DEFAULT_provenanceRelationships, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraProvenance {
  entities?: LyraEntity[];
  /** One `lr-path-strip` row each. */
  relationships?: { path: LyraPathElement[] }[];
  communities?: LyraCommunity[];
  chunks?: LyraChunk[];
}

type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

type Section = 'entities' | 'relationships' | 'communities' | 'chunks';

/** The panel is a conduit, so its event map is the union of every affordance it renders: its own
 *  section toggle plus the entity chips', community cards' and path strips' events, all of which
 *  are `composed` and therefore reach a host listener on `<lr-provenance-panel>` itself. Declaring
 *  only `lr-toggle` typed those controls out of existence for anyone building handlers off this
 *  type. */
export interface LyraProvenancePanelEventMap
  extends LyraCommunityCardEventMap,
    LyraEntityChipEventMap,
    LyraPathStripEventMap {
  'lr-toggle': CustomEvent<{ section: Section; expanded: boolean }>;
}

/**
 * `<lr-provenance-panel>` — the grounding breakdown for one answer: a sectioned disclosure
 * panel (Entities / Relationships / Communities / Text chunks) composing this family's own pieces.
 * The chat <-> graph <-> document glue component. Pure projection + event conduit: no fetching, no
 * graph/viewer imports, no persistence.
 *
 * @customElement lr-provenance-panel
 * @event lr-toggle - A section header was toggled. `detail: { section, expanded }`.
 * @event lr-entity-activate - Surfaced unchanged from an embedded entity chip, community card, or
 *   relationship path strip. `detail: { id }`.
 * @event lr-entity-open - Surfaced unchanged from an embedded entity chip (double-click, or Space
 *   while focused). `detail: { id }`.
 * @event lr-drill - Surfaced unchanged from an embedded community card's title, drill button, or
 *   overflow chip. `detail: { id }`.
 * @event lr-relation-activate - Surfaced unchanged from an embedded relationship path strip's edge.
 *   `detail: { relation, sourceId, targetId }`.
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
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    provenanceChunks: LYRA_DEFAULT_provenanceChunks,
    provenanceCommunities: LYRA_DEFAULT_provenanceCommunities,
    provenanceEmpty: LYRA_DEFAULT_provenanceEmpty,
    provenanceEntities: LYRA_DEFAULT_provenanceEntities,
    provenancePanelLabel: LYRA_DEFAULT_provenancePanelLabel,
    provenanceRelationships: LYRA_DEFAULT_provenanceRelationships,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) provenance: LyraProvenance | null = null;
  /** `lr-graph` `nodeTypes` pass-through; resolves each `entity.type` for the entity chips' `typeLabel`. */
  @property({ attribute: false }) types: NodeTypeStyle[] = [];
  @property({ attribute: false }) thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 };
  @property() label = '';

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

  private renderSection(section: Section, titleKey: LyraMessageKey, count: number, body: TemplateResult) {
    if (count === 0) return nothing;
    const expanded = this.expandedSections[section];
    const bodyId = `${this.sectionIdBase}-${section}`;
    return html`
      <div part="section">
        <button part="header" type="button" aria-expanded=${expanded ? 'true' : 'false'} aria-controls=${bodyId} @click=${() => this.toggleSection(section)}>
          <span>${this.localize(titleKey)}</span>
          <span part="count">${getNumberFormat(this.effectiveLocale).format(count)}</span>
        </button>
        <div part="body" id=${bodyId} ?hidden=${!expanded}>${body}</div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const p = this.provenance;
    const entities = p?.entities ?? [];
    const relationships = p?.relationships ?? [];
    const communities = p?.communities ?? [];
    const chunks = p?.chunks ?? [];
    const allEmpty = entities.length === 0 && relationships.length === 0 && communities.length === 0 && chunks.length === 0;
    const groupLabel = this.getAttribute('aria-label') || this.label || this.localize('provenancePanelLabel');

    if (!p || allEmpty) {
      return html`<div part="base" aria-label=${groupLabel}><lr-empty part="empty" heading=${this.localize('provenanceEmpty')}></lr-empty></div>`;
    }

    return html`
      <div part="base" role="group" aria-label=${groupLabel}>
        ${this.renderSection(
          'entities',
          'provenanceEntities',
          entities.length,
          html`<div part="entity-row" class="entity-row">
            ${entities.map((entity) => {
              const typeLabel = this.types.find((t) => t.id === entity.type)?.label ?? entity.type ?? '';
              return html`<lr-entity-chip entity-id=${entity.id} label=${entity.label} type=${entity.type ?? ''} type-label=${typeLabel}></lr-entity-chip>`;
            })}
          </div>`,
        )}
        ${this.renderSection(
          'relationships',
          'provenanceRelationships',
          relationships.length,
          html`<div>${relationships.map((r) => html`<lr-path-strip .path=${r.path}></lr-path-strip>`)}</div>`,
        )}
        ${this.renderSection(
          'communities',
          'provenanceCommunities',
          communities.length,
          html`<div>${communities.map((c) => html`<lr-community-card compact .community=${c}></lr-community-card>`)}</div>`,
        )}
        ${this.renderSection(
          'chunks',
          'provenanceChunks',
          chunks.length,
          html`<lr-chunk-inspector compact .chunks=${chunks} .thresholds=${this.thresholds}></lr-chunk-inspector>`,
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
