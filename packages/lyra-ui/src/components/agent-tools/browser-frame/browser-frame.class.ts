import { html, nothing, type TemplateResult, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './browser-frame.styles.js';

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
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

export interface BrowserPing {
  id: string;
  x: number;
  y: number;
  kind: 'click' | 'type' | 'scroll' | 'move';
}

const STATUS_KEY = {
  idle: 'browserFrameStatusIdle',
  connecting: 'browserFrameStatusConnecting',
  streaming: 'browserFrameStatusLive',
  stalled: 'browserFrameStatusStalled',
} as const;

export interface LyraBrowserFrameEventMap {
  'lr-take-over': CustomEvent<{ controller: 'agent' | 'user' }>;
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
 * @csspart status - The visible status text (`role="status"`).
 * @csspart controller-badge - The current controller indicator.
 * @csspart actions - The `actions` slot wrapper.
 * @csspart take-over-button - The take-over/hand-back button.
 * @csspart stop-button - The stop button.
 * @csspart viewport - The frame/media container.
 * @csspart frame - The `frame-src` `<img>` (absent once the default slot is populated).
 * @csspart ping - One action-ping marker; carries `data-kind`.
 * @cssprop [--lr-browser-frame-aspect-ratio=16 / 9] - The viewport's aspect ratio.
 */
export class LyraBrowserFrame extends LyraElement<LyraBrowserFrameEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: 'frame-src' }) frameSrc = '';
  @property() url = '';
  @property({ reflect: true }) status: 'idle' | 'connecting' | 'streaming' | 'stalled' = 'idle';
  @property({ reflect: true }) controller: 'agent' | 'user' = 'agent';
  @property({ attribute: false }) pings: BrowserPing[] = [];
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) controls = true;

  private hasDefaultSlotContent = false;
  /** The measured `object-fit: contain` content box of the `frame-src` `<img>`, in pixels relative
   *  to `[part='viewport']` -- `null` until the image has loaded and the viewport has a real size
   *  (e.g. no `frameSrc`, or the default slot is in use instead). Pings fall back to plain
   *  percent-of-viewport when `null`. */
  @state() private contentRect: { left: number; top: number; width: number; height: number } | null = null;

  private viewportResizeObserver?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    // The viewport observer is torn down on disconnect, and a reattached, already-rendered frame
    // <img> fires no new load event -- re-arm and re-measure here so the content rect keeps
    // tracking resizes after a move within the DOM.
    if (this.hasUpdated) {
      this.observeViewport();
      this.recomputeContentRect();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = undefined;
  }

  private observeViewport(): void {
    const viewport = this.renderRoot.querySelector('[part="viewport"]');
    if (!viewport || this.viewportResizeObserver) return;
    this.viewportResizeObserver = new ResizeObserver(() => this.recomputeContentRect());
    this.viewportResizeObserver.observe(viewport);
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
  private pingStyle(ping: BrowserPing): string {
    const rect = this.contentRect;
    if (!rect) return `left:${ping.x}%;top:${ping.y}%`;
    const left = rect.left + (ping.x / 100) * rect.width;
    const top = rect.top + (ping.y / 100) * rect.height;
    return `left:${left}px;top:${top}px`;
  }

  private onSlotChange = (e: Event): void => {
    this.hasDefaultSlotContent = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    this.requestUpdate();
  };

  private onFrameLoad = (): void => {
    this.observeViewport();
    this.recomputeContentRect();
  };

  private onTakeOver = (): void => {
    const requested = this.controller === 'agent' ? 'user' : 'agent';
    this.emit('lr-take-over', { controller: requested });
  };

  render(): TemplateResult {
    const safeSrc = safeMediaSrc(this.frameSrc);
    return html`
      <div part="base" role="group" aria-label=${this.getAttribute('aria-label') || this.localize('browserFrameLabel')}>
        <div part="toolbar">
          <span class="sr-only">${this.localize('browserFrameUrlLabel')}</span>
          <span part="url" dir="ltr" title=${this.url}>${this.url}</span>
          <span part="status" role="status">${this.localize(STATUS_KEY[this.status])}</span>
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
              />`
            : nothing}
          ${this.pings.map(
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
