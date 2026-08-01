import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance } from '../../../internal/variants.js';
import { styles } from './accordion-item.styles.js';
import { LyraDetails } from './details.class.js';

export type LyraAccordionIconPlacement = 'start' | 'end';
export type LyraAccordionHeadingLevel = '1' | '2' | '3' | '4' | '5' | '6' | 'none';
export type LyraAccordionAppearance = Exclude<LyraAppearance, 'accent'>;

/**
 * `<lr-accordion-item>` — an accessible expandable section for `<lr-accordion>`.
 *
 * `expanded`/`label` are the canonical accordion vocabulary. The inherited Details vocabulary is
 * also supported: `open` aliases `expanded`, `summary` aliases `label`, the `summary` slot aliases
 * the `label` slot, and `show()`/`hide()` alias `expand()`/`collapse()`.
 *
 * @customElement lr-accordion-item
 * @slot - Panel content.
 * @slot label - Header label; takes priority over `label`, `summary`, and the `summary` slot.
 * @slot summary - Compatibility alias for the `label` slot.
 * @slot icon - Optional decorative expand/collapse icon.
 * @csspart base - Deprecated compatibility name for the outer wrapper; use `accordion-item`.
 * @csspart accordion-item - The outer wrapper. It is the same node as `base`.
 * @csspart heading - Heading around the trigger; omitted for `heading-level="none"`.
 * @csspart button - The trigger button.
 * @csspart label - Label container.
 * @csspart icon - Expand/collapse icon container.
 * @csspart panel - Expandable panel.
 * @csspart content - Content container inside the panel.
 * @cssprop [--spacing=var(--lr-form-control-padding-inline)] - Header/content spacing.
 * @cssprop [--show-duration=var(--lr-duration-base)] - Expand transition duration.
 * @cssprop [--hide-duration=var(--lr-duration-base)] - Collapse transition duration.
 * @cssprop [--easing=var(--lr-easing-standard)] - Expand/collapse easing.
 * @cssstate animating - Present while an expand/collapse transition is settling.
 */
export class LyraAccordionItem extends LyraDetails {
  static override styles = [LyraElement.styles, sizes, styles];

  private transitionGeneration = 0;
  private transitionComplete: Promise<void> = Promise.resolve();
  private readonly itemInternals = this.attachInternals();
  @state() private hasLabelSlot = false;
  @state() private hasLegacySummarySlot = false;

  /** Text shown in the trigger. Rich content belongs in the `label` slot. */
  @property() label = '';

  /** Whether the panel is expanded. This is synchronized bidirectionally with `open`. */
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

  /** Heading level from 1–6, or `none` to render the button without a heading wrapper. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraAccordionHeadingLevel = '3';

  /** Whether the icon appears before or after the label. */
  @property({ attribute: 'icon-placement', reflect: true })
  iconPlacement: LyraAccordionIconPlacement = 'end';

  /** Visual treatment inherited from the owning accordion. */
  @property({ reflect: true })
  appearance: LyraAccordionAppearance = 'outlined';

  /** @internal Roving-tabindex state controlled by the owning accordion. */
  @property({ attribute: false }) isTabbable = true;

  override disconnectedCallback(): void {
    this.transitionGeneration++;
    this.setAnimating(false);
    super.disconnectedCallback();
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
      this.emit('lr-accordion-item-state-change', { item: this });
    }
  }

  /** Details-compatible expansion. Prefer `expand()` in accordion code. */
  override show(): void {
    const old = this.open;
    super.show();
    if (this.open === old) return;
    this.requestUpdate('expanded', old);
    this.transitionComplete = this.settleItemTransition(true);
  }

  /** Details-compatible collapse. Prefer `collapse()` in accordion code. */
  override hide(): void {
    const old = this.open;
    super.hide();
    if (this.open === old) return;
    this.requestUpdate('expanded', old);
    this.transitionComplete = this.settleItemTransition(false);
  }

  /** Expand with animation. Disabled or already-expanded items are unchanged. */
  async expand(): Promise<void> {
    if (this.expanded || this.disabled) return;
    this.show();
    if (this.expanded) await this.transitionComplete;
  }

  /** Collapse with animation. Disabled or already-collapsed items are unchanged. */
  async collapse(): Promise<void> {
    if (!this.expanded || this.disabled) return;
    this.hide();
    if (!this.expanded) await this.transitionComplete;
  }

  /** Toggle the expanded state. */
  async toggle(): Promise<void> {
    if (this.expanded) await this.collapse();
    else await this.expand();
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
    if (animating) this.itemInternals.states.add('animating');
    else this.itemInternals.states.delete('animating');
  }

  private async settleItemTransition(expectedExpanded: boolean): Promise<void> {
    const generation = ++this.transitionGeneration;
    this.setAnimating(true);
    await this.updateComplete;
    if (generation !== this.transitionGeneration || this.expanded !== expectedExpanded) return;

    if (this.isConnected && !prefersReducedMotion()) {
      const view = this.ownerDocument.defaultView;
      if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      if (generation !== this.transitionGeneration || this.expanded !== expectedExpanded) return;
      const panel = this.renderRoot.querySelector<HTMLElement>('[part~="panel"]');
      const animations = panel?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    }

    if (generation === this.transitionGeneration && this.expanded === expectedExpanded) {
      this.setAnimating(false);
    }
  }

  private handleTriggerClick = (): void => {
    if (this.disabled) return;
    const handled = this.emit('lr-accordion-item-trigger', { item: this }, { cancelable: true });
    if (!handled.defaultPrevented) void this.toggle();
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
      part="button"
      type="button"
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
