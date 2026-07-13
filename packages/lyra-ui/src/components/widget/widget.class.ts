import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import {
  activateOverlay,
  collectFocusableElements,
  deepActiveElement,
  type OverlayHandle,
} from '../../internal/overlay-manager.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon, closeIcon, expandIcon } from '../../internal/icons.js';
import { styles } from './widget.styles.js';

export interface WidgetView {
  id: string;
  label: string;
  icon?: TemplateResult;
}

export interface LyraWidgetEventMap {
  'lyra-collapse-change': CustomEvent<boolean>;
  'lyra-fullscreen-change': CustomEvent<boolean>;
  'lyra-view-change': CustomEvent<string>;
}
/**
 * `<lyra-widget>` — a titled panel shell with an optional collapse toggle and
 * an optional fullscreen-expand toggle. Fullscreen promotes the same host
 * element in place (a CSS state, not a clone/portal), so slotted content
 * (a chart, a running simulation, scroll position) survives the transition.
 *
 * @customElement lyra-widget
 * @slot - The panel body.
 * @slot icon - Optional leading icon in the title row.
 * @slot label - Rich label content (overrides the `label` attribute).
 * @slot sublabel - Rich sublabel content (overrides the `sublabel` attribute).
 * @slot actions - Header action controls, rendered before the collapse/expand buttons.
 * @event lyra-collapse-change - `detail: boolean` (the new `collapsed` state).
 * @event lyra-fullscreen-change - `detail: boolean` (the new `fullscreen` state).
 * @event lyra-view-change - Fired when the active view changes via a header toggle click.
 *   `detail: string` (the new view's `id`).
 * @csspart base - The panel root (dialog role + backdrop when fullscreen).
 * @csspart header - The header row containing the title, actions, and toggle buttons.
 * @csspart title - The wrapper around the label/sublabel.
 * @csspart icon - Wrapper around the `icon` slot. Hidden entirely when empty.
 * @csspart label-group - Wrapper around the label and sublabel.
 * @csspart label - The panel title text.
 * @csspart sublabel - The panel subtitle text.
 * @csspart actions - The wrapper around the `actions` slot.
 * @csspart view-toggles - The header toggle-button group, only rendered when `views` is non-empty.
 * @csspart view-toggle - A single view toggle button.
 * @csspart collapse-button - The collapse/expand toggle button.
 * @csspart fullscreen-button - The fullscreen toggle button.
 * @csspart body - The wrapper around the default slot (the panel body).
 * @csspart backdrop - The fullscreen scrim behind the panel.
 *
 * `fullscreen-inset` overrides the default `var(--lyra-space-l)` inset applied to `[part="base"]`
 * and `[part="backdrop"]` while fullscreen (e.g. `"0 0 0 240px"` to leave a persistent sidebar
 * visible). `compact` tightens header/body padding — same convention as `lyra-empty`'s `compact`.
 */
export class LyraWidget extends LyraElement<LyraWidgetEventMap> {
  static styles = [LyraElement.styles, styles];

  @property() label = '';
  @property() sublabel = '';
  @property({ type: Boolean, reflect: true }) collapsible = false;
  @property({ type: Boolean, reflect: true }) collapsed = false;
  @property({ type: Boolean, reflect: true }) expandable = false;
  @property({ type: Boolean, reflect: true }) fullscreen = false;
  /** Raw CSS `inset` shorthand applied to the fullscreen panel and backdrop instead of the default
   *  `var(--lyra-space-l)` on every side — e.g. `"0 0 0 240px"` to leave a 240px persistent sidebar
   *  visible while fullscreen. */
  @property({ attribute: 'fullscreen-inset' }) fullscreenInset = '';
  /** Tighter header/body padding for constrained spaces. */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Named alternate views for the panel body -- e.g. a chart/table toggle inside the same card
   *  chrome. Each entry gets a header toggle button and a `<slot name="view-${id}">`. Empty (the
   *  default) renders today's single unnamed default slot as the sole view, unchanged. */
  @property({ attribute: false }) views: WidgetView[] = [];

  /** The currently active view's `id` -- defaults to the first entry of `views` (or `''` when
   *  `views` is empty). Settable directly by a consumer wanting to control the active view
   *  externally; also updated internally when a view toggle is clicked. */
  @property({ attribute: false }) activeView = '';

  @state() private hasActionsSlot = false;
  @state() private hasIconSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasSublabelSlot = false;

  private releaseScrollLock?: () => void;
  private overlayHandle?: OverlayHandle;
  private explicitTrigger?: HTMLElement;
  private readonly bodyId = nextId('widget-body');

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
      this.hasIconSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'icon');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasSublabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'sublabel');
    }
    if (changed.has('fullscreen')) {
      if (this.fullscreen) {
        this.activateFullscreenOverlay();
      } else {
        this.deactivateFullscreenOverlay();
      }
    }
    if (changed.has('views') && !this.views.some((v) => v.id === this.activeView)) {
      this.activeView = this.views[0]?.id ?? '';
    }
  }

  // Runs after render (not willUpdate) so `[part="base"]`'s fullscreen-only
  // tabindex has already landed in the DOM before the fallback .focus() call
  // below can rely on it. WAI-ARIA APG's dialog pattern requires opening a
  // modal to move focus inside it; without this it only happened to work
  // because a mouse click natively focuses the button that triggered it --
  // not true for a directly-set `fullscreen` property, and not guaranteed
  // for every input method/browser even in the click case.
  //
  // The `collapsed` branch covers the same modal-focus-trap requirement for
  // a second case: collapsing the body while fullscreen hides (display:none)
  // whatever was focused inside it, which the browser resolves by silently
  // moving focus outside the panel. The shared manager then reclaims it while
  // preserving focus that is still on one of the visible header controls.
  protected updated(changed: PropertyValues): void {
    if (changed.has('fullscreen') && this.fullscreen) {
      this.overlayHandle?.focusInitial();
    } else if (changed.has('collapsed') && this.fullscreen) {
      const panel = this.shadowRoot?.querySelector<HTMLElement>('[part="base"]');
      const active = deepActiveElement(this.ownerDocument);
      if (panel && !collectFocusableElements(panel).includes(active as HTMLElement)) {
        if (active && typeof (active as HTMLElement).blur === 'function') (active as HTMLElement).blur();
        this.overlayHandle?.focusInitial();
      }
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent that keeps this same
    // element instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns
    // to notice `fullscreen` is still true. Restore the shared overlay
    // registration and scroll lock it dropped.
    if (this.hasUpdated && this.fullscreen) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateFullscreenOverlay();
      }
      if (!this.releaseScrollLock) this.releaseScrollLock = lockScroll(this.ownerDocument);
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.suspend();
  }

  private activateFullscreenOverlay(): void {
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null,
      onEscape: this.dismissFullscreen,
      onBackdrop: this.dismissFullscreen,
      restoreFocusTo: this.explicitTrigger,
    });
    this.explicitTrigger = undefined;
  }

  private deactivateFullscreenOverlay(): void {
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.deactivate();
    this.overlayHandle = undefined;
  }

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onSublabelSlotChange = (e: Event): void => {
    this.hasSublabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private setActiveView = (id: string): void => {
    if (id === this.activeView) return;
    this.activeView = id;
    this.emit('lyra-view-change', id);
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit('lyra-collapse-change', this.collapsed);
  };

  private toggleFullscreen = (e: MouseEvent): void => {
    if (!this.fullscreen) this.explicitTrigger = e.currentTarget as HTMLElement;
    this.fullscreen = !this.fullscreen;
    this.emit('lyra-fullscreen-change', this.fullscreen);
  };

  private dismissFullscreen = (): void => {
    if (!this.fullscreen) return;
    this.fullscreen = false;
    this.emit('lyra-fullscreen-change', false);
  };

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  render(): TemplateResult {
    const hasLabel = this.label.length > 0;
    const hasSublabel = this.sublabel.length > 0;
    return html`
      ${this.fullscreen
        ? html`<div
            part="backdrop"
            style=${this.fullscreenInset ? `--lyra-widget-fullscreen-inset:${this.fullscreenInset}` : nothing}
            @click=${this.onBackdropClick}
          ></div>`
        : nothing}
      <div
        part="base"
        role=${this.fullscreen ? 'dialog' : nothing}
        aria-modal=${this.fullscreen ? 'true' : nothing}
        aria-label=${this.fullscreen ? (hasLabel ? this.label : 'Fullscreen panel') : nothing}
        tabindex=${this.fullscreen ? '-1' : nothing}
        style=${this.fullscreenInset ? `--lyra-widget-fullscreen-inset:${this.fullscreenInset}` : nothing}
      >
        <div part="header">
          <div part="title">
            <span part="icon" ?hidden=${!this.hasIconSlot}>
              <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
            </span>
            <div part="label-group">
              ${hasLabel || this.hasLabelSlot
                ? html`<span part="label"><slot name="label" @slotchange=${this.onLabelSlotChange}>${this.label}</slot></span>`
                : nothing}
              ${hasSublabel || this.hasSublabelSlot
                ? html`<span part="sublabel"><slot name="sublabel" @slotchange=${this.onSublabelSlotChange}>${this.sublabel}</slot></span>`
                : nothing}
            </div>
          </div>
          <div part="actions" ?hidden=${!this.hasActionsSlot}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          </div>
          ${this.views.length > 0
            ? html`<div part="view-toggles" role="group" aria-label="Panel view">
                ${this.views.map(
                  (v) => html`<button
                    part="view-toggle"
                    type="button"
                    aria-pressed=${v.id === this.activeView ? 'true' : 'false'}
                    @click=${() => this.setActiveView(v.id)}
                  >${v.icon ?? nothing}${v.label}</button>`,
                )}
              </div>`
            : nothing}
          ${this.collapsible
            ? html`<button
                part="collapse-button"
                type="button"
                aria-expanded=${this.collapsed ? 'false' : 'true'}
                aria-label=${this.collapsed ? 'Expand panel' : 'Collapse panel'}
                aria-controls=${this.bodyId}
                style="transform:rotate(${this.collapsed ? '0deg' : '90deg'})"
                @click=${this.toggleCollapsed}
              >
                ${chevronIcon()}
              </button>`
            : nothing}
          ${this.expandable
            ? html`<button
                part="fullscreen-button"
                type="button"
                aria-pressed=${this.fullscreen ? 'true' : 'false'}
                aria-label=${this.fullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                @click=${this.toggleFullscreen}
              >
                ${this.fullscreen ? closeIcon() : expandIcon()}
              </button>`
            : nothing}
        </div>
        <div part="body" id=${this.bodyId} ?hidden=${this.collapsed}>
          ${this.views.length === 0
            ? html`<slot></slot>`
            : this.views.map(
                (v) => html`<div ?hidden=${v.id !== this.activeView}><slot name="view-${v.id}"></slot></div>`,
              )}
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-widget': LyraWidget;
  }
}
