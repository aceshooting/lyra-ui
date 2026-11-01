import assert from 'node:assert/strict';
import test from 'node:test';
import { planSceneAllocations } from '../src/scene/resource-ledger.mjs';
import { createTerrainNativeBatch } from '../src/scene/terrain-native.mjs';

function setup(options = {}) {
  const calls = [], deleted = new Set(), reservations = [], completions = []; let guarded = false, current = true, lost = false, signaled = false, elapsed = 0, sequence = 0;
  const nativeFramebuffer = { native: 'height' }, attachments = new Map();
  let drawFramebuffer = null, readFramebuffer = null, scratch;
  const constants = ['DRAW_FRAMEBUFFER','DRAW_FRAMEBUFFER_BINDING','FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE','FRAMEBUFFER_ATTACHMENT_OBJECT_NAME','TEXTURE','NONE','TEXTURE_2D','RGBA32F','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','NEAREST','READ_FRAMEBUFFER','FRAMEBUFFER','COLOR_ATTACHMENT0','FRAMEBUFFER_COMPLETE','PIXEL_PACK_BUFFER','STREAM_READ','PACK_ROW_LENGTH','PACK_SKIP_PIXELS','PACK_SKIP_ROWS','PACK_ALIGNMENT','RGBA','FLOAT','SYNC_GPU_COMMANDS_COMPLETE','TIMEOUT_EXPIRED','WAIT_FAILED','ALREADY_SIGNALED','CONDITION_SATISFIED','NO_ERROR','TEXTURE0'];
  const gl = Object.fromEntries(constants.map((name, i) => [name, i + 1]));
  const check = name => { calls.push(name); assert.equal(lost, false, `${name} cannot access lost GL`); assert.equal(guarded, true, `${name} needs state guard`); };
  const resource = kind => { check(`create${kind}`); assert.ok(reservations.some(value => !value.released), 'reserve before GL allocation'); return { kind, id: ++sequence }; };
  for (const kind of ['Texture','Framebuffer','Buffer']) {
    gl[`create${kind}`] = () => resource(kind);
    gl[`delete${kind}`] = value => { if (!value) return; check(`delete${kind}`); options.onDelete?.(kind, value); assert.ok(!deleted.has(value), 'delete exactly once'); deleted.add(value);
      if (kind === 'Framebuffer') attachments.delete(value);
      if (kind === 'Texture') for (const framebuffer of [drawFramebuffer, readFramebuffer]) {
        if (attachments.get(framebuffer) === value) attachments.delete(framebuffer);
      }
    };
  }
  for (const name of ['bindTexture','texStorage2D','texParameteri','readBuffer','bindBuffer','bufferData','pixelStorei','copyTexSubImage2D','readPixels','flush','activeTexture']) gl[name] = () => check(name);
  gl.bindFramebuffer = (target, framebuffer) => {
    check('bindFramebuffer');
    if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) drawFramebuffer = framebuffer;
    if (target === gl.FRAMEBUFFER || target === gl.READ_FRAMEBUFFER) readFramebuffer = framebuffer;
  };
  gl.framebufferTexture2D = (target, attachment, textureTarget, texture, level) => {
    check(texture === null ? 'detachTexture' : 'attachTexture');
    assert.equal(attachment, gl.COLOR_ATTACHMENT0); assert.equal(textureTarget, gl.TEXTURE_2D); assert.equal(level, 0);
    const framebuffer = target === gl.READ_FRAMEBUFFER ? readFramebuffer : drawFramebuffer;
    assert.ok(framebuffer);
    if (texture === null) options.onDetach?.(framebuffer);
    if (!options.ignoreDetach || texture !== null) attachments.set(framebuffer, texture);
  };
  gl.getParameter = name => {
    check('getParameter'); assert.equal(name, gl.DRAW_FRAMEBUFFER_BINDING);
    options.onQuery?.('binding'); return drawFramebuffer;
  };
  gl.getFramebufferAttachmentParameter = (target, attachment, name) => {
    check('getFramebufferAttachmentParameter'); assert.equal(target, gl.DRAW_FRAMEBUFFER); assert.equal(attachment, gl.COLOR_ATTACHMENT0);
    options.onQuery?.(name === gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE ? 'type' : 'name');
    const texture = attachments.get(drawFramebuffer) ?? null;
    if (name === gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE) return texture === null ? gl.NONE : gl.TEXTURE;
    assert.equal(name, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME); return texture;
  };
  gl.checkFramebufferStatus = () => { check('checkFramebufferStatus'); return gl.FRAMEBUFFER_COMPLETE; };
  gl.getExtension = () => { check('getExtension'); return {}; };
  gl.getError = () => { check('getError'); return options.onGetError?.() ?? gl.NO_ERROR; };
  gl.isContextLost = () => lost;
  gl.fenceSync = () => { check('fenceSync'); return { kind: 'Sync', id: ++sequence }; };
  gl.deleteSync = value => { if (!value) return; check('deleteSync'); options.onDelete?.('Sync', value); assert.ok(!deleted.has(value)); deleted.add(value); };
  gl.clientWaitSync = (_fence, flags, timeout) => { check('clientWaitSync'); assert.equal(flags, 0); assert.equal(timeout, 0); return signaled ? gl.CONDITION_SATISFIED : gl.TIMEOUT_EXPIRED; };
  gl.getBufferSubData = (_target, _offset, target) => { check('getBufferSubData'); assert.ok(signaled, 'read only after signaled fence'); for (let i = 0; i < target.length; i += 4) { target[i] = options.readHeight?.() ?? 0; target[i + 3] = 1; } options.onRead?.(); };
  const reserve = request => { const plan = planSceneAllocations(request, { bytes: Number.MAX_SAFE_INTEGER }); const record = { resources: request, bytes: plan.knownBytes, texturePixels: request.filter(value => value.kind === 'texture').reduce((sum, value) => sum + value.width * value.height * value.layers * value.faces, 0), released: false }; reservations.push(record); calls.push('reserve'); options.onReserve?.(); return { release() { assert.equal(record.released, false);
    assert.ok(lost || ![...attachments.values()].some(value => value?.kind === 'Texture'), 'known owned attachments retain their payload lease'); record.released = true; calls.push('release'); options.onRelease?.(); } }; };
  const withState = work => { assert.equal(guarded, false); assert.equal(lost, false); const savedDraw = drawFramebuffer, savedRead = readFramebuffer; guarded = true; calls.push('guard-enter'); try { options.onGuard?.(); return work(); } finally { calls.push(lost ? 'guard-lost' : 'guard-restore'); if (!lost) { drawFramebuffer = savedDraw; readFramebuffer = savedRead; } guarded = false; options.onAfterGuard?.(); } };
  const native = { renderTerrainHeightMap(value) { check('native-height'); assert.equal(value.width, 1); assert.equal(value.height, 1); assert.ok(value.bounds.every(Number.isFinite)); assert.ok(value.bounds[0] < value.bounds[2] && value.bounds[1] < value.bounds[3]); scratch = value.texture; gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, nativeFramebuffer);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scratch, 0);
    elapsed += options.drawMs ?? 0; options.onDraw?.(value);
    if (!lost) gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); } };
  const service = createTerrainNativeBatch({ gl, reserve, withState, isCurrent: () => options.onCurrent?.() ?? current, now: () => elapsed,
    requestRender() { calls.push('requestRender'); }, onComplete(token, value) { completions.push({ token, ...value }); options.onComplete?.(token, value); } });
  const batch = (count = 8) => ({ token: {}, span: .001, points: Array.from({ length: count }, (_, i) => [.49 + i * .001, .5]) });
  return { service, native, batch, calls, reservations, deleted, completions, gl, attachments, nativeFramebuffer,
    get scratch() { return scratch; }, moveDraw(value) { drawFramebuffer = value; },
    signal() { signaled = true; }, stale() { current = false; }, lose() { lost = true; calls.push('context-loss'); } };
}

test('requires explicit borrowed epoch services and never retains prerender native arguments', () => {
  for (const missing of ['gl','reserve','withState','isCurrent','requestRender','onComplete']) {
    const services = { gl: {}, reserve() {}, withState() {}, isCurrent() {}, requestRender() {}, onComplete() {} }; delete services[missing];
    assert.throws(() => createTerrainNativeBatch(services));
  }
  const f = setup(), batch = f.batch(); assert.equal(f.service.submit(batch), true); f.service.prerender(f.native);
  assert.equal(f.calls.filter(name => name === 'native-height').length, 8);
  f.native.renderTerrainHeightMap = () => { throw new Error('old arguments retained'); };
  f.signal(); f.service.prerender({}); assert.equal(f.completions.length, 1); f.service.dispose();
});

test('PBO readback is fenced, nonblocking, guarded and cannot be reused while pending', () => {
  const f = setup(), batch = f.batch(); f.service.submit(batch); f.service.prerender(f.native);
  assert.ok(f.calls.indexOf('readPixels') < f.calls.indexOf('fenceSync')); assert.ok(f.calls.indexOf('fenceSync') < f.calls.indexOf('flush'));
  const allocationCount = f.calls.filter(name => name.startsWith('create')).length;
  assert.equal(f.service.submit(f.batch()), false); f.service.prerender(f.native);
  assert.equal(f.calls.includes('getBufferSubData'), false); assert.equal(f.completions.length, 0);
  assert.equal(f.calls.filter(name => name.startsWith('create')).length, allocationCount);
  f.signal(); f.service.prerender(f.native); assert.equal(f.completions.length, 1); assert.equal(f.completions[0].token, batch.token);
  assert.ok(f.completions[0].rgba instanceof Float32Array); assert.equal(f.completions[0].count, 8);
  assert.ok(f.calls.indexOf('clientWaitSync') < f.calls.indexOf('getBufferSubData'));
  f.service.dispose(); f.service.dispose(); assert.ok(f.reservations.every(value => value.released));
  assert.equal(f.calls.filter(name => name === 'guard-enter').length, f.calls.filter(name => name === 'guard-restore').length);
});

test('draw cap is eight and soft four millisecond submission stop is checked between native calls', () => {
  const f = setup({ drawMs: 3 }), batch = f.batch(); f.service.submit(batch); f.service.prerender(f.native);
  assert.equal(f.calls.filter(name => name === 'native-height').length, 2);
  f.signal(); f.service.prerender(f.native); assert.equal(f.completions[0].count, 2); f.service.dispose();
  const slow = setup({ drawMs: 10 }); slow.service.submit(slow.batch()); slow.service.prerender(slow.native);
  assert.equal(slow.calls.filter(name => name === 'native-height').length, 1); slow.service.dispose();
});

test('stale epochs never publish or request more frames, and cleanup is exactly once', () => {
  const f = setup(); f.service.submit(f.batch()); f.service.prerender(f.native); f.stale();
  const boundary = f.calls.length; f.signal(); f.service.prerender(f.native);
  assert.equal(f.completions.length, 0); assert.equal(f.calls.slice(boundary).includes('requestRender'), false);
  f.service.dispose(); f.service.dispose(); assert.ok(f.reservations.every(value => value.released));
});

test('current epoch is rechecked after callback-capable native draw and readback boundaries', () => {
  let f; f = setup({ onDraw() { f.stale(); } }); f.service.submit(f.batch()); f.service.prerender(f.native);
  assert.equal(f.completions.length, 0); assert.equal(f.calls.filter(name => name === 'native-height').length, 1); f.service.dispose();
  let read; read = setup({ onRead() { read.stale(); } }); read.service.submit(read.batch()); read.service.prerender(read.native); read.signal(); read.service.prerender(read.native);
  assert.equal(read.completions.length, 0); read.service.dispose();
});

test('lost context retires resources and reservations without GL or state restoration access', () => {
  const f = setup(); f.service.submit(f.batch()); f.service.prerender(f.native); f.lose(); const boundary = f.calls.length;
  f.service.dispose({ contextLost: true }); f.service.dispose({ contextLost: true });
  assert.ok(f.calls.slice(boundary).every(name => name === 'release')); assert.equal(f.completions.length, 0); assert.ok(f.reservations.every(value => value.released));
});

test('cancellation retires its PBO before a subsequent batch can allocate or publish', () => {
  const f = setup(); const old = f.batch(); f.service.submit(old); f.service.prerender(f.native); f.service.cancel();
  assert.ok(f.calls.includes('deleteBuffer') && f.calls.includes('deleteSync'));
  const next = f.batch(); assert.equal(f.service.submit(next), true); f.service.prerender(f.native); f.signal(); f.service.prerender(f.native);
  assert.deepEqual(f.completions.map(value => value.token), [next.token]); f.service.dispose();
});

test('missing native capability reports unavailable without a fabricated zero result', () => {
  const f = setup(); f.service.submit(f.batch()); assert.deepEqual(f.service.prerender({}), { status: 'terrain-unavailable' });
  assert.equal(f.completions.length, 0); f.service.dispose();
});

test('primary selected wrap is preserved and invalid or collapsed footprints reject before native drawing', () => {
  const seen = [], f = setup({ onDraw(value) { seen.push(value.bounds); } });
  f.service.submit({ token: {}, span: .001, points: [[1.01, .5]] }); f.service.prerender(f.native);
  assert.ok(Math.abs((seen[0][0] + seen[0][2]) / 2 - 1.01) < 1e-12); f.service.dispose();
  for (const batch of [{ token: {}, span: 0, points: [[.5, .5]] }, { token: {}, span: Number.MIN_VALUE, points: [[.5, .5]] },
    { token: {}, span: .001, points: [[Infinity, .5]] }, { token: {}, span: .001, points: Array.from({ length: 9 }, () => [.5, .5]) }]) {
    const invalid = setup(); assert.throws(() => { invalid.service.submit(batch); invalid.service.prerender(invalid.native); });
    assert.equal(invalid.calls.includes('native-height'), false); invalid.service.dispose();
  }
});

test('allocation reserves all fixed payload before constructors and releases after native failure', () => {
  const f = setup({ onDraw() { throw new Error('native terrain failed'); } });
  f.service.submit(f.batch()); assert.throws(() => f.service.prerender(f.native)); f.service.dispose();
  assert.equal(f.reservations.reduce((sum, value) => sum + value.bytes, 0), 400);
  assert.equal(f.reservations.reduce((sum, value) => sum + (value.texturePixels ?? 0), 0), 9);
  assert.ok(f.calls.indexOf('reserve') < f.calls.indexOf('createTexture'));
  assert.ok(f.reservations.every(value => value.released));
  assert.equal(f.calls.filter(name => name === 'guard-enter').length, f.calls.filter(name => name === 'guard-restore').length);
});

test('reserve may synchronously dispose before returning its lease without leaking or constructing GL storage', () => {
  let f; f = setup({ onReserve() { f.service.dispose(); } });
  f.service.submit(f.batch());
  try { f.service.prerender(f.native); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(f.calls.some(name => name.startsWith('create')), false);
  assert.ok(f.reservations.length > 0 && f.reservations.every(value => value.released));
  const releases = f.calls.filter(name => name === 'release').length;
  f.service.dispose(); assert.equal(f.calls.filter(name => name === 'release').length, releases);
});

test('reserve may synchronously stale the epoch before returning without allocating or publishing', () => {
  let f; f = setup({ onReserve() { f.stale(); } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  assert.equal(f.calls.some(name => name.startsWith('create')), false); assert.equal(f.completions.length, 0);
  assert.ok(f.reservations.length > 0 && f.reservations.every(value => value.released)); f.service.dispose();
});

test('reservation reentry cannot install a nested batch or orphan either reservation', () => {
  let f, entered = false, nestedAccepted;
  f = setup({ onReserve() {
    if (entered) return; entered = true;
    f.service.cancel(); nestedAccepted = f.service.submit(f.batch()); f.service.prerender(f.native);
  } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  assert.equal(nestedAccepted, false); assert.equal(f.calls.includes('native-height'), false);
  f.service.dispose(); assert.ok(f.reservations.every(value => value.released));
});

test('native draw and readback callbacks cannot recursively enter the same operation', () => {
  let f, drawEntered = false;
  f = setup({ onDraw() { if (!drawEntered) { drawEntered = true; f.service.prerender(f.native); } } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  assert.equal(f.calls.filter(name => name === 'native-height').length, 8); f.service.dispose();
  let read, readEntered = false;
  read = setup({ onRead() { if (!readEntered) { readEntered = true; read.service.prerender(read.native); } } });
  read.service.submit(read.batch()); read.service.prerender(read.native); read.signal(); read.service.prerender(read.native);
  assert.equal(read.calls.filter(name => name === 'getBufferSubData').length, 1); assert.equal(read.completions.length, 1); read.service.dispose();
});

test('borrowed completion storage remains stable and unavailable for reuse until delivery returns', () => {
  let f, height = 7, delivered = false;
  f = setup({ readHeight: () => height, onComplete(_token, value) {
    if (delivered) return; delivered = true;
    const before = Array.from(value.rgba); height = 91;
    assert.equal(f.service.submit(f.batch()), false);
    f.service.prerender(f.native); f.signal(); f.service.prerender(f.native);
    assert.deepEqual(Array.from(value.rgba), before);
  } });
  f.service.submit(f.batch()); f.service.prerender(f.native); f.signal(); f.service.prerender(f.native);
  assert.equal(f.completions.length, 1); assert.equal(f.service.submit(f.batch()), true); f.service.dispose();
});

test('native batch admission does not execute points map or coordinate every overrides', () => {
  const f = setup(); let accesses = 0;
  const points = [[.5, .5]]; points.map = () => { accesses++; return Array.from({ length: 9 }, () => [.4, .4, .6, .6]); };
  try { f.service.submit({ token: {}, span: .001, points }); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(accesses, 0); f.service.dispose();
  const second = setup(), coordinate = [.5, .5]; coordinate.every = () => { accesses++; return true; };
  try { second.service.submit({ token: {}, span: .001, points: [coordinate] }); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(accesses, 0); second.service.dispose();
});

test('cleanup guard refusal preserves its reservation until a later permitted retirement', () => {
  let refuse = false;
  const f = setup({ onGuard() { if (refuse) throw new Error('guard unavailable'); } });
  f.service.submit(f.batch()); f.service.prerender(f.native); refuse = true;
  assert.throws(() => f.service.cancel()); assert.ok(f.reservations.some(value => !value.released));
  refuse = false; f.service.dispose(); assert.ok(f.reservations.every(value => value.released));
  assert.equal(f.deleted.size, 5);
});

test('one failed deletion does not skip other handles or release still-owned storage', () => {
  let failOnce = true;
  const f = setup({ onDelete(kind) { if (kind === 'Sync' && failOnce) { failOnce = false; throw new Error('delete unavailable'); } } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  try { f.service.cancel(); } catch (error) { assert.ok(error instanceof Error); }
  assert.ok(f.calls.includes('deleteBuffer') && f.calls.includes('deleteFramebuffer'));
  assert.equal(f.calls.filter(name => name === 'deleteTexture').length, 2);
  assert.ok(f.reservations.some(value => !value.released));
  f.service.dispose(); assert.ok(f.reservations.every(value => value.released)); assert.equal(f.deleted.size, 5);
});

test('actual loss inside draw or readback stops GL even before host generation changes', () => {
  let draw; draw = setup({ onDraw() { draw.lose(); } });
  draw.service.submit(draw.batch());
  assert.doesNotThrow(() => draw.service.prerender(draw.native));
  assert.equal(draw.completions.length, 0); assert.ok(draw.reservations.every(value => value.released));
  let read; read = setup({ onRead() { read.lose(); } });
  read.service.submit(read.batch()); read.service.prerender(read.native); read.signal();
  assert.doesNotThrow(() => read.service.prerender(read.native));
  assert.equal(read.completions.length, 0); assert.ok(read.reservations.every(value => value.released));
});

test('shared native error flags are not drained to infer terrain error provenance', () => {
  const f = setup({ onGetError: () => 0x0502 });
  f.service.submit(f.batch()); assert.doesNotThrow(() => f.service.prerender(f.native));
  assert.equal(f.calls.includes('getError'), false); f.service.dispose();
});

test('loss immediately after the state envelope suppresses frame requests and publication', () => {
  let f, loseAfterGuard = false;
  f = setup({ onAfterGuard() { if (loseAfterGuard) f.lose(); } });
  f.service.submit(f.batch()); loseAfterGuard = true;
  assert.doesNotThrow(() => f.service.prerender(f.native));
  assert.equal(f.calls.includes('requestRender'), false); assert.equal(f.completions.length, 0);
  assert.ok(f.reservations.every(value => value.released));
});

test('a current predicate disposing during final submission cannot install a retired batch', () => {
  let f, armed = false, calls = 0;
  f = setup({ onCurrent() { calls++; if (armed && calls === 2) f.service.dispose(); return true; } });
  armed = true;
  assert.equal(f.service.submit(f.batch()), false);
  assert.equal(f.calls.includes('native-height'), false); f.service.dispose();
});

test('a current predicate canceling during the native callback cannot allocate or draw', () => {
  let f, armed = false, canceled = false;
  f = setup({ onCurrent() { if (armed && !canceled) { canceled = true; f.service.cancel(); } return true; } });
  f.service.submit(f.batch()); armed = true;
  f.service.prerender(f.native);
  assert.equal(f.calls.some(name => name.startsWith('create')), false);
  assert.equal(f.calls.includes('native-height'), false); assert.equal(f.calls.includes('requestRender'), false); f.service.dispose();
});

test('a current predicate disposing after readback cannot publish a retired completion', () => {
  let f, arm = false, readComplete = false, retired = false;
  f = setup({ onRead() { readComplete = true; }, onAfterGuard() { if (readComplete) arm = true; }, onCurrent() {
    if (arm && readComplete && !retired) { retired = true; f.service.dispose(); }
    return true;
  } });
  f.service.submit(f.batch()); f.service.prerender(f.native); f.signal();
  f.service.prerender(f.native);
  assert.equal(f.completions.length, 0); assert.ok(f.reservations.every(value => value.released));
});

test('a lease release callback can dispose recursively without releasing terminal storage twice', () => {
  let f, reentered = false;
  f = setup({ onRelease() { if (!reentered) { reentered = true; f.service.dispose(); } } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  assert.doesNotThrow(() => f.service.cancel());
  assert.equal(f.calls.filter(name => name === 'release').length, 1);
  assert.ok(f.reservations.every(value => value.released)); f.service.dispose();
});

test('context-loss lease retirement detaches ownership before a recursive dispose callback', () => {
  let f, reentered = false;
  f = setup({ onRelease() { if (!reentered) { reentered = true; f.service.dispose({ contextLost: true }); } } });
  f.service.submit(f.batch()); f.service.prerender(f.native); f.lose();
  assert.doesNotThrow(() => f.service.dispose({ contextLost: true }));
  assert.equal(f.calls.filter(name => name === 'release').length, 1);
  assert.ok(f.reservations.every(value => value.released));
});

test('a predicate canceling after the envelope cannot schedule another native frame', () => {
  let f, armed = false, canceled = false;
  f = setup({ onAfterGuard() { armed = true; }, onCurrent() {
    if (armed && !canceled) { canceled = true; f.service.cancel(); }
    return true;
  } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  assert.equal(f.calls.includes('requestRender'), false); assert.equal(f.completions.length, 0); f.service.dispose();
});

test('lease retirement blocks submission and rendering throughout the cleanup phase', () => {
  let f, attempted = false, accepted;
  f = setup({ onRelease() {
    if (attempted) return; attempted = true;
    accepted = f.service.submit(f.batch()); f.service.prerender(f.native);
  } });
  f.service.submit(f.batch()); f.service.prerender(f.native);
  const allocations = f.reservations.length, draws = f.calls.filter(name => name === 'native-height').length;
  f.service.cancel();
  assert.equal(accepted, false); assert.equal(f.reservations.length, allocations);
  assert.equal(f.calls.filter(name => name === 'native-height').length, draws);
  f.service.dispose(); assert.ok(f.reservations.every(value => value.released));
});

test('submission admission callbacks cannot recursively submit or render an inner batch', () => {
  let f, attempted = false, accepted;
  f = setup({ onCurrent() {
    if (!attempted) { attempted = true; accepted = f.service.submit(f.batch()); f.service.prerender(f.native); }
    return true;
  } });
  assert.equal(f.service.submit(f.batch()), true);
  assert.equal(accepted, false); assert.equal(f.reservations.length, 0); assert.equal(f.calls.includes('native-height'), false);
  f.service.dispose();
});

test('live resources do not enter a redundant cleanup envelope whose exit can strand terminal ownership', () => {
  for (const lose of [false, true]) {
    let f, exits = 0, terminal = false;
    f = setup({ onAfterGuard() {
      exits++;
      if (exits === 2) { terminal = true; if (lose) f.lose(); f.service.dispose({ contextLost: lose }); }
    } });
    f.service.submit(f.batch());
    assert.doesNotThrow(() => f.service.prerender(f.native));
    // A draw envelope is necessary. A second cleanup envelope has no retired work to guard.
    assert.equal(exits, 1); assert.equal(terminal, false);
    f.service.dispose(); assert.ok(f.reservations.every(value => value.released));
  }
});

test('terminal disposal on the drawing envelope exit drains retirement before returning', () => {
  for (const lose of [false, true]) {
    let f, terminal = false;
    f = setup({ onAfterGuard() {
      if (!terminal) { terminal = true; if (lose) f.lose(); f.service.dispose({ contextLost: lose }); }
    } });
    f.service.submit(f.batch()); assert.doesNotThrow(() => f.service.prerender(f.native));
    assert.ok(f.reservations.every(value => value.released)); assert.equal(f.completions.length, 0);
    assert.equal(f.calls.includes('requestRender'), false);
  }
});

test('native attachment failure detaches only the exact owned scratch before state restoration and terminally retires', () => {
  const f = setup({ onDraw() { throw new Error('native draw failed after attachment'); } });
  f.service.submit(f.batch()); assert.throws(() => f.service.prerender(f.native), /Terrain batch unavailable/);
  const detach = f.calls.indexOf('detachTexture'), restore = f.calls.indexOf('guard-restore');
  assert.ok(detach >= 0 && detach < restore, 'owned attachment is removed inside the original live guard');
  assert.equal(f.attachments.get(f.nativeFramebuffer) ?? null, null);
  assert.equal(f.deleted.has(f.scratch), true); assert.equal(f.reservations[0].released, true);
  assert.equal(f.service.submit(f.batch()), false, 'failed native ownership epoch is terminal');
  f.service.cancel(); f.service.dispose();
  assert.equal(f.calls.filter(name => name === 'release').length, 1);
  assert.equal(f.calls.includes('getError'), false);
});

for (const fault of ['foreign', 'missing-binding', 'moved-binding', 'query-throw', 'detach-throw', 'detach-ignored', 'verification-throw']) {
  test(`native attachment ${fault} retains the compound reservation until actual context retirement`, () => {
    let f, queried = 0, detached = false;
    const foreign = { foreign: 'texture' }, moved = { foreign: 'framebuffer' };
    f = setup({
      ignoreDetach: fault === 'detach-ignored',
      onDraw() {
        if (fault === 'foreign') f.attachments.set(f.nativeFramebuffer, foreign);
        if (fault === 'missing-binding') f.moveDraw(null);
        throw new Error('native draw failed after attachment');
      },
      onQuery(kind) {
        if (fault === 'query-throw') throw new Error('attachment query failed');
        if (fault === 'moved-binding' && kind === 'binding' && ++queried === 2) f.moveDraw(moved);
        if (fault === 'verification-throw' && detached) throw new Error('attachment verification failed');
      },
      onDetach() { detached = true; if (fault === 'detach-throw') throw new Error('attachment detach failed'); }
    });
    f.service.submit(f.batch()); assert.throws(() => f.service.prerender(f.native), /Terrain batch unavailable/);
    assert.equal(f.reservations.length, 1); assert.equal(f.reservations[0].bytes, 400);
    assert.equal(f.reservations[0].released, false, 'all 400 bytes remain conservatively reserved');
    assert.equal(f.deleted.has(f.scratch), false, 'uncertain scratch ownership remains quarantined');
    if (fault === 'foreign') {
      assert.equal(f.attachments.get(f.nativeFramebuffer), foreign);
      assert.equal(f.calls.includes('detachTexture'), false, 'foreign attachment is not modified');
    }
    for (let index = 0; index < 3; index++) {
      f.service.cancel(); assert.equal(f.service.submit(f.batch()), false);
      f.service.prerender(f.native);
    }
    f.stale(); f.service.dispose();
    assert.equal(f.reservations.length, 1); assert.equal(f.reservations[0].released, false);
    assert.equal(f.completions.length, 0); assert.equal(f.calls.includes('getError'), false);
    f.lose(); const boundary = f.calls.length;
    f.service.dispose({ contextLost: true }); f.service.dispose({ contextLost: true });
    assert.deepEqual(f.calls.slice(boundary), ['release']);
    assert.equal(f.reservations[0].released, true);
  });
}

for (const phase of ['hook', 'binding', 'type', 'name', 'detach']) {
  test(`loss during attachment cleanup at ${phase} stops subsequent GL and releases by invalidation`, () => {
    let f;
    f = setup({
      onDraw() { if (phase === 'hook') f.lose(); throw new Error('native draw failure'); },
      onQuery(kind) { if (kind === phase) f.lose(); },
      onDetach() { if (phase === 'detach') f.lose(); }
    });
    f.service.submit(f.batch()); assert.throws(() => f.service.prerender(f.native), /Terrain batch unavailable/);
    assert.equal(f.reservations[0].released, true); assert.equal(f.completions.length, 0);
    const loss = f.calls.indexOf('context-loss');
    assert.ok(loss >= 0); assert.ok(f.calls.slice(loss + 1).every(name => name === 'guard-lost' || name === 'release'));
    assert.equal(f.deleted.has(f.scratch), false, 'context-invalidated scratch is not counted as deleted');
    const boundary = f.calls.length;
    f.service.dispose({ contextLost: true }); f.service.dispose({ contextLost: true });
    assert.equal(f.calls.length, boundary); assert.equal(f.calls.filter(name => name === 'release').length, 1);
  });
}

test('normal native detachment allows repeated batches on the same scratch without a quarantine record', () => {
  const f = setup(); let scratch;
  for (let index = 0; index < 2; index++) {
    assert.equal(f.service.submit(f.batch(1)), true); f.service.prerender(f.native);
    scratch ??= f.scratch; assert.equal(f.scratch, scratch);
    assert.equal(f.attachments.get(f.nativeFramebuffer) ?? null, null);
    f.signal(); f.service.prerender(f.native);
  }
  assert.equal(f.reservations.length, 1); assert.equal(f.completions.length, 2);
  f.service.dispose(); assert.equal(f.reservations[0].released, true);
});
