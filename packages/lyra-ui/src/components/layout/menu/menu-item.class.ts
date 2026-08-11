import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import {
  composedParentElement,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisibilityHidden,
  isAccessibilityVisible,
} from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon, spinnerIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize, LyraVariant } from '../../../internal/variants.js';
import type { MenuFocusTarget, SubmenuPanel } from './menu-shared.js';
import { styles } from './menu-item.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_items, LYRA_DEFAULT_loading, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type MenuItemType = 'normal' | 'checkbox';
export type MenuItemVariant = LyraVariant | 'default';

const menuTag = unsafeStatic(tag('menu'));
const SUBMENU_TRANSLATE = 'var(--_lr-menu-item-submenu-translation) 0';

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
 * never fires `lr-menu-item-select`, and `type="checkbox"` has no effect on
 * one. The submenu's own selections travel up as the *outer* menu's single
 * consolidated `lr-menu-select` — there is no separate nested-selection
 * event. The panel's `lr-show`/`lr-hide` stop here rather than surfacing on
 * the ancestor menu, where a consumer would read them as that menu closing;
 * listen on the submenu element itself for those.
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
 * parent's Enter/Space handling via `select()`) toggles `checked` and fires
 * `lr-menu-item-change` *in addition to* the usual `lr-menu-item-select`
 * — the latter is never suppressed, so a parent `<lr-menu>` still closes
 * and re-fires its consolidated `lr-menu-select` exactly as it does for a
 * `type="normal"` item. `type="normal"` (the default) renders and behaves
 * exactly as before this option existed — no role, rendering, or event
 * differences.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    items: LYRA_DEFAULT_items,
    loading: LYRA_DEFAULT_loading,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // The shared ladder sits before this component's own sheet so the per-tier `--lr-form-control-*`
  // knobs are already declared by the time `[part='base']` reads them.
  static override styles = [LyraElement.styles, sizes, styles];

  /** An id/value the parent `<lr-menu>`'s `lr-menu-select` detail keys off of. */
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

  /** Visual treatment for a dangerous action (e.g. "Delete") — tints the row with `--lr-color-danger`. */
  @property({ type: Boolean, reflect: true }) destructive = false;

  /** Semantic treatment. `default` is the WA spelling of Lyra's neutral tone; `danger` is the
   * mapped dangerous-action treatment and is equivalent to the legacy `destructive` boolean. */
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
  private offsetPopup: HTMLElement | null = null;
  private previousPopupTranslate = '';
  private previousPopupTranslatePriority = '';
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
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverCtor) {
      this.nativeStateObserver = new MutationObserverCtor(this.onNativeStateMutation);
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
      if (!this.isConnected || labelGeneration !== this.labelObservationGeneration) return;
      this.observeLabelContent();
      this.syncSlottedLabel();
    });
    // A reconnect follows disconnectedCallback()'s restoration of the nested
    // popup's authored inline style. The panel itself is retained, so reapply
    // our live custom-property bridge once the current microtask's upgrades and
    // child renders have settled.
    queueMicrotask(() => {
      if (this.isConnected) this.applySubmenuOffset();
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
    this.releaseSubmenuOffset();
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

  /** Fires `lr-menu-item-select` (no-op while `disabled` or `loading`). Called by this element's own
   *  click handler, and by `<lr-menu>`'s Enter/Space keydown handling of the active item.
   *  For `type="checkbox"`, also toggles `checked` and fires `lr-menu-item-change` first --
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
      this.checked = !this.checked;
      this.emit('lr-menu-item-change', { value: this.value, checked: this.checked });
    }
    this.emit('lr-menu-item-select');
  }

  /** Opens this item's submenu. A no-op without one, or while `disabled`/`loading`. `focus` follows
   *  `<lr-menu>`'s own `show()` vocabulary — `'first'` for keyboard activation, `'none'` for
   *  pointer intent, which must not pull focus out from under the keyboard. Re-opening an
   *  already-open submenu still applies the focus target, so ArrowRight moves into a submenu the
   *  pointer opened a moment earlier. */
  async openSubmenu(focus: MenuFocusTarget = 'first'): Promise<void> {
    const panel = this.submenuPanel;
    const generation = this.submenuPanelGeneration;
    if (!panel || this.interactionDisabled || !this.isCurrentSubmenuPanel(panel, generation)) return;
    this.applySubmenuOffset(panel);
    panel.anchor = this;
    const shown = panel.show(focus);
    // Read back rather than assume: `open` settles synchronously, so `aria-expanded` lands in
    // this same update instead of one tick behind the panel's own `lr-show`.
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = panel.open;
    await shown;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    if (panel.updateComplete) await panel.updateComplete;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.applySubmenuOffset(panel);
    this.submenuExpanded = panel.open;
    await this.updateComplete;
  }

  /** Closes this item's submenu (and, through it, any of its own descendants). A no-op without
   *  one. Focus is left alone — the caller that moved it knows where it belongs. */
  async closeSubmenu(): Promise<void> {
    const panel = this.submenuPanel;
    const generation = this.submenuPanelGeneration;
    if (!panel || !this.isCurrentSubmenuPanel(panel, generation)) return;
    const hidden = panel.hide();
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = panel.open;
    await hidden;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    if (panel.updateComplete) await panel.updateComplete;
    if (!this.isCurrentSubmenuPanel(panel, generation)) return;
    this.submenuExpanded = panel.open;
    await this.updateComplete;
  }

  private onIconSlotChange = (): void => {
    this.hasIconSlot = [...this.renderRoot.querySelectorAll<HTMLSlotElement>('slot[name="icon"], slot[name="prefix"]')]
      .some((slot) => slot.assignedElements({ flatten: true }).length > 0);
  };

  private onDetailsSlotChange = (e: Event): void => {
    this.hasDetailsSlot = (e.target as HTMLSlotElement).assignedNodes({ flatten: true })
      .some((node) => (node.textContent ?? '').trim() !== '');
  };

  private onSuffixSlotChange = (e: Event): void => {
    this.hasSuffixSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private defaultLabelSlot(): HTMLSlotElement | null {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    return renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])') ?? null;
  }

  private isDefaultLabelBranch(node: Node): boolean {
    let top = node;
    while (top.parentNode && top.parentNode !== this) top = top.parentNode;
    if (top.parentNode !== this) return false;
    return top.nodeType !== 1 || ((top as Element).getAttribute('slot') ?? '') === '';
  }

  private labelForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) =>
      this.isDefaultLabelBranch(slot));
  }

  private composedParentForNode(node: Node): Element | null {
    const assignedSlot = (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot;
    if (assignedSlot) return assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode() as Document | ShadowRoot;
    return 'host' in root && root.host.nodeType === 1 ? root.host : null;
  }

  /** The visual slot wrappers are intentionally inert, but their author-owned label content still
   * supplies this host's name and type-ahead text. Skip only the known label presentation fence;
   * visibility and accessibility state in every author-owned branch still applies. */
  private isVisibleLabelContent(element: Element): boolean {
    return isAccessibilityVisible(element, {
      ignorePresentation: (candidate) =>
        candidate.getRootNode() === this.renderRoot &&
        candidate.matches('[part~="label"][aria-hidden="true"][inert]:not([hidden])'),
    });
  }

  /** Plain text that can contribute to the row's accessible name. Flattened forwarding slots are
   * traversed without allowing their fallback to leak through a real (even hidden) assignment. */
  private accessibleLabelText(node: Node, inheritedTextVisible?: boolean): string {
    if (node.nodeType === 3) {
      if (inheritedTextVisible === undefined) {
        const parent = this.composedParentForNode(node);
        inheritedTextVisible = parent !== null &&
          !isAccessibilitySubtreeExcluded(parent) &&
          !isAccessibilityVisibilityHidden(parent) &&
          this.isVisibleLabelContent(parent);
      }
      return inheritedTextVisible ? node.textContent ?? '' : '';
    }
    if (node.nodeType !== 1) return '';

    const element = node as Element;
    if (isAccessibilitySubtreeExcluded(element)) return '';
    const ownTextVisible = !isAccessibilityVisibilityHidden(element);
    // `visibility:hidden` does not prune a subtree: a descendant can restore visibility. For an
    // otherwise visible node, however, this also catches hidden composed ancestors, closed
    // `<details>` branches, and skipped `content-visibility:auto` content.
    if (ownTextVisible && !this.isVisibleLabelContent(element)) return '';
    const ariaLabel = ownTextVisible ? element.getAttribute('aria-label')?.trim() : '';
    if (ariaLabel) return ariaLabel;
    const children =
      element.localName === 'slot' && (element as HTMLSlotElement).assignedNodes().length > 0
        ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
        : Array.from(element.childNodes);
    return Array.from(children)
      .map((child) => this.accessibleLabelText(child, ownTextVisible))
      .join(' ');
  }

  private readSlottedLabel(slot: HTMLSlotElement | null = this.defaultLabelSlot()): string {
    const nodes = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(this.childNodes).filter((node) => this.isDefaultLabelBranch(node));
    return nodes
      .map((node) => this.accessibleLabelText(node))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private observeLabelAncestors(node: Node, options: MutationObserverInit): void {
    const observer = this.labelObserver;
    if (!observer) return;
    let current = this.composedParentForNode(node);
    while (current) {
      // The full subtree observation below already owns this target. Calling observe() again with
      // attribute-only options would replace that registration instead of adding another one.
      if (current !== this && !this.contains(current)) observer.observe(current, options);
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
        'class',
        'hidden',
        'inert',
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

  private syncSlottedLabel(slot: HTMLSlotElement | null = this.defaultLabelSlot()): void {
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
    const submenuSlot = e.target as HTMLSlotElement;
    // Switching from the initial bare slot to the panel/items wrapper removes the old slot.
    // Chromium can deliver that retired slot's final empty `slotchange` after the replacement is
    // already live; treating it as authored removal disconnects and reconnects the same panel and
    // loses ownership of the computed panel name.
    if (!submenuSlot.isConnected || submenuSlot.getRootNode() !== this.renderRoot) return;
    // Matched by tag name rather than `instanceof`: importing the class here would close an
    // import cycle with menu.class.ts (see menu-shared.ts).
    const assigned = submenuSlot.assignedElements({ flatten: true });
    const authoredPanel = assigned.find((element) => element.localName === tag('menu')) as
      | SubmenuPanel
      | undefined;
    const hasDirectItems = assigned.some((element) =>
      element.localName === tag('menu-item') || element.localName === tag('dropdown-item'));
    const kind = authoredPanel ? 'panel' : hasDirectItems ? 'items' : undefined;
    this.submenuKind = kind;
    this.submenuAssigned = kind !== undefined;
    if (kind === 'items') {
      // The generated panel is part of the next render; updated() connects it once it exists.
      return;
    }
    this.connectSubmenuPanel(authoredPanel ?? null);
  };

  private connectSubmenuPanel(next: SubmenuPanel | null): void {
    if (next === this.submenuPanel) return;
    const previous = this.submenuPanel;
    const generation = ++this.submenuPanelGeneration;
    this.releaseSubmenuOffset();
    previous?.removeEventListener('lr-show', this.onPanelShow);
    previous?.removeEventListener('lr-hide', this.onPanelHide);
    if (previous) {
      void previous.hide({ focusTrigger: false });
      if (previous.anchor === this) previous.anchor = null;
    }
    this.submenuPanel = next;
    this.ownsPanelAriaLabel = false;
    this.ownedPanelAriaLabelValue = null;
    if (!this.submenuPanel) {
      this.submenuExpanded = false;
      return;
    }
    const panel = this.submenuPanel;
    panel.anchor = this;
    panel.addEventListener('lr-show', this.onPanelShow);
    panel.addEventListener('lr-hide', this.onPanelHide);
    this.submenuExpanded = panel.open;
    this.applyPanelName();
    this.applySubmenuOffset(panel);
    // A generated menu can still be awaiting its first render during the
    // parent's updated() callback. Its update is already queued, so this runs
    // after it without creating an unhandled promise branch under strict WTR.
    queueMicrotask(() => {
      if (this.isCurrentSubmenuPanel(panel, generation)) this.applySubmenuOffset(panel);
    });
  }

  /** Whether an async submenu operation still owns this item after an awaited panel transition. */
  private isCurrentSubmenuPanel(panel: SubmenuPanel, generation: number): boolean {
    return (
      this.isConnected &&
      this.submenuPanel === panel &&
      this.submenuPanelGeneration === generation
    );
  }

  /** Bridges this item's inherited public CSS property into the actual floating
   * popup. The nested menu owns that node in its shadow root, so a selector in
   * menu-item.styles.ts cannot reach the authored `submenu` slot across both
   * shadow boundaries; the value itself remains live CSS and needs no JS
   * parsing, unit conversion, or property-change observer. */
  private applySubmenuOffset(panel: SubmenuPanel | null = this.submenuPanel): void {
    const popup = panel?.shadowRoot?.querySelector<HTMLElement>('[part~="popup"]') ?? null;
    if (!popup || popup === this.offsetPopup) return;
    this.releaseSubmenuOffset();
    this.offsetPopup = popup;
    this.previousPopupTranslate = popup.style.getPropertyValue('translate');
    this.previousPopupTranslatePriority = popup.style.getPropertyPriority('translate');
    popup.style.setProperty('translate', SUBMENU_TRANSLATE);
  }

  /** Restores any inline translate the nested menu's popup carried before this
   * item adopted it, but leaves a later consumer write alone. */
  private releaseSubmenuOffset(): void {
    const popup = this.offsetPopup;
    if (!popup) return;
    if (popup.style.getPropertyValue('translate') === SUBMENU_TRANSLATE) {
      if (this.previousPopupTranslate) {
        popup.style.setProperty(
          'translate',
          this.previousPopupTranslate,
          this.previousPopupTranslatePriority,
        );
      } else {
        popup.style.removeProperty('translate');
      }
    }
    this.offsetPopup = null;
    this.previousPopupTranslate = '';
    this.previousPopupTranslatePriority = '';
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('submenuKind') && this.submenuKind === 'items') {
      const generated = this.renderRoot.querySelector(`[data-generated-submenu]`) as SubmenuPanel | null;
      this.connectSubmenuPanel(generated);
    }
  }

  /** Tracking the panel's own events (rather than only the calls this element makes) keeps
   *  `aria-expanded` right however the submenu closed — Escape, an outside click, a selection,
   *  an ancestor closing, or a direct `panel.open = false`. Both stop here: on the ancestor
   *  `<lr-menu>` they read as *that* menu showing/hiding, which it is not. */
  private onPanelShow = (e: Event): void => {
    e.stopPropagation();
    if (e.currentTarget !== this.submenuPanel) return;
    this.submenuExpanded = true;
  };

  private onPanelHide = (e: Event): void => {
    e.stopPropagation();
    if (e.currentTarget !== this.submenuPanel) return;
    this.submenuExpanded = false;
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
          <span part="prefix"><slot name="prefix" @slotchange=${this.onIconSlotChange}></slot></span>
        </span>
        <span part="label" aria-hidden="true" inert><slot @slotchange=${this.onLabelSlotChange}></slot></span>
        <span part="details" aria-hidden="true" inert ?hidden=${!this.hasDetailsSlot}>
          <slot name="details" @slotchange=${this.onDetailsSlotChange}></slot>
        </span>
        <span part="suffix" aria-hidden="true" inert ?hidden=${!this.hasSuffixSlot}>
          <slot name="suffix" @slotchange=${this.onSuffixSlotChange}></slot>
        </span>
        ${this.loading
          ? html`<span part="spinner spinner__base" aria-hidden="true">${spinnerIcon()}</span>`
          : nothing}
        ${this.type === 'checkbox' && this.checked
          ? html`<span part="checked-icon">${checkmarkGlyph()}</span>`
          : nothing}
        ${this.submenuAssigned
          ? html`<span part="submenu-icon" aria-hidden="true">${chevronIcon()}</span>`
          : nothing}
      </span>
      <!-- Outside [part='base'] on purpose: a click inside the submenu must not read as an
           activation of the row that owns it. -->
      ${this.submenuKind === 'items'
        ? staticHtml`
            <${menuTag} part="submenu" data-generated-submenu .anchor=${this}>
              <slot name="submenu" @slotchange=${this.onSubmenuSlotChange}></slot>
            </${menuTag}>
          `
        : this.submenuKind === 'panel'
          ? html`<span part="submenu"><slot name="submenu" @slotchange=${this.onSubmenuSlotChange}></slot></span>`
          : html`<slot name="submenu" @slotchange=${this.onSubmenuSlotChange}></slot>`}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-menu-item': LyraMenuItem;
  }
}
