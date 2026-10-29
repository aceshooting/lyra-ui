import { createMapSceneSourceOwner } from '../src/components/media/map/map-scene-source-snapshot.js';

export function sceneSourceHarness(maxEncodedBytes = 64) {
  const connection = Object.freeze({});
  const owner = Object.freeze({});
  let revision = 1;
  let liveBytes = 0;
  let allocations = 0;
  let releases = 0;
  let resolutions = 0;
  const hooks: {
    reserve?: (bytes: number) => void;
    resolve?: (source: string) => { readonly url: string; readonly owner: object } | null;
    release?: () => void;
    current?: () => void;
  } = {};
  const request = () => Object.freeze({ connection, revision });
  const isCurrent = (candidate: { readonly connection: object; readonly revision: number }) => {
    const result = candidate.connection === connection && candidate.revision === revision;
    hooks.current?.();
    return result;
  };
  const sources = createMapSceneSourceOwner({ connection, isCurrent, maxEncodedBytes,
    reserveBytes(byteLength: number) {
      hooks.reserve?.(byteLength);
      allocations++;
      liveBytes += byteLength;
      let released = false;
      return { release() {
        if (released) throw new Error('Reservation released twice');
        released = true;
        releases++;
        liveBytes -= byteLength;
        hooks.release?.();
      } };
    },
    resolveUrl(source: string) {
      resolutions++;
      return hooks.resolve ? hooks.resolve(source) : { url: `https://example.invalid/${source}`, owner };
    },
  });
  return { sources, connection, owner, request, isCurrent, hooks,
    next() { revision++; return request(); },
    get liveBytes() { return liveBytes; },
    get allocations() { return allocations; },
    get releases() { return releases; },
    get resolutions() { return resolutions; },
  };
}

export function sceneMarker(id = 'target', longitude = 0) {
  return { id, label: id, kind: 'marker' as const, position: { lngLat: [longitude, 0] as [number, number] } };
}

export function sceneModel(id = 'model', source = { format: 'glb' as const, bytes: new Uint8Array([1, 2, 3]) }) {
  return { id, label: id, kind: 'model' as const, position: { lngLat: [0, 0] as [number, number] }, source };
}

export function scenePath(id = 'route') {
  return { id, label: id, kind: 'path' as const,
    positions: [{ lngLat: [0, 0] as [number, number] }, { lngLat: [10, 0] as [number, number] }] };
}

export function sceneArc(id = 'arc') {
  return { id, label: id, kind: 'arc' as const,
    start: { lngLat: [0, 0] as [number, number] }, end: { lngLat: [10, 0] as [number, number] }, height: 100 };
}
