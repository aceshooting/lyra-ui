import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './toast.styles.js';
import { LyraToastItem, type ToastVariant, type ToastSize } from './toast-item.class.js';
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
  size?: ToastSize;
  withIcon?: boolean;
}

/**
 * `<lyra-toast>` — the stacking toast region. One per page is recommended.
 * Mirrors the Web Awesome `<wa-toast>` API under the `lyra-` prefix.
 *
 * @customElement lyra-toast
 * @slot - `<lyra-toast-item>` elements.
 * @csspart stack - The fl-column container holding the items.
 */
export class LyraToast extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Where the stack anchors on screen. */
  @property({ reflect: true }) placement: ToastPlacement = 'top-end';

  /** Create and append a toast item programmatically; resolves to the item. */
  async create(message: string, options: ToastCreateOptions = {}): Promise<LyraToastItem> {
    const item = document.createElement('lyra-toast-item') as LyraToastItem;
    // Only assign what the caller actually specified -- a freshly-created
    // <lyra-toast-item> already carries its own property defaults, so
    // falling back to a literal here (e.g. `?? 5000`) would duplicate those
    // defaults in a second place that has no way of staying in sync if the
    // property declaration in toast-item.ts ever changes.
    if (options.variant !== undefined) item.variant = options.variant;
    if (options.duration !== undefined) item.duration = options.duration;
    if (options.size !== undefined) item.size = options.size;
    if (options.withIcon !== undefined) item.withIcon = options.withIcon;
    item.textContent = message;
    this.appendChild(item);
    await item.updateComplete;
    return item;
  }

  render(): TemplateResult {
    // Each toast item owns its own status/alert role. Keeping a live region on
    // the stack as well would nest assertive alerts inside a polite region and
    // can cause duplicate or out-of-order announcements.
    return html`<div part="stack"><slot></slot></div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-toast': LyraToast;
  }
}

