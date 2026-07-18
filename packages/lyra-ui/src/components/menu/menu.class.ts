import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../internal/lyra-element.js';
import { place } from '../../internal/positioner.js';
import { rtlAwarePlacement } from '../../internal/rtl.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './menu.styles.js';
import { LyraMenuItem } from './menu-item.class.js';
import './menu-item.class.js';

export interface MenuSelectDetail {
  value: string;
}

export interface LyraMenuEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-menu-select': CustomEvent<MenuSelectDetail>;
}
/**
 * `<lr-menu>` — an anchored dropdown of `<lr-menu-item>` actions, opened
 * from a consumer-supplied trigger (typically an icon button). A close, drop-
 * in-shaped replacement for reaching outside this library for a third-party
 * dropdown to build a gear menu, an avatar menu, or a history row's overflow
 * menu: click the trigger, a positioned menu appears, clicking an item both
 * performs the action *and* closes the menu.
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
 * family's own `<lr-tree>`/`<lr-tree-node>` pair, which this component's
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
 *   the focused item. Escape closes and returns focus to the trigger. Tab
 *   closes the menu without trapping focus (the browser's own default Tab
 *   behavior proceeds untouched). A printable keypress runs type-ahead:
 *   roving focus jumps to the next non-disabled item whose text starts with
 *   the accumulated buffer, cycling from just after the active item (mirrors
 *   `<lr-select>`'s identical listbox type-ahead). All of the above (except
 *   Escape) only respond to keydowns from a real `<lr-menu-item>` target,
 *   so a slotted non-item control (e.g. a date input) keeps its own full
 *   default keyboard behavior. Escape from such a slotted control closes the
 *   menu too, but only when `closeOnEscapeAnywhere` is set — it defaults to
 *   `false`, so existing consumers keep today's behavior unchanged.
 * - A click outside both the trigger and the open popup closes it (mirrors
 *   `<lr-select>`'s `onDocPointer` exactly) — this does *not* refocus the
 *   trigger, since the outside click itself already moved focus somewhere
 *   the user chose; Escape and a committed selection *do* refocus the
 *   trigger, since those are dismissals with nowhere else for focus to go.
 *
 * The trigger element itself is read from the `trigger` slot's assigned
 * element (first one, if several are assigned) and enhanced imperatively
 * with `aria-haspopup="menu"`/`aria-expanded`/`aria-controls` — the same
 * "reach into a consumer-owned light-DOM element to complete its a11y
 * wiring" approach `<lr-dialog>` documents for its own heading detection,
 * necessary here because those attributes belong on the actual interactive
 * trigger, which lives outside this component's own shadow root.
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
 * role, matching what `role="menu"` expects between item groups).
 * @event lr-show - The menu opened. Not fired for markup that renders
 * `open` true from the start (mirrors `<lr-select>`'s identical guard).
 * @event lr-hide - The menu closed. Same first-render guard as `lr-show`.
 * @event lr-menu-select - A `<lr-menu-item>` was activated. `detail: {
 * value }` — the consolidated re-fire of that item's own
 * `lr-menu-item-select` (see `<lr-menu-item>`'s doc for why listening
 * here, rather than on every item, is the recommended approach). Always
 * followed by the menu closing and focus returning to the trigger.
 * @csspart trigger - The wrapper around the `trigger` slot (the positioning anchor).
 * @csspart popup - The positioned floating panel.
 * @csspart list - The `role="menu"` container wrapping the default slot.
 */
export class LyraMenu extends LyraElement<LyraMenuEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Whether the menu is open. */
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
   *  localized default, matching `lr-select`/`lr-model-select`'s
   *  established `this.getAttribute('aria-label') || <computed default>`
   *  precedence (see `effectiveLabel`). */
  @property() label = 'Menu';

  /** Extends the Escape-closes-and-refocuses-trigger behavior to keydown
   *  events originating from slotted non-item content within `[part="list"]`
   *  (e.g. a date input or a custom section slotted alongside
   *  `<lr-menu-item>`s), not just from a real `<lr-menu-item>`. Default
   *  `false` leaves Escape from slotted non-item content with full default
   *  keyboard behavior, matching every existing consumer. Arrow/Home/End/
   *  Enter/Space stay scoped to real `<lr-menu-item>` targets regardless of
   *  this property — only Escape is affected. */
  @property({ type: Boolean, attribute: 'close-on-escape-anywhere' }) closeOnEscapeAnywhere = false;

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
  private _isFirstUpdate = true;
  private pendingFocus: 'first' | 'last' = 'first';
  private readonly listId = nextId('menu-list');
  // Standard menu type-ahead, mirroring lr-select's identical listbox
  // trio: printable keystrokes accumulate into this buffer and reset ~500ms
  // after the last one, so "d" then "e" narrows to "de" instead of
  // restarting the search on every keystroke.
  private typeAheadBuffer = '';
  private typeAheadTimer?: ReturnType<typeof setTimeout>;

  protected willUpdate(): void {
    this._isFirstUpdate = !this.hasUpdated;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All open-driven side effects (positioning, the click-outside
      // listener, the lr-show/lr-hide events, and moving focus into the
      // menu) live here rather than in show()/hide() so they fire however
      // `open` became true -- via show()/hide()'s own user-interaction
      // paths, or a consumer/test setting `el.open` directly, which bypasses
      // both. Mirrors lr-select's identical updated()-centralized approach.
      if (this.open) {
        document.addEventListener('pointerdown', this.onDocPointer);
        if (!this._isFirstUpdate) this.emit('lr-show');
        // Both reposition() and focusRoving() no-op gracefully if triggerEl/
        // items aren't populated yet -- for markup that renders `open` true
        // from the start, the trigger/default slots' *own* slotchange events
        // (queued as microtasks) can still be pending at this point, ahead of
        // Lit's synchronous first update. onTriggerSlotChange/
        // onItemsSlotChange below re-run these same two calls once that
        // catches up, so this always resolves correctly either way.
        this.reposition();
        this.focusRoving(this.pendingFocus);
      } else {
        document.removeEventListener('pointerdown', this.onDocPointer);
        if (!this._isFirstUpdate) this.emit('lr-hide');
      }
      this.syncTriggerA11y();
    } else if (this.open && changed.has('placement')) {
      // A placement change while already open must move the popup immediately --
      // otherwise the Floating UI subscription established at open time keeps
      // running with the stale placement baked into its computePosition options,
      // and the new value only takes effect on the *next* open. reposition()
      // tears down and re-subscribes, so re-invoking it here is safe.
      this.reposition();
    }
  }

  private reposition(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    if (this.triggerEl && popup) {
      const placement = this.placement && rtlAwarePlacement(this.placement, this);
      this.cleanup = place(this.triggerEl, popup, placement ? { placement } : {});
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    clearTimeout(this.typeAheadTimer);
    this.itemStateObserver?.disconnect();
    this.itemStateObserver = undefined;
    document.removeEventListener('pointerdown', this.onDocPointer);
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the menu rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  private show(focus: 'first' | 'last' = 'first'): void {
    if (this.open) return;
    this.pendingFocus = focus;
    this.open = true;
  }

  /** `refocusTrigger` is only ever `true` for a dismissal with nowhere else
   *  for focus to land (Escape, a committed selection) -- see the class
   *  doc's interaction contract for why an outside click deliberately omits it. */
  private hide(refocusTrigger = false): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
    this.applyRovingTabIndex();
    if (refocusTrigger) this.triggerEl?.focus();
  }

  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  private onTriggerClick = (): void => {
    this.open ? this.hide() : this.show();
  };

  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    // A safety net for a menu with zero navigable items: focus never leaves
    // the trigger in that edge case (see focusRoving()), so onListKeyDown's
    // own Escape handling would otherwise never run.
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.hide(true);
      return;
    }
    if (this.open) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.show('first');
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.show('last');
        break;
      default:
        return;
    }
  };

  private onTriggerSlotChange = (e: Event): void => {
    const assigned = (e.target as HTMLSlotElement).assignedElements({ flatten: true });
    const next = assigned[0] as HTMLElement | undefined;
    if (next === this.triggerEl) return;
    if (this.triggerEl) {
      this.triggerEl.removeAttribute('aria-haspopup');
      this.triggerEl.removeAttribute('aria-expanded');
      this.triggerEl.removeAttribute('aria-controls');
    }
    this.triggerEl = next;
    this.syncTriggerA11y();
    // Covers the "open from the start" race documented on reposition()'s
    // call in updated() -- a no-op resubscribe once already positioned.
    if (this.open) this.reposition();
  };

  /** `aria-haspopup`/`aria-expanded`/`aria-controls` belong on the actual
   *  interactive trigger, which is consumer-owned light-DOM content outside
   *  this component's own shadow root -- see the class doc. */
  private syncTriggerA11y(): void {
    if (!this.triggerEl) return;
    this.triggerEl.setAttribute('aria-haspopup', 'menu');
    this.triggerEl.setAttribute('aria-expanded', this.open ? 'true' : 'false');
    this.triggerEl.setAttribute('aria-controls', this.listId);
  }

  private onItemsSlotChange = (e: Event): void => {
    this.itemStateObserver?.disconnect();
    // A bounds check can't survive membership changes: adding, removing or
    // reordering items while open shifts survivors to new indices, so an
    // in-range activeIndex starts pointing at a different item. Re-resolve by
    // identity instead.
    const previouslyActive = this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    this.items = (e.target as HTMLSlotElement)
      .assignedElements({ flatten: true })
      .filter((el): el is LyraMenuItem => el instanceof LyraMenuItem);
    if (typeof MutationObserver !== 'undefined') {
      this.itemStateObserver = new MutationObserver(() => this.onItemStateChange());
      for (const item of this.items) {
        this.itemStateObserver.observe(item, {
          attributes: true,
          attributeFilter: ['disabled', 'hidden', 'aria-hidden'],
        });
      }
    }
    this.activeIndex = previouslyActive ? this.items.indexOf(previouslyActive) : -1;
    this.applyRovingTabIndex();
    if (this.open) {
      if (this.activeIndex === -1) {
        // Nothing left to preserve: the active item is gone, or nothing had
        // claimed the roving focus yet (the "open from the start" race that
        // onTriggerSlotChange's reposition() call also covers).
        this.focusRoving(this.pendingFocus);
      } else if (!this.contains(document.activeElement)) {
        // Reordering an item moves the node, which blurs it and drops focus out
        // to <body> -- beyond reach of the list keydown handler, leaving an open
        // menu keyboard-dead. The guard keeps this from stealing focus a user
        // parked on slotted non-item content, which stays within this element.
        this.items[this.activeIndex]!.focus();
      }
    }
  };

  private isNavigable(item: LyraMenuItem): boolean {
    return !item.disabled && !item.hidden && item.getAttribute('aria-hidden') !== 'true';
  }

  /** Rehomes roving focus immediately when an active item becomes disabled or hidden. */
  private onItemStateChange = (): void => {
    const navigable = this.items.filter((item) => this.isNavigable(item));
    if (this.activeIndex >= 0 && !this.isNavigable(this.items[this.activeIndex]!)) {
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
    const item = e.target;
    if (!(item instanceof LyraMenuItem)) return;
    this.emit<MenuSelectDetail>('lr-menu-select', { value: item.value });
    this.hide(true);
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
  private focusRoving(which: 'first' | 'last'): void {
    const navigable = this.items.filter((i) => this.isNavigable(i));
    if (!navigable.length) return;
    const item = which === 'first' ? navigable[0] : navigable[navigable.length - 1];
    this.setActiveItem(item);
  }

  private setActiveItem(item: LyraMenuItem): void {
    this.activeIndex = this.items.indexOf(item);
    this.applyRovingTabIndex();
    item.focus();
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
  };

  private onListKeyDown = (e: KeyboardEvent): void => {
    const isItemTarget = e.target instanceof LyraMenuItem;
    // Escape alone can be opted in (via closeOnEscapeAnywhere) to close the
    // menu from slotted non-item content too, e.g. a slotted form control --
    // every other key below stays scoped to real LyraMenuItem targets so it
    // never hijacks keydown from arbitrary slotted content (the bug the
    // instanceof guard below exists to prevent).
    if (e.key === 'Escape' && (isItemTarget || this.closeOnEscapeAnywhere)) {
      e.preventDefault();
      this.hide(true);
      return;
    }
    if (!isItemTarget) return;
    const navigable = this.items.filter((i) => this.isNavigable(i));
    const current = this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    const currentNavIndex = current ? navigable.indexOf(current) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (navigable.length) {
          this.setActiveItem(navigable[(currentNavIndex + 1 + navigable.length) % navigable.length]);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (navigable.length) {
          const prevIndex = currentNavIndex <= 0 ? navigable.length - 1 : currentNavIndex - 1;
          this.setActiveItem(navigable[prevIndex]);
        }
        break;
      case 'Home':
        e.preventDefault();
        if (navigable.length) this.setActiveItem(navigable[0]);
        break;
      case 'End':
        e.preventDefault();
        if (navigable.length) this.setActiveItem(navigable[navigable.length - 1]);
        break;
      case 'Enter':
      case ' ':
        // Mirrors lr-tree calling current.select() from its own delegated
        // keydown handler, rather than each row wiring its own keydown.
        e.preventDefault();
        current?.select();
        break;
      case 'Tab':
        // No preventDefault -- the browser's own default Tab navigation is
        // left to proceed untouched, only the (now-stale) open menu closes.
        this.hide();
        break;
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        return;
    }
  };

  /** Standard WAI-ARIA APG menu-button type-ahead: moves the roving focus to
   *  the next non-disabled item whose text content starts with the
   *  accumulated buffer, cycling from just after the currently active item
   *  -- mirrors `<lr-select>`'s identical listbox type-ahead. */
  private typeAhead(char: string): void {
    clearTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLowerCase();
    this.typeAheadTimer = setTimeout(() => {
      this.typeAheadBuffer = '';
    }, 500);

    const navigable = this.items.filter((i) => this.isNavigable(i));
    if (!navigable.length) return;
    const current = this.activeIndex >= 0 ? this.items[this.activeIndex] : undefined;
    const currentIndex = current ? navigable.indexOf(current) : -1;
    const n = navigable.length;
    for (let step = 1; step <= n; step++) {
      const candidate = navigable[(currentIndex + step + n) % n];
      if ((candidate.textContent ?? '').trim().toLowerCase().startsWith(this.typeAheadBuffer)) {
        this.setActiveItem(candidate);
        return;
      }
    }
  }

  /** Resolves `label`'s effective text: a host-level `aria-label` attribute wins first
   *  (unset by default, so this is a no-op for every existing consumer); otherwise an
   *  explicit `label` override wins verbatim; left at the built-in default it instead
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring `label` itself to be set. */
  private get effectiveLabel(): string {
    return this.getAttribute('aria-label') || this.localize('menuLabel', this.label === 'Menu' ? undefined : this.label);
  }

  render(): TemplateResult {
    return html`
      <div part="trigger" @click=${this.onTriggerClick} @keydown=${this.onTriggerKeyDown}>
        <slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot>
      </div>
      <div part="popup">
        <div
          part="list"
          id=${this.listId}
          role="menu"
          aria-label=${this.effectiveLabel}
          @keydown=${this.onListKeyDown}
          @focusin=${this.onListFocusIn}
          @lr-menu-item-select=${this.onItemSelect}
          @lr-menu-item-state-change=${this.onItemStateChange}
        >
          <slot @slotchange=${this.onItemsSlotChange}></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-menu': LyraMenu;
  }
}
