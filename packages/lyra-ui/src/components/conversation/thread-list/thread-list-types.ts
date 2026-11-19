import type { LyraTimestamp } from '../timestamp.js';

export interface LyraChatThread {
  id: string;
  /** Required display/search text. Runtime records without a string title are omitted. */
  title: string;
  excerpt?: string;
  timestamp?: LyraTimestamp;
  pinned?: boolean;
  archived?: boolean;
}

export type ThreadListGrouping = 'date' | 'custom' | 'none';

export type ThreadBucketKey =
  | 'pinned'
  | 'today'
  | 'yesterday'
  | 'previous7'
  | 'previous30'
  | `month:${string}`
  | 'archived';
