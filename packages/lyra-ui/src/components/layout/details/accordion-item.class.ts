import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  LyraElement,
  type LyraEmitArgs,
  type LyraEmitOptions,
  type LyraEmittedEvent,
} from '../../../internal/lyra-element.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance } from '../../../internal/variants.js';
import { styles } from './accordion-item.styles.js';
import { LyraDetails, type LyraDetailsEventMap } from './details.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraAccordionIconPlacement = 'start' | 'end';
/** A heading level string. Values other than 1–6 and `none` render the documented h3 fallback. */
export type LyraAccordionHeadingLevel = string;
export type LyraAccordionAppearance = Exclude<LyraAppearance, 'accent'>;

/**
 * `<lr-accordion-item>` — an accessible expandable section for `<lr-accordion>`.
 *
 * `expanded`/`label` are the canonical accordion vocabulary. The inherited Details vocabulary is
 * also supported: `open` aliases `expanded`, `summary` aliases `label`, the `summary` slot aliases
 * the `label` slot, and `show()`/`hide()` alias `expand()`/`collapse()`.
 *
 * A present host `aria-label`, including an explicitly empty value, names the trigger button.
 * When absent, the trigger retains its native name-from-content behavior.
 *
 * @customElement lr-accordion-item
 * @slot - Panel content.
 * @slot label - Header label; takes priority over `label`, `summary`, and the `summary` slot.
 * @slot summary - Compatibility alias for the `label` slot.
 * @slot icon - Optional decorative expand/collapse icon.
 * @csspart base - Compatibility name for the outer wrapper; use `accordion-item`.
 * @csspart accordion-item - The outer wrapper. It is the same node as `base`.
 * @csspart heading - Heading around the trigger; omitted for `heading-level="none"`.
 * @csspart button - The trigger button.
 * @csspart summary - Details compatibility alias for `button`; both names are on the same trigger.
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
 * @cssprop [--spacing] - Compatibility alias for `--lr-accordion-item-spacing`; set on either
 *   name.
 * @cssprop [--show-duration] - Compatibility alias for `--lr-accordion-item-show-duration`.
 * @cssprop [--hide-duration] - Compatibility alias for `--lr-accordion-item-hide-duration`.
 * @cssprop [--easing] - Compatibility alias for `--lr-accordion-item-easing`.
 * @cssprop [--lr-details-font-size=var(--lr-form-control-font-size)] - Details compatibility alias
 *   for the item's text size.
 * @cssprop [--lr-details-spacing=var(--lr-form-control-padding-inline)] - Details compatibility
 *   alias for the item's spacing.
 * @cssstate animating - Present while an expand/collapse transition is settling.
 * @status stable
 * @since 4.0.0
 */
export class LyraAccordionItem extends LyraDetails {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  @state() private hasLabelSlot = false;
  @state() private hasLegacySummarySlot = false;

  /** Text shown in the trigger. Rich content belongs in the `label` slot. */
  @property() label = '';

  /**
   * Whether the panel is expanded. This is synchronized bidirectionally with `open`.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get expanded(): boolean {
    return this.open;
  }
  set expanded(next: boolean) {
    const old = this.open;
    const normalized = Boolean(next);
    this.open = normalized;
    if (this.open !== old) this.requestUpdate('expanded', old);
    else if (this.open !== normalized) this.toggleAttribute('expanded', this.open);
  }

  /** Heading level from 1–6, or `none`; every other value uses h3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraAccordionHeadingLevel = '3';

  /** Whether the icon appears before or after the label. */
  @property({ attribute: 'icon-placement', reflect: true })
  override iconPlacement: LyraAccordionIconPlacement = 'end';

  /** Visual treatment inherited from the owning accordion. */
  @property({ reflect: true })
  override appearance: LyraAccordionAppearance = 'outlined';

  /** @internal Roving-tabindex state controlled by the owning accordion. */
  @property({ attribute: false }) isTabbable = true;

  override disconnectedCallback(): void {
    this.setAnimating(false);
    super.disconnectedCallback();
  }

  protected override emit<K extends keyof LyraDetailsEventMap & string>(
    name: K,
    ...args: LyraEmitArgs<LyraDetailsEventMap, K>
  ): LyraEmittedEvent<LyraDetailsEventMap, K> {
    // The inherited Details lifecycle owns the real rendered-motion wait. Drop the custom state
    // immediately before publishing its completion boundary so every lr-after-* listener observes
    // a settled item rather than the one-microtask race produced by a second parallel waiter.
    if (name === 'lr-after-show' || name === 'lr-after-hide') this.setAnimating(false);
    return super.emit(name, ...args);
  }

  /**
   * The private child->parent protocol `<lr-accordion>` listens for.
   *
   * Deliberately not routed through `emit()`: these two names appear in no event map, no
   * `@event` tag, no manifest entry and no docs page, because they are coordination signals
   * rather than public API. `emit()` now type-checks its name against the component's declared
   * event map, so dispatching them there would mean advertising them as public events.
   * The dispatch itself is identical to `emit()`'s -- bubbling and composed, so it still reaches
   * the owning accordion across the item's shadow boundary.
   */
  private emitAccordionProtocol(
    name: 'lr-accordion-item-state-change' | 'lr-accordion-item-trigger',
    options?: LyraEmitOptions,
  ): CustomEvent<{ item: LyraAccordionItem }> {
    const event = new CustomEvent(name, {
      detail: { item: this },
      bubbles: true,
      composed: true,
      cancelable: options?.cancelable ?? false,
    });
    this.dispatchEvent(event);
    return event;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((child) => child.getAttribute('slot') === 'label');
      this.hasLegacySummarySlot = Array.from(this.children).some(
        (child) => child.getAttribute('slot') === 'summary',
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('open') || changed.has('expanded')) {
      this.toggleAttribute('expanded', this.open);
    }
    if (changed.has('disabled')) {
      this.emitAccordionProtocol('lr-accordion-item-state-change');
    }
  }

  /** Details-compatible expansion. Prefer `expand()` in accordion code. */
  override async show(): Promise<void> {
    const old = this.open;
    const settled = super.show();
    if (this.open === old) {
      // A post-mount attribute write still invokes Lit's property setter even when Details rejects
      // the transition while disabled. Reflect the actual state back through both aliases.
      if (!old) {
        this.toggleAttribute('open', false);
        this.toggleAttribute('expanded', false);
      }
      await settled;
      return;
    }
    this.requestUpdate('expanded', old);
    this.setAnimating(true);
    await settled;
  }

  /** Details-compatible collapse. Prefer `collapse()` in accordion code. */
  override async hide(): Promise<void> {
    const old = this.open;
    const settled = super.hide();
    if (this.open === old) {
      await settled;
      return;
    }
    this.requestUpdate('expanded', old);
    this.setAnimating(true);
    await settled;
  }

  /** Expand with animation. Disabled or already-expanded items are unchanged. */
  expand(): void {
    if (this.expanded || this.disabled) return;
    void this.show();
  }

  /** Collapse with animation. Disabled or already-collapsed items are unchanged. */
  collapse(): void {
    if (!this.expanded || this.disabled) return;
    void this.hide();
  }

  /** Toggle the expanded state. */
  toggle(): void {
    if (this.expanded) this.collapse();
    else this.expand();
  }

  /** Focus the internal trigger. */
  override focus(options?: FocusOptions): void {
    this.triggerButton?.focus(options);
  }

  /** Remove focus from the internal trigger. */
  override blur(): void {
    this.triggerButton?.blur();
  }

  /** Activate the internal trigger. */
  override click(): void {
    const trigger = this.triggerButton;
    if (trigger) trigger.click();
    else super.click();
  }

  private get triggerButton(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('[part~="button"]');
  }

  private setAnimating(animating: boolean): void {
    if (animating) this.detailsInternals.states.add('animating');
    else this.detailsInternals.states.delete('animating');
  }

  private handleTriggerClick = (): void => {
    if (this.disabled) return;
    const handled = this.emitAccordionProtocol('lr-accordion-item-trigger', { cancelable: true });
    if (!handled.defaultPrevented) this.toggle();
  };

  private handleLabelSlotChange = (event: Event): void => {
    this.hasLabelSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private handleSummarySlotChange = (event: Event): void => {
    this.hasLegacySummarySlot =
      (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private renderHeading(button: TemplateResult): TemplateResult {
    switch (this.headingLevel) {
      case '1':
        return html`<h1 part="heading">${button}</h1>`;
      case '2':
        return html`<h2 part="heading">${button}</h2>`;
      case '4':
        return html`<h4 part="heading">${button}</h4>`;
      case '5':
        return html`<h5 part="heading">${button}</h5>`;
      case '6':
        return html`<h6 part="heading">${button}</h6>`;
      default:
        return html`<h3 part="heading">${button}</h3>`;
    }
  }

  override render(): TemplateResult {
    const fallbackLabel = this.label || this.summary || this.localize('details');
    const button = html`<button
      id="trigger"
      part="button summary"
      type="button"
      aria-label=${hostAriaLabel(this) ?? nothing}
      aria-expanded=${this.expanded ? 'true' : 'false'}
      aria-controls="panel"
      aria-disabled=${this.disabled ? 'true' : 'false'}
      tabindex=${this.disabled || !this.isTabbable ? '-1' : '0'}
      ?disabled=${this.disabled}
      @click=${this.handleTriggerClick}
    >
      <span part="label">
        <slot name="label" ?hidden=${!this.hasLabelSlot} @slotchange=${this.handleLabelSlotChange}></slot>
        <slot
          name="summary"
          ?hidden=${this.hasLabelSlot || !this.hasLegacySummarySlot}
          @slotchange=${this.handleSummarySlotChange}
        ></slot>
        ${this.hasLabelSlot || this.hasLegacySummarySlot ? '' : fallbackLabel}
      </span>
      <span part="icon" aria-hidden="true"><slot name="icon"><span class="default-icon"></span></slot></span>
    </button>`;

    return html`<div part="base accordion-item">
      ${this.headingLevel === 'none' ? button : this.renderHeading(button)}
      <div
        id="panel"
        part="panel"
        role="region"
        aria-labelledby="trigger"
        aria-hidden=${this.expanded ? 'false' : 'true'}
        ?inert=${!this.expanded}
      >
        <div class="panel-clip"><slot part="content"></slot></div>
      </div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-accordion-item': LyraAccordionItem; } }
