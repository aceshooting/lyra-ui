import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { isRtl } from '../../internal/rtl.js';
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
 * layout/navigation axis respond to the stepper's own measured inline size instead of only the
 * authored `orientation`: below that width (px, measured on `[part="base"]` via `ResizeObserver`),
 * `narrowOrientation` becomes effective; at/above it, `orientation` does. This mirrors `<lr-split>`'s
 * identically-named `orientationBreakpoint`/`narrowOrientation` contract -- the observation boundary
 * is the component's own allocation, not the viewport, so a stepper placed in a narrow split pane or
 * dialog still responds correctly even in a wide window. The effective axis is exposed via the
 * `effectiveOrientation` getter, a `data-effective-orientation` host attribute (only present while
 * `orientationBreakpoint` is set), and `lr-stepper-orientation-change`.
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

  /** Opt-in inline-size breakpoint (px, measured on `[part="base"]`). Below it, `narrowOrientation`
   *  becomes effective instead of `orientation`. Unset (the default): no behavior change, the
   *  authored `orientation` always applies. */
  @property({ type: Number, attribute: 'orientation-breakpoint' }) orientationBreakpoint?: number;

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

  /** The live layout/navigation axis after applying `orientationBreakpoint` -- identical to
   *  `orientation` whenever that's unset. See the class doc. */
  get effectiveOrientation(): StepperOrientation {
    return this._effectiveOrientation;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.orientationBreakpoint != null) this.armResizeObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(): void {
    if (this.orientationBreakpoint != null) this.armResizeObserver();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('orientation') || changed.has('narrowOrientation') || changed.has('orientationBreakpoint')) {
      this.updateEffectiveOrientation(this.baseEl?.clientWidth ?? Number.POSITIVE_INFINITY, false);
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('orientationBreakpoint')) {
      if (this.orientationBreakpoint != null) this.armResizeObserver();
      else this.resizeObserver?.disconnect();
    }
  }

  /** Classifies a measured inline size into the effective layout/navigation axis and, only on an
   *  actual transition, applies it -- mirrors `<lr-split>`'s identically-shaped
   *  `updateEffectiveOrientation()`. `emitOnChange` is false for the property-driven re-derivation
   *  in `willUpdate()` and true for the `ResizeObserver` callback's fresh measurement. */
  private updateEffectiveOrientation(width: number, emitOnChange: boolean): void {
    const next: StepperOrientation =
      this.orientationBreakpoint != null && width < this.orientationBreakpoint ? this.narrowOrientation : this.orientation;
    if (this.orientationBreakpoint != null) {
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
