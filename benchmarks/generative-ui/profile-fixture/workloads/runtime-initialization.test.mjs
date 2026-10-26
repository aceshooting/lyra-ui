import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture as createReport, fixtureDefinitions as reportDefinitions, createReportRenderer } from './a2ui.js';
import { createFixture as createSdk, fixtureDefinitions as sdkDefinitions } from './ai-sdk.js';

test('authority reprojection owns a fresh renderer and retired actions stay detached after regrant', () => {
  class View extends EventTarget {
    dataset = {};
    connected = true;
    remove() { this.connected = false; }
  }
  const signal = new AbortController().signal, catalog = {}, document = { surfaceId: 'extended-report', revision: 102 };
  let sourceGranted = true, actions = 0;
  const options = { View, catalog, signal, onAction: () => { if (sourceGranted) actions++; } };
  const original = createReportRenderer(options); original.view.document = document;
  original.view.dispatchEvent(new Event('lr-gen-action')); assert.equal(actions, 1);
  sourceGranted = false;
  const replacement = createReportRenderer(options); replacement.view.document = document;
  original.dispose(); original.dispose();
  assert.notEqual(replacement.view, original.view);
  assert.equal(replacement.view.document, document, 'Reprojection must not invent a protocol revision.');
  assert.equal(original.view.document, undefined); assert.equal(original.view.connected, false);
  replacement.view.dispatchEvent(new Event('lr-gen-action')); assert.equal(actions, 1);
  sourceGranted = true;
  original.view.dispatchEvent(new Event('lr-gen-action')); assert.equal(actions, 1, 'Regrant must not revive the retired action listener.');
  replacement.view.dispatchEvent(new Event('lr-gen-action')); assert.equal(actions, 2);
  replacement.dispose(); replacement.view.dispatchEvent(new Event('lr-gen-action')); assert.equal(actions, 2);
});

for (const [workload, createFixture, definition] of [
  ['A', createReport, reportDefinitions.A], ['K', createSdk, sdkDefinitions.K],
]) {
  for (const cancellation of ['abort', 'dispose']) {
    test(`${workload} preparation is inert and ${cancellation} during runtime loading prevents late initialization`, async () => {
      const events = [], controller = new AbortController();
      let finishLoad;
      const loaded = new Promise(resolve => { finishLoad = resolve; });
      const host = { childNodes: [], querySelectorAll: () => [], append: () => assert.fail('A cancelled mount appended content.') };
      const measurement = { pendingOperations: 0, async measureOperation({ trigger, readOracle }) {
        events.push('ready-start');
        assert.equal(readOracle().status, 'pending');
        return trigger();
      } };
      const fixture = await createFixture({ workload, host, measurement, signal: controller.signal,
        loadRuntime: () => { events.push('load'); return loaded; } });
      const prepared = await fixture.prepare({ batchIndex: 0, sampleIndex: 0, manifest: { workload, sha256: 'a'.repeat(64) } });
      assert.deepEqual(events, [], 'Factory and prepare cannot import production modules.');
      assert.equal(fixture.readOracle({ operation: definition.operations[0], generation: prepared.generation }).status, 'pending');
      events.push('first-mount-start');
      const running = fixture.runOperation({ operation: definition.operations[0], generation: prepared.generation, signal: controller.signal });
      assert.deepEqual(events, workload === 'A' ? ['first-mount-start', 'ready-start', 'load'] : ['first-mount-start', 'load'],
        'A loads within timed mount; K loads within lifecycle before its final-input readiness clock.');
      if (cancellation === 'abort') controller.abort();
      else assert.equal((await fixture.dispose()).retainedSources, 0);
      const rejection = assert.rejects(running, /initialization aborted/u);
      finishLoad(new Proxy([], { get(_target, key) { if (key === 'then') return undefined; assert.fail('Cancelled initialization accessed runtime constructors.'); } }));
      await rejection;
      assert.deepEqual(await fixture.dispose(), { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 });
      await assert.rejects(fixture.runOperation({ operation: definition.operations[0], generation: prepared.generation, signal: controller.signal }), /Stale/u);
    });
  }
}
