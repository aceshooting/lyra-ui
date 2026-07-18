import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './stepper.styles.js';

export type StepState = 'pending' | 'current' | 'completed' | 'disabled' | 'error';

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
 * @customElement lr-stepper
 * @event lr-step-select - Fired on click, or Enter/Space while focused, on a non-`disabled`
 *   step. `detail: { index, id }`. Cancelable, though this component takes no default action of
 *   its own to prevent (it never mutates `steps`) -- `preventDefault()` is available for a host
 *   that wants a single place to short-circuit its own listener's follow-up work.
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
   *  `'vertical'` stacks them (Up/Down navigate instead, no RTL swap needed). */
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';

  /** Accessible name for the `role="tablist"` step strip. Attribute-reflects from a host-level
   *  `aria-label` so a plain-markup consumer gets ARIA-name forwarding without setting a JS
   *  property. Unset, the tablist renders without an `aria-label` (the role carries no localized
   *  default name). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

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
    const vertical = this.orientation === 'vertical';
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
      <div part="base" role="tablist" aria-label=${this.accessibleLabel || nothing} aria-orientation=${this.orientation} @keydown=${this.onKeyDown}>
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
