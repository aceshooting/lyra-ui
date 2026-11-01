const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const reject = () => { throw new TypeError('Scene completion data unavailable.'); };
function record(value, names) {
  if (!value || typeof value !== 'object') reject();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) reject();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(key => !names.includes(key))) reject();
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    result[name] = descriptor.value;
  }
  return result;
}
function array(value, maximum, exact) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) reject();
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum || exact !== undefined && length !== exact) reject();
  if (Reflect.ownKeys(value).length !== length + 1) reject();
  return Array.from({ length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    return descriptor.value;
  });
}
function token(value) {
  record(value, []);
  if (!Object.isFrozen(value)) reject();
  return value;
}
function position(value, optional = false) {
  let names = ['lngLat', 'altitude', 'altitudeReference'];
  if (optional) names = names.filter(name => Object.hasOwn(value ?? {}, name));
  if (!names.includes('lngLat')) reject();
  const data = record(value, names), lngLat = array(data.lngLat, 2, 2);
  const altitude = optional && data.altitude === undefined ? 0 : data.altitude;
  const altitudeReference = optional && data.altitudeReference === undefined ? 'sea-level' : data.altitudeReference;
  if (!lngLat.every(finite) || lngLat[0] < -180 || lngLat[0] >= 180 || Math.abs(lngLat[1]) > 90 ||
      !finite(altitude) || altitude < -12000 || altitude > 100000000 || !['sea-level', 'terrain'].includes(altitudeReference)) reject();
  return Object.freeze({ lngLat: Object.freeze(lngLat), altitude, altitudeReference });
}
function identifier(value) {
  if (typeof value !== 'string' || value.length > 1024 || !value.trim()) reject();
  return value;
}
function allocation(value) {
  if (value === undefined) return;
  const data = record(value, ['revision', 'width', 'height', 'pixelRatio', 'padding']);
  if (!positive(data.revision) || ![data.width, data.height, data.pixelRatio].every(number => finite(number) && number > 0) ||
      ![data.width * data.pixelRatio, data.height * data.pixelRatio].every(number => positive(Math.round(number)))) reject();
  const padding = record(data.padding, ['top', 'right', 'bottom', 'left']);
  if (!Object.values(padding).every(number => finite(number) && number >= 0)) reject();
}
function render(value) {
  const data = record(value, ['acceptedSceneRevision', 'presentationRevision', 'allocation', 'reducedMotion', 'markers']);
  if (!Number.isSafeInteger(data.acceptedSceneRevision) || data.acceptedSceneRevision < 0 || !positive(data.presentationRevision) || typeof data.reducedMotion !== 'boolean') reject();
  allocation(data.allocation);
  const ids = new Set();
  const markers = array(data.markers, 2000).map(value => {
    const row = record(value, ['id', 'position', 'acceptedPositionRevision', 'radiusCss', 'rgba']);
    identifier(row.id);
    if (ids.has(row.id) || !positive(row.acceptedPositionRevision) || !finite(row.radiusCss) || row.radiusCss <= 0) reject();
    ids.add(row.id);
    if (!array(row.rgba, 4, 4).every(number => finite(number) && number >= 0 && number <= 1)) reject();
    return { id: row.id, position: position(row.position, true), acceptedPositionRevision: row.acceptedPositionRevision };
  });
  return { ...data, markers };
}
const samePosition = (first, second) => first.altitude === second.altitude && first.altitudeReference === second.altitudeReference &&
  first.lngLat[0] === second.lngLat[0] && first.lngLat[1] === second.lngLat[1];

/** Copies bounded neutral membership while preserving the exact render packet authority. */
export function readCompletionInput(value, exactRenderInput) {
  try {
    const data = record(value, ['publicationToken', 'stateToken', 'phase', 'acceptedSceneRevision', 'renderInput', 'members']);
    token(data.publicationToken); token(data.stateToken);
    if (!['pending', 'resolved', 'unavailable'].includes(data.phase) || data.renderInput !== exactRenderInput) return undefined;
    const packet = render(data.renderInput);
    if (!Number.isSafeInteger(data.acceptedSceneRevision) || data.acceptedSceneRevision < 0 || data.acceptedSceneRevision !== packet.acceptedSceneRevision) return undefined;
    const ids = new Set(), rows = new Set(), targets = new Set();
    const members = array(data.members, 2000).map(value => {
      const row = record(value, ['id', 'kind', 'rowToken', 'target']);
      identifier(row.id); token(row.rowToken);
      if (ids.has(row.id) || rows.has(row.rowToken) || !['marker', 'path', 'arc', 'model'].includes(row.kind)) reject();
      ids.add(row.id); rows.add(row.rowToken);
      let target;
      if (row.kind === 'marker' || row.kind === 'model') {
        const source = record(row.target, ['token', 'acceptedPositionRevision', 'position']); token(source.token);
        if (targets.has(source.token) || !positive(source.acceptedPositionRevision)) reject();
        targets.add(source.token);
        target = Object.freeze({ token: source.token, acceptedPositionRevision: source.acceptedPositionRevision, position: position(source.position) });
      } else if (row.target !== undefined) reject();
      return Object.freeze({ id: row.id, kind: row.kind, rowToken: row.rowToken, target });
    });
    if (data.acceptedSceneRevision === 0 && members.length !== 0) return undefined;
    if (data.phase !== 'resolved' && packet.markers.length !== 0) return undefined;
    if (data.phase === 'resolved') {
      const markers = new Map(packet.markers.map(row => [row.id, row]));
      const expected = members.filter(row => row.kind === 'marker');
      if (markers.size !== expected.length) return undefined;
      for (const row of expected) {
        const marker = markers.get(row.id);
        if (!marker || marker.acceptedPositionRevision !== row.target.acceptedPositionRevision || !samePosition(marker.position, row.target.position)) return undefined;
      }
    }
    return Object.freeze({ ...data, members: Object.freeze(members) });
  } catch { return undefined; }
}

/** Joins independently qualified anchor and object evidence without inventing visibility. */
export function createTargetProjection(value) {
  try {
    const data = record(value, ['acceptedPositionRevision', 'status', 'point', 'anchor', 'object']);
    if (!positive(data.acceptedPositionRevision) || !['resolved', 'terrain-pending', 'terrain-unavailable', 'model-pending',
      'visibility-pending', 'clipped', 'occluded', 'unavailable'].includes(data.status)) return undefined;
    let point;
    if (data.point !== undefined) {
      point = array(data.point, 2, 2);
      if (!point.every(finite)) return undefined;
      point = Object.freeze(point);
    }
    if (![data.anchor, data.object].every(value => value === undefined || typeof value === 'boolean')) return undefined;
    let status = data.status;
    if (status === 'resolved') {
      if (!point) return undefined;
      if (data.anchor === false || data.object === false) status = 'occluded';
      else if (data.anchor !== true || data.object !== true) status = 'visibility-pending';
    }
    return Object.freeze({ acceptedPositionRevision: data.acceptedPositionRevision, status,
      ...(point ? { point } : {}), visible: status === 'resolved' });
  } catch { return undefined; }
}

export function nextPaintSerial(previous) {
  return Number.isSafeInteger(previous) && previous >= 0 && previous < Number.MAX_SAFE_INTEGER ? previous + 1 : undefined;
}
