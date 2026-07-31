import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import {
  isAbortError,
  isResourceLimitError,
  readResponseText,
} from '../../../internal/resource-loader.js';
import { getIconLibrary, subscribeIconLibrary, type LyraIconLibrary } from './icon-library.js';
import { loadIconSanitizer } from './dompurify-loader.js';
import { styles } from './icon.styles.js';

const PATHS: Record<string, string> = {
  add: 'M12 5v14M5 12h14',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M18 6 6 18',
  search: 'm21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-down': 'm6 9 6 6 6-6',
  calendar: 'M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z',
  command: 'M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
};

/** An icon document is a handful of kilobytes; anything near this ceiling is not an icon, and the
 *  cap applies before a decoder or parser ever sees the bytes. */
const MAX_ICON_BYTES = 1024 * 1024;

/** Elements and attributes an icon legitimately needs, and nothing else. Scripting, event-handler
 *  attributes, and active URL schemes are all outside this profile. */
const SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  RETURN_DOM_FRAGMENT: true,
} as const;

/** Which side of a remote load failed, so the alert stays localized (and re-localizes when the
 *  locale changes) instead of freezing a resolved string into component state. */
type IconErrorReason = 'load' | 'too-large' | 'sanitizer';

type IconFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; node: SVGElement }
  | { kind: 'empty' }
  | { kind: 'error'; reason: IconErrorReason };

/** Mirroring direction for `flip`. Physical, not direction-relative — see `icon.styles.ts`. */
export type LyraIconFlip = 'horizontal' | 'vertical' | 'both';

export interface LyraIconEventMap {
  'lr-load': CustomEvent<{ src: string }>;
  'lr-error': CustomEvent<{ src: string; error: unknown }>;
}

/** `<lr-icon>` — an SVG icon primitive. Renders a built-in named path with no network access at
 * all, or resolves a name through a registered icon library, or fetches one SVG document from
 * `src`. Remote markup is byte-capped, sanitized with DOMPurify, and rendered only if the whole
 * pipeline succeeds; anything else fails closed with a localized alert and no partial markup.
 * @customElement lr-icon
 * @slot - Optional custom SVG/path content when no `name`, `path`, `library`, or `src` resolves.
 * @event lr-load - A remote icon finished loading and is in the DOM. `detail: { src }`.
 * @event lr-error - A remote icon could not be resolved, fetched, or sanitized.
 *   `detail: { src, error }`.
 * @csspart svg - The rendered SVG, whether built-in or fetched.
 * @csspart error - The visually hidden `role="alert"` shown when a remote icon fails.
 * @csspart empty - Marker rendered when a remote icon resolved to an empty but valid document.
 * @cssprop [--lr-icon-size=var(--lr-size-1-25rem)] - Inline and block size of the icon box.
 * @cssprop [--lr-icon-fixed-width=var(--lr-size-1-5rem)] - Inline size of the box while
 *   `fixed-width` is set; the glyph keeps `--lr-icon-size` and centers inside it.
 * @cssprop [--lr-icon-rotate=0deg] - Rotation applied to the box. Written inline from the `rotate`
 *   property, so set that rather than this property.
 * @cssprop [--lr-icon-flip-x=1] - Horizontal scale factor, set to `-1` by `flip`.
 * @cssprop [--lr-icon-flip-y=1] - Vertical scale factor, set to `-1` by `flip`.
 */
export class LyraIcon extends LyraElement<LyraIconEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];
  /** A built-in glyph name, or the name handed to the resolver of a registered `library`. */
  @property() name = '';
  /** Raw SVG path data, taking precedence over a built-in `name`. */
  @property() path = '';
  /** Accessible name. Empty (the default) leaves the icon `aria-hidden`. */
  @property() label = '';
  /** Name of a registered icon library. Empty (the default) means the built-in glyph set; an
   *  unregistered name also falls back to it, so registration can happen after first render. */
  @property({ reflect: true }) library = '';
  /** URL of a single SVG document to fetch, used when no registered library resolves `name`. */
  @property() src = '';
  /** Rotation in degrees, clockwise in both text directions. Left unset there is no rotation and
   *  no `transform` at all, so an ordinary icon never becomes a containing block. */
  @property({ type: Number, reflect: true }) rotate?: number;
  /** Mirrors the icon about the vertical (`horizontal`), horizontal (`vertical`), or both axes. */
  @property({ reflect: true }) flip?: LyraIconFlip;
  /** Widens the icon box to `--lr-icon-fixed-width` so a column of icons aligns its labels. */
  @property({ type: Boolean, reflect: true, attribute: 'fixed-width' }) fixedWidth = false;

  @state() private fetchState: IconFetchState = { kind: 'idle' };
  @query('svg') private svgEl?: SVGSVGElement;
  @query('slot') private customSlot?: HTMLSlotElement;
  private customContentObserver?: MutationObserver;
  private stopLibrarySubscription?: () => void;
  /** Bumped by every load start and by disconnect, and re-checked after every `await`, so a
   *  superseded response can never paint over a newer one. */
  private generation = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopLibrarySubscription ??= subscribeIconLibrary((name) => {
      if (name === this.library) void this.load();
    });
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (this.isConnected) this.syncCustomNodes();
      });
      if (this.remoteSource().url) this.scheduleAfterUpdate(() => void this.load());
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.stopLibrarySubscription?.();
    this.stopLibrarySubscription = undefined;
    this.customContentObserver?.disconnect();
    this.customContentObserver = undefined;
    // A detached icon holds no half-finished remote state; reconnecting re-resolves from scratch.
    // Assigning an equal-but-new state object would schedule an update while detached, and that
    // update re-clones slotted geometry the observer has deliberately stopped tracking.
    if (this.fetchState.kind !== 'idle') this.fetchState = { kind: 'idle' };
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rotate')) {
      const angle = finiteNumber(this.rotate ?? 0, 0);
      if (angle) this.style.setProperty('--lr-icon-rotate', `${angle}deg`);
      else this.style.removeProperty('--lr-icon-rotate');
    }
    this.applyRemoteA11y();
    this.syncCustomNodes();
    if (changed.has('src') || changed.has('library') || changed.has('name')) {
      this.scheduleAfterUpdate(() => void this.load());
    }
  }

  private onCustomSlotChange = (): void => {
    this.syncCustomNodes();
  };

  /**
   * SVG geometry distributed through a shadow-DOM slot does not paint reliably in Chromium when
   * the slot itself is inside an SVG. Keep the public custom-content slot, but clone its trusted
   * SVG nodes into the component-owned SVG so path/circle/group content has a real SVG parent.
   */
  private syncCustomNodes(): void {
    // Only the built-in render owns a slot; a fetched document is never merged with slotted nodes.
    if (this.fetchState.kind !== 'idle') return;
    const svgEl = this.svgEl;
    if (!svgEl) return;
    svgEl.querySelectorAll('[data-lr-custom-copy]').forEach((node) => node.remove());
    this.customContentObserver?.disconnect();

    const slot = this.customSlot;
    if (!slot) return;
    for (const node of slot.assignedNodes({ flatten: true })) {
      const copy = this.cloneSvgNode(node);
      if (!copy) continue;
      copy.setAttribute('data-lr-custom-copy', '');
      svgEl.append(copy);
    }
    this.observeCustomContent(slot);
  }

  private observeCustomContent(slot: HTMLSlotElement): void {
    this.customContentObserver?.disconnect();
    if (!this.isConnected) return;
    this.customContentObserver ??= new MutationObserver(() => {
      if (this.isConnected) this.syncCustomNodes();
    });
    for (const node of slot.assignedNodes({ flatten: true })) {
      if (node instanceof Element) {
        this.customContentObserver.observe(node, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }
    }
  }

  private cloneSvgNode(node: Node): SVGElement | null {
    if (!(node instanceof Element)) return null;
    // A hyphenated light-DOM child is a custom element, not an SVG primitive.
    // Creating it with the SVG namespace produces an inert node that can never
    // upgrade; skip it rather than silently changing its semantics.
    if (node.localName.includes('-')) return null;
    const copy = document.createElementNS('http://www.w3.org/2000/svg', node.localName);
    for (const attribute of node.attributes) {
      copy.setAttribute(attribute.name, attribute.value);
    }
    for (const child of node.childNodes) {
      const childCopy = this.cloneSvgNode(child);
      if (childCopy) copy.append(childCopy);
      else if (child.nodeType === Node.TEXT_NODE) copy.append(child.cloneNode(true));
    }
    return copy;
  }

  private accessibleLabel(): string {
    return this.getAttribute('aria-label') ?? this.label;
  }

  /**
   * The remote document this icon should show, if any. A registered `library` owns resolution for
   * its own names; otherwise `src` applies. An unregistered library name resolves to nothing here,
   * which is what lets the built-in glyph render until `registerIconLibrary()` arrives.
   */
  private remoteSource(): { url: string; library?: LyraIconLibrary; failed: boolean } {
    const library = this.library ? getIconLibrary(this.library) : undefined;
    if (this.name && library) {
      try {
        return { url: library.resolver(this.name) || '', library, failed: false };
      } catch {
        return { url: '', library, failed: true };
      }
    }
    return { url: this.src, failed: false };
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    const source = this.remoteSource();
    if (source.failed) {
      await this.fail('load', generation, this.name, new Error('icon library resolver threw'));
      return;
    }
    if (!source.url) {
      // Equal-but-new state objects are not equal to Lit, and every icon in the library reaches
      // this line on its first update — assigning unconditionally would cost every one of them a
      // second render (which also re-clones slotted geometry) for no change at all.
      if (this.fetchState.kind !== 'idle') this.fetchState = { kind: 'idle' };
      return;
    }
    const url = safeFetchUrl(source.url);
    if (!url) {
      await this.fail('load', generation, source.url, new Error('icon URL is not allowed'));
      return;
    }

    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const sanitizer = await loadIconSanitizer();
      if (!this.isConnected || generation !== this.generation) return;
      if (!sanitizer) {
        await this.fail('sanitizer', generation, url, new Error('dompurify is not installed'));
        return;
      }

      const raw = await readResponseText(response, MAX_ICON_BYTES);
      if (!this.isConnected || generation !== this.generation) return;
      if (raw.trim() === '') {
        // A valid response that simply has nothing to draw is not a failure.
        this.fetchState = { kind: 'empty' };
        await this.updateComplete;
        if (!this.isConnected || generation !== this.generation) return;
        this.emit('lr-load', { src: url });
        return;
      }

      // Sanitize straight into DOM nodes: serializing the sanitized result and re-parsing it is
      // the step mutation-XSS exploits, and nothing here needs the intermediate string.
      const fragment = sanitizer.sanitize(raw, SANITIZE_CONFIG) as DocumentFragment;
      const node = fragment.firstElementChild;
      if (!(node instanceof SVGSVGElement)) {
        await this.fail('load', generation, url, new Error('response is not an SVG document'));
        return;
      }
      // The mutator is trusted consumer code and runs on the already-sanitized, component-owned
      // node; a throwing mutator fails the load rather than rendering a half-adjusted icon.
      source.library?.mutator?.(node);

      this.fetchState = { kind: 'loaded', node };
      await this.updateComplete;
      if (!this.isConnected || generation !== this.generation) return;
      this.emit('lr-load', { src: url });
    } catch (error) {
      if (isAbortError(error)) return;
      await this.fail(isResourceLimitError(error) ? 'too-large' : 'load', generation, url, error);
    }
  }

  private async fail(
    reason: IconErrorReason,
    generation: number,
    src: string,
    error: unknown,
  ): Promise<void> {
    if (!this.isConnected || generation !== this.generation) return;
    this.fetchState = { kind: 'error', reason };
    await this.updateComplete;
    if (!this.isConnected || generation !== this.generation) return;
    this.emit('lr-error', { src, error });
  }

  private errorMessage(reason: IconErrorReason): string {
    if (reason === 'sanitizer') return this.localize('iconSanitizerMissing');
    if (reason === 'too-large') return this.localize('iconTooLarge');
    return this.localize('iconLoadError');
  }

  /** Applies the accessible-name contract to the fetched node, which Lit does not own and so
   *  cannot keep in sync through a template binding. */
  private applyRemoteA11y(): void {
    const state = this.fetchState;
    if (state.kind !== 'loaded') return;
    const label = this.accessibleLabel();
    state.node.setAttribute('part', 'svg');
    state.node.setAttribute('focusable', 'false');
    state.node.setAttribute('aria-hidden', label ? 'false' : 'true');
    if (label) state.node.setAttribute('aria-label', label);
    else state.node.removeAttribute('aria-label');
  }

  private renderBuiltIn(): TemplateResult {
    const path = this.path || PATHS[this.name] || '';
    const accessibleLabel = this.accessibleLabel();
    return html`<svg part="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${accessibleLabel ? 'false' : 'true'} aria-label=${accessibleLabel || nothing} focusable="false">${path ? svg`<path d=${path}></path>` : html`<slot @slotchange=${this.onCustomSlotChange}></slot>`}</svg>`;
  }

  override render(): TemplateResult {
    const state = this.fetchState;
    switch (state.kind) {
      case 'loaded':
        return html`${state.node}`;
      case 'error':
        return html`<span part="error" class="sr-only" role="alert">${this.errorMessage(state.reason)}</span>`;
      case 'empty':
        return html`<span part="empty" aria-hidden="true"></span>`;
      case 'loading':
        // Nothing is drawn while a remote icon resolves: a placeholder glyph would be a flash of
        // the wrong icon, and the box already holds its size.
        return html``;
      case 'idle':
      default:
        return this.renderBuiltIn();
    }
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon': LyraIcon; } }
