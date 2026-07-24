import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { fileIcon } from '../../../internal/icons.js';
import { srOnly } from '../../../internal/a11y.js';
import { safeDownloadHref, safeFetchUrl, safeMediaSrc } from '../../../internal/safe-url.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseText,
} from '../../../internal/resource-loader.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './document-preview.styles.js';
import type { LyraAnchor, LyraHighlight } from '../document-viewer/anchors.js';

export type DocumentPreviewStatus = 'idle' | 'converting' | 'ready' | 'error';

/** What this component can render inline. Anything not `'text'`/`'image'`
 *  dispatches to `'generic'` — the download-or-`unsupported`-slot fallback —
 *  per this component's explicit scope: a minimal built-in dispatch, not a
 *  format registry. `lr-code-block` (syntax-highlighted text) and any
 *  PDF/office-doc/video/audio renderer are deliberately out of scope; a
 *  consumer wanting one composes it via the `unsupported` slot instead. */
type PreviewFormat = 'text' | 'image' | 'generic';

/** Internal state for this component's own `fetch(src)` of a `text/*`/
 *  `application/json` document — a *different* async operation than the
 *  host-owned `status="converting"` conversion (see the class doc). */
type TextFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; text: string }
  | { kind: 'error'; message: string };

const IDLE_TEXT_FETCH: TextFetchState = { kind: 'idle' };

function classifyFormat(mimeType: string): PreviewFormat {
  const mt = mimeType.trim().toLowerCase();
  if (mt.startsWith('text/') || mt === 'application/json') return 'text';
  if (mt.startsWith('image/')) return 'image';
  return 'generic';
}

function sameRegionAnchor(a: LyraAnchor, b: LyraAnchor): boolean {
  if (a.kind !== 'region' || b.kind !== 'region') return false;
  return (
    a.page === b.page &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  );
}

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

/** A downward arrow into a tray -- the conventional "download" glyph. */
function downloadIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M12 3v12"></path>
    <polyline points="7 11 12 16 17 11"></polyline>
    <path d="M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
  `);
}

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

export interface LyraDocumentPreviewEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-download': CustomEvent<{ src: string; filename: string }>;
  'lr-highlight-activate': CustomEvent<{ id: string }>;
}
/**
 * `<lr-document-preview>` — a format-dispatching viewer for one document/
 * attachment, plus the visual state machine for an async server-side
 * conversion a host app runs in front of it.
 *
 * Format dispatch is intentionally minimal (see this family's scope
 * guidance): only `text/*`/`application/json` (plain, scrollable `<pre>` —
 * no syntax highlighting; compose `<lr-code-block>` yourself via the
 * `unsupported` slot for that) and `image/*` (a contained `<img>`) render
 * inline. Everything else — PDF, office documents, video, audio, or any
 * unrecognized MIME type — falls back to a generic "can't preview this"
 * state: a file glyph, a short message, and (when `src` is set) a native
 * `<a download>` link. This is a deliberate ceiling, not a gap: this
 * component ships a dispatch *shell*, not a format registry. The
 * `unsupported` slot is the escape hatch for every format left out of the
 * built-in three — plug in a PDF.js viewer, an office-doc renderer, a
 * `<lr-code-block>`, or anything else keyed off `mime-type` yourself.
 *
 * `status="converting"` is a second, independent axis from format dispatch.
 * This component does not know your backend's conversion API shape and
 * therefore owns none of the actual polling/fetch — a host that's converting
 * a non-natively-previewable format server-side (e.g. .docx → .pdf) polls
 * its own backend and updates `status`/`progress`/`src` here as that
 * proceeds. This component only *visualizes* that state: an indeterminate
 * spinner, or a determinate one once `progress` is supplied. Once the host
 * flips `status` to `"ready"` (typically alongside a new `src`/`mime-type`
 * pointing at the converted artifact), normal format dispatch resumes.
 *
 * The one piece of async work this component *does* own is fetching a
 * `text/*`/`application/json` `src` itself (there's no other way to get a
 * `<pre>`'s text content from a URL) — gated behind the same generation-
 * counter guard `<lr-tool-result-view>`'s `resolve()` uses, plus an
 * `AbortController`, so a `src` reassigned mid-fetch cancels the obsolete
 * request and can't have a stale response clobber a newer one. A
 * failure here (network error, non-2xx response) renders inline via
 * `[part="error"]` and fires `lr-render-error`, independently of the
 * host-owned `status` prop — mirrors `<lr-markdown>`'s identical stance
 * that a *rendering* failure and a host's own state machine are different
 * concerns.
 *
 * Every `src` is validated for the DOM/API sink that consumes it. Text
 * fetches and image sources allow relative URLs plus `http:`, `https:`,
 * `blob:`, and `data:`. Download links deliberately exclude `data:` because
 * following a `data:text/html` URL can create an active document. Unsafe or
 * malformed URLs never reach `fetch()`, an image `src`, or an anchor `href`;
 * they render a non-interactive fallback/error instead.
 *
 * Accessibility: the `"converting"` state (no numeric `progress`) is a
 * `role="status"` region wrapping a visually-hidden "Converting document…"
 * string. This is a *plain* static region, not routed through
 * `<lr-live-region>`/`Announcer` — like `<lr-typing-indicator>`'s
 * identical judgement call (see that component's class doc), this only ever
 * has one thing to announce (entering the state), not a rapidly-repeating
 * stream of updates, so the coalescing machinery a high-frequency component
 * needs would be pure overhead here. Once real `progress` is available, the
 * region becomes a standard `role="progressbar"` instead, which is
 * self-describing via `aria-valuenow` with no extra live-region wiring
 * needed. `status="error"` renders `[part="error"]` as `role="alert"` — an
 * assertive, one-shot failure notice, the same native-role shortcut
 * `<lr-live-region>`'s own `mode="assertive"` maps to, without requiring
 * the announcer machinery here either.
 *
 * @customElement lr-document-preview
 * @slot unsupported - Escape hatch: when populated, its content renders
 *   *instead of* the generic download fallback for any `mime-type` this
 *   component doesn't natively support (i.e. whenever format dispatch would
 *   otherwise fall through to "generic"). Ignored while `mime-type` resolves
 *   to `text`/`image` dispatch, or while `status` is `"converting"`/`"error"`.
 * @event lr-download - `detail: { src, filename }` — fired when the safe
 *   generic-download fallback link is activated. The browser download itself
 *   needs no JS (a plain `<a download>` handles it); this is purely for a host
 *   that wants to observe/log the download.
 * @event lr-render-error - `detail: { error }` — fired when this
 *   component's own `text/*`/`application/json` `fetch(src)` fails. Distinct
 *   from `status="error"`, which is entirely host-driven (see the class
 *   doc).
 * @event lr-highlight-activate - A region highlight was activated (image format only). `detail: { id }`.
 * @csspart base - The root container.
 * @csspart header - The row above the body, holding `filename`. Hidden entirely when `filename` is unset.
 * @csspart filename - The filename text.
 * @csspart body - The wrapper around whichever content is currently showing (text/image preview, the generic fallback, the spinner, or the error message).
 * @csspart spinner - The converting/loading indicator — indeterminate (`role="status"`) or, once numeric progress is known, a determinate `role="progressbar"`. Used both for `status="converting"` and for this component's own in-flight text fetch.
 * @csspart error - The error message region (`role="alert"`) — used both for `status="error"` and for a failed text fetch.
 * @csspart download-link - The `<a download>` affordance in the generic fallback. Only rendered when `src` is set and safe for link navigation.
 * @csspart frame-viewport - Forwarded from the internal `<lr-zoomable-frame>` when `zoomable` (image format only).
 * @csspart frame-content - Forwarded from the internal `<lr-zoomable-frame>` when `zoomable` (image format only).
 * @csspart frame-controls - Forwarded from the internal `<lr-zoomable-frame>` when `zoomable` (image format only).
 * @csspart frame-zoom-in - Forwarded from the internal `<lr-zoomable-frame>` when `zoomable` (image format only).
 * @csspart frame-zoom-out - Forwarded from the internal `<lr-zoomable-frame>` when `zoomable` (image format only).
 * @csspart frame-reset - Forwarded from the internal `<lr-zoomable-frame>` when `zoomable` (image format only).
 * @csspart highlight-layer - The wrapper around every rendered region highlight (image format only).
 * @csspart region-highlight - One region highlight (`data-tone`, `data-active`) (image format only).
 * @csspart region-highlight-target - Transparent activation geometry around a region highlight,
 *   with a minimum pointer/focus area independent of the visual rectangle (image format only).
 * @csspart highlight-actions - Non-overlapping actions used when multiple region highlights would
 *   otherwise create overlapping minimum hit areas (image format only).
 * @csspart region-highlight-action - One action in the non-overlapping highlight action list.
 * @cssprop [--lr-document-preview-max-height=none] - Maximum body block size before the preview scrolls internally.
 * @cssprop [--lr-document-preview-font=var(--lr-font-mono)] - Font used for plain-text previews.
 * @cssprop [--lr-document-preview-spin-duration=var(--lr-transition-ambient)] - Timing of one
 *   indeterminate loading-indicator rotation.
 * @cssprop [--lr-document-preview-progress=0] - Unitless 0-100 completion of the determinate
 *   loading ring (multiplied by `1%` in its conic gradient). Written inline by the component from
 *   the clamped `progress` value, so it is a read-out rather than a consumer knob.
 * @cssprop [--lr-document-preview-active-border=var(--lr-color-warning, var(--lr-color-brand))] -
 *   Border color of the `[part="region-highlight"]` matching `activeHighlightId` (image format
 *   only). Distinct from the resting highlight border.
 * @cssprop [--lr-document-preview-highlight-accent-color=var(--lr-color-brand)] - Accent highlight border and hover tint.
 * @cssprop [--lr-document-preview-highlight-success-color=var(--lr-color-success)] - Success highlight border and hover tint.
 * @cssprop [--lr-document-preview-highlight-warning-color=var(--lr-color-warning)] - Warning highlight border and hover tint.
 * @cssprop [--lr-document-preview-highlight-danger-color=var(--lr-color-danger)] - Danger highlight border and hover tint.
 * @cssprop [--lr-document-preview-highlight-neutral-color=var(--lr-color-neutral)] - Neutral highlight border and hover tint.
 */
export class LyraDocumentPreview extends LyraElement<LyraDocumentPreviewEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch (for `text`/`application/json`) or display (`image`, or as
   *  the generic fallback's download `href`). The value is validated against
   *  a sink-specific scheme allowlist before use. Optional — gracefully
   *  absent while, e.g., a conversion is still in progress. */
  @property() src = '';

  /** Drives format dispatch — see the class doc. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Shown in the header and used as the download link's suggested filename. */
  @property() filename = '';

  /** Alternative text for an image preview. When omitted, `filename` (or a
   * localized generic fallback) is used. Set this explicitly to an empty
   * string when the preview image is decorative. */
  @property() alt?: string;

  /** Host-owned lifecycle state. `"converting"` shows the spinner regardless
   *  of `mime-type`/`src`; `"error"` shows `errorMessage` regardless of
   *  either. `"idle"`/`"ready"` both resume normal format dispatch — this
   *  component doesn't require a host that has no conversion step to ever
   *  set `"ready"` explicitly. */
  @property({ reflect: true }) status: DocumentPreviewStatus = 'idle';

  /** 0-100. Only consulted while `status="converting"`. Unset (the default)
   *  renders the indeterminate spinner instead of a determinate progress bar. */
  @property({ type: Number }) progress?: number;

  /** Shown (via `[part="error"]`) while `status="error"`. */
  @property({ attribute: 'error-message' }) errorMessage = '';

  /** A CSS length (e.g. `"24rem"`); once set, `[part="body"]` scrolls
   *  internally past this height instead of growing the page — same
   *  contract as `<lr-json-viewer>`'s identically-named prop. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Wraps the rendered image (image format only) in an internal `<lr-zoomable-frame>`. `false`
   *  (the default) preserves today's exact DOM -- an inline thumbnail (e.g. in a chat stream) must
   *  not unexpectedly grow a focusable zoom-chrome viewport; an inspection surface opts in. */
  @property({ type: Boolean, reflect: true }) zoomable = false;

  /** Display-only region highlights over the image-format preview (see the class doc's format-
   *  dispatch scope -- text/generic formats never render these). */
  @property({ attribute: false }) highlights: LyraHighlight[] = [];
  @property({ attribute: 'active-highlight-id' }) activeHighlightId: string | null = null;
  readonly anchorKinds: LyraAnchor['kind'][] = ['region'];

  @state() private hasUnsupportedSlot = false;
  @state() private textFetch: TextFetchState = IDLE_TEXT_FETCH;
  /** Suppresses the generic fallback action when a composing shell owns the same download action. */
  @state() private suppressDownload = false;

  // Bumped on every fetchText() call so a stale in-flight fetch (superseded
  // by a newer src/mime-type/status before it settles) can detect it's no
  // longer current and skip writing its result over a more recent one --
  // same guard <lr-tool-result-view>'s resolve() uses.
  private generation = 0;
  private invalidUrlReportedFor: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.src && classifyFormat(this.mimeType) === 'text') {
      this.textFetch = IDLE_TEXT_FETCH;
      this.scheduleAfterUpdate(() => {
        const url = safeFetchUrl(this.src);
        if (url && this.status !== 'converting' && this.status !== 'error') void this.fetchText(url);
      });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.beginAbortableLoad();
    this.textFetch = IDLE_TEXT_FETCH;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasUnsupportedSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'unsupported');
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);

    const safeTextSrc = safeFetchUrl(this.src);
    const shouldFetchText =
      classifyFormat(this.mimeType) === 'text' &&
      safeTextSrc !== null &&
      this.status !== 'converting' &&
      this.status !== 'error';

    if (shouldFetchText) {
      // Refetch when the target itself changed, or when this just became
      // fetchable (e.g. a "converting" -> "ready" transition) and nothing
      // has been fetched yet -- but not on every unrelated property change.
      if (
        changed.has('src') ||
        changed.has('mimeType') ||
        (changed.has('status') && this.textFetch.kind === 'idle')
      ) {
        this.scheduleAfterUpdate(() => {
          void this.fetchText(safeTextSrc);
        });
      }
    } else if (this.textFetch.kind !== 'idle') {
      // No longer applicable (format changed away from text, src cleared,
      // or status moved to converting/error) -- abort any in-flight fetch
      // and drop the stale result so a later re-entry starts clean.
      this.generation++;
      this.beginAbortableLoad();
      this.textFetch = IDLE_TEXT_FETCH;
    }
  }

  private async fetchText(url: string): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.textFetch = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      this.textFetch = { kind: 'loaded', text };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      const message = this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.textFetch = { kind: 'error', message };
      this.emit('lr-render-error', { error });
    }
  }

  private onUnsupportedSlotChange = (e: Event): void => {
    this.hasUnsupportedSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onDownloadClick = (): void => {
    this.emit('lr-download', { src: this.src, filename: this.filename });
  };

  /** Renders `[part="spinner"]` -- indeterminate (`role="status"` + a
   *  visually-hidden label, per the class doc's accessibility note) when
   *  `progressValue` is absent, or a `role="progressbar"` once it's a finite
   *  0-100 number. Shared by the host-driven `"converting"` state and this
   *  component's own in-flight text fetch (which never has a numeric
   *  progress of its own to report). */
  private renderSpinner(label: string, progressValue?: number): TemplateResult {
    const hasProgress = progressValue != null && Number.isFinite(progressValue);
    if (hasProgress) {
      // The host-supplied `progress` property (passed in here as `progressValue`) is already
      // known finite at this point (`hasProgress` above), but an out-of-range override (e.g.
      // `progress="150"`) would otherwise render an invalid `aria-valuenow`/bar width --
      // finiteRange() clamps it into the documented 0-100 contract instead.
      const clamped = finiteRange(progressValue, 0, 0, 100);
      const rounded = Math.round(clamped);
      const formatted = getNumberFormat(this.effectiveLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(clamped / 100);
      return html`
        <div
          part="spinner"
          role="progressbar"
          aria-valuenow=${rounded}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label=${label}
        >
          <span class="ring determinate" style=${`--lr-document-preview-progress:${clamped}`}></span>
          <span class="spinner-text">${formatted}</span>
        </div>
      `;
    }
    return html`
      <div part="spinner" role="status">
        <span class="ring" aria-hidden="true"></span>
        <span class="sr-only">${label}</span>
      </div>
    `;
  }

  private renderError(message: string): TemplateResult {
    return html`<div part="error" role="alert">${message || this.localize('documentPreviewGenericError')}</div>`;
  }

  private renderTextPreview(): TemplateResult {
    if (this.src === '')
      return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    if (safeFetchUrl(this.src) === null) {
      if (this.invalidUrlReportedFor !== this.src) {
        this.invalidUrlReportedFor = this.src;
        this.scheduleAfterUpdate(() => {
          if (this.isConnected && this.invalidUrlReportedFor === this.src) {
            this.emit('lr-render-error', {
              error: new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed')),
            });
          }
        });
      }
      return this.renderError(this.localize('documentPreviewUrlNotAllowed'));
    }
    this.invalidUrlReportedFor = null;
    switch (this.textFetch.kind) {
      case 'loaded':
        return html`<pre class="text">${this.textFetch.text}</pre>`;
      case 'error':
        return this.renderError(this.textFetch.message);
      case 'loading':
      case 'idle':
      default:
        return this.renderSpinner(this.localize('loadingDocument'));
    }
  }

  private renderImagePreview(): TemplateResult {
    if (this.src === '')
      return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeImage') })}</p>`;
    const src = safeMediaSrc(this.src);
    if (src === null) return this.renderDownloadFallback();
    return this.renderZoomableWrapper(
      html`<img src=${src} alt=${this.alt ?? (this.filename || this.localize('documentPreviewAlt'))} />`,
    );
  }

  private stopZoomableFrameEvent(event: Event): void {
    event.stopPropagation();
  }

  /** Wraps `content` in the internal `<lr-zoomable-frame>` when `zoomable`; otherwise renders it
   *  (plus the highlight layer, which needs the same relatively-positioned sibling context either
   *  way) unwrapped, preserving pre-`zoomable` DOM exactly. Mirrors `<lr-svg-viewer>`'s identical
   *  helper. */
  private renderZoomableWrapper(content: TemplateResult): TemplateResult {
    const regionHighlights = this.regionHighlights();
    const inner = html`<div class="zoom-content">
      ${content}${this.renderHighlightLayer(regionHighlights, regionHighlights.length === 1)}
    </div>`;
    const frame = this.zoomable ? html`<lr-zoomable-frame
      exportparts="viewport:frame-viewport, content:frame-content, controls:frame-controls, zoom-in:frame-zoom-in, zoom-out:frame-zoom-out, reset:frame-reset"
      @lr-zoom-change=${this.stopZoomableFrameEvent}
    >${inner}</lr-zoomable-frame>` : inner;
    return html`${frame}${this.renderHighlightActions(regionHighlights)}`;
  }

  private regionHighlights(): Array<
    LyraHighlight & {
      anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } };
    }
  > {
    return this.highlights.filter(
      (h): h is LyraHighlight & { anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } } } =>
        h.anchor.kind === 'region',
    );
  }

  private renderHighlightLayer(
    regionHighlights: ReturnType<LyraDocumentPreview['regionHighlights']>,
    interactive: boolean,
  ): TemplateResult | typeof nothing {
    if (!regionHighlights.length) return nothing;
    // Region rects are physical percent-of-image coordinates and the previewed image never
    // mirrors, so position with physical left/top -- logical inset-inline-start would flip the
    // overlay under RTL while the image underneath stays put.
    return html`<div part="highlight-layer">
      ${regionHighlights.map(
        (h) => html`
          ${interactive ? html`<button
            part="region-highlight-target"
            data-highlight-id=${h.id}
            style="left:calc(${h.anchor.rect.x}% + ${h.anchor.rect.width / 2}%);
              top:calc(${h.anchor.rect.y}% + ${h.anchor.rect.height / 2}%);
              width:max(${h.anchor.rect.width}%, var(--lr-icon-button-size));
              height:max(${h.anchor.rect.height}%, var(--lr-icon-button-size))"
            type="button"
            role="button"
            aria-label=${h.label || this.localize('viewerHighlightLabel')}
            @click=${() => this.emit('lr-highlight-activate', { id: h.id })}
          ></button>` : nothing}
          <div
            part="region-highlight"
            data-id=${h.id}
            data-tone=${h.tone ?? 'accent'}
            ?data-active=${h.id === this.activeHighlightId}
            aria-hidden="true"
            style="left:${h.anchor.rect.x}%;top:${h.anchor.rect.y}%;width:${h.anchor.rect.width}%;height:${h.anchor.rect.height}%"
          ></div>
        `,
      )}
    </div>`;
  }

  private renderHighlightActions(
    regionHighlights: ReturnType<LyraDocumentPreview['regionHighlights']>,
  ): TemplateResult | typeof nothing {
    if (regionHighlights.length < 2) return nothing;
    return html`<div part="highlight-actions">
      ${regionHighlights.map((highlight) => html`
        <button
          part="region-highlight-action"
          type="button"
          data-highlight-id=${highlight.id}
          aria-label=${highlight.label || this.localize('viewerHighlightLabel')}
          @click=${() => this.emit('lr-highlight-activate', { id: highlight.id })}
        >
          ${highlight.label || this.localize('viewerHighlightLabel')}
        </button>
      `)}
    </div>`;
  }

  /** Scrolls a `region` highlight into view (image format only). See `<lr-svg-viewer>`'s
   *  identical method for the id/anchor-reference resolution and no-retry-loop rationale. */
  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    const highlight =
      typeof target === 'string'
        ? this.highlights.find((h) => h.id === target)
        : this.highlights.find((h) => h.anchor === target || sameRegionAnchor(h.anchor, target));
    const anchor = highlight?.anchor;
    const ready = classifyFormat(this.mimeType) === 'image' && safeMediaSrc(this.src) !== null;
    if (!highlight || !anchor || anchor.kind !== 'region' || !ready) return false;
    await this.updateComplete;
    const region = this.renderRoot.querySelector(
      `[part="region-highlight"][data-id="${CSS.escape(highlight.id)}"]`,
    );
    if (!region) return false;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    region.scrollIntoView({ behavior, block: 'center', inline: 'center' });
    return true;
  }

  private renderDownloadFallback(): TemplateResult {
    const label = this.filename || this.localize('documentPreviewGenericFile');
    const href = safeDownloadHref(this.src);
    return html`
      <div class="fallback">
        <span class="fallback-icon" aria-hidden="true">${fileIcon()}</span>
        <p class="fallback-text">${this.localize('documentPreviewNotAvailable', undefined, { label })}</p>
        ${href !== null && !this.suppressDownload
          ? html`
              <a
                part="download-link"
                href=${href}
                download=${this.filename || ''}
                @click=${this.onDownloadClick}
              >
                ${downloadIcon()}<span>${this.localize('download')}</span>
              </a>
            `
          : nothing}
      </div>
    `;
  }

  /** The `<slot>` element renders unconditionally (not just while
   *  `hasUnsupportedSlot`) so a slot-assignment change is always observable
   *  via `slotchange` -- same reasoning as `<lr-chat-message>`'s
   *  always-rendered optional slots. */
  private renderGenericFallback(): TemplateResult {
    return html`
      <slot name="unsupported" @slotchange=${this.onUnsupportedSlotChange}></slot>
      ${this.hasUnsupportedSlot ? nothing : this.renderDownloadFallback()}
    `;
  }

  private renderBody(): TemplateResult {
    if (this.status === 'converting')
      return this.renderSpinner(this.localize('convertingDocument'), this.progress);
    if (this.status === 'error') return this.renderError(this.errorMessage);

    switch (classifyFormat(this.mimeType)) {
      case 'text':
        return this.renderTextPreview();
      case 'image':
        return this.renderImagePreview();
      default:
        return this.renderGenericFallback();
    }
  }

  override render(): TemplateResult {
    return html`
      <div part="base" style=${this.maxHeight ? `--lr-document-preview-max-height:${this.maxHeight}` : nothing}>
        <div part="header" ?hidden=${!this.filename}>
          <span part="filename" title=${this.filename}>${this.filename}</span>
        </div>
        <div part="body">${this.renderBody()}</div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-document-preview': LyraDocumentPreview;
  }
}
