import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalog } from './catalog.js';
import {
  createScriptedConversation, resolveScriptedPath, validateScriptedTree,
  type LyraGenScriptedBuildResult, type LyraGenScriptedPath, type LyraGenScriptedSnapshot, type LyraGenScriptedTree,
} from './scripted-conversation.js';
import type { JsonValue, LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = createCatalog({ id: 'scripted', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
} });
type Copy = { readonly key: string };
const tree: LyraGenScriptedTree<Copy> = {
  start: 'intro',
  steps: {
    intro: { id: 'intro', copy: { key: 'intro' }, choices: [
      { id: 'markets', next: 'markets', copy: { key: 'pick-markets' } },
      { id: 'weather', next: 'weather', copy: { key: 'pick-weather' } },
    ] },
    markets: { id: 'markets', choices: [
      { id: 'focus', next: 'done' },
      { id: 'compare', next: 'done' },
    ] },
    weather: { id: 'weather', choices: [
      { id: 'dry', next: 'done' },
      { id: 'warm', next: 'done' },
    ] },
    done: { id: 'done', choices: [] },
  },
};
const body = (path: LyraGenScriptedPath, controls: Readonly<Record<string, JsonValue>>): LyraGenScriptedBuildResult => ({
  root: { id: 'root', type: 'stack', children: [{ id: 'step', type: 'text', text: `${path.step}:${JSON.stringify(controls)}` }] },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('the tree validator rejects unknown targets, cycles, duplicate ids, unreachable steps and lone follow-ups', () => {
  assert.equal(validateScriptedTree(tree).ok, true);
  const codes = (input: unknown) => { const result = validateScriptedTree(input); return result.ok ? [] : result.diagnostics.map(item => item.code); };
  assert.ok(codes({ ...tree, start: 'missing' }).includes('scripted.start'));
  assert.ok(codes({ start: 'a', steps: { a: { id: 'a', choices: [{ id: 'x', next: 'b' }, { id: 'y', next: 'c' }] }, b: { id: 'b', choices: [] } } }).includes('scripted.size'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, done: { id: 'done', choices: [{ id: 'again', next: 'intro' }, { id: 'other', next: 'markets' }] } } }).includes('scripted.cycle'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, markets: { id: 'markets', choices: [{ id: 'focus', next: 'done' }, { id: 'focus', next: 'done' }] } } }).includes('scripted.duplicate'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, markets: { id: 'markets', choices: [{ id: 'focus', next: 'nowhere' }, { id: 'compare', next: 'done' }] } } }).includes('scripted.target'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, markets: { id: 'markets', choices: [{ id: 'focus', next: 'done' }] } } }).includes('scripted.choices'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, orphan: { id: 'orphan', choices: [] } } }).includes('scripted.unreachable'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, done: { id: 'other', choices: [] } } }).includes('scripted.identity'));
  assert.ok(codes({ ...tree, steps: { ...tree.steps, done: { id: 'done', choices: [{ id: 'bad id', next: 'x' }] } } }).includes('scripted.identity'));
  assert.throws(() => createScriptedConversation({ tree: { ...tree, start: 'missing' }, catalog, surfaceId: 's', buildStep: body }), TypeError);
  assert.throws(() => createScriptedConversation({ tree, catalog, surfaceId: 'bad id', buildStep: body }), TypeError);
});

test('paths resolve only through declared follow-up choices', () => {
  const ok = resolveScriptedPath(tree, ['weather', 'dry']);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value, { choices: ['weather', 'dry'], steps: ['intro', 'weather', 'done'], step: 'done' });
  assert.equal(resolveScriptedPath(tree, ['weather', 'focus']).ok, false);
  assert.equal(resolveScriptedPath(tree, ['weather', 'dry', 'more']).ok, false);
});

test('choose, back and restart publish strictly increasing revisions on one surface and never reuse one', async () => {
  const seen: number[] = [];
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', buildStep: body });
  conversation.subscribe(snapshot => { if (snapshot.document && seen.at(-1) !== snapshot.document.revision) seen.push(snapshot.document.revision); });
  assert.equal(conversation.snapshot.status, 'idle');
  conversation.restart(); await settle();
  assert.equal(conversation.snapshot.status, 'ready');
  assert.equal(conversation.snapshot.document?.surfaceId, 'guided');
  assert.deepEqual(conversation.snapshot.choices.map(choice => choice.id), ['markets', 'weather']);
  assert.equal(conversation.choose('markets'), 'accepted'); await settle();
  assert.equal(conversation.choose('dry'), 'unknown');
  assert.equal(conversation.choose('focus'), 'accepted'); await settle();
  assert.equal(conversation.snapshot.terminal, true);
  assert.equal(conversation.back(), 'accepted'); await settle();
  assert.equal(conversation.snapshot.step.id, 'markets');
  assert.equal(conversation.back(), 'accepted'); await settle();
  assert.equal(conversation.back(), 'unavailable');
  assert.equal(conversation.choose('weather'), 'accepted'); await settle();
  conversation.restart(); await settle();
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(conversation.snapshot.path, []);
});

test('the transcript pairs application-owned prompt and answer copy without adding text', async () => {
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', buildStep: body });
  conversation.restart(); conversation.choose('markets'); await settle();
  assert.deepEqual(conversation.snapshot.transcript.map(entry => [entry.kind, entry.id, entry.copy?.key ?? null]), [
    ['prompt', 'prompt:0:intro', 'intro'], ['answer', 'answer:0:markets', 'pick-markets'], ['prompt', 'prompt:1:markets', null],
  ]);
});

test('a superseded build and a late render report for an old revision never land', async () => {
  const gates = new Map<string, ReturnType<typeof deferred<LyraGenScriptedBuildResult>>>();
  const aborted: string[] = [];
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', buildStep: (path, controls, context) => {
    const gate = deferred<LyraGenScriptedBuildResult>();
    gates.set(path.step, gate);
    context.signal.addEventListener('abort', () => aborted.push(path.step));
    return gate.promise.then(() => body(path, controls));
  } });
  conversation.restart();
  gates.get('intro')!.resolve(body({ choices: [], steps: ['intro'], step: 'intro' }, {})); await settle();
  const first = conversation.snapshot.document!.revision;
  conversation.choose('markets');
  conversation.back();
  assert.deepEqual(aborted, ['markets']);
  gates.get('markets')!.resolve(body({ choices: [], steps: [], step: 'markets' }, {})); await settle();
  assert.equal(conversation.snapshot.status, 'building');
  assert.equal(conversation.snapshot.document!.revision, first);
  gates.get('intro')!.resolve(body({ choices: [], steps: ['intro'], step: 'intro' }, {})); await settle();
  const current = conversation.snapshot.document!.revision;
  assert.equal(current, first + 2, 'the superseded build consumed its own revision');
  assert.equal(conversation.markRendered('guided', first), false);
  assert.equal(conversation.markRendered('elsewhere', current), false);
  assert.equal(conversation.snapshot.rendered, false);
  assert.equal(conversation.markRendered('guided', current), true);
  assert.equal(conversation.snapshot.rendered, true);
  assert.deepEqual(conversation.snapshot.focusTarget, { reason: 'back', choiceId: 'markets' });
});

test('control edits coalesce into one in-flight revision and the latest values win', async () => {
  const builds: string[] = [];
  const gates: Array<ReturnType<typeof deferred<void>>> = [];
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', controls: { nights: 1 }, buildStep: async (path, controls) => {
    builds.push(JSON.stringify(controls));
    const gate = deferred<void>(); gates.push(gate); await gate.promise;
    return body(path, controls);
  } });
  conversation.restart(); gates[0]!.resolve(); await settle();
  assert.equal(conversation.markRendered('guided', 1), true);
  assert.deepEqual(conversation.snapshot.focusTarget, { reason: 'restart', choiceId: 'markets' });
  conversation.setControls({ nights: 2 });
  assert.equal(conversation.snapshot.focusTarget, undefined);
  conversation.setControls({ nights: 3 });
  conversation.setControls({ nights: 4 });
  assert.deepEqual(conversation.snapshot.controls, { nights: 4 });
  assert.equal(builds.length, 2);
  gates[1]!.resolve(); await settle();
  assert.equal(builds.length, 3);
  assert.equal(conversation.snapshot.document!.revision, 2);
  gates[2]!.resolve(); await settle();
  assert.deepEqual(builds, ['{"nights":1}', '{"nights":2}', '{"nights":4}']);
  assert.equal(conversation.snapshot.document!.revision, 3);
  assert.equal(conversation.snapshot.status, 'ready');
  conversation.markRendered('guided', 3);
  assert.equal(conversation.snapshot.focusTarget, undefined, 'a control edit never asks to move focus');
  assert.throws(() => conversation.setControls({ nights: undefined as unknown as JsonValue }), TypeError);
});

test('patch results apply to the committed view and are restamped to the controller revision', async () => {
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', buildStep: (path, _controls, context) => context.previous
    ? { operations: [{ op: 'replace', nodeId: 'step', node: { id: 'step', type: 'text', text: path.step } }] }
    : body(path, {}) });
  conversation.restart(); await settle();
  const first = conversation.snapshot.document!;
  conversation.choose('weather'); conversation.back(); conversation.choose('markets'); await settle();
  const next = conversation.snapshot.document!;
  assert.equal(next.revision, 4);
  assert.equal(next.root.children![0]!.text, 'markets');
  assert.notEqual(next, first);
});

test('invalid views and thrown builds fail closed with generic diagnostics; retry recovers', async () => {
  let fail: 'throw' | 'invalid' | undefined = 'throw';
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', buildStep: path => {
    if (fail === 'throw') throw new Error('secret detail');
    if (fail === 'invalid') return { root: { id: 'root', type: 'script', text: 'x' } };
    return body(path, {});
  } });
  const snapshots: LyraGenScriptedSnapshot<Copy>[] = [];
  conversation.subscribe(snapshot => snapshots.push(snapshot));
  conversation.restart(); await settle();
  assert.equal(conversation.snapshot.status, 'error');
  assert.equal(conversation.snapshot.diagnostics[0]!.code, 'scripted.build');
  assert.ok(!JSON.stringify(conversation.snapshot.diagnostics).includes('secret'));
  fail = 'invalid'; conversation.retry(); await settle();
  assert.equal(conversation.snapshot.status, 'error');
  assert.equal(conversation.snapshot.document, undefined);
  fail = undefined; conversation.retry(); await settle();
  assert.equal(conversation.snapshot.status, 'ready');
  assert.equal(conversation.snapshot.document!.revision, 3);
  assert.ok(snapshots.every(snapshot => Object.isFrozen(snapshot)));
  conversation.dispose();
  assert.equal(conversation.choose('markets'), 'disposed');
  assert.equal(conversation.snapshot.status, 'disposed');
});

test('goTo restores a validated path and rejects an undeclared one', async () => {
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', revisionStart: 40, buildStep: body });
  assert.equal(conversation.goTo(['weather', 'focus']), 'unknown');
  assert.equal(conversation.goTo(['weather', 'warm']), 'accepted'); await settle();
  assert.equal(conversation.snapshot.document!.revision, 40);
  assert.deepEqual(conversation.snapshot.steps, ['intro', 'weather', 'done']);
  assert.equal(conversation.snapshot.canGoBack, true);
});
