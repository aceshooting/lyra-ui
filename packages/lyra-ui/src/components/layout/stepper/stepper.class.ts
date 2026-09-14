import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  OrientationBreakpointController,
  type BreakpointBasis,
} from '../../../internal/orientation-breakpoint.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { isRtl } from '../../../internal/rtl.js';
import {
  observeScrollOverflow,
  SCROLL_OVERFLOW_ATTRIBUTE,
} from '../../../internal/scroll-overflow.js';
import { styles } from './stepper.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-reflection.js';

export type LyraStepState = 'pending' | 'current' | 'completed' | 'error';

export interface LyraStepperOrientationChangeDetail {
  orientation: LyraOrientation;
}

export interface LyraStepItem {
  /** Stable business identity for this step. Duplicate IDs are valid occurrences and are
   * disambiguated by their zero-based collection index. */
  stepId: string;
  /** Nonblank text used as the step's visible and accessible name. */
  label: string;
  /** Progress state. Availability is independent so a disabled step retains its progress. */
  state: LyraStepState;
  /** Excludes this step from activation and roving focus without changing `state`. */
  disabled?: boolean;
  /** Optional native `title` tooltip for this step -- e.g. explaining why a disabled step is
   *  locked. Renders on the step's button, or on the non-interactive item that replaces it while
   *  `readonly`. Omit for no `title` attribute at all (not an empty string). */
  title?: string;
  /** Optional leading topic glyph for this step (e.g. a payment icon on a "Payment" step) --
   *  same `LyraPaletteItem`/`MentionItem`/`LyraSegmentedItem` precedent: intentionally general content
   *  (a `TemplateResult`, an emoji string, etc.), not a square-icon-only field. Rendered
   *  additionally to, never instead of, the state-driven index chip/checkmark -- the icon
   *  identifies the step's topic, the chip/checkmark identifies its state. It is inert and hidden
   *  from assistive technology, so it never supplies a second action or accessible name. */
  icon?: unknown;
}

export interface LyraStepperEventMap {
  'lr-step-select': CustomEvent<{ stepId: string; index: number }>;
  'lr-stepper-orientation-change': CustomEvent<LyraStepperOrientationChangeDetail>;
}

const STEP_STATES = new Set<LyraStepState>([
  'pending',
  'current',
  'completed',
  'error',
]);
const MAX_STEPS = 256;

/** Creates the bounded, realm-neutral snapshot used by rendering, focus, and event correlation.
 * Duplicate step IDs remain valid occurrences because `lr-step-select` also publishes their
 * zero-based index. */
function snapshotSteps(value: unknown): readonly Readonly<LyraStepItem>[] {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
  } catch {
    return Object.freeze([]);
  }

  const normalized: Readonly<LyraStepItem>[] = [];
  let length = 0;
  try {
    length = Math.min(value.length, MAX_STEPS);
  } catch {
    return Object.freeze(normalized);
  }
  for (let index = 0; index < length; index += 1) {
    try {
      const candidate: unknown = value[index];
      if (!candidate || typeof candidate !== 'object') continue;
      const record = candidate as Record<string, unknown>;
      const stepId = record['stepId'];
      const label = record['label'];
      const state = record['state'];
      const disabled = record['disabled'];
      const title = record['title'];
      const icon = record['icon'];
      if (
        typeof stepId !== 'string' ||
        stepId.length === 0 ||
        stepId !== stepId.trim() ||
        typeof label !== 'string' ||
        label.trim() === '' ||
        typeof state !== 'string' ||
        !STEP_STATES.has(state as LyraStepState) ||
        (disabled !== undefined && typeof disabled !== 'boolean') ||
        (title !== undefined && typeof title !== 'string')
      ) {
        continue;
      }
      normalized.push(
        Object.freeze({
          stepId,
          label,
          state: state as LyraStepState,
          ...(disabled !== undefined ? { disabled } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(icon !== undefined ? { icon } : {}),
        })
      );
    } catch {
      // One hostile record must not reject the component's entire update.
    }
  }
  return Object.freeze(normalized);
}

const GLYPH_VIEW_BOX = '0 0 24 24';
const GLYPH_STROKE_WIDTH = '1.75';

function checkmarkGlyph() {
  return html`<svg
    part="step-check"
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
  >
    <polyline points="5 12.5 10 17.5 19 6.5"></polyline>
  </svg>`;
}

/**
 * `<lr-stepper>` — ordered multi-step wizard/form navigation: label + index per step,
 * current/completed/locked/error state, click-to-jump. First-party invention (no Web Awesome
 * equivalent). Fully data-driven and controlled, like `lr-table`'s `columns`/`rows` -- it never
 * mutates `steps` itself; a click or Enter/Space on a non-disabled step fires a non-cancelable
 * `lr-step-select`, and the host decides whether/how `steps` changes in response.
 *
 * An opt-in `orientationBreakpoint` (unset by default -- no behavior change) makes the effective
 * layout/navigation axis respond to a measured inline size instead of only the authored
 * `orientation`: below that width (a pixel number or a `px`/`rem`/`em` CSS length), `narrowOrientation`
 * becomes effective; at/above it, `orientation` does. This mirrors `<lr-multi-split>`'s identically-named
 * `orientationBreakpoint`/`narrowOrientation`/`orientationBreakpointBasis` contract. Under the default
 * `orientationBreakpointBasis="container"` the breakpoint is measured on this stepper's own
 * `[part="base"]` inline size via `ResizeObserver`, so a stepper placed in a narrow split pane or
 * dialog still responds correctly even in a wide window; `orientationBreakpointBasis="viewport"`
 * instead evaluates `matchMedia('(max-width: <breakpoint>)')`, needed when the stepper has a fixed
 * width in a row that stacks at a shared breakpoint. The effective axis is exposed via the
 * `effectiveOrientation` getter, a `data-effective-orientation` host attribute (only present while
 * the breakpoint feature is active), and `lr-stepper-orientation-change`.
 *
 * An opt-in `readonly` (false by default -- no behavior change) turns the same data into a passive
 * progress display: every step renders as a non-interactive item rather than a button, so no step
 * takes a tab stop and no `lr-step-select` is emitted. (A read-only horizontal strip that actually
 * overflows moves the single tab stop onto its own scroll container instead, so its off-screen
 * steps stay keyboard-reachable.) It is deliberately *not* a disabled
 * treatment -- `disabled` says "you may not do this", read-only says "there is nothing to do here"
 * -- so read-only steps keep normal opacity and every state glyph, current-step marker and
 * `--lr-stepper-*` custom property.
 *
 * @customElement lr-stepper
 * @event lr-step-select - Fired on click, or Enter/Space while focused, on a non-`disabled`
 *   step. Never fired while `readonly`. `detail: { stepId, index }`; the index disambiguates
 *   legitimate duplicate step IDs.
 *   Not cancelable: this component is fully controlled (mirrors
 *   `lr-table`'s `columns`/`rows` contract) and takes no default action of its own on selection
 *   (it never mutates `steps`), so there is no real veto point for `preventDefault()` to gate.
 * @event lr-stepper-orientation-change - `detail: { orientation }`, fired when an enabled
 *   `orientationBreakpoint` changes the effective layout/navigation axis.
 * @csspart base - The root wrapper, and the horizontally scrolling track. Takes `tabindex="0"`
 *   only while `readonly` and genuinely overflowing, so an otherwise keyboard-unreachable
 *   read-only strip can still be scrolled; style that state with `::part(base):focus-visible`.
 * @csspart step-item - The `role="listitem"` wrapper for one step.
 * @csspart step - A single step button, or a non-interactive `<div>` carrying the same part while
 *   `readonly`.
 * @csspart step-icon - Optional inert, aria-hidden leading topic glyph supplied by the item's
 *   `icon` field; content may have a natural aspect ratio and is not restricted to a square icon.
 *   Rendered additionally to, never instead of, `step-index`/`step-check`.
 * @csspart step-index - The numbered index chip, shown for `pending`/`current`/`error` steps.
 * @csspart step-check - The completed-checkmark glyph, shown for `completed` steps instead of `step-index`.
 * @csspart step-label - The step's label text.
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of each decorative horizontal overflow fade.
 * Pointer-state hooks use inline `var()` fallbacks rather than a `:host` declaration, so they
 * inherit from the stepper or any ancestor without retheming another state.
 * @cssprop [--lr-stepper-hover-bg=var(--lr-color-brand-quiet)] - Background of a hovered,
 *   non-disabled step.
 * @cssprop [--lr-stepper-hover-color=var(--lr-color-text)] - Text color of a hovered,
 *   non-disabled step.
 * @cssprop [--lr-stepper-active-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of a pressed, non-disabled step.
 * @cssprop [--lr-stepper-active-color=var(--lr-color-text)] - Text color of a pressed,
 *   non-disabled step.
 * @cssprop [--lr-stepper-current-color=var(--lr-color-text)] - Text color of the `current` step.
 *   Declared as an inline `var()` fallback (never on `:host`), so setting it on the element or an
 *   ancestor recolors only the current step without hijacking the library-wide `--lr-color-text` token.
 * @cssprop [--lr-stepper-current-font-weight=var(--lr-font-weight-semibold)] - Font weight of the
 *   `current` step's label. `::part(step)[data-state='current']` is invalid CSS (an attribute
 *   selector cannot follow `::part`), so this is the only way to change just the current step's
 *   boldness without hijacking the library-wide `--lr-font-weight-semibold` token.
 * @cssprop [--lr-stepper-error-color=var(--lr-color-danger)] - Text color of an `error` step.
 * @cssprop [--lr-stepper-current-index-bg=var(--lr-color-brand)] - Background of the `current` step's
 *   numbered index chip (`step-index`).
 * @cssprop [--lr-stepper-current-index-color=var(--lr-color-on-brand)] - Text color of the `current`
 *   step's numbered index chip.
 * @status stable
 * @since 4.0.0
 */
export class LyraStepper extends LyraElement<LyraStepperEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Ordered step data. Never mutated by this component -- see the class doc's controlled-
   *  component contract. Empty (the default) renders nothing. Each step's optional `title`
   *  renders as a native `title` tooltip on that step -- e.g. to explain why a `disabled` step is
   *  locked. */
  private effectiveSteps: readonly Readonly<LyraStepItem>[] = Object.freeze([]);

  @property({ attribute: false })
  get steps(): readonly LyraStepItem[] {
    return this.effectiveSteps;
  }
  set steps(value: readonly LyraStepItem[]) {
    const previous = this.effectiveSteps;
    this.effectiveSteps = snapshotSteps(value);
    this.requestUpdate('steps', previous);
  }

  /** `'horizontal'` (the default) lays steps out in a row (Left/Right, RTL-aware, to navigate);
   *  `'vertical'` stacks them (Up/Down navigate instead, no RTL swap needed). The *authored* axis
   *  used at/above `orientationBreakpoint` (or always, when that's unset) -- see
   *  `effectiveOrientation` for the live axis actually in effect. */
  @property({ reflect: true }) orientation: LyraOrientation = 'horizontal';

  /** Opt-in inline-size breakpoint, measured on `[part="base"]`. Below it, `narrowOrientation`
   *  becomes effective instead of `orientation`. Unset (the default): no behavior change, the
   *  authored `orientation` always applies.
   *
   *  Accepts a bare pixel number (`500`, `'500'`), an explicit `px` length (`'500px'`), a `rem`
   *  length (`'31.25rem'`) or an `em` length (`'3em'`). Under the default
   *  `orientationBreakpointBasis="container"`, `rem` resolves against the **document root**'s
   *  computed font size -- the rule a `@container` query follows, and *not* a `@media` query's --
   *  while `em` resolves against this element's own computed font size. The length is re-resolved
   *  on every measurement, never cached, so browser zoom, a user font-size preference or an app
   *  base-size token change are picked up with no invalidation step. To stay in step with a
   *  sibling `@media (max-width: …rem)` rule, use `orientationBreakpointBasis="viewport"`, which
   *  hands the length to the browser instead; see that property for why the two differ.
   *
   *  Any other value -- `%`, `vw`, `calc()`, `'auto'`, an unparseable string -- behaves exactly as
   *  unset (no responsive observation at all), rather than as an armed breakpoint that can never
   *  be crossed. Set `orientationBreakpointBasis="viewport"` for a viewport-relative breakpoint
   *  instead. */
  @property({ attribute: 'orientation-breakpoint' }) orientationBreakpoint?:
    | number
    | string;

  /** Which box `orientationBreakpoint` measures. `'container'` (the default) observes this
   *  stepper's own `[part="base"]` inline size via `ResizeObserver`, comparing strictly `<`.
   *  `'viewport'` instead evaluates `matchMedia('(max-width: <breakpoint>)')`, which is inclusive
   *  (`<=`) -- native `max-width` semantics, deliberately, so the crossing point matches a CSS
   *  `@media` rule authored with the same length exactly.
   *
   *  A stepper given a fixed width in a row layout cannot react to that row stacking by measuring
   *  itself -- its own width never changes. That case requires `'viewport'`, which also lets the
   *  browser resolve a `rem` breakpoint with real `@media` semantics. */
  @property({ reflect: true, attribute: 'orientation-breakpoint-basis' })
  orientationBreakpointBasis: BreakpointBasis = 'container';

  /** Layout/navigation axis used below `orientationBreakpoint`. */
  @property({ reflect: true, attribute: 'narrow-orientation' })
  narrowOrientation: LyraOrientation = 'vertical';

  /** When true, allows step labels to wrap when the effective orientation is vertical. The
   *  default preserves the single-line labels used by the original stepper contract; horizontal
   *  labels remain single-line even when this property is enabled. */
  @property({ type: Boolean, reflect: true, attribute: 'wrap-labels' })
  wrapLabels = false;

  /** Turns the strip into a passive progress display. Each step renders as a non-interactive
   *  `role="listitem"` item instead of a button: no `tabindex`, no `aria-disabled`, no click or
   *  Enter/Space activation, and therefore no `lr-step-select` at all. Everything that describes
   *  *progress* is kept untouched -- the index chip, the completed checkmark, the optional topic
   *  icon, the per-step `title`, `aria-current="step"` on the current step, and every
   *  `--lr-stepper-*` custom property.
   *
   *  Deliberately not `disabled` styling: `disabled` says "you may not do this", read-only says
   *  "there is nothing to do here", so a read-only step keeps normal opacity and simply loses its
   *  pointer cursor (the same bargain `lr-slider` and `lr-rating` strike for their own `readonly`).
   *  A per-step `disabled` flag is inert while read-only for the same reason -- there is no
   *  activation left for it to gate, so it contributes no dimming either.
   *
   *  No *step* takes a tab stop: roving tabindex exists to give a composite *control* exactly one
   *  entry point, and a passive list is not a control. The one exception is the scroll container
   *  itself -- a read-only horizontal strip that genuinely overflows gives `[part="base"]`
   *  `tabindex="0"` so its hidden steps stay reachable by keyboard (see `syncScrollTabStop()`);
   *  a strip that fits, or a vertical one, still takes no tab stop at all. Unset (the default) is
   *  byte-for-byte the previous behavior. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Accessible name for the `role="list"` step strip. Attribute-reflects from a host-level
   *  `aria-label` so a plain-markup consumer gets ARIA-name forwarding without setting a JS
   *  property. Unset, the list renders without an `aria-label` (the role carries no localized
   *  default name). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private _effectiveOrientation: LyraOrientation = 'horizontal';
  private resizeObserver?: ResizeObserver;
  private resizeObservedElement?: HTMLElement;
  private resizeObserverOwnerDocument?: Document;
  private resizeObserverGeneration = 0;
  private pendingStepFocus?: { stepId: string; index: number };
  @query('[part="base"]') private baseEl?: HTMLElement;
  /** Best-known inline size before `baseEl` exists (or as a fallback while it's momentarily
   *  unmeasured) -- seeded from a real reading of the host's own box in `connectedCallback()`
   *  (see its comment) so the very first render already classifies correctly under the default
   *  `'container'` basis, instead of falling back to the always-'wide' `Number.POSITIVE_INFINITY`
   *  sentinel until the `ResizeObserver`'s own necessarily async first callback lands. */
  private measuredInlineSize = Number.POSITIVE_INFINITY;
  /** Owns breakpoint resolution, basis selection, and the viewport `MediaQueryList` lifecycle
   *  (including teardown on disconnect) -- see `OrientationBreakpointController`. */
  private orientationBreakpoints = new OrientationBreakpointController(
    this,
    () =>
      this.updateEffectiveOrientation(
        this.baseEl?.clientWidth ?? this.measuredInlineSize,
        true
      )
  );

  /** Gates the horizontal [part="base"] edge fade on the track genuinely overflowing, with
   *  one-sided/RTL-aware logical-edge state -- see --lr-scroll-fade-size and stepper.styles.ts.
   *  Independent of the orientation controller above: the vertical rules zero the mask out
   *  regardless of this attribute. Stored (rather than a bare statement-expression call) so
   *  `updated()` can register each step on the controller's own `ResizeObserver` via
   *  `observeExtra()` below -- a step's own intrinsic content (a longer localized label, an icon
   *  loading in) can grow scrollWidth without [part="base"]'s own border box changing at all.
   *  The `onResize` hook re-syncs the read-only scroll tab stop from inside this controller's own
   *  (already-measured) `ResizeObserver` callback, which is the one path that flips overflow
   *  without a host update for `updated()` to ride on -- see `syncScrollTabStop()`. */
  private scrollOverflow = observeScrollOverflow(
    this,
    () => this.baseEl,
    () => this.syncScrollTabStop()
  );

  /** The live layout/navigation axis after applying `orientationBreakpoint` -- identical to
   *  `orientation` whenever that's unset. See the class doc. */
  get effectiveOrientation(): LyraOrientation {
    return this._effectiveOrientation;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Seeds `measuredInlineSize` with a real reading of the host's own box, taken before the
    // very first render (and again on every reconnect) -- [part="base"] is a block-level flex
    // container with no width of its own (see stepper.styles.ts), so it fills the host's
    // content-box width, making the host's own box a safe stand-in for it before that part even
    // exists. See the field's own comment for why this matters.
    const hostWidth = this.getBoundingClientRect().width;
    if (hostWidth > 0) this.measuredInlineSize = hostWidth;
    if (this.orientationBreakpoints.containerObservationEnabled)
      this.armResizeObserver();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetResizeObserver();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetResizeObserver();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (this.orientationBreakpoints.containerObservationEnabled)
      this.armResizeObserver();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('steps')) {
      const focusedStep = activeElementIn(
        this.renderRoot as ShadowRoot
      ) as HTMLElement | null;
      if (focusedStep?.getAttribute('part') === 'step') {
        this.pendingStepFocus = {
          stepId: focusedStep.dataset['stepId'] ?? '',
          index: Number(focusedStep.dataset['index']),
        };
      }
    }
    if (
      changed.has('orientationBreakpoint') ||
      changed.has('orientationBreakpointBasis')
    ) {
      this.orientationBreakpoints.configure(
        this.orientationBreakpoint,
        this.orientationBreakpointBasis
      );
    }
    if (
      changed.has('orientation') ||
      changed.has('narrowOrientation') ||
      changed.has('orientationBreakpoint') ||
      changed.has('orientationBreakpointBasis')
    ) {
      // Under 'viewport' basis, `configure()` just above (re-)armed `matchMedia` synchronously, so
      // `isBelow()` below already reflects a live, authoritative read -- the same "fresh
      // measurement" condition that earns an emit elsewhere (see this method's own doc comment).
      // That's only a genuine transition to emit for on a *later* update, though: on this
      // component's very first update `this.hasUpdated` is still false here (Lit only flips it
      // after this update completes), and `_effectiveOrientation` has no committed prior value to
      // transition away from yet, so the very first read must never emit -- matching this event's
      // documented "changes the effective axis" contract. Under 'container' basis there's no fresh
      // read here at all -- only `measuredInlineSize`, which `connectedCallback()` already seeded
      // with a real reading of the host's own box before this first render (see its comment), so
      // the first paint is already correct here too; the `ResizeObserver` callback's own fresh
      // measurement still owns every subsequent transition.
      this.updateEffectiveOrientation(
        this.baseEl?.clientWidth ?? this.measuredInlineSize,
        this.hasUpdated && this.orientationBreakpointBasis === 'viewport'
      );
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // ARIA idrefs do not cross a shadow boundary -- a host-authored `aria-describedby` never
    // reaches `[part="base"]`'s own `role="list"` (which owns the accessible description) unless
    // it is explicitly reflected there. Mirrors lr-checkbox's/lr-flow-minimap's identical
    // `syncAriaDescribedByElements` use.
    const base = this.renderRoot.querySelector<HTMLElement>('[part~="base"]') ?? undefined;
    syncAriaDescribedByElements(this, base, this.getAttribute('aria-describedby'));
    // Each step's own intrinsic geometry (a label, image, font, or slot change) can alter scroll
    // reachability without [part="base"]'s own border box changing at all -- the primary observer
    // above only watches that one container, so every current step rides along on its single
    // ResizeObserver instance instead of a second one of its own.
    this.scrollOverflow.observeExtra(
      this.renderRoot.querySelectorAll('[part="step"]')
    );
    // Runs after the controller's own `hostUpdated()` measurement (Lit drives every controller's
    // `hostUpdated` before the host's `updated`), so the overflow attribute it reads is this
    // render's, not the previous one's.
    this.syncScrollTabStop();
    if (this.pendingStepFocus !== undefined) {
      const focusedOccurrence = this.pendingStepFocus;
      this.pendingStepFocus = undefined;
      const enabledIdentityMatches = [
        ...this.renderRoot.querySelectorAll<HTMLElement>('[part="step"]'),
      ].filter(
        (step) =>
          step.dataset['stepId'] === focusedOccurrence.stepId &&
          step.getAttribute('aria-disabled') !== 'true'
      );
      const retainedStep =
        enabledIdentityMatches.find(
          (step) => Number(step.dataset['index']) === focusedOccurrence.index
        ) ??
        // A unique business identity may move when the collection is reordered. Duplicate IDs
        // deliberately do not take this fallback: picking the first match would collapse two
        // legitimate occurrences and move focus to the wrong step on a data refresh.
        (enabledIdentityMatches.length === 1
          ? enabledIdentityMatches[0]
          : undefined);
      (
        retainedStep ??
        this.renderRoot.querySelector<HTMLElement>(
          '[part="step"][tabindex="0"]'
        )
      )?.focus();
    }
    if (
      changed.has('orientationBreakpoint') ||
      changed.has('orientationBreakpointBasis')
    ) {
      if (this.orientationBreakpoints.containerObservationEnabled)
        this.armResizeObserver();
      else this.resetResizeObserver();
    }
  }

  /** Gives the horizontally scrolling `[part="base"]` its own tab stop while, and only while, it
   *  both is `readonly` and genuinely overflows.
   *
   *  A read-only strip renders every step as a plain `<div>`, so it has no tabbable descendant of
   *  any kind. A scroll container with content to scroll and nothing tabbable inside is
   *  unreachable by keyboard -- the WCAG 2.1.1 failure axe reports as
   *  `scrollable-region-focusable` -- so the container itself takes the stop. `role="list"` and
   *  its optional `aria-label` are unchanged, and `onKeyDown()` already returns early while
   *  read-only, so this is a pure scroll stop: arrow keys scroll the box natively and no roving
   *  semantics come back with it.
   *
   *  Both halves of the gate matter. While interactive, the roving tabindex already guarantees
   *  exactly one tabbable step inside, and a second stop on the container would make every
   *  stepper cost two tabs instead of one. While read-only but fitting, there is nothing to
   *  scroll to, so a stop there would be dead weight -- the same "only when it actually
   *  overflows" bargain the edge fade above already strikes, and what the browsers' own
   *  keyboard-focusable-scrollers behavior does. The vertical axis is excluded outright because
   *  its rules set `overflow: visible` on both axes (stepper.styles.ts), so that box never
   *  scrolls whatever `scrollWidth` reports.
   *
   *  Written as an attribute rather than through the template because overflow is measured, not
   *  rendered: the controller flips it from a `ResizeObserver`/content change with no state Lit
   *  could re-render from, and `[part="base"]` is a stable node across every re-render. Mirrors
   *  the `syncAriaDescribedByElements()` call in `updated()` on this same element. */
  private syncScrollTabStop(): void {
    const base = this.baseEl;
    if (!base) return;
    const scrollable =
      this.effectiveOrientation === 'horizontal' &&
      base.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE);
    if (this.readonly && scrollable) base.setAttribute('tabindex', '0');
    else base.removeAttribute('tabindex');
  }

  /** Classifies a measured inline size into the effective layout/navigation axis and, only on an
   *  actual transition, applies it -- mirrors `<lr-multi-split>`'s identically-shaped
   *  `updateEffectiveOrientation()`. `emitOnChange` is false for the property-driven re-derivation
   *  in `willUpdate()` (except a genuine viewport-basis transition after the first update -- see
   *  `willUpdate()`'s own doc comment) and true for the `ResizeObserver`/`matchMedia` callbacks'
   *  own fresh measurements. */
  private updateEffectiveOrientation(
    width: number,
    emitOnChange: boolean
  ): void {
    const next: LyraOrientation = this.orientationBreakpoints.isBelow(width)
      ? this.narrowOrientation
      : this.orientation;
    // Gated on `active` (not `resolvedOrientationBreakpoint`) so a viewport-basis breakpoint still
    // publishes this marker even though `resolved` is meaningless there -- see
    // OrientationBreakpointController's class doc.
    if (this.orientationBreakpoints.active) {
      this.setAttribute('data-effective-orientation', next);
    } else {
      this.removeAttribute('data-effective-orientation');
    }
    if (next === this._effectiveOrientation) return;
    this._effectiveOrientation = next;
    this.requestUpdate();
    if (emitOnChange) {
      this.emit('lr-stepper-orientation-change', { orientation: next });
    }
  }

  /** Creates (idempotently) and (re-)observes `[part="base"]` -- a no-op until `baseEl` exists (see
   *  `firstUpdated()`/`connectedCallback()`). */
  private armResizeObserver(): void {
    const observedElement = this.baseEl;
    if (!this.isConnected || !observedElement) return;
    const ownerDocument = this.ownerDocument;
    if (
      this.resizeObserver &&
      this.resizeObservedElement === observedElement &&
      this.resizeObserverOwnerDocument === ownerDocument
    ) {
      return;
    }

    this.resetResizeObserver();
    const ResizeObserverConstructor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverConstructor) return;
    const generation = this.resizeObserverGeneration;
    const observer = new ResizeObserverConstructor((entries) => {
      if (
        this.resizeObserver !== observer ||
        this.resizeObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument ||
        this.baseEl !== observedElement
      ) {
        return;
      }
      const box = entries[0]?.contentBoxSize?.[0];
      const width = box
        ? box.inlineSize
        : observedElement.getBoundingClientRect().width;
      this.measuredInlineSize = width;
      this.updateEffectiveOrientation(width, true);
    });
    this.resizeObserver = observer;
    this.resizeObservedElement = observedElement;
    this.resizeObserverOwnerDocument = ownerDocument;
    observer.observe(observedElement);
  }

  private resetResizeObserver(): void {
    this.resizeObserverGeneration += 1;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeObservedElement = undefined;
    this.resizeObserverOwnerDocument = undefined;
  }

  private selectStep(step: LyraStepItem, index: number): void {
    // `readonly` is re-checked here, not only in render(): a read-only step binds no @click, but a
    // host can still dispatch a synthetic click at the part, and a passive progress display must
    // never publish a selection it has no way to have been asked for.
    if (this.readonly || step.disabled) return;
    // Not cancelable -- see the class doc's `lr-step-select` entry for why this component (a
    // fully controlled, data-driven component like `lr-table`) has no default action of its own
    // to gate behind `.defaultPrevented`.
    this.emit('lr-step-select', {
      stepId: step.stepId,
      index,
    });
  }

  private focusStep(index: number): void {
    const button = this.renderRoot.querySelector(
      `[part="step"][data-index="${index}"]`
    ) as HTMLElement | null;
    button?.focus();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // A read-only strip owns no focus stop, so there is nothing to rove between and nothing to
    // activate. Returning before the preventDefault() branches below also leaves Space scrolling
    // the page and Home/End reaching whatever scroll container the list sits in, which is the
    // correct behavior for a passive list.
    if (this.readonly) return;
    const navigable = this.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => !step.disabled);
    if (navigable.length === 0) return;
    const focused = activeElementIn(
      this.renderRoot as ShadowRoot
    ) as HTMLElement | null;
    const focusedIndex = Number(focused?.dataset['index']);
    const currentIndex = navigable.findIndex(
      (item) => item.index === focusedIndex
    );
    const vertical = this.effectiveOrientation === 'vertical';
    const rtl = !vertical && isRtl(this);
    const forwardKey = vertical
      ? 'ArrowDown'
      : rtl
      ? 'ArrowLeft'
      : 'ArrowRight';
    const backwardKey = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex: number;
    switch (e.key) {
      case forwardKey:
        targetIndex = Math.min(
          navigable.length - 1,
          (currentIndex < 0 ? -1 : currentIndex) + 1
        );
        break;
      case backwardKey:
        targetIndex = Math.max(0, (currentIndex < 0 ? 1 : currentIndex) - 1);
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = navigable.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentIndex >= 0) {
          const target = navigable[currentIndex]!;
          this.selectStep(target.step, target.index);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    this.focusStep(navigable[targetIndex]!.index);
  };

  override render(): TemplateResult {
    // Roving tabindex needs exactly one stop in the tab order at all times -- the `current` step
    // when there is one, otherwise the first step a keyboard user could actually land on. Without
    // this fallback, an all-`completed`/all-`pending`/no-`current` `steps` array would leave every
    // button at tabindex="-1" and drop the whole stepper out of the tab order.
    const currentIndex = this.steps.findIndex(
      (step) => step.state === 'current'
    );
    // -1 while `readonly`, so no step claims the stop: roving tabindex gives a composite *control*
    // exactly one entry point, and a passive progress display is not a control. That is the one
    // case where leaving zero focusable stops is correct rather than the bug the fallback above
    // exists to prevent, because there is no keyboard contract left to strand.
    const rovingIndex = this.readonly
      ? -1
      : currentIndex >= 0 && !this.steps[currentIndex]!.disabled
      ? currentIndex
      : this.steps.findIndex((step) => !step.disabled);
    const numberFormat = getNumberFormat(this.effectiveLocale);
    /** The topic icon and state glyph, identical in both branches below, because `readonly`
     *  changes what a step *is*, never what progress it reports. The `step-label` span stays
     *  written out at each call site rather than joining this helper: it is the step's meaningful
     *  text content, and check:hit-area reads that statically to tell a labelled control from a
     *  compact icon-only one that owes the 40px floor. */
    const stepGlyphs = (step: Readonly<LyraStepItem>, index: number) =>
      html`${step.icon !== undefined
        ? html`<span part="step-icon" aria-hidden="true" inert
            >${step.icon}</span
          >`
        : nothing}
      ${step.state === 'completed'
        ? checkmarkGlyph()
        : html`<span part="step-index"
            >${numberFormat.format(index + 1)}</span
          >`}`;
    return html`
      <div
        part="base"
        role="list"
        aria-label=${this.accessibleLabel ?? nothing}
        @keydown=${this.onKeyDown}
      >
        ${repeat(
          this.steps,
          (step, index) => `${step.stepId}\u0000${index}`,
          (step, index) => html`<div role="listitem" part="step-item">
            ${this.readonly
              ? // No button element, no tabindex, no @click and no aria-disabled: a read-only step
                // is a plain item inside the role="listitem" wrapper, so assistive technology
                // announces progress instead of an unavailable command. aria-current and the state
                // glyphs stay, because those describe progress, not availability.
                html`<div
                  part="step"
                  data-step-id=${step.stepId}
                  data-index=${index}
                  data-state=${step.state}
                  aria-current=${index === currentIndex ? 'step' : 'false'}
                  title=${step.title ?? nothing}
                >
                  ${stepGlyphs(step, index)}
                  <span part="step-label">${step.label}</span>
                </div>`
              : html`<button
                  type="button"
                  part="step"
                  data-step-id=${step.stepId}
                  data-index=${index}
                  data-state=${step.state}
                  aria-current=${index === currentIndex ? 'step' : 'false'}
                  aria-disabled=${step.disabled ? 'true' : 'false'}
                  tabindex=${index === rovingIndex ? '0' : '-1'}
                  title=${step.title ?? nothing}
                  @click=${() => this.selectStep(step, index)}
                >
                  ${stepGlyphs(step, index)}
                  <span part="step-label">${step.label}</span>
                </button>`}
          </div>`
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-stepper': LyraStepper;
  }
}
