import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { OrientationBreakpointController, type OrientationBreakpointBasis } from '../../../internal/orientation-breakpoint.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './stepper.styles.js';

export type StepState = 'pending' | 'current' | 'completed' | 'disabled' | 'error';

export type StepperOrientation = 'horizontal' | 'vertical';

export interface StepperOrientationChangeDetail {
  orientation: StepperOrientation;
}

export interface StepItem {
  id: string;
  label: string;
  state: StepState;
  /** Optional native `title` tooltip for this step's button -- e.g. explaining why a
   *  `disabled` step is locked. Omit for no `title` attribute at all (not an empty string). */
  title?: string;
}

export interface LyraStepperEventMap {
  'lr-step-select': CustomEvent<{ index: number; id: string }>;
  'lr-stepper-orientation-change': CustomEvent<StepperOrientationChangeDetail>;
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
  ><polyline points="5 12.5 10 17.5 19 6.5"></polyline></svg>`;
}

/**
 * `<lr-stepper>` — ordered multi-step wizard/form navigation: label + index per step,
 * current/completed/locked/error state, click-to-jump. First-party invention (no Web Awesome
 * equivalent). Fully data-driven and controlled, like `lr-table`'s `columns`/`rows` -- it never
 * mutates `steps` itself; a click or Enter/Space on a non-disabled step fires a cancelable
 * `lr-step-select`, and the host decides whether/how `steps` changes in response (mirroring
 * `lr-dialog-close`'s cancelable-event convention).
 *
 * An opt-in `orientationBreakpoint` (unset by default -- no behavior change) makes the effective
 * layout/navigation axis respond to a measured inline size instead of only the authored
 * `orientation`: below that width (a pixel number or a `px`/`rem`/`em` CSS length), `narrowOrientation`
 * becomes effective; at/above it, `orientation` does. This mirrors `<lr-split>`'s identically-named
 * `orientationBreakpoint`/`narrowOrientation`/`orientationBreakpointBasis` contract. Under the default
 * `orientationBreakpointBasis="container"` the breakpoint is measured on this stepper's own
 * `[part="base"]` inline size via `ResizeObserver`, so a stepper placed in a narrow split pane or
 * dialog still responds correctly even in a wide window; `orientationBreakpointBasis="viewport"`
 * instead evaluates `matchMedia('(max-width: <breakpoint>)')`, needed when the stepper has a fixed
 * width in a row that stacks at a shared breakpoint. The effective axis is exposed via the
 * `effectiveOrientation` getter, a `data-effective-orientation` host attribute (only present while
 * the breakpoint feature is active), and `lr-stepper-orientation-change`.
 *
 * @customElement lr-stepper
 * @event lr-step-select - Fired on click, or Enter/Space while focused, on a non-`disabled`
 *   step. `detail: { index, id }`. Cancelable, though this component takes no default action of
 *   its own to prevent (it never mutates `steps`) -- `preventDefault()` is available for a host
 *   that wants a single place to short-circuit its own listener's follow-up work.
 * @event lr-stepper-orientation-change - `detail: { orientation }`, fired when an enabled
 *   `orientationBreakpoint` changes the effective layout/navigation axis.
 * @csspart base - The root wrapper.
 * @csspart step - A single step button.
 * @csspart step-index - The numbered index chip, shown for `pending`/`current`/`error` steps.
 * @csspart step-check - The completed-checkmark glyph, shown for `completed` steps instead of `step-index`.
 * @csspart step-label - The step's label text.
 */
export class LyraStepper extends LyraElement<LyraStepperEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Ordered step data. Never mutated by this component -- see the class doc's controlled-
   *  component contract. Empty (the default) renders nothing. Each step's optional `title`
   *  renders as a native `title` tooltip on that step's button -- e.g. to explain why a
   *  `disabled` step is locked. */
  @property({ attribute: false }) steps: StepItem[] = [];

  /** `'horizontal'` (the default) lays steps out in a row (Left/Right, RTL-aware, to navigate);
   *  `'vertical'` stacks them (Up/Down navigate instead, no RTL swap needed). The *authored* axis
   *  used at/above `orientationBreakpoint` (or always, when that's unset) -- see
   *  `effectiveOrientation` for the live axis actually in effect. */
  @property({ reflect: true }) orientation: StepperOrientation = 'horizontal';

  /** Opt-in inline-size breakpoint, measured on `[part="base"]`. Below it, `narrowOrientation`
   *  becomes effective instead of `orientation`. Unset (the default): no behavior change, the
   *  authored `orientation` always applies.
   *
   *  Accepts a bare pixel number (`500`, `'500'`), an explicit `px` length (`'500px'`), a `rem`
   *  length (`'31.25rem'`) or an `em` length (`'3em'`). `rem` resolves against the **document
   *  root**'s computed font size -- exactly as a `rem` in a CSS `@media` query does, and *not*
   *  against this element -- so a breakpoint authored in `rem` stays numerically in step with a
   *  sibling `@media (max-width: …rem)` rule instead of drifting from it when the root font size
   *  changes (browser zoom, a user font-size preference, an app base-size token). `em` resolves
   *  against this element's own computed font size. The length is re-resolved on every
   *  measurement, never cached, so those changes are picked up with no invalidation step.
   *
   *  Any other value -- `%`, `vw`, `calc()`, `'auto'`, an unparseable string -- behaves exactly as
   *  unset (no responsive observation at all), rather than as an armed breakpoint that can never
   *  be crossed. Set `orientationBreakpointBasis="viewport"` for a viewport-relative breakpoint
   *  instead. */
  @property({ attribute: 'orientation-breakpoint' }) orientationBreakpoint?: number | string;

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
  orientationBreakpointBasis: OrientationBreakpointBasis = 'container';

  /** Layout/navigation axis used below `orientationBreakpoint`. */
  @property({ reflect: true, attribute: 'narrow-orientation' }) narrowOrientation: StepperOrientation = 'vertical';

  /** Accessible name for the `role="tablist"` step strip. Attribute-reflects from a host-level
   *  `aria-label` so a plain-markup consumer gets ARIA-name forwarding without setting a JS
   *  property. Unset, the tablist renders without an `aria-label` (the role carries no localized
   *  default name). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private _effectiveOrientation: StepperOrientation = 'horizontal';
  private resizeObserver?: ResizeObserver;
  @query('[part="base"]') private baseEl?: HTMLElement;
  /** Owns breakpoint resolution, basis selection, and the viewport `MediaQueryList` lifecycle
   *  (including teardown on disconnect) -- see `OrientationBreakpointController`. */
  private orientationBreakpoints = new OrientationBreakpointController(this, () =>
    this.updateEffectiveOrientation(this.baseEl?.clientWidth ?? Number.POSITIVE_INFINITY, true),
  );

  /** The live layout/navigation axis after applying `orientationBreakpoint` -- identical to
   *  `orientation` whenever that's unset. See the class doc. */
  get effectiveOrientation(): StepperOrientation {
    return this._effectiveOrientation;
  }

  /** `orientationBreakpoint` in pixels, or `undefined` when unset *or* unparseable -- meaningful
   *  only under `orientationBreakpointBasis="container"`, where this controller owns the crossing
   *  comparison. Deliberately re-resolved per call (never cached): a `rem` breakpoint has to track
   *  the live root font size. Never use this to decide whether the feature is on -- under
   *  `"viewport"` basis it's not the number actually in effect; use `orientationBreakpoints.active`
   *  for that (see `OrientationBreakpointController`'s class doc). */
  private get resolvedOrientationBreakpoint(): number | undefined {
    return this.orientationBreakpoints.resolved;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.orientationBreakpoints.containerObservationEnabled) this.armResizeObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(): void {
    if (this.orientationBreakpoints.containerObservationEnabled) this.armResizeObserver();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('orientationBreakpoint') || changed.has('orientationBreakpointBasis')) {
      this.orientationBreakpoints.configure(this.orientationBreakpoint, this.orientationBreakpointBasis);
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
      // read here at all, only a stale `baseEl` snapshot, so that case keeps deferring the emit to
      // the `ResizeObserver` callback's own fresh measurement, as before.
      this.updateEffectiveOrientation(
        this.baseEl?.clientWidth ?? Number.POSITIVE_INFINITY,
        this.hasUpdated && this.orientationBreakpointBasis === 'viewport',
      );
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('orientationBreakpoint') || changed.has('orientationBreakpointBasis')) {
      if (this.orientationBreakpoints.containerObservationEnabled) this.armResizeObserver();
      else this.resizeObserver?.disconnect();
    }
  }

  /** Classifies a measured inline size into the effective layout/navigation axis and, only on an
   *  actual transition, applies it -- mirrors `<lr-split>`'s identically-shaped
   *  `updateEffectiveOrientation()`. `emitOnChange` is false for the property-driven re-derivation
   *  in `willUpdate()` (except a genuine viewport-basis transition after the first update -- see
   *  `willUpdate()`'s own doc comment) and true for the `ResizeObserver`/`matchMedia` callbacks'
   *  own fresh measurements. */
  private updateEffectiveOrientation(width: number, emitOnChange: boolean): void {
    const next: StepperOrientation = this.orientationBreakpoints.isBelow(width)
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
      this.emit<StepperOrientationChangeDetail>('lr-stepper-orientation-change', { orientation: next });
    }
  }

  /** Creates (idempotently) and (re-)observes `[part="base"]` -- a no-op until `baseEl` exists (see
   *  `firstUpdated()`/`connectedCallback()`). */
  private armResizeObserver(): void {
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const box = entries[0]?.contentBoxSize?.[0];
        const width = box ? box.inlineSize : (this.baseEl?.getBoundingClientRect().width ?? 0);
        this.updateEffectiveOrientation(width, true);
      });
    }
    if (this.baseEl) this.resizeObserver.observe(this.baseEl);
  }

  private selectStep(step: StepItem, index: number): void {
    if (step.state === 'disabled') return;
    this.emit<{ index: number; id: string }>('lr-step-select', { index, id: step.id }, { cancelable: true });
  }

  private focusStep(id: string): void {
    const button = this.renderRoot.querySelector(
      `[part="step"][data-id="${CSS.escape(id)}"]`,
    ) as HTMLElement | null;
    button?.focus();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.steps.filter((s) => s.state !== 'disabled');
    if (navigable.length === 0) return;
    const focused = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
    const currentId = focused?.dataset.id;
    const currentIndex = navigable.findIndex((s) => s.id === currentId);
    const vertical = this.effectiveOrientation === 'vertical';
    const rtl = !vertical && isRtl(this);
    const forwardKey = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex: number;
    switch (e.key) {
      case forwardKey:
        targetIndex = Math.min(navigable.length - 1, (currentIndex < 0 ? -1 : currentIndex) + 1);
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
          const idx = this.steps.findIndex((s) => s.id === navigable[currentIndex]!.id);
          this.selectStep(navigable[currentIndex]!, idx);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    const target = navigable[targetIndex]!;
    this.focusStep(target.id);
  };

  render(): TemplateResult {
    // Roving tabindex needs exactly one stop in the tab order at all times -- the `current` step
    // when there is one, otherwise the first step a keyboard user could actually land on. Without
    // this fallback, an all-`completed`/all-`pending`/no-`current` `steps` array would leave every
    // button at tabindex="-1" and drop the whole stepper out of the tab order.
    const rovingId = this.steps.find((s) => s.state === 'current')?.id ?? this.steps.find((s) => s.state !== 'disabled')?.id;
    return html`
      <div part="base" role="tablist" aria-label=${this.accessibleLabel || nothing} aria-orientation=${this.effectiveOrientation} @keydown=${this.onKeyDown}>
        ${repeat(
          this.steps,
          (step) => step.id,
          (step, index) => html`<button
            type="button"
            part="step"
            data-id=${step.id}
            data-state=${step.state}
            role="tab"
            aria-selected=${step.state === 'current' ? 'true' : 'false'}
            aria-current=${step.state === 'current' ? 'step' : nothing}
            aria-disabled=${step.state === 'disabled' ? 'true' : 'false'}
            tabindex=${step.id === rovingId ? '0' : '-1'}
            title=${step.title ?? nothing}
            @click=${() => this.selectStep(step, index)}
          >
            ${step.state === 'completed'
              ? checkmarkGlyph()
              : html`<span part="step-index">${index + 1}</span>`}
            <span part="step-label">${step.label}</span>
          </button>`,
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
