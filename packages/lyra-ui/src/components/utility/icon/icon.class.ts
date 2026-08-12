import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isAccessibilityVisible, srOnly } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { isUnsafeSvgCloneAttribute } from '../../../internal/safe-svg.js';
import { isAbortError, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import type { ResourceCacheLease } from '../../../internal/safe-resource-cache.js';
import { getIconLibrary, subscribeIconLibrary } from './icon-library.js';
import {
  acquireSanitizedIconResource,
  IconResourceError,
} from './icon-resource.js';
import { styles } from './icon.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_iconLoadError, LYRA_DEFAULT_iconSanitizerMissing, LYRA_DEFAULT_iconTooLarge } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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

/** Which side of a remote load failed, so the alert stays localized (and re-localizes when the
 *  locale changes) instead of freezing a resolved string into component state. */
type IconErrorReason = 'load' | 'too-large' | 'sanitizer';

type IconFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; node: SVGSVGElement }
  | { kind: 'empty' }
  | { kind: 'error'; reason: IconErrorReason };

/** Mirroring direction for `flip`. Physical, not direction-relative — see `icon.styles.ts`. */
export type LyraIconFlip = 'x' | 'y' | 'both' | 'horizontal' | 'vertical';

/** Sizing strategy for the icon's layout canvas. */
export type LyraIconCanvas = 'fixed' | 'auto' | 'square' | 'roomy';

/** Built-in motion treatments. Every treatment stops when reduced motion is requested. */
export type LyraIconAnimation =
  | 'beat'
  | 'fade'
  | 'beat-fade'
  | 'bounce'
  | 'flip'
  | 'flip-360'
  | 'shake'
  | 'spin'
  | 'spin-pulse'
  | 'spin-reverse'
  | 'spin-snap'
  | 'spin-snap-4'
  | 'spin-snap-8'
  | 'buzz'
  | 'wag'
  | 'float'
  | 'swing'
  | 'jello';

export interface LyraIconEventMap {
  'lr-load': CustomEvent<{ src: string }>;
  'lr-error': CustomEvent<{ src: string; error: unknown }>;
}

/** `<lr-icon>` — an SVG icon primitive. Renders a built-in named path with no network access at
 * all, or resolves a name through a registered icon library, or fetches one SVG document from
 * `src`. Remote markup is byte-capped, sanitized with DOMPurify, and rendered only if the whole
 * pipeline succeeds; anything else fails closed with a localized alert and no partial markup.
 * Matching loads share a bounded cache of canonical sanitized SVGs. Each instance deep-clones the
 * canonical node before its trusted library mutator runs, so cached state is never mutated.
 * @customElement lr-icon
 * @slot - Optional custom SVG/path content when no `name`, `path`, `library`, or `src` resolves.
 * @event lr-load - A remote icon finished loading and is in the DOM. `detail: { src }`.
 * @event lr-error - A remote icon could not be resolved, fetched, or sanitized.
 *   `detail: { src, error }`.
 * @csspart svg - The rendered SVG, whether built-in or fetched.
 * @csspart use - Every `<use>` element in the rendered SVG.
 * @csspart error - The visually hidden, `aria-hidden` mirror shown when a remote icon fails. The
 *   spoken error is appended to Lyra's shared assertive light-DOM announcement sink while the
 *   icon and its composed ancestors are exposed to the accessibility tree.
 * @csspart empty - Marker rendered when a remote icon resolved to an empty but valid document.
 * @cssprop [--lr-icon-size] - Optional inline and block size override for every canvas.
 * @cssprop [--lr-icon-fixed-width=var(--lr-size-1-5em)] - Inline size of the box while
 *   `fixed-width` is set; the glyph keeps `--lr-icon-size` and centers inside it.
 * @cssprop [--lr-icon-rotate=0deg] - Rotation applied to the box. Written inline from the `rotate`
 *   property, so set that rather than this property.
 * @cssprop [--lr-icon-flip-x=1] - Horizontal scale factor, set to `-1` by `flip`.
 * @cssprop [--lr-icon-flip-y=1] - Vertical scale factor, set to `-1` by `flip`.
 * @cssprop [--animation-delay=0s] - Delay before an icon animation starts.
 * @cssprop [--animation-direction=normal] - Playback direction for icon animations.
 * @cssprop [--animation-duration=var(--lr-duration-icon)] - Duration of one animation cycle.
 * @cssprop [--animation-iteration-count=infinite] - Number of animation cycles.
 * @cssprop [--animation-timing=var(--lr-easing-emphasized)] - Animation timing function.
 * @cssprop [--beat-fade-opacity=0.4] - Lowest opacity during `beat-fade`.
 * @cssprop [--beat-fade-scale=1.25] - Peak scale during `beat-fade`.
 * @cssprop [--beat-scale=1.25] - Scale multiplier for `beat` and `spin-pulse`.
 * @cssprop [--bounce-height=calc(var(--lr-size-0-5em)*-1)] - Peak bounce height.
 * @cssprop [--bounce-jump-scale-x=0.95] - Horizontal scale at the top of a bounce.
 * @cssprop [--bounce-jump-scale-y=1.05] - Vertical scale at the top of a bounce.
 * @cssprop [--bounce-land-scale-x=1.08] - Horizontal scale while landing.
 * @cssprop [--bounce-land-scale-y=0.92] - Vertical scale while landing.
 * @cssprop [--bounce-rebound=calc(var(--lr-size-1em)*-0.1)] - Landing rebound distance.
 * @cssprop [--bounce-start-scale-x=1] - Initial horizontal bounce scale.
 * @cssprop [--bounce-start-scale-y=1] - Initial vertical bounce scale.
 * @cssprop [--bounce-anticipation=0] - Downward offset before a bounce.
 * @cssprop [--fade-opacity=0.4] - Lowest opacity during `fade` and `spin-pulse`.
 * @cssprop [--flip-angle=180deg] - Rotation angle for flip treatments.
 * @cssprop [--flip-x=0] - X coordinate of the flip rotation axis.
 * @cssprop [--flip-y=1] - Y coordinate of the flip rotation axis.
 * @cssprop [--flip-z=0] - Z coordinate of the flip rotation axis.
 * @cssprop [--flip-anticipation-scale=0.9] - Wind-up scale before a flip.
 * @cssprop [--flip-overshoot=0deg] - Extra angle before a flip settles.
 * @cssprop [--buzz-distance=calc(var(--lr-size-1em)*0.12)] - Horizontal buzz travel.
 * @cssprop [--wag-angle=12deg] - Peak wag angle.
 * @cssprop [--swing-angle=15deg] - Peak swing angle.
 * @cssprop [--jello-scale-x=1.18] - Horizontal jello stretch.
 * @cssprop [--jello-scale-y=0.82] - Vertical jello stretch.
 * @cssprop [--float-height=calc(var(--lr-size-0-5em)*-1)] - Float rise height.
 * @cssprop [--float-drift=0] - Horizontal float drift.
 * @cssprop [--float-tilt=4deg] - Rotation at the float peak.
 * @cssprop [--float-squash-x=1.04] - Resting horizontal float scale.
 * @cssprop [--float-squash-y=0.96] - Resting vertical float scale.
 * @cssprop [--float-stretch-x=0.96] - Peak horizontal float scale.
 * @cssprop [--float-stretch-y=1.04] - Peak vertical float scale.
 * @cssprop [--primary-color=currentColor] - Primary duotone layer color.
 * @cssprop [--primary-opacity=1] - Primary duotone layer opacity.
 * @cssprop [--secondary-color=currentColor] - Secondary duotone layer color.
 * @cssprop [--secondary-opacity=0.4] - Secondary duotone layer opacity.
 * @status stable
 * @since 4.0.0
 */
export class LyraIcon extends LyraElement<LyraIconEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    iconLoadError: LYRA_DEFAULT_iconLoadError,
    iconSanitizerMissing: LYRA_DEFAULT_iconSanitizerMissing,
    iconTooLarge: LYRA_DEFAULT_iconTooLarge,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];
  private _name = '';
  /** A built-in glyph name, or the name handed to the resolver of a registered `library`.
   * Assigning `undefined`, as permitted by both pinned upstreams, clears the name. */
  @property({ reflect: true, useDefault: true })
  get name(): string {
    return this._name;
  }
  set name(value: string | undefined) {
    const old = this._name;
    this._name = value ?? '';
    this.requestUpdate('name', old);
  }
  /** Raw SVG path data, taking precedence over a built-in `name`. */
  @property() path = '';
  /** Accessible name. Empty (the default) leaves the icon `aria-hidden`. */
  @property() label = '';
  /** Name of a registered icon library. `default` means the built-in glyph set; an
   *  unregistered name also falls back to it, so registration can happen after first render. */
  @property({ reflect: true }) library = 'default';
  /** Family forwarded to a registered library resolver. Its vocabulary belongs to the library. */
  @property({ reflect: true, useDefault: true }) family = '';
  /** Variant forwarded to a registered library resolver. Its vocabulary belongs to the library. */
  @property({ reflect: true, useDefault: true }) variant = '';
  private _src = '';
  /** URL of a single SVG document to fetch, used when no registered library resolves `name`.
   * Assigning the upstream `undefined` spelling aborts/clears the pending source on update. */
  @property()
  get src(): string {
    return this._src;
  }
  set src(value: string | undefined) {
    const old = this._src;
    this._src = value ?? '';
    this.requestUpdate('src', old);
  }
  /** Rotation in degrees, clockwise in both text directions. The zero default does not reflect and
   *  produces no `transform`, so an ordinary icon never becomes a containing block. */
  @property({ type: Number, reflect: true, useDefault: true }) rotate = 0;
  /** Mirrors the icon about the vertical (`x`/`horizontal`), horizontal (`y`/`vertical`), or both axes. */
  @property({ reflect: true }) flip?: LyraIconFlip;
  /** Layout canvas. Unset/`fixed` is 1.25em × 1em; `auto` follows intrinsic width at 1em high;
   *  `square` is 1.25em × 1.25em; `roomy` is 1.5em × 1.5em. */
  @property({ reflect: true }) canvas?: LyraIconCanvas;
  /** Compatibility alias for `canvas="auto"`.
   * @deprecated Use `canvas="auto"` instead. */
  @property({ type: Boolean, reflect: true, attribute: 'auto-width' }) autoWidth = false;
  /** Swaps the primary and secondary opacity hooks used by duotone SVGs. */
  @property({ type: Boolean, reflect: true, attribute: 'swap-opacity' }) swapOpacity = false;
  /** Optional built-in motion treatment; all variants honor `prefers-reduced-motion`. */
  @property({ reflect: true }) animation?: LyraIconAnimation;
  /** Widens the icon box to `--lr-icon-fixed-width` so a column of icons aligns its labels. */
  @property({ type: Boolean, reflect: true, attribute: 'fixed-width' }) fixedWidth = false;

  @state() private fetchState: IconFetchState = { kind: 'idle' };
  @query('svg') private svgEl?: SVGSVGElement;
  @query('slot') private customSlot?: HTMLSlotElement;
  private customContentObserver?: MutationObserver;
  private stopLibrarySubscription?: () => void;
  private resourceLease?: ResourceCacheLease<SVGSVGElement | null>;
  private errorAnnouncementSink?: AnnouncementSink;
  /** Bumped by every load start and by disconnect, and re-checked after every `await`, so a
   *  superseded response can never paint over a newer one. */
  private generation = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    // Mount before a resolver/fetch can fail; creating the live region alongside its first message
    // is not reliably announced, and an adopted icon must target its current owner document.
    this.errorAnnouncementSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    this.stopLibrarySubscription ??= subscribeIconLibrary((name) => {
      if (name === this.library) void this.load();
    });
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (this.isConnected) this.syncCustomNodes();
      });
      if (this.hasRemoteSource()) this.scheduleAfterUpdate(() => void this.load());
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.releaseResourceLease();
    this.stopLibrarySubscription?.();
    this.stopLibrarySubscription = undefined;
    this.customContentObserver?.disconnect();
    this.customContentObserver = undefined;
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
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
    if (
      changed.has('src') ||
      changed.has('library') ||
      changed.has('name') ||
      changed.has('family') ||
      changed.has('variant')
    ) {
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
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.customContentObserver ??= new MutationObserverCtor(() => {
      if (this.isConnected) this.syncCustomNodes();
    });
    for (const node of slot.assignedNodes({ flatten: true })) {
      if (node.nodeType === 1) {
        this.customContentObserver.observe(node, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }
    }
  }

  private cloneSvgNode(node: Node): SVGElement | null {
    if (node.nodeType !== 1) return null;
    const element = node as Element;
    // A hyphenated light-DOM child is a custom element, not an SVG primitive.
    // Creating it with the SVG namespace produces an inert node that can never
    // upgrade; skip it rather than silently changing its semantics.
    if (element.localName.includes('-')) return null;
    const copy = this.ownerDocument.createElementNS(
      'http://www.w3.org/2000/svg',
      element.localName,
    );
    for (const attribute of element.attributes) {
      if (isUnsafeSvgCloneAttribute(attribute.name)) continue;
      copy.setAttribute(attribute.name, attribute.value);
    }
    for (const child of element.childNodes) {
      const childCopy = this.cloneSvgNode(child);
      if (childCopy) copy.append(childCopy);
      else if (child.nodeType === 3) {
        copy.append(this.ownerDocument.createTextNode(child.textContent ?? ''));
      }
    }
    return copy;
  }

  private accessibleLabel(): string {
    return this.getAttribute('aria-label') ?? this.label;
  }

  private hasRemoteSource(): boolean {
    return Boolean(
      this.src || (this.name && this.library && getIconLibrary(this.library)),
    );
  }

  private releaseResourceLease(): void {
    this.resourceLease?.release();
    this.resourceLease = undefined;
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.releaseResourceLease();
    const library = this.name && this.library ? getIconLibrary(this.library) : undefined;
    if (!library && !this.src) {
      // Equal-but-new state objects are not equal to Lit, and every icon in the library reaches
      // this line on its first update — assigning unconditionally would cost every one of them a
      // second render (which also re-clones slotted geometry) for no change at all.
      if (this.fetchState.kind !== 'idle') this.fetchState = { kind: 'idle' };
      return;
    }

    this.fetchState = { kind: 'loading' };
    let source = this.src;
    try {
      if (library) {
        source = await library.resolver(this.name, this.family, this.variant);
        if (!this.isConnected || generation !== this.generation) return;
        if (typeof source !== 'string') throw new TypeError('icon resolver did not return a URL');
      }
    } catch (error) {
      await this.fail('load', generation, this.name, error);
      return;
    }
    if (!source) {
      if (this.isConnected && generation === this.generation) this.fetchState = { kind: 'idle' };
      return;
    }

    const safeSource = safeFetchUrl(source);
    if (!safeSource) {
      await this.fail('load', generation, source, new Error('icon URL is not allowed'));
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, safeSource);
    if (!fetchTarget) {
      await this.fail('load', generation, safeSource, new Error('icon URL is not available'));
      return;
    }

    let lease: ResourceCacheLease<SVGSVGElement | null> | undefined;
    try {
      lease = acquireSanitizedIconResource(fetchTarget);
      this.resourceLease = lease;
      const canonical = await lease.promise;
      if (!this.isConnected || generation !== this.generation) return;
      if (!canonical) {
        // A valid response that simply has nothing to draw is not a failure.
        this.fetchState = { kind: 'empty' };
        await this.updateComplete;
        if (!this.isConnected || generation !== this.generation) return;
        this.emit('lr-load', { src: safeSource });
        return;
      }

      // The shared cache owns an immutable canonical sanitized node. Every instance gets a deep
      // clone before trusted library code may adjust it, so one mutator cannot poison another
      // library, a direct `src`, or a later cache hit.
      const node = this.ownerDocument.importNode(canonical, true) as SVGSVGElement;
      library?.mutator?.(node);

      this.fetchState = { kind: 'loaded', node };
      await this.updateComplete;
      if (!this.isConnected || generation !== this.generation) return;
      this.emit('lr-load', { src: safeSource });
    } catch (error) {
      if (isAbortError(error)) return;
      const reason = error instanceof IconResourceError ? error.reason : 'load';
      await this.fail(reason, generation, safeSource, error);
    } finally {
      if (this.resourceLease === lease) this.resourceLease = undefined;
      lease?.release();
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
    if (isAccessibilityVisible(this)) {
      this.errorAnnouncementSink?.announce(this.errorMessage(reason));
    }
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
    for (const use of state.node.querySelectorAll('use')) {
      const parts = new Set((use.getAttribute('part') ?? '').split(/\s+/).filter(Boolean));
      parts.add('use');
      use.setAttribute('part', [...parts].join(' '));
    }
  }

  /**
   * The custom-content slot is a *sibling* of the SVG, never a child of it. An HTML parser puts
   * every element inside `<svg>` into the SVG namespace, so a server-rendered `<slot>` there comes
   * back as an inert SVG element that assigns nothing and has no `assignedNodes()` at all — the
   * client-only DOM insertion Lit does is the only reason the nested spelling ever worked. Nothing
   * is lost by moving it out: slotted geometry never painted through the slot either way (see
   * `syncCustomNodes`, which clones it into the component-owned SVG), so the slot is purely an
   * assignment target and `icon.styles.ts` keeps it `display: none`.
   */
  private renderBuiltIn(): TemplateResult {
    const path = this.path || PATHS[this.name] || '';
    const accessibleLabel = this.accessibleLabel();
    return html`<svg part="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${accessibleLabel ? 'false' : 'true'} aria-label=${accessibleLabel || nothing} focusable="false">${path ? svg`<path d=${path}></path>` : nothing}</svg>${path ? nothing : html`<slot @slotchange=${this.onCustomSlotChange}></slot>`}`;
  }

  override render(): TemplateResult {
    const state = this.fetchState;
    switch (state.kind) {
      case 'loaded':
        return html`${state.node}`;
      case 'error':
        return html`<span part="error" class="sr-only" aria-hidden="true">${this.errorMessage(state.reason)}</span>`;
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
