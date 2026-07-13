import {
  html,
  svg,
  nothing,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
  type ComplexAttributeConverter,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
import { nextId } from '../../internal/a11y.js';
import { closeIcon, expandIcon } from '../../internal/icons.js';
import { styles } from './tool-result-dialog.styles.js';

/** Same status vocabulary as `<lyra-tool-call-chip>`. */
export type ToolResultStatus = 'pending' | 'running' | 'success' | 'error' | 'denied';

/**
 * Reason the dialog was dismissed, forwarded as the `lyra-dialog-close` event
 * detail -- mirrors `<lyra-dialog>`'s own `DialogCloseReason` shape.
 * `'escape'`/`'backdrop'` come from the dialog's own built-in dismiss
 * triggers, `'close-button'` from the built-in header close button, and any
 * other string is whatever a caller passes to `close()` directly (e.g. a
 * consumer's own footer action).
 */
export type ToolResultDialogCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'api'
  | (string & Record<never, never>);

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding
// tool-result-specific glyphs to that module -- it's off limits here -- so
// these still read as part of the same visual language as the rest of the
// library's inline icons. Same approach lyra-checkbox's/lyra-chat-message's
// own local glyphs take for the identical reason.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

/** A "restore from maximized" glyph -- the mirror image of `expandIcon()`,
 *  arrows pointing inward toward the center instead of outward toward the
 *  corners, same as lyra-widget's fullscreen-exit affordance reuses
 *  `closeIcon()` for the analogous "undo the expanded state" action. A
 *  distinct glyph (not `closeIcon()`) is used here because this dialog
 *  already has its own, separate close button right next to it -- two
 *  identical "x" icons side by side would be ambiguous about which one
 *  dismisses the dialog and which one only un-maximizes it. */
function shrinkIcon(): SVGTemplateResult {
  return icon(svg`
    <polyline points="4 14 10 14 10 20"></polyline>
    <polyline points="20 10 14 10 14 4"></polyline>
    <line x1="14" y1="10" x2="21" y2="3"></line>
    <line x1="3" y1="21" x2="10" y2="14"></line>
  `);
}

function pendingIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>`);
}

/** A three-quarter arc, spun by the `[status="running"] [part="status"] svg`
 *  CSS animation -- a full circle wouldn't visibly convey rotation. */
function runningIcon(): SVGTemplateResult {
  return icon(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

function successIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline>`);
}

function errorIcon(): SVGTemplateResult {
  return icon(svg`
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="9" y1="9" x2="15" y2="15"></line>
    <line x1="15" y1="9" x2="9" y2="15"></line>
  `);
}

/** A "blocked" glyph (circle + diagonal slash) -- distinct from `errorIcon()`
 *  since a denial is a policy rejection, not a runtime failure. */
function deniedIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><line x1="6" y1="18" x2="18" y2="6"></line>`);
}

const STATUS_ICON: Record<ToolResultStatus, () => SVGTemplateResult> = {
  pending: pendingIcon,
  running: runningIcon,
  success: successIcon,
  error: errorIcon,
  denied: deniedIcon,
};

/** Visible (not just color-coded) text for every status. */
const STATUS_LABEL: Record<ToolResultStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Success',
  error: 'Error',
  denied: 'Denied',
};

const STATUS_VALUES = new Set<string>(Object.keys(STATUS_LABEL));

/**
 * Normalizes `status` at the attribute boundary -- an out-of-union value
 * (markup a caller doesn't fully control, or a raw string from an untyped
 * consumer) falls back to `'pending'` here rather than reaching
 * STATUS_ICON/STATUS_LABEL as a bad lookup key and crashing `render()`. This
 * only covers attribute parsing; a `.status = ...` assignment made directly
 * as a property bypasses converters entirely, which is why `render()` below
 * also falls back at the STATUS_ICON/STATUS_LABEL lookup itself.
 */
const statusConverter: ComplexAttributeConverter<ToolResultStatus> = {
  fromAttribute(value): ToolResultStatus {
    return value !== null && STATUS_VALUES.has(value) ? (value as ToolResultStatus) : 'pending';
  },
  toAttribute(value): string {
    return value;
  },
};

/** `820` -> `"820ms"`; `1500` -> `"1.5s"`; `2000` -> `"2s"`. Sub-second
 *  durations are the common case for a single tool call, so they get the
 *  more precise unit; once a call runs a full second or longer, trimming to
 *  (at most) one decimal place of seconds reads better than a 4-5 digit
 *  millisecond count. */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) {
    return `${Math.round(Math.max(0, ms))}ms`;
  }
  const seconds = ms / 1000;
  const rounded = Math.round(seconds * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
}

/**
 * `<lyra-tool-result-dialog>` — a full tool-call detail overlay: a status/
 * duration header plus a `body` slot where a consumer typically places a
 * `<lyra-tabs>` with Input/Preview/JSON/Raw panels. This component knows
 * nothing about what's inside that slot — it only supplies the modal chrome
 * around it.
 *
 * This is its own standalone overlay implementation (`role="dialog"`,
 * focus-trapped, Escape/backdrop-dismissible, scroll-locking) rather than
 * nesting a `<lyra-dialog>` in its shadow template — see `<lyra-dialog>`'s
 * own header comment for why a new overlay component in this library
 * duplicates that pattern locally instead of composing the previous one:
 * slot-forwarding into a nested `<lyra-dialog>` would put a forwarding
 * `<slot>` where a light-DOM-scanning descendant (e.g. a slotted
 * `<lyra-tabs>`'s own `Array.from(this.children)` scan) expects real
 * projected content.
 *
 * `maximized` toggles between a constrained modal size and a near-fullscreen
 * size within the same open dialog and open/close lifecycle — unlike
 * `<lyra-widget>`'s fullscreen mode, there's no non-modal resting state to
 * return to, so no separate scroll-lock/focus-trap bookkeeping is needed for
 * the transition itself.
 *
 * Stacking: opening more than one of these dialogs at once is supported --
 * Escape and the Tab focus trap only ever act on the topmost open instance,
 * so instances beneath it stay open and untouched until the one on top closes.
 *
 * @customElement lyra-tool-result-dialog
 * @slot body - The dialog's main content — typically a `<lyra-tabs>` with
 * Input/Preview/JSON/Raw panels, entirely consumer-assembled.
 * @slot footer - Optional action buttons, rendered in a bottom row.
 * @event lyra-dialog-close - `detail: ToolResultDialogCloseReason`. Fired
 * exactly once per dismissal, via Escape, a backdrop click, the built-in
 * close button, or a `close()` call.
 * @event lyra-maximize-change - `detail: boolean` (the new `maximized`
 * state), fired when the header's maximize/restore toggle is clicked.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open).
 * @csspart header - The row containing the tool name, status, duration, and toggle/close buttons.
 * @csspart title - The wrapper around the tool name, status, and duration.
 * @csspart tool-name - The `tool-name` text.
 * @csspart status - The status badge (icon + text).
 * @csspart duration - The formatted `duration-ms` text.
 * @csspart header-actions - The wrapper around the maximize and close buttons.
 * @csspart maximize-button - The built-in maximize/restore toggle button.
 * @csspart close-button - The built-in close button.
 * @csspart body - The wrapper around the `body` slot.
 * @csspart footer - The wrapper around the `footer` slot.
 */
export class LyraToolResultDialog extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /**
   * Whether the dialog is open. Set this (or call `close()`) — there is no
   * separate `show()`/`hide()` pair. Both paths restore focus to the trigger
   * element identically; only `close()` additionally fires
   * `lyra-dialog-close`, since a direct assignment carries no reason string
   * to attach to that event.
   */
  @property({ type: Boolean, reflect: true }) open = false;

  /** The tool's name, rendered prominently in the header. */
  @property({ attribute: 'tool-name' }) toolName = '';

  /**
   * The tool call's current lifecycle state — drives the header's status
   * badge. An out-of-union value (e.g. a stray `status` attribute, or a
   * direct property assignment from an untyped caller) is treated as
   * `'pending'` rather than crashing render.
   */
  @property({ reflect: true, converter: statusConverter }) status: ToolResultStatus = 'pending';

  /** How long the call took, in milliseconds. Omitted from the header entirely when unset. */
  @property({ type: Number, attribute: 'duration-ms' }) durationMs?: number;

  /** Near-fullscreen presentation of the same open dialog. */
  @property({ type: Boolean, reflect: true }) maximized = false;

  @state() private hasFooterSlot = false;

  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
  private readonly titleId = nextId('tool-result-dialog-title');

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
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
  }

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lyra-dialog-close` detail --
   * built-in triggers pass `'escape'`/`'backdrop'`/`'close-button'`; a
   * consumer's own close affordance (e.g. a footer action button) should
   * call this directly with its own reason string, so every dismissal path
   * funnels through the same event instead of the consumer having to also
   * toggle `open` itself.
   *
   * Focus restoration follows the `open` lifecycle, so a direct `.open =
   * false` assignment restores focus identically to calling `close()` -- the
   * one thing a direct assignment still can't do is fire
   * `lyra-dialog-close`, since there's no reason string to attach without
   * going through this method.
   */
  close(reason: ToolResultDialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<ToolResultDialogCloseReason>('lyra-dialog-close', reason);
  }

  private onBackdropClick = (): void => {
    this.overlay?.dismissBackdrop();
  };

  private onCloseButtonClick = (): void => {
    this.close('close-button');
  };

  private toggleMaximized = (): void => {
    this.maximized = !this.maximized;
    this.emit<boolean>('lyra-maximize-change', this.maximized);
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
    const hasDuration = this.durationMs != null;
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-labelledby=${this.titleId}
        tabindex="-1"
      >
        <div part="header">
          <div part="title">
            <span part="tool-name" id=${this.titleId}>${this.toolName || 'Tool call'}</span>
            <span part="status"
              >${(STATUS_ICON[this.status] ?? STATUS_ICON.pending)()}<span
                >${STATUS_LABEL[this.status] ?? STATUS_LABEL.pending}</span
              ></span
            >
            ${hasDuration ? html`<span part="duration">${formatDuration(this.durationMs!)}</span>` : nothing}
          </div>
          <div part="header-actions">
            <button
              part="maximize-button"
              type="button"
              aria-pressed=${this.maximized ? 'true' : 'false'}
              aria-label=${this.maximized ? 'Restore' : 'Maximize'}
              @click=${this.toggleMaximized}
            >
              ${this.maximized ? shrinkIcon() : expandIcon()}
            </button>
            <button part="close-button" type="button" aria-label="Close" @click=${this.onCloseButtonClick}>
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
      </div>
    `;
  }
}

defineElement('tool-result-dialog', LyraToolResultDialog);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tool-result-dialog': LyraToolResultDialog;
  }
}
