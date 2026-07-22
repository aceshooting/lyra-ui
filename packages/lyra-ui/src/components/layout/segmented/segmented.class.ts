import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { styles } from './segmented.styles.js';

export interface SegmentedItem {
  value: string;
  label: string;
  /** Optional leading visual rendered before the label. This is intentionally general content,
   *  not a square-icon-only field: SVG icons, flag glyphs, badges, and other natural-aspect-ratio
   *  Lit content are supported. */
  icon?: unknown;
  disabled?: boolean;
}

export type LyraSegmentedSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

export interface LyraSegmentedEventMap {
  'lr-change': CustomEvent<{ value: string }>;
}

/**
 * `<lr-segmented>` — a single-select button row with the WAI-ARIA APG `radiogroup` contract
 * built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or
 * arrow-key move both select immediately, like a native radio group), cyclic Arrow/Home/End
 * navigation among non-disabled items. First-party invention --
 * "choose exactly one of N labeled options, rendered as a button row" is ubiquitous
 * settings/filter-panel UI. Supports the same `2xs`-`xl` compact-form-control `size` scale as
 * `<lr-select>`/`<lr-combobox>`/`<lr-input>`, so it can sit flush beside those controls in a
 * toolbar at a matching height.
 *
 * @customElement lr-segmented
 * @event lr-change - Fired when the selected value changes via click or keyboard.
 *   `detail: { value }`.
 * @method scrollToValue - `scrollToValue(value: string): void` — scroll the segment with the given
 *   `value` into view within the (possibly overflowing) track. Called automatically when `value`
 *   changes programmatically; exposed for the "reveal without selecting" case. Honors
 *   `prefers-reduced-motion`.
 * @csspart base - The `role="radiogroup"` root.
 * @csspart segment - A single `role="radio"` button.
 * @csspart segment-icon - Optional leading visual supplied by the item's `icon` field; content
 *   may have a natural aspect ratio and is not restricted to a square icon.
 * @csspart segment-label - The segment's label text.
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of the static fade at each horizontal scroll edge.
 * @cssprop [--lr-segmented-track-min-height=var(--lr-size-2-5rem)] - Minimum height of the `base`
 *   track. Re-set per `size` (`2xs` through `xl`); the `2.5rem` (40px) default applies at the
 *   unset/`m` size, matching `<lr-input>`/`<lr-select>`/`<lr-combobox>`'s own shared default-tier
 *   floor. Because it is declared on `:host` per tier, override it on the element itself, not on
 *   an ancestor.
 * @cssprop [--lr-segmented-track-height] - Exact height of the `base` track, pinning it at every
 *   `size` tier (sets both `block-size` and `min-block-size`) so the row can sit flush beside a
 *   hard-sized toolbar control. **Genuinely unset by default** — while unset each tier keeps its
 *   own `--lr-segmented-track-min-height` floor and the track grows with its content.
 * @cssprop [--lr-segmented-selected-bg=var(--lr-color-surface)] - Background of the checked
 *   segment. Scoped to `[aria-checked='true']` only, so it never repaints a hovered unselected
 *   segment (which is what hijacking `--lr-color-surface` library-wide used to do).
 * @cssprop [--lr-segmented-selected-color=var(--lr-color-text)] - Text color of the checked segment.
 * @cssprop [--lr-segmented-selected-font-weight=var(--lr-font-weight-semibold)] - Font weight of the
 *   checked segment.
 * @cssprop [--lr-segmented-selected-shadow=var(--lr-shadow)] - Box shadow lifting the checked
 *   segment off the track.
 * @cssprop [--lr-segmented-hover-color=var(--lr-color-text)] - Text color of a hovered segment that
 *   is neither checked nor disabled. Independent of the selected-state props above — recoloring the
 *   checked pill leaves this untouched.
 * @cssprop [--lr-segmented-segment-padding=var(--lr-size-0-125rem) var(--lr-space-s)] - Each
 *   segment's padding. Re-set per `size`; this default applies at the unset/`m` size.
 * @cssprop [--lr-segmented-font-size=var(--lr-font-size-sm)] - Each segment's font size. Re-set per
 *   `size`; this default applies at the unset/`m` size.
 */
export class LyraSegmented extends LyraElement<LyraSegmentedEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The button row's items. */
  @property({ attribute: false }) items: SegmentedItem[] = [];

  /** The currently selected item's `value`. */
  @property() value = '';

  /** Accessible name for the radiogroup, used when no visible label context
   *  exists around it (e.g. no wrapping `<label>` or adjacent heading). Set
   *  as `aria-label` on the `role="radiogroup"` element. A plain `aria-label`
   *  attribute on the host itself is honored as a fallback when this is left
   *  unset, matching `<lr-slider>`. */
  @property() label = '';

  /** Visual size — same `2xs`-`xl` scale as `<lr-select>`/`<lr-combobox>` (`s` through `xl`)
   *  and `<lr-input>` (`2xs`). Reflects as the `size` attribute. The default `m` tier is
   *  identical to this component's pre-`size` rendering, so leaving it unset never changes
   *  output. */
  @property({ reflect: true }) size: LyraSegmentedSize = 'm';

  private select(item: SegmentedItem): void {
    if (item.disabled || item.value === this.value) return;
    this.value = item.value;
    this.emit<{ value: string }>('lr-change', { value: item.value });
  }

  private segmentButton(value: string): HTMLElement | null {
    return this.renderRoot.querySelector(
      `[part="segment"][data-value="${CSS.escape(value)}"]`,
    ) as HTMLElement | null;
  }

  private focusItem(value: string): void {
    // Keyboard nav already reveals the focused segment implicitly (native focus() scrolls it into
    // view). scrollToValue below closes the equivalent gap for programmatic `value` changes.
    this.segmentButton(value)?.focus();
  }

  /** Scroll the segment with the given `value` into view within the (possibly overflowing) track.
   *  Public so a consumer can reveal a segment without selecting it. */
  scrollToValue(value: string): void {
    this.segmentButton(value)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Reveal a programmatically-changed selection. Guard the first render so an initial mount
    // never scrolls an ancestor page to the selected segment. Keyboard-driven changes already
    // reveal via focusItem()'s focus(), and re-scrolling there is harmless/idempotent.
    if (changed.has('value') && changed.get('value') !== undefined && this.value) {
      this.scrollToValue(this.value);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.items.filter((i) => !i.disabled);
    if (navigable.length === 0) return;
    const currentIndex = navigable.findIndex((i) => i.value === this.value);
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex: number;
    switch (e.key) {
      case forwardKey:
        targetIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % navigable.length;
        break;
      case backwardKey:
        targetIndex = currentIndex < 0 ? navigable.length - 1 : (currentIndex - 1 + navigable.length) % navigable.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = navigable.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = navigable[targetIndex]!;
    this.select(target);
    this.focusItem(target.value);
  };

  override render(): TemplateResult {
    const ariaLabel = this.label || this.getAttribute('aria-label') || nothing;
    // WAI-ARIA APG radiogroup: exactly one non-disabled radio is ever tabbable.
    // That's normally the checked item, but a fresh/cleared radiogroup has no
    // checked item at all -- falling back to `item.value === this.value` alone
    // would then match nothing and drop every button out of the tab order, so
    // fall back to the first non-disabled item when nothing is selected (or the
    // selected value doesn't match a current, non-disabled item).
    const selectedIndex = this.items.findIndex((item) => item.value === this.value && !item.disabled);
    const tabbableIndex = selectedIndex !== -1 ? selectedIndex : this.items.findIndex((item) => !item.disabled);
    return html`
      <div part="base" role="radiogroup" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${repeat(
          this.items,
          (item) => item.value,
          (item, index) => html`<button
            type="button"
            part="segment"
            data-value=${item.value}
            role="radio"
            aria-checked=${item.value === this.value ? 'true' : 'false'}
            aria-disabled=${item.disabled ? 'true' : 'false'}
            tabindex=${index === tabbableIndex ? '0' : '-1'}
            @click=${() => this.select(item)}
          >${item.icon ? html`<span part="segment-icon" aria-hidden="true">${item.icon}</span>` : nothing}<span part="segment-label">${item.label}</span></button>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-segmented': LyraSegmented;
  }
}
