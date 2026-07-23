import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { DocumentLocator } from '../../../ai/types.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  activateOverlay,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import '../../forms/button/button.js';
import { styles } from './selection-toolbar.styles.js';

export type SelectionAction = 'ask' | 'quote' | 'cite' | 'copy';

export interface SelectionActionDetail {
  action: SelectionAction;
  text: string;
  anchor: DocumentLocator | null;
}

export interface LyraSelectionToolbarEventMap {
  'lr-selection-action': CustomEvent<SelectionActionDetail>;
  'lr-dismiss': CustomEvent<undefined>;
  'lr-copy-error': CustomEvent<{ error: unknown }>;
}

const ACTION_KEYS: Record<SelectionAction, string> = {
  ask: 'selectionAsk',
  quote: 'selectionQuote',
  cite: 'selectionCite',
  copy: 'copy',
};

/**
 * `<lr-selection-toolbar>` — a nonmodal action toolbar positioned above selected text. It carries
 * the selected text and a format-neutral document anchor into ask, quote, cite, or copy actions.
 *
 * @customElement lr-selection-toolbar
 * @event lr-selection-action - An action was chosen. `detail: { action, text, anchor }`.
 * @event lr-dismiss - The toolbar was dismissed with Escape.
 * @event lr-copy-error - Clipboard writing failed. `detail: { error }`.
 * @csspart toolbar - The floating `role="toolbar"` surface.
 * @csspart action - Every action button.
 * @csspart action-ask - The ask action.
 * @csspart action-quote - The quote action.
 * @csspart action-cite - The cite action.
 * @csspart action-copy - The copy action.
 * @cssprop [--lr-selection-toolbar-inline-start] - Computed logical inline position of the toolbar.
 * @cssprop [--lr-selection-toolbar-block-start] - Computed logical block position of the toolbar.
 */
export class LyraSelectionToolbar extends LyraElement<LyraSelectionToolbarEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) open = false;
  @property() text = '';
  @property({ attribute: false }) anchor: DocumentLocator | null = null;
  @property({ attribute: false }) rect: DOMRectReadOnly | null = null;
  @property({ attribute: false }) actions: SelectionAction[] = ['ask', 'quote', 'cite', 'copy'];
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @query('[part="toolbar"]') private toolbar?: HTMLElement;
  private overlay?: OverlayHandle;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.open) this.overlay?.resume();
  }

  override disconnectedCallback(): void {
    this.overlay?.suspend();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    if (!changed.has('open')) return;
    if (this.open) {
      this.overlay = activateOverlay({
        host: this,
        panel: () => this.toolbar ?? null,
        onEscape: () => this.dismiss(),
        modal: false,
        trapFocus: false,
      });
    } else {
      this.overlay?.deactivate();
      this.overlay = undefined;
    }
  }

  private dismiss(): void {
    if (!this.open) return;
    this.open = false;
    this.emit('lr-dismiss');
  }

  private async activate(action: SelectionAction): Promise<void> {
    if (action === 'copy' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(this.text);
      } catch (error) {
        this.emit('lr-copy-error', { error });
      }
    }
    this.emit('lr-selection-action', { action, text: this.text, anchor: this.anchor });
  }

  private actionPartNames(action: SelectionAction): string {
    const parts = ['action'];
    switch (action) {
      case 'ask':
        parts.push('action-ask');
        break;
      case 'quote':
        parts.push('action-quote');
        break;
      case 'cite':
        parts.push('action-cite');
        break;
      case 'copy':
        parts.push('action-copy');
        break;
    }
    return parts.join(' ');
  }

  private coordinates(): Record<string, string> {
    const inline = this.rect ? this.rect.left + this.rect.width / 2 : window.innerWidth / 2;
    const logicalInline = this.effectiveDirection === 'rtl' ? window.innerWidth - inline : inline;
    const block = this.rect?.top ?? 0;
    return {
      '--lr-selection-toolbar-inline-start': `${logicalInline}px`,
      '--lr-selection-toolbar-block-start': `${block}px`,
    };
  }

  override render(): TemplateResult {
    if (!this.open || !this.text) return html`${nothing}`;
    const label = this.accessibleLabel || this.label || this.localize('selectionToolbarLabel');
    return html`<div
      part="toolbar"
      role="toolbar"
      aria-label=${label}
      tabindex="-1"
      style=${styleMap(this.coordinates())}
    >${this.actions.map((action) => html`<lr-button
        part=${this.actionPartNames(action)}
        data-action=${action}
        size="xs"
        appearance="plain"
        @click=${() => void this.activate(action)}
      >${this.localize(ACTION_KEYS[action])}</lr-button>`)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-selection-toolbar': LyraSelectionToolbar;
  }
}
