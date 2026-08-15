import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity, isNonBlankIdentity } from '../retrieval-identity.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { finiteCount, finiteNumber } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './entity-card.styles.js';
import '../../agent-tools/result-card/result-field.class.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/chip/chip.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/empty/empty.class.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_entityCommunity, LYRA_DEFAULT_entityDegree, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_focusInGraph, LYRA_DEFAULT_noData, LYRA_DEFAULT_untitledEntity } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** One knowledge-graph entity, as consumed by every knowledge-graph explorer component. Field
 *  names deliberately mirror `lr-graph`'s node shape (`type`, `communityId`), so
 *  `{ ...graphNode, label: graphNode.label ?? graphNode.id }` adapts a graph node into a
 *  `LyraEntity` with no mapping table. */
export interface LyraEntity {
  id: string;
  label: string;
  /** Matches a `nodeTypes[].id` on the paired `lr-graph`. */
  type?: string;
  description?: string;
  /** Key/value dossier rows, rendered in insertion order. */
  properties?: Readonly<Record<string, string | number>>;
  /** Relationship count (in + out). */
  degree?: number;
  communityId?: string;
}

/** Container treatment for `<lr-entity-card>`'s root. The library-wide {@linkcode LyraFrame}
 *  vocabulary under this component's own export name. */
export type EntityCardAppearance = LyraFrame;

export interface LyraEntityCardEventMap {
  'lr-entity-activate': CustomEvent<{ entityId: string }>;
}

/** Derives themeable `--lr-badge-*` overrides from a data-driven type color -- the same "type
 *  color is data-driven by design" exception `lr-graph`'s `nodeTypes` colors already have,
 *  applied here to the type badge only; every other color in this component comes from tokens. */
function typeBadgeStyle(color: string | undefined): Record<string, string> {
  const safe = color != null ? sanitizeCssColor(color) : undefined;
  if (!safe) return {};
  return {
    // Consumer colors remain an accent rather than becoming the text authority. Extreme valid
    // inputs such as white, black, or a translucent color therefore cannot erase the category
    // label in the opposite theme; the semantic foreground stays token-owned and the border is
    // the persistent non-text color cue (also retained by forced-colors adjustment).
    '--lr-badge-color': 'var(--lr-color-text)',
    '--lr-badge-background': `color-mix(in srgb, ${safe} 12%, var(--lr-color-surface))`,
    '--lr-badge-border': safe,
  };
}

/**
 * `<lr-entity-card>` — a dossier card for one `LyraEntity`: type badge, description, key/value
 * property rows, degree, community chip, plus a built-in "focus in graph" action. Never fetches or
 * focuses a graph itself — `lr-entity-activate` is a request a host routes into `lr-graph`'s
 * `focusNode(id, { zoom? })`.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-entity-card
 * @slot - Extra body content below the property rows (e.g. a `lr-neighbor-list`).
 * @slot actions - Extra header actions alongside the built-in focus button.
 * @event lr-entity-activate - The built-in focus button was activated. `detail: { entityId }`.
 * @csspart base - The outer bordered container.
 * @csspart header - The header row wrapping the type badge, title, and actions.
 * @csspart type-badge - The resolved entity-type badge.
 * @csspart title - The entity's label, `role="heading" aria-level="3"` by default.
 * @csspart description - The entity's description text.
 * @csspart properties - The wrapper around every property/degree/community row.
 * @csspart property - One key/value dossier row.
 * @csspart degree - The relationship-count row.
 * @csspart community - The community-chip row.
 * @csspart actions - The wrapper around the `actions` slot and the built-in focus button.
 * @csspart focus-button - The built-in "Focus in graph" button.
 * @csspart empty - The empty state shown when `entity` is `null`.
 * @cssprop [--lr-entity-card-compact-padding=var(--lr-space-s)] - `[part="base"]` padding while
 *   `compact`.
 * @cssprop [--lr-entity-card-compact-gap=var(--lr-space-xs)] - Gap between `[part="base"]`'s rows
 *   while `compact`.
 * @status stable
 * @since 4.0.0
 */
export class LyraEntityCard extends LyraElement<LyraEntityCardEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    entityCommunity: LYRA_DEFAULT_entityCommunity,
    entityDegree: LYRA_DEFAULT_entityDegree,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    focusInGraph: LYRA_DEFAULT_focusInGraph,
    noData: LYRA_DEFAULT_noData,
    untitledEntity: LYRA_DEFAULT_untitledEntity,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'entity',
    'types',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** `null` renders the shared `lr-empty` `noData` state. */
  @property({ attribute: false }) entity: Readonly<LyraEntity> | null = null;
  /** `lr-graph` `nodeTypes` pass-through used to resolve the type badge's label and swatch
   *  color; an unresolvable `entity.type` renders as its raw id in a neutral badge. */
  @property({ attribute: false }) types: readonly LyraNodeTypeStyle[] = [];
  /** Display label for `entity.communityId`'s chip; falls back to the raw id. */
  @property({ attribute: 'community-label' }) communityLabel = '';
  /** Hides the built-in focus action on pages with no graph. */
  @property({
    type: Boolean,
    attribute: 'show-focus-button',
    converter: trueDefaultBooleanConverter,
  })
  showFocusButton = true;
  /** Tighter root padding and row gap for dense contexts (a dossier rendered in a sidebar or a
   *  result list) -- same convention as `lr-empty`'s `compact`, and as this component's sibling
   *  `lr-community-card`. Defaults to `false`, i.e. the full card padding. Purely a density knob:
   *  the border and background stay, so use `frame="plain"` to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, padded box. `'plain'` removes the border, background, padding and corner
   *  radius, so a card nested inside a container that already draws a border doesn't double it.
   *  `plain` wins over `compact` when both are set (nothing left to tighten). */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  private resolvedType(type: string): LyraNodeTypeStyle | undefined {
    return firstByRetrievalIdentity(this.types, (entry) => entry?.id).find(
      (entry) => entry.id === type
    );
  }

  private onFocusClick = (): void => {
    if (this.entity && isNonBlankIdentity(this.entity.id)) {
      this.emit('lr-entity-activate', { entityId: this.entity.id });
    }
  };

  override render(): TemplateResult {
    if (!this.entity || !isNonBlankIdentity(this.entity.id)) {
      return html`<div part="base">
        <lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>
      </div>`;
    }
    const entity = this.entity;
    const titleText = entity.label || this.localize('untitledEntity');
    const resolved = entity.type ? this.resolvedType(entity.type) : undefined;
    const badgeLabel = resolved?.label ?? entity.type;
    const properties = Object.entries(entity.properties ?? {});
    const ariaLevel = this.getAttribute('aria-level') || '3';

    // The degree/community rows route their localized labels through `lr-result-field`'s
    // `label` prop, exactly like the plain `property` rows above: the label/value separator is
    // presentation that belongs to `lr-result-field` (a single, locale-adjustable place), not a
    // literal joined into this template. The community *value* stays slotted because it's rich
    // content (a chip), which the default slot handles by design.
    return html`
      <div part="base">
        <div part="header">
          ${badgeLabel
            ? html`<lr-badge
                part="type-badge"
                style=${styleMap(typeBadgeStyle(resolved?.color))}
                >${badgeLabel}</lr-badge
              >`
            : nothing}
          <span part="title" role="heading" aria-level=${ariaLevel}
            >${titleText}</span
          >
          <div part="actions">
            <slot name="actions"></slot>
            ${this.showFocusButton
              ? html`<lr-button
                  part="focus-button"
                  size="s"
                  @click=${this.onFocusClick}
                  >${this.localize('focusInGraph')}</lr-button
                >`
              : nothing}
          </div>
        </div>
        ${entity.description
          ? html`<p part="description">${entity.description}</p>`
          : nothing}
        <div part="properties">
          ${properties.map(
            ([key, value]) => html`<lr-result-field
              part="property"
              label=${key}
              value=${typeof value === 'number'
                ? getNumberFormat(this.effectiveLocale).format(
                    finiteNumber(value, 0)
                  )
                : String(value)}
            ></lr-result-field>`
          )}
          ${entity.degree != null
            ? html`<lr-result-field
                part="degree"
                label=${this.localize('entityDegree')}
                value=${getNumberFormat(this.effectiveLocale).format(
                  finiteCount(entity.degree)
                )}
              ></lr-result-field>`
            : nothing}
          ${entity.communityId
            ? html`<lr-result-field
                part="community"
                label=${this.localize('entityCommunity')}
                ><lr-chip
                  >${this.communityLabel || entity.communityId}</lr-chip
                ></lr-result-field
              >`
            : nothing}
        </div>
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-entity-card': LyraEntityCard;
  }
}
