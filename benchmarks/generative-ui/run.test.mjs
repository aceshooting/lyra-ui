import test from 'node:test';
import assert from 'node:assert/strict';
import { optionsFor, checkReplayMetrics, summarizeReplaySamples } from './run.mjs';
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
  assert.deepEqual(optionsFor(['--output=result.json']), { samples: 3, browser: 'chromium', workload: 'chat-form', temperature: 'cold', reservation: 'default', output: 'result.json' });
  assert.equal(optionsFor(['--output=result.json', '--temperature=paired', '--reservation=both']).temperature, 'paired');
  for (const argument of ['--samples=0', '--samples=31', '--samples=2.5', '--browser=missing', '--workload=missing', '--temperature=cached', '--reservation=invented', '--unknown=x']) {
    assert.throws(() => optionsFor(['--output=result.json', argument]));
  }
  assert.throws(() => optionsFor([]));
});

test('descriptive summaries keep cold/warm and reservation cells separate and retain unsupported nulls', () => {
  const samples = [
    { sampleIndex: 0, mode: 'chunk', temperature: 'cold', reservation: 'default', metrics: { elapsedMs: 8, cls: null } },
    { sampleIndex: 1, mode: 'chunk', temperature: 'cold', reservation: 'default', metrics: { elapsedMs: 4, cls: null } },
    { sampleIndex: 0, mode: 'frame', temperature: 'cold', reservation: 'default', metrics: { elapsedMs: 3, cls: null } },
    { sampleIndex: 0, mode: 'chunk', temperature: 'warm', reservation: 'none', metrics: { elapsedMs: 1, cls: null } },
  ];
  const summary = summarizeReplaySamples(samples);
  assert.equal(summary.cells.length, 3);
  assert.deepEqual(summary.cells[0].metrics.elapsedMs, { count: 2, min: 4, median: 6, p95: 8, max: 8 });
  assert.equal(summary.cells[0].metrics.cls, null);
  assert.equal(summary.pairedModeDifferences.length, 1, 'Only exact sample/temperature/reservation pairs are compared.');
  assert.equal(summary.pairedModeDifferences[0].metrics.elapsedMs, -5);
  assert.equal(summary.pairedModeDifferences[0].metrics.cls, null);
  assert.match(summary.uncertainty, /descriptive/u);
});


test('fails missing or nonsensical rendering measurements while preserving unsupported observer nulls', () => {
  const metrics = Object.fromEntries(['elapsedMs', 'firstUsefulMs', 'controlReadyMs', 'parseControllerMs', 'renderSettlingMs', 'hostUpdates', 'litUpdates', 'peakConnectedNodes', 'controlInputToFrameMs', 'connectedNodesAfterDispose', 'connectedElementsAfterDispose', 'sourceCharactersBeforeRelease', 'sourceCharactersAfterRelease', 'presentationCharactersAfterRelease'].map(key => [key, 1]));
  Object.assign(metrics, { cls: null, longTaskCount: null, maximumLongTaskMs: null });
  checkReplayMetrics(metrics);
  assert.throws(() => checkReplayMetrics({ ...metrics, firstUsefulMs: null }));
  assert.throws(() => checkReplayMetrics({ ...metrics, litUpdates: 0 }));
  assert.throws(() => checkReplayMetrics({ ...metrics, cls: NaN }));
  assert.throws(() => checkReplayMetrics({ ...metrics, rendererTaskMs: -1 }));
  assert.throws(() => checkReplayMetrics({ ...metrics, controlReadyMs: 2 }));
});
