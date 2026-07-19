import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { lockScroll } from '../../../internal/scroll-lock.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { nextId, hasRealContent } from '../../../internal/a11y.js';
import { place, trackRect } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteInteger, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { styles } from './tour.styles.js';

/** Default distance (px) between the target and the popover -- see `LyraTour.distance`. */
const DEFAULT_DISTANCE = 12;
/** Default extra px between a target's own box and the spotlight cutout/ring -- see
 *  `LyraTour.spotlightPadding`. */
const DEFAULT_SPOTLIGHT_PADDING = 4;

/**
 * Resolves the element a step spotlights/anchors to. A `string` is resolved via
 * `this.ownerDocument.querySelector<HTMLElement>(target)` (top-level light DOM only -- CSS
 * selectors can't pierce a closed shadow root); pass a direct `HTMLElement` or a resolver
 * function for anything else (inside a shadow root, not yet mounted, computed dynamically).
 * Re-resolved every time this step becomes active (never cached) so a target that mounts later
 * in the app's lifecycle still resolves correctly once its own step is reached. A direct
 * `HTMLElement` reference is checked for `isConnected` on every re-resolution (same
 * target-missing handling as a selector/function that returns nothing) since, unlike a selector
 * string, a stale element reference can't "self-heal" across a DOM remount -- prefer a `string`
 * or function resolver for targets that might be replaced while the tour runs.
 */
export type TourTarget = string | HTMLElement | (() => HTMLElement | null);

export interface TourStep {
  /** Stable id for this step. Used in event details/DOM bookkeeping, never shown to the user. */
  id: string;
  /** The element this step spotlights and anchors its popover to. */
  target: TourTarget;
  /** Visible step heading -- becomes the popover panel's accessible name via `aria-labelledby`.
   *  Required: every step always has a name, so `<lr-tour>` never needs a generic fallback
   *  label of its own. Plain text; not localized by this component (caller-supplied data, per
   *  the library's i18n exception for app content). */
  heading: string;
  /** Visible step body copy. Rendered as plain text (Lit auto-escapes -- no HTML/markdown
   *  parsing). Ignored for the currently active step if the default slot carries real content
   *  (see the class doc's Slots section) -- the slot wins when both are present. */
  content?: string;
  /** Per-step Floating UI placement override. Falls back to the tour-level `placement` prop
   *  (`'bottom'`) when omitted. Resolved through `rtlAwarePlacement()` before being passed to
   *  `place()`, same as `lr-menu`/`lr-popover`. */
  placement?: Placement;
  /** Per-step override of the tour-level `spotlightPadding` prop (`4`). Extra px between the
   *  target's own box and the spotlight cutout/ring. `distance` (the offset between the target
   *  and the popover itself) is a tour-level-only setting -- it has no per-step override. */
  spotlightPadding?: number;
  /** Opts this step's target OUT of the tour's default non-interactive-spotlight behavior --
   *  see the class doc's "Target interactivity" section. Defaults to `false`. */
  interactiveTarget?: boolean;
  /** Hides the Previous control outright (not just disables it) for this step -- e.g. a step
   *  reached only via a side effect that can't be cleanly reversed. Defaults to `false`; compare
   *  with the first step, whose Previous control is disabled-but-visible instead, for a stable
   *  footer layout across steps. */
  hidePrevious?: boolean;
}

/**
 * Reason a tour ended, forwarded as the `lr-tour-end` event detail.
 * `'completed'`/`'skip'`/`'escape'` are emitted by the tour's own built-in dismiss triggers;
 * `'unmount'` is emitted when the tour is removed from the DOM while still open by something
 * other than its own `end()` (mirrors `lr-dialog`'s identical `'unmount'` case); any other
 * string is whatever a caller passes to `end()` directly.
 */
export type TourEndReason =
  | 'completed'
  | 'skip'
  | 'escape'
  | 'api'
  | 'unmount'
  | (string & Record<never, never>);

export interface LyraTourEventMap {
  'lr-tour-start': CustomEvent<{ index: number }>;
  'lr-tour-step-change': CustomEvent<{
    index: number;
    previousIndex: number;
    step: TourStep;
    via: 'next' | 'back' | 'goto';
  }>;
  'lr-tour-end': CustomEvent<TourEndReason>;
  'lr-tour-target-missing': CustomEvent<{ index: number; step: TourStep }>;
}

// Punches a rectangular hole (viewport minus the padded target rect) into the backdrop's own
// clip-path via the standard "keyhole" polygon technique: trace the full-viewport rectangle,
// slit inward to the target rectangle along a zero-width bridge (traversed once in, once back
// out along the exact same line so it contributes no net area), then trace the target rectangle
// itself. `evenodd` fill-rule turns the doubled-back bridge into a no-op and leaves the target
// rectangle excluded from the clipped (hit-testable, rendered) region -- this is what lets a
// pointer event fall through to the live page content underneath when a step opts into
// `interactiveTarget`.
function keyholeClipPath(x: number, y: number, width: number, height: number): string {
  const right = x + width;
  const bottom = y + height;
  return (
    `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ` +
    `${x}px ${y}px, ${x}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${y}px, ${x}px ${y}px, 0% 0%)`
  );
}

/**
 * `<lr-tour>` -- a spotlight-and-step guided walkthrough for first-run onboarding. A sequence
 * of steps, each anchored to a target element elsewhere in the page via the shared Floating UI
 * positioner, shown against a dimmed full-viewport backdrop with a cutout/ring highlighting the
 * current target, with Next/Previous/Skip controls and a step-progress indicator. First-party
 * invention (no Web Awesome equivalent) -- nearest precedent in shape is `lr-dialog` (overlay
 * lifecycle/focus trap) + `lr-carousel` (index-based navigation) + `lr-stepper`
 * (progress/RTL arrow-key nav).
 *
 * **Not a form-associated control.** A tour is a walkthrough, not a field -- it deliberately has
 * no `label`/`hint`/`error` chrome and no `FormAssociated` mixin.
 *
 * **Controlled component.** `steps` is never mutated by this component (mirrors
 * `lr-stepper`'s `steps`); only `activeIndex` and `open` are self-managed, mirroring
 * `lr-carousel`'s `index`.
 *
 * **Target interactivity.** By default, the step's spotlighted target is non-interactive while
 * its step is active: it stays visually revealed and perceivable/announceable by assistive tech
 * (not `inert`, not `aria-hidden`) but cannot be clicked -- every pointer event over the full
 * viewport, including directly over the visually-revealed target, is captured by the backdrop
 * (CSS `mask` does not affect hit-testing, only `clip-path` does) -- and cannot be reached by Tab
 * (the shared overlay focus trap confines Tab to the popover panel). Set `step.interactiveTarget`
 * to opt a step's target out of this: the backdrop additionally clips itself (via `clip-path`,
 * which *does* affect hit-testing) around the same rect, so pointer/click events fall through to
 * the live target underneath. This only restores pointer/click reachability, not Tab
 * reachability -- the focus trap still confines keyboard focus to the step popover regardless of
 * `interactiveTarget`. If the interaction a step demonstrates must also be keyboard-reachable,
 * don't rely on Tab to reach the live target -- have the app's own listener on the target call
 * `tourEl.next()` to advance the tour programmatically.
 *
 * **Focus management.** Uses the shared overlay manager with `modal: false` -- a deliberate
 * choice, not an oversight. The default `modal: true` would mark the entire rest of the page
 * (including the spotlighted target itself, since it lives outside `<lr-tour>`'s own ancestor
 * chain) `inert`, stripping it from the accessibility tree entirely -- stronger than the
 * "non-interactive but still perceivable" default described above. `modal: false` skips that
 * DOM-wide `inert` marking; the shared Tab-trap still confines keyboard Tab to the popover panel
 * unconditionally regardless of `modal`, and the backdrop's own hit-testing handles
 * pointer/click reachability, so nothing is lost. `role="dialog"` and `aria-modal="true"` are
 * still rendered on the popover panel anyway: most screen readers restrict their own virtual-
 * cursor/browse-mode navigation to an `aria-modal="true"` element's subtree, giving assistive-
 * tech users the same "can perceive, can't wander into, the live target" experience that the
 * Tab-trap and backdrop hit-testing already give sighted/mouse users.
 *
 * Each step transition mounts a genuinely new popover DOM node (keyed on the step's `id`) so
 * focus reliably re-enters the panel every time, even though the Previous/Next button that
 * triggered the transition lives inside that same persistent-looking region.
 *
 * No `Home`/`End` jump-to-first/last-step shortcut and no click-to-jump progress dots, unlike
 * `lr-stepper` -- a tour's steps are tied to live DOM targets that may not exist until an
 * earlier step's side effect (opening a menu, navigating a route) has run, so free jumping is
 * unsafe by default. `goToStep()` remains available for a host that knows what it's doing (e.g.
 * a "restart tour" affordance elsewhere).
 *
 * @customElement lr-tour
 * @slot - Rich content overriding the currently active step's plain-text `content` for that step
 *   only. When real content is assigned, it's shown instead of `step.content`; when empty,
 *   `step.content` renders as plain text. Not scoped per step by this component itself -- a
 *   consumer that needs different rich content per step swaps the slotted children (or listens
 *   for `lr-tour-step-change` and re-renders them) itself, the same "consumer owns slotted
 *   content" pattern `lr-dialog`'s default slot already uses.
 * @event lr-tour-start - Fired by `start()`. `detail: { index }`. Not cancelable.
 * @event lr-tour-step-change - Fired by `next()`/`back()`/`goToStep()` before `activeIndex`
 *   changes. `detail: { index, previousIndex, step, via }`. Cancelable -- a listener calling
 *   `preventDefault()` leaves `activeIndex` unchanged, letting a tour gate advancement on a real
 *   action (e.g. an onboarding step demonstrating "click this button" shouldn't let Next silently
 *   skip past it). This is a deliberate departure from `lr-carousel`'s non-cancelable
 *   `lr-slide-change`.
 * @event lr-tour-end - Fired by `end()` (and by `next()` on the last step, with reason
 *   `'completed'`). `detail: TourEndReason`. Cancelable, except in practice for `'unmount'` since
 *   the element is already being removed -- mirrors `lr-dialog-close` exactly.
 * @event lr-tour-target-missing - The active step's `target` did not resolve to a connected
 *   element. `detail: { index, step }`. Not cancelable -- informational. The tour does not
 *   auto-end; it renders that step's popover unanchored (viewport-centered, no spotlight cutout)
 *   instead of throwing. A host can listen and decide to `skip()`/`goToStep()` in response.
 * @csspart backdrop - The full-viewport dimmed scrim with the spotlight cutout, an inline `<svg>`.
 *   `aria-hidden="true"`.
 * @csspart spotlight - The decorative highlight ring drawn around the current target's (padded)
 *   rect. `pointer-events: none`, `aria-hidden="true"`.
 * @csspart popover - The step panel itself. `role="dialog"`.
 * @csspart heading - The step's visible heading text element -- the `aria-labelledby` target.
 * @csspart body - Wrapper around the step's content (slotted or `step.content`).
 * @csspart progress - Wrapper around the built-in step-progress indicator (dots + text).
 * @csspart progress-dot - An individual decorative dot within `progress`. `aria-hidden="true"`.
 * @csspart progress-text - The visible "Step X of Y" text -- one of the popover's
 *   `aria-describedby` targets.
 * @csspart footer - Wrapper around the Previous/Skip/Next-or-Done control row.
 * @csspart skip-button - The Skip control.
 * @csspart previous-button - The Previous control.
 * @csspart next-button - The Next/Done control (label switches on the last step).
 * @cssprop --lr-tour-backdrop-color - Backdrop scrim fill. Defaults to `--lr-color-overlay`.
 * @cssprop --lr-tour-spotlight-radius - Corner radius shared by the cutout and the ring.
 *   Defaults to `--lr-radius`.
 * @cssprop --lr-tour-spotlight-ring-color - Spotlight ring color. Defaults to `--lr-color-brand`.
 * @cssprop --lr-tour-spotlight-ring-width - Spotlight ring thickness. Defaults to
 *   `--lr-border-width-medium`.
 * @cssprop --lr-tour-popover-max-width - Maximum popover inline size. Defaults to `--lr-size-22rem`.
 */
export class LyraTour extends LyraElement<LyraTourEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Whether the tour is open. Set this (or call `start()`/`end()`) -- there is no separate
   *  `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Ordered step data. Never mutated by this component -- see the class doc's controlled-
   *  component contract. Empty (the default) renders nothing. */
  @property({ attribute: false }) steps: TourStep[] = [];

  /** Index of the currently active step, clamped to `[0, steps.length - 1]` by `goToStep()` --
   *  and, for a direct property/attribute assignment that bypasses that method (e.g. two-way
   *  binding an external store, or a bad `active-index` attribute), normalized the same way in
   *  `willUpdate()` below. */
  @property({ type: Number, reflect: true, attribute: 'active-index' }) activeIndex = 0;

  /** Tour-level default Floating UI placement, overridable per step via `TourStep.placement`. */
  @property({ reflect: true }) placement: Placement = 'bottom';

  /** Distance (px) between the target and the popover, passed straight to Floating UI's
   *  `offset()` middleware -- a tour-level-only setting, mirroring `lr-popover`'s `distance`
   *  prop exactly (can legitimately be negative for overlap). */
  @property({ type: Number }) distance = DEFAULT_DISTANCE;

  /** Tour-level default extra px between a target's own box and the spotlight cutout/ring,
   *  overridable per step via `TourStep.spotlightPadding`. Non-negative. */
  @property({ type: Number, attribute: 'spotlight-padding' }) spotlightPadding = DEFAULT_SPOTLIGHT_PADDING;

  /** Whether a backdrop click dismisses the tour (`end('skip')`). Defaults to `false` -- a
   *  deliberate inversion of `lr-dialog`'s `noLightDismiss` (opt-out, default
   *  dismiss-on-backdrop-click): a guided tour's backdrop click doing nothing by default avoids
   *  losing onboarding progress to a stray click. Set this to restore dismiss-on-backdrop-click. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  /** Whether the built-in "Step X of Y" progress indicator (dots + text) renders in the footer. */
  @property({ type: Boolean, attribute: 'show-progress' }) showProgress = true;

  /** Host-level `aria-label` override for every step popover's accessible name -- wins over each
   *  step's own `heading`, matching `lr-dialog`'s `accessibleLabel` pattern. Most consumers
   *  won't need this since each step already has a meaningful name via `heading`; setting it
   *  makes the *same* string name every step's panel. Set as a plain `aria-label` attribute on
   *  `<lr-tour>` itself, not a public JS property. */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

  @state() private unanchored = false;
  @state() private hasSlotContent = false;

  private overlay?: OverlayHandle;
  private releaseScrollLock?: () => void;
  private placeCleanup?: () => void;
  private spotlightCleanup?: () => void;

  private readonly maskId = nextId('tour-mask');
  private readonly headingId = nextId('tour-heading');
  private readonly bodyId = nextId('tour-body');
  private readonly progressTextId = nextId('tour-progress-text');

  protected willUpdate(changed: PropertyValues): void {
    // Normalizes a direct `activeIndex` assignment (property or `active-index` attribute) that
    // bypasses `goToStep()`'s own `clampIndex()` -- e.g. two-way-binding an external store, or a
    // non-numeric `active-index` attribute (NaN via the `type: Number` converter). Setting the
    // property here, before render, is safe and doesn't schedule a second update -- same pattern
    // as this method's `unanchored` derivation below.
    if (changed.has('activeIndex')) {
      const maxIndex = Math.max(0, this.steps.length - 1);
      const normalizedIndex = finiteInteger(this.activeIndex, 0, 0, maxIndex);
      if (normalizedIndex !== this.activeIndex) this.activeIndex = normalizedIndex;
    }
    if (!this.hasUpdated) {
      this.hasSlotContent = hasRealContent(this.childNodes);
    }
    if (changed.has('open')) {
      if (this.open) {
        this.activateOverlayInternal();
      } else {
        this.deactivateOverlayInternal();
      }
    }
    // Resolved here, not in updated()/activateStep(), purely to derive `unanchored` -- a value
    // this same render branches on (the backdrop's mask-vs-plain-scrim markup, [part="popover"]'s
    // data-unanchored) -- before render runs, so the popover renders in its correct
    // anchored/unanchored shape on the first pass instead of needing a second corrective render.
    // resolveTarget() only ever queries the top-level document or calls an external resolver
    // function -- never this element's own render tree -- so it's safe to call this early, unlike
    // the DOM-measurement-dependent half of step activation (scrollIntoView/place()/trackRect(),
    // which need the freshly rendered popover and so still run from updated(), via
    // activateStep()). Setting a reactive property from updated()/firstUpdated() instead schedules
    // a *second* update on top of the one that just finished, which Lit's dev-mode console flags
    // ("scheduled an update ... after an update completed") -- mirrors lr-split's/
    // lr-virtual-list's identical willUpdate()-not-updated() fix for their own derived-property
    // writes.
    if ((changed.has('open') && this.open) || changed.has('activeIndex')) {
      const step = this.steps[this.activeIndex];
      this.unanchored = step ? !this.resolveTarget(step) : false;
    }
  }

  // Runs after render so the manager can resolve the (possibly just-swapped, per keyed()) panel,
  // and so activateStep() can query the freshly-rendered popover/spotlight/mask elements.
  protected updated(changed: PropertyValues): void {
    if ((changed.has('open') && this.open) || changed.has('activeIndex')) {
      this.overlay?.focusInitial();
      if (this.open) this.activateStep();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no update in between, so
    // willUpdate never reruns to notice `open` is still true -- restore the scroll lock/trap and
    // positioning it dropped. Mirrors lr-dialog's identical reconnect-safety pattern.
    if (this.hasUpdated && this.open) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
        this.releaseScrollLock ??= lockScroll(this.ownerDocument);
      } else {
        this.activateOverlayInternal();
      }
      queueMicrotask(() => {
        // willUpdate() never reruns on a reconnect (see the comment above), so re-derive
        // `unanchored` here too -- the target's resolvability may have changed while
        // disconnected. Safe to set directly: this runs after connectedCallback() already
        // returned, well outside any Lit lifecycle-callback's synchronous call stack.
        const step = this.steps[this.activeIndex];
        this.unanchored = step ? !this.resolveTarget(step) : false;
        this.overlay?.focusInitial();
        this.activateStep();
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disposePositioning();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.suspend();
    if (this.open) {
      // Deferred a microtask so a synchronous reparent (disconnect immediately followed by
      // reconnect) isn't mistaken for a real removal -- mirrors lr-dialog's identical case.
      queueMicrotask(() => {
        if (!this.isConnected && this.open) {
          this.open = false;
          this.emit<TourEndReason>('lr-tour-end', 'unmount');
        }
      });
    }
  }

  /** Opens the tour at `index` (default `0`), clamped to `[0, steps.length - 1]`. Equivalent to
   *  `this.activeIndex = index; this.open = true;` plus the `lr-tour-start` event. */
  start(index = 0): void {
    this.activeIndex = this.clampIndex(index);
    this.open = true;
    this.emit<{ index: number }>('lr-tour-start', { index: this.activeIndex });
  }

  /** Advances to the next step. On the last step, ends the tour instead (`end('completed')`) --
   *  the built-in Next/Done button calls this same method, so a custom control wired to `next()`
   *  behaves identically to the built-in one. Cancelable via `lr-tour-step-change` (or
   *  `lr-tour-end` when it triggers completion). */
  next(): void {
    const total = this.steps.length;
    if (total === 0) return;
    if (this.activeIndex >= total - 1) {
      this.end('completed');
      return;
    }
    this.transitionTo(this.activeIndex + 1, 'next');
  }

  /** Moves to the previous step. No-op on the first step (`activeIndex === 0`). */
  back(): void {
    if (this.activeIndex <= 0) return;
    this.transitionTo(this.activeIndex - 1, 'back');
  }

  /** Jumps directly to `index`, clamped to `[0, steps.length - 1]`. */
  goToStep(index: number): void {
    if (this.steps.length === 0) return;
    const clamped = this.clampIndex(index);
    if (clamped === this.activeIndex) return;
    this.transitionTo(clamped, 'goto');
  }

  /** Sugar for `end('skip')`. What the built-in Skip button calls. */
  skip(): void {
    this.end('skip');
  }

  /** Ends the tour. `reason` is forwarded as the `lr-tour-end` detail. Cancelable (except in
   *  practice for `'unmount'`) -- mirrors `LyraDialog.close(reason)` exactly. */
  end(reason: TourEndReason = 'api'): void {
    if (!this.open) return;
    const event = this.emit<TourEndReason>('lr-tour-end', reason, { cancelable: true });
    if (event.defaultPrevented) return;
    this.open = false;
  }

  private clampIndex(index: number): number {
    const total = this.steps.length;
    if (total === 0) return 0;
    return Math.min(Math.max(index, 0), total - 1);
  }

  private transitionTo(index: number, via: 'next' | 'back' | 'goto'): void {
    const previousIndex = this.activeIndex;
    const step = this.steps[index];
    if (!step) return;
    const event = this.emit<{ index: number; previousIndex: number; step: TourStep; via: typeof via }>(
      'lr-tour-step-change',
      { index, previousIndex, step, via },
      { cancelable: true },
    );
    if (event.defaultPrevented) return;
    this.activeIndex = index;
  }

  private resolveTarget(step: TourStep): HTMLElement | null {
    const { target } = step;
    if (typeof target === 'string') {
      return this.ownerDocument.querySelector<HTMLElement>(target);
    }
    if (typeof target === 'function') {
      return target() ?? null;
    }
    return target.isConnected ? target : null;
  }

  // Resolves the active step's target, scrolls it into view, and (re)wires the shared
  // positioner (`place()`) for the popover and `trackRect()` for the spotlight cutout/ring.
  // Re-run on every step activation -- targets are never cached, per TourTarget's doc comment.
  // `unanchored` is already correctly derived for this render by willUpdate() (see its own doc)
  // by the time this runs, so the freshly queried popover already reflects the right
  // anchored/unanchored shape -- no separate corrective re-render/await round-trip needed here.
  private activateStep(): void {
    this.disposePositioning();
    const step = this.steps[this.activeIndex];
    if (!step) return;
    const target = this.resolveTarget(step);

    if (!target) {
      this.emit<{ index: number; step: TourStep }>('lr-tour-target-missing', { index: this.activeIndex, step });
      return;
    }

    const popover = this.renderRoot.querySelector('[part="popover"]') as HTMLElement | null;
    if (!popover) return;

    target.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

    const placement = rtlAwarePlacement(step.placement ?? this.placement, this);
    this.placeCleanup = place(target, popover, { placement, offset: finiteNumber(this.distance, DEFAULT_DISTANCE) });

    const padding = finiteRange(step.spotlightPadding ?? this.spotlightPadding, DEFAULT_SPOTLIGHT_PADDING, 0);
    const interactive = !!step.interactiveTarget;
    this.spotlightCleanup = trackRect(target, (rect) => this.paintSpotlight(rect, padding, interactive));
  }

  private paintSpotlight(rect: DOMRect, padding: number, interactive: boolean): void {
    const x = rect.left - padding;
    const y = rect.top - padding;
    const width = Math.max(0, rect.width + padding * 2);
    const height = Math.max(0, rect.height + padding * 2);

    const backdrop = this.renderRoot.querySelector('[part="backdrop"]') as SVGSVGElement | null;
    const cutout = this.renderRoot.querySelector('[part="backdrop"] .cutout') as SVGRectElement | null;
    const spotlight = this.renderRoot.querySelector('[part="spotlight"]') as HTMLElement | null;

    if (cutout) {
      cutout.setAttribute('x', String(x));
      cutout.setAttribute('y', String(y));
      cutout.setAttribute('width', String(width));
      cutout.setAttribute('height', String(height));
    }
    if (spotlight) {
      spotlight.style.left = `${x}px`;
      spotlight.style.top = `${y}px`;
      spotlight.style.width = `${width}px`;
      spotlight.style.height = `${height}px`;
    }
    if (backdrop) {
      backdrop.style.clipPath = interactive ? keyholeClipPath(x, y, width, height) : '';
    }
  }

  private disposePositioning(): void {
    this.placeCleanup?.();
    this.placeCleanup = undefined;
    this.spotlightCleanup?.();
    this.spotlightCleanup = undefined;
  }

  private activateOverlayInternal(): void {
    if (this.overlay?.isActive()) return;
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="popover"]') ?? null,
      onEscape: () => this.end('escape'),
      onBackdrop: () => this.end('skip'),
      preferredInitialFocus: () => this.renderRoot.querySelector<HTMLElement>('[part="popover"]'),
      modal: false,
    });
  }

  private deactivateOverlayInternal(): void {
    this.disposePositioning();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.deactivate();
    this.overlay = undefined;
  }

  private onBackdropClick = (): void => {
    if (!this.lightDismiss) return;
    this.overlay?.dismissBackdrop();
  };

  private onDefaultSlotChange = (e: Event): void => {
    this.hasSlotContent = hasRealContent((e.target as HTMLSlotElement).assignedNodes({ flatten: true }));
  };

  // ArrowRight/ArrowLeft swap "forward"/"backward" meaning under RTL, mirroring lr-stepper's
  // forwardKey/backwardKey. Skipped for a native text-editing control (a step's slotted rich
  // content might legitimately contain one) or when the keydown was already handled.
  private onPopoverKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const eventTarget = event.target as HTMLElement;
    if (eventTarget.matches('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;

    const rtl = this.effectiveDirection === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forwardKey) {
      event.preventDefault();
      this.next();
    } else if (event.key === backwardKey) {
      event.preventDefault();
      this.back();
    }
  };

  render(): TemplateResult {
    const step = this.open ? this.steps[this.activeIndex] : undefined;
    if (!step) return html``;

    const total = this.steps.length;
    const isLastStep = this.activeIndex >= total - 1;
    const hasBodyContent = this.hasSlotContent || !!step.content;
    const describedBy = [hasBodyContent ? this.bodyId : '', this.showProgress ? this.progressTextId : '']
      .filter((id) => id.length > 0)
      .join(' ');

    return html`
      <svg part="backdrop" aria-hidden="true" @click=${this.onBackdropClick}>
        ${this.unanchored
          ? html`<rect class="scrim" x="0" y="0" width="100%" height="100%"></rect>`
          : html`
              <defs>
                <mask id=${this.maskId}>
                  <rect x="0" y="0" width="100%" height="100%" fill="white"></rect>
                  <rect class="cutout" x="0" y="0" width="0" height="0" fill="black"></rect>
                </mask>
              </defs>
              <rect class="scrim" x="0" y="0" width="100%" height="100%" mask="url(#${this.maskId})"></rect>
            `}
      </svg>
      <div part="spotlight" aria-hidden="true" ?hidden=${this.unanchored}></div>
      ${keyed(
        step.id,
        html`
          <div
            part="popover"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label=${this.accessibleLabel ?? nothing}
            aria-labelledby=${this.accessibleLabel ? nothing : this.headingId}
            aria-describedby=${describedBy || nothing}
            ?data-unanchored=${this.unanchored}
            @keydown=${this.onPopoverKeyDown}
          >
            <span id=${this.headingId} part="heading">${step.heading}</span>
            <div id=${this.bodyId} part="body">
              <slot @slotchange=${this.onDefaultSlotChange}>${step.content ?? ''}</slot>
            </div>
            ${this.showProgress
              ? html`
                  <div part="progress">
                    <span part="progress-text" id=${this.progressTextId}>
                      ${this.localize('tourStepOf', undefined, { current: this.activeIndex + 1, total })}
                    </span>
                    <span class="dots">
                      ${this.steps.map(
                        (_s, index) =>
                          html`<span part="progress-dot" aria-hidden="true" ?data-current=${index === this.activeIndex}></span>`,
                      )}
                    </span>
                  </div>
                `
              : nothing}
            <div part="footer">
              ${!step.hidePrevious
                ? html`
                    <button
                      part="previous-button"
                      type="button"
                      ?disabled=${this.activeIndex === 0}
                      @click=${this.back}
                    >
                      ${this.localize('previous')}
                    </button>
                  `
                : nothing}
              <button part="skip-button" type="button" @click=${this.skip}>${this.localize('tourSkip')}</button>
              <button part="next-button" type="button" @click=${this.next}>
                ${this.localize(isLastStep ? 'tourDone' : 'next')}
              </button>
            </div>
          </div>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-tour': LyraTour;
  }
}
