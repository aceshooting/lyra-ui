import assert from 'node:assert/strict';
import test from 'node:test';
import { nextPaintSerial } from '../src/scene/completion-data.mjs';
import { createSceneCompletionDiagnostics } from '../src/scene/completion.mjs';
import { completionOwnerFixture } from './fixtures/scene-completion-owner.mjs';
import { completionInput, member, token } from './fixtures/scene-completion-data.mjs';

function started(input) { const h = completionOwnerFixture({ input }); h.start(); return h; }
function watched(input) { const h = started(input); h.owner.port.watchTarget('anchor'); return h; }

test('completion subscribes before capture and allocates no demand without a live target watch', () => {
  const h = started();
  assert.deepEqual(h.calls.order.slice(0, 2), ['subscribe', 'capture']);
  assert.deepEqual(Object.keys(h.owner.port).sort(), ['current', 'projectTarget', 'requestFrame', 'subscribeCompletedFrames', 'watchTarget']);
  assert.equal(h.issue(), undefined); assert.equal(h.calls.claims.length, 0); assert.equal(h.calls.demand.includes(true), false);
  h.owner.port.watchTarget('absent'); assert.equal(h.calls.demand.includes(true), false); h.close();
});

test('watches coalesce exact IDs and absent demand survives until acceptance', () => {
  const h = started(); const first = h.owner.port.watchTarget('anchor'), second = h.owner.port.watchTarget('anchor');
  assert.equal(h.calls.demand.filter(Boolean).length, 1);
  first(); first(); assert.notEqual(h.calls.demand.at(-1), false);
  second(); second(); assert.equal(h.calls.demand.at(-1), false);
  const release = h.owner.port.watchTarget('later'); assert.equal(h.issue(), undefined);
  h.replace(completionInput({ members: [member('later')] })); const issue = h.issue(); assert.ok(issue);
  h.finish(issue); assert.equal(h.frames.length, 1); release(); h.close();
});

test('unique watch limits refuse before acquisition and safe count exhaustion never wraps', () => {
  const h = started(); const releases = Array.from({ length: 2000 }, (_, index) => h.owner.port.watchTarget(`target-${index}`));
  assert.throws(() => h.owner.port.watchTarget('overflow'), TypeError);
  const extra = h.owner.port.watchTarget('target-0'); extra();
  assert.equal(nextPaintSerial(Number.MAX_SAFE_INTEGER - 1), Number.MAX_SAFE_INTEGER);
  assert.equal(nextPaintSerial(Number.MAX_SAFE_INTEGER), undefined);
  releases.forEach(release => release()); assert.doesNotThrow(() => h.owner.port.watchTarget('replacement')); h.close();
});

test('marker installation does not satisfy exhaustive mixed accepted membership', () => {
  const h = watched(completionInput({ members: [member(), member('route', 'path'), member('arc', 'arc'), member('model', 'model')] }));
  const markerOnly = h.install(h.input.members.slice(0, 1));
  assert.equal(h.owner.issue(h.observation(markerOnly)), undefined);
  assert.equal(h.calls.claims.length, 0); assert.equal(h.frames.length, 0); h.close();
});

test('whole installation joins exact input row and target identities', () => {
  const h = watched(), previous = h.input, old = h.install();
  h.replace(completionInput({ acceptedSceneRevision: 2 }));
  assert.equal(h.owner.issue(h.observation(old)), undefined);
  const wrong = h.install([{ ...h.input.members[0], rowToken: previous.members[0].rowToken }]);
  assert.equal(h.owner.issue(h.observation(wrong)), undefined);
  const wrongTarget = h.install([{ ...h.input.members[0], target: { ...h.input.members[0].target, token: token() } }]);
  assert.equal(h.owner.issue(h.observation(wrongTarget)), undefined);
  const issue = h.issue(); assert.ok(issue); h.finish(issue);
  assert.equal(h.frames[0].stamp.installedSceneRevision, 2); h.close();
});

test('partial installs and replaced native ownership revoke identical numeric revisions', () => {
  const h = watched(); const frame = h.paint(), target = h.input.members[0].target.token;
  assert.equal(h.owner.port.current(frame, 'anchor', target), true);
  h.revoke(); assert.equal(h.owner.port.current(frame, 'anchor', target), false);
  const partial = h.install([]); assert.equal(h.owner.issue(h.observation(partial)), undefined);
  assert.equal(h.frames.length, 1); h.close();
});

test('whole installation cannot replace missing native phase or visibility scope', () => {
  for (const change of [{ phase: undefined }, { scope: undefined }]) {
    const h = watched(); assert.equal(h.issue(change), undefined);
    assert.equal(h.calls.claims.length, 0); assert.equal(h.frames.length, 0); h.close();
  }
  const input = completionInput(), replacement = completionInput(), reported = [];
  const diagnostics = createSceneCompletionDiagnostics((value, code) => reported.push({ value, code }));
  assert.ok(Object.isFrozen(diagnostics)); assert.deepEqual(Object.keys(diagnostics), ['unavailable']);
  diagnostics.unavailable(input, 1); diagnostics.unavailable(input, 1);
  assert.deepEqual(reported, [{ value: input, code: 'completion-unavailable' }]);
  diagnostics.unavailable(replacement, 1); diagnostics.unavailable(replacement, 2); diagnostics.unavailable(replacement, 2);
  assert.deepEqual(reported.map(value => value.value), [input, replacement, replacement]);
  assert.ok(reported.every(value => value.code === 'completion-unavailable'));
  const nestedReports = []; let nested;
  nested = createSceneCompletionDiagnostics(value => {
    nestedReports.push(value);
    if (value === input && nestedReports.length === 1) nested.unavailable(replacement, 2);
  });
  nested.unavailable(input, 1); nested.unavailable(replacement, 2);
  assert.deepEqual(nestedReports, [input, replacement]);
  const originalConsole = { error: console.error, warn: console.warn, log: console.log };
  let consoleCalls = 0, reentrantCalls = 0, reentrant;
  try {
    console.error = console.warn = console.log = () => { consoleCalls++; };
    reentrant = createSceneCompletionDiagnostics(value => {
      reentrantCalls++;
      if (reentrantCalls < 5) reentrant.unavailable(value, 1);
      throw new Error('diagnostic reporter unavailable');
    });
    assert.doesNotThrow(() => reentrant.unavailable(input, 1));
    assert.doesNotThrow(() => reentrant.unavailable(input, 1));
    assert.equal(reentrantCalls, 1); assert.equal(consoleCalls, 0);
  } finally { Object.assign(console, originalConsole); }
});

test('foreign context input and cloned observation authority cannot authorize an issue', () => {
  const h = watched(), record = h.install(), observation = h.observation(record);
  assert.equal(h.owner.issue({ ...observation }), undefined);
  h.revoke(); assert.equal(h.owner.issue(observation), undefined);
  const other = completionInput(); assert.equal(h.owner.issue(h.observation(h.install(), { input: other })), undefined);
  assert.equal(h.frames.length, 0); h.close();
  for (const attack of ['clone', 'foreign-issue', 'reentry']) {
    const candidate = watched(), issue = candidate.issue(); assert.ok(issue);
    const authentic = candidate.result(issue);
    const result = attack === 'clone' ? { ...authentic } : attack === 'foreign-issue' ? candidate.result(token()) : authentic;
    if (attack === 'reentry') candidate.hooks.result = () => { candidate.hooks.result = undefined; candidate.replace(completionInput()); };
    assert.equal(candidate.owner.complete(issue, result), false, attack);
    assert.equal(candidate.frames.length, 0, attack); candidate.close();
  }
});

test('serial claims recheck currency and refuse unsafe or nonincreasing values', () => {
  const h = watched(); h.hooks.claim = () => { h.replace(completionInput()); return 1; };
  assert.equal(h.issue(), undefined); assert.equal(h.frames.length, 0);
  for (const value of [undefined, 0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    h.hooks.claim = () => value; assert.equal(h.issue(), undefined);
  }
  h.hooks.claim = () => 2; const issue = h.issue(); assert.ok(issue); h.finish(issue);
  h.owner.invalidate('paint'); assert.equal(h.issue(), undefined);
  assert.equal(h.frames.length, 1); h.close();
});

test('out of order duplicate completions cannot replace a later issue serial', () => {
  const h = watched(), old = h.issue(), oldResult = h.result(old);
  h.owner.invalidate('paint'); const next = h.issue(); assert.ok(next); assert.equal(h.finish(next), true);
  assert.equal(h.owner.complete(old, oldResult), false); assert.equal(h.finish(next), false);
  assert.equal(h.frames.length, 1); assert.equal(h.frames[0].stamp.paintFrameSerial, 2); h.close();
});

test('equal numeric publication replacement invalidates before notification delivery', () => {
  const h = watched(), frame = h.paint(), target = h.input.members[0].target.token;
  const before = h.input; h.replace({ ...before, publicationToken: token() }, false);
  assert.equal(h.owner.port.current(frame, 'anchor', target), false);
  assert.equal(h.owner.port.projectTarget(frame, 'anchor'), undefined); h.notify(); h.close();
});

test('same turn pending then resolved invalidates old completion without lifetime revocation', () => {
  const h = watched(), frame = h.paint(), target = h.input.members[0].target.token;
  h.replace(completionInput({ phase: 'pending' }));
  assert.equal(h.owner.port.current(frame, 'anchor', target), false); assert.equal(h.issue(), undefined);
  assert.equal(h.services.isCurrent(), true);
  h.replace(completionInput()); assert.ok(h.paint()); assert.equal(h.frames.length, 2); h.close();
});

test('every bound content view allocation style and context invalidation revokes the receipt', () => {
  for (const reason of ['placement', 'paint', 'occluder', 'source', 'view', 'allocation', 'style', 'context']) {
    const h = watched(), frame = h.paint(); h.owner.invalidate(reason);
    assert.equal(h.owner.port.current(frame, 'anchor', h.input.members[0].target.token), false, reason);
    assert.equal(h.owner.port.projectTarget(frame, 'anchor'), undefined, reason); h.close();
  }
});

test('read only completion neither wakes native paint nor increments input revisions', () => {
  const h = watched(), input = h.input, issue = h.issue(), requests = h.calls.requests;
  h.finish(issue); assert.equal(h.calls.requests, requests); assert.equal(h.input, input);
  const frame = h.frames[0]; assert.equal(h.owner.port.current(frame, 'anchor', input.members[0].target.token), true);
  h.revoke(); assert.equal(h.owner.port.current(frame, 'anchor', input.members[0].target.token), false);
  assert.equal(h.input, input); h.close();
});

test('copied frames and target tokens cannot acquire private receipt currentness', () => {
  const h = watched(), frame = h.paint(), target = h.input.members[0].target.token;
  assert.equal(h.owner.port.current({ ...frame }, 'anchor', target), false);
  assert.equal(h.owner.port.current(frame, 'anchor', token()), false);
  assert.equal(h.owner.port.projectTarget({ ...frame }, 'anchor'), undefined);
  h.owner.invalidate('view'); assert.equal(h.owner.port.projectTarget(frame, 'anchor'), undefined); h.close();
});

test('callback and reflection reentry fences stale notification and retires acquired work', () => {
  const h = watched(); let delivered = 0;
  h.owner.port.subscribeCompletedFrames(() => h.replace(completionInput()));
  h.owner.port.subscribeCompletedFrames(() => { delivered++; });
  const issue = h.issue(); h.finish(issue); assert.equal(delivered, 0);
  const original = h.input; let reflections = 0;
  const proxy = new Proxy(original, { ownKeys(target) { reflections++; h.replace(completionInput(), false); return Reflect.ownKeys(target); } });
  h.hooks.capture = () => { h.hooks.capture = undefined; h.replaceRaw(proxy); };
  h.owner.reconcile(); assert.ok(reflections > 0); assert.equal(h.owner.port.current(h.frames[0], 'anchor', original.members[0].target.token), false);
  h.hooks.current = () => { h.hooks.current = undefined; h.close(); };
  h.owner.port.requestFrame(); assert.equal(h.subscriptions, 0); assert.ok(h.calls.retired.includes(issue));
});

test('one inflight issue retains native capacity until retirement and latest input wins', () => {
  const h = watched(), first = h.issue(); assert.ok(first); assert.equal(h.issue(), undefined);
  h.replace(completionInput({ acceptedSceneRevision: 2 })); h.replace(completionInput({ acceptedSceneRevision: 3 }));
  assert.ok(h.calls.retired.includes(first));
  h.hooks.observation = () => h.revoke(); assert.equal(h.issue(), undefined);
  h.hooks.observation = undefined; const latest = h.issue(); assert.ok(latest); h.finish(latest);
  assert.equal(h.frames.at(-1).stamp.acceptedSceneRevision, 3); h.close();
});

test('bounded target batches never merge observations from distinct native issues', () => {
  const h = watched(completionInput({ members: [member(), member('second')] })); h.owner.port.watchTarget('second');
  const record = h.install(), all = h.observation(record);
  const first = h.owner.issue(h.observation(record, { targets: all.targets.slice(0, 1) })); assert.ok(first);
  h.finish(first, { targets: [{ id: 'anchor', anchor: true, object: true }] });
  assert.equal(h.owner.port.projectTarget(h.frames[0], 'second')?.visible ?? false, false);
  h.owner.invalidate('paint'); const next = h.owner.issue(h.observation(h.install(), { targets: all.targets.slice(1) })); assert.ok(next);
  h.finish(next, { targets: [{ id: 'second', anchor: true, object: true }] });
  assert.equal(h.owner.port.projectTarget(h.frames.at(-1), 'anchor')?.visible ?? false, false); h.close();
});

test('hidden expired and disposed owners suppress work and retire pending native issues', () => {
  const h = watched(), issue = h.issue(); h.owner.setVisible(false);
  assert.ok(h.calls.retired.includes(issue)); const requests = h.calls.requests;
  assert.equal(h.finish(issue), false); h.owner.port.requestFrame(); assert.equal(h.calls.requests, requests);
  h.owner.setVisible(true); h.expire(); assert.equal(h.issue(), undefined); h.close(); h.close();
  assert.equal(h.subscriptions, 0); assert.equal(h.calls.demand.at(-1), false);
  assert.equal(h.owner.port.projectTarget({}, 'anchor'), undefined); assert.doesNotThrow(() => h.owner.port.watchTarget('anchor')());
});

test('unavailable same issue camera facts remain absent instead of guessing control eligibility', () => {
  const h = watched(); h.hooks.camera = () => undefined;
  const frame = h.paint(); assert.ok(frame); assert.equal(frame.cameraProfile, undefined); h.close();
});
