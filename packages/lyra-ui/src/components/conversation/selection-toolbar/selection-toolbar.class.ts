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
 * @cssprop --lr-selection-toolbar-inline-start - Computed logical inline anchor position.
 * @cssprop --lr-selection-toolbar-block-start - Computed logical block anchor position.
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
  private stopPositioning?: () => void;
  private activeActionIndex = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.open) this.overlay?.resume();
  }

  override disconnectedCallback(): void {
    this.stopPositioning?.();
    this.stopPositioning = undefined;
    this.overlay?.suspend();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      if (this.open) {
        this.overlay = activateOverlay({
          host: this,
          panel: () => this.toolbar ?? null,
          onEscape: () => this.dismiss(),
          modal: false,
          trapFocus: false,
        });
        this.startPositioning();
      } else {
        this.stopPositioning?.();
        this.stopPositioning = undefined;
        this.overlay?.deactivate();
        this.overlay = undefined;
      }
    }
    if (this.open && (changed.has('rect') || changed.has('actions'))) this.updateToolbarPosition();
    if (this.open && (changed.has('open') || changed.has('actions'))) void this.syncRovingStops();
  }

  private dismiss(): void {
    if (!this.open) return;
    this.open = false;
    this.emit('lr-dismiss');
  }

  private async activate(action: SelectionAction): Promise<void> {
    const text = this.text;
    const anchor = this.anchor;
    if (action === 'copy' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        this.emit('lr-copy-error', { error });
      }
    }
    this.emit('lr-selection-action', { action, text, anchor });
  }

  private actionButtons(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('lr-button[data-action]')];
  }

  private async syncRovingStops(preferredIndex = this.activeActionIndex): Promise<void> {
    const buttons = this.actionButtons();
    await Promise.all(
      buttons.map((button) => (button as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete),
    );
    if (buttons.length === 0) return;
    this.activeActionIndex = Math.min(Math.max(0, preferredIndex), buttons.length - 1);
    buttons.forEach((button, index) => {
      const inner = button.shadowRoot?.querySelector<HTMLElement>('[part="base"]');
      if (inner) inner.tabIndex = index === this.activeActionIndex ? 0 : -1;
    });
  }

  private onToolbarFocusIn = (event: FocusEvent): void => {
    const buttons = this.actionButtons();
    const path = event.composedPath();
    const index = buttons.findIndex((button) => path.includes(button));
    if (index >= 0) void this.syncRovingStops(index);
  };

  private onToolbarKeyDown = (event: KeyboardEvent): void => {
    const buttons = this.actionButtons();
    if (buttons.length === 0) return;
    const forward = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let next: number;
    if (event.key === forward) next = (this.activeActionIndex + 1) % buttons.length;
    else if (event.key === backward) next = (this.activeActionIndex - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    void this.syncRovingStops(next).then(() => buttons[next]?.focus());
  };

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
    const desiredInline = this.rect ? this.rect.left + this.rect.width / 2 : window.innerWidth / 2;
    const block = this.rect?.top ?? 0;
    return {
      '--lr-selection-toolbar-inline-start': `${this.effectiveDirection === 'rtl'
        ? window.innerWidth - desiredInline
        : desiredInline}px`,
      '--lr-selection-toolbar-block-start': `${block}px`,
    };
  }

  private updateToolbarPosition = (): void => {
    const toolbar = this.toolbar;
    const view = this.ownerDocument.defaultView;
    if (!toolbar || !view) return;
    const edge = 8;
    const gap = 8;
    const rect =
      this.rect ??
      new DOMRect(view.innerWidth / 2, 0, 0, 0);
    const width = toolbar.offsetWidth;
    const height = toolbar.offsetHeight;
    const desiredInline = rect.left + rect.width / 2;
    const desiredLeft = desiredInline - width / 2;
    const maxLeft = Math.max(edge, view.innerWidth - width - edge);
    const left = Math.min(maxLeft, Math.max(edge, desiredLeft));
    const above = rect.top - height - gap;
    const below = rect.bottom + gap;
    const desiredTop = above >= edge ? above : below;
    const maxTop = Math.max(edge, view.innerHeight - height - edge);
    const top = Math.min(maxTop, Math.max(edge, desiredTop));
    const logicalInline =
      this.effectiveDirection === 'rtl' ? view.innerWidth - desiredInline : desiredInline;
    toolbar.style.setProperty('--lr-selection-toolbar-inline-start', `${logicalInline}px`);
    toolbar.style.setProperty('--lr-selection-toolbar-block-start', `${rect.top}px`);
    toolbar.style.setProperty(
      '--lr-selection-toolbar-inline-shift',
      `${left - (desiredInline - width / 2)}px`,
    );
    toolbar.style.setProperty(
      '--lr-selection-toolbar-block-shift',
      `${top - (rect.top - height)}px`,
    );
    toolbar.toggleAttribute('data-positioned', true);
  };

  private startPositioning(): void {
    this.stopPositioning?.();
    const toolbar = this.toolbar;
    const view = this.ownerDocument.defaultView;
    if (!toolbar || !view) return;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(this.updateToolbarPosition);
    observer?.observe(toolbar);
    view.addEventListener('resize', this.updateToolbarPosition);
    view.visualViewport?.addEventListener('resize', this.updateToolbarPosition);
    view.visualViewport?.addEventListener('scroll', this.updateToolbarPosition);
    this.updateToolbarPosition();
    this.stopPositioning = () => {
      observer?.disconnect();
      view.removeEventListener('resize', this.updateToolbarPosition);
      view.visualViewport?.removeEventListener('resize', this.updateToolbarPosition);
      view.visualViewport?.removeEventListener('scroll', this.updateToolbarPosition);
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
      @focusin=${this.onToolbarFocusIn}
      @keydown=${this.onToolbarKeyDown}
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
