import assert from 'node:assert/strict';
import test from 'node:test';
import { createPointsXrPresentation } from '../dist/points/xr.js';
import { createFixture } from './points-xr-fixture.mjs';

test('points presentation construction refuses a navigator without a usable XR session request', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; });
  const input = { scene: { viewportResources: {} } };
  for (const xr of [undefined, {}, { requestSession: 'not callable' }]) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { xr } });
    assert.throws(() => createPointsXrPresentation(input), { name: 'Lyra3dXrError', code: 'unavailable' });
  }
});

async function start(f) {
  const record = f.record, presentation = await record.engine.prepareXrPresentation();
  const entry = record.enter(presentation); void entry.catch(() => {});
  return { record, presentation, entry, attempt: f.attempts.at(-1) };
}
async function finish(f, active) {
  const exit = active.presentation.exit(); void exit.catch(() => {});
  active.attempt.ending.resolve(); active.attempt.endEvent();
  await f.until(() => active.record.viewport.renderer.getContext().state.releaseRequests === 1);
  f.lose(active.record); await exit;
}

test('a viewer pose without views is skipped and a later full pose still enters presentation', async t => {
  const f = await createFixture(t);
  const active = await start(f), r = active.record, before = r.renderReturns;
  await active.attempt.bind();
  const empty = { session: active.attempt.session, getViewerPose: () => ({ transform: active.attempt.frame().getViewerPose().transform, views: [] }) };
  for (const callback of [...active.attempt.session.frames.values()]) { active.attempt.session.frames.clear(); callback(100, empty); }
  await f.settle();
  assert.equal(r.renderReturns, before); assert.equal(active.presentation.state, 'requesting');
  active.attempt.deliver(); await active.entry;
  assert.equal(active.presentation.state, 'presenting'); assert.ok(r.renderReturns > before);
  await finish(f, active);
});
