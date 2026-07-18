import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './entity-card.styles.js';
import '../result-card/result-field.class.js';
import '../badge/badge.class.js';
import '../chip/chip.class.js';
import '../button/button.class.js';
import '../empty/empty.class.js';

/** One knowledge-graph entity, as consumed by every Family K component. Field names deliberately
 *  mirror §3.4's `GraphNode` additions (`type`, `communityId`), so `{ ...graphNode, label:
 *  graphNode.label ?? graphNode.id }` adapts a graph node into a `LyraEntity` with no mapping
 *  table. */
export interface LyraEntity {
  id: string;
  label: string;
  /** Matches a §3.4 `nodeTypes[].id` on the paired `lyra-graph`. */
  type?: string;
  description?: string;
  /** Key/value dossier rows, rendered in insertion order. */
  properties?: Record<string, string | number>;
  /** Relationship count (in + out). */
  degree?: number;
  communityId?: string;
}

/** The exact §3.4 `nodeTypes` entry shape -- see `lyra-graph-legend`'s identical local alias for
 *  why this isn't imported from `lyra-graph` itself. */
type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

export interface LyraEntityCardEventMap {
  'lyra-entity-activate': CustomEvent<{ id: string }>;
}

function sanitizeTypeColor(color: string | undefined): string | undefined {
  return color != null && !/[;{}]/.test(color) ? color : undefined;
}

/** Derives themeable `--lyra-badge-*` overrides from a data-driven type color -- the same "type
 *  color is data-driven by design" exception §2 already grants graph nodes, applied here to the
 *  type badge only; every other color in this component comes from tokens. */
function typeBadgeStyle(color: string | undefined): Record<string, string> {
  const safe = sanitizeTypeColor(color);
  if (!safe) return {};
  return {
    '--lyra-badge-color': safe,
    // 10% (not the 16% other quiet-tint recipes in this codebase use) -- WCAG AA 4.5:1 text
    // contrast must hold for *any* data-driven type color against --lyra-color-surface, and 16%
    // measurably fails it for saturated hues (e.g. #7c3aed lands at 4.46:1, confirmed via axe).
    '--lyra-badge-background': `color-mix(in srgb, ${safe} 10%, var(--lyra-color-surface))`,
    '--lyra-badge-border': safe,
  };
}

/**
 * `<lyra-entity-card>` — a dossier card for one `LyraEntity`: type badge, description, key/value
 * property rows, degree, community chip, plus a built-in "focus in graph" action. Never fetches or
 * focuses a graph itself — `lyra-entity-activate` is a request a host routes into §3.4's
 * `graph.focusNode(id, { zoom? })`.
 *
 * @customElement lyra-entity-card
 * @slot - Extra body content below the property rows (e.g. a `lyra-neighbor-list`).
 * @slot actions - Extra header actions alongside the built-in focus button.
 * @event lyra-entity-activate - The built-in focus button was activated. `detail: { id }`.
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
 */
export class LyraEntityCard extends LyraElement<LyraEntityCardEventMap> {
  static styles = [LyraElement.styles, styles];

  /** `null` renders the shared `lyra-empty` `noData` state. */
  @property({ attribute: false }) entity: LyraEntity | null = null;
  /** §3.4 `nodeTypes` pass-through used to resolve the type badge's label and swatch color; an
   *  unresolvable `entity.type` renders as its raw id in a neutral badge. */
  @property({ attribute: false }) types: NodeTypeStyle[] = [];
  /** Display label for `entity.communityId`'s chip; falls back to the raw id. */
  @property({ attribute: 'community-label' }) communityLabel = '';
  /** Hides the built-in focus action on pages with no graph. */
  @property({ type: Boolean, attribute: 'show-focus-button' }) showFocusButton = true;

  private resolvedType(type: string): NodeTypeStyle | undefined {
    return this.types.find((t) => t.id === type);
  }

  private onFocusClick = (): void => {
    if (this.entity) this.emit('lyra-entity-activate', { id: this.entity.id });
  };

  render(): TemplateResult {
    if (!this.entity) {
      return html`<div part="base"><lyra-empty part="empty" heading=${this.localize('noData')}></lyra-empty></div>`;
    }
    const entity = this.entity;
    const titleText = entity.label || this.localize('untitledEntity');
    const resolved = entity.type ? this.resolvedType(entity.type) : undefined;
    const badgeLabel = resolved?.label ?? entity.type;
    const properties = Object.entries(entity.properties ?? {});
    const ariaLevel = this.getAttribute('aria-level') || '3';

    // The degree/community rows below deliberately don't use `lyra-result-field`'s own
    // `label`/`value` props (unlike the plain `property` rows above): that props-driven text is
    // synthesized inside `lyra-result-field`'s *own* shadow root, so it never shows up in
    // `resultField.textContent` read from outside (shadow trees aren't part of a light-DOM
    // descendant's `textContent`) -- only genuinely slotted (light-DOM) content does. Writing the
    // localized label directly into the default slot keeps the row introspectable from a host's
    // perspective while still visually reading as "Label: value", matching the property rows.
    return html`
      <div part="base">
        <div part="header">
          ${badgeLabel
            ? html`<lyra-badge part="type-badge" style=${styleMap(typeBadgeStyle(resolved?.color))}
                >${badgeLabel}</lyra-badge
              >`
            : nothing}
          <span part="title" role="heading" aria-level=${ariaLevel}>${titleText}</span>
          <div part="actions">
            <slot name="actions"></slot>
            ${this.showFocusButton
              ? html`<lyra-button part="focus-button" size="s" @click=${this.onFocusClick}
                  >${this.localize('focusInGraph')}</lyra-button
                >`
              : nothing}
          </div>
        </div>
        ${entity.description ? html`<p part="description">${entity.description}</p>` : nothing}
        <div part="properties">
          ${properties.map(
            ([key, value]) => html`<lyra-result-field part="property" label=${key} value=${String(value)}></lyra-result-field>`,
          )}
          ${entity.degree != null
            ? html`<lyra-result-field part="degree"
                >${this.localize('entityDegree')}: ${String(entity.degree)}</lyra-result-field
              >`
            : nothing}
          ${entity.communityId
            ? html`<lyra-result-field part="community"
                >${this.localize('entityCommunity')}:
                <lyra-chip>${this.communityLabel || entity.communityId}</lyra-chip></lyra-result-field
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
    'lyra-entity-card': LyraEntityCard;
  }
}
