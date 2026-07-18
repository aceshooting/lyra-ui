import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import type { LyraMessageKey } from '../../internal/localization.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraPathElement } from '../path-strip/path-strip.class.js';
import type { LyraCommunity } from '../community-card/community-card.class.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import '../entity-chip/entity-chip.class.js';
import '../path-strip/path-strip.class.js';
import '../community-card/community-card.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import '../empty/empty.class.js';
import { styles } from './provenance-panel.styles.js';

export interface LyraProvenance {
  entities?: LyraEntity[];
  /** One `lyra-path-strip` row each. */
  relationships?: { path: LyraPathElement[] }[];
  communities?: LyraCommunity[];
  chunks?: LyraChunk[];
}

type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

type Section = 'entities' | 'relationships' | 'communities' | 'chunks';

export interface LyraProvenancePanelEventMap {
  'lyra-toggle': CustomEvent<{ section: Section; expanded: boolean }>;
}

/**
 * `<lyra-provenance-panel>` — the grounding breakdown for one answer: a sectioned disclosure
 * panel (Entities / Relationships / Communities / Text chunks) composing this family's own pieces.
 * The chat <-> graph <-> document glue component. Pure projection + event conduit: no fetching, no
 * graph/viewer imports, no persistence.
 *
 * @customElement lyra-provenance-panel
 * @event lyra-toggle - A section header was toggled. `detail: { section, expanded }`.
 * @csspart base - The root wrapper.
 * @csspart section - One section's wrapper.
 * @csspart header - A section's disclosure `<button>`.
 * @csspart count - A section's item-count badge.
 * @csspart body - A section's content wrapper, `hidden` while collapsed.
 * @csspart empty - The empty state, shown when every section is empty.
 */
export class LyraProvenancePanel extends LyraElement<LyraProvenancePanelEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) provenance: LyraProvenance | null = null;
  /** `lyra-graph` `nodeTypes` pass-through; resolves each `entity.type` for the entity chips' `typeLabel`. */
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
    this.emit('lyra-toggle', { section, expanded });
  }

  private renderSection(section: Section, titleKey: LyraMessageKey, count: number, body: TemplateResult) {
    if (count === 0) return nothing;
    const expanded = this.expandedSections[section];
    const bodyId = `${this.sectionIdBase}-${section}`;
    return html`
      <div part="section">
        <button part="header" type="button" aria-expanded=${expanded ? 'true' : 'false'} aria-controls=${bodyId} @click=${() => this.toggleSection(section)}>
          <span>${this.localize(titleKey)}</span>
          <span part="count">${count}</span>
        </button>
        <div part="body" id=${bodyId} ?hidden=${!expanded}>${body}</div>
      </div>
    `;
  }

  render(): TemplateResult {
    const p = this.provenance;
    const entities = p?.entities ?? [];
    const relationships = p?.relationships ?? [];
    const communities = p?.communities ?? [];
    const chunks = p?.chunks ?? [];
    const allEmpty = entities.length === 0 && relationships.length === 0 && communities.length === 0 && chunks.length === 0;
    const groupLabel = this.label || this.localize('provenancePanelLabel');

    if (!p || allEmpty) {
      return html`<div part="base" aria-label=${groupLabel}><lyra-empty part="empty" heading=${this.localize('provenanceEmpty')}></lyra-empty></div>`;
    }

    return html`
      <div part="base" role="group" aria-label=${groupLabel}>
        ${this.renderSection(
          'entities',
          'provenanceEntities',
          entities.length,
          html`<div class="entity-row">
            ${entities.map((entity) => {
              const typeLabel = this.types.find((t) => t.id === entity.type)?.label ?? entity.type ?? '';
              return html`<lyra-entity-chip entity-id=${entity.id} label=${entity.label} type=${entity.type ?? ''} type-label=${typeLabel}></lyra-entity-chip>`;
            })}
          </div>`,
        )}
        ${this.renderSection(
          'relationships',
          'provenanceRelationships',
          relationships.length,
          html`<div>${relationships.map((r) => html`<lyra-path-strip .path=${r.path}></lyra-path-strip>`)}</div>`,
        )}
        ${this.renderSection(
          'communities',
          'provenanceCommunities',
          communities.length,
          html`<div>${communities.map((c) => html`<lyra-community-card compact .community=${c}></lyra-community-card>`)}</div>`,
        )}
        ${this.renderSection(
          'chunks',
          'provenanceChunks',
          chunks.length,
          html`<lyra-chunk-inspector compact .chunks=${chunks} .thresholds=${this.thresholds}></lyra-chunk-inspector>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-provenance-panel': LyraProvenancePanel;
  }
}
