/** Per-bucket English defaults, overridable the same "no i18n, but
 *  overridable via an options object" way `<lr-date-picker>`/
 *  `<lr-source-list>`'s `label-plural` already establish. */
export interface RecencyLabels {
  today?: string;
  yesterday?: string;
  previousWeek?: string;
  older?: string;
}

export interface GroupByRecencyOptions<T> {
  /** Extracts the timestamp to bucket `item` by. Defaults to assuming `item`
   *  itself *is* a `Date` — the simplest possible default for the common
   *  case of grouping a plain array of dates. A returned `number` is treated
   *  as a standard JS epoch-milliseconds value (`Date.prototype.getTime()`'s
   *  own unit) — not a microsecond-epoch `time` type some backends use; a
   *  caller bridging from such data converts in its own `getTimestamp`
   *  callback. */
  getTimestamp?: (item: T) => Date | number | string;
  /** The "current" instant bucket boundaries are computed relative to.
   *  Defaults to `new Date()`. Overridable for deterministic tests (and for
   *  a caller that wants to bucket relative to something other than the
   *  actual current instant, e.g. a fixed "as of" report time). */
  now?: Date;
  /** Overrides for one or more of the four bucket labels. Any label left
   *  unset keeps its English default. */
  labels?: RecencyLabels;
}

export interface RecencyBucket<T> {
  label: string;
  items: T[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_LABELS: Required<RecencyLabels> = {
  today: 'Today',
  yesterday: 'Yesterday',
  previousWeek: 'Previous 7 Days',
  older: 'Older',
};

/** Midnight (start of the local calendar day) for `d`, as epoch millis —
 *  built from `d`'s own local-timezone Y/M/D fields, so this is a calendar-
 *  day boundary, not a rolling 24-hour offset from `d` itself. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Buckets `items` into Today / Yesterday / Previous 7 Days / Older, using
 * calendar-day boundaries in the local timezone — "yesterday" means the
 * previous calendar date, not "24-48 hours ago". Mirrors the bucketing a
 * chat sidebar's conversation-history list commonly groups by (this
 * library's own `<lr-conversation-item>` is the intended consumer, though
 * this function is deliberately DOM/component-free — plain data in, plain
 * data out).
 *
 * Only buckets that end up with at least one item are included in the
 * returned array, in Today/Yesterday/Previous-7-Days/Older order; each
 * bucket's items keep their original relative order from `items` (never
 * re-sorted). Two edge cases with no dedicated bucket of their own: a
 * timestamp dated in the future relative to `now` lands in `Today` — the
 * most-recent bucket available, since there's no "upcoming" bucket to put it
 * in instead. A timestamp that fails to parse lands in `Older` instead — it
 * carries no "this is recent" signal at all, so the oldest/catch-all bucket
 * is the more honest home for it than the newest one.
 */
export function groupByRecency<T>(items: T[], options: GroupByRecencyOptions<T> = {}): RecencyBucket<T>[] {
  const getTimestamp = options.getTimestamp ?? ((item: T) => item as unknown as Date);
  const now = options.now ?? new Date();
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  const todayStart = startOfLocalDay(now);

  const today: T[] = [];
  const yesterday: T[] = [];
  const previousWeek: T[] = [];
  const older: T[] = [];

  for (const item of items) {
    const raw = getTimestamp(item);
    const date = raw instanceof Date ? raw : new Date(raw);
    const time = date.getTime();

    // No meaningful "how recent" signal at all -- the catch-all bucket
    // surfaces it (so it's never silently dropped) without inventing a
    // "day 0" that a genuinely-invalid timestamp doesn't deserve.
    if (Number.isNaN(time)) {
      older.push(item);
      continue;
    }

    const dayDiff = Math.round((todayStart - startOfLocalDay(date)) / MS_PER_DAY);
    if (dayDiff <= 0) {
      // <= 0 (not === 0) also covers a timestamp dated in the future
      // relative to `now` -- there's no "upcoming" bucket, so it reads as
      // the most-recent bucket available rather than being dropped.
      today.push(item);
    } else if (dayDiff === 1) {
      yesterday.push(item);
    } else if (dayDiff <= 7) {
      previousWeek.push(item);
    } else {
      older.push(item);
    }
  }

  const buckets: RecencyBucket<T>[] = [];
  if (today.length) buckets.push({ label: labels.today, items: today });
  if (yesterday.length) buckets.push({ label: labels.yesterday, items: yesterday });
  if (previousWeek.length) buckets.push({ label: labels.previousWeek, items: previousWeek });
  if (older.length) buckets.push({ label: labels.older, items: older });
  return buckets;
}
