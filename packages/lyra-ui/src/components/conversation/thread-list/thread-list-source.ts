import type { ReactiveControllerHost, TemplateResult } from 'lit';
import type { LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController, SOURCE_TEXT_UNIT_LIMIT, readOwnSourceField } from '../../../internal/source-page-controller.js';
import { normalizeLyraTimestamp, type LyraTimestamp } from '../timestamp.js';
import type { LyraVirtualListGroup, LyraVirtualListIndexedSource } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraChatThread, ThreadListGrouping } from './thread-list-types.js';
import {
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  getOwnDataDescriptor,
} from '../../../internal/data-descriptors.js';
import { isSafeNonArrayObject } from '../../../internal/object-guards.js';

export type ThreadListItem =
  | {
      kind: 'group';
      id: string;
      label: string;
      adornment?: TemplateResult;
      collapsed: boolean;
    }
  | { kind: 'thread'; thread: LyraChatThread };

export interface ThreadListModel {
  key: readonly unknown[];
  visible: readonly LyraChatThread[];
  items: ThreadListItem[];
  source?: LyraVirtualListIndexedSource;
  groups?: LyraVirtualListGroup[];
}

const canonicalThreadSnapshots = new WeakMap<
  readonly unknown[],
  readonly LyraChatThread[]
>();
const sourceThreadByProjection = new WeakMap<
  LyraChatThread,
  LyraChatThread
>();

function normalizeProjectedTimestamp(value: unknown): Date | undefined {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    (value === null || typeof value !== 'object')
  )
    return undefined;
  return normalizeLyraTimestamp(value as LyraTimestamp);
}

/** Projects the closed display schema once; render hooks receive only the original source identity. */
function projectThread(value: unknown): LyraChatThread | undefined {
  if (!isSafeNonArrayObject(value)) return undefined;
  const id = getOwnDataDescriptor(value, 'id');
  const title = getOwnDataDescriptor(value, 'title');
  const excerpt = getOwnDataDescriptor(value, 'excerpt');
  const timestamp = getOwnDataDescriptor(value, 'timestamp');
  const pinned = getOwnDataDescriptor(value, 'pinned');
  const archived = getOwnDataDescriptor(value, 'archived');
  if (
    id === MISSING_OWN_DATA_DESCRIPTOR ||
    id === UNSAFE_OWN_DATA_DESCRIPTOR ||
    title === MISSING_OWN_DATA_DESCRIPTOR ||
    title === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof id.value !== 'string' ||
    id.value.trim().length === 0 ||
    typeof title.value !== 'string'
  )
    return undefined;
  const thread = Object.freeze({
    id: id.value,
    title: title.value,
    excerpt:
      excerpt === MISSING_OWN_DATA_DESCRIPTOR ||
      excerpt === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof excerpt.value !== 'string'
        ? undefined
        : excerpt.value,
    timestamp:
      timestamp === MISSING_OWN_DATA_DESCRIPTOR ||
      timestamp === UNSAFE_OWN_DATA_DESCRIPTOR
        ? undefined
        : normalizeProjectedTimestamp(timestamp.value),
    pinned:
      pinned === MISSING_OWN_DATA_DESCRIPTOR ||
      pinned === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof pinned.value !== 'boolean'
        ? false
        : pinned.value,
    archived:
      archived === MISSING_OWN_DATA_DESCRIPTOR ||
      archived === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof archived.value !== 'boolean'
        ? false
        : archived.value,
  });
  sourceThreadByProjection.set(thread, value as typeof value & LyraChatThread);
  return thread;
}

export function canonicalThreads(values: readonly unknown[]): readonly LyraChatThread[] {
  const cached = canonicalThreadSnapshots.get(values);
  if (cached) return cached;
  const projected: LyraChatThread[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const thread = projectThread(value);
    if (!thread || seen.has(thread.id)) continue;
    seen.add(thread.id);
    projected.push(thread);
  }
  const snapshot = Object.freeze(projected);
  canonicalThreadSnapshots.set(values, snapshot);
  return snapshot;
}

export function sourceThread(thread: LyraChatThread): LyraChatThread {
  return sourceThreadByProjection.get(thread) ?? thread;
}

export class ThreadListPageController<Q extends { readonly grouping: ThreadListGrouping }>
  extends SourcePageController<LyraChatThread, Q> {
  private sourceResult?: LyraPageResult<LyraChatThread>;
  sourceRows: readonly LyraChatThread[] = [];
  private sourcePageModel?: ThreadListModel;
  readonly sourceRowIdentities = new WeakSet<LyraChatThread>();
  readonly sourceGroupIdentities = new WeakSet<Extract<ThreadListItem, { kind: 'group' }>>();

  constructor(host: HTMLElement & ReactiveControllerHost, onChange: () => void) {
    super(host, {
      normalizeRecord: (record, isCurrent) => this.projectSourceThread(record, isCurrent),
      validateMetadata: (result, query) => this.validateSourceGroups(result, query),
      onChange,
    });
  }

  clearPage(): void {
    this.sourceResult = undefined;
    this.sourceRows = [];
    this.sourcePageModel = undefined;
  }

  acceptPage(result: LyraPageResult<LyraChatThread>): boolean {
    if (result === this.sourceResult) return false;
    this.sourceResult = result;
    this.sourceRows = result.rows.map(record => record.value);
    this.sourcePageModel = undefined;
    return true;
  }

  private projectSourceThread(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<LyraChatThread> {
    const raw = record.value;
    if (!isSafeNonArrayObject(raw)) throw new TypeError('Invalid source thread');
    let units = 0;
    const snapshot: Record<string, unknown> = {};
    for (const key of ['id', 'title', 'excerpt', 'timestamp', 'pinned', 'archived']) {
      const field = readOwnSourceField(raw, key, isCurrent);
      snapshot[key] = field;
      if (typeof field === 'string') {
        units += field.length;
        if (units > SOURCE_TEXT_UNIT_LIMIT) throw new RangeError('Source thread text too large');
      }
    }
    const value = projectThread(snapshot);
    if (!value || value.id !== record.key) throw new TypeError('Invalid source thread identity');
    sourceThreadByProjection.set(value, raw as typeof raw & LyraChatThread);
    this.sourceRowIdentities.add(value);
    return { key: record.key, order: record.order, value };
  }

  private validateSourceGroups(result: LyraPageResult<LyraChatThread>, query: Q): void {
    if (query.grouping === 'none') {
      if (result.groups?.length) throw new TypeError('Unexpected source groups');
      return;
    }
    if (!result.groups) throw new TypeError('Missing source groups');
    if (!result.rows.length) return;
    const size = this.state.pageSize;
    const page = Math.min(this.state.page, Math.floor((result.total - 1) / size));
    const start = page * size;
    const end = start + result.rows.length;
    let covered = start;
    let previousEnd = -1;
    for (const group of result.groups) {
      const groupEnd = group.startIndex + group.itemCount;
      if (group.startIndex < previousEnd || Math.max(start, group.startIndex) !== covered) throw new TypeError('Invalid source group coverage');
      previousEnd = groupEnd;
      covered = Math.min(end, groupEnd);
    }
    if (covered !== end) throw new TypeError('Incomplete source groups');
  }

  model(
    collapsedGroupIds: readonly string[],
    sticky: boolean,
    anchors: (items: ThreadListItem[]) => LyraVirtualListGroup[],
  ): ThreadListModel {
    const key = [this.sourceResult, collapsedGroupIds, sticky];
    if (this.sourcePageModel && key.every((value, index) => value === this.sourcePageModel!.key[index])) return this.sourcePageModel;
    const items: ThreadListItem[] = [];
    const groups = this.sourceResult?.groups ?? [];
    if (!groups.length) items.push(...this.sourceRows.map((thread): ThreadListItem => ({ kind: 'thread', thread })));
    else {
      const collapsed = new Set(collapsedGroupIds);
      const start = this.state.page * this.state.pageSize;
      for (const group of groups) {
        const header: Extract<ThreadListItem, { kind: 'group' }> = { kind: 'group', id: group.key, label: group.label, collapsed: collapsed.has(group.key) };
        this.sourceGroupIdentities.add(header);
        items.push(header);
        if (!header.collapsed) {
          const from = Math.max(0, group.startIndex - start);
          const to = Math.min(this.sourceRows.length, group.startIndex + group.itemCount - start);
          for (let index = from; index < to; index++) items.push({ kind: 'thread', thread: this.sourceRows[index]! });
        }
      }
    }
    this.sourcePageModel = { key, visible: this.sourceRows, items, groups: sticky ? anchors(items) : undefined };
    return this.sourcePageModel;
  }
}
