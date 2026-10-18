import type { GraphSource } from '../graph/graph.class.js';
import type { LyraGraphNode } from '../graph/graph-model.js';
import type { LyraGraphSourceQuery, LyraGraphSourceSummary, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';
import '../../data/pagination/pagination.class.js';

export type NeighborListSource = GraphSource;
export type NeighborSourceDirection = LyraGraphSourceQuery['direction'];
type NeighborSourceRow = LyraSourceRecord<LyraGraphNode>;
function sourceField(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid neighborhood value');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor && !('value' in descriptor)) throw new TypeError('Accessor neighborhood field');
  return descriptor?.value;
}
function sourceRows(raw: unknown, limit: number): readonly NeighborSourceRow[] {
  if (!Array.isArray(raw)) throw new TypeError('Invalid neighborhood page');
  const length = sourceCount(sourceField(raw, 'length'));
  if (length > limit) throw new RangeError('Neighborhood page limit');
  let units = 0;
  const text = (value: unknown, required = false): string | undefined => {
    if (value === undefined && !required) return undefined;
    if (typeof value !== 'string' || (required && !value.trim()) || value.length > 65_536 || (units += value.length) > 2_000_000) throw new TypeError('Invalid neighborhood text');
    return value;
  };
  return Object.freeze(Array.from({ length }, (_, index) => {
    const entry = sourceField(raw, index), record = sourceField(entry, 'value');
    if (sourceField(record, 'kind') !== 'node') throw new TypeError('Expected neighborhood node');
    const node = sourceField(record, 'value'), key = text(sourceField(entry, 'key'), true)!;
    const id = text(sourceField(node, 'id'), true)!;
    if (key !== `node:${id}`) throw new TypeError('Invalid neighborhood identity');
    const label = text(sourceField(node, 'label')), accessibleLabel = text(sourceField(node, 'accessibleLabel'));
    const type = text(sourceField(node, 'type'));
    return Object.freeze({ key, order: sourceCount(sourceField(entry, 'order')), value: Object.freeze({ id,
      ...(label === undefined ? {} : { label }), ...(accessibleLabel === undefined ? {} : { accessibleLabel }), ...(type === undefined ? {} : { type }),
    }) });
  }));
}
function sourceSummary(raw: unknown): LyraGraphSourceSummary {
  return Object.freeze({ nodes: sourceCount(sourceField(raw, 'nodes')), edges: sourceCount(sourceField(raw, 'edges')) });
}
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { lyraLocaleCatalogVersion } from '../../../internal/localization-runtime.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { expandIcon } from '../../../internal/icons.js';
import { finiteInteger, finiteCount } from '../../../internal/numbers.js';
import {
  getCollator,
  getListFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import type { LyraVirtualListGroup } from '../../layout/virtual-list/virtual-list.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './neighbor-list.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_graphDataListLimit, LYRA_DEFAULT_neighborExpand, LYRA_DEFAULT_neighborGroupHeader, LYRA_DEFAULT_neighborListEmpty, LYRA_DEFAULT_neighborListLabel, LYRA_DEFAULT_neighborRowLabel, LYRA_DEFAULT_neighborSourceChoose, LYRA_DEFAULT_neighborSourceError, LYRA_DEFAULT_neighborSourceSummary } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_loading, LYRA_DEFAULT_neighborDirectionBoth, LYRA_DEFAULT_neighborDirectionIn, LYRA_DEFAULT_neighborDirectionOut, LYRA_DEFAULT_retry } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

let virtualListRegistration: Promise<unknown> | undefined;

export interface LyraNeighborRow {
  /** Edge label, e.g. `'works_for'`. */
  relation: string;
  direction: 'in' | 'out' | 'both';
  node: LyraEntity;
}

export interface LyraNeighborListEventMap {
  /** Canonical name for the "user picked this entity" gesture. */
  'lr-entity-select': CustomEvent<{ entityId: string }>;
  /** Deliberately the *same name and detail* as the `lr-graph` event, so one host handler
   *  serves both ("expand this node's neighborhood"). */
  'lr-node-expand': CustomEvent<{ nodeId: string }>;
}

/**
 * `<lr-neighbor-list>` — one entity's relationship rows: relation, direction, neighbor, with
 * per-row navigate and expand-in-graph affordances. Never computes neighbors itself (the host
 * derives rows from its own graph data) and never mutates a graph.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-neighbor-list
 * @event lr-entity-select - A row's node button was activated. `detail: { entityId }`.
 * @event lr-node-expand - A row's expand button was activated (only rendered when `expandable`).
 * `detail: { nodeId }`.
 * @csspart base - The stable root wrapper across empty, populated and virtualized states. It owns
 *   `role="group"` and the fallback name unless a non-empty host `aria-label` owns the component;
 *   a nested list owns the row semantics in non-virtualized mode.
 * @csspart group-header - A relation group header, only rendered when `groupByRelation`. Above
 *   `virtualizeAt` this is the internal virtual-list's own group label, re-exported under the same
 *   name so both paths present identically.
 * @csspart row - One relationship row (`role="listitem"`). Above `virtualizeAt` this is the
 *   internal virtual-list's own row wrapper, re-exported under the same name.
 * @csspart direction - The `aria-hidden` direction glyph.
 * @csspart relation - The relation text.
 * @csspart node-label - The row's node `<button>`.
 * @csspart node-meta - Secondary node text (type/degree), when present.
 * @csspart expand-button - The per-row expand-in-graph icon button, only rendered when `expandable`.
 * @csspart limit - Localized retained/source counts when the row assignment exceeds its input boundary.
 * @csspart source-status - Source loading, failure, empty, or missing-center status.
 * @csspart source-summary - Exact neighborhood total and current page count.
 * @csspart source-retry - Retry action for the current failed source request.
 * @csspart empty - The empty-state message, shown when `rows` is empty.
 * @status stable
 * @since 4.0.0
 */
export class LyraNeighborList extends LyraElement<LyraNeighborListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    graphDataListLimit: LYRA_DEFAULT_graphDataListLimit,
    loading: LYRA_DEFAULT_loading,
    neighborDirectionBoth: LYRA_DEFAULT_neighborDirectionBoth,
    neighborDirectionIn: LYRA_DEFAULT_neighborDirectionIn,
    neighborDirectionOut: LYRA_DEFAULT_neighborDirectionOut,
    neighborExpand: LYRA_DEFAULT_neighborExpand,
    neighborGroupHeader: LYRA_DEFAULT_neighborGroupHeader,
    neighborListEmpty: LYRA_DEFAULT_neighborListEmpty,
    neighborListLabel: LYRA_DEFAULT_neighborListLabel,
    neighborRowLabel: LYRA_DEFAULT_neighborRowLabel,
    neighborSourceChoose: LYRA_DEFAULT_neighborSourceChoose,
    neighborSourceError: LYRA_DEFAULT_neighborSourceError,
    neighborSourceSummary: LYRA_DEFAULT_neighborSourceSummary,
    retry: LYRA_DEFAULT_retry,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'rows',
    'types',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** Neighbor relationships to render, including direction, relation, and target node data. */
  @property({ attribute: false }) rows: readonly LyraNeighborRow[] = [];
  /** `lr-graph` `nodeTypes` pass-through that names each node's type by its label, as
   *  `lr-entity-card` does; an unresolvable type shows its raw id. */
  @property({ attribute: false }) types: readonly LyraNodeTypeStyle[] = [];
  private typeLabels?: [readonly LyraNodeTypeStyle[], Map<string, string | undefined>];
  /** Stable-sorts rows by relation and renders one group header per relation with a count. */
  @property({ type: Boolean, attribute: 'group-by-relation' }) groupByRelation =
    false;
  /** Shows a per-row expand icon-button emitting `lr-node-expand`. */
  @property({ type: Boolean }) expandable = false;
  /** Above this row count the list renders through an internal `lr-virtual-list`. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 100;
  /** Accessible name for the stable group when the host has no `aria-label`; falls back to the
   *  localized `neighborListLabel` default when omitted. An explicitly empty host label stays
   *  empty, and so does an explicitly empty `label`. */
  @property() label?: string;

  private _graphSource?: NeighborListSource;
  /** Full node-neighborhood provider. Wins over rows while defined. Reassign (even the same
   * source) or call requestUpdate() to refresh; unset restores rows. Relation grouping and
   * per-row direction are unavailable because node records do not carry edge metadata. */
  @property({ attribute: false })
  get graphSource(): NeighborListSource | undefined { return this._graphSource; }
  set graphSource(value: NeighborListSource | undefined) {
    const previous = this._graphSource; this._graphSource = value; this.requestUpdate('graphSource', previous);
    if (previous === value) super.requestUpdate();
  }
  /** Canonical node key whose neighborhood is shown; null makes no provider request. */
  @property({ attribute: false }) centerKey: string | null = null;
  /** Direction filter for the entire neighborhood, not a per-row edge direction. */
  @property({ attribute: 'source-direction' }) sourceDirection: NeighborSourceDirection = 'both';
  private _sourceNodeTypes: readonly string[] = Object.freeze([]);
  private sourceTypesError = false;
  private sourceTypesVersion = 0;
  /** At most 500 distinct nonblank type IDs; 65,536 units each and 2,000,000 combined. */
  @property({ attribute: false })
  get sourceNodeTypes(): readonly string[] { return this._sourceNodeTypes; }
  set sourceNodeTypes(value: readonly string[]) {
    const previous = this._sourceNodeTypes, transaction = ++this.sourceTypesVersion;
    try {
      if (!Array.isArray(value)) throw new TypeError('Invalid neighborhood types');
      const length = sourceCount(sourceField(value, 'length'));
      if (length > 500) throw new RangeError('Neighborhood type limit');
      const types = new Set<string>(); let units = 0;
      for (let i = 0; i < length; i++) {
        const item = sourceField(value, i);
        if (typeof item !== 'string' || !item.trim() || item.length > 65_536) throw new TypeError('Invalid neighborhood type');
        if (!types.has(item)) { units += item.length; if (units > 2_000_000) throw new RangeError('Neighborhood type budget'); types.add(item); }
      }
      if (transaction !== this.sourceTypesVersion) return;
      this._sourceNodeTypes = Object.freeze([...types].sort()); this.sourceTypesError = false;
    } catch { if (transaction !== this.sourceTypesVersion) return; this._sourceNodeTypes = Object.freeze([]); this.sourceTypesError = true; }
    this.requestUpdate('sourceNodeTypes', previous);
  }
  /** Zero-based full-neighborhood page. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Requested page size, normalized to 1–500, default 100. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact matching neighborhood count, or null before a current successful query. */
  get sourceTotal(): number | null { return this.graphSource !== undefined && this.centerKey !== null && !this.sourceError && this.sourceBinding?.[3] === this.sourceEpoch ? this.sourcePages.state.result?.total ?? null : null; }
  private sourceEpoch = 0;
  private sourceNavigation = 0;
  private sourcePaint = 0;
  private sourceBinding?: readonly unknown[];
  private sourcePageBinding?: readonly unknown[];
  private sourceError = false;
  private sourceFailedEpoch?: number;
  private sourceSyncing = false;
  private sourcePromise: Promise<boolean> = Promise.resolve(false);
  private readonly sourcePages = new SourcePageController<LyraGraphNode, LyraGraphSourceQuery, LyraGraphSourceSummary>(this, {
    normalizeRecord: row => row as NeighborSourceRow,
    normalizeSummary: sourceSummary,
    validateMetadata: result => { if (result.total > result.summary.nodes) throw new RangeError('Invalid neighborhood total'); },
    onChange: () => { const old = this.sourcePaint++; this.requestUpdate('sourcePaint', old); },
  });

  private sourceCurrent(): () => boolean {
    const source = this.graphSource, epoch = this.sourceEpoch, owner = this.ownerDocument;
    let revision: unknown;
    try { revision = source?.revision; } catch { return () => false; }
    return () => {
      try { return source?.revision === revision && this.isConnected && this.ownerDocument === owner && this.graphSource === source && this.sourceEpoch === epoch; }
      catch { return false; }
    };
  }
  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    const epoch = this.sourceEpoch;
    try {
      if (this.sourceError && this.sourceFailedEpoch === epoch) return;
      const source = this.graphSource;
      if (source === undefined || this.centerKey === null || !this.isConnected) {
        if (this.sourceBinding || this.sourcePageBinding) this.sourcePages.bind(undefined);
        this.sourceBinding = undefined; this.sourcePageBinding = undefined; this.sourceError = false; return;
      }
      if (this.sourceTypesError || typeof this.centerKey !== 'string' || !this.centerKey.startsWith('node:') || !this.centerKey.slice(5).trim() || this.centerKey.length > 65_536 || !['in', 'out', 'both'].includes(this.sourceDirection)) throw new TypeError('Invalid neighborhood scope');
      const revision = sourceRevision(source.revision), records = source.records, locale = this.effectiveLocale;
      const queryRead = records.query, lookupRead = records.lookup, locateRead = records.locate;
      if (sourceRevision(records.revision) !== revision || typeof queryRead !== 'function' || typeof lookupRead !== 'function' || typeof locateRead !== 'function') throw new TypeError('Invalid neighborhood provider');
      if (epoch !== this.sourceEpoch || source !== this.graphSource) return;
      const binding = [source, records, revision, epoch, locale];
      if (!this.sourceBinding || binding.some((value, index) => value !== this.sourceBinding![index])) {
        this.sourceBinding = binding; this.sourcePageBinding = undefined; this.sourceError = false;
        const current = () => {
          const same = source.revision === revision && source.records === records && records.revision === revision;
          return same && this.isConnected && epoch === this.sourceEpoch && source === this.graphSource;
        };
        const check = () => { if (!current()) throw new Error('Obsolete neighborhood'); };
        this.sourcePages.bind({ revision, epoch, locale, source: { revision,
          query: async request => {
            check(); const raw = await queryRead.call(records, request); check();
            if (sourceField(raw, 'groups') !== undefined || sourceField(raw, 'tags') !== undefined) throw new TypeError('Unexpected neighborhood metadata');
            const result = { rows: sourceRows(sourceField(raw, 'rows'), request.pageSize), total: sourceCount(sourceField(raw, 'total')), summary: sourceSummary(sourceField(raw, 'summary')) }; check(); return result;
          },
          lookup: async (keys, context) => { check(); const raw = await lookupRead.call(records, keys, context); check(); const rows = sourceRows(raw, keys.length); check(); return rows; },
          locate: async (key, query, context) => { check(); const result = await locateRead.call(records, key, query, context); check(); return result; },
        } });
        if (epoch !== this.sourceEpoch || source !== this.graphSource) return;
      }
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      const page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      const signature = [page, size, this.centerKey, this.sourceDirection, this.sourceNodeTypes];
      if (!this.sourcePageBinding || signature.some((value, index) => value !== this.sourcePageBinding![index])) {
        this.sourcePageBinding = signature;
        this.sourcePromise = this.sourcePages.request(Object.freeze({ kind: 'nodes', search: '', centerKey: this.centerKey, direction: this.sourceDirection, nodeTypes: this.sourceNodeTypes }), page, size);
      }
    } catch {
      if (epoch === this.sourceEpoch) { this.sourceError = true; this.sourceFailedEpoch = epoch; this.sourcePages.bind(undefined); this.sourceBinding = undefined; this.sourcePageBinding = undefined; }
    } finally {
      this.sourceSyncing = false;
      if (epoch !== this.sourceEpoch) queueMicrotask(() => { const old = this.sourcePaint++; this.requestUpdate('sourcePaint', old); });
    }
  }
  /** Reveals and focuses a global neighborhood node without selecting or expanding it. */
  async revealSourceKey(key: string): Promise<boolean> {
    const navigation = ++this.sourceNavigation;
    if (this.graphSource === undefined || this.centerKey === null || typeof key !== 'string' || !key.startsWith('node:') || !key.slice(5).trim() || key.length > 65_536) return false;
    this.syncSource(); const sourceCurrent = this.sourceCurrent();
    const current = () => sourceCurrent() && this.sourceNavigation === navigation;
    await this.sourcePromise; if (!current() || this.sourceError) return false;
    const index = await this.sourcePages.locate(key); if (!current() || index === null) return false;
    this.sourceSyncing = true;
    this.sourcePage = Math.floor(index / finiteInteger(this.sourcePageSize, 100, 1, 500));
    this.sourceSyncing = false; this.syncSource(); await this.sourcePromise; await this.updateComplete;
    if (!current()) return false;
    const target = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-source-key]')].find(node => node.dataset['sourceKey'] === key);
    if (!target || !current()) return false;
    target.scrollIntoView({ block: 'nearest' }); if (!current()) return false;
    target.focus(); return current() && this.renderRoot.querySelector('[data-source-key]:focus') === target;
  }
  override connectedCallback(): void { super.connectedCallback(); this.sourceEpoch++; this.syncSource(); }
  override disconnectedCallback(): void {
    this.sourceEpoch++; this.sourceNavigation++; this.sourcePages.bind(undefined); this.sourceBinding = undefined; this.sourcePageBinding = undefined;
    super.disconnectedCallback();
  }

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the property's
   *  own default of `100`) -- a raw `NaN` (e.g. an invalid `virtualize-at` attribute) would
   *  otherwise make `sorted.length > virtualizeAt` always false, silently disabling
   *  virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 100);
  }

  // Memoized across renders that do not actually change the identity-deduped/sorted/grouped
  // output, so the `.items`/`.groups` bindings on the composed `<lr-virtual-list>` keep the same
  // array reference and it never has to clear its measured row heights / recompute offsets for an
  // unrelated reactive update (e.g. `expandable`, `label`). `willUpdate()` refreshes the cache
  // before `render()` ever reads it, mirroring `lr-retrieval-results`'s `processedChunksCache`.
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private sortedRowsCache: readonly LyraNeighborRow[] = [];
  private groupsCache: LyraVirtualListGroup[] | undefined;
  private hasComputedRows = false;
  private processedSignature = '';
  private explicitRefresh = 0;
  private groupDeps?: readonly unknown[];
  private presentationDeps?: readonly unknown[];
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (this.sourcePages && (!this.sourceSyncing || args[0] !== 'sourcePage')) {
      if (args[0] === undefined || ['graphSource', 'centerKey', 'sourceDirection', 'sourceNodeTypes', 'sourcePageSize'].includes(String(args[0]))) {
        this.sourceEpoch++; this.sourceNavigation++;
        if (['centerKey', 'sourceDirection', 'sourceNodeTypes', 'sourcePageSize'].includes(String(args[0]))) { const syncing = this.sourceSyncing; this.sourceSyncing = true; this.sourcePage = 0; this.sourceSyncing = syncing; }
      } else if (args[0] === 'sourcePage') this.sourceNavigation++;
    }
    if (args[0] === undefined) this.explicitRefresh = (this.explicitRefresh ?? 0) + 1;
    super.requestUpdate(...args);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.graphSource !== undefined) {
      if (changed.has('rows') || changed.has('groupByRelation')) this.hasComputedRows = false;
      return;
    }
    if (this.hasUpdated && changed.has('rows')) {
      const message = this.inputLimitMessage();
      if (message) this.announcements.announcePolite(message);
    }
    // Locale (and a `strings` override) affect both the collator used to sort and the group
    // header text/count formatting, but neither reaches this component through a tracked
    // `@property`, so the signature captures the resolved locale directly rather than relying on
    // `changed`.
    const signature = `${this.effectiveLocale} ${this.groupByRelation}`;
    if (
      !this.hasComputedRows ||
      changed.has('rows') ||
      changed.has('groupByRelation') ||
      signature !== this.processedSignature
    ) {
      this.hasComputedRows = true;
      this.processedSignature = signature;
      this.sortedRowsCache = this.computeSortedRows();
    }
    const groupDeps = [this.sortedRowsCache, this.effectiveLocale, this.strings,
      lyraLocaleCatalogVersion(this.effectiveLocale), this.explicitRefresh];
    if (!this.groupDeps || groupDeps.some((value, index) => value !== this.groupDeps![index])) {
      this.groupDeps = groupDeps;
      this.groupsCache = this.computeGroups(this.sortedRowsCache);
    }
    const presentationDeps = [...groupDeps, this.types, this.expandable];
    if (!this.presentationDeps || presentationDeps.some((value, index) => value !== this.presentationDeps![index])) {
      this.presentationDeps = presentationDeps;
      this.renderRow = item => this.renderNeighborRow(item as LyraNeighborRow);
    }
    // Registered on first need, so bundles whose lists stay short never load the virtualizer.
    if (this.sortedRowsCache.length > this.effectiveVirtualizeAt)
      virtualListRegistration ??= import('../../layout/virtual-list/virtual-list.js').catch(
        () => (virtualListRegistration = undefined)
      );
  }

  private sortedRows(): readonly LyraNeighborRow[] {
    return this.sortedRowsCache;
  }

  private computeSortedRows(): readonly LyraNeighborRow[] {
    const rows = firstByRetrievalIdentity(this.rows, (row) => row?.node?.id);
    if (!this.groupByRelation) return rows;
    // Array.prototype.sort is spec-guaranteed stable (ES2019+) -- rows sharing a relation keep
    // their original relative order.
    const compare = getCollator(this.effectiveLocale).compare;
    return rows.sort((a, b) => compare(a.relation, b.relation));
  }

  private groups(
    sorted: readonly LyraNeighborRow[]
  ): LyraVirtualListGroup[] | undefined {
    if (sorted === this.sortedRowsCache) return this.groupsCache;
    return this.computeGroups(sorted);
  }

  private computeGroups(
    sorted: readonly LyraNeighborRow[]
  ): LyraVirtualListGroup[] | undefined {
    if (!this.groupByRelation) return undefined;
    const groups: LyraVirtualListGroup[] = [];
    const counts = new Map<string, number>();
    for (const row of sorted)
      counts.set(row.relation, (counts.get(row.relation) ?? 0) + 1);
    const numberFormat = getNumberFormat(this.effectiveLocale);
    let lastRelation: string | undefined;
    sorted.forEach((row, i) => {
      if (row.relation !== lastRelation) {
        const count = numberFormat.format(counts.get(row.relation) ?? 0);
        groups.push({
          key: row.relation,
          label: this.localize('neighborGroupHeader', undefined, {
            relation: row.relation,
            count,
          }),
          startIndex: i,
        });
        lastRelation = row.relation;
      }
    });
    return groups;
  }

  /** The arrow encodes the graph edge's actual direction (outgoing vs incoming) -- real semantic
   *  data about which entity points to which -- so its meaning must stay fixed regardless of
   *  reading direction; it is never derived from `isRtl()`. Only the row's overall layout (icon
   *  position, text order) mirrors under RTL, and it already does so for free via this row's
   *  inline-axis flex flow (`neighbor-list.styles.ts`'s `[part='row']` rule) -- no code here needs
   *  to reason about direction at all. See docs/agents/i18n-rtl-theming.md: "directional glyphs
   *  mirror via the wrapping part, not the icon." */
  private directionGlyph(direction: LyraNeighborRow['direction']): string {
    if (direction === 'both') return '↔';
    return direction === 'out' ? '→' : '←';
  }

  private directionText(direction: LyraNeighborRow['direction']): string {
    return this.localize(
      direction === 'in'
        ? 'neighborDirectionIn'
        : direction === 'out'
        ? 'neighborDirectionOut'
        : 'neighborDirectionBoth'
    );
  }

  private renderRow = (item: unknown): TemplateResult =>
    this.renderNeighborRow(item as LyraNeighborRow);

  // Stable across every render (unlike an inline arrow literal in the template) so the composed
  // `<lr-virtual-list>`'s `.keyFunction` binding never appears to change on an unrelated
  // re-render, which would otherwise force it to rebuild row identity/offsets from scratch.
  private readonly virtualListKeyFunction = (item: unknown): string =>
    (item as LyraNeighborRow).node.id;

  /** Returns only a row's *content*, not its surrounding `role="listitem"`/`part="row"` wrapper:
   *  `<lr-virtual-list>` already supplies exactly such a wrapper (exported from here as `row`) for
   *  every virtualized row, and a second nested one would both duplicate the `listitem` role and
   *  be matched a second time by `lr-virtual-list::part(row)` -- `::part()` uses `part~=` semantics
   *  and reaches any depth of the target shadow tree -- doubling the row's padding and divider
   *  border. The non-virtualized path below supplies the identical wrapper itself. */
  private renderNeighborRow(row: LyraNeighborRow): TemplateResult {
    const nodeLabel = row.node.label || row.node.id;
    const directionText = this.directionText(row.direction);
    const accessibleName = this.localize('neighborRowLabel', undefined, {
      label: nodeLabel,
      relation: row.relation,
      direction: directionText,
    });
    const nodeType =
      typeof row.node.type === 'string' && row.node.type.trim() !== ''
        ? row.node.type
        : undefined;
    if (this.typeLabels?.[0] !== this.types)
      this.typeLabels = [
        this.types,
        new Map(firstByRetrievalIdentity(this.types, (type) => type?.id).map((type) => [type.id, type.label])),
      ];
    const meta = [
      nodeType && (this.typeLabels[1].get(nodeType) ?? nodeType),
      row.node.degree != null
        ? getNumberFormat(this.effectiveLocale).format(
            finiteCount(row.node.degree)
          )
        : undefined,
    ].filter((v): v is string => typeof v === 'string' && v !== '');
    const metaText = getListFormat(this.effectiveLocale, {
      style: 'short',
      type: 'unit',
    }).format(meta);
    return html`
      <button
        part="node-label"
        type="button"
        aria-label=${accessibleName}
        aria-description=${metaText || nothing}
        @click=${() => {
          this.emit('lr-entity-select', { entityId: row.node.id });
        }}
      >
        <span part="direction" aria-hidden="true"
          >${this.directionGlyph(row.direction)}</span
        >
        <span part="relation">${row.relation}</span>
        <span>${nodeLabel}</span>
        ${metaText ? html`<span part="node-meta">${metaText}</span>` : nothing}
      </button>
      ${this.expandable
        ? html`<button
            part="expand-button"
            type="button"
            aria-label=${this.localize('neighborExpand', undefined, {
              label: nodeLabel,
            })}
            @click=${() => this.emit('lr-node-expand', { nodeId: row.node.id })}
          >
            ${expandIcon()}
          </button>`
        : nothing}
    `;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
    this.sourceEpoch++; this.sourceNavigation++; this.sourcePages.adopted(); this.syncSource();
  }

  private renderSource(): TemplateResult {
    const state = this.sourcePages.state, failed = this.sourceError || Boolean(state.error);
    const sourceCurrent = this.sourceCurrent(), page = this.sourcePage;
    const current = () => sourceCurrent() && Object.is(this.sourcePage, page);
    const valid = () => current() && this.sourcePages.state === state && !this.sourceError;
    const rows = !failed && this.centerKey !== null ? state.result?.rows ?? [] : [];
    const label = retrievalSemanticLabel(this, this.label ?? this.localize('neighborListLabel'));
    const role = retrievalSemanticRole(this, 'group');
    const status = this.centerKey === null ? this.localize('neighborSourceChoose') : failed ? this.localize('neighborSourceError') : state.pending ? this.localize('loading') : rows.length ? '' : this.localize('neighborListEmpty');
    const total = this.sourceTotal;
    return html`<div part="base" role=${role ?? nothing} aria-label=${label ?? nothing} aria-busy=${String(state.pending)}>
      ${status ? html`<p part="source-status">${status}</p>` : nothing}
      ${failed ? html`<button part="source-retry" type="button" @click=${() => { if (current() && this.sourcePages.state === state && (this.sourceError || Boolean(state.error))) this.requestUpdate(); }}>${this.localize('retry')}</button>` : nothing}
      ${total !== null ? html`<p part="source-summary">${this.localize('neighborSourceSummary', undefined, { shown: getNumberFormat(this.effectiveLocale).format(rows.length), total: getNumberFormat(this.effectiveLocale).format(total) })}</p>` : nothing}
      <div role="list">${rows.map(row => {
        const name = row.value.accessibleLabel || row.value.label || row.value.id;
        return html`<div part="row" role="listitem"><button part="node-label" type="button" data-source-key=${row.key} aria-label=${name}
          @click=${() => { if (valid() && rows.includes(row)) this.emit('lr-entity-select', { entityId: row.value.id }); }}>${row.value.label || row.value.id}</button>
          ${this.expandable ? html`<button part="expand-button" type="button" aria-label=${this.localize('neighborExpand', undefined, { label: name })}
            @click=${() => { if (valid() && this.expandable && rows.includes(row)) this.emit('lr-node-expand', { nodeId: row.value.id }); }}>${expandIcon()}</button>` : nothing}</div>`;
      })}</div>
      ${this.centerKey !== null ? html`<lr-pagination format="compact" with-edges .page=${finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1}
        .pageSize=${finiteInteger(this.sourcePageSize, 100, 1, 500)} .total=${total ?? -1} .disabled=${failed || state.pending || total === null}
        .strings=${this.strings} @lr-page-change=${(event: CustomEvent<{ page: number }>) => { event.stopPropagation(); if (valid()) this.sourcePage = event.detail.page - 1; }}></lr-pagination>` : nothing}
    </div>`;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (this.graphSource !== undefined) {
      const state = this.sourcePages.state;
      const status = this.sourceError || state.error ? 'error' : state.pending ? 'loading' : 'ready';
      this.announcements.transition('source', status, status === 'error' ? this.localize('neighborSourceError') : status === 'loading' ? this.localize('loading') : '');
      if (state.result && this.sourcePage !== state.page) { this.sourceSyncing = true; this.sourcePage = state.page; this.sourceSyncing = false; if (this.sourcePageBinding) this.sourcePageBinding = [state.page, ...this.sourcePageBinding.slice(1)]; }
    }
  }

  private inputLimitMessage(): string {
    const loss = publicCollectionTruncation(this, 'rows');
    const format = getNumberFormat(this.effectiveLocale);
    return loss ? this.localize('graphDataListLimit', undefined, {
      shown: format.format(loss.retained), total: format.format(loss.source),
    }) : '';
  }

  private renderInputLimit(): TemplateResult | typeof nothing {
    const message = this.inputLimitMessage();
    return message ? html`<p part="limit" role="note">${message}</p>` : nothing;
  }

  override render(): TemplateResult {
    if (this.graphSource !== undefined) return this.renderSource();
    const sorted = this.sortedRows();
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('neighborListLabel') : this.label
    );
    const role = retrievalSemanticRole(this, 'group');
    if (sorted.length === 0) {
      // `heading` is passed as slotted light-DOM content (rather than the `heading` attribute)
      // so `[part="empty"]`'s `.textContent` -- a plain DOM accessor, which never pierces
      // `lr-empty`'s own shadow root -- actually includes the message; see
      // `<lr-chunk-inspector>`'s identical pattern/comment for the same reasoning.
      return html`<div
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        ${this.renderInputLimit()}
        <lr-empty part="empty"
          ><span slot="heading"
            >${this.localize('neighborListEmpty')}</span
          ></lr-empty
        >
      </div>`;
    }
    if (sorted.length > this.effectiveVirtualizeAt) {
      return html`
        <div part="base" role=${role ?? nothing} aria-label=${label ?? nothing}>
          ${this.renderInputLimit()}
          <lr-virtual-list
            exportparts="row:row, node-label:node-label, direction:direction, relation:relation, node-meta:node-meta, expand-button:expand-button, group:group-header"
            .items=${guard([sorted], () => sorted)}
            .renderItem=${this.renderRow}
            .keyFunction=${this.virtualListKeyFunction}
            .groups=${this.groups(sorted)}
          ></lr-virtual-list>
        </div>
      `;
    }
    const groups = this.groups(sorted);
    // Looked up once per row below -- indexing by startIndex up front keeps the render O(rows +
    // groups) instead of rescanning the whole `groups` array (O(groups)) for every row
    // (O(rows x groups), worst-case O(n^2) since groups can scale with distinct relations up to
    // one per row).
    const groupsByStartIndex = new Map(
      groups?.map((g) => [g.startIndex, g]) ?? []
    );
    return html`
      <div part="base" role=${role ?? nothing} aria-label=${label ?? nothing}>
        ${this.renderInputLimit()}
        <div role="list">
          ${sorted.map((row, i) => {
            const group = groupsByStartIndex.get(i);
            // `role="presentation"` (not `role="heading"`) -- ARIA's `list` role only owns
            // `listitem` children, so an explicit `heading` role here would be a disallowed child
            // (same convention as `<lr-node-palette>`'s identical category-header part).
            return html`${group
                ? html`<div part="group-header" role="presentation">
                    ${group.label}
                  </div>`
                : nothing}
              <div part="row" role="listitem">
                ${this.renderNeighborRow(row)}
              </div>`;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-neighbor-list': LyraNeighborList;
  }
}
