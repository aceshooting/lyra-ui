import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
export type { LyraEntity } from '../entity-card/entity-card.class.js';
import type {
  LyraNeighborListEventMap,
  LyraNeighborRow,
} from '../neighbor-list/neighbor-list.class.js';
export type { LyraNeighborRow } from '../neighbor-list/neighbor-list.class.js';
import type {
  LyraChunk,
  LyraChunkInspectorEventMap,
} from '../chunk-inspector/chunk-inspector.class.js';
export type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type {
  LyraProvenance,
  LyraProvenancePanelDisclosureDetail,
  LyraProvenancePanelEventMap,
} from '../provenance-panel/provenance-panel.class.js';
export type { LyraProvenance } from '../provenance-panel/provenance-panel.class.js';
import type { StatRow } from '../../data/stat/stat.class.js';
import type { LyraVariant } from '../../../internal/variants.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import type { LyraHeadingLevel } from '../../../internal/heading-level.js';
export type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import type { LyraTabGroupEventMap } from '../../layout/tab-group/tab-group.class.js';
import '../entity-card/entity-card.class.js';
import '../neighbor-list/neighbor-list.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import '../provenance-panel/provenance-panel.class.js';
import '../../data/stat/stat.class.js';
import '../../layout/tab-group/tab-group.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './entity-dossier.styles.js';
import type { LyraScoreThresholds } from '../../../internal/score-tiers.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chunkInspectorLabel, LYRA_DEFAULT_neighborListLabel, LYRA_DEFAULT_provenancePanelLabel } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_details, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The three tab ids this component renders -- also `lr-tab-group`' own `slot`/`tabId` values, so a
 *  `lr-tab-show` listener can switch on these literally. */
export type LyraEntityDossierTab = 'relationships' | 'chunks' | 'provenance';

/**
 * The headline confidence KPI shown next to the entity summary. Every field here is caller-supplied
 * domain data -- the same convention `lr-stat`'s own `label`/`value`/`caption`/`rows` already use
 * (a confidence metric's label is exactly as domain-specific as a "Revenue" or "Latency" stat's
 * label), so none of it routes through `localize()`.
 */
export interface LyraEntityDossierConfidence {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly variant?: LyraVariant;
  /** Exact value shown as a hover/focus tooltip on the headline value -- see `lr-stat.exactValue`. */
  readonly exactValue?: string;
  readonly caption?: string;
  /** Breakdown rows (e.g. per-signal sub-scores) -- see `lr-stat.rows`. */
  readonly rows?: readonly StatRow[];
}

export interface LyraEntityDossierEventMap
  extends Omit<LyraNeighborListEventMap, 'lr-entity-select'>,
    Omit<LyraChunkInspectorEventMap, 'lr-toggle'>,
    Omit<LyraProvenancePanelEventMap, 'lr-entity-select' | 'lr-retrieval-disclosure-change'>,
    Omit<LyraTabGroupEventMap, 'lr-tab-show'> {
  /** Canonical "user picked this entity" gesture from any composed child; a path strip adds `occurrenceIndex`. */
  'lr-entity-select': CustomEvent<{ entityId: string; occurrenceIndex?: number }>;
  'lr-tab-show': CustomEvent<{ tabId: LyraEntityDossierTab }>;
  /** Forwarded from the dossier's tab strip for the outgoing tab. */
  'lr-tab-hide': LyraTabGroupEventMap['lr-tab-hide'];
  'lr-retrieval-disclosure-change': CustomEvent<LyraEntityDossierDisclosureDetail>;
}

/** The disclosed item and the dossier panel that owns it. */
export type LyraEntityDossierDisclosureDetail =
  | (Extract<LyraProvenancePanelDisclosureDetail, { kind: 'chunk' }> & Readonly<{ origin: 'supporting' }>)
  | (LyraProvenancePanelDisclosureDetail & Readonly<{ origin: 'provenance' }>);

/**
 * `<lr-entity-dossier>` — a full entity detail surface: a persistent header (`lr-entity-card` plus
 * an optional confidence `lr-stat`) above a `lr-tab-group` strip for Relationships (`lr-neighbor-list`),
 * Supporting chunks (`lr-chunk-inspector`), and Provenance (`lr-provenance-panel`). Pure layout —
 * it never fetches, ranks, or mutates graph or document state.
 *
 * `chunks`/`thresholds` (the "supporting chunks" tab) and `provenance` (the "Provenance" tab) are
 * deliberately separate inputs even though `lr-provenance-panel` can itself also show a chunks
 * section: the "Supporting chunks" tab is the evidence for *this entity's own* summary/properties,
 * while `provenance` is the broader grounding chain (which may span other entities, relationships,
 * and communities, and may or may not reuse the same chunk set) — a host is free to pass the same
 * array to both when the two concepts genuinely coincide.
 *
 * Tab labels reuse the exact `localize()` keys the composed child already uses for its own
 * accessible name (`neighborListLabel`, `chunkInspectorLabel`, `provenancePanelLabel`) rather than
 * new dossier-specific keys, so a translated locale only has to cover each string once and the tab
 * strip and the panel underneath it always agree.
 *
 * Its EventMap and `@event` documentation name the composed events surfaced to the host so
 * listeners remain typed and discoverable;
 * `lr-tab-show` carries `detail: { tabId: LyraEntityDossierTab }`. This is the same "pure
 * projection + event conduit" convention `lr-provenance-panel` and `lr-spreadsheet-viewer`'s
 * internal `lr-tab-group` already establish.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-entity-dossier
 * @event lr-entity-select - Surfaced unchanged from the embedded entity card, neighbor list, or
 *   the provenance panel's community card or path strip. `detail: { entityId, occurrenceIndex? }`.
 * @event lr-node-expand - Surfaced unchanged from the embedded neighbor list.
 *   `detail: { nodeId }`.
 * @event lr-chunk-open - Surfaced unchanged from the embedded chunk inspector.
 *   `detail: { chunkId, sourceId, anchor? }`.
 * @event lr-retrieval-disclosure-change - A section or chunk disclosure changed. Detail
 *   includes `kind`, `section`, `expanded`, `origin` and, for a chunk, `chunkId`.
 * @event lr-entity-open - Surfaced unchanged from an entity chip inside the embedded provenance
 *   panel. `detail: { entityId }`.
 * @event lr-drill - Surfaced unchanged from a community card inside the embedded provenance panel.
 *   `detail: { communityId }`.
 * @event lr-relation-activate - Surfaced unchanged from a relationship path strip inside the
 *   embedded provenance panel. `detail: { relation, sourceNodeId?, targetNodeId?, occurrenceIndex }`.
 * @event lr-tab-show - Surfaced unchanged from the embedded tabs.
 *   `detail: { tabId }`.
 * @event lr-tab-hide - Surfaced unchanged from the embedded tabs for the outgoing tab.
 *   `detail: { name }`.
 * @csspart base - The root wrapper, or the empty state's wrapper when `entity` is `null`.
 * @csspart header - The wrapper around the entity summary and the confidence stat.
 * @csspart entity-card - The nested `lr-entity-card`.
 * @csspart confidence - The nested confidence `lr-stat`, only rendered when `confidence` is set.
 * @csspart tabs - The nested `lr-tab-group` strip.
 * @csspart neighbor-list - The nested `lr-neighbor-list`, inside the Relationships tab.
 * @csspart chunk-inspector - The nested `lr-chunk-inspector`, inside the Supporting chunks tab.
 * @csspart provenance-panel - The nested `lr-provenance-panel`, inside the Provenance tab.
 * @csspart empty - The empty state shown when `entity` is `null`.
 * @status stable
 * @since 4.1.0
 */
export class LyraEntityDossier extends LyraElement<LyraEntityDossierEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chunkInspectorLabel: LYRA_DEFAULT_chunkInspectorLabel,
    details: LYRA_DEFAULT_details,
    neighborListLabel: LYRA_DEFAULT_neighborListLabel,
    noData: LYRA_DEFAULT_noData,
    provenancePanelLabel: LYRA_DEFAULT_provenancePanelLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-retrieval-disclosure-change',
  ]);

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'entity',
    'confidence',
    'types',
    'neighbors',
    'chunks',
    'provenance',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** `null` renders the shared `lr-empty` `noData` state in place of the whole dossier. */
  @property({ attribute: false }) entity: Readonly<LyraEntity> | null = null;
  /** `lr-graph` `nodeTypes` pass-through, forwarded to both `lr-entity-card` and
   *  `lr-provenance-panel` so the entity type badge and any provenance entity chips resolve
   *  identically. */
  @property({ attribute: false }) types: readonly LyraNodeTypeStyle[] = [];
  /** Forwarded to `lr-entity-card`'s own `communityLabel`. */
  @property({ attribute: 'community-label' }) communityLabel = '';
  /** Forwarded to `lr-entity-card`'s own `headingLevel`, so the entity title can sit at the
   *  page's outline level (`none` drops its heading semantics). Unset, the card uses level 3. */
  @property({ attribute: 'heading-level' }) headingLevel?: LyraHeadingLevel;
  /** Forwarded to `lr-entity-card`'s own `withoutFocusButton`. */
  @property({ type: Boolean, attribute: 'without-focus-button' })
  withoutFocusButton = false;

  /** Headline confidence KPI, rendered as an `lr-stat` next to the entity summary. Omitted
   *  entirely (no placeholder, no empty stat) when `null`. */
  @property({ attribute: false })
  confidence: Readonly<LyraEntityDossierConfidence> | null = null;
  /** Forwarded to `lr-neighbor-list`'s own `rows`. */
  @property({ attribute: false }) neighbors: readonly LyraNeighborRow[] = [];
  /** Forwarded to `lr-neighbor-list`'s own `groupByRelation`. */
  @property({ type: Boolean, attribute: 'group-by-relation' }) groupByRelation =
    false;
  /** Forwarded to `lr-neighbor-list`'s own `expandable`. */
  @property({ type: Boolean }) expandable = false;
  /** Forwarded to `lr-chunk-inspector`'s own `chunks` -- the evidence for this entity's own
   *  summary, distinct from `provenance` (see the class doc above). */
  @property({ attribute: false }) chunks: readonly LyraChunk[] = [];
  /** Forwarded to both `lr-chunk-inspector`'s and `lr-provenance-panel`'s own `thresholds`, so
   *  the score tiers agree everywhere a score renders in this dossier. */
  @property({ attribute: false }) thresholds: LyraScoreThresholds = {
    high: 0.75,
    medium: 0.5,
  };
  /** Forwarded to `lr-provenance-panel`'s own `provenance`. */
  @property({ attribute: false }) provenance: Readonly<LyraProvenance> | null = null;
  /** Accessible name for the overall dossier, separate from accessibleLabel's tab-strip name.
   *  A host aria-label takes precedence; the default is localized Details. */
  @property() label: string | null = null;
  /** JS-only accessible name for the internal `lr-tab-group` strip while no host `aria-label` is
   *  authored. A host label independently names the dossier and is not cloned onto the strip. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private activeTab: LyraEntityDossierTab = 'relationships';

  private onTabsChange = (e: CustomEvent<{ name: string }>): void => {
    e.stopPropagation();
    const tabId = e.detail.name as LyraEntityDossierTab;
    this.activeTab = tabId;
    this.emit('lr-tab-show', { tabId });
  };

  private containTabsEvent = (e: Event): void => {
    e.stopPropagation();
  };

  private onSupportingChunkToggle = (event: LyraChunkInspectorEventMap['lr-toggle']): void => {
    if (event.composedPath()[0] !== event.currentTarget) return;
    event.stopPropagation();
    const { expanded, itemId } = event.detail;
    this.emit('lr-retrieval-disclosure-change', {
      origin: 'supporting', kind: 'chunk', section: 'chunks', chunkId: itemId, expanded,
    });
  };

  private onProvenanceDisclosure = (
    event: LyraProvenancePanelEventMap['lr-retrieval-disclosure-change']
  ): void => {
    if (event.composedPath()[0] !== event.currentTarget) return;
    event.stopPropagation();
    this.emit('lr-retrieval-disclosure-change', { ...event.detail, origin: 'provenance' });
  };

  override render(): TemplateResult {
    const authored = this.getAttribute('aria-label');
    const hostOwnsName = normalizeLabel(authored) !== undefined;
    const role = hostOwnsName ? nothing : 'group';
    // An explicitly empty host label or `label` stays an explicit opt-out; whitespace counts as absent.
    const label = hostOwnsName
      ? nothing
      : authored === '' || this.label === '' ? '' : normalizeLabel(this.label) ?? this.localize('details');
    if (!this.entity) {
      return html`<div part="base" role=${role} aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>
      </div>`;
    }
    const entity = this.entity;
    const c = this.confidence;
    // Only the host attribute owns the dossier name. The JS property names the tab strip.
    const tabsLabel = this.hasAttribute('aria-label')
      ? nothing
      : this.accessibleLabel ?? nothing;

    return html`
      <div part="base" role=${role} aria-label=${label}>
        <div part="header">
          <lr-entity-card
            part="entity-card"
            .entity=${entity}
            .types=${this.types}
            .communityLabel=${this.communityLabel}
            .withoutFocusButton=${this.withoutFocusButton}
            .headingLevel=${this.headingLevel}
          ></lr-entity-card>
          ${c
            ? html`<lr-stat
                part="confidence"
                .label=${c.label}
                .value=${c.value}
                .unit=${c.unit ?? ''}
                .variant=${c.variant ?? 'neutral'}
                .exactValue=${c.exactValue ?? ''}
                .caption=${c.caption ?? ''}
                .rows=${c.rows ?? []}
              ></lr-stat>`
            : nothing}
        </div>
        <lr-tab-group
          part="tabs"
          aria-label=${tabsLabel}
          .active=${this.activeTab}
          @lr-tab-show=${this.onTabsChange}
          @lr-activate=${this.containTabsEvent}
        >
          <lr-tab panel="relationships"
            >${this.localize('neighborListLabel')}</lr-tab
          >
          <lr-tab panel="chunks"
            >${this.localize('chunkInspectorLabel')}</lr-tab
          >
          <lr-tab panel="provenance"
            >${this.localize('provenancePanelLabel')}</lr-tab
          >
          <lr-tab-panel name="relationships">
            <lr-neighbor-list
              part="neighbor-list"
              .rows=${this.neighbors}
              .types=${this.types}
              .groupByRelation=${this.groupByRelation}
              .expandable=${this.expandable}
            ></lr-neighbor-list>
          </lr-tab-panel>
          <lr-tab-panel name="chunks">
            <lr-chunk-inspector
              part="chunk-inspector"
              .chunks=${this.chunks}
              .thresholds=${this.thresholds}
              @lr-toggle=${this.onSupportingChunkToggle}
            ></lr-chunk-inspector>
          </lr-tab-panel>
          <lr-tab-panel name="provenance">
            <lr-provenance-panel
              part="provenance-panel"
              .provenance=${this.provenance}
              .types=${this.types}
              .thresholds=${this.thresholds}
              @lr-retrieval-disclosure-change=${this.onProvenanceDisclosure}
            ></lr-provenance-panel>
          </lr-tab-panel>
        </lr-tab-group>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-entity-dossier': LyraEntityDossier;
  }
}
