import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  isComposedFocusAvailable,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import { deferredPlace as place } from '../../../internal/anchored-overlay-runtime.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { styles } from './app-rail-item.styles.js';

/**
 * `<lr-app-rail-item>` — an explicit icon/label navigation item for
 * `<lr-app-rail>`. The rail sets its `icon-only` attribute as the viewport
 * changes, keeping the label available to assistive technology while removing
 * it from the visual layout. `[part="base"]` resolves to a square hit target
 * (matching the icon-button footprint used elsewhere in this library) while
 * `icon-only`, instead of stretching across the rail's icon column.
 * A host `aria-label` is forwarded by attribute presence to the internal
 * focusable link or button, including an explicitly empty value.
 * When a focused link/button is replaced, focus follows an available replacement. If the new
 * owner is disabled or inert, focus returns to the available element that led into the item, or
 * to the stable owning rail surface when there is no return target; a newer external focus move
 * always wins.
 *
 * @customElement lr-app-rail-item
 * @slot - The visible navigation label.
 * @slot icon - The leading decorative icon. Its flattened subtree is inert and hidden from
 *   assistive technology; the default slot or host `aria-label` names the internal control.
 * @slot meta - Secondary trailing text -- an unread count, a keyboard shortcut. Rendered as a
 *   SIBLING of the internal link/button, never inside it, so it is not part of the item's
 *   accessible name and a pointer landing on it does not activate the item. Visually clipped in
 *   `icon-only` mode exactly as `[part="label"]` is, staying available to assistive technology.
 * @slot end - Trailing controls or adornments -- an overflow menu trigger, a status badge. Also a
 *   sibling of the internal link/button (the same shape `<lr-details>` uses for its
 *   `header-actions`), so a slotted control keeps its own click, keyboard activation and focus
 *   order instead of being swallowed by the item's own activation target. Unlike `meta` it stays
 *   visible in `icon-only` mode, where it shares the narrow rail's width with the icon.
 * @csspart base - The link or button receiving focus and activation.
 * @csspart icon - The icon wrapper.
 * @csspart label - The label wrapper; visually clipped in icon-only mode.
 * @csspart current-indicator - A decorative inline indicator rendered only while the item is
 *   `current`/`aria-current="page"`, mirroring `<lr-conversation-item>`'s shipped
 *   `active-indicator` part.
 * @csspart meta - The wrapper around the `meta` slot. Hidden while nothing is slotted into it, so
 *   an item without secondary text renders exactly as before the slot existed.
 * @csspart end - The wrapper around the `end` slot, following `[part="meta"]`. Hidden while empty
 *   for the same reason.
 * @csspart tooltip - The hover/focus label flyout, only rendered while `tooltip` is set, the item
 *   is `icon-only`, and it is hovered or focused.
 * @cssprop [--lr-app-rail-item-current-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `current`/`aria-current="page"` item. Scoped to `[aria-current='page']` only and declared as an
 *   inline `var()` fallback (never on `:host`), so setting it on the element or an ancestor recolors
 *   only the current item without hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-app-rail-item-current-color=var(--lr-color-brand)] - Text/icon color of the
 *   `current`/`aria-current="page"` item.
 * @cssprop [--lr-app-rail-item-current-font-weight=var(--lr-font-weight-semibold)] - Font weight
 *   of the `current`/`aria-current="page"` item, decoupled from the shared
 *   `--lr-font-weight-semibold` token so retheming it does not repaint every other semibold
 *   element on the page. Mirrors `<lr-stepper>`'s `--lr-stepper-current-font-weight` and
 *   `<lr-segmented>`'s `--lr-segmented-selected-font-weight`.
 * @cssprop [--lr-app-rail-item-current-indicator-color=var(--lr-color-brand)] - Color of the
 *   decorative `[part="current-indicator"]` while current.
 * @cssprop [--lr-app-rail-item-current-indicator-width=var(--lr-size-2px)] - Inline size of
 *   `[part="current-indicator"]` while current.
 * @cssprop [--lr-app-rail-item-current-indicator-inset-inline=0 auto] - Logical inline-start and
 *   inline-end insets for `[part="current-indicator"]`; set `auto 0` to place it at inline-end.
 * @cssprop [--lr-app-rail-item-hover-bg=var(--lr-color-brand-quiet)] - Hover background.
 * @cssprop [--lr-app-rail-item-hover-color=var(--lr-color-brand)] - Hover text/icon color.
 * @cssprop --lr-app-rail-item-active-bg - Pressed background; defaults to the former brand-quiet
 *   active mix.
 * @cssprop [--lr-app-rail-item-active-color=var(--lr-color-brand)] - Pressed text/icon color.
 * @cssprop [--lr-app-rail-item-min-block-size=var(--lr-icon-button-size)] - `[part="base"]`'s row
 *   height. Floor-clamped to `--lr-icon-button-size` regardless of the override, preserving the
 *   WCAG 2.5.8 hit-area minimum.
 * @cssprop [--lr-app-rail-item-padding=var(--lr-space-s)] - `[part="base"]`'s padding.
 * @cssprop [--lr-app-rail-item-gap=var(--lr-space-s)] - Gap between `[part="icon"]` and
 *   `[part="label"]`, and between the item's own control and its `[part="meta"]`/`[part="end"]`
 *   adornments.
 * @cssprop [--lr-app-rail-item-meta-color=var(--lr-color-text-quiet)] - `[part="meta"]`'s text
 *   color; quiet by default so a count reads as secondary to the label beside it.
 * @cssprop [--lr-app-rail-item-meta-font-size=var(--lr-font-size-sm)] - `[part="meta"]`'s
 *   font size.
 * @cssprop [--lr-app-rail-item-icon-size=var(--lr-icon-button-size)] - `[part="icon"]`'s inline
 *   size. Not floor-clamped -- the icon is decorative, not itself a pointer target.
 * @cssprop [--lr-app-rail-item-font-size=inherit] - `[part="base"]`'s font size, set after the
 *   `font` shorthand so it alone can be retuned while family/weight/line-height stay inherited.
 * @status stable
 * @since 4.0.0
 */
export class LyraAppRailItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'icon-only'];
  }

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
  @property({ type: Boolean, reflect: true }) current = false;

  /**
   * Deprecated alias for `current`, read alongside it.
   *
   * `active` was this property's original public name. It was renamed to `current` with no
   * changelog entry, no alias and no deprecation record, which broke every shipped consumer
   * silently: a Lit `.active=${...}` binding on a custom element is untyped, so it did not error --
   * it became a dead expando, leaving the rail with no current-item indicator and a permanent
   * `aria-current="false"`. Nothing in a consumer's type check, test suite or build could see that.
   *
   * Set either name; the item is current when either is true. Prefer `current`.
   *
   * @deprecated Use `current`.
   */
  @property({ type: Boolean, attribute: 'active' }) active = false;

  /** True when either the canonical `current` or its deprecated `active` alias is set. */
  private get isCurrent(): boolean {
    return this.current || this.active;
  }

  /** Opt-in hover/focus flyout showing this item's label text while `icon-only` (set externally by
   *  the parent `<lr-app-rail>` as the viewport narrows) hides it from view -- an explicit,
   *  documented property instead of an unverified cross-browser `::part()` + `::after` + `attr()`
   *  composition. No effect outside icon-only mode, since the label is already visible there.
   *  `false` (the default) reproduces today's exact output. */
  @property({ type: Boolean, reflect: true }) tooltip = false;

  @state() private showTooltip = false;
  /** `:empty` cannot see slotted light-DOM content (the wrapper always holds a `<slot>` element),
   *  so emptiness is tracked from `slotchange` the same way `<lr-details>` tracks its own
   *  `header-actions` wrapper. */
  @state() private hasEndSlot = false;
  @state() private hasMetaSlot = false;
  private stopPositioning?: () => void;
  private labelObserver?: MutationObserver;
  private semanticFocusRepair?: ComposedFocusRepairSnapshot;
  private focusReturnTarget?: HTMLElement;

  override connectedCallback(): void {
    super.connectedCallback();
    this.armLabelObserver();
  }

  private armLabelObserver(): void {
    this.labelObserver?.disconnect();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.labelObserver = new MutationObserverCtor(() => {
      if (this.showTooltip) this.requestUpdate();
    });
    this.labelObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  // Only the default slot's own content counts toward the tooltip text --
  // text incidentally living inside the (decorative) `icon` slot shouldn't
  // leak into the flyout label. Mirrors `lr-chip`'s `labelText` getter.
  private get labelText(): string {
    return Array.from(this.childNodes)
      .filter((node): node is Text | Element => {
        if (node.nodeType === 3) return true;
        if (node.nodeType !== 1) return false;
        return (node as Element).getAttribute('slot') !== 'icon';
      })
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }

  private get tooltipText(): string {
    return hostAriaLabel(this) ?? (this.labelText || '');
  }

  private onFocusShow = (event: Event): void => {
    if (this.tooltip && this.hasAttribute('icon-only')) this.showTooltip = true;
    if (event.type !== 'focus') return;
    const related = (event as FocusEvent).relatedTarget;
    if (related && (related as Node).nodeType === 1 && isComposedFocusAvailable(related as Element)) {
      this.focusReturnTarget = related as HTMLElement;
    }
  };

  private onBlurHide = (): void => {
    this.showTooltip = false;
  };

  private onEndSlotChange = (event: Event): void => {
    this.hasEndSlot = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(
      (node) => node.nodeType !== 3 || (node.textContent ?? '').trim() !== ''
    );
  };

  private onMetaSlotChange = (event: Event): void => {
    this.hasMetaSlot = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(
      (node) => node.nodeType !== 3 || (node.textContent ?? '').trim() !== ''
    );
  };

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name !== 'icon-only' || oldValue === newValue) return;
    if (newValue === null) this.showTooltip = false;
    this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('tooltip') && !this.tooltip) this.showTooltip = false;
    if (changed.has('href') || changed.has('disabled')) {
      const previous = this.renderRoot?.querySelector<HTMLElement>('[part="base"]') ?? null;
      const nextIsLink = Boolean(safeLinkHref(this.href)) && !this.disabled;
      const ownerReplaced = previous !== null && (previous.localName === 'a') !== nextIsLink;
      this.semanticFocusRepair = ownerReplaced && activeElementIn(this.shadowRoot) === previous
        ? captureComposedFocusRepair(this, this.focusFallback() ?? previous) ?? undefined
        : undefined;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const focusRepair = this.semanticFocusRepair;
    this.semanticFocusRepair = undefined;
    if (focusRepair) {
      this.scheduleAfterUpdate(() => {
        const replacement = this.renderRoot.querySelector<HTMLAnchorElement | HTMLButtonElement>(
          '[part="base"]',
        );
        const target = replacement && isComposedFocusAvailable(replacement)
          ? replacement
          : this.focusFallback();
        applyComposedFocusRepair(focusRepair, target);
      }, 'app-rail-item-owner-focus');
    }
    const popup = this.renderRoot.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement | null;
    if (!popup) {
      this.stopPositioning?.();
      this.stopPositioning = undefined;
      return;
    }
    if (changed.has('showTooltip') || !this.stopPositioning) {
      this.stopPositioning?.();
      const anchor = this.renderRoot.querySelector(
        '[part="base"]'
      ) as HTMLElement;
      // 'right' is a physical Floating UI placement -- resolve it through the
      // shared RTL helper (mirrors lr-menu's identical resolution) so the
      // flyout still anchors to the rail item's trailing edge (away from the
      // rail) rather than staying pinned to the physical right under RTL.
      this.stopPositioning = place(anchor, popup, {
        placement: rtlAwarePlacement('right', this),
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.semanticFocusRepair = undefined;
    this.focusReturnTarget = undefined;
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.stopPositioning?.();
    this.stopPositioning = undefined;
    this.showTooltip = false;
  }

  private focusFallback(): HTMLElement | null {
    if (this.focusReturnTarget && isComposedFocusAvailable(this.focusReturnTarget)) {
      return this.focusReturnTarget;
    }
    const rail = this.closest('lr-app-rail');
    const owner = rail?.shadowRoot?.querySelector<HTMLElement>('[part~="base"], [part~="panel"]') ?? null;
    return owner && isComposedFocusAvailable(owner) ? owner : null;
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
      ${this.isCurrent ? html`<span part="current-indicator" aria-hidden="true"></span>` : nothing}
      ${renderInertPresentation(html`<slot name="icon"></slot>`, { part: 'icon' })}
      <span part="label"><slot></slot></span>
    `;
    const tooltip = this.showTooltip && this.tooltip && this.hasAttribute('icon-only')
      ? html`<span part="tooltip" role="tooltip" aria-hidden="true">${this.tooltipText}</span>`
      : nothing;
    // Siblings of the activation target, never children of it: a control slotted here keeps its
    // own click/keyboard activation and focus order, and its text never joins the item's own
    // accessible name. Mirrors <lr-details>'s header-actions placement beside its native summary.
    const adornments = html`<span part="meta" ?hidden=${!this.hasMetaSlot}
        ><slot name="meta" @slotchange=${this.onMetaSlotChange}></slot></span
      ><span part="end" ?hidden=${!this.hasEndSlot}
        ><slot name="end" @slotchange=${this.onEndSlotChange}></slot></span
      >`;
    if (href && !this.disabled) {
      return html`
        <a
          part="base"
          href=${href}
          target=${this.target || nothing}
          rel=${this.target ? 'noopener noreferrer' : nothing}
          aria-label=${label ?? nothing}
          aria-disabled="false"
          aria-current=${this.isCurrent ? 'page' : 'false'}
          @mouseenter=${this.onFocusShow}
          @mouseleave=${this.onBlurHide}
          @focus=${this.onFocusShow}
          @blur=${this.onBlurHide}
        >${content}</a>${adornments}${tooltip}
      `;
    }
    return html`
      <button
        part="base"
        type="button"
        ?disabled=${this.disabled}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-label=${label ?? nothing}
        aria-current=${this.isCurrent ? 'page' : 'false'}
        @mouseenter=${this.onFocusShow}
        @mouseleave=${this.onBlurHide}
        @focus=${this.onFocusShow}
        @blur=${this.onBlurHide}
      >${content}</button>${adornments}${tooltip}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-app-rail-item': LyraAppRailItem;
  }
}
