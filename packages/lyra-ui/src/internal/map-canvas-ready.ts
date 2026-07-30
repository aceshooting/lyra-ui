type MapCanvasReadyCallback = (canvas: HTMLCanvasElement) => void;

const callbacks = new WeakMap<object, MapCanvasReadyCallback>();

/** Registers an internal synchronous handoff for composites that delegate a landmark to a map. */
export function setMapCanvasReadyCallback(
  map: object,
  callback: MapCanvasReadyCallback | null,
): void {
  if (callback) callbacks.set(map, callback);
  else callbacks.delete(map);
}

/** Called immediately after MapLibre constructs its semantic canvas. */
export function notifyMapCanvasReady(map: object, canvas: HTMLCanvasElement): void {
  callbacks.get(map)?.(canvas);
}
