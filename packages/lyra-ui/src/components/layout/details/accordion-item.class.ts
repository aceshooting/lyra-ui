import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { hostAriaLabel } from "../../../internal/a11y.js";
import { attachInternalsSafely } from "../../../internal/form-associated.js";
import { renderInertPresentation } from "../../../internal/inert-presentation.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { sizes } from "../../../internal/sizes.styles.js";
import { styles } from "./accordion-item.styles.js";
import { DisclosureMotionController } from "./disclosure-motion.js";
import {
  accordionItemOwnerContext,
  notifyAccordionItemStateChanged,
  notifyAccordionItemTransitionSettled,
  registerAccordionItemStateController,
  requestAccordionItemTransition,
} from "./accordion-owner.js";
import type {
  AccordionItemTransitionSource,
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from "./accordion-types.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from "./accordion-types.js";

/**
 * `<lr-accordion-item>` — an accessible expandable section for `<lr-accordion>`.
 *
 * The item deliberately owns only Web Awesome's accordion-item vocabulary. Use `expanded`,
 * `label`, and `expand()`/`collapse()`/`toggle()` here; the independent `open`, `summary`, and
 * `show()`/`hide()` disclosure vocabulary belongs to `<lr-details>`.
 *
 * A present host `aria-label`, including an explicitly empty value, names the trigger button.
 * When absent, the trigger retains its native name-from-content behavior.
 *
 * @customElement lr-accordion-item
 * @slot - Panel content.
 * @slot label - Visible header label; takes priority over the `label` property. Its flattened
 *   subtree is inert and hidden from assistive technology, while its accessibility-visible text
 *   names the sole trigger button.
 * @slot icon - Optional decorative expand/collapse icon. Its flattened subtree remains visible
 *   but is inert and hidden from assistive technology; the trigger button is the sole action.
 * @csspart base - Deprecated compatibility name for the outer wrapper; use `accordion-item`.
 * @csspart accordion-item - The outer wrapper. It is the same node as `base`.
 * @csspart heading - Heading around the trigger; omitted for `heading-level="none"`.
 * @csspart button - The trigger button.
 * @csspart label - Label container.
 * @csspart icon - Expand/collapse icon container.
 * @csspart panel - Expandable panel.
 * @csspart content - Content container inside the panel.
 * @cssprop [--lr-accordion-item-outlined-bg=var(--lr-color-surface)] - Outlined item background.
 * @cssprop [--lr-accordion-item-filled-bg=var(--lr-color-surface-raised)] - Filled item background.
 * @cssprop [--lr-accordion-item-filled-outlined-bg=var(--lr-color-surface-raised)] -
 *   Filled-outlined item background.
 * @cssprop [--lr-accordion-item-button-hover-bg=var(--lr-color-brand-quiet)] - Trigger hover
 *   background.
 * @cssprop [--lr-accordion-item-button-active-bg=color-mix(...)] - Trigger pressed background.
 * @cssprop [--lr-accordion-item-spacing=var(--lr-form-control-padding-inline)] - Header/content
 *   spacing.
 * @cssprop [--lr-accordion-item-show-duration=var(--lr-duration-base)] - Expand transition
 *   duration.
 * @cssprop [--lr-accordion-item-hide-duration=var(--lr-duration-base)] - Collapse transition
 *   duration.
 * @cssprop [--lr-accordion-item-easing=var(--lr-easing-standard)] - Expand/collapse easing.
 * @cssprop [--spacing] - Upstream-compatible alias for `--lr-accordion-item-spacing`.
 * @cssprop [--show-duration] - Upstream-compatible alias for
 *   `--lr-accordion-item-show-duration`.
 * @cssprop [--hide-duration] - Upstream-compatible alias for
 *   `--lr-accordion-item-hide-duration`.
 * @cssprop [--easing] - Upstream-compatible alias for `--lr-accordion-item-easing`.
 * @cssstate animating - Present while an expand/collapse transition is settling.
 * @status stable
 * @since 4.0.0
 */
export class LyraAccordionItem extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  private readonly itemInternals = attachInternalsSafely(this);
  private readonly disclosureMotion = new DisclosureMotionController(
    this,
    this.itemInternals,
    () => this.renderRoot,
    '[part~="accordion-item"]'
  );
  private _expanded = false;

  @state() private hasLabel = false;

  constructor() {
    super();
    registerAccordionItemStateController(this, (expanded, announce) =>
      this.transitionTo(expanded, "programmatic", true, announce)
    );
  }

  /** Text shown in the trigger. Rich content belongs in the `label` slot. */
  @property() label = "";

  /**
   * Whether the panel is expanded. Assigning it uses the owning accordion's cancelable lifecycle.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get expanded(): boolean {
    return this._expanded;
  }
  set expanded(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._expanded) return;
    if (!this.hasUpdated) {
      this.applyExpandedState(normalized);
      return;
    }
    void this.transitionTo(normalized, "programmatic");
  }

  /** Disables the item so it cannot be toggled. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Heading level from 1–6, or `none`; every other value uses h3. */
  @property({ attribute: "heading-level", reflect: true })
  headingLevel: LyraAccordionHeadingLevel = "3";

  /** Whether the icon appears before or after the label. */
  @property({ attribute: "icon-placement", reflect: true })
  iconPlacement: LyraAccordionIconPlacement = "end";

  /** Visual treatment inherited non-destructively from the owning accordion. */
  @property({ reflect: true })
  appearance: LyraAccordionAppearance = "outlined";

  /** @internal Roving-tabindex state controlled by the owning accordion. */
  @property({ attribute: false }) isTabbable = true;

  override disconnectedCallback(): void {
    this.disclosureMotion.cancel();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasLabel = Array.from(this.children).some(
        (child) => child.getAttribute("slot") === "label"
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has("disabled")) notifyAccordionItemStateChanged(this);
  }

  private applyExpandedState(next: boolean): void {
    const old = this._expanded;
    this._expanded = next;
    this.requestUpdate("expanded", old);
  }

  private syncExpandedAttribute(): void {
    this.toggleAttribute("expanded", this._expanded);
  }

  private async transitionTo(
    expanded: boolean,
    source: AccordionItemTransitionSource,
    ownerPreflighted = false,
    announceOwner = true
  ): Promise<void> {
    if (expanded === this._expanded) return;
    if (!ownerPreflighted && this.disabled) {
      this.syncExpandedAttribute();
      return;
    }
    if (
      !ownerPreflighted &&
      requestAccordionItemTransition(this, expanded, source) === false
    ) {
      this.syncExpandedAttribute();
      return;
    }

    this.applyExpandedState(expanded);
    if (!(await this.disclosureMotion.settle())) return;
    if (announceOwner) notifyAccordionItemTransitionSettled(this, expanded);
  }

  /** Expands the accordion item with animation. Disabled or expanded items are unchanged. */
  expand(): Promise<void> {
    return this.transitionTo(true, "programmatic");
  }

  /** Collapses the accordion item with animation. Disabled or collapsed items are unchanged. */
  collapse(): Promise<void> {
    return this.transitionTo(false, "programmatic");
  }

  /** Toggles the accordion item's expanded state. */
  toggle(): Promise<void> {
    return this.transitionTo(!this.expanded, "programmatic");
  }

  /** Focus the internal trigger. */
  override focus(options?: FocusOptions): void {
    this.button?.focus(options);
  }

  /** Activate the internal trigger. */
  override click(): void {
    const trigger = this.button;
    if (trigger) trigger.click();
    else super.click();
  }

  private get button(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('[part~="button"]');
  }

  private onTrigger = (): void => {
    if (this.disabled) return;
    void this.transitionTo(!this.expanded, "user");
  };

  private onLabel = (event: Event): void => {
    this.hasLabel =
      (event.target as HTMLSlotElement).assignedElements({ flatten: true })
        .length > 0;
  };

  private heading(button: TemplateResult): TemplateResult {
    switch (this.effectiveHeadingLevel) {
      case "1":
        return html`<h1 part="heading">${button}</h1>`;
      case "2":
        return html`<h2 part="heading">${button}</h2>`;
      case "4":
        return html`<h4 part="heading">${button}</h4>`;
      case "5":
        return html`<h5 part="heading">${button}</h5>`;
      case "6":
        return html`<h6 part="heading">${button}</h6>`;
      default:
        return html`<h3 part="heading">${button}</h3>`;
    }
  }

  private get effectiveAppearance(): LyraAccordionAppearance {
    return accordionItemOwnerContext(this)?.appearance ?? this.appearance;
  }

  private get effectiveHeadingLevel(): LyraAccordionHeadingLevel {
    return accordionItemOwnerContext(this)?.headingLevel ?? this.headingLevel;
  }

  private get effectiveIconPlacement(): LyraAccordionIconPlacement {
    return accordionItemOwnerContext(this)?.iconPlacement ?? this.iconPlacement;
  }

  override render(): TemplateResult {
    const fallbackLabel = this.label || this.localize("details");
    const hostLabel = hostAriaLabel(this);
    const button = html`<button
      id="trigger"
      part="button"
      type="button"
      aria-label=${hostLabel ?? nothing}
      aria-labelledby=${hostLabel === null && this.hasLabel ? "label" : nothing}
      aria-expanded=${this.expanded ? "true" : "false"}
      aria-controls="panel"
      aria-disabled=${this.disabled ? "true" : "false"}
      tabindex=${this.disabled || !this.isTabbable ? "-1" : "0"}
      ?disabled=${this.disabled}
      @click=${this.onTrigger}
    >
      <span part="label">
        <span id="label" aria-hidden="true" inert ?hidden=${!this.hasLabel}>
          <slot name="label" @slotchange=${this.onLabel}></slot>
        </span>
        ${this.hasLabel ? "" : fallbackLabel}
      </span>
      ${renderInertPresentation(
        html`<slot name="icon"><span class="default-icon"></span></slot>`,
        { part: "icon" }
      )}
    </button>`;

    return html`<div
      part="base accordion-item"
      data-appearance=${this.effectiveAppearance}
      data-icon-placement=${this.effectiveIconPlacement}
    >
      ${this.effectiveHeadingLevel === "none" ? button : this.heading(button)}
      <div
        id="panel"
        part="panel"
        role="region"
        aria-labelledby="trigger"
        aria-hidden=${this.expanded ? "false" : "true"}
        ?inert=${!this.expanded}
      >
        <div class="panel-clip"><slot part="content"></slot></div>
      </div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-accordion-item": LyraAccordionItem;
  }
}
