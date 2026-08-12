import { html, type TemplateResult, type PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import type { Placement } from "@floating-ui/dom";
import { LyraElement } from "../../../internal/lyra-element.js";
import { place } from "../../../internal/positioner.js";
import { rtlAwarePlacement } from "../../../internal/rtl.js";
import { nextId } from "../../../internal/a11y.js";
import type { LyraSize } from "../../../internal/variants.js";
import {
  collectFocusableElements,
  composedContains,
  deepActiveElement,
} from "../../../internal/overlay-manager.js";
import { styles } from "./menu.styles.js";
import { LyraMenuItem } from "./menu-item.class.js";
import type { ContainedMenuOwner, MenuFocusTarget } from "./menu-shared.js";
import "./menu-item.class.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { MenuFocusTarget } from "./menu-shared.js";

export interface MenuSelectDetail {
  value: string;
}

/** WA-compatible selection detail. The complete item keeps `value`, checkbox state, and any
 * consumer metadata available without translating the activation into a lossy string. */
export interface MenuItemSelectDetail {
  item: LyraMenuItem;
}

/** Where a submenu prefers to sit: beside its parent row, on the inline-end side. Resolved
 *  through `rtlAwarePlacement` and then flipped by `place()` when it does not fit. */
const SUBMENU_PLACEMENT: Placement = "right-start";

/** How long the pointer must rest on a submenu parent before its submenu opens, in ms. Short
 *  enough not to feel sticky, long enough that sweeping the cursor down a list opens nothing. */
const SUBMENU_OPEN_DELAY = 150;

/** How long an open submenu survives the pointer leaving its parent row, in ms. This is the
 *  tolerance that lets the cursor cut diagonally across the rows below on its way to the
 *  submenu -- deliberately longer than the open delay, so crossing a *sibling* submenu parent
 *  in transit neither dismisses the open one nor opens the sibling. */
const SUBMENU_CLOSE_DELAY = 300;

interface OwnedTimeout {
  owner: Window;
  handle: number;
}

export interface LyraMenuEventMap {
  "lr-show": CustomEvent<undefined>;
  "lr-hide": CustomEvent<undefined>;
  "lr-menu-select": CustomEvent<MenuSelectDetail>;
  "lr-select": CustomEvent<MenuItemSelectDetail>;
}
/**
 * `<lr-menu>` — a menu of `<lr-menu-item>` actions. With a consumer-supplied
 * `trigger` (typically an icon button), it is an anchored dropdown: click the
 * trigger, a positioned menu appears, and clicking an item both performs the
 * action *and* closes the menu. With no trigger or `anchor`, the exact mapped
 * `<sl-menu>` authoring shape instead renders as an inline, always-visible
 * standalone menu with one roving keyboard entry point.
 *
 * **ARIA pattern — `role="menu"`/`role="menuitem"` with real roving DOM
 * focus, not a listbox.** Two coherent, mutually-exclusive shapes were
 * available here: (a) `role="listbox"`/`role="option"` with
 * `aria-activedescendant`, the pattern `<lr-select>`'s trigger-button +
 * popup listbox uses, where DOM focus never leaves the trigger; or (b)
 * `role="menu"`/`role="menuitem"` with real focus moving between actual
 * focusable rows, the WAI-ARIA "menu button" pattern. This picks (b):
 * `<lr-menu-item>` rows are real, independently-focusable elements (see
 * that class's own doc), which is the more natural fit for a menu
 * specifically — unlike a listbox's rows, a menu's rows are conventionally
 * button-/link-shaped, and every well-known native/OS menu (and this
 * family's own `<lr-tree>`/`<lr-tree-item>` pair, which this component's
 * roving-tabindex plumbing directly mirrors) already moves real focus rather
 * than merely a virtual `aria-activedescendant` pointer. `role`/`tabIndex`
 * are consistently the menu-button shape throughout — never mixed with
 * listbox/option.
 *
 * Interaction contract (mirrors the WAI-ARIA APG "menu button" pattern):
 * - Click the trigger (or Enter/Space on it, via the trigger's own native
 *   `click` activation) toggles the menu, moving focus to the first
 *   non-disabled item on open.
 * - ArrowDown/ArrowUp on the trigger while closed also open it, focusing the
 *   first/last non-disabled item respectively.
 * - Once open, ArrowDown/ArrowUp move the roving focus among non-disabled
 *   items (wrapping past either end — the recommended, and more common,
 *   menu-widget behavior, unlike `<lr-select>`'s clamped listbox nav).
 *   Home/End jump to the first/last non-disabled item. Enter/Space activate
 *   the focused item. Escape closes and returns focus to the trigger. A
 *   printable keypress runs type-ahead: roving focus jumps to the next
 *   non-disabled item whose text starts with the accumulated buffer, cycling
 *   from just after the active item (mirrors `<lr-select>`'s identical
 *   listbox type-ahead). All of the above (except Escape and Tab) only
 *   respond to keydowns from a real `<lr-menu-item>` target, so a slotted
 *   non-item control (e.g. a date input) keeps its own full default keyboard
 *   behavior.
 * - Tab never traps focus and never calls `preventDefault()` — the browser's
 *   own Tab navigation always proceeds untouched. It closes the menu only
 *   when focus is on its way *out* of the popup: with a focusable in the
 *   `header`/`footer` region on the far side of the keypress, the menu stays
 *   open so native Tab can carry focus there instead. With neither region
 *   filled, Tab closes exactly as it always has. Tabbing past the popup's
 *   last focusable in either direction closes it too, including from slotted
 *   non-item content — which previously left the menu open while focus
 *   walked away.
 * - Escape from `header`/`footer` content closes the menu and refocuses the
 *   trigger unconditionally, mirroring `<lr-popover>`'s handling of arbitrary
 *   popup content. `closeOnEscapeAnywhere` governs only the *legacy* shape —
 *   non-item content slotted into the **default** slot — and defaults to
 *   `false`, so existing consumers keep today's behavior unchanged.
 * - An `<lr-menu-item>` with an `<lr-menu slot="submenu">` opens that nested
 *   menu beside itself. ArrowRight steps into it and focuses its first item;
 *   ArrowLeft closes it and returns focus to the parent row — both swap under
 *   RTL, since they are inline-direction moves. Enter/Space open it too
 *   (a submenu parent is a disclosure, never an action, so it fires no
 *   selection event). Escape inside a submenu closes only that submenu: the
 *   innermost open menu is the one holding focus and the first `<lr-menu>` on
 *   the event's path, so it handles the key and every ancestor declines.
 *   Hovering a submenu parent opens it after a short intent delay and leaving
 *   closes it after a longer one, which is the tolerance that lets the cursor
 *   cut diagonally across the rows in between. At most one submenu per level
 *   is open at a time, and closing a menu closes everything below it. A
 *   selection made in a submenu arrives as the outer menu's own
 *   `lr-menu-select` — one consolidated event for the whole tree.
 * - A click outside both the trigger and the open popup closes it (mirrors
 *   `<lr-select>`'s `onDocPointer` exactly) — this does *not* refocus the
 *   trigger, since the outside click itself already moved focus somewhere
 *   the user chose; Escape and a committed selection *do* refocus the
 *   trigger, since those are dismissals with nowhere else for focus to go.
 *
 * `show(focus?)` and `hide(options?)` are the public imperative pair, for the cases the trigger
 * can't express: a slotted "Apply"/"Done" button inside the menu, a keyboard shortcut, a parent
 * restoring UI state. `hide({ focusTrigger: true })` is the one that also returns DOM focus to the
 * trigger — use it whenever the interaction that closed the menu hasn't already put focus
 * somewhere the user chose. Writing `open` directly still works and is fully equivalent apart from
 * the focus moves: the roving-tabindex reset is centralized in `updated()`, so `el.open = false`
 * never leaves a stale `tabindex="0"` tab stop on the last active item.
 *
 * The trigger element itself is read from the `trigger` slot's assigned element (first one, if
 * several are assigned) and enhanced imperatively with
 * `aria-haspopup="menu"`/`aria-expanded`/`aria-controls` — the same "reach into a consumer-owned
 * light-DOM element to complete its a11y wiring" approach `<lr-dialog>` documents for its own
 * heading detection. `aria-controls` targets this menu host (which receives a stable generated
 * `id` only when the consumer did not supply one), rather than a shadow-private popup id, so the
 * relationship is resolvable from the trigger's root. `<lr-button>` and `<lr-icon-button>` observe
 * those attributes, forward the popup/expanded values to their shadow-internal native controls,
 * and resolve the controls element-reference onto that focused control. In supporting browsers,
 * assigning the element reference intentionally clears the internal control's serialized
 * `aria-controls` value; `ariaControlsElements` is the relationship's source of truth. Browsers
 * without the reflected element-reference API retain the string as a best-effort fallback.
 *
 * The popup is always rendered (never `display:none`) so `.focus()` calls on
 * its content work synchronously the instant it opens — visually hidden via
 * `visibility`/`opacity` instead (identical to `<lr-select>`'s own
 * `[part="listbox"]`). `visibility` is an inherited CSS property that
 * pierces the `<slot>` projection boundary, so every closed-state
 * `<lr-menu-item>` is automatically excluded from sequential (Tab-key)
 * navigation with no separate JS bookkeeping.
 *
 * @customElement lr-menu
 * @slot trigger - The consumer's own trigger element (typically an icon
 * button). Clicking it toggles the menu; it's positioned against via
 * `internal/positioner.js`'s `place()`.
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
 * @event lr-show - The menu is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed. Not fired for markup that renders open from the start,
 *   nor by a menu inside an `lr-dropdown`, whose owner runs the lifecycle instead.
 * @event lr-hide - The menu is about to close. Cancelable on the same terms as `lr-show`, except
 *   on disconnect, where a veto could not be honoured.
 * @event lr-menu-select - A `<lr-menu-item>` was activated. `detail: {
 * value }` — the consolidated re-fire of that item's own
 * `lr-menu-item-select` (see `<lr-menu-item>`'s doc for why listening
 * here, rather than on every item, is the recommended approach). It is
 * not cancelable; prevent the matching cancelable `lr-select` event to stop
 * closing and focus return, or set `stay-open-on-select` on a containing dropdown. A
 * selection inside a submenu surfaces through this same event on the
 * outermost menu, closing the whole chain behind it; a submenu's own
 * `lr-show`/`lr-hide` deliberately stop at the row that owns it, so they are
 * never mistaken for this menu opening or closing.
 * @event lr-select - WA-compatible selection event carrying `detail: { item }`. Cancelable;
 *   preventing it keeps the current menu/submenu chain open. Emitted once by the menu that owns
 *   the activated item and allowed to bubble through ancestors without translation/re-emission.
 * @csspart trigger - The wrapper around the `trigger` slot (the positioning anchor).
 * @csspart popup - The positioned floating panel.
 * @csspart header - The wrapper around the `header` slot, above the list and
 * outside `role="menu"`. `display: none` while the slot is unfilled.
 * @csspart list - The `role="menu"` container wrapping the default slot.
 * @csspart footer - The wrapper around the `footer` slot, below the list and
 * outside `role="menu"`. `display: none` while the slot is unfilled.
 * @status stable
 * @since 4.0.0
 */
export class LyraMenu extends LyraElement<LyraMenuEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Whether an anchored/trigger-owned popup is open. A triggerless, unanchored standalone menu
   * remains visible so an exact `<sl-menu>` to `<lr-menu>` tag rename preserves its presentation. */
  @property({ type: Boolean, reflect: true }) open = false;

  /**
   * Optional placement override forwarded to `place()`. Defaults to whatever `place()` itself
   * defaults to. A `left`/`right` side is resolved through `rtlAwarePlacement` semantics (see
   * `internal/rtl.ts`) so e.g. `placement="left-start"` still anchors to the menu's trailing edge
   * under RTL rather than pinning to the physical left.
   */
  @property({ reflect: true }) placement?: Placement;

  /** Accessible name for the `role="menu"` popup — override with something
   *  specific (e.g. "Row actions") when a page has more than one menu.
   *  Localized (`menuLabel`) when left at its default. A host-level
   *  `aria-label` attribute takes precedence over both this prop and the
   *  localized default — including an explicit empty `aria-label=""` —
   *  matching `lr-select`/`lr-model-select`'s established
   *  `this.getAttribute('aria-label') ?? <computed default>` precedence
   *  (see `effectiveLabel`). */
  @property() label = "Menu";

  /** Extends the Escape-closes-and-refocuses-trigger behavior to keydown
   *  events originating from non-item content slotted into the **default**
   *  slot, i.e. rendered within `[part="list"]` alongside the
   *  `<lr-menu-item>`s. Default `false` leaves Escape from such content with
   *  full default keyboard behavior, matching every existing consumer.
   *  Arrow/Home/End/Enter/Space stay scoped to real `<lr-menu-item>` targets
   *  regardless of this property — only Escape is affected.
   *
   *  It has no bearing on the `header`/`footer` slots, which sit outside
   *  `[part="list"]` and always close on Escape. Prefer those for composed
   *  controls: they are keyboard-reachable and ARIA-valid, whereas arbitrary
   *  content inside `role="menu"` is an `aria-required-children` violation. */
  @property({ type: Boolean, attribute: "close-on-escape-anywhere" })
  closeOnEscapeAnywhere = false;

  /**
   * Positions the popup against this element instead of the `trigger` slot's assigned element,
   * and makes it the target `hide({ focusTrigger: true })` returns focus to. Property-only: an
   * element reference has no attribute form.
   *
   * `<lr-menu-item>` sets it to itself on the menu assigned to its `submenu` slot, which is what
   * turns this instance into a submenu — the anchor is also what switches the default placement
   * from below the trigger to beside the anchoring row, and what keeps a pointerdown on that row
   * from reading as an outside click. Setting it by hand anchors a menu to any element, for a
   * trigger this component cannot slot (a canvas hit region, a table cell).
   */
  @property({ attribute: false }) anchor: HTMLElement | null = null;

  /** @internal Supplies only the menu interaction engine inside another component's popup. */
  @property({ type: Boolean, attribute: false }) dropdownContained = false;

  /** @internal Owner of a contained engine's open/focus-return lifecycle. */
  dropdownOwner: ContainedMenuOwner | null = null;

  /** @internal Mirrors the mapped dropdown's default-close policy. */
  @property({ type: Boolean, attribute: false }) dropdownStayOpenOnSelect = false;

  /** @internal Density propagated by the mapped dropdown to its directly owned items. */
  @property({ attribute: false }) dropdownSize: LyraSize | undefined;

  // Plain instance fields, not @state() -- render()'s template never reads
  // either (items render via the plain default <slot>; there is no
  // activeIndex-driven markup), so reactively scheduling a re-render on
  // every roving-focus move would only trigger Lit's "scheduled an update
  // after an update completed" dev-mode warning for no visual benefit --
  // both only drive imperative side effects (applyRovingTabIndex()/.focus()).
  private items: LyraMenuItem[] = [];
  private activeIndex = -1;

  private triggerEl?: HTMLElement;
  private cleanup?: () => void;
  private itemStateObserver?: MutationObserver;
  private pointerDocument?: Document;
  private _isFirstUpdate = true;
  private openVetoed = false;
  private pendingFocus: MenuFocusTarget = "first";
  private submenuOpenTimer?: OwnedTimeout;
  private submenuCloseTimer?: OwnedTimeout;
  private readonly generatedHostId = nextId("menu");
  private readonly listId = nextId("menu-list");
  // Standard menu type-ahead, mirroring lr-select's identical listbox
  // trio: printable keystrokes accumulate into this buffer and reset ~500ms
  // after the last one, so "d" then "e" narrows to "de" instead of
  // restarting the search on every keystroke.
  private typeAheadBuffer = "";
  private typeAheadTimer?: OwnedTimeout;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.id) this.id = this.generatedHostId;
    if (this.hasUpdated) {
      const slot = this.renderRoot.querySelector<HTMLSlotElement>("slot:not([name])");
      if (slot) this.syncItemsFromSlot(slot);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this._isFirstUpdate = !this.hasUpdated;
    this.announceOpenTransition(changed);
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` veto point for this update's `open` transition.
   *
   * It lives here rather than in `updated()` because a veto has to be answered *before* anything
   * observable happens: `willUpdate()` still runs ahead of render and attribute reflection, so
   * restoring `open` here leaves the menu, the reflected attribute and the property agreeing with
   * each other without a visible open-then-close flash. Keeping it on the `open` transition
   * (rather than inside `show()`/`hide()`) preserves the existing rule that the lifecycle fires
   * however `open` changed, including a direct `el.open = true` that bypasses both methods. A
   * dropdown-contained menu announces nothing here -- its owning `lr-dropdown` runs the lifecycle,
   * and two vetoable events for one transition would be worse than none.
   */
  private announceOpenTransition(changed: PropertyValues): void {
    this.openVetoed = false;
    if (!changed.has("open") || this._isFirstUpdate || this.dropdownContained) return;
    const name = this.open ? "lr-show" : "lr-hide";
    // Removal cannot be vetoed -- the element is already gone -- so the disconnect-driven close
    // is announced without offering a veto nobody could honour.
    if (!this.isConnected) {
      this.emit("lr-hide");
      return;
    }
    if (!this.emit(name, undefined, { cancelable: true }).defaultPrevented) return;
    this.openVetoed = true;
    this.open = !this.open;
  }

  protected override firstUpdated(): void {
    // `slotchange` only fires when a slot's assigned nodes actually *change*,
    // so a slot that starts (and stays) empty never fires one at all. The
    // header/footer wrappers and the divider borders are driven off these
    // attributes, so seed them once from the real slots after the first render.
    this.syncRegionState();
    this.syncPresentationState();
  }

  /** A mapped Shoelace menu without a trigger is an inline menu, not a closed popup. */
  private get hasStandalonePresentation(): boolean {
    return (
      !this.dropdownContained &&
      !this.anchor &&
      this.getAttribute("slot") !== "submenu" &&
      !this.triggerEl
    );
  }

  /** Keeps the inline mapped shape visible and gives it one keyboard entry point. */
  private syncPresentationState(): void {
    const standalone = this.hasStandalonePresentation;
    this.toggleAttribute("data-standalone", standalone);
    if (standalone) {
      const active = this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
      if (!active || !this.isNavigable(active)) {
        const first = this.items.find((item) => this.isNavigable(item));
        this.activeIndex = first ? this.items.indexOf(first) : -1;
      }
    } else if (!this.open) {
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
      "data-has-header",
      assigned('slot[name="header"]') > 0
    );
    this.toggleAttribute(
      "data-has-footer",
      assigned('slot[name="footer"]') > 0
    );
    this.toggleAttribute("data-list-empty", assigned("slot:not([name])") === 0);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // A vetoed transition already put `open` back during willUpdate(), so `changed` still names it
    // while nothing about the state actually moved: tearing down and rebuilding the popup
    // machinery here would undo the veto it was meant to honour.
    if ((changed.has("open") || changed.has("dropdownContained")) && !this.openVetoed) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All open-driven side effects (positioning, the click-outside
      // listener, and moving focus into the menu) live here rather than in
      // show()/hide() so they fire however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both. Mirrors lr-select,
      // whose lr-show/lr-hide veto point likewise runs one step earlier, in
      // willUpdate().
      if (this.open) {
        if (!this.dropdownContained) {
          this.bindDocumentPointer();
        } else {
          this.unbindDocumentPointer();
        }
        // Both reposition() and focusRoving() no-op gracefully if triggerEl/
        // items aren't populated yet -- for markup that renders `open` true
        // from the start, the trigger/default slots' *own* slotchange events
        // (queued as microtasks) can still be pending at this point, ahead of
        // Lit's synchronous first update. onTriggerSlotChange/
        // onItemsSlotChange below re-run these same two calls once that
        // catches up, so this always resolves correctly either way.
        if (!this.dropdownContained) this.reposition();
        this.focusRoving(this.pendingFocus);
      } else {
        this.unbindDocumentPointer();
        // The roving state is reset here, not in hide(), for the same reason every other
        // open-driven side effect lives here: `open` can become false through hide(), through a
        // consumer writing `el.open = false` directly, or through disconnectedCallback()'s
        // teardown reset -- and a closed menu must never leave a stale `tabindex="0"` tab stop on
        // whichever item happened to be active. Focus restoration deliberately stays in hide()
        // (see its doc): it is a user-intent-driven dismissal, and routing it through here would
        // also fire it on the disconnectedCallback() path, stealing focus during teardown.
        this.activeIndex = -1;
        this.applyRovingTabIndex();
        // Closing a menu closes everything it owns: a submenu left open would keep its own
        // outside-click listener and, on reopen, come back already expanded.
        this.clearSubmenuTimers();
        this.closeSubmenus();
      }
      if (!this.dropdownContained) this.syncTriggerA11y();
    } else if (!this.dropdownContained && this.open && (changed.has("placement") || changed.has("anchor"))) {
      // A placement change while already open must move the popup immediately --
      // otherwise the Floating UI subscription established at open time keeps
      // running with the stale placement baked into its computePosition options,
      // and the new value only takes effect on the *next* open. reposition()
      // tears down and re-subscribes, so re-invoking it here is safe.
      this.reposition();
    }
    if (changed.has("anchor") || changed.has("dropdownContained")) {
      this.syncPresentationState();
    }
    if (changed.has("dropdownSize")) this.applyDropdownSize();
  }

  private reposition(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const popup = this.renderRoot.querySelector(
      '[part="popup"]'
    ) as HTMLElement | null;
    // An anchored (submenu) menu positions against its anchoring row; everything else against the
    // slotted trigger. A submenu also defaults to sitting *beside* that row rather than below it,
    // which `rtlAwarePlacement` mirrors under RTL and `place()`'s flip() moves to the other side
    // when the preferred one would overflow.
    const anchorEl = this.anchor ?? this.triggerEl;
    const requested =
      this.placement ?? (this.anchor ? SUBMENU_PLACEMENT : undefined);
    if (anchorEl && popup) {
      const placement = requested && rtlAwarePlacement(requested, this);
      this.cleanup = place(anchorEl, popup, placement ? { placement } : {});
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.clearOwnedTimeout(this.typeAheadTimer);
    this.typeAheadTimer = undefined;
    this.typeAheadBuffer = "";
    this.clearSubmenuTimers();
    this.itemStateObserver?.disconnect();
    this.itemStateObserver = undefined;
    this.unbindDocumentPointer();
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the menu rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  private bindDocumentPointer(): void {
    const owner = this.ownerDocument;
    if (this.pointerDocument === owner) return;
    this.unbindDocumentPointer();
    owner.addEventListener("pointerdown", this.onDocPointer);
    this.pointerDocument = owner;
  }

  private unbindDocumentPointer(): void {
    this.pointerDocument?.removeEventListener("pointerdown", this.onDocPointer);
    this.pointerDocument = undefined;
  }

  private scheduleOwnedTimeout(callback: () => void, delay: number): OwnedTimeout | undefined {
    const owner = this.ownerDocument.defaultView;
    if (!owner) return undefined;
    return { owner, handle: owner.setTimeout(callback, delay) };
  }

  private clearOwnedTimeout(timer: OwnedTimeout | undefined): void {
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  /**
   * Opens the menu, moving roving focus to the first (or, with `'last'`, the last) non-disabled
   * item. Public so a consumer can open the menu from something other than the `trigger`-slotted
   * element -- a keyboard shortcut, a context-menu gesture, a parent component restoring UI
   * state -- without reproducing `pendingFocus`'s bookkeeping by hand. Deliberately thin:
   * `updated()` remains the single owner of positioning, the outside-click listener, the
   * `lr-show`/`lr-hide` events, and the initial focus move, so `el.open = true` behaves
   * identically apart from the focus target.
   *
   * `'none'` opens without moving DOM focus at all, for pointer-driven opening (a hovered
   * submenu) where pulling focus out from under the keyboard would be wrong -- and would strand
   * it on a hidden element as soon as the pointer moved on. On an already-open menu this applies
   * the focus target and nothing else, so ArrowRight can step into a submenu the pointer opened
   * a moment earlier.
   */
  show(focus: MenuFocusTarget = "first"): void {
    this.pendingFocus = focus;
    if (this.dropdownContained && this.dropdownOwner) {
      if (this.dropdownOwner.open) this.focusRoving(focus);
      else void this.dropdownOwner.show();
      return;
    }
    if (this.open) {
      this.focusRoving(focus);
      return;
    }
    this.open = true;
  }

  /**
   * Closes the menu. A no-op when already closed.
   *
   * `options.focusTrigger` returns DOM focus to the `trigger`-slotted element -- or, for an
   * anchored menu (a submenu), to its `anchor`, which is the row that opened it. Synchronously. Pass
   * it for a dismissal with nowhere else for focus to land -- a slotted "Apply"/"Done" button
   * inside the menu, a keyboard shortcut, Escape-like handling of your own. Leave it unset when
   * the interaction that closed the menu has already put focus somewhere the user chose (an
   * outside click, a Tab out) -- see the class doc's interaction contract.
   *
   * Deliberately thin, and deliberately *not* the owner of the roving-tabindex reset: that lives
   * in `updated()` so a bare `el.open = false` gets it too.
   */
  hide(options?: { focusTrigger?: boolean }): void {
    if (this.dropdownContained && this.dropdownOwner) {
      void this.dropdownOwner.hide(options);
      return;
    }
    if (!this.open) return;
    this.open = false;
    if (options?.focusTrigger) (this.triggerEl ?? this.anchor)?.focus();
  }

  private onDocPointer = (e: PointerEvent): void => {
    const path = e.composedPath();
    if (path.includes(this)) return;
    // An anchored menu's anchor is its trigger, and lives outside this element -- pressing it
    // must not read as an outside click, or the submenu closes on pointerdown and reopens on the
    // click that follows.
    if (this.anchor && path.includes(this.anchor)) return;
    this.hide();
  };

  private onTriggerClick = (): void => {
    this.open ? this.hide() : this.show();
  };

  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    // A safety net for a menu with zero navigable items: focus never leaves
    // the trigger in that edge case (see focusRoving()), so onListKeyDown's
    // own Escape handling would otherwise never run.
    if (e.key === "Escape" && this.open) {
      e.preventDefault();
      this.hide({ focusTrigger: true });
      return;
    }
    if (this.open) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.show("first");
        break;
      case "ArrowUp":
        e.preventDefault();
        this.show("last");
        break;
      default:
        return;
    }
  };

  private onTriggerSlotChange = (e: Event): void => {
    const assigned = (e.target as HTMLSlotElement).assignedElements({
      flatten: true,
    });
    const next = assigned[0] as HTMLElement | undefined;
    if (next === this.triggerEl) return;
    if (this.triggerEl) {
      this.triggerEl.removeAttribute("aria-haspopup");
      this.triggerEl.removeAttribute("aria-expanded");
      this.triggerEl.removeAttribute("aria-controls");
    }
    this.triggerEl = next;
    this.syncPresentationState();
    this.syncTriggerA11y();
    // Covers the "open from the start" race documented on reposition()'s
    // call in updated() -- a no-op resubscribe once already positioned.
    if (this.open) this.reposition();
  };

  /** `aria-haspopup`/`aria-expanded`/`aria-controls` belong on the actual interactive trigger,
   *  which is consumer-owned light-DOM content outside this component's own shadow root. The
   *  controls target is this host rather than `[part="list"]`: the latter's id is private to this
   *  shadow root and cannot form a valid reference from the trigger -- see the class doc. */
  private syncTriggerA11y(): void {
    if (!this.triggerEl) return;
    this.triggerEl.setAttribute("aria-haspopup", "menu");
    this.triggerEl.setAttribute("aria-expanded", this.open ? "true" : "false");
    this.triggerEl.setAttribute("aria-controls", this.id);
  }

  private onItemsSlotChange = (e: Event): void => {
    this.syncItemsFromSlot(e.target as HTMLSlotElement);
  };

  private syncItemsFromSlot(slot: HTMLSlotElement): void {
    this.itemStateObserver?.disconnect();
    // A bounds check can't survive membership changes: adding, removing or
    // reordering items while open shifts survivors to new indices, so an
    // in-range activeIndex starts pointing at a different item. Re-resolve by
    // identity instead.
    const previouslyActive =
      this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    this.items = slot
      .assignedElements({ flatten: true })
      .filter((el): el is LyraMenuItem => el instanceof LyraMenuItem);
    this.applyDropdownSize();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverCtor) {
      const owner = this.ownerDocument;
      let observer: MutationObserver;
      observer = new MutationObserverCtor(() => {
        if (this.itemStateObserver !== observer || this.ownerDocument !== owner) return;
        this.onItemStateChange();
      });
      this.itemStateObserver = observer;
      for (const item of this.items) {
        this.itemStateObserver.observe(item, {
          attributes: true,
          attributeFilter: ["disabled", "hidden", "aria-hidden", "inert"],
        });
      }
    }
    this.activeIndex = previouslyActive
      ? this.items.indexOf(previouslyActive)
      : -1;
    this.syncPresentationState();
    this.syncRegionState();
    if (this.open) {
      if (this.activeIndex === -1) {
        // Nothing left to preserve: the active item is gone, or nothing had
        // claimed the roving focus yet (the "open from the start" race that
        // onTriggerSlotChange's reposition() call also covers).
        this.focusRoving(this.pendingFocus);
      } else if (!this.contains(this.ownerDocument.activeElement)) {
        // Reordering an item moves the node, which blurs it and drops focus out
        // to <body> -- beyond reach of the list keydown handler, leaving an open
        // menu keyboard-dead. The guard keeps this from stealing focus a user
        // parked on slotted non-item content, which stays within this element.
        this.items[this.activeIndex]!.focus();
      }
    }
  }

  /** `inert` counts alongside disabled/hidden because an inert element *refuses* focus: stepping
   *  onto one leaves `focus()` a silent no-op, so roving focus is stranded on whatever held it
   *  (or on `<body>`) and every later key press dies. `closest` covers an inert ancestor, which
   *  inerts the item just as completely as the attribute on the item itself. */
  private isNavigable(item: LyraMenuItem): boolean {
    return (
      !item.interactionDisabled &&
      !item.hidden &&
      item.getAttribute("aria-hidden") !== "true" &&
      !item.inert &&
      !item.closest("[inert]")
    );
  }

  private applyDropdownSize(): void {
    if (!this.dropdownSize) return;
    for (const item of this.items) item.size = this.dropdownSize;
  }

  /** Rehomes roving focus immediately when an active item becomes disabled or hidden. */
  private onItemStateChange = (): void => {
    const navigable = this.items.filter((item) => this.isNavigable(item));
    if (
      this.activeIndex >= 0 &&
      !this.isNavigable(this.items[this.activeIndex]!)
    ) {
      const current = this.activeIndex;
      const next =
        navigable.find((item) => this.items.indexOf(item) > current) ??
        navigable.find((item) => this.items.indexOf(item) < current);
      if (next) {
        this.setActiveItem(next);
      } else {
        this.activeIndex = -1;
        this.applyRovingTabIndex();
      }
      return;
    }
    this.applyRovingTabIndex();
  };

  private onItemSelect = (e: Event): void => {
    // A nested submenu's own items are its business: its list handler already consumed and
    // re-fired the event, and stopping it a second time here would be stopping our own re-fire.
    // Path-based rather than a lookup in `items`, which is only populated once the default slot
    // has fired its first slotchange -- a selection can legitimately arrive before that.
    if (this.isForeignEvent(e)) return;
    const item = e.target;
    if (!(item instanceof LyraMenuItem)) return;
    // The item's own lr-menu-item-select bubbles+composes (LyraElement.emit()'s defaults) --
    // without stopping it here it would keep bubbling straight through this component under its
    // own, undocumented name, right behind the consolidated lr-menu-select below.
    e.stopPropagation();
    const selectEvent = this.emit("lr-select", { item }, { cancelable: true });
    this.emit("lr-menu-select", { value: item.value });
    if (!selectEvent.defaultPrevented && !this.dropdownStayOpenOnSelect) {
      this.hide({ focusTrigger: true });
    }
  };

  /** Flips exactly one non-disabled item's `tabIndex` to `0` (the roving
   *  target) and every other item's to `-1` -- see `<lr-menu-item>`'s doc
   *  for why this is the sole authority over that property. */
  private applyRovingTabIndex(): void {
    this.items.forEach((item, i) => {
      item.tabIndex = i === this.activeIndex ? 0 : -1;
    });
  }

  /** Moves the roving focus (and real DOM focus) to the first/last
   *  non-disabled item. A no-op when there are none -- focus then simply
   *  stays on the trigger (see onTriggerKeyDown's Escape safety net). */
  private focusRoving(which: MenuFocusTarget): void {
    if (which === "none") return;
    const navigable = this.items.filter((i) => this.isNavigable(i));
    if (!navigable.length) return;
    const item =
      which === "first" ? navigable[0] : navigable[navigable.length - 1];
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
      if (node instanceof LyraMenuItem) owner = node;
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
      if (node instanceof LyraMenu) return true;
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
    if (!(target instanceof LyraMenuItem)) return;
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
    const isItemTarget = e.target instanceof LyraMenuItem;
    // Escape alone can be opted in (via closeOnEscapeAnywhere) to close the
    // menu from slotted non-item content too, e.g. a slotted form control --
    // every other key below stays scoped to real LyraMenuItem targets so it
    // never hijacks keydown from arbitrary slotted content (the bug the
    // instanceof guard below exists to prevent).
    if (e.key === "Escape" && (isItemTarget || this.closeOnEscapeAnywhere)) {
      e.preventDefault();
      this.hide({ focusTrigger: true });
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
      this.effectiveDirection === "rtl" ? "ArrowLeft" : "ArrowRight";

    switch (e.key) {
      case "ArrowRight":
      case "ArrowLeft":
        if (e.key === intoSubmenuKey) {
          if (current?.hasSubmenu && this.isNavigable(current)) {
            e.preventDefault();
            this.closeSubmenus(current);
            current.openSubmenu("first");
          }
        } else if (this.anchor) {
          // Only a submenu has anywhere to go back to; in a root menu this key stays untouched.
          e.preventDefault();
          this.hide({ focusTrigger: true });
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (navigable.length) {
          const next =
            navigable[
              (currentNavIndex + 1 + navigable.length) % navigable.length
            ];
          if (next) this.setActiveItem(next); // modulo navigable.length keeps the index in-bounds
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (navigable.length) {
          const prevIndex =
            currentNavIndex <= 0 ? navigable.length - 1 : currentNavIndex - 1;
          const prev = navigable[prevIndex];
          if (prev) this.setActiveItem(prev); // prevIndex is in [0, navigable.length - 1]
        }
        break;
      case "Home":
        e.preventDefault();
        if (navigable.length) this.setActiveItem(navigable[0]!); // safe: navigable non-empty
        break;
      case "End":
        e.preventDefault();
        if (navigable.length)
          this.setActiveItem(navigable[navigable.length - 1]!); // safe: navigable non-empty
        break;
      case "Enter":
      case " ":
        // Mirrors lr-tree calling current.select() from its own delegated
        // keydown handler, rather than each row wiring its own keydown.
        e.preventDefault();
        // A submenu parent is a disclosure, not an action: activating it opens the submenu and
        // moves into it, exactly as the into-submenu arrow key does.
        if (current?.hasSubmenu) {
          this.closeSubmenus(current);
          current.openSubmenu("first");
        } else current?.select();
        break;
      // Tab is deliberately absent here: it is owned by onPopupKeyDown below,
      // which sees keydowns from the header/footer regions too and so can tell
      // "Tab moves within the popup" apart from "Tab leaves the popup". 'Tab'
      // is longer than one character, so the type-ahead default arm ignores it.
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        return;
    }
  };

  /**
   * Pointer intent for submenus, bound to `[part='popup']` rather than to each row: an open
   * submenu is DOM-nested inside the row that opened it, so a `pointerover` anywhere within that
   * submenu still resolves to the parent row here (see `ownItemFromEvent`) and reads as "still
   * inside this branch". That, plus the close delay being longer than the open delay, is what
   * lets the cursor cut diagonally across the rows in between without the submenu vanishing.
   *
   * Focus is deliberately never moved: the pointer opens a submenu, it does not claim the
   * keyboard.
   */
  private onPopupPointerOver = (e: PointerEvent): void => {
    if (!this.open) return;
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
      if (!this.open || !this.items.includes(hovered)) return;
      this.closeSubmenus(hovered);
      hovered.openSubmenu("none");
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
      this.hide();
      // The child first returns focus to its anchoring row. Restoring after that leaves focus on
      // the root trigger instead of on a row inside a popup that is about to disappear.
      this.scheduleAfterUpdate(
        () => this.triggerEl?.focus(),
        "menu-focus-return"
      );
    });
  };

  private popupPart(
    name: "popup" | "header" | "list" | "footer"
  ): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[part="${name}"]`);
  }

  /**
   * Whether a Tab/Shift+Tab keypress would move focus out of `[part='popup']` altogether, rather
   * than to another focusable inside it. The popup's Tab sequence is
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
    const header = this.popupPart("header");
    const footer = this.popupPart("footer");
    const listEl = this.popupPart("list");
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
    if (!(e.target instanceof LyraMenuItem) && hasNeighbor(listStops))
      return false;
    return backwards ? headerStops.length === 0 : footerStops.length === 0;
  }

  /**
   * Bound to `[part='popup']` rather than `[part='list']` so it also sees keydowns from the
   * `header`/`footer` regions, which sit outside the `role="menu"` list.
   *
   * Escape from those regions closes unconditionally, matching `<lr-popover>`'s own handling of
   * arbitrary popup content. `closeOnEscapeAnywhere` keeps governing only the legacy case --
   * non-item content still slotted into the *default* slot -- so Escape bubbling up from inside
   * the list is left entirely to `onListKeyDown`.
   */
  private onPopupKeyDown = (e: KeyboardEvent): void => {
    const listEl = this.popupPart("list");
    if (e.key === "Escape") {
      if (listEl && e.composedPath().includes(listEl)) return;
      e.preventDefault();
      this.hide({ focusTrigger: true });
      return;
    }
    // No preventDefault for Tab, in either branch -- the browser's own default
    // navigation is left to proceed untouched, only the (now-stale) open menu
    // closes, and only when Tab is actually leaving the popup.
    if (e.key === "Tab" && this.tabWouldLeavePopup(e)) this.hide();
  };

  /** Standard WAI-ARIA APG menu-button type-ahead: moves the roving focus to
   *  the next non-disabled item whose text content starts with the
   *  accumulated buffer, cycling from just after the currently active item
   *  -- mirrors `<lr-select>`'s identical listbox type-ahead. */
  private typeAhead(char: string): void {
    this.clearOwnedTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    this.typeAheadTimer = this.scheduleOwnedTimeout(() => {
      this.typeAheadBuffer = "";
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

  /** What type-ahead matches against: the row's accessible name where it has one, its text
   *  otherwise. The distinction is load-bearing for a submenu parent, whose `textContent` also
   *  contains every label inside the submenu. */
  private itemText(item: LyraMenuItem): string {
    return (item.getAttribute("aria-label") ?? item.textContent ?? "").trim();
  }

  /** Resolves `label`'s effective text: a host-level `aria-label` attribute wins first
   *  (unset by default, so this is a no-op for every existing consumer); otherwise an
   *  explicit `label` override wins verbatim; left at the built-in default it instead
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring `label` itself to be set. */
  private get effectiveLabel(): string {
    return (
      this.getAttribute("aria-label") ??
      this.localize("menuLabel", this.label === "Menu" ? undefined : this.label)
    );
  }

  override render(): TemplateResult {
    if (this.dropdownContained) {
      // The outer dropdown already owns the positioned popup and its role="menu". This shadow
      // slot contributes no accessibility node of its own, so assigned menuitem hosts flatten
      // directly beneath that one role while still using this class's interaction engine.
      return html`
        <slot
          @slotchange=${this.onItemsSlotChange}
          @keydown=${this.onListKeyDown}
          @focusin=${this.onListFocusIn}
          @pointerover=${this.onPopupPointerOver}
          @pointerleave=${this.onPopupPointerLeave}
          @lr-menu-item-select=${this.onItemSelect}
          @lr-menu-item-state-change=${this.onItemStateChange}
          @lr-select=${this.onNestedSelect}
        ></slot>
      `;
    }
    return html`
      <div
        part="trigger"
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeyDown}
      >
        <slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot>
      </div>
      <div
        part="popup"
        @keydown=${this.onPopupKeyDown}
        @pointerover=${this.onPopupPointerOver}
        @pointerleave=${this.onPopupPointerLeave}
      >
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
          @lr-menu-item-select=${this.onItemSelect}
          @lr-menu-item-state-change=${this.onItemStateChange}
          @lr-select=${this.onNestedSelect}
        >
          <slot @slotchange=${this.onItemsSlotChange}></slot>
        </div>
        <div part="footer">
          <slot name="footer" @slotchange=${this.onRegionSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-menu": LyraMenu;
  }
}
