import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LyraGenCatalog, LyraGenView } from '../types.js';
import { createAgUiViewReducer } from './ag-ui.js';

const catalog: LyraGenCatalog = { id: 'agui', version: '1', components: {
  panel: { tag: 'section', properties: { title: { type: 'string', maxLength: 32 } }, children: true },
  field: { tag: 'input', properties: { value: { type: 'string', maxLength: 8 } }, bindings: { value: { event: 'input', property: 'value' } } },
  metric: { tag: 'span', text: true, properties: { value: { type: 'number' } } },
} };
const view = (revision = 0, title = 'Board'): LyraGenView => ({ version: '1', catalog: { id: 'agui', version: '1' }, surfaceId: 'board', revision, root: {
  id: 'root', type: 'panel', props: { title }, children: [
    { id: 'name', type: 'field', props: { value: '' }, bindings: { value: '/name' } },
    { id: 'load', type: 'metric', text: 'Load', liveReads: { value: '/load' } },
  ] } });
const reducer = () => createAgUiViewReducer({ catalog, surfaceId: 'board' });
const snapshot = (lyraGen: unknown, extra: Record<string, unknown> = {}) => ({ type: 'STATE_SNAPSHOT', snapshot: { ...extra, lyraGen } });

test('a state snapshot admits the view, live data and bound state; other state keys are ignored', () => {
  const { initial, reduce } = reducer();
  const state = reduce(initial, snapshot({ view: view(), liveData: { load: 3 }, bindingState: { name: 'Ada', unbound: 'drop' } }, { chat: { long: 'x' } }));
  assert.equal(state.status, 'ready');
  assert.equal(state.view?.surfaceId, 'board');
  assert.deepEqual(state.liveData, { load: 3 });
  assert.deepEqual(state.bindingState, { name: 'Ada' });
  assert.equal(reduce(state, { type: 'TEXT_MESSAGE_CONTENT', delta: 'hi' }), state);
  assert.equal(reduce(state, null), state);
  assert.equal(reduce(state, { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/chat/long', value: 'y' }] }), state);
  const replay = reduce(state, snapshot({ view: structuredClone(view()), liveData: { load: 3 } }));
  assert.equal(replay.view, state.view);
});

test('state deltas inside the view go through the identity-addressed patch adapter', () => {
  const { initial, reduce } = reducer();
  const ready = reduce(initial, snapshot({ view: view(), liveData: { load: 1 } }));
  const next = reduce(ready, { type: 'STATE_DELTA', delta: [
    { op: 'replace', path: '/lyraGen/view/root/children/1/text', value: 'Live load' },
    { op: 'replace', path: '/lyraGen/liveData/load', value: 7 },
    { op: 'add', path: '/lyraGen/bindingState', value: { name: 'Lin' } },
  ] });
  assert.equal(next.status, 'ready', JSON.stringify(next.diagnostics));
  assert.equal(next.view?.revision, 1);
  assert.equal(next.view?.root.children?.[1]?.text, 'Live load');
  assert.equal(next.view?.root.children?.[0], ready.view?.root.children?.[0]);
  assert.deepEqual(next.liveData, { load: 7 });
  assert.deepEqual(next.bindingState, { name: 'Lin' });
  const appended = reduce(next, { type: 'STATE_DELTA', delta: [
    { op: 'add', path: '/lyraGen/view/root/children/-', value: { id: 'extra', type: 'metric', text: 'Extra' } },
    { op: 'replace', path: '/lyraGen/view/revision', value: 2 },
  ] });
  assert.deepEqual(appended.view?.root.children?.map(child => child.id), ['name', 'load', 'extra']);
  assert.equal(appended.view?.revision, 2);
});

test('invalid deltas and snapshots are rejected with diagnostics and keep the previous valid values', () => {
  const { initial, reduce } = reducer();
  const ready = reduce(initial, snapshot({ view: view(2), liveData: { load: 1 }, bindingState: { name: 'Ada' } }));
  const cases: unknown[] = [
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen/view/root/children/0/type', value: 'script' }] },
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen/view/surfaceId', value: 'other' }] },
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen/view/revision', value: 7 }] },
    { type: 'STATE_DELTA', delta: [{ op: 'add', path: '/lyraGen/view/root/props/__proto__', value: 1 }] },
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen/bindingState/name', value: 'far too long' }] },
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '', value: {} }] },
    { type: 'STATE_DELTA', delta: [{ op: 'move', from: '/elsewhere', path: '/lyraGen/liveData' }] },
    { type: 'STATE_DELTA', delta: [{ op: 'test', path: '/lyraGen/liveData/load', value: 9 }, { op: 'remove', path: '/lyraGen/liveData' }] },
    { type: 'STATE_DELTA', delta: Array.from({ length: 129 }, () => ({ op: 'test', path: '/x', value: 1 })) },
    { type: 'STATE_DELTA', delta: 'not a patch' },
    snapshot({ view: view(1) }),
    snapshot({ view: view(2, 'Changed without a revision') }),
    snapshot({ view: { ...view(3), surfaceId: 'another' } }),
    snapshot({ view: { ...view(3), root: { id: 'root', type: 'lyra-gen:isolated' } } }),
    snapshot('not an object'),
  ];
  for (const event of cases) {
    const rejected = reduce(ready, event);
    assert.equal(rejected.status, 'rejected', JSON.stringify(event).slice(0, 120));
    assert.ok(rejected.diagnostics.length > 0);
    assert.equal(rejected.view, ready.view);
    assert.equal(rejected.liveData, ready.liveData);
    assert.equal(rejected.bindingState, ready.bindingState);
  }
  const fresh = reduce(initial, { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen/view/root/props/title', value: 'x' }] });
  assert.equal(fresh.status, 'rejected');
  assert.equal(fresh.diagnostics[0]?.code, 'ag-ui.baseline');
});

test('wholesale view replacement through a delta must advance the revision', () => {
  const { initial, reduce } = reducer();
  const ready = reduce(initial, snapshot({ view: view(0) }));
  const replaced = reduce(ready, { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen/view', value: view(5, 'Replaced') }] });
  assert.equal(replaced.view?.revision, 5);
  assert.equal(reduce(replaced, { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lyraGen', value: { view: view(4) } }] }).status, 'rejected');
  const cleared = reduce(replaced, { type: 'STATE_SNAPSHOT', snapshot: { other: true } });
  assert.equal(cleared.status, 'idle');
  assert.equal(cleared.view, undefined);
});

test('activity events of the configured type carry the container for one message', () => {
  const { initial, reduce } = createAgUiViewReducer({ catalog, surfaceId: 'board', activityType: 'lyra-gen', statePath: '' });
  assert.equal(reduce(initial, { type: 'ACTIVITY_SNAPSHOT', messageId: 'm1', activityType: 'other', content: { view: view() } }), initial);
  const ready = reduce(initial, { type: 'ACTIVITY_SNAPSHOT', messageId: 'm1', activityType: 'lyra-gen', content: { view: view() } });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.activityMessageId, 'm1');
  assert.equal(reduce(ready, { type: 'ACTIVITY_DELTA', messageId: 'm2', activityType: 'lyra-gen', patch: [{ op: 'add', path: '/liveData', value: {} }] }), ready);
  const next = reduce(ready, { type: 'ACTIVITY_DELTA', messageId: 'm1', activityType: 'lyra-gen', patch: [{ op: 'remove', path: '/view/root/children/1' }] });
  assert.deepEqual(next.view?.root.children?.map(child => child.id), ['name']);
  assert.equal(reduce(next, { type: 'ACTIVITY_SNAPSHOT', messageId: 'm1', activityType: 'lyra-gen', replace: false, content: { view: view(9) } }), next);
  const whole = reduce(initial, { type: 'STATE_SNAPSHOT', snapshot: { view: view(), liveData: { load: 2 } } });
  assert.deepEqual(whole.liveData, { load: 2 });
});

test('the reducer needs a surface identity and a safe state path', () => {
  assert.throws(() => createAgUiViewReducer({ catalog, surfaceId: '' }), TypeError);
  assert.throws(() => createAgUiViewReducer({ catalog, surfaceId: 'board', statePath: '/__proto__' }), TypeError);
});
