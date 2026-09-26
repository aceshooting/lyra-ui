import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  deferredPlaceReady,
  loadAnchoredOverlayRuntime,
  waitForDeferredPlacement,
  type DeferredOperationHandle,
} from '../../../internal/anchored-overlay-runtime.js';
import { chevronIcon } from '../../../internal/icons.js';
import { resolveGuardedRel } from '../../../internal/link-rel.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import {
  activateNonmodalOverlay,
  composedContains,
  deepActiveElement,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { animateRegistered } from '../../../internal/registered-animation.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { LyraDetailsToggleSource } from '../details/details.class.js';
import {
  navigationMenuOwner,
  registerNavigationMenuItemController,
  type NavigationMenuCloseOptions,
  type NavigationMenuItemMode,
  type NavigationMenuMorph,
  type NavigationMenuOwnerContext,
  type NavigationMenuToggleSource,
} from '../navigation-menu/navigation-menu-owner.js';
import { styles } from './navigation-menu-item.styles.js';

/** Payload emitted with `lr-toggle` after an accepted disclosure change renders. */
export interface LyraNavigationMenuToggleDetail {
  open: boolean;
  source: LyraDetailsToggleSource;
}

export interface LyraNavigationMenuItemEventMap {
  'lr-toggle': CustomEvent<LyraNavigationMenuToggleDetail>;
}

/** Inline placement writes the positioner leaves behind once a panel stops floating. */
const PLACEMENT_STYLE_PROPERTIES = [
  'position',
  'margin',
  'left',
  'top',
  '--lr-positioner-available-inline-size',
  '--lr-positioner-available-block-size',
] as const;

const SHOW_OFFSET = 'translateY(var(--lr-size-neg-0-25rem))';

/** Parses a computed `transition-duration`/`transition-delay` list into milliseconds. */
function parseTimeList(value: string): number[] {
  return value.split(',').map((entry) => {
    const match = /^\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(ms|s)\s*$/i.exec(entry);
    if (!match) return 0;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return 0;
    return match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
  });
}

/**
 * `<lr-navigation-menu-item>` — one entry of an `<lr-navigation-menu>` bar: a link, a disclosure
 * trigger with a flyout panel, or a plain button.
 *
 * The kind follows from the markup. A safe `href` makes a link item, rendered as a native `<a>`
 * whose `panel` slot is never displayed. Otherwise the item is a native `<button type="button">`:
 * a disclosure trigger when the `panel` slot carries content, which adds `aria-expanded`,
 * `aria-controls` and the caret, or a plain button (useful for single-page routers) when it does
 * not. Links are decided from attributes alone. Until slot content can be inspected in the
 * browser, every other item renders as a trigger with `aria-expanded="false"` and every panel
 * renders hidden; the first browser update corrects both.
 *
 * Owned by an `<lr-navigation-menu>`, a trigger's panel floats below the bar (or below the item,
 * see the menu's `panel-anchor`) and opens on hover, click, Enter or Space; only one panel is open
 * at a time. In the menu's collapsed layout, or when the item has no owning menu, the panel opens
 * in flow below its trigger instead, with no positioning, no hover opening and no animation.
 *
 * A host `aria-label` is forwarded by attribute presence to the link or button, including an
 * explicitly empty value.
 *
 * @customElement lr-navigation-menu-item
 * @slot - The item label.
 * @slot start - Content before the label, inside the link or button.
 * @slot end - Content after the label, inside the link or button.
 * @slot panel - Flyout content for a disclosure trigger, such as a list of links. Ignored for a
 *   link item.
 * @slot expand-icon - Replaces the caret glyph. The wrapper is inert and `aria-hidden`.
 * @event lr-toggle - An accepted open-state change rendered. Not cancelable.
 *   `detail: { open: boolean, source: 'user' | 'programmatic' | 'peer' }`; `peer` means a sibling
 *   opened. Never emitted for initial markup. Panel content such as `lr-details` also bubbles
 *   `lr-toggle`, so a delegated listener filters on `event.target.localName`.
 * @csspart base - The native link or button. Also carries `base-current` while `current` is set
 *   and `base-open` while its panel is open.
 * @csspart base-current - State alias on the base while `current` is set.
 * @csspart base-open - State alias on the base while its panel is open.
 * @csspart start - Wrapper around the `start` slot.
 * @csspart label - Wrapper around the default slot.
 * @csspart end - Wrapper around the `end` slot.
 * @csspart expand-icon - The caret wrapper, hidden unless the item is a disclosure trigger.
 * @csspart panel - The flyout panel surface.
 * @cssprop [--lr-navigation-menu-item-padding-inline=var(--lr-space-l)] - Inline padding of the
 *   link or button.
 * @cssprop [--lr-navigation-menu-item-min-block-size=var(--lr-form-control-height-m,var(--lr-theme-form-control-height-m,var(--lr-size-2-5rem)))] -
 *   Minimum block size of the link or button. Never resolves below `--lr-icon-button-size`.
 * @cssprop [--lr-navigation-menu-item-font-size=var(--lr-font-size-m)] - Label font size.
 * @cssprop [--lr-navigation-menu-item-font-weight=var(--lr-font-weight-medium)] - Label font
 *   weight.
 * @cssprop [--lr-navigation-menu-item-hover-bg=var(--lr-color-brand-quiet)] - Hovered background.
 * @cssprop [--lr-navigation-menu-item-hover-color=var(--lr-color-brand)] - Hovered text colour.
 * @cssprop [--lr-navigation-menu-item-active-color=var(--lr-color-text)] - Pressed text colour.
 * @cssprop [--lr-navigation-menu-item-active-bg=color-mix(in oklab,var(--lr-color-brand-quiet),var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 *   Pressed background.
 * @cssprop [--lr-navigation-menu-item-open-bg=var(--lr-color-brand-quiet)] - Background of a
 *   trigger whose panel is open.
 * @cssprop [--lr-navigation-menu-item-current-color=var(--lr-color-brand)] - Text colour of the
 *   `current` item.
 * @cssprop [--lr-navigation-menu-item-current-font-weight=var(--lr-font-weight-semibold)] - Font
 *   weight of the `current` item.
 * @cssprop [--lr-navigation-menu-panel-padding=var(--lr-space-s)] - Padding of the panel.
 * @cssprop [--lr-navigation-menu-panel-max-inline-size=var(--lr-size-48rem)] - Maximum inline size
 *   of a floating panel, further capped by the space the viewport leaves.
 * @cssprop [--lr-navigation-menu-panel-indent=var(--lr-space-l)] - Inline-start indent of an
 *   in-flow panel in the collapsed layout.
 * @cssprop [--lr-navigation-menu-show-duration=var(--lr-duration-fast)] - Panel opening duration.
 * @cssprop [--lr-navigation-menu-hide-duration=var(--lr-duration-fast)] - Panel closing duration.
 * @cssprop [--lr-navigation-menu-switch-duration=var(--lr-duration-base)] - Duration of the panel
 *   resize and content slide when one open panel replaces another.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill
 *   of the floating panel.
 * @cssprop [--lr-overlay-border=var(--lr-color-border-subtle)] - Shared floating-surface edge
 *   colour of the floating panel.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius of the
 *   floating panel.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the floating panel.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override read when the panel
 *   is positioned. The panel is `fixed` when it is unset.
 * @status experimental
 * @since unreleased
 */
export class LyraNavigationMenuItem extends LyraElement<LyraNavigationMenuItemEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Accessible-name override for the link or button, mapped to the host `aria-label` attribute.
   * Attribute presence wins, so an explicitly empty `aria-label=""` stays empty. */
  @property({ attribute: 'aria-label' }) accessibleLabel?: string;

  /** Link URL. A safe URL makes this a link item, rendered as a native `<a>`; unsafe schemes such
   * as `javascript:` are ignored and the item renders as a button. */
  @property({ useDefault: true }) href = '';

  /** Native link target. Any non-empty value forces `noopener noreferrer` into the link's `rel`. */
  @property({ useDefault: true }) target = '';

  /** Link relationship tokens. Author tokens are kept, `opener` is always dropped, duplicates
   * collapse, and `noopener noreferrer` is added whenever `target` is set. */
  @property({ useDefault: true }) rel = '';

  /** Marks the current page. A link item renders `aria-current="page"` (otherwise `"false"`); a
   * trigger or plain button only takes the `base-current` part, since a disclosure is not a page. */
  @property({ type: Boolean, reflect: true }) current = false;

  private _open = false;

  /**
   * Whether the panel is shown. A write is refused (normalized back to `false` with no event) only
   * when the item cannot disclose: it is a link item, or its `panel` slot is empty once slot
   * content can be inspected. Among the items of one `<lr-navigation-menu>` only one is open at a
   * time; opening one closes the other with an `lr-toggle` whose source is `peer`.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const value = Boolean(next);
    if (value === this._open) return;
    // Before the first render this is initial markup, not a transition.
    const source: NavigationMenuToggleSource | null = this.hasUpdated ? 'programmatic' : null;
    if (value) this.openPanel('programmatic', source);
    else this.closePanel(source);
  }

  /** False on the server and during a hydrating first render, so both emit closed panels. */
  @state() private browserResolved = false;
  /** Keeps a floating panel visible while its exit animation runs. */
  @state() private closing = false;

  private readonly slotPresence = new SlotPresenceController(this);
  private readonly panelId = nextId('navigation-menu-panel');
  private interactionMode?: NavigationMenuItemMode;
  /** Whether the current open state has rendered as a visible, browser-resolved panel. */
  private liveOpen = false;
  private placement?: DeferredOperationHandle;
  private placementKey = '';
  private overlayHandle?: OverlayHandle;
  private pendingShow = false;
  private pendingMorph?: NavigationMenuMorph;
  private hideAnimation?: Animation;
  private hideAnimationStarted = false;
  private transitionToken = 0;
  private morphCleanup?: () => void;
  private focusInPanel = false;
  private semanticFocusOrigin?: Element;

  constructor() {
    super();
    registerNavigationMenuItemController(this, {
      isTrigger: () => this.isTrigger,
      isLink: () => this.isLink,
      isOpen: () => this._open,
      mode: () => (this._open ? this.interactionMode : undefined),
      pin: () => {
        if (this._open) this.interactionMode = 'pinned';
      },
      base: () => this.baseElement,
      panel: () => this.panelElement,
      open: (mode, source) => this.openPanel(mode, source),
      close: (source, options) => this.closePanel(source, options),
      isTopmost: () => this.overlayHandle?.isTopmost() ?? false,
      placementReady: () => this.placementReady(),
      reposition: () => {
        this.placementKey = '';
        this.requestUpdate();
      },
    });
  }

  private get ownerContext(): NavigationMenuOwnerContext | undefined {
    return navigationMenuOwner(this);
  }

  private get isLink(): boolean {
    return Boolean(safeLinkHref(this.href));
  }

  private get isTrigger(): boolean {
    return !this.isLink && this.slotPresence.has('panel');
  }

  /** Whether the panel lays out as a positioned overlay (bar layout of an owning menu). */
  private get floatingLayout(): boolean {
    return this.ownerContext?.layout() === 'bar';
  }

  private get baseElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('[part~="base"]') ?? null;
  }

  private get panelElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('[part~="panel"]') ?? null;
  }

  /** An item refuses `open` only when it is a link, or its resolved panel slot is empty. */
  private get canDisclose(): boolean {
    if (this.isLink) return false;
    return !this.browserResolved || this.slotPresence.has('panel');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    this.addEventListener('keydown', this.onHostKeyDown);
    this.updateBrowserDerivedState(() => {
      this.browserResolved = true;
    });
    if (this.hasUpdated && this._open) {
      // A reconnected panel resumes without events; the pin was interaction state.
      this.interactionMode = 'programmatic';
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    this.removeEventListener('keydown', this.onHostKeyDown);
    this.cancelMorph();
    this.stopPlacement();
    this.releaseOverlay(false);
    this.cancelHideAnimation();
    this.closing = false;
    this.focusInPanel = false;
    this.semanticFocusOrigin = undefined;
    if (this._open && this.interactionMode === 'hover') {
      // A hover interaction cannot outlive the detach.
      this._open = false;
      this.liveOpen = false;
      this.interactionMode = undefined;
      this.requestUpdate('open', true);
    } else if (this._open) {
      this.interactionMode = 'programmatic';
    }
    super.disconnectedCallback();
  }

  /** Moves focus to the link or button. */
  override focus(options?: FocusOptions): void {
    const base = this.baseElement;
    if (base) base.focus(options);
    else super.focus(options);
  }

  /** Activates the link or button, exactly like a user click. */
  override click(): void {
    this.baseElement?.click();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this._open && !this.canDisclose) {
      if (this.liveOpen) {
        this.closePanel('programmatic', { repairFocus: true, instant: true });
      } else {
        // Never rendered as an open panel: normalize without announcing a transition.
        this._open = false;
        this.interactionMode = undefined;
        this.pendingShow = false;
        this.pendingMorph = undefined;
        this.requestUpdate('open', true);
      }
    }
    if (changed.has('href')) {
      const previous = this.baseElement;
      const nextKind = this.isLink ? 'a' : 'button';
      this.semanticFocusOrigin =
        previous && previous.localName !== nextKind && activeElementIn(this.shadowRoot) === previous
          ? previous
          : undefined;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // A refused write that arrived through the attribute leaves the attribute behind; Lit does not
    // reflect a property back while it is applying that same attribute.
    if (this.isConnected && this.hasAttribute('open') !== this._open) {
      this.toggleAttribute('open', this._open);
    }
    this.syncFloating();
    this.syncHideAnimation();
    const focusOrigin = this.semanticFocusOrigin;
    this.semanticFocusOrigin = undefined;
    if (focusOrigin) {
      const internalActive = activeElementIn(this.shadowRoot);
      const documentActive = activeElementIn(this.ownerDocument);
      if (
        (internalActive === null || internalActive === focusOrigin) &&
        (documentActive === null ||
          documentActive === this ||
          documentActive === this.ownerDocument.body)
      ) {
        this.baseElement?.focus();
      }
    }
  }

  /** Accepted open transition. Returns `false` when the item cannot disclose. */
  private openPanel(mode: NavigationMenuItemMode, source: NavigationMenuToggleSource | null): boolean {
    if (this._open) {
      if (mode === 'pinned' && this.interactionMode === 'hover') this.interactionMode = 'pinned';
      return true;
    }
    if (!this.canDisclose) {
      this.requestUpdate('open', true);
      return false;
    }
    const context = this.ownerContext;
    const morph = context?.willOpen(this);
    this.cancelHideAnimation();
    this.closing = false;
    this.interactionMode = mode;
    this.pendingMorph = morph;
    this.pendingShow = source !== null && !morph;
    this._open = true;
    this.requestUpdate('open', false);
    this.queueToggle(true, source);
    context?.changed(this, true, source);
    return true;
  }

  /** Accepted close transition: focus repair, then positioning, then the overlay, then motion. */
  private closePanel(
    source: NavigationMenuToggleSource | null,
    options: NavigationMenuCloseOptions = {},
  ): void {
    if (!this._open) return;
    if (options.repairFocus !== false && this.panelHoldsFocus()) {
      (options.focusTarget ?? this.baseElement)?.focus({ preventScroll: true });
    }
    const wasFloating = this.placement !== undefined || this.overlayHandle !== undefined;
    this.cancelMorph();
    this.stopPlacement();
    this.releaseOverlay(options.restoreFocus === true);
    const animate =
      !options.instant && wasFloating && this.liveOpen && this.isConnected && this.floatingLayout;
    this.cancelHideAnimation();
    this.closing = animate;
    this.pendingMorph = undefined;
    this.pendingShow = false;
    this.interactionMode = undefined;
    this.liveOpen = false;
    this.focusInPanel = false;
    this._open = false;
    this.requestUpdate('open', true);
    this.queueToggle(false, source);
    this.ownerContext?.changed(this, false, source);
  }

  private queueToggle(open: boolean, source: NavigationMenuToggleSource | null): void {
    if (source === null) return;
    void this.updateComplete.then(() => {
      this.emit('lr-toggle', { open, source });
    });
  }

  /** Whether the focused element sits inside this item's panel (never on its own trigger). */
  private panelHoldsFocus(): boolean {
    const panel = this.panelElement;
    if (!panel) return false;
    const active = deepActiveElement(this.ownerDocument);
    if (active && composedContains(panel, active)) return true;
    // A focused node removed together with the panel content leaves focus on the body.
    return this.focusInPanel && (active === null || active === this.ownerDocument.body);
  }

  private readonly onFocusIn = (event: FocusEvent): void => {
    const panel = this.panelElement;
    const target = event.composedPath()[0] as Element | undefined;
    this.focusInPanel = panel !== null && target !== undefined && composedContains(panel, target);
  };

  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Element | null;
    if (next === null) return;
    const panel = this.panelElement;
    if (!panel || !composedContains(panel, next)) this.focusInPanel = false;
  };

  private readonly onBaseClick = (): void => {
    if (this.isLink) return;
    const context = this.ownerContext;
    if (context) {
      context.activate(this);
      return;
    }
    // An unowned item is a plain in-flow disclosure.
    if (!this.isTrigger) return;
    if (this._open) this.closePanel('user');
    else this.openPanel('programmatic', 'user');
  };

  /** Starts or stops floating resources to match what just rendered. */
  private syncFloating(): void {
    const panel = this.panelElement;
    const visible = this.isTrigger && this.browserResolved && this._open;
    if (visible) this.liveOpen = true;
    const shouldFloat = visible && this.isConnected && this.floatingLayout;
    if (!shouldFloat) {
      this.stopPlacement();
      if (this.overlayHandle) this.releaseOverlay(false);
      if (panel && !this.closing) {
        this.clearPlacementStyles(panel);
        // Crossing from the floating bar into the collapsed flow layout keeps this same panel
        // open and visible, so it never settles through [hidden]: release a top-layer promotion
        // explicitly or the panel would stay out of flow instead of rendering below its trigger.
        if (visible && panel.hasAttribute('data-lr-top-layer')) {
          void loadAnchoredOverlayRuntime().then(
            (runtime) => runtime.releaseTopLayer?.(panel),
            () => undefined,
          );
        }
      }
      if (visible) {
        this.pendingShow = false;
        this.pendingMorph = undefined;
      }
      return;
    }
    if (!panel) return;
    const context = this.ownerContext!;
    const anchor = context.anchor(this);
    if (!anchor) return;
    const key = [
      anchor === this.baseElement ? 'item' : 'menu',
      context.distance(),
      this.effectiveDirection,
    ].join('|');
    if (!this.placement || key !== this.placementKey) this.startPlacement(anchor, panel, key);
    if (!this.overlayHandle?.isActive()) {
      this.overlayHandle = activateNonmodalOverlay({
        host: this,
        panel: () => this.panelElement,
        onEscape: () => this.onOverlayEscape(),
        restoreFocusTo: () => this.baseElement,
      });
    }
    const morph = this.pendingMorph;
    const show = this.pendingShow;
    this.pendingMorph = undefined;
    this.pendingShow = false;
    if (!morph && !show) return;
    const handle = this.placement;
    void handle?.ready.then((placed) => {
      if (!placed || handle !== this.placement || !this._open) return;
      if (morph) this.runMorph(morph);
      else this.runShowAnimation();
    });
  }

  private startPlacement(anchor: HTMLElement, panel: HTMLElement, key: string): void {
    this.stopPlacement();
    const context = this.ownerContext!;
    const bridge = this.renderRoot.querySelector<HTMLElement>('.hover-bridge');
    this.placementKey = key;
    this.placement = deferredPlaceReady(anchor, panel, {
      placement: rtlAwarePlacement('bottom-start', this),
      strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
      offset: context.distance(),
      hoverBridge: bridge ?? undefined,
    });
  }

  private stopPlacement(): void {
    const handle = this.placement;
    this.placement = undefined;
    this.placementKey = '';
    handle?.();
  }

  private releaseOverlay(restoreFocus: boolean): void {
    const handle = this.overlayHandle;
    this.overlayHandle = undefined;
    handle?.deactivate({ restoreFocus });
  }

  private clearPlacementStyles(panel: HTMLElement): void {
    for (const property of PLACEMENT_STYLE_PROPERTIES) panel.style.removeProperty(property);
  }

  private onOverlayEscape(): void {
    const context = this.ownerContext;
    if (context) {
      context.escape(this);
      return;
    }
    const within = composedContains(this, deepActiveElement(this.ownerDocument));
    // No `overlayHandle` exists for this unowned, non-floating path (see `onHostKeyDown`'s doc
    // comment), so there is no `restoreFocusTo` to fall back on -- default `repairFocus` (not
    // `false`) is what actually returns focus to the trigger here, mirroring `onBaseClick`'s
    // click-to-close default.
    this.closePanel('user', { restoreFocus: within });
  }

  /**
   * Closes a standalone (unowned) item's open in-flow panel on Escape. An owned item never reaches
   * this: a `'bar'`-layout owner's floating panel gets its Escape from `activateNonmodalOverlay`
   * (wired in `syncFloating()`), and any owner at all gets it from `<lr-navigation-menu>`'s own
   * keydown handling (`itemEscape()`), which this item's `context.escape(this)` branch above
   * defers to. A plain in-flow disclosure with no owner and no floating layout gets neither, so it
   * would otherwise have no keyboard-dismiss path at all.
   */
  private readonly onHostKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || !this._open || this.ownerContext) return;
    event.preventDefault();
    this.onOverlayEscape();
  };

  private async placementReady(): Promise<boolean> {
    await this.updateComplete;
    if (!this.placement) return this._open;
    return waitForDeferredPlacement(() => this.placement);
  }

  /** The element whose animation registry resolves this item's motion: the owning menu. */
  private get registryHost(): Element {
    return this.ownerContext?.owner ?? this;
  }

  private runShowAnimation(): void {
    const panel = this.panelElement;
    if (!panel) return;
    animateRegistered(this.registryHost, panel, 'navigation-menu.show', this.effectiveDirection, {
      keyframes: [
        { opacity: 0, transform: SHOW_OFFSET },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      durationProperties: ['--lr-navigation-menu-show-duration', '--lr-duration-fast'],
      easingProperties: ['--lr-easing-standard'],
    });
  }

  /** Runs the exit animation of a closing floating panel, then lets it hide. */
  private syncHideAnimation(): void {
    if (!this.closing || this.hideAnimationStarted) return;
    this.hideAnimationStarted = true;
    const token = this.transitionToken;
    const panel = this.panelElement;
    const animation = panel
      ? animateRegistered(this.registryHost, panel, 'navigation-menu.hide', this.effectiveDirection, {
          keyframes: [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: SHOW_OFFSET },
          ],
          durationProperties: ['--lr-navigation-menu-hide-duration', '--lr-duration-fast'],
          easingProperties: ['--lr-easing-standard'],
        })
      : undefined;
    this.hideAnimation = animation;
    const settle = (): void => {
      if (token !== this.transitionToken) return;
      this.hideAnimation?.cancel();
      this.hideAnimation = undefined;
      this.hideAnimationStarted = false;
      this.closing = false;
    };
    if (animation) void animation.finished.then(settle, settle);
    else queueMicrotask(settle);
  }

  private cancelHideAnimation(): void {
    this.transitionToken++;
    this.hideAnimation?.cancel();
    this.hideAnimation = undefined;
    this.hideAnimationStarted = false;
  }

  /** Resizes the shared panel region from the panel that just closed to this one. */
  private runMorph(morph: NavigationMenuMorph): void {
    const panel = this.panelElement;
    const content = panel?.querySelector<HTMLElement>('.panel-content');
    if (!panel || !content) return;
    const travel = 'var(--lr-size-1rem)';
    const reversed = `calc(-1 * ${travel})`;
    const from = morph.direction === 'end' ? travel : reversed;
    const mirrored = morph.direction === 'end' ? reversed : travel;
    animateRegistered(
      this.registryHost,
      content,
      `navigation-menu.enter-from-${morph.direction}`,
      this.effectiveDirection,
      {
        keyframes: [
          { opacity: 0, transform: `translateX(${from})` },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        rtlKeyframes: [
          { opacity: 0, transform: `translateX(${mirrored})` },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        durationProperties: ['--lr-navigation-menu-switch-duration', '--lr-duration-base'],
        easingProperties: ['--lr-easing-standard'],
      },
    );
    const view = this.ownerDocument.defaultView;
    if (!view || prefersReducedMotion(view)) return;
    const to = panel.getBoundingClientRect();
    if (Math.abs(to.width - morph.from.width) < 1 && Math.abs(to.height - morph.from.height) < 1) {
      return;
    }
    this.cancelMorph();
    const natural = content.getBoundingClientRect().width;
    panel.setAttribute('data-morphing', '');
    panel.style.inlineSize = `${morph.from.width}px`;
    panel.style.blockSize = `${morph.from.height}px`;
    content.style.inlineSize = `${natural}px`;
    // The switch duration is never declared on the host, so read the resolved transition itself:
    // it already carries the whole fallback chain and the reduced-motion flattening.
    const style = view.getComputedStyle(panel);
    const durations = parseTimeList(style.transitionDuration);
    const delays = parseTimeList(style.transitionDelay);
    const total = Math.max(
      0,
      ...durations.map((duration, index) => duration + (delays[index % Math.max(1, delays.length)] ?? 0)),
    );
    let frame: number | undefined;
    let timer: number | undefined;
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== panel) return;
      if (!['inline-size', 'block-size', 'width', 'height'].includes(event.propertyName)) return;
      cleanup();
    };
    const cleanup = (): void => {
      if (this.morphCleanup !== cleanup) return;
      this.morphCleanup = undefined;
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      if (timer !== undefined) view.clearTimeout(timer);
      panel.removeEventListener('transitionend', onEnd);
      panel.removeAttribute('data-morphing');
      panel.style.removeProperty('inline-size');
      panel.style.removeProperty('block-size');
      content.style.removeProperty('inline-size');
    };
    this.morphCleanup = cleanup;
    panel.addEventListener('transitionend', onEnd);
    frame = view.requestAnimationFrame(() => {
      frame = undefined;
      if (this.morphCleanup !== cleanup) return;
      panel.style.inlineSize = `${to.width}px`;
      panel.style.blockSize = `${to.height}px`;
      timer = view.setTimeout(cleanup, total + 50);
    });
  }

  private cancelMorph(): void {
    this.morphCleanup?.();
  }

  override render(): TemplateResult {
    const isLink = this.isLink;
    const isTrigger = this.isTrigger;
    const floating = this.floatingLayout;
    const stacked = this.ownerContext?.layout() === 'stacked';
    const expanded = this._open && this.browserResolved;
    const panelVisible = isTrigger && this.browserResolved && (this._open || this.closing);
    const ariaLabel = hostAriaLabel(this);
    const parts = ['base'];
    if (this.current) parts.push('base-current');
    if (isTrigger && expanded) parts.push('base-open');
    const label = html`<span part="start" ?hidden=${!this.slotPresence.has('start')}
        ><slot name="start"></slot></span
      ><span part="label"><slot></slot></span
      ><span part="end" ?hidden=${!this.slotPresence.has('end')}><slot name="end"></slot></span
      ><span part="expand-icon" aria-hidden="true" inert ?hidden=${!isTrigger}
        ><slot name="expand-icon">${chevronIcon()}</slot></span
      >`;
    const base = isLink
      ? html`<a
          part=${parts.join(' ')}
          data-layout=${stacked ? 'stacked' : nothing}
          href=${safeLinkHref(this.href) ?? nothing}
          target=${this.target || nothing}
          rel=${resolveGuardedRel(this.rel, this.target) ?? nothing}
          aria-label=${ariaLabel ?? nothing}
          aria-current=${this.current ? 'page' : 'false'}
          >${label}</a
        >`
      : html`<button
          type="button"
          part=${parts.join(' ')}
          data-layout=${stacked ? 'stacked' : nothing}
          aria-label=${ariaLabel ?? nothing}
          aria-expanded=${isTrigger ? (expanded ? 'true' : 'false') : nothing}
          aria-controls=${isTrigger ? this.panelId : nothing}
          @click=${this.onBaseClick}
        >${label}</button>`;
    return html`${base}<div
        part="panel"
        id=${this.panelId}
        ?hidden=${!panelVisible}
        data-layout=${floating ? 'floating' : 'flow'}
      ><div class="panel-content"><slot name="panel"></slot></div></div
      >${floating && this._open && panelVisible
        ? html`<span class="hover-bridge" aria-hidden="true"></span>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-navigation-menu-item': LyraNavigationMenuItem;
  }
}
