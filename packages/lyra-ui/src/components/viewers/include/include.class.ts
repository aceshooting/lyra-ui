import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import {
  isAbortError,
  resolveOwnerFetchTarget,
  type OwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import type { ResourceCacheLease } from '../../../internal/safe-resource-cache.js';
import { loadHtmlSanitizer } from '../html-viewer/dompurify-loader.js';
import {
  acquireSanitizedIncludeResource,
  IncludeResourceError,
  invalidateIncludeResource,
  MAX_INCLUDE_BYTES,
  type LyraIncludeMode,
} from './include-resource.js';
import { styles } from './include.styles.js';
import type { AnchorResultDetail, TextSelectDetail } from '../document-viewer/anchors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraIncludeMode } from './include-resource.js';

const VALID_MODES: ReadonlySet<string> = new Set<LyraIncludeMode>(['cors', 'no-cors', 'same-origin']);

/**
 * Why a `lr-include-error` fired instead of a successful `lr-load`:
 * - `'blocked-url'` — `src` failed the shared `safeFetchUrl()` scheme
 *   allowlist; `fetch()` was never called.
 * - `'network'` — `fetch()` itself rejected (DNS/CORS/connection failure).
 * - `'http'` — the fetch completed but the response was not `ok`.
 * - `'missing-sanitizer'` — the fetch succeeded but the optional `dompurify`
 *   peer failed to load, so the fragment could not be sanitized.
 * - `'resource-too-large'` — the source markup exceeded Include's 2 MiB
 *   size cap.
 * - `'missing-fragment'` — a requested same-page or remote fragment id was
 *   not present after sanitization.
 */
export type LyraIncludeErrorReason =
  | 'blocked-url'
  | 'network'
  | 'http'
  | 'missing-sanitizer'
  | 'resource-too-large'
  | 'missing-fragment';

/** The detail both spellings of Include's failure notification carry. */
export interface LyraIncludeErrorDetail {
  status: number;
  reason: LyraIncludeErrorReason;
  error?: unknown;
}

export interface LyraIncludeEventMap extends LyraTextViewerTargetEventMap {
  'lr-load': CustomEvent<{ src: string }>;
  'lr-include-error': CustomEvent<LyraIncludeErrorDetail>;
  /**
   * Shoelace spells this failure `sl-error` where Web Awesome spells it `wa-include-error`, so
   * both migrated spellings resolve here. Neither is deprecated.
   */
  'lr-error': CustomEvent<LyraIncludeErrorDetail>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

class LyraIncludeBase extends LyraElement<LyraIncludeEventMap> {}

interface SamePageIncludeSource {
  kind: 'same-page';
  fragment: string;
}

interface RemoteIncludeSource {
  kind: 'remote';
  url: string;
  fragment: string;
  owner: OwnerFetchTarget['view'];
}

type IncludeSource = SamePageIncludeSource | RemoteIncludeSource;

const ID_REFERENCE_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-labelledby',
  'aria-owns',
  'for',
  'form',
  'headers',
  'list',
] as const;

let nextClonePrefix = 0;

function decodedFragment(hash: string): string {
  const encoded = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function isTemplateElement(element: Element): element is HTMLTemplateElement {
  return element.localName === 'template' && 'content' in element;
}

function allElements(root: ParentNode): Element[] {
  const elements = [...root.querySelectorAll('*')];
  for (const template of elements.filter(isTemplateElement)) {
    elements.push(...allElements(template.content));
  }
  return elements;
}

function elementWithId(root: ParentNode, id: string): Element | null {
  for (const element of allElements(root)) {
    if (element.id === id) return element;
  }
  return null;
}

/**
 * `<lr-include>` loads an HTML fragment from `src` and transcludes it into
 * the page as sanitized light-DOM content, so the fragment participates in
 * the surrounding page's CSS cascade exactly like a native server-side
 * include — unlike `<lr-html-viewer>`, which renders a foreign document
 * inside an isolated preview card.
 *
 * Loaded markup always passes through the shared DOMPurify-backed
 * sanitizer (`loadHtmlSanitizer()`, the same loader `<lr-html-viewer>`
 * uses) before it ever touches `innerHTML` — there is no `allow-scripts`
 * escape hatch here, unlike the Web Awesome/Shoelace components this element
 * otherwise mirrors: their raw, unsanitized injection (with an opt-in to
 * actually re-execute embedded `<script>` tags) is incompatible with this
 * library's sanitize-always contract, so that option is simply omitted
 * rather than shipped as a documented no-op.
 * A `src` beginning with `#` clones the matching same-page element's children
 * without fetching. A remote URL may carry the same kind of fragment; the
 * fragmentless response is byte-capped and sanitized before the target is
 * selected. Cloned ids are rebased per instance so repeated includes do not
 * introduce duplicate document ids.
 *
 * `mode` deliberately defaults to `'same-origin'` rather than the `'cors'`
 * default those upstream components document — a same-origin-only fetch
 * fails closed unless a consumer explicitly opts in to cross-origin fetching
 * with `mode="cors"` (and the remote server cooperates via CORS headers).
 * `'no-cors'` is accepted for enum completeness but is rarely useful: it
 * always yields an opaque response (`status` `0`, unreadable body), a Fetch
 * API platform limitation rather than a bug here.
 *
 * A failure is announced twice under two names that always carry the same
 * detail object and always fire together: `lr-include-error` (Web Awesome
 * spells it `wa-include-error`) and `lr-error` (Shoelace spells it
 * `sl-error`, and it is the name every other Lyra component uses for a load
 * failure). The two upstreams disagree, so both spellings are supported and
 * neither is deprecated — listen to whichever one your migration produced.
 *
 * This is a deliberately bare transclusion primitive with no label/hint/
 * error chrome — its interaction idiom (silently swapping light-DOM content)
 * is incompatible with a generic label/hint/error frame. Listen for
 * `lr-include-error` to build your own error UI, and author meaningful
 * fallback content inside `<lr-include>` for when the source never
 * succeeds; that fallback (and any previously successful include) is left
 * untouched on failure. No live region wraps the slot either: the
 * fragment can contain its own landmarks and nested content, and forcing the
 * whole host into a live region would re-announce all of it on every load.
 *
 * No implicit ARIA role and no computed accessible name are applied around
 * the transcluded content — the fragment's own semantics (headings,
 * landmarks, its own `role`/`aria-*` attributes) surface directly and
 * unmodified, exactly as they would in a native include. The host carries an
 * explicit `aria-busy` state: `"true"` while a source is being loaded and
 * sanitized, and
 * `"false"` otherwise.
 *
 * @customElement lr-include
 * @slot - Fallback content shown until (or unless) a fetch succeeds; overwritten with the sanitized fragment once one does.
 * @event lr-load - The source fragment was sanitized and written into the light DOM.
 * @event lr-include-error - Loading, selecting, or sanitizing the fragment failed; see `LyraIncludeErrorReason` for `detail.reason`. Mirrors Web Awesome's `wa-include-error`.
 * @event lr-error - The same failure under the spelling Shoelace's `sl-error` migrates to; it always fires alongside `lr-include-error` with the identical detail object. Neither spelling is deprecated.
 * @event {CustomEvent<{ query: string; matchCount: number; activeIndex: number }>} lr-search-change -
 *   Fired whenever included-content search state changes. `detail: { query: string; matchCount:
 *   number; activeIndex: number }`. Bubbling, composed, and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   included content. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @csspart base - The non-layout (`display: contents`) wrapper around the default slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraInclude extends TextViewerTarget(LyraIncludeBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // `srOnly` keeps the anchor-target mixin's aria-hidden diagnostic mirror from painting as
  // visible body text beside the transcluded fragment. The spoken copy lives in light DOM.
  static override styles = [LyraElement.styles, styles, srOnly];

  /**
   * HTML fragment source. Remote URLs are validated through the shared
   * `safeFetchUrl()` allowlist (`http:`, `https:`, `blob:`, `data:`). Use
   * `#id` to clone a same-page source's children or `/partial.html#id` to
   * select children from a sanitized remote document.
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

  /** Shares bounded, sanitized remote resources with matching Include requests. Set to false to
   *  opt out of both retained values and in-flight deduplication. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter }) cache = true;

  /** Shared text search and anchor-target API for sanitized light-DOM includes. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }

  private generation = 0;
  private resourceLease?: ResourceCacheLease<string>;
  private readonly clonePrefix = `include-fragment-${++nextClonePrefix}`;

  protected textContentRoot(): Element | null {
    return this;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src') || changed.has('mode') || changed.has('cache')) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-busy', 'false');
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.releaseResourceLease();
    this.setAttribute('aria-busy', 'false');
    super.disconnectedCallback();
  }

  /** Invalidates this remote source's retained value and loads it again. Same-page fragments are
   *  simply cloned again from their current source DOM. */
  async reload(): Promise<void> {
    const source = this.resolveSource();
    if (source?.kind === 'remote') {
      invalidateIncludeResource(source.url, this.effectiveMode, source.owner);
    }
    await this.load();
  }

  private get effectiveMode(): LyraIncludeMode {
    return VALID_MODES.has(this.mode) ? this.mode : 'same-origin';
  }

  private resolveSource(): IncludeSource | null {
    const value = this.src.trim();
    if (!value) return null;
    if (value.startsWith('#')) {
      return { kind: 'same-page', fragment: decodedFragment(value) };
    }
    const target = resolveOwnerFetchTarget(this, value);
    if (!target) return null;
    try {
      const parsed = new target.view.URL(target.url);
      const fragment = decodedFragment(parsed.hash);
      parsed.hash = '';
      return { kind: 'remote', url: parsed.href, fragment, owner: target.view };
    } catch {
      return null;
    }
  }

  private releaseResourceLease(): void {
    this.resourceLease?.release();
    this.resourceLease = undefined;
  }

  private async sanitizeSamePage(
    source: Element,
    generation: number,
  ): Promise<string | null> {
    const markup = source.innerHTML;
    if (new TextEncoder().encode(markup).byteLength > MAX_INCLUDE_BYTES) {
      this.fail(0, 'resource-too-large');
      return null;
    }
    const sanitizer = await loadHtmlSanitizer();
    if (!this.isConnected || generation !== this.generation) return null;
    if (!sanitizer) {
      this.fail(0, 'missing-sanitizer');
      return null;
    }
    return String(sanitizer.sanitize(markup));
  }

  private fragmentFromSanitized(markup: string, fragmentId: string): DocumentFragment | null {
    const template = this.ownerDocument.createElement('template');
    template.innerHTML = markup;
    const output = this.ownerDocument.createDocumentFragment();

    if (fragmentId) {
      const target = elementWithId(template.content, fragmentId);
      if (!target) return null;
      const children =
        isTemplateElement(target) ? target.content.childNodes : target.childNodes;
      for (const child of children) output.append(child.cloneNode(true));
    } else {
      output.append(template.content.cloneNode(true));
    }

    this.rebaseFragmentIds(output);
    return output;
  }

  private rebaseFragmentIds(fragment: DocumentFragment): void {
    const idMap = new Map<string, string>();
    let index = 0;
    const elements = allElements(fragment);
    for (const element of elements) {
      if (!element.id) continue;
      const original = element.id;
      const next = `${this.clonePrefix}-${++index}`;
      if (!idMap.has(original)) idMap.set(original, next);
      element.id = next;
    }

    for (const element of elements) {
      for (const attribute of ID_REFERENCE_ATTRIBUTES) {
        if (!element.hasAttribute(attribute)) continue;
        const tokens = element.getAttribute(attribute)!.split(/\s+/).filter(Boolean);
        element.setAttribute(
          attribute,
          tokens.map((token) => idMap.get(token) ?? token).join(' '),
        );
      }
      for (const attribute of ['href', 'xlink:href'] as const) {
        const value = element.getAttribute(attribute);
        if (!value?.startsWith('#')) continue;
        const replacement = idMap.get(decodedFragment(value));
        if (replacement) element.setAttribute(attribute, `#${replacement}`);
      }
      for (const attribute of element.getAttributeNames()) {
        const value = element.getAttribute(attribute);
        if (!value?.includes('url(#')) continue;
        element.setAttribute(
          attribute,
          value.replace(/url\(#([^)]+)\)/g, (match, id: string) =>
            idMap.has(id) ? `url(#${idMap.get(id)})` : match,
          ),
        );
      }
    }
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.releaseResourceLease();
    // Unconditionally reset first: a superseded generation's in-flight fetch
    // may still be settling (as an aborted/rejected promise) after this new
    // generation starts, and none of its own early-return paths below touch
    // aria-busy, so a stale "true" from that generation must not survive
    // into this one. Re-set to 'true' just below if this generation actually
    // reaches the fetch.
    this.setAttribute('aria-busy', 'false');
    if (!this.src.trim()) return; // idle no-op: no fetch, no events, content untouched
    if (!this.isConnected) return;

    const source = this.resolveSource();
    if (!source) {
      this.emitError({ status: 0, reason: 'blocked-url' });
      return;
    }

    this.setAttribute('aria-busy', 'true');
    let lease: ResourceCacheLease<string> | undefined;
    try {
      let markup: string | null;
      let fragmentId = source.fragment;
      if (source.kind === 'same-page') {
        const target = this.ownerDocument.getElementById(source.fragment);
        if (!target) {
          this.fail(0, 'missing-fragment');
          return;
        }
        markup = await this.sanitizeSamePage(target, generation);
        fragmentId = '';
      } else {
        lease = acquireSanitizedIncludeResource(
          source.url,
          this.effectiveMode,
          this.cache,
          source.owner,
        );
        this.resourceLease = lease;
        markup = await lease.promise;
      }
      if (
        markup == null ||
        !this.isConnected ||
        generation !== this.generation ||
        (source.kind === 'remote' && this.ownerDocument.defaultView !== source.owner)
      ) return;

      const fragment = this.fragmentFromSanitized(markup, fragmentId);
      if (!fragment) {
        this.fail(0, 'missing-fragment');
        return;
      }
      if (
        generation !== this.generation ||
        !this.isConnected ||
        (source.kind === 'remote' && this.ownerDocument.defaultView !== source.owner)
      ) return;
      this.replaceChildren(fragment);
      // `innerHTML` is imperative light-DOM work and does not schedule a Lit update. The shared
      // text-viewer target observes loaded text during `updated()`, so explicitly invalidate it
      // to recompute any active search against the replacement fragment.
      this.requestUpdate();
      this.setAttribute('aria-busy', 'false');
      this.emit('lr-load', { src: this.src });
    } catch (error) {
      if (
        isAbortError(error) ||
        !this.isConnected ||
        generation !== this.generation ||
        (source.kind === 'remote' && this.ownerDocument.defaultView !== source.owner)
      ) return; // silent
      if (error instanceof IncludeResourceError) {
        this.fail(error.status, error.reason, error.cause ?? error);
      } else {
        this.fail(0, 'network', error);
      }
    } finally {
      if (this.resourceLease === lease) this.resourceLease = undefined;
      lease?.release();
    }
  }

  private fail(status: number, reason: LyraIncludeErrorReason, error?: unknown): void {
    this.setAttribute('aria-busy', 'false');
    this.emitError({ status, reason, error });
  }

  /**
   * Announces one failure under both supported spellings. The two upstreams disagree on the name
   * (`wa-include-error` vs `sl-error`), so a migrated listener finds whichever it was written
   * against; the *same* detail object is dispatched to both so a consumer reading `detail.reason`
   * cannot observe a difference between them.
   */
  private emitError(detail: LyraIncludeErrorDetail): void {
    this.emit('lr-include-error', detail);
    this.emit('lr-error', detail);
  }

  override render(): TemplateResult {
    return html`<span part="base"><slot></slot></span>${this.renderAnchorLiveRegion()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-include': LyraInclude;
  }
}
