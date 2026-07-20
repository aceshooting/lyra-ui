import { html, nothing, type TemplateResult, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraNeighborRow } from '../neighbor-list/neighbor-list.class.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraProvenance } from '../provenance-panel/provenance-panel.class.js';
import type { StatVariant, StatRow } from '../../data/stat/stat.class.js';
import '../entity-card/entity-card.class.js';
import '../neighbor-list/neighbor-list.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import '../provenance-panel/provenance-panel.class.js';
import '../../data/stat/stat.class.js';
import '../../layout/tabs/tabs.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './entity-dossier.styles.js';

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library
 *  (see e.g. `<lr-agent-run>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

/** The exact `lr-graph.nodeTypes` entry shape -- see `lr-entity-card`'s and
 *  `lr-provenance-panel`'s identical local aliases for why this isn't imported from `lr-graph`
 *  itself. Shared verbatim with both of those, since it's forwarded to both nested components
 *  below without any mapping. */
type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

/** The three tab ids this component renders -- also `lr-tabs`' own `slot`/`tabId` values, so a
 *  `lr-tabs-change` listener can switch on these literally. */
export type LyraEntityDossierTab = 'relationships' | 'chunks' | 'provenance';

/**
 * The headline confidence KPI shown next to the entity summary. Every field here is caller-supplied
 * domain data -- the same convention `lr-stat`'s own `label`/`value`/`caption`/`rows` already use
 * (a confidence metric's label is exactly as domain-specific as a "Revenue" or "Latency" stat's
 * label), so none of it routes through `localize()`.
 */
export interface LyraEntityDossierConfidence {
  label: string;
  value: string;
  unit?: string;
  variant?: StatVariant;
  /** Exact value shown as a hover/focus tooltip on the headline value -- see `lr-stat.exactValue`. */
  exactValue?: string;
  caption?: string;
  /** Breakdown rows (e.g. per-signal sub-scores) -- see `lr-stat.rows`. */
  rows?: StatRow[];
}

/**
 * `<lr-entity-dossier>` — a full entity detail surface: a persistent header (`lr-entity-card` plus
 * an optional confidence `lr-stat`) above a `lr-tabs` strip for Relationships (`lr-neighbor-list`),
 * Supporting chunks (`lr-chunk-inspector`), and Provenance (`lr-provenance-panel`). Pure layout —
 * it never fetches, ranks, or mutates graph/document state, and never re-renders what any of those
 * five composed components already render themselves; every one of their own events (`
 * lr-entity-activate`, `lr-node-expand`, `lr-chunk-open`, `lr-expand`, `lr-toggle`, `lr-tabs-change`)
 * bubbles through unmodified (`composed: true` crosses this component's own shadow boundary with no
 * re-dispatch needed) rather than being re-declared as this component's own event.
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
 * This component declares no events of its own -- `lr-tabs-change` (`detail: { tabId:
 * LyraEntityDossierTab }`) and every composed child's own event bubble through unmodified, the
 * same "pure projection + event conduit" convention `lr-provenance-panel` and
 * `lr-spreadsheet-viewer`'s internal `lr-tabs` already establish.
 *
 * @customElement lr-entity-dossier
 * @csspart base - The root wrapper, or the empty state's wrapper when `entity` is `null`.
 * @csspart header - The wrapper around the entity summary and the confidence stat.
 * @csspart entity-card - The nested `lr-entity-card`.
 * @csspart confidence - The nested confidence `lr-stat`, only rendered when `confidence` is set.
 * @csspart tabs - The nested `lr-tabs` strip.
 * @csspart neighbor-list - The nested `lr-neighbor-list`, inside the Relationships tab.
 * @csspart chunk-inspector - The nested `lr-chunk-inspector`, inside the Supporting chunks tab.
 * @csspart provenance-panel - The nested `lr-provenance-panel`, inside the Provenance tab.
 * @csspart empty - The empty state shown when `entity` is `null`.
 */
export class LyraEntityDossier extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** `null` renders the shared `lr-empty` `noData` state in place of the whole dossier. */
  @property({ attribute: false }) entity: LyraEntity | null = null;
  /** `lr-graph` `nodeTypes` pass-through, forwarded to both `lr-entity-card` and
   *  `lr-provenance-panel` so the entity type badge and any provenance entity chips resolve
   *  identically. */
  @property({ attribute: false }) types: NodeTypeStyle[] = [];
  /** Forwarded to `lr-entity-card`'s own `communityLabel`. */
  @property({ attribute: 'community-label' }) communityLabel = '';
  /** Forwarded to `lr-entity-card`'s own `showFocusButton`. */
  @property({ type: Boolean, attribute: 'show-focus-button', converter: trueDefaultBooleanConverter })
  showFocusButton = true;
  /** Headline confidence KPI, rendered as an `lr-stat` next to the entity summary. Omitted
   *  entirely (no placeholder, no empty stat) when `null`. */
  @property({ attribute: false }) confidence: LyraEntityDossierConfidence | null = null;
  /** Forwarded to `lr-neighbor-list`'s own `rows`. */
  @property({ attribute: false }) neighbors: LyraNeighborRow[] = [];
  /** Forwarded to `lr-neighbor-list`'s own `groupByRelation`. */
  @property({ type: Boolean, attribute: 'group-by-relation' }) groupByRelation = false;
  /** Forwarded to `lr-neighbor-list`'s own `expandable`. */
  @property({ type: Boolean }) expandable = false;
  /** Forwarded to `lr-chunk-inspector`'s own `chunks` -- the evidence for this entity's own
   *  summary, distinct from `provenance` (see the class doc above). */
  @property({ attribute: false }) chunks: LyraChunk[] = [];
  /** Forwarded to both `lr-chunk-inspector`'s and `lr-provenance-panel`'s own `thresholds`, so
   *  the score tiers agree everywhere a score renders in this dossier. */
  @property({ attribute: false }) thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 };
  /** Forwarded to `lr-provenance-panel`'s own `provenance`. */
  @property({ attribute: false }) provenance: LyraProvenance | null = null;
  /** Accessible name forwarded to the internal `lr-tabs` strip. Unset, the tab strip renders
   *  without an `aria-label` (matching `lr-tabs`' own unset-default behavior). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Which tab is active -- internal, not a controlled public property: `lr-tabs` already owns
   *  this state, and a one-way `.active=${...}` binding driven by a *stale* public property here
   *  would fight the user's own click the next time this component re-renders for an unrelated
   *  reason (see `lr-spreadsheet-viewer`'s identical `activeSheetIndex` pattern). */
  @state() private activeTab: LyraEntityDossierTab = 'relationships';

  private onTabsChange = (e: CustomEvent<{ tabId: string }>): void => {
    this.activeTab = e.detail.tabId as LyraEntityDossierTab;
  };

  render(): TemplateResult {
    if (!this.entity) {
      return html`<div part="base"><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
    }
    const entity = this.entity;
    const c = this.confidence;

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
        <lr-tabs part="tabs" aria-label=${this.accessibleLabel || nothing} .active=${this.activeTab} @lr-tabs-change=${this.onTabsChange}>
          <div slot="relationships" label=${this.localize('neighborListLabel')}>
            <lr-neighbor-list
              part="neighbor-list"
              .rows=${this.neighbors}
              .groupByRelation=${this.groupByRelation}
              .expandable=${this.expandable}
            ></lr-neighbor-list>
          </div>
          <div slot="chunks" label=${this.localize('chunkInspectorLabel')}>
            <lr-chunk-inspector part="chunk-inspector" .chunks=${this.chunks} .thresholds=${this.thresholds}></lr-chunk-inspector>
          </div>
          <div slot="provenance" label=${this.localize('provenancePanelLabel')}>
            <lr-provenance-panel part="provenance-panel" .provenance=${this.provenance} .types=${this.types} .thresholds=${this.thresholds}></lr-provenance-panel>
          </div>
        </lr-tabs>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-entity-dossier': LyraEntityDossier;
  }
}
