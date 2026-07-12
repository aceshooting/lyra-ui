import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon, closeIcon, expandIcon } from '../../internal/icons.js';
import { styles } from './widget.styles.js';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shadow-piercing so a slotted custom element's real focusable target (e.g.
// an <input> inside its own shadow root) is found even though the host tag
// itself doesn't match FOCUSABLE_SELECTOR.
function collectFocusable(el: Element): HTMLElement[] {
  const result: HTMLElement[] = [];
  if (el.matches(FOCUSABLE_SELECTOR)) {
    result.push(el as HTMLElement);
  }
  if (el instanceof HTMLSlotElement) {
    for (const assigned of el.assignedElements({ flatten: true })) {
      result.push(...collectFocusable(assigned));
    }
    return result;
  }
  const container: Element | ShadowRoot = el.shadowRoot ?? el;
  for (const child of Array.from(container.children)) {
    result.push(...collectFocusable(child));
  }
  return result;
}

/**
 * Whether `el` is actually laid out/paintable — used to drop e.g. a
 * `[collapsed]` body's slotted content from the fullscreen tab order.
 * `el.offsetParent !== null` is the usual shorthand for this, but it's
 * unreliable here: it resolves `null` for an element whose nearest
 * *positioned* ancestor (fullscreen's `[part="base"] { position: fixed }`)
 * lives across a slot-projection boundary from the element itself (true for
 * every element this scans, since they're all slotted content), even though
 * the element is genuinely rendered. `checkVisibility()` (falling back to
 * `getClientRects().length` on engines without it) correctly follows
 * flattened-tree/slot assignment instead.
 */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
}

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
 * @csspart base - The panel root (dialog role + backdrop when fullscreen).
 * @csspart header - The header row containing the title, actions, and toggle buttons.
 * @csspart title - The wrapper around the label/sublabel.
 * @csspart label - The panel title text.
 * @csspart sublabel - The panel subtitle text.
 * @csspart actions - The wrapper around the `actions` slot.
 * @csspart collapse-button - The collapse/expand toggle button.
 * @csspart fullscreen-button - The fullscreen toggle button.
 * @csspart body - The wrapper around the default slot (the panel body).
 * @csspart backdrop - The fullscreen scrim behind the panel.
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
  private readonly bodyId = nextId('widget-body');

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    }
    if (changed.has('fullscreen')) {
      if (this.fullscreen) {
        this.releaseScrollLock = lockScroll();
        document.addEventListener('keydown', this.onDocKeyDown);
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        document.removeEventListener('keydown', this.onDocKeyDown);
      }
    }
  }

  // Runs after render (not willUpdate) so `[part="base"]`'s fullscreen-only
  // tabindex has already landed in the DOM before the fallback .focus() call
  // below can rely on it. WAI-ARIA APG's dialog pattern requires opening a
  // modal to move focus inside it; without this it only happened to work
  // because a mouse click natively focuses the button that triggered it --
  // not true for a directly-set `fullscreen` property, and not guaranteed
  // for every input method/browser even in the click case.
  protected updated(changed: PropertyValues): void {
    if (changed.has('fullscreen') && this.fullscreen) {
      const first = this.getFocusableElements()[0];
      if (first) {
        first.focus();
      } else {
        this.shadowRoot?.querySelector<HTMLElement>('[part="base"]')?.focus();
      }
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent that keeps this same
    // element instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns
    // to notice `fullscreen` is still true. Restore the scroll lock/trap it
    // dropped. `hasUpdated` excludes the initial mount, where willUpdate's
    // first pass already establishes them from the starting property value.
    if (this.hasUpdated && this.fullscreen && !this.releaseScrollLock) {
      this.releaseScrollLock = lockScroll();
      document.addEventListener('keydown', this.onDocKeyDown);
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
    if (!this.fullscreen) {
      this.lastTrigger?.focus();
    }
  };

  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (!this.fullscreen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.fullscreen = false;
      this.emit('lyra-fullscreen-change', false);
      this.lastTrigger?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.getActiveElement();
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Bounds Tab/Shift+Tab to the panel while fullscreen (a modal presentation)
  // so keyboard focus can't escape to page content hidden behind the
  // backdrop. Order follows the header's actions slot, then the collapse/
  // fullscreen buttons, then the body slot -- the same order the flattened
  // tree already tabs through.
  private getFocusableElements(): HTMLElement[] {
    const root = this.shadowRoot;
    if (!root) return [];
    const fromSlot = (selector: string): HTMLElement[] => {
      const slot = root.querySelector<HTMLSlotElement>(selector);
      return slot ? slot.assignedElements({ flatten: true }).flatMap(collectFocusable) : [];
    };
    const shadowButtons = Array.from(
      root.querySelectorAll<HTMLElement>('[part="collapse-button"], [part="fullscreen-button"]'),
    );
    return [
      ...fromSlot('slot[name="actions"]'),
      ...shadowButtons,
      ...fromSlot('[part="body"] slot:not([name])'),
    ].filter(isRendered);
  }

  private getActiveElement(): Element | null {
    let active: Element | null = document.activeElement;
    while (active) {
      const inner: Element | null = active.shadowRoot?.activeElement ?? null;
      if (!inner) break;
      active = inner;
    }
    return active;
  }

  private onBackdropClick = (): void => {
    if (!this.fullscreen) return;
    this.fullscreen = false;
    this.emit('lyra-fullscreen-change', false);
    this.lastTrigger?.focus();
  };

  render(): TemplateResult {
    const hasLabel = this.label.length > 0;
    const hasSublabel = this.sublabel.length > 0;
    return html`
      ${this.fullscreen ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
      <div
        part="base"
        role=${this.fullscreen ? 'dialog' : nothing}
        aria-modal=${this.fullscreen ? 'true' : nothing}
        aria-label=${this.fullscreen ? (hasLabel ? this.label : 'Fullscreen panel') : nothing}
        tabindex=${this.fullscreen ? '-1' : nothing}
      >
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
                aria-controls=${this.bodyId}
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
        <div part="body" id=${this.bodyId} ?hidden=${this.collapsed}>
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
