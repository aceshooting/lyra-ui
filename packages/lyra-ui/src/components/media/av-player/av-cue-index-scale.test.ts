import { expect } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { AvCueIndex } from './av-cue-index.js';
import type { LyraAvCue } from './av-metadata.js';

function reference(cues: readonly LyraAvCue[], duration: number, time: number): number {
  const max = duration > 0 ? duration : Infinity;
  let winner = -1;
  let winningStart = -Infinity;
  cues.forEach((cue, index) => {
    const start = Math.min(cue.start, max);
    const next = Math.min(...cues.filter(other => other.start > cue.start).map(other => other.start));
    const end = cue.end === undefined
      ? start >= max || next === Infinity ? Infinity : Math.min(next, max)
      : Math.min(Math.max(start, cue.end), max);
    if (time >= start && time < end && start >= winningStart) { winner = index; winningStart = start; }
  });
  return winner;
}

it('matches the legacy scan across unsorted overlaps, zero lengths, ties and duration caps', () => {
  const cues: LyraAvCue[] = Array.from({ length: 160 }, (_, index) => {
    const start = (index * 37) % 61;
    return { cueId: String(index), start, ...(index % 3 ? { end: start + index % 19 } : {}), text: '' };
  });
  for (const duration of [0, 1, 20, 60, 100]) {
    const answers = new AvCueIndex(cues, duration);
    for (let time = 100; time >= -1; time -= 0.5) {
      expect(answers.at(time), `duration=${duration} time=${time}`).to.equal(reference(cues, duration, time));
    }
  }
});

it('retains at most two boundaries per cue and performs logarithmic lookup with constant interval reuse', () => {
  let cueReads = 0;
  const cues = Array.from({ length: 10000 }, (_, index) => ({
    cueId: String(index), get start() { cueReads += 1; return index * 2; }, end: index * 2 + 1, text: '',
  }));
  const answers = new AvCueIndex(cues, 0);
  expect(cueReads).to.be.at.most(40000);
  const internal = answers as unknown as { boundaries: number[]; winners: number[] };
  expect(internal.boundaries.length).to.be.at.most(20001);
  expect(internal.winners.length).to.equal(internal.boundaries.length);
  let comparisons = 0;
  internal.boundaries = new Proxy(internal.boundaries, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) comparisons += 1;
    return Reflect.get(target, key, receiver);
  } });
  cueReads = 0;
  expect(answers.at(19998.5)).to.equal(9999);
  expect(comparisons).to.be.at.most(18);
  const lookupReads = comparisons;
  comparisons = 0;
  for (let tick = 0; tick < 100; tick += 1) expect(answers.at(19998.5)).to.equal(9999);
  expect(comparisons).to.equal(200);
  expect(cueReads).to.equal(0);
  recordScaleMeasurement('lr-av-player', 'legacy-answer-intervals@10000', { boundaries: internal.boundaries.length, lookupReads, repeatBoundaryReads: comparisons, repeatCueReads: cueReads });
});

it('handles empty input, no-active spans and final infinite intervals', () => {
  const empty = new AvCueIndex([], 10);
  expect([-1, 0, 10, 100].map(time => empty.at(time))).to.deep.equal([-1, -1, -1, -1]);
  const answers = new AvCueIndex([{ cueId: 'a', start: 1, end: 2, text: '' }, { cueId: 'b', start: 4, text: '' }], 10);
  expect([0, 1, 2, 3, 4, 100, 0, 4].map(time => answers.at(time))).to.deep.equal([-1, 0, -1, -1, 1, 1, -1, 1]);
});
