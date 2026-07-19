import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { getDateTimeFormat } from '../../internal/intl-cache.js';
import { playIcon, pauseIcon } from '../../internal/icons.js';
import { styles } from './knowledge-base.styles.js';
import type { TableColumn } from '../table/table.class.js';
import '../table/table.js';
import type { BadgeVariant } from '../badge/badge.class.js';
import '../badge/badge.js';
import '../stat/stat.js';
import type { MenuSelectDetail } from '../menu/menu.class.js';
import '../menu/menu.js';
import '../button/button.js';

/** Sync lifecycle state of one knowledge source, as last reported by the host. */
export type KnowledgeSourceSyncStatus = 'idle' | 'syncing' | 'paused' | 'synced' | 'error';

/** Health of the most recent indexing pass over a source's content, as last reported by the host. */
export type KnowledgeSourceIndexingHealth = 'healthy' | 'degraded' | 'failed' | 'unknown';

/** The current viewer's access level on a source -- informational only (see the class doc's
 *  authorization note). */
export type KnowledgeSourcePermission = 'owner' | 'editor' | 'viewer' | 'restricted';

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
  /** Epoch milliseconds or an ISO-8601 string, matching `ChatThread`/`ChatMessage`'s own
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
  'lr-kb-create': CustomEvent<undefined>;
  /** A row's "Sync now" action was activated. */
  'lr-kb-sync': CustomEvent<{ sourceId: string }>;
  /** A row's "Pause sync" action was activated. */
  'lr-kb-pause': CustomEvent<{ sourceId: string }>;
  /** A row's "Delete source" action was activated. No built-in confirmation, matching
   *  `lr-thread-list`'s identical `lr-thread-delete` contract. */
  'lr-kb-delete': CustomEvent<{ sourceId: string }>;
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

function normalizeTimestamp(value: Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * `<lr-knowledge-base>` — a source list for a retrieval knowledge base: sync status, indexing
 * health, permissions, and per-row create/sync/pause/delete affordances. A controlled data view,
 * like every other Lyra data component: it never syncs or indexes anything itself, only presents
 * `sources` and emits request-only events (`lr-kb-create`/`-sync`/`-pause`/`-delete`) for the host
 * to act on and reflect back into a new `sources` value -- mirrors `lr-thread-list`'s
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
 * custom-element or `role="menuitem"` cell content as interactive, so the per-row `<lr-menu>` never
 * misfires the table's row-click handling), `<lr-badge>` for the sync-status/indexing-health/
 * permission indicators, `<lr-stat>` for the aggregate summary row above the table, and `<lr-menu>`
 * for the per-row action affordances. The table's own `lr-row-click` is intentionally stopped from
 * propagating further (this component doesn't expose row-click/selection semantics -- only the
 * per-row action menu is interactive).
 *
 * @customElement lr-knowledge-base
 * @event lr-kb-create - The toolbar "Add source" affordance was activated. No detail.
 * @event lr-kb-sync - A row's "Sync now" action was activated. `detail: { sourceId }`.
 * @event lr-kb-pause - A row's "Pause sync" action was activated. `detail: { sourceId }`.
 * @event lr-kb-delete - A row's "Delete source" action was activated. `detail: { sourceId }`.
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
 * @csspart actions-menu - A row's `<lr-menu>`.
 * @csspart actions-trigger - The kebab `<button>` opening a row's action menu.
 */
export class LyraKnowledgeBase extends LyraElement<LyraKnowledgeBaseEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The sources to list, in display order. */
  @property({ attribute: false }) sources: KnowledgeSource[] = [];

  /** Heading text and the table's accessible name. Falls back to a localized default. */
  @property() label = '';

  /** Hides the aggregate summary row (total/synced/syncing/needs-attention). */
  @property({ type: Boolean, attribute: 'hide-summary', reflect: true }) hideSummary = false;

  /** Hides the toolbar's "Add source" affordance, e.g. for a read-only or permission-gated view. */
  @property({ type: Boolean, attribute: 'hide-create', reflect: true }) hideCreate = false;

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

  private renderNameCell(source: KnowledgeSource): TemplateResult {
    return html`
      <div part="name-cell">
        <span part="source-name">${source.name}</span>
        ${source.type ? html`<span part="source-type">${source.type}</span>` : nothing}
      </div>
    `;
  }

  private renderSyncCell(source: KnowledgeSource): TemplateResult {
    const lastSynced = normalizeTimestamp(source.lastSyncedAt);
    return html`
      <div part="sync-cell">
        <lr-badge part="sync-badge" variant=${SYNC_STATUS_VARIANT[source.syncStatus]}
          >${this.syncStatusLabel(source.syncStatus)}</lr-badge
        >
        <span part="sync-timestamp">
          ${lastSynced
            ? getDateTimeFormat(this.effectiveLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(lastSynced)
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
        <lr-badge part="health-badge" variant=${HEALTH_VARIANT[health]}>${this.healthLabel(health)}</lr-badge>
        ${source.documentCount != null
          ? html`<span part="document-count"
              >${this.localize('knowledgeBaseDocumentCount', undefined, {
                count: source.documentCount,
              })}</span
            >`
          : nothing}
      </div>
    `;
  }

  private renderPermissionCell(source: KnowledgeSource): TemplateResult {
    if (!source.permission) return html``;
    return html`<lr-badge part="permission-badge" variant=${PERMISSION_VARIANT[source.permission]}
      >${this.permissionLabel(source.permission)}</lr-badge
    >`;
  }

  private onRowAction(source: KnowledgeSource, action: string): void {
    if (action === 'sync') this.emit('lr-kb-sync', { sourceId: source.id });
    else if (action === 'pause') this.emit('lr-kb-pause', { sourceId: source.id });
    else if (action === 'delete') this.emit('lr-kb-delete', { sourceId: source.id });
  }

  private renderActionsCell(source: KnowledgeSource): TemplateResult {
    const canPause = source.syncStatus === 'syncing';
    const canSync = source.syncStatus !== 'syncing';
    const label = this.localize('knowledgeBaseRowActionsLabel', undefined, { name: source.name });
    return html`
      <lr-menu
        part="actions-menu"
        label=${label}
        @lr-menu-select=${(e: CustomEvent<MenuSelectDetail>) => this.onRowAction(source, e.detail.value)}
      >
        <button slot="trigger" type="button" part="actions-trigger" aria-label=${label}>${kebabIcon()}</button>
        <lr-menu-item value="sync" ?disabled=${!canSync}>
          <span slot="icon">${playIcon()}</span>
          ${this.localize('knowledgeBaseSyncAction')}
        </lr-menu-item>
        <lr-menu-item value="pause" ?disabled=${!canPause}>
          <span slot="icon">${pauseIcon()}</span>
          ${this.localize('knowledgeBasePauseAction')}
        </lr-menu-item>
        <lr-menu-item value="delete" destructive>
          <span slot="icon">${trashIcon()}</span>
          ${this.localize('knowledgeBaseDeleteAction')}
        </lr-menu-item>
      </lr-menu>
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

  private renderSummary(): TemplateResult {
    const total = this.sources.length;
    const synced = this.sources.filter((s) => s.syncStatus === 'synced').length;
    const syncing = this.sources.filter((s) => s.syncStatus === 'syncing').length;
    const attention = this.sources.filter(
      (s) => s.syncStatus === 'error' || s.indexingHealth === 'failed' || s.indexingHealth === 'degraded',
    ).length;
    return html`
      <div part="summary">
        <lr-stat
          part="summary-stat"
          label=${this.localize('knowledgeBaseTotalSources')}
          value=${String(total)}
        ></lr-stat>
        <lr-stat
          part="summary-stat"
          label=${this.localize('knowledgeBaseSyncedSources')}
          value=${String(synced)}
        ></lr-stat>
        <lr-stat
          part="summary-stat"
          label=${this.localize('knowledgeBaseSyncingSources')}
          value=${String(syncing)}
        ></lr-stat>
        <lr-stat
          part="summary-stat"
          variant=${attention > 0 ? 'danger' : 'neutral'}
          label=${this.localize('knowledgeBaseNeedsAttention')}
          value=${String(attention)}
        ></lr-stat>
      </div>
    `;
  }

  render(): TemplateResult {
    const heading = this.label || this.localize('knowledgeBaseHeading');
    return html`
      <div part="base">
        <div part="toolbar">
          <h3 part="heading">${heading}</h3>
          ${!this.hideCreate
            ? html`<lr-button
                part="create-button"
                variant="brand"
                size="s"
                @click=${() => this.emit('lr-kb-create')}
              >
                ${this.localize('knowledgeBaseCreateSource')}
              </lr-button>`
            : nothing}
        </div>
        ${!this.hideSummary && this.sources.length > 0 ? this.renderSummary() : nothing}
        <lr-table
          part="table"
          .columns=${this.tableColumns()}
          .rows=${this.sources}
          .rowKey=${(row: KnowledgeSource) => row.id}
          aria-label=${heading}
          empty-heading=${this.localize('knowledgeBaseEmptyHeading')}
          empty-description=${this.localize('knowledgeBaseEmptyDescription', undefined,
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
