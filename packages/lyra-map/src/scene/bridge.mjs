import { createSceneGlyphRenderer } from './bridge-glyph.mjs';
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

/** Composes one owned marker layer without publishing completed visibility or whole-scene readiness. */
export function createSceneBridge(map, host) {
  const signal = field(host, 'signal'), hostCurrent = field(host, 'isCurrent');
  const capture = field(host, 'captureRenderInput'), subscribe = field(host, 'subscribeRenderInput');
  const onState = field(host, 'onState'), onError = field(host, 'onError');
  if (!signal || typeof signal.addEventListener !== 'function' ||
      [hostCurrent, capture, subscribe, onState, onError].some(value => typeof value !== 'function')) fail();
  for (const name of ['addLayer', 'removeLayer', 'getLayer', 'getCanvas', 'isStyleLoaded', 'triggerRepaint',
    'getCenter', 'getZoom', 'getPitch', 'getBearing', 'getTerrain', 'getProjection', 'on', 'off']) if (typeof map?.[name] !== 'function') fail();
  const canvas = map.getCanvas();
  if (!canvas || typeof canvas.addEventListener !== 'function' || typeof canvas.removeEventListener !== 'function') fail();
  if (!positive(++bridgeSequence)) fail();
  const layerID = `scene-markers-${bridgeSequence}`;
  // Two bounded queue packets, one native sampler and two scalar staging records may overlap.
  const ledger = createSceneResourceLedger({ bytes: 2000 * 56 + 400 + 72 });
  const contexts = new WeakMap(), retainedContexts = new Set(), owners = new Set(), listeners = [];
  let disposed = false, visible = true, contextLost = false, awaitingStyle = false, scheduled = false, wakeup = false;
  let active, operation, activeCallback, releaseInput, reconcileRevision = 0, installationRevision = 0, ownerSequence = 0, contextSequence = 0;
  let viewRevision = 1, styleRevision = 1, stamp = Object.freeze({}), layout, zoom = 0, terrainSource;

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
      retireSampler(owner.sampler, owner.context?.lost);
      if (owner.glyph) {
        try { owner.glyph.dispose({ contextLost: Boolean(owner.context?.lost) }); } catch { report('render'); }
      }
      if (!owner.leases.size && (!owner.glyph || owner.glyph.retired()) && (!owner.sampler || !owner.sampler.leases.size)) {
        owner.context?.owners.delete(owner); owners.delete(owner);
      }
    } finally { owner.cleaning = false; cleanupListeners(); }
  }
  function retire(owner, reason) {
    if (!owner) return;
    owner.retired = true;
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
    viewRevision++; stamp = Object.freeze({});
    try {
      readView();
      if (active && !active.retired) {
        active.queue.setStamp(stamp); active.batch = undefined; active.terrainUnavailable = false;
        retireSampler(active.sampler); active.sampler = undefined;
        registerMarkers(active, active.input);
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
        owner.glyph.render(frame, owner.input.markers);
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
      isStyleReady: () => !awaitingStyle && map.isStyleLoaded(),
      onState() {},
      onError(_id, code) {
        report(code === 'engine' ? 'engine' : 'render');
        if (current(owner)) publish('unavailable', owner.input, owner.identity, code === 'engine' ? 'engine' : 'render');
      }
    }, {
      participant,
      prepare(layer, nativeSignal) {
        owner.layer = layer;
        const onAdd = layer.onAdd, onRemove = layer.onRemove;
        layer.onAdd = function (nativeMap, gl) {
          onAdd.call(this, nativeMap, gl);
          if (!nativeSignal.aborted && current(owner)) {
            const handle = map.getLayer(layer.id);
            if (handle && handle === map.getLayer(layer.id) && current(owner)) owner.installationHandle = handle;
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
  function inputChanged() { reconcileRevision++; schedule(); }
  function lost() {
    contextLost = true; wakeup = false; reconcileRevision++;
    for (const context of retainedContexts) context.lost = true;
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
    awaitingStyle = true; styleRevision++; viewRevision++; stamp = Object.freeze({}); reconcileRevision++; wakeup = false;
    retire(active);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; reconcileRevision++; wakeup = false;
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
  canvas.addEventListener('webglcontextlost', lost, true);
  canvas.addEventListener('webglcontextrestored', restored);
  signal.addEventListener('abort', dispose, { once: true });
  releaseInput = subscribe(inputChanged);
  if (typeof releaseInput !== 'function') { dispose(); fail(); }
  if (disposed) { const release = releaseInput; releaseInput = undefined; release(); }
  else if (signal.aborted) dispose(); else schedule();
  return Object.freeze({ invalidateStyle, requestFrame, dispose,
    setVisible(value) {
      const previous = visible; visible = Boolean(value); active?.lifetime.setVisible(visible);
      if (!visible) { wakeup = false; if (active) { retireSampler(active.sampler); active.sampler = undefined; if (active.batch) active.queue.cancelBatch(active.batch.token); active.batch = undefined; } }
      else if (!previous) requestFrame();
    }
  });
}
