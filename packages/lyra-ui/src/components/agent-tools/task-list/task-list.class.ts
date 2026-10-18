import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchyView, LyraTaskSourceSummary } from '../../../data-sources.js';
import { HierarchySourceController, hierarchyField, hierarchyKey, hierarchyText } from '../../../internal/hierarchy-source-controller.js';
import { hierarchySourceView } from '../../../internal/hierarchy-source-view.js';
import { hierarchySourceStyles } from '../../../internal/hierarchy-source-view.styles.js';
import { readOwnDataValue } from '../../../internal/data-descriptors.js';
import { finiteCount } from '../../../internal/numbers.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import {
  html,
  svg,
  nothing,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
} from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { chevronIcon } from '../../../internal/icons.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './task-list.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_taskListCompletedOfTotal, LYRA_DEFAULT_taskListLabel, LYRA_DEFAULT_taskListLimit, LYRA_DEFAULT_taskListStepCompletedAnnounce, LYRA_DEFAULT_taskListStepFailedAnnounce, LYRA_DEFAULT_taskListStepIncompleteAnnounce, LYRA_DEFAULT_taskListStepStartedAnnounce } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_expand, LYRA_DEFAULT_item, LYRA_DEFAULT_items, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusIncomplete, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_treeNodeMoved, LYRA_DEFAULT_treeSourceError, LYRA_DEFAULT_treeSourceSummary } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** A plan step's lifecycle state — not permission-gated, so there is no `denied` state here
 *  (unlike `<lr-tool-call-chip>`'s status vocabulary, which does need one). `incomplete` is a step
 *  that stopped without finishing (a cancelled run): neither a success nor a failure. */
export type TaskStatus = 'pending' | 'running' | 'success' | 'error' | 'incomplete';

function normalizeTaskStatus(value: unknown): TaskStatus {
  return value === 'running' || value === 'success' || value === 'error' || value === 'incomplete'
    ? value
    : 'pending';
}

const DEEP_NESTING_WARNING_KEY = 'lyra-task-list-nesting-depth';
const DEEP_NESTING_WARNING = '<lr-task-list>: task nesting deeper than one level is ignored.';

/** Default ceiling on tasks, including direct children, actually mounted into the DOM, matching the shared cap this family's
 *  other bounded lists use (`trace-tree`/`span-waterfall`'s `MAX_RENDERED_LYRA_SPANS`,
 *  `subagent-panel`'s `MAX_RENDERED_RUNS`). `total`/`completed` in the header summary still count
 *  every item in `items`, not just the rendered subset -- only the row DOM is capped. Reorder
 *  index math is unaffected: it reads sibling order from `items`/`item.children` directly, never
 *  from what is actually rendered. */
const MAX_RENDERED_TASKS = 500;

const canonicalTaskArrays = new WeakSet<object>();

function validTaskItems(value: unknown): TaskItem[] {
  if (value && typeof value === 'object' && canonicalTaskArrays.has(value)) return value as TaskItem[];
  const items: TaskItem[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    try {
      if (
        item !== null
        && typeof item === 'object'
        && !Array.isArray(item)
        && typeof item.id === 'string'
        && item.id.trim().length > 0
      ) {
        items.push(item);
      }
    } catch {
      // A malformed row cannot suppress later valid tasks.
    }
  }
  return items;
}

interface TaskProjection {
  source: readonly TaskItem[];
  items: TaskItem[];
  flat: TaskItem[];
  valid: boolean;
  unique: boolean;
  completed: number;
  deep: boolean;
  truncated: boolean;
}

function isTaskArray(value: unknown): value is unknown[] {
  try { return Array.isArray(value); } catch { return false; }
}

function isTaskRecord(value: unknown): value is object {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  catch { return false; }
}

function taskArrayLength(values: object): number {
  const value = readOwnDataValue(values, 'length');
  return finiteCount(typeof value === 'number' ? value : 0, 0);
}

/** Copy only the display schema; opaque source metadata never spends the display budget. */
function projectTaskItems(source: readonly TaskItem[]): TaskProjection {
  let childBudget = 10_000;
  let valid = true;
  let deep = false;
  let truncated = false;
  const copy = (values: unknown, depth: number): TaskItem[] => {
    const result: TaskItem[] = [];
    try {
      if (!isTaskArray(values)) return result;
      const length = taskArrayLength(values);
      const count = Math.min(length, depth === 0 ? 10_000 : childBudget);
      if (count < length) { truncated = true; valid = false; }
      if (depth > 0) childBudget -= count;
      for (let index = 0; index < count; index++) {
        const value = readOwnDataValue(values, String(index));
        if (!isTaskRecord(value)) { valid = false; continue; }
        const id = readOwnDataValue(value, 'id');
        if (typeof id !== 'string' || !id.trim()) { valid = false; continue; }
        const label = readOwnDataValue(value, 'label');
        const detail = readOwnDataValue(value, 'detail');
        const children = readOwnDataValue(value, 'children');
        if (depth > 0 && isTaskArray(children) && taskArrayLength(children) > 0) deep = true;
        const item: TaskItem = {
          id,
          label: typeof label === 'string' ? label : '',
          status: normalizeTaskStatus(readOwnDataValue(value, 'status')),
          ...(typeof detail === 'string' ? { detail } : {}),
          ...(depth === 0 && isTaskArray(children) ? { children: copy(children, 1) } : {}),
        };
        result.push(Object.freeze(item));
      }
    } catch { valid = false; }
    canonicalTaskArrays.add(result);
    Object.freeze(result);
    return result;
  };
  const items = copy(source, 0);
  const flat: TaskItem[] = [];
  let completed = 0;
  let unique = true;
  const ids = new Set<string>();
  for (const item of items) {
    if (item.status === 'success') completed++;
    flat.push(item, ...(item.children ?? []));
  }
  for (const item of flat) {
    if (ids.has(item.id)) unique = false;
    ids.add(item.id);
  }
  return { source, items, flat, valid, unique, completed, deep, truncated };
}

/** Visual chrome for `<lr-task-list>`'s root — the library's shared container-frame vocabulary. */
export type TaskListAppearance = LyraFrame;

export interface TaskItem {
  /** Unique among every top-level task and direct child while `reorderable`; duplicated data stays
   *  visible but fails closed for reorder requests. */
  id: string;
  label: string;
  status: TaskStatus;
  /** Optional secondary plain-text line, e.g. an error message or a short progress note. */
  detail?: string;
  /** One level of sub-steps. Deeper nesting (a child's own `children`) is ignored. */
  children?: readonly TaskItem[];
}

/** Complete two-level provider preorder with a global top-level task summary. */
export type TaskListSource = LyraHierarchySource<TaskItem, LyraHierarchyQuery, LyraTaskSourceSummary>;
const SOURCE_QUERY: LyraHierarchyQuery = Object.freeze({ search: '', hiddenKinds: Object.freeze([]) });

export interface TaskListToggleDetail {
  expanded: boolean;
}

export interface LyraTaskListEventMap {
  'lr-toggle-request': CustomEvent<TaskListToggleDetail>;
  'lr-toggle': CustomEvent<TaskListToggleDetail>;
  'lr-reorder': CustomEvent<{
    taskId: string;
    parentTaskId: string | null;
    fromIndex: number;
    toIndex: number;
  }>;
}

interface PendingTaskReorder {
  id: string;
  parentId: string | null;
  originalSiblingIds: string[];
  targetSiblingId: string;
  fromIndex: number;
  toIndex: number;
}

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts) without adding
// task-list-specific glyphs there -- duplicated locally, matching lr-tool-call-chip's own
// STATUS_ICON set (minus its 'denied' glyph, which has no TaskStatus
// counterpart).
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

function pendingIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>`);
}

function runningIcon(): SVGTemplateResult {
  return icon(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

function successIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline>`);
}

function errorIcon(): SVGTemplateResult {
  return icon(svg`
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="9" y1="9" x2="15" y2="15"></line>
    <line x1="15" y1="9" x2="9" y2="15"></line>
  `);
}

/** A circle with a level dash: stopped short, neither succeeded nor failed. */
function incompleteIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><line x1="8" y1="12" x2="16" y2="12"></line>`);
}

const STATUS_ICON: Record<TaskStatus, () => SVGTemplateResult> = {
  pending: pendingIcon,
  running: runningIcon,
  success: successIcon,
  error: errorIcon,
  incomplete: incompleteIcon,
};

const STATUS_LABEL_KEY: Record<TaskStatus, string> = {
  pending: 'statusPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusError',
  incomplete: 'statusIncomplete',
};

/**
 * `<lr-task-list>` — a live, collapsible tracker for an agent's plan: ordered steps with
 * per-step lifecycle status and one level of nested sub-steps, embedded in the transcript.
 * `items` is controlled and never mutated by this component, mirroring `<lr-stepper>`'s `steps`
 * contract. Unlike stepper's single-`current` navigation control, task-list has no selection and
 * several steps may be `running` at once. Set `reorderable` to request sibling-scoped keyboard
 * moves; the host applies the reordered `items` array. Non-record rows and rows without a nonempty
 * string id are omitted. Reordering additionally requires globally unique ids among every retained
 * top-level task and direct child; duplicate data stays visible but fails closed.
 * The visible header is not a document heading by default (`heading-level="none"`); set
 * `heading-level` from `1`–`6` to expose it at that level in the surrounding document outline.
 * Status changes and confirmed moves are announced through an internal `<lr-live-region>`.
 *
 * The outer items array is an identity-kept readonly snapshot of at most 10,000 entries.
 * Display fields are copied without invoking accessors; direct child input positions share a
 * 10,000-entry projection budget, independent of opaque provider metadata. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * By default, only the first 500 tasks, including direct children, are mounted into the DOM (matching the render ceiling this
 * family's other bounded lists use); the header's "N of M completed" summary still counts every
 * item in `items`, and reorder index math still reads full sibling order from `items` regardless
 * of what is actually rendered.
 *
 * Defined treeSource uses complete provider preorder, limited to top-level tasks and direct
 * children. Its required summary counts top-level tasks independently of visible rows. Source
 * mode supports navigation and expansion, not selection or legacy full-model reorder.
 * @csspart source-list - Bounded provider viewport.
 * @csspart source-row - Provider task tree item and focus owner.
 * @csspart source-label - Task presentation.
 * @csspart source-toggle - Provider expansion/retry control.
 * @csspart source-status - Localized provider state.
 * @csspart source-error - Localized provider failure.
 * @customElement lr-task-list
 * @slot detail-<id> - Dynamic, one per item id (e.g. `slot="detail-step-3"`). Rich detail under
 *   that item's label, after its `detail` text -- typically a `<lr-tool-call-chip>` or file
 *   `<lr-chip>`. Plain-HTML friendly, no render props.
 * @event lr-toggle-request - Cancelable proposal before a header activation changes the panel.
 *   `detail: { expanded }` is the requested state.
 * @event lr-toggle - The header was activated, expanding or collapsing the panel. `detail: {
 *   expanded }`.
 * @event lr-reorder - `detail: { taskId, parentTaskId, fromIndex, toIndex }` —
 *   Ctrl/Cmd+ArrowUp/ArrowDown requests moving the focused task within its own sibling list
 *   (`parentTaskId` is `null` for a
 *   top-level task; indices are sibling-scoped). Only fired while `reorderable` with unique ids;
 *   a boundary key never reparents. A move is announced only after the rendered order confirms it.
 * @csspart base - The outer container.
 * @csspart header - The visible header content (a `<button>` unless `without-collapse` is set, a
 *   plain wrapper otherwise), inside the configurable semantic heading.
 * @csspart label - The `heading` text.
 * @csspart summary - The visible "N of M completed" summary, counting only top-level items.
 * @csspart toggle - The chevron indicator inside the header. Not rendered while `without-collapse`.
 * @csspart body - The list of items, `hidden` while collapsed.
 * @csspart item - One item row (`role="listitem"`); carries `data-status`, `data-id`,
 *   `data-depth` (`"0"` for a top-level item, `"1"` for a child), and is keyboard-focusable only
 *   for valid `reorderable` data.
 * @csspart status-icon - The per-item status glyph.
 * @csspart item-label - The item's `label` text.
 * @csspart item-detail - The item's optional `detail` text.
 * @csspart item-children - The nested `role="list"` wrapper around a top-level item's children.
 * @csspart limit - Visible notice when the plan exceeds the shared render cap.
 * @cssprop [--lr-task-list-spin=var(--lr-transition-ambient)] - Running-status icon spin
 *   animation duration/timing.
 * @cssprop [--lr-task-list-compact-header-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="header"]` padding while `size` is `s` or smaller.
 * @cssprop [--lr-task-list-compact-header-gap=var(--lr-space-2xs)] - Gap between `[part="header"]`'s
 *   toggle/label/summary while `size` is `s` or smaller.
 * @cssprop [--lr-task-list-compact-header-font-size=var(--lr-font-size-sm)] - `[part="header"]`
 *   font size while `size` is `s` or smaller.
 * @cssprop [--lr-task-list-compact-gap=var(--lr-space-2xs)] - Gap between `[part="body"]`'s item
 *   rows while `size` is `s` or smaller.
 * @cssprop [--lr-task-list-compact-body-padding=var(--lr-space-2xs) var(--lr-space-s) var(--lr-space-s)] -
 *   `[part="body"]` padding while `size` is `s` or smaller.
 * @cssprop [--lr-task-list-pending-color=var(--lr-color-text-quiet)] - Pending status icon color.
 * @cssprop [--lr-task-list-running-color=var(--lr-color-brand)] - Running status icon color.
 * @cssprop [--lr-task-list-success-color=var(--lr-color-success)] - Success status icon color.
 * @cssprop [--lr-task-list-error-color=var(--lr-color-danger)] - Error status icon color.
 * @cssprop [--lr-task-list-incomplete-color=var(--lr-color-text-quiet)] - Incomplete status icon color.
 * @cssprop [--lr-task-list-bg=var(--lr-color-surface)] - Fill of the outer card
 *   (`[part="base"]`) while `frame="card"`. `frame="plain"` still removes the fill entirely.
 * @cssprop [--lr-task-list-border-color=var(--lr-color-border)] - Colour of the outer card's
 *   border and of the header/body divider, which `frame="plain"` keeps.
 * @cssprop [--lr-task-list-radius=var(--lr-radius)] - Corner radius of the outer card.
 *   `frame="plain"` still squares the corners.
 * @status stable
 * @since 4.0.0
 */
export class LyraTaskList extends LyraElement<LyraTaskListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    expand: LYRA_DEFAULT_expand,
    item: LYRA_DEFAULT_item,
    items: LYRA_DEFAULT_items,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    statusIncomplete: LYRA_DEFAULT_statusIncomplete,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    taskListCompletedOfTotal: LYRA_DEFAULT_taskListCompletedOfTotal,
    taskListLabel: LYRA_DEFAULT_taskListLabel,
    taskListLimit: LYRA_DEFAULT_taskListLimit,
    taskListStepCompletedAnnounce: LYRA_DEFAULT_taskListStepCompletedAnnounce,
    taskListStepFailedAnnounce: LYRA_DEFAULT_taskListStepFailedAnnounce,
    taskListStepIncompleteAnnounce: LYRA_DEFAULT_taskListStepIncompleteAnnounce,
    taskListStepStartedAnnounce: LYRA_DEFAULT_taskListStepStartedAnnounce,
    treeNodeMoved: LYRA_DEFAULT_treeNodeMoved,
    treeSourceError: LYRA_DEFAULT_treeSourceError,
    treeSourceSummary: LYRA_DEFAULT_treeSourceSummary,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['items']);
  protected static override readonly identityCollectionProperties = Object.freeze(['items']);

  static override styles = [LyraElement.styles, srOnly, hierarchySourceStyles, styles];

  private _treeSource: TaskListSource | undefined = undefined;
  private sourceVersion = 0;
  private sourcePaintVersion = 0;
  private sourceWrapper?: LyraHierarchySource<TaskItem, LyraHierarchyQuery>;
  private readonly sourceSummaries = new WeakMap<object, Readonly<LyraTaskSourceSummary> & { readonly current: () => boolean }>();
  private sourceAnnouncement?: string;
  private readonly sourceControl = new HierarchySourceController<TaskItem>(this, {
    normalize: (value, key) => this.normalizeSourceTask(value, key),
    payload: { maxUnits: 2_000_000, maxRowUnits: 65_536,
      unitsOf: item => item.id.length + item.label.length + (item.detail?.length ?? 0) },
    onChange: () => { const old = this.sourcePaintVersion++; this.requestUpdate('sourcePaintVersion', old); },
    accepted: () => {},

  });

  /** Immutable provider preorder; defined sources win over items, even when invalid.
   * Four 100-row pages and one focused row are retained; at most 301 rows mount.
   * Provider metadata owns topology and selection, and summary counts all top-level tasks. Source mode disables legacy reorder.
   * Reassign or requestUpdate() after changing revision. Unset restores legacy items.
   * @default undefined */
  @property({ attribute: false })
  get treeSource(): TaskListSource | undefined { return this._treeSource; }
  set treeSource(value: TaskListSource | undefined) {
    const previous = this._treeSource;
    this._treeSource = value;
    this.sourceVersion++;
    this.clearPendingReorder();
    this.previousStatusById.clear();
    this.sourceWrapper = value === undefined ? undefined : this.wrapSource(value);
    this.syncSource(true);
    this.requestUpdate('treeSource', previous);
  }

  /** Reveal and focus a full-source key; false when absent, disabled or superseded. */
  revealSourceKey(key: string): Promise<boolean> {
    return this.treeSource === undefined ? Promise.resolve(false) : this.sourceControl.reveal(key);
  }

  private syncSource(force = false): void {
    this.sourceControl?.update(this.sourceWrapper, this.effectiveLocale, force,
      SOURCE_QUERY);
  }

  private wrapSource(source: TaskListSource): LyraHierarchySource<TaskItem, LyraHierarchyQuery> {
    const host = this;
    return {
      get revision() { return source.revision; },
      async project(request) {
        const version = host.sourceVersion;
        const owner = host.ownerDocument;
        const owned = () => host._treeSource === source && host.sourceVersion === version &&
          host.ownerDocument === owner && host.isConnected && !request.signal.aborted;
        const current = () => {
          if (!owned()) return false;
          const revision = source.revision;
          return owned() && revision === request.revision;
        };
        const check = () => { if (!current()) throw new Error('Task source changed'); };
        check();
        const project = source.project;
        check();
        const result = await project.call(source, request);
        check();
        const summary = result.summary;
        check();
        const taskTotal = hierarchyField(summary, 'total');
        check();
        const completed = hierarchyField(summary, 'completed');
        check();
        if (typeof taskTotal !== 'number' || typeof completed !== 'number' || !Number.isSafeInteger(taskTotal) ||
          !Number.isSafeInteger(completed) || taskTotal < 0 || completed < 0 || completed > taskTotal)
          throw new TypeError('Invalid task summary');
        const validateRow = (value: unknown): LyraHierarchyRow<TaskItem> => {
          const copy: Record<string, unknown> = {};
          for (const name of ['key', 'parentKey', 'level', 'position', 'setSize', 'childCount', 'expanded', 'selected', 'disabled', 'selectionState', 'value']) {
            check(); copy[name] = hierarchyField(value, name); check();
          }
          const { level, parentKey, childCount } = copy;
          if (!((level === 1 && parentKey === null) || (level === 2 && typeof parentKey === 'string' && parentKey.length > 0 && childCount === 0)))
            throw new TypeError('Invalid task depth');
          return Object.freeze(copy) as unknown as LyraHierarchyRow<TaskItem>;
        };
        const view = result.rows;
        check();
        const count = view.count;
        check();
        const hasItemAt = 'itemAt' in view;
        check();
        const itemAt = hasItemAt ? (view as { itemAt?: unknown }).itemAt : undefined;
        check();
        let wrapped: LyraHierarchyView<LyraHierarchyRow<TaskItem>>;
        if (typeof itemAt === 'function') {
          const indexed = view as Extract<typeof view, { itemAt: unknown }>;
          wrapped = { count,
            itemAt(index) { check(); const method = indexed.itemAt; check(); const value = method.call(indexed, index); check(); return validateRow(value); },
            keyAt(index) { check(); const method = indexed.keyAt; check(); const value = method.call(indexed, index); check(); return value; },
            indexOfKey(key: string | number) { check(); const method = indexed.indexOfKey; check(); const value = method.call(indexed, key); check(); return value; },
          };
        } else {
          const ranged = view as Extract<typeof view, { read: unknown }>;
          wrapped = { count,
            async read(range) {
              const active = () => { check(); if (range.signal.aborted) throw new Error('Task range changed'); };
              active(); const method = ranged.read; active();
              const value = await method.call(ranged, range); active();
              const length = hierarchyField(value, 'length'); active();
              if (!Array.isArray(value) || typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > range.limit)
                throw new TypeError('Invalid task range');
              const rows: LyraHierarchyRow<TaskItem>[] = [];
              for (let index = 0; index < length; index++) {
                active(); const row = hierarchyField(value, String(index)); active(); rows.push(validateRow(row));
              }
              active(); return rows;
            },
            async indexOfKey(key: string, context) {
              const active = () => { check(); if (context.signal.aborted) throw new Error('Task navigation changed'); };
              active(); const method = ranged.indexOfKey; active();
              const value = await method.call(ranged, key, context); active(); return value;
            },
          };
        }
        const state = result.state;
        check();
        const total = result.total;
        check();
        if (typeof total !== 'number' || taskTotal > total) throw new TypeError('Invalid task summary total');
        const focusIndex = result.focusIndex;
        check();
        host.sourceSummaries.set(wrapped, Object.freeze({ total: taskTotal, completed, current }));
        return { state, total, rows: wrapped, ...(focusIndex === undefined ? {} : { focusIndex }) };
      },
    };
  }

  private normalizeSourceTask(value: unknown, key: string): TaskItem {
    const source = this.treeSource;
    const version = this.sourceVersion;
    const owner = this.ownerDocument;
    const control = this.sourceControl;
    const epoch = control.epoch;
    const projection = control.projection;
    const owned = () => this.isConnected && this.ownerDocument === owner && this.treeSource === source &&
      this.sourceVersion === version && this.sourceControl === control && control.epoch === epoch && control.projection === projection && !control.loading;
    const accepted = projection ? this.sourceSummaries.get(projection.rows) : undefined;
    const current = () => owned() && Boolean(accepted?.current()) && owned();
    const field = (name: string) => {
      if (!current()) throw new Error('Task source changed');
      const result = hierarchyField(value, name);
      if (!current()) throw new Error('Task source changed');
      return result;
    };
    const id = hierarchyKey(field('id'));
    if (id !== key) throw new TypeError('Task key mismatch');
    const label = hierarchyText(field('label'));
    const status = normalizeTaskStatus(field('status'));
    const detail = field('detail');
    return Object.freeze({ id, label, status, ...(detail === undefined ? {} : { detail: hierarchyText(detail) }) });
  }



  /** The plan. Controlled and never mutated by this component -- pass a new array to update it.
   *  Runtime non-record rows and rows without a nonempty string id are omitted before rendering,
   *  summaries, announcements, and reorder validation. */
  @property({ attribute: false }) items: readonly TaskItem[] = [];

  /** Maximum rendered tasks including direct children; bounded to 1–5,000, default 500. */
  @property({ type: Number, attribute: 'max-nodes' }) maxNodes = 500;

  private taskProjection?: TaskProjection;
  private renderedProjection?: { model: TaskProjection; limit: number; items: TaskItem[]; truncated: boolean };
  private get effectiveMaxNodes(): number { return Math.max(1, Math.min(5_000, finiteCount(this.maxNodes, MAX_RENDERED_TASKS))); }
  private taskModel(): TaskProjection {
    if (this.taskProjection?.source !== this.items) this.taskProjection = projectTaskItems(this.items);
    return this.taskProjection!;
  }
  private visibleTaskItems(): TaskItem[] {
    const model = this.taskModel();
    const limit = this.effectiveMaxNodes;
    if (this.renderedProjection?.model !== model || this.renderedProjection.limit !== limit) {
      const items = this.renderedTaskItems(model.items);
      this.renderedProjection = { model, limit, items, truncated: this.renderedTasksTruncated };
    }
    this.renderedTasksTruncated = this.renderedProjection.truncated || model.truncated || !!publicCollectionTruncation(this, 'items');
    return this.renderedProjection.items;
  }
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (this._treeSource !== undefined && args[0] === undefined) { this.sourceVersion++; this.syncSource(true); }
    if (this._treeSource === undefined && args[0] === 'items' && this.taskProjection?.source !== this.items) {
      this.taskProjection = undefined;
      this.taskModel();
    }
    super.requestUpdate(...args);
  }

  private sourceSummary(): string {
    const projection = this.sourceControl.projection;
    return projection ? this.localize('treeSourceSummary', undefined, {
      visible: getNumberFormat(this.effectiveLocale).format(projection.rows.count),
      total: getNumberFormat(this.effectiveLocale).format(projection.total),
    }) : '';
  }

  private updateSourceEffects(): void {
    const source = this.treeSource;
    const binding = this.sourceWrapper;
    const version = this.sourceVersion;
    const epoch = this.sourceControl.epoch;
    const owner = this.ownerDocument;
    const projection = this.sourceControl.projection;
    const { error, loading, rowError, rowsObserved } = this.sourceControl;
    const bound = () => this.isConnected && this.ownerDocument === owner && this.treeSource === source &&
      this.sourceWrapper === binding && this.sourceVersion === version && this.sourceControl.epoch === epoch;
    const current = () => bound() && this.sourceControl.projection === projection &&
      this.sourceControl.error === error && this.sourceControl.loading === loading &&
      this.sourceControl.rowError === rowError && this.sourceControl.rowsObserved === rowsObserved;
    if (!current()) return;
    const status = error ? this.localize('treeSourceError') : loading ? this.localize('loading') : this.sourceSummary();
    if (!current()) return;
    if (this.sourceAnnouncement !== undefined && status !== this.sourceAnnouncement) {
      this.limitAnnouncements.announcePolite(status);
      if (!current()) return;
    }
    if (rowsObserved) {
      const message = rowError ? this.localize('treeSourceError') : '';
      if (!current()) return;
      this.limitAnnouncements.transition('source-rows', rowError ? 'error' : 'ready', message);
      if (!current()) return;
    }
    this.sourceAnnouncement = status;
  }

  /** Opts into Ctrl/Cmd+ArrowUp/ArrowDown reorder requests. `items` remains host-owned: the
   *  component never moves a task until the host reassigns a confirmed sibling order. All ids
   *  across top-level tasks and direct children must be unique; otherwise the feature fails closed
   *  with no row tab stops or `lr-reorder` requests. */
  @property({ type: Boolean, reflect: true }) reorderable = false;

  /** Optional visible section title. Omission localizes `taskListLabel`; any supplied string,
   *  including `'Tasks'` or `''`, is rendered verbatim. */
  @property() heading?: string;

  /** Semantic level of the visible header. Use `none` to keep the visual header without exposing
   *  it to heading navigation. Invalid untyped values use level 3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraHeadingLevel = 'none';

  /** Hides the body (item list). The list starts shown -- this is a progress surface, not a
   *  details disclosure a reader opts into. */
  @property({ type: Boolean, reflect: true }) collapsed = false;

  /** Renders the header as a static heading (no button, no toggle affordance); `collapsed` can
   *  still be set programmatically by the host, just not toggled via the UI. */
  @property({ type: Boolean, attribute: 'without-collapse' }) withoutCollapse = false;

  /**
   * Density on the shared size scale. `s` (and the smaller `xs`/`2xs`) tightens the header/body
   * padding and item gap for dense contexts (a plan tracker nested in an already-padded transcript
   * row) -- same convention as `lr-agent-run`'s `size`. `m` (the default) and larger keep the full
   * padding. Purely a density knob: the border and background stay, so use `frame="plain"` instead
   * to drop the chrome entirely.
   */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled box. `'plain'` removes `[part="base"]`'s border, background, and
   *  corner radius, so a list embedded in the transcript inside a container that already draws a
   *  border (an agent-run panel, a message bubble) doesn't double it. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private readonly headerId = nextId('task-list-header');
  private readonly bodyId = nextId('task-list-body');

  /** `true` until the first completed update -- gates the status-change announcements below so a
   *  freshly-mounted list never announces whatever statuses its very first `items` happens to
   *  carry (mirrors `<lr-chat-message>`'s identical `isMounting` gate for its own status-change
   *  announcement). */
  private isMounting = true;
  private readonly limitAnnouncements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private previouslyTruncated = false;
  private renderedTasksTruncated = false;

  /** Last-seen status per item id, one level deep (top-level items plus their direct children) --
   *  diffed against the incoming `items` on every update to decide what to announce. */
  private previousStatusById = new Map<string, TaskStatus>();
  private pendingReorder?: PendingTaskReorder;
  private pendingFocusId: string | null = null;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.treeSource !== undefined) { this.clearPendingReorder(); return; }
    if (changed.has('reorderable') && !this.reorderable) this.clearPendingReorder();
    if (changed.has('items')) {
      if (this.taskModel().deep) devWarnOnce(DEEP_NESTING_WARNING_KEY, DEEP_NESTING_WARNING);
      this.capturePendingReorderFocus();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const wasMounting = this.isMounting || !this.isConnected;
    this.isMounting = !this.isConnected;
    if (this.treeSource !== undefined) { this.updateSourceEffects(); return; }
    if (changed.has('items')) {
      this.diffAndAnnounce(wasMounting);
      this.confirmPendingReorder();
    }
    if (!wasMounting && this.renderedTasksTruncated && !this.previouslyTruncated) {
      this.limitAnnouncements.announcePolite(this.localize('taskListLimit', undefined, {
        count: getNumberFormat(this.effectiveLocale).format(this.effectiveMaxNodes),
      }));
    }
    this.previouslyTruncated = this.renderedTasksTruncated;
  }

  override disconnectedCallback(): void {
    this.sourceVersion++;
    this.sourceAnnouncement = undefined;
    super.disconnectedCallback();
    this.isMounting = true;
    this.previousStatusById.clear();
    this.clearPendingReorder();
  }

  override connectedCallback(): void {
    const reconnecting = this.hasUpdated;
    this.isMounting = true;
    this.previousStatusById.clear();
    super.connectedCallback();
    if (reconnecting) this.requestUpdate('items');
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.limitAnnouncements.adopted();
    this.sourceVersion++;
    this.sourceAnnouncement = undefined;
    this.sourceControl.adopted();
    this.syncSource(true);
  }

  private renderedTaskItems(items: readonly TaskItem[]): TaskItem[] {
    const rendered: TaskItem[] = [];
    let remaining = this.effectiveMaxNodes;
    let truncated = false;
    for (const item of items) {
      if (remaining === 0) { truncated = true; break; }
      remaining--;
      const children = validTaskItems(item.children);
      const visibleChildren = children.slice(0, remaining);
      canonicalTaskArrays.add(visibleChildren);
      remaining -= visibleChildren.length;
      if (visibleChildren.length < children.length) truncated = true;
      rendered.push(visibleChildren.length === children.length ? item : { ...item, children: visibleChildren });
    }
    this.renderedTasksTruncated = truncated;
    return rendered;
  }

  private diffAndAnnounce(firstSight: boolean): void {
    const region = this.liveRegion;
    const nextMap = new Map<string, TaskStatus>();
    for (const item of this.taskModel().flat) {
      const status = normalizeTaskStatus(item.status);
      nextMap.set(item.id, status);
      if (!firstSight && region) {
        const previous = this.previousStatusById.get(item.id);
        if (previous !== undefined && previous !== status) {
          // Every branch forces an immediate flush -- these are discrete lifecycle transitions
          // (a step starting/finishing), not a high-frequency stream where throttling matters, and
          // a caller updating `items` in a synchronous batch expects the *latest* transition heard
          // right away rather than coalesced behind the announcer's default throttle window.
          if (status === 'running') {
            region.mode = 'polite';
            region.announce(this.localize('taskListStepStartedAnnounce', undefined, { label: item.label }), {
              force: true,
            });
          } else if (status === 'success') {
            region.mode = 'polite';
            region.announce(this.localize('taskListStepCompletedAnnounce', undefined, { label: item.label }), {
              force: true,
            });
          } else if (status === 'error') {
            region.mode = 'assertive';
            region.announce(this.localize('taskListStepFailedAnnounce', undefined, { label: item.label }), {
              force: true,
            });
          } else if (status === 'incomplete') {
            region.mode = 'polite';
            region.announce(
              this.localize('taskListStepIncompleteAnnounce', undefined, {
                label: item.label,
                status: this.localize('statusIncomplete'),
              }),
              { force: true },
            );
          }
        }
      }
    }
    this.previousStatusById = nextMap;
  }

  private toggle = (): void => {
    if (this.withoutCollapse) return;
    const expanded = this.collapsed;
    const version = this.sourceVersion;
    const owner = this.ownerDocument;
    if (this.emit('lr-toggle-request', { expanded }, { cancelable: true }).defaultPrevented) return;
    if (!this.isConnected || this.ownerDocument !== owner || this.sourceVersion !== version || this.withoutCollapse || this.collapsed !== expanded) return;
    this.collapsed = !expanded;
    this.emit('lr-toggle', { expanded });
  };

  private idsAreUnique(): boolean { return this.taskModel().unique; }

  private canReorderItems(): boolean {
    if (this.treeSource !== undefined) return false;
    const model = this.taskModel();
    return this.reorderable && model.valid && model.unique;
  }

  private siblingItems(parentId: string | null): readonly TaskItem[] | undefined {
    if (parentId === null) return this.taskModel().items;
    return this.taskModel().items.find((item) => item.id === parentId)?.children;
  }

  private requestReorder(item: TaskItem, parentId: string | null, delta: 1 | -1): void {
    if (!this.canReorderItems()) return;
    const siblings = this.siblingItems(parentId);
    if (!siblings) return;
    const fromIndex = siblings.findIndex((candidate) => candidate.id === item.id);
    const toIndex = fromIndex + delta;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= siblings.length) return;
    this.pendingReorder = {
      id: item.id,
      parentId,
      originalSiblingIds: siblings.map((candidate) => candidate.id),
      targetSiblingId: siblings[toIndex]!.id,
      fromIndex,
      toIndex,
    };
    this.pendingFocusId = null;
    this.emit('lr-reorder', {
      taskId: item.id,
      parentTaskId: parentId,
      fromIndex,
      toIndex,
    });
  }

  /** Only direct row key presses can request a move. This leaves Ctrl/Cmd+Arrow on slotted detail
   * controls (and a nested row bubbling through its parent row) to the focused control itself. */
  private onItemKeyDown(event: KeyboardEvent, item: TaskItem, parentId: string | null): void {
    if (this.treeSource !== undefined || !(event.currentTarget as Element)?.isConnected || event.composedPath()[0] !== event.currentTarget) return;
    if (!this.canReorderItems() || !(event.ctrlKey || event.metaKey)) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    // ArrowUp/ArrowDown describe sibling order and do not swap under RTL.
    event.preventDefault();
    this.requestReorder(item, parentId, event.key === 'ArrowDown' ? 1 : -1);
  }

  private capturePendingReorderFocus(): void {
    const pending = this.pendingReorder;
    if (!pending) return;
    const active = shadowFocusTarget(this);
    this.pendingFocusId =
      active instanceof HTMLElement && active.getAttribute('part') === 'item' && active.dataset['id'] === pending.id
        ? pending.id
        : null;
  }

  /** Announce only after the host's controlled refresh proves the exact sibling swap. Unrelated
   * updates retain a request, while a missing or divergent sibling list rejects it. */
  private confirmPendingReorder(): void {
    const pending = this.pendingReorder;
    if (!pending) return;
    const siblings = this.siblingItems(pending.parentId);
    if (!siblings || !this.idsAreUnique()) {
      this.clearPendingReorder();
      return;
    }
    const siblingIds = siblings.map((item) => item.id);
    const orderChanged =
      siblingIds.length !== pending.originalSiblingIds.length ||
      siblingIds.some((id, index) => id !== pending.originalSiblingIds[index]);
    if (!orderChanged) return;

    this.pendingReorder = undefined;
    const restoreFocus = this.pendingFocusId === pending.id;
    this.pendingFocusId = null;
    if (
      siblingIds[pending.toIndex] !== pending.id ||
      siblingIds[pending.fromIndex] !== pending.targetSiblingId
    ) {
      return;
    }
    const moved = siblings[pending.toIndex]!;
    const region = this.liveRegion;
    if (region) {
      region.mode = 'polite';
      region.announce(
        this.localize('treeNodeMoved', undefined, {
          label: moved.label,
          index: getNumberFormat(this.effectiveLocale).format(pending.toIndex + 1),
          total: getNumberFormat(this.effectiveLocale).format(siblings.length),
        }),
        { force: true },
      );
    }
    if (restoreFocus) this.focusItem(pending.id);
  }

  private focusItem(id: string): void {
    const row = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part="item"]') ?? [])].find(
      (candidate) => candidate.dataset['id'] === id,
    );
    row?.focus();
  }

  private clearPendingReorder(): void {
    this.pendingReorder = undefined;
    this.pendingFocusId = null;
  }

  private renderItem(
    item: TaskItem,
    depth: 0 | 1,
    parentId: string | null,
    canReorder: boolean,
  ): TemplateResult {
    const status = normalizeTaskStatus(item.status);
    const children = depth === 0 ? validTaskItems(item.children) : [];
    const hasChildren = children.length > 0;
    return html`
      <div
        part="item"
        role="listitem"
        data-status=${status}
        data-id=${item.id}
        data-depth=${depth}
        tabindex=${canReorder ? '0' : nothing}
        @keydown=${(event: Event) => this.onItemKeyDown(event as KeyboardEvent, item, parentId)}
      >
        <span part="status-icon" aria-hidden="true">${STATUS_ICON[status]()}</span>
        <span class="sr-only">${this.localize(STATUS_LABEL_KEY[status])}</span>
        <span part="item-label">${item.label}</span>
        ${item.detail ? html`<span part="item-detail">${item.detail}</span>` : nothing}
        <slot name=${`detail-${item.id}`}></slot>
        ${hasChildren
          ? html`<div part="item-children" role="list">
              ${canReorder
                ? repeat(
                    children,
                    (child) => child.id,
                    (child) => this.renderItem(child, 1, item.id, canReorder),
                  )
                : children.map((child) => this.renderItem(child, 1, item.id, canReorder))}
            </div>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const label = this.heading == null ? this.localize('taskListLabel') : this.heading;
    const ariaLabel = hostAriaLabel(this) ?? label;
    const sourceMode = this.treeSource !== undefined;
    const model = sourceMode ? undefined : this.taskModel();
    const projection = this.sourceControl.projection;
    const sourceSummary = sourceMode && projection ? this.sourceSummaries.get(projection.rows) : undefined;
    const total = sourceMode ? sourceSummary?.total : model!.items.length;
    const completed = sourceMode ? sourceSummary?.completed : model!.completed;
    // Bounds the actual DOM node count for a very large plan; the summary above still counts every
    // item in `items`, not just this rendered subset. See MAX_RENDERED_TASKS.
    const renderedItems = sourceMode ? [] : this.visibleTaskItems();
    const canReorder = this.canReorderItems();
    const number = getNumberFormat(this.effectiveLocale);
    const summary = total === undefined || completed === undefined ? '' : this.localize('taskListCompletedOfTotal', undefined, {
      completed: number.format(completed),
      total: number.format(total),
    });
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    const header = !this.withoutCollapse
      ? html`
          <button
            part="header"
            type="button"
            id=${this.headerId}
            aria-expanded=${this.collapsed ? 'false' : 'true'}
            aria-controls=${this.bodyId}
            @click=${this.toggle}
          >
            <span part="toggle" aria-hidden="true">${chevronIcon()}</span>
            <span part="label">${label}</span>
            <span part="summary">${summary}</span>
          </button>
        `
      : html`
          <div part="header" id=${this.headerId}>
            <span part="label">${label}</span>
            <span part="summary">${summary}</span>
          </div>
        `;

    return html`
      <div part="base">
        <div role=${headingLevel ? 'heading' : nothing} aria-level=${headingLevel ?? nothing}>
          ${header}
        </div>
        <div part="body" id=${this.bodyId} role=${sourceMode ? nothing : 'list'} aria-label=${ariaLabel} ?hidden=${this.collapsed}>
          ${sourceMode ? hierarchySourceView(this.sourceControl, {
            label: ariaLabel, rtl: this.effectiveDirection === 'rtl', multiple: false,
            loading: this.localize('loading'), error: this.localize('treeSourceError'), empty: this.localize('noData'),
            retry: this.localize('retry'), expand: this.localize('expand'), collapse: this.localize('collapse'),
            summary: this.sourceSummary(), name: () => '', select: () => {},
            content: item => html`<span class="source-task" data-status=${item.status}>
              <span part="status-icon" aria-hidden="true">${STATUS_ICON[item.status]()}</span>
              <span class="sr-only">${this.localize(STATUS_LABEL_KEY[item.status])}</span>
              <span part="item-label">${item.label}</span>
              ${item.detail ? html`<span part="item-detail">${item.detail}</span>` : nothing}
              <slot name=${`detail-${item.id}`}></slot>
            </span>`,
          }) : canReorder
            ? repeat(
                renderedItems,
                (item) => item.id,
                (item) => this.renderItem(item, 0, null, canReorder),
              )
            : renderedItems.map((item) => this.renderItem(item, 0, null, canReorder))}
        </div>
        ${!sourceMode && this.renderedTasksTruncated
          ? html`<p part="limit" role="note">${this.localize('taskListLimit', undefined, {
              count: number.format(this.effectiveMaxNodes),
            })}</p>`
          : nothing}
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-task-list': LyraTaskList;
  }
}
