import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { observeReducedMotion } from '../../../internal/motion-observer.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import type { MapLibreMapCapability } from './map-loader.js';
import { createMapSceneLineLayer } from './map-scene-line-layer.js';
import type { SceneLineRequest } from './map-scene-line-layer.js';
import { buildSceneLineData } from './map-scene-lines.js';
import type { SceneLineObject } from './map-scene-lines.js';
import type { createMapSceneOwner, SceneAcceptedSnapshot } from './map-scene-owner.js';
import type { SceneRenderInput, SceneRenderPublication, SceneResolvedPresentation, SceneViewportInput } from './map-scene-render-contract.js';
import type { SceneDrawOutcome } from './map-scene-status.js';

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
  /** The current native style finished loading, including after a replacement. */
  styleReady(): void;
  /** What each renderer established for the current accepted revision. */
  captureOutcomes(): { readonly markers: SceneDrawOutcome; readonly lines: SceneDrawOutcome };
  dispose(): void;
}
type BridgeReport = { readonly revision: number; readonly outcome: SceneDrawOutcome };

const isLine = (row: { readonly kind: string }): row is SceneLineObject => row.kind === 'path' || row.kind === 'arc';
function channel(value: number): number { return Math.round(Math.min(1, Math.max(0, value)) * 255); }

/** Interprets a renderer-owned marker state report without trusting its shape. */
function bridgeReport(value: unknown): BridgeReport | undefined {
  try {
    if (value === null || typeof value !== 'object') return undefined;
    const state: unknown = Reflect.get(value, 'state'), revision: unknown = Reflect.get(value, 'acceptedSceneRevision');
    const code: unknown = Reflect.get(value, 'code');
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return undefined;
    if (state === 'installed') return { revision, outcome: { state: 'drawn' } };
    if (state === 'pending') return { revision, outcome: { state: 'pending' } };
    if (state === 'unavailable') return { revision, outcome: { state: 'failed',
      code: code === 'limit' ? 'limit' : code === 'context-lost' ? 'context-lost' : 'engine' } };
  } catch { /* A hostile report establishes nothing. */ }
  return undefined;
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
  /** Whether the native style currently accepts source and layer mutations. */
  readonly styleLoaded?: () => boolean;
  /** Called after an outcome from `captureOutcomes()` may have changed. */
  readonly onStatusChange?: () => void;
}): MapSceneRenderController {
  const { element, map, container, owner } = options;
  const document = element.ownerDocument, view = document.defaultView;
  const abort = new (view?.AbortController ?? AbortController)(), releases: (() => void)[] = [];
  let closed = false, intersecting = false, visibilityObserved = false, intersectionObserved = false;
  let allocationRead: object = {};
  let bridge: MapSceneRenderBridge | undefined, visible: boolean | undefined;
  let loading = false, attemptedRevision: number | undefined;
  let preparing = false;
  let bridgeFailure: number | undefined, report: BridgeReport | undefined, markerContextLost = false;
  let linesFor: SceneAcceptedSnapshot | undefined, lineColorsStale = true;

  function current(): boolean {
    return !closed && view !== null && element.isConnected && element.ownerDocument === document && options.isCurrent();
  }
  function demand(): boolean { return owner.captureAccepted().objects.some(row => row.kind === 'marker'); }
  function statusChanged(): void {
    if (!current()) return;
    try { options.onStatusChange?.(); } catch { /* Status observers cannot retire native rendering. */ }
  }
  const lines = createMapSceneLineLayer({ map, isCurrent: () => current(),
    styleLoaded: () => { try { return options.styleLoaded?.() ?? map.isStyleLoaded?.() === true; } catch { return false; } },
    changed: statusChanged });
  function syncLines(): void {
    if (!current()) return;
    const accepted = owner.captureAccepted();
    if (accepted === linesFor && !lineColorsStale) return;
    const objects = accepted.objects.filter(isLine);
    if (objects.length === 0) { linesFor = accepted; lineColorsStale = false; lines.update(undefined); return; }
    const colors = new Map<string, string>(), resolved = new Map<string, Rgba | undefined>();
    let request: SceneLineRequest | undefined;
    try {
      for (const row of objects) {
        const expression = row.color ?? `var(${options.accentToken})`;
        if (!resolved.has(expression)) resolved.set(expression, resolvedColor(element, expression));
        if (!current() || owner.captureAccepted() !== accepted) return;
        const rgba = resolved.get(expression);
        if (!rgba) { request = { revision: accepted.acceptedSceneRevision, failure: 'engine' }; break; }
        colors.set(row.id, `rgba(${channel(rgba[0])}, ${channel(rgba[1])}, ${channel(rgba[2])}, ${rgba[3]})`);
      }
      if (!request) {
        const data = buildSceneLineData(objects, colors);
        request = data ? { revision: accepted.acceptedSceneRevision, objects, data } :
          { revision: accepted.acceptedSceneRevision, failure: 'limit' };
      }
    } catch { request = { revision: accepted.acceptedSceneRevision, failure: 'engine' }; }
    if (!current() || owner.captureAccepted() !== accepted) return;
    linesFor = accepted; lineColorsStale = false;
    lines.update(request);
  }
  function markerOutcome(revision: number): SceneDrawOutcome {
    if (!demand()) return { state: 'none' };
    if (bridgeFailure === revision) return { state: 'failed', code: 'engine' };
    if (markerContextLost) return { state: 'failed', code: 'context-lost' };
    return report?.revision === revision ? report.outcome : { state: 'pending' };
  }
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
          // Revisioned installation reports establish installed markers, never visible pixels.
          onState: value => {
            const next = current() && bridge === created ? bridgeReport(value) : undefined;
            if (!next) return;
            report = next;
            if (next.outcome.state === 'drawn') markerContextLost = false;
            statusChanged();
          },
          onError: code => {
            if (!current() || bridge !== created || code !== 'context-lost') return;
            markerContextLost = true; statusChanged();
          },
        });
        candidate = created;
        if (!created || !['dispose', 'invalidateStyle', 'setVisible', 'requestFrame'].every(name =>
          typeof Reflect.get(created, name) === 'function')) throw new TypeError('Map scene renderer unavailable');
        if (!current() || !demand()) { created.dispose(); return; }
        bridge = created; visible = undefined; syncVisibility();
      } catch {
        try { candidate?.dispose(); } catch { /* Best-effort cleanup of a failed optional factory. */ }
        if (current()) { bridgeFailure = revision; statusChanged(); }
      }
    }, () => { if (current()) { bridgeFailure = revision; statusChanged(); } }).finally(() => {
      loading = false;
      if (current() && owner.captureAccepted().acceptedSceneRevision !== attemptedRevision) startBridge();
    });
  }
  /** Line-only intent keeps this installation but retires marker rendering. */
  function retireBridge(): void {
    const previous = bridge;
    if (!previous || demand()) return;
    bridge = undefined; visible = undefined; report = undefined; markerContextLost = false; attemptedRevision = undefined;
    try { previous.dispose(); } catch { /* Optional cleanup cannot retire line rendering. */ }
  }
  function sync(): void {
    if (!current()) return;
    retireBridge(); prepare(); syncVisibility(); startBridge(); syncLines();
  }
  function refreshPresentation(): void {
    if (!current()) return;
    lineColorsStale = true;
    if (demand()) owner.invalidatePresentation();
    sync();
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
    lines.dispose();
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
    invalidateStyle() {
      if (!current()) return;
      try { bridge?.invalidateStyle(); } catch { /* The native owner remains authoritative. */ }
      lines.invalidateStyle();
    },
    styleReady() { if (current()) lines.styleReady(); },
    captureOutcomes() {
      const revision = owner.captureAccepted().acceptedSceneRevision, captured = lines.capture();
      return { markers: markerOutcome(revision),
        lines: captured.revision === revision || captured.outcome.state === 'none' ? captured.outcome : { state: 'pending' } };
    },
    dispose };
}
