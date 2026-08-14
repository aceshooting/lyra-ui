/** Timestamp input shared by Lyra's original conversation surfaces. */
export type LyraTimestamp = Date | string | number;

/** Normalizes a supported timestamp through ECMAScript's Date/TimeClip domain. */
export function normalizeLyraTimestamp(value: LyraTimestamp | undefined): Date | undefined {
  if (value === undefined) return undefined;
  try {
    const epoch =
      typeof value === 'object'
        ? Date.prototype.getTime.call(value)
        : new Date(value).getTime();
    if (!Number.isFinite(epoch)) return undefined;
    const date = new Date(epoch);
    return Number.isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}
