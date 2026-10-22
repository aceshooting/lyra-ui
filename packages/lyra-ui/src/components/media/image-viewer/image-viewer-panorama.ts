import { html, nothing, type TemplateResult } from 'lit';
import { literalSetConverter } from '../../../internal/converters.js';
import { snapshotPublicCollection } from '../../../internal/collection-snapshot.js';
import { isObjectValue, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { finiteRange } from '../../../internal/numbers.js';
import { createEngine3dLoader, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { Engine3dSelection, ENGINE_3D_REASON_MESSAGE, ENGINE_3D_SHOWING_MESSAGE, engine3dFailureReason, webgl2Available, type Engine3dFallbackDetail, type Engine3dFallbackReason } from '../../../internal/engine-3d.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { tag } from '../../../internal/prefix.js';

export type LyraMediaProjection = 'flat' | 'equirectangular';
export interface LyraPanoramaCamera { readonly yaw: number; readonly pitch: number; readonly fieldOfView: number }
export interface LyraPanoramaHotspot { readonly id: string; readonly yaw: number; readonly pitch: number; readonly label?: string }
export interface LyraPanoramaHotspotSelectDetail { readonly hotspot: LyraPanoramaHotspot; readonly id: string; readonly index: number }
export const PANORAMA_PROJECTION = literalSetConverter<LyraMediaProjection>(['flat', 'equirectangular'], 'flat');
export const PANORAMA_DEFAULT_CAMERA: LyraPanoramaCamera = Object.freeze({ yaw: 0, pitch: 0, fieldOfView: 75 });
export const panoramaLoader = createEngine3dLoader({ entry: 'panorama', tag: tag('image-viewer'), load: () => import('@aceshooting/lyra-3d/panorama') });
export const panoramaEnvironment = { available: (owner: Document) => webgl2Available(() => owner.createElement('canvas')) };

export function normalizePanoramaCamera(value: unknown): LyraPanoramaCamera {
  if (!isObjectValue(value)) return PANORAMA_DEFAULT_CAMERA;
  const number = (key: string): number => { const entry = readOwnDataValue(value, key); return typeof entry === 'number' ? entry : NaN; };
  const yaw = finiteRange(number('yaw'), 0);
  return Object.freeze({ yaw: ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI,
    pitch: finiteRange(number('pitch'), 0, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    fieldOfView: finiteRange(number('fieldOfView'), 75, 20, 100) });
}

/** First valid ID wins; invalid coordinates and blank IDs are omitted from the bounded snapshot. */
export function snapshotPanoramaHotspots(value: unknown, owner: Window | null): readonly LyraPanoramaHotspot[] {
  const source = snapshotPublicCollection(value, owner);
  if (!Array.isArray(source)) return Object.freeze([]);
  const seen = new Set<string>();
  const result: LyraPanoramaHotspot[] = [];
  for (const item of source) {
    const id = readOwnDataValue(item, 'id'), yaw = readOwnDataValue(item, 'yaw'), pitch = readOwnDataValue(item, 'pitch'), label = readOwnDataValue(item, 'label');
    if (typeof id !== 'string' || !id.trim() || seen.has(id) || typeof yaw !== 'number' || !Number.isFinite(yaw) || typeof pitch !== 'number' || !Number.isFinite(pitch) || Math.abs(pitch) > Math.PI / 2) continue;
    seen.add(id);
    result.push(Object.freeze({ id, yaw: normalizePanoramaCamera({ yaw }).yaw, pitch, ...(typeof label === 'string' ? { label } : {}) }));
  }
  return Object.freeze(result);
}

type Media = HTMLImageElement | HTMLVideoElement;
interface PanoramaOptions {
  readonly changed: () => void;
  readonly updated: () => Promise<unknown>;
  readonly localize: (key: LyraMessageKey) => string;
  readonly direction: () => 'ltr' | 'rtl';
  readonly camera: (camera: LyraPanoramaCamera) => void;
  readonly pick: (detail: LyraPanoramaHotspotSelectDetail) => void;
  readonly fallback: (detail: Engine3dFallbackDetail) => void;
}

/** Optional spherical rendering around a caller-owned native image or video. */
export class PanoramaController {
  private readonly selection = new Engine3dSelection(true);
  private readonly announcements: AnnouncementSinkController;
  ready = false;
  loading = false;
  notice: Engine3dFallbackDetail | null = null;
  private software = false;
  private enabled = false;
  private media: Media | null = null;
  private mediaRevision = -1;
  private hotspots: readonly LyraPanoramaHotspot[] = [];
  private camera: LyraPanoramaCamera = PANORAMA_DEFAULT_CAMERA;
  private container: HTMLElement | null = null;
  private engine?: Engine3dInstance;
  private generation = 0;
  private revision = 0;
  private attempted = false;
  private pending = false;
  private intersection?: IntersectionObserver;
  private eligibility?: MutationObserver;
  private intersecting = false;
  private resize?: ResizeObserver;
  private theme?: MutationObserver;
  private cleanups: (() => void)[] = [];
  private cursor = 0;

  constructor(private readonly host: HTMLElement, private readonly options: PanoramaOptions) {
    this.announcements = new AnnouncementSinkController(host, { eager: ['assertive'] });
  }

  private release(): void {
    this.generation++;
    this.intersection?.disconnect(); this.intersection = undefined;
    this.eligibility?.disconnect(); this.eligibility = undefined;
    this.intersecting = false;
    this.resize?.disconnect(); this.resize = undefined;
    this.theme?.disconnect(); this.theme = undefined;
    for (const cleanup of this.cleanups) cleanup(); this.cleanups = [];
    const engine = this.engine; this.engine = undefined;
    this.ready = this.loading = this.pending = false;
    engine?.dispose();
  }

  invalidate(): void {
    this.release(); this.attempted = false; this.notice = null; this.software = false;
    this.selection.prefer(this.enabled ? 'webgl' : 'builtin');
  }
  disconnect(): void { this.invalidate(); this.media = null; this.container = null; }
  adopted(): void { this.disconnect(); this.announcements.adopted(); }

  update(enabled: boolean, media: Media | null, mediaRevision: number, hotspots: readonly LyraPanoramaHotspot[], camera: LyraPanoramaCamera, container: HTMLElement | null): void {
    const replace = enabled !== this.enabled || media !== this.media || mediaRevision !== this.mediaRevision || hotspots !== this.hotspots || container !== this.container;
    if (replace) {
      this.invalidate(); this.enabled = enabled; this.media = media; this.mediaRevision = mediaRevision;
      this.hotspots = hotspots; this.container = container; this.cursor = Math.min(this.cursor, Math.max(0, hotspots.length - 1));
      this.selection.prefer(enabled ? 'webgl' : 'builtin');
      this.options.changed();
    }
    const cameraChanged = camera !== this.camera; this.camera = camera;
    if (!enabled || !media || !container || !this.host.isConnected) return;
    if (this.ready) { if (cameraChanged) this.command(() => this.engine?.setCamera(camera)); return; }
    if (this.pending || this.attempted || this.intersection || this.eligibility) return;
    const view = this.host.ownerDocument.defaultView;
    const generation = this.generation;
    this.intersecting = view?.IntersectionObserver === undefined;
    const admit = (): void => {
      if (generation !== this.generation || this.pending || this.attempted || !this.intersecting || !isAccessibilityVisible(this.host)) return;
      this.intersection?.disconnect(); this.intersection = undefined;
      this.eligibility?.disconnect(); this.eligibility = undefined;
      void this.start();
    };
    if (view?.IntersectionObserver) {
      this.intersection = new view.IntersectionObserver(entries => {
        if (generation !== this.generation) return;
        for (const entry of entries) if (entry.target === container) this.intersecting = entry.isIntersecting;
        admit();
      });
      this.intersection.observe(container);
    }
    // Only pending admission observes author fences; no polling or subtree/document observer.
    if (view?.MutationObserver) {
      this.eligibility = new view.MutationObserver(admit);
      let ancestor: Element | null = this.host;
      let depth = 0;
      while (ancestor && depth++ <= 256) {
        this.eligibility.observe(ancestor, { attributes: true, attributeFilter: ['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open'] });
        const root: Node = ancestor.getRootNode();
        ancestor = ancestor.assignedSlot ?? ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
      }
    }
    admit();
  }

  private fail(reason: Engine3dFallbackReason): void {
    const detail = this.selection.renderer === 'webgl' ? this.selection.fail(reason) : null;
    this.ready = this.loading = false;
    if (reason !== 'context-lost') { this.release(); this.attempted = true; }
    if (!detail) return;
    this.notice = detail; this.options.changed();
    this.announcements.announceAssertive(this.options.localize(ENGINE_3D_REASON_MESSAGE[detail.reason]));
    this.announcements.announcePolite(this.options.localize(ENGINE_3D_SHOWING_MESSAGE[detail.to]));
    this.options.fallback(detail);
  }

  private command(run: () => void): void {
    const generation = this.generation;
    const engine = this.engine;
    try { run(); } catch { if (generation === this.generation && engine === this.engine) this.fail('error'); }
  }

  private async start(): Promise<void> {
    const owner = this.host.ownerDocument, container = this.container, media = this.media, hotspots = this.hotspots;
    if (!this.enabled || !container || !media || !this.host.isConnected) return;
    const generation = this.generation;
    const current = () => generation === this.generation && this.host.isConnected && this.host.ownerDocument === owner;
    this.pending = this.attempted = true;
    if (!panoramaEnvironment.available(owner)) { this.fail('unsupported'); return; }
    this.loading = true; this.options.changed();
    let engine: Engine3dInstance | null = null;
    let owned = false;
    try {
      engine = await panoramaLoader.create();
      if (!current()) { engine?.dispose(); return; }
      if (!engine) { this.fail('unavailable'); return; }
      this.engine = engine; owned = true;
      await engine.mount(container, {
        hover: index => { if (current() && this.ready) this.command(() => engine!.setState?.({ selected: new Set(), dimmed: new Set(), hover: index ?? -1, focus: this.cursor })); },
        pick: index => { if (current() && this.ready && index !== null) this.activate(index); },
        camera: value => { if (current() && this.ready) { this.camera = normalizePanoramaCamera(value); this.options.camera(this.camera); } },
        lost: reason => { if (current()) this.fail(reason); },
        restored: () => {
          if (!current() || !this.engine || !this.selection.restore()) return;
          this.command(() => {
            engine!.setStyle(this.style());
            if (!current()) return;
            engine!.setCamera(this.camera);
            if (!current()) return;
            engine!.setState?.({ selected: new Set(), dimmed: new Set(), hover: -1, focus: this.cursor });
            if (!current()) return;
            this.ready = true; this.notice = null; this.options.changed();
          });
        },
        rendering: value => { if (current()) { this.software = value.software; this.options.changed(); } },
      });
      if (!current()) return;
      engine.setStyle(this.style());
      if (!current()) return;
      const angles = new Float32Array(hotspots.length * 2);
      hotspots.forEach((hotspot, index) => { angles[index * 2] = hotspot.yaw; angles[index * 2 + 1] = hotspot.pitch; });
      engine.setData({ source: media.localName === 'video' ? { kind: 'video', video: media } : { kind: 'image', image: media }, hotspotAngles: angles }, ++this.revision);
      if (!current()) return;
      engine.setCamera(this.camera);
      if (!current()) return;
      const resize = () => { if (!current()) return; const box = container.getBoundingClientRect(); engine!.resize(Math.max(1, box.width), Math.max(1, box.height)); };
      resize();
      if (!current()) return;
      const view = owner.defaultView;
      if (view?.ResizeObserver) { this.resize = new view.ResizeObserver(() => { if (current() && this.ready) this.command(resize); }); this.resize.observe(container); }
      const restyle = () => { if (current() && this.ready) this.command(() => engine!.setStyle(this.style())); };
      if (view?.MutationObserver) {
        this.theme = new view.MutationObserver(restyle);
        let ancestor: Element | null = this.host;
        while (ancestor) { this.theme.observe(ancestor, { attributes: true }); const root: Node = ancestor.getRootNode(); ancestor = ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null); }
      }
      for (const query of ['(prefers-reduced-motion: reduce)', '(forced-colors: active)', '(prefers-color-scheme: dark)']) {
        const mediaQuery = view?.matchMedia(query); mediaQuery?.addEventListener('change', restyle);
        if (mediaQuery) this.cleanups.push(() => mediaQuery.removeEventListener('change', restyle));
      }
      this.pending = this.loading = false; this.ready = this.selection.renderer === 'webgl'; this.options.changed();
    } catch (error) { if (!current()) { if (!owned) engine?.dispose(); return; } this.fail(engine3dFailureReason(error)); }
  }

  private style(): unknown {
    const view = this.host.ownerDocument.defaultView!;
    const computed = view.getComputedStyle(this.host);
    const canvas = this.host.ownerDocument.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const color = (name: string) => {
      const value = resolveCanvasColor(this.host, `var(${name})`, computed.color);
      if (!context) return value;
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      const rgba = context.getImageData(0, 0, 1, 1).data;
      return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]! / 255})`;
    };
    return { background: color('--lr-color-surface'), foreground: color('--lr-color-text'), muted: color('--lr-color-text-quiet'), accent: color('--lr-color-brand'), focus: color('--lr-focus-ring-color'), palette: [color('--lr-color-brand')],
      fontFamily: computed.fontFamily, fontSize: finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128), pointSize: 24, lineWidth: 1,
      devicePixelRatio: finiteRange(view.devicePixelRatio, 1, 0.25, 4), reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches, forcedColors: view.matchMedia('(forced-colors: active)').matches };
  }

  private activate(index: number): void {
    const hotspot = this.hotspots[index]; if (!hotspot || !Number.isSafeInteger(index)) return;
    this.cursor = index; this.options.changed(); this.options.pick({ hotspot, id: hotspot.id, index });
  }

  keydown(event: KeyboardEvent, direction: 'ltr' | 'rtl'): void {
    if (!this.ready || event.target !== event.currentTarget) return;
    const sign = direction === 'rtl' ? -1 : 1;
    let { yaw, pitch, fieldOfView } = this.camera;
    switch (event.key) {
      case 'ArrowLeft': yaw -= sign * Math.PI / 18; break;
      case 'ArrowRight': yaw += sign * Math.PI / 18; break;
      case 'ArrowUp': pitch += Math.PI / 18; break;
      case 'ArrowDown': pitch -= Math.PI / 18; break;
      case '+': case '=': fieldOfView -= 5; break;
      case '-': case '_': fieldOfView += 5; break;
      case 'Home': yaw = pitch = 0; fieldOfView = 75; break;
      default: return;
    }
    event.preventDefault(); event.stopPropagation();
    this.camera = normalizePanoramaCamera({ yaw, pitch, fieldOfView });
    const generation = this.generation;
    this.command(() => this.engine?.setCamera(this.camera));
    if (generation === this.generation && this.ready) this.options.camera(this.camera);
  }

  renderViewport(label: string, enabled: boolean): TemplateResult | typeof nothing {
    return enabled ? html`<div part="panorama" role="group" aria-label=${label} aria-description=${this.options.localize('panoramaInstructions')}
      tabindex=${this.ready ? '0' : '-1'} ?data-ready=${this.ready} ?hidden=${this.notice !== null}
      @keydown=${(event: KeyboardEvent) => this.keydown(event, this.options.direction())}><div part="panorama-engine" aria-hidden="true"></div></div>` : nothing;
  }

  renderNotice(): TemplateResult | typeof nothing {
    const notice = this.notice;
    if (notice) return html`<div part="panorama-notice"><p>${this.options.localize(ENGINE_3D_REASON_MESSAGE[notice.reason])}</p><p>${this.options.localize(ENGINE_3D_SHOWING_MESSAGE[notice.to])}</p></div>`;
    if (!this.loading && !this.software) return nothing;
    return html`<p part="panorama-notice">${this.options.localize(this.loading ? 'engine3dLoading' : 'engine3dSoftwareRendering')}</p>`;
  }

  renderHotspots(enabled: boolean): TemplateResult | typeof nothing {
    if (!enabled || !this.hotspots.length) return nothing;
    const start = Math.floor(this.cursor / 200) * 200, end = Math.min(this.hotspots.length, start + 200);
    const generation = this.generation;
    const current = () => this.host.isConnected && generation === this.generation;
    const move = (index: number, focus = false) => {
      if (!current()) return;
      this.cursor = Math.max(0, Math.min(this.hotspots.length - 1, index)); this.options.changed();
      if (this.ready) this.command(() => this.engine?.setState?.({ selected: new Set(), dimmed: new Set(), hover: -1, focus: this.cursor }));
      if (focus) void this.options.updated().then(() => { if (current()) this.host.shadowRoot?.querySelector<HTMLElement>(`[data-panorama-index="${this.cursor}"]`)?.focus(); });
    };
    return html`<div part="panorama-hotspots" role="group" aria-label=${this.options.localize('panoramaHotspotsLabel')}>
      ${this.hotspots.slice(start, end).map((hotspot, offset) => { const index = start + offset; return html`<button part="panorama-hotspot" type="button" data-panorama-index=${index} tabindex=${index === this.cursor ? '0' : '-1'}
        @focus=${() => move(index)} @click=${() => { if (current()) this.activate(index); }}
        @keydown=${(event: KeyboardEvent) => {
          const forward = this.options.direction() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
          const backward = this.options.direction() === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
          let next = index;
          if (event.key === forward || event.key === 'ArrowDown') next++;
          else if (event.key === backward || event.key === 'ArrowUp') next--;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = this.hotspots.length - 1;
          else return;
          event.preventDefault(); move(next, true);
        }}>${hotspot.label || hotspot.id}</button>`; })}
      ${this.hotspots.length > 200 ? html`<div role="group" aria-label=${this.options.localize('paginationLabel')}><button part="panorama-page" type="button" ?disabled=${start === 0} @click=${() => move(start - 200)}>${this.options.localize('previous')}</button><button part="panorama-page" type="button" ?disabled=${end === this.hotspots.length} @click=${() => move(start + 200)}>${this.options.localize('next')}</button></div>` : nothing}
    </div>`;
  }
}
