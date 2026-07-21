import { html, nothing, type ComplexAttributeConverter, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './entity-card.styles.js';
import '../../agent-tools/result-card/result-field.class.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/chip/chip.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/empty/empty.class.js';

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
  properties?: Record<string, string | number>;
  /** Relationship count (in + out). */
  degree?: number;
  communityId?: string;
}

/** The exact `lr-graph.nodeTypes` entry shape -- see `lr-graph-legend`'s identical local
 *  alias for why this isn't imported from `lr-graph` itself. */
type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

/** Visual chrome for `<lr-entity-card>`'s root, mirroring `lr-card`'s `appearance` vocabulary. */
export type EntityCardAppearance = 'card' | 'plain';

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library
 *  (see e.g. `<lr-attachment-chip>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

export interface LyraEntityCardEventMap {
  'lr-entity-activate': CustomEvent<{ id: string }>;
}

function sanitizeTypeColor(color: string | undefined): string | undefined {
  return color != null && !/[;{}]/.test(color) ? color : undefined;
}

/** Derives themeable `--lr-badge-*` overrides from a data-driven type color -- the same "type
 *  color is data-driven by design" exception `lr-graph`'s `nodeTypes` colors already have,
 *  applied here to the type badge only; every other color in this component comes from tokens. */
function typeBadgeStyle(color: string | undefined): Record<string, string> {
  const safe = sanitizeTypeColor(color);
  if (!safe) return {};
  return {
    '--lr-badge-color': safe,
    // 8% (not the 16% other quiet-tint recipes in this codebase use) -- WCAG AA 4.5:1 text
    // contrast must hold for *any* data-driven type color against --lr-color-surface. 16%
    // measurably fails it for saturated hues (e.g. #7c3aed lands at 4.46:1, confirmed via axe),
    // and even 10% isn't safe margin for every hue in this palette -- e.g.
    // --lr-theme-color-chart-1 (#8250df) lands at 4.42:1. 8% clears 4.5:1 for both with margin.
    '--lr-badge-background': `color-mix(in srgb, ${safe} 8%, var(--lr-color-surface))`,
    '--lr-badge-border': safe,
  };
}

/**
 * `<lr-entity-card>` — a dossier card for one `LyraEntity`: type badge, description, key/value
 * property rows, degree, community chip, plus a built-in "focus in graph" action. Never fetches or
 * focuses a graph itself — `lr-entity-activate` is a request a host routes into `lr-graph`'s
 * `focusNode(id, { zoom? })`.
 *
 * @customElement lr-entity-card
 * @slot - Extra body content below the property rows (e.g. a `lr-neighbor-list`).
 * @slot actions - Extra header actions alongside the built-in focus button.
 * @event lr-entity-activate - The built-in focus button was activated. `detail: { id }`.
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
 */
export class LyraEntityCard extends LyraElement<LyraEntityCardEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** `null` renders the shared `lr-empty` `noData` state. */
  @property({ attribute: false }) entity: LyraEntity | null = null;
  /** `lr-graph` `nodeTypes` pass-through used to resolve the type badge's label and swatch
   *  color; an unresolvable `entity.type` renders as its raw id in a neutral badge. */
  @property({ attribute: false }) types: NodeTypeStyle[] = [];
  /** Display label for `entity.communityId`'s chip; falls back to the raw id. */
  @property({ attribute: 'community-label' }) communityLabel = '';
  /** Hides the built-in focus action on pages with no graph. */
  @property({ type: Boolean, attribute: 'show-focus-button', converter: trueDefaultBooleanConverter })
  showFocusButton = true;
  /** Tighter root padding and row gap for dense contexts (a dossier rendered in a sidebar or a
   *  result list) -- same convention as `lr-empty`'s `compact`, and as this component's sibling
   *  `lr-community-card`. Defaults to `false`, i.e. the full card padding. Purely a density knob:
   *  the border and background stay, so use `appearance="plain"` to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Visual chrome, mirroring `lr-card`'s `appearance` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, padded box. `'plain'` removes the border, background, padding and corner
   *  radius, so a card nested inside a container that already draws a border doesn't double it.
   *  `plain` wins over `compact` when both are set (nothing left to tighten). */
  @property({ reflect: true }) appearance: EntityCardAppearance = 'card';

  private resolvedType(type: string): NodeTypeStyle | undefined {
    return this.types.find((t) => t.id === type);
  }

  private onFocusClick = (): void => {
    if (this.entity) this.emit('lr-entity-activate', { id: this.entity.id });
  };

  override render(): TemplateResult {
    if (!this.entity) {
      return html`<div part="base"><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
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
            ? html`<lr-badge part="type-badge" style=${styleMap(typeBadgeStyle(resolved?.color))}
                >${badgeLabel}</lr-badge
              >`
            : nothing}
          <span part="title" role="heading" aria-level=${ariaLevel}>${titleText}</span>
          <div part="actions">
            <slot name="actions"></slot>
            ${this.showFocusButton
              ? html`<lr-button part="focus-button" size="s" @click=${this.onFocusClick}
                  >${this.localize('focusInGraph')}</lr-button
                >`
              : nothing}
          </div>
        </div>
        ${entity.description ? html`<p part="description">${entity.description}</p>` : nothing}
        <div part="properties">
          ${properties.map(
            ([key, value]) => html`<lr-result-field part="property" label=${key} value=${String(value)}></lr-result-field>`,
          )}
          ${entity.degree != null
            ? html`<lr-result-field
                part="degree"
                label=${this.localize('entityDegree')}
                value=${String(entity.degree)}
              ></lr-result-field>`
            : nothing}
          ${entity.communityId
            ? html`<lr-result-field part="community" label=${this.localize('entityCommunity')}
                ><lr-chip>${this.communityLabel || entity.communityId}</lr-chip></lr-result-field
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
