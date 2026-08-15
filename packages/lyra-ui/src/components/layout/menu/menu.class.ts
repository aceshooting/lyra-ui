import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { nextId, resolveAccessibleTrigger } from '../../../internal/a11y.js';
import type { LyraSize } from '../../../internal/variants.js';
import {
  collectFocusableElements,
  composedContains,
  deepActiveElement,
} from '../../../internal/overlay-manager.js';
import { styles } from './menu.styles.js';
import type { LyraMenuItem } from './menu-item.class.js';
import {
  menuItemOwner,
  submenuPanelController,
  type ContainedMenuOwner,
  type MenuFocusTarget,
  type MenuItemOwned,
  type MenuItemOwner,
  type SubmenuPanelController,
} from './menu-shared.js';
import { composedAccessibilityText } from '../../../internal/accessibility-visibility.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { tag } from '../../../internal/prefix.js';
import './menu-item.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { MenuFocusTarget } from './menu-shared.js';

/** WA-compatible selection detail. The complete item keeps `value`, checkbox state, and any
 * consumer metadata available without translating the activation into a lossy string. */
export interface MenuItemSelectDetail {
  readonly item: LyraMenuItem;
}

/** Where a submenu prefers to sit: beside its parent row, on the inline-end side. Resolved
 *  through `rtlAwarePlacement` and then flipped by `place()` when it does not fit. */
const SUBMENU_PLACEMENT: Placement = 'right-start';

/** How long the pointer must rest on a submenu parent before its submenu opens, in ms. Short
 *  enough not to feel sticky, long enough that sweeping the cursor down a list opens nothing. */
const SUBMENU_OPEN_DELAY = 150;

/** How long an open submenu survives the pointer leaving its parent row, in ms. This is the
 *  tolerance that lets the cursor cut diagonally across the rows below on its way to the
 *  submenu -- deliberately longer than the open delay, so crossing a *sibling* submenu parent
 *  in transit neither dismisses the open one nor opens the sibling. */
const SUBMENU_CLOSE_DELAY = 300;

function isLyraMenuItemElement(value: unknown): value is LyraMenuItem {
  if (!isHtmlElement(value)) return false;
  return (
    value.localName === tag('menu-item') ||
    value.localName === tag('dropdown-item')
  );
}

function isLyraMenuElement(value: unknown): value is LyraMenu {
  return isHtmlElement(value) && value.localName === tag('menu');
}

interface OwnedTimeout {
  owner: Window;
  handle: number;
}

export interface LyraMenuEventMap {
  'lr-select': CustomEvent<LyraEventDetailSnapshot<MenuItemSelectDetail>>;
}
/**
 * `<lr-menu>` — the inline semantic controller mapped from `<sl-menu>`. It owns the
 * `role="menu"` list, real roving focus, wrapping Arrow/Home/End navigation, typeahead, and the
 * single canonical `lr-select` event. Wrap it in `<lr-dropdown>` when a trigger, positioned popup,
 * open state, lifecycle events, or imperative overlay methods are required; those concerns belong
 * to the dropdown shell rather than being duplicated on the menu.
 *
 * An `<lr-menu-item>` with `<lr-menu slot="submenu">` uses a private, symbol-keyed presentation
 * controller. ArrowRight steps into the submenu and ArrowLeft returns (mirrored under RTL),
 * Enter/Space open the branch, Escape and outside pointer dismissal close only the innermost
 * branch, hover uses an intent delay, and at most one submenu per level stays open. This internal
 * shell does not add root-menu attributes, methods, parts, or lifecycle events.
 *
 * Selection is always one cancelable `lr-select` carrying the complete item. A nested selection
 * bubbles through every ancestor without translation or re-emission; preventing it anywhere keeps
 * the current branch open. Item-to-menu activation uses private owner plumbing, so neither
 * `lr-menu-item-select` nor `lr-menu-select` is part of the public contract.
 *
 * @customElement lr-menu
 * @slot - `<lr-menu-item>` elements, plus optionally plain `<hr>` dividers
 * between groups (native `<hr>` already carries an implicit `separator`
 * role, matching what `role="menu"` expects between item groups). Arbitrary
 * non-item content still renders here for backward compatibility, but the
 * `header`/`footer` slots below are the supported place for it.
 * @slot header - Composed content rendered above the items and *outside* the
 * `role="menu"` list — a filter/search field, a section title, a summary row.
 * Keeps its own full default keyboard behavior, is reachable with Tab from
 * the items, and is ARIA-valid (arbitrary content inside `role="menu"` is
 * not). Collapses to no box at all while unfilled.
 * @slot footer - Same as `header`, rendered below the items — an
 * "Apply"/"Done" button, a link to a fuller settings page, a count.
 * @event lr-select - WA-compatible selection event carrying `detail: { item }`. Cancelable;
 *   preventing it keeps the current menu/submenu chain open. Emitted once by the menu that owns
 *   the activated item and allowed to bubble through ancestors without translation/re-emission.
 * @csspart header - The wrapper around the `header` slot, above the list and
 * outside `role="menu"`. `display: none` while the slot is unfilled.
 * @csspart list - The `role="menu"` container wrapping the default slot.
 * @csspart footer - The wrapper around the `footer` slot, below the list and
 * outside `role="menu"`. `display: none` while the slot is unfilled.
 * @status stable
 * @since 4.0.0
 */
export class LyraMenu extends LyraElement<LyraMenuEventMap> {
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-select',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-select': Object.freeze(['item']),
  });

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @state() private presentationOpen = false;
  private submenuAnchor: HTMLElement | null = null;
  private submenuStateChange: ((open: boolean) => void) | null = null;

  /** Accessible name for the `role="menu"` list — override with something
   *  specific (e.g. "Row actions") when a page has more than one menu.
   *  Localized (`menuLabel`) when omitted. Any supplied string, including
   *  `"Menu"` or an empty string, remains literal. A host-level
   *  `aria-label` attribute takes precedence over both this prop and the
   *  localized default — including an explicit empty `aria-label=""` —
   *  matching `lr-select`/`lr-model-select`'s established
   *  `this.getAttribute('aria-label') ?? <computed default>` precedence
   *  (see `effectiveLabel`). */
  @property() label?: string;

  /** @internal Supplies only the menu interaction engine inside another component's popup. */
  @property({ type: Boolean, attribute: false }) dropdownContained = false;

  /** @internal Owner of a contained engine's open/focus-return lifecycle. */
  dropdownOwner: ContainedMenuOwner | null = null;

  /** @internal Open state supplied by the containing dropdown shell. */
  private _dropdownOpen = false;
  @property({ type: Boolean, attribute: false })
  get dropdownOpen(): boolean {
    return this._dropdownOpen;
  }
  set dropdownOpen(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._dropdownOpen) return;
    const old = this._dropdownOpen;
    this._dropdownOpen = normalized;
    this.presentationOpen = normalized;
    this.requestUpdate('dropdownOpen', old);
  }

  /** @internal Renders the menu role inside a contained engine when its outer popup owns a
   * different semantic role (for example, a dialog containing an action menu). */
  @property({ type: Boolean, attribute: false }) dropdownRendersMenuRole =
    false;

  /** @internal Mirrors the mapped dropdown's default-close policy. */
  @property({ type: Boolean, attribute: false }) dropdownStayOpenOnSelect =
    false;

  /** @internal Density propagated by the mapped dropdown to its directly owned items. */
  @property({ attribute: false }) dropdownSize: LyraSize | undefined;

  /** @internal Accessible-name fallback supplied by a containing dropdown. The menu's own
   * host `aria-label` and explicit `label` remain authoritative. */
  @property({ attribute: false }) dropdownLabel: string | undefined;

  // Plain instance fields, not @state() -- render()'s template never reads
  // either (items render via the plain default <slot>; there is no
  // activeIndex-driven markup), so reactively scheduling a re-render on
  // every roving-focus move would only trigger Lit's "scheduled an update
  // after an update completed" dev-mode warning for no visual benefit --
  // both only drive imperative side effects (applyRovingTabIndex()/.focus()).
  private items: LyraMenuItem[] = [];
  private activeIndex = -1;

  private cleanup?: () => void;
  private itemStateObserver?: MutationObserver;
  private pointerDocument?: Document;
  private pendingFocus: MenuFocusTarget = 'first';
  private submenuOpenTimer?: OwnedTimeout;
  private submenuCloseTimer?: OwnedTimeout;
  private readonly listId = nextId('menu-list');
  private readonly owningMenu: MenuItemOwner = {
    activate: (item) => this.onOwnedItemSelect(item),
  };
  // Standard menu type-ahead, mirroring lr-select's identical listbox
  // trio: printable keystrokes accumulate into this buffer and reset ~500ms
  // after the last one, so "d" then "e" narrows to "de" instead of
  // restarting the search on every keystroke.
  private typeAheadBuffer = '';
  private typeAheadTimer?: OwnedTimeout;

  /** @internal Symbol-keyed so submenu overlay mechanics never become a second public menu API. */
  readonly [submenuPanelController] = this.createSubmenuController();

  private createSubmenuController(): SubmenuPanelController {
    const menu = this;
    return {
      get open(): boolean {
        return menu.submenuAnchor !== null && menu.presentationOpen;
      },
      attach(anchor, onStateChange): void {
        if (menu.submenuAnchor && menu.submenuAnchor !== anchor)
          menu.closePresentation();
        menu.submenuAnchor = anchor;
        menu.submenuStateChange = onStateChange;
        menu.syncPresentationState();
        menu.requestUpdate();
      },
      detach(anchor): void {
        if (menu.submenuAnchor !== anchor) return;
        menu.closePresentation();
        menu.submenuAnchor = null;
        menu.submenuStateChange = null;
        menu.cleanup?.();
        menu.cleanup = undefined;
        menu.syncPresentationState();
        menu.requestUpdate();
      },
      async show(focus = 'first'): Promise<void> {
        if (!menu.submenuAnchor) return;
        menu.openPresentation(focus);
        await menu.updateComplete;
      },
      async hide(options): Promise<void> {
        menu.closePresentation(options);
        await menu.updateComplete;
      },
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      const slot =
        this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
      if (slot) this.syncItemsFromSlot(slot);
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // `slotchange` only fires when a slot's assigned nodes actually *change*,
    // so a slot that starts (and stays) empty never fires one at all. The
    // header/footer wrappers and the divider borders are driven off these
    // attributes, so seed them once from the real slots after the first render.
    this.syncRegionState();
    this.syncPresentationState();
  }

  /** A root mapped menu is inline; only an owning menu item installs the private submenu shell. */
  private get hasStandalonePresentation(): boolean {
    return !this.dropdownContained && !this.submenuAnchor;
  }

  private get interactionOpen(): boolean {
    return this.hasStandalonePresentation || this.presentationOpen;
  }

  /** Keeps the inline mapped shape visible and gives it one keyboard entry point. */
  private syncPresentationState(): void {
    const standalone = this.hasStandalonePresentation;
    this.toggleAttribute('data-inline', standalone);
    this.toggleAttribute('data-submenu', this.submenuAnchor !== null);
    this.toggleAttribute('data-contained', this.dropdownContained);
    if (standalone) {
      const active =
        this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
      if (!active || !this.isNavigable(active)) {
        const first = this.items.find((item) => this.isNavigable(item));
        this.activeIndex = first ? this.items.indexOf(first) : -1;
      }
    } else if (!this.presentationOpen) {
      this.activeIndex = -1;
    }
    this.applyRovingTabIndex();
  }

  private onRegionSlotChange = (): void => {
    this.syncRegionState();
  };

  /**
   * Reflects "is this slot filled?" onto the host so the stylesheet can collapse an unfilled
   * header/footer wrapper to no box at all, and can skip the divider border next to an empty
   * list. `:empty` cannot do this job: Chromium's `:empty` does not ignore the whitespace-only
   * text nodes Lit leaves inside a part, so a `[part='header']:empty` rule never matches.
   *
   * The polarity is deliberate -- `data-has-header`/`data-has-footer` are *absent* for a menu
   * with neither slot filled, and `data-list-empty` is absent for a menu that has items, so the
   * overwhelmingly common shape gains no host attribute of any kind.
   */
  private syncRegionState(): void {
    const assigned = (selector: string): number =>
      this.renderRoot
        .querySelector<HTMLSlotElement>(selector)
        ?.assignedElements({ flatten: true }).length ?? 0;
    this.toggleAttribute(
      'data-has-header',
      assigned('slot[name="header"]') > 0
    );
    this.toggleAttribute(
      'data-has-footer',
      assigned('slot[name="footer"]') > 0
    );
    this.toggleAttribute('data-list-empty', assigned('slot:not([name])') === 0);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('presentationOpen') ||
      changed.has('dropdownOpen') ||
      changed.has('dropdownContained')
    ) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.presentationOpen) {
        if (this.submenuAnchor) {
          this.bindDocumentPointer();
          this.reposition();
        } else this.unbindDocumentPointer();
        this.focusRoving(this.pendingFocus);
      } else {
        this.unbindDocumentPointer();
        this.resetTypeAhead();
        this.activeIndex = -1;
        this.applyRovingTabIndex();
        this.clearSubmenuTimers();
        this.closeSubmenus();
      }
    }
    if (changed.has('dropdownContained')) {
      this.syncPresentationState();
    }
    if (changed.has('dropdownSize')) this.applyDropdownSize();
  }

  private reposition(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const popup = this.renderRoot.querySelector(
      '.submenu-surface'
    ) as HTMLElement | null;
    if (this.submenuAnchor && popup) {
      const placement = rtlAwarePlacement(SUBMENU_PLACEMENT, this);
      this.cleanup = place(this.submenuAnchor, popup, { placement });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.clearOwnedTimeout(this.typeAheadTimer);
    this.typeAheadTimer = undefined;
    this.typeAheadBuffer = '';
    this.clearSubmenuTimers();
    this.itemStateObserver?.disconnect();
    this.itemStateObserver = undefined;
    this.unbindDocumentPointer();
    for (const item of this.items) this.releaseItemOwner(item);
    this._dropdownOpen = false;
    this.presentationOpen = false;
    this.submenuStateChange?.(false);
  }

  private bindDocumentPointer(): void {
    const owner = this.ownerDocument;
    if (this.pointerDocument === owner) return;
    this.unbindDocumentPointer();
    owner.addEventListener('pointerdown', this.onDocPointer);
    this.pointerDocument = owner;
  }

  private unbindDocumentPointer(): void {
    this.pointerDocument?.removeEventListener('pointerdown', this.onDocPointer);
    this.pointerDocument = undefined;
  }

  private scheduleOwnedTimeout(
    callback: () => void,
    delay: number
  ): OwnedTimeout | undefined {
    const owner = this.ownerDocument.defaultView;
    if (!owner) return undefined;
    return { owner, handle: owner.setTimeout(callback, delay) };
  }

  private clearOwnedTimeout(timer: OwnedTimeout | undefined): void {
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  /** @internal Focuses a contained dropdown menu through the shell that owns its lifecycle. */
  focusContained(focus: MenuFocusTarget = 'first'): void {
    if (this.dropdownContained && this.dropdownOwner) {
      if (this.dropdownOwner.open) {
        this.pendingFocus = focus;
        this.focusRoving(focus);
      } else {
        const transition = this.dropdownOwner.show();
        if (this.dropdownOwner.open) this.pendingFocus = focus;
        void transition;
      }
    }
  }

  private openPresentation(focus: MenuFocusTarget = 'first'): void {
    if (this.dropdownContained && this.dropdownOwner) {
      this.focusContained(focus);
      return;
    }
    this.pendingFocus = focus;
    if (this.presentationOpen) this.focusRoving(focus);
    else {
      this.presentationOpen = true;
      this.submenuStateChange?.(true);
    }
  }

  private closePresentation(options?: { focusTrigger?: boolean }): void {
    if (this.dropdownContained && this.dropdownOwner) {
      void this.dropdownOwner.hide(options);
      return;
    }
    if (!this.presentationOpen) return;
    this.presentationOpen = false;
    this.submenuStateChange?.(false);
    if (options?.focusTrigger && this.submenuAnchor) {
      resolveAccessibleTrigger(this.submenuAnchor).focus();
    }
  }

  private onDocPointer = (e: PointerEvent): void => {
    const path = e.composedPath();
    if (path.includes(this)) return;
    if (this.submenuAnchor && path.includes(this.submenuAnchor)) return;
    this.closePresentation();
  };

  private onItemsSlotChange = (e: Event): void => {
    this.syncItemsFromSlot(e.target as HTMLSlotElement);
  };

  private syncItemsFromSlot(slot: HTMLSlotElement): void {
    this.itemStateObserver?.disconnect();
    const previousItems = this.items;
    // A bounds check can't survive membership changes: adding, removing or
    // reordering items while open shifts survivors to new indices, so an
    // in-range activeIndex starts pointing at a different item. Re-resolve by
    // identity instead.
    const previouslyActive =
      this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    const focusedBefore = deepActiveElement(this.ownerDocument);
    const activeItemLostFocus =
      Boolean(previouslyActive) &&
      (focusedBefore === null ||
        focusedBefore === this.ownerDocument.body ||
        focusedBefore === previouslyActive ||
        composedContains(previouslyActive!, focusedBefore));
    this.items = slot
      .assignedElements({ flatten: true })
      .filter(isLyraMenuItemElement);
    for (const item of previousItems) {
      if (!this.items.includes(item)) this.releaseItemOwner(item);
    }
    for (const item of this.items) this.acquireItemOwner(item);
    this.applyDropdownSize();
    const MutationObserverCtor =
      this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverCtor) {
      const owner = this.ownerDocument;
      let observer: MutationObserver;
      observer = new MutationObserverCtor(() => {
        if (this.itemStateObserver !== observer || this.ownerDocument !== owner)
          return;
        this.onItemStateChange();
      });
      this.itemStateObserver = observer;
      for (const item of this.items) {
        this.itemStateObserver.observe(item, {
          attributes: true,
          attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'inert'],
        });
      }
    }
    this.activeIndex = previouslyActive
      ? this.items.indexOf(previouslyActive)
      : -1;
    this.syncPresentationState();
    this.syncRegionState();
    if (this.interactionOpen) {
      if (this.activeIndex === -1) {
        // Nothing left to preserve: the active item is gone, or nothing had
        // claimed the roving focus yet (the "open from the start" race that
        // onTriggerSlotChange's reposition() call also covers).
        this.focusRoving(this.pendingFocus);
        if (
          activeItemLostFocus &&
          !this.items.some((item) => this.isNavigable(item))
        ) {
          this.rehomeZeroSurvivorFocus();
        }
      } else if (!this.contains(this.ownerDocument.activeElement)) {
        // Reordering an item moves the node, which blurs it and drops focus out
        // to <body> -- beyond reach of the list keydown handler, leaving an open
        // menu keyboard-dead. The guard keeps this from stealing focus a user
        // parked on slotted non-item content, which stays within this element.
        this.items[this.activeIndex]!.focus();
      }
    }
  }

  private acquireItemOwner(item: LyraMenuItem): void {
    (item as unknown as Partial<MenuItemOwned>)[menuItemOwner]?.(
      this.owningMenu
    );
  }

  private releaseItemOwner(item: LyraMenuItem): void {
    (item as unknown as Partial<MenuItemOwned>)[menuItemOwner]?.(
      null,
      this.owningMenu
    );
  }

  /** `inert` counts alongside disabled/hidden because an inert element *refuses* focus: stepping
   *  onto one leaves `focus()` a silent no-op, so roving focus is stranded on whatever held it
   *  (or on `<body>`) and every later key press dies. `closest` covers an inert ancestor, which
   *  inerts the item just as completely as the attribute on the item itself. */
  private isNavigable(item: LyraMenuItem): boolean {
    return (
      !item.interactionDisabled &&
      !item.hidden &&
      item.getAttribute('aria-hidden') !== 'true' &&
      !item.inert &&
      !item.closest('[inert]')
    );
  }

  private applyDropdownSize(): void {
    if (!this.dropdownSize) return;
    for (const item of this.items) item.size = this.dropdownSize;
  }

  /** Rehomes roving focus immediately when an active item becomes disabled or hidden. */
  private onItemStateChange = (event?: Event): void => {
    // This is private item-to-owner coordination. Let the owning menu repair its roving stop,
    // then contain the implementation event so it cannot appear to originate from a composite
    // wrapper further up the tree.
    event?.stopPropagation();
    const navigable = this.items.filter((item) => this.isNavigable(item));
    if (
      this.activeIndex >= 0 &&
      !this.isNavigable(this.items[this.activeIndex]!)
    ) {
      const current = this.activeIndex;
      const displaced = this.items[current]!;
      const focused = deepActiveElement(this.ownerDocument);
      const displacedHadFocus =
        focused === null ||
        focused === this.ownerDocument.body ||
        focused === displaced ||
        composedContains(displaced, focused);
      const next =
        navigable.find((item) => this.items.indexOf(item) > current) ??
        navigable.find((item) => this.items.indexOf(item) < current);
      if (next) {
        this.setActiveItem(next);
      } else {
        this.activeIndex = -1;
        this.applyRovingTabIndex();
        if (displacedHadFocus) this.rehomeZeroSurvivorFocus();
      }
      return;
    }
    this.applyRovingTabIndex();
  };

  /** Never leave real DOM focus on a removed/inert final row. Trigger-owned menus close and return
   * focus through their public owner contract; a standalone menu falls back to its role owner. */
  private rehomeZeroSurvivorFocus(): void {
    if (this.dropdownContained && this.dropdownOwner) {
      void this.dropdownOwner.hide({ focusTrigger: true });
      return;
    }
    if (this.submenuAnchor) {
      this.closePresentation({ focusTrigger: true });
      return;
    }
    const list = this.renderRoot.querySelector<HTMLElement>('[part~="list"]');
    if (!list) return;
    list.tabIndex = -1;
    list.focus({ preventScroll: true });
  }

  private onOwnedItemSelect(item: HTMLElement): void {
    if (!isLyraMenuItemElement(item) || !this.items.includes(item)) return;
    const selectEvent = this.emit('lr-select', { item }, { cancelable: true });
    if (!selectEvent.defaultPrevented && !this.dropdownStayOpenOnSelect) {
      this.dismissAfterSelection(true);
    }
  }

  private dismissAfterSelection(focusTrigger: boolean): void {
    this.closeSubmenus();
    if (this.dropdownContained) {
      if (this.dropdownOwner) void this.dropdownOwner.hide({ focusTrigger });
    } else if (this.submenuAnchor) {
      this.closePresentation({ focusTrigger });
    }
  }

  /** Flips exactly one non-disabled item's `tabIndex` to `0` (the roving
   *  target) and every other item's to `-1` -- see `<lr-menu-item>`'s doc
   *  for why this is the sole authority over that property. */
  private applyRovingTabIndex(): void {
    this.items.forEach((item, i) => {
      item.tabIndex = i === this.activeIndex ? 0 : -1;
    });
  }

  /** Moves the roving focus (and real DOM focus) to the first/last
   *  non-disabled item. A no-op when there are none. */
  private focusRoving(which: MenuFocusTarget): void {
    if (which === 'none') return;
    const navigable = this.items.filter((i) => this.isNavigable(i));
    if (!navigable.length) return;
    const item =
      which === 'first' ? navigable[0] : navigable[navigable.length - 1];
    if (!item) return; // navigable is non-empty (checked above), so item is always defined
    this.setActiveItem(item);
  }

  private setActiveItem(item: LyraMenuItem): void {
    this.activeIndex = this.items.indexOf(item);
    this.applyRovingTabIndex();
    // Moving the roving highlight off a submenu parent closes what it opened: at most one submenu
    // per level is ever open, and the keyboard is the authority on which one.
    this.closeSubmenus(item);
    item.focus();
  }

  /** Closes every open submenu at this level except `keep`. */
  private closeSubmenus(keep?: LyraMenuItem): void {
    for (const item of this.items) {
      if (item !== keep && item.submenuOpen) item.closeSubmenu();
    }
  }

  private openSubmenuItem(): LyraMenuItem | undefined {
    return this.items.find((item) => item.submenuOpen);
  }

  private clearSubmenuTimers(): void {
    this.clearOwnedTimeout(this.submenuOpenTimer);
    this.clearOwnedTimeout(this.submenuCloseTimer);
    this.submenuOpenTimer = undefined;
    this.submenuCloseTimer = undefined;
  }

  /**
   * The row of *this* menu the event passed through, or `undefined` for one that touched none —
   * the *last* `LyraMenuItem` before this host on the path, deliberately not the first. Pointing
   * at a row inside an open submenu passes through that submenu's own row first and only then
   * through the row that opened it here, and the latter is the answer the hover bookkeeping
   * wants: the pointer is still inside the branch that row owns.
   */
  private ownItemFromEvent(e: Event): LyraMenuItem | undefined {
    let owner: LyraMenuItem | undefined;
    for (const node of e.composedPath()) {
      if (node === this) break;
      if (isLyraMenuItemElement(node)) owner = node;
    }
    return owner;
  }

  /**
   * Whether a nested `<lr-menu>` owns this event. Events from a submenu's rows reach this menu's
   * own delegated listeners (a submenu is light-DOM content inside one of this menu's items), and
   * without this guard an Escape or Arrow key inside a submenu would drive both menus at once.
   *
   * This is also the whole stacking story for a nested dismissible: the innermost open menu is
   * the one containing focus, it is the first `<lr-menu>` on the event's path, so it handles the
   * keypress and every ancestor declines -- no document-level listener and no shared overlay
   * stack are involved on either side.
   */
  private isForeignEvent(e: Event): boolean {
    for (const node of e.composedPath()) {
      if (node === this) return false;
      if (isLyraMenuElement(node)) return true;
    }
    return false;
  }

  /** Resyncs `activeIndex` (and the roving `tabindex`) to wherever real DOM
   *  focus actually lands, for any path that doesn't go through
   *  `setActiveItem()` -- e.g. a real mousedown on an item, which focuses it
   *  even while `disabled` (`tabIndex="-1"` remains mouse-focusable per
   *  spec). Without this, `activeIndex` goes stale the moment focus moves any
   *  other way, and subsequent Arrow-key navigation computes its next item
   *  from that stale position instead of from where focus actually is. A
   *  no-op for `setActiveItem()`'s own `.focus()` call, since `activeIndex`
   *  there is already set to match before focus moves. */
  private onListFocusIn = (e: FocusEvent): void => {
    const target = e.target;
    if (!isLyraMenuItemElement(target)) return;
    const index = this.items.indexOf(target);
    if (index === -1 || index === this.activeIndex) return;
    this.activeIndex = index;
    this.applyRovingTabIndex();
    // Focus landing on a different row is the same intent as an arrow key moving there: whatever
    // the row it left had open is no longer the branch the user is in. Focus moving *into* a
    // submenu is never this case -- that target is not one of this menu's own items.
    this.closeSubmenus(target);
  };

  private onListKeyDown = (e: KeyboardEvent): void => {
    // Everything below is scoped to this menu's own level: a keydown from inside a nested submenu
    // is that submenu's to handle, and driving both menus from one keypress would move two roving
    // highlights (or close two menus) at once.
    if (this.isForeignEvent(e)) return;
    const isItemTarget = isLyraMenuItemElement(e.target);
    if (e.key === 'Escape' && isItemTarget && !this.hasStandalonePresentation) {
      e.preventDefault();
      this.closePresentation({ focusTrigger: true });
      return;
    }
    if (!isItemTarget) return;
    const navigable = this.items.filter((i) => this.isNavigable(i));
    const current =
      this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    const currentNavIndex = current ? navigable.indexOf(current) : -1;
    // "Into the submenu" and "back out of it" are inline-direction moves, so both swap under RTL
    // -- the physical key that opens a submenu on the right opens nothing when submenus grow to
    // the left. Everything else on this switch is block-direction or direction-free.
    const intoSubmenuKey =
      this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        if (e.key === intoSubmenuKey) {
          if (current?.hasSubmenu && this.isNavigable(current)) {
            e.preventDefault();
            this.closeSubmenus(current);
            current.openSubmenu('first');
          }
        } else if (this.submenuAnchor) {
          // Only a submenu has anywhere to go back to; in a root menu this key stays untouched.
          e.preventDefault();
          this.closePresentation({ focusTrigger: true });
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (navigable.length) {
          const next =
            navigable[
              (currentNavIndex + 1 + navigable.length) % navigable.length
            ];
          if (next) this.setActiveItem(next); // modulo navigable.length keeps the index in-bounds
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (navigable.length) {
          const prevIndex =
            currentNavIndex <= 0 ? navigable.length - 1 : currentNavIndex - 1;
          const prev = navigable[prevIndex];
          if (prev) this.setActiveItem(prev); // prevIndex is in [0, navigable.length - 1]
        }
        break;
      case 'Home':
        e.preventDefault();
        if (navigable.length) this.setActiveItem(navigable[0]!); // safe: navigable non-empty
        break;
      case 'End':
        e.preventDefault();
        if (navigable.length)
          this.setActiveItem(navigable[navigable.length - 1]!); // safe: navigable non-empty
        break;
      case 'Enter':
      case ' ':
        // Mirrors lr-tree calling current.select() from its own delegated
        // keydown handler, rather than each row wiring its own keydown.
        e.preventDefault();
        // A submenu parent is a disclosure, not an action: activating it opens the submenu and
        // moves into it, exactly as the into-submenu arrow key does.
        if (current?.hasSubmenu) {
          this.closeSubmenus(current);
          current.openSubmenu('first');
        } else current?.select();
        break;
      // Tab is deliberately absent here: a private submenu surface handles it below,
      // which sees keydowns from the header/footer regions too and so can tell
      // "Tab moves within the surface" apart from "Tab leaves the surface". 'Tab'
      // is longer than one character, so the type-ahead default arm ignores it.
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        return;
    }
  };

  /**
   * Pointer intent for submenus, bound to the menu surface rather than to each row: an open
   * submenu is DOM-nested inside the row that opened it, so a `pointerover` anywhere within that
   * submenu still resolves to the parent row here (see `ownItemFromEvent`) and reads as "still
   * inside this branch". That, plus the close delay being longer than the open delay, is what
   * lets the cursor cut diagonally across the rows in between without the submenu vanishing.
   *
   * Focus is deliberately never moved: the pointer opens a submenu, it does not claim the
   * keyboard.
   */
  private onPopupPointerOver = (e: PointerEvent): void => {
    if (!this.interactionOpen) return;
    const hovered = this.ownItemFromEvent(e);
    this.clearOwnedTimeout(this.submenuOpenTimer);
    this.submenuOpenTimer = undefined;
    const opened = this.openSubmenuItem();
    if (opened && opened === hovered) {
      this.clearOwnedTimeout(this.submenuCloseTimer);
      this.submenuCloseTimer = undefined;
    } else if (opened) {
      this.scheduleSubmenuClose(opened);
    }
    if (
      !hovered ||
      hovered === opened ||
      !hovered.hasSubmenu ||
      !this.isNavigable(hovered)
    ) {
      return;
    }
    this.submenuOpenTimer = this.scheduleOwnedTimeout(() => {
      this.submenuOpenTimer = undefined;
      if (!this.interactionOpen || !this.items.includes(hovered)) return;
      this.closeSubmenus(hovered);
      hovered.openSubmenu('none');
    }, SUBMENU_OPEN_DELAY);
  };

  /** Leaving the popup entirely is the same intent as hovering a different row -- with one
   *  exception: crossing the gap between a popup and its own submenu fires this too, which is
   *  why it schedules rather than closes. */
  private onPopupPointerLeave = (): void => {
    this.clearOwnedTimeout(this.submenuOpenTimer);
    this.submenuOpenTimer = undefined;
    const opened = this.openSubmenuItem();
    if (opened) this.scheduleSubmenuClose(opened);
  };

  private scheduleSubmenuClose(item: LyraMenuItem): void {
    if (this.submenuCloseTimer) return;
    this.submenuCloseTimer = this.scheduleOwnedTimeout(() => {
      this.submenuCloseTimer = undefined;
      if (!item.submenuOpen) return;
      // A submenu the keyboard is inside was opened deliberately; dismissing it because the
      // pointer wandered off would strand focus on an element about to become invisible.
      if (composedContains(item, deepActiveElement(this.ownerDocument))) return;
      item.closeSubmenu();
    }, SUBMENU_CLOSE_DELAY);
  }

  /** A submenu's single `lr-select` keeps bubbling through every ancestor. Closure waits one
   * microtask so a consumer later on that same dispatch path can veto it. */
  private onNestedSelect = (e: Event): void => {
    if (e.target === this) return;
    const event = e as CustomEvent<MenuItemSelectDetail>;
    if (this.dropdownStayOpenOnSelect) event.preventDefault();
    queueMicrotask(() => {
      if (event.defaultPrevented) return;
      this.dismissAfterSelection(true);
    });
  };

  private popupPart(name: 'header' | 'list' | 'footer'): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[part="${name}"]`);
  }

  /**
   * Whether a Tab/Shift+Tab keypress would move focus out of the private submenu surface
   * altogether, rather than to another focusable inside it. Its Tab sequence is
   * `[header focusables, the list, footer focusables]`, and the list contributes exactly one stop
   * -- the roving `tabindex="0"` item.
   *
   * Non-item content slotted into the *default* slot is deliberately not part of that sequence
   * from an item's point of view: Tab from an `<lr-menu-item>` closes the menu exactly as it
   * always has unless there is a real region to move into. Tab *from* such content is still
   * measured against its default-slot neighbors, so a legacy two-control filter row keeps
   * working -- only tabbing past the last of them now closes the menu, which is the dismissal
   * hole this seals (previously the item-target gate swallowed the keypress entirely and focus
   * walked out of the popup while the menu stayed open).
   */
  private tabWouldLeavePopup(e: KeyboardEvent): boolean {
    const header = this.popupPart('header');
    const footer = this.popupPart('footer');
    const listEl = this.popupPart('list');
    const backwards = e.shiftKey;
    const active = deepActiveElement(this.ownerDocument) as HTMLElement | null;
    const headerStops = header ? collectFocusableElements(header) : [];
    const footerStops = footer ? collectFocusableElements(footer) : [];
    const listStops = listEl ? collectFocusableElements(listEl) : [];
    const hasNeighbor = (stops: HTMLElement[]): boolean => {
      const index = active ? stops.indexOf(active) : -1;
      if (index === -1) return false;
      return backwards ? index > 0 : index < stops.length - 1;
    };

    const path = e.composedPath();
    if (footer && path.includes(footer)) {
      if (hasNeighbor(footerStops)) return false;
      return backwards
        ? listStops.length === 0 && headerStops.length === 0
        : true;
    }
    if (header && path.includes(header)) {
      if (hasNeighbor(headerStops)) return false;
      return backwards
        ? true
        : listStops.length === 0 && footerStops.length === 0;
    }
    if (!isLyraMenuItemElement(e.target) && hasNeighbor(listStops))
      return false;
    return backwards ? headerStops.length === 0 : footerStops.length === 0;
  }

  /**
   * Bound to the private submenu surface rather than `[part='list']` so it also sees keydowns from the
   * `header`/`footer` regions, which sit outside the `role="menu"` list.
   *
   * Escape from those regions closes the submenu. Escape bubbling up from inside the list stays
   * with `onListKeyDown`, which can distinguish this submenu from an inline root menu.
   */
  private onPopupKeyDown = (e: KeyboardEvent): void => {
    const listEl = this.popupPart('list');
    if (e.key === 'Escape') {
      if (listEl && e.composedPath().includes(listEl)) return;
      if (this.hasStandalonePresentation) return;
      e.preventDefault();
      this.closePresentation({ focusTrigger: true });
      return;
    }
    // No preventDefault for Tab, in either branch -- the browser's own default
    // navigation is left to proceed untouched; only the private submenu closes, and only when Tab
    // is actually leaving its surface.
    if (e.key === 'Tab' && this.tabWouldLeavePopup(e)) this.closePresentation();
  };

  /** Standard WAI-ARIA APG menu-button type-ahead: moves the roving focus to
   *  the next non-disabled item whose text content starts with the
   *  accumulated buffer, cycling from just after the currently active item
   *  -- mirrors `<lr-select>`'s identical listbox type-ahead. */
  private typeAhead(char: string): void {
    this.clearOwnedTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    this.typeAheadTimer = this.scheduleOwnedTimeout(() => {
      this.typeAheadBuffer = '';
    }, 500);

    const navigable = this.items.filter((i) => this.isNavigable(i));
    if (!navigable.length) return;
    const current =
      this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    const currentIndex = current ? navigable.indexOf(current) : -1;
    const n = navigable.length;
    for (let step = 1; step <= n; step++) {
      const candidate = navigable[(currentIndex + step + n) % n];
      if (!candidate) continue; // modulo n keeps the index in-bounds; guard satisfies the checker
      if (
        this.itemText(candidate)
          .toLocaleLowerCase(this.effectiveLocale)
          .startsWith(this.typeAheadBuffer)
      ) {
        this.setActiveItem(candidate);
        return;
      }
    }
  }

  private resetTypeAhead(): void {
    this.clearOwnedTimeout(this.typeAheadTimer);
    this.typeAheadTimer = undefined;
    this.typeAheadBuffer = '';
  }

  /** What type-ahead matches against: the row's accessible name where it has one, its text
   *  otherwise. The distinction is load-bearing for a submenu parent, whose `textContent` also
   *  contains every label inside the submenu. */
  private itemText(item: LyraMenuItem): string {
    return composedAccessibilityText(item).trim();
  }

  /** Resolves `label`'s effective text: a host-level `aria-label` attribute wins first
   *  (unset by default, so this is a no-op for every existing consumer), then an explicit menu
   *  `label`, then a containing dropdown's label. With none of those supplied, it routes through
   *  `this.localize()` so a locale/`.strings` override applies without requiring `label` itself
   *  to be set. */
  private get effectiveLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel !== null) return hostLabel;
    if (this.label !== undefined) return this.label;
    if (this.dropdownLabel !== undefined) return this.dropdownLabel;
    return this.localize('menuLabel');
  }

  private renderContents(): TemplateResult {
    return html`
      <div part="header">
        <slot name="header" @slotchange=${this.onRegionSlotChange}></slot>
      </div>
      <div
        part="list"
        id=${this.listId}
        role="menu"
        aria-label=${this.effectiveLabel}
        @keydown=${this.onListKeyDown}
        @focusin=${this.onListFocusIn}
        @pointerover=${this.onPopupPointerOver}
        @pointerleave=${this.onPopupPointerLeave}
        @lr-menu-item-state-change=${this.onItemStateChange}
        @lr-select=${this.onNestedSelect}
      >
        <slot @slotchange=${this.onItemsSlotChange}></slot>
      </div>
      <div part="footer">
        <slot name="footer" @slotchange=${this.onRegionSlotChange}></slot>
      </div>
    `;
  }

  override render(): TemplateResult {
    if (!this.submenuAnchor) return this.renderContents();
    return html`
      <div
        class=${this.presentationOpen
          ? 'submenu-surface open'
          : 'submenu-surface'}
        @keydown=${this.onPopupKeyDown}
        @pointerover=${this.onPopupPointerOver}
        @pointerleave=${this.onPopupPointerLeave}
      >
        ${this.renderContents()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-menu': LyraMenu;
  }
}
