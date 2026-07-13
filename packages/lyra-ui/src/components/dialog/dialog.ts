import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { styles } from './dialog.styles.js';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/**
 * Reason a dialog was dismissed, forwarded as the `lyra-dialog-close` event
 * detail. `'escape'` and `'backdrop'` are emitted by the dialog's own built-in
 * dismiss triggers; `'unmount'` is emitted when the dialog is removed from
 * the DOM while still open by something other than its own `close()` (e.g. a
 * consumer's own cleanup code, or a parent re-render that drops it); any
 * other string is whatever a caller passes to `close()` (e.g. a consumer's
 * own footer close button, or confirm.ts's `'confirm'`/`'cancel'`).
 */
export type DialogCloseReason = 'escape' | 'backdrop' | 'api' | 'unmount' | string;

/**
 * `<lyra-dialog>` — a general-purpose modal/overlay. `role="dialog"`,
 * focus-trapped while open, dismissible via Escape or a backdrop click, and
 * scroll-locks the document for as long as it's open. Chrome stays minimal —
 * no built-in title bar or close button; a consumer supplies a heading and
 * any close affordance itself via the default/`footer` slots.
 *
 * Accessible name: if a heading element (`h1`–`h6` or `[role="heading"]`) is
 * a *direct child* (not inside `slot="footer"`), its text content becomes
 * `aria-label` on the panel. Otherwise, when `label` is set, an invisible
 * (`.sr-only`, exposed as the `label` part) element carrying that text is
 * rendered inside the panel and `aria-labelledby` points at it instead.
 * Either way `label` itself never renders visible chrome — a slotted heading
 * is what a sighted user sees; `::part(label)` can be restyled to make the
 * sr-only text visible too, if a consumer wants that instead of slotting a
 * heading.
 *
 * The heading case deliberately uses `aria-label` (a copied string) rather
 * than `aria-labelledby` pointing at the heading's `id`: the heading is
 * *light-DOM* content while `[part="panel"]` lives in this element's
 * *shadow* tree, and an ID-reference attribute can't resolve across that
 * boundary (verified against axe's `aria-dialog-name` rule) — unlike the
 * `label`-prop case above, where the sr-only element is rendered inside the
 * same shadow root it labels, so `aria-labelledby` there is safe.
 *
 * Stacking: opening one `<lyra-dialog>` while another is already open (e.g. a
 * `confirm()` launched from within an already-open dialog) is supported --
 * Escape and the Tab focus trap only ever act on the topmost open dialog, so
 * dialogs beneath it stay open and untouched until the one on top closes.
 *
 * @customElement lyra-dialog
 * @slot - The dialog body.
 * @slot footer - Action buttons, rendered in a bottom row.
 * @event lyra-dialog-close - `detail: DialogCloseReason`. Fired whenever the
 *   dialog is dismissed via Escape, a backdrop click, a `close()` call, or
 *   (with reason `'unmount'`) removal from the DOM by anything else while
 *   still open.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open).
 * @csspart label - The invisible `label`-text element used for
 *   `aria-labelledby` when no heading is slotted.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 */
export class LyraDialog extends LyraElement {
  static styles = [LyraElement.styles, srOnly, styles];

  /** Whether the dialog is open. Set this (or call `close()`) — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Accessible name used when no heading is slotted — see the class doc for the full fallback order. */
  @property() label = '';

  @state() private hasFooterSlot = false;
  @state() private headingText?: string;

  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
  private readonly srLabelId = nextId('dialog-label');

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      this.detectHeading();
    }
    if (changed.has('open')) {
      if (this.open) {
        this.activateOverlay();
      } else {
        this.deactivateOverlay();
      }
    }
  }

  // Runs after render so the manager can resolve the panel and its composed
  // focus targets, including controls projected through either slot.
  protected updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice `open` is still true -- restore the scroll lock/trap it dropped.
    if (this.hasUpdated && this.open) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
        this.releaseScrollLock ??= lockScroll(this.ownerDocument);
      } else {
        this.activateOverlay();
      }
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.suspend();
    if (this.open) {
      // A reparent (drag-and-drop moving this same element instance to a new
      // parent) fires disconnectedCallback immediately followed by a
      // synchronous connectedCallback, with no turn of the event loop in
      // between -- deferring this check a microtask lets that case
      // short-circuit here once isConnected is true again, so only a genuine
      // removal (the element still disconnected once microtasks flush) ever
      // reaches the assignment below. Without this, removing an open dialog
      // any way other than its own close() (a consumer's own DOM cleanup, a
      // parent re-render that drops it, etc.) never fires
      // `lyra-dialog-close`, so e.g. confirm()'s returned promise hangs forever.
      queueMicrotask(() => {
        if (!this.isConnected && this.open) {
          this.open = false;
          this.emit<DialogCloseReason>('lyra-dialog-close', 'unmount');
        }
      });
    }
  }

  private onDefaultSlotChange = (): void => {
    this.detectHeading();
  };

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // Only direct children are scanned -- a heading nested several layers deep
  // (or inside a slotted custom element's own shadow root) is left to the
  // consumer to label explicitly via `label` instead. Same depth limit
  // lyra-widget applies to its own actions-slot presence check. Recomputed
  // only on slot assignment changes, not on every render -- a consumer that
  // mutates an already-slotted heading's textContent in place (rather than
  // replacing the node) won't retroactively update aria-label; set `label`
  // instead for a title that needs to change live.
  private detectHeading(): void {
    const heading = Array.from(this.children).find(
      (el) => el.getAttribute('slot') !== 'footer' && el.matches(HEADING_SELECTOR),
    ) as HTMLElement | undefined;
    this.headingText = heading?.textContent?.trim() || undefined;
  }

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lyra-dialog-close` detail --
   * built-in triggers pass `'escape'`/`'backdrop'`; a consumer's own close
   * affordance (e.g. a footer Cancel button) should call this directly with
   * its own reason string, so every dismissal path funnels through the same
   * event instead of the consumer having to also toggle `open` itself.
   */
  close(reason: DialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<DialogCloseReason>('lyra-dialog-close', reason);
  }

  private onBackdropClick = (): void => {
    this.overlay?.dismissBackdrop();
  };

  private activateOverlay(): void {
    if (this.overlay?.isActive()) return;
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => this.close('backdrop'),
    });
  }

  private deactivateOverlay(): void {
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.deactivate();
    this.overlay = undefined;
  }

  render(): TemplateResult {
    const useSrLabel = !this.headingText && this.label.length > 0;
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${this.headingText ?? nothing}
        aria-labelledby=${useSrLabel ? this.srLabelId : nothing}
        tabindex="-1"
      >
        ${useSrLabel
          ? html`<span id=${this.srLabelId} part="label" class="sr-only">${this.label}</span>`
          : nothing}
        <div part="body">
          <slot @slotchange=${this.onDefaultSlotChange}></slot>
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

defineElement('dialog', LyraDialog);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-dialog': LyraDialog;
  }
}
