import assert from 'node:assert/strict';
import test from 'node:test';
import { createLayerLifetime } from '../src/scene/lifetime.mjs';

const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(options = {}) {
  const controller = new AbortController(), layers = new Map(), events = [];
  const calls = { add: [], remove: [], prepare: [], geographic: [], open: [], close: [], guards: 0, repaint: 0 };
  const gl = {}, canvas = {}, args = {}, frame = { revision: 1 }, geographic = {};
  let guarded = false, current, styleReady = true, activeCallback = false;
  const map = {
    getCanvas: () => canvas,
    getLayer: id => layers.get(id),
    addLayer(layer, before) {
      assert.equal(layers.has(layer.id), false);
      calls.add.push({ layer, before }); layers.set(layer.id, layer);
      layer.onAdd(map, gl);
    },
    removeLayer(id) {
      assert.equal(activeCallback, false, 'native removal waits until the callback exits');
      calls.remove.push(id);
      const layer = layers.get(id); layers.delete(id); layer?.onRemove?.(map, gl);
    },
    triggerRepaint() { calls.repaint++; }
  };
  const host = {
    signal: controller.signal,
    isCurrent: request => request === current,
    isStyleReady: () => styleReady,
    onState(id, state, code) { events.push({ id, state, code }); options.onState?.(id, state, code); },
    onError(id, code) { events.push({ id, error: code }); }
  };
  const services = {
    prepare(layer, signal) { calls.prepare.push({ layer, signal }); return options.prepare?.(layer, signal) ?? Promise.resolve(); },
    geographic(epoch, signal) { calls.geographic.push({ epoch, signal }); return geographic; },
    openFrame(value, epoch, signal) {
      assert.equal(value, args); calls.open.push({ epoch, signal });
      let closed = false;
      return { frame, close() { assert.equal(closed, false); closed = true; calls.close.push(epoch); } };
    },
    withState(value, work) {
      assert.equal(value, gl); calls.guards++; const previous = guarded; guarded = true;
      try { return work(); } finally { guarded = previous; }
    }
  };
  const lifetime = createLayerLifetime(map, host, services);
  return {
    lifetime, map, host, services, layers, calls, events, gl, frame, geographic, controller,
    guarded: () => guarded,
    setStyleReady(value) { styleReady = value; },
    request(create, change = {}) {
      return { descriptor: { id: 'scene', label: 'Scene', create, ...change }, revision: 1, styleRevision: 1 };
    },
    mount(request) { current = request; return lifetime.mount(request); },
    async callback(method = 'render', layer = layers.get('scene')) {
      activeCallback = true;
      try { assert.doesNotThrow(() => layer[method](gl, args)); }
      finally { activeCallback = false; }
      await flush();
    },
    ready: () => events.filter(event => event.state === 'ready').length
  };
}

test('state guard is a required dependency before native mutation', () => {
  const item = fixture();
  assert.throws(() => createLayerLifetime(item.map, item.host, { ...item.services, withState: undefined }));
  assert.equal(item.calls.add.length, 0);
  item.lifetime.dispose();
});

test('invalid descriptors and unsafe revisions are rejected before preparation or native mutation', async () => {
  for (const change of [
    { descriptor: { id: '', label: 'Scene', create() {} } },
    { descriptor: { id: 'scene', label: '', create() {} } },
    { descriptor: { id: 'scene', label: 'Scene', create: null } },
    { revision: 0 }, { revision: 1.5 }, { revision: Number.MAX_SAFE_INTEGER + 1 },
    { styleRevision: -1 }, { styleRevision: Infinity }
  ]) {
    const item = fixture();
    const request = { ...item.request(() => ({ render() {}, dispose() {} })), ...change };
    try { await item.mount(request); } catch { /* Admission may reject the mount promise. */ }
    assert.equal(item.calls.prepare.length, 0); assert.equal(item.calls.add.length, 0);
    assert.equal(item.events.filter(event => event.error === 'invalid').length, 1);
    item.lifetime.dispose();
  }
});

test('replaced or disposed preparation cannot install or announce readiness', async () => {
  for (const replacement of [false, true]) {
    const wait = deferred(), item = fixture({ prepare: () => wait.promise });
    let creates = 0;
    const old = item.mount(item.request(() => { creates++; return { render() {}, dispose() {} }; }));
    assert.equal(item.events[0]?.state, 'loading');
    let next;
    if (replacement) next = item.mount(item.request(() => ({ render() {}, dispose() {} }), { id: 'next' }));
    else item.lifetime.dispose();
    wait.resolve(); await old; await next;
    assert.equal(creates, 0);
    assert.equal(item.calls.add.filter(call => call.layer.id === 'scene').length, 0);
    assert.equal(item.ready(), 0);
    item.lifetime.dispose();
  }
});

test('missing anchor and unavailable style preserve a desired request for explicit retry', async () => {
  const item = fixture(); let creates = 0;
  item.setStyleReady(false);
  await item.mount(item.request(() => { creates++; return { render() {}, dispose() {} }; }, { before: 'labels' }));
  assert.equal(item.calls.add.length, 0);
  item.setStyleReady(true); await item.lifetime.retry();
  assert.equal(item.calls.add.length, 0);
  item.layers.set('labels', { id: 'labels' }); await item.lifetime.retry();
  assert.equal(item.calls.add.length, 1); assert.equal(item.calls.add[0].before, 'labels');
  assert.equal(creates, 0); assert.equal(item.ready(), 0);
  await item.callback(); assert.equal(creates, 1); assert.equal(item.ready(), 1);
  item.lifetime.dispose();
});

test('foreign same-ID layers are neither replaced nor removed, including external replacement', async () => {
  const item = fixture(), foreign = { id: 'scene' };
  item.layers.set('scene', foreign);
  await item.mount(item.request(() => ({ render() {}, dispose() {} })));
  assert.equal(item.calls.add.length, 0); item.lifetime.dispose();
  assert.equal(item.layers.get('scene') === foreign, true); assert.equal(item.calls.remove.length, 0);
  const owned = fixture(); let disposals = 0;
  await owned.mount(owned.request(() => ({ render() {}, dispose() { disposals++; } })));
  await owned.callback(); owned.layers.set('scene', foreign); owned.lifetime.dispose();
  assert.equal(owned.layers.get('scene') === foreign, true);
  assert.equal(owned.calls.remove.length, 0); assert.equal(disposals, 1);
});

test('factory and captured callbacks run guarded once per frame and every lease closes once', async () => {
  const item = fixture(); let creates = 0, renders = 0, prerenders = 0, disposals = 0, context;
  const instance = {
    prerender(frame) { assert.equal(item.guarded(), true); assert.equal(frame, item.frame); prerenders++; },
    render(frame) { assert.equal(item.guarded(), true); assert.equal(frame, item.frame); renders++; },
    dispose() { assert.equal(item.guarded(), true); disposals++; }
  };
  await item.mount(item.request(value => {
    assert.equal(item.guarded(), true); creates++; context = value; return instance;
  }));
  assert.equal(creates, 0); assert.equal(item.ready(), 0);
  await item.callback('prerender');
  instance.render = () => { throw new Error('replacement callback must not run'); };
  await item.callback(); await item.callback();
  assert.equal(creates, 1); assert.equal(prerenders, 1); assert.equal(renders, 2);
  assert.equal(context.gl, item.gl); assert.equal(context.geographic, item.geographic);
  assert.equal(item.calls.open.length, 3); assert.equal(item.calls.close.length, 3);
  assert.equal(item.ready(), 1); item.lifetime.dispose(); item.lifetime.dispose(); assert.equal(disposals, 1);
});

test('reentrant factory disposal retires its returned instance without rendering or readiness', async () => {
  const item = fixture(); let disposals = 0, renders = 0, signal;
  await item.mount(item.request(context => {
    signal = context.signal; item.lifetime.dispose();
    return { render() { renders++; }, dispose() { disposals++; } };
  }));
  await item.callback();
  assert.equal(signal.aborted, true); assert.equal(disposals, 1); assert.equal(renders, 0);
  assert.equal(item.ready(), 0); assert.equal(item.calls.remove.length, 1);
  assert.equal(item.calls.open.length, item.calls.close.length);
});

test('throwing render closes its frame and restores the guard before sanitized retirement', async () => {
  const item = fixture(); let disposals = 0;
  await item.mount(item.request(() => ({
    render() { throw new Error('untrusted callback detail'); }, dispose() { disposals++; }
  })));
  await item.callback();
  assert.equal(item.guarded(), false); assert.equal(item.calls.open.length, 1);
  assert.equal(item.calls.close.length, 1); assert.equal(disposals, 1);
  assert.equal(item.events.filter(event => event.error === 'render').length, 1);
  assert.equal(JSON.stringify(item.events).includes('untrusted callback detail'), false);
  assert.equal(item.ready(), 0); item.lifetime.dispose(); assert.equal(disposals, 1);
});

test('loading notification can replace a request before preparation or installation', async () => {
  let item, replacement, replaced = false, oldCreates = 0;
  item = fixture({ onState(id, state) {
    if (id === 'scene' && state === 'loading' && !replaced) {
      replaced = true;
      replacement = item.mount(item.request(() => ({ render() {}, dispose() {} }), { id: 'next' }));
    }
  } });
  await item.mount(item.request(() => { oldCreates++; return { render() {}, dispose() {} }; }));
  await replacement;
  assert.equal(oldCreates, 0); assert.equal(item.layers.has('scene'), false);
  assert.equal(item.layers.has('next'), true); assert.equal(item.ready(), 0);
  item.lifetime.dispose();
});

test('context loss, duplicate removal and disposal retire once without restoring lost GL state', async () => {
  const item = fixture(); let disposals = 0, context;
  await item.mount(item.request(value => { context = value; return { render() {}, dispose() { disposals++; } }; }));
  await item.callback(); const layer = item.layers.get('scene'), guards = item.calls.guards;
  item.lifetime.invalidate('context-lost'); layer.onRemove(item.map, item.gl);
  layer.onRemove(item.map, item.gl); item.lifetime.dispose();
  assert.equal(context.signal.aborted, true); assert.equal(disposals, 1);
  assert.equal(item.calls.guards, guards);
});

test('render requests coalesce and stale, hidden, lost and aborted contexts stay inert', async () => {
  const item = fixture(), contexts = []; let disposals = 0;
  await item.mount(item.request(context => { contexts.push(context); return { render() {}, dispose() { disposals++; } }; }));
  await item.callback();
  let before = item.calls.repaint;
  contexts[0].requestRender(); contexts[0].requestRender(); contexts[0].requestRender(); await flush();
  assert.equal(item.calls.repaint - before, 1);
  await item.callback(); item.lifetime.setVisible(false); before = item.calls.repaint;
  contexts[0].requestRender(); await flush(); assert.equal(item.calls.repaint, before);
  item.lifetime.setVisible(true); await flush(); assert.equal(item.calls.repaint - before, 1);
  item.lifetime.invalidate('context-lost'); before = item.calls.repaint;
  contexts[0].requestRender(); contexts[0].reportState('ready'); await flush();
  assert.equal(item.calls.repaint, before);
  await item.lifetime.retry(); await item.callback();
  assert.equal(contexts.length, 2); assert.notEqual(contexts[0].signal, contexts[1].signal);
  assert.notEqual(item.calls.geographic[0].epoch, item.calls.geographic[1].epoch);
  assert.equal(contexts[0].signal.aborted, true); assert.equal(disposals, 1);
  before = item.calls.repaint; item.controller.abort(); contexts[1].requestRender(); await flush();
  assert.equal(item.calls.repaint, before); item.lifetime.dispose(); assert.equal(disposals, 2);
});

test('promise-returning factories and render callbacks cannot publish ready frames', async () => {
  for (const asynchronousFactory of [true, false]) {
    const item = fixture();
    await item.mount(item.request(() => asynchronousFactory
      ? Promise.resolve({ render() {}, dispose() {} })
      : { render() { return Promise.resolve(); }, dispose() {} }));
    await item.callback();
    assert.equal(item.ready(), 0);
    assert.equal(item.events.filter(event => event.error).length, 1);
    assert.equal(item.calls.open.length, item.calls.close.length);
    item.lifetime.dispose();
  }
});

test('geographic service reentrant disposal prevents the factory from running', async () => {
  const item = fixture(); let creates = 0;
  item.services.geographic = () => { item.lifetime.dispose(); return item.geographic; };
  await item.mount(item.request(() => { creates++; return { render() {}, dispose() {} }; }));
  await item.callback();
  assert.equal(creates, 0); assert.equal(item.calls.open.length, 0); assert.equal(item.ready(), 0);
});

test('frame service reentrant disposal closes its lease without invoking the captured render', async () => {
  const item = fixture(); let renders = 0, closes = 0, disposals = 0;
  item.services.openFrame = () => {
    item.lifetime.dispose();
    return { frame: item.frame, close() { closes++; } };
  };
  await item.mount(item.request(() => ({ render() { renders++; }, dispose() { disposals++; } })));
  await item.callback();
  assert.equal(renders, 0); assert.equal(closes, 1); assert.equal(disposals, 1); assert.equal(item.ready(), 0);
});

test('invalid descriptor accessors are never evaluated while reporting admission errors', async () => {
  const item = fixture(); let reads = 0;
  const request = { revision: 1, styleRevision: 1 };
  Object.defineProperty(request, 'descriptor', { get() { reads++; throw new Error('caller getter'); } });
  await assert.doesNotReject(() => item.mount(request));
  assert.equal(reads, 0); assert.equal(item.calls.prepare.length, 0);
  assert.equal(item.events.filter(event => event.error === 'invalid').length, 1);
  item.lifetime.dispose();
});

test('throwing host currency lookup cannot escape a native callback', async () => {
  const item = fixture();
  await item.mount(item.request(() => ({ render() {}, dispose() {} })));
  item.host.isCurrent = () => { throw new Error('host lookup'); };
  await item.callback();
  assert.equal(item.ready(), 0); assert.equal(item.calls.open.length, 0);
  item.lifetime.dispose();
});

test('host currency lookup that disposes and returns true cannot authorize factory work', async () => {
  const item = fixture(); let creates = 0, renders = 0;
  await item.mount(item.request(() => {
    creates++; return { render() { renders++; }, dispose() {} };
  }));
  item.host.isCurrent = () => { item.lifetime.dispose(); return true; };
  await item.callback();
  assert.equal(creates, 0); assert.equal(renders, 0); assert.equal(item.calls.open.length, 0);
  assert.equal(item.ready(), 0);
});

test('late asynchronous factory cleanup does not restore an actually lost context', async () => {
  const item = fixture(), pending = deferred(); let lost = false, disposals = 0;
  item.gl.isContextLost = () => lost;
  await item.mount(item.request(() => pending.promise));
  await item.callback();
  const guards = item.calls.guards;
  lost = true;
  pending.resolve({ render() {}, dispose() { disposals++; } }); await flush();
  assert.equal(disposals, 1); assert.equal(item.calls.guards, guards);
  item.lifetime.dispose();
});

test('stable opaque public handles authorize owned callbacks and removal across fresh epochs', async () => {
  const item = fixture(), handles = []; let owned, creates = 0, disposals = 0;
  item.map.addLayer = layer => {
    owned = layer; const handle = Object.freeze({ id: layer.id }); handles.push(handle);
    item.layers.set(layer.id, handle); item.calls.add.push({ layer }); layer.onAdd(item.map, item.gl);
  };
  item.map.removeLayer = id => {
    item.calls.remove.push(id); item.layers.delete(id); owned.onRemove(item.map, item.gl);
  };
  await item.mount(item.request(() => { creates++; return { render() {}, dispose() { disposals++; } }; }));
  await item.callback('render', owned);
  assert.equal(creates, 1); assert.equal(item.ready(), 1);
  item.lifetime.invalidate('style'); await item.lifetime.retry(); await item.callback('render', owned);
  assert.equal(handles.length, 2); assert.notEqual(handles[0], handles[1]); assert.equal(creates, 2);
  assert.equal(item.calls.remove.length, 1); assert.equal(disposals, 1);
  const foreign = { id: 'scene' }; item.layers.set('scene', foreign); item.lifetime.dispose();
  assert.equal(item.layers.get('scene') === foreign, true);
  assert.equal(item.calls.remove.length, 1); assert.equal(disposals, 2);
});

test('missing or unstable public lookup during onAdd never grants ownership of a later handle', async () => {
  for (const unstable of [false, true]) {
    const item = fixture(); let owned, creates = 0, lookup = 0;
    const stable = { id: 'scene' };
    item.map.addLayer = layer => {
      owned = layer; item.calls.add.push({ layer });
      const original = item.map.getLayer;
      item.map.getLayer = () => unstable ? { id: `lookup-${lookup++}` } : undefined;
      layer.onAdd(item.map, item.gl);
      item.map.getLayer = original; item.layers.set(layer.id, stable);
    };
    await item.mount(item.request(() => { creates++; return { render() {}, dispose() {} }; }));
    await item.callback('render', owned);
    assert.equal(creates, 0); assert.equal(item.ready(), 0);
    assert.equal(item.events.filter(event => event.error === 'engine').length, 1);
    item.lifetime.dispose();
    assert.equal(item.calls.remove.length, 0); assert.equal(item.layers.get('scene') === stable, true);
  }
});
