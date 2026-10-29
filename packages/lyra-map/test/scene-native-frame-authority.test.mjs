import assert from 'node:assert/strict';
import test from 'node:test';
import {
  abortNativeFrame,
  assertNativeFrameCompletedAuthority,
  assertNativeFrameRenderAuthority,
  beginNativeFrame,
  captureNativeFrameAuthority,
  enterNativeCustomRender,
  hasNativeFrameDemand,
  leaveNativeCustomRender,
  loseNativeFrameContext,
  readNativeFrameAuthority,
  registerNativeFrameDemand,
  sealNativeFrame
} from '../src/scene/native-frame-authority.mjs';

const unavailable = { name: 'TypeError', message: 'Native frame authority unavailable.' };

function frameFacts() {
  return { styleGeneration: 1, orderedLayers: [
    { id: 'background', type: 'background' },
    { id: 'buildings', type: 'fill-extrusion' },
    { id: 'scene', type: 'custom' }
  ], terrainEnabled: false, projection: 'mercator', projectionTransition: 0, debug: false, tailDraws: false };
}

function identities(changes = {}) {
  return { gl: {}, frameContext: {}, implementation: {},
    originalRender() { assert.fail('authority bookkeeping must not invoke the original renderer'); },
    originalArgs: {}, ...changes };
}

function begin(item, facts = frameFacts()) {
  item.releaseDemand = registerNativeFrameDemand(item.gl, item.implementation, item.originalRender);
  assert.equal(typeof item.releaseDemand, 'function');
  return beginNativeFrame(item.gl, item.frameContext, facts);
}

function enter(item, frame, facts = { pass: 'translucent', currentLayer: 2 }) {
  return enterNativeCustomRender(frame, item.implementation, item.originalRender, item.originalArgs, facts);
}

function capture(item) {
  return captureNativeFrameAuthority(item.gl, item.implementation, item.originalRender, item.originalArgs);
}

function opaque(value) {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(Reflect.ownKeys(value), []);
  return value;
}

function deeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) deeplyFrozen(child);
}

function admitted(item) {
  const result = capture(item);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Reflect.ownKeys(result).sort(), ['authority', 'facts', 'status']);
  assert.equal(result.status, 'admitted');
  opaque(result.authority);
  deeplyFrozen(result.facts);
  return result;
}

function noCapture(item) {
  const result = capture(item);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Reflect.ownKeys(result), ['status']);
  assert.ok(['unqualified', 'refused'].includes(result.status));
}

function renderCurrent(authority, item) {
  const result = assertNativeFrameRenderAuthority(authority, item.gl, item.implementation, item.originalRender, item.originalArgs);
  deeplyFrozen(readNativeFrameAuthority(authority, item.gl, 'render'));
  return result;
}

function completedCurrent(authority, item) {
  const result = assertNativeFrameCompletedAuthority(authority, item.gl, item.implementation, item.originalRender, item.originalArgs);
  deeplyFrozen(readNativeFrameAuthority(authority, item.gl, 'completed'));
  return result;
}

function identitiesRefused(authority, item) {
  assert.throws(() => renderCurrent(authority, item), unavailable);
  assert.throws(() => completedCurrent(authority, item), unavailable);
}

function refused(authority, item) {
  identitiesRefused(authority, item);
  assert.throws(() => readNativeFrameAuthority(authority, item.gl, 'render'), unavailable);
  assert.throws(() => readNativeFrameAuthority(authority, item.gl, 'completed'), unavailable);
}

test('exact original native frame and render scope capture detached immutable phase facts without calling native identities', () => {
  let reads = 0, calls = 0, factReads = 0;
  const rejectRead = { get() { reads++; throw new Error('native identity properties must not be read'); } };
  const item = identities({ gl: new Proxy({}, rejectRead), frameContext: new Proxy({}, rejectRead),
    implementation: new Proxy({}, rejectRead), originalArgs: new Proxy({}, rejectRead),
    originalRender: new Proxy(() => { calls++; }, rejectRead) });
  const rejectFacts = () => { factReads++; throw new Error('dormant frame facts must not be inspected'); };
  const inactiveFacts = new Proxy({}, { get: rejectFacts, ownKeys: rejectFacts, getOwnPropertyDescriptor: rejectFacts });
  assert.equal(hasNativeFrameDemand(item.gl), false);
  assert.equal(beginNativeFrame(item.gl, item.frameContext, inactiveFacts), undefined);
  assert.equal(enterNativeCustomRender(undefined, item.implementation, item.originalRender, item.originalArgs, inactiveFacts), undefined);
  assert.equal(leaveNativeCustomRender(undefined, true), undefined);
  assert.equal(sealNativeFrame(undefined), undefined);
  assert.equal(abortNativeFrame(undefined), undefined);
  assert.deepEqual(capture(item), { status: 'unqualified' });
  assert.equal(factReads, 0); assert.equal(reads, 0); assert.equal(calls, 0);
  const facts = frameFacts(), expected = structuredClone(facts);
  const frame = opaque(begin(item, facts));
  assert.equal(hasNativeFrameDemand(item.gl), true);
  for (const unregistered of [identities({ ...item, implementation: new Proxy({}, rejectRead) }),
    identities({ ...item, originalRender: new Proxy(() => { calls++; }, rejectRead) })]) {
    assert.equal(enterNativeCustomRender(frame, unregistered.implementation, unregistered.originalRender,
      unregistered.originalArgs, inactiveFacts), undefined);
    noCapture(unregistered);
  }
  assert.equal(factReads, 0); assert.equal(reads, 0); assert.equal(calls, 0);
  facts.styleGeneration = 9; facts.orderedLayers[1].type = 'custom'; facts.orderedLayers.push({ id: 'later', type: 'custom' });
  const phase = { pass: 'translucent', currentLayer: 2 }, scope = opaque(enter(item, frame, phase));
  phase.pass = 'offscreen'; phase.currentLayer = 0;
  const result = admitted(item);
  assert.deepEqual(result.facts, { frame: expected, phase: { pass: 'translucent', currentLayer: 2 } });
  assert.notEqual(result.facts.frame, facts); assert.notEqual(result.facts.phase, phase);
  assert.notEqual(result.facts.frame.orderedLayers, facts.orderedLayers);
  assert.notEqual(result.facts.frame.orderedLayers[0], facts.orderedLayers[0]);
  assert.throws(() => { result.facts.frame.orderedLayers[0].type = 'custom'; }, TypeError);
  assert.throws(() => { result.facts.phase.currentLayer = 0; }, TypeError);
  assert.equal(admitted(item).authority, result.authority);
  assert.equal(renderCurrent(result.authority, item), undefined);
  assert.deepEqual(readNativeFrameAuthority(result.authority, item.gl, 'render'), result.facts);
  assert.throws(() => readNativeFrameAuthority(result.authority, item.gl, 'completed'), unavailable);
  for (const stage of [undefined, 'unknown', 'prerender']) {
    assert.throws(() => readNativeFrameAuthority(result.authority, item.gl, stage), unavailable);
  }
  assert.throws(() => completedCurrent(result.authority, item), unavailable);
  leaveNativeCustomRender(scope, true);
  assert.equal(sealNativeFrame(frame), true);
  assert.equal(completedCurrent(result.authority, item), undefined);
  assert.deepEqual(readNativeFrameAuthority(result.authority, item.gl, 'completed'), result.facts);
  assert.throws(() => readNativeFrameAuthority(result.authority, item.gl, 'render'), unavailable);
  assert.equal(reads, 0); assert.equal(calls, 0);
  abortNativeFrame(frame);
  item.releaseDemand(); item.releaseDemand();
  assert.equal(hasNativeFrameDemand(item.gl), false);
});

test('wrong GL and native frame identities cannot enter, capture or assert an original frame authority', () => {
  const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
  const other = identities({ implementation: item.implementation, originalRender: item.originalRender, originalArgs: item.originalArgs });
  noCapture(other); refused(result.authority, other);
  for (const wrongFrame of [{}, item.frameContext, { ...frame }, Object.create(frame)]) {
    assert.throws(() => enter(item, wrongFrame), unavailable);
    assert.equal(sealNativeFrame(wrongFrame), false);
  }
  assert.equal(renderCurrent(result.authority, item), undefined);
  leaveNativeCustomRender(scope, true); assert.equal(sealNativeFrame(frame), true);
  assert.equal(completedCurrent(result.authority, item), undefined);
  refused(result.authority, other);
  abortNativeFrame(frame);
});

test('original implementation, render function and render-input object are exact identities at capture and assertion', () => {
  const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
  const wrong = [identities({ ...item, implementation: {} }), identities({ ...item, originalRender() {} }),
    identities({ ...item, originalArgs: { ...item.originalArgs } })];
  for (const mismatch of wrong) { noCapture(mismatch); identitiesRefused(result.authority, mismatch); }
  assert.equal(admitted(item).authority, result.authority);
  leaveNativeCustomRender(scope, true); assert.equal(sealNativeFrame(frame), true);
  for (const mismatch of wrong) identitiesRefused(result.authority, mismatch);
  assert.equal(completedCurrent(result.authority, item), undefined);
  abortNativeFrame(frame);
});

test('lookalike, copied and inherited receipts never gain render or completed authority', () => {
  const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
  const fakes = [undefined, null, false, 1, 'authority', {}, Object.freeze({}), { ...result.authority },
    Object.create(result.authority), result, { ...result }, { gl: item.gl, frame, active: true }];
  for (const fake of fakes) refused(fake, item);
  assert.throws(() => { result.authority = {}; }, TypeError);
  assert.throws(() => { result.authority.active = true; }, TypeError);
  assert.throws(() => Object.setPrototypeOf(result.authority, { gl: item.gl }), TypeError);
  leaveNativeCustomRender(scope, true); assert.equal(sealNativeFrame(frame), true);
  for (const fake of fakes) refused(fake, item);
  assert.equal(completedCurrent(result.authority, item), undefined);
  abortNativeFrame(frame);
});

test('offscreen and unknown pass provenance never admits a render observation', () => {
  for (const pass of ['offscreen', 'opaque', 'unknown']) {
    const item = identities(), frame = begin(item), scope = enter(item, frame, { pass, currentLayer: 2 });
    const result = capture(item);
    assert.deepEqual(result, { status: 'refused' }); assert.equal(Object.isFrozen(result), true);
    leaveNativeCustomRender(scope, true);
    sealNativeFrame(frame);
    noCapture(item);
    abortNativeFrame(frame);
  }
});

test('only normal original callback return followed by native normal end seals an authority once', () => {
  const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
  assert.equal(sealNativeFrame(frame), false, 'normal end cannot seal an open original callback');
  assert.equal(renderCurrent(result.authority, item), undefined);
  assert.throws(() => completedCurrent(result.authority, item), unavailable);
  assert.equal(leaveNativeCustomRender(scope, true), undefined);
  noCapture(item);
  refused(result.authority, item);
  assert.equal(sealNativeFrame(frame), true);
  assert.throws(() => renderCurrent(result.authority, item), unavailable);
  assert.equal(completedCurrent(result.authority, item), undefined);
  assert.equal(sealNativeFrame(frame), false, 'normal end mints at most one seal');
  assert.equal(completedCurrent(result.authority, item), undefined);
  assert.throws(() => enter(item, frame), unavailable, 'a sealed frame cannot replay its original scope');
  abortNativeFrame(frame);
});

test('failed original callback return aborts the frame and cannot be repaired by later normal return or seal', () => {
  const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
  leaveNativeCustomRender(scope, false);
  noCapture(item); refused(result.authority, item);
  assert.equal(sealNativeFrame(frame), false);
  leaveNativeCustomRender(scope, true);
  assert.equal(sealNativeFrame(frame), false);
  refused(result.authority, item);
  abortNativeFrame(frame);
});

test('native tail or reset failure aborts an otherwise normally returned original render', () => {
  for (const stage of ['tail', 'reset']) {
    const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
    leaveNativeCustomRender(scope, true);
    assert.throws(() => completedCurrent(result.authority, item), unavailable, stage);
    abortNativeFrame(frame);
    assert.equal(sealNativeFrame(frame), false, stage);
    noCapture(item); refused(result.authority, item);
    abortNativeFrame(frame);
  }
});

test('forged and duplicate public render notifications cannot seal a pending native frame', () => {
  const item = identities(), frame = begin(item), scope = enter(item, frame), result = admitted(item);
  leaveNativeCustomRender(scope, true);
  const notification = { type: 'render', target: item.implementation, gl: item.gl,
    frameContext: item.frameContext, render: item.originalRender, args: item.originalArgs };
  for (const event of [notification, notification, { ...notification }, { ...frame }, { ...result }]) {
    assert.equal(sealNativeFrame(event), false);
    assert.throws(() => completedCurrent(result.authority, item), unavailable);
  }
  assert.equal(sealNativeFrame(frame), true);
  assert.equal(completedCurrent(result.authority, item), undefined);
  assert.equal(sealNativeFrame(notification), false);
  assert.equal(sealNativeFrame(frame), false);
  assert.equal(completedCurrent(result.authority, item), undefined);
  abortNativeFrame(frame);
});

test('same-context nested native paint revokes both frames until the entire paint stack unwinds', () => {
  for (const sameFrameContext of [false, true]) {
    const outer = identities(), outerFrame = begin(outer), outerScope = enter(outer, outerFrame);
    const outerAuthority = admitted(outer).authority;
    const inner = identities({ gl: outer.gl, frameContext: sameFrameContext ? outer.frameContext : {} });
    const innerFrame = begin(inner), innerScope = enter(inner, innerFrame);
    noCapture(inner); noCapture(outer); refused(outerAuthority, outer);
    leaveNativeCustomRender(innerScope, true);
    assert.equal(sealNativeFrame(innerFrame), false, 'nested completion cannot precede resumed outer painting');
    noCapture(inner); refused(outerAuthority, outer);
    abortNativeFrame(innerFrame);
    noCapture(outer); refused(outerAuthority, outer);
    leaveNativeCustomRender(outerScope, true);
    assert.equal(sealNativeFrame(outerFrame), false);
    abortNativeFrame(outerFrame);
    const fresh = identities({ gl: outer.gl }), freshFrame = begin(fresh), freshScope = enter(fresh, freshFrame);
    const freshAuthority = admitted(fresh).authority;
    abortNativeFrame(innerFrame); abortNativeFrame(outerFrame);
    leaveNativeCustomRender(freshScope, true); assert.equal(sealNativeFrame(freshFrame), true);
    assert.equal(completedCurrent(freshAuthority, fresh), undefined);
    refused(outerAuthority, outer);
    abortNativeFrame(freshFrame);
  }
  for (const registered of [false, true]) {
    const outer = identities(), frame = begin(outer), scope = enter(outer, frame), authority = admitted(outer).authority;
    const inner = identities({ gl: outer.gl });
    if (registered) inner.releaseDemand = registerNativeFrameDemand(inner.gl, inner.implementation, inner.originalRender);
    let nestedScope;
    try { nestedScope = enter(inner, frame); }
    catch (error) {
      assert.equal(error.name, unavailable.name); assert.equal(error.message, unavailable.message);
    }
    noCapture(inner); noCapture(outer); refused(authority, outer);
    leaveNativeCustomRender(nestedScope, true); leaveNativeCustomRender(scope, true);
    assert.equal(sealNativeFrame(frame), false, 'even an unregistered nested native callback revokes the outer paint');
    abortNativeFrame(frame);
    inner.releaseDemand?.(); outer.releaseDemand();
    const fresh = identities({ gl: outer.gl }), freshFrame = begin(fresh), freshScope = enter(fresh, freshFrame);
    const freshAuthority = admitted(fresh).authority;
    leaveNativeCustomRender(freshScope, true); assert.equal(sealNativeFrame(freshFrame), true);
    assert.equal(completedCurrent(freshAuthority, fresh), undefined);
    abortNativeFrame(freshFrame); fresh.releaseDemand();
  }
});

test('the next native begin invalidates an earlier completion before any new work despite equal view facts', () => {
  const item = identities(), facts = frameFacts(), frame = begin(item, facts), scope = enter(item, frame);
  const previous = admitted(item).authority;
  leaveNativeCustomRender(scope, true); assert.equal(sealNativeFrame(frame), true);
  assert.equal(completedCurrent(previous, item), undefined);
  const next = identities({ ...item, frameContext: {} }), nextFrame = begin(next, structuredClone(facts));
  refused(previous, item);
  assert.equal(sealNativeFrame(frame), false);
  const nextScope = enter(next, nextFrame), current = admitted(next).authority;
  assert.notEqual(current, previous);
  abortNativeFrame(frame);
  assert.equal(renderCurrent(current, next), undefined);
  leaveNativeCustomRender(nextScope, true); assert.equal(sealNativeFrame(nextFrame), true);
  assert.equal(completedCurrent(current, next), undefined);
  refused(previous, item);
  abortNativeFrame(nextFrame);
});

test('independent contexts, authoritative loss and late old-frame closure preserve exact generation isolation', () => {
  const first = identities(), second = identities({ implementation: first.implementation,
    originalRender: first.originalRender, originalArgs: first.originalArgs });
  const firstFrame = begin(first), firstScope = enter(first, firstFrame), firstAuthority = admitted(first).authority;
  const secondFrame = begin(second), secondScope = enter(second, secondFrame), secondAuthority = admitted(second).authority;
  assert.equal(renderCurrent(firstAuthority, first), undefined);
  assert.equal(renderCurrent(secondAuthority, second), undefined);
  refused(firstAuthority, second); refused(secondAuthority, first);
  loseNativeFrameContext(first.gl);
  refused(firstAuthority, first); noCapture(first);
  assert.equal(renderCurrent(secondAuthority, second), undefined);
  const restored = identities({ ...first, frameContext: {} }), restoredFrame = begin(restored), restoredScope = enter(restored, restoredFrame);
  const restoredAuthority = admitted(restored).authority;
  first.releaseDemand(); first.releaseDemand();
  assert.equal(hasNativeFrameDemand(first.gl), true, 'the restored owner retains its exact demand registration');
  leaveNativeCustomRender(firstScope, true); abortNativeFrame(firstFrame);
  assert.equal(sealNativeFrame(firstFrame), false);
  assert.equal(renderCurrent(restoredAuthority, restored), undefined);
  assert.equal(renderCurrent(secondAuthority, second), undefined);
  leaveNativeCustomRender(restoredScope, true); assert.equal(sealNativeFrame(restoredFrame), true);
  leaveNativeCustomRender(secondScope, true); assert.equal(sealNativeFrame(secondFrame), true);
  assert.equal(completedCurrent(restoredAuthority, restored), undefined);
  assert.equal(completedCurrent(secondAuthority, second), undefined);
  loseNativeFrameContext(first.gl);
  refused(firstAuthority, first); refused(restoredAuthority, restored);
  assert.equal(completedCurrent(secondAuthority, second), undefined);
  restored.releaseDemand();
  assert.equal(hasNativeFrameDemand(first.gl), false);
  const replacement = identities({ ...first, frameContext: {} }), replacementFrame = begin(replacement);
  const replacementScope = enter(replacement, replacementFrame), replacementAuthority = admitted(replacement).authority;
  first.releaseDemand(); restored.releaseDemand();
  assert.equal(hasNativeFrameDemand(first.gl), true, 'stale release cannot remove a replacement registration');
  assert.equal(renderCurrent(replacementAuthority, replacement), undefined);
  leaveNativeCustomRender(replacementScope, true); assert.equal(sealNativeFrame(replacementFrame), true);
  assert.equal(completedCurrent(replacementAuthority, replacement), undefined);
  replacement.releaseDemand(); replacement.releaseDemand();
  assert.equal(hasNativeFrameDemand(first.gl), false);
  refused(replacementAuthority, replacement);
  assert.deepEqual(capture(replacement), { status: 'unqualified' });
  assert.equal(completedCurrent(secondAuthority, second), undefined);
  second.releaseDemand();
  assert.equal(hasNativeFrameDemand(second.gl), false); refused(secondAuthority, second);
  abortNativeFrame(replacementFrame);
  abortNativeFrame(firstFrame); abortNativeFrame(restoredFrame); abortNativeFrame(secondFrame);
});
