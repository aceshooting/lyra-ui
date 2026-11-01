import { captureSceneGlyphObservation, createSceneGlyphRenderer } from './bridge-glyph.mjs';
import { readCompletionInput } from './completion-data.mjs';
import { createSceneCompletionDiagnostics, createSceneCompletionOwner } from './completion.mjs';
import { createSceneCompletionObservation } from './completion-observation.mjs';
import { captureNativeFrameAuthority, loseNativeFrameContext, readNativeFrameAuthority, registerNativeFrameDemand } from './native-frame-authority.mjs';
import { createEpochGeographicServices, createGeographicFrameLease } from './frame.mjs';
import { geographicFromEnu, geographicToTile } from './geographic.mjs';
import { createSceneGlEnvelope } from './gl-state.mjs';
import { createLayerLifetime } from './lifetime.mjs';
import { assertNativeTerrainAuthority, captureNativeTerrainAuthority } from './native-terrain-authority.mjs';
import { projectionOriginFor } from './projection.mjs';
import { createSceneResourceLedger } from './resource-ledger.mjs';
import { createTerrainNativeBatch } from './terrain-native.mjs';
import { createTerrainPointQueue } from './terrain-points.mjs';

const fail = () => { throw new TypeError('Scene bridge is unavailable.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
let bridgeSequence = 0;
function field(value, name, optional = false) {
  if (!value || typeof value !== 'object') fail();
  const entry = Object.getOwnPropertyDescriptor(value, name);
  if (!entry) { if (optional) return undefined; fail(); }
  if (!Object.hasOwn(entry, 'value')) fail();
  return entry.value;
}
function array(value, maximum, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  const count = field(value, 'length');
  if (!Number.isSafeInteger(count) || count < 0 || count > maximum || length !== undefined && count !== length) fail();
  return Array.from({ length: count }, (_, index) => field(value, String(index)));
}
function readInput(value) {
  const acceptedSceneRevision = field(value, 'acceptedSceneRevision'), presentationRevision = field(value, 'presentationRevision');
  const reducedMotion = field(value, 'reducedMotion'), suppliedAllocation = field(value, 'allocation');
  if (!positive(acceptedSceneRevision) || !positive(presentationRevision) || typeof reducedMotion !== 'boolean') fail();
  let allocation;
  if (suppliedAllocation !== undefined) {
    const revision = field(suppliedAllocation, 'revision'), width = field(suppliedAllocation, 'width');
    const height = field(suppliedAllocation, 'height'), pixelRatio = field(suppliedAllocation, 'pixelRatio');
    const suppliedPadding = field(suppliedAllocation, 'padding'), padding = {};
    if (!positive(revision) || ![width, height, pixelRatio].every(number => finite(number) && number > 0) ||
        ![width * pixelRatio, height * pixelRatio].every(number => finite(number) && Math.round(number) > 0 && Number.isSafeInteger(Math.round(number)))) fail();
    for (const name of ['top', 'right', 'bottom', 'left']) {
      const number = field(suppliedPadding, name);
      if (!finite(number) || number < 0) fail();
      padding[name] = number;
    }
    allocation = Object.freeze({ revision, width, height, pixelRatio, padding: Object.freeze(padding) });
  }
  const identifiers = new Set();
  const markers = array(field(value, 'markers'), 2000).map(source => {
    const id = field(source, 'id'), acceptedPositionRevision = field(source, 'acceptedPositionRevision');
    const radiusCss = field(source, 'radiusCss'), rgba = array(field(source, 'rgba'), 4, 4);
    const suppliedPosition = field(source, 'position'), altitudeReference = field(suppliedPosition, 'altitudeReference', true);
    if (typeof id !== 'string' || !id.trim() || identifiers.has(id) || !positive(acceptedPositionRevision) ||
        !finite(radiusCss) || radiusCss <= 0 || !rgba.every(number => finite(number) && number >= 0 && number <= 1) ||
        altitudeReference !== undefined && !['terrain', 'sea-level'].includes(altitudeReference)) fail();
    identifiers.add(id);
    const position = geographicFromEnu({ lngLat: array(field(suppliedPosition, 'lngLat'), 2, 2), altitude: field(suppliedPosition, 'altitude', true) }, [0, 0, 0]);
    return Object.freeze({ id, acceptedPositionRevision, radiusCss, rgba: Object.freeze(rgba), position: Object.freeze({
      lngLat: Object.freeze(position.lngLat), altitude: position.altitude, altitudeReference: altitudeReference ?? 'sea-level'
    }) });
  });
  return Object.freeze({ acceptedSceneRevision, presentationRevision, allocation, reducedMotion, markers: Object.freeze(markers) });
}

/** Composes an owned marker layer with an optional authenticated completion service. */
export function createSceneBridge(map, host) {
  const signal = field(host, 'signal'), hostCurrent = field(host, 'isCurrent');
  const capture = field(host, 'captureRenderInput'), subscribe = field(host, 'subscribeRenderInput');
  const onState = field(host, 'onState'), onError = field(host, 'onError');
  const completionHost = field(host, 'completion', true);
  if (completionHost !== undefined) for (const name of ['captureInput', 'subscribeInput', 'claimPaintSerial', 'captureCameraFacts']) {
    if (typeof field(completionHost, name) !== 'function') fail();
  }
  if (!signal || typeof signal.addEventListener !== 'function' ||
      [hostCurrent, capture, subscribe, onState, onError].some(value => typeof value !== 'function')) fail();
  for (const name of ['addLayer', 'removeLayer', 'getLayer', 'getCanvas', 'isStyleLoaded', 'triggerRepaint',
    'getCenter', 'getZoom', 'getPitch', 'getBearing', 'getTerrain', 'getProjection', 'on', 'off']) if (typeof map?.[name] !== 'function') fail();
  const canvas = map.getCanvas();
  if (!canvas || typeof canvas.addEventListener !== 'function' || typeof canvas.removeEventListener !== 'function') fail();
  if (!positive(++bridgeSequence)) fail();
  const layerID = `scene-markers-${bridgeSequence}`;
  // Two bounded queue packets, one native sampler and two scalar staging records may overlap.
  const ledger = createSceneResourceLedger({ bytes: 2000 * 56 + 400 + 72 + 512 });
  const contexts = new WeakMap(), retainedContexts = new Set(), owners = new Set(), listeners = [];
  let disposed = false, visible = true, contextLost = false, awaitingStyle = false, waitingStyleReady = false, scheduled = false, wakeup = false;
  let pollingStyleReady = false;
  let active, operation, activeCallback, releaseInput, reconcileRevision = 0, installationRevision = 0, ownerSequence = 0, contextSequence = 0;
  let viewRevision = 1, styleRevision = 1, stamp = Object.freeze({}), layout, zoom = 0, terrainSource;
  let completion, completionDemand = false, completionGeneration = 1, releaseCompletionVisibility;
  const installedRecords = completionHost ? new WeakMap() : undefined;
  const observationRecords = completionHost ? new WeakMap() : undefined;
  const completionResults = completionHost ? new WeakMap() : undefined;
  const completionOwnerToken = completionHost ? Object.freeze({}) : undefined;
  const completionDiagnostics = completionHost ? createSceneCompletionDiagnostics(() => {}) : undefined;

  function completionInput() {
    if (!completionHost || !baseCurrent()) return undefined;
    const value = completionHost.captureInput(), renderInput = capture();
    if (!baseCurrent() || !readCompletionInput(value, renderInput)) return undefined;
    return completionHost.captureInput() === value && capture() === renderInput && baseCurrent() ? value : undefined;
  }
  function completionCurrent(owner, input) {
    if (!completion || !visible || canvas.ownerDocument?.hidden || !current(owner) || !owner.committed ||
        owner.context?.lost || !completionDemand || completionInput() !== input) return false;
    if (typeof map.loaded !== 'function' || typeof map.isMoving !== 'function' || map.loaded() !== true || map.isMoving() !== false) return false;
    return completionInput() === input && current(owner) && visible && !canvas.ownerDocument?.hidden;
  }
  function updateCompletionDemand(owner) {
    if (!owner) return;
    const gl = owner.context?.gl ?? owner.nativeGl;
    const wanted = Boolean(completionDemand && !disposed && !contextLost && visible && !canvas.ownerDocument?.hidden &&
      !owner.retired && gl && !owner.context?.lost && owner.layer);
    if (!wanted && owner.releaseCompletion) { const release = owner.releaseCompletion; owner.releaseCompletion = undefined; release(); }
    if (wanted && !owner.releaseCompletion) owner.releaseCompletion = registerNativeFrameDemand(gl, owner.layer, owner.layer.render);
    if (!wanted) { owner.observation?.invalidate(); completionDiagnostics?.unavailable(undefined); }
  }
  function invalidateCompletion(reason) {
    if (!completion) return;
    if (!Number.isSafeInteger(completionGeneration + 1)) { completion.dispose(); return; }
    completionGeneration++; completionDiagnostics.unavailable(undefined);
    for (const owner of owners) owner.observation?.invalidate();
    completion.invalidate(reason);
  }
  function observationAuthorityCurrent(record) {
    if (!record || record.generation !== completionGeneration || !completionCurrent(record.owner, record.input)) return false;
    try { readNativeFrameAuthority(record.authority, record.owner.context.gl, 'render'); }
    catch {
      try { readNativeFrameAuthority(record.authority, record.owner.context.gl, 'completed'); }
      catch { return false; }
    }
    if (record.generation !== completionGeneration || !completionCurrent(record.owner, record.input)) return false;
    try { readNativeFrameAuthority(record.authority, record.owner.context.gl, 'render'); return true; }
    catch {
      try { readNativeFrameAuthority(record.authority, record.owner.context.gl, 'completed'); return true; }
      catch { return false; }
    }
  }
  function installedCurrent(record, input) {
    const owned = installedRecords.get(record);
    return Boolean(owned && owned.input === input && owned.generation === completionGeneration &&
      owned.identity === owned.owner.identity && completionCurrent(owned.owner, input) &&
      owned.generation === completionGeneration && owned.identity === owned.owner.identity && !owned.owner.retired && owned.owner.committed && !owned.owner.context?.lost);
  }
  function observationFor(owner) {
    if (owner.observation) return owner.observation;
    const window = canvas.ownerDocument?.defaultView;
    if (!window || typeof window.requestAnimationFrame !== 'function' || typeof window.cancelAnimationFrame !== 'function' ||
        typeof window.performance?.now !== 'function') return undefined;
    const tickets = new WeakMap();
    owner.observation = createSceneCompletionObservation({ gl: owner.context.gl,
      isCurrent: () => owner.observationGeneration === completionGeneration && completionCurrent(owner, owner.observationInput),
      requestAnimationFrame: callback => window.requestAnimationFrame(callback),
      cancelAnimationFrame: handle => window.cancelAnimationFrame(handle), now: () => window.performance.now(),
      onComplete(ticket, value) {
        const issued = tickets.get(ticket); if (!issued) return;
        tickets.delete(ticket);
        const result = Object.freeze({ targets: Object.freeze([Object.freeze({ id: issued.id, anchor: value.anchor, object: value.object })]) });
        completionResults.set(result, issued.issue);
        if (completion.complete(issued.issue, result) && completionInput() === owner.observationInput &&
            owner.observationGeneration === completionGeneration) completionDiagnostics.unavailable(undefined);
      },
      onUnavailable(ticket) {
        const issued = tickets.get(ticket); if (issued) tickets.delete(ticket);
        if (owner.observationInput) completionDiagnostics.unavailable(owner.observationInput, owner.observationGeneration);
        completion.invalidate('observation');
      }
    });
    owner.observationTickets = tickets;
    return owner.observation;
  }
  function completeMarkerPaint(owner, frame, authority) {
    const input = completionInput(), callback = activeCallback, generation = completionGeneration;
    if (!input || !completionCurrent(owner, input)) return;
    const refuse = () => completionDiagnostics.unavailable(input, generation);
    let facts;
    try { facts = readNativeFrameAuthority(authority, owner.context.gl, 'render'); }
    catch { refuse(); return; }
    const layers = facts.frame.orderedLayers, phase = facts.phase;
    if (input.phase !== 'resolved' || input.members.length !== 1 || input.members[0].kind !== 'marker' ||
        owner.input.markers.length !== 1 || input.members[0].id !== owner.input.markers[0].id ||
        input.members[0].target?.position.altitudeReference !== 'sea-level' || facts.frame.terrainEnabled ||
        facts.frame.projection !== 'mercator' || facts.frame.projectionTransition !== 0 || facts.frame.debug || facts.frame.tailDraws ||
        phase.pass !== 'translucent' || phase.currentLayer !== layers.length - 1 || layers.at(-1)?.id !== layerID ||
        layers.at(-1)?.type !== 'custom' || layers.slice(0, -1).some(layer => !['background', 'fill-extrusion'].includes(layer.type))) { refuse(); return; }
    const member = input.members[0], marker = owner.input.markers[0];
    const plan = captureSceneGlyphObservation(owner.glyph, frame, marker, authority);
    const projected = frame.geographic.project(marker.position);
    if (!completionCurrent(owner, input) || generation !== completionGeneration || activeCallback !== callback) return;
    const installed = Object.freeze({ input, members: Object.freeze([Object.freeze({ id: member.id, kind: member.kind,
      rowToken: member.rowToken, targetToken: member.target.token })]) });
    installedRecords.set(installed, { owner, input, identity: owner.identity, generation });
    completion.acceptInstalled(installed);
    const allocation = owner.input.allocation, rawTransition = callback.rawTransition;
    if (rawTransition !== 0) { refuse(); return; }
    const data = Object.freeze({ stamp: Object.freeze({ ownerToken: completionOwnerToken, contextEpoch: owner.context.epoch,
      styleRevision, samplingViewRevision: viewRevision, layoutRevision: layout.revision, allocationRevision: allocation.revision,
      acceptedSceneRevision: input.acceptedSceneRevision, installedSceneRevision: input.acceptedSceneRevision,
      placementRevision: viewRevision, paintRevision: owner.input.presentationRevision }),
      width: allocation.width, height: allocation.height, pixelRatio: allocation.pixelRatio, padding: allocation.padding,
      projectionTransition: Math.fround(rawTransition), cameraProfile: Object.freeze({ nativeControlTransition: rawTransition }) });
    const observation = Object.freeze({ input, installed, phase: authority, scope: authority, frame: data,
      targets: Object.freeze([Object.freeze({ id: member.id, targetToken: member.target.token,
        acceptedPositionRevision: member.target.acceptedPositionRevision,
        status: projected.status === 'visibility-pending' ? 'resolved' : projected.status,
        ...(projected.point ? { point: Object.freeze([...projected.point]) } : {}) })]) });
    observationRecords.set(observation, { owner, input, authority, generation });
    const issue = completion.issue(observation);
    if (!issue || !observationAuthorityCurrent(observationRecords.get(observation))) return;
    const manager = observationFor(owner);
    if (!manager) { completion.invalidate('observation'); refuse(); return; }
    owner.observationInput = input; owner.observationGeneration = generation;
    const ticket = manager.issue({ plan, authority });
    if (ticket) owner.observationTickets.set(ticket, { issue, id: member.id });
    else { completion.invalidate('observation'); refuse(); }
  }

  function baseCurrent() {
    if (disposed || signal.aborted || contextLost) return false;
    const result = hostCurrent();
    return Boolean(result) && !disposed && !signal.aborted && !contextLost;
  }
  function identityCurrent(identity) {
    if (!baseCurrent()) return false;
    const value = capture();
    return baseCurrent() && value === identity;
  }
  function current(owner) {
    if (!owner) return false;
    const identity = owner.identity, revision = reconcileRevision;
    const local = () => active === owner && !owner.retired && owner.identity === identity && revision === reconcileRevision;
    if (!local() || !identityCurrent(identity) || !local()) return false;
    if (owner.committed && map.getLayer(layerID) !== owner.handle) return false;
    return local();
  }
  function deferPendingInput(owner, nativeSignal) {
    const identity = owner.identity;
    const local = () => owner.committed && active === owner && !owner.retired && owner.identity === identity &&
      owner.styleRevision === styleRevision && !disposed && !signal.aborted && !nativeSignal.aborted &&
      !contextLost && !owner.context?.lost && !awaitingStyle;
    try {
      if (!local() || !baseCurrent() || !local() || capture() === identity || !local()) return false;
      const handle = map.getLayer(layerID);
      if (!local() || handle !== owner.handle || !baseCurrent() || !local() || capture() === identity || !local()) return false;
      if (map.getLayer(layerID) !== handle || !local() || !baseCurrent() || !local()) return false;
      // A synchronous native redraw can precede the queued publication reconciliation.
      wakeup = false; schedule();
      return true;
    } catch { return false; }
  }
  function report(code) {
    if (disposed || signal.aborted) return;
    try { onError(code); } catch { /* Host failures cannot escape native callbacks. */ }
  }
  function notifyState(state, input, code) {
    const value = { state, acceptedSceneRevision: input.acceptedSceneRevision, presentationRevision: input.presentationRevision,
      allocationRevision: input.allocation?.revision, markerInstallationRevision: installationRevision };
    if (code) value.code = code;
    try { onState(Object.freeze(value)); } catch { /* Isolate presentation callbacks. */ }
  }
  function publish(state, input, identity, code) {
    if (identityCurrent(identity)) notifyState(state, input, code);
  }
  function commitInstallation(owner, attempt) {
    const identity = owner.identity, input = owner.input;
    const local = () => active === owner && !owner.retired && !disposed && !signal.aborted && !contextLost &&
      !awaitingStyle && reconcileRevision === attempt && owner.identity === identity && owner.input === input;
    if (!local() || !identityCurrent(identity) || !local()) return false;
    const handle = map.getLayer(layerID);
    if (!handle || handle !== owner.installationHandle || !local()) return false;
    if (!Number.isSafeInteger(installationRevision + 1)) fail();
    // The last callback-bearing lookups have completed. Commit and publish this owned plan atomically.
    owner.handle = handle; owner.committed = true; installationRevision++;
    notifyState('installed', input);
    return true;
  }
  function requestFrame() {
    if (!visible || wakeup || !baseCurrent() || awaitingStyle) return;
    wakeup = true;
    try { map.triggerRepaint(); } catch { wakeup = false; report('engine'); }
  }
  function trackedReserve(record, resources) {
    const lease = ledger.reserve(resources), retained = { lease, attempted: false, failed: false };
    record.leases.add(retained);
    return Object.freeze({ release() {
      if (retained.attempted) return;
      retained.attempted = true;
      try {
        lease.release(); record.leases.delete(retained);
        if (record.retired && !record.leases.size && record.context?.samplers.has(record)) {
          const finish = () => {
            if (record.retired && !record.leases.size) record.context.samplers.delete(record);
            cleanupListeners();
          };
          if (operation?.owner === record) queueMicrotask(finish); else finish();
        }
      }
      catch { retained.failed = true; throw new TypeError('Scene reservation retirement is unavailable.'); }
    } });
  }
  function readView() {
    const center = map.getCenter(), value = map.getZoom(), terrain = map.getTerrain();
    // Read other native view facets only outside GL work; events own their sampling revisions.
    const pitch = map.getPitch(), bearing = map.getBearing(); map.getProjection();
    if (!finite(center?.lng) || !finite(value) || !finite(pitch) || !finite(bearing)) fail();
    zoom = value;
    layout = Object.freeze({ revision: viewRevision, tileZoom: Math.max(0, Math.min(30, Math.floor(value))), centerLongitude: center.lng });
    terrainSource = typeof terrain?.source === 'string' ? terrain.source : undefined;
  }
  function operationCurrent(token) {
    const local = () => token && operation === token && !token.context.lost && retainedContexts.has(token.context) &&
      (token.dispose ? token.context.owners.has(token.owner) || token.context.samplers.has(token.owner) :
        visible && token.callback?.live && activeCallback === token.callback && token.stamp === stamp &&
        token.callback.identity === token.owner.identity && token.callback.stamp === stamp && !token.owner.retired);
    if (!local()) return false;
    if (token.context.gl.isContextLost()) { observeContextLoss(token.context); return false; }
    if (!local()) return false;
    if (token.dispose) return true;
    if (!current(token.owner) || !local()) return false;
    if (token.authority?.status === 'refused') return false;
    if (token.authority?.status === 'admitted') {
      try { assertNativeTerrainAuthority(token.authority.authority, token.context.gl, token.callback.originalHook); }
      catch { return false; }
    }
    return local();
  }
  function withOperation(context, owner, kind, work, callback = activeCallback) {
    if (operation || context.lost || !retainedContexts.has(context)) fail();
    const dispose = kind.endsWith('dispose');
    const token = { context, owner, dispose, callback, stamp, authority: kind === 'terrain' ? callback?.authority : undefined };
    operation = token;
    try {
      if (!operationCurrent(token)) fail();
      const envelope = kind.startsWith('terrain') ? context.terrainEnvelope : context.pointEnvelope;
      return envelope.run(work);
    } finally { operation = undefined; }
  }
  function contextFor(gl) {
    if (gl.canvas !== canvas) fail();
    let context = contexts.get(gl);
    if (context && !context.lost) return context;
    context = { gl, epoch: ++contextSequence, lost: false, owners: new Set(), samplers: new Set() };
    context.pointEnvelope = createSceneGlEnvelope(gl, { profile: 'point', isCurrent: () => operationCurrent(operation) });
    context.terrainEnvelope = createSceneGlEnvelope(gl, { profile: 'terrain-point', epoch: context.epoch, isCurrent: () => operationCurrent(operation) });
    contexts.set(gl, context); retainedContexts.add(context);
    return context;
  }
  function cleanupListeners() {
    if (!disposed || owners.size || [...retainedContexts].some(context => context.samplers.size)) return;
    if (operation || activeCallback) { queueMicrotask(cleanupListeners); return; }
    canvas.removeEventListener('webglcontextlost', lost, true);
    canvas.removeEventListener('webglcontextrestored', restored);
    for (const context of retainedContexts) { context.pointEnvelope.dispose(); context.terrainEnvelope.dispose(); }
    retainedContexts.clear();
  }
  function observeContextLoss(context) {
    if (context.lost) return;
    context.lost = true;
    if (completion) { loseNativeFrameContext(context.gl); invalidateCompletion('context'); }
    if (active?.context === context) contextLost = true;
    queueMicrotask(() => {
      if (active?.context === context) retire(active, 'context-lost');
      for (const owner of [...owners]) if (owner.context === context) { owner.retired = true; cleanupOwner(owner); }
      for (const sampler of [...context.samplers]) retireSampler(sampler, true);
      cleanupListeners();
    });
  }
  function retireSampler(sampler, lostContext = false) {
    if (!sampler) return;
    sampler.retired = true;
    try { sampler.service.dispose({ contextLost: lostContext || sampler.context.lost }); }
    catch { report('render'); }
    if (!sampler.leases.size) sampler.context.samplers.delete(sampler);
  }
  function cleanupOwner(owner) {
    if (owner.cleaning) return;
    owner.cleaning = true;
    try {
      if (!owner.queueDisposed) {
        owner.queueDisposed = true;
        try { owner.queue.dispose(); } catch { report('render'); }
      }
      if (owner.releaseCompletion) { const release = owner.releaseCompletion; owner.releaseCompletion = undefined; release(); }
      if (owner.observation) {
        try { owner.observation.dispose({ contextLost: Boolean(owner.context?.lost) }); } catch { /* Keep retained observation ownership reachable. */ }
      }
      retireSampler(owner.sampler, owner.context?.lost);
      if (owner.glyph) {
        try { owner.glyph.dispose({ contextLost: Boolean(owner.context?.lost) }); } catch { report('render'); }
      }
      if (!owner.leases.size && (!owner.observation || owner.observation.retired()) && (!owner.glyph || owner.glyph.retired()) && (!owner.sampler || !owner.sampler.leases.size)) {
        owner.context?.owners.delete(owner); owners.delete(owner);
      }
    } finally { owner.cleaning = false; cleanupListeners(); }
  }
  function retire(owner, reason) {
    if (!owner) return;
    owner.retired = true;
    if (completion) invalidateCompletion(reason ?? 'owner');
    updateCompletionDemand(owner);
    if (active === owner) active = undefined;
    if (reason === 'context-lost' && owner.context) owner.context.lost = true;
    owner.lifetime?.invalidate(reason === 'context-lost' ? reason : 'style');
    owner.lifetime?.dispose();
    // Native callbacks finish their guarded work before owner retirement performs GL.
    if (activeCallback?.owner === owner || operation?.owner === owner) queueMicrotask(() => cleanupOwner(owner));
    else cleanupOwner(owner);
  }
  function geographicCoordinate(position) {
    const source = { lngLat: position.lngLat, altitude: 0 }, origin = projectionOriginFor(source, layout);
    const encoded = geographicToTile(source, origin.tile), size = 2 ** origin.tile.z;
    return [(origin.tile.x + encoded[0] / 8192) / size + origin.tile.wrap, (origin.tile.y + encoded[1] / 8192) / size];
  }
  function registerMarkers(owner, input) {
    const next = new Map(), resolved = new Map();
    for (const marker of input.markers) {
      if (marker.position.altitudeReference !== 'terrain') continue;
      if (!current(owner)) fail();
      const coordinate = geographicCoordinate(marker.position), key = coordinate.join(',');
      let record = owner.requests.get(marker.id);
      if (!record || record.key !== key) {
        const handle = owner.queue.request(marker.id, [{ coordinate, offsetMeters: 0 }]);
        record = { key, handle };
      }
      next.set(marker.id, record); resolved.set(marker.position.lngLat.join(','), record.handle);
    }
    if (!current(owner)) fail();
    for (const [id, record] of owner.requests) if (!next.has(id)) record.handle.release();
    owner.requests = next; owner.terrainByCoordinate = resolved;
  }
  function invalidateTerrain() {
    invalidateCompletion('view');
    viewRevision++; stamp = Object.freeze({});
    try {
      readView();
      if (active && !active.retired) {
        active.queue.setStamp(stamp); active.batch = undefined; active.terrainUnavailable = false;
        retireSampler(active.sampler); active.sampler = undefined;
        if (current(active)) registerMarkers(active, active.input);
        else schedule();
      }
      requestFrame();
    } catch { report('engine'); }
  }
  function samplerFor(owner) {
    if (owner.sampler && !owner.sampler.retired) return owner.sampler;
    const context = owner.context;
    if ([...context.samplers].some(sampler => sampler.retired && sampler.leases.size)) fail();
    const sampler = { owner, context, leases: new Set(), retired: false, service: undefined };
    context.samplers.add(sampler);
    sampler.service = createTerrainNativeBatch({ gl: context.gl,
      reserve: resources => trackedReserve(sampler, resources),
      withState: work => withOperation(context, sampler.retired ? sampler : owner, sampler.retired ? 'terrain-dispose' : 'terrain', work),
      isCurrent: () => current(owner) && visible && !sampler.retired && Boolean(activeCallback?.live) && activeCallback.owner === owner && owner.batchStamp === stamp,
      requestRender: () => { if (current(owner)) requestFrame(); },
      onComplete(token, result) {
        if (!current(owner) || owner.batchStamp !== stamp || owner.batch?.token !== token) return;
        owner.queue.complete(token, result); owner.batch = undefined;
        requestFrame();
      }
    });
    owner.sampler = sampler;
    return sampler;
  }
  function createOwner(identity, input) {
    const owner = { identity, input, serial: ++ownerSequence, styleRevision, committed: false, retired: false, leases: new Set(),
      requests: new Map(), terrainByCoordinate: new Map(), roots: new Map(), queueDisposed: false, cleaning: false,
      context: undefined, glyph: undefined, sampler: undefined, batch: undefined, terrainUnavailable: false };
    owners.add(owner);
    owner.queue = createTerrainPointQueue({ reserve: resources => trackedReserve(owner, resources) });
    owner.queue.setStamp(stamp);
    const factory = () => { fail(); };
    const participant = {
      factory,
      create(context) {
        if (!current(owner)) fail();
        owner.context = contextFor(context.gl);
        if ([...owner.context.owners].some(previous => previous !== owner && previous.glyph && !previous.glyph.retired())) fail();
        owner.context.owners.add(owner);
        // Keep the map-owned owner reachable before constructing any fallible renderer storage.
        owner.glyph = createSceneGlyphRenderer({ gl: context.gl, geographic: context.geographic,
          reserve: resources => trackedReserve(owner, resources),
          isCurrent: () => operation ? operation.owner === owner && operationCurrent(operation) : current(owner) && Boolean(activeCallback?.live),
          withState: (kind, work) => withOperation(owner.context, owner, kind === 'dispose' ? 'point-dispose' : 'point', work)
        });
        updateCompletionDemand(owner);
        return owner;
      },
      prerender(value, _frame, hook) {
        if (value !== owner || !current(owner) || !visible || !owner.requests.size) return;
        if (typeof hook !== 'function') { owner.terrainUnavailable = true; return; }
        owner.terrainUnavailable = false;
        const sampler = samplerFor(owner);
        if (!owner.batch) {
          const batch = owner.queue.beginBatch();
          if (!batch) return;
          owner.batch = batch; owner.batchStamp = stamp;
          if (!sampler.service.submit({ token: batch.token, points: batch.points.map(point => [...point]), span: 1 / (2 ** zoom * 512) })) {
            owner.queue.cancelBatch(batch.token); owner.batch = undefined; return;
          }
        }
        const result = sampler.service.prerender({ renderTerrainHeightMap: hook });
        if (result?.status === 'terrain-unavailable') {
          owner.terrainUnavailable = true;
          if (owner.batch) owner.queue.cancelBatch(owner.batch.token);
          owner.batch = undefined;
        }
      },
      render(value, frame) {
        if (value !== owner || !current(owner) || !visible) return;
        let authority;
        if (completionDemand && completion) {
          const captured = captureNativeFrameAuthority(owner.context.gl, owner.layer, owner.layer.render, activeCallback?.originalArgs);
          if (captured.status === 'admitted') authority = captured.authority;
          if (owner.lastCompletionAuthority !== authority) {
            invalidateCompletion('paint');
            owner.lastCompletionAuthority = authority;
          }
        }
        owner.glyph.render(frame, owner.input.markers, authority);
        if (authority) {
          try { completeMarkerPaint(owner, frame, authority); }
          catch { if (completion) { completion.invalidate('observation'); const input = completionInput(); if (input) completionDiagnostics.unavailable(input, completionGeneration); } }
        } else if (completionDemand && completion) {
          const input = completionInput(); if (input) completionDiagnostics.unavailable(input, completionGeneration);
        }
      },
      dispose(value, options) {
        if (value !== owner) fail();
        owner.retired = true;
        if (options.contextLost && owner.context) owner.context.lost = true;
        cleanupOwner(owner);
      }
    };
    owner.request = { descriptor: { id: layerID, label: 'Scene markers', create: factory }, revision: owner.serial, styleRevision };
    owner.lifetime = createLayerLifetime(map, {
      signal,
      isCurrent: request => baseCurrent() && active === owner && !owner.retired && owner.styleRevision === styleRevision && request === owner.request &&
        (owner.committed || identityCurrent(owner.identity)),
      isStyleReady() {
        if (awaitingStyle) return false;
        // Source loading does not revoke an already committed style and layer identity.
        if (owner.committed) return true;
        const ready = map.isStyleLoaded();
        if (!ready && !disposed && !contextLost && !awaitingStyle && active === owner && !owner.retired && owner.styleRevision === styleRevision) {
          waitingStyleReady = true;
        }
        return ready;
      },
      onState() {},
      onError(_id, code) {
        report(code === 'engine' ? 'engine' : 'render');
        if (current(owner)) publish('unavailable', owner.input, owner.identity, code === 'engine' ? 'engine' : 'render');
      }
    }, {
      participant,
      prepare(layer, nativeSignal) {
        owner.layer = layer;
        let enteringCallback = false;
        for (const method of ['prerender', 'render']) {
          const callback = layer[method];
          if (typeof callback === 'function') layer[method] = function (...args) {
            if (enteringCallback) return;
            enteringCallback = true;
            try {
              if (deferPendingInput(owner, nativeSignal)) return;
              return Reflect.apply(callback, this, args);
            } finally { enteringCallback = false; }
          };
        }
        const onAdd = layer.onAdd, onRemove = layer.onRemove;
        layer.onAdd = function (nativeMap, gl) {
          onAdd.call(this, nativeMap, gl);
          if (!nativeSignal.aborted && current(owner)) {
            const handle = map.getLayer(layer.id);
            if (handle && handle === map.getLayer(layer.id) && current(owner)) {
              owner.installationHandle = handle;
              if (completion && gl.canvas === canvas && current(owner)) {
                owner.nativeGl = gl; updateCompletionDemand(owner);
              }
            }
          }
        };
        layer.onRemove = function (...args) {
          owner.installationHandle = undefined;
          onRemove.apply(this, args);
          owner.retired = true;
          if (active === owner) active = undefined;
          if (activeCallback?.owner === owner || operation?.owner === owner) queueMicrotask(() => cleanupOwner(owner));
          else cleanupOwner(owner);
        };
        return typeof map.prepareFeatures === 'function' ? map.prepareFeatures({ layers: [layer] }, { signal: nativeSignal }) : Promise.resolve();
      },
      geographic(epoch, nativeSignal) {
        if (!owner.roots.has(epoch)) owner.roots.set(epoch, createEpochGeographicServices({ epoch,
          isCurrent: () => current(owner) && !nativeSignal.aborted,
          layout: () => layout,
          resolveTerrain(lngLat) {
            if (owner.terrainUnavailable) return { status: 'terrain-unavailable' };
            const handle = owner.terrainByCoordinate.get(lngLat.join(',')), value = handle?.resolve();
            return value?.status === 'resolved' ? { status: 'resolved', height: value.altitudes[0] } : { status: 'terrain-pending' };
          }
        }));
        return owner.roots.get(epoch);
      },
      openFrame(args, epoch, nativeSignal) {
        if (!current(owner) || !owner.input.allocation) fail();
        const input = owner.input, identity = owner.identity, revision = viewRevision;
        const originalHook = args.renderTerrainHeightMap;
        const callback = { owner, identity, stamp, live: true, originalHook,
          authority: captureNativeTerrainAuthority(owner.context.gl, originalHook) };
        if (completionDemand) { callback.originalArgs = args; callback.rawTransition = undefined; }
        if (callback.authority.status === 'refused') fail();
        activeCallback = callback; wakeup = false;
        const valid = () => callback.live && activeCallback === callback && !nativeSignal.aborted && current(owner) && owner.identity === identity && revision === viewRevision;
        let lease;
        try {
          lease = createGeographicFrameLease({ ...input.allocation, epoch, revision, time: performance.now(),
            reducedMotion: input.reducedMotion, services: owner.roots.get(epoch), isCurrent: valid,
            projectionFor(origin) {
              if (!valid()) fail();
              const data = args.getProjectionData({ tileID: { canonical: { z: origin.tile.z, x: origin.tile.x, y: origin.tile.y }, wrap: origin.tile.wrap },
                applyGlobeMatrix: true, applyTerrainMatrix: false });
              if (!valid()) fail();
              if (completionDemand) callback.rawTransition = data.projectionTransition;
              return { ...data, shaderData: args.shaderData };
            }
          });
        } catch (error) { callback.live = false; if (activeCallback === callback) activeCallback = undefined; throw error; }
        return Object.freeze({ frame: lease.frame,
          terrainHook: typeof originalHook === 'function' ? target => {
            if (!valid() || !operationCurrent(operation) || operation.owner !== owner) return;
            originalHook.call(args, target);
            // A normal return that became stale is canceled by the sampler's ordinary current check.
          } : undefined,
          close() { callback.live = false; lease.close(); if (activeCallback === callback) activeCallback = undefined; }
        });
      },
      withState() { fail(); }
    });
    return owner;
  }
  async function reconcile() {
    const attempt = ++reconcileRevision;
    if (!baseCurrent() || awaitingStyle) return;
    waitingStyleReady = false;
    const identity = capture();
    if (!identityCurrent(identity)) return;
    const input = readInput(identity);
    if (!identityCurrent(identity)) return;
    readView();
    if (!identityCurrent(identity)) return;
    if (!input.markers.length || !input.allocation) {
      retire(active); publish(input.markers.length ? 'pending' : 'empty', input, identity); return;
    }
    if (active && !active.retired && active.committed) {
      const owner = active, previous = owner.input;
      if (map.getLayer(layerID) !== owner.handle) {
        retire(owner); publish('unavailable', input, identity, 'engine'); return;
      }
      owner.identity = identity; owner.input = input;
      if (previous.allocation?.revision !== input.allocation.revision) invalidateTerrain();
      registerMarkers(owner, input);
      if (!current(owner) || attempt !== reconcileRevision) return;
      if (!commitInstallation(owner, attempt)) { retire(owner); return; }
      if (current(owner)) requestFrame();
      return;
    }
    retire(active);
    if (!identityCurrent(identity) || attempt !== reconcileRevision) return;
    const owner = createOwner(identity, input); active = owner;
    registerMarkers(owner, input); publish('pending', input, identity);
    if (!current(owner) || attempt !== reconcileRevision) { retire(owner); return; }
    await owner.lifetime.mount(owner.request);
    if (!current(owner) || attempt !== reconcileRevision || !owner.installationHandle || map.getLayer(layerID) !== owner.installationHandle) { retire(owner); return; }
    owner.handle = map.getLayer(layerID);
    if (!current(owner) || owner.handle !== map.getLayer(layerID)) { retire(owner); return; }
    if (!commitInstallation(owner, attempt)) { retire(owner); return; }
    if (current(owner)) requestFrame();
  }
  function schedule() {
    if (scheduled || disposed || signal.aborted) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void reconcile().catch(() => { report('engine'); });
    });
  }
  function inputChanged() { invalidateCompletion('input'); reconcileRevision++; schedule(); }
  function lost() {
    contextLost = true; waitingStyleReady = false; wakeup = false; reconcileRevision++;
    for (const context of retainedContexts) { context.lost = true; if (completion) loseNativeFrameContext(context.gl); }
    invalidateCompletion('context');
    retire(active, 'context-lost');
    for (const owner of [...owners]) { owner.retired = true; cleanupOwner(owner); }
    for (const context of retainedContexts) for (const sampler of [...context.samplers]) retireSampler(sampler, true);
    cleanupListeners();
  }
  function restored() {
    if (disposed || signal.aborted) return;
    contextLost = false; awaitingStyle = false; viewRevision++; stamp = Object.freeze({}); schedule();
  }
  function invalidateStyle() {
    if (disposed) return;
    invalidateCompletion('style');
    awaitingStyle = true; waitingStyleReady = false; styleRevision++; viewRevision++; stamp = Object.freeze({}); reconcileRevision++; wakeup = false;
    retire(active);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; waitingStyleReady = false; reconcileRevision++; wakeup = false;
    completion?.dispose(); completionDiagnostics?.unavailable(undefined);
    if (releaseCompletionVisibility) { const release = releaseCompletionVisibility; releaseCompletionVisibility = undefined; release(); }
    signal.removeEventListener('abort', dispose);
    if (releaseInput) { const release = releaseInput; releaseInput = undefined; try { release(); } catch { /* Retain resource cleanup independently. */ } }
    for (const [name, listener] of listeners) map.off(name, listener);
    retire(active);
    for (const owner of [...owners]) { owner.retired = true; cleanupOwner(owner); }
    cleanupListeners();
  }
  const listen = (name, listener) => { listeners.push([name, listener]); map.on(name, listener); };
  for (const name of ['move', 'resize', 'terrain', 'projectiontransition']) listen(name, () => { if (!disposed && !contextLost) invalidateTerrain(); });
  listen('sourcedata', event => { if (!disposed && !contextLost && terrainSource && event?.sourceId === terrainSource) invalidateTerrain(); });
  listen('style.load', () => { if (!disposed) { awaitingStyle = false; schedule(); } });
  listen('render', () => {
    if (!waitingStyleReady || pollingStyleReady || awaitingStyle || disposed || contextLost) return;
    pollingStyleReady = true;
    try {
      if (!baseCurrent() || !waitingStyleReady || awaitingStyle || !map.isStyleLoaded()) return;
      if (!waitingStyleReady || awaitingStyle || disposed || contextLost) return;
      waitingStyleReady = false; schedule();
    } catch { report('engine'); }
    finally { pollingStyleReady = false; }
  });
  if (completionHost) {
    completion = createSceneCompletionOwner({
      captureInput() { const value = completionInput(); if (!value) fail(); return value; },
      subscribeInput: changed => completionHost.subscribeInput(changed),
      claimPaintSerial: expected => completionHost.claimPaintSerial(expected),
      captureCameraFacts: expected => completionHost.captureCameraFacts(expected)
    }, {
      isCurrent: () => baseCurrent() && visible && !canvas.ownerDocument?.hidden,
      isInstalled: installedCurrent,
      isObservationCurrent: (observation, input) => observation.input === input && observationAuthorityCurrent(observationRecords.get(observation)),
      isResultCurrent: (issue, result) => completionResults.get(result) === issue,
      requestFrame,
      setDemand(value) { completionDemand = Boolean(value); updateCompletionDemand(active); },
      retireIssue() { for (const owner of owners) owner.observation?.invalidate(); }
    });
    const hidden = () => {
      completion.setVisible(visible && !canvas.ownerDocument.hidden);
      invalidateCompletion('visibility'); updateCompletionDemand(active);
    };
    canvas.ownerDocument?.addEventListener('visibilitychange', hidden);
    releaseCompletionVisibility = () => canvas.ownerDocument?.removeEventListener('visibilitychange', hidden);
    for (const name of ['data', 'dataloading', 'styledata', 'sourcedata']) listen(name, () => invalidateCompletion('content'));
  }
  canvas.addEventListener('webglcontextlost', lost, true);
  canvas.addEventListener('webglcontextrestored', restored);
  signal.addEventListener('abort', dispose, { once: true });
  releaseInput = subscribe(inputChanged);
  if (typeof releaseInput !== 'function') { dispose(); fail(); }
  if (disposed) { const release = releaseInput; releaseInput = undefined; release(); }
  else if (signal.aborted) dispose(); else schedule();
  return Object.freeze({ invalidateStyle, requestFrame, dispose, ...(completion ? { completion: completion.port } : {}),
    setVisible(value) {
      const previous = visible; visible = Boolean(value); active?.lifetime.setVisible(visible);
      completion?.setVisible(visible && !canvas.ownerDocument?.hidden);
      if (completion) { invalidateCompletion('visibility'); updateCompletionDemand(active); }
      if (!visible) { wakeup = false; if (active) { retireSampler(active.sampler); active.sampler = undefined; if (active.batch) active.queue.cancelBatch(active.batch.token); active.batch = undefined; } }
      else if (!previous) requestFrame();
    }
  });
}
