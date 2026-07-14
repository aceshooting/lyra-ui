import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { place } from '../../internal/positioner.js';
import { rtlAwarePlacement } from '../../internal/rtl.js';
import { styles } from './app-rail-item.styles.js';

/**
 * `<lyra-app-rail-item>` — an explicit icon/label navigation item for
 * `<lyra-app-rail>`. The rail sets its `icon-only` attribute as the viewport
 * changes, keeping the label available to assistive technology while removing
 * it from the visual layout.
 *
 * @customElement lyra-app-rail-item
 * @slot - The visible navigation label.
 * @slot icon - The leading icon.
 * @csspart base - The link or button receiving focus and activation.
 * @csspart icon - The icon wrapper.
 * @csspart label - The label wrapper; visually clipped in icon-only mode.
 * @csspart tooltip - The hover/focus label flyout, only rendered while `tooltip` is set, the item
 *   is `icon-only`, and it is hovered or focused.
 */
export class LyraAppRailItem extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Optional destination. Without `href`, the item renders as a button. */
  @property() href = '';

  /** Optional link target. */
  @property() target = '';

  /** Prevents activation while retaining the item in the rail. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Marks this as the destination for the current page/view. Reflects
   *  `aria-current="page"` on `[part="base"]` and drives the active visual
   *  treatment -- the rail has no built-in routing, so the consumer sets
   *  this per item (e.g. by comparing `href` against the current location). */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Opt-in hover/focus flyout showing this item's label text while `icon-only` (set externally by
   *  the parent `<lyra-app-rail>` as the viewport narrows) hides it from view -- an explicit,
   *  documented property instead of an unverified cross-browser `::part()` + `::after` + `attr()`
   *  composition. No effect outside icon-only mode, since the label is already visible there.
   *  `false` (the default) reproduces today's exact output. */
  @property({ type: Boolean, reflect: true }) tooltip = false;

  @state() private showTooltip = false;
  private stopPositioning?: () => void;

  private get tooltipText(): string {
    return this.getAttribute('aria-label') || this.textContent?.trim() || '';
  }

  private onFocusShow = (): void => {
    if (this.tooltip && this.hasAttribute('icon-only')) this.showTooltip = true;
  };

  private onBlurHide = (): void => {
    this.showTooltip = false;
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('showTooltip')) {
      this.stopPositioning?.();
      this.stopPositioning = undefined;
      if (this.showTooltip) {
        const anchor = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
        const popup = this.renderRoot.querySelector('[part="tooltip"]') as HTMLElement | null;
        // 'right' is a physical Floating UI placement -- resolve it through the
        // shared RTL helper (mirrors lyra-menu's identical resolution) so the
        // flyout still anchors to the rail item's trailing edge (away from the
        // rail) rather than staying pinned to the physical right under RTL.
        if (anchor && popup)
          this.stopPositioning = place(anchor, popup, { placement: rtlAwarePlacement('right', this) });
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPositioning?.();
  }

  render(): TemplateResult {
    const label = this.getAttribute('aria-label');
    const content = html`
      <span part="icon" aria-hidden=${label ? 'true' : nothing}><slot name="icon"></slot></span>
      <span part="label"><slot></slot></span>
      ${this.showTooltip ? html`<span part="tooltip" role="tooltip">${this.tooltipText}</span>` : nothing}
    `;
    if (this.href && !this.disabled) {
      return html`<a
        part="base"
        href=${this.href}
        target=${this.target || nothing}
        aria-label=${label || nothing}
        aria-current=${this.active ? 'page' : nothing}
        @mouseenter=${this.onFocusShow}
        @mouseleave=${this.onBlurHide}
        @focus=${this.onFocusShow}
        @blur=${this.onBlurHide}
      >${content}</a>`;
    }
    return html`<button
      part="base"
      type="button"
      ?disabled=${this.disabled}
      aria-disabled=${this.disabled ? 'true' : nothing}
      aria-label=${label || nothing}
      aria-current=${this.active ? 'page' : nothing}
      @mouseenter=${this.onFocusShow}
      @mouseleave=${this.onBlurHide}
      @focus=${this.onFocusShow}
      @blur=${this.onBlurHide}
    >${content}</button>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-app-rail-item': LyraAppRailItem;
  }
}

