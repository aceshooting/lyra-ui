import { finiteRange } from '../../../internal/numbers.js';
import type { LyraAvCue } from './av-metadata.js';

interface CueBoundary {
  readonly time: number;
  readonly index: number;
  readonly start: number;
  readonly opening: boolean;
}

/** Answer intervals for the bounded, admitted legacy cue snapshot. Construction is O(N log N),
 * retention O(N), and lookup O(log N), or O(1) within the previous answer interval. */
export class AvCueIndex {
  private readonly boundaries: number[] = [-Infinity];
  private readonly winners: number[] = [-1];
  private cursor = 0;

  constructor(cues: readonly LyraAvCue[], duration: number) {
    const max = duration > 0 ? duration : Infinity;
    const starts = [...new Set(cues.map(cue => cue.start))].sort((a, b) => a - b);
    const nextStarts = new Map(starts.map((start, index) => [start, starts[index + 1] ?? Infinity]));
    const events: CueBoundary[] = [];
    cues.forEach((cue, index) => {
      const start = finiteRange(cue.start, 0, 0, max);
      const next = nextStarts.get(cue.start) ?? Infinity;
      const end = cue.end == null
        ? start >= max || next === Infinity ? Infinity : Math.min(next, max)
        : finiteRange(cue.end, start, start, max);
      if (!(end > start)) return;
      events.push({ time: start, index, start, opening: true });
      events.push({ time: end, index, start, opening: false });
    });
    events.sort((a, b) => a.time - b.time || Number(a.opening) - Number(b.opening));
    const live = new Set<number>();
    const heap: CueBoundary[] = [];
    const higher = (a: CueBoundary, b: CueBoundary): boolean => a.start > b.start || (a.start === b.start && a.index > b.index);
    const push = (event: CueBoundary): void => {
      let position = heap.length;
      heap.push(event);
      while (position > 0) {
        const parent = Math.floor((position - 1) / 2);
        if (!higher(event, heap[parent]!)) break;
        heap[position] = heap[parent]!;
        position = parent;
      }
      heap[position] = event;
    };
    const pop = (): void => {
      const last = heap.pop()!;
      if (heap.length === 0) return;
      let position = 0;
      while (position * 2 + 1 < heap.length) {
        let child = position * 2 + 1;
        if (child + 1 < heap.length && higher(heap[child + 1]!, heap[child]!)) child += 1;
        if (!higher(heap[child]!, last)) break;
        heap[position] = heap[child]!;
        position = child;
      }
      heap[position] = last;
    };
    for (let offset = 0; offset < events.length;) {
      const time = events[offset]!.time;
      do {
        const event = events[offset++]!;
        if (event.opening) { live.add(event.index); push(event); }
        else live.delete(event.index);
      } while (offset < events.length && events[offset]!.time === time);
      while (heap.length > 0 && !live.has(heap[0]!.index)) pop();
      const winner = heap[0]?.index ?? -1;
      if (winner !== this.winners[this.winners.length - 1]) {
        this.boundaries.push(time);
        this.winners.push(winner);
      }
    }
  }

  at(time: number): number {
    if (!Number.isFinite(time)) return -1;
    if (time >= this.boundaries[this.cursor]! && time < (this.boundaries[this.cursor + 1] ?? Infinity)) {
      return this.winners[this.cursor]!;
    }
    let low = 0;
    let high = this.boundaries.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.boundaries[middle]! <= time) low = middle + 1;
      else high = middle;
    }
    this.cursor = low - 1;
    return this.winners[this.cursor]!;
  }
}
