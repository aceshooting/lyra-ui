import { createTargetProjection, nextPaintSerial, readCompletionInput } from './completion-data.mjs';

const fail = () => { throw new TypeError('Scene completion unavailable.'); };
const positive = value => Number.isSafeInteger(value) && value > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const object = value => value !== null && typeof value === 'object';
function field(value, name) {
  if (!object(value)) fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}
function rows(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  const length = field(value, 'length');
  if (!Number.isSafeInteger(length) || length < 0 || length > 2000 || Reflect.ownKeys(value).length !== length + 1) fail();
  return Array.from({ length }, (_, index) => field(value, String(index)));
}
function frozenGraph(value) {
  const pending = [value], seen = new Set();
  while (pending.length) {
    const item = pending.pop();
    if (!object(item) || seen.has(item)) continue;
    if (seen.size >= 50000 || !Object.isFrozen(item)) return false;
    seen.add(item);
    for (const key of Reflect.ownKeys(item)) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
      if (object(descriptor.value)) pending.push(descriptor.value);
    }
  }
  return true;
}
function validID(id) { return typeof id === 'string' && id.length <= 1024 && id.trim().length > 0; }
function copyPadding(value) {
  const result = {};
  for (const key of ['top', 'right', 'bottom', 'left']) {
    const number = field(value, key); if (!finite(number) || number < 0) fail(); result[key] = number;
  }
  return Object.freeze(result);
}
function frameData(value, input) {
  const source = field(value, 'stamp'), stamp = {}, allocation = input.renderInput.allocation;
  if (!allocation) fail();
  const ownerToken = field(source, 'ownerToken');
  if (!object(ownerToken) || !Object.isFrozen(ownerToken) || Reflect.ownKeys(ownerToken).length !== 0 ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(ownerToken))) fail();
  stamp.ownerToken = ownerToken;
  for (const key of ['contextEpoch', 'styleRevision', 'samplingViewRevision', 'layoutRevision', 'allocationRevision',
    'acceptedSceneRevision', 'installedSceneRevision', 'placementRevision', 'paintRevision']) {
    const number = field(source, key); if (!positive(number)) fail(); stamp[key] = number;
  }
  const width = field(value, 'width'), height = field(value, 'height'), pixelRatio = field(value, 'pixelRatio');
  const padding = copyPadding(field(value, 'padding')), projectionTransition = field(value, 'projectionTransition');
  if (stamp.acceptedSceneRevision !== input.acceptedSceneRevision || stamp.installedSceneRevision !== input.acceptedSceneRevision ||
      stamp.allocationRevision !== allocation.revision || width !== allocation.width || height !== allocation.height ||
      pixelRatio !== allocation.pixelRatio || !finite(projectionTransition) || projectionTransition < 0 || projectionTransition > 1 ||
      Object.keys(padding).some(key => padding[key] !== allocation.padding[key])) fail();
  let nativeControlTransition;
  const profile = field(value, 'cameraProfile');
  if (object(profile)) {
    try {
      const raw = field(profile, 'nativeControlTransition');
      if (finite(raw) && raw >= 0 && raw <= 1) nativeControlTransition = raw;
    } catch { /* Missing control provenance cannot be inferred from uploaded matrices. */ }
  }
  return { stamp: Object.freeze(stamp), width, height, pixelRatio, padding, projectionTransition, nativeControlTransition };
}
function cameraProfile(value, frame) {
  if (!object(value) || frame.nativeControlTransition === undefined) return undefined;
  try {
    const result = {};
    for (const key of ['latitude', 'zoom', 'pitch', 'nativeMinZoom', 'nativeMaxZoom']) {
      const number = field(value, key); if (!finite(number)) return undefined; result[key] = number;
    }
    if (Math.abs(result.latitude) > 90 || result.nativeMinZoom > result.nativeMaxZoom) return undefined;
    for (const key of ['explicitBounds', 'explicitZoomLimits', 'nativeBounds', 'terrain', 'canPan', 'canObserveMotion', 'canStop', 'moving', 'hasProjection']) {
      const flag = field(value, key); if (typeof flag !== 'boolean') return undefined; result[key] = flag;
    }
    if (!result.hasProjection) return undefined;
    return Object.freeze({ ...result, width: frame.width, height: frame.height, padding: frame.padding,
      nativeControlTransition: frame.nativeControlTransition });
  } catch { return undefined; }
}

/** Coalesces only the latest bridge-owned refusal; reporting cannot retain a historical input registry. */
export function createSceneCompletionDiagnostics(report) {
  if (typeof report !== 'function') fail();
  let latest, revision = 0;
  return Object.freeze({ unavailable(input, scopeGeneration) {
    const operation = nextPaintSerial(revision);
    if (operation === undefined) { revision = NaN; latest = undefined; return; }
    revision = operation;
    if (input === undefined) { latest = undefined; return; }
    let record;
    try {
      const publicationToken = field(input, 'publicationToken');
      if (!positive(scopeGeneration) || !object(publicationToken) || !Object.isFrozen(publicationToken) ||
          Reflect.ownKeys(publicationToken).length !== 0 || ![Object.prototype, null].includes(Object.getPrototypeOf(publicationToken))) return;
      if (latest?.input.deref() === input && latest.publicationToken === publicationToken && latest.scopeGeneration === scopeGeneration) return;
      record = Object.freeze({ input: new WeakRef(input), publicationToken, scopeGeneration, code: 'completion-unavailable' });
    } catch { return; }
    if (revision !== operation) return;
    // One weak input reference preserves exact identity without retaining the caller's graph.
    latest = record;
    try { report(input, record.code); } catch { /* A diagnostic cannot fail rendering. */ }
  } });
}

/** Owns neutral receipts and demand; native resource and phase authentication remain private services. */
export function createSceneCompletionOwner(host, services) {
  const capture = field(host, 'captureInput'), subscribe = field(host, 'subscribeInput');
  const claim = field(host, 'claimPaintSerial'), captureCamera = field(host, 'captureCameraFacts');
  const methods = {};
  for (const name of ['isInstalled', 'isObservationCurrent', 'isResultCurrent', 'requestFrame', 'isCurrent', 'setDemand', 'retireIssue']) {
    methods[name] = field(services, name);
  }
  if ([capture, subscribe, claim, captureCamera, ...Object.values(methods)].some(value => typeof value !== 'function')) fail();
  let disposed = false, visible = true, version = 0, identity, input, installed, pending, latest, releaseInput;
  let reconciling = false, issuing = false, completing = false, checking = false, requesting = false;
  let demand, wakeup = false, lastSerial = 0;
  const watches = new Map(), listeners = new Set(), issued = new WeakMap(), frames = new WeakMap();
  const invoke = (name, ...args) => Reflect.apply(methods[name], services, args);
  function live() {
    if (disposed) return false;
    try { const result = invoke('isCurrent'); return result === true && !disposed; } catch { return false; }
  }
  function retire(record) {
    if (!record || record.retired) return;
    record.retired = true;
    if (pending === record) pending = undefined;
    try { invoke('retireIssue', record.ticket); } catch { /* Native retention remains charged by its owner. */ }
    record.expected = record.plan = record.observation = record.targets = record.frame = record.profile = undefined;
  }
  function invalidate() {
    const next = nextPaintSerial(version);
    if (next === undefined) { dispose(); return; }
    const previous = latest; version = next; latest = undefined; wakeup = false;
    retire(pending); retire(previous?.record);
  }
  function updateDemand() {
    const eligible = !disposed && visible && input?.phase === 'resolved' && input.acceptedSceneRevision > 0 &&
      input.renderInput.allocation !== undefined && input.members.some(row => row.target && watches.has(row.id));
    const value = Boolean(eligible);
    if (demand === value) return;
    const previous = demand;
    demand = value;
    if (previous === true && !value) invalidate();
    if (demand !== value) return;
    try { invoke('setDemand', value); } catch { /* Scope admission will refuse an unavailable native owner. */ }
  }
  function captureState() {
    const start = version;
    if (!live() || start !== version) return undefined;
    const raw = Reflect.apply(capture, host, []);
    const data = readCompletionInput(raw, field(raw, 'renderInput'));
    if (!data || !frozenGraph(raw) || !live() || start !== version) return undefined;
    const after = Reflect.apply(capture, host, []);
    if (raw !== after || !live() || start !== version) return undefined;
    return { raw, data };
  }
  function reconcile(shouldRequest = true) {
    if (disposed || reconciling) return;
    reconciling = true;
    let changed = false;
    try {
      const captured = captureState();
      if (!captured) {
        if (identity !== undefined || input !== undefined) { identity = input = installed = undefined; invalidate(); }
      } else if (identity !== captured.raw) {
        identity = captured.raw; input = captured.data; installed = undefined; changed = true; invalidate();
      }
      updateDemand();
    } catch {
      identity = input = installed = undefined; invalidate(); updateDemand();
    } finally { reconciling = false; }
    if (changed && shouldRequest) requestFrame();
  }
  function locallyCurrent(expected, revision) {
    return !disposed && visible && identity === expected && version === revision;
  }
  function unchanged(expected, revision) {
    if (!locallyCurrent(expected, revision)) return false;
    try {
      if (!live() || version !== revision || identity !== expected) return false;
      const current = Reflect.apply(capture, host, []);
      return current === expected && live() && version === revision && identity === expected && !disposed && visible;
    } catch { return false; }
  }
  function verify(name, args, expected, revision) {
    if (!unchanged(expected, revision)) return false;
    // Trusted native verifiers finish their own callback checks with a pure authority check.
    // Calling the host again afterward could revoke that authority during the final fence.
    try { return invoke(name, ...args) === true && locallyCurrent(expected, revision); } catch { return false; }
  }
  function completeMembership(record, expected, data) {
    if (field(record, 'input') !== expected) return false;
    const supplied = rows(field(record, 'members'));
    if (supplied.length !== data.members.length) return false;
    const expectedRows = new Map(data.members.map(row => [row.id, row])), seen = new Set();
    for (const source of supplied) {
      const id = field(source, 'id'), row = expectedRows.get(id);
      if (!row || seen.has(id) || field(source, 'kind') !== row.kind || field(source, 'rowToken') !== row.rowToken ||
          field(source, 'targetToken') !== row.target?.token) return false;
      seen.add(id);
    }
    return true;
  }
  function acceptInstalled(record) {
    reconcile(false); const expected = identity, revision = version, data = input;
    if (!data || data.phase !== 'resolved') return false;
    try {
      if (!completeMembership(record, expected, data) || !verify('isInstalled', [record, expected], expected, revision)) return false;
      installed = record; return true;
    } catch { return false; }
  }
  function issue(observation) {
    if (issuing || disposed) return undefined;
    issuing = true;
    try { return issueCurrent(observation); } finally { issuing = false; }
  }
  function issueCurrent(observation) {
    reconcile(false); wakeup = false;
    const expected = identity, revision = version, data = input, plan = installed;
    if (!data || !demand || pending || data.phase !== 'resolved' || !positive(data.acceptedSceneRevision)) return undefined;
    try {
      if (field(observation, 'input') !== expected || field(observation, 'installed') !== plan ||
          !object(field(observation, 'phase')) || !object(field(observation, 'scope')) || !completeMembership(plan, expected, data) ||
          !verify('isInstalled', [plan, expected], expected, revision) ||
          !verify('isObservationCurrent', [observation, expected], expected, revision)) return undefined;
      const frame = frameData(field(observation, 'frame'), data), targets = new Map();
      const members = new Map(data.members.map(row => [row.id, row]));
      for (const value of rows(field(observation, 'targets'))) {
        const id = field(value, 'id'), row = members.get(id), status = field(value, 'status');
        const point = Object.hasOwn(value, 'point') ? field(value, 'point') : undefined;
        if (!row?.target || targets.has(id) || field(value, 'targetToken') !== row.target.token ||
            field(value, 'acceptedPositionRevision') !== row.target.acceptedPositionRevision) return undefined;
        const projection = createTargetProjection({ acceptedPositionRevision: row.target.acceptedPositionRevision, status, point, anchor: undefined, object: undefined });
        if (!projection) return undefined;
        targets.set(id, { token: row.target.token, status, point: projection.point, acceptedPositionRevision: row.target.acceptedPositionRevision });
      }
      if (![...targets.keys()].some(id => watches.has(id)) || !unchanged(expected, revision)) return undefined;
      let facts;
      try { facts = Reflect.apply(captureCamera, host, [expected]); } catch { facts = undefined; }
      const profile = cameraProfile(facts, frame);
      if (!verify('isInstalled', [plan, expected], expected, revision) ||
          !verify('isObservationCurrent', [observation, expected], expected, revision) || pending) return undefined;
      const serial = Reflect.apply(claim, host, [expected]);
      if (!positive(serial) || serial <= lastSerial) return undefined;
      lastSerial = serial;
      if (!verify('isInstalled', [plan, expected], expected, revision) ||
          !verify('isObservationCurrent', [observation, expected], expected, revision) || pending || !demand ||
          ![...targets.keys()].some(id => watches.has(id))) return undefined;
      const ticket = Object.freeze({}), record = { ticket, expected, revision, plan, observation, targets, frame, profile, serial, retired: false, completed: false };
      issued.set(ticket, record); pending = record; return ticket;
    } catch { return undefined; }
  }
  function recordCurrent(record) {
    return record && !record.retired && demand && [...record.targets.keys()].some(id => watches.has(id)) &&
      unchanged(record.expected, record.revision) &&
      verify('isInstalled', [record.plan, record.expected], record.expected, record.revision) &&
      verify('isObservationCurrent', [record.observation, record.expected], record.expected, record.revision) && demand;
  }
  function complete(ticket, result) {
    if (completing || disposed) return false;
    completing = true;
    try { return completeCurrent(ticket, result); } finally { completing = false; }
  }
  function completeCurrent(ticket, result) {
    const record = object(ticket) ? issued.get(ticket) : undefined;
    if (!record || record.completed || pending !== record || !recordCurrent(record)) return false;
    try {
      if (!verify('isResultCurrent', [ticket, result], record.expected, record.revision) || !recordCurrent(record)) return false;
      const projections = new Map();
      for (const value of rows(field(result, 'targets'))) {
        const id = field(value, 'id'), target = record.targets.get(id);
        if (!target || projections.has(id)) return false;
        const projection = createTargetProjection({ acceptedPositionRevision: target.acceptedPositionRevision, status: target.status,
          point: target.point, anchor: field(value, 'anchor'), object: field(value, 'object') });
        if (!projection) return false; projections.set(id, projection);
      }
      if (projections.size !== record.targets.size || !recordCurrent(record)) return false;
      const frame = Object.freeze({ stamp: Object.freeze({ ...record.frame.stamp, paintFrameSerial: record.serial }),
        width: record.frame.width, height: record.frame.height, pixelRatio: record.frame.pixelRatio, padding: record.frame.padding,
        projectionTransition: record.frame.projectionTransition, cameraProfile: record.profile });
      const previous = latest;
      if (previous) { latest = undefined; retire(previous.record); }
      if (!verify('isResultCurrent', [ticket, result], record.expected, record.revision) ||
          !recordCurrent(record) || pending !== record) return false;
      record.completed = true; pending = undefined;
      const receipt = { record, projections, frame }; latest = receipt; frames.set(frame, receipt);
      for (const listener of [...listeners]) {
        if (latest !== receipt || !recordCurrent(record)) break;
        if (!listeners.has(listener)) continue;
        try { listener.callback(frame); } catch { /* Subscribers cannot roll back a completed frame. */ }
      }
      return true;
    } catch { return false; }
  }
  function requestFrame() {
    if (requesting || !visible || disposed || wakeup || !demand) return;
    requesting = true;
    try {
      if (!live() || !visible || disposed || !demand) return;
      wakeup = true;
      try { invoke('requestFrame'); } catch { wakeup = false; }
    } finally { requesting = false; }
  }
  function dispose() {
    if (disposed) return;
    const previous = latest;
    disposed = true; latest = undefined; identity = input = installed = undefined; watches.clear(); listeners.clear(); retire(pending); retire(previous?.record);
    updateDemand();
    const release = releaseInput; releaseInput = undefined;
    try { release?.(); } catch { /* Release each owner independently. */ }
  }
  const port = Object.freeze({
    watchTarget(id) {
      if (disposed) return () => {};
      if (!validID(id)) fail();
      const previous = watches.get(id) ?? 0, count = nextPaintSerial(previous);
      if (count === undefined || previous === 0 && watches.size >= 2000) fail();
      watches.set(id, count); reconcile(false); updateDemand(); requestFrame();
      let active = true;
      return () => {
        if (!active) return; active = false;
        const count = watches.get(id); if (count === undefined) return;
        if (count === 1) watches.delete(id); else watches.set(id, count - 1);
        if (watches.size === 0 || pending && ![...pending.targets.keys()].some(id => watches.has(id)) ||
            latest && ![...latest.record.targets.keys()].some(id => watches.has(id))) invalidate();
        updateDemand();
      };
    },
    subscribeCompletedFrames(callback) {
      if (disposed) return () => {};
      if (typeof callback !== 'function' || listeners.size >= 2000) fail();
      const listener = { callback }; listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    current(frame, id, targetToken) {
      if (checking || disposed) return false;
      checking = true;
      try {
        reconcile(false); const receipt = object(frame) ? frames.get(frame) : undefined;
        const target = receipt?.record.targets?.get(id);
        return receipt !== undefined && receipt === latest && !receipt.record.retired && object(targetToken) && target !== undefined && target.token === targetToken &&
          recordCurrent(receipt.record) && receipt === latest;
      } finally { checking = false; }
    },
    projectTarget(frame, id) {
      if (checking || disposed) return undefined;
      checking = true;
      try {
        reconcile(false); const receipt = object(frame) ? frames.get(frame) : undefined;
        if (!receipt || receipt !== latest || !recordCurrent(receipt.record) || receipt !== latest) return undefined;
        return receipt.projections.get(id);
      } finally { checking = false; }
    },
    requestFrame
  });
  const owner = Object.freeze({ port, reconcile, acceptInstalled, issue, complete, invalidate,
    setVisible(value) { if (disposed || typeof value !== 'boolean' || visible === value) return;
      visible = value; invalidate(); updateDemand(); if (visible) requestFrame(); }, dispose });
  try {
    const release = Reflect.apply(subscribe, host, [() => { invalidate(); reconcile(); }]);
    if (typeof release !== 'function') fail();
    if (disposed) { try { release(); } catch { /* Retire a stale acquisition. */ } }
    else releaseInput = release;
    reconcile();
  } catch { dispose(); fail(); }
  return owner;
}
