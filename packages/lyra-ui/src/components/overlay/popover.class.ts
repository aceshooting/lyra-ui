import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../internal/positioner.js';
import { rtlAwarePlacement } from '../../internal/rtl.js';
import { finiteNumber } from '../../internal/numbers.js';
import { styles } from './overlay.styles.js';

/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware. */
const DEFAULT_DISTANCE = 4;

export interface LyraPopoverEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
}

/**
 * `<lr-popover>` — a click-triggered, light-dismiss floating surface.
 *
 * @customElement lr-popover
 * @slot trigger - The interactive element that toggles the popover.
 * @slot - Popover content.
 * @event lr-show - The popover opened.
 * @event lr-hide - The popover closed.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The positioned popup.
 * @csspart content - The content wrapper.
 * @cssprop --lr-overlay-max-inline-size - Maximum inline size of the popup (default `--lr-size-20rem`).
 */
export class LyraPopover extends LyraElement<LyraPopoverEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ reflect: true }) placement: Placement = 'bottom-start';
  /** Anchor-offset distance (px) passed to Floating UI's `offset()` middleware. Can legitimately
   *  be negative (overlaps the popup with the trigger); NaN/non-finite falls back to the default. */
  @property({ type: Number }) distance = DEFAULT_DISTANCE;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Semantic role used by the popup. Dropdown subclasses set this to `menu`. */
  @property({ attribute: 'popup-role' }) popupRole: 'dialog' | 'menu' = 'dialog';
  @state() private trigger?: HTMLElement;
  /** The virtual anchor set by `showAt()`, taking priority over `trigger` for positioning while
   *  set. Cleared whenever the popover closes, so a later `open = true` with no fresh `showAt()`
   *  call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the popover, if any -- see
   *  `showAt()`'s doc comment and `onVirtualAnchorKeyDown`. */
  private returnFocusTo?: HTMLElement;
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
      // lr-show/lr-hide or toggle the document listener when `open`
      // itself didn't change.
      if (changed.has('open')) {
        if (this.open) {
          document.addEventListener('pointerdown', this.onDocumentPointer);
          // A virtual anchor has no slotted trigger and (typically) no focused popup content for
          // the existing trigger-/popup-scoped keydown handlers below to catch Escape through --
          // bind a document-level Escape listener for that path specifically.
          if (this.virtualAnchor) document.addEventListener('keydown', this.onVirtualAnchorKeyDown);
          if (!this.firstUpdate) this.emit('lr-show');
        } else {
          document.removeEventListener('pointerdown', this.onDocumentPointer);
          document.removeEventListener('keydown', this.onVirtualAnchorKeyDown);
          this.virtualAnchor = undefined;
          this.returnFocusTo = undefined;
          if (!this.firstUpdate) this.emit('lr-hide');
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
      if (this.virtualAnchor) document.addEventListener('keydown', this.onVirtualAnchorKeyDown);
      this.position();
    }
  }
  disconnectedCallback(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    document.removeEventListener('pointerdown', this.onDocumentPointer);
    document.removeEventListener('keydown', this.onVirtualAnchorKeyDown);
    super.disconnectedCallback();
  }
  /**
   * Opens the popover anchored to an arbitrary rectangle instead of the slotted `trigger` -- for
   * anchoring to a graph node, a canvas pixel, a chart datum, or any other non-DOM location.
   * `width`/`height` default to `0` (a point). Positions exactly as `place()` would against a real
   * element (flip/shift/RTL all apply unchanged).
   *
   * A virtual anchor has no DOM node, so `autoUpdate()` can't track it moving on its own -- call
   * `showAt()` again with fresh coordinates to re-anchor an already-open popover (e.g. on a graph
   * pan/zoom tick); the popover stays open across such a call, it does not toggle. Pass
   * `rect.contextElement` (a real, still-connected element near the virtual point) when available
   * so `autoUpdate()` has something to observe for ancestor-scroll/resize tracking; omitting it
   * still works, it just means only explicit re-`showAt()` calls keep the popover anchored.
   *
   * A virtual anchor also has no `.focus()`. Escape and light-dismiss return focus to
   * `options.returnFocusTo` when supplied, or skip focus-return entirely otherwise -- refocusing
   * the right place after a virtual anchor closes is the host's responsibility, since Lyra can't
   * assume how e.g. a graph node's own keyboard model wants focus back.
   */
  showAt(
    rect: { x: number; y: number; width?: number; height?: number; contextElement?: Element },
    options?: { returnFocusTo?: HTMLElement },
  ): void {
    this.virtualAnchor = virtualAnchorFromRect(rect);
    this.returnFocusTo = options?.returnFocusTo;
    if (this.open) this.position();
    else this.open = true;
  }
  private position(): void {
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    const anchor = this.virtualAnchor ?? this.trigger;
    if (!this.open || !anchor || !popup) return;
    this.cleanup = place(anchor, popup, {
      placement: rtlAwarePlacement(this.placement, this),
      offset: finiteNumber(this.distance, DEFAULT_DISTANCE),
    });
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
  /** Escape handling for a popover opened via `showAt()` -- bound at the document level (not
   *  scoped to the trigger/popup elements) while such a popover is open, since a virtual anchor
   *  has no slotted trigger or (typically) focused popup content for `onTriggerKeyDown`/
   *  `onPopupKeyDown` above to catch Escape through. */
  private onVirtualAnchorKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    const returnFocusTarget = this.returnFocusTo;
    this.open = false;
    returnFocusTarget?.focus();
  };
  private onDocumentPointer = (event: PointerEvent): void => {
    if (!event.composedPath().includes(this)) this.open = false;
  };
  render(): TemplateResult {
    // The accessible-name fallback follows the popup's actual semantic role --
    // a `popupRole="menu"` popup (e.g. <lr-dropdown>) is announced as a menu,
    // not as a generic "Popover", so its translation is looked up under the
    // same key <lr-menu> uses for its own default name.
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
declare global { interface HTMLElementTagNameMap { 'lr-popover': LyraPopover; } }
