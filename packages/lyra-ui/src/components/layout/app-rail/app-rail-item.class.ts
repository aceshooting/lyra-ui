import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { composedContains, deepActiveElement } from '../../../internal/overlay-manager.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  isComposedFocusAvailable,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { chevronIcon } from '../../../internal/icons.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { tag } from '../../../internal/prefix.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import { deferredPlace as place } from '../../../internal/anchored-overlay-runtime.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { styles } from './app-rail-item.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_appRailItemCollapse, LYRA_DEFAULT_appRailItemExpand } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraAppRailItemToggleDetail {
  open: boolean;
}

export interface LyraAppRailItemEventMap {
  'lr-toggle-request': CustomEvent<LyraAppRailItemToggleDetail>;
  'lr-toggle': CustomEvent<LyraAppRailItemToggleDetail>;
}

/**
 * `<lr-app-rail-item>` — an explicit icon/label navigation item for
 * `<lr-app-rail>`. The rail sets its `icon-only` attribute as the viewport
 * changes, keeping the label available to assistive technology while removing
 * it from the visual layout. `[part="base"]` resolves to a square hit target
 * (matching the icon-button footprint used elsewhere in this library) while
 * `icon-only`, instead of stretching across the rail's icon column.
 * A host `aria-label` is forwarded by attribute presence to the internal
 * focusable link or button, including an explicitly empty value.
 * When a focused link/button is replaced, focus follows an available replacement. If the new
 * owner is disabled or inert, focus returns to the available element that led into the item, or
 * to the stable owning rail surface when there is no return target; a newer external focus move
 * always wins.
 *
 * An item may own its own expandable child list -- the treeitem-with-link pattern used by
 * repository trees, Notion-style page trees and IDE explorers, where the row itself is a
 * destination and a SEPARATE disclosure expands that one item's own nested rows beneath it.
 * `<lr-app-rail-group>` cannot express this: its collapsible heading IS the toggle, so nesting a
 * navigable link inside it would put an interactive element inside a button. Slotting one or more
 * `<lr-app-rail-item>`s into `children` instead renders a built-in disclosure -- a SIBLING of
 * `[part="base"]`, never nested inside it, so the link keeps navigating on its own and the
 * disclosure keeps toggling on its own; clicking one never triggers the other. The disclosure
 * carries `aria-expanded`/`aria-controls` and a localized accessible name interpolating this
 * item's own label, mirroring `<lr-app-rail-group>`'s collapsible contract for event name, detail
 * shape and cancelable request/commit semantics exactly (see `lr-toggle-request`/`lr-toggle`
 * below). An item with nothing slotted into `children` renders no disclosure and no extra
 * wrapper -- byte-identical to an item with no children slot at all.
 *
 * `icon-only` forwards onto every `<lr-app-rail-item>` this item DIRECTLY owns through `children`,
 * exactly how `<lr-app-rail-group>` forwards onto the items and nested groups it owns -- so a
 * nested item's own icon/label presentation tracks the rail's presentation without the rail
 * reaching through two hosts. Icon-only presentation hides the disclosure and nested list while
 * keeping expanded unchanged. If a hidden control held focus, the visible parent item receives it.
 * There is no ancestor-current treatment: `<lr-app-rail-group>` has no equivalent concept for a
 * group containing the current item, so none is invented here either -- a current descendant
 * stays perceivable only through its own `current` property, exactly as an unnested item would.
 *
 * @customElement lr-app-rail-item
 * @slot - The visible navigation label.
 * @slot icon - The leading decorative icon. Its flattened subtree is inert and hidden from
 *   assistive technology; the default slot or host `aria-label` names the internal control.
 * @slot meta - Secondary trailing text -- an unread count, a keyboard shortcut. Rendered as a
 *   SIBLING of the internal link/button, never inside it, so it is not part of the item's
 *   accessible name and a pointer landing on it does not activate the item. Visually clipped in
 *   `icon-only` mode exactly as `[part="label"]` is, staying available to assistive technology.
 * @slot end - Trailing controls or adornments -- an overflow menu trigger, a status badge. Also a
 *   sibling of the internal link/button (the same shape `<lr-details>` uses for its
 *   `header-actions`), so a slotted control keeps its own click, keyboard activation and focus
 *   order instead of being swallowed by the item's own activation target. Unlike `meta` it stays
 *   visible in `icon-only` mode. Reserve rail width for twice the nav padding plus the icon
 *   square, item gap and end content; a 1.5rem end badge needs 5.5rem at default tokens.
 * @slot children - Nested `<lr-app-rail-item>`s disclosed beneath this item. Rendering anything
 *   into this slot grows a built-in disclosure button (`[part="toggle"]`) as a sibling of
 *   `[part="base"]`; leaving it empty renders neither the disclosure nor `[part="children"]`.
 * @event lr-toggle-request - Cancelable proposal emitted before `expanded` changes from the
 *   built-in disclosure. Call `preventDefault()` to keep the current state, or assign `expanded`
 *   from the listener to resolve it yourself -- a write during the dispatch suppresses the default
 *   commit even when it assigns the value the property already held. Not emitted for a direct
 *   `expanded` write. `detail: LyraAppRailItemToggleDetail` (`{ open: boolean }` -- the field is
 *   named `open`, matching `<lr-app-rail-group>`'s identical event name and detail shape exactly,
 *   so a listener bound to both components' `lr-toggle-request` need not branch on which fired).
 * @event lr-toggle - The item finished expanding or collapsing its `children`. Non-cancelable,
 *   emitted after `expanded` is written, and never emitted for a vetoed or listener-resolved
 *   request. `detail: LyraAppRailItemToggleDetail`.
 * @csspart base - The link or button receiving focus and activation.
 * @csspart icon - The icon wrapper.
 * @csspart label - The label wrapper; visually clipped in icon-only mode.
 * @csspart current-indicator - A decorative inline indicator rendered only while the item is
 *   `current`/`aria-current="page"`, mirroring `<lr-conversation-item>`'s shipped
 *   `active-indicator` part.
 * @csspart meta - The wrapper around the `meta` slot. Hidden while nothing is slotted into it, so
 *   an item without secondary text renders exactly as before the slot existed.
 * @csspart end - The wrapper around the `end` slot, following `[part="meta"]`. Hidden while empty
 *   for the same reason.
 * @csspart toggle - The disclosure control, hidden in icon-only and rendered only with content in
 *   `children`. A sibling of `[part="base"]`, never nested inside it, so activating one never
 *   triggers the other. Carries `aria-expanded` in both states and `aria-controls` pointing at
 *   `[part="children"]`'s id; its accessible name is a localized `this.localize()` template
 *   interpolating this item's own label, with no literal fallback.
 * @csspart toggle-icon - The wrapper around the disclosure chevron. Direction-aware through this
 *   wrapper's own `transform`, never a second mirrored glyph -- mirrors
 *   `<lr-app-rail-group>`'s `[part="toggle-icon"]`.
 * @csspart children - The nested list, hidden in icon-only while preserving expanded. Rendered only while something is
 *   slotted into `children`; hidden (but present, so `aria-controls` keeps resolving) while
 *   `expanded` is `false`.
 * @csspart tooltip - The hover/focus label flyout, only rendered while `tooltip` is set, the item
 *   is `icon-only`, and it is hovered or focused.
 * @cssprop [--lr-app-rail-item-current-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `current`/`aria-current="page"` item. Scoped to `[aria-current='page']` only and declared as an
 *   inline `var()` fallback (never on `:host`), so setting it on the element or an ancestor recolors
 *   only the current item without hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-app-rail-item-current-color=var(--lr-color-brand)] - Text/icon color of the
 *   `current`/`aria-current="page"` item.
 * @cssprop [--lr-app-rail-item-current-font-weight=var(--lr-font-weight-semibold)] - Font weight
 *   of the `current`/`aria-current="page"` item, decoupled from the shared
 *   `--lr-font-weight-semibold` token so retheming it does not repaint every other semibold
 *   element on the page. Mirrors `<lr-stepper>`'s `--lr-stepper-current-font-weight` and
 *   `<lr-segmented>`'s `--lr-segmented-selected-font-weight`.
 * @cssprop [--lr-app-rail-item-current-indicator-color=var(--lr-color-brand)] - Color of the
 *   decorative `[part="current-indicator"]` while current.
 * @cssprop [--lr-app-rail-item-current-indicator-width=var(--lr-size-2px)] - Inline size of
 *   `[part="current-indicator"]` while current.
 * @cssprop [--lr-app-rail-item-current-indicator-inset-inline=0 auto] - Logical inline-start and
 *   inline-end insets for `[part="current-indicator"]`; set `auto 0` to place it at inline-end.
 * @cssprop [--lr-app-rail-item-current-indicator-display] - `[part="current-indicator"]`'s
 *   `display` while `icon-only`. Unset (the default), the indicator is suppressed there -- a
 *   full-height edge bar on the square icon-only tile reads as a rendering glitch. Set to `block`
 *   (or any non-`none` display) to restore it. Full presentation is unaffected either way; its own
 *   `[part="current-indicator"]` rule declares no `display` at all.
 * @cssprop [--lr-app-rail-item-current-ring] - `box-shadow` on `[part="base"]` while
 *   `current`/`aria-current="page"`. Unset, icon-only gets an inset ring by default -- the
 *   non-color-only signal that replaces the indicator bar suppressed there (WCAG 1.4.1); full
 *   presentation, which already conveys current state through the indicator bar and
 *   `--lr-app-rail-item-current-font-weight`, stays ring-free (`none`) by default. Setting this
 *   token explicitly applies the same value in both presentations.
 * @cssprop [--lr-app-rail-item-hover-bg=var(--lr-color-brand-quiet)] - Hover background.
 * @cssprop [--lr-app-rail-item-hover-color=var(--lr-color-brand)] - Hover text/icon color.
 * @cssprop --lr-app-rail-item-active-bg - Pressed background; defaults to the former brand-quiet
 *   active mix.
 * @cssprop [--lr-app-rail-item-active-color=var(--lr-color-brand)] - Pressed text/icon color.
 * @cssprop [--lr-app-rail-item-min-block-size=var(--lr-icon-button-size)] - `[part="base"]`'s row
 *   height. Floor-clamped to `--lr-icon-button-size` regardless of the override, preserving the
 *   WCAG 2.5.8 hit-area minimum.
 * @cssprop [--lr-app-rail-item-padding=var(--lr-space-s)] - `[part="base"]`'s padding.
 * @cssprop [--lr-app-rail-item-gap=var(--lr-space-s)] - Gap between `[part="icon"]` and
 *   `[part="label"]`, and between the item's own control and its `[part="meta"]`/`[part="end"]`
 *   adornments.
 * @cssprop [--lr-app-rail-item-meta-color=var(--lr-color-text-quiet)] - `[part="meta"]`'s text
 *   color; quiet by default so a count reads as secondary to the label beside it.
 * @cssprop [--lr-app-rail-item-meta-font-size=var(--lr-font-size-sm)] - `[part="meta"]`'s
 *   font size.
 * @cssprop [--lr-app-rail-item-icon-size=var(--lr-icon-button-size)] - `[part="icon"]`'s inline
 *   size. Not floor-clamped -- the icon is decorative, not itself a pointer target.
 * @cssprop [--lr-app-rail-item-icon-only-size] - When set, sizes `[part="base"]`'s icon-only
 *   square (`inline-size` and `block-size` alike) directly, independent of the row's own
 *   `--lr-app-rail-item-min-block-size`. Unset (the default), the square is still derived via
 *   `aspect-ratio: 1` against the row's block size, exactly as before. Still floor-clamped to
 *   `--lr-icon-button-size` by `[part="base"]`'s shared `min-block-size` rule.
 * @cssprop [--lr-app-rail-item-font-size=inherit] - `[part="base"]`'s font size, set after the
 *   `font` shorthand so it alone can be retuned while family/weight/line-height stay inherited.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the icon-only
 *   flyout tooltip's `fixed` default, read from computed style when it is (re)positioned. Set it
 *   once on `:root`, a theme, or one clipping ancestor to change every unset rail item beneath it;
 *   an unrecognized value falls back to `fixed`.
 * @cssprop [--lr-app-rail-item-indent=var(--lr-space-l)] - `[part="children"]`'s
 *   `padding-inline-start`. Applied once per nesting level -- a doubly-nested `children` list
 *   compounds two insets automatically, since each level's own `[part="children"]` applies the
 *   token again. Logical, so it mirrors under `dir="rtl"` with no separate rule.
 * @status stable
 * @since 4.0.0
 */
export class LyraAppRailItem extends LyraElement<LyraAppRailItemEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    appRailItemCollapse: LYRA_DEFAULT_appRailItemCollapse,
    appRailItemExpand: LYRA_DEFAULT_appRailItemExpand,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'icon-only'];
  }

  /** Optional destination. Without `href`, the item renders as a button. */
  @property() href = '';

  /** Optional link target. */
  @property() target = '';

  /** Prevents activation while retaining the item in the rail. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Marks this as the destination for the current page/view. Reflects
   *  `aria-current="page"` on `[part="base"]` and drives the active visual
   *  treatment -- the rail has no built-in routing, so the consumer sets
   *  this per item (e.g. by comparing `href` against the current location). */
  @property({ type: Boolean, reflect: true }) current = false;

  /** Opt-in hover/focus flyout showing this item's label text while `icon-only` (set externally by
   *  the parent `<lr-app-rail>` as the viewport narrows) hides it from view -- an explicit,
   *  documented property instead of an unverified cross-browser `::part()` + `::after` + `attr()`
   *  composition. No effect outside icon-only mode, since the label is already visible there.
   *  `false` (the default) reproduces today's exact output. */
  @property({ type: Boolean, reflect: true }) tooltip = false;

  /** Whether this item's `children` are shown. `false` by default -- a nested list expanding
   *  itself on first paint would be a surprising default, and it reproduces exactly what an item
   *  with no `expanded` property rendered before this feature existed. Mirrors
   *  `<lr-app-rail-group>`'s `open` accessor: every write, including one that assigns the value
   *  already held, marks the veto guard so a synchronous `lr-toggle-request` listener resolving
   *  this itself is observed correctly (see {@link VetoWriteGuard}). */
  @property({ type: Boolean, reflect: true })
  get expanded(): boolean {
    return this._expanded;
  }
  set expanded(next: boolean) {
    const old = this._expanded;
    this._expanded = next;
    markVetoGuardWrite(this.toggleGuard);
    this.requestUpdate('expanded', old);
  }
  private _expanded = false;

  private readonly toggleGuard = new VetoWriteGuard();

  @state() private showTooltip = false;
  /** `:empty` cannot see slotted light-DOM content (the wrapper always holds a `<slot>` element),
   *  so emptiness is tracked from `slotchange` the same way `<lr-details>` tracks its own
   *  `header-actions` wrapper. */
  @state() private hasEndSlot = false;
  @state() private hasMetaSlot = false;
  // happy-dom never fires a slot's INITIAL `slotchange` (only a later mutation), so these two
  // are also collected once from `firstUpdated()` -- see `collectInitialSlotAssignment`'s doc.
  @query('slot[name="meta"]') private metaSlot?: HTMLSlotElement;
  @query('slot[name="end"]') private endSlot?: HTMLSlotElement;
  private stopPositioning?: () => void;
  private labelObserver?: MutationObserver;
  private childrenObserver?: MutationObserver;
  private recoverFocusAfterIconOnly = false;
  private semanticFocusRepair?: ComposedFocusRepairSnapshot;
  private focusReturnTarget?: HTMLElement;
  private readonly childrenId = nextId('app-rail-item-children');

  /** Reads the light-DOM `slot` attribute directly rather than a live `assignedNodes()` snapshot
   *  -- the same WebKit-safe pattern `<lr-app-rail>`'s own `onHeaderSlotChange`/`onFooterSlotChange`
   *  use -- so the very first render (before any mutation has ever fired) already renders the
   *  disclosure and `[part="children"]` when the item was authored with children in markup,
   *  with no flash of the childless state. Only ELEMENT children can carry a `slot` attribute, so
   *  reading `this.children` (not `this.childNodes`) already excludes stray text nodes. */
  private get hasChildrenSlotted(): boolean {
    return Array.from(this.children).some((el) => el.getAttribute('slot') === 'children');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.armLabelObserver();
    this.armChildrenObserver();
    this.syncOwnedChildren();
  }

  private armLabelObserver(): void {
    this.labelObserver?.disconnect();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.labelObserver = new MutationObserverCtor(() => {
      if (this.showTooltip) this.requestUpdate();
    });
    this.labelObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  /** Watches the light DOM for a `children`-slotted node being added, removed, or re-slotted, so
   *  `hasChildrenSlotted` (read fresh from `render()`, never cached) triggers a re-render at the
   *  moment the disclosure/`[part="children"]` should appear or disappear -- including the very
   *  first time a consumer appends a nested item after construction. `childList` catches
   *  add/remove; the `subtree`-scoped `slot`-only `attributes` filter catches an existing child
   *  being re-slotted into or out of `children`, mirroring what a real `slotchange` listener would
   *  see for an always-rendered slot (this slot is instead rendered on demand, so there is no
   *  `<slot>` element to listen on while it does not exist). Also re-syncs this item's own
   *  `icon-only` forwarding onto whatever it owns, since either kind of mutation can change which
   *  nodes this item owns. */
  private armChildrenObserver(): void {
    this.childrenObserver?.disconnect();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.childrenObserver = new MutationObserverCtor(() => {
      this.syncOwnedChildren();
      this.requestUpdate();
    });
    this.childrenObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['slot'],
    });
  }

  /** Mirrors this item's own `icon-only` state onto every `<lr-app-rail-item>` it DIRECTLY owns
   *  through `children` -- exactly how `<lr-app-rail-group>`'s `syncOwnedItems()` forwards onto the
   *  items and nested groups it owns. One owner per node: ownership is resolved from the node's
   *  PARENT, never the node itself, so a grandchild's own next sync does not immediately undo a
   *  grandparent's write, and a nested item's own `attributeChangedCallback` cascades the same
   *  forwarding one level further down in turn. Gated on `isConnected` so a detached item stops
   *  claiming ownership of nodes appended to it afterwards. */
  private syncOwnedChildren(): void {
    if (!this.isConnected) return;
    const iconOnly = this.hasAttribute('icon-only');
    const itemTag = tag('app-rail-item');
    for (const node of this.querySelectorAll(itemTag)) {
      if ((node.parentElement?.closest(itemTag) ?? null) !== this) continue;
      node.toggleAttribute('icon-only', iconOnly);
    }
  }

  private onToggleClick = (event: Event): void => {
    // The rail's own nav slot listener closes the mobile overlay on any click reaching it
    // (composed events cross the shadow boundary): toggling a disclosure is not navigation, so it
    // must never trigger that close, unlike activating the link itself.
    event.stopPropagation();
    const next = !this._expanded;
    requestThenCommit({
      requestDetail: { open: next },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-toggle-request', detail, init),
      guard: this.toggleGuard,
      commit: () => {
        this.expanded = next;
        this.emit('lr-toggle', { open: next });
      },
    });
  };

  // Only the default slot's own content counts toward the tooltip text and the disclosure's
  // interpolated {label} -- text incidentally living inside the (decorative) `icon` slot or a
  // nested `children` item shouldn't leak into either. Mirrors `lr-chip`'s `labelText` getter.
  private get labelText(): string {
    return Array.from(this.childNodes)
      .filter((node): node is Text | Element => {
        if (node.nodeType === 3) return true;
        if (node.nodeType !== 1) return false;
        const slot = (node as Element).getAttribute('slot');
        return slot !== 'icon' && slot !== 'children';
      })
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }

  private get tooltipText(): string {
    return hostAriaLabel(this) ?? (this.labelText || '');
  }

  private onFocusShow = (event: Event): void => {
    if (this.tooltip && this.hasAttribute('icon-only')) this.showTooltip = true;
    if (event.type !== 'focus') return;
    const related = (event as FocusEvent).relatedTarget;
    if (related && (related as Node).nodeType === 1 && isComposedFocusAvailable(related as Element)) {
      this.focusReturnTarget = related as HTMLElement;
    }
  };

  private onBlurHide = (): void => {
    this.showTooltip = false;
  };

  private onEndSlotChange = (event: Event): void => {
    this.applyEndSlotPresence(event.target as HTMLSlotElement);
  };

  private applyEndSlotPresence(slot: HTMLSlotElement): void {
    this.hasEndSlot = slot.assignedNodes({ flatten: true }).some(
      (node) => node.nodeType !== 3 || (node.textContent ?? '').trim() !== ''
    );
  }

  private onMetaSlotChange = (event: Event): void => {
    this.applyMetaSlotPresence(event.target as HTMLSlotElement);
  };

  private applyMetaSlotPresence(slot: HTMLSlotElement): void {
    this.hasMetaSlot = slot.assignedNodes({ flatten: true }).some(
      (node) => node.nodeType !== 3 || (node.textContent ?? '').trim() !== ''
    );
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name !== 'icon-only' || oldValue === newValue) return;
    if (newValue === null) this.showTooltip = false;
    else {
      const active = deepActiveElement(this.ownerDocument);
      const toggle = this.renderRoot?.querySelector('[part="toggle"]');
      this.recoverFocusAfterIconOnly = active === toggle ||
        Array.from(this.children).some(child => child.getAttribute('slot') === 'children' && composedContains(child, active));
    }
    this.syncOwnedChildren();
    this.requestUpdate();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // happy-dom (through at least 20.14.5) never fires a slot's INITIAL `slotchange` -- only a
    // later mutation to an already-connected slot -- so `hasEndSlot`/`hasMetaSlot` would otherwise
    // stay `false` forever for an item whose `meta`/`end` children already exist at connect (the
    // ordinary "render once data is ready" Lit pattern). Collect once here too, from each slot's
    // current assignment; `applyEndSlotPresence()`/`applyMetaSlotPresence()` recompute the same
    // boolean from scratch every time, so a real browser also firing the initial event contributes
    // no duplicate side effect. Deferred a microtask for the same reason `select.class.ts`'s own
    // `firstUpdated()` defers: `hasEndSlot`/`hasMetaSlot` are reactive `@state()`, and writing one
    // synchronously here -- after this same update has already been marked complete -- would trip
    // Lit's "scheduled an update after an update completed" dev warning.
    const metaSlot = this.metaSlot;
    const endSlot = this.endSlot;
    queueMicrotask(() => {
      collectInitialSlotAssignment(metaSlot, (s) => this.applyMetaSlotPresence(s));
      collectInitialSlotAssignment(endSlot, (s) => this.applyEndSlotPresence(s));
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('tooltip') && !this.tooltip) this.showTooltip = false;
    if (changed.has('href') || changed.has('disabled')) {
      const previous = this.renderRoot?.querySelector<HTMLElement>('[part="base"]') ?? null;
      const nextIsLink = Boolean(safeLinkHref(this.href)) && !this.disabled;
      const ownerReplaced = previous !== null && (previous.localName === 'a') !== nextIsLink;
      this.semanticFocusRepair = ownerReplaced && activeElementIn(this.shadowRoot) === previous
        ? captureComposedFocusRepair(this, this.focusFallback() ?? previous) ?? undefined
        : undefined;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.recoverFocusAfterIconOnly) {
      this.recoverFocusAfterIconOnly = false;
      this.scheduleAfterUpdate(() => {
        const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
        if (base && isComposedFocusAvailable(base) && !composedContains(base, deepActiveElement(this.ownerDocument))) base.focus();
      }, 'app-rail-item-icon-only-focus');
    }
    const focusRepair = this.semanticFocusRepair;
    this.semanticFocusRepair = undefined;
    if (focusRepair) {
      this.scheduleAfterUpdate(() => {
        const replacement = this.renderRoot.querySelector<HTMLAnchorElement | HTMLButtonElement>(
          '[part="base"]',
        );
        const target = replacement && isComposedFocusAvailable(replacement)
          ? replacement
          : this.focusFallback();
        applyComposedFocusRepair(focusRepair, target);
      }, 'app-rail-item-owner-focus');
    }
    const popup = this.renderRoot.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement | null;
    if (!popup) {
      this.stopPositioning?.();
      this.stopPositioning = undefined;
      return;
    }
    if (changed.has('showTooltip') || !this.stopPositioning) {
      this.stopPositioning?.();
      const anchor = this.renderRoot.querySelector(
        '[part="base"]'
      ) as HTMLElement;
      // 'right' is a physical Floating UI placement -- resolve it through the
      // shared RTL helper (mirrors lr-menu's identical resolution) so the
      // flyout still anchors to the rail item's trailing edge (away from the
      // rail) rather than staying pinned to the physical right under RTL.
      this.stopPositioning = place(anchor, popup, {
        placement: rtlAwarePlacement('right', this),
        strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.semanticFocusRepair = undefined;
    this.focusReturnTarget = undefined;
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.childrenObserver?.disconnect();
    this.childrenObserver = undefined;
    this.stopPositioning?.();
    this.stopPositioning = undefined;
    this.showTooltip = false;
  }

  private focusFallback(): HTMLElement | null {
    if (this.focusReturnTarget && isComposedFocusAvailable(this.focusReturnTarget)) {
      return this.focusReturnTarget;
    }
    const rail = this.closest('lr-app-rail');
    const owner = rail?.shadowRoot?.querySelector<HTMLElement>('[part~="base"], [part~="panel"]') ?? null;
    return owner && isComposedFocusAvailable(owner) ? owner : null;
  }

  /** Activates the internal link or button. Disabled items remain inert. */
  override click(): void {
    if (this.disabled) return;
    this.renderRoot
      .querySelector<HTMLAnchorElement | HTMLButtonElement>('[part~="base"]')
      ?.click();
  }

  override render(): TemplateResult {
    const label = hostAriaLabel(this);
    const href = safeLinkHref(this.href);
    const content = html`
      ${this.current ? html`<span part="current-indicator" aria-hidden="true"></span>` : nothing}
      ${renderInertPresentation(html`<slot name="icon"></slot>`, { part: 'icon' })}
      <span part="label"><slot></slot></span>
    `;
    const tooltip = this.showTooltip && this.tooltip && this.hasAttribute('icon-only')
      ? html`<span part="tooltip" role="tooltip" aria-hidden="true">${this.tooltipText}</span>`
      : nothing;
    // Siblings of the activation target, never children of it: a control slotted here keeps its
    // own click/keyboard activation and focus order, and its text never joins the item's own
    // accessible name. Mirrors <lr-details>'s header-actions placement beside its native summary.
    const adornments = html`<span part="meta" ?hidden=${!this.hasMetaSlot}
        ><slot name="meta" @slotchange=${this.onMetaSlotChange}></slot></span
      ><span part="end" ?hidden=${!this.hasEndSlot}
        ><slot name="end" @slotchange=${this.onEndSlotChange}></slot></span
      >`;
    const hasChildren = this.hasChildrenSlotted;
    // A sibling of [part="base"], never nested inside it -- the link keeps navigating on its own
    // and this keeps toggling on its own (see the class doc). Omitted entirely, not merely
    // hidden, while nothing is slotted into `children`, so an item with no nested items renders
    // no disclosure at all, byte-identical to an item authored before this feature existed.
    const toggle = hasChildren
      ? html`<button
          part="toggle"
          type="button"
          aria-expanded=${this._expanded ? 'true' : 'false'}
          aria-controls=${this.childrenId}
          aria-label=${this.localize(
            this._expanded ? 'appRailItemCollapse' : 'appRailItemExpand',
            undefined,
            { label: this.tooltipText },
          )}
          @click=${this.onToggleClick}
        ><span part="toggle-icon" aria-hidden="true">${chevronIcon()}</span></button>`
      : nothing;
    // Rendered (hidden while collapsed, never removed) only alongside the toggle that controls
    // it, so `aria-controls` always resolves to a real element whenever the toggle exists.
    const childrenList = hasChildren
      ? html`<span part="children" id=${this.childrenId} ?hidden=${!this._expanded}
          ><slot name="children"></slot
        ></span>`
      : nothing;
    const row = href && !this.disabled
      ? html`<a
            part="base"
            href=${href}
            target=${this.target || nothing}
            rel=${this.target ? 'noopener noreferrer' : nothing}
            aria-label=${label ?? nothing}
            aria-disabled="false"
            aria-current=${this.current ? 'page' : 'false'}
            @mouseenter=${this.onFocusShow}
            @mouseleave=${this.onBlurHide}
            @focus=${this.onFocusShow}
            @blur=${this.onBlurHide}
          >${content}</a>${adornments}${toggle}${tooltip}`
      : html`<button
            part="base"
            type="button"
            ?disabled=${this.disabled}
            aria-disabled=${this.disabled ? 'true' : 'false'}
            aria-label=${label ?? nothing}
            aria-current=${this.current ? 'page' : 'false'}
            @mouseenter=${this.onFocusShow}
            @mouseleave=${this.onBlurHide}
            @focus=${this.onFocusShow}
            @blur=${this.onBlurHide}
          >${content}</button>${adornments}${toggle}${tooltip}`;
    // :host lays out as a column of [row, children-list] so `[part="children"]` stacks BELOW the
    // row instead of squeezing into it; the row's own flex/gap/alignment CSS (unchanged from
    // before this feature existed) now lives on this wrapper instead of :host. When `hasChildren`
    // is false, `childrenList` is `nothing` and the row alone reproduces the exact prior layout.
    return html`<div class="row">${row}</div>${childrenList}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-app-rail-item': LyraAppRailItem;
  }
}
