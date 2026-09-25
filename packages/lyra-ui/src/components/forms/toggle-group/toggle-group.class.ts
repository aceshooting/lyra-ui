import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement, type LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import {
  normalizeReflectedOptionalSize,
  optionalSizeConverter,
  type LyraSize,
} from '../../../internal/variants.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { literalSetConverter, optionalLiteralSetConverter } from '../../../internal/converters.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  isAccessibilitySubtreeExcluded,
  isAriaTrue,
} from '../../../internal/accessibility-visibility.js';
import { composedParentElement, deepActiveElementIn } from '../../../internal/active-element.js';
import { composedContains } from '../../../internal/overlay-stack.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { measureAdjacentRuns, type AdjacentRunPosition } from '../../../internal/adjacent-runs.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import type {
  LyraToggle,
  LyraToggleAppearance,
  LyraToggleChangeDetail,
  LyraToggleGroupLink,
} from '../toggle/toggle.class.js';
import { styles } from './toggle-group.styles.js';

/** `multiple`: zero or more pressed. `single`: zero or one pressed, so the choice can be cleared. */
export type LyraToggleGroupSelectionMode = 'single' | 'multiple';

/** The group-level proposal one owned toggle's pending activation translates into. */
export interface LyraToggleGroupToggleRequestDetail {
  /** The group value that would result from the activation, in DOM order. */
  readonly value: readonly string[];
  /** The group value as it stands while the request is dispatched. */
  readonly previousValue: readonly string[];
  /** The toggle the user acted on, kept by identity. */
  readonly option: LyraToggle;
}

export interface LyraToggleGroupEventMap {
  'lr-toggle-group-toggle-request': CustomEvent<
    LyraEventDetailSnapshot<LyraToggleGroupToggleRequestDetail>
  >;
  'lr-change': CustomEvent<Readonly<{ value: readonly string[] }>>;
}

const SELECTION_MODE = literalSetConverter<LyraToggleGroupSelectionMode>(
  ['single', 'multiple'],
  'multiple',
);
const ORIENTATION = literalSetConverter<LyraOrientation>(['horizontal', 'vertical'], 'horizontal');
const APPEARANCE = optionalLiteralSetConverter<LyraToggleAppearance>(['plain', 'outlined']);

const AMBIGUOUS_VALUE_WARNING_KEY = 'lyra-toggle-group-ambiguous-values';
const AMBIGUOUS_VALUE_WARNING =
  '<lr-toggle-group>: empty or duplicate toggle values make the group value ambiguous; give each toggle a distinct value.';

// Every attribute the ownership and availability predicates read, on a toggle or on any wrapper
// between it and the group. `class` and `style` matter because a stylesheet can hide a toggle.
const OBSERVED_ATTRIBUTES = [
  'slot',
  'pressed',
  'disabled',
  'value',
  'hidden',
  'inert',
  'aria-hidden',
  'aria-disabled',
  'class',
  'style',
];

interface TrackedFocus {
  readonly toggle: LyraToggle;
  readonly snapshot: ComposedFocusRepairSnapshot;
}

/**
 * `<lr-toggle-group>` — a set of `<lr-toggle>` children behind one tab stop.
 *
 * `selection-mode="multiple"` (the default) lets any number of toggles be pressed.
 * `selection-mode="single"` allows **zero or one**: pressing a toggle releases the others, and
 * pressing the pressed toggle again clears the choice. Each toggle keeps its `aria-pressed` button
 * semantics in both modes, which convey no exclusivity to assistive technology, so state an
 * exclusive choice in the group's name (`label="Highlight colour (optional, pick one)"`). A choice
 * that must never be empty -- text alignment, view mode -- is a radio choice: use
 * `<lr-radio-group>` with `<lr-radio-button>`, which conveys exclusivity and position.
 *
 * Owned toggles are the light-DOM `<lr-toggle>` descendants whose nearest group is this one and
 * whose top-level wrapper sits in the default slot, so wrappers such as a tooltip are allowed while
 * nested groups keep their own toggles. The group renders exactly one internal tab stop and roves
 * between available toggles with the arrow keys (mirrored under RTL; Up/Down when vertical), Home
 * and End. Arrows only move focus; Enter and Space toggle the focused toggle. It projects its
 * `disabled` and its opt-in `size`/`appearance` onto every owned toggle without rewriting their own
 * attributes, and joins horizontally adjacent toggles into one bordered run measured from their
 * rendered geometry. A toggle that upgrades after the group, or is added later, is adopted, and a
 * `value` assigned before any toggle exists is applied once they arrive.
 *
 * The group is the aggregate event surface, like `<lr-checkbox-group>`: it consumes each owned
 * toggle's `lr-toggle-toggle-request` and `lr-change` and republishes them as
 * `lr-toggle-group-toggle-request` and `lr-change`. Programmatic `value`, `pressed` and
 * `selection-mode` changes are silent.
 *
 * `focus()` focuses the current tab stop, `blur()` releases whichever owned toggle holds focus, and
 * `click()` toggles the current tab stop through its full user-activation path, so the request and
 * `lr-change` fire and a veto still applies. All three are no-ops while the group is disabled or no
 * toggle is available.
 *
 * The group does not implement `getToolbarActions()`: inside `<lr-message-actions>` it stays one
 * nested composite with its own tab stop, and its toggles contribute no actions of their own.
 * It is not form-associated and submits nothing; give every toggle a distinct `value`, which the
 * group warns about once in development when it finds an empty or duplicate one.
 *
 * @customElement lr-toggle-group
 * @slot - `<lr-toggle>` children, directly or inside wrappers.
 * @event lr-toggle-group-toggle-request - An owned toggle is about to flip;
 *   `detail: { value, previousValue, option }` carries the group value that *would* result, the
 *   value as it stands, and the toggle the user acted on (by identity). Cancelable:
 *   `preventDefault()` keeps every toggle unchanged and no `lr-change` follows. A listener may
 *   instead resolve the request by assigning the group's `value` itself during the dispatch, which
 *   suppresses the change the same way. The detail is a detached, frozen snapshot.
 * @event lr-change - A committed user change, with single-mode exclusivity already applied;
 *   `detail: { value }`. Not cancelable and not fired for programmatic changes.
 * @csspart base - The `role="group"` flex container.
 * @cssprop [--lr-toggle-group-gap=0] - Gap between toggles along the group's axis. The built-in
 *   default is 0 when horizontal, so adjacent toggles join, and `var(--lr-space-2xs)` when
 *   vertical. Any real gap keeps every toggle's corners.
 * @cssprop [--lr-toggle-group-wrap-gap=var(--lr-space-2xs)] - Gap between wrapped lines.
 * @status experimental
 * @since unreleased
 */
export class LyraToggleGroup extends LyraElement<LyraToggleGroupEventMap> {
  // Both details are detached and frozen at the boundary so a listener cannot mutate the group's
  // bookkeeping through them; `option` is the one field kept by identity, because naming which
  // toggle is acting is the point of it.
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-toggle-group-toggle-request',
    'lr-change',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-toggle-group-toggle-request': Object.freeze(['option']),
  });

  static override styles = [LyraElement.styles, sizes, styles];
  static override properties = {
    value: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _disabled = false;
  private _selectionMode: LyraToggleGroupSelectionMode = 'multiple';
  private _orientation: LyraOrientation = 'horizontal';
  private _size?: LyraSize;
  private _appearance?: LyraToggleAppearance;
  /** Toggles currently linked to this group, in the order they were last reconciled. */
  private linked = new Set<LyraToggle>();
  /** The owned toggles, in DOM order, at the last projection; the anchor for clamping the stop. */
  private previousOrder: readonly LyraToggle[] = [];
  private runPositions = new WeakMap<LyraToggle, AdjacentRunPosition>();
  private syncing = false;
  private pendingValue?: readonly string[];
  /** The roving anchor: the last focused toggle, or where the stop clamped to after it vanished. */
  private lastFocused?: LyraToggle;
  /** The most recently pressed toggle in single mode, which wins an exclusivity repair. */
  private lastPressed?: LyraToggle;
  private trackedFocus?: TrackedFocus;
  private membershipObserver?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private sizedToggles: readonly LyraToggle[] = [];
  private runFrame?: number;
  private generation = 0;
  private definitionSyncQueued = false;
  // Shared with every other veto point: a listener that answers the group request by assigning
  // `value` finishes before the toggle's pending commit runs, and a before/after compare reads
  // "unchanged" whenever it assigned the value the group already held.
  private readonly groupGuard = new VetoWriteGuard();
  private readonly link: LyraToggleGroupLink = {
    owns: (toggle) => this.isConnected && this.ownsToggle(toggle),
    pressedWritten: (toggle) => this.onPressedWritten(toggle),
  };

  /** `multiple` (zero or more, the default) or `single` (zero or one). Unsupported values fall back
   *  to `multiple`. Switching to `single` silently keeps only the first pressed toggle. */
  @property({ attribute: 'selection-mode', reflect: true, converter: SELECTION_MODE })
  get selectionMode(): LyraToggleGroupSelectionMode {
    return this._selectionMode;
  }
  set selectionMode(next: LyraToggleGroupSelectionMode) {
    const normalized = SELECTION_MODE.normalizeReflected(this, 'selection-mode', next);
    const old = this._selectionMode;
    if (old === normalized) return;
    this._selectionMode = normalized;
    // Recency is tracked only while in single mode, so a pick remembered from an earlier
    // single-mode spell says nothing about presses made in multiple mode since. Entering single
    // mode starts over and keeps the first pressed toggle, as documented.
    if (normalized === 'single') this.lastPressed = undefined;
    this.sync();
    this.requestUpdate('selectionMode', old);
  }

  /** Arrow-key axis and layout. Vertical groups never join their toggles into a run. */
  @property({ reflect: true, converter: ORIENTATION })
  get orientation(): LyraOrientation {
    return this._orientation;
  }
  set orientation(next: LyraOrientation) {
    const normalized = ORIENTATION.normalizeReflected(this, 'orientation', next);
    const old = this._orientation;
    if (old === normalized) return;
    this._orientation = normalized;
    this.requestUpdate('orientation', old);
  }

  /** Opt-in tier projected onto every owned toggle, on the shared ladder. Unset (the default) and
   *  unsupported values leave each toggle's own `size` in charge. */
  @property({ reflect: true, converter: optionalSizeConverter })
  get size(): LyraSize | undefined {
    return this._size;
  }
  set size(next: LyraSize | undefined) {
    const normalized = normalizeReflectedOptionalSize(this, next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.sync();
    this.requestUpdate('size', old);
  }

  /** Opt-in `plain`/`outlined` appearance projected onto every owned toggle. Unset (the default)
   *  and unsupported values leave each toggle's own `appearance` in charge. */
  @property({ reflect: true, converter: APPEARANCE })
  get appearance(): LyraToggleAppearance | undefined {
    return this._appearance;
  }
  set appearance(next: LyraToggleAppearance | undefined) {
    const normalized = APPEARANCE.normalizeReflected(this, 'appearance', next);
    const old = this._appearance;
    if (old === normalized) return;
    this._appearance = normalized;
    this.sync();
    this.requestUpdate('appearance', old);
  }

  /** Accessible-name fallback for the group when the host has no `aria-label`. */
  @property() label = '';

  /** Disables every owned toggle, leaving each toggle's own `disabled` untouched. */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.sync();
    this.requestUpdate('disabled', old);
  }

  /**
   * The distinct `value`s of the pressed owned toggles, in DOM order, as a frozen snapshot.
   *
   * Assigning presses the toggles the array names and releases every other one, silently. In
   * `single` mode only the first owned toggle matching the first listed value that names any
   * toggle is pressed. An assignment made before any toggle exists is applied once they arrive.
   */
  get value(): readonly string[] {
    const values = new Set<string>();
    for (const toggle of this.toggles()) if (toggle.pressed) values.add(toggle.value);
    return Object.freeze([...values]);
  }
  set value(next: readonly string[] | null | undefined) {
    // Unconditional, including an assignment of the value already held: the guard tracks that a
    // write happened, not that a value differs.
    markVetoGuardWrite(this.groupGuard);
    const requested = Object.freeze(
      Array.isArray(next) ? next.filter((entry): entry is string => typeof entry === 'string') : [],
    );
    const toggles = this.toggles();
    if (toggles.length === 0) {
      this.pendingValue = requested;
      return;
    }
    this.pendingValue = undefined;
    this.applyValue(toggles, requested);
    this.sync();
  }

  constructor() {
    super();
    // Capture phase on the host: it runs before any bubble-phase listener on this node and before
    // any listener on the toggle itself, so consuming the toggle's own events here is reliable
    // whatever order a consumer registered theirs in. An outer group's capture runs before an
    // inner one, so ownership -- not phase -- is what keeps nested groups apart.
    this.addEventListener('lr-toggle-toggle-request', this.onToggleRequest, { capture: true });
    this.addEventListener('lr-change', this.onToggleChange, { capture: true });
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    this.addEventListener('click', this.onClick);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.armMembershipObserver();
    this.sync();
  }

  override disconnectedCallback(): void {
    this.generation += 1;
    this.membershipObserver?.disconnect();
    this.membershipObserver = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.sizedToggles = [];
    if (this.runFrame !== undefined) this.ownerDocument?.defaultView?.cancelAnimationFrame(this.runFrame);
    this.runFrame = undefined;
    this.definitionSyncQueued = false;
    this.pendingValue = undefined;
    this.trackedFocus = undefined;
    this.lastPressed = undefined;
    // Disconnecting an observer drops its queued records, so a group unwrapped in one step
    // (`group.replaceWith(...group.childNodes)`) would never see its toggles leave. Release every
    // link explicitly; toggles still inside a detached group are standalone until it reconnects.
    for (const toggle of this.linked) toggle.leaveGroup(this.link);
    this.linked = new Set();
    this.previousOrder = [];
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Orientation, direction and language changes move toggles without resizing any of them.
    this.scheduleRunProjection();
  }

  /** Moves focus to the current tab-stop toggle. */
  override focus(options?: FocusOptions): void {
    if (this.disabled) return;
    this.currentStop()?.focus(options);
  }

  /** Removes focus from whichever owned toggle contains the deep active element. */
  override blur(): void {
    this.toggles().find((toggle) => toggle.matches(':focus-within'))?.blur();
  }

  /** Toggles the current tab-stop toggle through its full user-activation path. */
  override click(): void {
    if (this.disabled) return;
    this.currentStop()?.click();
  }

  private currentStop(): LyraToggle | undefined {
    return this.computeTabStop(this.toggles());
  }

  /** Whether `element` is a toggle this group owns through its default slot. */
  private ownsToggle(element: Element): boolean {
    if (element.localName !== tag('toggle')) return false;
    // Nested Lit SSR and partial DOM shims may lack `closest()`; ownership needs real ancestry.
    const closest = (element as Partial<Element>).closest;
    if (typeof closest !== 'function') return false;
    if (closest.call(element, tag('toggle-group')) !== this) return false;
    let topLevel: Element = element;
    while (topLevel.parentElement && topLevel.parentElement !== this) topLevel = topLevel.parentElement;
    if (topLevel.parentElement !== this) return false;
    // The group renders only a default slot, so a child assigned to any named slot is never shown.
    return !topLevel.getAttribute('slot');
  }

  private isOwnedToggle(target: EventTarget | null): target is LyraToggle {
    return (
      (target as Partial<Node> | null)?.nodeType === 1 &&
      this.ownsToggle(target as Element) &&
      typeof (target as Partial<LyraToggle>).joinGroup === 'function'
    );
  }

  /** The owned, upgraded toggles in DOM order. */
  private toggles(): LyraToggle[] {
    return this.ownedElements().filter(
      (element): element is LyraToggle => typeof (element as Partial<LyraToggle>).joinGroup === 'function',
    );
  }

  private ownedElements(): Element[] {
    // The document-less Lit server host has no light-DOM query API; an empty collection is the
    // only state available there, and connection restores real reconciliation.
    const querySelectorAll = (this as Partial<Element>).querySelectorAll;
    if (typeof querySelectorAll !== 'function') return [];
    return [...querySelectorAll.call(this, tag('toggle'))].filter((element) => this.ownsToggle(element));
  }

  private isAvailable(toggle: LyraToggle): boolean {
    if (this.disabled || toggle.disabled) return false;
    for (let current: Element | null = toggle; current; current = composedParentElement(current)) {
      if (isAccessibilitySubtreeExcluded(current) || isAriaTrue(current.getAttribute('aria-disabled'))) {
        return false;
      }
      if (current === this) break;
    }
    return true;
  }

  /**
   * Reconciles membership, single-mode exclusivity and any pending value, then projects state onto
   * every owned toggle. Idempotent: it writes only what changed.
   */
  private sync(): void {
    if (this.syncing || !this.isConnected) return;
    const elements = this.ownedElements();
    const toggles = this.toggles();
    if (elements.length !== toggles.length) this.queueDefinitionSync();
    this.syncing = true;
    try {
      const current = new Set(toggles);
      for (const toggle of this.linked) {
        if (!current.has(toggle)) toggle.leaveGroup(this.link);
      }
      for (const toggle of toggles) {
        if (!this.linked.has(toggle)) toggle.joinGroup(this.link);
      }
      this.linked = current;
      if (this.selectionMode === 'single') this.keepOnePressed(toggles);
      if (this.pendingValue !== undefined && toggles.length > 0) {
        const pending = this.pendingValue;
        this.pendingValue = undefined;
        this.applyValue(toggles, pending);
      }
    } finally {
      this.syncing = false;
    }
    this.warnOnAmbiguousValues(toggles);
    this.observeSizes(toggles);
    this.project(toggles);
    this.scheduleRunProjection();
  }

  private keepOnePressed(toggles: readonly LyraToggle[]): void {
    const pressed = toggles.filter((toggle) => toggle.pressed);
    if (pressed.length <= 1) return;
    const keep = this.lastPressed && pressed.includes(this.lastPressed) ? this.lastPressed : pressed[0];
    for (const toggle of pressed) if (toggle !== keep) toggle.pressed = false;
  }

  private applyValue(toggles: readonly LyraToggle[], requested: readonly string[]): void {
    const wasSyncing = this.syncing;
    this.syncing = true;
    try {
      if (this.selectionMode === 'single') {
        const wanted = requested.find((value) => toggles.some((toggle) => toggle.value === value));
        const chosen = wanted === undefined ? undefined : toggles.find((toggle) => toggle.value === wanted);
        for (const toggle of toggles) toggle.pressed = toggle === chosen;
        if (chosen) this.lastPressed = chosen;
      } else {
        const wanted = new Set(requested);
        for (const toggle of toggles) toggle.pressed = wanted.has(toggle.value);
      }
    } finally {
      this.syncing = wasSyncing;
    }
  }

  private onPressedWritten(toggle: LyraToggle): void {
    if (this.syncing || !this.isConnected || !this.ownsToggle(toggle)) return;
    if (this.selectionMode !== 'single' || !toggle.pressed) return;
    this.lastPressed = toggle;
    this.syncing = true;
    try {
      for (const other of this.toggles()) {
        if (other !== toggle && other.pressed) other.pressed = false;
      }
    } finally {
      this.syncing = false;
    }
  }

  private warnOnAmbiguousValues(toggles: readonly LyraToggle[]): void {
    const seen = new Set<string>();
    for (const toggle of toggles) {
      if (toggle.value === '' || seen.has(toggle.value)) {
        devWarnOnce(AMBIGUOUS_VALUE_WARNING_KEY, AMBIGUOUS_VALUE_WARNING);
        return;
      }
      seen.add(toggle.value);
    }
  }

  /**
   * The one available toggle that carries the internal tab stop: the roving anchor, else the first
   * pressed, else the first. When the anchor disappears or becomes unavailable the stop clamps to
   * the next available toggle, else the previous one, and that toggle becomes the new anchor.
   */
  private computeTabStop(toggles: readonly LyraToggle[]): LyraToggle | undefined {
    const available = toggles.filter((toggle) => this.isAvailable(toggle));
    if (available.length === 0) return undefined;
    const anchor = this.lastFocused;
    if (anchor && available.includes(anchor)) return anchor;
    if (anchor) {
      const index = this.previousOrder.indexOf(anchor);
      if (index >= 0) {
        const after = this.previousOrder.slice(index + 1).find((toggle) => available.includes(toggle));
        const before = this.previousOrder
          .slice(0, index)
          .reverse()
          .find((toggle) => available.includes(toggle));
        const clamped = after ?? before;
        if (clamped) {
          this.lastFocused = clamped;
          return clamped;
        }
      }
      this.lastFocused = undefined;
    }
    return available.find((toggle) => toggle.pressed) ?? available[0];
  }

  private project(toggles: readonly LyraToggle[]): void {
    const stop = this.computeTabStop(toggles);
    this.previousOrder = [...toggles];
    const horizontal = this.orientation === 'horizontal';
    for (const toggle of toggles) {
      toggle.setGroupProjection({
        disabled: this.disabled,
        tabbable: toggle === stop,
        size: this.size ?? null,
        appearance: this.appearance ?? null,
        run: horizontal ? this.runPositions.get(toggle) ?? 'standalone' : 'standalone',
      });
    }
    this.repairFocus(toggles, stop);
  }

  /** Moves focus that was lost with a removed or hidden toggle onto the new tab stop. */
  private repairFocus(toggles: readonly LyraToggle[], stop: LyraToggle | undefined): void {
    const tracked = this.trackedFocus;
    if (!tracked) return;
    if (toggles.includes(tracked.toggle) && this.isAvailable(tracked.toggle)) return;
    this.trackedFocus = undefined;
    if (!stop) return;
    const target = collectComposedFocusTargets(stop, { includeRoot: false, mode: 'programmatic' }).elements[0];
    if (target) applyComposedFocusRepair(tracked.snapshot, () => [target]);
  }

  private queueDefinitionSync(): void {
    if (this.definitionSyncQueued) return;
    const registry = this.ownerDocument?.defaultView?.customElements;
    if (!registry) return;
    this.definitionSyncQueued = true;
    const generation = this.generation;
    void registry.whenDefined(tag('toggle')).then(() => {
      if (this.generation !== generation) return;
      this.definitionSyncQueued = false;
      if (this.isConnected) this.sync();
    });
  }

  private armMembershipObserver(): void {
    const ownerWindow = this.ownerDocument?.defaultView;
    const MutationObserverCtor = ownerWindow?.MutationObserver;
    if (!MutationObserverCtor || this.membershipObserver) return;
    const generation = this.generation;
    const observer = new MutationObserverCtor(() => {
      if (this.membershipObserver !== observer || this.generation !== generation || !this.isConnected) return;
      this.sync();
    });
    this.membershipObserver = observer;
    observer.observe(this, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
  }

  private observeSizes(toggles: readonly LyraToggle[]): void {
    const ResizeObserverCtor = this.ownerDocument?.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    // Re-arm only when membership changed: a fresh observer reports every target once, which
    // would schedule a redundant measurement on each pressed-state sync.
    if (
      this.resizeObserver &&
      toggles.length === this.sizedToggles.length &&
      toggles.every((toggle, index) => this.sizedToggles[index] === toggle)
    ) {
      return;
    }
    this.sizedToggles = [...toggles];
    this.resizeObserver?.disconnect();
    const generation = this.generation;
    const observer = new ResizeObserverCtor(() => {
      if (this.resizeObserver !== observer || this.generation !== generation) return;
      this.scheduleRunProjection();
    });
    this.resizeObserver = observer;
    observer.observe(this);
    for (const toggle of toggles) observer.observe(toggle);
  }

  private scheduleRunProjection(): void {
    const ownerWindow = this.ownerDocument?.defaultView;
    if (!ownerWindow || !this.isConnected || this.runFrame !== undefined) return;
    const generation = this.generation;
    this.runFrame = ownerWindow.requestAnimationFrame(() => {
      this.runFrame = undefined;
      if (this.generation !== generation || !this.isConnected) return;
      this.measureRuns();
    });
  }

  /**
   * Measures joined runs from rendered geometry and re-projects. The same pass recomputes the tab
   * stop, so a toggle hidden by a rule no attribute observer can see (a media query, an ancestor
   * outside the group) still moves the stop once its box appears or disappears.
   */
  private measureRuns(): void {
    const toggles = this.toggles();
    const positions = this.orientation === 'horizontal'
      ? measureAdjacentRuns(toggles, {
        direction: getComputedStyle(this).direction === 'rtl' ? 'rtl' : 'ltr',
        joinable: () => true,
      })
      : toggles.map((): AdjacentRunPosition => 'standalone');
    toggles.forEach((toggle, index) => this.runPositions.set(toggle, positions[index]!));
    this.project(toggles);
  }

  private firstToggleInPath(event: Event): Element | undefined {
    for (const target of event.composedPath()) {
      if (target === this) return undefined;
      if ((target as Partial<Node>).nodeType === 1 && (target as Element).localName === tag('toggle')) {
        return target as Element;
      }
    }
    return undefined;
  }

  private onToggleRequest = (event: Event): void => {
    const option = event.target;
    if (!this.isOwnedToggle(option)) return;
    // The group is the aggregate event surface, so the toggle's own request is consumed here and
    // republished under the group's name. Stopping propagation keeps the canceled flag, so a veto
    // applied below still reaches the toggle's pending commit.
    event.stopImmediatePropagation();
    const proposed = (event as CustomEvent<LyraToggleChangeDetail>).detail.pressed;
    let allowed = false;
    requestThenCommit({
      requestDetail: {
        value: this.projectedValue(option, proposed),
        previousValue: this.value,
        option,
      },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-toggle-group-toggle-request', detail, init),
      guard: this.groupGuard,
      // The group writes nothing itself: committing means letting the toggle's pending write run.
      // A flag set here stays correct alongside the guard, because a listener that resolved the
      // request by assigning `value` leaves `defaultPrevented` false while still suppressing it.
      commit: () => {
        allowed = true;
      },
    });
    if (!allowed) event.preventDefault();
  };

  private onToggleChange = (event: Event): void => {
    if (!this.isOwnedToggle(event.target)) return;
    event.stopImmediatePropagation();
    this.emit('lr-change', { value: this.value });
  };

  /** The group value that would result if `option` took `pressed`, in DOM order. */
  private projectedValue(option: LyraToggle, pressed: boolean): readonly string[] {
    if (this.selectionMode === 'single') return Object.freeze(pressed ? [option.value] : []);
    const values = new Set<string>();
    for (const toggle of this.toggles()) {
      if (toggle === option ? pressed : toggle.pressed) values.add(toggle.value);
    }
    return Object.freeze([...values]);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = this.firstToggleInPath(event);
    if (!current || !this.isOwnedToggle(current)) return;
    const horizontal = this.orientation === 'horizontal';
    const rtl = this.effectiveDirection === 'rtl';
    let move: 'next' | 'previous' | 'first' | 'last' | undefined;
    if (event.key === 'Home') move = 'first';
    else if (event.key === 'End') move = 'last';
    else if (horizontal && event.key === 'ArrowRight') move = rtl ? 'previous' : 'next';
    else if (horizontal && event.key === 'ArrowLeft') move = rtl ? 'next' : 'previous';
    else if (!horizontal && event.key === 'ArrowDown') move = 'next';
    else if (!horizontal && event.key === 'ArrowUp') move = 'previous';
    if (!move) return;
    const available = this.toggles().filter((toggle) => this.isAvailable(toggle));
    if (available.length === 0) return;
    const index = available.indexOf(current);
    const count = available.length;
    let nextIndex: number;
    if (move === 'first') nextIndex = 0;
    else if (move === 'last') nextIndex = count - 1;
    else if (index < 0) nextIndex = move === 'next' ? 0 : count - 1;
    else nextIndex = move === 'next' ? (index + 1) % count : (index - 1 + count) % count;
    event.preventDefault();
    // Manual activation: arrows only move focus, so a toggle never flips while being navigated.
    const next = available[nextIndex]!;
    this.lastFocused = next;
    this.project(this.toggles());
    next.focus();
  };

  private onFocusIn = (event: FocusEvent): void => {
    const toggle = this.firstToggleInPath(event);
    if (!toggle || !this.isOwnedToggle(toggle)) return;
    const snapshot = captureComposedFocusRepair(toggle, toggle);
    this.trackedFocus = snapshot ? { toggle, snapshot } : undefined;
    if (this.lastFocused === toggle) return;
    this.lastFocused = toggle;
    this.project(this.toggles());
  };

  private onFocusOut = (): void => {
    const tracked = this.trackedFocus;
    if (!tracked) return;
    queueMicrotask(() => {
      if (this.trackedFocus !== tracked) return;
      const active = deepActiveElementIn(this.ownerDocument);
      if (active !== null && composedContains(tracked.toggle, active)) return;
      const lost =
        active === null || active === this.ownerDocument.body || active === this.ownerDocument.documentElement;
      // Keep the repair only when focus fell to the document together with a toggle that was
      // removed or hidden; a move to any other target is the user's, and is never undone.
      const vanished = !tracked.toggle.isConnected || !this.isAvailable(tracked.toggle);
      if (!lost || !vanished) this.trackedFocus = undefined;
    });
  };

  private onClick = (event: MouseEvent): void => {
    // WebKit does not focus a button on click, so a click also moves the roving anchor.
    const toggle = this.firstToggleInPath(event);
    if (!toggle || !this.isOwnedToggle(toggle) || this.lastFocused === toggle) return;
    this.lastFocused = toggle;
    this.project(this.toggles());
  };

  private onSlotChange = (): void => {
    this.sync();
  };

  override render(): TemplateResult {
    const name = hostAriaLabel(this);
    return html`<div part="base" role="group" aria-label=${name ?? (this.label || nothing)}>
      <slot @slotchange=${this.onSlotChange}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-toggle-group': LyraToggleGroup;
  }
}
