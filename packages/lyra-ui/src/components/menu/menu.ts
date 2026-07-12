import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { rtlAwarePlacement } from '../../internal/rtl.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './menu.styles.js';
import { LyraMenuItem } from './menu-item.js';
import './menu-item.js';

export interface MenuSelectDetail {
  value: string;
}

/**
 * `<lyra-menu>` — an anchored dropdown of `<lyra-menu-item>` actions, opened
 * from a consumer-supplied trigger (typically an icon button). A close, drop-
 * in-shaped replacement for reaching outside this library for a third-party
 * dropdown to build a gear menu, an avatar menu, or a history row's overflow
 * menu: click the trigger, a positioned menu appears, clicking an item both
 * performs the action *and* closes the menu.
 *
 * **ARIA pattern — `role="menu"`/`role="menuitem"` with real roving DOM
 * focus, not a listbox.** Two coherent, mutually-exclusive shapes were
 * available here: (a) `role="listbox"`/`role="option"` with
 * `aria-activedescendant`, the pattern `<lyra-select>`'s trigger-button +
 * popup listbox uses, where DOM focus never leaves the trigger; or (b)
 * `role="menu"`/`role="menuitem"` with real focus moving between actual
 * focusable rows, the WAI-ARIA "menu button" pattern. This picks (b):
 * `<lyra-menu-item>` rows are real, independently-focusable elements (see
 * that class's own doc), which is the more natural fit for a menu
 * specifically — unlike a listbox's rows, a menu's rows are conventionally
 * button-/link-shaped, and every well-known native/OS menu (and this
 * family's own `<lyra-tree>`/`<lyra-tree-node>` pair, which this component's
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
 *   menu-widget behavior, unlike `<lyra-select>`'s clamped listbox nav).
 *   Home/End jump to the first/last non-disabled item. Enter/Space activate
 *   the focused item. Escape closes and returns focus to the trigger. Tab
 *   closes the menu without trapping focus (the browser's own default Tab
 *   behavior proceeds untouched).
 * - A click outside both the trigger and the open popup closes it (mirrors
 *   `<lyra-select>`'s `onDocPointer` exactly) — this does *not* refocus the
 *   trigger, since the outside click itself already moved focus somewhere
 *   the user chose; Escape and a committed selection *do* refocus the
 *   trigger, since those are dismissals with nowhere else for focus to go.
 *
 * The trigger element itself is read from the `trigger` slot's assigned
 * element (first one, if several are assigned) and enhanced imperatively
 * with `aria-haspopup="menu"`/`aria-expanded`/`aria-controls` — the same
 * "reach into a consumer-owned light-DOM element to complete its a11y
 * wiring" approach `<lyra-dialog>` documents for its own heading detection,
 * necessary here because those attributes belong on the actual interactive
 * trigger, which lives outside this component's own shadow root.
 *
 * The popup is always rendered (never `display:none`) so `.focus()` calls on
 * its content work synchronously the instant it opens — visually hidden via
 * `visibility`/`opacity` instead (identical to `<lyra-select>`'s own
 * `[part="listbox"]`). `visibility` is an inherited CSS property that
 * pierces the `<slot>` projection boundary, so every closed-state
 * `<lyra-menu-item>` is automatically excluded from sequential (Tab-key)
 * navigation with no separate JS bookkeeping.
 *
 * @customElement lyra-menu
 * @slot trigger - The consumer's own trigger element (typically an icon
 * button). Clicking it toggles the menu; it's positioned against via
 * `internal/positioner.js`'s `place()`.
 * @slot - `<lyra-menu-item>` elements, plus optionally plain `<hr>` dividers
 * between groups (native `<hr>` already carries an implicit `separator`
 * role, matching what `role="menu"` expects between item groups).
 * @event lyra-show - The menu opened. Not fired for markup that renders
 * `open` true from the start (mirrors `<lyra-select>`'s identical guard).
 * @event lyra-hide - The menu closed. Same first-render guard as `lyra-show`.
 * @event lyra-menu-select - A `<lyra-menu-item>` was activated. `detail: {
 * value }` — the consolidated re-fire of that item's own
 * `lyra-menu-item-select` (see `<lyra-menu-item>`'s doc for why listening
 * here, rather than on every item, is the recommended approach). Always
 * followed by the menu closing and focus returning to the trigger.
 * @csspart trigger - The wrapper around the `trigger` slot (the positioning anchor).
 * @csspart popup - The positioned floating panel.
 * @csspart list - The `role="menu"` container wrapping the default slot.
 */
export class LyraMenu extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Whether the menu is open. */
  @property({ type: Boolean, reflect: true }) open = false;

  /**
   * Optional placement override forwarded to `place()`. Defaults to whatever `place()` itself
   * defaults to. A `left`/`right` side is resolved through `rtlAwareSide` semantics (see
   * `internal/rtl.ts`) so e.g. `placement="left-start"` still anchors to the menu's trailing edge
   * under RTL rather than pinning to the physical left.
   */
  @property({ reflect: true }) placement?: Placement;

  /** Accessible name for the `role="menu"` popup — override with something
   *  specific (e.g. "Row actions") when a page has more than one menu. */
  @property() label = 'Menu';

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
  private _isFirstUpdate = true;
  private pendingFocus: 'first' | 'last' = 'first';
  private readonly listId = nextId('menu-list');

  protected willUpdate(): void {
    this._isFirstUpdate = !this.hasUpdated;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All open-driven side effects (positioning, the click-outside
      // listener, the lyra-show/lyra-hide events, and moving focus into the
      // menu) live here rather than in show()/hide() so they fire however
      // `open` became true -- via show()/hide()'s own user-interaction
      // paths, or a consumer/test setting `el.open` directly, which bypasses
      // both. Mirrors lyra-select's identical updated()-centralized approach.
      if (this.open) {
        document.addEventListener('pointerdown', this.onDocPointer);
        if (!this._isFirstUpdate) this.emit('lyra-show');
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
        if (!this._isFirstUpdate) this.emit('lyra-hide');
      }
      this.syncTriggerA11y();
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
    document.removeEventListener('pointerdown', this.onDocPointer);
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
    this.items = (e.target as HTMLSlotElement)
      .assignedElements({ flatten: true })
      .filter((el): el is LyraMenuItem => el instanceof LyraMenuItem);
    if (this.activeIndex >= this.items.length) this.activeIndex = -1;
    this.applyRovingTabIndex();
    // Covers the same "open from the start" race as onTriggerSlotChange's
    // reposition() call -- activeIndex === -1 means nothing has claimed the
    // roving focus yet (never true once a user has actually navigated),
    // so this only ever fires for that initial catch-up, not on every later
    // items mutation while open.
    if (this.open && this.activeIndex === -1) this.focusRoving(this.pendingFocus);
  };

  private onItemSelect = (e: Event): void => {
    const item = e.target;
    if (!(item instanceof LyraMenuItem)) return;
    this.emit<MenuSelectDetail>('lyra-menu-select', { value: item.value });
    this.hide(true);
  };

  /** Flips exactly one non-disabled item's `tabIndex` to `0` (the roving
   *  target) and every other item's to `-1` -- see `<lyra-menu-item>`'s doc
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
    const navigable = this.items.filter((i) => !i.disabled);
    if (!navigable.length) return;
    const item = which === 'first' ? navigable[0] : navigable[navigable.length - 1];
    this.setActiveItem(item);
  }

  private setActiveItem(item: LyraMenuItem): void {
    this.activeIndex = this.items.indexOf(item);
    this.applyRovingTabIndex();
    item.focus();
  }

  private onListKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.items.filter((i) => !i.disabled);
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
        // Mirrors lyra-tree calling current.select() from its own delegated
        // keydown handler, rather than each row wiring its own keydown.
        e.preventDefault();
        current?.select();
        break;
      case 'Escape':
        e.preventDefault();
        this.hide(true);
        break;
      case 'Tab':
        // No preventDefault -- the browser's own default Tab navigation is
        // left to proceed untouched, only the (now-stale) open menu closes.
        this.hide();
        break;
      default:
        return;
    }
  };

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
          aria-label=${this.label}
          @keydown=${this.onListKeyDown}
          @lyra-menu-item-select=${this.onItemSelect}
        >
          <slot @slotchange=${this.onItemsSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

defineElement('menu', LyraMenu);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-menu': LyraMenu;
  }
}
