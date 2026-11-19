import { localDate } from '../../../internal/calendar-date.js';
import { calendarDaysAgo } from '../../../internal/group-by-recency.js';
import { normalizeLyraTimestamp } from '../timestamp.js';
import type { LyraChatThread, ThreadBucketKey } from './thread-list-types.js';

export function bucketFor(thread: LyraChatThread, today: number): ThreadBucketKey {
  if (thread.archived) return 'archived';
  if (thread.pinned) return 'pinned';
  const ts = thread.timestamp === undefined
    ? undefined
    : normalizeLyraTimestamp(thread.timestamp);
  if (!ts) return 'previous30';
  const diffDays = calendarDaysAgo(today, ts);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'previous7';
  if (diffDays <= 30) return 'previous30';
  return `month:${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

export function dateForBucket(key: ThreadBucketKey): Date | undefined {
  if (!key.startsWith('month:')) return undefined;
  const separator = key.lastIndexOf('-');
  return localDate(Number(key.slice(6, separator)), Number(key.slice(separator + 1)) - 1);
}
