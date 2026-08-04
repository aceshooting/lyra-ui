import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { DocumentLocator } from '../../../ai/types.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import {
  activateOverlay,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { styles } from './selection-toolbar.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_copy, LYRA_DEFAULT_open, LYRA_DEFAULT_selectionAsk, LYRA_DEFAULT_selectionCite, LYRA_DEFAULT_selectionQuote, LYRA_DEFAULT_selectionToolbarLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
 * @cssprop --lr-selection-toolbar-inline-shift - Computed inline collision-avoidance offset.
 * @cssprop --lr-selection-toolbar-block-shift - Computed block collision-avoidance offset.
 * @status stable
 * @since 7.0.0
 */
export class LyraSelectionToolbar extends LyraElement<LyraSelectionToolbarEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    copy: LYRA_DEFAULT_copy,
    open: LYRA_DEFAULT_open,
    selectionAsk: LYRA_DEFAULT_selectionAsk,
    selectionCite: LYRA_DEFAULT_selectionCite,
    selectionQuote: LYRA_DEFAULT_selectionQuote,
    selectionToolbarLabel: LYRA_DEFAULT_selectionToolbarLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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
  private lifecycleGeneration = 0;
  private positioningGeneration = 0;
  private rovingGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no update in between, so
    // updated()'s `changed.has('open')` branch never reruns to notice `open` is still true --
    // resume the overlay registration *and* restart the positioning subscription
    // disconnectedCallback tore down (mirrors lr-tooltip's identical reconnect handling).
    if (this.hasUpdated) this.syncOpenLifecycle();
  }

  override disconnectedCallback(): void {
    this.lifecycleGeneration++;
    this.rovingGeneration++;
    this.retirePositioning();
    this.overlay?.suspend();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    // Adoption can happen after a node was already disconnected, so independently invalidate
    // every continuation and exact owner-window subscription retained by the old document.
    this.lifecycleGeneration++;
    this.rovingGeneration++;
    this.retirePositioning();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open') || changed.has('text')) this.syncOpenLifecycle();
    if (this.open && this.text && (changed.has('rect') || changed.has('actions'))) {
      this.updateToolbarPosition();
    }
    if (this.open && this.text && (changed.has('open') || changed.has('text') || changed.has('actions'))) {
      void this.syncRovingStops();
    }
  }

  private syncOpenLifecycle(): void {
    if (!this.isConnected) {
      // Lit can finish a queued update after removal. Never let that detached update resume the
      // suspended handle against its former document (or activate a fresh document listener).
      // Retiring the handle here also means the next connectedCallback necessarily registers
      // against the element's then-current owner document.
      this.retirePositioning();
      this.overlay?.deactivate();
      this.overlay = undefined;
      return;
    }
    if (!this.open || !this.text) {
      this.retirePositioning();
      this.overlay?.deactivate();
      this.overlay = undefined;
      return;
    }
    if (this.overlay?.isActive()) {
      this.overlay.resume();
    } else {
      this.overlay = activateOverlay({
        host: this,
        panel: () => this.toolbar ?? null,
        onEscape: () => this.dismiss(),
        modal: false,
        trapFocus: false,
      });
    }
    this.startPositioning();
  }

  private dismiss(): void {
    if (!this.open) return;
    this.open = false;
    this.emit('lr-dismiss');
  }

  private async activate(action: SelectionAction): Promise<void> {
    const text = this.text;
    const anchor = this.anchor;
    const generation = this.lifecycleGeneration;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    if (action === 'copy' && owner?.navigator.clipboard?.writeText) {
      try {
        await owner.navigator.clipboard.writeText(text);
      } catch (error) {
        if (!this.isCurrentLifecycle(generation, owner)) return;
        this.emit('lr-copy-error', { error });
      }
    }
    if (!this.isCurrentLifecycle(generation, owner)) return;
    this.emit('lr-selection-action', { action, text, anchor });
  }

  private isCurrentLifecycle(generation: number, owner: Window | null): boolean {
    return (
      generation === this.lifecycleGeneration
      && this.isConnected
      && this.ownerDocument.defaultView === owner
    );
  }

  private actionButtons(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('lr-button[data-action]')];
  }

  private async syncRovingStops(
    preferredIndex = this.activeActionIndex,
  ): Promise<HTMLElement | undefined> {
    const generation = this.lifecycleGeneration;
    const owner = this.ownerDocument.defaultView;
    const request = ++this.rovingGeneration;
    if (!owner || !this.isConnected) return undefined;
    const buttons = this.actionButtons();
    await Promise.all(
      buttons.map((button) => (button as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete),
    );
    if (
      request !== this.rovingGeneration
      || !this.isCurrentLifecycle(generation, owner)
      || buttons.some(
        (button) =>
          !button.isConnected
          || button.ownerDocument !== this.ownerDocument
          || !this.renderRoot.contains(button),
      )
    ) return undefined;
    if (buttons.length === 0) return undefined;
    this.activeActionIndex = Math.min(Math.max(0, preferredIndex), buttons.length - 1);
    buttons.forEach((button, index) => {
      const inner = button.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
      if (inner) inner.tabIndex = index === this.activeActionIndex ? 0 : -1;
    });
    return buttons[this.activeActionIndex];
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
    const generation = this.lifecycleGeneration;
    const owner = this.ownerDocument.defaultView;
    void this.syncRovingStops(next).then((button) => {
      if (
        !button
        || !this.isCurrentLifecycle(generation, owner)
        || !button.isConnected
        || button.ownerDocument !== this.ownerDocument
        || !this.renderRoot.contains(button)
      ) return;
      button.focus();
    });
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

  /** Coerces a caller-supplied `rect` to finite geometry before it reaches any style sink --
   *  `rect` is typed `DOMRectReadOnly`, but TS cannot enforce that across the property boundary,
   *  and `coordinates()` feeds a `styleMap()` whose first commit serializes the whole `style`
   *  value as one string (see `sanitizeSwatchColor`'s doc comment for why that matters). */
  private safeRect(rect: DOMRectReadOnly): { left: number; top: number; width: number; bottom: number } {
    return {
      left: finiteNumber(rect.left, 0),
      top: finiteNumber(rect.top, 0),
      width: finiteNumber(rect.width, 0),
      bottom: finiteNumber(rect.bottom, 0),
    };
  }

  private coordinates(): Record<string, string> {
    const viewportWidth = this.ownerDocument.defaultView?.innerWidth ?? 0;
    const rect = this.rect ? this.safeRect(this.rect) : undefined;
    const desiredInline = rect ? rect.left + rect.width / 2 : viewportWidth / 2;
    const block = rect?.top ?? 0;
    return {
      '--lr-selection-toolbar-inline-start': `${this.effectiveDirection === 'rtl'
        ? viewportWidth - desiredInline
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
    const rect = this.safeRect(this.rect ?? new view.DOMRect(view.innerWidth / 2, 0, 0, 0));
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
    this.retirePositioning();
    const toolbar = this.toolbar;
    const view = this.ownerDocument.defaultView;
    if (!toolbar || !view || !this.isConnected) return;
    const generation = this.positioningGeneration;
    const update = (): void => {
      if (
        generation !== this.positioningGeneration
        || !this.isConnected
        || this.ownerDocument.defaultView !== view
        || this.toolbar !== toolbar
      ) return;
      this.updateToolbarPosition();
    };
    const observer =
      typeof view.ResizeObserver === 'undefined'
        ? undefined
        : new view.ResizeObserver(update);
    observer?.observe(toolbar);
    view.addEventListener('resize', update);
    view.visualViewport?.addEventListener('resize', update);
    view.visualViewport?.addEventListener('scroll', update);
    update();
    this.stopPositioning = () => {
      observer?.disconnect();
      view.removeEventListener('resize', update);
      view.visualViewport?.removeEventListener('resize', update);
      view.visualViewport?.removeEventListener('scroll', update);
    };
  }

  private retirePositioning(): void {
    this.positioningGeneration++;
    const stop = this.stopPositioning;
    this.stopPositioning = undefined;
    stop?.();
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
