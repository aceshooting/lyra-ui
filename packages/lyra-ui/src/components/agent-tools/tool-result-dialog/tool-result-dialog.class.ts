import { NativeModalCarrier } from '../../../internal/native-modal-carrier.js';
import { ModalSurfaceController } from '../../../internal/modal-surface-controller.js';
import { nativeModalCarrierStyles } from '../../../internal/native-modal-carrier.styles.js';
import {
  html,
  svg,
  nothing,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon, expandIcon } from '../../../internal/icons.js';
import { formatShortDuration, safeDurationMs } from '../../../internal/duration.js';
import { TOOL_CALL_STATUSES, TOOL_STATUS_LABEL_KEY, toolGlyph, toolStatusIcon } from '../tool-status.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { styles } from './tool-result-dialog.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_map, LYRA_DEFAULT_maximize, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusIncomplete, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_toolCall } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Same status vocabulary as `<lr-tool-call-chip>`, including `incomplete` for a call that ended
 *  without a result. */
export type ToolResultStatus = LyraToolStatus | 'incomplete';

/**
 * Reason the dialog was dismissed, forwarded as the `lr-close` event
 * detail -- mirrors `<lr-dialog>`'s own `DialogCloseReason` shape.
 * `'escape'`/`'backdrop'` come from the dialog's own built-in dismiss
 * triggers (the latter only while `lightDismiss` is enabled), `'close-button'` from the built-in
 * header close button, and any other string is whatever a caller passes to `close()` directly (e.g. a
 * consumer's own footer action).
 */
export type ToolResultDialogCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'api'
  | (string & Record<never, never>);

/** The accepted dismissal reason. */
export interface LyraToolResultDialogCloseDetail {
  reason: ToolResultDialogCloseReason;
}

export interface LyraToolResultDialogEventMap {
  'lr-close': CustomEvent<LyraToolResultDialogCloseDetail>;
  /** Cancelable request to toggle `maximized`, fired before it changes. */
  'lr-maximize-change-request': CustomEvent<{ readonly maximized: boolean }>;
}

/** A "restore from maximized" glyph -- the mirror image of `expandIcon()`,
 *  arrows pointing inward toward the center instead of outward toward the
 *  corners, same as lr-widget's fullscreen-exit affordance reuses
 *  `closeIcon()` for the analogous "undo the expanded state" action. A
 *  distinct glyph (not `closeIcon()`) is used here because this dialog
 *  already has its own, separate close button right next to it -- two
 *  identical "x" icons side by side would be ambiguous about which one
 *  dismisses the dialog and which one only un-maximizes it. */
function shrinkIcon(): SVGTemplateResult {
  return toolGlyph(svg`
    <polyline points="4 14 10 14 10 20"></polyline>
    <polyline points="20 10 14 10 14 4"></polyline>
    <line x1="14" y1="10" x2="21" y2="3"></line>
    <line x1="3" y1="21" x2="10" y2="14"></line>
  `);
}

// The status glyphs and label keys are shared with `<lr-tool-call-chip>`, `<lr-tool-timeline>` and
// `<lr-tool-call-block>` (../tool-status.ts), so a call reads identically wherever it is shown.

const TOOL_RESULT_DIALOG_STATUS = literalSetConverter<ToolResultStatus>(TOOL_CALL_STATUSES, 'pending');

/**
 * `<lr-tool-result-dialog>` — a full tool-call detail overlay: a status/
 * duration header plus a `body` slot where a consumer typically places a
 * `<lr-tab-group>` with Input/Preview/JSON/Raw panels. This component knows
 * nothing about what's inside that slot — it only supplies the modal chrome
 * around it.
 *
 * This is its own standalone overlay implementation (`role="dialog"`,
 * focus-trapped, Escape-dismissible, optionally backdrop-dismissible, scroll-locking) rather than
 * nesting a `<lr-dialog>` in its shadow template — see `<lr-dialog>`'s
 * own header comment for why a new overlay component in this library
 * duplicates that pattern locally instead of composing the previous one:
 * slot-forwarding into a nested `<lr-dialog>` would put a forwarding
 * `<slot>` where a light-DOM-scanning descendant (e.g. a slotted
 * `<lr-tab-group>`'s own `Array.from(this.children)` scan) expects real
 * projected content.
 *
 * `maximized` toggles between a constrained modal size and a near-fullscreen
 * size within the same open dialog and open/close lifecycle — unlike
 * `<lr-widget>`'s fullscreen mode, there's no non-modal resting state to
 * return to, so no separate scroll-lock/focus-trap bookkeeping is needed for
 * the transition itself.
 *
 * Stacking: opening more than one of these dialogs at once is supported --
 * Escape and the Tab focus trap only ever act on the topmost open instance,
 * so instances beneath it stay open and untouched until the one on top closes.
 * The header also remains usable in narrow allocations: long localized status
 * labels wrap within their badge while the maximize and close actions move to
 * a reachable row instead of forcing the panel wider.
 *
 * When opened above a native modal, the dialog remains interactive without moving its host or slots.
 * Closing returns focus to the element that held it when the dialog opened, including an opener
 * the host re-shows only after the close.
 *
 * @customElement lr-tool-result-dialog
 * @slot body - The dialog's main content — typically a `<lr-tab-group>` with
 * Input/Preview/JSON/Raw panels, entirely consumer-assembled.
 * @slot footer - Optional action buttons, rendered in a bottom row.
 * @event lr-close - `detail: { reason: ToolResultDialogCloseReason }`. Fired
 * exactly once per dismissal, via Escape, an opted-in backdrop click, the built-in
 * close button, or a `close()` call. The name is not dialog-scoped in this library: nesting this
 * dialog inside a consumer's own `<lr-dialog>` means that dialog's `lr-close` listener also
 * observes this event. See `<lr-dialog>`'s own `lr-close` docs for the full list of emitters and
 * the `event.target !== event.currentTarget` guard.
 * @event lr-maximize-change-request - Cancelable. `detail: { maximized: boolean }` (the would-be
 * new `maximized` state), fired when the header's maximize/restore toggle is clicked, *before*
 * `maximized` itself changes. Calling `preventDefault()` vetoes the toggle and leaves `maximized`
 * unchanged -- e.g. a host persisting a per-user "prefers maximized" layout preference can hold the
 * transition until a save round-trip completes.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself.
 * @csspart header - The row containing the tool name, status, duration, and toggle/close buttons.
 * @csspart title - The wrapper around the tool name, status, and duration.
 * @csspart tool-name - The `tool-name` text.
 * @csspart status - The status badge (icon + text).
 * @csspart duration - The formatted `duration-ms` text.
 * @csspart header-actions - The wrapper around the maximize and close buttons.
 * @csspart maximize-button - The built-in maximize/restore button, named by its action.
 * @csspart close-button - The built-in close button.
 * @csspart body - The wrapper around the `body` slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * @cssprop [--lr-tool-result-dialog-overlay-color=var(--lr-color-overlay)] - Backdrop color.
 * @cssprop --lr-tool-result-dialog-maximized-inset - Insets for the maximized panel.
 * @cssprop [--lr-tool-result-dialog-spin=var(--lr-transition-ambient)] - Running-status animation
 *   duration and timing.
 * @cssprop [--lr-tool-result-dialog-pending-color=var(--lr-color-text-quiet)] - Pending status foreground.
 * @cssprop [--lr-tool-result-dialog-pending-bg=transparent] - Pending status background.
 * @cssprop [--lr-tool-result-dialog-running-color=var(--lr-color-brand)] - Running status foreground.
 * @cssprop [--lr-tool-result-dialog-running-bg=var(--lr-color-brand-quiet)] - Running status background.
 * @cssprop [--lr-tool-result-dialog-success-color=var(--lr-color-success)] - Success status foreground.
 * @cssprop [--lr-tool-result-dialog-success-bg=var(--lr-color-success-quiet)] - Success status background.
 * @cssprop [--lr-tool-result-dialog-error-color=var(--lr-color-danger)] - Error status foreground.
 * @cssprop [--lr-tool-result-dialog-error-bg=var(--lr-color-danger-quiet)] - Error status background.
 * @cssprop [--lr-tool-result-dialog-denied-color=var(--lr-color-warning)] - Denied status foreground.
 * @cssprop [--lr-tool-result-dialog-denied-bg=var(--lr-color-warning-quiet)] - Denied status background.
 * @cssprop [--lr-tool-result-dialog-incomplete-color=var(--lr-color-text-quiet)] - Incomplete status foreground.
 * @cssprop [--lr-tool-result-dialog-incomplete-bg=transparent] - Incomplete status background.
 * @status stable
 * @since 4.0.0
 */
export class LyraToolResultDialog extends LyraElement<LyraToolResultDialogEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    map: LYRA_DEFAULT_map,
    maximize: LYRA_DEFAULT_maximize,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusIncomplete: LYRA_DEFAULT_statusIncomplete,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    toolCall: LYRA_DEFAULT_toolCall,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, nativeModalCarrierStyles, styles];

  /**
   * Whether the dialog is open. Set this directly or use `show()`/`hide()`/`close()`. Each path
   * restores focus to the trigger element identically; reasoned closing additionally fires
   * `lr-close`, since a direct assignment carries no reason string
   * to attach to that event.
   */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Dismisses the dialog on a backdrop click. Opt-in and `false` by default, matching
   *  `<lr-dialog>`, `<lr-drawer>`, and `<lr-lightbox>`. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  /** Accessible name for the dialog. A non-empty host `aria-label` takes precedence over a
   *  direct property value; without either, the visible heading names the dialog. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** The tool's name, rendered prominently in the header. */
  @property({ attribute: 'tool-name' }) toolName = '';

  /**
   * The tool call's current lifecycle state — drives the header's status
   * badge. `incomplete` is a call that ended without a result. An
   * out-of-union value (e.g. a stray `status` attribute, or a direct property
   * assignment from an untyped caller) normalizes and reflects as `'pending'`.
   */
  @property({ reflect: true, converter: TOOL_RESULT_DIALOG_STATUS })
  get status(): ToolResultStatus {
    return this.statusValue;
  }
  set status(next: ToolResultStatus) {
    const old = this.statusValue;
    this.statusValue = TOOL_RESULT_DIALOG_STATUS.normalizeReflected(this, 'status', next);
    this.requestUpdate('status', old);
  }
  private statusValue: ToolResultStatus = 'pending';

  /** How long the call took, in milliseconds. Omitted from the header entirely when unset. */
  // numeric-guard-exempt: safeDurationMs() in internal/duration.ts rejects non-finite values and clamps negatives.
  @property({ type: Number, attribute: 'duration-ms' }) durationMs?: number;

  /** Near-fullscreen presentation of the same open dialog. */
  @property({ type: Boolean, reflect: true }) maximized = false;

  @state() private hasFooterSlot = false;

  private readonly nativeModal = new NativeModalCarrier(this, {
    onCancel: () => {
      if (!this.open || !this.overlay?.isTopmost()) return;
      this.close('escape');
    },
    onUnexpectedClose: () => {
      if (!this.open) return;
      this.nativeModal.hide();
      this.close('api');
    },
  });
  private readonly modalSurface = new ModalSurfaceController(this, this.nativeModal);
  private overlay?: OverlayHandle;
  private readonly titleId = nextId('tool-result-dialog-title');

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    }
    if (changed.has('open')) {
      if (this.open) {
        this.modalSurface.open(() => this.activateOverlay());
      } else {
        const hadOverlay = this.overlay !== undefined;
        this.modalSurface.close(hadOverlay, () => this.deactivateOverlay(), () => !this.open);
      }
    }
  }

  // Runs after render so the manager can resolve the panel and its composed
  // focus targets, including controls projected through either slot.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.open) this.enterTopLayer();
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice `open` is still true -- restore the scroll lock/trap it dropped.
    if (this.hasUpdated && this.open) {
      this.modalSurface.prepare();
      this.requestUpdate();
      if (this.overlay?.isActive()) {
        this.overlay.resume();
      } else {
        this.activateOverlay();
      }
      // The shadow panel survives a same-document reparent, so restore focus before the pending
      // Lit update. Waiting for updateComplete leaves focus on <body> for a microtask turn.
      this.overlay?.focusInitial();
      void this.updateComplete.then(() => {
        if (!this.open || !this.isConnected) return;
        this.enterTopLayer();
        this.overlay?.focusInitial();
      });
    }
  }

  /** Joins the top layer like `<lr-dialog>` so an already open dialog cannot cover it. */
  private enterTopLayer(): void {
    this.modalSurface.show();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.modalSurface.disconnect();
    this.overlay?.suspend();
  }

  // Reads the light-DOM `slot` attribute directly rather than the live `assignedElements()`
  // snapshot: WebKit has been observed reporting the latter transiently empty for an unrelated
  // forwarding-slot chain nested inside the assigned element (see `<lr-switch>`'s equivalent fix),
  // even though the assigned child's own `slot` attribute never changed.
  private onFooterSlotChange = (): void => {
    this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
  };

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as `lr-close` detail.reason --
   * built-in triggers pass `'escape'`/`'backdrop'`/`'close-button'` (`'backdrop'` only while
   * `lightDismiss` is enabled); a
   * consumer's own close affordance (e.g. a footer action button) should
   * call this directly with its own reason string, so every dismissal path
   * funnels through the same event instead of the consumer having to also
   * toggle `open` itself.
   *
   * Focus restoration follows the `open` lifecycle, so a direct `.open =
   * false` assignment restores focus identically to calling `close()` -- the
   * one thing a direct assignment still can't do is fire
   * `lr-close`, since there's no reason string to attach without
   * going through this method.
   */
  close(reason: ToolResultDialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit('lr-close', { reason });
  }

  /** Opens the dialog. No-op when already open. */
  show(): void {
    if (this.open) return;
    this.open = true;
  }

  /** Closes the dialog through the same reasoned lifecycle as `close()`. */
  hide(reason: ToolResultDialogCloseReason = 'api'): void {
    this.close(reason);
  }

  private onBackdropClick = (): void => {
    this.overlay?.dismissBackdrop();
  };

  private onCloseButtonClick = (): void => {
    this.close('close-button');
  };

  private toggleMaximized = (): void => {
    const next = !this.maximized;
    const request = this.emit('lr-maximize-change-request', Object.freeze({ maximized: next }), { cancelable: true });
    if (request.defaultPrevented) return;
    this.maximized = next;
  };

  private activateOverlay(): void {
    if (this.overlay?.isActive()) return;
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => {
        if (this.lightDismiss) this.close('backdrop');
      },
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private deactivateOverlay(): void {
    this.overlay?.deactivate();
    this.overlay = undefined;
  }

  private localizedDuration(ms: number): string {
    return formatShortDuration(this.localize.bind(this), this.effectiveLocale, ms);
  }

  /** `durationMs` normalized to a finite, non-negative value, or `null` -- `null`/`undefined`
   *  and a non-finite raw value (e.g. a stray `NaN` assignment) both mean "no duration to show,"
   *  matching this property's own "omitted from the header entirely when unset" contract, rather
   *  than rendering a literal "NaN ms". A finite negative value clamps to `0` instead of
   *  rendering a nonsensical negative duration. */
  private get safeDurationMs(): number | null {
    return safeDurationMs(this.durationMs);
  }

  override render(): TemplateResult {
    const durationMs = this.safeDurationMs;
    const hostLabel = this.getAttribute('aria-label');
    const panelLabel = hostLabel?.trim()
      ? hostLabel
      : typeof this.accessibleLabel === 'string' && this.accessibleLabel.trim()
        ? this.accessibleLabel
        : null;
    return this.nativeModal.render(html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open && !this.nativeModal.requested ? 'dialog' : nothing}
        aria-modal=${this.open && !this.nativeModal.requested ? 'true' : nothing}
        aria-label=${!this.nativeModal.requested ? panelLabel ?? nothing : nothing}
        aria-labelledby=${!this.nativeModal.requested && panelLabel === null ? this.titleId : nothing}
        tabindex="-1"
      >
        <div part="header">
          <div part="title">
            <span part="tool-name" id=${this.titleId}>${this.toolName || this.localize('toolCall')}</span>
            <span part="status"
              >${toolStatusIcon(this.status)}<span
                >${this.localize(TOOL_STATUS_LABEL_KEY[this.status])}</span
              ></span
            >
            ${durationMs != null
              ? html`<span part="duration"
                  >${this.localizedDuration(durationMs)}</span
                >`
              : nothing}
          </div>
          <div part="header-actions">
            <button
              part="maximize-button"
              type="button"
              aria-label=${this.maximized ? this.localize('restore') : this.localize('maximize')}
              @click=${this.toggleMaximized}
            >
              ${this.maximized ? shrinkIcon() : expandIcon()}
            </button>
            <button part="close-button" type="button" aria-label=${this.localize('close')} @click=${this.onCloseButtonClick}>
              ${closeIcon()}
            </button>
          </div>
        </div>
        <div part="body">
          <slot name="body"></slot>
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </div>
        ${this.nativeModal.renderHelperSlot()}
      </div>
    `, { label: panelLabel, labelledBy: panelLabel === null ? this.titleId : null });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-result-dialog': LyraToolResultDialog;
  }
}
