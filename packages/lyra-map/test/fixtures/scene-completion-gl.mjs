import assert from 'node:assert/strict';
import { createSceneBridgeGl } from './scene-bridge-gl.mjs';

/** Query bookkeeping extends the shared GL fixture; it does not simulate rasterized visibility. */
export function createSceneCompletionGl(options) {
  const gpu = createSceneBridgeGl(options), { gl } = gpu;
  const queryRecords = new Map(), callbacks = new Map(), requests = [], cancels = [];
  let querySerial = 0, callbackSerial = 0, time = 0, timerQuery;
  gl.QUERY_RESULT_AVAILABLE = 'QUERY_RESULT_AVAILABLE'; gl.QUERY_RESULT = 'QUERY_RESULT';
  gl.TIME_ELAPSED_EXT = 'TIME_ELAPSED_EXT';
  const call = (name, work) => {
    gl[name] = function (...args) {
      assert.equal(this, gl, `${name} preserves its WebGL receiver`);
      gpu.calls.push([name, ...args]);
      assert.equal(gl.isContextLost(), false, `${name} cannot run after loss`);
      gpu.beforeCall?.(name, args);
      assert.equal(gl.isContextLost(), false, `${name} cannot continue after loss`);
      const result = work(...args); gpu.afterCall?.(name, args, result); return result;
    };
  };
  const record = query => {
    assert.ok(queryRecords.has(query) && !gpu.deleted.has(query), 'query operation uses a live owned query');
    return queryRecords.get(query);
  };
  call('createQuery', () => {
    const query = Object.freeze({ kind: 'Query', id: ++querySerial });
    queryRecords.set(query, { active: false, ended: false, available: false, result: true });
    gpu.created.add(query); return query;
  });
  call('isQuery', query => queryRecords.has(query) && !gpu.deleted.has(query));
  call('beginQuery', (target, query) => {
    assert.equal(target, gl.ANY_SAMPLES_PASSED); assert.equal(gpu.queries.get(target) ?? null, null, 'never nest query targets');
    const value = record(query); assert.equal(value.active, false); assert.equal(value.ended, false);
    value.active = true; gpu.queries.set(target, query);
  });
  call('endQuery', target => {
    assert.equal(target, gl.ANY_SAMPLES_PASSED);
    const query = gpu.queries.get(target), value = record(query);
    assert.equal(value.active, true); value.active = false; value.ended = true; gpu.queries.delete(target);
  });
  call('getQueryParameter', (query, parameter) => {
    const value = record(query); assert.equal(value.active, false, 'never poll an active query');
    assert.equal(value.ended, true, 'only an ended query has completion evidence');
    if (parameter === gl.QUERY_RESULT_AVAILABLE) return value.available;
    assert.equal(parameter, gl.QUERY_RESULT); assert.equal(value.available, true, 'never synchronously read unavailable result');
    return value.result;
  });
  call('deleteQuery', query => {
    const value = record(query); assert.equal(value.active, false, 'retire only a safely ended query');
    gpu.deleted.add(query);
  });
  const originalExtension = gl.getExtension;
  gl.getExtension = function (name) {
    if (name !== 'EXT_disjoint_timer_query_webgl2' || !timerQuery) return Reflect.apply(originalExtension, this, [name]);
    assert.equal(this, gl); gpu.calls.push(['getExtension', name]);
    assert.equal(gl.isContextLost(), false, 'getExtension cannot run after loss');
    gpu.beforeCall?.('getExtension', [name]);
    assert.equal(gl.isContextLost(), false, 'getExtension cannot continue after loss');
    const result = Object.freeze({ TIME_ELAPSED_EXT: gl.TIME_ELAPSED_EXT }); gpu.afterCall?.('getExtension', [name], result); return result;
  };
  const raf = {
    request(callback) { const id = ++callbackSerial; callbacks.set(id, callback); requests.push(id); return id; },
    cancel(id) { callbacks.delete(id); cancels.push(id); },
    step(milliseconds = 16) {
      assert.ok(Number.isFinite(milliseconds) && milliseconds >= 0); time += milliseconds;
      const pending = [...callbacks]; callbacks.clear();
      for (const [, callback] of pending) callback(time);
    },
    now: () => time,
    get pending() { return callbacks.size; }, requests, cancels
  };
  return Object.assign(gpu, {
    queryRecords, raf,
    settleQueries(results = true) {
      let index = 0;
      for (const [query, value] of queryRecords) if (value.ended && !gpu.deleted.has(query)) {
        value.available = true; value.result = Array.isArray(results) ? results[index++] : results;
        assert.equal(typeof value.result, 'boolean');
      }
    },
    foreignQuery(target = gl.ANY_SAMPLES_PASSED) {
      const query = Object.freeze({ kind: 'Query', foreign: true }); gpu.queries.set(target, query); return query;
    },
    setTimerQuery(value) {
      timerQuery = Boolean(value);
      if (timerQuery) gpu.queries.set(gl.TIME_ELAPSED_EXT, Object.freeze({ foreign: true, timer: true }));
      else gpu.queries.delete(gl.TIME_ELAPSED_EXT);
    }
  });
}
