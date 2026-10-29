import { drawSceneGlyphObservation, readSceneGlyphObservation } from './bridge-glyph.mjs';
import { createSceneGlEnvelope } from './gl-state.mjs';
import { readNativeFrameAuthority } from './native-frame-authority.mjs';

const fail = () => { throw new TypeError('Scene completion observation is unavailable.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
const tupleEqual = (left, right) => left?.length === right?.length && Array.from(left).every((value, index) => value === right[index]);

/** CPU coordinate convention only; the observation shader selects the actual GPU depth cell. */
export function mapSceneAnchorPixel(point, allocation) {
  try {
    const { width, height, backingWidth, backingHeight } = allocation;
    if (!Array.isArray(point) || point.length !== 2 || !point.every(finite) || !positive(width) || !positive(height) ||
        !Number.isSafeInteger(backingWidth) || backingWidth <= 0 || !Number.isSafeInteger(backingHeight) || backingHeight <= 0 ||
        point[0] < 0 || point[0] >= width || point[1] < 0 || point[1] >= height) return undefined;
    const x = Math.floor(point[0] * backingWidth / width);
    const y = backingHeight - 1 - Math.floor(point[1] * backingHeight / height);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || x >= backingWidth || y < 0 || y >= backingHeight) return undefined;
    return Object.freeze([x, y]);
  } catch { return undefined; }
}

function admitScope(facts, glyph) {
  const { frame, phase } = facts, layers = frame.orderedLayers;
  if (phase.pass !== 'translucent' || !Array.isArray(layers) || layers.length === 0 ||
      phase.currentLayer !== layers.length - 1 || layers[phase.currentLayer]?.type !== 'custom' ||
      layers.slice(0, -1).some(layer => !['background', 'fill-extrusion'].includes(layer.type)) ||
      frame.terrainEnabled !== false || frame.projection !== 'mercator' || frame.projectionTransition !== 0 ||
      frame.debug !== false || frame.tailDraws !== false || glyph.markerCount !== 1 || glyph.altitudeReference !== 'sea-level') fail();
}

/** Runs fixed glyph observations and bounded read-only polling on one owned native context. */
export function createSceneCompletionObservation({ gl, isCurrent, requestAnimationFrame, cancelAnimationFrame, now, onComplete, onUnavailable }) {
  if (!gl || typeof gl.isContextLost !== 'function' ||
      [isCurrent, requestAnimationFrame, cancelAnimationFrame, now, onComplete, onUnavailable].some(value => typeof value !== 'function')) fail();
  let closed = false, visible = true, lost = false, working = false, retiring = false, generation = 0;
  let pending, scheduled, operation;
  // At most eight queries and one sync, including failed retirement. Packet payload belongs
  // to the glyph owner; these bounded identity/scalar records and driver storage are overhead.
  const retained = new Set();

  function live() {
    if (lost) return false;
    if (gl.isContextLost()) { lost = true; return false; }
    return true;
  }

  function ownerCurrent() {
    if (closed || !visible || !live()) return false;
    const result = isCurrent();
    return Boolean(result) && !closed && visible && live();
  }

  function check(record, stage) {
    if (!ownerCurrent() || record.cancelled || record.generation !== generation) fail();
    readNativeFrameAuthority(record.authority, gl, stage);
    if (closed || !visible || record.cancelled || record.generation !== generation || !live()) fail();
  }

  function call(record, stage, name, args, save) {
    check(record, stage);
    const value = gl[name](...args);
    save?.(value);
    check(record, stage);
    return value;
  }

  // Retirement has its own live-context authority after input, phase or visibility expiry.
  function cleanupCall(name, args, save) {
    if (!live()) fail();
    const value = gl[name](...args);
    save?.(value);
    if (!live()) fail();
    return value;
  }

  const envelope = createSceneGlEnvelope(gl, { profile: 'point', isCurrent() {
    try { if (!operation) return false; check(operation, 'render'); return true; }
    catch { return false; }
  } });

  function cancelScheduled() {
    const previous = scheduled;
    scheduled = undefined;
    if (previous?.id !== undefined) {
      try { cancelAnimationFrame(previous.id); } catch { /* The detached callback remains inert. */ }
    }
  }

  function forgetLost() {
    if (!lost) return;
    for (const record of retained) {
      for (const query of record.queries) { query.handle = undefined; query.open = false; }
      record.sync = undefined;
    }
    retained.clear();
  }

  function endOwned(query) {
    if (!query.handle || !query.open) return;
    const actual = cleanupCall('getQuery', [gl.ANY_SAMPLES_PASSED, gl.CURRENT_QUERY]);
    if (actual === query.handle) {
      cleanupCall('endQuery', [gl.ANY_SAMPLES_PASSED], () => { query.open = false; });
    } else if (actual === null) {
      // beginQuery can throw before starting; no unrelated query is ever ended.
      query.open = false;
    } else fail();
  }

  function retire(record) {
    if (retiring) return false;
    retiring = true;
    let failed = false;
    const attempt = work => { try { work(); } catch { failed = true; } };
    try {
      if (lost) { forgetLost(); return true; }
      for (const query of record.queries) {
        if (!query.handle) continue;
        attempt(() => {
          endOwned(query);
          cleanupCall('deleteQuery', [query.handle], () => { query.handle = undefined; });
        });
      }
      if (record.sync) attempt(() => cleanupCall('deleteSync', [record.sync], () => { record.sync = undefined; }));
      if (lost) forgetLost();
      else if (!record.sync && record.queries.every(query => !query.handle)) retained.delete(record);
      return !failed && !retained.has(record);
    } finally {
      retiring = false;
    }
  }

  function retireUnused() {
    if (retiring) return;
    for (const record of retained) if (record !== pending) retire(record);
    forgetLost();
  }

  function notifyUnavailable(record) {
    if (record.notified || record.generation !== generation) return;
    try { if (!ownerCurrent()) return; } catch { return; }
    if (record.notified || record.generation !== generation || closed || !visible || lost) return;
    record.notified = true;
    try { onUnavailable(record.ticket, 'completion-unavailable'); } catch { /* Notification cannot reopen work. */ }
  }

  function discard(record, notify = false) {
    if (!record) return;
    record.cancelled = true;
    record.authority = undefined;
    if (pending === record) { pending = undefined; cancelScheduled(); }
    retire(record);
    if (notify) notifyUnavailable(record);
  }

  function target(record, glyph) {
    const get = parameter => call(record, 'render', 'getParameter', [parameter]);
    if (!positive(glyph.width) || !positive(glyph.height) || !Number.isSafeInteger(glyph.backingWidth) || glyph.backingWidth <= 0 ||
        !Number.isSafeInteger(glyph.backingHeight) || glyph.backingHeight <= 0 ||
        get(gl.DRAW_FRAMEBUFFER_BINDING) !== null || get(gl.READ_FRAMEBUFFER_BINDING) !== null ||
        !tupleEqual(get(gl.VIEWPORT), glyph.viewport) || !tupleEqual(glyph.viewport, [0, 0, glyph.backingWidth, glyph.backingHeight]) ||
        gl.drawingBufferWidth !== glyph.backingWidth || gl.drawingBufferHeight !== glyph.backingHeight ||
        get(gl.DEPTH_FUNC) !== gl.LEQUAL || glyph.depthFunction !== gl.LEQUAL ||
        !tupleEqual(get(gl.DEPTH_RANGE), glyph.depthRange) || glyph.depthRange.length !== 2 || !glyph.depthRange.every(finite) ||
        glyph.depthRange[0] < 0 || glyph.depthRange[0] >= glyph.depthRange[1] || glyph.depthRange[1] > 1 ||
        !tupleEqual(get(gl.SCISSOR_BOX), glyph.scissor) || glyph.scissor.length !== 4 || !glyph.scissor.every(Number.isSafeInteger) ||
        glyph.scissor[2] < 0 || glyph.scissor[3] < 0 ||
        call(record, 'render', 'isEnabled', [gl.SCISSOR_TEST]) !== glyph.scissorEnabled) fail();
    check(record, 'render');
  }

  function baseline(record) {
    const set = (name, ...args) => call(record, 'render', name, args);
    set('colorMask', false, false, false, false);
    set('depthMask', false);
    set('enable', gl.DEPTH_TEST);
    set('enable', gl.BLEND);
    set('blendEquationSeparate', gl.FUNC_ADD, gl.FUNC_ADD);
    set('blendFuncSeparate', gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const name of ['STENCIL_TEST', 'CULL_FACE', 'RASTERIZER_DISCARD', 'SAMPLE_COVERAGE',
      'SAMPLE_ALPHA_TO_COVERAGE', 'POLYGON_OFFSET_FILL']) set('disable', gl[name]);
  }

  function submit(record, plan, glyph) {
    baseline(record);
    for (const mode of [1, 2]) {
      const query = { handle: undefined, open: false };
      record.queries.push(query);
      call(record, 'render', 'createQuery', [], value => { if (!value) fail(); query.handle = value; });
      let failed = false;
      try {
        query.open = true;
        call(record, 'render', 'beginQuery', [gl.ANY_SAMPLES_PASSED, query.handle]);
        if (call(record, 'render', 'getQuery', [gl.ANY_SAMPLES_PASSED, gl.CURRENT_QUERY]) !== query.handle) fail();
        check(record, 'render');
        drawSceneGlyphObservation(plan, gl, record.authority, mode);
        check(record, 'render');
        target(record, glyph);
        if (call(record, 'render', 'getQuery', [gl.ANY_SAMPLES_PASSED, gl.CURRENT_QUERY]) !== query.handle) fail();
        call(record, 'render', 'endQuery', [gl.ANY_SAMPLES_PASSED], () => { query.open = false; });
      } catch { failed = true; }
      finally {
        if (query.open) { try { endOwned(query); } catch { failed = true; } }
      }
      if (failed) fail();
    }
    call(record, 'render', 'fenceSync', [gl.SYNC_GPU_COMMANDS_COMPLETE, 0], value => { if (!value) fail(); record.sync = value; });
    call(record, 'render', 'flush', []);
    target(record, glyph);
  }

  function schedule(record) {
    if (scheduled || pending !== record || record.cancelled) return;
    const entry = { record, id: undefined };
    let returning = false, synchronous = false;
    scheduled = entry;
    try {
      const id = requestAnimationFrame(() => {
        if (!returning) { synchronous = true; return; }
        if (scheduled !== entry) return;
        scheduled = undefined;
        poll(record);
      });
      returning = true;
      entry.id = id;
      if (synchronous) fail();
      if (scheduled !== entry || pending !== record || record.cancelled || closed || !visible) {
        try { cancelAnimationFrame(id); } catch { /* A detached callback cannot do work. */ }
      }
    } catch {
      returning = true;
      if (scheduled === entry) cancelScheduled();
      discard(record, true);
    }
  }

  function poll(record) {
    if (working || retiring || pending !== record || record.cancelled) return;
    working = true;
    let retry = false, result, failed = false, stale = false;
    try {
      try { check(record, 'completed'); } catch { stale = true; fail(); }
      const time = now();
      check(record, 'completed');
      record.polls++;
      if (!finite(time) || time < record.started || record.polls >= 120 || time - record.started >= 2000) fail();
      const status = call(record, 'completed', 'clientWaitSync', [record.sync, 0, 0]);
      if (status === gl.WAIT_FAILED || ![gl.TIMEOUT_EXPIRED, gl.ALREADY_SIGNALED, gl.CONDITION_SATISFIED].includes(status)) fail();
      if (status === gl.TIMEOUT_EXPIRED) retry = true;
      else {
        const available = record.queries.map(query => call(record, 'completed', 'getQueryParameter', [query.handle, gl.QUERY_RESULT_AVAILABLE]));
        if (!available.every(value => value === true)) retry = true;
        else {
          const values = record.queries.map(query => call(record, 'completed', 'getQueryParameter', [query.handle, gl.QUERY_RESULT]));
          if (values.some(value => typeof value !== 'boolean')) fail();
          result = Object.freeze({ anchor: values[0], object: values[1] });
        }
      }
      check(record, 'completed');
    } catch { failed = true; }
    if (failed) discard(record, !stale);
    else if (result) {
      if (!retire(record)) discard(record, true);
      else {
        try {
          check(record, 'completed');
          if (pending !== record) fail();
          pending = undefined;
          record.cancelled = true;
          onComplete(record.ticket, result);
        } catch { discard(record); }
      }
    }
    working = false;
    retireUnused();
    if (closed) envelope.dispose();
    if (retry && pending === record && !record.cancelled) schedule(record);
  }

  function invalidate() {
    generation++;
    const previous = pending;
    pending = undefined;
    if (previous) { previous.cancelled = true; previous.authority = undefined; }
    cancelScheduled();
    if (!working) retireUnused();
  }

  return Object.freeze({
    issue({ plan, authority } = {}) {
      if (working || retiring || closed || !visible || pending) return undefined;
      let record, succeeded = false;
      working = true;
      try {
        retireUnused();
        const candidate = { authority, generation, cancelled: false };
        check(candidate, 'render');
        const facts = readNativeFrameAuthority(authority, gl, 'render');
        const glyph = readSceneGlyphObservation(plan, gl, authority);
        check(candidate, 'render');
        admitScope(facts, glyph);
        let queries = 0, syncs = 0;
        for (const previous of retained) {
          queries += previous.queries.filter(query => query.handle).length;
          if (previous.sync) syncs++;
        }
        if (queries > 6 || syncs > 0) fail();
        const started = now();
        if (!finite(started) || started < 0) fail();
        check(candidate, 'render');
        operation = candidate;
        envelope.run(() => {
          target(candidate, glyph);
          record = { ...candidate, ticket: Object.freeze(Object.create(null)), queries: [], sync: undefined,
            started, polls: 0, notified: false };
          retained.add(record);
          pending = record;
          operation = record;
          submit(record, plan, glyph);
        });
        check(record, 'render');
        succeeded = true;
      } catch {
        if (record) discard(record, true);
      } finally {
        operation = undefined;
        working = false;
        retireUnused();
        if (closed) envelope.dispose();
      }
      if (!succeeded || !record || record.cancelled || pending !== record) return undefined;
      schedule(record);
      return pending === record && !record.cancelled ? record.ticket : undefined;
    },
    invalidate,
    setVisible(value) {
      if (closed) return;
      visible = Boolean(value);
      if (!visible) invalidate();
    },
    dispose({ contextLost = false } = {}) {
      closed = true;
      // A caller hint cannot retire live native resources without observing actual loss.
      if (contextLost) { try { live(); } catch { /* Keep unverified ownership retained. */ } }
      invalidate();
      if (!working) { retireUnused(); envelope.dispose(); }
    },
    retired() { return closed && !working && !retiring && !pending && !scheduled && retained.size === 0; }
  });
}
