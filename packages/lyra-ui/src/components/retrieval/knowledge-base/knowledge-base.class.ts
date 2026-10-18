import type { LyraPageSource, LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import {
  html,
  nothing,
  render as renderLit,
  svg,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { createRetryForwarder } from '../../../internal/retry-forwarder.js';
import {
  getDateTimeFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import { playIcon, pauseIcon } from '../../../internal/icons.js';
import { styles } from './knowledge-base.styles.js';
import type { LyraTableEventMap, TableColumn } from '../../data/table/table.class.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import type { LyraMenu, MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_knowledgeBaseActionsColumn, LYRA_DEFAULT_knowledgeBaseCreateSource, LYRA_DEFAULT_knowledgeBaseDeleteAction, LYRA_DEFAULT_knowledgeBaseDocumentCount, LYRA_DEFAULT_knowledgeBaseEmptyDescription, LYRA_DEFAULT_knowledgeBaseEmptyHeading, LYRA_DEFAULT_knowledgeBaseHeading, LYRA_DEFAULT_knowledgeBaseHealthColumn, LYRA_DEFAULT_knowledgeBaseHealthDegraded, LYRA_DEFAULT_knowledgeBaseHealthFailed, LYRA_DEFAULT_knowledgeBaseHealthHealthy, LYRA_DEFAULT_knowledgeBaseHealthUnknown, LYRA_DEFAULT_knowledgeBaseNameColumn, LYRA_DEFAULT_knowledgeBaseNeedsAttention, LYRA_DEFAULT_knowledgeBaseNeverSynced, LYRA_DEFAULT_knowledgeBasePauseAction, LYRA_DEFAULT_knowledgeBasePermissionColumn, LYRA_DEFAULT_knowledgeBasePermissionEditor, LYRA_DEFAULT_knowledgeBasePermissionOwner, LYRA_DEFAULT_knowledgeBasePermissionRestricted, LYRA_DEFAULT_knowledgeBasePermissionViewer, LYRA_DEFAULT_knowledgeBaseRowActionsLabel, LYRA_DEFAULT_knowledgeBaseSyncAction, LYRA_DEFAULT_knowledgeBaseSyncColumn, LYRA_DEFAULT_knowledgeBaseSyncError, LYRA_DEFAULT_knowledgeBaseSyncIdle, LYRA_DEFAULT_knowledgeBaseSyncPaused, LYRA_DEFAULT_knowledgeBaseSyncSynced, LYRA_DEFAULT_knowledgeBaseSyncSyncing, LYRA_DEFAULT_knowledgeBaseSyncedSources, LYRA_DEFAULT_knowledgeBaseSyncingSources, LYRA_DEFAULT_knowledgeBaseTotalSources, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_loading, LYRA_DEFAULT_tableLoadFailed } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Sync lifecycle state of one knowledge source, as last reported by the host. */
export type KnowledgeSourceSyncStatus =
  | 'idle'
  | 'syncing'
  | 'paused'
  | 'synced'
  | 'error';

/** Health of the most recent indexing pass over a source's content, as last reported by the host. */
export type KnowledgeSourceIndexingHealth =
  | 'healthy'
  | 'degraded'
  | 'failed'
  | 'unknown';

/** The current viewer's access level on a source -- informational only (see the class doc's
 *  authorization note). */
export type KnowledgeSourcePermission =
  | 'owner'
  | 'editor'
  | 'viewer'
  | 'restricted';

/**
 * One connected knowledge-base source (e.g. a Drive/Notion connector, an uploaded document set, a
 * crawled URL). `id`/`name` follow the same spirit as `DocumentRef` (`src/ai/types.ts`) -- a stable
 * identity plus a display name -- but a source is a *connector feeding* documents into the
 * knowledge base, not a document itself, so the remaining fields are its own.
 */
export interface KnowledgeSource {
  id: string;
  name: string;
  /** Free-form connector/source kind (e.g. `'drive'`, `'notion'`, `'upload'`, `'url'`) --
   *  consumer-defined and rendered as-is (not routed through `localize()` -- caller-supplied data,
   *  not library copy). Omit when there's nothing meaningful to show. */
  type?: string;
  syncStatus: KnowledgeSourceSyncStatus;
  /** Omitted/absent is treated the same as `'unknown'`. */
  indexingHealth?: KnowledgeSourceIndexingHealth;
  permission?: KnowledgeSourcePermission;
  documentCount?: number;
  /** A `Date` or an ISO-8601 string, matching `LyraChatThread`/`ChatMessage`'s own `Date | string`
   *  timestamp convention elsewhere in this library. Omitted/unparseable renders as "never synced". */
  lastSyncedAt?: Date | string;
  /** Shown only while `syncStatus` is `'error'`. Caller-supplied data, not routed through
   *  `localize()`. */
  errorMessage?: string;
}

/** Full-source server order for the source grid. */
export interface KnowledgeBaseSourceQuery {
  readonly sortKey: string | null;
  readonly sortDir: 'asc' | 'desc';
}
/** Full-source counts; attention may overlap either lifecycle count. */
export interface KnowledgeBaseSourceSummary {
  readonly total: number;
  readonly synced: number;
  readonly syncing: number;
  readonly attention: number;
}
export type KnowledgeBaseSource = LyraPageSource<KnowledgeSource, KnowledgeBaseSourceQuery, KnowledgeBaseSourceSummary>;

function sourceField(value: unknown, key: string, current: () => boolean, required = false): unknown {
  if (!current()) throw new Error('Source record revoked');
  if (!value || typeof value !== 'object') throw new TypeError('Invalid source value');
  const descriptor = getOwnDataDescriptor(value, key);
  if (!current()) throw new Error('Source record revoked');
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || (required && descriptor === MISSING_OWN_DATA_DESCRIPTOR)) throw new TypeError('Invalid source field');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function sourceCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid source count');
  return value;
}
function projectKnowledgeSource(record: LyraSourceRecord<unknown>, current: () => boolean): KnowledgeSource {
  const read = (key: string, required = false) => sourceField(record.value, key, current, required);
  const id = read('id', true); const name = read('name', true); const type = read('type');
  const syncStatus = read('syncStatus', true); const indexingHealth = read('indexingHealth'); const permission = read('permission');
  const documentCount = read('documentCount'); const timestamp = read('lastSyncedAt'); const errorMessage = read('errorMessage');
  let units = 0;
  for (const value of [id, name, type, syncStatus, indexingHealth, permission, errorMessage, typeof timestamp === 'string' ? timestamp : undefined]) {
    if (value !== undefined && typeof value !== 'string') throw new TypeError('Invalid source text');
    units += typeof value === 'string' ? value.length : 0;
  }
  if (typeof id !== 'string' || !id.trim() || id !== record.key || typeof name !== 'string' || units > 65_536) throw new TypeError('Invalid source record');
  if (!['idle', 'syncing', 'paused', 'synced', 'error'].includes(syncStatus as string)) throw new TypeError('Invalid source status');
  if (indexingHealth !== undefined && !['healthy', 'degraded', 'failed', 'unknown'].includes(indexingHealth as string)) throw new TypeError('Invalid source health');
  if (permission !== undefined && !['owner', 'editor', 'viewer', 'restricted'].includes(permission as string)) throw new TypeError('Invalid source permission');
  if (documentCount !== undefined) sourceCount(documentCount);
  let lastSyncedAt: Date | string | undefined;
  if (typeof timestamp === 'string' || timestamp === undefined) lastSyncedAt = timestamp;
  else {
    const time = Date.prototype.getTime.call(timestamp);
    if (!Number.isFinite(time)) throw new TypeError('Invalid source timestamp');
    lastSyncedAt = new Date(time);
  }
  if (!current()) throw new Error('Source record revoked');
  return Object.freeze({ id, name, type: type as string | undefined, syncStatus: syncStatus as KnowledgeSourceSyncStatus,
    indexingHealth: indexingHealth as KnowledgeSourceIndexingHealth | undefined, permission: permission as KnowledgeSourcePermission | undefined,
    documentCount: documentCount as number | undefined, lastSyncedAt, errorMessage: errorMessage as string | undefined });
}
function projectKnowledgeSummary(value: unknown, current: () => boolean): KnowledgeBaseSourceSummary {
  const read = (key: string) => sourceCount(sourceField(value, key, current, true));
  return Object.freeze({ total: read('total'), synced: read('synced'), syncing: read('syncing'), attention: read('attention') });
}

export interface LyraKnowledgeBaseEventMap {
  'lr-sort-request': LyraTableEventMap<KnowledgeSource>['lr-sort-request'];
  'lr-sort': LyraTableEventMap<KnowledgeSource>['lr-sort'];
  /** The toolbar's "Add source" affordance was activated. No `sourceId` -- there is nothing yet to
   *  reference; the host owns the actual creation flow (naming, connector picking, ...). */
  'lr-source-create': CustomEvent<null>;
  /** A row's "Sync now" action was activated. */
  'lr-source-sync': CustomEvent<{ sourceId: string }>;
  /** A row's "Pause sync" action was activated. */
  'lr-source-pause': CustomEvent<{ sourceId: string }>;
  /** A row's "Delete source" action was activated. No built-in confirmation, matching
   *  `lr-thread-list`'s identical `lr-thread-delete` contract. */
  'lr-source-delete': CustomEvent<{ sourceId: string }>;
  /** Cancelable retry proposal. The default action clears the parent and nested table error. */
  'lr-retry-request': CustomEvent<null>;
}

const SYNC_STATUS_VARIANT: Record<KnowledgeSourceSyncStatus, BadgeVariant> = {
  idle: 'neutral',
  syncing: 'brand',
  paused: 'warning',
  synced: 'success',
  error: 'danger',
};

const HEALTH_VARIANT: Record<KnowledgeSourceIndexingHealth, BadgeVariant> = {
  healthy: 'success',
  degraded: 'warning',
  failed: 'danger',
  unknown: 'neutral',
};

const PERMISSION_VARIANT: Record<KnowledgeSourcePermission, BadgeVariant> = {
  owner: 'brand',
  editor: 'neutral',
  viewer: 'neutral',
  restricted: 'warning',
};

const TABLE_EXPORT_PARTS = [
  'name-cell:name-cell',
  'source-name:source-name',
  'source-type:source-type',
  'sync-cell:sync-cell',
  'sync-badge:sync-badge',
  'sync-timestamp:sync-timestamp',
  'sync-error:sync-error',
  'health-cell:health-cell',
  'health-badge:health-badge',
  'document-count:document-count',
  'permission-badge:permission-badge',
  'actions-menu:actions-menu',
  'actions-trigger:actions-trigger',
  'error-row:error-row',
  'error-cell:error-cell',
  'error:error',
  'error-base:error-base',
  'error-icon:error-icon',
  'error-heading:error-heading',
  'error-description:error-description',
  'error-actions:error-actions',
  'retry-button:retry-button',
].join(', ');

// One-off glyphs kept local rather than added to the shared internal/icons.ts set -- same approach
// lr-thread-list's local pinIcon()/archiveIcon()/trashIcon() take, for the identical reason (these
// aren't part of the library's general-purpose icon vocabulary). trashIcon mirrors lr-thread-list's
// own glyph verbatim so a destructive action reads identically everywhere it appears.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function trashIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 7h16"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M6 7l1 14h10l1-14"></path>
      <path d="M9 7V4h6v3"></path>
    </svg>
  `;
}

/** A vertical three-dot "more actions" trigger glyph -- filled dots rather than this set's usual
 *  stroked paths, since that's the conventional rendering for an overflow-menu affordance. */
function kebabIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="currentColor" stroke="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="5" r="1.75"></circle>
      <circle cx="12" cy="12" r="1.75"></circle>
      <circle cx="12" cy="19" r="1.75"></circle>
    </svg>
  `;
}

function normalizeTimestamp(
  value: Date | string | undefined
): Date | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * `<lr-knowledge-base>` — a source list for a retrieval knowledge base: sync status, indexing
 * health, permissions, and per-row create/sync/pause/delete affordances. A controlled data view,
 * like every other Lyra data component: it never syncs or indexes anything itself, only presents
 * `sources` and emits request-only events (`lr-source-create`/`-sync`/`-pause`/`-delete`) for the
 * host to act on and reflect back into a new `sources` value -- mirrors `lr-thread-list`'s
 * `lr-thread-pin`/`-archive`/`-delete` convention exactly.
 *
 * `permission` is rendered informationally only (a badge in the permission column); this component
 * does not gate the per-row action menu by it -- authorization enforcement is the host's own
 * concern, consistent with the controlled/presentational-only contract above. A `'syncing'` row's
 * "Sync now" action is disabled (a sync is already running); every other row's is enabled,
 * including `'error'`, so re-running a failed sync is one click. "Pause sync" is enabled only while
 * `'syncing'`.
 *
 * Composes `<lr-table>` for the source list (its own click/keydown delegation already treats any
 * custom-element or `role="menuitem"` cell content as interactive, so the per-row `<lr-dropdown>` never
 * misfires the table's row-click handling), `<lr-badge>` for the sync-status/indexing-health/
 * permission indicators, `<lr-stat>` for the aggregate summary row above the table, and
 * `<lr-dropdown>` + `<lr-menu>` for the per-row action affordances. The table's own
 * `lr-row-activate` is intentionally stopped from
 * propagating further (this component doesn't expose row-click/selection semantics -- only the
 * per-row action menu is interactive).
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank source ids and later duplicates are ignored before summary counts, rendering, or actions.
 * The first source for an id wins.
 *
 * `dataSource` opts into provider-owned server pages of at most 500 rows. Source keys must
 * equal record IDs. Each response supplies authoritative total/synced/syncing/attention counts;
 * attention can overlap the lifecycle counts. Only the current page is retained, and the name,
 * sync, health, and permission headers request server sorting. Undefined restores `sources`.
 * Reassign the provider or call requestUpdate() to refresh; ordinary presentation updates do not
 * refetch. Provider failures retain the toolbar and use the existing cancelable retry contract.
 *
 * A separate `error` state reports a failed source-list load without discarding the toolbar and
 * summary context around it: while `error` is set, the nested `<lr-table>` shows its own built-in
 * failed-load state (the same `error`-prefixed exported parts and `[part='retry-button']` as
 * `<lr-table>` itself) in place of the source rows, behind this component's own `error` slot.
 * Precedence matches `<lr-table>`'s: `error` beats the empty state, so a failed load never falls
 * through to "no sources" copy that would hide the retry affordance. This component forwards
 * `error`/`errorHeading`/`errorDescription` to the nested table but owns the retry commit itself
 * (it intercepts the table's own `lr-retry-request`, re-proposes its own cancelable one, and only then
 * clears `error`) so the outer property never drifts out of sync with the table's internal state.
 *
 * @csspart source-status - Localized provider loading or failed-summary status.
 * @customElement lr-knowledge-base
 * @event lr-sort-request - Source mode only: cancelable original table sort proposal.
 * @event lr-sort - Source mode only: original accepted table sort commit.
 * @event lr-source-create - The toolbar "Add source" affordance was activated. No detail.
 * @event lr-source-sync - A row's "Sync now" action was activated. `detail: { sourceId }`.
 * @event lr-source-pause - A row's "Pause sync" action was activated. `detail: { sourceId }`.
 * @event lr-source-delete - A row's "Delete source" action was activated. `detail: { sourceId }`.
 * @event lr-retry-request - Cancelable retry proposal, `detail: null`, re-emitted by this
 *   component from the nested table's retry action. Vetoing it keeps both the parent and nested
 *   table in the error state.
 * @slot error - Replaces the nested table's built-in failed-load state, including its retry
 *   button, while `error` is set.
 * @csspart base - The root.
 * @csspart toolbar - The heading + "Add source" row.
 * @csspart heading - The heading text.
 * @csspart create-button - The "Add source" `<lr-button>`, omitted while `withoutCreate` is set.
 * @csspart summary - The aggregate-stats row, omitted while `withoutSummary` is set or `sources` is empty.
 * @csspart summary-stat - One `<lr-stat>` inside `summary`.
 * @csspart table - The `<lr-table>` listing every source.
 * @csspart name-cell - A row's source-name cell wrapper.
 * @csspart source-name - The source's name text.
 * @csspart source-type - The source's `type` text, omitted when unset.
 * @csspart sync-cell - A row's sync-status cell wrapper.
 * @csspart sync-badge - The sync-status `<lr-badge>`.
 * @csspart sync-timestamp - The formatted `lastSyncedAt` text (or a "never synced" fallback).
 * @csspart sync-error - The `errorMessage` text, shown only while `syncStatus` is `'error'` and it's set.
 * @csspart health-cell - A row's indexing-health cell wrapper.
 * @csspart health-badge - The indexing-health `<lr-badge>`.
 * @csspart document-count - The formatted `documentCount` text, omitted when unset.
 * @csspart permission-badge - The permission `<lr-badge>`, omitted when `permission` is unset.
 * @csspart actions-menu - A row's `<lr-dropdown>` shell.
 * @csspart actions-trigger - The kebab `<button>` opening a row's action menu.
 * @csspart error-row - The nested table's single full-width row that replaces the source rows
 *   while `error` is set.
 * @csspart error-cell - The cell inside `error-row` that holds the failed-load content.
 * @csspart error - The nested table's built-in `<lr-empty>` host rendered while `error` is set.
 * @csspart error-base - Exported from the built-in error `<lr-empty>`'s own `base` part.
 * @csspart error-icon - Exported from the built-in error `<lr-empty>`'s `icon` part.
 * @csspart error-heading - Exported from the built-in error `<lr-empty>`'s `heading` part.
 * @csspart error-description - Exported from the built-in error `<lr-empty>`'s `description` part.
 * @csspart error-actions - Exported from the built-in error `<lr-empty>`'s `actions` part.
 * @csspart retry-button - The built-in retry control rendered into the error state's `actions`.
 * @cssprop [--lr-icon-button-bg=transparent] - Icon action background in the resting state.
 * @cssprop [--lr-icon-button-bg-active=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Icon action background in the pressed state.
 * @cssprop [--lr-icon-button-bg-hover=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] - Icon action background in the hover state.
 * @cssprop [--lr-icon-button-border=0] - Icon action border in the resting state.
 * @cssprop [--lr-icon-button-border-active=var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0))] - Icon action border in the pressed state.
 * @cssprop [--lr-icon-button-border-hover=var(--lr-icon-button-border, 0)] - Icon action border in the hover state.
 * @cssprop [--lr-icon-button-color=var(--lr-color-text-quiet)] - Icon action foreground color in the resting state.
 * @cssprop [--lr-icon-button-color-active=var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))] - Icon action foreground color in the pressed state.
 * @cssprop [--lr-icon-button-color-hover=var(--lr-color-text)] - Icon action foreground color in the hover state.
 * @cssprop [--lr-icon-button-radius=var(--lr-radius)] - Icon action corner radius in the resting state.
 * @status stable
 * @since 4.1.0
 */
export class LyraKnowledgeBase extends LyraElement<LyraKnowledgeBaseEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    knowledgeBaseActionsColumn: LYRA_DEFAULT_knowledgeBaseActionsColumn,
    knowledgeBaseCreateSource: LYRA_DEFAULT_knowledgeBaseCreateSource,
    knowledgeBaseDeleteAction: LYRA_DEFAULT_knowledgeBaseDeleteAction,
    knowledgeBaseDocumentCount: LYRA_DEFAULT_knowledgeBaseDocumentCount,
    knowledgeBaseEmptyDescription: LYRA_DEFAULT_knowledgeBaseEmptyDescription,
    knowledgeBaseEmptyHeading: LYRA_DEFAULT_knowledgeBaseEmptyHeading,
    knowledgeBaseHeading: LYRA_DEFAULT_knowledgeBaseHeading,
    knowledgeBaseHealthColumn: LYRA_DEFAULT_knowledgeBaseHealthColumn,
    knowledgeBaseHealthDegraded: LYRA_DEFAULT_knowledgeBaseHealthDegraded,
    knowledgeBaseHealthFailed: LYRA_DEFAULT_knowledgeBaseHealthFailed,
    knowledgeBaseHealthHealthy: LYRA_DEFAULT_knowledgeBaseHealthHealthy,
    knowledgeBaseHealthUnknown: LYRA_DEFAULT_knowledgeBaseHealthUnknown,
    knowledgeBaseNameColumn: LYRA_DEFAULT_knowledgeBaseNameColumn,
    knowledgeBaseNeedsAttention: LYRA_DEFAULT_knowledgeBaseNeedsAttention,
    knowledgeBaseNeverSynced: LYRA_DEFAULT_knowledgeBaseNeverSynced,
    knowledgeBasePauseAction: LYRA_DEFAULT_knowledgeBasePauseAction,
    knowledgeBasePermissionColumn: LYRA_DEFAULT_knowledgeBasePermissionColumn,
    knowledgeBasePermissionEditor: LYRA_DEFAULT_knowledgeBasePermissionEditor,
    knowledgeBasePermissionOwner: LYRA_DEFAULT_knowledgeBasePermissionOwner,
    knowledgeBasePermissionRestricted: LYRA_DEFAULT_knowledgeBasePermissionRestricted,
    knowledgeBasePermissionViewer: LYRA_DEFAULT_knowledgeBasePermissionViewer,
    knowledgeBaseRowActionsLabel: LYRA_DEFAULT_knowledgeBaseRowActionsLabel,
    knowledgeBaseSyncAction: LYRA_DEFAULT_knowledgeBaseSyncAction,
    knowledgeBaseSyncColumn: LYRA_DEFAULT_knowledgeBaseSyncColumn,
    knowledgeBaseSyncError: LYRA_DEFAULT_knowledgeBaseSyncError,
    knowledgeBaseSyncIdle: LYRA_DEFAULT_knowledgeBaseSyncIdle,
    knowledgeBaseSyncPaused: LYRA_DEFAULT_knowledgeBaseSyncPaused,
    knowledgeBaseSyncSynced: LYRA_DEFAULT_knowledgeBaseSyncSynced,
    knowledgeBaseSyncSyncing: LYRA_DEFAULT_knowledgeBaseSyncSyncing,
    knowledgeBaseSyncedSources: LYRA_DEFAULT_knowledgeBaseSyncedSources,
    knowledgeBaseSyncingSources: LYRA_DEFAULT_knowledgeBaseSyncingSources,
    knowledgeBaseTotalSources: LYRA_DEFAULT_knowledgeBaseTotalSources,
    loading: LYRA_DEFAULT_loading,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'sources',
  ]);

  protected static override readonly identityCollectionObjectProperties = Object.freeze(['dataSource']);

  static override styles = [LyraElement.styles, styles];

  @state() private sourceStateVersion = 0;
  private _dataSource?: KnowledgeBaseSource;
  private sourceEpoch = 0;
  private sourceVersion = 0;
  private sourceSyncing = false;
  private sourceResync = false;
  private sourceLocaleUpdate = false;
  private sourceInputs?: readonly unknown[];
  private sourceResult?: LyraPageResult<KnowledgeSource, KnowledgeBaseSourceSummary>;
  private sourceRows: KnowledgeSource[] = [];
  private sourceFailure: unknown;
  private sourceTableShown = false;
  private sourceSortKey: string | null = null;
  private sourceSortDir: 'asc' | 'desc' = 'asc';
  private sortRequest?: { target: EventTarget | null; version: number; columns: readonly TableColumn<KnowledgeSource>[]; key: string; dir: 'asc' | 'desc' };
  private readonly sourcePages = new SourcePageController<KnowledgeSource, KnowledgeBaseSourceQuery, KnowledgeBaseSourceSummary>(this, {
    normalizeRecord: (record, isCurrent) => {
      const current = this.sourceCurrent();
      return Object.freeze({ ...record, value: projectKnowledgeSource(record, () => isCurrent() && current()) });
    },
    normalizeSummary: value => projectKnowledgeSummary(value, this.sourceCurrent()),
    validateMetadata: result => {
      const summary = result.summary!;
      if (summary.total !== result.total || summary.synced > summary.total || summary.syncing > summary.total || summary.attention > summary.total || summary.synced + summary.syncing > summary.total) throw new TypeError('Invalid source summary');
      const rows = result.rows.map(record => record.value);
      if (rows.filter(row => row.syncStatus === 'synced').length > summary.synced || rows.filter(row => row.syncStatus === 'syncing').length > summary.syncing || rows.filter(row => row.syncStatus === 'error' || row.indexingHealth === 'failed' || row.indexingHealth === 'degraded').length > summary.attention) throw new TypeError('Inconsistent source summary');
    },
    onChange: () => { this.sourceStateVersion++; },
  });

  /** Immutable full-source provider; takes precedence over sources. Keys equal source IDs.
   * Reassigning the same provider or requestUpdate() refreshes. undefined restores sources. */
  @property({ attribute: false })
  get dataSource(): KnowledgeBaseSource | undefined { return this._dataSource; }
  set dataSource(value: KnowledgeBaseSource | undefined) {
    const old = this._dataSource; this._dataSource = value;
    this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    this.requestUpdate('dataSource', old);
  }
  /** Zero-based provider page. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider page size, normalized to 1–500. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Accepted full-source total; null while pending, failed, or using sources. */
  get sourceTotal(): number | null { return this.sourceMode ? this.sourceResult?.total ?? null : null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }
  private sourceCurrent(): () => boolean {
    const version = this.sourceVersion; const epoch = this.sourceEpoch; const source = this.dataSource; const owner = this.ownerDocument;
    return () => this.isConnected && this.ownerDocument === owner && this.sourceVersion === version && this.sourceEpoch === epoch && this.dataSource === source;
  }
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (this.sourceLocaleUpdate) { super.requestUpdate(...args); this.syncSource(); return; }
    if (args[0] === undefined && (!this.sourceInputs || this.effectiveLocale === this.sourceInputs[3])) this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize'].includes(String(args[0]))) this.syncSource();
    super.requestUpdate(...args);
  }
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    const previous = this.sourceLocaleUpdate;
    if (name === 'lang' || name === 'locale') this.sourceLocaleUpdate = true;
    try { super.attributeChangedCallback(name, old, value); } finally { this.sourceLocaleUpdate = previous; }
  }
  override connectedCallback(): void { super.connectedCallback(); this.syncSource(); }
  override adoptedCallback(): void { this.clearSourceLifecycle(); this.sourcePages.adopted(); super.adoptedCallback(); this.syncSource(); }
  protected override willUpdate(changed: PropertyValues): void { super.willUpdate(changed); this.syncSource(); }
  private clearSourceLifecycle(): void {
    this.sourceEpoch++; this.sourceVersion++; this.sourceInputs = undefined;
    this.sourceRows = []; this.sourceResult = undefined; this.sourceFailure = undefined; this.sourceTableShown = false;
    this.closeActionMenus(); this.sourcePages.bind(undefined);
  }
  private syncSource(): void {
    if (!this.sourcePages || !this.isConnected) return;
    if (this.sourceSyncing) { this.sourceResync = true; return; }
    this.sourceSyncing = true;
    const source = this.dataSource; const epoch = this.sourceEpoch; const owner = this.ownerDocument;
    const current = () => this.isConnected && this.ownerDocument === owner && this.dataSource === source && this.sourceEpoch === epoch;
    try {
      if (source === undefined) {
        if (this.sourceInputs || this.sourceFailure) this.clearSourceLifecycle();
        return;
      }
      const revision = source.revision;
      if (!current()) return;
      const locale = this.effectiveLocale; const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      if (this.sourceInputs && (size !== this.sourceInputs[6] || this.sourceSortKey !== this.sourceInputs[4] || this.sourceSortDir !== this.sourceInputs[5])) page = 0;
      const inputs = [source, revision, epoch, locale, this.sourceSortKey, this.sourceSortDir, size, page];
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      const version = ++this.sourceVersion;
      this.sourceInputs = inputs; this.sourceRows = []; this.sourceResult = undefined; this.sourceFailure = undefined;
      this.closeActionMenus(); this.sourcePage = page;
      this.sourcePages.bind({ source, revision, epoch, locale });
      if (!current() || this.sourceVersion !== version) return;
      void this.loadSourcePage(version, Object.freeze({ sortKey: this.sourceSortKey, sortDir: this.sourceSortDir }), page, size);
    } catch (error) {
      if (current()) { this.sourceVersion++; this.sourceRows = []; this.sourceResult = undefined; this.sourceFailure = error; this.closeActionMenus(); this.sourcePages.bind(undefined); }
    } finally {
      this.sourceSyncing = false;
      if (this.sourceResync) { this.sourceResync = false; this.syncSource(); }
    }
  }
  private async loadSourcePage(version: number, query: KnowledgeBaseSourceQuery, page: number, size: number): Promise<void> {
    const owner = this.ownerDocument;
    const accepted = await this.sourcePages.request(query, page, size);
    if (!this.isConnected || this.ownerDocument !== owner || this.sourceVersion !== version || !this.sourceMode) return;
    if (accepted) {
      this.sourceResult = this.sourcePages.state.result;
      this.sourceRows = this.sourceResult!.rows.map(record => record.value);
      if (this.sourceInputs) this.sourceInputs = [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page];
      this.sourcePage = this.sourcePages.state.page;
    }
    this.sourceStateVersion++;
  }

  /** The sources to list, in display order. */
  @property({ attribute: false }) sources: readonly KnowledgeSource[] = [];

  /** Heading text and the nested table's accessible name. A host `aria-label` independently
   *  names the complete component. Omitted falls back to a localized default. An explicitly
   *  empty `label` keeps the visible heading empty, but the nested table still receives the
   *  localized default as its accessible name so the grid is never left unnamed. */
  @property() label?: string;

  /** Semantic level of the heading; `none` keeps the visible text without heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '3';

  /** Hides the aggregate summary row (total/synced/syncing/needs-attention). */
  @property({ type: Boolean, attribute: 'without-summary', reflect: true })
  withoutSummary = false;

  /** Hides the toolbar's "Add source" affordance, e.g. for a read-only or permission-gated view. */
  @property({ type: Boolean, attribute: 'without-create', reflect: true })
  withoutCreate = false;

  /** Reports a failed source-list load. Forwarded to the nested `<lr-table>`, whose own built-in
   *  failed-load state renders in place of the source rows; `<lr-table>`'s own precedence applies
   *  (`error` beats the empty state). Reflected so `[error]` is selectable from outside. */
  @property({ type: Boolean, reflect: true }) error = false;

  /** Failed-load heading override, forwarded to the nested table. Omitted localizes the table's
   *  own `tableLoadFailed` default. */
  @property({ attribute: 'error-heading' }) errorHeading?: string;

  /** Failed-load supporting copy, forwarded to the nested table. */
  @property({ attribute: 'error-description' }) errorDescription = '';

  private readonly slotPresence = new SlotPresenceController(this, { observeLightDom: true });
  private get hasErrorSlot(): boolean { return this.slotPresence.has('error'); }

  /** Forward the nested table's retry as this component's request; a veto keeps both error states. */
  private legacyTableRetry = createRetryForwarder(
    (init) => this.emit('lr-retry-request', null, init),
    () => { this.error = false; },
  );

  private sourceRetryCommit?: () => void;
  private readonly sourceTableRetry = createRetryForwarder(
    init => this.emit('lr-retry-request', null, init),
    () => this.sourceRetryCommit?.(),
  );

  private retrySource(event: CustomEvent<null>, current: () => boolean, failed: boolean): void {
    if (!current()) { event.stopPropagation(); event.preventDefault(); return; }
    const nested = this.sourceRetryCommit !== undefined;
    if (!nested) this.sourceRetryCommit = () => {
      if (!current() || !this.sourceMode) return;
      this.error = false;
      if (failed && current()) this.requestUpdate();
    };
    try { this.sourceTableRetry(event); } finally { if (!nested) this.sourceRetryCommit = undefined; }
  }

  private sourcesCache?: { source: unknown; value: KnowledgeSource[] };

  private get normalizedSources(): KnowledgeSource[] {
    if (this.sourcesCache?.source !== this.sources)
      this.sourcesCache = {
        source: this.sources,
        value: firstByRetrievalIdentity(
          Array.isArray(this.sources) ? this.sources : [],
          (source) => source.id
        ),
      };
    return this.sourcesCache.value;
  }

  private readonly rowKey = (row: KnowledgeSource): string => row.id;

  private syncStatusLabel(status: KnowledgeSourceSyncStatus): string {
    switch (status) {
      case 'idle':
        return this.localize('knowledgeBaseSyncIdle');
      case 'syncing':
        return this.localize('knowledgeBaseSyncSyncing');
      case 'paused':
        return this.localize('knowledgeBaseSyncPaused');
      case 'synced':
        return this.localize('knowledgeBaseSyncSynced');
      case 'error':
        return this.localize('knowledgeBaseSyncError');
      default:
        return this.localize('knowledgeBaseHealthUnknown');
    }
  }

  private healthLabel(health: KnowledgeSourceIndexingHealth): string {
    switch (health) {
      case 'healthy':
        return this.localize('knowledgeBaseHealthHealthy');
      case 'degraded':
        return this.localize('knowledgeBaseHealthDegraded');
      case 'failed':
        return this.localize('knowledgeBaseHealthFailed');
      default:
        return this.localize('knowledgeBaseHealthUnknown');
    }
  }

  private permissionLabel(permission: KnowledgeSourcePermission): string {
    switch (permission) {
      case 'owner':
        return this.localize('knowledgeBasePermissionOwner');
      case 'editor':
        return this.localize('knowledgeBasePermissionEditor');
      case 'viewer':
        return this.localize('knowledgeBasePermissionViewer');
      case 'restricted':
        return this.localize('knowledgeBasePermissionRestricted');
      default:
        return this.localize('knowledgeBaseHealthUnknown');
    }
  }

  private sourceName(source: KnowledgeSource): string {
    return typeof source.name === 'string' && source.name.trim() !== ''
      ? source.name
      : this.localize('untitledSource');
  }

  private renderNameCell(source: KnowledgeSource): TemplateResult {
    const name = this.sourceName(source);
    return html`
      <div part="name-cell">
        <span part="source-name">${name}</span>
        ${source.type
          ? html`<span part="source-type">${source.type}</span>`
          : nothing}
      </div>
    `;
  }

  private renderSyncCell(source: KnowledgeSource): TemplateResult {
    const lastSynced = normalizeTimestamp(source.lastSyncedAt);
    return html`
      <div part="sync-cell">
        <lr-badge
          part="sync-badge"
          variant=${SYNC_STATUS_VARIANT[source.syncStatus] ?? 'neutral'}
          >${this.syncStatusLabel(source.syncStatus)}</lr-badge
        >
        <span part="sync-timestamp">
          ${lastSynced
            ? getDateTimeFormat(this.effectiveLocale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(lastSynced)
            : this.localize('knowledgeBaseNeverSynced')}
        </span>
        ${source.syncStatus === 'error' && source.errorMessage
          ? html`<span part="sync-error">${source.errorMessage}</span>`
          : nothing}
      </div>
    `;
  }

  private renderHealthCell(source: KnowledgeSource): TemplateResult {
    const health = source.indexingHealth ?? 'unknown';
    return html`
      <div part="health-cell">
        <lr-badge part="health-badge" variant=${HEALTH_VARIANT[health] ?? 'neutral'}
          >${this.healthLabel(health)}</lr-badge
        >
        ${source.documentCount != null
          ? html`<span part="document-count"
              >${this.localize('knowledgeBaseDocumentCount', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(
                  finiteCount(source.documentCount)
                ),
              })}</span
            >`
          : nothing}
      </div>
    `;
  }

  private renderPermissionCell(source: KnowledgeSource): TemplateResult {
    if (!source.permission) return html``;
    return html`<lr-badge
      part="permission-badge"
      variant=${PERMISSION_VARIANT[source.permission] ?? 'neutral'}
      >${this.permissionLabel(source.permission)}</lr-badge
    >`;
  }

  private onRowAction(source: KnowledgeSource, action: string): void {
    if (action === 'sync') this.emit('lr-source-sync', { sourceId: source.id });
    else if (action === 'pause')
      this.emit('lr-source-pause', { sourceId: source.id });
    else if (action === 'delete')
      this.emit('lr-source-delete', { sourceId: source.id });
  }

  private readonly openActionMenus = new Map<HTMLElement, { source: KnowledgeSource; current: () => boolean }>();

  private closeActionMenus(): void {
    for (const dropdown of this.openActionMenus.keys()) {
      (dropdown as HTMLElement & { open: boolean }).open = false;
      const menu = dropdown.querySelector<LyraMenu>(tag('menu'));
      if (menu) renderLit(nothing, menu);
    }
    this.openActionMenus.clear();
  }

  private updateActionMenu(dropdown: HTMLElement, sourceId: string): void {
    const menu = dropdown.querySelector<LyraMenu>(tag('menu'));
    const admitted = this.openActionMenus.get(dropdown);
    const source = this.sourceMode ? (admitted?.current() ? admitted.source : undefined) : this.normalizedSources.find((row) => row.id === sourceId);
    if (!menu || !source) return;
    menu.label = this.localize('knowledgeBaseRowActionsLabel', undefined, { name: this.sourceName(source) });
    const canPause = source.syncStatus === 'syncing';
    const canSync = SYNC_STATUS_VARIANT[source.syncStatus] !== undefined && !canPause;
    renderLit(this.renderActionItems(canSync, canPause), menu);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    for (const [dropdown, admission] of this.openActionMenus) {
      if (!dropdown.isConnected || !(dropdown as HTMLElement & { open: boolean }).open) {
        this.openActionMenus.delete(dropdown);
        continue;
      }
      this.updateActionMenu(dropdown, admission.source.id);
    }
  }

  override disconnectedCallback(): void {
    this.clearSourceLifecycle();
    super.disconnectedCallback();
  }

  private renderActionsCell(source: KnowledgeSource): TemplateResult {
    const sourceMode = this.sourceMode; const authority = this.sourceCurrent();
    const current = () => sourceMode ? authority() && this.sourceMode && this.sourceRows.includes(source) : !this.sourceMode;
    const label = this.localize('knowledgeBaseRowActionsLabel', undefined, {
      name: this.sourceName(source),
    });
    return html`
      <lr-dropdown without-arrow part="actions-menu" placement="bottom-end"
        @lr-show=${(event: Event) => {
          const dropdown = event.currentTarget as HTMLElement & { open: boolean };
          if (event.target !== dropdown || !current()) return;
          const menu = dropdown.querySelector<LyraMenu>(tag('menu'));
          if (menu) {
            this.openActionMenus.set(dropdown, { source, current });
            this.updateActionMenu(dropdown, source.id);
            queueMicrotask(() => {
              if (current() && !dropdown.open) {
                this.openActionMenus.delete(dropdown);
                renderLit(nothing, menu);
              }
            });
          }
        }}
        @lr-after-hide=${(event: Event) => {
          const dropdown = event.currentTarget as HTMLElement & { open: boolean };
          if (event.target !== dropdown || !current()) return;
          const menu = dropdown.querySelector<LyraMenu>(tag('menu'));
          if (!dropdown.open && menu) {
            this.openActionMenus.delete(dropdown);
            renderLit(nothing, menu);
          }
        }}>
        <button
          slot="trigger"
          type="button"
          part="actions-trigger"
          aria-label=${label}
        >
          ${kebabIcon()}
        </button>
        <lr-menu
          label=${label}
          @lr-select=${(e: CustomEvent<MenuItemSelectDetail>) => {
            e.stopPropagation();
            if (!current()) return;
            const action = e.detail.item.value;
            if (!current() || (sourceMode && ((action === 'sync' && source.syncStatus === 'syncing') || (action === 'pause' && source.syncStatus !== 'syncing')))) return;
            this.onRowAction(source, action);
          }}
        ></lr-menu>
      </lr-dropdown>
    `;
  }

  private renderActionItems(canSync: boolean, canPause: boolean): TemplateResult {
    return html`
          <lr-menu-item value="sync" ?disabled=${!canSync}>
            <span slot="icon">${playIcon()}</span>
            ${this.localize('knowledgeBaseSyncAction')}
          </lr-menu-item>
          <lr-menu-item value="pause" ?disabled=${!canPause}>
            <span slot="icon">${pauseIcon()}</span>
            ${this.localize('knowledgeBasePauseAction')}
          </lr-menu-item>
          <lr-menu-item value="delete" variant="danger">
            <span slot="icon">${trashIcon()}</span>
            ${this.localize('knowledgeBaseDeleteAction')}
          </lr-menu-item>
    `;
  }

  private columnsCache?: {
    locale: string;
    strings: unknown;
    source: boolean;
    value: TableColumn<KnowledgeSource>[];
  };

  // Rebuilt only when the locale or the strings change, so the table keeps its caches otherwise.
  private tableColumns(): TableColumn<KnowledgeSource>[] {
    const { effectiveLocale: locale, strings } = this;
    const cached = this.columnsCache;
    if (cached?.locale === locale && cached.strings === strings && cached.source === this.sourceMode) return cached.value;
    const value: TableColumn<KnowledgeSource>[] = [
      {
        key: 'name',
        sortable: this.sourceMode,
        label: this.localize('knowledgeBaseNameColumn'),
        cell: (row) => this.renderNameCell(row),
      },
      {
        key: 'sync',
        sortable: this.sourceMode,
        label: this.localize('knowledgeBaseSyncColumn'),
        cell: (row) => this.renderSyncCell(row),
      },
      {
        key: 'health',
        sortable: this.sourceMode,
        label: this.localize('knowledgeBaseHealthColumn'),
        cell: (row) => this.renderHealthCell(row),
      },
      {
        key: 'permission',
        sortable: this.sourceMode,
        label: this.localize('knowledgeBasePermissionColumn'),
        cell: (row) => this.renderPermissionCell(row),
      },
      {
        key: 'actions',
        label: this.localize('knowledgeBaseActionsColumn'),
        align: 'end',
        cell: (row) => this.renderActionsCell(row),
      },
    ];
    this.columnsCache = { locale, strings, source: this.sourceMode, value };
    return value;
  }

  private renderSummary(sources: readonly KnowledgeSource[]): TemplateResult {
    const summary = this.sourceMode ? this.sourceResult?.summary : undefined;
    const total = summary?.total ?? sources.length;
    const synced = summary?.synced ?? sources.filter((s) => s.syncStatus === 'synced').length;
    const syncing = summary?.syncing ?? sources.filter((s) => s.syncStatus === 'syncing').length;
    const attention = summary?.attention ?? sources.filter(
      (s) =>
        s.syncStatus === 'error' ||
        s.indexingHealth === 'failed' ||
        s.indexingHealth === 'degraded'
    ).length;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return html`
      <div part="summary">
        <lr-stat
          part="summary-stat"
          label=${this.localize('knowledgeBaseTotalSources')}
          value=${numberFormat.format(total)}
        ></lr-stat>
        <lr-stat
          part="summary-stat"
          label=${this.localize('knowledgeBaseSyncedSources')}
          value=${numberFormat.format(synced)}
        ></lr-stat>
        <lr-stat
          part="summary-stat"
          label=${this.localize('knowledgeBaseSyncingSources')}
          value=${numberFormat.format(syncing)}
        ></lr-stat>
        <lr-stat
          part="summary-stat"
          variant=${attention > 0 ? 'danger' : 'neutral'}
          label=${this.localize('knowledgeBaseNeedsAttention')}
          value=${numberFormat.format(attention)}
        ></lr-stat>
      </div>
    `;
  }

  override render(): TemplateResult {
    const source = this.sourceMode;
    const sources = source ? this.sourceRows : this.normalizedSources;
    const current = this.sourceCurrent(); const version = this.sourceVersion;
    const state = this.sourcePages.state;
    const failed = source && !!(state.error || this.sourceFailure);
    if (source && !state.pending && (this.sourceResult || failed)) this.sourceTableShown = true;
    const columns = this.tableColumns();
    const heading =
      this.label == null ? this.localize('knowledgeBaseHeading') : this.label;
    // An explicitly blank heading is a visual choice; the grid still needs a name.
    const tableLabel =
      heading.trim() === '' ? this.localize('knowledgeBaseHeading') : heading;
    const level = resolveHeadingLevel(this.headingLevel);
    return html`
      <div part="base">
        <div part="toolbar">
          <div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${heading}</div>
          ${!this.withoutCreate
            ? html`<lr-button
                part="create-button"
                variant="brand"
                size="s"
                @click=${() => this.emit('lr-source-create')}
              >
                ${this.localize('knowledgeBaseCreateSource')}
              </lr-button>`
            : nothing}
        </div>
        ${source && !this.sourceResult
          ? html`<p part="source-status">${this.localize(failed ? 'tableLoadFailed' : 'loading')}</p>`
          : !this.withoutSummary && sources.length > 0 ? this.renderSummary(sources) : nothing}
        ${source && !this.sourceTableShown && !this.error ? nothing : html`
        <lr-table
          part="table"
          exportparts=${TABLE_EXPORT_PARTS}
          .columns=${columns}
          .strings=${this.strings}
          .paginationMode=${source ? 'server' : 'client'}
          .sortMode=${source ? 'server' : 'client'}
          .page=${source ? finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1 : 1}
          .pageSize=${source ? finiteInteger(this.sourcePageSize, 100, 1, 500) : 100}
          .sortKey=${source ? this.sourceSortKey ?? '' : ''}
          .sortDir=${source ? this.sourceSortDir : 'asc'}
          .totalItems=${source ? this.sourceTotal ?? 0 : 0}
          .unknownTotal=${source && this.sourceTotal === null}
          .hasNext=${false}
          .loading=${source && state.pending && !this.error}
          @lr-page-change=${(event: CustomEvent<{ page: number }>) => { if (!source) return; event.stopPropagation(); if (current()) this.sourcePage = event.detail.page - 1; }}
          @lr-sort-request=${(event: CustomEvent<{ sortKey: string; sortDir: 'asc' | 'desc' }>) => {
            if (!source) return;
            if (!current()) { event.preventDefault(); event.stopPropagation(); return; }
            this.sortRequest = { target: event.currentTarget, version, columns, key: event.detail.sortKey, dir: event.detail.sortDir };
          }}
          @lr-sort=${(event: CustomEvent<{ sortKey: string; sortDir: 'asc' | 'desc' }>) => {
            if (!source) return;
            const request = this.sortRequest; this.sortRequest = undefined;
            if (!current() || !request || request.target !== event.currentTarget || request.version !== version || request.columns !== this.tableColumns() || request.key !== event.detail.sortKey || request.dir !== event.detail.sortDir) { event.stopPropagation(); return; }
            this.sourceSortKey = event.detail.sortKey; this.sourceSortDir = event.detail.sortDir; this.syncSource(); this.sourceStateVersion++;
          }}
          .rows=${sources}
          .rowKey=${this.rowKey}
          aria-label=${tableLabel}
          empty-heading=${this.localize('knowledgeBaseEmptyHeading')}
          empty-description=${this.localize(
            'knowledgeBaseEmptyDescription',
            undefined
          )}
          ?error=${this.error || failed}
          error-heading=${this.errorHeading ?? nothing}
          error-description=${this.errorDescription}
          @lr-row-activate=${(e: Event) => e.stopPropagation()}
          @lr-row-click=${(e: Event) => e.stopPropagation()}
          @lr-retry-request=${(event: CustomEvent<null>) => { if (!source) { this.legacyTableRetry(event); return; } this.retrySource(event, current, failed); }}
        >${this.hasErrorSlot
          ? html`<div slot="error"><slot name="error"></slot></div>`
          : nothing}</lr-table>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-knowledge-base': LyraKnowledgeBase;
  }
}
