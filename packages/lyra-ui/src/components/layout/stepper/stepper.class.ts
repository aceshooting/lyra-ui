import { finiteCount } from '../../../internal/numbers.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import { checkIcon } from '../../../internal/icons.js';
import { HostChildrenObserver, OwnedResizeObserver, readInlineSize } from '../../../internal/owned-observer.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraVariant } from '../../../internal/variants.js';
import type { LyraStep } from './step.class.js';
import { OwnedFrame } from '../../../internal/owned-timer.js';
import { SnapshotProperty } from '../../../internal/collection-source-tracker.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resolveAccessibleName } from '../../../internal/accessible-name.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  OrientationBreakpointController,
  type BreakpointBasis,
} from '../../../internal/orientation-breakpoint.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { isRepeatedActivationKey, shouldIgnoreNavigationKey, resolveListMove } from '../../../internal/list-navigation.js';
import {
  observeScrollOverflow,
  SCROLL_OVERFLOW_ATTRIBUTE,
} from '../../../internal/scroll-overflow.js';
import { scrollOverflowFadeStyles } from '../../../internal/scroll-overflow.styles.js';
import { styles } from './stepper.styles.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { restoreComposedFocus } from '../../../internal/focus-repair.js';
import { collectComposedFocusTargets } from '../../../internal/focus-navigation.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-reflection.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { isElementNode } from '../../../internal/dom-guards.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_stepperStateCompleted, LYRA_DEFAULT_stepperStateError, LYRA_DEFAULT_stepperStateLocked, LYRA_DEFAULT_stepperStatePending, LYRA_DEFAULT_stepperStepPosition, LYRA_DEFAULT_stepperSteps } from '../../../internal/default-strings/layout.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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

/** Layout axis of a stepper. `auto` lays the steps in a row and stacks them when the stepper is too
 *  narrow to give each step room. */
export type LyraStepperOrientation = LyraOrientation | 'auto';

/** Payload of `lr-before-step-change` and `lr-step-change` in child-driven mode. */
export interface LyraStepChangeDetail {
  /** `name` of the step becoming current. */
  name: string;
  /** `name` of the step that was current, or `null` when none was. */
  previousName: string | null;
  /** The step becoming current. */
  step: LyraStep;
  /** The step that was current, or `null` when none was. */
  previousStep: LyraStep | null;
}

export interface LyraStepperEventMap {
  'lr-step-select': CustomEvent<{ stepId: string; index: number }>;
  'lr-before-step-change': CustomEvent<LyraStepChangeDetail>;
  'lr-step-change': CustomEvent<LyraStepChangeDetail>;
  'lr-stepper-orientation-change': CustomEvent<LyraStepperOrientationChangeDetail>;
}

const STEP_STATES = new Set<LyraStepState>([
  'pending',
  'current',
  'completed',
  'error',
]);
const MAX_STEPS = 256;

interface StepperInvokerRecord {
  count: number;
  handler: (event: Event) => void;
}
const invokerRecords = new WeakMap<Document, StepperInvokerRecord>();
const INVOKER_COMMANDS = new Set(['next', 'previous', 'goto']);

/** One shared document listener per document resolves `data-stepper="<command> [id] [args]"`
 *  invokers, which may sit anywhere on the page, inside a shadow root or inside the stepper itself.
 *  Registered while at least one stepper is connected, so importing the module has no side effect. */
function handleInvokerClick(event: Event): void {
  const invoker = event
    .composedPath()
    .find((node): node is Element => node instanceof Element && node.hasAttribute('data-stepper'));
  if (!invoker) return;
  const [rawCommand, ...rest] = (invoker.getAttribute('data-stepper') ?? '').trim().split(/\s+/);
  const command = (rawCommand ?? '').toLowerCase();
  if (!INVOKER_COMMANDS.has(command)) return;
  const root = invoker.getRootNode() as Partial<Document | ShadowRoot>;
  const named = rest[0] ? root.getElementById?.(rest[0]) ?? null : null;
  const byId = named?.localName === tag('stepper');
  const target = (byId ? named : invoker.closest(tag('stepper'))) as LyraStepper | null;
  if (!target) return;
  const args = byId ? rest.slice(1) : rest;
  if (command === 'next') target.next();
  else if (command === 'previous') target.previous();
  else if (args.length > 0) target.goTo(args.join(' '));
}

function acquireInvokers(doc: Document): void {
  const existing = invokerRecords.get(doc);
  if (existing) {
    existing.count += 1;
    return;
  }
  doc.addEventListener('click', handleInvokerClick);
  invokerRecords.set(doc, { count: 1, handler: handleInvokerClick });
}

function releaseInvokers(doc: Document): void {
  const record = invokerRecords.get(doc);
  if (!record) return;
  record.count -= 1;
  if (record.count > 0) return;
  doc.removeEventListener('click', record.handler);
  invokerRecords.delete(doc);
}

/** Creates the bounded, realm-neutral snapshot used by rendering, focus, and event correlation.
 * Duplicate step IDs remain valid occurrences because `lr-step-select` also publishes their
 * zero-based index. */
function snapshotSteps(value: unknown, reportOmitted: (count: number) => void): readonly Readonly<LyraStepItem>[] {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
  } catch {
    return Object.freeze([]);
  }

  const normalized: Readonly<LyraStepItem>[] = [];
  let length = 0;
  try {
    const sourceLength = finiteCount(value.length);
    length = Math.min(sourceLength, MAX_STEPS);
    reportOmitted(sourceLength - length);
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

/**
 * `<lr-stepper>` — ordered multi-step wizard/form navigation: label + index per step,
 * current/completed/locked/error state, click-to-jump. Mirrors `wa-stepper`, whose `wa-step`
 * children are `<lr-step>`; the stepper has two authoring modes.
 *
 * Data-driven mode (the original contract): fully controlled, like `lr-table`'s `columns`/`rows` --
 * it never mutates `steps` itself; a click or Enter/Space on a non-disabled step fires a
 * non-cancelable `lr-step-select`, and the host decides whether/how `steps` changes in response.
 *
 * Child mode: with an empty `steps` array and `<lr-step>` children, the stepper owns the current
 * step. `active` names it (the first step when unset or unmatched), `goTo(name)`, `next()` and
 * `previous()` move it, and each move first emits a cancelable `lr-before-step-change` (a
 * `preventDefault()` veto keeps the current step) and then `lr-step-change`, and announces the new
 * position politely. `linear` stops a step being reached until every step before it is
 * `completed`; later steps render locked. `clickable` makes each step a button (one roving tab stop,
 * Left/Right swapped under RTL, Up/Down while stacked, Home/End) so a click or Enter/Space jumps to
 * it; unset, only the methods and invokers move the step, and the stepper is a labelled group
 * instead of a navigation landmark. Any element on the page, inside the stepper or not, with
 * `data-stepper="next <id>"`, `"previous <id>"` or `"goto <id> <step-name>"` drives the stepper
 * whose `id` it names when clicked. `label` names the group. The array mode is unchanged and wins
 * while `steps` is non-empty.
 *
 * `orientation="auto"` lays the steps in a row and stacks them whenever the stepper's own measured
 * width cannot give every step about 6em, so a phone-width container stacks without any breakpoint.
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
 *   `orientationBreakpoint`, or `orientation="auto"`, changes the effective layout/navigation axis.
 * @event lr-before-step-change - Child mode. Cancelable; `detail: { name, previousName, step,
 *   previousStep }`, fired before `active` changes. `preventDefault()` keeps the current step.
 * @event lr-step-change - Child mode. `detail` as `lr-before-step-change`; fired after `active`
 *   changed and the steps re-rendered.
 * @slot - Child mode: one or more `<lr-step>` elements.
 * @csspart stepper - Child mode: the outer wrapper, a `<nav>` landmark while `clickable`, otherwise
 *   a labelled `role="group"`.
 * @csspart summary - Child mode: visually hidden "Step X of Y" text for assistive technology.
 * @csspart steps - The list element that lays out the steps; the same node as `base`.
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
 * @cssprop [--lr-stepper-marker-size=var(--lr-size-2rem)] - Child mode: diameter of each step's marker.
 * @cssprop [--lr-stepper-connector-color=var(--lr-color-neutral-fill-normal)] - Child mode: color of the
 *   line after a step that is not completed.
 * @cssprop [--lr-stepper-connector-active-color] - Child mode: color of the line after a completed
 *   step; unset, it follows that step's variant.
 * @cssprop [--lr-stepper-connector-width=var(--lr-border-width-medium)] - Child mode: line thickness.
 * @cssprop [--lr-stepper-connector-gap=var(--lr-size-0-35em)] - Child mode: gap between a marker and
 *   the line on both sides.
 * @cssprop [--lr-stepper-step-gap=var(--lr-space-m)] - Child mode: space between steps while stacked.
 * @cssprop [--marker-size=var(--lr-stepper-marker-size,var(--lr-size-2rem))] - Child mode: alias of
 *   `--lr-stepper-marker-size`; wins when both are set.
 * @cssprop [--connector-color=var(--lr-stepper-connector-color,var(--lr-color-neutral-fill-normal))] -
 *   Child mode: alias of `--lr-stepper-connector-color`; wins when both are set.
 * @cssprop [--connector-color-active] - Child mode: alias of `--lr-stepper-connector-active-color`;
 *   wins when both are set.
 * @cssprop [--connector-width=var(--lr-stepper-connector-width,var(--lr-border-width-medium))] - Child
 *   mode: alias of `--lr-stepper-connector-width`; wins when both are set.
 * @cssprop [--connector-gap=var(--lr-stepper-connector-gap,var(--lr-size-0-35em))] - Child mode: alias
 *   of `--lr-stepper-connector-gap`; wins when both are set.
 * @cssprop [--gap=var(--lr-stepper-step-gap,var(--lr-space-m))] - Child mode: alias of
 *   `--lr-stepper-step-gap`, the space between stacked steps; wins when both are set. In a row the
 *   connectors span the space between steps, which share the width evenly.
 * @cssstate completed - Every step is completed (child mode: every `<lr-step>` is `completed`; data
 *   mode: every item's `state` is `completed`).
 * @cssstate loading - Child mode: at least one `<lr-step>` is `loading`.
 * @cssstate stacked - The steps are laid out vertically, by `orientation="vertical"`, an
 *   `orientationBreakpoint` or an `auto` stepper too narrow for a row.
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
 * @cssprop [--lr-stepper-index-bg=var(--lr-color-neutral-fill-normal)] - Background of a step's
 *   `[part='step-index']` outside the current and error states.
 * @cssprop [--lr-stepper-index-border=none] - Border shorthand of a step's index circle (for example
 *   `2px solid currentColor`); the circle keeps its size.
 * @cssprop [--lr-stepper-current-index-border=var(--lr-stepper-index-border,none)] - Border of the `current` step's index.
 * @cssprop [--lr-stepper-error-index-border=var(--lr-stepper-index-border,none)] - Border of an `error` step's index.
 * @cssprop [--lr-stepper-index-color=var(--lr-color-neutral-on-normal)] - Text color of that index.
 * @cssprop [--lr-stepper-error-index-bg=var(--lr-color-neutral-fill-normal)] - Background of an
 *   `error` step's index.
 * @cssprop [--lr-stepper-error-index-color=var(--lr-color-neutral-on-normal)] - Text color of an
 *   `error` step's index.
 * @cssprop [--lr-stepper-check-color=var(--lr-color-success)] - Color of a completed step's
 *   `[part='step-check']` mark.
 * @cssprop [--lr-stepper-current-index-bg=var(--lr-color-brand)] - Background of the `current` step's
 *   numbered index chip (`step-index`).
 * @cssprop [--lr-stepper-current-index-color=var(--lr-color-on-brand)] - Text color of the `current`
 *   step's numbered index chip.
 * @status stable
 * @since 4.0.0
 */
export class LyraStepper extends LyraElement<LyraStepperEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    stepperStateCompleted: LYRA_DEFAULT_stepperStateCompleted,
    stepperStateError: LYRA_DEFAULT_stepperStateError,
    stepperStateLocked: LYRA_DEFAULT_stepperStateLocked,
    stepperStatePending: LYRA_DEFAULT_stepperStatePending,
    stepperStepPosition: LYRA_DEFAULT_stepperStepPosition,
    stepperSteps: LYRA_DEFAULT_stepperSteps,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-before-step-change',
    'lr-step-change',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-before-step-change': Object.freeze(['step', 'previousStep']),
    'lr-step-change': Object.freeze(['step', 'previousStep']),
  });

  static override styles = [LyraElement.styles, scrollOverflowFadeStyles, styles];

  private omitted = 0;
  private readonly stepsSnapshot = new SnapshotProperty<readonly Readonly<LyraStepItem>[]>(
    Object.freeze([]),
    value => {
      this.omitted = 0;
      return snapshotSteps(value, count => { this.omitted = count; });
    },
  );

  /** Input positions beyond the 256-position limit on the latest assignment. */
  get omittedSteps(): number { return this.omitted; }

  /** Ordered step data. Never mutated by this component -- see the class doc's controlled-
   *  component contract. Empty (the default) renders nothing. Each step's optional `title`
   *  renders as a native `title` tooltip on that step -- e.g. to explain why a `disabled` step is
   *  locked. */
  @property({ attribute: false })
  get steps(): readonly LyraStepItem[] {
    return this.stepsSnapshot.read();
  }
  set steps(value: readonly LyraStepItem[]) {
    this.stepsSnapshot.assign(this, 'steps', value);
  }

  /** `'horizontal'` (the default) lays steps out in a row (Left/Right, RTL-aware, to navigate);
   *  `'vertical'` stacks them (Up/Down navigate instead, no RTL swap needed); `'auto'` lays them in
   *  a row and stacks them whenever the stepper's measured inline size cannot give each step about
   *  6em (plus the gaps), so a narrow container or a phone stacks with no breakpoint to author.
   *  `'auto'` measures the stepper, so a server-rendered one starts as a row. The *authored* axis
   *  used at/above `orientationBreakpoint` (or always, when that's unset) -- see
   *  `effectiveOrientation` for the live axis actually in effect. */
  @property({ reflect: true, converter: declaredDefaultConverter<LyraStepperOrientation>('horizontal') }) orientation: LyraStepperOrientation = 'horizontal';

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
  @property({ reflect: true, converter: declaredDefaultConverter<BreakpointBasis>('container'), attribute: 'orientation-breakpoint-basis' })
  orientationBreakpointBasis: BreakpointBasis = 'container';

  /** Layout/navigation axis used below `orientationBreakpoint`. */
  @property({ reflect: true, converter: declaredDefaultConverter<LyraOrientation>('vertical'), attribute: 'narrow-orientation' })
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

  /** Accessible name when no aria-label is supplied. In child mode it names the stepper's group or
   *  navigation landmark (a localized "Steps" when unset). */
  @property() label?: string;

  /** Child mode: the `name` of the current `<lr-step>`. Falls back to the first visible step when
   *  unset or when it matches no visible step. Changing it from script moves the step without the veto event;
   *  `goTo()`, `next()` and `previous()` ask first. */
  @property({ reflect: true }) active = '';

  /** Child mode: steps must be completed in order. `next()`, `goTo()`, an invoker and a click
   *  cannot reach a step until every visible step before it is `completed`; later steps render locked. */
  @property({ type: Boolean, reflect: true }) linear = false;

  /** Child mode: each step becomes a button, so a click (or Enter/Space on a focused step) jumps to
   *  it. Unset, only the methods and `data-stepper` invokers move the step. */
  @property({ type: Boolean, reflect: true }) clickable = false;

  private childSteps: LyraStep[] = [];
  private focusedChildStep?: LyraStep;
  private readonly stepperInternals = attachInternalsSafely(this);
  @state() private childCount = 0;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });

  /** True while child mode is in effect: `<lr-step>` children and an empty `steps` array. */
  private get childMode(): boolean {
    return this.childSteps.length > 0 && this.steps.length === 0;
  }

  private get visibleChildSteps(): LyraStep[] {
    return this.childSteps.filter((step) => !step.hasAttribute('hidden'));
  }

  constructor() {
    super();
    this.addEventListener('click', this.onChildClick);
    this.addEventListener('keydown', this.onChildKeyDown);
    this.addEventListener('focusin', this.onChildFocusIn);
    this.addEventListener('focusout', this.onChildFocusOut);
    // Keeps the child list current; the controller registers itself with the host.
    new HostChildrenObserver(this, {
      subtree: true,
      attributeFilter: ['name', 'completed', 'loading', 'disabled', 'variant', 'hidden'],
      onChange: (records) => {
        const own = records.some((record) => {
          const target = record.target as Element;
          if (record.attributeName === 'hidden')
            return target.parentElement === this && target.localName === tag('step');
          return target === this || target.closest?.(tag('stepper')) === this;
        });
        if (own) this.syncChildSteps();
      },
    });
  }

  private _effectiveOrientation: LyraOrientation = 'horizontal';
  private readonly resizeFrame = new OwnedFrame(this);
  private readonly resizeObserver = new OwnedResizeObserver(this, entries => {
    const width = readInlineSize(entries[0]) ?? this.orientationInlineSize();
    this.resizeFrame.schedule(() => {
      this.measuredInlineSize = width;
      this.updateEffectiveOrientation(width, true);
    });
  });
  private readonlyFocusLost = false;
  private pendingStepFocus?: { stepId: string; index: number };
  @query('[part~="base"]') private baseEl?: HTMLElement;
  /** Container width seeded before the first render only when its orientation breakpoint
   *  consumes it, then refreshed on reconnect and by the allocation observer. */
  private measuredInlineSize = Number.POSITIVE_INFINITY;
  /** Owns breakpoint resolution, basis selection, and the viewport `MediaQueryList` lifecycle
   *  (including teardown on disconnect) -- see `OrientationBreakpointController`. */
  private orientationBreakpoints = new OrientationBreakpointController(
    this,
    () =>
      this.updateEffectiveOrientation(
        this.orientationInlineSize(),
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

  /** Whether a container-measuring observer is needed: an armed breakpoint or `orientation="auto"`. */
  private get observesContainer(): boolean {
    return this.orientationBreakpoints.containerObservationEnabled || this.orientation === 'auto';
  }

  /** The live layout/navigation axis after applying `orientationBreakpoint` -- identical to
   *  `orientation` whenever that's unset. See the class doc. */
  get effectiveOrientation(): LyraOrientation {
    return this._effectiveOrientation;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.observesContainer)
      this.seedInlineSize();
    if (this.observesContainer)
      this.armResizeObserver();
    this.registerInvokers();
    this.syncChildSteps();
  }

  private invokerDocument?: Document;

  private registerInvokers(): void {
    const doc = this.ownerDocument;
    if (this.invokerDocument === doc) return;
    this.unregisterInvokers();
    this.invokerDocument = doc;
    acquireInvokers(doc);
  }

  private unregisterInvokers(): void {
    if (this.invokerDocument) releaseInvokers(this.invokerDocument);
    this.invokerDocument = undefined;
  }

  private seedInlineSize(): void {
    const hostWidth = this.getBoundingClientRect().width;
    if (hostWidth > 0) this.measuredInlineSize = hostWidth;
  }

  private orientationInlineSize(): number {
    return this.observesContainer
      ? this.baseEl?.clientWidth ?? this.measuredInlineSize
      : this.measuredInlineSize;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.focusedChildStep = undefined;
    this.resetResizeObserver();
    this.unregisterInvokers();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetResizeObserver();
    this.unregisterInvokers();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (this.observesContainer)
      this.armResizeObserver();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('readonly') && this.hasUpdated) {
      // Switching to a read-only strip swaps the focused <button part=step> for a plain <div>, so
      // the focused node is removed; remember that focus was inside so it can be repaired.
      this.readonlyFocusLost = shadowFocusTarget(this)?.getAttribute('part') === 'step';
    }
    if (
      changed.has('active') ||
      changed.has('linear') ||
      changed.has('clickable') ||
      changed.has('steps') ||
      !this.hasUpdated
    ) {
      this.applyChildState();
    }
    if (changed.has('steps')) {
      const focusedStep = shadowFocusTarget(this) as HTMLElement | null;
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
    // Property bindings can be committed after connection in the same turn. Resolve them before
    // taking the first container measurement so the initial layout uses the authored breakpoint.
    if (!this.hasUpdated && this.isConnected && this.observesContainer)
      this.seedInlineSize();
    if (
      changed.has('orientation') ||
      (changed.has('steps') && this.orientation === 'auto') ||
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
      // read here at all -- only `measuredInlineSize`, seeded above before this first render, so
      // the first paint is already correct here too; the `ResizeObserver` callback's own fresh
      // measurement still owns every subsequent transition.
      this.updateEffectiveOrientation(
        this.orientationInlineSize(),
        this.hasUpdated && this.orientationBreakpointBasis === 'viewport'
      );
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncCustomStates();
    this.registerInvokers();
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
    if (this.readonlyFocusLost) {
      this.readonlyFocusLost = false;
      restoreComposedFocus(
        this,
        true,
        this.renderRoot.querySelector<HTMLElement>('[part~="base"]')
      );
    }
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
    // Re-armed on every update: switching between the array and child templates replaces
    // [part="base"], and `orientation="auto"` needs the observer without any breakpoint.
    if (this.observesContainer) this.armResizeObserver();
    else this.resetResizeObserver();
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
    else if (this.readonly && (this.readonlyFocusLost || shadowFocusTarget(this) === base)) base.tabIndex = -1;
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
      : this.orientation === 'auto'
      ? this.autoStacks(width)
        ? 'vertical'
        : 'horizontal'
      : this.orientation;
    // Gated on `active` (not `resolvedOrientationBreakpoint`) so a viewport-basis breakpoint still
    // publishes this marker even though `resolved` is meaningless there -- see
    // OrientationBreakpointController's class doc.
    if (this.orientationBreakpoints.active || this.orientation === 'auto') {
      this.setAttribute('data-effective-orientation', next);
    } else {
      this.removeAttribute('data-effective-orientation');
    }
    if (next === this._effectiveOrientation) return;
    this._effectiveOrientation = next;
    for (const step of this.childSteps) step.vertical = next === 'vertical';
    this.requestUpdate();
    if (emitOnChange) {
      this.emit('lr-stepper-orientation-change', { orientation: next });
    }
  }

  /** Whether an `orientation="auto"` stepper stacks at this inline size: each step needs about
   *  6em to keep a short label on one line, plus the gaps between them. An unmeasured (infinite
   *  or zero) width never stacks, so the first paint is a row. */
  private autoStacks(width: number): boolean {
    if (!Number.isFinite(width) || width <= 0) return false;
    const count = this.childMode ? this.childCount : this.steps.length;
    if (count < 2) return false;
    const fontSize = Number.parseFloat(getComputedStyle(this).fontSize) || 16;
    const gap = this.baseEl ? Number.parseFloat(getComputedStyle(this.baseEl).columnGap) || 0 : 0;
    return width < count * fontSize * 6 + (count - 1) * gap;
  }

  /** Creates (idempotently) and (re-)observes `[part="base"]` -- a no-op until `baseEl` exists (see
   *  `firstUpdated()`/`connectedCallback()`). */
  private observedBase?: HTMLElement;

  private armResizeObserver(): void {
    const base = this.baseEl;
    if (!base) return;
    if (this.observedBase === base && this.resizeObserver.active) return;
    this.resizeObserver.clear();
    this.resizeObserver.observe(base);
    this.observedBase = base;
  }

  private resetResizeObserver(): void {
    this.resizeFrame.cancel();
    this.resizeObserver.clear();
    this.observedBase = undefined;
  }

  // ---- Child mode (`<lr-step>` children) -------------------------------------------------------

  /** Re-reads the direct `<lr-step>` children and pushes the derived state down to them. */
  private syncChildSteps(): void {
    const steps = Array.from(this.children).filter(
      (child): child is LyraStep => child.localName === tag('step')
    );
    const hadChildren = this.childSteps.length > 0;
    this.childSteps = steps;
    const visible = this.visibleChildSteps;
    const countChanged = visible.length !== this.childCount;
    this.childCount = visible.length;
    if (hadChildren !== (steps.length > 0)) this.requestUpdate();
    const stop = this.applyChildState(visible);
    if (this.focusedChildStep?.hasAttribute('hidden')) {
      this.focusedChildStep = undefined;
      const owner = this.ownerDocument;
      if (stop) void stop.updateComplete.then(() => {
        if (!this.isConnected || this.ownerDocument !== owner || !this.childMode || !this.clickable) return;
        const preferred = collectComposedFocusTargets(stop, { includeRoot: false, mode: 'programmatic' }).elements[0];
        restoreComposedFocus(this, true, preferred);
      });
    }
    this.syncCustomStates();
    // The step count feeds `orientation="auto"`, so a changed count re-derives the axis too.
    if (countChanged && this.orientation === 'auto')
      this.updateEffectiveOrientation(this.orientationInlineSize(), true);
  }

  /** Publishes the `completed`, `loading` and `stacked` custom states. */
  private syncCustomStates(): void {
    const child = this.childMode;
    const visible = child ? this.visibleChildSteps : [];
    const completed = child
      ? visible.length > 0 && visible.every((step) => step.completed)
      : this.steps.length > 0 && this.steps.every((step) => step.state === 'completed');
    setCustomState(this.stepperInternals, 'completed', completed);
    setCustomState(this.stepperInternals, 'loading', visible.some((step) => step.loading));
    setCustomState(this.stepperInternals, 'stacked', this.effectiveOrientation === 'vertical');
  }

  /** The visible step `active` resolves to: the one it names, else the first. */
  private resolveActiveStep(steps: readonly LyraStep[]): LyraStep | undefined {
    return steps.find((step) => step.name === this.active) ?? steps[0];
  }

  /** In `linear` mode the 0-based index of the last step that may be reached. */
  private linearBoundary(steps: readonly LyraStep[]): number {
    const firstIncomplete = steps.findIndex((step) => !step.completed);
    return firstIncomplete === -1 ? steps.length - 1 : firstIncomplete;
  }

  private isReachable(step: LyraStep, steps: readonly LyraStep[]): boolean {
    if (step.disabled || step.hasAttribute('hidden')) return false;
    if (!this.linear) return true;
    return steps.indexOf(step) <= this.linearBoundary(steps);
  }

  private applyChildState(steps = this.visibleChildSteps): LyraStep | undefined {
    if (!this.childMode) return;
    const activeStep = this.resolveActiveStep(steps);
    const boundary = this.linearBoundary(steps);
    this.activeIndex = activeStep ? steps.indexOf(activeStep) : 0;
    const stop =
      activeStep && this.isReachable(activeStep, steps)
        ? activeStep
        : steps.find((step) => this.isReachable(step, steps));
    const vertical = this.effectiveOrientation === 'vertical';
    for (const step of this.childSteps) {
      if (!step.hasAttribute('hidden')) continue;
      step.active = false;
      step.tabStop = false;
    }
    steps.forEach((step, index) => {
      step.position = index + 1;
      step.active = step === activeStep;
      step.locked = this.linear && index > boundary;
      step.clickable = this.clickable;
      step.vertical = vertical;
      step.first = index === 0;
      step.last = index === steps.length - 1;
      step.tabStop = step === stop;
      const previous = steps[index - 1];
      step.connectorStartVariant = previous?.completed ? (previous.variant as LyraVariant) : undefined;
    });
    return stop;
  }

  @state() private activeIndex = 0;

  /** Child mode: requests a change to the named step. Emits a cancelable `lr-before-step-change`;
   *  unless vetoed, updates `active`, emits `lr-step-change` and announces the new position. Does
   *  nothing when the step does not exist, is hidden or disabled, or (while `linear`) cannot be reached yet. */
  goTo(name: string): void {
    if (!this.childMode) return;
    const steps = this.visibleChildSteps;
    const target = steps.find((step) => step.name === name);
    if (!target || !this.isReachable(target, steps)) return;
    const previousStep = this.resolveActiveStep(steps) ?? null;
    if (target === previousStep) return;
    const detail: LyraStepChangeDetail = {
      name: target.name,
      previousName: previousStep?.name ?? null,
      step: target,
      previousStep,
    };
    if (this.emit('lr-before-step-change', detail, { cancelable: true }).defaultPrevented) return;
    if (target.hasAttribute('hidden')) return;
    this.active = target.name;
    void this.updateComplete.then(() => {
      this.emit('lr-step-change', detail);
      const format = getNumberFormat(this.effectiveLocale);
      this.announcements.announcePolite(
        this.localize('stepperStepPosition', undefined, {
          current: format.format(this.activeIndex + 1),
          total: format.format(this.childCount),
        })
      );
    });
  }

  /** Child mode: goes to the visible step after the current one, if any. */
  next(): void {
    const steps = this.visibleChildSteps;
    const index = steps.findIndex((step) => step === this.resolveActiveStep(steps));
    const target = steps[index + 1];
    if (index >= 0 && target) this.goTo(target.name);
  }

  /** Child mode: goes back to the visible step before the current one, if any. */
  previous(): void {
    const steps = this.visibleChildSteps;
    const index = steps.findIndex((step) => step === this.resolveActiveStep(steps));
    const target = index > 0 ? steps[index - 1] : undefined;
    if (target) this.goTo(target.name);
  }

  private ownStepOf(event: Event): LyraStep | undefined {
    const origin = event.target;
    if (!isElementNode(origin)) return undefined;
    const step = origin.closest(tag('step')) as LyraStep | null;
    return step && step.parentNode === this ? step : undefined;
  }

  private readonly onChildFocusIn = (event: FocusEvent): void => {
    this.focusedChildStep = this.ownStepOf(event);
  };

  private readonly onChildFocusOut = (event: FocusEvent): void => {
    // A browser may drop focus before the hidden-attribute observer runs.
    if (event.relatedTarget || !this.focusedChildStep?.hasAttribute('hidden')) this.focusedChildStep = undefined;
  };

  private readonly onChildClick = (event: MouseEvent): void => {
    if (!this.childMode || !this.clickable) return;
    const step = this.ownStepOf(event);
    if (step) this.goTo(step.name);
  };

  private readonly onChildKeyDown = (event: KeyboardEvent): void => {
    if (!this.childMode || !this.clickable || event.defaultPrevented || shouldIgnoreNavigationKey(event)) return;
    const current = this.ownStepOf(event);
    if (!current) return;
    const steps = this.visibleChildSteps;
    const navigable = steps.filter((step) => this.isReachable(step, steps));
    const target = resolveListMove(event, {
      count: navigable.length,
      current: navigable.indexOf(current),
      orientation: this.effectiveOrientation === 'vertical' ? 'vertical' : 'horizontal',
      direction: this.effectiveDirection,
      wrap: false,
      clamp: true,
      backwardFromMissing: 'first',
    });
    if (target === null) return;
    event.preventDefault();
    navigable[target]?.focus();
  };

  private renderChildren(): TemplateResult {
    const format = getNumberFormat(this.effectiveLocale);
    const name = this.accessibleLabel || this.label || this.localize('stepperSteps');
    const body = html`
      ${this.childCount > 0 ? html`<span part="summary" class="visually-hidden"
        >${this.localize('stepperStepPosition', undefined, {
          current: format.format(this.activeIndex + 1),
          total: format.format(this.childCount),
        })}</span
      >` : nothing}
      <div part="base steps" class="child-steps" role="list"><slot></slot></div>
    `;
    // A landmark earns its keep only when its steps are buttons to navigate between.
    return this.clickable
      ? html`<nav part="stepper" aria-label=${name}>${body}</nav>`
      : html`<div part="stepper" role="group" aria-label=${name}>${body}</div>`;
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
    if (this.readonly || e.defaultPrevented || shouldIgnoreNavigationKey(e)) return;
    const navigable = this.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => !step.disabled);
    if (navigable.length === 0) return;
    const focused = shadowFocusTarget(this) as HTMLElement | null;
    const focusedIndex = Number(focused?.dataset['index']);
    const currentIndex = navigable.findIndex(
      (item) => item.index === focusedIndex
    );
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isRepeatedActivationKey(e)) return;
      if (currentIndex >= 0) {
        const target = navigable[currentIndex]!;
        this.selectStep(target.step, target.index);
      }
      return;
    }
    const targetIndex = resolveListMove(e, {
      count: navigable.length,
      current: currentIndex,
      orientation: this.effectiveOrientation === 'vertical' ? 'vertical' : 'horizontal',
      direction: this.effectiveDirection,
      wrap: false,
      clamp: true,
      backwardFromMissing: 'first',
    });
    if (targetIndex === null) return;
    e.preventDefault();
    this.focusStep(navigable[targetIndex]!.index);
  };

  override render(): TemplateResult {
    if (this.childMode) return this.renderChildren();
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
    /** Non-colour state cue: completed, error and pending read as text, and a locked step says so
     *  instead of leaving it to `aria-disabled` plus a tooltip. The current step is already
     *  announced through `aria-current`, so it adds nothing. */
    const stateText = (step: Readonly<LyraStepItem>) => {
      const parts: string[] = [];
      if (step.state === 'completed') parts.push(this.localize('stepperStateCompleted'));
      else if (step.state === 'error') parts.push(this.localize('stepperStateError'));
      else if (step.state === 'pending') parts.push(this.localize('stepperStatePending'));
      if (step.disabled && !this.readonly) parts.push(this.localize('stepperStateLocked'));
      return parts.length === 0
        ? nothing
        : html`<span class="visually-hidden">${parts.length === 1 ? parts[0] : getListFormat(this.effectiveLocale, { type: 'unit' }).format(parts)}</span>`;
    };
    /** The topic icon and state glyph, identical in both branches below, because `readonly`
     *  changes what a step *is*, never what progress it reports. The `step-label` span stays
     *  written out at each call site rather than joining this helper: it is the step's meaningful
     *  text content, and check:hit-area reads that statically to tell a labelled control from a
     *  compact icon-only one that owes the shared hit-area floor. */
    const stepGlyphs = (step: Readonly<LyraStepItem>, index: number) =>
      html`${step.icon !== undefined
        ? html`<span part="step-icon" aria-hidden="true" inert
            >${step.icon}</span
          >`
        : nothing}
      ${step.state === 'completed'
        ? html`<span part="step-check">${checkIcon()}</span>`
        : html`<span part="step-index"
            >${numberFormat.format(index + 1)}</span
          >`}`;
    return html`
      <div
        part="base"
        role="list"
        aria-label=${(hostAriaLabel(this) === '' || this.accessibleLabel === '') ? '' : resolveAccessibleName(this, this.label) ?? nothing}
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
                  ${stateText(step)}
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
                  ${stateText(step)}
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
