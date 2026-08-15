import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { finiteRange } from '../../../internal/numbers.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { safeDownloadHref } from '../../../internal/safe-url.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { styles } from './zoomable-frame.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_zoomControls, LYRA_DEFAULT_zoomIn, LYRA_DEFAULT_zoomOut, LYRA_DEFAULT_zoomableFrameLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraZoomableFrameLoading = 'eager' | 'lazy';

const DEFAULT_ZOOM_LEVELS = '25% 50% 75% 100% 125% 150% 175% 200%';
const DEFAULT_IFRAME_SANDBOX = 'allow-same-origin';

const DEFAULT_ZOOM_LEVEL_VALUES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 1000;
// `zoomLevels` is consulted by render state and every zoom action. Bound both source scanning and
// numeric conversion before sorting, then memoize the result per component instance.
const MAX_ZOOM_LEVEL_SOURCE_CODE_UNITS = 16_384;
const MAX_ZOOM_LEVEL_TOKENS = 256;

const SANDBOX_TOKENS = new Set([
  'allow-downloads',
  'allow-forms',
  'allow-modals',
  'allow-orientation-lock',
  'allow-pointer-lock',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
  'allow-storage-access-by-user-activation',
  'allow-top-navigation',
  'allow-top-navigation-by-user-activation',
  'allow-top-navigation-to-custom-protocols',
]);

const REFERRER_POLICIES = new Set<ReferrerPolicy>([
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
]);

const THEME_ATTRIBUTES = ['data-lr-theme', 'data-theme', 'data-color-scheme'] as const;

interface ThemeClassMutation {
  original: boolean;
  applied: boolean;
}

interface ThemeAttributeMutation {
  original: string | null;
  applied: string | null;
}

interface ThemeStyleMutation {
  original: string;
  originalPriority: string;
  applied: string;
  appliedPriority: string;
}

interface ThemeSyncState {
  target: HTMLElement;
  classes: Map<string, ThemeClassMutation>;
  attributes: Map<(typeof THEME_ATTRIBUTES)[number], ThemeAttributeMutation>;
  properties: Map<string, ThemeStyleMutation>;
}

function isLyraThemeClass(value: string): boolean {
  return value === 'lr-light' || value === 'lr-dark' ||
    value.startsWith('lr-theme-') || value.startsWith('lr-brand-') || value.startsWith('lr-palette-');
}

/** Returns a URL suitable for active iframe navigation, or `null` when the scheme is unsafe.
 * Unlike media sinks, iframe navigation deliberately rejects `data:` because it creates an active
 * document. `mailto:` and other navigation-only schemes are rejected as non-embeddable too. */
function safeZoomableFrameSrc(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().toLowerCase() === 'about:blank') return value.trim();
  return safeDownloadHref(value);
}

/** Normalizes the sandbox token list without ever dropping the `sandbox` attribute itself.
 * Unknown tokens are omitted. The dangerous `allow-scripts allow-same-origin` pair is narrowed by
 * dropping `allow-same-origin`, preventing same-origin framed code from removing its own sandbox. */
function safeZoomableFrameSandbox(value: unknown): string {
  if (typeof value !== 'string') return '';
  const tokens = [...new Set(value.toLowerCase().split(/\s+/).filter(token => SANDBOX_TOKENS.has(token)))];
  if (tokens.includes('allow-scripts') && tokens.includes('allow-same-origin')) {
    return tokens.filter(token => token !== 'allow-same-origin').join(' ');
  }
  return tokens.join(' ');
}

function safeLoading(value: unknown): LyraZoomableFrameLoading {
  return value === 'lazy' ? 'lazy' : 'eager';
}

function safeReferrerPolicy(value: unknown): ReferrerPolicy | null {
  if (value === '' || value == null) return null;
  return typeof value === 'string' && REFERRER_POLICIES.has(value as ReferrerPolicy)
    ? value as ReferrerPolicy
    : 'no-referrer';
}

function parseZoomLevels(value: unknown): readonly number[] {
  if (typeof value !== 'string') return DEFAULT_ZOOM_LEVEL_VALUES;
  const source = value.slice(0, MAX_ZOOM_LEVEL_SOURCE_CODE_UNITS);
  const finalTokenContinues = value.length > MAX_ZOOM_LEVEL_SOURCE_CODE_UNITS &&
    /\S/u.test(source.at(-1) ?? '') && /\S/u.test(value[MAX_ZOOM_LEVEL_SOURCE_CODE_UNITS] ?? '');
  const tokenPattern = /\S+/g;
  const unique = new Set<number>();
  let tokenCount = 0;
  let match: RegExpExecArray | null;
  while (tokenCount < MAX_ZOOM_LEVEL_TOKENS && (match = tokenPattern.exec(source)) !== null) {
    // Never reinterpret a token whose suffix lies outside the admitted source prefix. For example,
    // cutting `200%` after `200` must not turn a 2× stop into a 200× stop.
    if (finalTokenContinues && tokenPattern.lastIndex === source.length) break;
    tokenCount += 1;
    const token = match[0];
    const percent = token.endsWith('%');
    const parsed = Number(percent ? token.slice(0, -1) : token);
    const level = percent ? parsed / 100 : parsed;
    if (Number.isFinite(level) && level >= MIN_ZOOM && level <= MAX_ZOOM) unique.add(level);
  }
  if (unique.size === 0) return DEFAULT_ZOOM_LEVEL_VALUES;
  return Object.freeze([...unique].sort((left, right) => left - right));
}

export interface LyraZoomableFrameEventMap {
  load: Event;
  error: Event;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<null>;
  'lr-focus': CustomEvent<null>;
}

/**
 * `<lr-zoomable-frame>` — a sandboxed iframe preview with discrete zoom controls. Its public
 * surface mirrors Web Awesome's `wa-zoomable-frame`; Lyra's former slotted/image inspection
 * surface now lives at `<lr-pan-zoom>`.
 *
 * Security defaults are deliberately restrictive: iframe navigation accepts only relative,
 * `http:`, `https:`, `blob:`, and exact `about:blank` URLs; the iframe always carries a sandbox; and the default
 * `allow-same-origin` token supports same-origin `contentDocument`/theme synchronization while
 * scripts, forms, popups, downloads, and top navigation remain blocked. Consumer-provided sandbox
 * tokens are allowlisted, and `allow-scripts` is never combined with `allow-same-origin`.
 *
 * The scaled iframe is a physical pixel canvas, so its origin stays at physical top-left in both
 * directions. The zoom toolbar remains logical interface chrome and therefore appears at inline-end
 * (physical left in RTL).
 * `withoutInteraction` makes the browsing context genuinely unavailable: the iframe is native
 * `inert`, leaves sequential focus, refuses pointer and programmatic activation, and carries no
 * unsupported `aria-disabled` claim. Focus entry through Tab, pointer, or `focus()` is tracked on
 * the host as `data-frame-focused` so the shared focus ring remains visible across the browsing-
 * context boundary.
 *
 * @customElement lr-zoomable-frame
 * @slot zoom-in-icon - Override for the decorative zoom-in glyph. Its flattened subtree is inert
 *   and hidden from assistive technology; the native zoom-in button remains the sole action.
 * @slot zoom-out-icon - Override for the decorative zoom-out glyph. Its flattened subtree is inert
 *   and hidden from assistive technology; the native zoom-out button remains the sole action.
 * @event load - Relayed native iframe load event; non-bubbling and non-composed.
 * @event error - Relayed native iframe error event; non-bubbling and non-composed.
 * @event {FocusEvent} focus - Relayed once from the internal iframe as a bubbling, composed native
 *   event.
 * @event {FocusEvent} blur - Relayed once from the internal iframe as a bubbling, composed native
 *   event.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @csspart iframe - The internal `<iframe>` element.
 * @csspart controls - The zoom-controls toolbar.
 * @csspart zoom-in-button - The zoom-in button.
 * @csspart zoom-out-button - The zoom-out button.
 * @cssprop [--lr-zoomable-frame-control-hover-background=var(--lr-color-brand-quiet)] - Zoom
 *   control hover background; its active background derives from the same value.
 * @cssprop [--lr-zoomable-frame-zoom=1] - Read-only resolved iframe scale written from `zoom`.
 * @status stable
 * @since 4.0.0
 */
export class LyraZoomableFrame extends LyraElement<LyraZoomableFrameEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    zoomControls: LYRA_DEFAULT_zoomControls,
    zoomIn: LYRA_DEFAULT_zoomIn,
    zoomOut: LYRA_DEFAULT_zoomOut,
    zoomableFrameLabel: LYRA_DEFAULT_zoomableFrameLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The URL of the content to display. Active/non-embeddable schemes are rejected. */
  @property() src = '';
  /** Inline HTML to display. A present `srcdoc` wins over `src`, including an empty attribute. */
  @property() srcdoc = '';
  /** Forwards the native fullscreen opt-in to the iframe. */
  @property({ type: Boolean }) allowfullscreen = false;
  /** Controls native iframe loading behavior. Invalid runtime values fall back to `eager`. */
  @property() loading: LyraZoomableFrameLoading = 'eager';
  /** Native iframe referrer policy. Invalid non-empty values fail closed to `no-referrer`. */
  @property() referrerpolicy = '';
  /** Iframe sandbox tokens. The attribute is always rendered; the script/same-origin pair is
   * narrowed to scripts in a unique origin. */
  @property() sandbox = DEFAULT_IFRAME_SANDBOX;
  /** Current iframe scale. Programmatic values need not appear in `zoomLevels`. */
  @property({ type: Number, reflect: true }) zoom = 1;
  /** Space-separated decimal and percentage stops used only by `zoomIn()`/`zoomOut()`. The
   * normalized projection reads at most 16,384 UTF-16 code units and 256 whitespace-delimited
   * tokens, ignores a token cut by the source ceiling, and is cached until this string changes. */
  @property({ attribute: 'zoom-levels' }) zoomLevels = DEFAULT_ZOOM_LEVELS;
  /** Removes the zoom toolbar. */
  @property({ type: Boolean, attribute: 'without-controls', reflect: true }) withoutControls = false;
  /** Removes the iframe from sequential focus and disables pointer interaction. */
  @property({ type: Boolean, attribute: 'without-interaction', reflect: true }) withoutInteraction = false;
  /** Best-effort sync of Lyra theme classes, attributes, and `--lr-theme-*` values into a
   * same-origin iframe document. Turning it off restores only the iframe state this component
   * changed; cross-origin access remains untouched. */
  @property({ type: Boolean, attribute: 'with-theme-sync', reflect: true }) withThemeSync = false;
  /** Accessible-name input. A declarative `aria-label` remains on the host while the iframe keeps
   * a localized purpose title; a property-only value names the iframe. An explicitly empty host
   * name is preserved as an empty iframe title instead of being replaced through truthiness. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** The internal iframe. Readonly by convention; replaced whenever navigation policy changes. */
  @query('iframe') iframe?: HTMLIFrameElement;

  private cachedZoomLevelsSource: unknown = Symbol('uncached zoom levels');
  private cachedZoomLevels: readonly number[] = DEFAULT_ZOOM_LEVEL_VALUES;

  /** Focus the internal iframe when interaction is enabled and a live frame is connected. */
  override focus(options?: FocusOptions): void {
    const frame = this.iframe;
    if (!frame || !this.isConnected || this.withoutInteraction || frame.inert) return;
    const previous = this.ownerDocument.activeElement;
    const wasFocused = this.frameOwnsFocus(frame);
    frame.focus(options);
    if (!wasFocused && this.frameOwnsFocus(frame)) this.emitHostFocus(undefined, previous);
  }

  /** Blur the internal iframe. */
  override blur(): void {
    const frame = this.iframe;
    if (!frame || !this.frameOwnsFocus(frame)) return;
    frame.blur();
    if (!this.frameOwnsFocus(frame)) this.emitHostBlur(undefined, this.ownerDocument.activeElement);
  }

  /** Activate the internal iframe only while interaction is enabled. */
  override click(): void {
    if (this.isConnected && !this.withoutInteraction && !this.iframe?.inert) this.iframe?.click();
  }

  // Bound to focusin/focusout rather than focus/blur. Firefox does not dispatch focus/blur on an
  // <iframe> ELEMENT for a programmatic .focus()/.blur() (verified: the element becomes
  // shadowRoot.activeElement, but no focus event fires), so a focus/blur binding re-dispatched
  // nothing there while working in Chromium -- the host focus/blur contract silently did not exist
  // on one engine. focusin/focusout are dispatched for the iframe in all three engines. They also
  // bubble, which is why stopPropagation() below still matters: it keeps the internal event from
  // escaping the shadow boundary alongside the component's own re-dispatched one.
  /** Whether a host-level `focus` has been emitted without a matching `blur` yet. Guarantees the
   *  re-dispatched pair stays balanced when both the native listener and the overridden method fire
   *  for one focus change (Chromium/WebKit) and when only one of them does (Firefox). */
  private hasEmittedFocus = false;

  private frameIsActive(frame: HTMLIFrameElement | undefined = this.iframe): boolean {
    return Boolean(
      frame && this.isConnected &&
      (this.shadowRoot?.activeElement === frame || this.ownerDocument.activeElement === this),
    );
  }

  private frameOwnsFocus(frame: HTMLIFrameElement | undefined = this.iframe): boolean {
    return Boolean(frame && !frame.inert && !this.withoutInteraction && this.frameIsActive(frame));
  }

  private setFrameFocused(focused: boolean): void {
    this.toggleAttribute('data-frame-focused', focused);
  }

  private dispatchHostFocusEvent(
    type: 'focus' | 'blur',
    source?: FocusEvent,
    relatedTarget: EventTarget | null = null,
  ): void {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    const nativeSource = new view.FocusEvent(type, {
      relatedTarget: source?.relatedTarget ?? relatedTarget,
      view,
      detail: source?.detail ?? 0,
    });
    relayNativeEvent(this, nativeSource);
    this.emit(type === 'focus' ? 'lr-focus' : 'lr-blur');
  }

  private emitHostFocus(source?: FocusEvent, relatedTarget: EventTarget | null = null): void {
    if (this.hasEmittedFocus) return;
    this.hasEmittedFocus = true;
    this.setFrameFocused(true);
    this.dispatchHostFocusEvent('focus', source, relatedTarget);
  }

  private emitHostBlur(source?: FocusEvent, relatedTarget: EventTarget | null = null): void {
    if (!this.hasEmittedFocus) return;
    this.hasEmittedFocus = false;
    this.setFrameFocused(false);
    this.dispatchHostFocusEvent('blur', source, relatedTarget);
  }

  // Bound to focusin/focusout rather than focus/blur: these bubble, so they also catch focus that
  // lands via user interaction rather than the overridden methods above. stopPropagation() keeps
  // the internal event from escaping the shadow boundary alongside our own re-dispatched one.
  private onFrameFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    if (!this.frameOwnsFocus(event.currentTarget as HTMLIFrameElement)) return;
    this.emitHostFocus(event);
  };

  private onFrameBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    if (this.frameOwnsFocus(event.currentTarget as HTMLIFrameElement)) return;
    this.emitHostBlur(event);
  };

  // Browsers do not consistently dispatch focusin/focusout on an <iframe> element when keyboard
  // or pointer focus crosses into its nested browsing context. The owner window does report that
  // boundary transition. Reconcile after the native event turn, then publish only when the actual
  // active-element relationship proves the frame gained or lost focus.
  private focusReconciliationGeneration = 0;
  private scheduleFrameFocusReconciliation = (): void => {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    const generation = ++this.focusReconciliationGeneration;
    view.setTimeout(() => {
      if (generation !== this.focusReconciliationGeneration || !this.isConnected) return;
      if (this.frameOwnsFocus()) this.emitHostFocus();
      else this.emitHostBlur(undefined, this.ownerDocument.activeElement);
    }, 0);
  };

  private focusBoundaryDocument?: Document;
  private onFocusBoundaryKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') this.scheduleFrameFocusReconciliation();
  };

  private resetFocusBoundaryDocument(): void {
    this.focusBoundaryDocument?.removeEventListener('keydown', this.onFocusBoundaryKeyDown, true);
    this.focusBoundaryDocument?.removeEventListener('pointerdown', this.scheduleFrameFocusReconciliation, true);
    this.focusBoundaryDocument = undefined;
  }

  private bindFocusBoundaryDocument(): void {
    let target: Document | null = null;
    try {
      target = this.contentDocument;
    } catch {
      // A cross-origin document is intentionally opaque. Native iframe focus events and the
      // owner-document reconciliation path remain authoritative in that case.
    }
    if (!target || target === this.focusBoundaryDocument) return;
    this.resetFocusBoundaryDocument();
    this.focusBoundaryDocument = target;
    target.addEventListener('keydown', this.onFocusBoundaryKeyDown, true);
    target.addEventListener('pointerdown', this.scheduleFrameFocusReconciliation, true);
  }

  private navigationGeneration = 0;
  private needsReconnectFrame = false;
  private syncedThemeClasses = new Set<string>();
  private syncedThemeProperties = new Set<string>();
  private themeSyncState?: ThemeSyncState;
  private lyraThemeObserver?: MutationObserver;

  constructor() {
    super();
    new ThemeWatcher(this, () => this.syncTheme());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.ownerDocument.addEventListener('focusin', this.scheduleFrameFocusReconciliation, true);
    this.ownerDocument.addEventListener('focusout', this.scheduleFrameFocusReconciliation, true);
    this.ownerDocument.addEventListener('keydown', this.onFocusBoundaryKeyDown, true);
    this.ownerDocument.defaultView?.addEventListener('focus', this.scheduleFrameFocusReconciliation);
    this.ownerDocument.defaultView?.addEventListener('blur', this.scheduleFrameFocusReconciliation);
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    if (Observer) {
      this.lyraThemeObserver?.disconnect();
      this.lyraThemeObserver = new Observer(() => this.syncTheme());
      this.lyraThemeObserver.observe(this.ownerDocument.documentElement, {
        attributes: true,
        attributeFilter: ['data-lr-theme'],
      });
    }
    if (this.needsReconnectFrame) {
      this.needsReconnectFrame = false;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    this.focusReconciliationGeneration++;
    this.ownerDocument.removeEventListener('focusin', this.scheduleFrameFocusReconciliation, true);
    this.ownerDocument.removeEventListener('focusout', this.scheduleFrameFocusReconciliation, true);
    this.ownerDocument.removeEventListener('keydown', this.onFocusBoundaryKeyDown, true);
    this.ownerDocument.defaultView?.removeEventListener('focus', this.scheduleFrameFocusReconciliation);
    this.ownerDocument.defaultView?.removeEventListener('blur', this.scheduleFrameFocusReconciliation);
    this.navigationGeneration++;
    this.needsReconnectFrame = true;
    // Transient focus state, reset like every other open-state flag: a disconnected host is not
    // focused, and leaving this set would swallow the next genuine `focus` after a reconnect.
    this.hasEmittedFocus = false;
    this.setFrameFocused(false);
    this.resetFocusBoundaryDocument();
    this.lyraThemeObserver?.disconnect();
    this.lyraThemeObserver = undefined;
    this.resetThemeSyncState();
    super.disconnectedCallback();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'srcdoc' && (oldValue === null) !== (value === null)) {
      // `srcdoc=""` and an absent `srcdoc` both map to the property's empty-string default, so Lit
      // cannot otherwise observe this meaningful presence change. Rekey synchronously as well as
      // requesting an update so an event from the superseded frame cannot escape in the gap.
      this.navigationGeneration++;
      this.requestUpdate();
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('src') || changed.has('srcdoc') || changed.has('allowfullscreen') ||
      changed.has('loading') || changed.has('referrerpolicy') || changed.has('sandbox')
    ) {
      const frame = this.iframe;
      const wasFocused = this.frameIsActive(frame);
      frame?.blur();
      if (wasFocused && !this.frameIsActive(frame)) {
        this.emitHostBlur(undefined, this.ownerDocument.activeElement);
      }
      this.setFrameFocused(false);
      this.resetFocusBoundaryDocument();
      this.navigationGeneration++;
    }
    if (changed.has('withoutInteraction') && this.withoutInteraction) {
      const frame = this.iframe;
      const wasFocused = this.frameIsActive(frame);
      frame?.blur();
      if (wasFocused) this.emitHostBlur(undefined, this.ownerDocument.activeElement);
      this.setFrameFocused(false);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!changed.has('withThemeSync')) return;
    if (this.withThemeSync) this.syncTheme();
    else this.restoreTheme();
  }

  /** Returns the current iframe window while connected. Cross-origin windows are still opaque. */
  get contentWindow(): Window | null {
    if (!this.isConnected) return null;
    return this.iframe?.contentWindow ?? null;
  }

  /** Returns the current same-origin iframe document, or `null` when detached/cross-origin. */
  get contentDocument(): Document | null {
    if (!this.isConnected) return null;
    try {
      return this.iframe?.contentDocument ?? null;
    } catch {
      return null;
    }
  }

  private get safeZoom(): number {
    return finiteRange(this.zoom, 1, MIN_ZOOM, MAX_ZOOM);
  }

  private get availableZoomLevels(): readonly number[] {
    const source: unknown = this.zoomLevels;
    if (source === this.cachedZoomLevelsSource) return this.cachedZoomLevels;
    this.cachedZoomLevelsSource = source;
    this.cachedZoomLevels = parseZoomLevels(source);
    return this.cachedZoomLevels;
  }

  private get hasInlineDocument(): boolean {
    return this.hasAttribute('srcdoc') || (typeof this.srcdoc === 'string' && this.srcdoc !== '');
  }

  private get hasNavigation(): boolean {
    return this.hasInlineDocument || safeZoomableFrameSrc(this.src) !== null;
  }

  private navigationSignature(): string {
    const inline = this.hasInlineDocument;
    return JSON.stringify([
      inline,
      inline ? this.srcdoc : safeZoomableFrameSrc(this.src),
      this.allowfullscreen,
      safeLoading(this.loading),
      safeReferrerPolicy(this.referrerpolicy),
      safeZoomableFrameSandbox(this.sandbox),
    ]);
  }

  /** Zooms to the smallest configured stop above the current programmatic value. */
  zoomIn(): void {
    const current = this.safeZoom;
    const next = this.availableZoomLevels.find(level => level > current);
    if (next !== undefined) this.zoom = next;
  }

  /** Zooms to the largest configured stop below the current programmatic value. */
  zoomOut(): void {
    const current = this.safeZoom;
    const levels = this.availableZoomLevels;
    for (let index = levels.length - 1; index >= 0; index--) {
      const previous = levels[index];
      if (previous !== undefined && previous < current) {
        this.zoom = previous;
        return;
      }
    }
  }

  private isZoomInDisabled(): boolean {
    return !this.availableZoomLevels.some(level => level > this.safeZoom);
  }

  private isZoomOutDisabled(): boolean {
    return !this.availableZoomLevels.some(level => level < this.safeZoom);
  }

  private onControlsKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    }
  };

  private dispatchFrameEvent(type: 'load' | 'error'): void {
    const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
    if (type === 'load') {
      this.dispatchEvent(new EventConstructor('load', { bubbles: false, composed: false }));
    } else {
      this.dispatchEvent(new EventConstructor('error', { bubbles: false, composed: false }));
    }
  }

  private onFrameEvent(
    type: 'load' | 'error',
    source: Event,
    generation: number,
    navigationSignature: string,
  ): void {
    source.stopPropagation();
    if (
      !this.isConnected || !this.hasNavigation || generation !== this.navigationGeneration ||
      navigationSignature !== this.navigationSignature() || source.currentTarget !== this.iframe
    ) return;
    if (type === 'load') {
      this.bindFocusBoundaryDocument();
      this.syncTheme();
    }
    this.dispatchFrameEvent(type);
  }

  private syncTheme(): void {
    if (!this.withThemeSync || !this.isConnected) return;
    const target = this.contentDocument?.documentElement;
    const source = this.ownerDocument.documentElement;
    if (!target || !source) return;

    try {
      const state = this.themeStateFor(target);
      const nextClasses = new Set([...source.classList].filter(isLyraThemeClass));
      for (const className of this.syncedThemeClasses) {
        if (!nextClasses.has(className)) this.setSyncedThemeClass(state, className, false);
      }
      for (const className of nextClasses) this.setSyncedThemeClass(state, className, true);
      this.syncedThemeClasses = nextClasses;

      for (const attribute of THEME_ATTRIBUTES) {
        const value = source.getAttribute(attribute);
        this.setSyncedThemeAttribute(state, attribute, value);
      }

      const view = this.ownerDocument.defaultView;
      const computed = view?.getComputedStyle(this);
      if (!computed) return;
      const nextProperties = new Set<string>();
      for (let index = 0; index < computed.length; index++) {
        const property = computed.item(index);
        if (!property.startsWith('--lr-theme-')) continue;
        this.setSyncedThemeProperty(state, property, computed.getPropertyValue(property));
        nextProperties.add(property);
      }
      for (const property of this.syncedThemeProperties) {
        if (!nextProperties.has(property)) this.setSyncedThemeProperty(state, property, null);
      }
      this.syncedThemeProperties = nextProperties;
      this.setSyncedThemeProperty(state, 'color-scheme', computed.colorScheme);
    } catch {
      // Same-Origin Policy is the authority. Theme sync is best-effort and never changes sandbox
      // tokens or navigation policy to gain access to an otherwise opaque document.
    }
  }

  private themeStateFor(target: HTMLElement): ThemeSyncState {
    if (this.themeSyncState?.target === target) return this.themeSyncState;
    this.resetThemeSyncState();
    const state: ThemeSyncState = {
      target,
      classes: new Map(),
      attributes: new Map(),
      properties: new Map(),
    };
    this.themeSyncState = state;
    return state;
  }

  private setSyncedThemeClass(state: ThemeSyncState, className: string, present: boolean): void {
    let mutation = state.classes.get(className);
    if (!mutation) {
      mutation = {
        original: state.target.classList.contains(className),
        applied: state.target.classList.contains(className),
      };
      state.classes.set(className, mutation);
    }
    state.target.classList.toggle(className, present);
    mutation.applied = state.target.classList.contains(className);
  }

  private setSyncedThemeAttribute(
    state: ThemeSyncState,
    attribute: (typeof THEME_ATTRIBUTES)[number],
    value: string | null,
  ): void {
    let mutation = state.attributes.get(attribute);
    if (!mutation) {
      const original = state.target.getAttribute(attribute);
      mutation = { original, applied: original };
      state.attributes.set(attribute, mutation);
    }
    if (value === null) state.target.removeAttribute(attribute);
    else state.target.setAttribute(attribute, value);
    mutation.applied = state.target.getAttribute(attribute);
  }

  private setSyncedThemeProperty(
    state: ThemeSyncState,
    property: string,
    value: string | null,
  ): void {
    let mutation = state.properties.get(property);
    if (!mutation) {
      mutation = {
        original: state.target.style.getPropertyValue(property),
        originalPriority: state.target.style.getPropertyPriority(property),
        applied: state.target.style.getPropertyValue(property),
        appliedPriority: state.target.style.getPropertyPriority(property),
      };
      state.properties.set(property, mutation);
    }
    if (value === null) state.target.style.removeProperty(property);
    else state.target.style.setProperty(property, value);
    mutation.applied = state.target.style.getPropertyValue(property);
    mutation.appliedPriority = state.target.style.getPropertyPriority(property);
  }

  private restoreTheme(): void {
    const state = this.themeSyncState;
    if (!state) return;
    try {
      if (this.contentDocument?.documentElement !== state.target) return;
      for (const [className, mutation] of state.classes) {
        if (state.target.classList.contains(className) === mutation.applied) {
          state.target.classList.toggle(className, mutation.original);
        }
      }
      for (const [attribute, mutation] of state.attributes) {
        if (state.target.getAttribute(attribute) !== mutation.applied) continue;
        if (mutation.original === null) state.target.removeAttribute(attribute);
        else state.target.setAttribute(attribute, mutation.original);
      }
      for (const [property, mutation] of state.properties) {
        if (
          state.target.style.getPropertyValue(property) !== mutation.applied ||
          state.target.style.getPropertyPriority(property) !== mutation.appliedPriority
        ) continue;
        if (mutation.original) {
          state.target.style.setProperty(property, mutation.original, mutation.originalPriority);
        } else {
          state.target.style.removeProperty(property);
        }
      }
    } catch {
      // Same-Origin Policy can change between the last successful sync and this opt-out.
    } finally {
      this.resetThemeSyncState();
    }
  }

  private resetThemeSyncState(): void {
    this.themeSyncState = undefined;
    this.syncedThemeClasses.clear();
    this.syncedThemeProperties.clear();
  }

  private renderControls(): TemplateResult | typeof nothing {
    if (this.withoutControls) return nothing;
    return html`<div
      part="controls"
      role="toolbar"
      aria-label=${this.localize('zoomControls')}
      @keydown=${this.onControlsKeyDown}
    >
      <button
        part="zoom-out-button"
        type="button"
        aria-label=${this.localize('zoomOut')}
        ?disabled=${this.isZoomOutDisabled()}
        @click=${() => this.zoomOut()}
      ><span aria-hidden="true" inert><slot name="zoom-out-icon">−</slot></span></button>
      <button
        part="zoom-in-button"
        type="button"
        aria-label=${this.localize('zoomIn')}
        ?disabled=${this.isZoomInDisabled()}
        @click=${() => this.zoomIn()}
      ><span aria-hidden="true" inert><slot name="zoom-in-icon">+</slot></span></button>
    </div>`;
  }

  override render(): TemplateResult {
    const generation = this.navigationGeneration;
    const navigationSignature = this.navigationSignature();
    const inline = this.hasInlineDocument;
    const src = inline ? null : safeZoomableFrameSrc(this.src);
    const referrerPolicy = safeReferrerPolicy(this.referrerpolicy);
    const explicitHostLabel = hostAriaLabel(this);
    const label = explicitHostLabel === ''
      ? ''
      : explicitHostLabel !== null
        ? this.localize('zoomableFrameLabel')
        : this.accessibleLabel ?? this.localize('zoomableFrameLabel');
    const zoom = this.safeZoom;
    const frame = html`<iframe
      part="iframe"
      title=${label}
      src=${src ?? nothing}
      .srcdoc=${inline ? this.srcdoc : nothing}
      ?allowfullscreen=${this.allowfullscreen}
      loading=${safeLoading(this.loading)}
      referrerpolicy=${referrerPolicy ?? nothing}
      sandbox=${safeZoomableFrameSandbox(this.sandbox)}
      tabindex=${this.withoutInteraction ? '-1' : '0'}
      .inert=${this.withoutInteraction}
      style="--lr-zoomable-frame-zoom: ${zoom}"
      @load=${(event: Event) => this.onFrameEvent('load', event, generation, navigationSignature)}
      @error=${(event: Event) => this.onFrameEvent('error', event, generation, navigationSignature)}
      @focusin=${this.onFrameFocus}
      @focusout=${this.onFrameBlur}
      @pointerdown=${this.scheduleFrameFocusReconciliation}
    ></iframe>`;
    return html`${keyed(generation, frame)}${this.renderControls()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-zoomable-frame': LyraZoomableFrame;
  }
}
