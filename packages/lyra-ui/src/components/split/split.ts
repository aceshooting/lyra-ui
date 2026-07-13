import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './split.styles.js';

const KEYBOARD_STEP = 2;

// Sentinel fallbacks so a one-sided constraint (only `minPx` or only
// `maxPx`) can still be expressed as a 3-argument CSS `clamp()` in the
// static layout, instead of needing two different flex-basis shapes.
const NO_MIN_PX = 0;
const NO_MAX_PX = 1_000_000;

interface DragState {
  index: number;
  startPos: number;
  base: HTMLElement;
  /** Cumulative delta already folded into the live `sizes` so far this
   *  gesture — clamping against live sizes (see onPointerMove) means each
   *  move must apply only the *incremental* delta since the last move, not
   *  the total-since-drag-start delta a snapshot-based clamp would use. */
  appliedDelta: number;
}

/** A fixed-pixel-range constraint for one panel; index-aligned with `sizes`/
 *  `panelConstraints`. Either bound may be omitted to leave that side
 *  unconstrained (falls back to the component's percent-based `min`). */
export interface PanelConstraint {
  minPx?: number;
  maxPx?: number;
}

export type SplitConstraintIssueReason =
  | 'minimum-total'
  | 'maximum-total'
  | 'minimum-exceeds-maximum';

export interface SplitConstraintIssueDetail {
  reason: SplitConstraintIssueReason;
  panelCount: number;
  minimumTotal: number;
  maximumTotal: number | null;
  containerSize: number;
}

interface ConstraintResolution {
  bounds: Array<{ min: number; max: number }>;
  usePanelConstraints: boolean;
  issue?: SplitConstraintIssueDetail;
}

/** Which pane (if any) participates in responsive collapse (see `collapse`). */
export type SplitCollapseMode = 'start' | 'end' | 'none';

/** The collapsing pane's current responsive state — `'wide'` is the normal
 *  drag-resizable percent layout (identical to `collapse="none"`); `'rail'`
 *  clamps it to `railWidth`; `'floating'` lifts it out of the flex flow as an
 *  overlay above the other pane. */
export type SplitCollapseState = 'wide' | 'rail' | 'floating';

/** What can be *assigned* to `collapseState` -- `'auto'` is a write-only
 *  sentinel; see the `collapseState` accessor doc. */
export type SplitCollapseStateInput = SplitCollapseState | 'auto';

export interface SplitCollapseChangeDetail {
  state: SplitCollapseState;
}

/**
 * `<lyra-split>` — resizable panels for dashboard layouts. Direct light-DOM
 * children are the panels; a divider is auto-inserted between each pair.
 *
 * Optionally, one pane can opt in to responsive collapse via `collapse`
 * (`"start"`/`"end"`, default `"none"` — no behavior change when unset): as
 * the split's own container narrows past `railBreakpoint` that pane clamps
 * to a fixed `railWidth`, and past the narrower `floatBreakpoint` it instead
 * becomes an absolutely-positioned overlay "floating card" above the other
 * pane. This component only handles the width-collapse mechanics and
 * signals the current state — via the `collapseState`-derived
 * `data-collapse-state` attribute (set on both the host and the collapsing
 * panel itself) and the `lyra-split-collapse-change` event — it renders no
 * icon-only/collapsed UI of its own; slotted content is expected to adapt to
 * its own clamped width (e.g. via its own container query).
 *
 * `collapseState` is a public accessor with force/auto semantics mirroring
 * `<lyra-app-rail>`'s `mode`: it's normally derived automatically from the
 * measured container width (via a `ResizeObserver` on `[part="base"]`)
 * whenever it crosses `railBreakpoint`/`floatBreakpoint`, but assigning it a
 * concrete `'wide'`/`'rail'`/`'floating'` value pins it there and stops that
 * automatic tracking — useful for a consumer-driven toggle (e.g. a button
 * that forces `'floating'` regardless of width). Assigning the write-only
 * `'auto'` sentinel releases the pin and immediately re-derives the state
 * from the current measured width, resuming automatic tracking. `'auto'` is
 * never a value this getter returns.
 *
 * The `'floating'` state is a hidden-by-default drawer, gated by `open`
 * (mirrors `<lyra-app-rail>`'s mobile overlay): while `collapseState` is
 * `'floating'` and `open` is `false` (the default), the collapsing panel
 * renders nothing — `hidden`, out of the accessibility tree, not just
 * visually hidden — instead of the always-visible overlay card this state
 * rendered before `open` existed. Setting `open = true` reveals it as a
 * focus-trapped floating panel with a `[part="backdrop"]` scrim; Escape or a
 * backdrop click set `open` back to `false`. `open` is preserved (not reset)
 * while `collapseState` isn't `'floating'`, but no drawer chrome renders
 * until it is again — except that leaving `'floating'` while `open` is
 * `true` (a breakpoint crossing back to `'wide'`/`'rail'`, or a forced
 * reassignment) also closes it, the same way `<lyra-app-rail>` closes its
 * mobile overlay when leaving `'mobile'` while open.
 *
 * @customElement lyra-split
 * @event lyra-resize - `detail: { sizes }`, fired on every drag step/release
 *   and every keyboard step.
 * @event lyra-split-collapse-change - `detail: { state }` (`SplitCollapseChangeDetail`),
 *   fired whenever the responsive `collapseState` actually transitions between
 *   `'wide'`/`'rail'`/`'floating'` — whether from a breakpoint crossing or an
 *   explicit `collapseState` assignment. Only relevant when `collapse` isn't
 *   `"none"`; never fires otherwise. Not fired for a redundant reassignment
 *   to the state already in effect.
 * @event lyra-split-constraints-invalid - `detail: SplitConstraintIssueDetail`,
 *   fired once when the configured panel minimums/maximums cannot describe a
 *   layout that fits the track. The splitter rejects that infeasible set for
 *   interaction and falls back to a normalized percent minimum.
 * @slot - Panels to arrange side by side (or stacked, when `orientation="vertical"`); each direct child becomes one resizable panel.
 * @csspart base - The flex layout wrapper (`position: relative`, so the `'floating'` collapse state can anchor to it).
 * @csspart divider - Each divider between two panels; carries `aria-disabled="true"` and is drag/keyboard-inert while its adjacent panel is collapsed (`'rail'`/`'floating'`).
 * @csspart backdrop - The `'floating'` drawer's scrim. Only rendered while `collapseState === 'floating'` and `open`.
 */
export class LyraSplit extends LyraElement {
  static styles = [LyraElement.styles, styles];

  // `collapseState` needs a custom accessor (force/auto semantics -- see the
  // class doc) rather than the usual @property()-generated one -- registered
  // here, alongside the decorator-declared properties below, the same way
  // lyra-app-rail's `mode` is. `reflect: true` still applies: LitElement's
  // update loop reflects any `reflect`-flagged property to its attribute
  // generically by reading `this[name]` after render, regardless of whether
  // that property has a custom or auto-generated accessor. `attribute` is
  // spelled out (unlike `mode`, a single word whose Lit-default lowercase
  // form already reads fine) so the reflected attribute stays kebab-case,
  // matching this file's other attribute-reflected properties.
  static properties = {
    collapseState: { reflect: true, attribute: 'collapse-state', noAccessor: true },
  };

  @property({ attribute: false }) sizes: number[] = [];
  @property({ type: Number }) min = 10;
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';
  @property({ attribute: 'storage-key' }) storageKey?: string;
  /** Optional fixed-pixel min/max per panel, index-aligned with `sizes`. A
   *  `null`/missing entry leaves that panel purely percent-based (the
   *  existing `min`-only behavior). `sizes`, the `lyra-resize` payload, and
   *  localStorage persistence stay percent-based regardless — only the
   *  effective clamp bounds change for a constrained panel. */
  @property({ attribute: false }) panelConstraints: (PanelConstraint | null)[] = [];
  /** Opts a pane in to responsive collapse: `'start'` is the first light-DOM
   *  panel (index 0), `'end'` is the last. Both are LOGICAL positions, same
   *  as CSS `inset-inline-start`/`-end` — see the `collapsingIndex` getter
   *  for why that already resolves to the same physical index under RTL for
   *  this component (panels are never re-`order`ed for RTL, only the drag
   *  delta sign mirrors). Default `'none'`: none of the collapse behavior
   *  below applies, and rendering/behavior is identical to before this
   *  property existed. */
  @property({ reflect: true }) collapse: SplitCollapseMode = 'none';
  /** Fixed CSS length the collapsing pane clamps to in the `'rail'` state. */
  @property({ attribute: 'rail-width' }) railWidth = '3.5rem';
  /** Container width (px, measured on `[part="base"]`) below which the
   *  collapsing pane switches from its normal percent width to the fixed
   *  `railWidth` (`'rail'` state). Must stay above `floatBreakpoint`. */
  @property({ type: Number, attribute: 'rail-breakpoint' }) railBreakpoint = 640;
  /** Container width (px) below which the collapsing pane instead becomes an
   *  absolutely-positioned overlay above the other pane (`'floating'` state). */
  @property({ type: Number, attribute: 'float-breakpoint' }) floatBreakpoint = 400;
  /** Whether the `'floating'` collapse state's drawer is shown. Only
   *  meaningful while `collapseState` is `'floating'` — the value is
   *  preserved (not reset) while another state is active, but no drawer
   *  chrome renders until `collapseState` is `'floating'` again. Defaults to
   *  `false`: the collapsing pane renders nothing while floating until a
   *  consumer opts in by setting this (or it's forced open programmatically)
   *  — see the class doc. */
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private panelCount = 0;
  private _collapseState: SplitCollapseState = 'wide';
  // Whether ResizeObserver-driven measurement is currently ignored because a
  // consumer forced a specific collapseState -- see the accessor doc.
  private _forced = false;
  // Derived from collapseState === 'floating' && open -- tracked as its own
  // field (rather than recomputed inline everywhere) so willUpdate can detect
  // the specific false->true/true->false transition regardless of which of
  // the two source properties changed (mirrors lyra-app-rail's
  // `overlayActive`).
  private overlayActive = false;
  private justOpened = false;
  private releaseScrollLock?: () => void;
  private overlayHandle?: OverlayHandle;
  // Keyed by pointerId so an interrupted or concurrent (multi-touch) drag on
  // one divider never reads or clobbers another pointer's drag state.
  private drags = new Map<number, DragState>();
  // Panels `updated()` last applied inline flex/order (and, while collapsing,
  // position/inset/inline-size) styles to — tracked so a panel removed from
  // the slot (e.g. a DOM node later reused elsewhere) gets those
  // lyra-split-authored styles cleared instead of carrying them around stale
  // forever.
  private stylizedPanels = new Set<HTMLElement>();
  private constraintIssueKey = '';
  @query('[part="base"]') private baseEl?: HTMLElement;
  private collapseResizeObserver?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.panelCount = this.children.length;
    this.ensureSizes();
    this.loadPersisted();
    // No-op on first mount (`baseEl` doesn't exist until the first render —
    // `firstUpdated()` below arms it then) but does the real work on a
    // reconnect, whose shadow DOM content survives disconnect. Mirrors
    // lite-chart.ts's identical connectedCallback/firstUpdated split for its
    // own ResizeObserver.
    if (this.collapse !== 'none') this.armCollapseObserver();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice the floating drawer is still active -- restore its shared
    // registration and scroll lock. Mirrors lyra-app-rail's identical
    // reconnect handling for its mobile overlay.
    if (this.hasUpdated && this.overlayActive) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateFloatingOverlay();
      }
      if (!this.releaseScrollLock) this.releaseScrollLock = lockScroll(this.ownerDocument);
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up any remaining event listeners from an in-flight drag.
    this.drags.clear();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
    this.collapseResizeObserver?.disconnect();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.suspend();
  }

  protected firstUpdated(): void {
    if (this.collapse !== 'none') this.armCollapseObserver();
  }

  /** Both branches here derive one reactive property from another with no
   *  DOM measurement involved, so they belong in `willUpdate()` rather than
   *  `updated()`: setting a reactive property from `updated()`/
   *  `firstUpdated()` schedules a *second* update on top of the one that
   *  just finished, which Lit's dev-mode console flags ("scheduled an
   *  update ... after an update completed"). Both of these were real and
   *  reproducible in normal usage, not just test artifacts --
   *  `ensureSizes()` on any direct `sizes` assignment whose length doesn't
   *  match `panelCount` (e.g. a consumer correcting a stale layout), and the
   *  `collapseState` reset on every `collapse` -> `'none'` transition. The
   *  `collapse !== 'none'` re-arm path in `syncCollapseObserver()` still
   *  needs a freshly measured container width and stays in `updated()` --
   *  see `armCollapseObserver()`'s own doc comment for why *that* one is the
   *  documented exception instead (mirrors virtual-list.ts's
   *  `attachContainerListeners()`). */
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('sizes') || this.sizes.length === 0) this.ensureSizes();
    if (changed.has('collapse') && this.collapse === 'none') {
      this.resetCollapseState();
    }
    if (changed.has('open') || changed.has('collapseState')) {
      const next = this._collapseState === 'floating' && this.open;
      if (next !== this.overlayActive) {
        this.overlayActive = next;
        if (next) {
          this.justOpened = true;
          this.activateFloatingOverlay();
        } else {
          this.deactivateFloatingOverlay();
        }
      }
    }
  }

  /**
   * The collapsing pane's current responsive state. Always one of the three
   * real states — never `'auto'` — reflecting either the live measured
   * width or, once forced, whatever was last assigned. See the class doc for
   * the full force/auto contract (mirrors `<lyra-app-rail>`'s `mode`).
   */
  get collapseState(): SplitCollapseState {
    return this._collapseState;
  }
  set collapseState(next: SplitCollapseStateInput) {
    if (next === 'auto') {
      this._forced = false;
      this.updateCollapseState(this.currentMeasuredWidth());
      return;
    }
    this._forced = true;
    this.applyCollapseStateChange(next);
  }

  /** The container width (px) `[part="base"]` is measured at right now --
   *  used to re-derive `collapseState` immediately when a forced value is
   *  released back to `'auto'`, outside of the `ResizeObserver`'s own
   *  (async, entry-driven) callback. Mirrors the synchronous initial read
   *  `armCollapseObserver()` already does when it (re-)arms. */
  private currentMeasuredWidth(): number {
    return this.baseEl?.clientWidth ?? 0;
  }

  /** Resets `collapseState` back to its `'wide'` default and releases any
   *  force, bypassing the public accessor's pin/event-emit side effects --
   *  used only for the `collapse -> 'none'` housekeeping reset in
   *  `willUpdate()`, which is purely internal bookkeeping (the feature is
   *  off entirely), not a state transition a consumer forced or observed. */
  private resetCollapseState(): void {
    this._forced = false;
    if (this._collapseState === 'wide') return;
    const old = this._collapseState;
    this._collapseState = 'wide';
    this.requestUpdate('collapseState', old);
  }

  /** Applies an actual `collapseState` transition (no-op if `next` matches
   *  the current value): updates the field, triggers Lit's reflect/re-render
   *  via `requestUpdate`, and fires `lyra-split-collapse-change`. Shared by
   *  both the `ResizeObserver`-driven measurement path (`updateCollapseState`)
   *  and the accessor's forced-value assignment, so the two never duplicate
   *  this logic. Leaving `'floating'` while `open` is still `true` also
   *  closes the drawer -- mirrors `<lyra-app-rail>` closing its mobile
   *  overlay when `mode` leaves `'mobile'` while open. */
  private applyCollapseStateChange(next: SplitCollapseState): void {
    if (next === this._collapseState) return;
    const old = this._collapseState;
    this._collapseState = next;
    this.requestUpdate('collapseState', old);
    this.emit<SplitCollapseChangeDetail>('lyra-split-collapse-change', { state: next });
    if (next !== 'floating' && this.open) this.open = false;
  }

  private get storageFullKey(): string | undefined {
    return this.storageKey ? `lyra-split:${this.storageKey}:${this.panelCount}` : undefined;
  }

  private loadPersisted(): void {
    const key = this.storageFullKey;
    if (!key) return;
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* localStorage unavailable (private browsing, sandboxed iframe, etc.) */
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as number[];
      // A persisted layout can predate a since-raised `min`; reject it rather
      // than restoring sizes that are already stuck below the current floor.
      const isValid =
        Array.isArray(parsed) &&
        parsed.length === this.panelCount &&
        parsed.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= this.min);
      if (isValid) this.sizes = parsed;
    } catch {
      /* ignore malformed persisted state */
    }
  }

  private persist(): void {
    const key = this.storageFullKey;
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(this.sizes));
    } catch {
      /* ignore persistence failures (e.g. quota exceeded, private browsing) */
    }
  }

  private ensureSizes(): void {
    if (this.panelCount === this.sizes.length) return;
    if (this.panelCount <= 0) {
      this.sizes = [];
      return;
    }
    if (this.sizes.length === 0) {
      const equal = 100 / this.panelCount;
      this.sizes = Array.from({ length: this.panelCount }, () => equal);
      return;
    }
    // A panel was added or removed: rebalance the existing sizes
    // proportionally instead of discarding every panel's customized size,
    // so an unrelated panel-count change doesn't wipe the whole layout.
    const diff = this.panelCount - this.sizes.length;
    if (diff > 0) {
      const newShare = 100 / this.panelCount;
      const scale = (100 - newShare * diff) / 100;
      this.sizes = [
        ...this.sizes.map((s) => s * scale),
        ...Array.from({ length: diff }, () => newShare),
      ];
    } else {
      const kept = this.sizes.slice(0, this.panelCount);
      const removedTotal = this.sizes.slice(this.panelCount).reduce((sum, s) => sum + s, 0);
      const keptTotal = kept.reduce((sum, s) => sum + s, 0) || 1;
      this.sizes = kept.map((s) => s + (s / keptTotal) * removedTotal);
    }
  }

  private onSlotChange = (): void => {
    this.panelCount = this.children.length;
    this.ensureSizes();
  };

  /** The container extent (px) along the resize axis, read live so a
   *  container resize between calls is always picked up — same live read
   *  `onPointerMove` already does via `drag.base.clientWidth/clientHeight`. */
  private getContainerSize(): number {
    if (!this.baseEl) return 0;
    return this.orientation === 'vertical' ? this.baseEl.clientHeight : this.baseEl.clientWidth;
  }

  /** The physical panel index `collapse: 'start' | 'end'` resolves to, or
   *  `-1` when collapse is off (`'none'`) or there are fewer than 2 panels
   *  to collapse one of. Panels are laid out via ascending inline `order`
   *  (see `updated()`) and that ordering is never re-swapped for RTL — only
   *  the drag/keyboard *delta sign* mirrors for RTL, exactly like
   *  `onPointerMove`/`onDividerKeyDown` — so panel index 0 already renders
   *  at the logical inline-start edge under both LTR and RTL (confirmed by
   *  the pointer-drag RTL test elsewhere in this file: panel 0 renders on
   *  the visual *right*, i.e. the RTL inline-start side). `'start'` therefore
   *  always resolves to index 0 and `'end'` to `panelCount - 1`, regardless
   *  of `isRtl(this)` — consulting it here would swap collapse onto the
   *  panel that visually sits at the *other* logical edge, which would be a
   *  bug against this component's own RTL rendering, not a fix for one.
   */
  private get collapsingIndex(): number {
    if (this.collapse === 'none' || this.panelCount < 2) return -1;
    return this.collapse === 'start' ? 0 : this.panelCount - 1;
  }

  /** Whether a pane is actually collapsed (rail or floating) right now —
   *  `false` whenever `collapse === 'none'`, since `collapseState` then
   *  never leaves its `'wide'` default. */
  private get collapseActive(): boolean {
    return this.collapsingIndex !== -1 && this.collapseState !== 'wide';
  }

  /** Dragging/keyboard-resizing is disabled on the one divider immediately
   *  adjacent to the currently-collapsed pane (its other side has nothing
   *  meaningful to resize against while the pane is rail/floating-width). */
  private isDividerDisabled(index: number): boolean {
    if (!this.collapseActive) return false;
    const adjacent = this.collapsingIndex === 0 ? 0 : this.panelCount - 2;
    return index === adjacent;
  }

  /** Classifies a measured container width into the collapsing pane's
   *  responsive state and, only on an actual transition, applies it (via the
   *  same `applyCollapseStateChange()` the accessor's forced-value path
   *  uses). Gated behind `_forced` so a pinned `collapseState` is never
   *  silently overwritten by a subsequent resize — this is also what the
   *  accessor's `'auto'` release calls (with the current measured width) to
   *  re-derive the state without duplicating the width-vs-breakpoint logic. */
  private updateCollapseState(width: number): void {
    if (this.collapse === 'none') return;
    if (this._forced) return;
    const next: SplitCollapseState =
      width < this.floatBreakpoint ? 'floating' : width < this.railBreakpoint ? 'rail' : 'wide';
    this.applyCollapseStateChange(next);
  }

  /** Creates (idempotently) and (re-)observes `[part="base"]` with the
   *  collapse-state `ResizeObserver` — a no-op until `baseEl` exists (see
   *  `firstUpdated()`/`connectedCallback()`). Mirrors lite-chart.ts's own
   *  ResizeObserver setup, including reading the box size synchronously
   *  once so the very first render doesn't sit at the stale `'wide'` default
   *  until the (async) first callback fires — same rationale as
   *  lyra-virtual-list's `containerResizeObserver` synchronous initial read. */
  private armCollapseObserver(): void {
    if (!this.collapseResizeObserver) {
      this.collapseResizeObserver = new ResizeObserver((entries) => {
        const box = entries[0]?.contentBoxSize?.[0];
        const width = box ? box.inlineSize : (this.baseEl?.getBoundingClientRect().width ?? 0);
        this.updateCollapseState(width);
      });
    }
    if (this.baseEl) {
      this.collapseResizeObserver.observe(this.baseEl);
      this.updateCollapseState(this.baseEl.clientWidth);
    }
  }

  /** Reacts to a live `collapse` property change (as opposed to the
   *  connect/first-render arming above): turns the observer on/off. The
   *  `collapseState` reset for the `'none'` case lives in `willUpdate()`
   *  instead (see its doc comment) so no stale rail/floating styling
   *  survives switching collapse off, without the extra render pass a
   *  property set here would cost. */
  private syncCollapseObserver(): void {
    if (this.collapse === 'none') {
      this.collapseResizeObserver?.disconnect();
      return;
    }
    this.armCollapseObserver();
  }

  /** The safe fallback for a shared percent minimum. A value above the
   *  available share is still useful as a consumer intent, but it cannot be
   *  honored for every panel at once, so reduce it proportionally. */
  private normalizedDefaultMin(): number {
    if (this.panelCount <= 0) return 0;
    const requested = Number.isFinite(this.min) ? Math.max(0, this.min) : 0;
    // Leave one keyboard step of aggregate slack after rejecting an
    // infeasible configuration, so an equal starting layout remains
    // resizable instead of merely becoming a different frozen layout.
    const available = Math.max(0, 100 - KEYBOARD_STEP);
    return Math.min(requested, available / this.panelCount);
  }

  /** Resolves all panel bounds together so aggregate feasibility is checked
   *  before an individual divider is asked to clamp a pair. An invalid set is
   *  rejected as a whole: interaction uses the safe shared minimum instead of
   *  exposing a divider whose minimum is greater than its maximum. */
  private resolveConstraintBounds(containerSize: number): ConstraintResolution {
    const fallbackMin = this.normalizedDefaultMin();
    const fallback = Array.from({ length: this.panelCount }, () => ({ min: fallbackMin, max: Infinity }));
    if (this.panelCount <= 0) return { bounds: [], usePanelConstraints: true };

    const bounds: Array<{ min: number; max: number }> = [];
    let minimumTotal = 0;
    let maximumTotal = 0;
    let hasUnboundedMaximum = false;
    let issueReason: SplitConstraintIssueReason | undefined;

    for (let index = 0; index < this.panelCount; index++) {
      const constraint = this.panelConstraints[index];
      let min = Number.isFinite(this.min) ? Math.max(0, this.min) : 0;
      let max = Infinity;
      if (constraint) {
        if (constraint.minPx != null && Number.isFinite(constraint.minPx) && constraint.minPx >= 0 && containerSize > 0) {
          min = (constraint.minPx / containerSize) * 100;
        }
        if (constraint.maxPx != null && Number.isFinite(constraint.maxPx) && constraint.maxPx >= 0 && containerSize > 0) {
          max = (constraint.maxPx / containerSize) * 100;
        }
        if (
          (constraint.minPx != null && (!Number.isFinite(constraint.minPx) || constraint.minPx < 0)) ||
          (constraint.maxPx != null && (!Number.isFinite(constraint.maxPx) || constraint.maxPx < 0))
        ) {
          issueReason ??= 'minimum-exceeds-maximum';
        }
      }
      if (min > max) issueReason ??= 'minimum-exceeds-maximum';
      bounds.push({ min, max });
      minimumTotal += min;
      if (Number.isFinite(max)) maximumTotal += max;
      else hasUnboundedMaximum = true;
    }

    if (issueReason == null && minimumTotal > 100 + 1e-9) issueReason = 'minimum-total';
    if (issueReason == null && !hasUnboundedMaximum && maximumTotal < 100 - 1e-9) issueReason = 'maximum-total';
    if (issueReason == null) return { bounds, usePanelConstraints: true };

    return {
      bounds: fallback,
      usePanelConstraints: false,
      issue: {
        reason: issueReason,
        panelCount: this.panelCount,
        minimumTotal,
        maximumTotal: hasUnboundedMaximum ? null : maximumTotal,
        containerSize,
      },
    };
  }

  private percentBounds(index: number, containerSize: number): { min: number; max: number } {
    return this.resolveConstraintBounds(containerSize).bounds[index] ?? { min: 0, max: Infinity };
  }

  private clampPair(sizes: number[], i: number, delta: number, containerSize = 0): number[] {
    const next = [...sizes];
    const pairTotal = next[i] + next[i + 1];
    const a = this.percentBounds(i, containerSize);
    const b = this.percentBounds(i + 1, containerSize);
    // Panel i's own bounds, further narrowed by panel i+1's bounds (its
    // partner's min/max caps how much i can grow/shrink within the pair).
    const loRaw = Math.max(a.min, pairTotal - b.max);
    const hiRaw = Math.min(a.max, pairTotal - b.min);
    // Clamp *toward* the bound instead of rejecting the whole move when the
    // result is still outside it — otherwise a pair that starts under its
    // combined min (e.g. an equal split across many panels) can never be
    // moved at all, since every step recomputes the same rejected delta from
    // the same untouched starting sizes.
    const lo = Math.min(loRaw, pairTotal);
    const hi = Math.max(hiRaw, lo);
    const clampedA = Math.min(Math.max(next[i] + delta, lo), hi);
    next[i] = clampedA;
    next[i + 1] = pairTotal - clampedA;
    return next;
  }

  private applyDelta(index: number, delta: number, commit: boolean): void {
    this.sizes = this.clampPair(this.sizes, index, delta, this.getContainerSize());
    this.emit('lyra-resize', { sizes: [...this.sizes] });
    if (commit) this.persist();
  }

  /** The collapsing pane's light-DOM element itself — the `'floating'`
   *  drawer's focus-trap/backdrop target. There's no separate shadow-DOM
   *  panel to trap focus within (unlike `<lyra-app-rail>`'s `[part="panel"]`):
   *  the slotted panel *is* the floating drawer, just repositioned via
   *  inline styles in `updated()`. */
  private get floatingPanelEl(): HTMLElement | null {
    const index = this.collapsingIndex;
    return index === -1 ? null : ((this.children[index] as HTMLElement | undefined) ?? null);
  }

  private activateFloatingOverlay(): void {
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.floatingPanelEl,
      onEscape: () => (this.open = false),
      onBackdrop: () => (this.open = false),
    });
  }

  private deactivateFloatingOverlay(): void {
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.deactivate();
    this.overlayHandle = undefined;
  }

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  private onPointerDown = (e: PointerEvent, index: number): void => {
    // The divider adjacent to a currently rail/floating-collapsed pane isn't
    // draggable — mirrors the `[part="divider"][aria-disabled="true"]`
    // `pointer-events: none` in split.styles.ts (belt-and-suspenders: this
    // guard also covers a synthetic/programmatic pointerdown that CSS
    // wouldn't stop).
    if (this.isDividerDisabled(index)) return;
    // The divider that dispatched this is itself a child of [part="base"],
    // so baseEl is guaranteed to be already rendered here.
    this.drags.set(e.pointerId, {
      index,
      startPos: this.orientation === 'vertical' ? e.clientY : e.clientX,
      base: this.baseEl!,
      appliedDelta: 0,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup
    // or the divider keeps "resizing" in response to unrelated movement.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (!drag) return;
    const total = this.orientation === 'vertical' ? drag.base.clientHeight : drag.base.clientWidth;
    const pos = this.orientation === 'vertical' ? e.clientY : e.clientX;
    let cumulativeDelta = ((pos - drag.startPos) / total) * 100;
    // Panels are ordered along the inline axis via CSS `order`, so under RTL
    // `flex-direction: row` already renders panel[i] to the *right* of
    // panel[i+1] — a physically-rightward drag has to shrink index instead
    // of growing it to keep matching the visible panel under the pointer.
    if (this.orientation === 'horizontal' && isRtl(this)) cumulativeDelta = -cumulativeDelta;
    // Clamp against the *current* live sizes, not this pointer's own drag-start
    // snapshot -- two adjacent dividers dragged concurrently share one panel
    // between them, and each clamp pass must see whatever the other pointer's
    // move has *just* written, or the two independently-clamped pairs can each
    // stay individually valid while their shared panel drifts past what either
    // pair alone would allow, letting the total exceed 100%. Since the clamp
    // basis is now the live, already-partially-applied `this.sizes` instead of
    // a fixed drag-start snapshot, only the *incremental* delta since the last
    // move may be applied here (not the cumulative-since-drag-start delta a
    // snapshot-based clamp would use).
    const incremental = cumulativeDelta - drag.appliedDelta;
    const priorValue = this.sizes[drag.index];
    const paired = this.clampPair(this.sizes, drag.index, incremental, total);
    // Accumulate this move's own *realized* increment (post-clamp) onto the
    // running total, rather than recomputing an absolute "total since
    // drag-start" diff against a fixed startSizes snapshot. clampPair can
    // cap the actual move short of what was requested (e.g. a drag
    // saturating a panel's min/panelConstraints bound), so the realized
    // portion still has to be tracked instead of the raw request -- that
    // part of round 1's fix stands. But an absolute since-start diff also
    // silently absorbs any change a DIFFERENT concurrent pointer's drag
    // makes to this same shared panel between this pointer's own moves
    // (adjacent dividers share one panel: divider i's index+1 panel is
    // divider i+1's index panel), corrupting this pointer's next incremental
    // calculation. Summing only this move's own delta (paired vs. the value
    // immediately prior to *this* clamp) avoids both bugs at once.
    drag.appliedDelta += paired[drag.index] - priorValue;
    // Merge only this drag's pair into the live sizes so a concurrent drag
    // on another divider (different pointerId) isn't clobbered.
    const next = [...this.sizes];
    next[drag.index] = paired[drag.index];
    next[drag.index + 1] = paired[drag.index + 1];
    this.sizes = next;
    this.emit('lyra-resize', { sizes: [...this.sizes] });
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.drags.has(e.pointerId)) return;
    this.drags.delete(e.pointerId);
    this.persist();
    if (this.drags.size === 0) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
  };

  private onDividerKeyDown = (e: KeyboardEvent, index: number): void => {
    // Same rail/floating-adjacent guard as onPointerDown.
    if (this.isDividerDisabled(index)) return;
    // Mirror the same swap as onPointerMove for horizontal+RTL.
    const rtl = this.orientation === 'horizontal' && isRtl(this);
    const forwardKey = this.orientation === 'vertical' ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.orientation === 'vertical' ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey) {
      e.preventDefault();
      this.applyDelta(index, KEYBOARD_STEP, true);
    } else if (e.key === backwardKey) {
      e.preventDefault();
      this.applyDelta(index, -KEYBOARD_STEP, true);
    }
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('collapse')) this.syncCollapseObserver();
    const constraintResolution = this.resolveConstraintBounds(this.getContainerSize());
    const issue = constraintResolution.issue;
    const issueKey = issue
      ? `${issue.reason}:${issue.panelCount}:${issue.minimumTotal}:${issue.maximumTotal ?? 'unbounded'}`
      : '';
    if (issueKey !== this.constraintIssueKey) {
      this.constraintIssueKey = issueKey;
      if (issue) this.emit<SplitConstraintIssueDetail>('lyra-split-constraints-invalid', issue);
    }
    const panels = [...this.children] as HTMLElement[];
    const current = new Set(panels);
    // A panel that dropped out of the slot (removed from the light DOM)
    // still carries whatever inline flex/order (and, while collapsing,
    // position/inset/inline-size) this method last applied to it — clear
    // those before that DOM node potentially gets reused elsewhere (e.g.
    // re-slotted into another split/container).
    for (const stale of this.stylizedPanels) {
      if (!current.has(stale)) {
        stale.style.removeProperty('flex');
        stale.style.removeProperty('order');
        stale.style.removeProperty('position');
        stale.style.removeProperty('inset-block');
        stale.style.removeProperty('inset-inline-start');
        stale.style.removeProperty('inset-inline-end');
        stale.style.removeProperty('inline-size');
        stale.hidden = false;
        delete stale.dataset.collapseState;
      }
    }
    // Resolved once per pass rather than per panel: which physical index (if
    // any) is actually collapsed right now — `-1` covers both `collapse ===
    // 'none'` (the default) and a `collapse !== 'none'` pane that's still in
    // its normal `'wide'` state, so every panel below falls straight through
    // to the exact pre-existing (non-collapse) styling in either case.
    const collapsingIndex = this.collapseActive ? this.collapsingIndex : -1;
    panels.forEach((panel, i) => {
      const percent = this.sizes[i] ?? 0;
      const constraint = constraintResolution.usePanelConstraints ? this.panelConstraints[i] : undefined;
      // Collapse-only inline styles are always cleared first, then
      // re-applied below only for the panel(s) that need them this pass —
      // simpler than diffing which of the 5 properties changed.
      panel.style.removeProperty('position');
      panel.style.removeProperty('inset-block');
      panel.style.removeProperty('inset-inline-start');
      panel.style.removeProperty('inset-inline-end');
      panel.style.removeProperty('inline-size');
      panel.hidden = false;

      if (collapsingIndex === i && this.collapseState === 'rail') {
        // Fixed rail width instead of the normal clamp()/percent flex-basis.
        panel.style.flex = `0 0 ${this.railWidth}`;
      } else if (collapsingIndex === i && this.collapseState === 'floating' && !this.open) {
        // Hidden-by-default drawer (see the class doc): rendering nothing
        // (not just visually collapsed, so it's out of the accessibility
        // tree too) until a consumer sets `open`. The pane still vacates the
        // flex flow the same way the open/floating branch below does, via
        // `hidden`'s UA `display: none` rather than `position: absolute`, so
        // the other pane below still grows to fill the space regardless of
        // which of the two branches applied.
        panel.style.flex = 'none';
        panel.hidden = true;
      } else if (collapsingIndex === i && this.collapseState === 'floating') {
        // `this.open` is true here. Lifted out of the flex flow entirely as
        // an overlay card, anchored to its own logical start/end edge,
        // spanning the full cross-axis extent — [part="base"] carries
        // `position: relative` for this to anchor against (see
        // split.styles.ts). Sized at its own normal percent width (i.e. what
        // it would render at in the `'wide'` state), so there's no visual
        // size jump the moment it un-floats.
        panel.style.flex = 'none';
        panel.style.position = 'absolute';
        panel.style.setProperty('inset-block', '0');
        panel.style.setProperty(collapsingIndex === 0 ? 'inset-inline-start' : 'inset-inline-end', '0');
        panel.style.setProperty('inline-size', `${percent}%`);
      } else if (collapsingIndex !== -1 && i !== collapsingIndex) {
        // The pane(s) sharing the split with a currently rail/floating
        // collapsed pane: grow to fill whatever space that pane no longer
        // occupies (its full percent-basis space while floating, or
        // percent-basis-minus-railWidth while railed), proportionally to
        // their own relative `sizes` share for a 3+-panel split.
        panel.style.flex = `${percent} 1 0%`;
      } else {
        // clamp() mixes units natively, so a constrained panel stays pinned
        // between its px bounds across container resizes with no extra
        // ResizeObserver — the browser re-evaluates it on every layout pass.
        panel.style.flex =
          constraint && (constraint.minPx != null || constraint.maxPx != null)
            ? `0 0 clamp(${constraint.minPx ?? NO_MIN_PX}px, ${percent}%, ${constraint.maxPx ?? NO_MAX_PX}px)`
            : `0 0 ${percent}%`;
      }
      panel.style.order = String(i * 2);

      if (collapsingIndex === i) {
        panel.dataset.collapseState = this.collapseState;
      } else {
        delete panel.dataset.collapseState;
      }
    });
    this.stylizedPanels = current;

    // Host-level marker (mirrors the per-panel `dataset.collapseState`
    // above) for simple external CSS targeting of the whole component's
    // current state, e.g. `lyra-split[data-collapse-state="rail"] + aside`.
    // Absent whenever there's nothing collapsed to report (`collapse ===
    // 'none'` or still `'wide'`), same as the per-panel marker.
    if (collapsingIndex !== -1) {
      this.setAttribute('data-collapse-state', this.collapseState);
    } else {
      this.removeAttribute('data-collapse-state');
    }

    // Runs after this render (not willUpdate) so the floating panel's
    // repositioned geometry above has already landed before the focus call
    // below can rely on it -- mirrors lyra-app-rail's/lyra-dialog's identical
    // ordering rationale for their own overlay's initial focus.
    if (this.justOpened) {
      this.justOpened = false;
      this.overlayHandle?.focusInitial();
    }
  }

  render(): TemplateResult {
    const dividers: TemplateResult[] = [];
    const bounds = this.resolveConstraintBounds(this.getContainerSize()).bounds;
    for (let i = 0; i < this.panelCount - 1; i++) {
      // The achievable range is bounded by both adjacent panels, not the
      // whole track — pushing past it would starve the partner even though
      // this pair still has room. Keep max >= min for imperfect persisted or
      // consumer-supplied starting sizes.
      const pairTotal = (this.sizes[i] ?? 0) + (this.sizes[i + 1] ?? 0);
      const a = bounds[i] ?? { min: 0, max: Infinity };
      const b = bounds[i + 1] ?? { min: 0, max: Infinity };
      const valueMin = Math.max(a.min, pairTotal - b.max);
      const valueMax = Math.max(valueMin, Math.min(a.max, pairTotal - b.min));
      const disabled = this.isDividerDisabled(i);
      dividers.push(html`<div
        part="divider"
        role="separator"
        aria-label="Resize divider between panel ${i + 1} and panel ${i + 2}"
        aria-orientation=${this.orientation === 'vertical' ? 'horizontal' : 'vertical'}
        aria-valuenow=${Math.round(this.sizes[i] ?? 0)}
        aria-valuemin=${Math.round(valueMin)}
        aria-valuemax=${Math.round(valueMax)}
        aria-disabled=${disabled ? 'true' : nothing}
        tabindex=${disabled ? '-1' : '0'}
        style=${`order:${i * 2 + 1}`}
        @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, i)}
        @keydown=${(e: KeyboardEvent) => this.onDividerKeyDown(e, i)}
      ></div>`);
    }
    const showBackdrop = this.collapseState === 'floating' && this.open;
    return html`<div part="base">
      <slot @slotchange=${this.onSlotChange}></slot>
      ${dividers}
      ${showBackdrop ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
    </div>`;
  }
}

defineElement('split', LyraSplit);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-split': LyraSplit;
  }
}
