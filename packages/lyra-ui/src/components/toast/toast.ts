import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './toast.styles.js';
import { LyraToastItem, type ToastVariant, type ToastSize } from './toast-item.js';
import './toast-item.js';

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
    item.variant = options.variant ?? 'neutral';
    item.duration = options.duration ?? 5000;
    item.size = options.size ?? 'm';
    item.withIcon = options.withIcon ?? false;
    item.textContent = message;
    this.appendChild(item);
    await item.updateComplete;
    return item;
  }

  render(): TemplateResult {
    return html`<div part="stack" role="status" aria-live="polite"><slot></slot></div>`;
  }
}

defineElement('toast', LyraToast);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-toast': LyraToast;
  }
}
