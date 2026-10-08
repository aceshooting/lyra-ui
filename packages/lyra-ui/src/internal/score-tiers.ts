import { finiteNumber } from './numbers.js';

/** Shared score-tier thresholds for retrieval relevance and grounding confidence. */
export interface LyraScoreThresholds {
  readonly high: number;
  readonly medium: number;
}

/** Merges a partial threshold input over the defaults; non-finite values fall back and an inverted pair is reordered. */
export function resolveScoreTiers(
  defaults: LyraScoreThresholds,
  input: Partial<LyraScoreThresholds> | null | undefined
): LyraScoreThresholds {
  const high = finiteNumber(input?.high as number, defaults.high);
  const medium = finiteNumber(input?.medium as number, defaults.medium);
  return high >= medium ? { high, medium } : { high: medium, medium: high };
}
