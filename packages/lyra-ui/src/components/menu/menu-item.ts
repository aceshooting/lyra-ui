import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './menu-item.styles.js';

/**
 * `<lyra-menu-item>` — a single action row inside `<lyra-menu>`'s default
 * slot. Not meaningful on its own (there is no standalone "click a menu item"
 * use case) — it exists purely as `<lyra-menu>`'s light-DOM child, the same
 * relationship `<lyra-option>` has to `<lyra-combobox>`/`<lyra-select>`.
 *
 * `role="menuitem"` and the roving `tabindex` both live on *this host
 * element*, not an internal shadow-DOM button — mirroring `<lyra-tree-node>`'s
 * identical choice (see that class's doc). `<lyra-menu>` is the sole owner of
 * this element's `tabIndex`: it flips exactly one navigable item's `tabIndex`
 * to `0` (the rest sit at `-1`) as its roving-tabindex highlight moves, and
 * calls `.focus()` directly on this host to move real DOM focus there.
 * `[part="base"]` is purely a visual box with no interactive semantics of its
 * own — see the class doc on `<lyra-menu>` for why real DOM focus (rather
 * than `aria-activedescendant`) was chosen for this pair.
 *
 * Enter/Space activation is handled by `<lyra-menu>`'s own delegated
 * `keydown` listener calling `select()` on whichever item is currently
 * roving-focused (mirrors `<lyra-tree>` calling `current.select()` from its
 * own keydown handler) — this element only wires a plain `click` listener
 * itself, so `select()` fires identically whether the item was reached by
 * mouse or keyboard.
 *
 * @customElement lyra-menu-item
 * @slot - The item's label content.
 * @slot icon - Optional leading icon.
 * @event lyra-menu-item-select - This item was activated (click, or the
 * parent `<lyra-menu>`'s own Enter/Space handling of the roving-focused
 * item). No detail payload — a listener already has `event.target` (this
 * element) to read `value` off of, and `<lyra-menu>` itself consumes this
 * event to close and re-fire it as its own consolidated `lyra-menu-select`
 * (`detail: { value }`) rather than requiring a consumer to listen on every
 * individual item — listen there instead unless you specifically need a
 * per-item handler.
 * @csspart base - The row (`role` lives on the host — see the class doc).
 * @csspart icon - Wrapper around the `icon` slot. Not rendered at all when the slot is empty.
 * @csspart label - Wrapper around the default slot.
 */
export class LyraMenuItem extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** An id/value the parent `<lyra-menu>`'s `lyra-menu-select` detail keys off of. */
  @property() value = '';

  /** Disables selection and excludes this item from `<lyra-menu>`'s roving-tabindex nav entirely. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Visual treatment for a dangerous action (e.g. "Delete") — tints the row with `--lyra-color-danger`. */
  @property({ type: Boolean, reflect: true }) destructive = false;

  // [part='icon'] never matches a bare :empty selector -- see menu-item.styles.ts's
  // own comment on that part. Same fix as lyra-tool-call-chip's hasDetailSlot.
  @state() private hasIconSlot = false;

  connectedCallback(): void {
    super.connectedCallback();
    // A safe, focusable-but-out-of-tab-order baseline before <lyra-menu> ever
    // gets a chance to assign roving-tabindex state (e.g. a standalone
    // fixture in a test, or the brief window before the parent's own
    // slotchange handler runs). <lyra-menu> is the sole subsequent owner of
    // this property -- see the class doc.
    if (this.tabIndex !== 0) this.tabIndex = -1;
  }

  protected willUpdate(changed: PropertyValues): void {
    // role/aria-disabled live on the host (see the class doc), so they're
    // plain imperative attribute writes here rather than part of render()'s
    // shadow-DOM template -- mirrors lyra-tree-node's identical willUpdate.
    this.setAttribute('role', 'menuitem');
    if (this.disabled) {
      this.setAttribute('aria-disabled', 'true');
      // Defense-in-depth mirroring connectedCallback's baseline above:
      // <lyra-menu>'s roving-tabindex bookkeeping (activeIndex) only gets a
      // chance to resync once real focus actually moves (via its own
      // focusin listener), so a `disabled` flip must proactively strip this
      // item out of the roving target and drop any focus it's currently
      // holding right here -- regardless of what the parent's activeIndex
      // still thinks -- so a disabled item can never remain the roving
      // target or retain focus.
      if (changed.has('disabled')) {
        this.tabIndex = -1;
        if (document.activeElement === this) this.blur();
      }
    } else {
      this.removeAttribute('aria-disabled');
    }
  }

  /** Fires `lyra-menu-item-select` (no-op while `disabled`). Called by this element's own
   *  click handler, and by `<lyra-menu>`'s Enter/Space keydown handling of the active item. */
  select(): void {
    if (this.disabled) return;
    this.emit('lyra-menu-item-select');
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    return html`
      <span part="base" @click=${() => this.select()}>
        <span part="icon" aria-hidden="true" ?hidden=${!this.hasIconSlot}>
          <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
        </span>
        <span part="label"><slot></slot></span>
      </span>
    `;
  }
}

defineElement('menu-item', LyraMenuItem);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-menu-item': LyraMenuItem;
  }
}
