import assert from 'node:assert/strict';
import test from 'node:test';
import { hasNativeFrameDemand } from '../src/scene/native-frame-authority.mjs';
import { completionBridgeFixture, flushCompletion } from './fixtures/scene-completion-bridge.mjs';
import { completionInput, member } from './fixtures/scene-completion-data.mjs';

const queries = h => h.gpu.calls.filter(call => call[0] === 'createQuery').length;

test('marker only factory and ordinary native hooks remain completion dormant', async () => {
  const h = completionBridgeFixture({ completion: false });
  assert.equal(hasNativeFrameDemand(h.gl), false); await h.render();
  assert.equal(h.calls.phaseFacts, 0); assert.equal(h.calls.scopes, 0); assert.equal(queries(h), 0);
  await h.start();
  assert.deepEqual(Object.keys(h.bridge).sort(), ['dispose', 'invalidateStyle', 'requestFrame', 'setVisible']);
  await h.render(); assert.equal(hasNativeFrameDemand(h.gl), false); assert.equal(queries(h), 0);
  assert.equal(h.calls.phaseFacts, 0); assert.equal(h.calls.scopes, 0);
  assert.equal(h.calls.completionSubscriptions, 0); assert.equal(h.calls.camera, 0); assert.equal(h.raf.requests.length, 0);
  assert.equal(h.gpu.calls.filter(call => call[0] === 'fenceSync').length, 0); h.close();
});

test('completion opt in shares the owned marker renderer and activates only watched demand', async () => {
  const h = completionBridgeFixture(); await h.start(false);
  assert.equal(hasNativeFrameDemand(h.gl), false); assert.equal(queries(h), 0);
  const release = h.bridge.completion.watchTarget('anchor'); await h.render(); await h.settle();
  assert.equal(h.calls.add, 1); assert.equal(h.layers.size, 1); assert.ok(queries(h) > 0);
  assert.equal(h.frames.length, 1); release(); assert.equal(hasNativeFrameDemand(h.gl), false); h.close();
});

test('completion capture rejects a scalar equivalent packet from a different bridge publication', async () => {
  const h = completionBridgeFixture(); const expected = h.input;
  h.completion.captureInput = () => ({ ...expected, renderInput: { ...expected.renderInput } });
  await h.start(); await h.render(); assert.equal(queries(h), 0); assert.equal(h.frames.length, 0); h.close();
});

test('camera capture reentry cannot issue from retired input or native lifetime', async () => {
  const h = completionBridgeFixture(); await h.start();
  h.hooks.camera = () => { h.hooks.camera = undefined; h.replace(completionInput()); h.expire(); };
  await h.render(); assert.ok(h.calls.camera > 0); assert.equal(queries(h), 0); assert.equal(h.calls.claims, 0); assert.equal(h.frames.length, 0); h.close();
});

test('owned layer replacement between capture and issue cancels installation authority', async () => {
  const h = completionBridgeFixture(); await h.start(); const accepted = h.input;
  h.hooks.camera = () => { for (const entry of h.layers.values()) entry.handle = {}; };
  await h.render(); assert.ok(h.calls.camera > 0); assert.equal(queries(h), 0); assert.equal(h.frames.length, 0); assert.equal(h.input, accepted); h.close();
});

test('later native depth writing layer denies scope and public render cannot seal it', async () => {
  const h = completionBridgeFixture(); await h.start(); const layer = [...h.layers.values()][0].layer;
  await h.render({ facts: { orderedLayers: [{ id: 'background', type: 'background' }, { id: layer.id, type: 'custom' }, { id: 'later', type: 'fill-extrusion' }] } });
  assert.deepEqual(h.errors, []);
  h.nativeEvents.emit('render'); await h.settle(); assert.equal(queries(h), 0); assert.equal(h.frames.length, 0);
  assert.deepEqual(h.errors, []); h.close();
});

test('multiple opaque overlapping glyphs cannot receive optimistic depth only visibility', async () => {
  const h = completionBridgeFixture({ input: completionInput({ members: [member(), member('front')] }) });
  await h.start(); h.bridge.completion.watchTarget('front'); await h.render(); await h.settle();
  assert.ok(h.gpu.draws.length > 0); assert.equal(queries(h), 0); assert.equal(h.frames.length, 0); h.close();
});

test('ready query results cannot repair missing or aborted native normal end', async () => {
  for (const change of [{ seal: false }, { abort: true }]) {
    const h = completionBridgeFixture(); await h.start(); await h.render(change);
    assert.ok(queries(h) > 0); h.nativeEvents.emit('render'); await h.settle(); assert.equal(h.frames.length, 0); h.close();
  }
});

test('opposite anchor and object query results both remain nonvisible', async () => {
  for (const evidence of [[false, true], [true, false]]) {
    const h = completionBridgeFixture(); await h.start(); await h.render();
    assert.equal(queries(h), 2); await h.settle(evidence); assert.equal(h.frames.length, 1);
    const value = h.bridge.completion.projectTarget(h.frames[0], 'anchor'); assert.equal(value.visible, false);
    assert.notEqual(value.status, 'resolved'); h.close();
  }
});

test('style and context replacement revoke old results while new resources can complete', async () => {
  const h = completionBridgeFixture(); await h.start(); await h.render(); await h.settle(); const old = h.frames[0];
  const oldQueries = [...h.gpu.queryRecords.keys()]; await h.replay(); await h.render(); await h.settle();
  assert.equal(h.bridge.completion.current(old, 'anchor', h.input.members[0].target.token), false);
  assert.ok([...h.gpu.queryRecords.keys()].some(query => !oldQueries.includes(query)));
  h.loss(); h.restore(); await flushCompletion(); await h.render(); await h.settle();
  assert.equal(h.bridge.completion.current(old, 'anchor', h.input.members[0].target.token), false);
  assert.ok(h.frames.at(-1).stamp.paintFrameSerial > old.stamp.paintFrameSerial); h.close();
});

test('pending terrain and mixed model plans never turn authored fallback into resolved completion', async () => {
  for (const input of [completionInput({ members: [member('anchor', 'marker', { target: { ...member().target,
    position: { lngLat: [0, 0], altitude: 7, altitudeReference: 'terrain' } } })] }),
  completionInput({ members: [member(), member('model', 'model')] })]) {
    const h = completionBridgeFixture({ input }); await h.start(); await h.render(); await h.settle();
    assert.equal(queries(h), 0); assert.equal(h.frames.length, 0); assert.equal(h.input.members.length, input.members.length); h.close();
  }
});

test('read only polling completes without repaint or replaying probes into another render', async () => {
  const h = completionBridgeFixture(); await h.start(); await h.render();
  const previous = [...h.gpu.queryRecords.keys()]; assert.equal(previous.length, 2);
  await h.render();
  assert.equal(h.frames.length, 0); assert.equal(queries(h), 4);
  assert.ok(previous.every(query => h.gpu.deleted.has(query)), 'the next native paint retires the earlier pending issue');
  assert.equal(h.raf.pending, 1);
  const repaint = h.calls.repaint, draws = h.gpu.draws.length, count = queries(h);
  h.raf.step(); assert.equal(h.frames.length, 0); assert.equal(h.raf.pending, 1);
  await h.settle(); assert.equal(h.frames.length, 1); assert.equal(h.frames[0].stamp.paintFrameSerial, 2); assert.equal(h.calls.repaint, repaint);
  assert.equal(h.gpu.draws.length, draws); assert.equal(queries(h), count); assert.equal(h.raf.pending, 0); h.close();
});
