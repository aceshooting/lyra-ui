import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, nextId, resolveAccessibleTrigger } from '../../../internal/a11y.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import {
  acquireAriaOwnership,
  type AriaOwnershipLease,
} from '../../../internal/aria-ownership.js';
import { tag } from '../../../internal/prefix.js';
import type {
  PlaceStrategy,
  PlaceSync,
  VirtualAnchor,
} from '../../../internal/positioner.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { loadAnchoredOverlayRuntime } from '../../../internal/anchored-overlay-runtime.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteDuration, finiteNumber } from '../../../internal/numbers.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  literalSetConverter,
  omittedEmptyStringConverter,
  optionalLiteralSetConverter,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import {
  activateNonmodalOverlay,
  composedContains,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { animateRegistered } from '../../../internal/registered-animation.js';
import { applyOverlayArrow, type LyraArrowPlacement } from './overlay-arrow.js';
import {
  normalizeVirtualRect,
  observeOverlayAnchorIdentity,
  OverlayTransitionGate,
  resolveOverlayAnchor,
  type OverlayVirtualRect,
} from './overlay-shared.js';
import { styles } from './overlay.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel, LYRA_DEFAULT_popover } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware. */
const DEFAULT_DISTANCE = 8;

/** Monotonic connection order makes initial same-root ownership deterministic even when several
 * server-rendered popovers release their hydration guards in different tasks. */
let popoverConnectionSequence = 0;

/** Semantic role vocabulary for a popover surface or mapped trigger contract. */
/**
 * Semantic role a popover's positioned surface takes on.
 *
 * `'none'` is the escape hatch for the WAI-ARIA **disclosure navigation** pattern: a list of links
 * is not an application action menu (`'menu'` announces "menu, menu item" and expects `menuitem`
 * children) and is not an interruptive surface (`'dialog'`). Under `'none'` the popover contributes
 * positioning, light dismiss, and the `aria-expanded`/`aria-controls` wiring the disclosure pattern
 * requires, while the author's own `<nav>`/`<ul>` inside owns the semantics and the accessible
 * name. No `role` and no generated `aria-label` are emitted, and the trigger carries no
 * `aria-haspopup` -- a disclosure button does not own a popup, and `aria-haspopup="none"` is an
 * invalid attribute value that axe flags as a critical violation.
 */
export type LyraPopupRole = 'dialog' | 'menu' | 'none';

const POPUP_ROLE = literalSetConverter<LyraPopupRole>(
  ['dialog', 'menu', 'none'],
  'dialog',
);

/**
 * One keyword of the space-separated `trigger` list -- the same vocabulary, spelled the same way,
 * that `<lr-tooltip>`'s `trigger` accepts, so `trigger="hover focus"` means one thing everywhere in
 * this library.
 *
 * `'click'` is the shipped behaviour and stays the default. `'hover'` and `'focus'` are the two
 * transient modes: they open after `showDelay`, close after `hideDelay` once the interaction ends,
 * never move focus into the surface on their own, and can be *pinned* open by a click on the
 * trigger (a second click releases the pin and closes). `'manual'` refuses every interaction and
 * leaves the surface entirely to `show()`/`hide()`/`open`, and wins over any keyword beside it.
 */
export type LyraPopoverTrigger = 'click' | 'hover' | 'focus' | 'manual';

const POPOVER_TRIGGER_KEYWORDS: readonly LyraPopoverTrigger[] = [
  'click',
  'hover',
  'focus',
  'manual',
];

/**
 * Canonicalizes an authored `trigger` list: keywords are lowercased, unrecognized tokens are
 * dropped, duplicates collapse, and author order is preserved.
 *
 * A list that keeps no recognized keyword resolves to `'click'` rather than to nothing, which is
 * where this deliberately parts company with `<lr-tooltip>`'s identical parse. A tooltip that a
 * typo turned inert loses a hint; a popover is frequently the only way to reach real content, so
 * a typo must not be able to strand it behind `show()`.
 */
function normalizeTriggerList(next: unknown): string {
  const keywords: LyraPopoverTrigger[] = [];
  for (const token of String(next ?? '').trim().toLowerCase().split(/\s+/)) {
    const keyword = POPOVER_TRIGGER_KEYWORDS.find((candidate) => candidate === token);
    if (keyword && !keywords.includes(keyword)) keywords.push(keyword);
  }
  return keywords.length > 0 ? keywords.join(' ') : 'click';
}

/** Both interaction delays default to zero, so adopting a transient trigger never also changes
 *  how promptly a click-driven popover has always responded. */
const DEFAULT_TRIGGER_DELAY = 0;

/** Unsupported values resolve to *absent* rather than to a baked-in member, because each mapped
 *  overlay keeps a different mirrored default and the fallback therefore has to be read off the
 *  instance rather than off the converter. */
const POSITIONING_STRATEGY = optionalLiteralSetConverter<PlaceStrategy>([
  'absolute',
  'fixed',
]);

export type { LyraArrowPlacement, OverlayVirtualRect, PlaceStrategy };

/** The `showAt()` rectangle, shared verbatim with `<lr-tooltip>` (see `./overlay-shared.ts`). */

export interface LyraPopoverEventMap {
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
}

/**
 * `<lr-popover>` — a light-dismiss floating surface, click-triggered by default.
 *
 * `trigger` selects which interaction opens it: `click` (the shipped default), `hover`, `focus`,
 * or `manual`. The two transient modes open after `showDelay`, close after `hideDelay` once the
 * interaction ends, deliberately never move focus into the surface, and keep it open while focus
 * rests anywhere inside it. A click on the trigger while a transient surface is open *pins* it --
 * the pointer may then leave without closing it -- and the next click releases the pin. Set
 * `hover-bridge` to have the positioner clip an invisible quad across the `distance` gap so a
 * pointer travelling from the trigger to the popup never leaves both at once.
 *
 * Interaction/ARIA ownership is resolved separately from positioning. A slotted trigger wins and
 * receives the click listener plus `aria-haspopup`, `aria-expanded`, and `aria-controls`; without
 * one, a live HTML element resolved by `for` owns the same contract. A wrapper/custom trigger's
 * real composed focus target receives the same owned semantics and is the focus-return target. A
 * direct `.anchor` is positioning-only. `showAt()`'s virtual anchor wins positioning and
 * deliberately has no DOM interaction/ARIA owner while active.
 * The component supplies the real shadow popup to the shared relationship controller. Current
 * browsers expose its nearest public shadow host to a light-DOM trigger, keeping the relationship
 * resolvable without pretending a private idref crosses the boundary.
 * Live `popupRole`, host-id, target-id, and target-identity changes keep those relationships
 * synchronized. Losing the sole live positioning anchor force-closes the surface; if a slotted or
 * `for` fallback remains, the popover repositions to it and stays open. A deliberate `showAt()`
 * virtual anchor remains open independently of DOM-anchor removal.
 *
 * Lifecycle: `show()` emits `lr-show` (cancelable) and then `lr-after-show` once the popup's
 * transition has finished; `hide()` emits `lr-hide` (cancelable) then `lr-after-hide`. Assigning
 * `open` runs the same sequence, so the property, the reflected attribute and the two methods can
 * never disagree. Markup that renders open from the start emits nothing.
 * Motion resolves through `popover.show`/`popover.hide` in the public animation registry.
 *
 * Positioning resolves `showAt()` virtual anchor, direct `.anchor`, `for`, then the interaction
 * owner, in that order. Thus `anchor` can position against an element that never receives click or
 * ARIA state, while `for` owns both positioning and interaction only when no trigger is slotted.
 * Activating an enabled, non-inert light-DOM descendant with `data-popover="close"` requests this
 * closest owning popover to close. Nested popovers consume their own close actions.
 *
 * Open popovers, dropdowns and tooltips reposition when their effective host or inherited text direction changes, preserving open state and lifecycle events.
 *
 * @customElement lr-popover
 * @slot trigger - The highest-priority interaction/ARIA owner; toggles the popover even when
 *   positioning uses `anchor` or `for`.
 * @slot - Popover content. An enabled, non-inert descendant with `data-popover="close"` closes its
 *   nearest owning popover when activated.
 * @event lr-show - The popover is about to open. Cancelable — `preventDefault()` keeps it closed.
 * @event lr-after-show - The popover is open and its transition has finished.
 * @event lr-hide - The popover is about to close, for every dismissal path (Escape, light
 *   dismiss, `hide()`, `open = false`). Cancelable — `preventDefault()` keeps it open.
 * @event lr-after-hide - The popover is closed and its transition has finished.
 * @method show - `show(): Promise<void>` — programmatically open and resolve after
 *   `lr-after-show`.
 * @method hide - `hide(options?: { focusTrigger?: boolean }): Promise<void>` — programmatically
 *   close and resolve after `lr-after-hide`. Focus returns to the slotted/`for` interaction owner
 *   by default, matching Escape, light dismiss, and `el.open = false`; pass
 *   `focusTrigger: false` to preserve the current focus instead.
 * @csspart trigger - The trigger wrapper.
 * @csspart hover-bridge - The invisible quad bridging the trigger and the popup, rendered only
 *   while a `hover` popover with `hover-bridge` set is open.
 * @csspart popup - The positioned popup; also carries `dialog` and `popup__popup` aliases.
 * @csspart dialog - Mapped alias on the positioned popup.
 * @csspart popup__popup - Exported popup alias on the positioned popup.
 * @csspart content - The content wrapper; also carries the `body` alias.
 * @csspart body - Mapped alias on the content wrapper.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set. Its part name also
 *   carries the resolved side (`arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right`), so
 *   `::part(arrow arrow-top)` can style one side — state after `::part()` never matches.
 * @csspart popup__arrow - Exported mapped alias on the arrow.
 * @cssprop [--max-width=var(--lr-overlay-max-inline-size,var(--lr-size-20rem))] - Maximum inline
 * size of the popup.
 * @cssprop --lr-overlay-max-inline-size - Retained Lyra fallback for `--max-width`.
 * @cssprop [--arrow-size=var(--lr-overlay-arrow-size,var(--lr-size-0-375rem))] - Half-width of the
 * arrow square.
 * @cssprop --lr-overlay-arrow-size - Retained Lyra fallback for `--arrow-size`.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 *   read by the popup and by its arrow. One declaration on any ancestor retints every overlay in
 *   that subtree without touching the page, card and control surfaces behind them.
 * @cssprop [--lr-overlay-border=var(--lr-color-border-subtle)] - Shared floating-surface edge
 *   colour, on the popup and on the arrow's two outward-facing edges.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius. The
 *   arrow is deliberately excluded: its corners are already cut by its clip path.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of an anchored,
 *   positioner-placed overlay. A separate tier from `--lr-overlay-shadow-modal`, so raising popups
 *   never raises dialogs.
 * @cssprop [--show-duration=var(--lr-duration-fast)] - Opening transition duration.
 * @cssprop [--hide-duration=var(--lr-duration-fast)] - Closing transition duration.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for
 *   {@link positioningStrategy}, read from computed style when the popup is (re)positioned. Set it
 *   once on `:root`, a theme, or one clipping ancestor to change every unset overlay beneath it
 *   without authoring `positioning-strategy`/`hoist` on each instance; an explicit value on the
 *   instance always wins over it.
 * @cssstate open - Present while the popover is open.
 * @status stable
 * @since 4.0.0
 */
export class LyraPopover<Events extends LyraPopoverEventMap = LyraPopoverEventMap> extends LyraElement<Events> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
    popover: LYRA_DEFAULT_popover,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _open = false;
  /** Whether the popover is open. Assigning it runs the full `lr-show`/`lr-hide` lifecycle.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next) && this.canOpen;
    if (normalized === this._open) return;
    // Before the first render this is initial markup state, not a transition.
    if (!this.hasUpdated) {
      this.setOpen(normalized);
      // A consumer can append a closed element and assign `open` in the same task, after
      // connectedCallback's first reconciliation saw no work. Re-run through the same hydration
      // guard so that construction order still decides ownership without changing a server first
      // render.
      if (this.isConnected && this.connectionSequence > 0) {
        this.updateBrowserDerivedState(() => this.reconcileInitialPopoverPeers());
      }
      return;
    }
    if (normalized) void this.show();
    else void this.hide();
  }
  @property({ reflect: true }) placement: Placement = 'top';
  private _positioningStrategy?: PlaceStrategy;
  /**
   * CSS positioning scheme the popup is laid out with -- the one property `<lr-popover>`,
   * `<lr-dropdown>` and `<lr-select>` all spell the same way. `fixed` normally positions against
   * the viewport, so it escapes most clipping ancestors; `absolute` positions against the popup's
   * containing block and scrolls with it. Each component keeps its own mirrored default, so
   * setting nothing on the instance and on every ancestor never changes what it already rendered;
   * an unsupported authored value resolves to that same default. Changes apply live while open.
   * This property reports only the instance's own authored value (or the mirrored default); the
   * popup is actually placed with the `--lr-positioning-strategy` cascading custom property
   * honored ahead of that default when the instance itself sets nothing -- see that `@cssprop`.
   * @default 'fixed'
   */
  @property({
    attribute: 'positioning-strategy',
    reflect: true,
    converter: POSITIONING_STRATEGY,
  })
  get positioningStrategy(): PlaceStrategy {
    return this._positioningStrategy ?? this.defaultPositioningStrategy;
  }
  set positioningStrategy(next: PlaceStrategy) {
    const normalized =
      POSITIONING_STRATEGY.normalize(next) ?? this.defaultPositioningStrategy;
    const old = this.positioningStrategy;
    // Recorded even when it matches the already-resolved value: an author who explicitly writes
    // the mirrored default still authored a value, and `resolveEffectivePositioningStrategy()`
    // (positioning-strategy.ts) has to be able to tell that apart from "unset" -- only "unset"
    // falls through to a cascading `--lr-positioning-strategy` ancestor override.
    this._positioningStrategy = normalized;
    if (normalized === old) return;
    this.requestUpdate('positioningStrategy', old);
    this.onPositioningStrategyChanged(old, normalized);
  }

  /** Mapped subclasses that also publish the retained `hoist` boolean alias keep the two spellings
   *  reflecting together from here; the generic popover has no such alias and does nothing. */
  protected onPositioningStrategyChanged(
    _previous: PlaceStrategy,
    _next: PlaceStrategy,
  ): void {}
  /** Anchor-offset distance (px) passed to Floating UI's `offset()` middleware. Can legitimately
   *  be negative (overlaps the popup with the trigger); NaN/non-finite falls back to the default. */
  @property({ type: Number }) distance = 8;
  /** Offset along the anchor's edge, in pixels — Floating UI's cross-axis offset. */
  @property({ type: Number }) skidding = 0;
  /**
   * Id of an element elsewhere in this popover's own root. It participates in positioning behind
   * a direct `.anchor`; when it resolves to a live HTML element and no trigger is slotted, that
   * element also owns click and ARIA. A slotted trigger still wins interaction ownership, and a
   * `showAt()` virtual anchor wins positioning while suppressing every DOM interaction owner.
   */
  private _for = '';
  @property({ reflect: true, converter: omittedEmptyStringConverter })
  get for(): string {
    return this._for;
  }
  set for(next: string | null) {
    this._for = next ?? '';
  }
  /** Positioning-only element anchor. Takes precedence over `for` and the interaction owner, but
   *  never receives click listeners or generated ARIA. */
  @property({ attribute: false }) anchor: Element | null = null;
  /** Render an arrow that points at the anchor. Defaults on for the mapped surface. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true }) arrow = true;
  /** Positive mapped spelling for suppressing the default arrow. */
  @property({ type: Boolean, attribute: 'without-arrow', reflect: true }) withoutArrow = false;
  /** Where the arrow sits along the popup's edge. `anchor` tracks the anchor's centre. */
  @property({ attribute: 'arrow-placement' }) arrowPlacement: LyraArrowPlacement = 'anchor';
  /** Keeps the arrow this far from the popup's corners, in pixels. */
  @property({ type: Number, attribute: 'arrow-padding' }) arrowPadding = 0;
  private _trigger = 'click';
  /**
   * Space-separated list of the interactions that open the popover -- see
   * {@link LyraPopoverTrigger} for the keywords, which are exactly `<lr-tooltip>`'s. Unrecognized
   * tokens are dropped and a list left with none resolves back to `'click'`, so the property always
   * reads back as a canonical list.
   * @type {string}
   * @default 'click'
   */
  @property()
  get trigger(): string {
    return this._trigger;
  }
  set trigger(next: string) {
    const normalized = normalizeTriggerList(next);
    if (normalized === this._trigger) return;
    const old = this._trigger;
    this._trigger = normalized;
    this.requestUpdate('trigger', old);
  }
  /** The resolved interaction keywords, always at least one. */
  private get triggerKeywords(): Set<string> {
    return new Set(this._trigger.split(' '));
  }
  /** `manual` beats every other keyword: a surface an author declared programmatic must not still
   *  be openable by a stray `hover` left beside it. */
  protected get isManualTrigger(): boolean {
    return this.triggerKeywords.has('manual');
  }
  /** Whether `keyword` is one of the interactions currently allowed to open this popover. */
  protected opensOn(keyword: LyraPopoverTrigger): boolean {
    return !this.isManualTrigger && this.triggerKeywords.has(keyword);
  }
  /** Delay (ms) between a `hover`/`focus` interaction and the popover opening. NaN, negative and
   *  oversized values all normalize through `finiteDuration`.
   *  @default 0 */
  @property({ type: Number, attribute: 'show-delay' }) showDelay = 0;
  /** Delay (ms) between the interaction ending and the popover closing again -- the grace period
   *  that lets a pointer cross the gap to the popup. Normalized like {@link showDelay}.
   *  @default 0 */
  @property({ type: Number, attribute: 'hide-delay' }) hideDelay = 0;
  /**
   * Renders an invisible `[part='hover-bridge']` quad spanning the `distance` gap between the
   * trigger and the popup while a `hover` popover is open, so a pointer travelling between them
   * never leaves both at once and the popover does not close underneath it. Off by default: it is
   * only meaningful for `trigger="hover"`, and a page that keeps `distance` at `0` does not need
   * it.
   * @default false
   */
  @property({ type: Boolean, attribute: 'hover-bridge', reflect: true }) hoverBridge = false;
  /** Accessible name for the semantic popup. An authored host `aria-label` wins by presence,
   *  including an explicitly empty value, before this property or the localized role fallback. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  private _popupRole: LyraPopupRole = 'dialog';
  /** Semantic role used by the popup. `dialog` (default) for a contextual surface, `menu` for an
   *  action menu, or `none` to render no role and no generated name so the slotted content owns
   *  its own semantics -- see `LyraPopupRole` for why a navigation disclosure needs that.
   *  Unsupported attribute values and untyped property writes normalize to `dialog` before the
   *  role or trigger ARIA is rendered.
   *  @default 'dialog' */
  @property({ attribute: 'popup-role', converter: POPUP_ROLE })
  get popupRole(): LyraPopupRole {
    return this._popupRole;
  }
  set popupRole(next: LyraPopupRole) {
    const normalized = POPUP_ROLE.normalize(next);
    if (normalized === this._popupRole) return;
    const old = this._popupRole;
    this._popupRole = normalized;
    this.requestUpdate('popupRole', old);
  }
  private _disabled = false;
  /** Prevents opening the popover -- pointer, keyboard, and programmatic `show()`/`open = true`
   *  are all refused while set. Becoming disabled also closes an already-open popover; initial
   *  `disabled` plus `open` markup/property state normalizes closed in either order. Mirrors
   *  `<lr-tooltip>`'s and `<lr-dropdown>`'s own `disabled`.
   *  @default false */
  @property({ type: Boolean, reflect: true })
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._disabled) return;
    const old = this._disabled;
    this._disabled = normalized;
    this.requestUpdate('disabled', old);
    if (normalized && this.open) {
      if (this.hasUpdated) void this.hide();
      else this.open = false;
    }
  }
  private triggerElement?: HTMLElement;
  private slottedTrigger?: HTMLElement;
  // The named `trigger` slot -- read once from `firstUpdated()` in addition to its own
  // `@slotchange` listener; see `collectInitialSlotAssignment`'s doc.
  @query('slot[name="trigger"]') private triggerSlotElement?: HTMLSlotElement;
  /**
   * True while the surface was opened by a transient `hover`/`focus` interaction rather than a
   * click or a programmatic call. It gates two things: the surface closes again when the
   * interaction ends, and it never pulls focus (`onPopupPositioned()`), because a popover that
   * appeared because the pointer drifted over a trigger must not steal the caret from whatever
   * the user is actually typing into.
   */
  protected openedByInteraction = false;
  /** A click on the trigger pins a `hover`/`focus` popover open: the pointer leaving or focus
   *  moving away stops closing it, and the next click releases the pin and closes. Transient
   *  state -- reset on every close and on disconnect. */
  private pinned = false;
  /** True for exactly as long as a close is handing focus back to the trigger. Without it a
   *  `focus`-triggered popover reopens the instant it closes, because the restoration IS a focusin
   *  on the trigger -- and it reopens from inside `updated()`, which is also what trips Lit's
   *  change-in-update warning. */
  private suppressTriggerFocusOpen = false;
  private delayTimer?: number;
  private delayTimerView?: Window;
  private pendingDirection?: 'show' | 'hide';
  @state() private resolvedSide: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  @state() private anchorPositioned = false;
  /** Removes the settled-closed popup from layout (`[hidden]` -> `display:none`) so its stale
   *  placed coordinates and full slotted-content box stop contributing to whatever ancestor
   *  establishes its CSS containing block. Starts `true` (never-opened popups stay out of
   *  layout), clears as soon as `open` becomes true -- before positioning runs, so the popup is
   *  still a real, measurable box -- and is set back only once the close transition has settled
   *  (`lr-after-hide`), preserving the existing visibility/opacity fade in the meantime. Mirrors
   *  `LyraSelect`'s `listboxHidden`. */
  @state() private popupHidden = true;
  private positionedAnchor?: Element | VirtualAnchor;
  private positioningDirection?: 'ltr' | 'rtl';
  private directionChanged = false;
  private observedDirectAnchor?: Element;
  private observedDirectAnchorWasConnected = false;
  private stopAnchorIdentityObservation?: () => void;
  private triggerAria?: AriaOwnershipLease;
  private accessibleTriggerAria?: AriaOwnershipLease;
  /** The virtual anchor set by `showAt()`, taking priority over `trigger` for positioning while
   *  set. Cleared whenever the popover closes, so a later `open = true` with no fresh `showAt()`
   *  call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the popover, if any -- see
   *  `showAt()`'s doc comment and `activatePopoverOverlay()`'s focus-return configuration. */
  private returnFocusTo?: HTMLElement;
  private cleanup?: () => void;
  private positioningGeneration = 0;
  private positioningReady: Promise<boolean> = Promise.resolve(false);
  private resolvePositioningReady?: (positioned: boolean) => void;
  /** Registered with the shared overlay manager while every popover is open, so one topmost stack
   *  owns Escape and focus restoration. */
  private overlayHandle?: OverlayHandle;
  private readonly generatedHostId = nextId('popover');
  private readonly popupId = nextId('popover-popup');
  private lightDismissDocument?: Document;
  private hostIdObserver?: MutationObserver;
  private hostIdObserverDocument?: Document;
  private hostIdObserverGeneration = 0;
  /** Invalidates an in-flight `lr-after-*` wait when the opposite transition interrupts it. */
  private transitionToken = 0;
  private transitionAnimation?: Animation;
  private readonly transitionGate = new OverlayTransitionGate();
  private connectionSequence = 0;
  private readonly popoverInternals = attachInternalsSafely(this);

  /** Subclass seam for mapped overlays whose public distance default differs from the popover. */
  protected get defaultDistance(): number {
    return DEFAULT_DISTANCE;
  }

  /** The strategy this component resolves to when nothing has been authored. A subclass keeps its
   *  own mirrored default here rather than changing the shared property's meaning. */
  protected get defaultPositioningStrategy(): PlaceStrategy {
    return 'fixed';
  }

  /** The strategy the positioner will use, including an authored same-as-default property value
   *  and the inherited custom-property fallback. Subclasses that change positioning behavior must
   *  use this resolver instead of inferring explicitness from reflected attributes. */
  protected get resolvedPositioningStrategy(): PlaceStrategy {
    return resolveEffectivePositioningStrategy(
      this,
      this._positioningStrategy,
      this.defaultPositioningStrategy,
    );
  }

  /** Positioning hook for mapped overlays that expose Floating UI's sync surface. */
  protected get positioningSync(): PlaceSync | undefined {
    return undefined;
  }

  /** Registry namespace and token fallbacks are override seams for mapped dropdowns. */
  protected get animationNamespace(): string {
    return 'popover';
  }
  protected animationDurationProperties(showing: boolean): readonly string[] {
    return [showing ? '--show-duration' : '--hide-duration', '--lr-duration-fast'];
  }

  /** Additive part aliases for mapped subclasses. `popup`/`content` remain present. */
  protected get popupPartNames(): string {
    const parts = ['popup', 'dialog', 'popup__popup'];
    return parts.join(' ');
  }
  protected get contentPartNames(): string {
    const parts = ['content', 'body'];
    return parts.join(' ');
  }

  /** The role announced by the interaction trigger. Mapped subclasses can keep this semantic
   * invariant even when their positioned wrapper is deliberately presentation-only. */
  protected get triggerPopupRole(): LyraPopupRole {
    return this.popupRole;
  }

  /** Semantic role owned by the positioned surface. Dropdown overrides this because its contained
   * menu is the real role/name owner and the outer element contributes positioning chrome only.
   * `'none'` reaches the same undefined result by author request rather than by subclass. */
  protected get popupSurfaceRole(): LyraPopupRole | undefined {
    return this.popupRole === 'none' ? undefined : this.popupRole;
  }

  /** Resolved popup name, also available to a mapped subclass that delegates role ownership to a
   * contained semantic component. Presence-based host naming preserves an authored empty label. */
  protected get effectivePopupLabel(): string {
    return hostAriaLabel(this) ?? (
      this.accessibleLabel || this.localize(this.triggerPopupRole === 'menu' ? 'menuLabel' : 'popover')
    );
  }

  /** Subclasses can retain a different arrow default without forking rendering/positioning. */
  protected get rendersArrow(): boolean {
    return this.arrow && !this.withoutArrow;
  }

  /** The bridge only exists while a hover popover is actually open: it is a full-viewport element
   *  clipped to the trigger/popup quad, and one left behind while closed would be an invisible
   *  hit-test surface over the page. */
  protected get rendersHoverBridge(): boolean {
    return this.hoverBridge && this.opensOn('hover') && this.open;
  }

  /** Subclass opening invariant, checked for initial property/attribute replay and every later
   * imperative `show()`. A disabled popover is never eligible to open. */
  protected get canOpen(): boolean {
    return !this.disabled;
  }

  /** Generic popovers project their default slot directly. A mapped subclass can insert an owned
   * interaction controller without replacing the trigger/popup shell. */
  protected renderPopupContent(): unknown {
    return html`<slot></slot>`;
  }

  /** Trigger-key extension point. Generic popovers deliberately retain click-only toggling. */
  protected onTriggerKeyDown(_event: KeyboardEvent): void {}

  /** A `for` trigger lives outside the shadow wrapper that normally delegates key events. */
  private onExternalTriggerKeyDown = (event: KeyboardEvent): void => {
    this.onTriggerKeyDown(event);
  };

  /** Lets a mapped subclass include a separate containing element in its dismiss boundary. */
  protected isInsideLightDismissBoundary(path: EventTarget[]): boolean {
    return path.includes(this) || (this.triggerElement != null && path.includes(this.triggerElement));
  }

  /** Runs once when a newly opened/re-anchored popup has completed its first placement and is no
   *  longer visibility-hidden. Focus cannot reliably enter a visibility-hidden subtree in Firefox
   *  or WebKit, so autofocus and mapped menu focus wait for this readiness boundary. */
  protected onPopupPositioned(): void {
    // A hover/focus-opened surface never pulls focus: the user did not ask to go there, and moving
    // the caret out from under them is the exact defect `trigger="hover"` would otherwise ship.
    if (this.openedByInteraction) return;
    this.overlayHandle?.focusAutofocus();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const direction = this.effectiveDirection;
    this.directionChanged = direction !== this.positioningDirection;
    this.positioningDirection = direction;
    const lostDirectAnchorProperty =
      changed.has('anchor')
      && changed.get('anchor') === this.observedDirectAnchor
      && this.observedDirectAnchorWasConnected
      && this.anchor?.isConnected !== true;
    if (lostDirectAnchorProperty && this.open && !this.resolveAnchor()) {
      void this.forceClose({ focusTrigger: false });
    }
    // `anchorPositioned` gates `?data-hidden`, keeping the popup invisible until Floating UI has
    // placed it. Clearing it from `updated()` flipped a `@state` true -> false after the update
    // had completed, which schedules a whole second render for no visible gain and trips Lit's
    // change-in-update warning. On close it is a pure derivation of `open`, so it belongs here,
    // before render: the same render already hides the popup via `!this.open`.
    if (changed.has('open') && !this.open) this.anchorPositioned = false;
    // `popupHidden` gates the settled-closed `[hidden]` attribute. Clearing it here too, before
    // render, rather than from `updated()` (where select.class.ts's own equivalent `listboxHidden`
    // clear lives) avoids scheduling a second render and Lit's change-in-update warning for this
    // component specifically: unlike select's plain reactive `open`, this class routes every open
    // through `setOpen()` while a lifecycle promise is already in flight, and a same-render
    // derivation reveals the popup for positioning exactly as promptly.
    if (changed.has('open') && this.open) this.popupHidden = false;
    // A new anchor is likewise knowable before render: `position()`/`reposition()` runs from
    // `updated()` and clears this the moment it sees the anchor differs from the one it last placed
    // against, which flips the state after the update completed and buys a second render. Deriving
    // it here hides the popup in the *same* render that adopts the new anchor -- also the more
    // correct paint, since the old coordinates are already stale by then.
    if (changed.has('anchor') || changed.has('for')) this.anchorPositioned = false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('trigger')) {
      // A delayed open/close armed under the previous mode is no longer something any interaction
      // asked for, and a pin only means anything to a transient mode.
      this.cancelPendingTransition();
      if (!this.opensOn('hover') && !this.opensOn('focus')) this.pinned = false;
    }
    // Re-arm an already-pending transition against the new delay, so shortening it takes effect on
    // the transition currently waiting rather than only on the next one.
    if (changed.has('showDelay') && this.pendingDirection === 'show') {
      this.requestDelayedTransition(true, true);
    }
    if (changed.has('hideDelay') && this.pendingDirection === 'hide') {
      this.requestDelayedTransition(false, true);
    }
    if (changed.has('for') || changed.has('anchor') || changed.has('open')) {
      this.syncAnchorIdentityObservation();
    }
    if (changed.has('for')) this.syncInteractionTrigger();
    if (
      this.directionChanged ||
      changed.has('open') ||
      changed.has('placement') ||
      changed.has('positioningStrategy') ||
      changed.has('hoverBridge') ||
      changed.has('trigger') ||
      changed.has('distance') ||
      changed.has('skidding') ||
      changed.has('for') ||
      changed.has('anchor') ||
      changed.has('arrow') ||
      changed.has('withoutArrow') ||
      changed.has('arrowPlacement') ||
      changed.has('arrowPadding') ||
      changed.has('popupRole')
    ) {
      if (this.open && this.isConnected) this.positionPopup();
      else if (changed.has('open')) this.invalidatePositioning();
      // Scoped to a real open/close transition -- a placement/distance-only
      // change re-runs this whole block to reposition, but must not toggle the
      // document listener when `open` itself didn't change. The lifecycle
      // events themselves are emitted from show()/hide(), before the state flips.
      if (changed.has('open')) {
        if (this.open) {
          if (this.isConnected) {
            this.startLightDismiss();
            this.activatePopoverOverlay();
          }
        } else {
          // `anchorPositioned` is cleared in willUpdate(); `positionedAnchor` is not reactive.
          this.pinned = false;
          this.openedByInteraction = false;
          this.cancelPendingTransition();
          this.positionedAnchor = undefined;
          this.stopLightDismiss();
          this.suppressTriggerFocusOpen = true;
          try {
            this.overlayHandle?.deactivate();
          } finally {
            this.suppressTriggerFocusOpen = false;
          }
          this.overlayHandle = undefined;
          this.virtualAnchor = undefined;
          this.returnFocusTo = undefined;
          this.syncInteractionTrigger();
        }
      }
      if (this.isConnected) this.syncTriggerA11y();
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // happy-dom (through at least 20.14.5) never fires the named `trigger` slot's INITIAL
    // `slotchange` -- see `collectInitialSlotAssignment`'s own doc -- so a `<lr-popover>` whose
    // slotted trigger already exists at connect (the ordinary "render once data is ready" Lit
    // pattern) would otherwise never bind click/keydown/hover interactions to it: `slottedTrigger`
    // stays `undefined` forever, and `syncInteractionTrigger()` falls through to `resolveForTrigger()`,
    // which only resolves a `for`-id target. Collect once here too, from the slot's current
    // assignment; `collectTriggerFromSlot()` is idempotent, so a real browser firing the initial
    // event as well is a no-op past its own `next === this.slottedTrigger` guard.
    // Deferred a microtask for the same reason `<lr-select>`'s equivalent fix is: calling this
    // synchronously here can, for an already-`open` popover, reach `positionPopup()` and write the
    // reactive `anchorPositioned` state after this same update was already marked complete,
    // tripping Lit's "scheduled an update after an update completed" dev warning. A real
    // `slotchange` event runs this same collection from a task/microtask entirely outside the
    // update cycle, which never trips it; queuing a microtask here reproduces that same
    // "outside the cycle" timing instead of writing state from inside it.
    const slot = this.triggerSlotElement;
    queueMicrotask(() => {
      collectInitialSlotAssignment(slot, (s) => this.collectTriggerFromSlot(s));
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.connectionSequence = ++popoverConnectionSequence;
    // On the host, not the trigger: focus moving OUT of slotted popup content fires `focusout` on
    // that content, which never reaches a listener bound to the trigger element.
    this.addEventListener('focusin', this.onSurfaceFocusIn);
    this.addEventListener('focusout', this.onSurfaceFocusOut);
    // Initial `open` markup is state, not a lifecycle transition, so reconcile it without events.
    // A server-rendered shadow root defers this browser-only ownership decision until after its
    // first hydration render, preserving the server's initial open-state identity.
    this.updateBrowserDerivedState(() => this.reconcileInitialPopoverPeers());
    this.syncAnchorIdentityObservation();
    if (!this.id) this.id = this.generatedHostId;
    this.observeHostId();
    this.syncInteractionTrigger();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so updated() never reruns to
    // notice `open` is still true -- restore the light-dismiss listener and
    // the Floating UI positioner subscription it dropped. No lifecycle event is
    // emitted: reconnecting an already-open popover is not an open transition,
    // and `lr-show` was already announced when `open` became true.
    if (this.hasUpdated && this.open) {
      const wasPreviouslyActivated = this.overlayHandle?.isActive() === true;
      this.startLightDismiss();
      if (wasPreviouslyActivated) this.overlayHandle!.resume();
      else this.activatePopoverOverlay();
      this.popupHidden = false;
      this.positionPopup();
    }
  }
  override disconnectedCallback(): void {
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    this.invalidatePositioning();
    this.stopLightDismiss();
    this.resetHostIdObserver();
    this.overlayHandle?.suspend();
    this.triggerElement?.removeEventListener('click', this.onTriggerClick);
    this.triggerElement?.removeEventListener('keydown', this.onExternalTriggerKeyDown);
    if (this.triggerElement) this.unbindTriggerInteractions(this.triggerElement);
    this.releaseTriggerA11y();
    this.triggerElement = undefined;
    this.removeEventListener('focusin', this.onSurfaceFocusIn);
    this.removeEventListener('focusout', this.onSurfaceFocusOut);
    // Transient interaction state, per the library's reset-on-disconnect rule: a pin taken before
    // a drag-and-drop reparent must not outlive the move and strand the surface open.
    this.cancelPendingTransition();
    this.pinned = false;
    this.openedByInteraction = false;
    // A pending after-event must not announce a transition the detached element left behind.
    this.transitionToken++;
    this.cancelTransitionAnimation();
    this.removeAttribute('data-closing');
    this.popupHidden = true;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    this.resetHostIdObserver();
    this.releaseTriggerA11y();
  }
  private syncAnchorIdentityObservation(): void {
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    // A `for` target can be inserted or replaced while closed and owns interaction, so it remains
    // observable. A direct anchor has no interaction contract and only needs structural tracking
    // while an open surface is actively positioned against it. Slotted triggers use slotchange.
    const directAnchor = this.open ? (this.anchor ?? undefined) : undefined;
    this.observedDirectAnchor = directAnchor;
    this.observedDirectAnchorWasConnected = directAnchor?.isConnected === true;
    if (!this.isConnected || (!this.for && !directAnchor)) return;

    const onIdentityChange = (): void => {
      const directAnchorRemoved =
        this.anchor === this.observedDirectAnchor
        && this.observedDirectAnchorWasConnected
        && this.observedDirectAnchor?.isConnected === false;
      this.observedDirectAnchorWasConnected = this.observedDirectAnchor?.isConnected === true;
      this.syncInteractionTrigger();
      if (!this.open) return;
      const nextAnchor = this.resolveAnchor();
      if (directAnchorRemoved && !nextAnchor) {
        void this.forceClose({ focusTrigger: false });
        return;
      }
      if (nextAnchor !== this.positionedAnchor) this.positionPopup();
    };
    const observedRoots = new Set<Node>([this]);
    if (directAnchor && directAnchor.getRootNode() !== this.getRootNode()) {
      observedRoots.add(directAnchor.isConnected ? directAnchor : directAnchor.ownerDocument);
    }
    const cleanups = [...observedRoots].map((root) =>
      observeOverlayAnchorIdentity(root, onIdentityChange));
    this.stopAnchorIdentityObservation = () => {
      for (const cleanup of cleanups) cleanup();
    };
  }

  private resolveForTrigger(): HTMLElement | undefined {
    if (!this.for) return undefined;
    const root = this.getRootNode() as Document | ShadowRoot;
    const target = root.getElementById?.(this.for) ?? null;
    const HTMLElementCtor = target?.ownerDocument.defaultView?.HTMLElement;
    return target && HTMLElementCtor && target instanceof HTMLElementCtor ? target : undefined;
  }

  private syncInteractionTrigger(): void {
    const next = this.virtualAnchor ? undefined : (this.slottedTrigger ?? this.resolveForTrigger());
    if (next === this.triggerElement) {
      // Re-resolve a custom trigger's real focus target after late upgrade without interpreting an
      // unrelated root mutation as the loss of an initially undistributed declarative trigger.
      this.syncTriggerA11y();
      return;
    }
    this.triggerElement?.removeEventListener('click', this.onTriggerClick);
    this.triggerElement?.removeEventListener('keydown', this.onExternalTriggerKeyDown);
    if (this.triggerElement) this.unbindTriggerInteractions(this.triggerElement);
    this.triggerElement = next;
    if (this.triggerElement && this.triggerElement !== this.slottedTrigger) {
      this.triggerElement.addEventListener('click', this.onTriggerClick);
      this.triggerElement.addEventListener('keydown', this.onExternalTriggerKeyDown);
    }
    // `mouseenter`/`mouseleave` do not bubble, so they bind to the interaction owner itself for
    // BOTH shapes -- a slotted trigger's own node and a `for` target alike. The shadow
    // `[part="trigger"]` wrapper cannot stand in for it: a `for` trigger is not inside it at all.
    // `focusin`/`focusout` DO bubble, but only within the tree they happen in, so the same call
    // adds them for an out-of-host `for` target (see triggerNeedsOwnFocusListeners()).
    if (this.triggerElement) this.bindTriggerInteractions(this.triggerElement);
    this.syncTriggerA11y();
    if (this.open) {
      if (!this.resolveAnchor()) {
        void this.forceClose({ focusTrigger: false });
        return;
      }
      this.updatePopoverRestoreFocusTarget();
      this.positionPopup();
    }
  }
  /** Registers every open popover with the shared, topmost-stack-aware overlay manager. Popovers
   *  remain nonmodal and non-focus-trapping; the manager owns Escape and restoration to the
   *  trigger (or a virtual anchor's explicit `returnFocusTo`). */
  private activatePopoverOverlay(): void {
    if (!this.isConnected || this.overlayHandle?.isActive()) return;
    this.overlayHandle = activateNonmodalOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part~="popup"]') as HTMLElement | null,
      onEscape: () => void this.hide(),
      restoreFocusTo: this.virtualAnchor ? (this.returnFocusTo ?? null) : this.accessibleTrigger,
    });
  }

  /** Updates the eventual focus-return target without changing this popover's overlay-stack
   *  identity. Re-registering would promote an underlying popover above a newer overlay and, when
   *  this popover is already topmost, briefly move focus into the overlay underneath. */
  private updatePopoverRestoreFocusTarget(): void {
    const target = this.virtualAnchor ? (this.returnFocusTo ?? null) : this.accessibleTrigger;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.updateRestoreFocusTo(target);
      return;
    }
    this.activatePopoverOverlay();
  }
  /**
   * Opens the popover anchored to an arbitrary rectangle instead of any DOM anchor -- for
   * anchoring to a graph node, a canvas pixel, a chart datum, or any other non-DOM location.
   * `width`/`height` default to `0` (a point). Positions exactly as `place()` would against a real
   * element (flip/shift/RTL all apply unchanged).
   *
   * A virtual anchor has no DOM node, so `autoUpdate()` can't track it moving on its own -- call
   * `showAt()` again with fresh coordinates to re-anchor an already-open popover (e.g. on a graph
   * pan/zoom tick); the popover stays open across such a call, it does not toggle. Pass
   * `rect.contextElement` (a real, still-connected element near the virtual point) when available
   * so `autoUpdate()` has something to observe for ancestor-scroll/resize tracking; omitting it
   * still works, it just means only explicit re-`showAt()` calls keep the popover anchored.
   *
   * While the virtual anchor is active, no slotted/`for` element owns click or generated ARIA.
   * A virtual anchor also has no `.focus()`. Escape, light dismiss, and programmatic close return
   * focus to `options.returnFocusTo` when supplied, or skip focus-return entirely otherwise --
   * refocusing the right place after a virtual anchor closes is the host's responsibility, since
   * Lyra can't assume how e.g. a graph node's own keyboard model wants focus back.
   * Non-finite coordinates or dimensions are ignored and leave the current open/anchor state
   * unchanged.
   */
  showAt(
    rect: OverlayVirtualRect,
    options?: { returnFocusTo?: HTMLElement },
  ): void {
    const normalizedRect = normalizeVirtualRect(rect);
    if (!normalizedRect) return;
    const previousAnchor = this.virtualAnchor;
    const previousReturnFocusTo = this.returnFocusTo;
    const bounds = new DOMRect(
      normalizedRect.x,
      normalizedRect.y,
      normalizedRect.width,
      normalizedRect.height,
    );
    this.virtualAnchor = {
      getBoundingClientRect: () => bounds,
      contextElement: normalizedRect.contextElement,
    };
    this.returnFocusTo = options?.returnFocusTo;
    this.syncInteractionTrigger();
    if (this.open) {
      this.updatePopoverRestoreFocusTarget();
      this.positionPopup();
      return;
    }
    void this.show();
    if (this.open) return;
    this.virtualAnchor = previousAnchor;
    this.returnFocusTo = previousReturnFocusTo;
    this.syncInteractionTrigger();
  }
  /** Resolves what the popup is positioned against: an explicit virtual anchor first, then the
   *  direct `anchor`, then the `for` idref, then the slotted trigger. Shared with `<lr-tooltip>`,
   *  which resolves the identical chain. */
  private resolveAnchor(): Element | VirtualAnchor | null {
    return resolveOverlayAnchor(this, {
      virtualAnchor: this.virtualAnchor,
      anchor: this.anchor,
      for: this.for,
      trigger: this.triggerElement,
    });
  }
  protected positionPopup(): void {
    this.invalidatePositioning();
    const popup = this.renderRoot.querySelector('[part~="popup"]') as HTMLElement | null;
    const arrowElement = this.renderRoot.querySelector('[part~="arrow"]') as HTMLElement | null;
    const bridgeElement = this.renderRoot.querySelector('[part~="hover-bridge"]') as HTMLElement | null;
    const anchor = this.resolveAnchor();
    if (!this.open || !anchor || !popup) {
      this.positionedAnchor = undefined;
      this.anchorPositioned = false;
      return;
    }
    if (anchor !== this.positionedAnchor) {
      this.anchorPositioned = false;
    }
    const generation = this.positioningGeneration;
    this.positioningReady = new Promise<boolean>((resolve) => {
      this.resolvePositioningReady = resolve;
    });
    void this.startPositioning(generation, anchor, popup, arrowElement, bridgeElement);
  }

  private invalidatePositioning(): void {
    this.positioningGeneration++;
    this.cleanup?.();
    this.cleanup = undefined;
    this.resolvePositioningReady?.(false);
    this.resolvePositioningReady = undefined;
  }

  private resolveCurrentPositioning(positioned: boolean): void {
    const resolve = this.resolvePositioningReady;
    this.resolvePositioningReady = undefined;
    resolve?.(positioned);
  }

  private async startPositioning(
    generation: number,
    anchor: Element | VirtualAnchor,
    popup: HTMLElement,
    arrowElement: HTMLElement | null,
    bridgeElement: HTMLElement | null,
  ): Promise<void> {
    try {
      const { place } = await loadAnchoredOverlayRuntime();
      if (
        generation !== this.positioningGeneration ||
        !this.open ||
        !this.isConnected ||
        this.resolveAnchor() !== anchor ||
        this.renderRoot.querySelector('[part~="popup"]') !== popup
      ) {
        return;
      }
      const cleanup = place(anchor, popup, {
        placement: rtlAwarePlacement(this.placement, this),
        strategy: this.resolvedPositioningStrategy,
        offset: finiteNumber(this.distance, this.defaultDistance),
        skidding: finiteNumber(this.skidding, 0),
        sync: this.positioningSync,
        arrow: this.rendersArrow && arrowElement ? arrowElement : undefined,
        arrowPadding: Math.max(0, finiteNumber(this.arrowPadding, 0)),
        hoverBridge: this.rendersHoverBridge && bridgeElement ? bridgeElement : undefined,
        onPlaced: ({ placement, arrow }) => {
          if (generation !== this.positioningGeneration) return;
          const becamePositioned = !this.anchorPositioned || this.positionedAnchor !== anchor;
          this.positionedAnchor = anchor;
          this.anchorPositioned = true;
          // onPopupPositioned()'s whole contract is "the popup is no longer visibility-hidden" --
          // true the instant this callback ran when data-hidden was removed imperatively here, but
          // anchorPositioned reactively driving that removal now defers it to Lit's own update.
          // Wait for that update to actually commit before handing off to focus-dependent callers.
          const side = applyOverlayArrow(arrowElement, {
            placement,
            coords: arrow,
            enabled: this.rendersArrow,
            arrowPlacement: this.arrowPlacement,
            arrowPadding: Math.max(0, finiteNumber(this.arrowPadding, 0)),
            rtl: this.effectiveDirection === 'rtl',
            sizeProperty: '--arrow-size',
            fallbackSizeProperty: '--lr-overlay-arrow-size',
          });
          if (side !== this.resolvedSide) this.resolvedSide = side;
          void this.updateComplete.then(() => {
            if (
              generation !== this.positioningGeneration ||
              !this.open ||
              this.resolveAnchor() !== anchor
            ) {
              return;
            }
            this.resolveCurrentPositioning(true);
            if (becamePositioned) this.onPopupPositioned();
          });
        },
      });
      if (generation !== this.positioningGeneration) cleanup();
      else this.cleanup = cleanup;
    } catch {
      if (generation !== this.positioningGeneration) return;
      this.resolveCurrentPositioning(false);
      void this.forceClose({ focusTrigger: false });
    }
  }
  private syncTriggerA11y(): void {
    const trigger = this.triggerElement ?? null;
    // SSR/hydration shims can connect the host before Lit establishes a render root. The trigger
    // still receives its state immediately; the first completed render resynchronizes `controls`
    // to the real popup without reading through an unavailable root during upgrade.
    const renderRoot = this.renderRoot as ShadowRoot | undefined;
    const popup = renderRoot?.querySelector<HTMLElement>('[part~="popup"]') ?? null;
    const contribution = {
      attributes: {
        // A null value is skipped by the ARIA lease, so `'none'` leaves any author-written
        // aria-haspopup on the trigger untouched instead of stamping an invalid literal 'none'.
        'aria-haspopup': this.triggerPopupRole === 'none' ? null : this.triggerPopupRole,
        'aria-expanded': this.open ? 'true' : 'false',
      },
      controls: popup ? [popup] : [],
    };
    if (this.triggerAria) this.triggerAria.update(trigger, contribution);
    else this.triggerAria = acquireAriaOwnership(trigger, contribution);

    const accessibleTrigger = this.accessibleTrigger;
    const distinctAccessibleTrigger = accessibleTrigger !== trigger ? accessibleTrigger : null;
    if (this.accessibleTriggerAria) {
      this.accessibleTriggerAria.update(distinctAccessibleTrigger, contribution);
    } else {
      this.accessibleTriggerAria = acquireAriaOwnership(distinctAccessibleTrigger, contribution);
    }
    if (this.overlayHandle?.isActive() && !this.virtualAnchor) {
      this.overlayHandle.updateRestoreFocusTo(accessibleTrigger);
    }
  }

  private get accessibleTrigger(): HTMLElement | null {
    return this.triggerElement ? resolveAccessibleTrigger(this.triggerElement) : null;
  }

  private releaseTriggerA11y(): void {
    this.accessibleTriggerAria?.release();
    this.accessibleTriggerAria = undefined;
    this.triggerAria?.release();
    this.triggerAria = undefined;
  }
  private onTriggerSlotChange = (event: Event): void => {
    this.collectTriggerFromSlot(event.target as HTMLSlotElement);
  };

  /**
   * Reads the named `trigger` slot's currently assigned element and applies it -- wired as the
   * `slotchange` handler (via `onTriggerSlotChange`) for every later mutation, and called once
   * more from `firstUpdated()` (see `collectInitialSlotAssignment`) to cover an environment, or a
   * real-browser timing race, where the slot's initial assignment never fires `slotchange`.
   * Idempotent: a second call that reads back the same assigned element is a no-op past the
   * `next === this.slottedTrigger` guard.
   */
  private collectTriggerFromSlot(slot: HTMLSlotElement): void {
    const next = slot.assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (next === this.slottedTrigger) return;
    this.slottedTrigger = next;
    this.syncInteractionTrigger();
  }
  private onTriggerClick = (): void => {
    if (this.virtualAnchor) return;
    this.syncTriggerA11y();
    if (this.isManualTrigger) return;
    this.cancelPendingTransition();
    if (this.opensOn('click')) {
      if (this.open) void this.hide();
      else void this.show();
      return;
    }
    // Transient modes: a click PINS the surface rather than toggling it, so a user who has found
    // the content they wanted can stop holding the pointer still. The next click releases it.
    if (this.open && this.pinned) {
      void this.hide();
      return;
    }
    this.pinned = true;
    this.openedByInteraction = false;
    if (!this.open) void this.show();
  };

  private onTriggerPointerEnter = (): void => {
    if (!this.opensOn('hover')) return;
    this.requestDelayedTransition(true);
  };

  private onTriggerPointerLeave = (event: MouseEvent): void => {
    if (!this.opensOn('hover')) return;
    this.requestInteractionClose(event.relatedTarget);
  };

  private onPopupPointerEnter = (): void => {
    if (!this.opensOn('hover') || !this.open) return;
    this.cancelPendingTransition();
  };

  private onPopupPointerLeave = (event: MouseEvent): void => {
    if (!this.opensOn('hover')) return;
    this.requestInteractionClose(event.relatedTarget);
  };

  private onSurfaceFocusIn = (): void => {
    if (!this.opensOn('focus') || this.suppressTriggerFocusOpen) return;
    this.requestDelayedTransition(true);
  };

  private onSurfaceFocusOut = (event: FocusEvent): void => {
    if (!this.opensOn('focus')) return;
    this.requestInteractionClose(event.relatedTarget);
  };

  /** The shared "the interaction that was holding this open has ended" path. Retention beats
   *  closing: a pinned surface, a pointer/focus target still inside the trigger or the popup, and
   *  focus resting anywhere within the surface each keep it open. */
  private requestInteractionClose(next: EventTarget | null): void {
    if (this.pinned) return;
    if (this.isWithinPopoverSurface(next)) return;
    if (this.hasFocusWithinSurface()) return;
    this.requestDelayedTransition(false);
  }

  /** Whether `target` is the trigger, the popup, or anything inside either -- across slots and the
   *  shadow boundary, which a plain `contains()` cannot see. */
  private isWithinPopoverSurface(target: EventTarget | null): boolean {
    if (target === null || (target as Node).nodeType !== 1) return false;
    const element = target as Element;
    if (composedContains(this, element)) return true;
    const popup = this.renderRoot?.querySelector<HTMLElement>('[part~="popup"]') ?? null;
    if (popup && composedContains(popup, element)) return true;
    return this.triggerElement != null && composedContains(this.triggerElement, element);
  }

  /**
   * Whether focus is resting somewhere that should keep a transient surface open.
   *
   * The TRIGGER is deliberately excluded. Focus lands there routinely without the user asking --
   * a click that pinned the surface, and every close path that restores focus to it -- so counting
   * it as retention would leave a `hover` popover that can never close once it has been clicked.
   * Only focus inside the popup (or the host's own slotted content) is a reason to stay.
   */
  private hasFocusWithinSurface(): boolean {
    const active = activeElementIn(this.ownerDocument);
    if (active === null) return false;
    if (this.triggerElement && composedContains(this.triggerElement, active)) return false;
    return this.isWithinPopoverSurface(active);
  }

  /**
   * Runs `show()`/`hide()` after the matching delay, replacing whatever was already pending.
   *
   * `deferImmediate` keeps a zero (or negative) delay off the *current* task instead of committing
   * inline. Every interaction path wants the inline commit -- a zero-delay hover must open in the
   * same turn the pointer arrived. The one caller that must not is `updated()`'s delay re-arm:
   * committing there writes `open` from inside an update, which is the Lit change-in-update the
   * combobox's own `refreshQueued` branch exists to avoid.
   */
  private requestDelayedTransition(next: boolean, deferImmediate = false): void {
    this.cancelPendingTransition();
    if (next && !this.canOpen) return;
    const commit = (): void => {
      if (next) {
        this.openedByInteraction = true;
        void this.show();
      } else {
        void this.hide();
      }
    };
    const delay = Math.max(
      0,
      finiteDuration(next ? this.showDelay : this.hideDelay, DEFAULT_TRIGGER_DELAY),
    );
    const view = this.ownerDocument.defaultView;
    if (!view || (delay <= 0 && !deferImmediate)) {
      commit();
      return;
    }
    this.pendingDirection = next ? 'show' : 'hide';
    this.delayTimerView = view;
    const timer = view.setTimeout(() => {
      if (this.delayTimerView !== view || this.delayTimer !== timer) return;
      this.delayTimer = undefined;
      this.delayTimerView = undefined;
      this.pendingDirection = undefined;
      commit();
    }, delay);
    this.delayTimer = timer;
  }

  private cancelPendingTransition(): void {
    if (this.delayTimer !== undefined) this.delayTimerView?.clearTimeout(this.delayTimer);
    this.delayTimer = undefined;
    this.delayTimerView = undefined;
    this.pendingDirection = undefined;
  }

  /** Whether `trigger` needs its OWN focus listeners. `focusin`/`focusout` bubble, so a trigger
   *  that sits inside this host (the slotted shape) already reaches the host-level pair bound in
   *  `connectedCallback()`; a `for` target lives outside the host entirely and would otherwise
   *  never deliver a focus event to this popover at all. Binding both would double-fire the
   *  handler, so the containment test -- not just `!== slottedTrigger` -- decides. */
  private triggerNeedsOwnFocusListeners(trigger: HTMLElement): boolean {
    return !composedContains(this, trigger);
  }

  private bindTriggerInteractions(trigger: HTMLElement): void {
    trigger.addEventListener('mouseenter', this.onTriggerPointerEnter);
    trigger.addEventListener('mouseleave', this.onTriggerPointerLeave);
    if (!this.triggerNeedsOwnFocusListeners(trigger)) return;
    trigger.addEventListener('focusin', this.onSurfaceFocusIn);
    trigger.addEventListener('focusout', this.onSurfaceFocusOut);
  }

  private unbindTriggerInteractions(trigger: HTMLElement): void {
    trigger.removeEventListener('mouseenter', this.onTriggerPointerEnter);
    trigger.removeEventListener('mouseleave', this.onTriggerPointerLeave);
    // Unconditionally removed: the trigger may have been reparented into or out of this host since
    // it was bound, and removing a listener that was never added is a no-op.
    trigger.removeEventListener('focusin', this.onSurfaceFocusIn);
    trigger.removeEventListener('focusout', this.onSurfaceFocusOut);
  }
  private onPopupClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    const path = event.composedPath();
    const hostIndex = path.indexOf(this);
    if (hostIndex < 0) return;
    const closeAction = path.slice(0, hostIndex).find(
      (target): target is HTMLElement =>
        (target as Node).nodeType === 1
        && (target as HTMLElement).getAttribute('data-popover') === 'close',
    );
    if (!closeAction) return;
    // The closest owning surface consumes the declarative action even when its own hide is vetoed;
    // an ancestor popover must never interpret the same activation as its close request.
    event.stopPropagation();
    const state = closeAction as HTMLElement & { disabled?: boolean; effectiveDisabled?: boolean };
    if (
      state.effectiveDisabled === true
      || state.disabled === true
      || closeAction.hasAttribute('disabled')
      || closeAction.getAttribute('aria-disabled')?.trim().toLowerCase() === 'true'
      || closeAction.hasAttribute('inert')
      || closeAction.closest('[inert]')
    ) return;
    void this.hide();
  };
  private onDocumentPointer = (event: PointerEvent): void => {
    if (!this.overlayHandle?.isTopmost()) return;
    if (!this.isInsideLightDismissBoundary(event.composedPath())) void this.hide();
  };

  private startLightDismiss(): void {
    const nextDocument = this.ownerDocument;
    if (this.lightDismissDocument === nextDocument) return;
    this.stopLightDismiss();
    nextDocument.addEventListener('pointerdown', this.onDocumentPointer);
    this.lightDismissDocument = nextDocument;
  }

  private stopLightDismiss(): void {
    this.lightDismissDocument?.removeEventListener('pointerdown', this.onDocumentPointer);
    this.lightDismissDocument = undefined;
  }

  private observeHostId(): void {
    const ownerDocument = this.ownerDocument;
    if (this.hostIdObserver && this.hostIdObserverDocument === ownerDocument) return;
    this.resetHostIdObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor || !this.isConnected) return;
    const generation = this.hostIdObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.hostIdObserver !== observer ||
        this.hostIdObserverDocument !== ownerDocument ||
        this.hostIdObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      if (!this.id) this.id = this.generatedHostId;
      this.syncTriggerA11y();
    });
    this.hostIdObserver = observer;
    this.hostIdObserverDocument = ownerDocument;
    observer.observe(this, { attributes: true, attributeFilter: ['id'] });
  }

  private resetHostIdObserver(): void {
    this.hostIdObserverGeneration += 1;
    this.hostIdObserver?.disconnect();
    this.hostIdObserver = undefined;
    this.hostIdObserverDocument = undefined;
  }

  private setOpen(next: boolean): void {
    if (this._open === next) return;
    const old = this._open;
    this._open = next;
    setCustomState(this.popoverInternals, 'open', next);
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property; Lit only
   *  reflects properties it saw change. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  /** Open the popover. Emits `lr-show` first — vetoing it leaves the popover closed — and
   *  `lr-after-show` once the popup's transition has finished. */
  show(): Promise<void> {
    if (this._open || !this.canOpen) return Promise.resolve();
    return this.transitionGate.request(true, () => {
      if (this.emitCancelableLifecycle('lr-show').defaultPrevented) {
        this.syncOpenAttribute();
        return;
      }
      if (!this.closePopoverPeers()) {
        this.syncOpenAttribute();
        return;
      }
      this.cancelTransitionAnimation();
      this.removeAttribute('data-closing');
      this.setOpen(true);
      return this.settleTransition('lr-after-show');
    });
  }

  /** Programmatically close the popover and return focus to its trigger by default, matching
   *  Escape, light dismiss, and a bare `el.open = false`. Pass `{ focusTrigger: false }` to opt
   *  out and leave focus where it is. Virtual anchors restore their explicit `returnFocusTo`.
   *  Emits `lr-hide` first — vetoing it leaves the popover open — then `lr-after-hide`. */
  hide(options?: { focusTrigger?: boolean }): Promise<void> {
    if (!this._open) return Promise.resolve();
    return this.transitionGate.request(false, () => {
      if (this.emitCancelableLifecycle('lr-hide').defaultPrevented) {
        this.syncOpenAttribute();
        return;
      }
      return this.forceClose(options);
    });
  }

  /** Generic DOM-anchored popovers are a same-root singleton. Dropdown subclasses and virtual
   * `showAt()` surfaces are intentionally outside that contract. A peer veto leaves the newcomer
   * closed; focus never jumps through the retiring peer's trigger during the handoff. */
  private closePopoverPeers(): boolean {
    if (this.virtualAnchor || this.localName !== tag('popover')) return true;
    const root = this.getRootNode() as Document | ShadowRoot;
    for (const peer of root.querySelectorAll<LyraPopover>(tag('popover'))) {
      if (peer === this || !peer.open || peer.virtualAnchor) continue;
      void peer.hide({ focusTrigger: false });
      if (peer.open) return false;
    }
    return true;
  }

  /** Reconciles initially open public popovers after connection without inventing a show/hide
   * lifecycle. The most recently connected peer owns the root; mapped dropdowns, virtual
   * surfaces, and peers in another document/shadow root remain independent. */
  private reconcileInitialPopoverPeers(): void {
    if (
      !this.isConnected ||
      !this._open ||
      this.virtualAnchor ||
      this.localName !== tag('popover')
    ) {
      return;
    }
    const root = this.getRootNode() as Document | ShadowRoot;
    const peers = [...root.querySelectorAll<LyraPopover>(tag('popover'))].filter((peer) =>
      peer.isConnected &&
      peer._open &&
      !peer.virtualAnchor &&
      peer.connectionSequence > 0
    );
    const winner = peers.reduce<LyraPopover | undefined>((latest, peer) =>
      !latest || peer.connectionSequence > latest.connectionSequence ? peer : latest,
    undefined);
    if (winner !== this) {
      this.closeForInitialPeerReconciliation();
      return;
    }
    for (const peer of peers) {
      if (peer !== this) peer.closeForInitialPeerReconciliation();
    }
  }

  /** Structurally retires superseded initial markup. This deliberately skips every lifecycle
   * event and focus restoration because no user-initiated open transition occurred. */
  private closeForInitialPeerReconciliation(): void {
    if (!this._open) return;
    this.transitionToken++;
    this.cancelTransitionAnimation();
    this.removeAttribute('data-closing');
    this.invalidatePositioning();
    this.stopLightDismiss();
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.positionedAnchor = undefined;
    this.anchorPositioned = false;
    this.returnFocusTo = undefined;
    this.setOpen(false);
    this.syncOpenAttribute();
  }

  /** The close half of `hide()` without the veto point, for structural teardown that leaves an
   *  open surface with no live positioning anchor. */
  private forceClose(options?: { focusTrigger?: boolean }): Promise<void> {
    if (!this._open) return Promise.resolve();
    if (options?.focusTrigger === false) {
      this.overlayHandle?.deactivate({ restoreFocus: false });
      this.overlayHandle = undefined;
    }
    this.cancelTransitionAnimation();
    if (this.isConnected) this.setAttribute('data-closing', '');
    this.setOpen(false);
    return this.settleTransition('lr-after-hide');
  }

  private cancelTransitionAnimation(): void {
    this.transitionAnimation?.cancel();
    this.transitionAnimation = undefined;
  }

  /**
   * `emit()` pinned to this class's own base event map.
   *
   * `Events` is a type parameter here so `<lr-dropdown>` can widen the map, which leaves
   * `LyraEmitArgs<Events, K>` an unresolved conditional type that no concrete argument list can be
   * checked against. The `Events extends LyraPopoverEventMap` constraint already guarantees these
   * four lifecycle events keep their detail-less shape, so resolve them against the base map.
   */
  private emitCancelableLifecycle(
    name: 'lr-show' | 'lr-hide',
  ): CustomEvent<null> {
    return (this as LyraPopover<LyraPopoverEventMap>).emit(name, null, { cancelable: true });
  }

  private emitSettledLifecycle(
    name: 'lr-after-show' | 'lr-after-hide',
  ): CustomEvent<null> {
    return (this as LyraPopover<LyraPopoverEventMap>).emit(name);
  }

  /** Resolves once the registry-backed popup animation has finished, then emits the matching
   * `lr-after-*` event. A disabled registration retains the lifecycle without native motion. */
  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (event === 'lr-after-show') {
      while (this.open && !this.anchorPositioned) {
        const readiness = this.positioningReady;
        const positioned = await readiness;
        if (this.transitionToken !== token) return;
        if (positioned) break;
        if (readiness === this.positioningReady) return;
      }
      await this.updateComplete;
      if (this.transitionToken !== token) return;
    }
    if (this.isConnected) {
      const popup = this.renderRoot.querySelector<HTMLElement>('[part~="popup"]');
      const showing = event === 'lr-after-show';
      const offset = 'translateY(var(--lr-size-neg-0-25rem))';
      const animation = popup
        ? animateRegistered(
            this,
            popup,
            `${this.animationNamespace}.${showing ? 'show' : 'hide'}`,
            this.effectiveDirection,
            {
              keyframes: showing
                ? [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'translateY(0)' }]
                : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: offset }],
              durationProperties: this.animationDurationProperties(showing),
              easingProperties: ['--lr-easing-standard'],
            },
          )
        : undefined;
      this.transitionAnimation = animation;
      await animation?.finished.catch(() => undefined);
      if (this.transitionToken !== token) return;
      this.cancelTransitionAnimation();
    }
    if (event === 'lr-after-hide') {
      this.removeAttribute('data-closing');
      // Settled closed: remove the popup from layout now that its exit transition has finished
      // playing, so a stale placed box can no longer inflate an ancestor's scrollable overflow.
      this.popupHidden = true;
      await this.updateComplete;
      if (this.transitionToken !== token) return;
    }
    this.emitSettledLifecycle(event);
  }

  override render(): TemplateResult {
    const popupRole = this.popupSurfaceRole;
    return html`
      <span part="trigger" @click=${this.onTriggerClick} @keydown=${this.onTriggerKeyDown}>
        <slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot>
      </span>
      ${this.rendersHoverBridge
        ? html`<span part="hover-bridge" aria-hidden="true"></span>`
        : nothing}
      <div id=${this.popupId} part=${this.popupPartNames} role=${popupRole ?? nothing}
        aria-label=${popupRole ? this.effectivePopupLabel : nothing}
        ?hidden=${this.popupHidden}
        ?data-hidden=${!this.open || !this.anchorPositioned} ?data-has-arrow=${this.rendersArrow}
        @mouseenter=${this.onPopupPointerEnter} @mouseleave=${this.onPopupPointerLeave}
        @click=${this.onPopupClick}>
        <div part=${this.contentPartNames}>${this.renderPopupContent()}</div>
        ${this.rendersArrow
          ? html`<span part="arrow popup__arrow arrow-${this.resolvedSide}"></span>`
          : nothing}
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-popover': LyraPopover; } }
