import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './menu-item.styles.js';

export type MenuItemType = 'normal' | 'checkbox';

export interface MenuItemChangeDetail {
  value: string;
  checked: boolean;
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// checkmark glyph to that module -- it's off limits here -- so this one-off
// icon still reads as part of the same visual language as the rest of the
// library's inline icons. Same approach lyra-checkbox's own local
// checkmark/indeterminate glyphs (and lyra-chat-message's local retryIcon())
// take for the identical reason.
const GLYPH_VIEW_BOX = '0 0 24 24';
const GLYPH_STROKE_WIDTH = '1.75';

function checkmarkGlyph(): SVGTemplateResult {
  return svg`
    <svg
      part="checkmark"
      width="1em"
      height="1em"
      viewBox=${GLYPH_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="5 12.5 10 17.5 19 6.5"></polyline></svg>
  `;
}

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
 * `type="checkbox"` (mirroring `wa-dropdown-item`'s identical `type` option)
 * renders `role="menuitemcheckbox"` in place of `role="menuitem"`, with
 * `aria-checked` reflecting `checked` and a checkmark glyph shown once
 * `checked` is `true`. Activating a `checkbox`-type item (click, or the
 * parent's Enter/Space handling via `select()`) toggles `checked` and fires
 * `lyra-menu-item-change` *in addition to* the usual `lyra-menu-item-select`
 * — the latter is never suppressed, so a parent `<lyra-menu>` still closes
 * and re-fires its consolidated `lyra-menu-select` exactly as it does for a
 * `type="normal"` item. `type="normal"` (the default) renders and behaves
 * exactly as before this option existed — no role, rendering, or event
 * differences.
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
 * @event lyra-menu-item-change - A `type="checkbox"` item was activated and
 * its `checked` state toggled. `detail: { value, checked }` — the item's own
 * `value` and its new `checked` value. Fired in addition to (never instead
 * of) `lyra-menu-item-select` above. Never fired for `type="normal"`.
 * @csspart base - The row (`role` lives on the host — see the class doc).
 * @csspart icon - Wrapper around the `icon` slot. Not rendered at all when the slot is empty.
 * @csspart label - Wrapper around the default slot.
 * @csspart checkmark - The checkmark glyph shown when a `type="checkbox"` item is `checked`. Not rendered at all for `type="normal"`.
 */
export interface LyraMenuItemEventMap {
  'lyra-menu-item-state-change': CustomEvent<{ disabled: boolean; hidden: boolean }>;
  'lyra-menu-item-select': CustomEvent<undefined>;
}
export class LyraMenuItem extends LyraElement<LyraMenuItemEventMap> {
  static styles = [LyraElement.styles, styles];

  /** An id/value the parent `<lyra-menu>`'s `lyra-menu-select` detail keys off of. */
  @property() value = '';

  /** Disables selection and excludes this item from `<lyra-menu>`'s roving-tabindex nav entirely. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Visual treatment for a dangerous action (e.g. "Delete") — tints the row with `--lyra-color-danger`. */
  @property({ type: Boolean, reflect: true }) destructive = false;

  /** `'checkbox'` renders `role="menuitemcheckbox"` with a toggleable `checked` state and a
   *  checkmark glyph, mirroring `wa-dropdown-item`'s identical `type` option — see the class doc. */
  @property() type: MenuItemType = 'normal';

  /** Whether a `type="checkbox"` item is checked. Meaningless (ignored) for `type="normal"`. */
  @property({ type: Boolean, reflect: true }) checked = false;

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
    // role/aria-disabled/aria-checked live on the host (see the class doc),
    // so they're plain imperative attribute writes here rather than part of
    // render()'s shadow-DOM template -- mirrors lyra-tree-node's identical
    // willUpdate.
    const isCheckbox = this.type === 'checkbox';
    this.setAttribute('role', isCheckbox ? 'menuitemcheckbox' : 'menuitem');
    if (isCheckbox) {
      this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
    } else {
      // Kept absent entirely for type="normal" -- see the class doc's "no
      // role, rendering, or event differences" guarantee for that default.
      this.removeAttribute('aria-checked');
    }
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
    if (changed.has('disabled')) {
      this.emit('lyra-menu-item-state-change', { disabled: this.disabled, hidden: this.hidden });
    }
  }

  /** Fires `lyra-menu-item-select` (no-op while `disabled`). Called by this element's own
   *  click handler, and by `<lyra-menu>`'s Enter/Space keydown handling of the active item.
   *  For `type="checkbox"`, also toggles `checked` and fires `lyra-menu-item-change` first --
   *  see the class doc. */
  select(): void {
    if (this.disabled) return;
    if (this.type === 'checkbox') {
      this.checked = !this.checked;
      this.emit<MenuItemChangeDetail>('lyra-menu-item-change', { value: this.value, checked: this.checked });
    }
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
        ${this.type === 'checkbox' && this.checked ? checkmarkGlyph() : nothing}
      </span>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-menu-item': LyraMenuItem;
  }
}
