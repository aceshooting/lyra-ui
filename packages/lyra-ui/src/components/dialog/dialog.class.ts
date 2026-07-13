import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { closeIcon } from '../../internal/icons.js';
import { styles } from './dialog.styles.js';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/**
 * Reason a dialog was dismissed, forwarded as the `lyra-dialog-close` event
 * detail. `'escape'` and `'backdrop'` are emitted by the dialog's own built-in
 * dismiss triggers; `'close-button'` by the built-in header close button
 * (rendered when `closable` is set); `'unmount'` is emitted when the dialog is
 * removed from the DOM while still open by something other than its own
 * `close()` (e.g. a consumer's own cleanup code, or a parent re-render that
 * drops it); any other string is whatever a caller passes to `close()` (e.g. a
 * consumer's own footer close button, or confirm.ts's `'confirm'`/`'cancel'`).
 */
export type DialogCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'api'
  | 'unmount'
  | (string & Record<never, never>);

/**
 * `<lyra-dialog>` — a general-purpose modal/overlay. `role="dialog"`,
 * focus-trapped while open, dismissible via Escape or a backdrop click, and
 * scroll-locks the document for as long as it's open. Chrome stays minimal by
 * default — no built-in title bar or close button; a consumer supplies a
 * heading and any close affordance itself via the default/`footer` slots.
 * `heading`/`closable` are an opt-in convenience for the common case where
 * hand-building that chrome isn't worth it (see below).
 *
 * Accessible name / visible header, in priority order:
 * 1. If a heading element (`h1`–`h6` or `[role="heading"]`) is a *direct
 *    child* (not inside `slot="footer"`), its text content becomes
 *    `aria-label` on the panel — unchanged, and takes priority over `heading`
 *    below so an existing consumer that already slots its own heading keeps
 *    rendering it exactly as before.
 * 2. Otherwise, when `heading` is set, a visible header row (`part="header"`)
 *    renders containing that text (`part="heading"`), which becomes the
 *    `aria-labelledby` target.
 * 3. Otherwise, when `label` is set, an invisible (`.sr-only`, exposed as the
 *    `label` part) element carrying that text is rendered inside the panel
 *    and `aria-labelledby` points at it instead.
 * Only one of cases 2/3 ever renders at a time, so exactly one element ever
 * claims `aria-labelledby`. `label` itself never renders visible chrome on
 * its own — `::part(label)` can be restyled to make the sr-only text visible,
 * or `heading` can be set instead, if a consumer wants visible chrome without
 * slotting a real heading element.
 *
 * The slotted-heading case deliberately uses `aria-label` (a copied string)
 * rather than `aria-labelledby` pointing at the heading's `id`: the heading is
 * *light-DOM* content while `[part="panel"]` lives in this element's
 * *shadow* tree, and an ID-reference attribute can't resolve across that
 * boundary (verified against axe's `aria-dialog-name` rule) — unlike the
 * `heading`/`label`-prop cases above, where the target element is rendered
 * inside the same shadow root it labels, so `aria-labelledby` there is safe.
 *
 * `closable` renders a close (X) button in the header row (creating one, with
 * no heading text, if `heading` is unset) that closes the dialog via the same
 * `close()` path as Escape/backdrop-dismiss, with reason `'close-button'`.
 *
 * Stacking: opening one `<lyra-dialog>` while another is already open (e.g. a
 * `confirm()` launched from within an already-open dialog) is supported --
 * Escape and the Tab focus trap only ever act on the topmost open dialog, so
 * dialogs beneath it stay open and untouched until the one on top closes.
 *
 * @customElement lyra-dialog
 * @slot - The dialog body.
 * @slot footer - Action buttons, rendered in a bottom row.
 * @event lyra-dialog-close - `detail: DialogCloseReason`. Cancelable — a listener calling
 *   `preventDefault()` stops the dialog from closing, for every dismissal path (Escape, backdrop,
 *   the built-in close button, or a consumer's own `close()` call). Fired whenever the dialog is
 *   dismissed via Escape, a backdrop click, the built-in close button (`closable`), a `close()`
 *   call, or (with reason `'unmount'`, not cancelable in practice since the element is already
 *   being removed) removal from the DOM by anything else while still open.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open). Shrink-wraps to its
 *   content by default, capped at `--lyra-dialog-max-width` (default `32rem`); set
 *   `--lyra-dialog-width` for an assertive width instead of only a cap.
 * @csspart header - The header row, rendered when `heading` is set (and no
 *   heading is slotted) and/or `closable` is `true`.
 * @csspart heading - The visible `heading`-text element inside `header`,
 *   rendered only when `heading` is set and no heading is slotted.
 * @csspart close-button - The built-in close button, rendered inside `header`
 *   only when `closable` is `true`.
 * @csspart label - The invisible `label`-text element used for
 *   `aria-labelledby` when no heading is slotted and `heading` is unset.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 */
export class LyraDialog extends LyraElement {
  static styles = [LyraElement.styles, srOnly, styles];

  /** Whether the dialog is open. Set this (or call `close()`) — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Accessible name used when no heading is slotted — see the class doc for the full fallback order. */
  @property() label = '';

  /** Visible header text, rendered when no heading element is slotted into
   *  the default slot — see the class doc for the full fallback order. Has
   *  no effect (renders nothing) if a light-DOM heading is slotted; that case
   *  keeps working completely unchanged whether or not `heading` is set. */
  @property() heading?: string;

  /** Renders a built-in close (X) button in the header row (creating one,
   *  with no heading text, if `heading` is unset), wired to the same
   *  `close()` path Escape/backdrop-dismiss already use, with reason
   *  `'close-button'`. */
  @property({ type: Boolean, attribute: 'closable' }) closable = false;

  /** Opts out of dismissing the dialog on a backdrop click — mirrors `wa-dialog`'s
   *  `light-dismiss` (default `false`, opt-in) equivalent, inverted to an opt-out here since
   *  backdrop-dismiss has always been this component's default behavior. `false` (the default)
   *  reproduces today's exact backdrop-dismiss behavior. */
  @property({ type: Boolean, attribute: 'no-light-dismiss' }) noLightDismiss = false;

  @state() private hasFooterSlot = false;
  @state() private headingText?: string;

  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
  private readonly srLabelId = nextId('dialog-label');
  private readonly headingId = nextId('dialog-heading');

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
   * built-in triggers pass `'escape'`/`'backdrop'`/`'close-button'`; a
   * consumer's own close affordance (e.g. a footer Cancel button) should
   * call this directly with its own reason string, so every dismissal path
   * funnels through the same event instead of the consumer having to also
   * toggle `open` itself.
   */
  close(reason: DialogCloseReason = 'api'): void {
    if (!this.open) return;
    const event = this.emit<DialogCloseReason>('lyra-dialog-close', reason, { cancelable: true });
    if (event.defaultPrevented) return;
    this.open = false;
  }

  private onBackdropClick = (): void => {
    if (this.noLightDismiss) return;
    this.overlay?.dismissBackdrop();
  };

  private onCloseButtonClick = (): void => {
    this.close('close-button');
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
    // Priority order (see class doc): a slotted heading always wins; only
    // when there isn't one does `heading` get a turn, then `label`'s
    // sr-only fallback -- never more than one of the two below claims
    // aria-labelledby for the same panel.
    const useHeadingProp = !this.headingText && !!this.heading;
    const useSrLabel = !this.headingText && !useHeadingProp && this.label.length > 0;
    const showHeader = useHeadingProp || this.closable;
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${this.headingText ?? nothing}
        aria-labelledby=${useHeadingProp ? this.headingId : useSrLabel ? this.srLabelId : nothing}
        tabindex="-1"
      >
        ${useSrLabel
          ? html`<span id=${this.srLabelId} part="label" class="sr-only">${this.label}</span>`
          : nothing}
        ${showHeader
          ? html`
              <div part="header">
                ${useHeadingProp
                  ? html`<span id=${this.headingId} part="heading">${this.heading}</span>`
                  : nothing}
                ${this.closable
                  ? html`
                      <button
                        part="close-button"
                        type="button"
                        aria-label=${this.localize('close')}
                        @click=${this.onCloseButtonClick}
                      >
                        ${closeIcon()}
                      </button>
                    `
                  : nothing}
              </div>
            `
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


declare global {
  interface HTMLElementTagNameMap {
    'lyra-dialog': LyraDialog;
  }
}
