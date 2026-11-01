import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { observeReducedMotion } from '../../../internal/motion-observer.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import type { MapLibreMapCapability } from './map-loader.js';
import type { createMapSceneOwner } from './map-scene-owner.js';
import type { SceneRenderInput, SceneRenderPublication, SceneResolvedPresentation, SceneViewportInput } from './map-scene-render-contract.js';

type SceneOwner = ReturnType<typeof createMapSceneOwner>;
type Rgba = readonly [number, number, number, number];

export interface MapSceneRenderBridge {
  dispose(): void;
  invalidateStyle(): void;
  setVisible(visible: boolean): void;
  requestFrame(): void;
}
export interface MapSceneBridgeRuntime {
  createSceneBridge(map: MapLibreMapCapability, host: {
    readonly signal: AbortSignal;
    isCurrent(): boolean;
    captureRenderInput(): SceneRenderInput;
    subscribeRenderInput(listener: () => void): () => void;
    onState(value: unknown): void;
    onError(code: unknown): void;
  }): MapSceneRenderBridge;
}
export interface MapSceneRenderController {
  sync(): void;
  refreshPresentation(): void;
  refreshAllocation(): void;
  invalidateStyle(): void;
  dispose(): void;
}

function resolvedColor(element: Element, expression: string): Rgba | undefined {
  const color = resolveCanvasColor(element, expression, '');
  if (!color) return undefined;
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(color);
  if (match) {
    const channels: Rgba = [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255,
      match[4] === undefined ? 1 : Number(match[4])];
    if (channels.every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return channels;
  }
  const canvas = element.ownerDocument.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
  if (!context) return undefined;
  context.fillStyle = color; context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return [pixel[0]! / 255, pixel[1]! / 255, pixel[2]! / 255, pixel[3]! / 255];
}

/** One native installation; accepted intent and revision counters remain on the connection owner. */
export function createMapSceneRenderController(options: {
  readonly element: HTMLElement;
  readonly map: MapLibreMapCapability;
  readonly container: HTMLElement;
  readonly owner: SceneOwner;
  readonly accentToken: string;
  readonly loadBridge: () => Promise<MapSceneBridgeRuntime>;
  readonly isCurrent: () => boolean;
}): MapSceneRenderController {
  const { element, map, container, owner } = options;
  const document = element.ownerDocument, view = document.defaultView;
  const abort = new (view?.AbortController ?? AbortController)(), releases: (() => void)[] = [];
  let closed = false, intersecting = false, visibilityObserved = false, intersectionObserved = false;
  let allocationRead: object = {};
  let bridge: MapSceneRenderBridge | undefined, visible: boolean | undefined;
  let loading = false, attemptedRevision: number | undefined;
  let preparing = false;

  function current(): boolean {
    return !closed && view !== null && element.isConnected && element.ownerDocument === document && options.isCurrent();
  }
  function demand(): boolean { return owner.captureAccepted().objects.some(row => row.kind === 'marker'); }
  function keep(release: () => void): void {
    if (!current()) { try { release(); } catch { /* Retire an observer acquired during reentry. */ } }
    else releases.push(release);
  }
  function syncVisibility(): void {
    if (!current() || !bridge) return;
    const publication = owner.captureRenderPublication();
    const next = visibilityObserved && intersectionObserved && intersecting && document.visibilityState !== 'hidden' && !document.hidden &&
      publication.phase === 'resolved' && publication.input.allocation !== undefined && demand();
    if (visible === next) return;
    visible = next;
    try { bridge.setVisible(next); } catch { /* A failed optional renderer does not retire the basemap. */ }
  }
  function preparePublication(expected: SceneRenderPublication): void {
    try {
      const colors = new Map<string, Rgba>();
      const markers: { id: string; rgba: Rgba }[] = [];
      for (const row of expected.accepted.objects) {
        if (row.kind !== 'marker') continue;
        const expression = row.color ?? `var(${options.accentToken})`;
        let rgba = colors.get(expression);
        if (!rgba) {
          rgba = resolvedColor(element, expression);
          if (!rgba) { if (current()) owner.failPresentation(expected); return; }
          colors.set(expression, rgba);
        }
        if (!current() || owner.captureRenderPublication() !== expected) return;
        markers.push({ id: row.id, rgba });
      }
      const presentation: SceneResolvedPresentation = { markers, reducedMotion: prefersReducedMotion(element) };
      if (current()) owner.commitPresentation(expected, presentation);
    } catch {
      if (current()) owner.failPresentation(expected);
    }
  }
  function prepare(): void {
    if (!current() || preparing) return;
    preparing = true;
    try {
      // Reentrant reads can consume a subscriber's newer baseline before this preparation exits.
      // Drain that pending publication synchronously, with a bound against hostile read loops.
      for (let pass = 0; pass < 32 && current(); pass++) {
        const expected = owner.captureRenderPublication();
        if (expected.phase !== 'pending') return;
        preparePublication(expected);
        if (owner.captureRenderPublication() === expected) return;
      }
      if (current()) owner.failPresentation(owner.captureRenderPublication());
    } finally { preparing = false; }
  }
  function refreshAllocation(): void {
    if (!current() || !demand()) return;
    const attempt = {}; allocationRead = attempt;
    const active = () => current() && allocationRead === attempt;
    let allocation: SceneViewportInput | undefined;
    try {
      const getContainer = map.getContainer; if (!active()) return;
      const getCanvas = map.getCanvas; if (!active()) return;
      const getPixelRatio = map.getPixelRatio; if (!active()) return;
      const getPadding = map.getPadding; if (!active()) return;
      if (typeof getContainer === 'function' && typeof getCanvas === 'function' &&
        typeof getPixelRatio === 'function' && typeof getPadding === 'function') {
        const nativeContainer = getContainer.call(map); if (!active()) return;
        const canvas = getCanvas.call(map); if (!active()) return;
        const width = nativeContainer.clientWidth; if (!active()) return;
        const height = nativeContainer.clientHeight; if (!active()) return;
        const pixelRatio = getPixelRatio.call(map); if (!active()) return;
        const padding = getPadding.call(map); if (!active()) return;
        const top = padding.top; if (!active()) return;
        const right = padding.right; if (!active()) return;
        const bottom = padding.bottom; if (!active()) return;
        const left = padding.left; if (!active()) return;
        const backingWidth = canvas.width; if (!active()) return;
        const backingHeight = canvas.height; if (!active()) return;
        const sameContainer = map.getContainer?.() === nativeContainer; if (!active()) return;
        const sameCanvas = map.getCanvas() === canvas; if (!active()) return;
        const sameWidth = nativeContainer.clientWidth === width; if (!active()) return;
        const sameHeight = nativeContainer.clientHeight === height; if (!active()) return;
        const sameBackingWidth = canvas.width === backingWidth; if (!active()) return;
        const sameBackingHeight = canvas.height === backingHeight; if (!active()) return;
        if (sameContainer && sameCanvas && sameWidth && sameHeight && sameBackingWidth && sameBackingHeight &&
          nativeContainer === container && nativeContainer.ownerDocument === document && canvas.ownerDocument === document &&
          Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0 &&
          Number.isFinite(pixelRatio) && pixelRatio > 0 && Number.isSafeInteger(backingWidth) && backingWidth > 0 &&
          Number.isSafeInteger(backingHeight) && backingHeight > 0 && backingWidth === Math.round(width * pixelRatio) &&
          backingHeight === Math.round(height * pixelRatio) && [top, right, bottom, left].every(value => Number.isFinite(value) && value >= 0)) {
          allocation = { width, height, pixelRatio, padding: { top, right, bottom, left } };
        }
      }
    } catch { /* Missing or failed public capabilities do not authorize an allocation. */ }
    if (!active()) return;
    owner.setViewport(allocation);
    if (active()) syncVisibility();
  }
  function startBridge(): void {
    if (!current() || !demand() || bridge || loading) return;
    const revision = owner.captureAccepted().acceptedSceneRevision;
    if (attemptedRevision === revision) return;
    attemptedRevision = revision; loading = true;
    void options.loadBridge().then(runtime => {
      if (!current() || !demand()) return;
      let candidate: MapSceneRenderBridge | undefined;
      try {
        const created = runtime.createSceneBridge(map, {
          signal: abort.signal, isCurrent: current,
          captureRenderInput: () => owner.captureRenderPublication().input,
          subscribeRenderInput: listener => owner.subscribeRenderPublication(listener),
          // Native installation and unrevisioned diagnostics cannot establish scene completion.
          onState: () => {}, onError: () => {},
        });
        candidate = created;
        if (!created || !['dispose', 'invalidateStyle', 'setVisible', 'requestFrame'].every(name =>
          typeof Reflect.get(created, name) === 'function')) throw new TypeError('Map scene renderer unavailable');
        if (!current() || !demand()) { created.dispose(); return; }
        bridge = created; visible = undefined; syncVisibility();
      } catch {
        try { candidate?.dispose(); } catch { /* Best-effort cleanup of a failed optional factory. */ }
      }
    }, () => undefined).finally(() => {
      loading = false;
      if (current() && owner.captureAccepted().acceptedSceneRevision !== attemptedRevision) startBridge();
    });
  }
  function sync(): void {
    if (!current()) return;
    prepare(); syncVisibility(); startBridge();
  }
  function refreshPresentation(): void {
    if (!current() || !demand()) return;
    owner.invalidatePresentation(); sync();
  }
  function dispose(): void {
    if (closed) return;
    closed = true; allocationRead = {};
    const previous = bridge; bridge = undefined;
    for (const release of releases.splice(0)) {
      try { release(); } catch { /* Release independent observations even if one peer refuses. */ }
    }
    abort.abort();
    try { previous?.dispose(); } catch { /* Optional cleanup cannot prevent native map removal. */ }
  }

  keep(owner.subscribeRenderPublication(sync));
  for (const event of ['move', 'resize'] as const) {
    try { keep(() => { map.off?.(event, refreshAllocation); }); if (current()) {
      Reflect.apply(map.on, map, [event, refreshAllocation]);
      if (!current()) map.off?.(event, refreshAllocation);
    } }
    catch { /* Other allocation notifications may still establish current dimensions. */ }
  }
  try {
    const Observer = view?.IntersectionObserver;
    if (Observer) {
      const observer = new Observer(entries => {
        if (!current()) return;
        for (const entry of entries) if (entry.target === container) intersecting = entry.isIntersecting;
        syncVisibility();
      });
      keep(() => observer.disconnect());
      if (current()) { observer.observe(container); intersectionObserved = current(); }
    }
  } catch { intersecting = false; }
  keep(() => document.removeEventListener('visibilitychange', syncVisibility));
  try { if (current()) {
    document.addEventListener('visibilitychange', syncVisibility); visibilityObserved = current();
  } }
  catch { intersecting = false; }
  try { keep(observeReducedMotion(element, refreshPresentation)); } catch { /* Motion is also read on presentation refresh. */ }
  refreshAllocation(); sync();
  return { sync, refreshPresentation, refreshAllocation,
    invalidateStyle() { if (current()) { try { bridge?.invalidateStyle(); } catch { /* The native owner remains authoritative. */ } } },
    dispose };
}
