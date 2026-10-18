export interface AggregateGroup {
  readonly label: string;
  readonly count: number;
  readonly summary: { min: number; q1: number; median: number; q3: number; max: number };
}

export interface ObservationAggregates {
  readonly sourceCount: number;
  readonly groups: readonly AggregateGroup[];
  readonly stages: readonly { label: string; value: number }[];
  readonly days: readonly { date: string; value: number }[];
}

/** Host-side fixture: complete, exact reductions over a bounded integer value domain.
 * No raw observation collection is assigned to or retained by a component. */
export async function aggregateMillionObservations() {
  const count = 1_000_000;
  const chunkSize = 10_000;
  const dates = Array.from({ length: 365 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10));
  const histograms = Array.from({ length: 4 }, () => new Map<number, number>());
  const groupCounts = [0, 0, 0, 0];
  const stageCounts = [0, 0, 0, 0];
  const dayCounts = Array<number>(365).fill(0);
  let sourceReads = 0;
  let maxChunkRecords = 0;
  const read = (index: number) => {
    sourceReads++;
    const tail = index === count - 1;
    return { index, group: index % 4, value: tail ? 10_000 : index % 101, day: tail ? 364 : index % 365, tail };
  };
  const snapshot = (): ObservationAggregates => ({
    sourceCount: sourceReads,
    groups: histograms.map((histogram, index) => {
      const sorted = [...histogram].sort(([a], [b]) => a - b);
      const sampleCount = groupCounts[index]!;
      const quantile = (fraction: number): number => {
        const rank = Math.ceil(sampleCount * fraction);
        let cumulative = 0;
        for (const [value, frequency] of sorted) {
          cumulative += frequency;
          if (cumulative >= rank) return value;
        }
        throw new Error('Missing exact quantile rank');
      };
      return { label: `Group ${index}`, count: sampleCount, summary: {
        min: sorted[0]![0], q1: quantile(0.25), median: quantile(0.5), q3: quantile(0.75), max: sorted[sorted.length - 1]![0],
      } };
    }),
    stages: ['Visited', 'Registered', 'Activated', 'Converted'].map((label, index) => ({ label, value: stageCounts[index]! })),
    days: dates.map((date, index) => ({ date, value: dayCounts[index]! })),
  });
  let prefix: ObservationAggregates | undefined;
  for (let start = 0; start < count; start += chunkSize) {
    const end = Math.min(count, start + chunkSize);
    maxChunkRecords = Math.max(maxChunkRecords, end - start);
    for (let index = start; index < end; index++) {
      if (index === count - 1) prefix = snapshot();
      const observation = read(index);
      const histogram = histograms[observation.group]!;
      histogram.set(observation.value, (histogram.get(observation.value) ?? 0) + 1);
      groupCounts[observation.group]!++;
      stageCounts[0]!++;
      if (observation.index % 2 === 0 || observation.tail) stageCounts[1]!++;
      if (observation.index % 4 === 0 || observation.tail) stageCounts[2]!++;
      if (observation.index % 8 === 0 || observation.tail) stageCounts[3]!++;
      dayCounts[observation.day]!++;
    }
    if (end < count) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (!prefix) throw new Error('Missing prefix aggregate');
  return {
    prefix,
    complete: snapshot(),
    get sourceReads() { return sourceReads; },
    maxChunkRecords,
    histogramEntries: histograms.reduce((total, histogram) => total + histogram.size, 0),
    quantileMethod: 'Exact nearest-rank quantiles over complete integer-domain histograms',
  };
}
