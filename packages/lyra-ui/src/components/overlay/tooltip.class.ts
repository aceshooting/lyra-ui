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
 * @cssprop --lyra-tooltip-max-inline-size - Maximum inline size of the tooltip (default `--lyra-size-20rem`).
 * @cssprop --lyra-tooltip-background - Tooltip background color (default `--lyra-color-neutral`).
 * @cssprop --lyra-tooltip-color - Tooltip text color (default `--lyra-color-on-neutral`).
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
  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so updated() never reruns to
    // notice `open` is still true -- restore the Floating UI positioner
    // subscription it dropped. The trigger's own listeners are untouched by
    // (dis)connect since they live on a light-DOM element the reconnect
    // doesn't move independently of this host.
    if (this.hasUpdated && this.open) this.position();
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
  private bindTrigger(trigger: HTMLElement): void {
    trigger.addEventListener('mouseenter', this.onEnter);
    trigger.addEventListener('mouseleave', this.onLeave);
    trigger.addEventListener('focus', this.onEnter);
    trigger.addEventListener('blur', this.onLeave);
    trigger.addEventListener('keydown', this.onTriggerKeyDown);
  }
  private unbindTrigger(trigger: HTMLElement): void {
    trigger.removeEventListener('mouseenter', this.onEnter);
    trigger.removeEventListener('mouseleave', this.onLeave);
    trigger.removeEventListener('focus', this.onEnter);
    trigger.removeEventListener('blur', this.onLeave);
    trigger.removeEventListener('keydown', this.onTriggerKeyDown);
    trigger.removeAttribute('aria-describedby');
  }
  private onTriggerSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (next === this.trigger) return;
    // Swapping the slotted trigger (a conditional template, a repeat() re-key)
    // must strip the outgoing element's listeners and stale aria-describedby
    // before adopting the new one -- otherwise the old node keeps driving this
    // tooltip's open state and keeps pointing assistive tech at it.
    if (this.trigger) this.unbindTrigger(this.trigger);
    this.trigger = next;
    if (!this.trigger) return;
    this.bindTrigger(this.trigger);
    this.syncTriggerA11y();
  };
  private onEnter = (): void => { if (!this.manual) this.setOpen(true); };
  private onLeave = (): void => { if (!this.manual) this.setOpen(false); };
  private onTriggerKeyDown = (event: KeyboardEvent): void => {
    // WCAG 1.4.13: content shown on hover/focus must be dismissable without
    // moving pointer hover or keyboard focus -- Escape hides the tooltip while
    // leaving focus on the trigger (unlike the popover's Escape handling, the
    // trigger already has focus here, so there's nothing to refocus).
    if (this.manual || !this.open || event.key !== 'Escape') return;
    event.preventDefault();
    clearTimeout(this.timer);
    this.open = false;
  };
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
