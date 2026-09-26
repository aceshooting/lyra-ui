import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { isComposedFocusAvailable } from '../../../internal/focus-navigation.js';
import { menuIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { composedContains, deepActiveElement } from '../../../internal/nonmodal-overlay-manager.js';
import { finiteDuration, finiteRange } from '../../../internal/numbers.js';
import { collectFocusableElements } from '../../../internal/overlay-stack.js';
import { tag } from '../../../internal/prefix.js';
import {
  bindNavigationMenuItem,
  navigationMenuItemController,
  releaseNavigationMenuItem,
  type NavigationMenuCloseOptions,
  type NavigationMenuItemController,
  type NavigationMenuLayout,
  type NavigationMenuMorph,
  type NavigationMenuOwnerContext,
  type NavigationMenuToggleSource,
} from './navigation-menu-owner.js';
import { styles } from './navigation-menu.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel, LYRA_DEFAULT_navigation } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** What a floating panel is positioned against: the whole item row, or its own trigger. */
export type LyraNavigationMenuPanelAnchor = 'menu' | 'item';

/** How an `expanded` change began. */
export type LyraNavigationMenuExpandedChangeSource = 'user' | 'programmatic';

/** Payload emitted with `lr-expanded-change` after a change to `expanded` renders. */
export interface LyraNavigationMenuExpandedChangeDetail {
  expanded: boolean;
  source: LyraNavigationMenuExpandedChangeSource;
}

export interface LyraNavigationMenuEventMap {
  'lr-expanded-change': CustomEvent<LyraNavigationMenuExpandedChangeDetail>;
}

const PANEL_ANCHOR = literalSetConverter<LyraNavigationMenuPanelAnchor>(['menu', 'item'], 'menu');

const DEFAULT_SHOW_DELAY = 200;
const DEFAULT_HIDE_DELAY = 150;
const DEFAULT_SKIP_DELAY = 300;
const DEFAULT_DISTANCE = 6;

/** In-panel arrow keys belong to these controls; fields and composite widgets keep their own. */
const PANEL_KEY_ORIGIN = 'a[href], button, [role="link"], [role="button"]';

const IGNORED_CHILDREN = new Set(['template', 'script', 'style']);

interface PendingTimer {
  readonly item: HTMLElement;
  readonly id: number;
  readonly view: Window;
}

interface IndicatorBox {
  readonly start: number;
  readonly size: number;
  readonly top: number;
  readonly visible: boolean;
}

function isElementNode(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

function isAnchorWithHref(value: EventTarget): boolean {
  return isElementNode(value) && value.localName === 'a' && value.hasAttribute('href');
}

/**
 * `<lr-navigation-menu>` — a site-header navigation bar following the WAI-ARIA disclosure
 * navigation pattern: a `nav` landmark holding a list of `<lr-navigation-menu-item>` links and
 * disclosure buttons whose flyout panels share one region below the bar. It never uses menu
 * roles; application menus belong to `lr-menu`.
 *
 * Panels open on hover (after `show-delay`), on click, and on Enter or Space; only one is open at
 * a time, and moving the pointer to another trigger switches immediately while the shared panel
 * region resizes to the new content. A click pins a hover-opened panel. Arrow keys move between
 * top-level items (swapped under right-to-left text), ArrowDown enters an open panel, Escape
 * closes it, and a press outside, focus leaving the item, or activating a link closes it too.
 *
 * With `mobile-breakpoint` set, the menu collapses when its own allocated inline size is at or
 * below that length: a "Menu" toggle then shows and hides the list as an in-flow column, and each
 * panel opens in place below its trigger. The same nodes serve both layouts. Unset, the menu never
 * collapses and its row wraps instead.
 *
 * The host defaults to `flex: 1 1 0%`, so a flex-row header allocates the menu the remaining space
 * rather than its content size; a content-sized collapsed menu could otherwise never measure wide
 * enough to leave the collapsed layout. Give it `flex: none` in a column flex parent, and a
 * definite inline size in shrink-to-fit contexts (an auto grid track, inline-flex, floats,
 * absolute positioning).
 *
 * Keep header chrome such as a logo, search or actions outside the menu: every default-slot child
 * renders inside the list. Several menus on one page need distinct `aria-label` values.
 *
 * Animations resolve through `navigation-menu.show`, `navigation-menu.hide`,
 * `navigation-menu.enter-from-start` and `navigation-menu.enter-from-end` in the public animation
 * registry, with this element as the registry host for every owned item.
 *
 * @customElement lr-navigation-menu
 * @slot - `<lr-navigation-menu-item>` children.
 * @slot toggle-icon - Replaces the hamburger glyph of the collapsed-layout toggle. The wrapper is
 *   inert and `aria-hidden`.
 * @event lr-expanded-change - A change to `expanded` rendered. Not cancelable.
 *   `detail: { expanded: boolean, source: 'user' | 'programmatic' }`.
 * @csspart base - The `nav` landmark.
 * @csspart list - The `role="list"` row, or column while collapsed.
 * @csspart toggle - The collapsed-layout toggle button, rendered only while collapsed.
 * @csspart toggle-icon - The toggle glyph wrapper.
 * @csspart toggle-label - The toggle's visible text.
 * @csspart indicator - Decorative track under the open trigger, rendered only with `indicator`
 *   in the bar layout.
 * @csspart indicator-arrow - The notch inside the indicator.
 * @cssprop [--lr-navigation-menu-gap=var(--lr-space-xs)] - Gap between items, in both layouts.
 * @cssprop [--lr-navigation-menu-toggle-active-color=var(--lr-color-text)] - Text colour of the
 *   collapsed-layout toggle while it is pressed or open.
 * @cssprop [--lr-navigation-menu-indicator-size=var(--lr-size-0-375rem)] - Block size of the
 *   indicator.
 * @cssprop [--lr-navigation-menu-indicator-color=var(--lr-overlay-border,var(--lr-color-border-subtle))] -
 *   Colour of the indicator notch, matching the panel edge by default.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override read by the items
 *   when their panels are positioned.
 * @cssstate collapsed - Present while the collapsed layout is active.
 * @status experimental
 * @since unreleased
 */
export class LyraNavigationMenu extends LyraElement<LyraNavigationMenuEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
    navigation: LYRA_DEFAULT_navigation,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Accessible name of the `nav` landmark, mapped to the host `aria-label` attribute. Attribute
   * presence wins, so `aria-label=""` leaves the landmark deliberately unnamed; with no value the
   * landmark is named with the localized "Navigation". */
  @property({ attribute: 'aria-label' }) accessibleLabel?: string;

  /** Allocation breakpoint: the menu collapses while its content-box inline size is at or below
   * this length. Accepts a bare number or a `px`, `rem` or `em` length. Unset or unresolvable
   * means the menu never collapses. */
  @property({ attribute: 'mobile-breakpoint' }) mobileBreakpoint?: string;

  private _expanded = false;

  /**
   * Whether the item list shows in the collapsed layout. Kept while the bar layout is active and
   * applied at the next collapse; reset to `false` when the menu leaves the collapsed layout.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get expanded(): boolean {
    return this._expanded;
  }
  set expanded(next: boolean) {
    this.setExpanded(Boolean(next), this.hasUpdated ? 'programmatic' : null);
  }

  /** Shows a decorative indicator under the trigger whose panel is open. */
  @property({ type: Boolean, reflect: true }) indicator = false;

  private _panelAnchor: LyraNavigationMenuPanelAnchor = 'menu';

  /**
   * What a floating panel is positioned against: `menu` aligns every panel with the start edge of
   * the item row, so switching panels resizes one shared region in place; `item` aligns each panel
   * with its own trigger. Unsupported values normalize to `menu`.
   * @default 'menu'
   */
  @property({ attribute: 'panel-anchor', reflect: true, converter: PANEL_ANCHOR })
  get panelAnchor(): LyraNavigationMenuPanelAnchor {
    return this._panelAnchor;
  }
  set panelAnchor(next: LyraNavigationMenuPanelAnchor) {
    const normalized = PANEL_ANCHOR.normalizeReflected(this, 'panel-anchor', next);
    if (normalized === this._panelAnchor) return;
    const old = this._panelAnchor;
    this._panelAnchor = normalized;
    this.requestUpdate('panelAnchor', old);
  }

  /** Delay (ms) before a hovered trigger opens its panel. Non-finite values use the default;
   * negative values behave like `0`, which opens in the same turn. */
  @property({ type: Number, attribute: 'show-delay' }) showDelay = DEFAULT_SHOW_DELAY;

  /** Delay (ms) before a hover-opened panel closes once the pointer leaves the item. */
  @property({ type: Number, attribute: 'hide-delay' }) hideDelay = DEFAULT_HIDE_DELAY;

  /** Hover grace window (ms): a hover that arrives this soon after a panel closed opens
   * immediately. `0` disables it. */
  @property({ type: Number, attribute: 'skip-delay' }) skipDelay = DEFAULT_SKIP_DELAY;

  /** Gap (px) between the anchor and a floating panel. Negative values clamp to `0`. */
  @property({ type: Number }) distance = DEFAULT_DISTANCE;

  @state() private collapsedLayout = false;
  @state() private indicatorBox?: IndicatorBox;

  /** Whether the collapsed layout is active. Mirrored to the `collapsed` custom state. */
  get collapsed(): boolean {
    return this.collapsedLayout;
  }

  private readonly listId = nextId('navigation-menu-list');
  private readonly menuInternals = attachInternalsSafely(this);
  private readonly ownedRoles = new WeakSet<HTMLElement>();
  private readonly context: NavigationMenuOwnerContext = {
    owner: this,
    layout: () => this.layout,
    anchor: (item) =>
      this._panelAnchor === 'item' ? (this.controllerFor(item)?.base() ?? null) : this.listElement,
    distance: () => finiteRange(this.distance, DEFAULT_DISTANCE, 0),
    activate: (item) => this.activateItem(item),
    willOpen: (item) => this.itemWillOpen(item),
    changed: (item, open, source) => this.itemChanged(item, open, source),
    escape: (item) => this.itemEscape(item),
  };
  private items: HTMLElement[] = [];
  private openItem?: HTMLElement;
  private showTimer?: PendingTimer;
  private hideTimer?: PendingTimer;
  private lastCloseAt = Number.NEGATIVE_INFINITY;
  private pressActive = false;
  private pressOpenItem?: HTMLElement;
  private pressDocument?: Document;
  private pressTimer?: { id: number; view: Window };
  private lightDismissDocument?: Document;
  private resizeObserver?: ResizeObserver;
  private observedIndicatorTargets = new Set<Element>();
  private lastInlineSize?: number;
  private allocationFrame?: { id: number; view: Window };
  private pendingFocus?: 'toggle' | 'first-base';
  private indicatorQueued = false;
  private lastDirection?: 'ltr' | 'rtl';

  private get layout(): NavigationMenuLayout {
    return this.collapsedLayout ? 'stacked' : 'bar';
  }

  private get listElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('[part~="list"]') ?? null;
  }

  private get toggleElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('[part~="toggle"]') ?? null;
  }

  private controllerFor(item: HTMLElement | undefined): NavigationMenuItemController | undefined {
    return item ? navigationMenuItemController(item) : undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('pointerover', this.onPointerOver);
    this.addEventListener('pointerout', this.onPointerOut);
    this.addEventListener('pointerdown', this.onPointerDownCapture, true);
    this.addEventListener('click', this.onClickCapture, true);
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('focusout', this.onFocusOut);
    this.observeAllocation();
    if (this.hasUpdated) {
      this.updateBrowserDerivedState(() => this.bindItems());
    }
  }

  override disconnectedCallback(): void {
    this.removeEventListener('pointerover', this.onPointerOver);
    this.removeEventListener('pointerout', this.onPointerOut);
    this.removeEventListener('pointerdown', this.onPointerDownCapture, true);
    this.removeEventListener('click', this.onClickCapture, true);
    this.removeEventListener('keydown', this.onKeyDown);
    this.removeEventListener('focusout', this.onFocusOut);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.cancelAllocationFrame();
    this.observedIndicatorTargets.clear();
    this.stopLightDismiss();
    this.cancelShow();
    this.cancelHide();
    this.clearPress();
    for (const item of this.items) this.releaseItem(item);
    this.items = [];
    super.disconnectedCallback();
  }

  /**
   * Closes the open panel and collapses an expanded list, as after a single-page route change.
   * Focus moves only when the close would hide the focused element: to that item's trigger, or to
   * the toggle when the collapsed list hides. A router's own later focus call still wins.
   */
  close(): void {
    this.cancelShow();
    this.cancelHide();
    const listHides = this.collapsedLayout && this._expanded;
    this.closeOpenItem(
      'programmatic',
      listHides ? { focusTarget: this.toggleElement } : {},
    );
    this.setExpanded(false, 'programmatic');
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Binding writes item and menu state; do it outside the update that just completed.
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.updateBrowserDerivedState(() => this.bindItems());
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('mobileBreakpoint') && this.hasUpdated) {
      this.applyAllocation(this.measureContentInlineSize());
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocus;
    this.pendingFocus = undefined;
    if (pending === 'toggle') this.toggleElement?.focus({ preventScroll: true });
    else if (pending === 'first-base') this.firstNavigableBase()?.focus({ preventScroll: true });

    const direction = this.effectiveDirection;
    const directionChanged = this.lastDirection !== undefined && direction !== this.lastDirection;
    this.lastDirection = direction;
    if (changed.has('distance') || changed.has('panelAnchor') || directionChanged) {
      this.controllerFor(this.openItem)?.reposition();
    }
    if (
      changed.has('indicator') ||
      changed.has('panelAnchor') ||
      changed.has('collapsedLayout') ||
      directionChanged
    ) {
      this.observeIndicatorTargets();
      this.queueIndicatorMeasure();
    }
  }

  private bindItems(): void {
    if (!this.isConnected) return;
    const slot = this.renderRoot?.querySelector<HTMLSlotElement>('[part~="list"] > slot');
    const assigned = slot
      ? slot.assignedElements()
      : [...this.children].filter((child) => !child.hasAttribute('slot'));
    const itemTag = tag('navigation-menu-item');
    const next: HTMLElement[] = [];
    for (const child of assigned) {
      if (child.localName === itemTag) {
        next.push(child as HTMLElement);
      } else if (!IGNORED_CHILDREN.has(child.localName)) {
        devWarnOnce(
          'lr-navigation-menu:non-item-child',
          `<${tag('navigation-menu')}> received <${child.localName}> in its default slot, which ` +
            `renders inside its list without a list item role. Only <${itemTag}> children belong ` +
            'there; place header chrome such as a logo, search or actions outside the menu.',
        );
      }
    }
    const kept = new Set(next);
    for (const previous of this.items) if (!kept.has(previous)) this.releaseItem(previous);
    for (const item of next) {
      bindNavigationMenuItem(item, this.context);
      if (!item.hasAttribute('role')) {
        item.setAttribute('role', 'listitem');
        this.ownedRoles.add(item);
      }
    }
    this.items = next;
    // One open item: the one already tracked, or else the first in DOM order. The others close
    // silently -- reconciling markup or a reconnect is not a user transition.
    // A hover-opened item drops its open state silently on detach, so a reattached one can come
    // back closed while still tracked; a stale reference would swallow its next hover open.
    if (this.openItem && (!kept.has(this.openItem) || !this.controllerFor(this.openItem)?.isOpen())) {
      this.openItem = undefined;
    }
    for (const item of next) {
      const controller = this.controllerFor(item);
      if (!controller?.isOpen()) continue;
      if (!this.openItem) this.openItem = item;
      else if (this.openItem !== item) controller.close(null, { repairFocus: false, instant: true });
    }
    if (this.openItem && this.layout === 'bar') this.startLightDismiss();
    else this.stopLightDismiss();
    this.observeIndicatorTargets();
    this.queueIndicatorMeasure();
  }

  private releaseItem(item: HTMLElement): void {
    releaseNavigationMenuItem(item, this);
    if (this.ownedRoles.has(item)) {
      if (item.getAttribute('role') === 'listitem') item.removeAttribute('role');
      this.ownedRoles.delete(item);
    }
    if (this.showTimer?.item === item) this.cancelShow();
    if (this.hideTimer?.item === item) this.cancelHide();
    if (this.openItem === item) {
      this.openItem = undefined;
      this.stopLightDismiss();
    }
  }

  private readonly onSlotChange = (): void => {
    this.updateBrowserDerivedState(() => this.bindItems());
  };

  private now(): number {
    return this.ownerDocument.defaultView?.performance.now() ?? Date.now();
  }

  private isNavigable(item: HTMLElement): boolean {
    if (
      item.hidden ||
      item.inert ||
      item.closest('[inert]') !== null ||
      item.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }
    const base = this.controllerFor(item)?.base();
    return base !== null && base !== undefined && isComposedFocusAvailable(base);
  }

  private firstNavigableBase(): HTMLElement | null {
    const item = this.items.find((candidate) => this.isNavigable(candidate));
    return this.controllerFor(item)?.base() ?? null;
  }

  private itemContaining(target: EventTarget | undefined): HTMLElement | undefined {
    if (!isElementNode(target)) return undefined;
    return this.items.find((item) => composedContains(item, target));
  }

  /** Focus inside the item's panel -- never on its own trigger, where a click or focus return
   * routinely leaves it. */
  private focusWithinPanel(item: HTMLElement): boolean {
    const active = deepActiveElement(this.ownerDocument);
    if (!active || !composedContains(item, active)) return false;
    const base = this.controllerFor(item)?.base();
    return !(base && composedContains(base, active));
  }

  private closeOpenItem(
    source: NavigationMenuToggleSource | null,
    options: NavigationMenuCloseOptions = {},
  ): void {
    this.controllerFor(this.openItem)?.close(source, options);
  }

  private activateItem(item: HTMLElement): void {
    const controller = this.controllerFor(item);
    if (!controller) return;
    this.cancelShow();
    this.cancelHide();
    if (controller.isTrigger()) {
      if (!controller.isOpen()) {
        controller.open('pinned', 'user');
      } else if (this.layout === 'bar' && controller.mode() === 'hover') {
        controller.pin();
      } else {
        controller.close('user');
      }
      return;
    }
    this.closeOpenItem('user');
    if (this.layout === 'stacked') this.setExpanded(false, 'user');
  }

  private itemWillOpen(item: HTMLElement): NavigationMenuMorph | undefined {
    if (this.showTimer?.item !== item) this.cancelShow();
    const current = this.openItem;
    if (!current || current === item) return undefined;
    const currentController = this.controllerFor(current);
    let morph: NavigationMenuMorph | undefined;
    if (
      this.layout === 'bar' &&
      this._panelAnchor === 'menu' &&
      !prefersReducedMotion(this.ownerDocument.defaultView)
    ) {
      const panel = currentController?.panel();
      const from = panel && !panel.hidden ? panel.getBoundingClientRect() : undefined;
      if (from && from.width > 0 && from.height > 0) {
        morph = {
          from,
          direction: this.items.indexOf(item) > this.items.indexOf(current) ? 'end' : 'start',
        };
      }
    }
    currentController?.close('peer', {
      instant: true,
      focusTarget: this.controllerFor(item)?.base() ?? null,
    });
    return morph;
  }

  private itemChanged(item: HTMLElement, open: boolean, source: NavigationMenuToggleSource | null): void {
    if (open) {
      this.openItem = item;
      if (this.hideTimer?.item === item) this.cancelHide();
      if (this.layout === 'bar') this.startLightDismiss();
    } else if (this.openItem === item) {
      this.openItem = undefined;
      if (this.layout === 'bar' && source !== 'peer') this.lastCloseAt = this.now();
      if (this.hideTimer?.item === item) this.cancelHide();
      this.stopLightDismiss();
    }
    this.observeIndicatorTargets();
    this.queueIndicatorMeasure();
  }

  private itemEscape(item: HTMLElement): void {
    this.cancelShow();
    this.cancelHide();
    const within = composedContains(item, deepActiveElement(this.ownerDocument));
    this.controllerFor(item)?.close('user', { repairFocus: false, restoreFocus: within });
  }

  // Hover ------------------------------------------------------------------------------------

  private readonly onPointerOver = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || this.layout !== 'bar') return;
    const target = event.composedPath()[0];
    const item = this.itemContaining(target);
    const controller = this.controllerFor(item);
    if (!item || !controller || !isElementNode(target)) return;
    if (this.openItem === item) {
      // Back within the open item: its trigger, panel, slotted content or hover bridge.
      if (this.hideTimer?.item === item) this.cancelHide();
      return;
    }
    const base = controller.base();
    if (!base || !composedContains(base, target)) return;
    if (controller.isTrigger()) this.hoverTrigger(item);
    else this.hoverNonTrigger();
  };

  private readonly onPointerOut = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || this.layout !== 'bar') return;
    const item = this.itemContaining(event.composedPath()[0]);
    if (!item) return;
    const next = event.relatedTarget;
    if (isElementNode(next) && composedContains(item, next)) return;
    if (this.showTimer?.item === item) this.cancelShow();
    this.requestHoverClose(item);
  };

  private hoverTrigger(item: HTMLElement): void {
    this.cancelHide();
    const open = this.openItem;
    if (open && open !== item) {
      // Switching would hide the element the user is working in; only a click or key switches.
      if (this.focusWithinPanel(open)) return;
      this.cancelShow();
      this.controllerFor(item)?.open('hover', 'user');
      return;
    }
    if (this.showTimer?.item === item) return;
    const skip = finiteDuration(this.skipDelay, DEFAULT_SKIP_DELAY);
    if (skip > 0 && this.now() - this.lastCloseAt <= skip) {
      this.cancelShow();
      this.controllerFor(item)?.open('hover', 'user');
      return;
    }
    this.scheduleShow(item);
  }

  private hoverNonTrigger(): void {
    this.cancelShow();
    const open = this.openItem;
    if (open) this.requestHoverClose(open);
  }

  private requestHoverClose(item: HTMLElement): void {
    if (this.openItem !== item) return;
    if (this.controllerFor(item)?.mode() !== 'hover' || this.focusWithinPanel(item)) return;
    this.scheduleHide(item);
  }

  private scheduleShow(item: HTMLElement): void {
    this.cancelShow();
    const delay = finiteDuration(this.showDelay, DEFAULT_SHOW_DELAY);
    const view = this.ownerDocument.defaultView;
    const commit = (): void => {
      if (this.layout !== 'bar' || !this.items.includes(item)) return;
      const open = this.openItem;
      if (open && open !== item && this.focusWithinPanel(open)) return;
      this.controllerFor(item)?.open('hover', 'user');
    };
    if (!view || delay <= 0) {
      commit();
      return;
    }
    const id = view.setTimeout(() => {
      if (this.showTimer?.id !== id) return;
      this.showTimer = undefined;
      commit();
    }, delay);
    this.showTimer = { item, id, view };
  }

  private scheduleHide(item: HTMLElement): void {
    this.cancelHide();
    const delay = finiteDuration(this.hideDelay, DEFAULT_HIDE_DELAY);
    const view = this.ownerDocument.defaultView;
    const commit = (): void => {
      if (this.openItem !== item) return;
      const controller = this.controllerFor(item);
      if (controller?.mode() !== 'hover' || this.focusWithinPanel(item)) return;
      controller.close('user');
    };
    if (!view || delay <= 0) {
      commit();
      return;
    }
    const id = view.setTimeout(() => {
      if (this.hideTimer?.id !== id) return;
      this.hideTimer = undefined;
      commit();
    }, delay);
    this.hideTimer = { item, id, view };
  }

  private cancelShow(): void {
    const timer = this.showTimer;
    this.showTimer = undefined;
    if (timer) timer.view.clearTimeout(timer.id);
  }

  private cancelHide(): void {
    const timer = this.hideTimer;
    this.hideTimer = undefined;
    if (timer) timer.view.clearTimeout(timer.id);
  }

  // Dismissal --------------------------------------------------------------------------------

  private startLightDismiss(): void {
    const doc = this.ownerDocument;
    if (!this.isConnected || this.lightDismissDocument === doc) return;
    this.stopLightDismiss();
    doc.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.lightDismissDocument = doc;
  }

  private stopLightDismiss(): void {
    this.lightDismissDocument?.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.lightDismissDocument = undefined;
  }

  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    const open = this.openItem;
    const controller = this.controllerFor(open);
    if (!open || !controller || this.layout !== 'bar' || !controller.isTopmost()) return;
    const path = event.composedPath();
    if (path.includes(open)) return;
    // A press on another trigger is the first half of a switch; its click performs it.
    for (const item of this.items) {
      if (item === open) continue;
      const other = this.controllerFor(item);
      const base = other?.base();
      if (other?.isTrigger() && base && path.includes(base)) return;
    }
    this.cancelShow();
    this.cancelHide();
    controller.close('user', { repairFocus: false });
  };

  private readonly onPointerDownCapture = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    this.clearPressTimer();
    this.pressActive = true;
    this.pressOpenItem = this.openItem;
    const doc = this.ownerDocument;
    if (this.pressDocument === doc) return;
    this.stopPressListeners();
    doc.addEventListener('pointerup', this.onPressEnd, true);
    doc.addEventListener('pointercancel', this.onPressEnd, true);
    this.pressDocument = doc;
  };

  /** Re-evaluates one task after the release, once the click it produces has run any switch. */
  private readonly onPressEnd = (): void => {
    this.stopPressListeners();
    this.clearPressTimer();
    const view = this.ownerDocument.defaultView;
    if (!view) {
      this.clearPress();
      return;
    }
    const id = view.setTimeout(() => {
      if (this.pressTimer?.id !== id) return;
      this.pressTimer = undefined;
      this.reevaluatePress();
    }, 0);
    this.pressTimer = { id, view };
  };

  private reevaluatePress(): void {
    const pressed = this.pressOpenItem;
    this.pressActive = false;
    this.pressOpenItem = undefined;
    if (!pressed || pressed !== this.openItem || this.layout !== 'bar') return;
    const controller = this.controllerFor(pressed);
    if (!controller?.isOpen()) return;
    const doc = this.ownerDocument;
    const active = deepActiveElement(doc);
    if (!active || active === doc.body || active === doc.documentElement) return;
    if (composedContains(pressed, active)) return;
    controller.close('user', { repairFocus: false });
  }

  private stopPressListeners(): void {
    this.pressDocument?.removeEventListener('pointerup', this.onPressEnd, true);
    this.pressDocument?.removeEventListener('pointercancel', this.onPressEnd, true);
    this.pressDocument = undefined;
  }

  private clearPressTimer(): void {
    const timer = this.pressTimer;
    this.pressTimer = undefined;
    if (timer) timer.view.clearTimeout(timer.id);
  }

  private clearPress(): void {
    this.stopPressListeners();
    this.clearPressTimer();
    this.pressActive = false;
    this.pressOpenItem = undefined;
  }

  private readonly onFocusOut = (event: FocusEvent): void => {
    const open = this.openItem;
    if (!open || this.layout !== 'bar') return;
    const target = event.composedPath()[0];
    if (!isElementNode(target) || !composedContains(open, target)) return;
    const next = event.relatedTarget;
    if (!isElementNode(next) || composedContains(open, next)) return;
    if (this.pressActive) return;
    this.cancelShow();
    this.cancelHide();
    this.controllerFor(open)?.close('user', { repairFocus: false });
  };

  /** A plain primary click on a panel link or a link item closes the open panel, even when a
   * router prevents the navigation. Capture phase, so a router that stops propagation cannot
   * hide the activation. */
  private readonly onClickCapture = (event: MouseEvent): void => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const path = event.composedPath();
    const activated = this.items.some((item) => {
      const controller = this.controllerFor(item);
      if (!controller) return false;
      const base = controller.base();
      if (controller.isLink() && base && path.includes(base)) return true;
      const panel = controller.panel();
      if (!panel) return false;
      const panelIndex = path.indexOf(panel);
      if (panelIndex === -1) return false;
      return path.slice(0, panelIndex).some(isAnchorWithHref);
    });
    if (!activated) return;
    this.cancelShow();
    this.cancelHide();
    const listHides = this.layout === 'stacked' && this._expanded;
    this.closeOpenItem('user', listHides ? { focusTarget: this.toggleElement } : {});
    if (listHides) this.setExpanded(false, 'user');
  };

  // Keyboard ---------------------------------------------------------------------------------

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (this.layout === 'stacked') {
      if (event.key === 'Escape') this.handleStackedEscape(event);
      return;
    }
    const origin = event.composedPath()[0];
    if (!isElementNode(origin)) return;
    const topLevel = this.items.find((item) => this.controllerFor(item)?.base() === origin);
    if (topLevel) {
      this.handleBaseKey(event, topLevel);
      return;
    }
    const panel = this.controllerFor(this.openItem)?.panel();
    if (panel && composedContains(panel, origin)) this.handlePanelKey(event, panel, origin);
  };

  private handleBaseKey(event: KeyboardEvent, item: HTMLElement): void {
    const rtl = this.effectiveDirection === 'rtl';
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        event.preventDefault();
        const forward = (event.key === 'ArrowRight') !== rtl;
        this.focusSibling(item, forward ? 1 : -1);
        return;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        const navigable = this.items.filter((candidate) => this.isNavigable(candidate));
        const target = event.key === 'Home' ? navigable[0] : navigable.at(-1);
        this.controllerFor(target)?.base()?.focus();
        return;
      }
      case 'ArrowDown': {
        const controller = this.controllerFor(item);
        if (!controller?.isTrigger() || !controller.isOpen()) return;
        event.preventDefault();
        void this.enterPanel(controller);
        return;
      }
    }
  }

  private focusSibling(item: HTMLElement, step: 1 | -1): void {
    const navigable = this.items.filter((candidate) => this.isNavigable(candidate));
    const index = navigable.indexOf(item);
    if (index === -1) return;
    this.controllerFor(navigable[index + step])?.base()?.focus();
  }

  private async enterPanel(controller: NavigationMenuItemController): Promise<void> {
    await controller.placementReady();
    if (!controller.isOpen()) return;
    const panel = controller.panel();
    if (!panel) return;
    collectFocusableElements(panel)[0]?.focus();
  }

  private handlePanelKey(event: KeyboardEvent, panel: HTMLElement, origin: Element): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (!origin.matches(PANEL_KEY_ORIGIN)) return;
    event.preventDefault();
    const focusable = collectFocusableElements(panel);
    const index = focusable.findIndex((candidate) => candidate === origin);
    let target: HTMLElement | undefined;
    if (event.key === 'Home') target = focusable[0];
    else if (event.key === 'End') target = focusable.at(-1);
    else if (event.key === 'ArrowDown') target = focusable[index + 1];
    else if (index > 0) target = focusable[index - 1];
    target?.focus();
  }

  private handleStackedEscape(event: KeyboardEvent): void {
    const open = this.openItem;
    const active = deepActiveElement(this.ownerDocument);
    if (open && active && composedContains(open, active)) {
      event.preventDefault();
      const controller = this.controllerFor(open);
      const base = controller?.base();
      controller?.close('user');
      base?.focus();
      return;
    }
    if (!this._expanded) return;
    event.preventDefault();
    this.setExpanded(false, 'user');
    this.toggleElement?.focus();
  }

  // Collapse ---------------------------------------------------------------------------------

  private setExpanded(
    next: boolean,
    source: LyraNavigationMenuExpandedChangeSource | null,
  ): void {
    if (next === this._expanded) return;
    if (!next && this.collapsedLayout) {
      // The list is about to hide: move focus out of it first so it never falls to the body.
      const list = this.listElement;
      const active = deepActiveElement(this.ownerDocument);
      if (list && active && composedContains(list, active)) {
        this.toggleElement?.focus({ preventScroll: true });
      }
      this.closeOpenItem(source, { repairFocus: false });
    }
    const old = this._expanded;
    this._expanded = next;
    this.requestUpdate('expanded', old);
    if (source !== null) {
      void this.updateComplete.then(() => {
        this.emit('lr-expanded-change', { expanded: next, source });
      });
    }
  }

  private readonly onToggleClick = (): void => {
    this.setExpanded(!this._expanded, 'user');
  };

  private observeAllocation(): void {
    const view = this.ownerDocument.defaultView;
    const ResizeObserverConstructor = view?.ResizeObserver;
    if (!ResizeObserverConstructor) return;
    this.resizeObserver ??= new ResizeObserverConstructor((entries) => this.onResize(entries));
    this.resizeObserver.observe(this);
    this.observedIndicatorTargets.clear();
    this.observeIndicatorTargets();
  }

  private onResize(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.target !== this) continue;
      this.lastInlineSize = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      this.scheduleAllocation();
    }
    this.queueIndicatorMeasure();
  }

  /**
   * Applies the measured allocation on the next frame rather than inside the observer callback:
   * the layout switch changes this host's own block size, which the observer would otherwise have
   * to report again within the same delivery and flag as an undelivered loop.
   */
  private scheduleAllocation(): void {
    if (this.allocationFrame) return;
    const view = this.ownerDocument.defaultView;
    if (!view) {
      this.applyAllocation(this.lastInlineSize);
      return;
    }
    const id = view.requestAnimationFrame(() => {
      if (this.allocationFrame?.id !== id) return;
      this.allocationFrame = undefined;
      if (this.isConnected) this.applyAllocation(this.lastInlineSize);
    });
    this.allocationFrame = { id, view };
  }

  private cancelAllocationFrame(): void {
    const frame = this.allocationFrame;
    this.allocationFrame = undefined;
    if (frame) frame.view.cancelAnimationFrame(frame.id);
  }

  private measureContentInlineSize(): number | undefined {
    const view = this.ownerDocument.defaultView;
    if (!view || !this.isConnected) return this.lastInlineSize;
    const style = view.getComputedStyle(this);
    const edges = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const;
    let width = this.getBoundingClientRect().width;
    for (const edge of edges) width -= Number.parseFloat(style[edge]) || 0;
    return Math.max(0, width);
  }

  private applyAllocation(width: number | undefined): void {
    if (width === undefined || !Number.isFinite(width)) return;
    const breakpoint = resolveCssLength(this.mobileBreakpoint, { host: this });
    const next = breakpoint !== undefined && Number.isFinite(breakpoint) && width <= breakpoint;
    this.updateBrowserDerivedState(() => this.setCollapsed(next));
  }

  private setCollapsed(next: boolean): void {
    if (next === this.collapsedLayout) return;
    this.cancelShow();
    this.cancelHide();
    const active = deepActiveElement(this.ownerDocument);
    const open = this.openItem;
    if (next) {
      const list = this.listElement;
      const listHides = !this._expanded;
      const focusInList = Boolean(active && list && composedContains(list, active));
      this.controllerFor(open)?.close('programmatic', { instant: true, repairFocus: !listHides });
      if (listHides && focusInList) this.pendingFocus = 'toggle';
      this.stopLightDismiss();
    } else {
      const toggle = this.toggleElement;
      const onToggle = Boolean(active && toggle && composedContains(toggle, active));
      this.controllerFor(open)?.close('programmatic', { instant: true });
      if (onToggle) this.pendingFocus = 'first-base';
    }
    this.collapsedLayout = next;
    setCustomState(this.menuInternals, 'collapsed', next);
    for (const item of this.items) {
      (item as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.();
    }
    if (!next && this._expanded) this.setExpanded(false, 'programmatic');
  }

  // Indicator --------------------------------------------------------------------------------

  private observeIndicatorTargets(): void {
    const observer = this.resizeObserver;
    if (!observer) return;
    const wanted = new Set<Element>();
    if (this.indicator) {
      const list = this.listElement;
      if (list) wanted.add(list);
      if (this.openItem) wanted.add(this.openItem);
    }
    for (const target of this.observedIndicatorTargets) {
      if (!wanted.has(target)) observer.unobserve(target);
    }
    for (const target of wanted) {
      if (!this.observedIndicatorTargets.has(target)) observer.observe(target);
    }
    this.observedIndicatorTargets = wanted;
  }

  private queueIndicatorMeasure(): void {
    if (this.indicatorQueued || !this.indicator) return;
    this.indicatorQueued = true;
    queueMicrotask(() => {
      const open = this.openItem as (HTMLElement & { updateComplete?: Promise<unknown> }) | undefined;
      void Promise.all([this.updateComplete, open?.updateComplete]).then(() => {
        this.indicatorQueued = false;
        this.measureIndicator();
      });
    });
  }

  private measureIndicator(): void {
    if (!this.indicator || this.collapsedLayout || !this.isConnected) return;
    const nav = this.renderRoot.querySelector<HTMLElement>('[part~="base"]');
    const base = this.controllerFor(this.openItem)?.base();
    const previous = this.indicatorBox;
    if (!nav || !base) {
      if (previous?.visible) this.indicatorBox = { ...previous, visible: false };
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const trigger = base.getBoundingClientRect();
    const list = this.listElement;
    const rtl = this.effectiveDirection === 'rtl';
    const bottom =
      this._panelAnchor === 'menu' && list ? list.getBoundingClientRect().bottom : trigger.bottom;
    const next: IndicatorBox = {
      start: rtl ? navRect.right - trigger.right : trigger.left - navRect.left,
      size: trigger.width,
      top: bottom - navRect.top,
      visible: true,
    };
    if (
      previous &&
      previous.visible === next.visible &&
      Math.abs(previous.start - next.start) < 0.5 &&
      Math.abs(previous.size - next.size) < 0.5 &&
      Math.abs(previous.top - next.top) < 0.5
    ) {
      return;
    }
    this.indicatorBox = next;
  }

  override render(): TemplateResult {
    const hostLabel = hostAriaLabel(this);
    const label = hostLabel ?? this.localize('navigation');
    const collapsed = this.collapsedLayout;
    const box = this.indicatorBox;
    return html`<nav part="base" aria-label=${label}>
      ${collapsed
        ? html`<button
            type="button"
            part="toggle"
            aria-expanded=${this._expanded ? 'true' : 'false'}
            aria-controls=${this.listId}
            @click=${this.onToggleClick}
          >
            <span part="toggle-icon" aria-hidden="true" inert
              ><slot name="toggle-icon">${menuIcon()}</slot></span
            ><span part="toggle-label">${this.localize('menuLabel')}</span>
          </button>`
        : nothing}
      <div
        part="list"
        role="list"
        id=${this.listId}
        data-layout=${collapsed ? 'stacked' : 'bar'}
        ?hidden=${collapsed && !this._expanded}
      ><slot @slotchange=${this.onSlotChange}></slot></div>
      ${this.indicator && !collapsed
        ? html`<div
            part="indicator"
            aria-hidden="true"
            ?data-visible=${box?.visible === true}
            style=${styleMap({
              '--_lr-navigation-menu-indicator-start': box ? `${box.start}px` : undefined,
              '--_lr-navigation-menu-indicator-size': box ? `${box.size}px` : undefined,
              '--_lr-navigation-menu-indicator-top': box ? `${box.top}px` : undefined,
            })}
          ><div part="indicator-arrow"></div></div>`
        : nothing}
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-navigation-menu': LyraNavigationMenu;
  }
}
