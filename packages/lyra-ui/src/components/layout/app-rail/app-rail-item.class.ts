import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { hostAriaLabel } from "../../../internal/a11y.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { safeLinkHref } from "../../../internal/safe-url.js";
import { place } from "../../../internal/positioner.js";
import { rtlAwarePlacement } from "../../../internal/rtl.js";
import { styles } from "./app-rail-item.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-app-rail-item>` — an explicit icon/label navigation item for
 * `<lr-app-rail>`. The rail sets its `icon-only` attribute as the viewport
 * changes, keeping the label available to assistive technology while removing
 * it from the visual layout.
 * A host `aria-label` is forwarded by attribute presence to the internal
 * focusable link or button, including an explicitly empty value.
 *
 * @customElement lr-app-rail-item
 * @slot - The visible navigation label.
 * @slot icon - The leading icon.
 * @csspart base - The link or button receiving focus and activation.
 * @csspart icon - The icon wrapper.
 * @csspart label - The label wrapper; visually clipped in icon-only mode.
 * @csspart tooltip - The hover/focus label flyout, only rendered while `tooltip` is set, the item
 *   is `icon-only`, and it is hovered or focused.
 * @cssprop [--lr-app-rail-item-current-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `active`/`aria-current="page"` item. Scoped to `[aria-current='page']` only and declared as an
 *   inline `var()` fallback (never on `:host`), so setting it on the element or an ancestor recolors
 *   only the current item without hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-app-rail-item-current-color=var(--lr-color-brand)] - Text/icon color of the
 *   `active`/`aria-current="page"` item.
 * @cssprop [--lr-app-rail-item-hover-bg=var(--lr-color-brand-quiet)] - Hover background.
 * @cssprop [--lr-app-rail-item-hover-color=var(--lr-color-brand)] - Hover text/icon color.
 * @cssprop --lr-app-rail-item-active-bg - Pressed background; defaults to the former brand-quiet
 *   active mix.
 * @cssprop [--lr-app-rail-item-active-color=var(--lr-color-brand)] - Pressed text/icon color.
 * @status stable
 * @since 4.0.0
 */
export class LyraAppRailItem extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "icon-only"];
  }

  /** Optional destination. Without `href`, the item renders as a button. */
  @property() href = "";

  /** Optional link target. */
  @property() target = "";

  /** Prevents activation while retaining the item in the rail. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Marks this as the destination for the current page/view. Reflects
   *  `aria-current="page"` on `[part="base"]` and drives the active visual
   *  treatment -- the rail has no built-in routing, so the consumer sets
   *  this per item (e.g. by comparing `href` against the current location). */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Opt-in hover/focus flyout showing this item's label text while `icon-only` (set externally by
   *  the parent `<lr-app-rail>` as the viewport narrows) hides it from view -- an explicit,
   *  documented property instead of an unverified cross-browser `::part()` + `::after` + `attr()`
   *  composition. No effect outside icon-only mode, since the label is already visible there.
   *  `false` (the default) reproduces today's exact output. */
  @property({ type: Boolean, reflect: true }) tooltip = false;

  @state() private showTooltip = false;
  private stopPositioning?: () => void;

  // Only the default slot's own content counts toward the tooltip text --
  // text incidentally living inside the (decorative) `icon` slot shouldn't
  // leak into the flyout label. Mirrors `lr-chip`'s `labelText` getter.
  private get labelText(): string {
    return Array.from(this.childNodes)
      .filter((node): node is Text | Element => {
        if (node.nodeType === 3) return true;
        if (node.nodeType !== 1) return false;
        return (node as Element).getAttribute("slot") !== "icon";
      })
      .map((n) => n.textContent ?? "")
      .join("")
      .trim();
  }

  private get tooltipText(): string {
    return hostAriaLabel(this) ?? (this.labelText || "");
  }

  private onFocusShow = (): void => {
    if (this.tooltip && this.hasAttribute("icon-only")) this.showTooltip = true;
  };

  private onBlurHide = (): void => {
    this.showTooltip = false;
  };

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name !== "icon-only" || oldValue === newValue) return;
    if (newValue === null) this.showTooltip = false;
    this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has("tooltip") && !this.tooltip) this.showTooltip = false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const popup = this.renderRoot.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement | null;
    if (!popup) {
      this.stopPositioning?.();
      this.stopPositioning = undefined;
      return;
    }
    if (changed.has("showTooltip") || !this.stopPositioning) {
      this.stopPositioning?.();
      const anchor = this.renderRoot.querySelector(
        '[part="base"]'
      ) as HTMLElement;
      // 'right' is a physical Floating UI placement -- resolve it through the
      // shared RTL helper (mirrors lr-menu's identical resolution) so the
      // flyout still anchors to the rail item's trailing edge (away from the
      // rail) rather than staying pinned to the physical right under RTL.
      this.stopPositioning = place(anchor, popup, {
        placement: rtlAwarePlacement("right", this),
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPositioning?.();
    this.stopPositioning = undefined;
    this.showTooltip = false;
  }

  /** Activates the internal link or button. Disabled items remain inert. */
  override click(): void {
    if (this.disabled) return;
    this.renderRoot
      .querySelector<HTMLAnchorElement | HTMLButtonElement>('[part~="base"]')
      ?.click();
  }

  override render(): TemplateResult {
    const label = hostAriaLabel(this);
    const href = safeLinkHref(this.href);
    const content = html`
      <span part="icon" aria-hidden="true"><slot name="icon"></slot></span>
      <span part="label"><slot></slot></span>
      ${this.showTooltip && this.tooltip && this.hasAttribute("icon-only")
        ? html`<span part="tooltip" role="tooltip">${this.tooltipText}</span>`
        : nothing}
    `;
    if (href && !this.disabled) {
      return html`<a
        part="base"
        href=${href}
        target=${this.target || nothing}
        rel=${this.target ? "noopener noreferrer" : nothing}
        aria-label=${label ?? nothing}
        aria-disabled="false"
        aria-current=${this.active ? "page" : nothing}
        @mouseenter=${this.onFocusShow}
        @mouseleave=${this.onBlurHide}
        @focus=${this.onFocusShow}
        @blur=${this.onBlurHide}
        >${content}</a
      >`;
    }
    return html`<button
      part="base"
      type="button"
      ?disabled=${this.disabled}
      aria-disabled=${this.disabled ? "true" : "false"}
      aria-label=${label ?? nothing}
      aria-current=${this.active ? "page" : nothing}
      @mouseenter=${this.onFocusShow}
      @mouseleave=${this.onBlurHide}
      @focus=${this.onFocusShow}
      @blur=${this.onBlurHide}
    >
      ${content}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-app-rail-item": LyraAppRailItem;
  }
}
