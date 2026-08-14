import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import {
  composedParentElement,
  isAccessibilitySubtreeExcluded,
} from '../../../internal/a11y.js';
import { composedAccessibilityText } from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon, spinnerIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import {
  menuItemOwner,
  submenuPanelController,
  type MenuFocusTarget,
  type MenuItemOwner,
  type SubmenuPanel,
} from './menu-shared.js';
import { styles } from './menu-item.styles.js';

export type MenuItemType = 'normal' | 'checkbox';
export type MenuItemVariant = 'default' | 'danger';

const menuTag = unsafeStatic(tag('menu'));
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

/** The navigability flags `<lr-menu>` re-checks its roving tabindex against. */
export interface MenuItemStateChangeDetail {
  /** `disabled || loading` — the item's effective `interactionDisabled`. */
  disabled: boolean;
  hidden: boolean;
  inert: boolean;
}

export interface LyraMenuItemEventMap {
  'lr-menu-item-state-change': CustomEvent<MenuItemStateChangeDetail>;
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
 * own keydown handler). The visual row wires the pointer `click` listener,
 * and the host's `click()` forwards to that same row, so `select()` fires
 * identically whether the item was reached by mouse, keyboard, or a
 * programmatic host click.
 *
 * A `<lr-menu>` or one or more direct mapped items assigned to the `submenu` slot turns this row
 * into a submenu parent: the host gains `aria-haspopup="menu"` plus an `aria-expanded` that
 * renders `"true"` *and* `"false"` (never omitted — the attribute is part of
 * the role's state, so a Lit `?aria-expanded=` directive would be wrong), a
 * chevron renders in `[part="submenu-icon"]`, and activation opens the
 * submenu instead of selecting. The parent `<lr-menu>` owns the interaction
 * policy — the arrow keys (mirrored under RTL), pointer intent, and the
 * one-submenu-per-level rule — and drives it through `openSubmenu()` /
 * `closeSubmenu()`; this element owns the ARIA, the naming, and the panel
 * wiring. Because a submenu parent is a disclosure rather than an action, it
 * never activates the menu, and `type="checkbox"` has no effect on one. A submenu selection is
 * the same single `lr-select` event bubbling through the outer menu — there is no separate nested
 * selection event or public child-to-menu event.
 *
 * The default label slot's flattened subtree is visual-only: it is inert and
 * hidden from assistive technology so the focusable host remains the row's
 * sole action. Its accessible text names both this item and its submenu's
 * `role="menu"`, without allowing an open submenu to leak into the item's
 * name. Direct and flattened, forwarded default-slot labels are observed live
 * so in-place text edits, reassignments, and relevant visibility changes
 * update type-ahead and both computed names. Accessibility-hidden branches are
 * omitted; a real forwarding-slot assignment remains authoritative even when
 * hidden, while fallback contributes once no assignment remains. A host-level
 * `aria-label` or `aria-labelledby` remains authoritative; a `label`/
 * `aria-label` on the submenu itself does too. An explicitly empty
 * `aria-label` and a value supplied after the initial computed name both win.
 *
 * `type="checkbox"` (mirroring `wa-dropdown-item`'s identical `type` option)
 * renders `role="menuitemcheckbox"` in place of `role="menuitem"`, with
 * `aria-checked` reflecting `checked` and a checkmark glyph shown once
 * `checked` is `true`. Activating a `checkbox`-type item (click, or the
 * parent's Enter/Space handling via `select()`) first fires a cancelable
 * `lr-menu-item-change` with the proposed next `checked` value, then mutates
 * `checked` unless a listener prevents that event. It fires
 * the owning menu's canonical `lr-select` afterwards either way. `type="normal"` (the default) renders and
 * behaves exactly as before this option existed — no role, rendering, or
 * event differences.
 *
 * @customElement lr-menu-item
 * @slot - The item's visual label content. Its flattened subtree is inert and hidden from assistive
 *   technology; its accessible text names the host menu item.
 * @slot icon - Optional decorative leading icon. Its flattened subtree is inert and hidden from
 *   assistive technology.
 * @slot prefix - Shoelace-compatible decorative alias for leading content. Its flattened subtree is
 *   inert and hidden from assistive technology.
 * @slot details - Decorative secondary WA-compatible detail text rendered after the label. Its
 *   flattened subtree is inert and hidden from assistive technology.
 * @slot suffix - Shoelace-compatible decorative trailing content. Its flattened subtree is inert and
 *   hidden from assistive technology.
 * @slot submenu - A nested `<lr-menu>` or direct mapped menu items that open beside this row.
 * @event lr-menu-item-change - A `type="checkbox"` item was activated.
 * `detail: { value, checked }` contains the item's own `value` and the
 * proposed next `checked` value, before the property mutates. Cancelable:
 * prevent it to retain the current `checked` value. The usual
 * the parent menu's `lr-select` still follows, so selection and close
 * behavior are unchanged. Never fired for `type="normal"`.
 * @event lr-menu-item-state-change - Something that decides whether this item is navigable changed:
 *   `disabled`, `loading`, `hidden`, `inert`, or `aria-hidden`. `detail: { disabled, hidden, inert }`,
 *   where `disabled` is the effective `disabled || loading`. `<lr-menu>` consumes this to repair its
 *   roving-tabindex state immediately. The last three are plain native attributes rather than
 *   reactive properties, so they are watched with the item's own `MutationObserver`; `aria-hidden`
 *   fires the event without appearing in the detail, which carries only the item's own state flags.
 * @csspart base - The row (`role` lives on the host — see the class doc).
 * @csspart icon - Wrapper around the `icon` slot. Not rendered at all when the slot is empty.
 * @csspart prefix - Wrapper around the `prefix` slot.
 * @csspart label - Wrapper around the default slot.
 * @csspart checkmark - The checkmark glyph shown when a `type="checkbox"` item is `checked`. Not rendered at all for `type="normal"`.
 * @csspart checked-icon - Shoelace-compatible wrapper around the checked glyph.
 * @csspart details - Wrapper around the `details` slot.
 * @csspart suffix - Wrapper around the `suffix` slot.
 * @csspart spinner - Loading spinner.
 * @csspart spinner__base - Shoelace-compatible alias on the loading spinner.
 * @csspart submenu-icon - Wrapper around the chevron shown on a submenu parent. Not rendered at all without a `submenu` slot. Mirrors under RTL through this wrapper, never by swapping the glyph.
 * @csspart submenu - The submenu panel/wrapper.
 * @cssprop [--submenu-offset=-2px] - Final signed distance between a submenu and its parent row.
 * Negative values overlap the parent menu; positive values add separation. Mirrors under RTL.
 * @cssprop [--lr-menu-item-gap=var(--lr-space-xs)] - Gap between the visual parts of
 * `[part="base"]`, including its leading content, label, trailing details, and state glyphs.
 * Declared as an inline `var()` fallback (never on `:host`), so an item or any ancestor can retune
 * it without a `::part(base)` rule. It is constant across the shared size ladder.
 * @cssprop [--lr-menu-item-radius=var(--lr-form-control-radius)] - Corner radius of the visual row
 * and focusable host. Its fallback follows the active shared size tier. Declared as an inline
 * `var()` fallback (never on `:host`), so an item or any ancestor can retune it without a
 * `::part(base)` rule.
 * Danger-state hooks are also inline fallbacks, so a menu can retheme only its dangerous rows
 * without replacing the shared danger palette elsewhere.
 * @cssprop [--lr-menu-item-danger-color=var(--lr-color-danger)] - Foreground of a
 * `variant="danger"` row.
 * @cssprop [--lr-menu-item-danger-hover-bg=var(--lr-color-danger-quiet)] - Background of an enabled
 * danger row while hovered.
 * @cssprop [--lr-menu-item-danger-active-bg=color-mix(in oklab, var(--lr-color-danger-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of an enabled danger row while pressed.
 * @method click - Activates the visual row, including checkbox and submenu behavior; no-op while
 * disabled or loading.
 * @method select - Activates a selectable item; no-op while disabled/loading and opens submenu parents.
 * @method openSubmenu - Opens the submenu and resolves after its open state settles.
 * @method closeSubmenu - Closes the submenu and resolves after its closed state settles.
 * @method getTextLabel - Returns the visible label used by type-ahead.
 * @status stable
 * @since 4.0.0
 */
export class LyraMenuItem extends LyraElement<LyraMenuItemEventMap> {
  // The shared ladder sits before this component's own sheet so the per-tier `--lr-form-control-*`
  // knobs are already declared by the time `[part='base']` reads them.
  static override styles = [LyraElement.styles, sizes, styles];

  /** An id/value available on the item carried by the parent `<lr-menu>`'s `lr-select` detail. */
  @property() value = '';

  /** Row density, on the library's shared six-step ladder — `'m'` by default. Scales the row's
   *  height, inline/block padding, font size and corner radius together; `'small'`/`'medium'`/
   *  `'large'` are accepted as synonyms of `'s'`/`'m'`/`'l'`. Every tier still resolves to at
   *  least the 24px pointer-target floor, so even `'2xs'` stays tappable. Each item carries its
   *  own size rather than inheriting one from `<lr-menu>`, so a single compact row inside an
   *  otherwise default menu needs no wrapper. */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Disables selection and excludes this item from `<lr-menu>`'s roving-tabindex nav entirely. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Semantic treatment. `default` is the WA spelling of a normal action and `danger` is its
   * mapped dangerous-action treatment. */
  @property({ reflect: true }) variant: MenuItemVariant = 'default';

  /** `'checkbox'` renders `role="menuitemcheckbox"` with a toggleable `checked` state and a
   *  checkmark glyph, mirroring `wa-dropdown-item`'s identical `type` option — see the class doc. */
  @property({ reflect: true }) type: MenuItemType = 'normal';

  /** Whether a `type="checkbox"` item is checked. Meaningless (ignored) for `type="normal"`. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Shows progress and makes the row interaction-disabled while an action is pending. */
  @property({ type: Boolean, reflect: true }) loading = false;

  // [part='icon'] never matches a bare :empty selector -- see menu-item.styles.ts's
  // own comment on that part. Same fix as lr-tool-call-chip's hasDetailSlot.
  @state() private hasIconSlot = false;
  @state() private hasDetailsSlot = false;
  @state() private hasSuffixSlot = false;

  // Reactive because the host's aria-haspopup/aria-expanded and the chevron all key off them.
  @state() private submenuAssigned = false;
  @state() private submenuExpanded = false;
  @state() private submenuKind: 'panel' | 'items' | undefined;
  // The default slot's text, kept apart from `textContent` -- which, for a submenu parent, also
  // contains every label inside the submenu.
  @state() private slottedLabel = '';

  private submenuPanel: SubmenuPanel | null = null;
  private submenuPanelAttached = false;
  /** Increments whenever the owned submenu identity becomes stale, so async show/hide continuations
   * cannot write disclosure state or popup ownership back onto a replacement panel. */
  private submenuPanelGeneration = 0;
  /** `hidden`/`inert`/`aria-hidden` are native attributes, not reactive properties: assigning
   *  `item.inert = true` schedules no Lit update, so `willUpdate()` can never announce them. This
   *  observer is what makes the item — rather than every parent that has to care — the authority on
   *  its own navigability. */
  private nativeStateObserver?: MutationObserver;
  /** Watches default-slot label text, including flattened nodes projected from an outer wrapper. */
  private labelObserver?: MutationObserver;
  private labelObservationGeneration = 0;
  private announcedNativeState = '';
  private owningMenu: MenuItemOwner | null = null;
  // A consumer-authored name always wins; these record that the computed one was ours to update.
  private ownsAriaLabel = false;
  private ownedAriaLabelValue: string | null = null;
  private ownsPanelAriaLabel = false;
  private ownedPanelAriaLabelValue: string | null = null;

  /** Whether a nested `<lr-menu>` or direct mapped items are assigned to this item's `submenu`
   * slot, making it a submenu parent. */
  get hasSubmenu(): boolean {
    return this.submenuAssigned;
  }

  /** Whether this item's submenu is currently open. Tracks the panel's own state, however it
   *  changed — the parent menu's keyboard/pointer handling, a dismissal, or a direct write. */
  get submenuOpen(): boolean {
    return this.submenuExpanded;
  }

  /** @internal Installs the private item-to-menu activation bridge. A stale former owner can only
   * release its own lease, so same-task reparenting cannot disconnect the new menu. */
  [menuItemOwner](
    owner: MenuItemOwner | null,
    expectedOwner?: MenuItemOwner
  ): void {
    if (owner === null && expectedOwner && this.owningMenu !== expectedOwner)
      return;
    this.owningMenu = owner;
  }
  set submenuOpen(next: boolean) {
    if (Boolean(next) === this.submenuExpanded) return;
    if (next) void this.openSubmenu('none');
    else void this.closeSubmenu();
  }

  /** @internal The effective navigation/activation state used by the parent menu. */
  get interactionDisabled(): boolean {
    return this.disabled || this.loading;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Seed the host's accessible name before the first visual slotchange. The rendered wrapper is
    // intentionally inert, so later reads skip that presentation fence while still respecting the
    // author-owned label branch and its composed ancestors.
    const initialLabel = this.readSlottedLabel(null);
    if (initialLabel !== this.slottedLabel) this.slottedLabel = initialLabel;
    // A safe, focusable-but-out-of-tab-order baseline before <lr-menu> ever
    // gets a chance to assign roving-tabindex state (e.g. a standalone
    // fixture in a test, or the brief window before the parent's own
    // slotchange handler runs). <lr-menu> is the sole subsequent owner of
    // this property -- see the class doc.
    if (this.tabIndex !== 0) this.tabIndex = -1;
    this.announcedNativeState = this.nativeStateSignature();
    const MutationObserverCtor =
      this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverCtor) {
      this.nativeStateObserver = new MutationObserverCtor(
        this.onNativeStateMutation
      );
      this.nativeStateObserver.observe(this, {
        attributes: true,
        attributeFilter: ['hidden', 'inert', 'aria-hidden'],
      });
      this.labelObserver = new MutationObserverCtor(() => {
        this.observeLabelContent();
        this.syncSlottedLabel();
      });
      this.observeLabelContent();
    }
    this.addEventListener('slotchange', this.onForwardedLabelSlotChange);
    const labelGeneration = ++this.labelObservationGeneration;
    void this.updateComplete.then(() => {
      if (
        !this.isConnected ||
        labelGeneration !== this.labelObservationGeneration
      )
        return;
      this.observeLabelContent();
      this.syncSlottedLabel();
      const submenuSlot = this.renderRoot.querySelector<HTMLSlotElement>(
        'slot[name="submenu"]'
      );
      if (submenuSlot) this.syncSubmenuSlot(submenuSlot);
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.submenuPanelGeneration += 1;
    // Transient open state never survives a detach: the panel is a child, so it tears its own
    // `open` down at the same moment, and a reconnect must not resume with a stale aria-expanded.
    this.submenuExpanded = false;
    this.nativeStateObserver?.disconnect();
    this.nativeStateObserver = undefined;
    this.labelObservationGeneration += 1;
    this.removeEventListener('slotchange', this.onForwardedLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    if (this.submenuPanel && this.submenuPanelAttached) {
      this.submenuPanel[submenuPanelController].detach(this);
      this.submenuPanelAttached = false;
    }
  }

  /** Every flag a parent's navigability predicate reads, in one comparable string. */
  private nativeStateSignature(): string {
    return `${this.hidden}|${this.inert}|${this.getAttribute('aria-hidden')}`;
  }

  /** A `MutationObserver` re-fires for a write that changes nothing (`item.hidden = item.hidden`),
   *  so the signature comparison is what keeps a no-op write from waking every parent menu. */
  private onNativeStateMutation = (): void => {
    const signature = this.nativeStateSignature();
    if (signature === this.announcedNativeState) return;
    this.announcedNativeState = signature;
    this.emitStateChange();
  };

  private emitStateChange(): void {
    this.emit('lr-menu-item-state-change', {
      disabled: this.interactionDisabled,
      // `hidden` is `boolean | 'until-found'`, and `until-found` hides the row just as completely.
      hidden: Boolean(this.hidden),
      inert: this.inert,
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // role/aria-disabled/aria-checked live on the host (see the class doc),
    // so they're plain imperative attribute writes here rather than part of
    // render()'s shadow-DOM template -- mirrors lr-tree-item's identical
    // willUpdate.
    // A submenu parent is a disclosure, never simultaneously a checked action. Keep the author
    // property intact so removing the submenu restores its requested checkbox mode.
    const isCheckbox = this.type === 'checkbox' && !this.submenuAssigned;
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
      this.setAttribute(
        'aria-expanded',
        this.submenuExpanded ? 'true' : 'false'
      );
    } else {
      this.removeAttribute('aria-haspopup');
      this.removeAttribute('aria-expanded');
    }
    this.applyComputedName();
    this.toggleAttribute('submenu-open', this.submenuExpanded);
    this.setAttribute('aria-disabled', String(this.interactionDisabled));
    if (this.interactionDisabled) {
      // Defense-in-depth mirroring connectedCallback's baseline above:
      // <lr-menu>'s roving-tabindex bookkeeping (activeIndex) only gets a
      // chance to resync once real focus actually moves (via its own
      // focusin listener), so a `disabled` flip must proactively strip this
      // item out of the roving target and drop any focus it's currently
      // holding right here -- regardless of what the parent's activeIndex
      // still thinks -- so a disabled item can never remain the roving
      // target or retain focus.
      if (changed.has('disabled') || changed.has('loading')) {
        this.tabIndex = -1;
        if (this.ownerDocument?.activeElement === this) this.blur();
      }
    }
    if (changed.has('disabled') || changed.has('loading')) {
      this.emitStateChange();
    }
  }

  /** Activates the visual row, matching a consumer click on this focusable host. This preserves the
   *  row's native click event path and its normal, checkbox, and submenu branches. Disabled and
   *  loading items remain inert. */
  override click(): void {
    if (this.interactionDisabled) return;
    this.renderRoot.querySelector<HTMLElement>('[part~="base"]')?.click();
  }

  /** Activates this item through its owning menu (no-op while `disabled` or `loading`). Called by
   *  this element's own click handler, and by `<lr-menu>`'s Enter/Space keydown handling.
   *  For `type="checkbox"`, first emits the cancelable proposed `lr-menu-item-change`; it commits
   *  that proposed `checked` state only when the event is not prevented, then fires selection --
   *  see the class doc.
   *
   *  A submenu parent is a disclosure rather than an action: it opens its submenu (without
   *  moving focus, since this path is the pointer one -- `<lr-menu>`'s own Enter/Space handling
   *  calls `openSubmenu('first')` directly instead) and fires neither event. */
  select(): void {
    if (this.interactionDisabled) return;
    if (this.submenuPanel) {
      this.openSubmenu('none');
      return;
    }
    if (this.type === 'checkbox') {
      const checked = !this.checked;
      const changeEvent = this.emit(
        'lr-menu-item-change',
        { value: this.value, checked },
        { cancelable: true }
      );
      if (!changeEvent.defaultPrevented) this.checked = checked;
    }
    this.owningMenu?.activate(this);
  }

  /** Opens this item's submenu. A no-op without one, or while `disabled`/`loading`. `focus` uses
   *  `'first'` for keyboard activation and `'none'` for
   *  pointer intent, which must not pull focus out from under the keyboard. Re-opening an
   *  already-open submenu still applies the focus target, so ArrowRight moves into a submenu the
   *  pointer opened a moment earlier. */
  async openSubmenu(focus: MenuFocusTarget = 'first'): Promise<void> {
    const panel = this.submenuPanel;
    const generation = this.submenuPanelGeneration;
    if (
      !panel ||
      this.interactionDisabled ||
      !this.isCurrentSubmenuPanel(panel, generation)
    )
      return;
    const controller = panel[submenuPanelController];
    const shown = controller.show(focus);
    // Read back rather than assume: `open` settles synchronously, so `aria-expanded` lands in
    // this same update instead of one tick behind the panel render.
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = controller.open;
    await shown;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    if (panel.updateComplete) await panel.updateComplete;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = controller.open;
    await this.updateComplete;
  }

  /** Closes this item's submenu (and, through it, any of its own descendants). A no-op without
   *  one. Focus is left alone — the caller that moved it knows where it belongs. */
  async closeSubmenu(): Promise<void> {
    const panel = this.submenuPanel;
    const generation = this.submenuPanelGeneration;
    if (!panel || !this.isCurrentSubmenuPanel(panel, generation)) return;
    const controller = panel[submenuPanelController];
    const hidden = controller.hide();
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = controller.open;
    await hidden;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    if (panel.updateComplete) await panel.updateComplete;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = controller.open;
    await this.updateComplete;
  }

  private onIconSlotChange = (): void => {
    this.hasIconSlot = [
      ...this.renderRoot.querySelectorAll<HTMLSlotElement>(
        'slot[name="icon"], slot[name="prefix"]'
      ),
    ].some((slot) => slot.assignedElements({ flatten: true }).length > 0);
  };

  private onDetailsSlotChange = (e: Event): void => {
    this.hasDetailsSlot = (e.target as HTMLSlotElement)
      .assignedNodes({ flatten: true })
      .some((node) => (node.textContent ?? '').trim() !== '');
  };

  private onSuffixSlotChange = (e: Event): void => {
    this.hasSuffixSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private defaultLabelSlot(): HTMLSlotElement | null {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    return (
      renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])') ?? null
    );
  }

  private isDefaultLabelBranch(node: Node): boolean {
    let top = node;
    while (top.parentNode && top.parentNode !== this) top = top.parentNode;
    if (top.parentNode !== this) return false;
    return (
      top.nodeType !== 1 || ((top as Element).getAttribute('slot') ?? '') === ''
    );
  }

  private labelForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter(
      (slot) => this.isDefaultLabelBranch(slot)
    );
  }

  private composedParentForNode(node: Node): Element | null {
    const assignedSlot = (
      node as Node & { assignedSlot?: HTMLSlotElement | null }
    ).assignedSlot;
    if (assignedSlot) return assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode() as Document | ShadowRoot;
    return 'host' in root && root.host.nodeType === 1 ? root.host : null;
  }

  private isLabelSubtreeExcluded(element: Element): boolean {
    const presentationFence =
      element.getRootNode() === this.renderRoot &&
      element.matches(
        '[part~="label"][aria-hidden="true"][inert]:not([hidden])'
      );
    return !presentationFence && isAccessibilitySubtreeExcluded(element);
  }

  private readSlottedLabel(
    slot: HTMLSlotElement | null = this.defaultLabelSlot()
  ): string {
    const nodes = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(this.childNodes).filter((node) =>
          this.isDefaultLabelBranch(node)
        );
    return composedAccessibilityText(nodes, {
      ancestorBoundary: this,
      isSubtreeExcluded: (element) => this.isLabelSubtreeExcluded(element),
    })
      .replace(/\s+/g, ' ')
      .trim();
  }

  private observeLabelAncestors(
    node: Node,
    options: MutationObserverInit
  ): void {
    const observer = this.labelObserver;
    if (!observer) return;
    let current = this.composedParentForNode(node);
    while (current) {
      // The full subtree observation below already owns this target. Calling observe() again with
      // attribute-only options would replace that registration instead of adding another one.
      if (current !== this && !this.contains(current))
        observer.observe(current, options);
      current = composedParentElement(current);
    }
  }

  private observeLabelContent(): void {
    const observer = this.labelObserver;
    if (!observer) return;
    observer.disconnect();
    const options: MutationObserverInit = {
      attributes: true,
      attributeFilter: [
        'aria-hidden',
        'aria-label',
        'aria-labelledby',
        'alt',
        'class',
        'hidden',
        'inert',
        'id',
        'label',
        'open',
        'slot',
        'style',
      ],
      characterData: true,
      childList: true,
      subtree: true,
    };
    observer.observe(this, options);
    const slot = this.defaultLabelSlot();
    for (const assigned of slot?.assignedNodes({ flatten: true }) ?? []) {
      if (!this.contains(assigned)) observer.observe(assigned, options);
      this.observeLabelAncestors(assigned, {
        attributes: true,
        attributeFilter: options.attributeFilter,
      });
    }
  }

  private syncSlottedLabel(
    slot: HTMLSlotElement | null = this.defaultLabelSlot()
  ): void {
    const next = this.readSlottedLabel(slot);
    if (next !== this.slottedLabel) this.slottedLabel = next;
    this.applyComputedName();
    this.applyPanelName();
  }

  private onLabelSlotChange = (event: Event): void => {
    this.observeLabelContent();
    this.syncSlottedLabel(event.target as HTMLSlotElement);
  };

  private onForwardedLabelSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (!this.labelForwardingSlots().includes(slot)) return;
    this.observeLabelContent();
    this.syncSlottedLabel();
  };

  private onSubmenuSlotChange = (e: Event): void => {
    this.syncSubmenuSlot(e.target as HTMLSlotElement);
  };

  private syncSubmenuSlot(submenuSlot: HTMLSlotElement): void {
    // Switching from the initial bare slot to the panel/items wrapper removes the old slot.
    // Chromium can deliver that retired slot's final empty `slotchange` after the replacement is
    // already live; treating it as authored removal disconnects and reconnects the same panel and
    // loses ownership of the computed panel name.
    if (
      !submenuSlot.isConnected ||
      submenuSlot.getRootNode() !== this.renderRoot
    )
      return;
    // Matched by tag name rather than `instanceof`: importing the class here would close an
    // import cycle with menu.class.ts (see menu-shared.ts).
    const assigned = submenuSlot.assignedElements({ flatten: true });
    const authoredPanel = assigned.find(
      (element) => element.localName === tag('menu')
    ) as SubmenuPanel | undefined;
    const hasDirectItems = assigned.some(
      (element) =>
        element.localName === tag('menu-item') ||
        element.localName === tag('dropdown-item')
    );
    const kind = authoredPanel ? 'panel' : hasDirectItems ? 'items' : undefined;
    this.submenuKind = kind;
    this.submenuAssigned = kind !== undefined;
    if (kind === 'items') {
      // On first assignment the generated panel arrives in the next render; on reconnect it
      // already exists and must reacquire its private controller even when no slotchange fires.
      const generated = this.renderRoot.querySelector(
        `[data-generated-submenu]`
      ) as SubmenuPanel | null;
      if (generated) this.connectSubmenuPanel(generated);
      return;
    }
    this.connectSubmenuPanel(authoredPanel ?? null);
  }

  private connectSubmenuPanel(next: SubmenuPanel | null): void {
    const samePanel = next === this.submenuPanel;
    if (samePanel && (next === null || this.submenuPanelAttached)) return;
    const previous = this.submenuPanel;
    ++this.submenuPanelGeneration;
    if (previous && this.submenuPanelAttached) {
      previous[submenuPanelController].detach(this);
    }
    this.submenuPanelAttached = false;
    if (!samePanel) {
      this.submenuPanel = next;
      this.ownsPanelAriaLabel = false;
      this.ownedPanelAriaLabelValue = null;
    }
    if (!this.submenuPanel) {
      this.submenuExpanded = false;
      return;
    }
    const panel = this.submenuPanel;
    const controller = panel[submenuPanelController];
    controller.attach(this, this.onPanelStateChange);
    this.submenuPanelAttached = true;
    this.submenuExpanded = controller.open;
    this.applyPanelName();
  }

  /** Whether an async submenu operation still owns this item after an awaited panel transition. */
  private isCurrentSubmenuPanel(
    panel: SubmenuPanel,
    generation: number
  ): boolean {
    return (
      this.isConnected &&
      this.submenuPanel === panel &&
      this.submenuPanelGeneration === generation
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('submenuKind') && this.submenuKind === 'items') {
      const generated = this.renderRoot.querySelector(
        `[data-generated-submenu]`
      ) as SubmenuPanel | null;
      this.connectSubmenuPanel(generated);
    }
  }

  /** The private submenu controller reports every state transition, including Escape, outside
   * dismissal, selection, ancestor teardown, and panel replacement. */
  private onPanelStateChange = (open: boolean): void => {
    this.submenuExpanded = open;
  };

  /** Names the focusable host from its visual-only label text. This also prevents a submenu from
   *  leaking its open content into the parent item's name. */
  private applyComputedName(): void {
    if (
      this.ownsAriaLabel &&
      this.getAttribute('aria-label') !== this.ownedAriaLabelValue
    ) {
      this.ownsAriaLabel = false;
      this.ownedAriaLabelValue = null;
    }
    if (this.hasAttribute('aria-labelledby')) {
      if (this.ownsAriaLabel) this.removeAttribute('aria-label');
      this.ownsAriaLabel = false;
      this.ownedAriaLabelValue = null;
      return;
    }
    if (this.hasAttribute('aria-label') && !this.ownsAriaLabel) return;
    this.ownsAriaLabel = true;
    this.ownedAriaLabelValue = this.slottedLabel;
    if (this.getAttribute('aria-label') === this.slottedLabel) return;
    this.setAttribute('aria-label', this.slottedLabel);
  }

  /** Names the submenu's `role="menu"` after the row that opens it — the APG relationship, which
   *  `aria-labelledby` cannot express here because an idref cannot cross a shadow boundary. */
  private applyPanelName(): void {
    const panel = this.submenuPanel;
    if (!panel) return;
    if (
      this.ownsPanelAriaLabel &&
      panel.getAttribute('aria-label') !== this.ownedPanelAriaLabelValue
    ) {
      this.ownsPanelAriaLabel = false;
      this.ownedPanelAriaLabelValue = null;
    }
    if (panel.hasAttribute('label')) {
      if (this.ownsPanelAriaLabel) {
        panel.removeAttribute('aria-label');
        this.ownsPanelAriaLabel = false;
        this.ownedPanelAriaLabelValue = null;
      }
      return;
    }
    if (panel.hasAttribute('aria-label') && !this.ownsPanelAriaLabel) return;
    this.ownsPanelAriaLabel = true;
    this.ownedPanelAriaLabelValue = this.slottedLabel;
    if (panel.getAttribute('aria-label') === this.slottedLabel) return;
    panel.setAttribute('aria-label', this.slottedLabel);
  }

  /** Text label used by type-ahead and Shoelace-compatible integrations. */
  getTextLabel(): string {
    return this.readSlottedLabel();
  }

  override render(): TemplateResult {
    return html`
      <span part="base" @click=${() => this.select()}>
        <span part="icon" aria-hidden="true" inert ?hidden=${!this.hasIconSlot}>
          <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
          <span part="prefix"
            ><slot name="prefix" @slotchange=${this.onIconSlotChange}></slot
          ></span>
        </span>
        <span part="label" aria-hidden="true" inert
          ><slot @slotchange=${this.onLabelSlotChange}></slot
        ></span>
        <span
          part="details"
          aria-hidden="true"
          inert
          ?hidden=${!this.hasDetailsSlot}
        >
          <slot name="details" @slotchange=${this.onDetailsSlotChange}></slot>
        </span>
        <span
          part="suffix"
          aria-hidden="true"
          inert
          ?hidden=${!this.hasSuffixSlot}
        >
          <slot name="suffix" @slotchange=${this.onSuffixSlotChange}></slot>
        </span>
        ${this.loading
          ? html`<span part="spinner spinner__base" aria-hidden="true"
              >${spinnerIcon()}</span
            >`
          : nothing}
        ${this.type === 'checkbox' && this.checked
          ? html`<span part="checked-icon">${checkmarkGlyph()}</span>`
          : nothing}
        ${this.submenuAssigned
          ? html`<span part="submenu-icon" aria-hidden="true"
              >${chevronIcon()}</span
            >`
          : nothing}
      </span>
      <!-- Outside [part='base'] on purpose: a click inside the submenu must not read as an
           activation of the row that owns it. -->
      ${this.submenuKind === 'items'
        ? staticHtml`
            <${menuTag} part="submenu" data-generated-submenu>
              <slot name="submenu" @slotchange=${this.onSubmenuSlotChange}></slot>
            </${menuTag}>
          `
        : this.submenuKind === 'panel'
        ? html`<span part="submenu"
            ><slot name="submenu" @slotchange=${this.onSubmenuSlotChange}></slot
          ></span>`
        : html`<slot
            name="submenu"
            @slotchange=${this.onSubmenuSlotChange}
          ></slot>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-menu-item': LyraMenuItem;
  }
}
