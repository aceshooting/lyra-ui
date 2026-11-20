import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './browser-frame.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { styleMap } from 'lit/directives/style-map.js';
import { finiteRange } from '../../../internal/numbers.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { overallSemanticLabel, overallSemanticRole } from '../semantic-owner.js';
import type { LyraStreamPhase } from '../../../internal/stream-phase.js';
import { firstByIdentityMemo } from '../../../internal/collection-identity.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_browserFrameControllerAgent, LYRA_DEFAULT_browserFrameControllerUser, LYRA_DEFAULT_browserFrameHandBack, LYRA_DEFAULT_browserFrameLabel, LYRA_DEFAULT_browserFramePingsLimit, LYRA_DEFAULT_browserFrameStatusConnecting, LYRA_DEFAULT_browserFrameStatusIdle, LYRA_DEFAULT_browserFrameStatusLive, LYRA_DEFAULT_browserFrameStatusStalled, LYRA_DEFAULT_browserFrameStop, LYRA_DEFAULT_browserFrameTakeOver, LYRA_DEFAULT_browserFrameUrlLabel, LYRA_DEFAULT_browserFrameViewOf } from '../../../internal/default-strings/agent-tools.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const BROWSER_FRAME_PHASE = literalSetConverter<LyraStreamPhase>(
  ['idle', 'connecting', 'streaming', 'stalled'],
  'idle',
);

const BROWSER_FRAME_CONTROLLER = literalSetConverter<BrowserFrameController>(['agent', 'user'], 'agent');
const MAX_RENDERED_PINGS = 500;

/** The `object-fit: contain` content box (in pixels, relative to the container's own top-left) for
 *  an image of `naturalW`x`naturalH` shown inside a `containerW`x`containerH` box -- ping
 *  coordinates are percentages *of this box*, not of the (possibly letterboxed) outer container. */
function containRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
): { left: number; top: number; width: number; height: number } {
  if (naturalW === 0 || naturalH === 0 || containerW === 0 || containerH === 0) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const containerRatio = containerW / containerH;
  const naturalRatio = naturalW / naturalH;
  if (naturalRatio > containerRatio) {
    const height = containerW / naturalRatio;
    return { left: 0, top: (containerH - height) / 2, width: containerW, height };
  }
  const width = containerH * naturalRatio;
  return { left: (containerW - width) / 2, top: 0, width, height: containerH };
}

export interface BrowserPing {
  id: string;
  x: number;
  y: number;
  kind: 'click' | 'type' | 'scroll' | 'move';
}

/** Who currently holds input control of the browser session. */
export type BrowserFrameController = 'agent' | 'user';

const STATUS_KEY = {
  idle: 'browserFrameStatusIdle',
  connecting: 'browserFrameStatusConnecting',
  streaming: 'browserFrameStatusLive',
  stalled: 'browserFrameStatusStalled',
} as const;

const pingIdentity = (ping: BrowserPing): string => ping.id;

export interface LyraBrowserFrameEventMap {
  'lr-take-over': CustomEvent<{ controller: BrowserFrameController }>;
  'lr-stop': CustomEvent<null>;
}

/**
 * `<lr-browser-frame>` — presentational "agent computer" viewport: a screenshot/frame stream (or
 * slotted live media), read-only URL display, action-ping overlays, and take-over/stop affordances.
 * No automation transport, no input relay — take-over is an event; the host swaps in its own
 * interactive element.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-browser-frame
 * @event lr-take-over - `detail: { controller }` — the *requested* controller.
 * @event lr-stop - Stop the agent's browser session.
 * @slot - Host-owned live element (e.g. `<video>` or an interactive `<iframe>`), replacing the
 *   `frame-src` image.
 * @slot actions - Extra toolbar controls.
 * @csspart base - The root wrapper (`role="group"`).
 * @csspart toolbar - The header row.
 * @csspart url - The read-only address text.
 * @csspart status - The visible, non-live status text.
 * @csspart controller-badge - The current controller indicator.
 * @csspart actions - The `actions` slot wrapper.
 * @csspart take-over-button - The take-over/hand-back button, not rendered while `without-controls`.
 * @csspart stop-button - The stop button, not rendered while `without-controls`.
 * @csspart viewport - The frame/media container.
 * @csspart frame - The `frame-src` `<img>` (absent once the default slot is populated).
 * @csspart ping - One action-ping marker; carries `data-kind`.
 * @csspart limit - The localized notice when the action-marker window omits older entries.
 * @cssprop [--lr-browser-frame-aspect-ratio=16 / 9] - The viewport's aspect ratio.
 * @cssprop [--lr-browser-frame-controller-bg=var(--lr-color-brand-quiet)] - Controller
 *   badge background.
 * @cssprop [--lr-browser-frame-controller-color=var(--lr-color-brand)] - Controller badge text
 *   color.
 * @cssprop [--lr-browser-frame-ping-click-color=var(--lr-color-brand)] - Click-ping border color.
 * @cssprop [--lr-browser-frame-ping-type-color=var(--lr-color-success)] - Type-ping border color.
 * @cssprop [--lr-browser-frame-ping-scroll-color=var(--lr-color-warning)] - Scroll-ping border
 *   color.
 * @cssprop [--lr-browser-frame-ping-move-color=var(--lr-color-text-quiet)] - Move-ping border
 *   color.
 * @status stable
 * @since 4.0.0
 */
export class LyraBrowserFrame extends LyraElement<LyraBrowserFrameEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    browserFrameControllerAgent: LYRA_DEFAULT_browserFrameControllerAgent,
    browserFrameControllerUser: LYRA_DEFAULT_browserFrameControllerUser,
    browserFrameHandBack: LYRA_DEFAULT_browserFrameHandBack,
    browserFrameLabel: LYRA_DEFAULT_browserFrameLabel,
    browserFramePingsLimit: LYRA_DEFAULT_browserFramePingsLimit,
    browserFrameStatusConnecting: LYRA_DEFAULT_browserFrameStatusConnecting,
    browserFrameStatusIdle: LYRA_DEFAULT_browserFrameStatusIdle,
    browserFrameStatusLive: LYRA_DEFAULT_browserFrameStatusLive,
    browserFrameStatusStalled: LYRA_DEFAULT_browserFrameStatusStalled,
    browserFrameStop: LYRA_DEFAULT_browserFrameStop,
    browserFrameTakeOver: LYRA_DEFAULT_browserFrameTakeOver,
    browserFrameUrlLabel: LYRA_DEFAULT_browserFrameUrlLabel,
    browserFrameViewOf: LYRA_DEFAULT_browserFrameViewOf,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['pings']);

  static override styles = [LyraElement.styles, styles, srOnly, agentActionButtonStyles];

  private _frameSrc = '';

  /** Source URL of the embedded page frame. An unsafe or empty value renders no frame. */
  @property({ attribute: 'frame-src' })
  get frameSrc(): string {
    return this._frameSrc;
  }
  set frameSrc(next: string) {
    const old = this._frameSrc;
    this._frameSrc = next ?? '';
    if (old === this._frameSrc) return;
    this.contentRect = null;
    this.requestUpdate('frameSrc', old);
  }

  /** Address text shown in the read-only address bar and used in the frame's accessible description. */
  @property({ useDefault: true }) url = '';
  private _phase: LyraStreamPhase = 'idle';

  /** The browser session's connection/streaming lifecycle phase. */
  @property({ reflect: true, converter: BROWSER_FRAME_PHASE })
  get phase(): LyraStreamPhase {
    return this._phase;
  }
  set phase(next: LyraStreamPhase) {
    const normalized = BROWSER_FRAME_PHASE.normalizeReflected(this, 'phase', next);
    const old = this._phase;
    if (old === normalized) return;
    this._phase = normalized;
    this.requestUpdate('phase', old);
  }
  private _controller: BrowserFrameController = 'agent';

  /** Who controls the session; any other value normalizes and reflects as `'agent'`. */
  @property({ reflect: true, converter: BROWSER_FRAME_CONTROLLER })
  get controller(): BrowserFrameController {
    return this._controller;
  }
  set controller(next: BrowserFrameController) {
    const old = this._controller;
    this._controller = BROWSER_FRAME_CONTROLLER.normalizeReflected(this, 'controller', next);
    this.requestUpdate('controller', old);
  }
  /** Pointer markers keyed by stable id. Empty/blank ids are omitted and duplicates normalize
   *  first-wins. Only the last 500 normalized entries are rendered. */
  @property({ attribute: false }) pings: readonly BrowserPing[] = [];
  /** Hides the built-in take-over/hand-back and stop buttons, for a read-only viewer. The
   *  `actions` slot still renders. */
  @property({ type: Boolean, attribute: 'without-controls', reflect: true }) withoutControls = false;

  private hasDefaultSlotContent = false;
  @query('slot:not([name])') private defaultSlot?: HTMLSlotElement;
  /** The measured `object-fit: contain` content box of the `frame-src` `<img>`, in pixels relative
   *  to `[part='viewport']` -- `null` until the image has loaded and the viewport has a real size
   *  (e.g. no `frameSrc`, or the default slot is in use instead). Pings fall back to plain
   *  percent-of-viewport when `null`. */
  @state() private contentRect: { left: number; top: number; width: number; height: number } | null = null;

  private viewportResizeObserver?: ResizeObserver;
  private viewportObserverDocument?: Document;
  private viewportObserverTarget?: Element;
  private viewportObserverGeneration = 0;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private suppressNextStatusAnnouncement = true;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reattached screenshot does not fire another load event.
    if (this.hasUpdated) {
      // Use the current status as the silent baseline on reconnect.
      this.suppressNextStatusAnnouncement = true;
      this.requestUpdate();
      this.observeViewport();
      this.recomputeContentRect();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetViewportObserver();
    this.suppressNextStatusAnnouncement = true;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption can happen while detached, without another disconnectedCallback.
    this.resetViewportObserver();
    this.announcements.adopted();
    this.suppressNextStatusAnnouncement = true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    this.seedFirstRenderState(() => {
      this.hasDefaultSlotContent = Array.from(this.children).some((el) => !el.getAttribute('slot'));
    });
    // The status shown at mount is context, not a user-triggered change. Later lifecycle
    // transitions are infrequent and useful, so announce each one as its own light-DOM addition.
    if (this.hasUpdated && !this.suppressNextStatusAnnouncement && changed.has('phase')) {
      this.announcements.announcePolite(this.localize(STATUS_KEY[this.phase]));
    }
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    this.suppressNextStatusAnnouncement = false;
    const notice = this.renderRoot.querySelector('[part="limit"]')?.textContent ?? '';
    this.announcements.transition('ping-limit', notice ? 'limited' : 'ready', notice, 'polite');
  }

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    // The initial slotchange may be absent. Seed outside Lit's update cycle.
    const slot = this.defaultSlot;
    queueMicrotask(() => {
      collectInitialSlotAssignment(slot, () => this.collectDefaultSlotContent());
    });
  }

  private observeViewport(): void {
    const viewport = this.renderRoot.querySelector('[part="viewport"]');
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected || !viewport) return;
    if (
      this.viewportResizeObserver &&
      this.viewportObserverDocument === ownerDocument &&
      this.viewportObserverTarget === viewport
    ) {
      return;
    }
    this.resetViewportObserver();
    const ResizeObserverCtor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    const generation = this.viewportObserverGeneration;
    const observer = new ResizeObserverCtor(() => {
      if (
        this.viewportResizeObserver !== observer ||
        this.viewportObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument ||
        this.viewportObserverTarget !== viewport
      ) {
        return;
      }
      this.recomputeContentRect();
    });
    this.viewportResizeObserver = observer;
    this.viewportObserverDocument = ownerDocument;
    this.viewportObserverTarget = viewport;
    observer.observe(viewport);
  }

  private resetViewportObserver(): void {
    this.viewportObserverGeneration += 1;
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = undefined;
    this.viewportObserverDocument = undefined;
    this.viewportObserverTarget = undefined;
  }

  private recomputeContentRect(): void {
    const viewport = this.renderRoot.querySelector('[part="viewport"]') as HTMLElement | null;
    const img = this.renderRoot.querySelector('[part="frame"]') as HTMLImageElement | null;
    if (!viewport || !img || !img.naturalWidth || !img.naturalHeight) {
      this.contentRect = null;
      return;
    }
    this.contentRect = containRect(viewport.clientWidth, viewport.clientHeight, img.naturalWidth, img.naturalHeight);
  }

  // The screenshot does not mirror under RTL, so its ping coordinates stay physical.
  /** Ping coordinates are agent-supplied data, so they are clamped to the documented 0-100 percent
   *  range and emitted through `styleMap` -- interpolating them into a declaration string would let
   *  a crafted `x` inject arbitrary declarations onto `[part="ping"]`, and a non-finite value would
   *  serialize as `left:NaN%`. */
  private pingStyle(ping: BrowserPing): ReturnType<typeof styleMap> {
    const x = finiteRange(ping.x, 0, 0, 100);
    const y = finiteRange(ping.y, 0, 0, 100);
    const rect = this.contentRect;
    if (!rect) return styleMap({ left: `${x}%`, top: `${y}%` });
    return styleMap({
      left: `${rect.left + (x / 100) * rect.width}px`,
      top: `${rect.top + (y / 100) * rect.height}px`,
    });
  }

  private onSlotChange = (): void => {
    this.collectDefaultSlotContent();
  };

  // A forwarding slot can transiently empty WebKit's assignedElements() snapshot.
  private collectDefaultSlotContent(): void {
    const next = Array.from(this.children).some((el) => !el.getAttribute('slot'));
    if (next !== this.hasDefaultSlotContent) {
      this.hasDefaultSlotContent = next;
      this.contentRect = null;
    } else {
      this.recomputeContentRect();
    }
    this.requestUpdate();
  }

  private onFrameLoad = (): void => {
    this.observeViewport();
    this.recomputeContentRect();
  };

  private onFrameError = (): void => {
    this.contentRect = null;
  };

  private onTakeOver = (): void => {
    const requested = this.controller === 'agent' ? 'user' : 'agent';
    this.emit('lr-take-over', { controller: requested });
  };

  override render(): TemplateResult {
    const safeSrc = safeMediaSrc(this.frameSrc);
    const pings = firstByIdentityMemo(this.pings, pingIdentity);
    return html`
      <div
        part="base"
        role=${overallSemanticRole(this, 'group') ?? nothing}
        aria-label=${overallSemanticLabel(this, this.localize('browserFrameLabel')) ?? nothing}
      >
        <div part="toolbar">
          <span class="sr-only">${this.localize('browserFrameUrlLabel')}</span>
          <span part="url" dir="ltr" title=${this.url}>${this.url}</span>
          <span part="status">${this.localize(STATUS_KEY[this.phase])}</span>
          <span part="controller-badge">
            ${this.localize(
              this.controller === 'agent' ? 'browserFrameControllerAgent' : 'browserFrameControllerUser',
            )}
          </span>
          <slot name="actions" part="actions"></slot>
          ${!this.withoutControls
            ? html`
                <button part="take-over-button" data-agent-action="neutral" type="button" @click=${this.onTakeOver}>
                  ${this.controller === 'user'
                    ? this.localize('browserFrameHandBack')
                    : this.localize('browserFrameTakeOver')}
                </button>
                <button part="stop-button" data-agent-action="neutral" type="button" @click=${() => this.emit('lr-stop')}>
                  ${this.localize('browserFrameStop')}
                </button>
              `
            : nothing}
        </div>
        <div part="viewport">
          <slot @slotchange=${this.onSlotChange}></slot>
          ${!this.renderSlotPresence(this.hasDefaultSlotContent) && safeSrc
            ? html`<img
                part="frame"
                src=${safeSrc}
                alt=${this.url.trim()
                  ? this.localize('browserFrameViewOf', undefined, { url: this.url })
                  : this.localize('browserFrameLabel')}
                @load=${this.onFrameLoad}
                @error=${this.onFrameError}
              />`
            : nothing}
          ${pings.slice(-MAX_RENDERED_PINGS).map(
            (ping) => html`<span
              part="ping"
              data-kind=${ping.kind}
              aria-hidden="true"
              style=${this.pingStyle(ping)}
            ></span>`,
          )}
        </div>
        ${pings.length > MAX_RENDERED_PINGS ? html`<p part="limit" role="note">${this.localize('browserFramePingsLimit', undefined, {
          count: this.formatLocaleNumber(MAX_RENDERED_PINGS),
        })}</p>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-browser-frame': LyraBrowserFrame;
  }
}
