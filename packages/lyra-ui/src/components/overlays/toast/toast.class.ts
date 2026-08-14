import { html, type TemplateResult } from 'lit';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { property } from 'lit/decorators.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './toast.styles.js';
import type { LyraToastItem, ToastVariant } from './toast-item.class.js';
import './toast-item.class.js';

export type ToastPlacement =
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end';

export interface ToastCreateOptions {
  variant?: ToastVariant;
  duration?: number;
  /** Item size. Long upstream spellings remain observable on the created item. */
  size?: LyraSize;
  withIcon?: boolean;
}

/**
 * `<lr-toast>` — the stacking toast region. One per page is recommended.
 * Mirrors the Web Awesome `<wa-toast>` API under the `lr-` prefix.
 *
 * @customElement lr-toast
 * @slot - `<lr-toast-item>` elements.
 * @csspart stack - The fl-column container holding the items.
 * @cssprop --gap - Mapped alias for `--lr-toast-gap`.
 * @cssprop --width - Mapped alias for `--lr-toast-width`.
 * @cssprop [--lr-toast-gap=var(--lr-space-s)] - Gap between stacked items.
 * @cssprop [--lr-toast-width=var(--lr-size-28rem)] - Inline size of the stack, capped by the
 *   usable logical safe-area rectangle.
 * @cssprop [--lr-toast-accent-width=var(--lr-size-4px)] - Width of a slotted item's accent bar.
 *   Read by `<lr-toast-item>`'s own stylesheet, so set it on the item.
 * @cssprop [--lr-toast-accent-color=var(--lr-color-border)] - Accent bar / icon color of a slotted
 *   item, auto-swapped per its `variant`. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-padding=var(--lr-space-m)] - Padding of a slotted item, auto-swapped per its
 *   `size`. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-font-size=var(--lr-font-size-m)] - Font size of a slotted item,
 *   auto-swapped per its `size`. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-show-duration=var(--lr-transition-base, 180ms ease-out)] - Show transition
 *   of a slotted item. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-hide-duration=var(--lr-transition-base, 180ms ease-out)] - Hide transition
 *   of a slotted item. Read by `<lr-toast-item>`, so set it on the item.
 * @cssstate visible - Present while the region contains at least one toast item.
 * @status stable
 * @since 4.0.0
 */
export class LyraToast extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** Where the stack anchors on screen. */
  @property({ reflect: true }) placement: ToastPlacement = 'top-end';

  private readonly toastInternals = attachInternalsSafely(this);
  private childObserver?: MutationObserver;

  private syncVisibleState = (): void => {
    const hasToast =
      this.isConnected && Array.from(this.children).some((child) => child.localName === tag('toast-item'));
    setCustomState(this.toastInternals, 'visible', hasToast);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    const MutationObserverConstructor = this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverConstructor) {
      this.childObserver = new MutationObserverConstructor(this.syncVisibleState);
      this.childObserver.observe(this, { childList: true });
    }
    this.syncVisibleState();
  }

  override disconnectedCallback(): void {
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    setCustomState(this.toastInternals, 'visible', false);
    super.disconnectedCallback();
  }

  /** Create and append a toast item programmatically; resolves to the item. Long size aliases in
   * `options` remain observable just like declarative toast-item attributes. */
  async create(message: string, options: ToastCreateOptions = {}): Promise<LyraToastItem> {
    const itemTag = tag('toast-item');
    const ownerRegistry = this.ownerDocument.defaultView?.customElements;
    if (!ownerRegistry?.get(itemTag)) {
      throw new TypeError(`${itemTag} is not registered in the toast owner document.`);
    }
    const item = this.ownerDocument.createElement(itemTag) as LyraToastItem;
    if (typeof item.hide !== 'function' || !('updateComplete' in item)) {
      throw new TypeError(`${itemTag} does not expose the Lyra toast-item contract.`);
    }
    // Only assign what the caller actually specified -- a freshly-created
    // <lr-toast-item> already carries its own property defaults, so
    // falling back to a literal here (e.g. `?? 5000`) would duplicate those
    // defaults in a second place that has no way of staying in sync if the
    // property declaration in toast-item.ts ever changes.
    if (options.variant !== undefined) item.variant = options.variant;
    if (options.duration !== undefined) item.duration = options.duration;
    if (options.size !== undefined) item.size = options.size;
    if (options.withIcon !== undefined) item.withIcon = options.withIcon;
    item.textContent = message;
    this.appendChild(item);
    this.syncVisibleState();
    await item.updateComplete;
    return item;
  }

  override render(): TemplateResult {
    // Toast items announce their normalized messages through the shared
    // light-DOM sinks. Keeping a live role on this visible stack would pull
    // its controls back into an atomic announcement subtree.
    return html`<div part="stack"><slot @slotchange=${this.syncVisibleState}></slot></div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-toast': LyraToast;
  }
}
