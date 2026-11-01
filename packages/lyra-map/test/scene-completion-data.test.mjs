import assert from 'node:assert/strict';
import test from 'node:test';
import { readCompletionInput, createTargetProjection } from '../src/scene/completion-data.mjs';
import { completionInput, member, token } from './fixtures/scene-completion-data.mjs';

const read = value => readCompletionInput(value, value.renderInput);
const projection = change => createTargetProjection({ acceptedPositionRevision: 1, status: 'resolved', point: [12, 24], anchor: true, object: true, ...change });

test('completion data owns exhaustive mixed membership without source graphs', () => {
  const input = completionInput({ members: ['marker', 'path', 'arc', 'model'].map((kind, index) => member(`item-${index}`, kind)) });
  const result = read(input); assert.ok(result);
  assert.deepEqual(result.members.map(row => row.kind), ['marker', 'path', 'arc', 'model']);
  assert.notEqual(result.members, input.members); assert.notEqual(result.members[0].target.position, input.members[0].target.position);
  input.members[0].target.position.lngLat[0] = 70;
  assert.equal(result.members[0].target.position.lngLat[0], 0);
  assert.ok(Object.isFrozen(result.members[0].target.position.lngLat));
  assert.equal(result.members[0].rowToken, input.members[0].rowToken);
  assert.equal(read(completionInput({ members: [member('model', 'model', { source: { bytes: new Uint8Array([1]) } })] })), undefined);
});

test('completion membership refuses missing extra duplicate marker and token joins', () => {
  const input = completionInput();
  for (const members of [[], [input.members[0], input.members[0]], [member('extra')],
    [input.members[0], member('other', 'path', { rowToken: input.members[0].rowToken })]]) {
    assert.equal(read({ ...input, members }), undefined);
  }
  const second = member('second', 'model'); second.target.token = input.members[0].target.token;
  assert.equal(read({ ...input, members: [...input.members, second] }), undefined);
  assert.equal(read({ ...input, members: new Array(2001) }), undefined);
  assert.equal(read({ ...input, members: new Array(1) }), undefined);
  for (const id of ['', ' \t', 'x'.repeat(1025)]) assert.equal(read(completionInput({ members: [member(id, 'path')] })), undefined);
});

test('resolved marker geography and revision must match its render packet exactly', () => {
  const input = completionInput(); assert.ok(read(input));
  for (const change of [{ id: 'renamed' }, { target: { ...input.members[0].target, acceptedPositionRevision: 2 } },
    { target: { ...input.members[0].target, position: { ...input.members[0].target.position, altitude: 8 } } }]) {
    assert.equal(read({ ...input, members: [{ ...input.members[0], ...change }] }), undefined);
  }
});

test('completion input requires the exact render packet identity', () => {
  const input = completionInput();
  assert.equal(readCompletionInput(input, { ...input.renderInput }), undefined);
  assert.ok(readCompletionInput(input, input.renderInput));
});

test('pending and unavailable preserve accepted members despite zero prepared markers', () => {
  for (const phase of ['pending', 'unavailable']) {
    const input = completionInput({ phase }); const result = read(input);
    assert.ok(result); assert.equal(result.phase, phase); assert.equal(result.members.length, 1);
    assert.equal(result.renderInput.markers.length, 0); assert.equal(Object.hasOwn(result, 'installedSceneRevision'), false);
  }
});

test('completion reflection rejects accessors and thrown traps without evaluating getters', () => {
  let reads = 0; const input = completionInput();
  const accessor = { ...input }; Object.defineProperty(accessor, 'members', { enumerable: true, get() { reads++; return input.members; } });
  assert.equal(readCompletionInput(accessor, input.renderInput), undefined); assert.equal(reads, 0);
  const trapped = new Proxy(input, { ownKeys() { throw new Error('reflection unavailable'); } });
  assert.equal(readCompletionInput(trapped, input.renderInput), undefined);
  const result = read(input); assert.ok(result);
  Object.defineProperty(input.members[0], 'id', { get() { throw new Error('caller touched after ownership'); } });
  assert.equal(result.members[0].id, 'anchor');
});

test('revision zero is initial empty metadata only and counters never coerce', () => {
  assert.ok(read(completionInput({ acceptedSceneRevision: 0, members: [] })));
  assert.equal(read(completionInput({ acceptedSceneRevision: 0 })), undefined);
  for (const acceptedSceneRevision of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) {
    assert.equal(read(completionInput({ acceptedSceneRevision })), undefined);
  }
});

test('member kind determines whether a canonical target is required', () => {
  for (const kind of ['marker', 'model']) assert.equal(read(completionInput({ phase: 'pending', members: [member('item', kind, { target: undefined })] })), undefined);
  for (const kind of ['path', 'arc']) assert.equal(read(completionInput({ members: [member('item', kind, { target: member().target })] })), undefined);
  assert.equal(read(completionInput({ members: [member('item', 'label')] })), undefined);
});

test('target coordinates reference and revision refuse noncanonical or missing data', () => {
  const input = completionInput({ phase: 'pending' }); const original = input.members[0];
  for (const position of [{ lngLat: [181, 0], altitude: 7, altitudeReference: 'sea-level' },
    { lngLat: [0, 91], altitude: 7, altitudeReference: 'sea-level' },
    { lngLat: [0, 0], altitude: Infinity, altitudeReference: 'sea-level' },
    { lngLat: [0, 0], altitude: 7, altitudeReference: 'relative' }, { lngLat: [0, 0] }]) {
    assert.equal(read({ ...input, members: [{ ...original, target: { ...original.target, position } }] }), undefined);
  }
  for (const acceptedPositionRevision of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(read({ ...input, members: [{ ...original, target: { ...original.target, acceptedPositionRevision } }] }), undefined);
  }
});

test('only empty frozen tokens cross the neutral boundary', () => {
  const input = completionInput();
  for (const publicationToken of [{}, Object.freeze({ source: {} }), Object.freeze({ get value() { throw new Error('getter'); } }), Object.freeze([])]) {
    assert.equal(read({ ...input, publicationToken }), undefined);
  }
  assert.ok(read({ ...input, publicationToken: Object.freeze(Object.create(null)) }));
  const safe = token(); const result = read({ ...input, publicationToken: safe });
  assert.equal(result.publicationToken, safe); assert.deepEqual(Reflect.ownKeys(safe), []);
});

test('visibility joins anchor and object evidence without promoting unknown evidence', () => {
  for (const anchor of [true, false, undefined]) for (const object of [true, false, undefined]) {
    const result = projection({ anchor, object }); assert.ok(result);
    assert.equal(result.visible, anchor === true && object === true);
    assert.equal(result.status, anchor === false || object === false ? 'occluded' : anchor === true && object === true ? 'resolved' : 'visibility-pending');
  }
});

test('projection construction owns finite points and preserves refusal states', () => {
  const point = [12, 24], result = projection({ point }); point[0] = 99;
  assert.deepEqual(result.point, [12, 24]); assert.ok(Object.isFrozen(result.point));
  for (const status of ['terrain-pending', 'terrain-unavailable', 'model-pending', 'visibility-pending', 'clipped', 'occluded', 'unavailable']) {
    const refused = projection({ status }); assert.equal(refused.status, status); assert.equal(refused.visible, false);
  }
  for (const change of [{ status: 'unknown' }, { point: [NaN, 0] }, { acceptedPositionRevision: 0 }]) assert.equal(projection(change), undefined);
});
