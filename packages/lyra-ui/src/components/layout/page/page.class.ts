import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { property, query } from 'lit/decorators.js';
import { nextId, resolveAccessibleTrigger } from '../../../internal/a11y.js';
import { isAriaTrue } from '../../../internal/accessibility-visibility.js';
import {
  acquireAriaOwnership,
  type AriaOwnershipLease,
} from '../../../internal/aria-ownership.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { isComposedFocusAvailable } from '../../../internal/focus-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import {
  activateOverlay,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { styles } from './page.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_closeNavigation, LYRA_DEFAULT_navigation, LYRA_DEFAULT_openNavigation, LYRA_DEFAULT_skipToContent } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const DEFAULT_MOBILE_BREAKPOINT = '768px';

/** The Page presentation derived from its allocated inline size. */
export type PageView = 'mobile' | 'desktop';

/** The logical edge that owns navigation in either Page presentation. */
export type PageNavigationPlacement = 'start' | 'end';

interface CustomToggleOwnership {
  accessible: HTMLElement;
  accessibleAria?: AriaOwnershipLease;
  accessibleAuthoredLabel: string | null;
  hostAria: AriaOwnershipLease;
  hostAuthoredLabel: string | null;
}

function navigationIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="4" y1="7" x2="20" y2="7"></line>
      <line x1="4" y1="12" x2="20" y2="12"></line>
      <line x1="4" y1="17" x2="20" y2="17"></line>
    </svg>
  `;
}

export interface LyraPageEventMap {
  'lr-nav-toggle': CustomEvent<{ open: boolean }>;
}

/**
 * `<lr-page>` — a semantic application/page shell that derives its mobile or desktop presentation
 * from its own allocated inline size. A single static navigation subtree participates in the
 * desktop grid and is promoted in place to a modal mobile drawer, so assigned nodes, component
 * instances, focus, form state, and scroll state are never cloned or replaced at a breakpoint.
 *
 * Each instance owns unique main/drawer/navigation IDs. Its skip link therefore targets its own
 * main landmark even when several Pages coexist. The default skip and navigation controls are
 * localized, and a host `aria-label` overrides the navigation landmark's localized name.
 * Replacement skip text and navigation-toggle glyph content remain visual only: their assigned
 * subtrees are inert and hidden from assistive technology, while skip text still names the outer
 * link.
 *
 * `disable-sticky` is a whitespace-token attribute accepting `banner`, `header`, `subheader`,
 * `menu`, and `aside`. A token only disables that region; unrelated sticky regions keep working.
 * Slotted controls carrying `data-toggle-nav` toggle the mobile drawer, matching the documented
 * light-DOM Page pattern without adding a stale `nav-state` property.
 * Every custom `navigation-toggle` and each composed descendant that actually receives focus
 * receive component-owned `aria-haspopup="dialog"`, synchronized `aria-expanded`, a localized
 * label when unnamed, and a relationship sourced from the real drawer. Current browsers expose
 * the Page host for that inward shadow relationship. Replacement, removal, and disconnect restore
 * exact authored baselines, including writes made while ownership was active. Disabled,
 * `aria-disabled`, hidden, or inert assigned controls do not toggle the drawer.
 *
 * @customElement lr-page
 * @attr {string} disable-sticky - Whitespace-separated Page regions whose sticky positioning is
 *   disabled: `banner`, `header`, `subheader`, `menu`, and `aside`.
 * @slot - Main content.
 * @slot aside - Complementary content beside the main region.
 * @slot banner - A page-wide notice above the header.
 * @slot footer - Page-wide footer content.
 * @slot header - Primary page header content.
 * @slot main-footer - Content after the main body but inside the main landmark.
 * @slot main-header - Content before the main body but inside the main landmark.
 * @slot menu - A compact menu beside the main region.
 * @slot navigation - Primary navigation content.
 * @slot navigation-footer - Content after the navigation links.
 * @slot navigation-header - Content before the navigation links.
 * @slot navigation-toggle - Custom controls that toggle mobile navigation and each receive the
 * managed ARIA relationship described above.
 * @slot navigation-toggle-icon - Replaces the default toggle's menu glyph as inert, decorative
 *   visual content.
 * @slot skip-to-content - Replaces the localized skip-link text as inert visual content; its
 *   descriptive text names the outer skip link.
 * @slot subheader - A secondary header row.
 * @event lr-nav-toggle - A cancelable proposed `navOpen` state from `showNavigation()`,
 *   `hideNavigation()`, `toggleNavigation()`, or a built-in dismissal (backdrop click, Escape, the
 *   default navigation-toggle button). Call `preventDefault()` to leave `navOpen` unchanged.
 *   `detail: { open }`.
 * @csspart aside - Wrapper for the `aside` slot and the complementary landmark.
 * @csspart banner - Wrapper for the `banner` slot.
 * @csspart base - Compatibility name for the root Page wrapper; use `page`.
 * @csspart body - Desktop grid/mobile stack containing menu, navigation, main, and aside.
 * @csspart dialog-wrapper - Mobile backdrop and drawer positioning layer; display-contents on desktop.
 * @csspart drawer - Navigation's modal surface on mobile; display-contents on desktop.
 * @csspart footer - Page-wide footer landmark.
 * @csspart header - Primary page header landmark.
 * @csspart main - The unique main landmark.
 * @csspart main-content - Wrapper for the default slot.
 * @csspart main-footer - Wrapper for the `main-footer` slot.
 * @csspart main-header - Wrapper for the `main-header` slot.
 * @csspart menu - Wrapper for the `menu` slot.
 * @csspart navigation - The primary navigation landmark.
 * @csspart navigation-desktop - Desktop compatibility name on the same node as `navigation`.
 * @csspart navigation-footer - Wrapper for the `navigation-footer` slot.
 * @csspart navigation-header - Wrapper for the `navigation-header` slot.
 * @csspart navigation-toggle - The default mobile navigation button.
 * @csspart navigation-toggle-icon - The default button's icon wrapper.
 * @csspart page - Root Page wrapper; the same node as `base`.
 * @csspart skip-to-content - The focus-revealed skip link.
 * @csspart subheader - Wrapper for the `subheader` slot.
 * @cssprop [--lr-page-aside-width=auto] - Desktop aside column width.
 * @cssprop [--lr-page-banner-height=0px] - Minimum banner height and sticky offset.
 * @cssprop [--lr-page-header-height=0px] - Minimum header height and sticky offset.
 * @cssprop [--lr-page-main-width=1fr] - Desktop main column width.
 * @cssprop [--lr-page-menu-width=auto] - Desktop menu column width.
 * @cssprop [--lr-page-subheader-height=0px] - Minimum subheader height and sticky offset.
 * Interaction-state properties below are resolved as inline fallbacks, so setting one on the Page
 * or any ancestor themes only its named target without replacing shared design tokens.
 * @cssprop [--lr-page-skip-to-content-hover-bg=var(--lr-color-brand-quiet)] - Background of the
 *   hovered skip link.
 * @cssprop [--lr-page-skip-to-content-hover-color=var(--lr-color-brand)] - Text color of the
 *   hovered skip link.
 * @cssprop [--lr-page-skip-to-content-active-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of the pressed skip link.
 * @cssprop [--lr-page-skip-to-content-active-color=var(--lr-color-brand)] - Text color of the
 *   pressed skip link.
 * @cssprop [--lr-page-navigation-toggle-hover-bg=var(--lr-color-brand-quiet)] - Background of a
 *   hovered default or slotted navigation toggle.
 * @cssprop [--lr-page-navigation-toggle-hover-color=var(--lr-color-brand)] - Text color of a
 *   hovered default or slotted navigation toggle.
 * @cssprop [--lr-page-navigation-toggle-active-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of a pressed default or slotted navigation toggle.
 * @cssprop [--lr-page-navigation-toggle-active-color=var(--lr-color-brand)] - Text color of a
 *   pressed default or slotted navigation toggle.
 * @cssprop [--lr-page-navigation-backdrop-bg=var(--lr-color-overlay)] - Background of the open
 *   mobile navigation backdrop.
 * @cssprop [--lr-page-navigation-drawer-bg=var(--lr-color-surface-overlay)] - Background of the
 *   mobile navigation drawer.
 * @cssprop [--lr-page-navigation-drawer-shadow=var(--lr-shadow-l)] - Shadow of the mobile
 *   navigation drawer.
 * @cssprop [--aside-width] - Web Awesome alias for `--lr-page-aside-width`.
 * @cssprop [--banner-height] - Web Awesome alias for `--lr-page-banner-height`.
 * @cssprop [--header-height] - Web Awesome alias for `--lr-page-header-height`.
 * @cssprop [--main-width] - Web Awesome alias for `--lr-page-main-width`.
 * @cssprop [--menu-width] - Web Awesome alias for `--lr-page-menu-width`.
 * @cssprop [--subheader-height] - Web Awesome alias for `--lr-page-subheader-height`.
 * @status stable
 * @since 8.0.0
 */
export class LyraPage extends LyraElement<LyraPageEventMap> {
  /** `disable-sticky` is read only by `:host([disable-sticky~="..."])` rules in page.styles.ts,
   *  so it is deliberately not a reactive property. Declared here so authoring the documented
   *  attribute does not draw an "unknown attribute" dev warning. */
  static override knownUnobservedAttributes: readonly string[] = ['disable-sticky'];

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    closeNavigation: LYRA_DEFAULT_closeNavigation,
    navigation: LYRA_DEFAULT_navigation,
    openNavigation: LYRA_DEFAULT_openNavigation,
    skipToContent: LYRA_DEFAULT_skipToContent,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Presentation derived from the Page's allocated inline size. It begins at `desktop` so server
   * output is deterministic, then reflects the first live allocation measurement. */
  @property({ reflect: true }) view: PageView = 'desktop';

  /** Whether mobile navigation is open. Desktop navigation remains visible independently. */
  @property({ type: Boolean, attribute: 'nav-open', reflect: true }) navOpen =
    false;

  /** Allocation breakpoint. Bare numbers/px, `rem`, and `em` use the shared CSS-length resolver;
   * invalid values fall back to `768px`. */
  @property({ attribute: 'mobile-breakpoint' }) mobileBreakpoint = '768px';

  /** Logical edge occupied by desktop navigation and the mobile drawer. */
  @property({ attribute: 'navigation-placement', reflect: true })
  navigationPlacement: PageNavigationPlacement = 'start';

  /** Hides the default mobile toggle. Slotted `data-toggle-nav` controls remain available. */
  @property({
    type: Boolean,
    attribute: 'disable-navigation-toggle',
    reflect: true,
  })
  disableNavigationToggle = false;

  /** Host-level accessible-name override forwarded to the internal navigation landmark. */
  @property({ attribute: 'aria-label' }) private accessibleLabel:
    | string
    | null = null;

  private readonly mainId = nextId('page-main');
  private readonly navigationId = nextId('page-navigation');
  private readonly drawerId = nextId('page-drawer');
  private readonly skipTargetId = nextId('page-skip-target');
  private readonly skipLabelId = nextId('page-skip-label');
  /** SSR-reachable native fragment relationship; private so it does not invent another IDL API. */
  @property({ attribute: 'id', reflect: true }) private fragmentTargetId:
    | string
    | null = this.getAttribute('id') || this.skipTargetId;
  /** SSR-reachable native focusability for the fragment target. */
  @property({ attribute: 'tabindex', reflect: true }) private fragmentTabIndex:
    | string
    | null = this.getAttribute('tabindex') ?? '-1';
  private resizeObserver?: ResizeObserver;
  private resizeView?: Window;
  private overlayHandle?: OverlayHandle;
  private navigationTriggerOwner?: HTMLElement;
  private customToggle?: HTMLElement;
  private customToggles: HTMLElement[] = [];
  private readonly customToggleOwnership = new Map<
    HTMLElement,
    CustomToggleOwnership
  >();

  @query('[part~="main"]') private mainElement?: HTMLElement;
  @query('[part~="drawer"]') private drawerElement?: HTMLElement;

  override connectedCallback(): void {
    super.connectedCallback();
    // A URL fragment cannot resolve to an id inside a shadow root. Make the host the real,
    // per-instance native fragment target while the click handler below moves focus to the
    // semantic main landmark inside. Preserve an author-supplied host id/tabindex.
    this.measureAllocation();
    this.observeAllocation();
    if (this.hasUpdated && this.view === 'mobile' && this.navOpen) {
      if (this.overlayHandle?.isActive()) this.overlayHandle.resume();
      else this.syncOverlay();
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
    if (this.hasUpdated)
      queueMicrotask(() => this.isConnected && this.syncCustomToggle());
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeView?.removeEventListener('resize', this.onWindowResize);
    this.resizeView = undefined;
    this.overlayHandle?.suspend();
    this.releaseCustomToggleA11y();
    super.disconnectedCallback();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.measureAllocation();
    this.observeAllocation();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('fragmentTargetId') && !this.fragmentTargetId) {
      this.fragmentTargetId = this.skipTargetId;
    }
    if (changed.has('fragmentTabIndex') && this.fragmentTabIndex === null) {
      this.fragmentTabIndex = '-1';
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (
      changed.has('mobileBreakpoint') &&
      changed.get('mobileBreakpoint') !== undefined
    ) {
      this.measureAllocation();
    }
    const deactivatingOverlay =
      this.overlayHandle !== undefined &&
      (!this.isConnected || this.view !== 'mobile' || !this.navOpen);
    if (deactivatingOverlay) {
      // The live focus-return resolver runs during deactivation after modal inerting is removed.
      // Re-resolve the custom control immediately afterwards so its closed-state ARIA ownership
      // also moves from the temporarily inert wrapper to the real composed focus target.
      this.syncOverlay(changed);
      this.syncCustomToggle();
    } else {
      this.syncCustomToggle();
      this.syncOverlay(changed);
    }
  }

  private observeAllocation(): void {
    if (!this.isConnected) return;
    this.resizeView?.removeEventListener('resize', this.onWindowResize);
    this.resizeView = undefined;
    const view = this.ownerDocument.defaultView;
    const ResizeObserverConstructor = view?.ResizeObserver;
    if (ResizeObserverConstructor) {
      this.resizeObserver ??= new ResizeObserverConstructor((entries) => {
        const entry =
          entries.find((candidate) => candidate.target === this) ?? entries[0];
        const inlineSize =
          entry?.contentBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width;
        if (inlineSize !== undefined) this.applyMeasuredInlineSize(inlineSize);
      });
      this.resizeObserver.observe(this);
      return;
    }
    if (view) {
      this.resizeView = view;
      view.addEventListener('resize', this.onWindowResize);
    }
  }

  private readonly onWindowResize = (): void => this.measureAllocation();

  private measureAllocation(): void {
    const width = this.getBoundingClientRect().width;
    if (width > 0) this.applyMeasuredInlineSize(width);
  }

  /** Applies an authoritative allocation measurement. Kept separate from ResizeObserver delivery
   * so reconnect and deterministic browser contracts exercise the same classification path. */
  private applyMeasuredInlineSize(width: number): void {
    if (!Number.isFinite(width) || width < 0) return;
    const resolved = resolveCssLength(this.mobileBreakpoint, { host: this });
    const fallback =
      resolveCssLength(DEFAULT_MOBILE_BREAKPOINT, { host: this }) ?? 768;
    const breakpoint = Math.max(
      0,
      resolved !== undefined && Number.isFinite(resolved) ? resolved : fallback
    );
    const next: PageView = width <= breakpoint ? 'mobile' : 'desktop';
    if (next !== this.view) this.view = next;
  }

  private syncOverlay(changed?: PropertyValues<this>): void {
    const shouldBeActive =
      this.isConnected && this.view === 'mobile' && this.navOpen;
    if (shouldBeActive) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
        if (this.navigationTriggerOwner) {
          this.overlayHandle.updateRestoreFocusTo(
            this.resolveNavigationRestoreTarget
          );
        }
        return;
      }
      this.overlayHandle = activateOverlay({
        host: this,
        panel: () => this.drawerElement ?? null,
        modalRoot: () => this.drawerElement ?? null,
        onEscape: () => this.hideNavigation(),
        onBackdrop: () => this.hideNavigation(),
        ...(this.navigationTriggerOwner
          ? { restoreFocusTo: this.resolveNavigationRestoreTarget }
          : {}),
        lockScroll: true,
        suspendWhenUnrendered: true,
      });
      this.overlayHandle.focusInitial();
      return;
    }

    if (this.overlayHandle) {
      const restoreFocus = Boolean(changed?.has('navOpen') && !this.navOpen);
      this.overlayHandle.deactivate({ restoreFocus });
      this.overlayHandle = undefined;
    }
    if (!this.navOpen) {
      this.navigationTriggerOwner = undefined;
    }
  }

  /** Resolves only after overlay cleanup has released Page-owned inerting. A disappearing opening
   * owner falls back deterministically without changing the captured-focus behavior of a drawer
   * opened programmatically. */
  private readonly resolveNavigationRestoreTarget = (): HTMLElement | null => {
    const owner = this.navigationTriggerOwner;
    if (owner?.isConnected) {
      const accessible = resolveAccessibleTrigger(owner);
      if (isComposedFocusAvailable(accessible)) return accessible;
    }
    const builtIn = this.disableNavigationToggle
      ? null
      : this.renderRoot.querySelector<HTMLElement>(
          '[part~="navigation-toggle"]'
        );
    if (builtIn && isComposedFocusAvailable(builtIn)) return builtIn;
    return this.mainElement && isComposedFocusAvailable(this.mainElement)
      ? this.mainElement
      : null;
  };

  private syncCustomToggle(): void {
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>(
      'slot[name="navigation-toggle"]'
    );
    // With no assigned light-DOM node, assignedElements({ flatten: true }) may return the fallback
    // shadow button. That control is rendered declaratively and must not enter the custom-toggle
    // ownership lifecycle below. Every assigned custom control is otherwise an equal trigger:
    // leaving later controls actionable but semantically stale would create conflicting disclosure
    // buttons for the same drawer.
    const nextToggles = (
      slot?.assignedElements({ flatten: true }) ?? []
    ).filter(
      (candidate): candidate is HTMLElement =>
        candidate.nodeType === 1 && candidate.getRootNode() !== this.shadowRoot
    );
    const previous = this.customToggle;
    this.customToggles = nextToggles;
    this.customToggle = nextToggles[0];

    for (const [host, ownership] of this.customToggleOwnership) {
      if (nextToggles.includes(host)) continue;
      ownership.accessibleAria?.release();
      ownership.hostAria.release();
      this.customToggleOwnership.delete(host);
    }

    const localizedLabel = this.localize(
      this.navOpen ? 'closeNavigation' : 'openNavigation'
    );
    const drawer = this.drawerElement;

    for (const host of nextToggles) {
      const accessible = resolveAccessibleTrigger(host);
      let ownership = this.customToggleOwnership.get(host);
      if (!ownership) {
        ownership = {
          accessible,
          accessibleAuthoredLabel: accessible.hasAttribute('aria-label')
            ? accessible.getAttribute('aria-label') ?? ''
            : null,
          hostAria: acquireAriaOwnership(null, {}),
          hostAuthoredLabel: host.hasAttribute('aria-label')
            ? host.getAttribute('aria-label') ?? ''
            : null,
        };
        this.customToggleOwnership.set(host, ownership);
      } else if (accessible !== ownership.accessible) {
        ownership.accessibleAria?.release();
        ownership.accessibleAria = undefined;
        ownership.accessible = accessible;
        ownership.accessibleAuthoredLabel = accessible.hasAttribute(
          'aria-label'
        )
          ? accessible.getAttribute('aria-label') ?? ''
          : null;
      }

      ownership.hostAria.update(host, {
        attributes: {
          'aria-haspopup': 'dialog',
          'aria-expanded': this.navOpen ? 'true' : 'false',
          'aria-label': ownership.hostAuthoredLabel ?? localizedLabel,
        },
        controls: drawer ? [drawer] : [],
      });

      const distinctAccessible = accessible === host ? null : accessible;
      const accessibleContribution = {
        attributes: {
          'aria-haspopup': 'dialog',
          'aria-expanded': this.navOpen ? 'true' : 'false',
          'aria-label':
            ownership.accessibleAuthoredLabel ??
            ownership.hostAuthoredLabel ??
            localizedLabel,
        },
        controls: drawer ? [drawer] : [],
      };
      if (ownership.accessibleAria) {
        ownership.accessibleAria.update(
          distinctAccessible,
          accessibleContribution
        );
      } else {
        ownership.accessibleAria = acquireAriaOwnership(
          distinctAccessible,
          accessibleContribution
        );
      }
    }

    if (
      this.navOpen &&
      this.navigationTriggerOwner &&
      !nextToggles.includes(this.navigationTriggerOwner)
    ) {
      this.navigationTriggerOwner = this.customToggle;
      this.overlayHandle?.updateRestoreFocusTo(
        this.resolveNavigationRestoreTarget
      );
    } else if (
      this.navOpen &&
      previous &&
      this.navigationTriggerOwner === previous
    ) {
      this.overlayHandle?.updateRestoreFocusTo(
        this.resolveNavigationRestoreTarget
      );
    }
  }

  private releaseCustomToggleA11y(): void {
    for (const ownership of this.customToggleOwnership.values()) {
      ownership.accessibleAria?.release();
      ownership.hostAria.release();
    }
    this.customToggleOwnership.clear();
    this.customToggle = undefined;
    this.customToggles = [];
  }

  private isUnavailableCustomToggle(trigger: HTMLElement): boolean {
    const accessible = resolveAccessibleTrigger(trigger);
    return [trigger, accessible].some(
      (candidate) =>
        candidate.hasAttribute('hidden') ||
        candidate.hasAttribute('inert') ||
        candidate.matches(':disabled') ||
        isAriaTrue(candidate.getAttribute('aria-hidden')) ||
        isAriaTrue(candidate.getAttribute('aria-disabled'))
    );
  }

  private rememberTriggerAndToggle(trigger: HTMLElement): void {
    this.syncCustomToggle();
    if (!this.navOpen) {
      this.navigationTriggerOwner = trigger;
    }
    this.toggleNavigation();
  }

  private readonly onDefaultToggleClick = (event: MouseEvent): void => {
    this.rememberTriggerAndToggle(event.currentTarget as HTMLElement);
  };

  private readonly onToggleSlotClick = (event: MouseEvent): void => {
    const trigger = event
      .composedPath()
      .find(
        (candidate): candidate is HTMLElement =>
          (candidate as Partial<Node> | null)?.nodeType === 1 &&
          (candidate as Element).getAttribute('slot') === 'navigation-toggle'
      );
    if (
      trigger &&
      this.customToggles.includes(trigger) &&
      !this.isUnavailableCustomToggle(trigger)
    ) {
      this.rememberTriggerAndToggle(trigger);
    }
  };

  private readonly onPageClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    // A custom navigation-toggle may also carry data-toggle-nav. Its dedicated slot listener has
    // already toggled once, so the delegated compatibility path must not toggle it back.
    if (
      path.some(
        (candidate) =>
          (candidate as Partial<Node> | null)?.nodeType === 1 &&
          (candidate as Element).getAttribute('slot') === 'navigation-toggle'
      )
    ) {
      return;
    }
    const trigger = path.find(
      (candidate): candidate is HTMLElement =>
        (candidate as Partial<Node> | null)?.nodeType === 1 &&
        (candidate as Element).hasAttribute('data-toggle-nav')
    );
    if (trigger) this.rememberTriggerAndToggle(trigger);
  };

  private readonly onBackdropClick = (event: MouseEvent): void => {
    if (event.target === event.currentTarget)
      this.overlayHandle?.dismissBackdrop();
  };

  private readonly onSkipClick = (event: MouseEvent): void => {
    event.preventDefault();
    this.mainElement?.focus();
    this.mainElement?.scrollIntoView({ block: 'start' });
  };

  /** Emits the cancelable lr-nav-toggle proposal before touching navOpen; a defaultPrevented
   *  request leaves it unchanged. Shared by every mutation path -- showNavigation(),
   *  hideNavigation(), toggleNavigation(), and the built-in drawer dismissals that call them. */
  private requestNavOpen(next: boolean): void {
    if (this.navOpen === next) return;
    if (
      this.emit('lr-nav-toggle', { open: next }, { cancelable: true })
        .defaultPrevented
    )
      return;
    this.navOpen = next;
  }

  /** Open mobile navigation. Desktop navigation is already visible, but the state is retained so
   * an open drawer can move through desktop and back without replacing its content. */
  showNavigation(): void {
    this.requestNavOpen(true);
  }

  /** Close mobile navigation. */
  hideNavigation(): void {
    this.requestNavOpen(false);
  }

  /** Toggle mobile navigation. */
  toggleNavigation(): void {
    this.requestNavOpen(!this.navOpen);
  }

  /** Number of vertically visible CSS pixels for `element`, clamped to the current viewport. */
  visiblePixelsInViewport(element: HTMLElement | null): number {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return 0;
    const view = element.ownerDocument.defaultView;
    const candidateHeight =
      view?.innerHeight ?? element.ownerDocument.documentElement.clientHeight;
    if (!Number.isFinite(candidateHeight) || candidateHeight <= 0) return 0;
    const viewportHeight = finiteRange(candidateHeight, 0, 0);
    const visible =
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    return finiteRange(visible, 0, 0, viewportHeight);
  }

  override render(): TemplateResult {
    const mobile = this.view === 'mobile';
    const overlayOpen = mobile && this.navOpen;
    const navigationLabel = this.accessibleLabel ?? this.localize('navigation');
    return html`
      <div part="base page" @click=${this.onPageClick}>
        <a
          part="skip-to-content"
          href=${`#${this.fragmentTargetId || this.skipTargetId}`}
          aria-labelledby=${this.skipLabelId}
          @click=${this.onSkipClick}
        >
          <span id=${this.skipLabelId} aria-hidden="true" inert>
            <slot name="skip-to-content"
              >${this.localize('skipToContent')}</slot
            >
          </span>
        </a>

        <div part="banner"><slot name="banner"></slot></div>
        <header part="header">
          <slot name="header"></slot>
          <div class="navigation-toggle-container">
            <slot
              name="navigation-toggle"
              @click=${this.onToggleSlotClick}
              @slotchange=${this.syncCustomToggle}
            >
              <button
                part="navigation-toggle"
                type="button"
                aria-haspopup="dialog"
                aria-expanded=${this.navOpen ? 'true' : 'false'}
                aria-controls=${this.drawerId}
                aria-label=${this.localize(
                  this.navOpen ? 'closeNavigation' : 'openNavigation'
                )}
                @click=${this.onDefaultToggleClick}
              >
                <span part="navigation-toggle-icon" aria-hidden="true" inert>
                  <slot name="navigation-toggle-icon">${navigationIcon()}</slot>
                </span>
              </button>
            </slot>
          </div>
        </header>
        <div part="subheader"><slot name="subheader"></slot></div>

        <div part="body">
          <div part="menu"><slot name="menu"></slot></div>
          <div part="dialog-wrapper" @click=${this.onBackdropClick}>
            <div
              id=${this.drawerId}
              part="drawer"
              role=${overlayOpen ? 'dialog' : nothing}
              aria-modal=${overlayOpen ? 'true' : nothing}
              aria-label=${overlayOpen ? navigationLabel : nothing}
              aria-hidden=${mobile && !this.navOpen ? 'true' : nothing}
              tabindex=${overlayOpen ? '-1' : nothing}
              ?inert=${mobile && !this.navOpen}
            >
              <nav
                id=${this.navigationId}
                part="navigation navigation-desktop"
                aria-label=${navigationLabel}
              >
                <div part="navigation-header">
                  <slot name="navigation-header"></slot>
                </div>
                <slot name="navigation"></slot>
                <div part="navigation-footer">
                  <slot name="navigation-footer"></slot>
                </div>
              </nav>
            </div>
          </div>

          <main id=${this.mainId} part="main" tabindex="-1">
            <div part="main-header"><slot name="main-header"></slot></div>
            <div part="main-content"><slot></slot></div>
            <div part="main-footer"><slot name="main-footer"></slot></div>
          </main>
          <aside part="aside"><slot name="aside"></slot></aside>
        </div>

        <footer part="footer"><slot name="footer"></slot></footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-page': LyraPage;
  }
}
