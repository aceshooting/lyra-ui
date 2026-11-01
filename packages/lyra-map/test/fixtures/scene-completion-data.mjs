export function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export const token = () => Object.freeze({});
export const position = (longitude = 0) => ({ lngLat: [longitude, 0], altitude: 7, altitudeReference: 'sea-level' });
export const member = (id = 'anchor', kind = 'marker', change = {}) => ({ id, kind, rowToken: token(),
  target: kind === 'marker' || kind === 'model' ? { token: token(), acceptedPositionRevision: 1, position: position() } : undefined,
  ...change });
export function completionInput(change = {}) {
  const members = change.members ?? [member()];
  const phase = change.phase ?? 'resolved', acceptedSceneRevision = change.acceptedSceneRevision ?? 1;
  const renderInput = change.renderInput ?? freeze({ acceptedSceneRevision, presentationRevision: 1,
    allocation: { revision: 1, width: 640, height: 480, pixelRatio: 1.25, padding: { top: 3, right: 5, bottom: 7, left: 11 } },
    reducedMotion: true, markers: phase === 'resolved' ? members.filter(row => row.kind === 'marker').map(row => ({
      id: row.id, position: { ...row.target.position, lngLat: [...row.target.position.lngLat] },
      acceptedPositionRevision: row.target.acceptedPositionRevision, radiusCss: 6, rgba: [0.2, 0.4, 0.8, 0.5]
    })) : [] });
  return { publicationToken: token(), stateToken: token(), phase, acceptedSceneRevision, renderInput, members, ...change };
}
export const cameraFacts = (change = {}) => ({ latitude: 0, zoom: 4, pitch: 0,
  explicitBounds: false, explicitZoomLimits: false, nativeBounds: false, nativeMinZoom: 0, nativeMaxZoom: 22,
  terrain: false, canPan: true, canObserveMotion: true, canStop: true, moving: false, hasProjection: true, ...change });
export function frameData(input, change = {}) {
  const allocation = input.renderInput.allocation;
  return freeze({ stamp: { ownerToken: token(), contextEpoch: 1, styleRevision: 1, samplingViewRevision: 1,
    layoutRevision: 1, allocationRevision: allocation.revision, acceptedSceneRevision: input.acceptedSceneRevision,
    installedSceneRevision: input.acceptedSceneRevision, placementRevision: 1, paintRevision: 1 },
  width: allocation.width, height: allocation.height, pixelRatio: allocation.pixelRatio, padding: { ...allocation.padding },
  projectionTransition: 0, cameraProfile: { ...cameraFacts(), width: allocation.width, height: allocation.height,
    padding: { ...allocation.padding }, nativeControlTransition: 0 }, ...change });
}
