import { html, nothing, svg, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './graph-legend.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_graphLegendLabel, LYRA_DEFAULT_legendTypeHidden, LYRA_DEFAULT_legendTypeShown, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The exact `lr-graph.nodeTypes` entry shape, declared locally (not imported from
 *  `lr-graph`) so this zero-dependency component never pulls in the graph's own d3 optional-peer
 *  chain and has no build-time coupling to `lr-graph` itself — TypeScript's structural typing
 *  makes `legend.types = graph.nodeTypes` interchangeable regardless. */
export type LyraGraphLegendType = {
  id: string;
  label: string;
  /** A CSS color. Invalid values and `url()` paint servers use the categorical fallback. */
  color?: string;
  shape?: 'circle' | 'square' | 'diamond';
};

export interface LyraGraphLegendVisibilityDetail {
  hiddenTypes: string[];
}

export interface LyraGraphLegendEventMap {
  'lr-visibility-change': CustomEvent<LyraGraphLegendVisibilityDetail>;
}

const PALETTE_SIZE = 8;
/** Read from `--lr-graph-cat-1`..`-8` (defined by `lr-graph` type-styling) with this
 *  hardcoded fallback -- the same computed-style-with-a-hardcoded-fallback pattern
 *  `lr-word-cloud`'s own `--lr-word-cloud-color-1`..`-8` palette already uses, so this legend
 *  renders sensible colors even when no theme defines those variables. */
const FALLBACK_PALETTE = ['#0969da', '#1a7f37', '#9a6700', '#cf222e', '#8250df', '#bf3989', '#0a7d91', '#57606a'];

/**
 * `<lr-graph-legend>` — a node-type legend for a paired `lr-graph`: one swatch + label + count
 * row per `lr-graph` node type, doubling as visibility filters. Never reads or writes a graph directly —
 * the host forwards `types` in from `graph.nodeTypes` and `hiddenTypes` back out to
 * `graph.hiddenTypes` on `lr-visibility-change`, the same event-decoupled contract every sibling
 * in this family follows.
 *
 * @customElement lr-graph-legend
 * @event lr-visibility-change - `detail: { hiddenTypes }` — the complete updated array, fired
 * after each toggle.
 * @csspart base - The `role="group"` wrapper.
 * @csspart item - One row per type — a `<button>` when `interactive`, a plain `<div>` otherwise.
 * @csspart swatch - The type's shape glyph.
 * @csspart label - The type's label text.
 * @csspart count - The optional per-type count.
 * @csspart live-region - The visually hidden filter-toggle announcement.
 * @cssprop [--lr-graph-legend-hidden-color=var(--lr-color-text-quiet)] - Text color for a
 * filtered-out (hidden) legend row's label/count, independent of the shared quiet-text token.
 * @cssprop [--lr-graph-legend-hidden-swatch-opacity=0.5] - Opacity of a filtered-out row's
 * decorative swatch.
 * @status stable
 * @since 4.0.0
 */
export class LyraGraphLegend extends LyraElement<LyraGraphLegendEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    graphLegendLabel: LYRA_DEFAULT_graphLegendLabel,
    legendTypeHidden: LYRA_DEFAULT_legendTypeHidden,
    legendTypeShown: LYRA_DEFAULT_legendTypeShown,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  /** The `lr-graph.nodeTypes` array, passed through verbatim. */
  @property({ attribute: false }) types: LyraGraphLegendType[] = [];
  /** Optional per-type node counts keyed by type id; a type with no entry renders no count. */
  @property({ attribute: false }) counts?: Record<string, number>;
  /** Currently-hidden type ids. The legend toggles its own copy on activation *then* emits; a host
   *  may also treat this as controlled by reassigning it after each event. */
  @property({ attribute: false }) hiddenTypes: string[] = [];
  /** `false` renders a read-only legend (no buttons, no toggling). */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) interactive = true;
  /** Accessible name for the group; falls back to the localized `graphLegendLabel`. */
  @property() label = '';

  @state() private liveText = '';
  /** The documented part remains a shadow-DOM text mirror only; announcements use this shared
   * light-DOM sink because shadow live regions are not reliable across AT/browser pairs. */
  private announcementSink?: AnnouncementSink;

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
    super.disconnectedCallback();
  }

  private paletteColor(index: number): string {
    const cs = getComputedStyle(this);
    const varValue = cs.getPropertyValue(`--lr-graph-cat-${(index % PALETTE_SIZE) + 1}`).trim();
    return varValue || FALLBACK_PALETTE[index % PALETTE_SIZE]!;
  }

  private swatchColor(type: LyraGraphLegendType, index: number): string {
    return sanitizeCssColor(type.color) ?? this.paletteColor(index);
  }

  private isVisible(id: string): boolean {
    return !this.hiddenTypes.includes(id);
  }

  private toggle(type: LyraGraphLegendType): void {
    if (!this.interactive) return;
    const wasVisible = this.isVisible(type.id);
    const next = wasVisible ? [...this.hiddenTypes, type.id] : this.hiddenTypes.filter((id) => id !== type.id);
    this.hiddenTypes = next;
    this.liveText = this.localize(wasVisible ? 'legendTypeHidden' : 'legendTypeShown', undefined, {
      label: type.label,
    });
    this.announcementSink?.announce(this.liveText);
    this.emit('lr-visibility-change', { hiddenTypes: next });
  }

  private renderSwatchShape(shape: LyraGraphLegendType['shape'], color: string): TemplateResult {
    if (shape === 'square') return svg`<rect x="1" y="1" width="10" height="10" fill=${color}></rect>`;
    if (shape === 'diamond') return svg`<polygon points="6,0 12,6 6,12 0,6" fill=${color}></polygon>`;
    return svg`<circle cx="6" cy="6" r="5" fill=${color}></circle>`;
  }

  override render(): TemplateResult {
    const groupLabel = this.getAttribute('aria-label') ?? (this.label || this.localize('graphLegendLabel'));
    return html`
      <div part="base" role="group" aria-label=${groupLabel}>
        ${this.types.map((type, index) => {
          const visible = this.isVisible(type.id);
          const color = this.swatchColor(type, index);
          const count = this.counts?.[type.id];
          const content = html`
            <svg part="swatch" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              ${this.renderSwatchShape(type.shape, color)}
              ${!visible
                ? svg`<line x1="0" y1="12" x2="12" y2="0" stroke="currentColor" stroke-width="1.5"></line>`
                : nothing}
            </svg>
            <span part="label">${type.label}</span>
            ${count != null
              ? html`<span part="count">${getNumberFormat(this.effectiveLocale).format(count)}</span>`
              : nothing}
          `;
          return this.interactive
            ? html`<button
                part="item"
                type="button"
                aria-pressed=${visible ? 'true' : 'false'}
                ?data-hidden=${!visible}
                @click=${() => this.toggle(type)}
              >
                ${content}
              </button>`
            : html`<div part="item" ?data-hidden=${!visible}>${content}</div>`;
        })}
      </div>
      <div part="live-region" class="sr-only" aria-hidden="true">${this.liveText}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-graph-legend': LyraGraphLegend;
  }
}
