import { mapCustomLayerAttachment, type MapCustomLayerLease } from './map-custom-layer-attachment.js';
import type { LyraMapCustomLayer, LyraMapCustomLayerCode, LyraMapCustomLayerContext, LyraMapCustomLayerHandle, LyraMapCustomLayerOptions,
  LyraMapCustomLayerState, LyraMapCustomLayerStatus } from './map-custom-layer-types.js';
import { isMapSceneLayerHandle, loadMapSceneLayerRuntime, type MapSceneLayerHandle } from './map-scene-layer-runtime.js';

type NativeListener = (event: unknown) => void;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function ownValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor && !('value' in descriptor)) throw new TypeError(`Map custom layer ${key} must be a data property.`);
  return descriptor?.value;
}

/** Snapshots the descriptor fields once; `create` keeps the caller's receiver. */
function admitLayer(layer: unknown): LyraMapCustomLayer {
  if (typeof layer !== 'object' || layer === null) throw new TypeError('A map custom layer must be an object.');
  const id = ownValue(layer, 'id'), label = ownValue(layer, 'label'), before = ownValue(layer, 'before');
  const create = (layer as { create?: unknown }).create;
  if (!text(id) || !text(label) || typeof create !== 'function' || (before !== undefined && !text(before))) {
    throw new TypeError('A map custom layer needs a nonblank id and label, a create() function and an optional nonblank before.');
  }
  return Object.freeze({ id, label, ...(before === undefined ? {} : { before }),
    create: (context: LyraMapCustomLayerContext) => Reflect.apply(create, layer, [context]) as ReturnType<LyraMapCustomLayer['create']> });
}

function nativeCall(map: object, method: 'on' | 'off', name: string, listener: NativeListener): void {
  const callable: unknown = Reflect.get(map, method);
  if (typeof callable === 'function') Reflect.apply(callable, map, [name, listener]);
}

function eventPoint(event: unknown): readonly [number, number] | undefined {
  if (typeof event !== 'object' || event === null) return undefined;
  const point: unknown = Reflect.get(event, 'point');
  if (typeof point !== 'object' || point === null) return undefined;
  const x: unknown = Reflect.get(point, 'x'), y: unknown = Reflect.get(point, 'y');
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? [x, y] : undefined;
}

/** Owns one custom layer on one `lr-map` for the map's connected lifetime. */
export function createMapCustomLayerController(element: HTMLElement, input: LyraMapCustomLayer,
  options: LyraMapCustomLayerOptions = {}): LyraMapCustomLayerHandle {
  const layer = admitLayer(input);
  const attachment = mapCustomLayerAttachment(element);
  if (!attachment) throw new TypeError('addMapCustomLayer() requires a connected lr-map.');
  const onStateChange = options.onStateChange;
  let status: LyraMapCustomLayerStatus = Object.freeze({ state: 'loading' });
  let removed = false, visible = true, attempt = 0;
  let engine: MapSceneLayerHandle | undefined, engineMap: object | undefined, abort: AbortController | undefined;
  let lease: MapCustomLayerLease | undefined;

  function setStatus(state: LyraMapCustomLayerState, code?: LyraMapCustomLayerCode): void {
    if (removed && state !== 'removed') return;
    if (status.state === state && status.code === code) return;
    status = Object.freeze(code === undefined ? { state } : { state, code });
    try { onStateChange?.(status); } catch { /* Observers cannot retire the layer. */ }
  }
  const onClick: NativeListener = event => {
    const target = engine, point = eventPoint(event);
    if (!target || !visible || removed || !point) return;
    void target.pick(point).then(hit => {
      if (!hit || target !== engine || removed || typeof event !== 'object' || event === null) return;
      lease?.activate({ id: hit.id, layerId: layer.id, ...(hit.position ? { position: hit.position } : {}) }, event);
    }, () => undefined);
  };
  function stop(): void {
    attempt++;
    abort?.abort(); abort = undefined;
    const previous = engine; engine = undefined;
    try { previous?.dispose(); } catch { /* Optional cleanup cannot keep the layer. */ }
    if (engineMap) { try { nativeCall(engineMap, 'off', 'click', onClick); } catch { /* The native map may be gone. */ } }
    engineMap = undefined;
  }
  function start(map: object): void {
    stop();
    const ticket = attempt, controller = abort = new AbortController();
    engineMap = map;
    setStatus('loading');
    try { nativeCall(map, 'on', 'click', onClick); } catch { /* Picking is optional. */ }
    loadMapSceneLayerRuntime().then(runtime => {
      if (removed || ticket !== attempt) return;
      let created: unknown;
      try {
        created = runtime.createSceneLayer(map, layer, { signal: controller.signal,
          onState: (state, code) => { if (!removed && ticket === attempt) setStatus(state, code); },
          reducedMotion: () => lease?.reducedMotion() ?? false });
        if (!isMapSceneLayerHandle(created)) throw new TypeError('Map custom layers are unavailable');
      } catch {
        controller.abort();
        if (isMapSceneLayerHandle(created)) { try { created.dispose(); } catch { /* Best effort. */ } }
        if (ticket === attempt) setStatus('unavailable', 'engine');
        return;
      }
      if (removed || ticket !== attempt) { created.dispose(); return; }
      engine = created;
      if (!visible) created.setVisible(false);
    }, () => { if (!removed && ticket === attempt) setStatus('unavailable', 'engine'); });
  }
  function remove(): void {
    if (removed) return;
    stop(); removed = true;
    const owned = lease; lease = undefined; owned?.release();
    status = Object.freeze({ state: 'removed' });
    try { onStateChange?.(status); } catch { /* Observers cannot resurrect the layer. */ }
  }

  lease = attachment.acquire({
    styleReady(map) {
      if (removed) return;
      if (engineMap === map) { engine?.styleReady(); return; }
      start(map);
    },
    styleInvalidated() { if (!removed) engine?.invalidateStyle(); },
    mapRemoved() { if (removed) return; stop(); setStatus('loading'); },
    released: remove,
  });
  const initial = lease.nativeMap();
  if (initial) start(initial);

  return Object.freeze({
    id: layer.id,
    get status() { return status; },
    requestRender() { if (!removed) engine?.requestFrame(); },
    setVisible(value: boolean) { visible = Boolean(value); if (!removed) engine?.setVisible(visible); },
    async pick(point: readonly [number, number]) {
      const target = engine;
      if (!target || removed) return null;
      const hit = await target.pick(point);
      return target === engine && !removed ? hit : null;
    },
    remove,
  });
}
