import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, readResponseText } from '../../internal/resource-loader.js';
import { loadHtmlSanitizer } from '../html-viewer/dompurify-loader.js';
import { styles } from './include.styles.js';

/** `fetch()`'s `RequestMode` values this component accepts. */
export type LyraIncludeMode = 'cors' | 'no-cors' | 'same-origin';

const VALID_MODES: ReadonlySet<string> = new Set<LyraIncludeMode>(['cors', 'no-cors', 'same-origin']);

/**
 * Why a `lr-include-error` fired instead of a successful `lr-load`:
 * - `'blocked-url'` — `src` failed the shared `safeFetchUrl()` scheme
 *   allowlist; `fetch()` was never called.
 * - `'network'` — `fetch()` itself rejected (DNS/CORS/connection failure).
 * - `'http'` — the fetch completed but the response was not `ok`.
 * - `'missing-sanitizer'` — the fetch succeeded but the optional `dompurify`
 *   peer failed to load, so the fragment could not be sanitized.
 * - `'resource-too-large'` — the response body exceeded the shared resource
 *   loader's size cap.
 */
export type LyraIncludeErrorReason = 'blocked-url' | 'network' | 'http' | 'missing-sanitizer' | 'resource-too-large';

export interface LyraIncludeEventMap {
  'lr-load': CustomEvent<{ src: string }>;
  'lr-include-error': CustomEvent<{ status: number; reason: LyraIncludeErrorReason; error?: unknown }>;
}

/**
 * `<lr-include>` fetches an HTML fragment from `src` and transcludes it into
 * the page as sanitized light-DOM content, so the fragment participates in
 * the surrounding page's CSS cascade exactly like a native server-side
 * include — unlike `<lr-html-viewer>`, which renders a foreign document
 * inside an isolated preview card.
 *
 * The fetched markup always passes through the shared DOMPurify-backed
 * sanitizer (`loadHtmlSanitizer()`, the same loader `<lr-html-viewer>`
 * uses) before it ever touches `innerHTML` — there is no `allow-scripts`
 * escape hatch here, unlike the Web Awesome/Shoelace components this element
 * otherwise mirrors: their raw, unsanitized injection (with an opt-in to
 * actually re-execute embedded `<script>` tags) is incompatible with this
 * library's sanitize-always contract, so that option is simply omitted
 * rather than shipped as a documented no-op.
 *
 * `mode` deliberately defaults to `'same-origin'` rather than the `'cors'`
 * default those upstream components document — a same-origin-only fetch
 * fails closed unless a consumer explicitly opts in to cross-origin fetching
 * with `mode="cors"` (and the remote server cooperates via CORS headers).
 * `'no-cors'` is accepted for enum completeness but is rarely useful: it
 * always yields an opaque response (`status` `0`, unreadable body), a Fetch
 * API platform limitation rather than a bug here.
 *
 * This is a deliberately bare transclusion primitive with no label/hint/
 * error chrome — its interaction idiom (silently swapping light-DOM content)
 * is incompatible with a generic label/hint/error frame. Listen for
 * `lr-include-error` to build your own error UI, and author meaningful
 * fallback content inside `<lr-include>` for when the fetch never
 * succeeds; that fallback (and any previously successful include) is left
 * untouched on failure. No `aria-live` region wraps the slot either: the
 * fragment can contain its own landmarks and nested content, and forcing the
 * whole host into a live region would re-announce all of it on every load.
 *
 * No implicit ARIA role and no computed accessible name are applied around
 * the transcluded content — the fragment's own semantics (headings,
 * landmarks, its own `role`/`aria-*` attributes) surface directly and
 * unmodified, exactly as they would in a native include. `aria-busy="true"`
 * is set on the host while a fetch is in flight and removed once it settles,
 * whether it succeeds or fails.
 *
 * @customElement lr-include
 * @slot - Fallback content shown until (or unless) a fetch succeeds; overwritten with the sanitized fragment once one does.
 * @event lr-load - The fetched fragment was sanitized and written into the light DOM.
 * @event lr-include-error - Fetching or sanitizing the fragment failed; see `LyraIncludeErrorReason` for `detail.reason`.
 * @csspart base - The non-layout (`display: contents`) wrapper around the default slot.
 */
export class LyraInclude extends LyraElement<LyraIncludeEventMap> {
  static styles = [LyraElement.styles, styles];

  /**
   * URL of the HTML fragment to fetch, validated through the shared
   * `safeFetchUrl()` allowlist (`http:`, `https:`, `blob:`, `data:`).
   * An empty/falsy value is a no-op: no fetch, no events, existing content
   * untouched.
   */
  @property({ reflect: true }) src = '';

  /**
   * Forwarded to `fetch(url, { mode })`. Deliberately defaults to
   * `'same-origin'` rather than the `'cors'` default documented by the
   * Web Awesome/Shoelace components this element otherwise mirrors — a
   * consumer opts in to cross-origin fetching explicitly. An invalid/typo'd
   * attribute value is defensively normalized back to `'same-origin'`
   * rather than letting `fetch()` throw synchronously for an invalid
   * `RequestMode`.
   */
  @property({ reflect: true }) mode: LyraIncludeMode = 'same-origin';

  private generation = 0;

  protected updated(changed: PropertyValues): void {
    if (changed.has('src') || changed.has('mode')) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    // Unconditionally clear first: a superseded generation's in-flight fetch
    // may still be settling (as an aborted/rejected promise) after this new
    // generation starts, and none of its own early-return paths below touch
    // aria-busy, so a stale "true" from that generation must not survive
    // into this one. Re-set to 'true' just below if this generation actually
    // reaches the fetch.
    this.removeAttribute('aria-busy');
    if (!this.src) return; // idle no-op: no fetch, no events, content untouched

    const url = safeFetchUrl(this.src);
    if (!url) {
      this.emit('lr-include-error', { status: 0, reason: 'blocked-url' });
      return;
    }

    this.setAttribute('aria-busy', 'true');
    const mode = VALID_MODES.has(this.mode) ? this.mode : 'same-origin';
    try {
      const response = await fetch(url, signal ? { mode, signal } : { mode });
      if (!response.ok) {
        if (generation === this.generation) this.fail(response.status, 'http');
        return;
      }
      const sanitizer = await loadHtmlSanitizer();
      if (!sanitizer) {
        if (generation === this.generation) this.fail(0, 'missing-sanitizer');
        return;
      }
      const markup = sanitizer.sanitize(await readResponseText(response));
      if (generation !== this.generation || !this.isConnected) return; // superseded/detached — silent
      this.innerHTML = markup;
      this.removeAttribute('aria-busy');
      this.emit('lr-load', { src: this.src });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return; // silent
      this.fail(0, isResourceLimitError(error) ? 'resource-too-large' : 'network', error);
    }
  }

  private fail(status: number, reason: LyraIncludeErrorReason, error?: unknown): void {
    this.removeAttribute('aria-busy');
    this.emit('lr-include-error', { status, reason, error });
  }

  render(): TemplateResult {
    return html`<span part="base"><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-include': LyraInclude;
  }
}
