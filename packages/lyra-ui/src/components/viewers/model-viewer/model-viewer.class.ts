import { html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { resolveGuardedRel } from '../../../internal/link-rel.js';
import { safeDownloadHref } from '../../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { engine3dFailureReason, type Engine3dFallbackDetail, type Engine3dFallbackReason } from '../../../internal/engine-3d.js';
import type { Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { modelEngineEnvironment, modelEngineLoader } from './model-viewer-loader.js';
import { MODEL_SOURCE_MAX_BYTES, DEFAULT_MODEL_CAMERA, readModelSource, resolveModelFormat, snapshotModelCamera, type LyraModelCamera, type LyraModelFormat, type LyraModelFormatPreference } from './model-viewer-source.js';
import { styles } from './model-viewer.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_download, LYRA_DEFAULT_engine3dContextLost, LYRA_DEFAULT_engine3dSoftwareRendering, LYRA_DEFAULT_engine3dUnavailable, LYRA_DEFAULT_engine3dUnsupported, LYRA_DEFAULT_retry, LYRA_DEFAULT_zoomIn, LYRA_DEFAULT_zoomOut } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_modelViewerAlternative, LYRA_DEFAULT_modelViewerEmpty, LYRA_DEFAULT_modelViewerFit, LYRA_DEFAULT_modelViewerInstructions, LYRA_DEFAULT_modelViewerInvalid, LYRA_DEFAULT_modelViewerLabel, LYRA_DEFAULT_modelViewerProgress, LYRA_DEFAULT_modelViewerReady, LYRA_DEFAULT_modelViewerRotateDown, LYRA_DEFAULT_modelViewerRotateLeft, LYRA_DEFAULT_modelViewerRotateRight, LYRA_DEFAULT_modelViewerRotateUp, LYRA_DEFAULT_modelViewerUnsupportedFormat } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraModelCamera, LyraModelFormat, LyraModelFormatPreference } from './model-viewer-source.js';

type ModelStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'context-lost';

/** What a failed or degraded model says; `statusText()` maps each to its localized message. */
type ModelMessage = 'tooLarge' | 'urlNotAllowed' | 'unsupportedFormat' | 'invalid' | 'engineUnsupported' | 'engineUnavailable' | 'contextLost';

/** Camera actions, in toolbar order. */
type ModelAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'fit';

/** Keyboard model of the camera surface; `+` and `=` share a key on most layouts. */
const KEY_ACTIONS: Readonly<Record<string, ModelAction>> = Object.freeze({
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', Home: 'fit',
});

/**
 * Bounded static 3D model and point-cloud viewer with a persistent text alternative.
 * Loads the optional `@aceshooting/lyra-3d` model engine only for a nonempty, supported source.
 * Supports conservative embedded subsets of glTF, GLB, STL, OBJ, PLY, XYZ and PCD; external
 * resource references reject. Sources are limited to 64 MiB before the engine applies its
 * decoded, geometry and texture ceilings.
 *
 * @customElement lr-model-viewer
 * @slot - Additional descriptive content, displayed after the text alternative.
 * @csspart base - The named viewer region.
 * @csspart viewport - The keyboard camera surface containing the decorative engine canvas.
 * @csspart toolbar - The native camera controls.
 * @csspart control - One camera or retry button.
 * @csspart instructions - The keyboard instructions that describe the camera surface.
 * @csspart alternative - The persistent text alternative.
 * @csspart status - Visible localized loading, progress or completion text.
 * @csspart error - Visible localized failure text.
 * @csspart footer - The wrapper around the download link and the retry button.
 * @csspart download - The guarded source download link.
 * @cssprop [--lr-model-viewer-height=var(--lr-size-20rem)] - Block size of the camera surface.
 * @event lr-load - The current model finished parsing, including a valid model with no visible geometry. `detail: { format }`.
 * @event lr-render-error - The source or the engine failed. `detail: { error }`.
 * @event lr-camera-change - The user moved the camera with a pointer, key or toolbar button. Assigning `camera` is silent. `detail: { camera }`.
 * @event lr-engine-fallback - WebGL stopped rendering and the text alternative remains. `detail: { from, to, reason }`.
 * @status experimental
 * @since unreleased
 */
export class LyraModelViewer extends LyraElement<LyraModelViewerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    download: LYRA_DEFAULT_download,
    engine3dContextLost: LYRA_DEFAULT_engine3dContextLost,
    engine3dSoftwareRendering: LYRA_DEFAULT_engine3dSoftwareRendering,
    engine3dUnavailable: LYRA_DEFAULT_engine3dUnavailable,
    engine3dUnsupported: LYRA_DEFAULT_engine3dUnsupported,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    modelViewerAlternative: LYRA_DEFAULT_modelViewerAlternative,
    modelViewerEmpty: LYRA_DEFAULT_modelViewerEmpty,
    modelViewerFit: LYRA_DEFAULT_modelViewerFit,
    modelViewerInstructions: LYRA_DEFAULT_modelViewerInstructions,
    modelViewerInvalid: LYRA_DEFAULT_modelViewerInvalid,
    modelViewerLabel: LYRA_DEFAULT_modelViewerLabel,
    modelViewerProgress: LYRA_DEFAULT_modelViewerProgress,
    modelViewerReady: LYRA_DEFAULT_modelViewerReady,
    modelViewerRotateDown: LYRA_DEFAULT_modelViewerRotateDown,
    modelViewerRotateLeft: LYRA_DEFAULT_modelViewerRotateLeft,
    modelViewerRotateRight: LYRA_DEFAULT_modelViewerRotateRight,
    modelViewerRotateUp: LYRA_DEFAULT_modelViewerRotateUp,
    modelViewerUnsupportedFormat: LYRA_DEFAULT_modelViewerUnsupportedFormat,
    retry: LYRA_DEFAULT_retry,
    zoomIn: LYRA_DEFAULT_zoomIn,
    zoomOut: LYRA_DEFAULT_zoomOut,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _src = '';
  private _name = '';
  private _mimeType = '';
  private _format: LyraModelFormatPreference = 'auto';
  private _camera?: LyraModelCamera;
  private authoredCamera = false;

  /**
   * URL of the model file. Fetched through the shared URL policy with a fixed 64 MiB ceiling; no parser may fetch dependencies.
   * @default ''
   */
  @property({ noAccessor: true }) get src(): string { return this._src; }
  set src(value: string) {
    const next = typeof value === 'string' ? value : '';
    const old = this._src;
    if (next === old) return;
    this.retire();
    this._src = next;
    this.requestUpdate('src', old);
  }

  /**
   * File name used for format detection, the download name and the region name when no host `aria-label` is present.
   * @default ''
   */
  @property({ noAccessor: true }) get name(): string { return this._name; }
  set name(value: string) {
    const next = typeof value === 'string' ? value : '';
    const old = this._name;
    if (next === old) return;
    this.retire();
    this._name = next;
    this.requestUpdate('name', old);
  }

  /**
   * MIME type used before extension detection when `format` is `auto`.
   * @default ''
   */
  @property({ attribute: 'mime-type', noAccessor: true }) get mimeType(): string { return this._mimeType; }
  set mimeType(value: string) {
    const next = typeof value === 'string' ? value : '';
    const old = this._mimeType;
    if (next === old) return;
    this.retire();
    this._mimeType = next;
    this.requestUpdate('mimeType', old);
  }

  /**
   * Explicit parser format, or `auto` to use the MIME type, then the file name, then the source extension. An unknown value fails closed.
   * @default 'auto'
   */
  @property({ noAccessor: true }) get format(): LyraModelFormatPreference { return this._format; }
  set format(value: LyraModelFormatPreference) {
    const next = value ?? 'auto';
    const old = this._format;
    if (next === old) return;
    this.retire();
    this._format = next;
    this.requestUpdate('format', old);
  }

  /** Text alternative rendered in every loading, ready and failure state. A built-in sentence is used when empty. */
  @property() alt = '';

  /** Browsing context of the download link. A nonempty target always adds `noopener noreferrer`. */
  @property() target = '_blank';

  /** Additional link relationships for the download link; `opener` is always removed. */
  @property() rel = '';

  /** Orbit camera copied on assignment. Assigning a camera is silent; unsetting it returns to automatic fit. User camera changes emit `lr-camera-change`. */
  @property({ attribute: false, noAccessor: true }) get camera(): LyraModelCamera | undefined { return this._camera; }
  set camera(value: LyraModelCamera | undefined) {
    const next = value === undefined || value === null ? undefined : snapshotModelCamera(value);
    const old = this._camera;
    this._camera = next;
    this.authoredCamera = next !== undefined;
    try {
      if (next) this.engine?.setCamera(next);
      else if (this.status === 'ready') this.fit();
    } catch (error) {
      this.fail('invalid', 'error', error);
    }
    this.requestUpdate('camera', old);
  }

  @state() private status: ModelStatus = 'idle';
  @state() private message: ModelMessage | '' = '';
  @state() private software = false;
  @state() private loaded = 0;
  @state() private total: number | null = null;

  private generation = 0;
  private controller?: AbortController;
  private engine?: Engine3dInstance;
  private observers: Array<{ disconnect(): void }> = [];
  private mediaCleanup: Array<() => void> = [];
  private readonly announcements = new ViewerAnnouncementController(this);
  private readonly descriptions = new HostDescriptionController(this, () => this.viewport, () => {
    const instructions = this.renderRoot.querySelector('[part="instructions"]');
    return instructions ? [instructions] : [];
  });

  private get viewport(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('[part="viewport"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override disconnectedCallback(): void {
    this.retire();
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.retire();
    this.announcements.adopted();
    this.descriptions.adopted();
    if (this.isConnected) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'model',
      this.status,
      this.statusText(),
      this.status === 'error'
        ? 'assertive'
        : this.status === 'ready' || this.status === 'empty' || this.status === 'loading' || this.status === 'context-lost' ? 'polite' : undefined,
    );
    if (['src', 'name', 'mimeType', 'format'].some(key => changed.has(key))) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  /** Invalidates the current generation synchronously and releases every resource it owned. */
  private retire(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    for (const observer of this.observers) observer.disconnect();
    this.observers = [];
    for (const cleanup of this.mediaCleanup) cleanup();
    this.mediaCleanup = [];
    const engine = this.engine;
    this.engine = undefined;
    try { engine?.dispose(); } catch { /* The engine attempts all owned resource releases. */ }
    this.viewport?.replaceChildren();
    this.status = 'idle';
    this.message = '';
    this.software = false;
    this.loaded = 0;
    this.total = null;
  }

  private fail(message: ModelMessage, reason: Engine3dFallbackReason, error?: unknown): void {
    this.retire();
    this.status = 'error';
    this.message = message;
    this.emit('lr-engine-fallback', { from: 'webgl', to: 'list', reason });
    this.emit('lr-render-error', { error: error ?? new Error('Model engine unavailable') });
  }

  private async load(): Promise<void> {
    this.retire();
    if (!this.src || !this.isConnected) return;
    const owner = this.ownerDocument;
    const view = owner.defaultView;
    const container = this.viewport;
    if (!view || !container) return;
    const generation = this.generation;
    const controller = new view.AbortController();
    this.controller = controller;
    const current = () => generation === this.generation && !controller.signal.aborted && this.isConnected && this.ownerDocument === owner;
    if (this.src.length > MODEL_SOURCE_MAX_BYTES) { this.fail('tooLarge', 'error'); return; }
    const format = resolveModelFormat(this.format, this.name, this.mimeType, this.src);
    if (!format) { this.fail('unsupportedFormat', 'unsupported'); return; }
    if (!resolveOwnerFetchTarget(this, this.src)) { this.fail('urlNotAllowed', 'error'); return; }
    if (!modelEngineEnvironment.available(owner)) { this.fail('engineUnsupported', 'unsupported'); return; }
    this.status = 'loading';
    let candidate: Engine3dInstance | null = null;
    try {
      const bytes = await readModelSource(this, this.src, controller.signal, current, (loaded, total) => {
        if (current() && (total !== this.total || loaded === total || loaded - this.loaded >= 1024 * 1024)) { this.loaded = loaded; this.total = total; }
      });
      if (!current()) return;
      candidate = await modelEngineLoader.create();
      if (!current()) { candidate?.dispose(); return; }
      if (!candidate) { this.fail('engineUnavailable', 'unavailable'); return; }
      const engine = candidate;
      this.engine = engine;
      if (typeof engine.fit !== 'function') { this.fail('engineUnavailable', 'unavailable'); return; }
      engine.setStyle(this.engineStyle());
      let parsed = false;
      let contextLost = false;
      const publishParsedView = () => {
        if (!current() || contextLost || !parsed) return;
        this.status = engine.positionOf?.(0) === null ? 'empty' : 'ready';
        this.message = '';
        if (this.status === 'ready' && !this.authoredCamera) this.fit();
      };
      await engine.mount(container, {
        hover: () => {},
        pick: () => {},
        camera: value => { if (current() && this.status === 'ready') this.acceptCamera(value, true); },
        progress: (loaded, total) => {
          if (!current() || parsed || !Number.isFinite(loaded) || !Number.isFinite(total) || total < 0 || loaded < total) return;
          try {
            parsed = true;
            publishParsedView();
            if (current()) this.emit('lr-load', { format });
          } catch (error) {
            if (current()) this.fail('invalid', 'error', error);
          }
        },
        lost: reason => {
          if (!current()) return;
          if (reason === 'context-lost') {
            if (contextLost) return;
            contextLost = true;
            this.status = 'context-lost';
            this.message = 'contextLost';
            this.emit('lr-engine-fallback', { from: 'webgl', to: 'list', reason });
          } else this.fail('invalid', 'error');
        },
        rendering: info => { if (current()) this.software = info.software; },
        restored: () => {
          if (!current() || !contextLost) return;
          try {
            contextLost = false;
            this.message = '';
            if (parsed) publishParsedView(); else this.status = 'loading';
            if (current()) this.refreshEngine();
          } catch (error) {
            if (current()) this.fail('invalid', 'error', error);
          }
        },
      });
      if (!current()) {
        if (this.engine === engine) { this.engine = undefined; engine.dispose(); }
        return;
      }
      // The canvas is decorative and must stay unfocusable: a tabindex would let a pointer press move
      // focus onto it, where the camera surface's key handler never sees the key.
      container.querySelectorAll('canvas').forEach(canvas => { canvas.setAttribute('aria-hidden', 'true'); canvas.removeAttribute('tabindex'); });
      if (this.authoredCamera && this.camera) engine.setCamera(this.camera);
      this.watchEnvironment(current);
      this.refreshEngine();
      if (!current()) return;
      engine.setData({ bytes, format }, generation);
    } catch (error) {
      if (!current() || isAbortError(error)) return;
      const reason = engine3dFailureReason(error);
      this.fail(isResourceLimitError(error) ? 'tooLarge' : reason === 'unsupported' ? 'engineUnsupported' : 'invalid', reason, error);
    }
  }

  /** Resolves the live design tokens to the concrete sRGB colors the engine paints with. */
  private engineStyle(): unknown {
    const view = this.ownerDocument.defaultView!;
    const computed = view.getComputedStyle(this);
    const canvas = this.ownerDocument.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const color = (token: string) => {
      const resolved = resolveCanvasColor(this, `var(${token})`, computed.color);
      if (!context) return resolved;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = resolved;
      context.fillRect(0, 0, 1, 1);
      const rgba = context.getImageData(0, 0, 1, 1).data;
      return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]! / 255})`;
    };
    return {
      background: color('--lr-color-surface'),
      foreground: color('--lr-color-text'),
      muted: color('--lr-color-text-quiet'),
      accent: color('--lr-color-brand'),
      focus: color('--lr-focus-ring-color'),
      palette: [color('--lr-color-brand')],
      fontFamily: computed.fontFamily,
      fontSize: finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128),
      pointSize: 8,
      lineWidth: 1,
      devicePixelRatio: finiteRange(view.devicePixelRatio, 1, 0.25, 4),
      reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches,
      forcedColors: view.matchMedia('(forced-colors: active)').matches,
    };
  }

  private refreshEngine(): void {
    if (!this.engine || !this.isConnected) return;
    try {
      this.engine.setStyle(this.engineStyle());
      const box = this.viewport?.getBoundingClientRect();
      if (box) this.engine.resize(Math.max(1, box.width), Math.max(1, box.height));
    } catch (error) {
      this.fail('invalid', 'error', error);
    }
  }

  private watchEnvironment(current: () => boolean): void {
    const view = this.ownerDocument.defaultView!;
    const refresh = () => { if (current()) this.refreshEngine(); };
    const resize = new view.ResizeObserver(refresh);
    resize.observe(this.viewport!);
    this.observers.push(resize);
    const mutation = new view.MutationObserver(refresh);
    let ancestor: Element | null = this;
    while (ancestor) {
      mutation.observe(ancestor, { attributes: true });
      const root: Node = ancestor.getRootNode();
      ancestor = ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
    }
    this.observers.push(mutation);
    for (const query of ['(prefers-reduced-motion: reduce)', '(forced-colors: active)', '(prefers-color-scheme: dark)']) {
      const media = view.matchMedia(query);
      media.addEventListener('change', refresh);
      this.mediaCleanup.push(() => media.removeEventListener('change', refresh));
    }
  }

  private acceptCamera(value: unknown, emit: boolean): void {
    let next: LyraModelCamera;
    try { next = snapshotModelCamera(value); } catch { return; }
    const old = this._camera;
    this._camera = next;
    this.requestUpdate('camera', old);
    if (emit) {
      this.authoredCamera = true;
      this.emit('lr-camera-change', { camera: next });
    }
  }

  /** Fits the current model without emitting a camera change. Does nothing until a model is ready. */
  fit(): void {
    if (this.engine && this.status === 'ready') {
      try { this.acceptCamera(this.engine.fit?.(), false); } catch (error) { this.fail('invalid', 'error', error); }
    }
  }

  /** Retries the current source, and the optional companion, after a failure. */
  retry(): void {
    this.retire();
    this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private move(action: ModelAction): void {
    if (!this.engine || this.status !== 'ready') return;
    if (action === 'fit') {
      const generation = this.generation;
      this.fit();
      if (generation === this.generation && this.status === 'ready' && this.camera) this.emit('lr-camera-change', { camera: this.camera });
      return;
    }
    const current = this.camera ?? DEFAULT_MODEL_CAMERA;
    const horizontal = this.effectiveDirection === 'rtl' ? -1 : 1;
    const next = snapshotModelCamera({
      ...current,
      yaw: current.yaw + (action === 'left' ? -0.1 * horizontal : action === 'right' ? 0.1 * horizontal : 0),
      pitch: current.pitch + (action === 'up' ? 0.1 : action === 'down' ? -0.1 : 0),
      distance: current.distance * (action === 'in' ? 0.8 : action === 'out' ? 1.25 : 1),
    });
    try {
      this.engine.setCamera(next);
      this.acceptCamera(next, true);
    } catch (error) {
      this.fail('invalid', 'error', error);
    }
  }

  private keydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.currentTarget !== event.target || this.closest('[inert]')) return;
    const action = Object.hasOwn(KEY_ACTIONS, event.key) ? KEY_ACTIONS[event.key] : undefined;
    if (!action || this.status !== 'ready') return;
    event.preventDefault();
    this.move(action);
  }

  private statusText(): string {
    switch (this.message) {
      case 'tooLarge': return this.localize('documentPreviewResourceTooLarge');
      case 'urlNotAllowed': return this.localize('documentPreviewUrlNotAllowed');
      case 'unsupportedFormat': return this.localize('modelViewerUnsupportedFormat');
      case 'invalid': return this.localize('modelViewerInvalid');
      case 'engineUnsupported': return this.localize('engine3dUnsupported');
      case 'engineUnavailable': return this.localize('engine3dUnavailable');
      case 'contextLost': return this.localize('engine3dContextLost');
      default: break;
    }
    if (this.status === 'ready') return this.localize('modelViewerReady');
    if (this.status === 'empty') return this.localize('modelViewerEmpty');
    if (this.status === 'loading') {
      if (this.total === null) return this.localize('loadingDocument');
      const number = getNumberFormat(this.effectiveLocale);
      return this.localize('modelViewerProgress', undefined, { loaded: number.format(this.loaded), total: number.format(this.total) });
    }
    return this.localize('documentPreviewEmpty', undefined, { type: this.localize('modelViewerLabel') });
  }

  override render() {
    const label = hostAriaLabel(this) ?? (this.name || this.localize('modelViewerLabel'));
    const ready = this.status === 'ready';
    const href = this.src.length <= MODEL_SOURCE_MAX_BYTES ? safeDownloadHref(this.src, this.ownerDocument?.defaultView?.URL ?? URL) : null;
    const controls: ReadonlyArray<readonly [ModelAction, string]> = [
      ['left', this.localize('modelViewerRotateLeft')],
      ['right', this.localize('modelViewerRotateRight')],
      ['up', this.localize('modelViewerRotateUp')],
      ['down', this.localize('modelViewerRotateDown')],
      ['in', this.localize('zoomIn')],
      ['out', this.localize('zoomOut')],
      ['fit', this.localize('modelViewerFit')],
    ];
    return html`<section part="base" role="region" aria-label=${label}>
      <div part="viewport" role="group" aria-label=${label} aria-busy=${String(this.status === 'loading')} tabindex=${ready ? '0' : '-1'} ?data-ready=${ready} ?hidden=${this.status === 'idle' || this.status === 'empty' || this.status === 'error'} @keydown=${this.keydown}></div>
      <div part="toolbar">${controls.map(([action, label]) => html`<button part="control" type="button" ?disabled=${!ready} @click=${() => this.move(action)}>${label}</button>`)}</div>
      <p part="instructions">${this.localize('modelViewerInstructions')}</p>
      <p part="alternative">${this.alt || this.localize('modelViewerAlternative')}</p><slot></slot>
      ${this.status === 'error' || this.status === 'context-lost' ? html`<p part="error">${this.statusText()}</p>` : html`<p part="status">${this.statusText()}</p>`}
      ${this.software ? html`<p part="status">${this.localize('engine3dSoftwareRendering')}</p>` : nothing}
      <div part="footer">${href ? html`<a part="download" href=${href} download=${this.name} target=${ifDefined(this.target || undefined)} rel=${ifDefined(resolveGuardedRel(this.rel, this.target))}>${this.localize('download')}</a>` : nothing}${this.status === 'error' ? html`<button part="control" type="button" @click=${this.retry}>${this.localize('retry')}</button>` : nothing}</div>
    </section>`;
  }
}

export interface LyraModelViewerEventMap {
  'lr-load': CustomEvent<{ readonly format: LyraModelFormat }>;
  'lr-render-error': CustomEvent<{ readonly error: unknown }>;
  'lr-camera-change': CustomEvent<{ readonly camera: LyraModelCamera }>;
  'lr-engine-fallback': CustomEvent<Engine3dFallbackDetail>;
}

declare global { interface HTMLElementTagNameMap { 'lr-model-viewer': LyraModelViewer } }
