import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type {
  LyraNeighborListEventMap,
  LyraNeighborRow,
} from '../neighbor-list/neighbor-list.class.js';
import type {
  LyraChunk,
  LyraChunkInspectorEventMap,
} from '../chunk-inspector/chunk-inspector.class.js';
import type {
  LyraProvenance,
  LyraProvenancePanelEventMap,
} from '../provenance-panel/provenance-panel.class.js';
import type { StatRow } from '../../data/stat/stat.class.js';
import type { LyraVariant } from '../../../internal/variants.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import type { LyraTabGroupEventMap } from '../../layout/tab-group/tab-group.class.js';
import '../entity-card/entity-card.class.js';
import '../neighbor-list/neighbor-list.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import '../provenance-panel/provenance-panel.class.js';
import '../../data/stat/stat.class.js';
import '../../layout/tab-group/tab-group.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './entity-dossier.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import type { LyraScoreThresholds } from '../graph/graph.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chunkInspectorLabel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_neighborListLabel, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_provenancePanelLabel, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
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
  extends LyraNeighborListEventMap,
    LyraChunkInspectorEventMap,
    LyraProvenancePanelEventMap,
    Omit<LyraTabGroupEventMap, 'lr-tab-show'> {
  'lr-tab-show': CustomEvent<{ tabId: LyraEntityDossierTab }>;
}

/**
 * `<lr-entity-dossier>` — a full entity detail surface: a persistent header (`lr-entity-card` plus
 * an optional confidence `lr-stat`) above a `lr-tab-group` strip for Relationships (`lr-neighbor-list`),
 * Supporting chunks (`lr-chunk-inspector`), and Provenance (`lr-provenance-panel`). Pure layout —
 * it never fetches, ranks, or mutates graph/document state, and never re-renders what any of those
 * five composed components already render themselves; every one of their own events (`
 * lr-entity-activate`, `lr-node-expand`, `lr-chunk-open`, `lr-expand`, `lr-toggle`, `lr-tab-show`,
 * plus the provenance panel's own conduit set — `lr-entity-open`, `lr-drill`,
 * `lr-relation-activate`) bubbles through unmodified (`composed: true` crosses this component's own
 * shadow boundary with no re-dispatch needed).
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
 * This component emits no events of its own. Its EventMap and `@event` documentation name the
 * composed events that bubble through so host listeners remain typed and discoverable;
 * `lr-tab-show` carries `detail: { tabId: LyraEntityDossierTab }`. This is the same "pure
 * projection + event conduit" convention `lr-provenance-panel` and `lr-spreadsheet-viewer`'s
 * internal `lr-tab-group` already establish.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-entity-dossier
 * @event lr-entity-activate - Surfaced unchanged from the embedded entity card or neighbor list.
 *   `detail: { id }`.
 * @event lr-node-expand - Surfaced unchanged from the embedded neighbor list.
 *   `detail: { id }`.
 * @event lr-chunk-open - Surfaced unchanged from the embedded chunk inspector.
 *   `detail: { id, sourceId, anchor? }`.
 * @event lr-expand - Surfaced unchanged from the embedded chunk inspector.
 *   `detail: { id, expanded }`.
 * @event lr-toggle - Surfaced unchanged from the embedded provenance panel.
 *   `detail: { section, expanded }`.
 * @event lr-entity-open - Surfaced unchanged from an entity chip inside the embedded provenance
 *   panel. `detail: { id }`.
 * @event lr-drill - Surfaced unchanged from a community card inside the embedded provenance panel.
 *   `detail: { id }`.
 * @event lr-relation-activate - Surfaced unchanged from a relationship path strip inside the
 *   embedded provenance panel. `detail: { relation, sourceId, targetId }`.
 * @event lr-tab-show - Surfaced unchanged from the embedded tabs.
 *   `detail: { tabId }`.
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
  protected static override readonly ownedCollectionProperties = Object.freeze([
    'entity',
    'confidence',
    'types',
    'neighbors',
    'chunks',
    'provenance',
  ]);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chunkInspectorLabel: LYRA_DEFAULT_chunkInspectorLabel,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    neighborListLabel: LYRA_DEFAULT_neighborListLabel,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    provenancePanelLabel: LYRA_DEFAULT_provenancePanelLabel,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** `null` renders the shared `lr-empty` `noData` state in place of the whole dossier. */
  @property({ attribute: false }) entity: Readonly<LyraEntity> | null = null;
  /** `lr-graph` `nodeTypes` pass-through, forwarded to both `lr-entity-card` and
   *  `lr-provenance-panel` so the entity type badge and any provenance entity chips resolve
   *  identically. */
  @property({ attribute: false }) types: readonly LyraNodeTypeStyle[] = [];
  /** Forwarded to `lr-entity-card`'s own `communityLabel`. */
  @property({ attribute: 'community-label' }) communityLabel = '';
  /** Forwarded to `lr-entity-card`'s own `showFocusButton`. */
  @property({
    type: Boolean,
    attribute: 'show-focus-button',
    converter: trueDefaultBooleanConverter,
  })
  showFocusButton = true;
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
  /** JS-only accessible name for the internal `lr-tab-group` strip while no host `aria-label` is
   *  authored. A host label independently names the dossier and is not cloned onto the strip. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Which tab is active -- internal, not a controlled public property: `lr-tab-group` already owns
   *  this state, and a one-way `.active=${...}` binding driven by a *stale* public property here
   *  would fight the user's own click the next time this component re-renders for an unrelated
   *  reason (see `lr-spreadsheet-viewer`'s identical `activeSheetIndex` pattern). */
  @state() private activeTab: LyraEntityDossierTab = 'relationships';

  private onTabsChange = (e: CustomEvent<{ tabId: string }>): void => {
    this.activeTab = e.detail.tabId as LyraEntityDossierTab;
  };

  override render(): TemplateResult {
    if (!this.entity) {
      return html`<div part="base">
        <lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>
      </div>`;
    }
    const entity = this.entity;
    const c = this.confidence;
    const tabsLabel =
      hostAriaLabel(this) === null ? this.accessibleLabel ?? nothing : nothing;

    return html`
      <div part="base">
        <div part="header">
          <lr-entity-card
            part="entity-card"
            .entity=${entity}
            .types=${this.types}
            .communityLabel=${this.communityLabel}
            .showFocusButton=${this.showFocusButton}
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
              .groupByRelation=${this.groupByRelation}
              .expandable=${this.expandable}
            ></lr-neighbor-list>
          </lr-tab-panel>
          <lr-tab-panel name="chunks">
            <lr-chunk-inspector
              part="chunk-inspector"
              .chunks=${this.chunks}
              .thresholds=${this.thresholds}
            ></lr-chunk-inspector>
          </lr-tab-panel>
          <lr-tab-panel name="provenance">
            <lr-provenance-panel
              part="provenance-panel"
              .provenance=${this.provenance}
              .types=${this.types}
              .thresholds=${this.thresholds}
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
