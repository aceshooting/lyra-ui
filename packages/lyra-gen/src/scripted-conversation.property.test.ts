import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createCatalog } from './catalog.js';
import { createScriptedConversation, resolveScriptedPath, validateScriptedTree, type LyraGenScriptedStep, type LyraGenScriptedTree } from './scripted-conversation.js';
import { propertyRuns } from '../test/property-options.js';

const catalog = createCatalog({ id: 'scripted-property', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } });
// A layered tree: each step links only to later layers, so it is acyclic and every step is reachable.
function layered(widths: readonly number[]): LyraGenScriptedTree {
  const steps: Record<string, LyraGenScriptedStep> = {};
  const layers = widths.map((width, layer) => Array.from({ length: width }, (_, index) => `s${layer}-${index}`));
  layers.forEach((ids, layer) => ids.forEach(id => {
    const next = layers[layer + 1];
    steps[id] = { id, choices: next ? next.map((target, choice) => ({ id: `c${choice}`, next: target })).concat(next.length === 1 ? [{ id: 'alt', next: next[0]! }] : []) : [] };
  }));
  return { start: 's0-0', steps };
}
const widths = fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 2, maxLength: 5 }).map(rest => [1, ...rest]);
const command = fc.oneof(
  fc.record({ kind: fc.constant('choose' as const), pick: fc.nat(4) }, { noNullPrototype: true }),
  fc.record({ kind: fc.constantFrom('back' as const, 'restart' as const, 'retry' as const, 'flush' as const) }, { noNullPrototype: true }),
  fc.record({ kind: fc.constant('controls' as const), value: fc.integer({ min: 0, max: 9 }) }, { noNullPrototype: true }),
);
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('random choice, back, restart and control sequences keep a valid path and strictly increasing revisions', async () => {
  await fc.assert(fc.asyncProperty(widths, fc.array(command, { maxLength: 24 }), async (shape, commands) => {
    const tree = layered(shape);
    assert.equal(validateScriptedTree(tree).ok, true);
    const revisions: number[] = [];
    const built: number[] = [];
    const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'prop', buildStep: async (path, controls, context) => {
      built.push(context.revision);
      await Promise.resolve();
      return { root: { id: 'root', type: 'text', text: `${path.step}:${String(controls['v'] ?? '')}` } };
    } });
    conversation.subscribe(snapshot => {
      assert.equal(resolveScriptedPath(tree, snapshot.path).ok, true);
      if (snapshot.document && snapshot.document.revision !== revisions.at(-1)) revisions.push(snapshot.document.revision);
    });
    conversation.restart();
    for (const step of commands) {
      if (step.kind === 'choose') {
        const choices = conversation.snapshot.choices;
        if (choices.length) assert.equal(conversation.choose(choices[step.pick % choices.length]!.id), 'accepted');
        else assert.equal(conversation.choose('c0'), 'unknown');
      } else if (step.kind === 'back') { const expected = conversation.snapshot.canGoBack ? 'accepted' : 'unavailable'; assert.equal(conversation.back(), expected); }
      else if (step.kind === 'restart') conversation.restart();
      else if (step.kind === 'retry') conversation.retry();
      else if (step.kind === 'controls') conversation.setControls({ v: step.value });
      else await settle();
    }
    await settle(); await settle();
    for (let index = 1; index < revisions.length; index++) assert.ok(revisions[index]! > revisions[index - 1]!);
    assert.equal(new Set(built).size, built.length, 'no revision is built twice');
    assert.equal(conversation.snapshot.status, 'ready');
    assert.equal(conversation.snapshot.document!.revision, built.at(-1));
    assert.ok(conversation.snapshot.document!.root.text!.startsWith(`${conversation.snapshot.step.id}:`));
  }), propertyRuns());
});
