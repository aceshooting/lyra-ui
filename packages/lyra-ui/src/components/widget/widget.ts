import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { chevronIcon, closeIcon, expandIcon } from '../../internal/icons.js';
import { styles } from './widget.styles.js';

/**
 * `<lyra-widget>` — a titled panel shell with an optional collapse toggle and
 * an optional fullscreen-expand toggle. Fullscreen promotes the same host
 * element in place (a CSS state, not a clone/portal), so slotted content
 * (a chart, a running simulation, scroll position) survives the transition.
 *
 * @customElement lyra-widget
 * @slot - The panel body.
 * @slot actions - Header action controls, rendered before the collapse/expand buttons.
 * @event lyra-collapse-change - `detail: boolean` (the new `collapsed` state).
 * @event lyra-fullscreen-change - `detail: boolean` (the new `fullscreen` state).
 * @csspart base, header, title, label, sublabel, actions, body, backdrop
 */
export class LyraWidget extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property() label = '';
  @property() sublabel = '';
  @property({ type: Boolean, reflect: true }) collapsible = false;
  @property({ type: Boolean, reflect: true }) collapsed = false;
  @property({ type: Boolean, reflect: true }) expandable = false;
  @property({ type: Boolean, reflect: true }) fullscreen = false;

  @state() private hasActionsSlot = false;

  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    }
    if (changed.has('fullscreen')) {
      if (this.fullscreen) {
        this.releaseScrollLock = lockScroll();
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    document.removeEventListener('keydown', this.onDocKeyDown);
  }

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit('lyra-collapse-change', this.collapsed);
  };

  private toggleFullscreen = (e: MouseEvent): void => {
    this.lastTrigger = e.currentTarget as HTMLElement;
    this.fullscreen = !this.fullscreen;
    this.emit('lyra-fullscreen-change', this.fullscreen);
    if (this.fullscreen) {
      document.addEventListener('keydown', this.onDocKeyDown);
    } else {
      document.removeEventListener('keydown', this.onDocKeyDown);
      this.lastTrigger?.focus();
    }
  };

  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.fullscreen) {
      e.preventDefault();
      this.fullscreen = false;
      this.emit('lyra-fullscreen-change', false);
      document.removeEventListener('keydown', this.onDocKeyDown);
      this.lastTrigger?.focus();
    }
  };

  private onBackdropClick = (): void => {
    if (!this.fullscreen) return;
    this.fullscreen = false;
    this.emit('lyra-fullscreen-change', false);
    document.removeEventListener('keydown', this.onDocKeyDown);
    this.lastTrigger?.focus();
  };

  render(): TemplateResult {
    const hasLabel = this.label.length > 0;
    const hasSublabel = this.sublabel.length > 0;
    return html`
      ${this.fullscreen ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
      <div part="base">
        <div part="header">
          <div part="title">
            ${hasLabel ? html`<span part="label">${this.label}</span>` : nothing}
            ${hasSublabel ? html`<span part="sublabel">${this.sublabel}</span>` : nothing}
          </div>
          <div part="actions" ?hidden=${!this.hasActionsSlot}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          </div>
          ${this.collapsible
            ? html`<button
                part="collapse-button"
                type="button"
                aria-expanded=${this.collapsed ? 'false' : 'true'}
                aria-label=${this.collapsed ? 'Expand panel' : 'Collapse panel'}
                @click=${this.toggleCollapsed}
              >
                <span style="display:inline-flex;transform:rotate(${this.collapsed ? '0deg' : '90deg'})"
                  >${chevronIcon()}</span
                >
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
        <div part="body" ?hidden=${this.collapsed}>
          <slot></slot>
        </div>
      </div>
    `;
  }
}

defineElement('widget', LyraWidget);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-widget': LyraWidget;
  }
}
