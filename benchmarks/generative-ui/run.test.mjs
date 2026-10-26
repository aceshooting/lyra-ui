import test from 'node:test';
import assert from 'node:assert/strict';
import { optionsFor, checkReplayMetrics } from './run.mjs';
import { WORKLOADS, tokenSchedule, workloadSchedule } from './workloads.mjs';

test('replays every source exactly with nonnegative ordered synthetic arrivals', () => {
  for (const workload of Object.values(WORKLOADS)) {
    const schedule = workloadSchedule(workload);
    assert.equal(schedule.map(chunk => chunk.text).join(''), workload.source);
    assert.equal(schedule[0].atMs, 0);
    assert.ok(schedule.every((chunk, index) => chunk.atMs >= (schedule[index - 1]?.atMs ?? 0)));
    if (!workload.recording) assert.ok(schedule.every((chunk, index) => chunk.atMs === index * workload.intervalMs));
  }
  assert.equal(tokenSchedule('a😀b', { characters: 1 }).map(chunk => chunk.text).join(''), 'a😀b');
  assert.throws(() => tokenSchedule('test', { characters: 0 }));
  assert.throws(() => tokenSchedule('test', { intervalMs: NaN }));
});

test('requires explicit output and bounded sample/browser/workload selection', () => {
  assert.deepEqual(optionsFor(['--output=result.json']), { samples: 3, browser: 'chromium', workload: 'chat-form', output: 'result.json' });
  for (const argument of ['--samples=0', '--samples=31', '--samples=2.5', '--browser=missing', '--workload=missing', '--unknown=x']) {
    assert.throws(() => optionsFor(['--output=result.json', argument]));
  }
  assert.throws(() => optionsFor([]));
});


test('fails missing or nonsensical rendering measurements while preserving unsupported observer nulls', () => {
  const metrics = Object.fromEntries(['elapsedMs', 'firstUsefulMs', 'controlReadyMs', 'parseControllerMs', 'renderSettlingMs', 'hostUpdates', 'litUpdates', 'peakConnectedNodes', 'controlInputToFrameMs', 'connectedNodesAfterDispose', 'connectedElementsAfterDispose', 'sourceCharactersBeforeRelease', 'sourceCharactersAfterRelease', 'presentationCharactersAfterRelease'].map(key => [key, 1]));
  Object.assign(metrics, { cls: null, longTaskCount: null, maximumLongTaskMs: null });
  checkReplayMetrics(metrics);
  assert.throws(() => checkReplayMetrics({ ...metrics, firstUsefulMs: null }));
  assert.throws(() => checkReplayMetrics({ ...metrics, litUpdates: 0 }));
  assert.throws(() => checkReplayMetrics({ ...metrics, cls: NaN }));
  assert.throws(() => checkReplayMetrics({ ...metrics, controlReadyMs: 2 }));
});
