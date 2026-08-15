import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  activateOverlay,
  collectFocusableElements,
  composedContains,
  deepActiveElement,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { nextId, hasRealContent } from '../../../internal/a11y.js';
import { place, trackRect } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteInteger, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { styles } from './tour.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_next, LYRA_DEFAULT_previous, LYRA_DEFAULT_tourDone, LYRA_DEFAULT_tourSkip, LYRA_DEFAULT_tourStepOf } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Default distance (px) between the target and the popover -- see `LyraTour.distance`. */
const DEFAULT_DISTANCE = 12;
/** Default extra px between a target's own box and the spotlight cutout/ring -- see
 *  `LyraTour.spotlightPadding`. */
const DEFAULT_SPOTLIGHT_PADDING = 4;
const MAX_TOUR_STEPS = 256;
const MAX_STEP_ID_LENGTH = 256;
const MAX_TARGET_SELECTOR_LENGTH = 8_192;
const MAX_HEADING_LENGTH = 4_096;
const MAX_CONTENT_LENGTH = 65_536;
const MAX_STEP_SPOTLIGHT_PADDING = 10_000;
const TOUR_PLACEMENTS = new Set<Placement>([
  'top',
  'top-start',
  'top-end',
  'right',
  'right-start',
  'right-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
]);

/**
 * Resolves the element a step spotlights/anchors to. A `string` is resolved via
 * `this.ownerDocument.querySelector<HTMLElement>(target)` (top-level light DOM only -- CSS
 * selectors can't pierce a closed shadow root); pass a direct `HTMLElement` or a resolver
 * function for anything else (inside a shadow root, not yet mounted, computed dynamically).
 * Resolved exactly once whenever this step becomes active, then retained as one connected
 * snapshot for that activation so rendering, focus routing, positioning, and the spotlight all
 * agree on the same element. It resolves again on a later activation/reconnect, so a target that
 * mounts later can still be found when its step is reached. Invalid selectors, throwing
 * resolvers, non-`HTMLElement` results, and detached elements all follow the documented
 * target-missing path instead of rejecting the component update.
 */
export type LyraTourTarget = string | HTMLElement | (() => HTMLElement | null);

export interface LyraTourStep {
  /** Stable business id for this step, never shown to the user. Collection occurrences remain
   *  unambiguous through the public `index`/`activeIndex` contract even when ids repeat. A step
   *  object still carrying the pre-rename `id` field (this property's former name) is accepted as
   *  a fallback when `stepId` itself is absent -- see `snapshotTourSteps()`. */
  readonly stepId: string;
  /** The element this step spotlights and anchors its popover to. */
  readonly target: LyraTourTarget;
  /** Visible step heading -- becomes the popover panel's accessible name via `aria-labelledby`.
   *  Plain text; not localized by this component (caller-supplied data, per the library's i18n
   *  exception for app content). A blank/whitespace heading is tolerated defensively and falls
   *  back to the localized step-progress text for the dialog name. */
  readonly heading: string;
  /** Visible step body copy. Rendered as plain text (Lit auto-escapes -- no HTML/markdown
   *  parsing). Ignored for the currently active step if the default slot carries real content
   *  (see the class doc's Slots section) -- the slot wins when both are present. */
  readonly content?: string;
  /** Per-step Floating UI placement override. Falls back to the tour-level `placement` prop
   *  (`'bottom'`) when omitted. Resolved through `rtlAwarePlacement()` before being passed to
   *  `place()`, same as `lr-menu`/`lr-popover`. */
  readonly placement?: Placement;
  /** Per-step override of the tour-level `spotlightPadding` prop (`4`). Extra px between the
   *  target's own box and the spotlight cutout/ring. `distance` (the offset between the target
   *  and the popover itself) is a tour-level-only setting -- it has no per-step override. */
  readonly spotlightPadding?: number;
  /** Opts this step's target OUT of the tour's default non-interactive-spotlight behavior --
   *  see the class doc's "Target interactivity" section. Defaults to `false`. */
  readonly interactiveTarget?: boolean;
  /** Hides the Previous control outright (not just disables it) for this step -- e.g. a step
   *  reached only via a side effect that can't be cleanly reversed. Defaults to `false`; compare
   *  with the first step, whose Previous control is disabled-but-visible instead, for a stable
   *  footer layout across steps. */
  readonly hidePrevious?: boolean;
}

/**
 * Reason a tour ended, forwarded as the `lr-tour-end` event detail.
 * `'completed'`/`'skip'`/`'escape'` are emitted by the tour's own built-in dismiss triggers;
 * `'unmount'` is emitted when the tour is removed from the DOM while still open by something
 * other than its own `end()` (mirrors `lr-dialog`'s identical `'unmount'` case); any other
 * string is whatever a caller passes to `end()` directly.
 */
export type LyraTourEndReason =
  | 'completed'
  | 'skip'
  | 'escape'
  | 'api'
  | 'unmount'
  | (string & Record<never, never>);

export interface LyraTourEventMap {
  'lr-tour-start': CustomEvent<{ readonly index: number }>;
  'lr-tour-step-change': CustomEvent<{
    readonly index: number;
    readonly previousIndex: number;
    readonly step: Readonly<LyraTourStep>;
    readonly via: 'next' | 'back' | 'goto';
  }>;
  'lr-tour-end': CustomEvent<LyraTourEndReason>;
  'lr-tour-target-missing': CustomEvent<{
    readonly index: number;
    readonly step: Readonly<LyraTourStep>;
  }>;
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

function isElementNode(value: unknown): value is Element {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Node).nodeType === 1 &&
    typeof (value as Element).localName === 'string' &&
    typeof (value as Element).matches === 'function'
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

function ownDataValue(record: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function safeArrayLength(value: unknown): number {
  try {
    if (!Array.isArray(value)) return 0;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = descriptor && 'value' in descriptor ? descriptor.value : 0;
    return typeof length === 'number' && Number.isFinite(length)
      ? Math.min(MAX_TOUR_STEPS, Math.max(0, Math.floor(length)))
      : 0;
  } catch {
    return 0;
  }
}

function arrayItem(value: unknown, index: number): unknown {
  try {
    if (!Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, maxLength) : undefined;
}

function normalizeTourTarget(value: unknown): LyraTourTarget | undefined {
  if (typeof value === 'string') {
    const selector = value.slice(0, MAX_TARGET_SELECTOR_LENGTH);
    return selector ? selector : undefined;
  }
  if (typeof value === 'function') {
    return value as () => HTMLElement | null;
  }
  try {
    return isHtmlElement(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Owns a bounded, realm-neutral snapshot without invoking provider accessors or iterators. */
function snapshotTourSteps(value: unknown): readonly Readonly<LyraTourStep>[] {
  const normalized: Readonly<LyraTourStep>[] = [];
  const length = safeArrayLength(value);
  for (let index = 0; index < length; index += 1) {
    const candidate = arrayItem(value, index);
    if (!isPlainRecord(candidate)) continue;
    // `id` is the pre-rename field this replaced -- accepted as a fallback so a caller still on
    // the old shape keeps working; `stepId` wins when both are present.
    const stepId =
      boundedString(ownDataValue(candidate, 'stepId'), MAX_STEP_ID_LENGTH) ??
      boundedString(ownDataValue(candidate, 'id'), MAX_STEP_ID_LENGTH);
    const target = normalizeTourTarget(ownDataValue(candidate, 'target'));
    const heading = boundedString(ownDataValue(candidate, 'heading'), MAX_HEADING_LENGTH);
    if (!stepId || stepId !== stepId.trim() || !target || heading === undefined) continue;

    const content = boundedString(ownDataValue(candidate, 'content'), MAX_CONTENT_LENGTH);
    const rawPlacement = ownDataValue(candidate, 'placement');
    const placement = TOUR_PLACEMENTS.has(rawPlacement as Placement)
      ? (rawPlacement as Placement)
      : undefined;
    const rawPadding = ownDataValue(candidate, 'spotlightPadding');
    const spotlightPadding =
      typeof rawPadding === 'number' && Number.isFinite(rawPadding)
        ? finiteRange(rawPadding, DEFAULT_SPOTLIGHT_PADDING, 0, MAX_STEP_SPOTLIGHT_PADDING)
        : undefined;
    const rawInteractive = ownDataValue(candidate, 'interactiveTarget');
    const interactiveTarget = typeof rawInteractive === 'boolean' ? rawInteractive : undefined;
    const rawHidePrevious = ownDataValue(candidate, 'hidePrevious');
    const hidePrevious = typeof rawHidePrevious === 'boolean' ? rawHidePrevious : undefined;

    normalized.push(
      Object.freeze({
        stepId,
        target,
        heading,
        ...(content !== undefined ? { content } : {}),
        ...(placement !== undefined ? { placement } : {}),
        ...(spotlightPadding !== undefined ? { spotlightPadding } : {}),
        ...(interactiveTarget !== undefined ? { interactiveTarget } : {}),
        ...(hidePrevious !== undefined ? { hidePrevious } : {}),
      }),
    );
  }
  return Object.freeze(normalized);
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
 * its step is active: it stays visually revealed but is outside the modal interaction model
 * and cannot be clicked -- every pointer event over the full
 * viewport, including directly over the visually-revealed target, is captured by the backdrop
 * (CSS `mask` does not affect hit-testing, only `clip-path` does) -- and cannot be reached by Tab
 * (the shared overlay focus trap confines Tab to the popover panel). Set `step.interactiveTarget`
 * to opt a step's target out of this: the backdrop additionally clips itself (via `clip-path`,
 * which *does* affect hit-testing) around the same rect, so pointer/click events fall through to
 * the live target underneath. The panel also becomes nonmodal and an explicit Tab route connects
 * its controls with the live target.
 *
 * **Focus management.** Default steps exclusively own interaction: the shared overlay manager
 * marks outside content inert, traps Tab, and the panel reports `aria-modal="true"`.
 * `interactiveTarget` steps instead use a nonmodal overlay, report `aria-modal="false"`, and
 * treat the panel plus the external target's live composed focusables as one bounded Tab scope.
 *
 * Each step transition mounts a genuinely new popover DOM node (keyed on occurrence index plus
 * the step's `stepId`) so duplicate business ids cannot collapse distinct occurrences and focus
 * reliably re-enters the panel every time, even though the Previous/Next button that triggered
 * the transition lives inside that same persistent-looking region. Every step-related event
 * exposes the occurrence index; it is the authoritative collection identity.
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
 *   `'completed'`). `detail: LyraTourEndReason`. Conditionally cancelable: every ordinary end can be
 *   vetoed, while `'unmount'` cannot because the element is already being removed -- mirrors
 *   `lr-dialog-close` exactly.
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
 * @cssprop [--lr-tour-progress-dot-current-bg=var(--lr-color-brand)] - Background of
 *   `progress-dot` for the current step, without repainting every other component that reuses the
 *   shared brand token.
 * @status stable
 * @since 4.0.0
 */
export class LyraTour extends LyraElement<LyraTourEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    next: LYRA_DEFAULT_next,
    previous: LYRA_DEFAULT_previous,
    tourDone: LYRA_DEFAULT_tourDone,
    tourSkip: LYRA_DEFAULT_tourSkip,
    tourStepOf: LYRA_DEFAULT_tourStepOf,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override properties = {
    steps: { attribute: false, noAccessor: true },
  };

  /** Whether the tour is open. Set this (or call `start()`/`end()`) -- there is no separate
   *  `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  private _steps: readonly Readonly<LyraTourStep>[] = Object.freeze([]);

  /** Ordered step data. Assignment clone-normalizes at most 256 own-data records into a frozen
   *  snapshot, omitting malformed/accessor rows and invalid optional fields, so later caller
   *  mutation cannot silently change rendering or an emitted event. Empty (the default) renders
   *  nothing. */
  get steps(): readonly Readonly<LyraTourStep>[] {
    return this._steps;
  }

  set steps(next: readonly LyraTourStep[]) {
    const previous = this._steps;
    this._steps = snapshotTourSteps(next);
    this.requestUpdate('steps', previous);
  }

  /** Index of the currently active step, clamped to `[0, steps.length - 1]` by `goToStep()` --
   *  and, for a direct property/attribute assignment that bypasses that method (e.g. two-way
   *  binding an external store, or a bad `active-index` attribute), normalized the same way in
   *  `willUpdate()` below. */
  @property({ type: Number, reflect: true, attribute: 'active-index' })
  activeIndex = 0;

  /** Tour-level default Floating UI placement, overridable per step via `LyraTourStep.placement`. */
  @property({ reflect: true }) placement: Placement = 'bottom';

  /** Distance (px) between the target and the popover, passed straight to Floating UI's
   *  `offset()` middleware -- a tour-level-only setting, mirroring `lr-popover`'s `distance`
   *  prop exactly (can legitimately be negative for overlap). */
  @property({ type: Number }) distance = DEFAULT_DISTANCE;

  /** Tour-level default extra px between a target's own box and the spotlight cutout/ring,
   *  overridable per step via `LyraTourStep.spotlightPadding`. Non-negative. */
  @property({ type: Number, attribute: 'spotlight-padding' }) spotlightPadding = DEFAULT_SPOTLIGHT_PADDING;

  /** Whether a backdrop click dismisses the tour (`end('skip')`). Defaults to `false`, matching
   *  `lr-dialog`/`lr-lightbox`'s `lightDismiss`: a guided tour's backdrop click doing nothing by
   *  default avoids losing onboarding progress to a stray click. Set it to opt in. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  /** Whether the built-in "Step X of Y" progress indicator (dots + text) renders in the footer. */
  @property({
    type: Boolean,
    attribute: 'show-progress',
    converter: trueDefaultBooleanConverter,
  })
  showProgress = true;

  /** Host-level `aria-label` override for every step popover's accessible name -- wins over each
   *  step's own `heading`, matching `lr-dialog`'s `accessibleLabel` pattern. Most consumers
   *  won't need this since each step already has a meaningful name via `heading`; setting it
   *  makes the *same* string name every step's panel. Set as a plain `aria-label` attribute on
   *  `<lr-tour>` itself, not a public JS property. */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

  @state() private unanchored = false;
  @state() private hasSlotContent = false;

  private overlay?: OverlayHandle;
  private placeCleanup?: () => void;
  private spotlightCleanup?: () => void;
  private interactiveKeyboardTarget?: HTMLElement;
  private interactiveKeyboardDocument?: Document;
  private overlayInteractive?: boolean;
  private activeTargetSnapshot: HTMLElement | null = null;
  private focusReturnTarget: HTMLElement | null = null;

  private readonly maskId = nextId('tour-mask');
  private readonly headingId = nextId('tour-heading');
  private readonly bodyId = nextId('tour-body');
  private readonly progressTextId = nextId('tour-progress-text');

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Normalizes a direct `activeIndex` assignment (property or `active-index` attribute) that
    // bypasses `goToStep()`'s own `clampIndex()` -- e.g. two-way-binding an external store, or a
    // non-numeric `active-index` attribute (NaN via the `type: Number` converter). Setting the
    // property here, before render, is safe and doesn't schedule a second update -- same pattern
    // as this method's `unanchored` derivation below.
    if (changed.has('activeIndex') || changed.has('steps')) {
      const maxIndex = Math.max(0, this.steps.length - 1);
      const normalizedIndex = finiteInteger(this.activeIndex, 0, 0, maxIndex);
      if (normalizedIndex !== this.activeIndex) this.activeIndex = normalizedIndex;
    }
    if (!this.hasUpdated) {
      this.hasSlotContent = hasRealContent(this.childNodes);
    }
    const cannotOpen = this.open && this.steps.length === 0;
    if (cannotOpen) {
      this.open = false;
      this.deactivateOverlayInternal();
    } else if (changed.has('open')) {
      if (this.open) {
        const active = deepActiveElement(this.ownerDocument);
        this.focusReturnTarget = isHtmlElement(active) ? active : null;
        this.activateOverlayInternal();
      } else {
        this.deactivateOverlayInternal();
      }
    }
    // Resolve once, before render, both to derive `unanchored` and to establish the single target
    // snapshot every other concern uses for this activation. Resolution is intentionally not
    // repeated from updated(), focus routing, or positioning: an unstable resolver must not make
    // those concerns disagree about which live element owns the active step.
    if (this.open && (changed.has('open') || changed.has('activeIndex') || changed.has('steps'))) {
      const step = this.steps[this.activeIndex];
      this.activeTargetSnapshot = step ? this.resolveTarget(step) : null;
      this.unanchored = step ? !this.activeTargetSnapshot : false;
    }
  }

  // Runs after render so the manager can resolve the (possibly just-swapped, per keyed()) panel,
  // and so activateStep() can query the freshly-rendered popover/spotlight/mask elements.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const activationChanged = changed.has('open') || changed.has('activeIndex') || changed.has('steps');
    const geometryChanged = changed.has('placement') || changed.has('distance') || changed.has('spotlightPadding');
    if (this.open && (activationChanged || geometryChanged)) {
      const preserveInteractiveTargetFocus = changed.has('steps') && this.canPreserveInteractiveTargetFocus();
      const overlayChanged = this.activateOverlayInternal();
      if (
        changed.has('open') ||
        changed.has('activeIndex') ||
        overlayChanged ||
        (changed.has('steps') && !preserveInteractiveTargetFocus)
      ) {
        this.overlay?.focusInitial();
      }
      this.activateStep({
        scroll: activationChanged,
        announceMissing: activationChanged,
      });
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no update in between, so
    // willUpdate never reruns to notice `open` is still true -- restore the scroll lock/trap and
    // positioning it dropped. Mirrors lr-dialog's identical reconnect-safety pattern.
    if (this.hasUpdated && this.open) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
      } else {
        this.activateOverlayInternal();
      }
      queueMicrotask(async () => {
        if (!this.isConnected || !this.open) return;
        // willUpdate() never reruns on a reconnect (see the comment above), so re-derive
        // `unanchored` here too -- the target's resolvability may have changed while
        // disconnected, while retaining exactly one snapshot for this reconnect activation.
        const step = this.steps[this.activeIndex];
        this.activeTargetSnapshot = step ? this.resolveTarget(step) : null;
        this.unanchored = step ? !this.activeTargetSnapshot : false;
        await this.updateComplete;
        if (!this.isConnected || !this.open) return;
        this.overlay?.focusInitial();
        this.activateStep({ scroll: true, announceMissing: true });
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disposePositioning();
    this.overlay?.suspend();
    if (this.open) {
      // Deferred a microtask so a synchronous reparent (disconnect immediately followed by
      // reconnect) isn't mistaken for a real removal -- mirrors lr-dialog's identical case.
      queueMicrotask(() => {
        if (!this.isConnected && this.open) {
          this.open = false;
          this.emit('lr-tour-end', 'unmount');
        }
      });
    }
  }

  /** Opens the tour at `index` (default `0`), clamped to `[0, steps.length - 1]`. Equivalent to
   *  `this.activeIndex = index; this.open = true;` plus the `lr-tour-start` event. */
  start(index: number = 0): void {
    if (this.steps.length === 0) return;
    this.activeIndex = this.clampIndex(index);
    this.open = true;
    this.emit('lr-tour-start', Object.freeze({ index: this.activeIndex }));
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
  end(reason: LyraTourEndReason = 'api'): void {
    if (!this.open) return;
    const event = this.emit('lr-tour-end', reason, { cancelable: true });
    if (event.defaultPrevented) return;
    this.open = false;
  }

  private clampIndex(index: number): number {
    const total = this.steps.length;
    if (total === 0) return 0;
    return finiteInteger(index, 0, 0, total - 1);
  }

  private transitionTo(index: number, via: 'next' | 'back' | 'goto'): void {
    const previousIndex = this.activeIndex;
    const step = this.steps[index];
    if (!step) return;
    const event = this.emit(
      'lr-tour-step-change',
      Object.freeze({ index, previousIndex, step, via }),
      { cancelable: true },
    );
    if (event.defaultPrevented) return;
    this.activeIndex = index;
  }

  private resolveTarget(step: LyraTourStep): HTMLElement | null {
    try {
      const { target } = step;
      const resolved =
        typeof target === 'string'
          ? this.ownerDocument.querySelector(target)
          : typeof target === 'function'
          ? target()
          : target;
      return isHtmlElement(resolved) && resolved.isConnected && resolved.ownerDocument === this.ownerDocument
        ? resolved
        : null;
    } catch {
      return null;
    }
  }

  private canPreserveInteractiveTargetFocus(): boolean {
    const previousTarget = this.interactiveKeyboardTarget;
    const step = this.steps[this.activeIndex];
    if (!previousTarget?.isConnected || !step?.interactiveTarget) return false;
    const currentTarget = this.activeTargetSnapshot;
    return currentTarget === previousTarget && composedContains(previousTarget, deepActiveElement(this.ownerDocument));
  }

  // Uses the activation's normalized target snapshot, scrolls it into view, and (re)wires the shared
  // positioner (`place()`) for the popover and `trackRect()` for the spotlight cutout/ring.
  // Re-run on every step activation and live geometry-property change.
  // `unanchored` is already correctly derived for this render by willUpdate() (see its own doc)
  // by the time this runs, so the freshly queried popover already reflects the right
  // anchored/unanchored shape -- no separate corrective re-render/await round-trip needed here.
  private activateStep(options: { scroll: boolean; announceMissing: boolean }): void {
    this.disposePositioning();
    const step = this.steps[this.activeIndex];
    if (!step) return;
    const target = this.activeTargetSnapshot;

    if (!target?.isConnected) {
      if (options.announceMissing) {
        this.emit(
          'lr-tour-target-missing',
          Object.freeze({
            index: this.activeIndex,
            step,
          }),
        );
      }
      return;
    }

    const popover = this.renderRoot.querySelector('[part="popover"]') as HTMLElement | null;
    if (!popover) return;

    if (options.scroll) {
      const ownerWindow = target.ownerDocument.defaultView;
      const reducedMotion = !ownerWindow || prefersReducedMotion(ownerWindow);
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    }

    const placement = rtlAwarePlacement(step.placement ?? this.placement, this);
    this.placeCleanup = place(target, popover, {
      placement,
      offset: finiteNumber(this.distance, DEFAULT_DISTANCE),
    });

    const padding = finiteRange(step.spotlightPadding ?? this.spotlightPadding, DEFAULT_SPOTLIGHT_PADDING, 0);
    const interactive = !!step.interactiveTarget;
    if (interactive) {
      this.interactiveKeyboardTarget = target;
      this.interactiveKeyboardDocument = target.ownerDocument;
      this.interactiveKeyboardDocument.addEventListener('keydown', this.onInteractiveScopeKeyDown, true);
    }
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
    this.interactiveKeyboardDocument?.removeEventListener('keydown', this.onInteractiveScopeKeyDown, true);
    this.interactiveKeyboardDocument = undefined;
    this.interactiveKeyboardTarget = undefined;
  }

  private activateOverlayInternal(): boolean {
    // Lit keeps updating a detached element, so `open = true` on a removed tour would lock scroll
    // on the real document and install a global Escape handler with nothing visible on screen,
    // and nothing self-heals it. lr-dialog already guards both of its activation paths this way.
    if (!this.isConnected) return false;
    const interactive = !!this.steps[this.activeIndex]?.interactiveTarget;
    if (this.overlay?.isActive() && this.overlayInteractive === interactive) return false;
    if (this.overlay?.isActive()) {
      this.overlay.deactivate({ restoreFocus: false });
      this.overlay = undefined;
    }
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="popover"]') ?? null,
      onEscape: () => this.end('escape'),
      onBackdrop: () => this.end('skip'),
      preferredInitialFocus: () => this.renderRoot.querySelector<HTMLElement>('[part="popover"]'),
      restoreFocusTo: () => {
        const target = this.focusReturnTarget;
        return target?.isConnected && target.ownerDocument === this.ownerDocument ? target : null;
      },
      modal: !interactive,
      trapFocus: !interactive,
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
    this.overlayInteractive = interactive;
    return true;
  }

  private deactivateOverlayInternal(): void {
    this.disposePositioning();
    this.activeTargetSnapshot = null;
    this.overlay?.deactivate();
    this.overlay = undefined;
    this.overlayInteractive = undefined;
    this.focusReturnTarget = null;
  }

  private onBackdropClick = (): void => {
    if (!this.lightDismiss) return;
    this.overlay?.dismissBackdrop();
  };

  private onDefaultSlotChange = (e: Event): void => {
    this.hasSlotContent = hasRealContent((e.target as HTMLSlotElement).assignedNodes({ flatten: true }));
  };

  private ownsDirectionalKeys(event: KeyboardEvent): boolean {
    return event
      .composedPath()
      .some(
        (node) =>
          isElementNode(node) &&
          node.matches(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="grid"], [role="gridcell"], [role="listbox"], [role="menu"], [role="menuitem"], [role="radio"], [role="radiogroup"], [role="scrollbar"], [role="slider"], [role="spinbutton"], [role="tab"], [role="tablist"], [role="tree"], [role="treeitem"]',
          ),
      );
  }

  private onInteractiveScopeKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || event.defaultPrevented || !this.open) return;
    const popover = this.renderRoot.querySelector<HTMLElement>('[part="popover"]');
    if (!popover) return;
    const target = this.interactiveKeyboardTarget;
    if (!target) return;
    const panelFocusable = collectFocusableElements(popover);
    const targetFocusable = collectFocusableElements(target);
    if (panelFocusable.length === 0 && targetFocusable.length === 0) {
      event.preventDefault();
      popover.focus();
      return;
    }

    const active = deepActiveElement(this.ownerDocument);
    const panelIndex = panelFocusable.findIndex(
      (candidate) => active === candidate || composedContains(candidate, active),
    );
    const targetIndex = targetFocusable.findIndex(
      (candidate) => active === candidate || composedContains(candidate, active),
    );
    const destination =
      panelIndex >= 0
        ? event.shiftKey && panelIndex === 0
          ? targetFocusable.at(-1) ?? panelFocusable.at(-1)
          : !event.shiftKey && panelIndex === panelFocusable.length - 1
          ? targetFocusable[0] ?? panelFocusable[0]
          : undefined
        : targetIndex >= 0
        ? event.shiftKey && targetIndex === 0
          ? panelFocusable.at(-1) ?? targetFocusable.at(-1)
          : !event.shiftKey && targetIndex === targetFocusable.length - 1
          ? panelFocusable[0] ?? targetFocusable[0]
          : undefined
        : active === popover && !event.shiftKey
        ? undefined
        : event.shiftKey
        ? targetFocusable.at(-1) ?? panelFocusable.at(-1)
        : panelFocusable[0] ?? targetFocusable[0];
    if (!destination) return;
    event.preventDefault();
    destination.focus();
  };

  private onPopoverKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (this.ownsDirectionalKeys(event)) return;

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

  private formatProgressNumber(value: number): string {
    try {
      return getNumberFormat(this.effectiveLocale).format(value);
    } catch {
      return String(value);
    }
  }

  override render(): TemplateResult {
    const step = this.open ? this.steps[this.activeIndex] : undefined;
    if (!step) return html``;

    const total = this.steps.length;
    const isLastStep = this.activeIndex >= total - 1;
    const headingName = (step.heading ?? '').trim();
    const suppliedName = this.accessibleLabel?.trim() ?? '';
    const fallbackName = this.localize('tourStepOf', undefined, {
      current: this.formatProgressNumber(this.activeIndex + 1),
      total: this.formatProgressNumber(total),
    });
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
        JSON.stringify([this.activeIndex, step.stepId]),
        html`
          <div
            part="popover"
            role="dialog"
            aria-modal=${step.interactiveTarget ? 'false' : 'true'}
            tabindex="-1"
            aria-label=${suppliedName || !headingName ? suppliedName || fallbackName : nothing}
            aria-labelledby=${suppliedName || !headingName ? nothing : this.headingId}
            aria-describedby=${describedBy || nothing}
            ?data-unanchored=${this.unanchored}
            @keydown=${this.onPopoverKeyDown}
          >
            <span id=${this.headingId} part="heading">${step.heading ?? ''}</span>
            <div id=${this.bodyId} part="body">
              <slot @slotchange=${this.onDefaultSlotChange}></slot>${this.hasSlotContent ? nothing : step.content ?? ''}
            </div>
            ${this.showProgress
              ? html`
                  <div part="progress">
                    <span part="progress-text" id=${this.progressTextId}>
                      ${this.localize('tourStepOf', undefined, {
                        current: this.formatProgressNumber(this.activeIndex + 1),
                        total: this.formatProgressNumber(total),
                      })}
                    </span>
                    <span class="dots">
                      ${this.steps.map(
                        (_s, index) =>
                          html`<span
                            part="progress-dot"
                            aria-hidden="true"
                            ?data-current=${index === this.activeIndex}
                          ></span>`,
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
