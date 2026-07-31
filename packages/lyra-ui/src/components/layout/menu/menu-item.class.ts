import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import type { MenuFocusTarget, SubmenuPanel } from './menu-shared.js';
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
// library's inline icons. Same approach lr-checkbox's own local
// checkmark/indeterminate glyphs (and lr-chat-message's local retryIcon())
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

export interface LyraMenuItemEventMap {
  'lr-menu-item-state-change': CustomEvent<{ disabled: boolean; hidden: boolean }>;
  'lr-menu-item-select': CustomEvent<undefined>;
  'lr-menu-item-change': CustomEvent<MenuItemChangeDetail>;
}
/**
 * `<lr-menu-item>` — a single action row inside `<lr-menu>`'s default
 * slot. Not meaningful on its own (there is no standalone "click a menu item"
 * use case) — it exists purely as `<lr-menu>`'s light-DOM child, the same
 * relationship `<lr-option>` has to `<lr-combobox>`/`<lr-select>`.
 *
 * `role="menuitem"` and the roving `tabindex` both live on *this host
 * element*, not an internal shadow-DOM button — mirroring `<lr-tree-item>`'s
 * identical choice (see that class's doc). `<lr-menu>` is the sole owner of
 * this element's `tabIndex`: it flips exactly one navigable item's `tabIndex`
 * to `0` (the rest sit at `-1`) as its roving-tabindex highlight moves, and
 * calls `.focus()` directly on this host to move real DOM focus there.
 * `[part="base"]` is purely a visual box with no interactive semantics of its
 * own — see the class doc on `<lr-menu>` for why real DOM focus (rather
 * than `aria-activedescendant`) was chosen for this pair.
 *
 * Enter/Space activation is handled by `<lr-menu>`'s own delegated
 * `keydown` listener calling `select()` on whichever item is currently
 * roving-focused (mirrors `<lr-tree>` calling `current.select()` from its
 * own keydown handler) — this element only wires a plain `click` listener
 * itself, so `select()` fires identically whether the item was reached by
 * mouse or keyboard.
 *
 * A `<lr-menu>` assigned to the `submenu` slot turns this row into a submenu
 * parent: the host gains `aria-haspopup="menu"` plus an `aria-expanded` that
 * renders `"true"` *and* `"false"` (never omitted — the attribute is part of
 * the role's state, so a Lit `?aria-expanded=` directive would be wrong), a
 * chevron renders in `[part="submenu-icon"]`, and activation opens the
 * submenu instead of selecting. The parent `<lr-menu>` owns the interaction
 * policy — the arrow keys (mirrored under RTL), pointer intent, and the
 * one-submenu-per-level rule — and drives it through `openSubmenu()` /
 * `closeSubmenu()`; this element owns the ARIA, the naming, and the panel
 * wiring. Because a submenu parent is a disclosure rather than an action, it
 * never fires `lr-menu-item-select`, and `type="checkbox"` has no effect on
 * one. The submenu's own selections travel up as the *outer* menu's single
 * consolidated `lr-menu-select` — there is no separate nested-selection
 * event. The panel's `lr-show`/`lr-hide` stop here rather than surfacing on
 * the ancestor menu, where a consumer would read them as that menu closing;
 * listen on the submenu element itself for those.
 *
 * The submenu's `role="menu"` is named from this item's own label text, and
 * so is the item, which otherwise computes its accessible name from its
 * contents — those contents include the whole open submenu. A host-level
 * `aria-label` (or a `label`/`aria-label` on the submenu itself) wins over
 * both computed names.
 *
 * `type="checkbox"` (mirroring `wa-dropdown-item`'s identical `type` option)
 * renders `role="menuitemcheckbox"` in place of `role="menuitem"`, with
 * `aria-checked` reflecting `checked` and a checkmark glyph shown once
 * `checked` is `true`. Activating a `checkbox`-type item (click, or the
 * parent's Enter/Space handling via `select()`) toggles `checked` and fires
 * `lr-menu-item-change` *in addition to* the usual `lr-menu-item-select`
 * — the latter is never suppressed, so a parent `<lr-menu>` still closes
 * and re-fires its consolidated `lr-menu-select` exactly as it does for a
 * `type="normal"` item. `type="normal"` (the default) renders and behaves
 * exactly as before this option existed — no role, rendering, or event
 * differences.
 *
 * @customElement lr-menu-item
 * @slot - The item's label content.
 * @slot icon - Optional leading icon.
 * @slot submenu - A nested `<lr-menu>` that opens beside this row, turning it
 * into a submenu parent. Anything else assigned here is rendered but gets no
 * submenu semantics.
 * @event lr-menu-item-select - This item was activated (click, or the
 * parent `<lr-menu>`'s own Enter/Space handling of the roving-focused
 * item). No detail payload — a listener already has `event.target` (this
 * element) to read `value` off of, and `<lr-menu>` itself consumes this
 * event to close and re-fire it as its own consolidated `lr-menu-select`
 * (`detail: { value }`) rather than requiring a consumer to listen on every
 * individual item — listen there instead unless you specifically need a
 * per-item handler.
 * @event lr-menu-item-change - A `type="checkbox"` item was activated and
 * its `checked` state toggled. `detail: { value, checked }` — the item's own
 * `value` and its new `checked` value. Fired in addition to (never instead
 * of) `lr-menu-item-select` above. Never fired for `type="normal"`.
 * @event lr-menu-item-state-change - The item's `disabled` or `hidden` state changed.
 *   `<lr-menu>` consumes this to repair its roving-tabindex state immediately.
 * @csspart base - The row (`role` lives on the host — see the class doc).
 * @csspart icon - Wrapper around the `icon` slot. Not rendered at all when the slot is empty.
 * @csspart label - Wrapper around the default slot.
 * @csspart checkmark - The checkmark glyph shown when a `type="checkbox"` item is `checked`. Not rendered at all for `type="normal"`.
 * @csspart submenu-icon - Wrapper around the chevron shown on a submenu parent. Not rendered at all without a `submenu` slot. Mirrors under RTL through this wrapper, never by swapping the glyph.
 */
export class LyraMenuItem extends LyraElement<LyraMenuItemEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** An id/value the parent `<lr-menu>`'s `lr-menu-select` detail keys off of. */
  @property() value = '';

  /** Disables selection and excludes this item from `<lr-menu>`'s roving-tabindex nav entirely. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Visual treatment for a dangerous action (e.g. "Delete") — tints the row with `--lr-color-danger`. */
  @property({ type: Boolean, reflect: true }) destructive = false;

  /** `'checkbox'` renders `role="menuitemcheckbox"` with a toggleable `checked` state and a
   *  checkmark glyph, mirroring `wa-dropdown-item`'s identical `type` option — see the class doc. */
  @property() type: MenuItemType = 'normal';

  /** Whether a `type="checkbox"` item is checked. Meaningless (ignored) for `type="normal"`. */
  @property({ type: Boolean, reflect: true }) checked = false;

  // [part='icon'] never matches a bare :empty selector -- see menu-item.styles.ts's
  // own comment on that part. Same fix as lr-tool-call-chip's hasDetailSlot.
  @state() private hasIconSlot = false;

  // Reactive because the host's aria-haspopup/aria-expanded and the chevron all key off them.
  @state() private submenuAssigned = false;
  @state() private submenuExpanded = false;
  // The default slot's text, kept apart from `textContent` -- which, for a submenu parent, also
  // contains every label inside the submenu.
  @state() private slottedLabel = '';

  private submenuPanel: SubmenuPanel | null = null;
  // A consumer-authored name always wins; these record that the computed one was ours to update.
  private ownsAriaLabel = false;
  private ownsPanelAriaLabel = false;

  /** Whether a `<lr-menu>` is assigned to this item's `submenu` slot, making it a submenu parent. */
  get hasSubmenu(): boolean {
    return this.submenuAssigned;
  }

  /** Whether this item's submenu is currently open. Tracks the panel's own state, however it
   *  changed — the parent menu's keyboard/pointer handling, a dismissal, or a direct write. */
  get submenuOpen(): boolean {
    return this.submenuExpanded;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A safe, focusable-but-out-of-tab-order baseline before <lr-menu> ever
    // gets a chance to assign roving-tabindex state (e.g. a standalone
    // fixture in a test, or the brief window before the parent's own
    // slotchange handler runs). <lr-menu> is the sole subsequent owner of
    // this property -- see the class doc.
    if (this.tabIndex !== 0) this.tabIndex = -1;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Transient open state never survives a detach: the panel is a child, so it tears its own
    // `open` down at the same moment, and a reconnect must not resume with a stale aria-expanded.
    this.submenuExpanded = false;
  }

  protected override willUpdate(changed: PropertyValues): void {
    // role/aria-disabled/aria-checked live on the host (see the class doc),
    // so they're plain imperative attribute writes here rather than part of
    // render()'s shadow-DOM template -- mirrors lr-tree-item's identical
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
    if (this.submenuAssigned) {
      this.setAttribute('aria-haspopup', 'menu');
      // Both states render: an omitted aria-expanded is a different, weaker statement than
      // aria-expanded="false", and this role is stateful.
      this.setAttribute('aria-expanded', this.submenuExpanded ? 'true' : 'false');
      this.applyComputedName();
    } else {
      this.removeAttribute('aria-haspopup');
      this.removeAttribute('aria-expanded');
      if (this.ownsAriaLabel) {
        this.removeAttribute('aria-label');
        this.ownsAriaLabel = false;
      }
    }
    this.setAttribute('aria-disabled', String(this.disabled));
    if (this.disabled) {
      // Defense-in-depth mirroring connectedCallback's baseline above:
      // <lr-menu>'s roving-tabindex bookkeeping (activeIndex) only gets a
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
    }
    if (changed.has('disabled')) {
      this.emit('lr-menu-item-state-change', { disabled: this.disabled, hidden: this.hidden });
    }
  }

  /** Fires `lr-menu-item-select` (no-op while `disabled`). Called by this element's own
   *  click handler, and by `<lr-menu>`'s Enter/Space keydown handling of the active item.
   *  For `type="checkbox"`, also toggles `checked` and fires `lr-menu-item-change` first --
   *  see the class doc.
   *
   *  A submenu parent is a disclosure rather than an action: it opens its submenu (without
   *  moving focus, since this path is the pointer one -- `<lr-menu>`'s own Enter/Space handling
   *  calls `openSubmenu('first')` directly instead) and fires neither event. */
  select(): void {
    if (this.disabled) return;
    if (this.submenuPanel) {
      this.openSubmenu('none');
      return;
    }
    if (this.type === 'checkbox') {
      this.checked = !this.checked;
      this.emit<MenuItemChangeDetail>('lr-menu-item-change', { value: this.value, checked: this.checked });
    }
    this.emit('lr-menu-item-select');
  }

  /** Opens this item's submenu. A no-op without one, or while `disabled`. `focus` follows
   *  `<lr-menu>`'s own `show()` vocabulary — `'first'` for keyboard activation, `'none'` for
   *  pointer intent, which must not pull focus out from under the keyboard. Re-opening an
   *  already-open submenu still applies the focus target, so ArrowRight moves into a submenu the
   *  pointer opened a moment earlier. */
  openSubmenu(focus: MenuFocusTarget = 'first'): void {
    const panel = this.submenuPanel;
    if (!panel || this.disabled) return;
    panel.anchor = this;
    panel.show(focus);
    // Read back rather than assume: `open` settles synchronously, so `aria-expanded` lands in
    // this same update instead of one tick behind the panel's own `lr-show`.
    this.submenuExpanded = panel.open;
  }

  /** Closes this item's submenu (and, through it, any of its own descendants). A no-op without
   *  one. Focus is left alone — the caller that moved it knows where it belongs. */
  closeSubmenu(): void {
    const panel = this.submenuPanel;
    if (!panel) return;
    panel.hide();
    this.submenuExpanded = panel.open;
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.slottedLabel = (e.target as HTMLSlotElement)
      .assignedNodes({ flatten: true })
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    this.applyPanelName();
  };

  private onSubmenuSlotChange = (e: Event): void => {
    // Matched by tag name rather than `instanceof`: importing the class here would close an
    // import cycle with menu.class.ts (see menu-shared.ts).
    const next = (e.target as HTMLSlotElement)
      .assignedElements({ flatten: true })
      .find((element) => element.localName === tag('menu')) as SubmenuPanel | undefined;
    if (next === this.submenuPanel) return;
    this.submenuPanel?.removeEventListener('lr-show', this.onPanelShow);
    this.submenuPanel?.removeEventListener('lr-hide', this.onPanelHide);
    this.submenuPanel = next ?? null;
    this.submenuAssigned = this.submenuPanel !== null;
    this.ownsPanelAriaLabel = false;
    if (!this.submenuPanel) {
      this.submenuExpanded = false;
      return;
    }
    this.submenuPanel.anchor = this;
    this.submenuPanel.addEventListener('lr-show', this.onPanelShow);
    this.submenuPanel.addEventListener('lr-hide', this.onPanelHide);
    this.submenuExpanded = this.submenuPanel.open;
    this.applyPanelName();
  };

  /** Tracking the panel's own events (rather than only the calls this element makes) keeps
   *  `aria-expanded` right however the submenu closed — Escape, an outside click, a selection,
   *  an ancestor closing, or a direct `panel.open = false`. Both stop here: on the ancestor
   *  `<lr-menu>` they read as *that* menu showing/hiding, which it is not. */
  private onPanelShow = (e: Event): void => {
    e.stopPropagation();
    this.submenuExpanded = true;
  };

  private onPanelHide = (e: Event): void => {
    e.stopPropagation();
    this.submenuExpanded = false;
  };

  /** Names the item explicitly once it has a submenu. Name-from-content would otherwise walk into
   *  the submenu the moment it opens (a visible subtree, so nothing excludes it) and announce
   *  "Share Email Copy link". */
  private applyComputedName(): void {
    if (!this.slottedLabel) return;
    if (this.hasAttribute('aria-label') && !this.ownsAriaLabel) return;
    this.ownsAriaLabel = true;
    if (this.getAttribute('aria-label') === this.slottedLabel) return;
    this.setAttribute('aria-label', this.slottedLabel);
  }

  /** Names the submenu's `role="menu"` after the row that opens it — the APG relationship, which
   *  `aria-labelledby` cannot express here because an idref cannot cross a shadow boundary. */
  private applyPanelName(): void {
    const panel = this.submenuPanel;
    if (!panel || !this.slottedLabel || panel.hasAttribute('label')) return;
    if (panel.hasAttribute('aria-label') && !this.ownsPanelAriaLabel) return;
    this.ownsPanelAriaLabel = true;
    if (panel.getAttribute('aria-label') === this.slottedLabel) return;
    panel.setAttribute('aria-label', this.slottedLabel);
  }

  override render(): TemplateResult {
    return html`
      <span part="base" @click=${() => this.select()}>
        <span part="icon" aria-hidden="true" ?hidden=${!this.hasIconSlot}>
          <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
        </span>
        <span part="label"><slot @slotchange=${this.onLabelSlotChange}></slot></span>
        ${this.type === 'checkbox' && this.checked ? checkmarkGlyph() : nothing}
        ${this.submenuAssigned
          ? html`<span part="submenu-icon" aria-hidden="true">${chevronIcon()}</span>`
          : nothing}
      </span>
      <!-- Outside [part='base'] on purpose: a click inside the submenu must not read as an
           activation of the row that owns it. -->
      <slot name="submenu" @slotchange=${this.onSubmenuSlotChange}></slot>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-menu-item': LyraMenuItem;
  }
}
