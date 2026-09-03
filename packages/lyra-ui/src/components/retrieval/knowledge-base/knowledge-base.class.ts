import {
  html,
  nothing,
  svg,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  getDateTimeFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import { playIcon, pauseIcon } from '../../../internal/icons.js';
import { styles } from './knowledge-base.styles.js';
import type { TableColumn } from '../../data/table/table.class.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import type { MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_knowledgeBaseActionsColumn, LYRA_DEFAULT_knowledgeBaseCreateSource, LYRA_DEFAULT_knowledgeBaseDeleteAction, LYRA_DEFAULT_knowledgeBaseDocumentCount, LYRA_DEFAULT_knowledgeBaseEmptyDescription, LYRA_DEFAULT_knowledgeBaseEmptyHeading, LYRA_DEFAULT_knowledgeBaseHeading, LYRA_DEFAULT_knowledgeBaseHealthColumn, LYRA_DEFAULT_knowledgeBaseHealthDegraded, LYRA_DEFAULT_knowledgeBaseHealthFailed, LYRA_DEFAULT_knowledgeBaseHealthHealthy, LYRA_DEFAULT_knowledgeBaseHealthUnknown, LYRA_DEFAULT_knowledgeBaseNameColumn, LYRA_DEFAULT_knowledgeBaseNeedsAttention, LYRA_DEFAULT_knowledgeBaseNeverSynced, LYRA_DEFAULT_knowledgeBasePauseAction, LYRA_DEFAULT_knowledgeBasePermissionColumn, LYRA_DEFAULT_knowledgeBasePermissionEditor, LYRA_DEFAULT_knowledgeBasePermissionOwner, LYRA_DEFAULT_knowledgeBasePermissionRestricted, LYRA_DEFAULT_knowledgeBasePermissionViewer, LYRA_DEFAULT_knowledgeBaseRowActionsLabel, LYRA_DEFAULT_knowledgeBaseSyncAction, LYRA_DEFAULT_knowledgeBaseSyncColumn, LYRA_DEFAULT_knowledgeBaseSyncError, LYRA_DEFAULT_knowledgeBaseSyncIdle, LYRA_DEFAULT_knowledgeBaseSyncPaused, LYRA_DEFAULT_knowledgeBaseSyncSynced, LYRA_DEFAULT_knowledgeBaseSyncSyncing, LYRA_DEFAULT_knowledgeBaseSyncedSources, LYRA_DEFAULT_knowledgeBaseSyncingSources, LYRA_DEFAULT_knowledgeBaseTotalSources, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings.generated.js';
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
  /** Epoch milliseconds or an ISO-8601 string, matching `LyraChatThread`/`ChatMessage`'s own
   *  `Date | string` timestamp convention elsewhere in this library. Omitted/unparseable renders as
   *  "never synced". */
  lastSyncedAt?: Date | string;
  /** Shown only while `syncStatus` is `'error'`. Caller-supplied data, not routed through
   *  `localize()`. */
  errorMessage?: string;
}

export interface LyraKnowledgeBaseEventMap {
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
 * `lr-row-click` is intentionally stopped from
 * propagating further (this component doesn't expose row-click/selection semantics -- only the
 * per-row action menu is interactive).
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank source ids and later duplicates are ignored before summary counts, rendering, or actions.
 * The first source for an id wins.
 *
 * @customElement lr-knowledge-base
 * @event lr-source-create - The toolbar "Add source" affordance was activated. No detail.
 * @event lr-source-sync - A row's "Sync now" action was activated. `detail: { sourceId }`.
 * @event lr-source-pause - A row's "Pause sync" action was activated. `detail: { sourceId }`.
 * @event lr-source-delete - A row's "Delete source" action was activated. `detail: { sourceId }`.
 * @csspart base - The root.
 * @csspart toolbar - The heading + "Add source" row.
 * @csspart heading - The heading text.
 * @csspart create-button - The "Add source" `<lr-button>`, omitted while `hideCreate` is set.
 * @csspart summary - The aggregate-stats row, omitted while `hideSummary` is set or `sources` is empty.
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
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'sources',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** The sources to list, in display order. */
  @property({ attribute: false }) sources: readonly KnowledgeSource[] = [];

  /** Heading text and the nested table's accessible name. A host `aria-label` independently
   *  names the complete component. Omitted falls back to a localized default. An explicitly
   *  empty `label` keeps the visible heading empty, but the nested table still receives the
   *  localized default as its accessible name so the grid is never left unnamed. */
  @property() label?: string;

  /** Hides the aggregate summary row (total/synced/syncing/needs-attention). */
  @property({ type: Boolean, attribute: 'hide-summary', reflect: true })
  hideSummary = false;

  /** Hides the toolbar's "Add source" affordance, e.g. for a read-only or permission-gated view. */
  @property({ type: Boolean, attribute: 'hide-create', reflect: true })
  hideCreate = false;

  private get normalizedSources(): KnowledgeSource[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.sources) ? this.sources : [],
      (source) => source.id
    );
  }

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
      case 'unknown':
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
          variant=${SYNC_STATUS_VARIANT[source.syncStatus]}
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
        <lr-badge part="health-badge" variant=${HEALTH_VARIANT[health]}
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
      variant=${PERMISSION_VARIANT[source.permission]}
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

  private renderActionsCell(source: KnowledgeSource): TemplateResult {
    const canPause = source.syncStatus === 'syncing';
    const canSync = source.syncStatus !== 'syncing';
    const label = this.localize('knowledgeBaseRowActionsLabel', undefined, {
      name: this.sourceName(source),
    });
    return html`
      <lr-dropdown part="actions-menu" placement="bottom-end">
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
            this.onRowAction(source, e.detail.item.value);
          }}
        >
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
        </lr-menu>
      </lr-dropdown>
    `;
  }

  // Recomputed every render (not memoized) so column labels stay correct across a locale change --
  // this list is small (five columns), so the recomputation cost is negligible.
  private tableColumns(): TableColumn<KnowledgeSource>[] {
    return [
      {
        key: 'name',
        label: this.localize('knowledgeBaseNameColumn'),
        cell: (row) => this.renderNameCell(row),
      },
      {
        key: 'sync',
        label: this.localize('knowledgeBaseSyncColumn'),
        cell: (row) => this.renderSyncCell(row),
      },
      {
        key: 'health',
        label: this.localize('knowledgeBaseHealthColumn'),
        cell: (row) => this.renderHealthCell(row),
      },
      {
        key: 'permission',
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
  }

  private renderSummary(sources: readonly KnowledgeSource[]): TemplateResult {
    const total = sources.length;
    const synced = sources.filter((s) => s.syncStatus === 'synced').length;
    const syncing = sources.filter((s) => s.syncStatus === 'syncing').length;
    const attention = sources.filter(
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
    const sources = this.normalizedSources;
    const heading =
      this.label == null ? this.localize('knowledgeBaseHeading') : this.label;
    // An explicitly blank heading is a visual choice; the grid still needs a name.
    const tableLabel =
      heading.trim() === '' ? this.localize('knowledgeBaseHeading') : heading;
    return html`
      <div part="base">
        <div part="toolbar">
          <h3 part="heading">${heading}</h3>
          ${!this.hideCreate
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
        ${!this.hideSummary && sources.length > 0
          ? this.renderSummary(sources)
          : nothing}
        <lr-table
          part="table"
          exportparts=${TABLE_EXPORT_PARTS}
          .columns=${this.tableColumns()}
          .rows=${sources}
          .rowKey=${(row: KnowledgeSource) => row.id}
          .accessibleLabel=${tableLabel}
          empty-heading=${this.localize('knowledgeBaseEmptyHeading')}
          empty-description=${this.localize(
            'knowledgeBaseEmptyDescription',
            undefined
          )}
          @lr-row-click=${(e: Event) => e.stopPropagation()}
        ></lr-table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-knowledge-base': LyraKnowledgeBase;
  }
}
