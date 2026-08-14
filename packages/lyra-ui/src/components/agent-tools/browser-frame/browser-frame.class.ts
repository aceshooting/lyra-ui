import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './browser-frame.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { styleMap } from 'lit/directives/style-map.js';
import { finiteRange } from '../../../internal/numbers.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { overallSemanticLabel, overallSemanticRole } from '../semantic-owner.js';
import type { LyraStreamPhase } from '../../../internal/stream-phase.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_browserFrameControllerAgent, LYRA_DEFAULT_browserFrameControllerUser, LYRA_DEFAULT_browserFrameHandBack, LYRA_DEFAULT_browserFrameLabel, LYRA_DEFAULT_browserFrameStatusConnecting, LYRA_DEFAULT_browserFrameStatusIdle, LYRA_DEFAULT_browserFrameStatusLive, LYRA_DEFAULT_browserFrameStatusStalled, LYRA_DEFAULT_browserFrameStop, LYRA_DEFAULT_browserFrameTakeOver, LYRA_DEFAULT_browserFrameUrlLabel, LYRA_DEFAULT_browserFrameViewOf, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Mirrors `<lr-agent-run>`'s own
 *  `showCancel`/`showRetry` converter (`toAttribute` omits the attribute for `true` since nothing
 *  in this component's stylesheet keys off `[controls]`'s presence). */

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

export interface LyraBrowserFrameEventMap {
  'lr-take-over': CustomEvent<{ controller: BrowserFrameController }>;
  'lr-stop': CustomEvent<undefined>;
}

/**
 * `<lr-browser-frame>` — presentational "agent computer" viewport: a screenshot/frame stream (or
 * slotted live media), read-only URL display, action-ping overlays, and take-over/stop affordances.
 * No automation transport, no input relay — take-over is an event; the host swaps in its own
 * interactive element.
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
 * @csspart take-over-button - The take-over/hand-back button.
 * @csspart stop-button - The stop button.
 * @csspart viewport - The frame/media container.
 * @csspart frame - The `frame-src` `<img>` (absent once the default slot is populated).
 * @csspart ping - One action-ping marker; carries `data-kind`.
 * @cssprop [--lr-browser-frame-aspect-ratio=16 / 9] - The viewport's aspect ratio.
 * @cssprop [--lr-browser-frame-controller-background=var(--lr-color-brand-quiet)] - Controller
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
    browserFrameStatusConnecting: LYRA_DEFAULT_browserFrameStatusConnecting,
    browserFrameStatusIdle: LYRA_DEFAULT_browserFrameStatusIdle,
    browserFrameStatusLive: LYRA_DEFAULT_browserFrameStatusLive,
    browserFrameStatusStalled: LYRA_DEFAULT_browserFrameStatusStalled,
    browserFrameStop: LYRA_DEFAULT_browserFrameStop,
    browserFrameTakeOver: LYRA_DEFAULT_browserFrameTakeOver,
    browserFrameUrlLabel: LYRA_DEFAULT_browserFrameUrlLabel,
    browserFrameViewOf: LYRA_DEFAULT_browserFrameViewOf,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private _frameSrc = '';

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

  @property() url = '';
  /** The browser session's connection/streaming lifecycle phase. */
  @property({ reflect: true }) phase: LyraStreamPhase = 'idle';
  @property({ reflect: true }) controller: BrowserFrameController = 'agent';
  /** Pointer markers keyed by stable id. Duplicate ids normalize first-wins before rendering. */
  @property({ attribute: false }) pings: BrowserPing[] = [];
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) controls = true;

  private hasDefaultSlotContent = false;
  /** The measured `object-fit: contain` content box of the `frame-src` `<img>`, in pixels relative
   *  to `[part='viewport']` -- `null` until the image has loaded and the viewport has a real size
   *  (e.g. no `frameSrc`, or the default slot is in use instead). Pings fall back to plain
   *  percent-of-viewport when `null`. */
  @state() private contentRect: { left: number; top: number; width: number; height: number } | null = null;

  private viewportResizeObserver?: ResizeObserver;
  private viewportObserverDocument?: Document;
  private viewportObserverTarget?: Element;
  private viewportObserverGeneration = 0;
  private statusAnnouncementSink?: AnnouncementSink;
  private suppressNextStatusAnnouncement = true;

  private syncStatusAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.statusAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.statusAnnouncementSink?.release();
    this.statusAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Mount the light-DOM live region before any transition text arrives. Re-resolving the owner
    // document also makes adoption into an iframe announce where the component is now displayed.
    this.syncStatusAnnouncementSink();
    // The viewport observer is torn down on disconnect, and a reattached, already-rendered frame
    // <img> fires no new load event -- re-arm and re-measure here so the content rect keeps
    // tracking resizes after a move within the DOM.
    if (this.hasUpdated) {
      // Reconnect establishes the already-visible status as a new silent baseline. Lit keeps
      // updates running while detached, so a write queued between remove() and append() must not
      // become a fresh announcement merely because the sink was reacquired first.
      this.suppressNextStatusAnnouncement = true;
      this.requestUpdate();
      this.observeViewport();
      this.recomputeContentRect();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetViewportObserver();
    this.statusAnnouncementSink?.release();
    this.statusAnnouncementSink = undefined;
    this.suppressNextStatusAnnouncement = true;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption can happen while already detached, in which case no new disconnectedCallback runs.
    // Drop all old-realm resources here and let the next connectedCallback bind the destination.
    this.resetViewportObserver();
    this.statusAnnouncementSink?.release();
    this.statusAnnouncementSink = undefined;
    this.suppressNextStatusAnnouncement = true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // The status shown at mount is context, not a user-triggered change. Later lifecycle
    // transitions are infrequent and useful, so announce each one as its own light-DOM addition.
    if (this.hasUpdated && !this.suppressNextStatusAnnouncement && changed.has('phase')) {
      this.statusAnnouncementSink?.announce(this.localize(STATUS_KEY[this.phase]));
    }
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    this.suppressNextStatusAnnouncement = false;
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

  // Ping coordinates are physical percent-of-frame over a screenshot that never mirrors, so
  // position with physical left/top -- logical inset-inline-start would flip the markers under
  // RTL while the screenshot underneath stays put.
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

  private onSlotChange = (e: Event): void => {
    this.hasDefaultSlotContent = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    this.contentRect = null;
    this.requestUpdate();
  };

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
          ${this.controls
            ? html`
                <button part="take-over-button" type="button" @click=${this.onTakeOver}>
                  ${this.controller === 'user'
                    ? this.localize('browserFrameHandBack')
                    : this.localize('browserFrameTakeOver')}
                </button>
                <button part="stop-button" type="button" @click=${() => this.emit('lr-stop')}>
                  ${this.localize('browserFrameStop')}
                </button>
              `
            : nothing}
        </div>
        <div part="viewport">
          <slot @slotchange=${this.onSlotChange}></slot>
          ${!this.hasDefaultSlotContent && safeSrc
            ? html`<img
                part="frame"
                src=${safeSrc}
                alt=${this.localize('browserFrameViewOf', undefined, { url: this.url })}
                @load=${this.onFrameLoad}
                @error=${this.onFrameError}
              />`
            : nothing}
          ${firstByIdentity(Array.isArray(this.pings) ? this.pings : [], (ping) => ping.id).map(
            (ping) => html`<span
              part="ping"
              data-kind=${ping.kind}
              aria-hidden="true"
              style=${this.pingStyle(ping)}
            ></span>`,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-browser-frame': LyraBrowserFrame;
  }
}
