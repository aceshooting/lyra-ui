import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { place } from '../../internal/positioner.js';
import { rtlAwarePlacement } from '../../internal/rtl.js';
import { styles } from './overlay.styles.js';

export interface LyraPopoverEventMap {
  'lyra-show': CustomEvent<undefined>;
  'lyra-hide': CustomEvent<undefined>;
}

/**
 * `<lyra-popover>` — a click-triggered, light-dismiss floating surface.
 *
 * @customElement lyra-popover
 * @slot trigger - The interactive element that toggles the popover.
 * @slot - Popover content.
 * @event lyra-show - The popover opened.
 * @event lyra-hide - The popover closed.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The positioned popup.
 * @csspart content - The content wrapper.
 * @cssprop --lyra-overlay-max-inline-size - Maximum inline size of the popup (default `--lyra-size-20rem`).
 */
export class LyraPopover extends LyraElement<LyraPopoverEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ reflect: true }) placement: Placement = 'bottom-start';
  @property({ type: Number }) distance = 4;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Semantic role used by the popup. Dropdown subclasses set this to `menu`. */
  @property({ attribute: 'popup-role' }) popupRole: 'dialog' | 'menu' = 'dialog';
  @state() private trigger?: HTMLElement;
  private cleanup?: () => void;
  private readonly popupId = nextId('popover');
  private firstUpdate = true;

  protected updated(changed: PropertyValues): void {
    if (changed.has('open') || changed.has('placement') || changed.has('distance')) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) this.position();
      // Scoped to a real open/close transition -- a placement/distance-only
      // change re-runs this whole block to reposition, but must not re-emit
      // lyra-show/lyra-hide or toggle the document listener when `open`
      // itself didn't change.
      if (changed.has('open')) {
        if (this.open) {
          document.addEventListener('pointerdown', this.onDocumentPointer);
          if (!this.firstUpdate) this.emit('lyra-show');
        } else {
          document.removeEventListener('pointerdown', this.onDocumentPointer);
          if (!this.firstUpdate) this.emit('lyra-hide');
        }
      }
      this.syncTriggerA11y();
    }
    this.firstUpdate = false;
  }
  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so updated() never reruns to
    // notice `open` is still true -- restore the light-dismiss listener and
    // the Floating UI positioner subscription it dropped.
    if (this.hasUpdated && this.open) {
      document.addEventListener('pointerdown', this.onDocumentPointer);
      this.position();
    }
  }
  disconnectedCallback(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    document.removeEventListener('pointerdown', this.onDocumentPointer);
    super.disconnectedCallback();
  }
  private position(): void {
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    if (!this.open || !this.trigger || !popup) return;
    this.cleanup = place(this.trigger, popup, { placement: rtlAwarePlacement(this.placement, this), offset: this.distance });
  }
  private syncTriggerA11y(): void {
    if (!this.trigger) return;
    this.trigger.setAttribute('aria-haspopup', this.popupRole);
    this.trigger.setAttribute('aria-expanded', this.open ? 'true' : 'false');
    this.trigger.setAttribute('aria-controls', this.popupId);
  }
  private onTriggerSlotChange = (event: Event): void => {
    this.trigger = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    this.syncTriggerA11y();
    if (this.open) this.position();
  };
  private onTriggerClick = (): void => { this.open = !this.open; };
  private onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) { event.preventDefault(); this.open = false; this.trigger?.focus(); }
  };
  private onPopupKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); this.open = false; this.trigger?.focus(); }
  };
  private onDocumentPointer = (event: PointerEvent): void => {
    if (!event.composedPath().includes(this)) this.open = false;
  };
  render(): TemplateResult {
    // The accessible-name fallback follows the popup's actual semantic role --
    // a `popupRole="menu"` popup (e.g. <lyra-dropdown>) is announced as a menu,
    // not as a generic "Popover", so its translation is looked up under the
    // same key <lyra-menu> uses for its own default name.
    const label =
      this.getAttribute('aria-label') ||
      this.accessibleLabel ||
      this.localize(this.popupRole === 'menu' ? 'menuLabel' : 'popover');
    return html`
      <span part="trigger" @click=${this.onTriggerClick} @keydown=${this.onTriggerKeyDown}>
        <slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot>
      </span>
      <div id=${this.popupId} part="popup" role=${this.popupRole} aria-label=${label} ?data-hidden=${!this.open} @keydown=${this.onPopupKeyDown}>
        <div part="content"><slot></slot></div>
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-popover': LyraPopover; } }
