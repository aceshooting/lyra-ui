import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { srOnly } from '../../internal/a11y.js';
import { safeFetchUrl, safeLinkHref, safeMediaSrc } from '../../internal/safe-url.js';
import { styles } from './document-preview.styles.js';

export type DocumentPreviewStatus = 'idle' | 'converting' | 'ready' | 'error';

/** What this component can render inline. Anything not `'text'`/`'image'`
 *  dispatches to `'generic'` — the download-or-`unsupported`-slot fallback —
 *  per this component's explicit scope: a minimal built-in dispatch, not a
 *  format registry. `lyra-code-block` (syntax-highlighted text) and any
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

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding
// document/download glyphs to that module -- it's off limits here -- so
// these one-off icons still read as part of the same visual language as the
// rest of the library's inline icons.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

/** A generic "document" glyph for the can't-preview-this fallback. Same
 *  shape as `<lyra-attachment-chip>`'s local `fileGlyph()` -- duplicated
 *  rather than imported (these are two independently consumable components)
 *  but kept visually identical so an unpreviewable-file affordance reads the
 *  same wherever it shows up in the library. */
function fileGlyph(): SVGTemplateResult {
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
    ><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
  `;
}

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
  'lyra-render-error': CustomEvent<{ error: unknown }>;
  'lyra-download': CustomEvent<{ src: string; filename: string }>;
}
/**
 * `<lyra-document-preview>` — a format-dispatching viewer for one document/
 * attachment, plus the visual state machine for an async server-side
 * conversion a host app runs in front of it.
 *
 * Format dispatch is intentionally minimal (see this family's scope
 * guidance): only `text/*`/`application/json` (plain, scrollable `<pre>` —
 * no syntax highlighting; compose `<lyra-code-block>` yourself via the
 * `unsupported` slot for that) and `image/*` (a contained `<img>`) render
 * inline. Everything else — PDF, office documents, video, audio, or any
 * unrecognized MIME type — falls back to a generic "can't preview this"
 * state: a file glyph, a short message, and (when `src` is set) a native
 * `<a download>` link. This is a deliberate ceiling, not a gap: this
 * component ships a dispatch *shell*, not a format registry. The
 * `unsupported` slot is the escape hatch for every format left out of the
 * built-in three — plug in a PDF.js viewer, an office-doc renderer, a
 * `<lyra-code-block>`, or anything else keyed off `mime-type` yourself.
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
 * counter guard `<lyra-tool-result-view>`'s `resolve()` uses, so a `src`
 * reassigned mid-fetch can't have a stale response clobber a newer one. A
 * failure here (network error, non-2xx response) renders inline via
 * `[part="error"]` and fires `lyra-render-error`, independently of the
 * host-owned `status` prop — mirrors `<lyra-markdown>`'s identical stance
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
 * `<lyra-live-region>`/`Announcer` — like `<lyra-typing-indicator>`'s
 * identical judgement call (see that component's class doc), this only ever
 * has one thing to announce (entering the state), not a rapidly-repeating
 * stream of updates, so the coalescing machinery a high-frequency component
 * needs would be pure overhead here. Once real `progress` is available, the
 * region becomes a standard `role="progressbar"` instead, which is
 * self-describing via `aria-valuenow` with no extra live-region wiring
 * needed. `status="error"` renders `[part="error"]` as `role="alert"` — an
 * assertive, one-shot failure notice, the same native-role shortcut
 * `<lyra-live-region>`'s own `mode="assertive"` maps to, without requiring
 * the announcer machinery here either.
 *
 * @customElement lyra-document-preview
 * @slot unsupported - Escape hatch: when populated, its content renders
 *   *instead of* the generic download fallback for any `mime-type` this
 *   component doesn't natively support (i.e. whenever format dispatch would
 *   otherwise fall through to "generic"). Ignored while `mime-type` resolves
 *   to `text`/`image` dispatch, or while `status` is `"converting"`/`"error"`.
 * @event lyra-download - `detail: { src, filename }` — fired when the safe
 *   generic-download fallback link is activated. The browser download itself
 *   needs no JS (a plain `<a download>` handles it); this is purely for a host
 *   that wants to observe/log the download.
 * @event lyra-render-error - `detail: { error }` — fired when this
 *   component's own `text/*`/`application/json` `fetch(src)` fails. Distinct
 *   from `status="error"`, which is entirely host-driven (see the class
 *   doc).
 * @csspart base - The root container.
 * @csspart header - The row above the body, holding `filename`. Hidden entirely when `filename` is unset.
 * @csspart filename - The filename text.
 * @csspart body - The wrapper around whichever content is currently showing (text/image preview, the generic fallback, the spinner, or the error message).
 * @csspart spinner - The converting/loading indicator — indeterminate (`role="status"`) or, once numeric progress is known, a determinate `role="progressbar"`. Used both for `status="converting"` and for this component's own in-flight text fetch.
 * @csspart error - The error message region (`role="alert"`) — used both for `status="error"` and for a failed text fetch.
 * @csspart download-link - The `<a download>` affordance in the generic fallback. Only rendered when `src` is set and safe for link navigation.
 */
export class LyraDocumentPreview extends LyraElement<LyraDocumentPreviewEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch (for `text`/`application/json`) or display (`image`, or as
   *  the generic fallback's download `href`). The value is validated against
   *  a sink-specific scheme allowlist before use. Optional — gracefully
   *  absent while, e.g., a conversion is still in progress. */
  @property() src = '';

  /** Drives format dispatch — see the class doc. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Shown in the header and used as the download link's suggested filename. */
  @property() filename = '';

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
   *  contract as `<lyra-json-viewer>`'s identically-named prop. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  @state() private hasUnsupportedSlot = false;
  @state() private textFetch: TextFetchState = IDLE_TEXT_FETCH;

  // Bumped on every fetchText() call so a stale in-flight fetch (superseded
  // by a newer src/mime-type/status before it settles) can detect it's no
  // longer current and skip writing its result over a more recent one --
  // same guard <lyra-tool-result-view>'s resolve() uses.
  private fetchGeneration = 0;

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasUnsupportedSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'unsupported');
    }

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
        !this.hasUpdated ||
        changed.has('src') ||
        changed.has('mimeType') ||
        (changed.has('status') && this.textFetch.kind === 'idle')
      ) {
        void this.fetchText(safeTextSrc);
      }
    } else if (this.textFetch.kind !== 'idle') {
      // No longer applicable (format changed away from text, src cleared,
      // or status moved to converting/error) -- invalidate any in-flight
      // fetch and drop the stale result so a later re-entry starts clean.
      this.fetchGeneration++;
      this.textFetch = IDLE_TEXT_FETCH;
    }
  }

  private async fetchText(url: string): Promise<void> {
    const generation = ++this.fetchGeneration;
    this.textFetch = { kind: 'loading' };
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await response.text();
      if (generation !== this.fetchGeneration) return;
      this.textFetch = { kind: 'loaded', text };
    } catch (error) {
      if (generation !== this.fetchGeneration) return;
      const message = error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad');
      this.textFetch = { kind: 'error', message };
      this.emit('lyra-render-error', { error });
    }
  }

  private onUnsupportedSlotChange = (e: Event): void => {
    this.hasUnsupportedSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onDownloadClick = (): void => {
    this.emit('lyra-download', { src: this.src, filename: this.filename });
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
      const clamped = Math.min(100, Math.max(0, progressValue));
      const rounded = Math.round(clamped);
      return html`
        <div
          part="spinner"
          role="progressbar"
          aria-valuenow=${rounded}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label=${label}
        >
          <span class="ring determinate" style=${`--lyra-document-preview-progress:${clamped}`}></span>
          <span class="spinner-text">${rounded}%</span>
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
    if (this.src === '') return html`<p class="empty-note">No document to display.</p>`;
    if (safeFetchUrl(this.src) === null) return this.renderError(this.localize('documentPreviewUrlNotAllowed'));
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
    if (this.src === '') return html`<p class="empty-note">No image to display.</p>`;
    const src = safeMediaSrc(this.src);
    if (src === null) return this.renderDownloadFallback();
    return html`<img src=${src} alt=${this.filename || this.localize('documentPreviewAlt')} />`;
  }

  private renderDownloadFallback(): TemplateResult {
    const label = this.filename || 'this file';
    const href = safeLinkHref(this.src);
    return html`
      <div class="fallback">
        <span class="fallback-icon" aria-hidden="true">${fileGlyph()}</span>
        <p class="fallback-text">Preview not available for ${label}.</p>
        ${href !== null
          ? html`
              <a
                part="download-link"
                href=${href}
                download=${this.filename || ''}
                @click=${this.onDownloadClick}
              >
                ${downloadIcon()}<span>Download</span>
              </a>
            `
          : nothing}
      </div>
    `;
  }

  /** The `<slot>` element renders unconditionally (not just while
   *  `hasUnsupportedSlot`) so a slot-assignment change is always observable
   *  via `slotchange` -- same reasoning as `<lyra-chat-message>`'s
   *  always-rendered optional slots. */
  private renderGenericFallback(): TemplateResult {
    return html`
      <slot name="unsupported" @slotchange=${this.onUnsupportedSlotChange}></slot>
      ${this.hasUnsupportedSlot ? nothing : this.renderDownloadFallback()}
    `;
  }

  private renderBody(): TemplateResult {
    if (this.status === 'converting') return this.renderSpinner('Converting document…', this.progress);
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

  render(): TemplateResult {
    return html`
      <div part="base" style=${this.maxHeight ? `--lyra-document-preview-max-height:${this.maxHeight}` : nothing}>
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
    'lyra-document-preview': LyraDocumentPreview;
  }
}
