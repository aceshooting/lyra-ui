import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { place } from '../../internal/positioner.js';
import { rtlAwarePlacement } from '../../internal/rtl.js';
import { tooltipStyles } from './overlay.styles.js';

/**
 * `<lyra-tooltip>` — a localized, hover/focus tooltip for a consumer-owned trigger.
 *
 * @customElement lyra-tooltip
 * @slot trigger - The element that receives hover/focus listeners.
 * @slot - Tooltip content.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The tooltip popup.
 */
export class LyraTooltip extends LyraElement {
  static styles = [LyraElement.styles, tooltipStyles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) manual = false;
  @property({ type: Number }) delay = 150;
  @property({ reflect: true }) placement: Placement = 'top';
  @property({ type: Number }) distance = 6;
  @property() content = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private trigger?: HTMLElement;
  private cleanup?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly tooltipId = nextId('tooltip');

  protected updated(changed: PropertyValues): void {
    if (changed.has('open') || changed.has('placement') || changed.has('distance')) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) this.position();
      this.syncTriggerA11y();
    }
  }
  disconnectedCallback(): void {
    clearTimeout(this.timer);
    this.cleanup?.();
    this.cleanup = undefined;
    super.disconnectedCallback();
  }
  private position(): void {
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    if (this.open && this.trigger && popup) this.cleanup = place(this.trigger, popup, { placement: rtlAwarePlacement(this.placement, this), offset: this.distance });
  }
  private syncTriggerA11y(): void {
    if (!this.trigger) return;
    this.trigger.setAttribute('aria-describedby', this.open ? this.tooltipId : '');
    if (!this.open) this.trigger.removeAttribute('aria-describedby');
  }
  private setOpen(next: boolean): void {
    clearTimeout(this.timer);
    if (next && this.delay > 0) this.timer = setTimeout(() => { this.open = true; }, this.delay);
    else this.open = next;
  }
  private onTriggerSlotChange = (event: Event): void => {
    this.trigger = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (!this.trigger) return;
    this.trigger.addEventListener('mouseenter', this.onEnter);
    this.trigger.addEventListener('mouseleave', this.onLeave);
    this.trigger.addEventListener('focus', this.onEnter);
    this.trigger.addEventListener('blur', this.onLeave);
    this.syncTriggerA11y();
  };
  private onEnter = (): void => { if (!this.manual) this.setOpen(true); };
  private onLeave = (): void => { if (!this.manual) this.setOpen(false); };
  render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.accessibleLabel || nothing;
    return html`
      <span part="trigger"><slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot></span>
      <div id=${this.tooltipId} part="popup" role="tooltip" aria-label=${label} ?data-hidden=${!this.open}>
        <slot>${this.content}</slot>
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-tooltip': LyraTooltip; } }
