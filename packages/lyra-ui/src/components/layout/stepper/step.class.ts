import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { checkIcon, spinnerIcon } from '../../../internal/icons.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { stepStyles } from './step.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_stepperStateCompleted, LYRA_DEFAULT_stepperStateDisabled, LYRA_DEFAULT_stepperStateLoading, LYRA_DEFAULT_stepperStateLocked, LYRA_DEFAULT_stepperStatePending } from '../../../internal/default-strings/layout.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Attention animation drawn on a step's marker. */
export type LyraStepAttention = 'none' | 'pulse' | 'bounce';

/**
 * `<lr-step>` — one stage inside a child-driven `<lr-stepper>`: its position marker, label,
 * optional description and completion status. Mirrors `wa-step`.
 *
 * The owning stepper numbers the step, marks the current one, locks the steps a `linear` stepper
 * cannot reach yet and, when it is `clickable`, turns the marker and content into a real button.
 * Outside a stepper the element still renders, as a plain list item.
 *
 * `name` identifies the step to the stepper's `active` property, `goTo()` and its events.
 * `completed` shows a check mark in place of the number; `loading` shows a spinner and sets
 * `aria-busy`; `disabled` makes the step unreachable. `variant` colors the marker (a cosmetic
 * cue only: pair a failed or flagged step with an `icon` and a clear label). `attention`
 * (`pulse` or `bounce`) animates the marker to draw the eye and stops under
 * `prefers-reduced-motion: reduce`.
 *
 * Every state also reaches assistive technology as visually hidden status text (completed,
 * loading, unavailable, locked, not started), localized through the standard string table, and
 * the current step carries `aria-current="step"` on the element that takes focus.
 *
 * @customElement lr-step
 * @slot - The step's label.
 * @slot description - Optional text shown under the label.
 * @slot icon - An element that replaces the step number, check mark or spinner.
 * @csspart step - The outer wrapper.
 * @csspart connector - The line joining this step to its neighbours. Each step draws the half
 *   leading in and the half leading out; both carry this part name.
 * @csspart button - The `<button>` wrapping the marker and content, rendered only while the
 *   owning stepper is `clickable`; otherwise the same wrapper is a plain non-focusable element.
 * @csspart marker - The round marker showing the number, check mark, spinner or `icon` slot.
 * @csspart spinner - The spinner shown inside the marker while `loading`.
 * @csspart content - The wrapper around the label, status text and description.
 * @csspart label - The label.
 * @csspart status - Visually hidden text telling assistive technology whether the step is
 *   completed, loading, unavailable, locked or not started.
 * @csspart description - The description.
 * @cssstate active - The owning stepper's current step.
 * @cssstate completed - Mirrors `completed`.
 * @cssstate loading - Mirrors `loading`.
 * @cssstate disabled - Mirrors `disabled`.
 * @cssstate locked - A `linear` stepper cannot reach this step yet.
 * @cssstate clickable - The owning stepper is `clickable`, so the step is a button.
 * @cssprop [--lr-step-pulse-color] - Color of the marker pulse drawn by `attention="pulse"`;
 *   defaults to the step's variant color.
 * @cssprop [--pulse-color] - Alias of `--lr-step-pulse-color`; wins when both are set.
 * @cssprop [--lr-stepper-marker-size=var(--lr-size-2rem)] - Diameter of the marker. Set on the
 *   stepper or an ancestor.
 * @cssprop [--lr-stepper-connector-color=var(--lr-color-neutral-fill-normal)] - Color of the line
 *   after a step that is not completed.
 * @cssprop [--lr-stepper-connector-active-color] - Color of the line after a completed step;
 *   unset, it follows the completed step's variant.
 * @cssprop [--lr-stepper-connector-width=var(--lr-border-width-medium)] - Thickness of the line.
 * @cssprop [--lr-stepper-connector-gap=var(--lr-size-0-35em)] - Gap between the marker edge and
 *   the line on both sides.
 * @cssprop [--lr-stepper-step-gap=var(--lr-space-m)] - Block spacing between steps while the
 *   stepper is laid out vertically.
 * @cssprop [--lr-stepper-hover-bg] - Background of a hovered, enabled clickable step.
 * @cssprop [--lr-stepper-active-bg] - Background of a pressed, enabled clickable step.
 * @status experimental
 * @since 32.1.0
 */
export class LyraStep extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    stepperStateCompleted: LYRA_DEFAULT_stepperStateCompleted,
    stepperStateDisabled: LYRA_DEFAULT_stepperStateDisabled,
    stepperStateLoading: LYRA_DEFAULT_stepperStateLoading,
    stepperStateLocked: LYRA_DEFAULT_stepperStateLocked,
    stepperStatePending: LYRA_DEFAULT_stepperStatePending,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, stepStyles];

  private readonly slots = new SlotPresenceController(this);
  private readonly stepInternals = attachInternalsSafely(this);

  /** Identifies the step. Matched against the stepper's `active` property and reported in its
   *  events. */
  @property({ reflect: true }) name = '';

  /** Marks the step done: a check mark replaces the number. */
  @property({ type: Boolean, reflect: true }) completed = false;

  /** Shows a spinner in place of the number, for example while an asynchronous transition runs.
   *  Sets `aria-busy` on the step. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Makes the step unreachable: it cannot be clicked or targeted by `next()`/`goTo()`, and it
   *  renders as a disabled button while the stepper is `clickable`. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Semantic color of the marker. An upcoming `brand` step keeps a neutral outline so a default
   *  stepper reads quietly. */
  @property({ reflect: true, converter: declaredDefaultConverter<LyraVariant>('brand') })
  variant: LyraVariant = 'brand';

  /** Animates the marker (`pulse` or `bounce`) to draw attention to it, for example the step the
   *  user should do next. Both stop under `prefers-reduced-motion: reduce`. */
  @property({ reflect: true, converter: declaredDefaultConverter<LyraStepAttention>('none') })
  attention: LyraStepAttention = 'none';

  /** Server rendering only: set it when a `description` is slotted so the server markup includes
   *  it before hydration. */
  @property({ type: Boolean, attribute: 'with-description' }) withDescription = false;

  /** Draws the step as the stepper's current step. The owning stepper keeps it in sync with its
   *  own `active`; set it yourself only for server rendering. */
  @property({ type: Boolean, reflect: true }) active = false;

  /** @internal The 1-based position, set by the owning stepper. */
  @state() position = 0;
  /** @internal Set by the owning stepper to match its `clickable`. */
  @state() clickable = false;
  /** @internal Set by a `linear` stepper for every step that cannot be reached yet. */
  @state() locked = false;
  /** @internal Set by the owning stepper while the steps stack vertically. */
  @state() vertical = false;
  /** @internal True for the first step; it draws no leading connector. */
  @state() first = false;
  /** @internal True for the last step; it draws no trailing connector. */
  @state() last = false;
  /** @internal Whether this step is the single tab stop of a clickable stepper. */
  @state() tabStop = false;
  /** @internal The variant of the completed step before this one, so the leading half connector
   *  matches the trailing half of its neighbour. Unset when that step is not completed. */
  @state() connectorStartVariant?: LyraVariant;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('loading')) this.setAttribute('aria-busy', this.loading ? 'true' : 'false');
    setCustomState(this.stepInternals, 'active', this.active);
    setCustomState(this.stepInternals, 'completed', this.completed);
    setCustomState(this.stepInternals, 'loading', this.loading);
    setCustomState(this.stepInternals, 'disabled', this.disabled);
    setCustomState(this.stepInternals, 'locked', this.locked);
    setCustomState(this.stepInternals, 'clickable', this.clickable);
    if (changed.has('active') || changed.has('clickable')) {
      // aria-current belongs on whichever element takes focus: the inner button while clickable,
      // the list item otherwise.
      if (this.active && !this.clickable) this.setAttribute('aria-current', 'step');
      else this.removeAttribute('aria-current');
    }
  }

  /** Focuses the step's button when the stepper is `clickable`. */
  override focus(options?: FocusOptions): void {
    const button = this.renderRoot?.querySelector<HTMLElement>('[part="button"]');
    if (button) button.focus(options);
    else super.focus(options);
  }

  private statusText(): string {
    if (this.completed) return this.localize('stepperStateCompleted');
    if (this.loading) return this.localize('stepperStateLoading');
    if (this.disabled) return this.localize('stepperStateDisabled');
    if (this.locked) return this.localize('stepperStateLocked');
    if (this.active) return '';
    return this.localize('stepperStatePending');
  }

  private markerContent(): TemplateResult | string | typeof nothing {
    if (this.loading) return html`<span part="spinner" class="spinner" aria-hidden="true">${spinnerIcon()}</span>`;
    if (this.completed) return html`<span class="check" aria-hidden="true">${checkIcon()}</span>`;
    return this.position > 0 ? getNumberFormat(this.effectiveLocale).format(this.position) : nothing;
  }

  override render(): TemplateResult {
    const hasDescription = this.withDescription || this.slots.has('description');
    const body = html`
      <span part="marker" class="marker" data-attention=${this.attention}>
        <slot name="icon">${this.markerContent()}</slot>
      </span>
      <span part="content" class="content">
        <span part="label" class="label"><slot></slot></span>
        <span part="status" class="visually-hidden">${this.statusText()}</span>
        <span part="description" class="description" ?hidden=${!hasDescription}>
          <slot name="description"></slot>
        </span>
      </span>
    `;
    return html`
      <div
        part="step"
        class="step"
        ?data-active=${this.active}
        ?data-completed=${this.completed}
        ?data-locked=${this.locked}
        ?data-disabled=${this.disabled}
        ?data-vertical=${this.vertical}
        ?data-first=${this.first}
        ?data-last=${this.last}
      >
        <span
          part="connector"
          class="connector connector-start"
          data-variant=${this.connectorStartVariant ?? nothing}
        ></span>
        <span part="connector" class="connector connector-end"></span>
        ${this.clickable
          ? html`<button
              part="button"
              class="body"
              type="button"
              tabindex=${this.tabStop ? '0' : '-1'}
              ?disabled=${this.disabled || this.locked}
              aria-current=${this.active ? 'step' : nothing}
            >${body}</button>`
          : html`<div class="body">${body}</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-step': LyraStep;
  }
}
